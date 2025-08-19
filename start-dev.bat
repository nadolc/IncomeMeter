@echo off
echo Starting IncomeMeter Development Environment...

REM Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Docker found - starting full stack...
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
) else (
    echo Docker not found - checking for .NET SDK...
    dotnet --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo .NET SDK found - starting API locally...
        cd IncomeMeter.Api
        dotnet run --urls="https://localhost:7079;http://localhost:8080"
    ) else (
        echo Neither Docker nor .NET SDK found.
        echo Please install one of the following:
        echo - Docker Desktop: https://docker.com/products/docker-desktop
        echo - .NET 9 SDK: https://dotnet.microsoft.com/download
        pause
    )
)