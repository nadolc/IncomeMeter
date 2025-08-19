# IncomeMeter - 2FA iOS Shortcuts Workflow Complete Guide

## 🎯 Overview

This guide provides the complete implementation of Two-Factor Authentication (2FA) with iOS Shortcuts integration for the IncomeMeter application. The system provides secure, seamless API access for iOS shortcuts while maintaining enterprise-level security.

## 🏗️ System Architecture

### Complete User Flow

1. **Initial Setup:**
   - User registers on web with email/password
   - Enables 2FA by scanning QR code with authenticator app
   - Verifies 2FA setup with first TOTP code
   - Downloads backup codes for recovery
   - Runs "Setup 2FA iOS Integration" shortcut
   - Copies setup data from web to shortcut

2. **Daily Usage (Seamless):**
   - User runs "Start Route with 2FA" shortcut
   - Access token auto-refreshes if needed (invisible)
   - API call succeeds immediately
   - Route starts successfully

3. **Monthly Re-authentication:**
   - Refresh token expires after 30 days
   - Shortcut detects expiry, opens web login
   - User logs in with email + password + TOTP code
   - New tokens auto-stored in shortcut
   - Returns to seamless daily usage

4. **Security Features:**
   - ✅ 2FA required for initial authentication
   - ✅ Short-lived access tokens (1 hour)
   - ✅ Rotating refresh tokens (30 days)
   - ✅ Secure token storage in iOS
   - ✅ Automatic token refresh
   - ✅ Complete audit trail
   - ✅ Rate limiting and security headers
   - ✅ Backup codes for recovery

## 📋 API Endpoints Reference

### 2FA Management Endpoints

#### POST /api/twofactor/setup
**Purpose:** Generate 2FA setup (QR code and backup codes)
**Authentication:** Bearer token required

```json
Request:
{
    "recoveryEmail": "backup@example.com" // Optional
}

Response:
{
    "success": true,
    "message": "2FA setup generated successfully",
    "secretKey": "JBSWY3DPEHPK3PXP",
    "qrCodeBase64": "data:image/png;base64,iVBORw0KGgoAAAANS...",
    "manualEntryCode": "JBSW Y3DP EHPK 3PXP",
    "backupCodes": [
        "a1b2c-d3e4f",
        "g5h6i-j7k8l",
        // ... 8 more codes
    ]
}
```

#### POST /api/twofactor/verify
**Purpose:** Verify TOTP code and complete 2FA setup
**Authentication:** Bearer token required

```json
Request:
{
    "code": "123456",           // TOTP code
    "backupCode": "a1b2c-d3e4f" // Or backup code
}

Response:
{
    "success": true,
    "message": "2FA setup completed successfully",
    "isSetupComplete": true
}
```

#### POST /api/twofactor/login
**Purpose:** Email/Password + 2FA Login
**Authentication:** None (login endpoint)

```json
Request:
{
    "email": "user@example.com",
    "password": "userpassword",
    "twoFactorCode": "123456",      // TOTP code
    "backupCode": "a1b2c-d3e4f",   // Or backup code
    "rememberMe": false
}

Response:
{
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
    "expiresAt": "2025-01-20T14:30:00Z",
    "refreshExpiresAt": "2025-02-19T13:30:00Z",
    "requiresTwoFactor": false
}
```

#### POST /api/twofactor/refresh
**Purpose:** Refresh access token using refresh token
**Authentication:** None (uses refresh token)

```json
Request:
{
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}

Response:
{
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "bmV3IHJlZnJlc2ggdG9rZW4gYWZ0ZXIgcm90YXRpb24...",
    "expiresAt": "2025-01-20T15:30:00Z",
    "refreshExpiresAt": "2025-02-19T14:30:00Z",
    "requiresTwoFactor": false
}
```

#### GET /api/twofactor/status
**Purpose:** Get 2FA status for current user
**Authentication:** Bearer token required

```json
Response:
{
    "isTwoFactorEnabled": true,
    "isSetupComplete": true,
    "remainingBackupCodes": 8,
    "recoveryEmail": "backup@example.com"
}
```

### iOS Integration Endpoints

#### POST /api/ios/setup
**Purpose:** Validate tokens and return user info for iOS shortcut setup
**Authentication:** Validates provided tokens

```json
Request:
{
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}

Response:
{
    "success": true,
    "message": "iOS integration setup successful",
    "userId": "507f1f77bcf86cd799439011",
    "userName": "John Doe",
    "tokenExpiry": "2025-01-20T14:30:00Z",
    "refreshExpiry": "2025-02-19T13:30:00Z"
}
```

#### POST /api/ios/login
**Purpose:** Authenticate for iOS shortcuts when refresh token expires
**Authentication:** None (login endpoint)

```json
Request:
{
    "email": "user@example.com",
    "password": "userpassword",
    "twoFactorCode": "123456",
    "deviceId": "iPhone-12-Pro-Max-Serial"
}

Response:
{
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "bmV3IHJlZnJlc2ggdG9rZW4gZm9yIGlPUw...",
    "expiresAt": "2025-01-20T15:30:00Z",
    "refreshExpiresAt": "2025-02-19T14:30:00Z",
    "requiresTwoFactor": false
}
```

#### POST /api/ios/refresh
**Purpose:** Automatic token refresh for iOS shortcuts
**Authentication:** Uses refresh token

```json
Request:
{
    "refreshToken": "bmV3IHJlZnJlc2ggdG9rZW4gZm9yIGlPUw..."
}

Response:
{
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "cm90YXRlZCByZWZyZXNoIHRva2VuIGZvciBpT1M...",
    "expiresAt": "2025-01-20T16:30:00Z",
    "refreshExpiresAt": "2025-02-19T15:30:00Z",
    "requiresTwoFactor": false
}
```

#### POST /api/ios/start-route
**Purpose:** Enhanced Start Route API for iOS shortcuts
**Authentication:** Bearer token required

```json
Request:
{
    "workType": "Delivery",
    "estimatedIncome": 50.00,
    "startMile": 12345.6
}

Response:
{
    "success": true,
    "message": "Route started successfully",
    "route": {
        "id": "507f1f77bcf86cd799439012",
        "status": "in_progress",
        "actualStartTime": "2025-01-20T13:30:00Z",
        "workType": "Delivery",
        "estimatedIncome": 50.00
    },
    "userName": "John Doe"
}
```

#### POST /api/ios/end-route
**Purpose:** Enhanced End Route API for iOS shortcuts
**Authentication:** Bearer token required

```json
Request:
{
    "routeId": "507f1f77bcf86cd799439012",
    "endMile": 12355.8,
    "actualIncome": 45.50
}

Response:
{
    "success": true,
    "message": "Route ended successfully",
    "route": {
        "id": "507f1f77bcf86cd799439012",
        "status": "completed",
        "actualEndTime": "2025-01-20T18:30:00Z",
        "distance": 10.2,
        "totalIncome": 45.50
    },
    "userName": "John Doe"
}
```

## 📱 iOS Shortcuts Templates

### 1. Setup 2FA iOS Integration Shortcut

```
Name: Setup 2FA iOS Integration
Description: One-time setup for IncomeMeter 2FA integration

Actions:
1. Text Input (accessToken): "Paste your access token from the web app"
2. Text Input (refreshToken): "Paste your refresh token from the web app"
3. Get Contents of URL
   - URL: https://incomemeter-api.com/api/ios/setup
   - Method: POST
   - Headers: Content-Type: application/json
   - Request Body: {"accessToken":"[accessToken]","refreshToken":"[refreshToken]"}
4. Get Value from Input (success)
5. If (success == true):
   - Get Value from Input (userId) → Save to "IncomeMeter_UserID"
   - Get Value from Input (userName) → Save to "IncomeMeter_UserName"
   - Text Input (accessToken) → Save to "IncomeMeter_AccessToken"
   - Text Input (refreshToken) → Save to "IncomeMeter_RefreshToken"
   - Show Notification: "✅ 2FA iOS Integration setup complete!"
6. Otherwise:
   - Show Notification: "❌ Setup failed. Check your tokens and try again."
```

### 2. Start Route with 2FA Shortcut

```
Name: Start Route with 2FA
Description: Start a new income route with automatic 2FA token management

Actions:
1. Get Variable (IncomeMeter_AccessToken)
2. Get Current Date → Format as ISO 8601
3. If (AccessToken expires in < 5 minutes):
   - Run Shortcut: "Refresh IncomeMeter Token"
   - Get Variable (IncomeMeter_AccessToken) [Updated]
4. Choose from Menu: "Work Type"
   - Delivery
   - Rideshare
   - Food Service
   - Other
5. Number Input (estimatedIncome): "Expected income for this route?"
6. Get Contents of URL
   - URL: https://incomemeter-api.com/api/ios/start-route
   - Method: POST
   - Headers: 
     - Content-Type: application/json
     - Authorization: Bearer [AccessToken]
   - Request Body: {"workType":"[WorkType]","estimatedIncome":[EstimatedIncome]}
7. Get Value from Input (success)
8. If (success == true):
   - Get Value from Input (route.id) → Save to "IncomeMeter_ActiveRoute"
   - Show Notification: "🚗 Route started successfully!"
9. Otherwise:
   - Get Value from Input (message)
   - If (message contains "token"):
     - Run Shortcut: "Refresh IncomeMeter Token"
     - Run Shortcut: "Start Route with 2FA" [Retry]
   - Otherwise:
     - Show Notification: "❌ Failed to start route: [message]"
```

### 3. Refresh IncomeMeter Token Shortcut

```
Name: Refresh IncomeMeter Token
Description: Automatically refresh access token using refresh token

Actions:
1. Get Variable (IncomeMeter_RefreshToken)
2. Get Contents of URL
   - URL: https://incomemeter-api.com/api/ios/refresh
   - Method: POST
   - Headers: Content-Type: application/json
   - Request Body: {"refreshToken":"[RefreshToken]"}
3. Get Value from Input (accessToken)
4. If (accessToken exists):
   - Save to "IncomeMeter_AccessToken"
   - Get Value from Input (refreshToken) → Save to "IncomeMeter_RefreshToken"
   - Get Value from Input (expiresAt) → Save to "IncomeMeter_TokenExpiry"
5. Otherwise:
   - Get Value from Input (message)
   - If (message contains "Invalid refresh token"):
     - Show Notification: "🔐 Please re-authenticate"
     - Run Shortcut: "IncomeMeter iOS Login"
   - Otherwise:
     - Show Notification: "❌ Token refresh failed: [message]"
```

### 4. IncomeMeter iOS Login Shortcut

```
Name: IncomeMeter iOS Login
Description: Full re-authentication when refresh token expires (monthly)

Actions:
1. Get Variable (IncomeMeter_UserEmail) or Text Input: "Enter your email"
2. Text Input (password): "Enter your password" [Secure Text]
3. Open App: "Authenticator" (Google Authenticator, Authy, etc.)
4. Text Input (twoFactorCode): "Enter your 2FA code from authenticator app"
5. Get Device Details (Serial Number) → Save as DeviceId
6. Get Contents of URL
   - URL: https://incomemeter-api.com/api/ios/login
   - Method: POST
   - Headers: Content-Type: application/json
   - Request Body: {
       "email":"[email]",
       "password":"[password]",
       "twoFactorCode":"[twoFactorCode]",
       "deviceId":"[deviceId]"
     }
7. Get Value from Input (accessToken)
8. If (accessToken exists):
   - Save to "IncomeMeter_AccessToken"
   - Get Value from Input (refreshToken) → Save to "IncomeMeter_RefreshToken"
   - Get Value from Input (expiresAt) → Save to "IncomeMeter_TokenExpiry"
   - Show Notification: "✅ Login successful! You can now use IncomeMeter shortcuts."
9. Otherwise:
   - Get Value from Input (message)
   - Show Notification: "❌ Login failed: [message]"
   - If (message contains "Invalid credentials"):
     - Show Alert: "Check your email and password"
   - If (message contains "Invalid 2FA"):
     - Show Alert: "Check your 2FA code and try again"
```

### 5. End Route with 2FA Shortcut

```
Name: End Route with 2FA
Description: End the current active route with automatic token management

Actions:
1. Get Variable (IncomeMeter_ActiveRoute)
2. If (ActiveRoute is empty):
   - Show Notification: "❌ No active route found"
   - Exit Shortcut
3. Get Variable (IncomeMeter_AccessToken)
4. If (AccessToken expires in < 5 minutes):
   - Run Shortcut: "Refresh IncomeMeter Token"
5. Number Input (actualIncome): "What was your actual income?"
6. Get Contents of URL
   - URL: https://incomemeter-api.com/api/ios/end-route
   - Method: POST
   - Headers:
     - Content-Type: application/json
     - Authorization: Bearer [AccessToken]
   - Request Body: {"routeId":"[ActiveRoute]","actualIncome":[ActualIncome]}
7. Get Value from Input (success)
8. If (success == true):
   - Remove Variable: "IncomeMeter_ActiveRoute"
   - Get Value from Input (route.totalIncome)
   - Show Notification: "🏁 Route completed! Total income: £[totalIncome]"
9. Otherwise:
   - Handle token refresh if needed (same as Start Route)
   - Show error notification
```

## 🔐 Security Implementation Details

### Token Management
- **Access Tokens**: 1-hour lifespan, JWT format with user claims
- **Refresh Tokens**: 30-day lifespan, secure random 512-bit strings
- **Automatic Rotation**: New refresh token issued with each refresh
- **Secure Storage**: iOS Keychain via Shortcuts app variables

### Rate Limiting Configuration
```json
{
    "*/twofactor/login": "5 requests per minute",
    "*/twofactor/verify": "10 requests per minute", 
    "*/ios/login": "5 requests per minute",
    "*": "100 requests per minute"
}
```

### Backup Code System
- **Generation**: 10 unique codes per user
- **Format**: XXXXX-XXXXX (e.g., a1b2c-d3e4f)
- **Security**: SHA-256 hashed storage
- **Single Use**: Each code can only be used once
- **Recovery**: Can be regenerated with valid TOTP code

### Audit Trail
Every security event is logged with:
- Event type and timestamp
- User ID (partially masked)
- IP address
- Device information (iOS only)
- Success/failure status
- Failure reasons

## 🧪 Testing the Complete Flow

### Prerequisites
1. IncomeMeter API running with 2FA enabled
2. iOS device with Shortcuts app
3. Authenticator app (Google Authenticator, Authy, etc.)
4. User account created on web interface

### Step-by-Step Testing

#### Phase 1: Initial Setup
1. **Web Registration**:
   ```bash
   # Register new user
   curl -X POST https://incomemeter-api.com/api/users/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "SecurePassword123!",
       "displayName": "Test User"
     }'
   ```

2. **Enable 2FA**:
   ```bash
   # Setup 2FA
   curl -X POST https://incomemeter-api.com/api/twofactor/setup \
     -H "Authorization: Bearer [access_token]" \
     -H "Content-Type: application/json" \
     -d '{"recoveryEmail": "backup@example.com"}'
   ```

3. **Verify 2FA Setup**:
   - Scan QR code with authenticator app
   - Get TOTP code from app
   ```bash
   # Verify setup
   curl -X POST https://incomemeter-api.com/api/twofactor/verify \
     -H "Authorization: Bearer [access_token]" \
     -H "Content-Type: application/json" \
     -d '{"code": "123456"}'
   ```

#### Phase 2: iOS Integration Setup
1. **Run Setup Shortcut**:
   - Install "Setup 2FA iOS Integration" shortcut
   - Paste access and refresh tokens from web
   - Verify success notification

2. **Test Token Validation**:
   ```bash
   # Validate iOS setup
   curl -X POST https://incomemeter-api.com/api/ios/setup \
     -H "Content-Type: application/json" \
     -d '{
       "accessToken": "eyJhbGci...",
       "refreshToken": "dGhpcyBp..."
     }'
   ```

#### Phase 3: Daily Usage Testing
1. **Start Route Test**:
   - Run "Start Route with 2FA" shortcut
   - Choose work type and estimated income
   - Verify route starts successfully

2. **Token Refresh Test**:
   - Wait for token to near expiry (or manually expire)
   - Run route shortcut again
   - Verify automatic token refresh

3. **End Route Test**:
   - Run "End Route with 2FA" shortcut
   - Enter actual income
   - Verify route completion

#### Phase 4: Monthly Re-authentication
1. **Simulate Token Expiry**:
   ```bash
   # Revoke refresh token (simulate expiry)
   # This would be done server-side for testing
   ```

2. **Test Re-authentication Flow**:
   - Run any shortcut that requires authentication
   - Verify redirect to login shortcut
   - Complete login with email + password + 2FA
   - Verify return to normal operation

## 📊 Monitoring and Analytics

### Key Metrics to Track
- 2FA setup completion rates
- iOS integration adoption
- Token refresh success rates
- Authentication failure reasons
- API endpoint usage patterns

### Alerting Triggers
- Multiple failed 2FA attempts from same IP
- Unusual token refresh patterns
- High rate of authentication failures
- Backup code usage spikes

## 🚨 Troubleshooting Guide

### Common Issues and Solutions

#### "Invalid refresh token" Error
**Symptoms**: iOS shortcut shows token refresh failed
**Causes**: 
- Token expired (30+ days old)
- Token revoked due to security policy
- Database token rotation issues

**Solutions**:
1. Run "IncomeMeter iOS Login" shortcut
2. Complete full re-authentication
3. Verify new tokens are stored correctly

#### "2FA not enabled" Error  
**Symptoms**: iOS endpoints reject requests
**Causes**:
- User disabled 2FA on web interface
- 2FA setup not completed properly

**Solutions**:
1. Check 2FA status: GET /api/twofactor/status
2. Complete 2FA setup if needed
3. Re-run iOS integration setup

#### Rate Limit Exceeded
**Symptoms**: HTTP 429 responses
**Causes**:
- Too many authentication attempts
- Shortcut running in tight loop

**Solutions**:
1. Wait for rate limit window to reset (1 minute)
2. Check shortcut logic for infinite loops
3. Review authentication flow efficiency

## 🔄 Backup and Recovery Procedures

### Using Backup Codes
When authenticator app is unavailable:

1. **Web Interface Recovery**:
   - Go to login page
   - Enter email + password
   - Click "Use backup code instead"
   - Enter one of the 10 backup codes
   - Access granted for emergency operations

2. **iOS Recovery**:
   - Modify "IncomeMeter iOS Login" shortcut
   - Replace 2FA code input with backup code input
   - Use format: "a1b2c-d3e4f"
   - Complete authentication normally

3. **Regenerate Backup Codes**:
   ```bash
   curl -X POST https://incomemeter-api.com/api/twofactor/backup-codes/regenerate \
     -H "Authorization: Bearer [access_token]" \
     -H "Content-Type: application/json" \
     -d '{"code": "123456"}'
   ```

### Lost Device Recovery
If iOS device is lost/stolen:

1. **Web Interface Actions**:
   - Login to web interface
   - Go to Security settings
   - View active refresh tokens
   - Revoke any suspicious tokens
   - Regenerate backup codes if needed

2. **New Device Setup**:
   - Install IncomeMeter shortcuts on new device
   - Run initial setup process
   - Use backup codes if authenticator not transferred

### Account Lockout Recovery
If account is locked due to security policies:

1. Contact support with verification details
2. Provide backup email confirmation
3. Complete identity verification process
4. Reset 2FA if necessary

This completes the comprehensive 2FA iOS Shortcuts integration for IncomeMeter. The system provides enterprise-grade security while maintaining user-friendly daily operations.