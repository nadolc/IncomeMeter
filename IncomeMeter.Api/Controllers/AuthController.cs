using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.DTOs;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Serilog;

namespace IncomeMeter.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly IUserService _userService;
        private readonly ILogger<AuthController> _logger;
        private readonly AppSettings _appSettings;

        public AuthController(IConfiguration configuration, IUserService userService, ILogger<AuthController> logger, IOptions<AppSettings> appSettings)
        {
            _configuration = configuration;
            _userService = userService;
            _logger = logger;
            _appSettings = appSettings.Value;
        }

        [HttpGet("login")]
        public IActionResult Login(string? returnUrl = null)
        {
            var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
            var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            
            Log.Logger
                .ForContext("EventType", "AuthenticationAttempt")
                .ForContext("CorrelationId", correlationId)
                .ForContext("RemoteIP", remoteIp)
                .ForContext("ReturnUrl", returnUrl)
                .Information("User initiated Google OAuth login");

            var redirectUrl = Url.Action(nameof(GoogleCallback), "Auth");
            var properties = new AuthenticationProperties { RedirectUri = redirectUrl };

            if (!string.IsNullOrEmpty(returnUrl))
            {
                properties.Items["returnUrl"] = returnUrl;
            }

            return Challenge(properties, GoogleDefaults.AuthenticationScheme);
        }

        [HttpGet("google-callback")]
        public async Task<IActionResult> GoogleCallback()
        {
            var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
            var result = await HttpContext.AuthenticateAsync();

            if (!result.Succeeded)
            {
                var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();
                
                Log.Logger
                    .ForContext("EventType", "AuthenticationFailed")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("RemoteIP", remoteIp)
                    .ForContext("Provider", "Google")
                    .Warning("Google OAuth authentication failed");
                    
                // Redirect to frontend with error
                return Redirect($"{_appSettings.FrontendBaseUrl}/login?error=Authentication failed");
            }

            // Extract user information from Google claims
            var googleId = result.Principal!.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var email = result.Principal!.FindFirst(ClaimTypes.Email)?.Value;
            var displayName = result.Principal!.FindFirst(ClaimTypes.Name)?.Value;

            // DEBUG: Log Google ID for migration purposes
            Console.WriteLine("=== GOOGLE USER INFO FOR MIGRATION ===");
            Console.WriteLine($"Google ID: {googleId}");
            Console.WriteLine($"Email: {email}");
            Console.WriteLine($"Display Name: {displayName}");
            Console.WriteLine("=====================================");

            if (string.IsNullOrEmpty(googleId) || string.IsNullOrEmpty(email) || string.IsNullOrEmpty(displayName))
            {
                Log.Logger
                    .ForContext("EventType", "AuthenticationError")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("Provider", "Google")
                    .ForContext("GoogleIdPresent", !string.IsNullOrEmpty(googleId))
                    .ForContext("EmailPresent", !string.IsNullOrEmpty(email))
                    .ForContext("DisplayNamePresent", !string.IsNullOrEmpty(displayName))
                    .Warning("Missing required user information from Google OAuth");
                    
                return Redirect($"{_appSettings.FrontendBaseUrl}/login?error=Missing user information from Google");
            }

            // Check if user exists
            var user = await _userService.GetUserByGoogleIdAsync(googleId);
            var sanitizedGoogleId = $"{googleId[..Math.Min(8, googleId.Length)]}***";
            
            if (user == null)
            {
                Log.Logger
                    .ForContext("EventType", "NewUserDetected")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("Provider", "Google")
                    .ForContext("GoogleId", sanitizedGoogleId)
                    .ForContext("Email", email?.Split('@')[0] + "@***")
                    .Information("New user detected, redirecting to registration");
                    
                // User not found - redirect to registration page with Google info
                var registrationUrl = $"{_appSettings.FrontendBaseUrl}/register?googleId={Uri.EscapeDataString(googleId)}&email={Uri.EscapeDataString(email)}&name={Uri.EscapeDataString(displayName)}";
                return Redirect(registrationUrl);
            }
            
            Log.Logger
                .ForContext("EventType", "ExistingUserLogin")
                .ForContext("CorrelationId", correlationId)
                .ForContext("Provider", "Google")
                .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                .ForContext("GoogleId", sanitizedGoogleId)
                .Information("Existing user successfully authenticated via Google OAuth");

            // Create custom claims including user ID from database
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id!),
                new(ClaimTypes.Name, user.DisplayName),
                new(ClaimTypes.Email, user.Email),
                new("google_id", user.GoogleId)
            };

            var identity = new ClaimsIdentity(claims);
            var principal = new ClaimsPrincipal(identity);

            // Generate JWT token for API access
            var token = GenerateJwtToken(principal);

            var returnUrl = result.Properties?.Items.ContainsKey("returnUrl") == true
                ? result.Properties.Items["returnUrl"]
                : "/dashboard";

            // Log successful authentication
            Log.Logger
                .ForContext("EventType", "AuthenticationSuccess")
                .ForContext("CorrelationId", correlationId)
                .ForContext("Provider", "Google")
                .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                .ForContext("TokenExpiry", DateTime.UtcNow.AddHours(1).ToString("O"))
                .Information("User authentication completed successfully, JWT token generated");
                
            // Redirect to frontend with token
            var frontendUrl = $"{_appSettings.FrontendBaseUrl}/auth-callback?token={token}&redirectUrl={Uri.EscapeDataString(returnUrl)}";
            return Redirect(frontendUrl);
        }

        [HttpPost("logout")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> Logout()
        {
            var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
            
            Log.Logger
                .ForContext("EventType", "UserLogout")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId?[..Math.Min(8, userId.Length)] + "***")
                .Information("User logged out successfully");
                
            await HttpContext.SignOutAsync();
            return Ok(new DTOs.AuthResponse
            {
                Success = true,
                Message = "Logged out successfully"
            });
        }

        [HttpGet("profile")]
        [Authorize(AuthenticationSchemes = "Cookies,Bearer")]
        public async Task<IActionResult> GetProfile()
        {
            var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
            
            if (string.IsNullOrEmpty(userId))
            {
                Log.Logger
                    .ForContext("EventType", "UnauthorizedProfileAccess")
                    .ForContext("CorrelationId", correlationId)
                    .Warning("Unauthorized attempt to access user profile - no user ID in token");
                return Unauthorized();
            }

            var user = await _userService.GetUserByIdAsync(userId);
            
            if (user == null)
            {
                Log.Logger
                    .ForContext("EventType", "ProfileNotFound")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .Warning("User profile not found for valid user ID");
                return NotFound();
            }
            
            Log.Logger
                .ForContext("EventType", "ProfileAccess")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .Information("User profile accessed successfully");

            var profile = new
            {
                Id = user.Id,
                Name = user.DisplayName,
                Email = user.Email,
                CreatedAt = user.CreatedAt.ToString("O"),
                UpdatedAt = user.CreatedAt.ToString("O"), // Using CreatedAt as UpdatedAt for now
                IsAuthenticated = true
            };

            return Ok(profile);
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            try
            {
                // Validate required fields
                if (string.IsNullOrEmpty(request.GoogleId) || 
                    string.IsNullOrEmpty(request.Email) || 
                    string.IsNullOrEmpty(request.DisplayName))
                {
                    return BadRequest(new DTOs.AuthResponse
                    {
                        Success = false,
                        Message = "Missing required fields"
                    });
                }

                // Check if user already exists
                var existingUser = await _userService.GetUserByGoogleIdAsync(request.GoogleId);
                if (existingUser != null)
                {
                    return BadRequest(new DTOs.AuthResponse
                    {
                        Success = false,
                        Message = "User already exists"
                    });
                }

                // Create new user
                var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
                var sanitizedGoogleId = $"{request.GoogleId[..Math.Min(8, request.GoogleId.Length)]}***";
                var sanitizedEmail = request.Email.Split('@')[0] + "@***";
                
                Log.Logger
                    .ForContext("EventType", "UserRegistrationStarted")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("Provider", "Google")
                    .ForContext("GoogleId", sanitizedGoogleId)
                    .ForContext("Email", sanitizedEmail)
                    .Information("New user registration initiated");
                    
                var user = await _userService.CreateUserAsync(request.GoogleId, request.Email, request.DisplayName);
                
                Log.Logger
                    .ForContext("EventType", "UserRegistrationSuccess")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("Provider", "Google")
                    .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                    .ForContext("GoogleId", sanitizedGoogleId)
                    .Information("New user registered successfully");

                // Create claims and generate JWT token
                var claims = new List<Claim>
                {
                    new(ClaimTypes.NameIdentifier, user.Id!),
                    new(ClaimTypes.Name, user.DisplayName),
                    new(ClaimTypes.Email, user.Email),
                    new("google_id", user.GoogleId)
                };

                var identity = new ClaimsIdentity(claims);
                var principal = new ClaimsPrincipal(identity);
                var token = GenerateJwtToken(principal);

                return Ok(new DTOs.AuthResponse
                {
                    Success = true,
                    Message = "Registration successful",
                    Token = token,
                    User = new
                    {
                        Id = user.Id,
                        Name = user.DisplayName,
                        Email = user.Email,
                        IsAuthenticated = true
                    }
                });
            }
            catch (Exception ex)
            {
                var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
                var sanitizedGoogleId = request.GoogleId?[..Math.Min(8, request.GoogleId.Length)] + "***";
                
                Log.Logger
                    .ForContext("EventType", "UserRegistrationFailed")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("Provider", "Google")
                    .ForContext("GoogleId", sanitizedGoogleId)
                    .Error(ex, "User registration failed with exception");
                    
                return BadRequest(new DTOs.AuthResponse
                {
                    Success = false,
                    Message = $"Registration failed: {ex.Message}"
                });
            }
        }

        [HttpGet("debug/user-info")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public IActionResult GetUserInfo()
        {
            var googleId = User.FindFirst("google_id")?.Value;
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            var name = User.FindFirst(ClaimTypes.Name)?.Value;

            return Ok(new
            {
                GoogleId = googleId,
                UserId = userId,
                Email = email,
                Name = name,
                AllClaims = User.Claims.Select(c => new { c.Type, c.Value }).ToList()
            });
        }

        private string GenerateJwtToken(ClaimsPrincipal user)
        {
            // Use same configuration key as JwtApiTokenService
            var jwtSecret = _configuration["Jwt:SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey not configured");

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(jwtSecret);

            // Get issuer and audience values to match Program.cs configuration
            var issuer = _configuration["Jwt:Issuer"] ?? "IncomeMeter";
            var audience = _configuration["Jwt:Audience"] ?? "IncomeMeter-API";

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(user.Claims),
                Expires = DateTime.UtcNow.AddHours(1),
                Issuer = issuer,
                Audience = audience,
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }
}
