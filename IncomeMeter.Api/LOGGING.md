# IncomeMeter API - Logging Implementation

## Overview
This document outlines the comprehensive logging implementation for the IncomeMeter API, including structured logging with Serilog, Azure Application Insights integration, and security monitoring.

## Logging Architecture

### Core Components
1. **Serilog with Azure Application Insights** - Centralized, structured logging
2. **Request/Response Logging Middleware** - Tracks all HTTP requests with performance metrics
3. **Global Exception Handling Middleware** - Captures and logs all unhandled exceptions
4. **Security Logging Middleware** - Monitors security-relevant events and suspicious activity
5. **Business Operation Logging** - Tracks user actions, routes, and income calculations

### Middleware Pipeline Order
```
1. GlobalExceptionMiddleware (catches all exceptions)
2. RequestLoggingMiddleware (logs all requests/responses with performance)
3. SecurityLoggingMiddleware (security event monitoring)
4. ApiKeyAuthenticationMiddleware
5. UseAuthentication()
6. UseAuthorization()
```

## Logging Categories and Event Types

### 1. HTTP Request/Response Logging
- **EventType**: `HttpRequest`, `HttpResponse`, `SlowRequest`
- **Performance Categories**: Fast (<100ms), Normal (<500ms), Slow (<1000ms), VerySlow (<5000ms), Critical (>5000ms)
- **Data Logged**: Method, path, duration, status codes, content lengths, user IDs (sanitized)

### 2. Authentication & Authorization
- **EventType**: `AuthenticationAttempt`, `AuthenticationSuccess`, `AuthenticationFailed`, `NewUserDetected`, `UserLogout`
- **Data Logged**: Provider (Google OAuth), user IDs (sanitized), IP addresses, success/failure reasons

### 3. Business Operations
- **EventType**: `RouteStarted`, `RouteCompleted`, `RouteCreated`, `RouteDeleted`, `DashboardStatsCalculated`
- **Data Logged**: Route IDs (sanitized), income amounts, work types, distances, user IDs (sanitized)

### 4. Security Events
- **EventType**: `SensitiveEndpointAccess`, `SuspiciousRequest`, `UnauthorizedAccess`, `ForbiddenAccess`, `PotentialBotActivity`
- **Data Logged**: IP addresses, user agents (sanitized), request patterns, suspicious content detection

### 5. Error Tracking
- **EventType**: `UnhandledException`, `ValidationError`, `ResourceNotFound`, `DatabaseError`
- **Data Logged**: Exception types, stack traces (truncated), error categories, correlation IDs

### 6. Performance Monitoring
- **Metrics**: Request duration, request/response sizes, database query times
- **Alerts**: Slow requests (>1000ms), critical performance issues (>5000ms)

## Data Sanitization and Privacy

### Sensitive Data Protection
- **User IDs**: Truncated to first 8 characters + "***"
- **Google IDs**: Truncated to first 8 characters + "***" 
- **Email Addresses**: Domain masked (user@***)
- **Request Headers**: Authorization, Cookie, API keys redacted
- **Stack Traces**: Limited to 2000 characters
- **User Agents**: Malicious content sanitized

### Correlation IDs
Every request gets a unique 8-character correlation ID for request tracing across logs.

## Configuration

### Log Levels (appsettings.json)
```json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.AspNetCore": "Warning",
        "MongoDB.Driver": "Warning"
      }
    }
  }
}
```

### Output Destinations
1. **Console** - Development debugging
2. **File** - Local file system (logs/incomemeter-{date}.txt)
3. **Azure Application Insights** - Production telemetry and monitoring

## Monitoring and Alerting

### Key Metrics to Monitor
- Request volume and response times
- Authentication failure rates
- Error rates by endpoint
- Security events (suspicious requests, unauthorized access)
- Performance degradation patterns

### Recommended Azure Monitor Queries
```kusto
// Slow requests in the last hour
requests
| where timestamp > ago(1h)
| where duration > 1000
| summarize count() by bin(timestamp, 5m)

// Authentication failures
traces
| where customDimensions.EventType == "AuthenticationFailed"
| where timestamp > ago(24h)
| summarize count() by bin(timestamp, 1h)

// Suspicious activity
traces
| where customDimensions.EventType == "SuspiciousRequest"
| where timestamp > ago(24h)
| project timestamp, customDimensions.RemoteIP, customDimensions.SuspiciousPattern
```

## Security Considerations

### What's Logged for Security
- All authentication attempts (success/failure)
- Access to sensitive endpoints (/api/auth, /api/routes, /api/dashboard)
- Suspicious request patterns (SQL injection, XSS attempts)
- Unusual request headers or user agents
- Bot detection and automated request patterns
- Authorization failures (401/403 responses)

### What's NOT Logged
- Raw passwords or secrets
- Complete authorization headers
- Full personal information
- Sensitive business data in plain text
- Complete stack traces in production

## Development vs Production

### Development Environment
- More verbose logging (Information level)
- Console output enabled
- Full exception details
- Local file logging

### Production Environment
- Warning level and above for Microsoft components
- Azure Application Insights integration
- Sanitized error messages
- Performance monitoring enabled
- Security event alerting

## Best Practices Implemented

1. **Structured Logging** - All logs use structured data for easy querying
2. **Correlation IDs** - Every request traceable across services
3. **Performance Categorization** - Automatic classification of request performance
4. **Security Monitoring** - Proactive detection of suspicious activity
5. **Data Privacy** - All sensitive data sanitized before logging
6. **Error Classification** - Exceptions categorized by type and severity
7. **Configurable Log Levels** - Easy adjustment without code changes

## Future Enhancements

1. **Custom Dashboards** - Azure Monitor workbooks for business metrics
2. **Automated Alerting** - Proactive notifications for security/performance issues
3. **Log Aggregation** - Centralized logging for microservices architecture
4. **Metrics Export** - Integration with external monitoring tools
5. **Compliance Logging** - Additional logging for regulatory requirements