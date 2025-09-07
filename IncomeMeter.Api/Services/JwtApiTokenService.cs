using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Services.Interfaces;

namespace IncomeMeter.Api.Services;

public interface IJwtApiTokenService
{
    Task<ApiTokenResponse> GenerateApiTokenAsync(string userId, ApiTokenRequest request);
    Task<ApiTokenResponse> RefreshTokenAsync(string refreshToken);
    Task<bool> RevokeTokenAsync(string tokenId, string userId);
    Task<bool> ValidateTokenAsync(string token);
    ClaimsPrincipal? ValidateTokenAndGetPrincipal(string token, bool validateExpiry = true);
    Task<List<ApiTokenInfo>> GetUserTokensAsync(string userId);
}

public class JwtApiTokenService : IJwtApiTokenService
{
    private readonly IConfiguration _configuration;
    private readonly IUserService _userService;
    private readonly ILogger<JwtApiTokenService> _logger;
    private readonly string _secretKey;
    private readonly string _issuer;
    private readonly string _audience;

    public JwtApiTokenService(
        IConfiguration configuration,
        IUserService userService,
        ILogger<JwtApiTokenService> logger)
    {
        _configuration = configuration;
        _userService = userService;
        _logger = logger;
        _secretKey = _configuration["Jwt:SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey not configured");
        _issuer = _configuration["Jwt:Issuer"] ?? "IncomeMeter";
        _audience = _configuration["Jwt:Audience"] ?? "IncomeMeter-API";
    }

    public async Task<ApiTokenResponse> GenerateApiTokenAsync(string userId, ApiTokenRequest request)
    {
        try
        {
            var user = await _userService.GetUserByIdAsync(userId);
            if (user == null)
            {
                throw new InvalidOperationException("User not found");
            }

            // Generate unique token ID for revocation capability
            var tokenId = Guid.NewGuid().ToString();
            var refreshTokenId = Guid.NewGuid().ToString();

            // Determine expiry based on request or default to 1 year
            var accessTokenExpiry = request.ExpiryDays.HasValue 
                ? TimeSpan.FromDays(request.ExpiryDays.Value)
                : TimeSpan.FromDays(365);

            var refreshTokenExpiry = TimeSpan.FromDays(730); // 2 years

            // Validate and set scopes
            var scopes = ValidateAndNormalizeScopes(request.Scopes);

            // Generate access token
            var accessTokenClaims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim(ClaimTypes.Name, user.DisplayName),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim("sub", userId),
                new Claim("jti", tokenId),
                new Claim("token_type", "api_access"),
                new Claim("scopes", string.Join(" ", scopes)),
                new Claim("description", request.Description ?? string.Empty),
                new Claim("iat", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            };

            var accessToken = GenerateJwtToken(accessTokenClaims, accessTokenExpiry);

            // Generate refresh token
            var refreshTokenClaims = new[]
            {
                new Claim("sub", userId),
                new Claim("jti", refreshTokenId),
                new Claim("token_type", "refresh"),
                new Claim("access_token_id", tokenId),
                new Claim("iat", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            };

            var refreshToken = GenerateJwtToken(refreshTokenClaims, refreshTokenExpiry);

            // Store token metadata in user record
            var apiToken = new ApiToken
            {
                Id = tokenId,
                TokenHash = ComputeTokenHash(accessToken), // Store hash for validation
                RefreshTokenId = refreshTokenId,
                RefreshTokenHash = ComputeTokenHash(refreshToken),
                Description = request.Description ?? "API Access Token",
                Scopes = scopes.ToList(),
                ExpiresAt = DateTime.UtcNow.Add(accessTokenExpiry),
                RefreshExpiresAt = DateTime.UtcNow.Add(refreshTokenExpiry),
                CreatedAt = DateTime.UtcNow,
                LastUsedAt = null,
                IsActive = true,
                UsageCount = 0
            };

            // Add token to user's token list
            user.ApiTokens ??= new List<ApiToken>();
            user.ApiTokens.Add(apiToken);
            await _userService.UpdateUserAsync(user);

            _logger.LogInformation("Generated API token for user {UserId} with scopes: {Scopes}", 
                userId, string.Join(", ", scopes));

            return new ApiTokenResponse
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                TokenType = "Bearer",
                ExpiresIn = (int)accessTokenExpiry.TotalSeconds,
                ExpiresAt = DateTime.UtcNow.Add(accessTokenExpiry),
                Scopes = scopes.ToArray(),
                TokenId = tokenId,
                Description = apiToken.Description
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating API token for user {UserId}", userId);
            throw;
        }
    }

    public async Task<ApiTokenResponse> RefreshTokenAsync(string refreshToken)
    {
        try
        {
            var principal = ValidateTokenAndGetPrincipal(refreshToken, validateExpiry: true);
            if (principal == null)
            {
                throw new SecurityTokenException("Invalid refresh token");
            }

            var tokenType = principal.FindFirst("token_type")?.Value;
            if (tokenType != "refresh")
            {
                throw new SecurityTokenException("Token is not a refresh token");
            }

            var userId = principal.FindFirst("sub")?.Value;
            var refreshTokenId = principal.FindFirst("jti")?.Value;
            var accessTokenId = principal.FindFirst("access_token_id")?.Value;

            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(refreshTokenId))
            {
                throw new SecurityTokenException("Invalid refresh token claims");
            }

            var user = await _userService.GetUserByIdAsync(userId);
            if (user?.ApiTokens == null)
            {
                throw new SecurityTokenException("User or tokens not found");
            }

            // Find the original token to refresh
            var originalToken = user.ApiTokens.FirstOrDefault(t => 
                t.Id == accessTokenId && t.RefreshTokenId == refreshTokenId && t.IsActive);

            if (originalToken == null)
            {
                throw new SecurityTokenException("Original token not found or inactive");
            }

            // Generate new access token with same scopes and description
            var newTokenRequest = new ApiTokenRequest
            {
                Description = originalToken.Description,
                Scopes = originalToken.Scopes.ToArray(),
                ExpiryDays = 365 // Default to 1 year
            };

            // Revoke the old token
            originalToken.IsActive = false;
            originalToken.RevokedAt = DateTime.UtcNow;

            await _userService.UpdateUserAsync(user);

            // Generate new token
            var newTokenResponse = await GenerateApiTokenAsync(userId, newTokenRequest);

            _logger.LogInformation("Refreshed API token for user {UserId}", userId);

            return newTokenResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error refreshing API token");
            throw;
        }
    }

    public async Task<bool> RevokeTokenAsync(string tokenId, string userId)
    {
        try
        {
            var user = await _userService.GetUserByIdAsync(userId);
            if (user?.ApiTokens == null)
            {
                return false;
            }

            var token = user.ApiTokens.FirstOrDefault(t => t.Id == tokenId);
            if (token == null)
            {
                return false;
            }

            token.IsActive = false;
            token.RevokedAt = DateTime.UtcNow;
            
            await _userService.UpdateUserAsync(user);

            _logger.LogInformation("Revoked API token {TokenId} for user {UserId}", tokenId, userId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking token {TokenId} for user {UserId}", tokenId, userId);
            return false;
        }
    }

    public async Task<bool> ValidateTokenAsync(string token)
    {
        try
        {
            var principal = ValidateTokenAndGetPrincipal(token);
            if (principal == null) return false;

            var tokenId = principal.FindFirst("jti")?.Value;
            var userId = principal.FindFirst("sub")?.Value;

            if (string.IsNullOrEmpty(tokenId) || string.IsNullOrEmpty(userId))
                return false;

            // Check if token is active in database
            var user = await _userService.GetUserByIdAsync(userId);
            var apiToken = user?.ApiTokens?.FirstOrDefault(t => t.Id == tokenId);

            if (apiToken == null || !apiToken.IsActive)
                return false;

            // Update last used timestamp
            apiToken.LastUsedAt = DateTime.UtcNow;
            apiToken.UsageCount++;
            await _userService.UpdateUserAsync(user!);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Token validation failed");
            return false;
        }
    }

    public ClaimsPrincipal? ValidateTokenAndGetPrincipal(string token, bool validateExpiry = true)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_secretKey);

            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = _issuer,
                ValidateAudience = true,
                ValidAudience = _audience,
                ValidateLifetime = validateExpiry,
                ClockSkew = TimeSpan.Zero
            };

            var principal = tokenHandler.ValidateToken(token, validationParameters, out var validatedToken);
            return principal;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Token validation failed");
            return null;
        }
    }

    public async Task<List<ApiTokenInfo>> GetUserTokensAsync(string userId)
    {
        var user = await _userService.GetUserByIdAsync(userId);
        if (user?.ApiTokens == null)
        {
            return new List<ApiTokenInfo>();
        }

        return user.ApiTokens
            .Where(t => t.IsActive)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new ApiTokenInfo
            {
                TokenId = t.Id,
                Description = t.Description,
                Scopes = t.Scopes.ToArray(),
                CreatedAt = t.CreatedAt,
                ExpiresAt = t.ExpiresAt,
                LastUsedAt = t.LastUsedAt,
                UsageCount = t.UsageCount,
                DaysUntilExpiry = (t.ExpiresAt - DateTime.UtcNow).Days
            })
            .ToList();
    }

    private string GenerateJwtToken(Claim[] claims, TimeSpan expiry)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        
        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: DateTime.UtcNow.Add(expiry),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string[] ValidateAndNormalizeScopes(string[]? requestedScopes)
    {
        var availableScopes = new[]
        {
            "read:routes", "write:routes", "delete:routes",
            "read:locations", "write:locations", "delete:locations",
            "read:dashboard", "read:configuration", "read:users"
        };

        if (requestedScopes == null || requestedScopes.Length == 0)
        {
            // Default scopes for API access
            return new[] { "read:routes", "write:routes", "read:locations", "write:locations", "read:dashboard" };
        }

        // Validate requested scopes
        var validScopes = requestedScopes
            .Where(s => availableScopes.Contains(s))
            .Distinct()
            .ToArray();

        if (validScopes.Length == 0)
        {
            throw new ArgumentException("No valid scopes provided");
        }

        return validScopes;
    }

    private static string ComputeTokenHash(string token)
    {
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}