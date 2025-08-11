# IncomeMeter API - Configuration Guide

## 🔐 Security Notice
This repository does NOT contain any sensitive configuration data. All secrets, API keys, and connection strings must be configured separately for each environment.

## 📁 Configuration Files Structure

### Public Configuration (Committed to Repository)
- `appsettings.json` - Base configuration with empty/placeholder values
- `appsettings.Production.json` - Production-specific settings (non-sensitive)

### Private Configuration (NOT Committed - Gitignored)
- `appsettings.Development.json` - Local development configuration with actual secrets
- `appsettings.Local.json` - Personal overrides
- `.env.local` - Environment variables for local development

## 🚀 Quick Setup for Development

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/incomemeter.git
cd incomemeter
```

### 2. Create Local Configuration
Copy the template and fill in your actual values:
```bash
# Copy environment template
cp .env.template .env.local

# Create development configuration
cp IncomeMeter.Api/appsettings.json IncomeMeter.Api/appsettings.Development.json
```

### 3. Configure Required Services

#### MongoDB Database
1. Create a MongoDB cluster (MongoDB Atlas recommended)
2. Get your connection string
3. Update `MONGO_CONNECTION_STRING` in `.env.local` or `appsettings.Development.json`

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add redirect URI: `https://localhost:7001/signin-google`
6. Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

#### OpenCage Geocoding (Optional but Recommended)
1. Sign up at [OpenCage Data](https://opencagedata.com/)
2. Get your free API key (2,500 requests/day)
3. Update `OPENCAGE_API_KEY`

#### OpenRouteService (Optional but Recommended)
1. Sign up at [OpenRouteService](https://openrouteservice.org/)
2. Get your free API key (1,000 requests/day)
3. Update `OPENROUTESERVICE_API_KEY`

## ⚙️ Configuration Options

### Environment Variables vs Configuration Files
You can use either approach:

**Option 1: Environment Variables (.env.local)**
```bash
MONGO_CONNECTION_STRING=mongodb+srv://...
GOOGLE_CLIENT_ID=your-client-id
```

**Option 2: Configuration Files (appsettings.Development.json)**
```json
{
  "DatabaseSettings": {
    "ConnectionString": "mongodb+srv://..."
  },
  "Development": {
    "GoogleClientId": "your-client-id"
  }
}
```

### Required Configuration Values

| Setting | Description | Required |
|---------|-------------|----------|
| `MONGO_CONNECTION_STRING` | MongoDB connection string | ✅ Yes |
| `MONGO_DATABASE_NAME` | MongoDB database name | ✅ Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ✅ Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | ✅ Yes |
| `JWT_SECRET` | JWT signing secret | ✅ Yes |
| `FRONTEND_BASE_URL` | Frontend application base URL | ✅ Yes |
| `API_BASE_URL` | API base URL (for CORS) | ✅ Yes |
| `ALLOWED_CORS_ORIGINS` | Comma-separated CORS origins | ✅ Yes |
| `OPENCAGE_API_KEY` | OpenCage geocoding API key | ⚠️ Optional* |
| `OPENROUTESERVICE_API_KEY` | OpenRouteService API key | ⚠️ Optional* |

*Optional but recommended for full functionality. Without these, fallback geodesic distance calculation will be used.

## 🌍 Production Deployment

### Azure Key Vault (Recommended)
1. Create Azure Key Vault
2. Add secrets with these names:
   - `GoogleClientId`
   - `GoogleClientSecret`
   - `JwtSecret`
   - `MongoConnectionString`
   - `OpenCageApiKey`
   - `OpenRouteServiceApiKey`

3. Update production configuration:
```json
{
  "KeyVault": {
    "VaultUri": "https://your-keyvault.vault.azure.net/"
  },
  "Development": {
    "UseKeyVault": true
  }
}
```

### Environment Variables (Alternative)
Set these environment variables in your hosting platform:
- `GoogleClientId`
- `GoogleClientSecret`
- `JwtSecret`
- `MongoConnectionString`
- `FrontendBaseUrl`
- `ApiBaseUrl`
- `AllowedCorsOrigins` (JSON array format: `["https://domain1.com","https://domain2.com"]`)
- `OpenCageApiKey`
- `OpenRouteServiceApiKey`

### ⚠️ Critical Production Settings

**Frontend Base URL**: Must match your production frontend domain
```json
{
  "AppSettings": {
    "FrontendBaseUrl": "https://yourdomain.com"
  }
}
```

**CORS Origins**: Must include all domains that will access your API
```json
{
  "AppSettings": {
    "AllowedCorsOrigins": [
      "https://yourdomain.com",
      "https://admin.yourdomain.com"
    ]
  }
}
```

## 🛡️ Security Best Practices

### ✅ DO
- Use Azure Key Vault or similar secret management in production
- Use different databases/credentials for development and production
- Regularly rotate API keys and secrets
- Use environment-specific configuration files
- Review and audit access to configuration secrets

### ❌ DON'T
- Commit any files with actual secrets to version control
- Share production credentials in development environments
- Use weak JWT secrets (use strong random strings)
- Store secrets in plain text files on production servers

## 🧪 Testing Configuration

### Verify Your Setup
1. Run the application: `dotnet run`
2. Check logs for configuration errors
3. Try OAuth login: `https://localhost:7001/api/auth/login`
4. Test geocoding: Add a location via API

### Common Issues
- **401 Unauthorized**: Check JWT_SECRET and Google OAuth configuration
- **500 Database Error**: Verify MongoDB connection string and network access
- **Geocoding Fallback**: Check OpenCage/ORS API keys and network connectivity

## 📞 Support
If you encounter configuration issues:
1. Check the application logs in `logs/incomemeter-{date}.txt`
2. Verify all required configuration values are set
3. Test individual services (database, OAuth, geocoding APIs)
4. Create an issue in the repository with sanitized error messages (no secrets!)

---
**Remember**: Never commit actual secrets to version control! Always use the template files and environment-specific configurations.