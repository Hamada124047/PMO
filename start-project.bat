@echo off
setlocal enabledelayedexpansion

if "%~1"=="--open-swagger" goto :open_swagger_worker

title PMO Project Portfolio Management System - Launcher
echo ============================================================================
echo   PMO PROJECT PORTFOLIO MANAGEMENT SYSTEM
echo ============================================================================
echo.

:: 1. Dynamically detect project root directory (never use hardcoded absolute paths)
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

echo [INFO] Project Root detected dynamically:
echo        "%PROJECT_ROOT%"
echo.

:: 2. Verify required directories exist
if not exist "%PROJECT_ROOT%\backend\PmoSystem.Api\PmoSystem.Api.csproj" goto :err_no_backend
if not exist "%PROJECT_ROOT%\frontend\package.json" goto :err_no_frontend

:: 3. Check that .NET SDK is installed
echo [CHECK 1/3] Checking .NET SDK installation...
where dotnet >nul 2>&1
if errorlevel 1 goto :err_no_dotnet
for /f "tokens=*" %%i in ('dotnet --version') do set DOTNET_VER=%%i
echo [OK] .NET SDK found (Version: %DOTNET_VER%)

:: 4. Check that Node.js and npm are installed
echo [CHECK 2/3] Checking Node.js and npm installation...
where node >nul 2>&1
if errorlevel 1 goto :err_no_node
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i

where npm >nul 2>&1
if errorlevel 1 goto :err_no_npm
for /f "tokens=*" %%i in ('call npm -v') do set NPM_VER=%%i
echo [OK] Node.js (%NODE_VER%) and npm (%NPM_VER%) found.

:: 5. Check whether frontend dependencies are installed; install if missing
echo [CHECK 3/3] Checking Angular frontend dependencies...
if not exist "%PROJECT_ROOT%\frontend\node_modules\" call :install_frontend_deps
if errorlevel 1 exit /b 1

echo.
echo ============================================================================
echo   STARTING SERVICES IN SEPARATE TERMINAL WINDOWS
echo ============================================================================
echo   Backend API URL : http://localhost:5000
echo   Swagger UI URL  : http://localhost:5000/swagger
echo   Angular UI URL  : http://localhost:4200
echo ============================================================================
echo.

:: 6. Start ASP.NET Core Web API Backend in a dedicated window
echo [START] Launching ASP.NET Core Web API Backend...
start "PMO-Backend-API" /D "%PROJECT_ROOT%\backend\PmoSystem.Api" cmd /k "set ASPNETCORE_ENVIRONMENT=Development&& dotnet run --urls=http://localhost:5000"

:: 7. Start Angular Frontend in a dedicated window
echo [START] Launching Angular Frontend...
start "PMO-Angular-Frontend" /D "%PROJECT_ROOT%\frontend" cmd /k "npm start"

:: 8. Automatically open Swagger API endpoint once backend responds
start "PMO-Swagger-Launcher" /MIN cmd /c ""%~f0" --open-swagger"

echo.
echo [SUCCESS] Both Backend and Frontend processes have been launched!
echo           - Swagger UI (http://localhost:5000/swagger) will open automatically once ready.
echo           - Open http://localhost:4200 in your browser for the Angular app.
echo           - Run stop-project.bat at any time to stop all services cleanly.
echo.
endlocal
exit /b 0

:install_frontend_deps
echo [INFO] Frontend dependencies not found in frontend\node_modules.
echo [ACTION] Running "npm install" in "%PROJECT_ROOT%\frontend"...
pushd "%PROJECT_ROOT%\frontend"
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo [ERROR] Failed to install Angular frontend dependencies.
    popd
    pause
    exit /b 1
)
popd
echo [OK] Frontend dependencies installed successfully.
exit /b 0

:open_swagger_worker
set /a ATTEMPTS=0
:open_swagger_loop
set /a ATTEMPTS+=1
node -e "fetch('http://127.0.0.1:5000/swagger/v1/swagger.json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>&1
if not errorlevel 1 (
    start "" "http://localhost:5000/swagger"
    exit /b 0
)
if %ATTEMPTS% lss 40 (
    ping -n 2 127.0.0.1 >nul
    goto :open_swagger_loop
)
exit /b 0

:err_no_backend
echo [ERROR] Backend project not found at:
echo         "%PROJECT_ROOT%\backend\PmoSystem.Api\PmoSystem.Api.csproj"
echo         Please ensure the project structure is intact.
pause
exit /b 1

:err_no_frontend
echo [ERROR] Angular frontend project not found at:
echo         "%PROJECT_ROOT%\frontend\package.json"
echo         Please ensure the project structure is intact.
pause
exit /b 1

:err_no_dotnet
echo [ERROR] .NET SDK is not installed or not in system PATH.
echo         Please install .NET 8.0 SDK from https://dotnet.microsoft.com/download
pause
exit /b 1

:err_no_node
echo [ERROR] Node.js is not installed or not in system PATH.
echo         Please install Node.js LTS from https://nodejs.org/
pause
exit /b 1

:err_no_npm
echo [ERROR] npm is not installed or not in system PATH.
echo         Please verify your Node.js installation.
pause
exit /b 1
