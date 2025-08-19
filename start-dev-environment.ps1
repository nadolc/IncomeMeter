# IncomeMeter Development Environment Startup Script
# Run this in PowerShell from the project root directory

param(
    [string]$Mode = "docker",  # Options: "docker", "local", "frontend-only"
    [switch]$Help
)

if ($Help) {
    Write-Host "IncomeMeter Development Environment Startup Script" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usage: .\start-dev-environment.ps1 [-Mode <mode>] [-Help]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Modes:" -ForegroundColor Cyan
    Write-Host "  docker        - Start full Docker stack (MongoDB + .NET API)" -ForegroundColor White
    Write-Host "  local         - Start .NET API locally (requires .NET 9 SDK)" -ForegroundColor White  
    Write-Host "  frontend-only - Start only frontend (for when backend is already running)" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Cyan
    Write-Host "  .\start-dev-environment.ps1                    # Start Docker stack" -ForegroundColor Gray
    Write-Host "  .\start-dev-environment.ps1 -Mode local        # Start .NET locally" -ForegroundColor Gray
    Write-Host "  .\start-dev-environment.ps1 -Mode frontend-only # Frontend only" -ForegroundColor Gray
    exit 0
}

Write-Host "🚀 Starting IncomeMeter Development Environment" -ForegroundColor Green
Write-Host "Mode: $Mode" -ForegroundColor Cyan

switch ($Mode.ToLower()) {
    "docker" {
        Write-Host "🐳 Starting Docker stack..." -ForegroundColor Blue
        if (Get-Command docker -ErrorAction SilentlyContinue) {
            Write-Host "Building and starting services..." -ForegroundColor Yellow
            docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
        } else {
            Write-Host "❌ Docker not found. Please install Docker Desktop or use -Mode local" -ForegroundColor Red
            exit 1
        }
    }
    
    "local" {
        Write-Host "🔧 Starting .NET API locally..." -ForegroundColor Blue
        if (Get-Command dotnet -ErrorAction SilentlyContinue) {
            Write-Host "Starting .NET backend on https://localhost:7079..." -ForegroundColor Yellow
            Set-Location -Path "IncomeMeter.Api"
            dotnet run --urls="https://localhost:7079;http://localhost:8080"
        } else {
            Write-Host "❌ .NET SDK not found. Please install .NET 9 SDK" -ForegroundColor Red
            Write-Host "Download: https://dotnet.microsoft.com/download" -ForegroundColor Yellow
            exit 1
        }
    }
    
    "frontend-only" {
        Write-Host "🌐 Starting frontend only..." -ForegroundColor Blue
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            Write-Host "Installing dependencies..." -ForegroundColor Yellow
            Set-Location -Path "IncomeMeter.Api/frontend"
            npm install
            Write-Host "Starting Vite dev server..." -ForegroundColor Yellow
            npm run dev
        } else {
            Write-Host "❌ Node.js/npm not found. Please install Node.js" -ForegroundColor Red
            Write-Host "Download: https://nodejs.org/" -ForegroundColor Yellow
            exit 1
        }
    }
    
    default {
        Write-Host "❌ Invalid mode: $Mode" -ForegroundColor Red
        Write-Host "Valid modes: docker, local, frontend-only" -ForegroundColor Yellow
        Write-Host "Use -Help for more information" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✅ Development environment started!" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 Access points:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  API:      https://localhost:7079" -ForegroundColor White
Write-Host "  Health:   https://localhost:7079/api/diagnostics/health" -ForegroundColor White
Write-Host ""
Write-Host "📱 To test 2FA:" -ForegroundColor Cyan  
Write-Host "  1. Go to Profile page" -ForegroundColor White
Write-Host "  2. Click 'Enable 2FA'" -ForegroundColor White
Write-Host "  3. Scan QR code with authenticator app" -ForegroundColor White
Write-Host "  4. Complete setup and test iOS integration" -ForegroundColor White