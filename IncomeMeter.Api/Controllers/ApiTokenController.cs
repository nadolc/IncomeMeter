using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Middleware;

namespace IncomeMeter.Api.Controllers;

/// <summary>
/// API Token management endpoints for generating, refreshing, and revoking JWT-based API tokens
/// </summary>
[ApiController]
[Route("api/tokens")]
[Authorize(AuthenticationSchemes = "Bearer")] // Requires Bearer token authentication
public class ApiTokenController : ControllerBase
{
    private readonly IJwtApiTokenService _jwtApiTokenService;
    private readonly ILogger<ApiTokenController> _logger;

    public ApiTokenController(
        IJwtApiTokenService jwtApiTokenService,
        ILogger<ApiTokenController> logger)
    {
        _jwtApiTokenService = jwtApiTokenService;
        _logger = logger;
    }

    private string GetCurrentUserId()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
               ?? throw new UnauthorizedAccessException("User ID not found in claims");
    }

    /// <summary>
    /// Generate a new API token with specified scopes and expiration
    /// </summary>
    /// <param name="request">Token generation request</param>
    /// <returns>Generated API token with refresh token</returns>
    [HttpPost("generate")]
    [ProducesResponseType(typeof(ApiTokenResponse), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(401)]
    public async Task<IActionResult> GenerateToken([FromBody] ApiTokenRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            var tokenResponse = await _jwtApiTokenService.GenerateApiTokenAsync(userId, request);
            
            _logger.LogInformation("Generated API token for user {UserId} with description: {Description}", 
                userId, request.Description);

            return Ok(tokenResponse);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid token generation request");
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating API token");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    /// <summary>
    /// Refresh an existing API token using a refresh token
    /// </summary>
    /// <param name="request">Refresh token request</param>
    /// <returns>New API token</returns>
    [HttpPost("refresh")]
    [AllowAnonymous] // Allow anonymous access since this uses refresh token authentication
    [ProducesResponseType(typeof(ApiTokenResponse), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(401)]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        try
        {
            var tokenResponse = await _jwtApiTokenService.RefreshTokenAsync(request.RefreshToken);
            
            _logger.LogInformation("Refreshed API token");
            return Ok(tokenResponse);
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning(ex, "Invalid refresh token");
            return Unauthorized(new { message = "Invalid refresh token" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error refreshing API token");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    /// <summary>
    /// Get all active API tokens for the current user
    /// </summary>
    /// <returns>List of user's API tokens</returns>
    [HttpGet("")]
    [ProducesResponseType(typeof(List<ApiTokenInfo>), 200)]
    [ProducesResponseType(401)]
    public async Task<IActionResult> GetUserTokens()
    {
        try
        {
            var userId = GetCurrentUserId();
            var tokens = await _jwtApiTokenService.GetUserTokensAsync(userId);
            
            return Ok(tokens);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user tokens");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    /// <summary>
    /// Revoke a specific API token
    /// </summary>
    /// <param name="request">Token revocation request</param>
    /// <returns>Success status</returns>
    [HttpPost("revoke")]
    [ProducesResponseType(200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(401)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> RevokeToken([FromBody] RevokeTokenRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            var success = await _jwtApiTokenService.RevokeTokenAsync(request.TokenId, userId);
            
            if (!success)
            {
                return NotFound(new { message = "Token not found" });
            }

            _logger.LogInformation("Revoked API token {TokenId} for user {UserId}", 
                request.TokenId, userId);

            return Ok(new { message = "Token revoked successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking token");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    /// <summary>
    /// Get available scopes for API token generation
    /// </summary>
    /// <returns>List of available scopes with descriptions</returns>
    [HttpGet("scopes")]
    [ProducesResponseType(typeof(object), 200)]
    public IActionResult GetAvailableScopes()
    {
        var scopes = new
        {
            available_scopes = new[]
            {
                new { scope = ApiScopes.ReadRoutes, description = "Read route data" },
                new { scope = ApiScopes.WriteRoutes, description = "Create and update routes" },
                new { scope = ApiScopes.DeleteRoutes, description = "Delete routes" },
                new { scope = ApiScopes.ReadLocations, description = "Read location data" },
                new { scope = ApiScopes.WriteLocations, description = "Create and update locations" },
                new { scope = ApiScopes.DeleteLocations, description = "Delete locations" },
                new { scope = ApiScopes.ReadDashboard, description = "Access dashboard data" },
                new { scope = ApiScopes.ReadConfiguration, description = "Read user configuration" },
                new { scope = ApiScopes.ReadUsers, description = "Read user information" }
            },
            default_scopes = ApiScopes.DefaultScopes,
            readonly_scopes = ApiScopes.ReadOnlyScopes
        };

        return Ok(scopes);
    }

    /// <summary>
    /// Validate a token and return its information
    /// </summary>
    /// <param name="token">Token to validate (from query parameter for easy testing)</param>
    /// <returns>Token validation result</returns>
    [HttpGet("validate")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(object), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(401)]
    public async Task<IActionResult> ValidateToken([FromQuery] string token)
    {
        if (string.IsNullOrEmpty(token))
        {
            return BadRequest(new { message = "Token parameter is required" });
        }

        try
        {
            var isValid = await _jwtApiTokenService.ValidateTokenAsync(token);
            if (!isValid)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var principal = _jwtApiTokenService.ValidateTokenAndGetPrincipal(token);
            if (principal == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var tokenInfo = new
            {
                valid = true,
                user_id = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value,
                user_email = principal.FindFirst(ClaimTypes.Email)?.Value,
                token_id = principal.FindFirst("jti")?.Value,
                scopes = principal.FindFirst("scopes")?.Value?.Split(' ') ?? Array.Empty<string>(),
                expires_at = principal.FindFirst("exp")?.Value,
                issued_at = principal.FindFirst("iat")?.Value,
                description = principal.FindFirst("description")?.Value
            };

            return Ok(tokenInfo);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Token validation failed");
            return Unauthorized(new { message = "Invalid token" });
        }
    }
}

/// <summary>
/// Public OAuth-style token endpoint for external applications
/// </summary>
[ApiController]
[Route("oauth/token")]
public class OAuthTokenController : ControllerBase
{
    private readonly IJwtApiTokenService _jwtApiTokenService;
    private readonly ILogger<OAuthTokenController> _logger;

    public OAuthTokenController(
        IJwtApiTokenService jwtApiTokenService,
        ILogger<OAuthTokenController> logger)
    {
        _jwtApiTokenService = jwtApiTokenService;
        _logger = logger;
    }

    /// <summary>
    /// OAuth 2.0 compatible token refresh endpoint
    /// </summary>
    /// <param name="grant_type">Must be "refresh_token"</param>
    /// <param name="refresh_token">The refresh token</param>
    /// <returns>New access token</returns>
    [HttpPost("")]
    [Consumes("application/x-www-form-urlencoded")]
    [ProducesResponseType(typeof(object), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(401)]
    public async Task<IActionResult> Token(
        [FromForm] string grant_type,
        [FromForm] string refresh_token)
    {
        if (grant_type != "refresh_token")
        {
            return BadRequest(new 
            { 
                error = "unsupported_grant_type",
                error_description = "Only refresh_token grant type is supported"
            });
        }

        if (string.IsNullOrEmpty(refresh_token))
        {
            return BadRequest(new 
            { 
                error = "invalid_request",
                error_description = "refresh_token parameter is required"
            });
        }

        try
        {
            var tokenResponse = await _jwtApiTokenService.RefreshTokenAsync(refresh_token);
            
            // Return OAuth 2.0 compatible response
            var response = new
            {
                access_token = tokenResponse.AccessToken,
                refresh_token = tokenResponse.RefreshToken,
                token_type = tokenResponse.TokenType.ToLowerInvariant(),
                expires_in = tokenResponse.ExpiresIn,
                scope = string.Join(" ", tokenResponse.Scopes)
            };

            return Ok(response);
        }
        catch (SecurityTokenException)
        {
            return Unauthorized(new 
            { 
                error = "invalid_grant",
                error_description = "The refresh token is invalid or expired"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in OAuth token endpoint");
            return StatusCode(500, new 
            { 
                error = "server_error",
                error_description = "Internal server error"
            });
        }
    }
}