using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services.Interfaces;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace IncomeMeter.Api.Services
{
    public class JwtTokenService : IJwtTokenService
    {
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;

        public JwtTokenService(IConfiguration configuration, IWebHostEnvironment environment)
        {
            _configuration = configuration;
            _environment = environment;
        }

        public string GenerateAccessToken(User user)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id!),
                new(ClaimTypes.Name, user.DisplayName),
                new(ClaimTypes.Email, user.Email),
                new("google_id", user.GoogleId),
                //new("two_factor_enabled", user.IsTwoFactorEnabled.ToString())
            };

            var identity = new ClaimsIdentity(claims);
            var principal = new ClaimsPrincipal(identity);

            return GenerateAccessToken(principal);
        }

        public string GenerateAccessToken(ClaimsPrincipal principal)
        {
            string jwtSecret;

            if (_environment.IsDevelopment() && !_configuration.GetValue<bool>("Development:UseKeyVault"))
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
                Subject = new ClaimsIdentity(principal.Claims),
                Expires = DateTime.UtcNow.AddHours(1), // Short-lived access tokens
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }
}