using Serilog;
using System.Security.Claims;
using System.Net;

namespace IncomeMeter.Api.Middleware;

public class SecurityLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SecurityLoggingMiddleware> _logger;
    
    // Sensitive endpoints that require additional security logging
    private static readonly string[] SensitiveEndpoints = 
    {
        "/api/auth", "/api/user", "/signin-google", "/api/routes", "/api/dashboard"
    };
    
    // Suspicious patterns
    private static readonly string[] SuspiciousPatterns = 
    {
        "script", "javascript", "vbscript", "onload", "onerror", "<iframe", "eval(", "alert(",
        "../", "..\\", "%2e%2e", "union", "select", "drop", "delete", "insert", "update",
        "exec", "xp_", "sp_", "cmd", "powershell", "/bin/", "/etc/", "passwd", "shadow"
    };

    public SecurityLoggingMiddleware(RequestDelegate next, ILogger<SecurityLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString();
        
        // Log security-relevant requests
        await LogSecurityEvents(context, correlationId);
        
        await _next(context);
        
        // Log after request processing
        await LogPostRequestSecurity(context, correlationId);
    }

    private async Task LogSecurityEvents(HttpContext context, string? correlationId)
    {
        var request = context.Request;
        var remoteIp = context.Connection.RemoteIpAddress?.ToString();
        var userAgent = request.Headers.UserAgent.ToString();
        var userId = GetUserId(context);
        var requestPath = request.Path.Value?.ToLower() ?? "";
        var method = request.Method;
        
        // Check for sensitive endpoint access
        var isSensitiveEndpoint = SensitiveEndpoints.Any(endpoint => 
            requestPath.StartsWith(endpoint, StringComparison.OrdinalIgnoreCase));
            
        if (isSensitiveEndpoint)
        {
            Log.Logger
                .ForContext("EventType", "SensitiveEndpointAccess")
                .ForContext("CorrelationId", correlationId)
                .ForContext("RemoteIP", remoteIp)
                .ForContext("UserAgent", SanitizeUserAgent(userAgent))
                .ForContext("UserId", userId)
                .ForContext("RequestPath", requestPath)
                .ForContext("Method", method)
                .ForContext("HasAuthentication", !string.IsNullOrEmpty(userId))
                .Information("Access to sensitive endpoint: {Method} {Path} from {RemoteIP}",
                    method, requestPath, remoteIp);
        }
        
        // Check for suspicious request patterns
        var suspiciousContent = DetectSuspiciousContent(request);
        if (!string.IsNullOrEmpty(suspiciousContent))
        {
            Log.Logger
                .ForContext("EventType", "SuspiciousRequest")
                .ForContext("CorrelationId", correlationId)
                .ForContext("RemoteIP", remoteIp)
                .ForContext("UserAgent", SanitizeUserAgent(userAgent))
                .ForContext("UserId", userId)
                .ForContext("RequestPath", requestPath)
                .ForContext("Method", method)
                .ForContext("SuspiciousPattern", suspiciousContent)
                .ForContext("QueryString", request.QueryString.Value)
                .Warning("Suspicious request pattern detected: {SuspiciousPattern} in {Method} {Path} from {RemoteIP}",
                    suspiciousContent, method, requestPath, remoteIp);
        }
        
        // Log unusual request patterns
        await LogUnusualPatterns(context, correlationId, remoteIp, userAgent, userId);
        
        // Log authentication attempts
        if (requestPath.Contains("/auth/") || requestPath.Contains("/signin"))
        {
            Log.Logger
                .ForContext("EventType", "AuthenticationAttempt")
                .ForContext("CorrelationId", correlationId)
                .ForContext("RemoteIP", remoteIp)
                .ForContext("UserAgent", SanitizeUserAgent(userAgent))
                .ForContext("RequestPath", requestPath)
                .ForContext("Method", method)
                .ForContext("Referer", request.Headers.Referer.ToString())
                .Information("Authentication attempt: {Method} {Path} from {RemoteIP}",
                    method, requestPath, remoteIp);
        }
    }

    private async Task LogPostRequestSecurity(HttpContext context, string? correlationId)
    {
        var response = context.Response;
        var request = context.Request;
        var userId = GetUserId(context);
        var remoteIp = context.Connection.RemoteIpAddress?.ToString();
        
        // Log failed authorization attempts
        if (response.StatusCode == 401 || response.StatusCode == 403)
        {
            Log.Logger
                .ForContext("EventType", response.StatusCode == 401 ? "UnauthorizedAccess" : "ForbiddenAccess")
                .ForContext("CorrelationId", correlationId)
                .ForContext("RemoteIP", remoteIp)
                .ForContext("UserId", userId)
                .ForContext("RequestPath", request.Path.Value)
                .ForContext("Method", request.Method)
                .ForContext("StatusCode", response.StatusCode)
                .ForContext("UserAgent", SanitizeUserAgent(request.Headers.UserAgent.ToString()))
                .Warning("{EventType}: {Method} {Path} returned {StatusCode} for user {UserId} from {RemoteIP}",
                    response.StatusCode == 401 ? "UnauthorizedAccess" : "ForbiddenAccess",
                    request.Method, request.Path.Value, response.StatusCode, userId ?? "Anonymous", remoteIp);
        }
        
        // Log suspicious response patterns
        if (response.StatusCode >= 400 && response.StatusCode < 500)
        {
            var isSensitiveEndpoint = SensitiveEndpoints.Any(endpoint => 
                request.Path.Value?.StartsWith(endpoint, StringComparison.OrdinalIgnoreCase) == true);
                
            if (isSensitiveEndpoint)
            {
                Log.Logger
                    .ForContext("EventType", "SensitiveEndpointError")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("RemoteIP", remoteIp)
                    .ForContext("UserId", userId)
                    .ForContext("RequestPath", request.Path.Value)
                    .ForContext("Method", request.Method)
                    .ForContext("StatusCode", response.StatusCode)
                    .Warning("Error accessing sensitive endpoint: {Method} {Path} returned {StatusCode}",
                        request.Method, request.Path.Value, response.StatusCode);
            }
        }
    }

    private async Task LogUnusualPatterns(HttpContext context, string? correlationId, 
        string? remoteIp, string userAgent, string? userId)
    {
        var request = context.Request;
        
        // Detect potential automated requests
        var isLikelyBot = DetectBotActivity(userAgent, request);
        if (isLikelyBot && string.IsNullOrEmpty(userId)) // Unauthenticated bot activity
        {
            Log.Logger
                .ForContext("EventType", "PotentialBotActivity")
                .ForContext("CorrelationId", correlationId)
                .ForContext("RemoteIP", remoteIp)
                .ForContext("UserAgent", SanitizeUserAgent(userAgent))
                .ForContext("RequestPath", request.Path.Value)
                .ForContext("Method", request.Method)
                .Information("Potential bot activity detected from {RemoteIP}: {Method} {Path}",
                    remoteIp, request.Method, request.Path.Value);
        }
        
        // Log requests with unusual headers
        var unusualHeaders = DetectUnusualHeaders(request.Headers);
        if (unusualHeaders.Any())
        {
            Log.Logger
                .ForContext("EventType", "UnusualHeaders")
                .ForContext("CorrelationId", correlationId)
                .ForContext("RemoteIP", remoteIp)
                .ForContext("UserId", userId)
                .ForContext("UnusualHeaders", unusualHeaders)
                .Information("Request with unusual headers from {RemoteIP}", remoteIp);
        }
    }

    private string DetectSuspiciousContent(HttpRequest request)
    {
        var pathAndQuery = $"{request.Path.Value} {request.QueryString.Value}".ToLower();
        
        foreach (var pattern in SuspiciousPatterns)
        {
            if (pathAndQuery.Contains(pattern, StringComparison.OrdinalIgnoreCase))
            {
                return pattern;
            }
        }
        
        return string.Empty;
    }

    private bool DetectBotActivity(string userAgent, HttpRequest request)
    {
        var botIndicators = new[] 
        { 
            "bot", "crawler", "spider", "scraper", "curl", "wget", "python-requests",
            "postman", "insomnia", "httpie"
        };
        
        var lowerUserAgent = userAgent.ToLower();
        return botIndicators.Any(indicator => lowerUserAgent.Contains(indicator));
    }

    private List<string> DetectUnusualHeaders(IHeaderDictionary headers)
    {
        var unusualHeaders = new List<string>();
        var commonHeaders = new[]
        {
            "accept", "accept-encoding", "accept-language", "authorization", "cache-control",
            "connection", "content-type", "cookie", "host", "referer", "user-agent"
        };
        
        foreach (var header in headers)
        {
            if (!commonHeaders.Contains(header.Key.ToLower()) && 
                !header.Key.StartsWith("x-", StringComparison.OrdinalIgnoreCase))
            {
                unusualHeaders.Add(header.Key);
            }
        }
        
        return unusualHeaders;
    }

    private string SanitizeUserAgent(string userAgent)
    {
        // Truncate very long user agents and sanitize potentially malicious content
        if (string.IsNullOrEmpty(userAgent)) return "Unknown";
        
        var sanitized = userAgent.Length > 200 ? userAgent[..200] + "..." : userAgent;
        
        // Remove potentially malicious patterns from user agent logging
        foreach (var pattern in new[] { "<script", "javascript:", "data:" })
        {
            sanitized = sanitized.Replace(pattern, "[SANITIZED]", StringComparison.OrdinalIgnoreCase);
        }
        
        return sanitized;
    }

    private string? GetUserId(HttpContext context)
    {
        if (context.User?.Identity?.IsAuthenticated == true)
        {
            var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return userId != null ? $"{userId[..Math.Min(8, userId.Length)]}***" : null;
        }
        return null;
    }
}