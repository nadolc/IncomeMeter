# JWT API Token Testing Guide

This guide provides step-by-step instructions for testing the newly implemented JWT API token system.

## 🧪 Testing Checklist

### Phase 1: Basic Functionality ✅ COMPLETE

**Backend Integration:**
- ✅ JwtApiTokenService registered in Program.cs
- ✅ JWT authentication middleware configured
- ✅ Scope-based authorization middleware added  
- ✅ JWT configuration added to appsettings.json
- ✅ Controllers updated with RequireScopes attributes

**Frontend Integration:**
- ✅ JwtApiTokenGenerator component created
- ✅ Settings page updated with JWT token section
- ✅ Legacy API key deprecation notice added

### Phase 2: Manual Testing Steps

#### Step 1: Access the Settings Page
1. Open your browser and navigate to the dashboard
2. Go to Settings page
3. Verify you can see:
   - "JWT API Tokens" section at the top
   - Token generation form with scope selection
   - "Legacy API Keys" section below with deprecation notice

#### Step 2: Generate a JWT Token
1. Fill in the description field (e.g., "Test API Access")
2. Select scopes (default scopes should be pre-selected)
3. Choose expiry period (default: 1 year)
4. Click "Generate JWT Token"
5. Verify:
   - Token generation modal appears
   - Access token and refresh token are displayed
   - Copy functionality works
   - Token information shows correct expiry and scopes

#### Step 3: Test API Access with JWT Token

**Using curl:**
```bash
# Test dashboard stats (requires read:dashboard scope)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
     http://localhost:7079/api/dashboard/stats

# Test routes listing (requires read:routes scope)  
curl -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
     http://localhost:7079/api/routes

# Test route creation (requires write:routes scope)
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     -d '{"workType":"delivery","status":"scheduled","scheduleStart":"2024-12-01T09:00:00Z","scheduleEnd":"2024-12-01T17:00:00Z"}' \
     http://localhost:7079/api/routes
```

**Using Postman/Insomnia:**
1. Create new request
2. Set Authorization header: `Bearer YOUR_JWT_TOKEN_HERE`
3. Test various endpoints with different scopes

#### Step 4: Test Scope Authorization
1. Generate a token with only `read:routes` scope
2. Try to create a route (POST /api/routes) - should get 403 Forbidden
3. Try to read routes (GET /api/routes) - should work fine

#### Step 5: Test Token Validation Endpoint
```bash
curl "http://localhost:7079/api/tokens/validate?token=YOUR_JWT_TOKEN_HERE"
```
Should return token information including user details and scopes.

#### Step 6: Test Token Refresh
```bash
curl -X POST \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=refresh_token&refresh_token=YOUR_REFRESH_TOKEN_HERE" \
     http://localhost:7079/oauth/token
```

#### Step 7: Test Token Revocation
1. Go to Settings page
2. Find your test token in the list
3. Click "Revoke" button
4. Try using the revoked token - should get 401 Unauthorized

### Phase 3: Backward Compatibility Testing

#### Legacy API Key Support
1. Generate a legacy API key using the old generator
2. Test that it still works for API access:
```bash
curl -H "Authorization: Bearer YOUR_LEGACY_API_KEY" \
     http://localhost:7079/api/routes
```
3. Verify both JWT tokens and legacy keys work simultaneously

### Phase 4: Security Testing

#### Invalid Token Tests
```bash
# Test with malformed JWT
curl -H "Authorization: Bearer invalid.jwt.token" \
     http://localhost:7079/api/routes

# Test with expired token (generate short-lived token)
# Wait for expiration, then test

# Test without Authorization header
curl http://localhost:7079/api/routes
```

All should return appropriate 401 Unauthorized responses.

## 🔍 Expected Results

### Successful JWT Token Generation
- Modal shows both access and refresh tokens
- Token info displays correct expiry date and scopes  
- Token appears in user's token list with usage stats

### Successful API Access
- JWT tokens work for all scoped endpoints
- Proper 403 responses for insufficient scopes
- 401 responses for invalid/expired tokens

### Token Management
- Token list shows creation date, expiry, usage count
- Token revocation works immediately
- Refresh token provides new access token

## 🐛 Troubleshooting

### Common Issues

**1. Token Generation Fails**
- Check JWT secret key is configured in appsettings.json
- Verify JWT service is registered in Program.cs
- Check console for detailed error messages

**2. API Calls Return 401**
- Verify token format: `Bearer JWT_TOKEN_HERE`
- Check token hasn't expired
- Verify token hasn't been revoked

**3. API Calls Return 403** 
- Check token has required scope for the endpoint
- Verify scope middleware is configured
- Check controller has correct RequireScopes attribute

**4. Frontend Errors**
- Check browser console for JavaScript errors
- Verify API base URL configuration
- Check network tab for failed requests

### Debug Endpoints

**Token Information:**
```
GET /api/tokens/validate?token=YOUR_TOKEN
```

**Available Scopes:**
```
GET /api/tokens/scopes
```

**User's Tokens:**
```  
GET /api/tokens
Authorization: Bearer USER_JWT_TOKEN
```

## 📊 Production Deployment Checklist

Before deploying to production:

- [ ] Use strong JWT secret key (minimum 32 characters)
- [ ] Configure proper CORS origins
- [ ] Set appropriate token expiry times
- [ ] Enable request logging for security monitoring
- [ ] Test all API endpoints with JWT tokens
- [ ] Verify scope authorization works correctly
- [ ] Document API changes for external developers
- [ ] Plan migration timeline for legacy API keys

## 🎯 Success Criteria

✅ **Implementation Complete When:**
- JWT tokens can be generated from Settings page
- API endpoints accept JWT tokens with proper scopes
- Token management (list, revoke) works correctly
- Refresh token flow functions properly
- Legacy API keys continue working
- All security tests pass
- Documentation is updated

The JWT API token system is now fully integrated and ready for testing!