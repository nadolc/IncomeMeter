# JWT API Token Integration Guide

This document provides a comprehensive guide for integrating the new JWT-based API authentication system into the existing IncomeMeter application.

## 🎯 Overview

The JWT API token system replaces plain API keys with secure, scoped, and expiring JWT tokens while maintaining backward compatibility. This provides enhanced security, better user experience, and industry-standard authentication practices.

## 📋 Implementation Checklist

### Phase 1: Backend Service Registration (Program.cs)

Add these services to your `Program.cs`:

```csharp
// JWT Configuration
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));

// Register JWT API Token Service
builder.Services.AddScoped<IJwtApiTokenService, JwtApiTokenService>();

// JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:SecretKey"]!)),
        ValidateIssuer = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = true,
        ValidAudience = builder.Configuration["Jwt:Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

// Authorization
builder.Services.AddAuthorization();
```

### Phase 2: Middleware Configuration

Replace the existing `ApiKeyAuthenticationMiddleware` with the new `JwtApiAuthenticationMiddleware`:

```csharp
// Remove this line:
// app.UseMiddleware<ApiKeyAuthenticationMiddleware>();

// Add these lines:
app.UseMiddleware<JwtApiAuthenticationMiddleware>();
app.UseMiddleware<ScopeAuthorizationMiddleware>();

// Make sure these come after UseRouting() but before UseEndpoints()
app.UseAuthentication();
app.UseAuthorization();
```

### Phase 3: Configuration Settings (appsettings.json)

Add JWT configuration to your `appsettings.json`:

```json
{
  "Jwt": {
    "SecretKey": "your-super-secret-key-that-is-at-least-32-characters-long",
    "Issuer": "IncomeMeter",
    "Audience": "IncomeMeter-API",
    "ExpirationHours": 24
  }
}
```

**⚠️ Important**: Use a strong, unique secret key in production. Consider using Azure Key Vault or environment variables.

### Phase 4: Controller Updates

Update controllers that need scope-based authorization:

```csharp
[ApiController]
[Route("api/routes")]
public class RoutesController : ControllerBase
{
    // Read routes - requires read:routes scope
    [HttpGet]
    [RequireScopes("read:routes")]
    public async Task<IActionResult> GetRoutes()
    {
        // Implementation
    }

    // Create route - requires write:routes scope
    [HttpPost]
    [RequireScopes("write:routes")]
    public async Task<IActionResult> CreateRoute([FromBody] CreateRouteDto request)
    {
        // Implementation
    }

    // Delete route - requires delete:routes scope
    [HttpDelete("{id}")]
    [RequireScopes("delete:routes")]
    public async Task<IActionResult> DeleteRoute(string id)
    {
        // Implementation
    }
}
```

### Phase 5: Frontend Integration

Update the Settings page to include the new JWT token generator:

```tsx
// In Settings.tsx
import JwtApiTokenGenerator from '../Settings/JwtApiTokenGenerator';

const Settings: React.FC = () => {
  // ... existing code ...

  return (
    <div className="space-y-8">
      {/* ... existing sections ... */}
      
      {/* API Access Section */}
      <div className="dashboard-card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">API Access</h2>
        
        {/* New JWT Token Generator */}
        <JwtApiTokenGenerator />
        
        {/* Keep existing ApiKeyGenerator for backward compatibility */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Legacy API Keys</h3>
          <p className="text-sm text-gray-600 mb-4">
            Legacy API keys are still supported but JWT tokens are recommended for new integrations.
          </p>
          <ApiKeyGenerator />
        </div>
      </div>
    </div>
  );
};
```

## 🔧 Migration Strategy

### For Existing API Key Users

1. **Backward Compatibility**: Existing API keys continue to work
2. **Gradual Migration**: Users can generate JWT tokens alongside existing keys
3. **Deprecation Timeline**: Plan to deprecate legacy keys in 6-12 months
4. **Migration UI**: Show migration prompts for users with only legacy keys

### Database Migrations

No database schema changes are required since we're adding a new `ApiTokens` list to the existing `User` model. MongoDB will handle the schema evolution automatically.

## 📚 Usage Examples

### Generating a JWT Token (Frontend)

```typescript
const generateToken = async () => {
  const response = await fetch('/api/tokens/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userJwtToken}`
    },
    body: JSON.stringify({
      description: 'Mobile App Access',
      scopes: ['read:routes', 'write:routes', 'read:dashboard'],
      expiryDays: 365
    })
  });

  const tokenData = await response.json();
  // Store tokenData.accessToken for API calls
};
```

### Using JWT Token in API Calls

```javascript
// Same as before - no change for external developers
const response = await fetch('/api/routes', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  }
});
```

### Refreshing Expired Tokens

```javascript
const refreshToken = async (refreshToken) => {
  const response = await fetch('/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  const newTokens = await response.json();
  return newTokens.access_token;
};
```

## 🔒 Security Considerations

### Token Storage
- **Never log JWT tokens in plaintext**
- Store only SHA256 hashes in the database
- Use secure HTTP-only cookies when possible
- Implement proper token rotation

### Scopes and Permissions
- Follow principle of least privilege
- Regularly audit token scopes
- Implement scope-based rate limiting
- Monitor token usage patterns

### Production Deployment
- Use strong JWT secret keys (minimum 32 characters)
- Consider using RSA keys for enhanced security
- Implement token revocation lists for compromised tokens
- Set up monitoring for suspicious token usage

## 📊 Monitoring and Analytics

### Token Usage Metrics
- Track token generation frequency
- Monitor token usage patterns
- Alert on suspicious API access
- Measure token expiration and renewal rates

### Security Monitoring
- Log failed authentication attempts
- Monitor token validation failures
- Track scope violations
- Alert on token abuse patterns

## 🚀 Rollout Plan

### Phase 1: Internal Testing (Week 1)
- Deploy to development environment
- Test all endpoints with JWT tokens
- Verify backward compatibility with existing keys
- Performance testing with concurrent token validation

### Phase 2: Beta Users (Week 2-3)
- Deploy to staging environment
- Invite beta users to test JWT tokens
- Gather feedback on UX and performance
- Fine-tune token expiration policies

### Phase 3: Production Rollout (Week 4)
- Deploy to production
- Enable JWT token generation for all users
- Monitor system performance and user adoption
- Provide support and documentation

### Phase 4: Legacy Deprecation (Month 6-12)
- Announce deprecation timeline for legacy API keys
- Provide migration tools and support
- Gradually reduce legacy key functionality
- Complete migration to JWT-only authentication

## 📞 Support and Troubleshooting

### Common Issues

1. **Token Validation Fails**
   - Check JWT secret key configuration
   - Verify token hasn't expired
   - Ensure proper Bearer header format

2. **Scope Authorization Errors**
   - Verify token includes required scopes
   - Check controller scope annotations
   - Confirm scope validation middleware is configured

3. **Refresh Token Issues**
   - Ensure refresh token hasn't expired
   - Verify refresh token endpoint configuration
   - Check refresh token storage and retrieval

### Debug Tools

- **Token Validation Endpoint**: `GET /api/tokens/validate?token=...`
- **Scope Information**: Available in JWT payload and API response headers
- **Usage Tracking**: Monitor token usage in user dashboard

## 📈 Benefits Achieved

### Security Improvements
- ✅ Expiring tokens (1 year default, configurable)
- ✅ Scoped permissions (granular access control)
- ✅ Token revocation capabilities
- ✅ Usage tracking and audit trails
- ✅ Industry-standard JWT format

### Developer Experience
- ✅ Same Bearer token usage pattern
- ✅ Automatic token refresh capability
- ✅ Clear scope-based permissions
- ✅ OAuth 2.0 compatible endpoints
- ✅ Comprehensive API documentation

### Operational Benefits
- ✅ Better security monitoring
- ✅ Easier token management
- ✅ Backward compatibility maintained
- ✅ Scalable authentication system
- ✅ Industry best practices implemented

---

This implementation provides a production-ready JWT authentication system that significantly enhances security while maintaining developer-friendly APIs and seamless user experience.