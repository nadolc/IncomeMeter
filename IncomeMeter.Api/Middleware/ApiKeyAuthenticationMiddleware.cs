using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Authentication;

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
            Console.WriteLine($"[API Key Middleware] Received API key: {apiKey.Substring(0, Math.Min(10, apiKey.Length))}...");

            // Hash the provided key to compare against stored hashes
            using var sha256 = SHA256.Create();
            var keyHash = BitConverter.ToString(sha256.ComputeHash(Encoding.UTF8.GetBytes(apiKey))).Replace("-", "").ToLower();
            Console.WriteLine($"[API Key Middleware] Generated hash: {keyHash.Substring(0, Math.Min(16, keyHash.Length))}...");

            // Find the user associated with this key hash
            var user = await userService.GetUserByApiKeyHashAsync(keyHash);
            Console.WriteLine($"[API Key Middleware] User found: {user != null}");
            
            if (user != null)
            {
                // Store user in HttpContext for access in controllers
                context.Items["User"] = user;
                
                // Set authentication context so the user is not anonymous
                var claims = new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id!),
                    new Claim(ClaimTypes.Name, user.DisplayName ?? user.Email),
                    new Claim(ClaimTypes.Email, user.Email)
                };
                
                var identity = new ClaimsIdentity(claims, "ApiKey");
                var principal = new ClaimsPrincipal(identity);
                context.User = principal;
                
                Console.WriteLine($"[API Key Middleware] User authenticated via API key: {user.Email}");
            }
        }
        else
        {
            Console.WriteLine($"[API Key Middleware] No valid Authorization header found");
        }

        await _next(context);
    }
}