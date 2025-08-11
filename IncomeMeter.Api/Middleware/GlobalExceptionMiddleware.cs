using Serilog;
using System.Net;
using System.Text.Json;

namespace IncomeMeter.Api.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString();
        var userId = GetUserId(context);
        var requestPath = context.Request.Path.Value;
        var requestMethod = context.Request.Method;
        var userAgent = context.Request.Headers.UserAgent.ToString();
        var remoteIp = context.Connection.RemoteIpAddress?.ToString();

        // Determine error type and severity
        var (statusCode, errorType, logLevel) = GetErrorDetails(exception);

        // Create structured error data
        var errorData = new
        {
            ErrorId = Guid.NewGuid().ToString("N")[..8],
            CorrelationId = correlationId,
            RequestPath = requestPath,
            RequestMethod = requestMethod,
            UserId = userId,
            UserAgent = userAgent,
            RemoteIP = remoteIp,
            ExceptionType = exception.GetType().Name,
            ErrorType = errorType,
            StatusCode = statusCode,
            Timestamp = DateTimeOffset.UtcNow,
            StackTrace = exception.StackTrace?[..Math.Min(2000, exception.StackTrace.Length)], // Truncate long stack traces
            InnerException = exception.InnerException?.Message,
            RequestHeaders = GetSanitizedHeaders(context.Request.Headers)
        };

        // Log the exception with appropriate level
        Log.Logger
            .ForContext("EventType", "UnhandledException")
            .ForContext("ErrorData", errorData, destructureObjects: true)
            .Write(logLevel, exception, 
                "Unhandled exception occurred: {ErrorType} at {RequestPath} for User {UserId} [{CorrelationId}]",
                errorType, requestPath, userId ?? "Anonymous", correlationId);

        // Create user-friendly error response
        var response = new
        {
            Error = new
            {
                Message = GetUserFriendlyMessage(exception, statusCode),
                Type = errorType,
                CorrelationId = correlationId,
                Timestamp = DateTimeOffset.UtcNow.ToString("O")
            }
        };

        // Set response details
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var jsonResponse = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        });

        await context.Response.WriteAsync(jsonResponse);
    }

    private string? GetUserId(HttpContext context)
    {
        if (context.User?.Identity?.IsAuthenticated == true)
        {
            var userId = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            // Sanitize user ID for logging
            return userId != null ? $"{userId[..Math.Min(8, userId.Length)]}***" : null;
        }
        return null;
    }

    private (HttpStatusCode statusCode, string errorType, Serilog.Events.LogEventLevel logLevel) GetErrorDetails(Exception exception)
    {
        return exception switch
        {
            ArgumentNullException or ArgumentException => (HttpStatusCode.BadRequest, "ValidationError", Serilog.Events.LogEventLevel.Warning),
            KeyNotFoundException => (HttpStatusCode.NotFound, "ResourceNotFound", Serilog.Events.LogEventLevel.Information),
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized, "AuthorizationError", Serilog.Events.LogEventLevel.Warning),
            InvalidOperationException => (HttpStatusCode.BadRequest, "BusinessLogicError", Serilog.Events.LogEventLevel.Warning),
            TimeoutException => (HttpStatusCode.RequestTimeout, "TimeoutError", Serilog.Events.LogEventLevel.Warning),
            NotImplementedException => (HttpStatusCode.NotImplemented, "NotImplementedError", Serilog.Events.LogEventLevel.Error),
            System.Data.Common.DbException => (HttpStatusCode.InternalServerError, "DatabaseError", Serilog.Events.LogEventLevel.Error),
            HttpRequestException => (HttpStatusCode.BadGateway, "ExternalServiceError", Serilog.Events.LogEventLevel.Error),
            OperationCanceledException => (HttpStatusCode.InternalServerError, "OperationCancelled", Serilog.Events.LogEventLevel.Information),
            _ => (HttpStatusCode.InternalServerError, "InternalServerError", Serilog.Events.LogEventLevel.Error)
        };
    }

    private string GetUserFriendlyMessage(Exception exception, HttpStatusCode statusCode)
    {
        return statusCode switch
        {
            HttpStatusCode.BadRequest => "The request was invalid. Please check your input and try again.",
            HttpStatusCode.Unauthorized => "Authentication is required to access this resource.",
            HttpStatusCode.NotFound => "The requested resource was not found.",
            HttpStatusCode.RequestTimeout => "The request timed out. Please try again.",
            HttpStatusCode.BadGateway => "An external service is temporarily unavailable. Please try again later.",
            HttpStatusCode.NotImplemented => "This feature is not yet implemented.",
            _ => "An unexpected error occurred. Please try again or contact support if the problem persists."
        };
    }

    private Dictionary<string, string> GetSanitizedHeaders(IHeaderDictionary headers)
    {
        var sanitized = new Dictionary<string, string>();
        var sensitiveHeaders = new[] { "authorization", "cookie", "x-api-key", "x-access-token" };

        foreach (var header in headers.Take(20)) // Limit number of headers logged
        {
            var key = header.Key.ToLower();
            if (sensitiveHeaders.Contains(key))
            {
                sanitized[header.Key] = "***REDACTED***";
            }
            else if (header.Key.Length < 50) // Avoid extremely long header names
            {
                var value = header.Value.ToString();
                sanitized[header.Key] = value.Length > 100 ? $"{value[..100]}..." : value;
            }
        }

        return sanitized;
    }
}