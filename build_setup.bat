@echo off
REM ==============================================================================
REM FinSync - Windows Automated Environment & Build Setup Script
REM ==============================================================================
REM Validates node_modules, installs peer dependencies, compiles web assets,
REM and syncs Capacitor native bridges for Android Studio.
REM
REM Usage:
REM   build_setup.bat
REM ==============================================================================

setlocal EnableDelayedExpansion

cd /d "%~dp0"

echo ==========================================================================
echo  FinSync Android & Web Build Setup
echo ==========================================================================

REM 1. Check & Install Node Modules
if not exist "node_modules\@capacitor\android" (
    echo [Step 1/3] 'node_modules\@capacitor\android' missing. Installing dependencies...
    call npm install --legacy-peer-deps
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        exit /b %errorlevel%
    )
) else (
    echo [Step 1/3] Node modules and Capacitor plugins verified on disk.
)

REM 2. Build Web Application
echo [Step 2/3] Building production web assets (Vite)...
call npm run build
if errorlevel 1 (
    echo [ERROR] Web build failed.
    exit /b %errorlevel%
)

REM 3. Sync Web Assets with Android Capacitor Project
echo [Step 3/3] Syncing assets with Android project (npx cap sync android)...
call npx cap sync android
if errorlevel 1 (
    echo [ERROR] Capacitor sync failed.
    exit /b %errorlevel%
)

echo ==========================================================================
echo Setup and Capacitor sync completed successfully!
echo You can now open the 'android' folder in Android Studio and run or sync.
echo ==========================================================================
pause
