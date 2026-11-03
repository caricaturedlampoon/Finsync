@echo off
REM ==============================================================================
REM FinSync - Automated NPM Troubleshooter & Capacitor Installer (Windows)
REM ==============================================================================
REM Resolves npm install failures, ERESOLVE peer dependency conflicts, corrupt
REM npm caches, and stale Capacitor native bridge bindings.
REM
REM Requirements met:
REM   1. Clears npm cache (`npm cache clean --force`)
REM   2. Safely deletes existing `node_modules` and `package-lock.json`
REM   3. Runs `npm install --legacy-peer-deps` for graceful peer resolution
REM   4. Executes `npm run build` and `npx cap sync android` for native bridge sync
REM   5. Clear, color-coded logging at every step (with graceful CMD/PowerShell fallback)
REM ==============================================================================

setlocal EnableDelayedExpansion

REM Navigate to project root directory
cd /d "%~dp0"

REM Define ANSI Escape Sequence for Windows 10+ CMD & PowerShell
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "C_RESET=%ESC%[0m"
set "C_CYAN=%ESC%[96m"
set "C_GREEN=%ESC%[92m"
set "C_YELLOW=%ESC%[93m"
set "C_RED=%ESC%[91m"
set "C_BOLD=%ESC%[1m"
set "C_GRAY=%ESC%[90m"

echo.
echo %C_CYAN%%C_BOLD%==============================================================================%C_RESET%
echo %C_CYAN%%C_BOLD%             FinSync Environment Troubleshooter & Repair Tool                %C_RESET%
echo %C_GRAY%              Automated NPM Cache Purge, Peer Fix & Capacitor Sync           %C_RESET%
echo %C_CYAN%%C_BOLD%==============================================================================%C_RESET%
echo.

REM ------------------------------------------------------------------------------
REM Step 0: Check System Prerequisites (Node.js & NPM)
REM ------------------------------------------------------------------------------
echo %C_CYAN%[0/4] Checking System Environment...%C_RESET%
where node >nul 2>nul
if errorlevel 1 (
    echo %C_RED%[ERROR] Node.js is not found in your system PATH!%C_RESET%
    echo %C_YELLOW%       Please install Node.js (v18+ or v20+ LTS recommended) from https://nodejs.org/%C_RESET%
    goto :handle_failure
)

where npm >nul 2>nul
if errorlevel 1 (
    echo %C_RED%[ERROR] npm is not found in your system PATH!%C_RESET%
    goto :handle_failure
)

for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
for /f "tokens=*" %%v in ('npm -v 2^>nul') do set "NPM_VER=%%v"
echo %C_GREEN%[SUCCESS] Detected Node.js %NODE_VER% and npm %NPM_VER%%C_RESET%
echo.

REM ------------------------------------------------------------------------------
REM Step 1: Automatically Clear Local NPM Cache
REM ------------------------------------------------------------------------------
echo %C_CYAN%[1/4] Step 1: Purging Local NPM Cache...%C_RESET%
echo %C_GRAY%      Executing 'npm cache clean --force'...%C_RESET%
call npm cache clean --force
if errorlevel 1 (
    echo %C_YELLOW%[WARNING] npm cache clean reported a minor non-zero code. Continuing...%C_RESET%
) else (
    echo %C_GREEN%[SUCCESS] Local npm cache purged cleanly.%C_RESET%
)
echo.

REM ------------------------------------------------------------------------------
REM Step 2: Safely Delete Existing node_modules and package-lock.json
REM ------------------------------------------------------------------------------
echo %C_CYAN%[2/4] Step 2: Safely Removing Stale node_modules and package-lock.json...%C_RESET%

if exist "package-lock.json" (
    echo %C_GRAY%      Deleting 'package-lock.json'...%C_RESET%
    del /f /q "package-lock.json" >nul 2>&1
    if exist "package-lock.json" (
        echo %C_YELLOW%      Retrying deletion via PowerShell...%C_RESET%
        powershell -NoProfile -Command "Remove-Item -Force -Path 'package-lock.json' -ErrorAction SilentlyContinue" >nul 2>&1
    )
    if exist "package-lock.json" (
        echo %C_RED%[ERROR] Could not delete package-lock.json. File may be open in an editor.%C_RESET%
    ) else (
        echo %C_GREEN%[SUCCESS] 'package-lock.json' removed.%C_RESET%
    )
) else (
    echo %C_GRAY%      No existing 'package-lock.json' found. Skipping.%C_RESET%
)

if exist "node_modules" (
    echo %C_GRAY%      Deleting 'node_modules' directory (this may take a few moments)...%C_RESET%
    rmdir /s /q "node_modules" >nul 2>&1
    if exist "node_modules" (
        echo %C_YELLOW%      Standard removal blocked. Invoking PowerShell recursive force removal...%C_RESET%
        powershell -NoProfile -Command "Remove-Item -Recurse -Force -LiteralPath 'node_modules' -ErrorAction SilentlyContinue" >nul 2>&1
    )
    if exist "node_modules" (
        echo %C_YELLOW%[WARNING] Some files inside 'node_modules' are currently locked by a running process%C_RESET%
        echo %C_YELLOW%          (e.g., VS Code, Android Studio daemon, or a running Node server).%C_RESET%
        echo %C_YELLOW%          Attempting to proceed with package overwrite...%C_RESET%
    ) else (
        echo %C_GREEN%[SUCCESS] 'node_modules' cleanly removed.%C_RESET%
    )
) else (
    echo %C_GRAY%      No existing 'node_modules' found. Fresh install state verified.%C_RESET%
)
echo.

REM ------------------------------------------------------------------------------
REM Step 3: Run npm install with --legacy-peer-deps
REM ------------------------------------------------------------------------------
echo %C_CYAN%[3/4] Step 3: Installing Dependencies with Peer Resolution Guardrail...%C_RESET%
echo %C_GRAY%      Executing 'npm install --legacy-peer-deps'...%C_RESET%
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo.
    echo %C_RED%[ERROR] 'npm install --legacy-peer-deps' failed!%C_RESET%
    echo %C_YELLOW%Troubleshooting Suggestions:%C_RESET%
    echo %C_YELLOW% 1. Check your internet connection or corporate proxy settings.%C_RESET%
    echo %C_YELLOW% 2. If 'EPERM' or 'EBUSY' appears, close VS Code / Android Studio and re-run this script as Administrator.%C_RESET%
    echo %C_YELLOW% 3. Check for specific native module compilation errors above.%C_RESET%
    goto :handle_failure
)
echo %C_GREEN%[SUCCESS] All npm dependencies installed successfully!%C_RESET%
echo.

REM ------------------------------------------------------------------------------
REM Step 4: Build Web Application & Synchronize Capacitor Native Bridge
REM ------------------------------------------------------------------------------
echo %C_CYAN%[4/4] Step 4: Building Web Assets & Syncing Capacitor Native Bridges...%C_RESET%

echo %C_GRAY%      [Subtask 4a] Compiling web bundle (npm run build)...%C_RESET%
call npm run build
if errorlevel 1 (
    echo.
    echo %C_RED%[ERROR] Web compilation (Vite) failed!%C_RESET%
    echo %C_YELLOW%Please review the TypeScript/Vite error logs printed above.%C_RESET%
    goto :handle_failure
)
echo %C_GREEN%[SUCCESS] Web bundle successfully built in /dist.%C_RESET%

echo %C_GRAY%      [Subtask 4b] Synchronizing native bridge (npx cap sync android)...%C_RESET%
call npx cap sync android
if errorlevel 1 (
    echo.
    echo %C_RED%[ERROR] Capacitor Android sync failed!%C_RESET%
    echo %C_YELLOW%Troubleshooting Suggestions:%C_RESET%
    echo %C_YELLOW% 1. Verify that 'node_modules/@capacitor/android' exists.%C_RESET%
    echo %C_YELLOW% 2. Ensure Android SDK Platform 35 is installed in Android Studio.%C_RESET%
    goto :handle_failure
)
echo %C_GREEN%[SUCCESS] Capacitor Android native bridges synchronized!%C_RESET%
echo.

REM ------------------------------------------------------------------------------
REM Verification Check of Native Bridge Artifacts
REM ------------------------------------------------------------------------------
set "ALL_VERIFIED=1"
if not exist "node_modules\@capacitor\android" set "ALL_VERIFIED=0"
if not exist "node_modules\@capacitor\status-bar\android" set "ALL_VERIFIED=0"
if not exist "android\app\src\main\assets\public\index.html" set "ALL_VERIFIED=0"

if "!ALL_VERIFIED!"=="1" (
    echo %C_GREEN%%C_BOLD%==============================================================================%C_RESET%
    echo %C_GREEN%%C_BOLD%  [COMPLETE] Environment Repaired & Android Native Bridges Ready!             %C_RESET%
    echo %C_GREEN%%C_BOLD%==============================================================================%C_RESET%
    echo.
    echo %C_GREEN%Verification summary:%C_RESET%
    echo  %C_GREEN%[OK]%C_RESET% npm cache purged & refreshed
    echo  %C_GREEN%[OK]%C_RESET% node_modules & lockfile recreated with peer dependency compatibility
    echo  %C_GREEN%[OK]%C_RESET% Web assets compiled into /dist
    echo  %C_GREEN%[OK]%C_RESET% Native bridges copied to android/app/src/main/assets/public
    echo  %C_GREEN%[OK]%C_RESET% Capacitor plugin Android sources present on disk
    echo.
    echo %C_CYAN%Next Steps in Android Studio:%C_RESET%
    echo  1. Open Android Studio.
    echo  2. Select %C_BOLD%Open%C_RESET% and select the %C_BOLD%android%C_RESET% folder in this project.
    echo  3. Wait for Gradle Sync to finish (nil variant mismatch errors will occur).
    echo  4. Click %C_BOLD%Run%C_RESET% ('play' button) to launch FinSync on your device or emulator.
    echo.
) else (
    echo %C_YELLOW%[WARNING] Some expected Capacitor bridge files were not found on disk.%C_RESET%
    echo %C_YELLOW%          Please verify 'node_modules/@capacitor' before syncing in Android Studio.%C_RESET%
)

goto :end

:handle_failure
echo.
echo %C_RED%%C_BOLD%==============================================================================%C_RESET%
echo %C_RED%%C_BOLD%  [FAILED] Environment repair encountered an error.                          %C_RESET%
echo %C_RED%%C_BOLD%==============================================================================%C_RESET%
echo %C_YELLOW%Refer to TROUBLESHOOTING.md for manual resolution steps or retry this script.%C_RESET%
echo.
exit /b 1

:end
pause
exit /b 0
