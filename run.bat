@echo off
setlocal enabledelayedexpansion

if "%~1"=="--open-swagger" goto :open_swagger_worker
if "%~1"=="--open-dotnet-swagger" goto :open_dotnet_swagger_worker

title NEXORA PMO - Project Portfolio Management System
echo ============================================================================
echo   NEXORA PMO - PORTFOLIO ^& STRATEGIC PROJECT MANAGEMENT SYSTEM
echo ============================================================================
echo.

:: Dynamically resolve project root from the directory containing this script
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

cd /d "%PROJECT_ROOT%"

echo [INFO] Project directory: "%PROJECT_ROOT%"
echo.

:: 1. Verify Node.js and npm
where node >nul 2>&1
if errorlevel 1 goto :err_no_node

where npm >nul 2>&1
if errorlevel 1 goto :err_no_npm

:: 2. If full-stack Node/Vite server (server.ts) is present, install & run it directly
if not exist "%PROJECT_ROOT%\server.ts" goto :fallback_dotnet

set "NEED_NPM_INSTALL=0"
if not exist "%PROJECT_ROOT%\node_modules\tsx\" set "NEED_NPM_INSTALL=1"
if not exist "%PROJECT_ROOT%\node_modules\swagger-ui-express\" set "NEED_NPM_INSTALL=1"
if not exist "%PROJECT_ROOT%\node_modules\mssql\" set "NEED_NPM_INSTALL=1"

if "%NEED_NPM_INSTALL%"=="1" call :install_deps
if errorlevel 1 exit /b 1

:: Ensure esbuild binary is initialized if npm blocked postinstall scripts
if exist "%PROJECT_ROOT%\node_modules\esbuild\install.js" node "%PROJECT_ROOT%\node_modules\esbuild\install.js" >nul 2>&1
if exist "%PROJECT_ROOT%\node_modules\tsx\node_modules\esbuild\install.js" node "%PROJECT_ROOT%\node_modules\tsx\node_modules\esbuild\install.js" >nul 2>&1

:: Optional: auto-start local Windows SQL Server LocalDB instance (MSSQLLocalDB) if installed
call :ensure_sqlserver_localdb

:: Optional: also start ASP.NET Core Web API & its Swagger endpoint in background if .NET SDK is available
set "HAS_DOTNET_SWAGGER=0"
where dotnet >nul 2>&1
if not errorlevel 1 if exist "%PROJECT_ROOT%\backend\PmoSystem.Api\PmoSystem.Api.csproj" set "HAS_DOTNET_SWAGGER=1"

if "%HAS_DOTNET_SWAGGER%"=="1" (
    echo [INFO] Starting ASP.NET Core Web API ^& Swagger on http://localhost:5000/swagger ...
    start "PMO-Backend-API" /MIN /D "%PROJECT_ROOT%\backend\PmoSystem.Api" cmd /c "set ASPNETCORE_ENVIRONMENT=Development&& dotnet run --urls=http://localhost:5000"
)

echo [RUN] Starting NEXORA PMO on http://localhost:3000 ...
echo       Swagger API UI   : http://localhost:3000/swagger
echo       OpenAPI Spec JSON: http://localhost:3000/swagger/v1/swagger.json
if "%HAS_DOTNET_SWAGGER%"=="1" echo       .NET Swagger UI  : http://localhost:5000/swagger
echo       Opening application and Swagger API endpoint in your browser once ready...
echo       Press Ctrl+C to stop the server.
echo.

start "NEXORA-Swagger-Launcher" /MIN cmd /c ""%~f0" --open-swagger"
if "%HAS_DOTNET_SWAGGER%"=="1" start "NEXORA-DotNet-Swagger-Launcher" /MIN cmd /c ""%~f0" --open-dotnet-swagger"

set "VITE_CONFIG_NATIVE_IGNORE_WARNING=true"
call npm run dev
goto :eof

:install_deps
echo [SETUP] Installing workspace dependencies...
call npm install --legacy-peer-deps
if not errorlevel 1 exit /b 0
echo [WARN] Standard install encountered a conflict. Retrying with --force...
call npm install --force
if not errorlevel 1 exit /b 0
echo [ERROR] Failed to install dependencies.
pause
exit /b 1

:open_swagger_worker
set /a ATTEMPTS=0
:open_swagger_loop
set /a ATTEMPTS+=1
node -e "fetch('http://127.0.0.1:3000/swagger/v1/swagger.json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>&1
if not errorlevel 1 (
    start "" "http://localhost:3000"
    start "" "http://localhost:3000/swagger"
    exit /b 0
)
if %ATTEMPTS% lss 40 (
    ping -n 2 127.0.0.1 >nul
    goto :open_swagger_loop
)
exit /b 0

:open_dotnet_swagger_worker
set /a ATTEMPTS=0
:open_dotnet_loop
set /a ATTEMPTS+=1
node -e "fetch('http://127.0.0.1:5000/swagger/v1/swagger.json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>&1
if not errorlevel 1 (
    start "" "http://localhost:5000/swagger"
    exit /b 0
)
if %ATTEMPTS% lss 30 (
    ping -n 2 127.0.0.1 >nul
    goto :open_dotnet_loop
)
exit /b 0

:ensure_sqlserver_localdb
where sqllocaldb >nul 2>&1
if errorlevel 1 (
    echo [INFO] SqlLocalDB CLI not found in PATH. Make sure Microsoft SQL Server LocalDB ^((localdb^)\MSSQLLocalDB^) is installed.
    exit /b 0
)
sqllocaldb start MSSQLLocalDB >nul 2>&1
if not errorlevel 1 (
    echo [OK] SQL Server LocalDB instance ^(MSSQLLocalDB^) is running.
) else (
    echo [WARN] Could not start SQL Server LocalDB instance ^(MSSQLLocalDB^). Verify LocalDB installation.
)
exit /b 0

:err_no_node
echo [ERROR] Node.js is not installed or not in system PATH.
echo         Please install Node.js LTS from https://nodejs.org/
pause
exit /b 1

:err_no_npm
echo [ERROR] npm is not installed or not in system PATH.
pause
exit /b 1

:fallback_dotnet
call "%PROJECT_ROOT%\start-project.bat"
endlocal
exit /b %ERRORLEVEL%
