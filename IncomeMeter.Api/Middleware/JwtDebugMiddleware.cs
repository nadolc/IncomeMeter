using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace IncomeMeter.Api.Middleware;

/// <summary>
/// Middleware to debug JWT Bearer authentication issues
/// </summary>
public class JwtDebugMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<JwtDebugMiddleware> _logger;
    private readonly IConfiguration _configuration;

    public JwtDebugMiddleware(RequestDelegate next, ILogger<JwtDebugMiddleware> logger, IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _configuration = configuration;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Only debug JWT authentication for API paths that require authentication
        var path = context.Request.Path.ToString().ToLower();
        var shouldDebug = path.StartsWith("/api/configuration") || path.StartsWith("/api/auth/profile");

        if (shouldDebug)
        {
            _logger.LogInformation("=== JWT DEBUG START for {Path} ===", context.Request.Path);
            
            // Log authorization header
            if (context.Request.Headers.TryGetValue("Authorization", out var authHeaders))
            {
                var authHeader = authHeaders.ToString();
                _logger.LogInformation("Authorization header found: {HeaderStart}...", 
                    authHeader.Length > 20 ? authHeader.Substring(0, 20) : authHeader);
                
                if (authHeader.StartsWith("Bearer "))
                {
                    var token = authHeader.Substring("Bearer ".Length);
                    await DebugJwtTokenAsync(token);
                }
            }
            else
            {
                _logger.LogWarning("No Authorization header found");
            }
            
            // Log current user state before processing
            _logger.LogInformation("User authenticated before processing: {IsAuth}, Identity: {Identity}", 
                context.User?.Identity?.IsAuthenticated ?? false,
                context.User?.Identity?.AuthenticationType ?? "None");
        }

        await _next(context);

        if (shouldDebug)
        {
            // Log user state after processing
            _logger.LogInformation("User authenticated after processing: {IsAuth}, Identity: {Identity}, Name: {Name}", 
                context.User?.Identity?.IsAuthenticated ?? false,
                context.User?.Identity?.AuthenticationType ?? "None",
                context.User?.Identity?.Name ?? "Unknown");
            
            _logger.LogInformation("=== JWT DEBUG END for {Path} ===", context.Request.Path);
        }
    }

    private async Task DebugJwtTokenAsync(string token)
    {
        try
        {
            _logger.LogInformation("Attempting to debug JWT token, length: {Length}", token.Length);
            
            // Parse token without validation to see its contents
            var handler = new JwtSecurityTokenHandler();
            var jsonToken = handler.ReadJwtToken(token);
            
            _logger.LogInformation("JWT Token parsed successfully:");
            _logger.LogInformation("  Algorithm: {Alg}", jsonToken.Header.Alg);
            _logger.LogInformation("  Type: {Typ}", jsonToken.Header.Typ);
            _logger.LogInformation("  Issuer: {Iss}", jsonToken.Issuer);
            _logger.LogInformation("  Audience: {Aud}", string.Join(", ", jsonToken.Audiences));
            _logger.LogInformation("  Expires: {Exp}", jsonToken.ValidTo);
            _logger.LogInformation("  Claims count: {ClaimsCount}", jsonToken.Claims.Count());
            
            // Log key claims
            var sub = jsonToken.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;
            var email = jsonToken.Claims.FirstOrDefault(c => c.Type.Contains("email"))?.Value;
            var tokenType = jsonToken.Claims.FirstOrDefault(c => c.Type == "token_type")?.Value;
            
            _logger.LogInformation("  Subject: {Sub}", sub);
            _logger.LogInformation("  Email: {Email}", email);
            _logger.LogInformation("  Token Type: {TokenType}", tokenType ?? "Not specified");
            
            // Test validation with current configuration
            await TestJwtValidationAsync(token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to debug JWT token: {Error}", ex.Message);
        }
    }

    private async Task TestJwtValidationAsync(string token)
    {
        try
        {
            _logger.LogInformation("Testing JWT validation with current configuration...");
            
            var jwtSecret = _configuration["Jwt:SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey not configured");
            var issuer = _configuration["Jwt:Issuer"] ?? "IncomeMeter";
            var audience = _configuration["Jwt:Audience"] ?? "IncomeMeter-API";
            
            _logger.LogInformation("Using JWT configuration:");
            _logger.LogInformation("  Secret length: {SecretLength}", jwtSecret.Length);
            _logger.LogInformation("  Issuer: {Issuer}", issuer);
            _logger.LogInformation("  Audience: {Audience}", audience);
            
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(jwtSecret);

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
            _logger.LogInformation("✅ JWT validation SUCCESSFUL!");
            _logger.LogInformation("  Validated token type: {TokenType}", validatedToken.GetType().Name);
            _logger.LogInformation("  Principal claims count: {ClaimsCount}", principal.Claims.Count());
        }
        catch (SecurityTokenExpiredException ex)
        {
            _logger.LogWarning("❌ JWT validation failed - Token expired: {Error}", ex.Message);
        }
        catch (SecurityTokenInvalidSignatureException ex)
        {
            _logger.LogWarning("❌ JWT validation failed - Invalid signature: {Error}", ex.Message);
        }
        catch (SecurityTokenInvalidIssuerException ex)
        {
            _logger.LogWarning("❌ JWT validation failed - Invalid issuer: {Error}", ex.Message);
        }
        catch (SecurityTokenInvalidAudienceException ex)
        {
            _logger.LogWarning("❌ JWT validation failed - Invalid audience: {Error}", ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError("❌ JWT validation failed - Unexpected error: {Error}", ex.Message);
        }
    }
}