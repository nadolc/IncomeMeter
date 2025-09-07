using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.Services.Interfaces;

namespace IncomeMeter.Api.Middleware;

/// <summary>
/// Enhanced authentication middleware supporting both legacy API keys and new JWT tokens
/// </summary>
public class JwtApiAuthenticationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<JwtApiAuthenticationMiddleware> _logger;

    public JwtApiAuthenticationMiddleware(RequestDelegate next, ILogger<JwtApiAuthenticationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IUserService userService, IJwtApiTokenService? jwtTokenService = null)
    {
        _logger.LogInformation("JWT middleware processing request: {Method} {Path}", context.Request.Method, context.Request.Path);
        
        // Skip authentication for certain paths
        if (ShouldSkipAuthentication(context.Request.Path))
        {
            _logger.LogInformation("Skipping authentication for path: {Path}", context.Request.Path);
            await _next(context);
            return;
        }

        // Check if user is already authenticated by built-in authentication
        var wasAlreadyAuthenticated = context.User?.Identity?.IsAuthenticated ?? false;
        _logger.LogInformation("User already authenticated by built-in auth: {IsAuthenticated}, Identity: {IdentityType}", 
            wasAlreadyAuthenticated, context.User?.Identity?.AuthenticationType ?? "None");
        
        // Only attempt custom authentication if built-in authentication failed
        if (!wasAlreadyAuthenticated)
        {
            _logger.LogInformation("Built-in authentication failed, attempting custom authentication");
            var authResult = await AuthenticateRequestAsync(context, userService, jwtTokenService);
            
            _logger.LogInformation("Custom authentication result: IsAuthenticated={IsAuthenticated}, Method={AuthMethod}, Path={Path}", 
                authResult.IsAuthenticated, authResult.AuthMethod, context.Request.Path);
            
            if (authResult.IsAuthenticated)
            {
                context.User = authResult.Principal!;
                context.Items["User"] = authResult.User;
                context.Items["AuthenticationMethod"] = authResult.AuthMethod;
                
                // Store client IP for tracking
                var clientIp = GetClientIpAddress(context);
                context.Items["ClientIp"] = clientIp;
                
                _logger.LogInformation("User authenticated via custom {Method}: {Email}", 
                    authResult.AuthMethod, authResult.User?.Email);
            }
            else
            {
                _logger.LogWarning("Custom authentication also failed - user will remain unauthenticated. Path: {Path}", context.Request.Path);
            }
        }
        else
        {
            _logger.LogInformation("User already authenticated via built-in authentication: {Email}, AuthType: {AuthType}", 
                context.User?.Identity?.Name ?? "Unknown", 
                context.User?.Identity?.AuthenticationType ?? "Unknown");
        }

        await _next(context);
    }

    private async Task<AuthenticationResult> AuthenticateRequestAsync(
        HttpContext context, 
        IUserService userService, 
        IJwtApiTokenService? jwtTokenService)
    {
        // Try to get the token from the Authorization header
        if (!context.Request.Headers.TryGetValue("Authorization", out var authHeader) ||
            !authHeader.ToString().StartsWith("Bearer "))
        {
            _logger.LogDebug("No valid Authorization header found");
            return AuthenticationResult.Failed();
        }

        var token = authHeader.ToString().Substring("Bearer ".Length);
        _logger.LogDebug("Found Bearer token, length: {TokenLength}", token.Length);
        
        // Determine if this is a JWT token or legacy API key
        if (IsJwtToken(token))
        {
            _logger.LogDebug("Token identified as JWT, attempting JWT authentication");
            return await AuthenticateJwtTokenAsync(token, userService, jwtTokenService, context);
        }
        else
        {
            _logger.LogDebug("Token identified as legacy API key, attempting legacy authentication");
            return await AuthenticateLegacyApiKeyAsync(token, userService);
        }
    }

    private async Task<AuthenticationResult> AuthenticateJwtTokenAsync(
        string token, 
        IUserService userService, 
        IJwtApiTokenService? jwtTokenService,
        HttpContext context)
    {
        try
        {
            _logger.LogInformation("Starting JWT token authentication process");
            
            // First, try to validate as a web authentication JWT (created by AuthController)
            _logger.LogInformation("Attempting web authentication JWT validation first");
            var webAuthResult = await TryValidateWebAuthJwtAsync(token, userService, context);
            if (webAuthResult.IsAuthenticated)
            {
                _logger.LogInformation("Web authentication JWT validation successful");
                return webAuthResult;
            }
            
            _logger.LogInformation("Web authentication JWT validation failed, trying API token validation");

            // If not a web auth JWT, try to validate as an API token (created by JwtApiTokenService)
            if (jwtTokenService != null)
            {
                var apiTokenResult = await TryValidateApiTokenAsync(token, userService, jwtTokenService, context);
                if (apiTokenResult.IsAuthenticated)
                {
                    _logger.LogInformation("API token JWT validation successful");
                    return apiTokenResult;
                }
                _logger.LogInformation("API token JWT validation also failed");
            }
            else
            {
                _logger.LogInformation("JwtApiTokenService is null, skipping API token validation");
            }

            _logger.LogWarning("JWT token validation failed for both web auth and API token - token is invalid or expired");
            return AuthenticationResult.Failed();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "JWT token authentication failed with unexpected exception: {Message}", ex.Message);
            return AuthenticationResult.Failed();
        }
    }

    private async Task<AuthenticationResult> TryValidateWebAuthJwtAsync(string token, IUserService userService, HttpContext context)
    {
        try
        {
            _logger.LogInformation("Attempting to validate web authentication JWT");
            
            // Get configuration from service provider
            var configuration = context.RequestServices.GetRequiredService<IConfiguration>();
            
            // Get JWT secret from configuration (same as JwtApiTokenService)
            var jwtSecret = configuration["Jwt:SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey not configured");
            _logger.LogInformation("Using JWT secret from Jwt:SecretKey configuration");

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(jwtSecret);

            var issuer = configuration["Jwt:Issuer"] ?? "IncomeMeter";
            var audience = configuration["Jwt:Audience"] ?? "IncomeMeter-API";
            
            _logger.LogInformation("JWT Validation Parameters: Issuer={Issuer}, Audience={Audience}", 
                issuer, audience);

            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = issuer,
                ValidateAudience = true,
                ValidAudience = audience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };

            var principal = tokenHandler.ValidateToken(token, validationParameters, out var validatedToken);
            _logger.LogInformation("JWT token structure validation successful");
            
            // Get user ID from token
            var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            _logger.LogInformation("Extracted User ID from JWT: {UserId}", userId?.Substring(0, Math.Min(8, userId?.Length ?? 0)) + "***");
            
            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("JWT token validation failed: No NameIdentifier claim found");
                return AuthenticationResult.Failed();
            }

            // Get user from database
            var user = await userService.GetUserByIdAsync(userId);
            if (user == null)
            {
                _logger.LogWarning("JWT token validation failed: User not found in database for ID: {UserId}", 
                    userId.Substring(0, Math.Min(8, userId.Length)) + "***");
                return AuthenticationResult.Failed();
            }

            _logger.LogInformation("Web authentication JWT validated successfully for user: {Email}", user.Email);
            return AuthenticationResult.Success(user, principal, "WebAuthJWT");
        }
        catch (SecurityTokenValidationException ex)
        {
            _logger.LogWarning(ex, "JWT token validation failed - Security token validation error: {Message}", ex.Message);
            return AuthenticationResult.Failed();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Web authentication JWT validation failed with unexpected error: {Message}", ex.Message);
            return AuthenticationResult.Failed();
        }
    }

    private async Task<AuthenticationResult> TryValidateApiTokenAsync(
        string token, 
        IUserService userService, 
        IJwtApiTokenService jwtTokenService,
        HttpContext context)
    {
        try
        {
            // Validate JWT token structure and signature
            var principal = jwtTokenService.ValidateTokenAndGetPrincipal(token);
            if (principal == null)
            {
                return AuthenticationResult.Failed();
            }

            // Additional validation against database (revocation check, usage tracking)
            var isValid = await jwtTokenService.ValidateTokenAsync(token);
            if (!isValid)
            {
                return AuthenticationResult.Failed();
            }

            var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return AuthenticationResult.Failed();
            }

            var user = await userService.GetUserByIdAsync(userId);
            if (user == null)
            {
                return AuthenticationResult.Failed();
            }

            // Check token scopes for authorization
            var scopes = principal.FindFirst("scopes")?.Value?.Split(' ') ?? Array.Empty<string>();
            AddScopesToContext(context, scopes);

            _logger.LogDebug("API JWT token authenticated for user: {Email} with scopes: {Scopes}", 
                user.Email, string.Join(", ", scopes));

            return AuthenticationResult.Success(user, principal, "JWT");
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "API JWT token validation failed");
            return AuthenticationResult.Failed();
        }
    }

    private async Task<AuthenticationResult> AuthenticateLegacyApiKeyAsync(string apiKey, IUserService userService)
    {
        try
        {
            // Hash the provided key to compare against stored hashes
            using var sha256 = SHA256.Create();
            var keyHash = BitConverter.ToString(sha256.ComputeHash(Encoding.UTF8.GetBytes(apiKey)))
                .Replace("-", "").ToLower();

            // Find the user associated with this key hash
            var user = await userService.GetUserByApiKeyHashAsync(keyHash);
            if (user == null)
            {
                _logger.LogDebug("Legacy API key not found");
                return AuthenticationResult.Failed();
            }

            // Create claims principal for legacy API key
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id!),
                new Claim(ClaimTypes.Name, user.DisplayName ?? user.Email),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim("auth_method", "legacy_api_key")
            };

            var identity = new ClaimsIdentity(claims, "ApiKey");
            var principal = new ClaimsPrincipal(identity);

            _logger.LogDebug("Legacy API key authenticated for user: {Email}", user.Email);

            return AuthenticationResult.Success(user, principal, "LegacyApiKey");
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Legacy API key authentication failed");
            return AuthenticationResult.Failed();
        }
    }

    private static bool IsJwtToken(string token)
    {
        // JWT tokens have three parts separated by dots
        var parts = token.Split('.');
        return parts.Length == 3;
    }

    private static bool ShouldSkipAuthentication(PathString path)
    {
        var skipPaths = new[]
        {
            "/api/auth",
            "/api/health",
            "/api/diagnostics",
            "/swagger",
            "/favicon.ico"
        };

        return skipPaths.Any(skipPath => path.StartsWithSegments(skipPath));
    }

    private static void AddScopesToContext(HttpContext context, string[] scopes)
    {
        context.Items["TokenScopes"] = scopes;
    }

    private static string GetClientIpAddress(HttpContext context)
    {
        // Try to get IP from X-Forwarded-For header first (for load balancers/proxies)
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            return forwardedFor.Split(',')[0].Trim();
        }

        // Try X-Real-IP header
        var realIp = context.Request.Headers["X-Real-IP"].FirstOrDefault();
        if (!string.IsNullOrEmpty(realIp))
        {
            return realIp;
        }

        // Fall back to remote IP address
        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private class AuthenticationResult
    {
        public bool IsAuthenticated { get; private set; }
        public Models.User? User { get; private set; }
        public ClaimsPrincipal? Principal { get; private set; }
        public string AuthMethod { get; private set; } = string.Empty;

        public static AuthenticationResult Success(Models.User user, ClaimsPrincipal principal, string authMethod)
        {
            return new AuthenticationResult
            {
                IsAuthenticated = true,
                User = user,
                Principal = principal,
                AuthMethod = authMethod
            };
        }

        public static AuthenticationResult Failed()
        {
            return new AuthenticationResult
            {
                IsAuthenticated = false
            };
        }
    }
}

/// <summary>
/// Authorization attribute to check for specific scopes
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class RequireScopesAttribute : Attribute
{
    public string[] RequiredScopes { get; }

    public RequireScopesAttribute(params string[] scopes)
    {
        RequiredScopes = scopes ?? Array.Empty<string>();
    }
}

/// <summary>
/// Middleware to enforce scope-based authorization
/// </summary>
public class ScopeAuthorizationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ScopeAuthorizationMiddleware> _logger;

    public ScopeAuthorizationMiddleware(RequestDelegate next, ILogger<ScopeAuthorizationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Only check scopes for authenticated requests using JWT tokens
        var authMethod = context.Items["AuthenticationMethod"] as string;
        if (authMethod != "JWT")
        {
            await _next(context);
            return;
        }

        var tokenScopes = context.Items["TokenScopes"] as string[] ?? Array.Empty<string>();
        var endpoint = context.GetEndpoint();
        
        if (endpoint != null)
        {
            var requireScopesAttribute = endpoint.Metadata.GetMetadata<RequireScopesAttribute>();
            if (requireScopesAttribute != null && requireScopesAttribute.RequiredScopes.Length > 0)
            {
                var hasRequiredScope = requireScopesAttribute.RequiredScopes
                    .Any(requiredScope => tokenScopes.Contains(requiredScope));

                if (!hasRequiredScope)
                {
                    _logger.LogWarning("Access denied. Required scopes: {RequiredScopes}, Token scopes: {TokenScopes}",
                        string.Join(", ", requireScopesAttribute.RequiredScopes),
                        string.Join(", ", tokenScopes));
                    
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsync("Insufficient scope for this operation");
                    return;
                }
            }
        }

        await _next(context);
    }
}