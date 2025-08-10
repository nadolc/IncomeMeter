using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IncomeMeter.Api.Models;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace IncomeMeter.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public AuthController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpGet("login")]
        public IActionResult Login(string? returnUrl = null)
        {
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
            var result = await HttpContext.AuthenticateAsync();

            if (!result.Succeeded)
            {
                return BadRequest(new AuthResponse
                {
                    Success = false,
                    Message = "Authentication failed"
                });
            }

            // Generate JWT token for API access
            var token = GenerateJwtToken(result.Principal!);

            // Get return URL if specified
            var returnUrl = result.Properties?.Items.GetValueOrDefault("returnUrl") ?? "/dashboard";

            return Ok(new AuthResponse
            {
                Success = true,
                Message = "Authentication successful",
                AccessToken = token,
                RedirectUrl = returnUrl
            });
        }

        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync();
            return Ok(new AuthResponse
            {
                Success = true,
                Message = "Logged out successfully"
            });
        }

        [HttpGet("profile")]
        [Authorize]
        public IActionResult GetProfile()
        {
            var user = HttpContext.User;
            var profile = new
            {
                Name = user.FindFirst(ClaimTypes.Name)?.Value,
                Email = user.FindFirst(ClaimTypes.Email)?.Value,
                IsAuthenticated = user.Identity?.IsAuthenticated ?? false
            };

            return Ok(profile);
        }

        private string GenerateJwtToken(ClaimsPrincipal user)
        {
            string jwtSecret;

            if (HttpContext.RequestServices.GetService<IWebHostEnvironment>()!.IsDevelopment() &&
                !_configuration.GetValue<bool>("Development:UseKeyVault"))
            {
                jwtSecret = _configuration["Development:JwtSecret"]!;
            }
            else
            {
                jwtSecret = _configuration["JwtSecret"]!;
            }

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(jwtSecret);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(user.Claims),
                Expires = DateTime.UtcNow.AddHours(1),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }
}
