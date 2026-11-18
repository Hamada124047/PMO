@echo off
setlocal enabledelayedexpansion

title PMO Project Portfolio Management System - Stopper
echo ============================================================================
echo   STOPPING PMO PROJECT PORTFOLIO MANAGEMENT SYSTEM
echo ============================================================================
echo.

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

echo [INFO] Stopping PMO Backend and Frontend processes...

:: 1. Stop windows by their dedicated window titles launched by start-project.bat
taskkill /FI "WINDOWTITLE eq PMO-Backend-API*" /T /F >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] Stopped PMO-Backend-API terminal window and child processes.
) else (
    echo [INFO] No window titled PMO-Backend-API was active.
)

taskkill /FI "WINDOWTITLE eq PMO-Angular-Frontend*" /T /F >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] Stopped PMO-Angular-Frontend terminal window and child processes.
) else (
    echo [INFO] No window titled PMO-Angular-Frontend was active.
)

:: 2. Also check and terminate any lingering processes listening on port 5000 (Backend) or 4200 (Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    if not "%%a"=="0" (
        echo [INFO] Terminating process on Backend Port 5000 (PID: %%a)...
        taskkill /PID %%a /F >nul 2>&1
    )
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4200" ^| findstr "LISTENING"') do (
    if not "%%a"=="0" (
        echo [INFO] Terminating process on Frontend Port 4200 (PID: %%a)...
        taskkill /PID %%a /F >nul 2>&1
    )
)

echo.
echo [SUCCESS] All PMO Project Portfolio Management System local processes stopped.
echo ============================================================================
endlocal
