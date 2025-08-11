# Development server with auto-restart on new files
param(
    [switch]$Force,
    [switch]$Clean
)

$frontendPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $frontendPath

Write-Host "🚀 Starting Income Meter Frontend Development Server" -ForegroundColor Green

if ($Clean) {
    Write-Host "🧹 Cleaning node_modules and reinstalling..." -ForegroundColor Yellow
    Remove-Item "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "package-lock.json" -Force -ErrorAction SilentlyContinue
    npm install
}

# Check if dev server is already running
$existingProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*Vite*" -or $_.CommandLine -like "*vite*" }

if ($existingProcess -and !$Force) {
    Write-Host "⚠️  Development server appears to be running already." -ForegroundColor Yellow
    Write-Host "Use -Force to kill existing processes and restart" -ForegroundColor Gray
    exit 1
}

if ($Force -and $existingProcess) {
    Write-Host "🔄 Stopping existing development server..." -ForegroundColor Yellow
    $existingProcess | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# Start the development server
Write-Host "📱 Starting Vite development server on http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔥 Hot reload enabled - changes will update automatically" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray

try {
    npm run dev
}
catch {
    Write-Host "❌ Failed to start development server: $_" -ForegroundColor Red
    exit 1
}

# Usage:
# .\scripts\dev-server.ps1           # Start normally
# .\scripts\dev-server.ps1 -Force    # Kill existing and restart  
# .\scripts\dev-server.ps1 -Clean    # Clean install and start