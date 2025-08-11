# Middleware Pipeline

This document outlines the middleware components and their order in the IncomeMeter API.

## Middleware Order (Important!)

1. **GlobalExceptionMiddleware** - Catches all unhandled exceptions
2. **RequestLoggingMiddleware** - Logs HTTP requests/responses with performance monitoring  
3. **SecurityLoggingMiddleware** - Monitors security events and suspicious activity
4. **ApiKeyAuthenticationMiddleware** - Custom API key authentication
5. **UseAuthentication()** - ASP.NET Core authentication
6. **UseAuthorization()** - ASP.NET Core authorization

## Key Features

### GlobalExceptionMiddleware
- Catches and logs all unhandled exceptions
- Categorizes exceptions by type (ValidationError, DatabaseError, etc.)
- Returns user-friendly error messages
- Includes correlation IDs for tracing
- Sanitizes sensitive data in error logs

### RequestLoggingMiddleware  
- Logs every HTTP request/response
- Performance categorization (Fast, Normal, Slow, VerySlow, Critical)
- Correlation ID generation
- User ID sanitization
- Request/response size tracking
- Skips health check endpoints

### SecurityLoggingMiddleware
- Monitors access to sensitive endpoints
- Detects suspicious request patterns (SQL injection, XSS)
- Logs authentication attempts
- Identifies potential bot activity
- Tracks authorization failures (401/403)
- Sanitizes user agents and headers

## Compilation Notes

Make sure these NuGet packages are installed:
- Microsoft.ApplicationInsights.AspNetCore
- Serilog.AspNetCore
- Serilog.Sinks.ApplicationInsights
- Serilog.Enrichers.Environment
- Serilog.Enrichers.Process  
- Serilog.Enrichers.Thread
- Serilog.Settings.Configuration

## Common Issues

1. **Missing enrichers** - Ensure all Serilog enricher packages are installed
2. **Application Insights** - Requires Microsoft.ApplicationInsights.AspNetCore package
3. **Middleware order** - Exception middleware must be first, auth middleware must be last
4. **Property names** - Ensure DTO properties match between controllers and logging calls