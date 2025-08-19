# Development Setup Instructions

Since Docker is not available in this WSL environment, here's how to run the full production-like development environment:

## Prerequisites

You'll need to run these commands in your local Windows environment (outside of WSL) where Docker and .NET SDK are installed.

## Method 1: Full Docker Stack (Recommended)

1. **Open PowerShell or Command Prompt** in your project root directory
2. **Start the full stack**:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
   ```

This will start:
- MongoDB on port 27017
- .NET API on port 7079 (HTTPS) and 8080 (HTTP)
- Full 2FA functionality with real QR codes

## Method 2: Local .NET Development Server

If Docker isn't available, you can run the .NET backend directly:

1. **Install .NET 9 SDK** if not already installed
2. **Navigate to API directory**:
   ```bash
   cd IncomeMeter.Api
   ```
3. **Start the backend**:
   ```bash
   dotnet run --urls="https://localhost:7079;http://localhost:8080"
   ```

## Method 3: Frontend + Backend Separate

### Terminal 1 - Backend (.NET API):
```bash
cd IncomeMeter.Api
dotnet run --urls="https://localhost:7079;http://localhost:8080"
```

### Terminal 2 - Frontend (Vite):
```bash
cd IncomeMeter.Api/frontend  
npm install
npm run dev
```

## Configuration Files Created

The following files have been created for you:

### `.env` - Environment Variables
- Contains all necessary secrets and API keys
- MongoDB credentials, Google OAuth, JWT secrets
- Pre-configured with your existing development settings

### `docker-compose.dev.yml` - Development Override
- Configures services for development with correct ports
- Maps port 7079 for HTTPS backend (matches frontend proxy)
- Uses your existing Azure Cosmos MongoDB connection
- Enables development logging and detailed errors

## Testing the Setup

Once the backend is running on `https://localhost:7079`:

1. **Visit** `http://localhost:5173/` (if running frontend separately)
   - OR `http://localhost:8080/` (if using Docker full stack)

2. **Navigate to Profile** → **Enable 2FA**

3. **Complete 2FA Setup** with:
   - Real QR code generation
   - Actual TOTP validation with authenticator apps
   - Real backup code generation
   - JWT token management

## Removing Mock Data

Once the backend is confirmed running, I'll remove all the mock data fallbacks from the frontend components so you get the full production experience.

## Troubleshooting

- **Port 7079 in use**: Stop any existing .NET processes or change the port
- **Certificate issues**: Use `--trust-certificate` when running dotnet
- **Database connection**: The configuration uses your existing Azure Cosmos MongoDB
- **CORS issues**: The dev configuration allows localhost:5173 origins

## Next Steps

Let me know which method you prefer and I'll help you complete the setup!