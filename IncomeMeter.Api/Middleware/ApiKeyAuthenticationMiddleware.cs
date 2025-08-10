using System.Security.Cryptography;
using System.Text;
using IncomeMeter.Api.Services;

namespace IncomeMeter.Api.Middleware;

public class ApiKeyAuthenticationMiddleware
{
    private readonly RequestDelegate _next;

    public ApiKeyAuthenticationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IUserService userService)
    {
        // Try to get the API key from the Authorization header
        if (context.Request.Headers.TryGetValue("Authorization", out var authHeader) &&
            authHeader.ToString().StartsWith("Bearer "))
        {
            var apiKey = authHeader.ToString().Substring("Bearer ".Length);

            // Hash the provided key to compare against stored hashes
            using var sha256 = SHA256.Create();
            var keyHash = BitConverter.ToString(sha256.ComputeHash(Encoding.UTF8.GetBytes(apiKey))).Replace("-", "").ToLower();

            // Find the user associated with this key hash
            var user = await userService.GetUserByApiKeyHashAsync(keyHash);
            if (user != null)
            {
                // Store user in HttpContext for access in controllers
                context.Items["User"] = user;
            }
        }

        await _next(context);
    }
}