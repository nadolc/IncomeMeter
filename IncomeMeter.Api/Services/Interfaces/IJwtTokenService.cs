using IncomeMeter.Api.Models;
using System.Security.Claims;

namespace IncomeMeter.Api.Services.Interfaces
{
    public interface IJwtTokenService
    {
        string GenerateAccessToken(User user);
        string GenerateAccessToken(ClaimsPrincipal principal);
    }
}