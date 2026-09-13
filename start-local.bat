@echo off
setlocal
REM ============================================================
REM  IncomeMeter - local dev launcher
REM  Starts the .NET API (https://localhost:7079) and the Vite
REM  frontend (http://localhost:5173) in two windows, then opens
REM  the browser. Close either window to stop that process.
REM ============================================================

set ROOT=%~dp0
set API=%ROOT%IncomeMeter.Api
set WEB=%ROOT%IncomeMeter.Api\frontend

echo.
echo === IncomeMeter local start ===
echo.

REM ---- prerequisites --------------------------------------------------
where dotnet >nul 2>nul || (echo [ERROR] dotnet SDK not found on PATH & goto :fail)
where node   >nul 2>nul || (echo [ERROR] Node.js not found on PATH & goto :fail)

if not exist "%API%\appsettings.Development.json" (
  echo [ERROR] %API%\appsettings.Development.json is missing.
  echo         Copy appsettings.Development.template.json to appsettings.Development.json
  echo         and fill in the secrets listed in LOCAL-DEV.md.
  goto :fail
)

if not exist "%WEB%\node_modules" (
  echo [INFO] Installing frontend dependencies...
  pushd "%WEB%"
  call npm install
  popd
)

REM ---- HTTPS dev certificate (the frontend calls https://localhost:7079) ---
dotnet dev-certs https --check --trust >nul 2>nul
if errorlevel 1 (
  echo [INFO] Trusting the ASP.NET Core HTTPS dev certificate - you may get a Windows prompt...
  dotnet dev-certs https --trust
)

REM ---- API -------------------------------------------------------------
echo [INFO] Starting API at https://localhost:7079  ^(swagger: /swagger^)
start "IncomeMeter API" cmd /k "cd /d "%API%" && set ASPNETCORE_ENVIRONMENT=Development&& dotnet run --launch-profile https"

REM ---- wait for the API to answer before starting the frontend ----------
echo [INFO] Waiting for the API...
set /a tries=0
:waitapi
set /a tries+=1
curl.exe -sk -o NUL -w "%%{http_code}" --max-time 2 https://localhost:7079/api/expenses/categories 2>nul | findstr /c:"200" >nul
if not errorlevel 1 goto :apiup
if %tries% GEQ 60 (
  echo [WARN] API did not respond after 60s - check the "IncomeMeter API" window. Starting frontend anyway.
  goto :apiup
)
timeout /t 1 /nobreak >nul
goto :waitapi
:apiup

REM ---- Frontend ---------------------------------------------------------
echo [INFO] Starting frontend at http://localhost:5173
start "IncomeMeter Web" cmd /k "cd /d "%WEB%" && npm run dev"

timeout /t 4 /nobreak >nul
start "" http://localhost:5173/expenses

echo.
echo Both processes are running in their own windows.
echo   API : https://localhost:7079   ^(http://localhost:5005^)
echo   Web : http://localhost:5173
echo.
exit /b 0

:fail
echo.
pause
exit /b 1
