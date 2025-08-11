using Serilog;
using System.Diagnostics;
using System.Security.Claims;
using System.Text;

namespace IncomeMeter.Api.Middleware;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;
    private static readonly string[] SensitivePaths = { "/api/auth", "/signin-google" };
    private static readonly string[] HealthCheckPaths = { "/health", "/favicon.ico" };

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Skip logging for health checks and static files
        if (ShouldSkipLogging(context.Request.Path))
        {
            await _next(context);
            return;
        }

        var correlationId = Guid.NewGuid().ToString("N")[..8];
        context.Items["CorrelationId"] = correlationId;

        var stopwatch = Stopwatch.StartNew();
        var originalBodyStream = context.Response.Body;

        try
        {
            // Log request
            await LogRequest(context, correlationId);

            // Continue with the pipeline
            await _next(context);

            stopwatch.Stop();

            // Log response
            await LogResponse(context, correlationId, stopwatch.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            Log.Logger
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", GetUserId(context))
                .ForContext("RequestPath", context.Request.Path)
                .ForContext("RequestMethod", context.Request.Method)
                .ForContext("Duration", stopwatch.ElapsedMilliseconds)
                .Error(ex, "Request failed with exception");
            
            throw;
        }
    }

    private async Task LogRequest(HttpContext context, string correlationId)
    {
        var request = context.Request;
        var userId = GetUserId(context);
        
        // Don't log request body for sensitive endpoints
        var isSensitive = SensitivePaths.Any(path => request.Path.StartsWithSegments(path));
        
        var logData = new
        {
            CorrelationId = correlationId,
            Method = request.Method,
            Path = request.Path.Value,
            QueryString = request.QueryString.HasValue ? request.QueryString.Value : null,
            UserAgent = request.Headers.UserAgent.ToString(),
            RemoteIP = context.Connection.RemoteIpAddress?.ToString(),
            UserId = userId,
            ContentLength = request.ContentLength,
            ContentType = request.ContentType,
            Headers = GetSanitizedHeaders(request.Headers),
            IsSensitive = isSensitive
        };

        _logger.LogInformation("HTTP Request started: {Method} {Path} by User {UserId} [{CorrelationId}]",
            request.Method, request.Path, userId ?? "Anonymous", correlationId);

        Log.Logger
            .ForContext("EventType", "HttpRequest")
            .ForContext("RequestData", logData, destructureObjects: true)
            .Information("HTTP Request: {Method} {Path}", request.Method, request.Path);
    }

    private async Task LogResponse(HttpContext context, string correlationId, long duration)
    {
        var response = context.Response;
        var userId = GetUserId(context);
        var request = context.Request;

        // Performance categorization
        var performanceCategory = duration switch
        {
            < 100 => "Fast",
            < 500 => "Normal", 
            < 1000 => "Slow",
            < 5000 => "VerySlow",
            _ => "Critical"
        };

        var logData = new
        {
            CorrelationId = correlationId,
            StatusCode = response.StatusCode,
            ContentLength = response.ContentLength,
            ContentType = response.ContentType,
            Duration = duration,
            UserId = userId,
            PerformanceCategory = performanceCategory,
            RequestSize = request.ContentLength,
            ResponseSize = response.ContentLength,
            Method = request.Method,
            Path = request.Path.Value,
            QueryStringLength = request.QueryString.Value?.Length ?? 0,
            HasAuthentication = !string.IsNullOrEmpty(userId)
        };

        var logLevel = response.StatusCode >= 400 ? LogLevel.Warning : LogLevel.Information;
        
        // Enhanced performance logging
        if (duration > 1000) // Log slow requests with higher priority
        {
            Log.Logger
                .ForContext("EventType", "SlowRequest")
                .ForContext("PerformanceData", logData, destructureObjects: true)
                .Warning("Slow HTTP request detected: {Method} {Path} took {Duration}ms (Category: {PerformanceCategory}) [{CorrelationId}]",
                    request.Method, request.Path, duration, performanceCategory, correlationId);
        }
        
        _logger.Log(logLevel, "HTTP Response: {StatusCode} for {Method} {Path} in {Duration}ms [{CorrelationId}]",
            response.StatusCode, context.Request.Method, context.Request.Path, duration, correlationId);

        Log.Logger
            .ForContext("EventType", "HttpResponse")
            .ForContext("ResponseData", logData, destructureObjects: true)
            .Information("HTTP Response: {StatusCode} in {Duration}ms (Category: {PerformanceCategory})", 
                response.StatusCode, duration, performanceCategory);
    }

    private string? GetUserId(HttpContext context)
    {
        var user = context.User;
        if (user?.Identity?.IsAuthenticated == true)
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            // Sanitize user ID for logging (first 8 characters + ***)
            return userId != null ? $"{userId[..Math.Min(8, userId.Length)]}***" : null;
        }
        return null;
    }

    private Dictionary<string, string> GetSanitizedHeaders(IHeaderDictionary headers)
    {
        var sanitized = new Dictionary<string, string>();
        var sensitiveHeaders = new[] { "authorization", "cookie", "x-api-key" };

        foreach (var header in headers)
        {
            var key = header.Key.ToLower();
            if (sensitiveHeaders.Contains(key))
            {
                sanitized[header.Key] = "***REDACTED***";
            }
            else if (header.Key.Length < 100) // Avoid extremely long header names
            {
                sanitized[header.Key] = header.Value.ToString()[..Math.Min(200, header.Value.ToString().Length)];
            }
        }

        return sanitized;
    }

    private static bool ShouldSkipLogging(PathString path)
    {
        return HealthCheckPaths.Any(skipPath => path.StartsWithSegments(skipPath));
    }
}