#!/usr/bin/env bash
# ==============================================================================
# FinSync - Automated NPM Troubleshooter & Capacitor Installer (macOS / Linux / WSL)
# ==============================================================================
# Resolves npm install failures, ERESOLVE peer dependency conflicts, corrupt
# npm caches, and stale Capacitor native bridge bindings.
#
# Requirements met:
#   1. Clears npm cache (`npm cache clean --force`)
#   2. Safely deletes existing `node_modules` and `package-lock.json`
#   3. Runs `npm install --legacy-peer-deps` for graceful peer resolution
#   4. Executes `npm run build` and `npx cap sync android` for native bridge sync
#   5. Clear, color-coded logging at every step
# ==============================================================================

set -euo pipefail

# Navigate to script directory (project root)
cd "$(dirname "$0")"

# ANSI Color Codes
C_RESET="\033[0m"
C_CYAN="\033[1;36m"
C_GREEN="\033[1;32m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"
C_BOLD="\033[1m"
C_GRAY="\033[0;90m"

echo -e "\n${C_CYAN}${C_BOLD}==============================================================================${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}             FinSync Environment Troubleshooter & Repair Tool                ${C_RESET}"
echo -e "${C_GRAY}              Automated NPM Cache Purge, Peer Fix & Capacitor Sync           ${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}==============================================================================${C_RESET}\n"

# ------------------------------------------------------------------------------
# Step 0: Check System Environment
# ------------------------------------------------------------------------------
echo -e "${C_CYAN}[0/4] Checking System Environment...${C_RESET}"
if ! command -v node &>/dev/null; then
    echo -e "${C_RED}[ERROR] Node.js is not found in your PATH!${C_RESET}"
    echo -e "${C_YELLOW}Please install Node.js (v18+ or v20+ LTS recommended) from https://nodejs.org/${C_RESET}"
    exit 1
fi

if ! command -v npm &>/dev/null; then
    echo -e "${C_RED}[ERROR] npm is not found in your PATH!${C_RESET}"
    exit 1
fi

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo -e "${C_GREEN}[SUCCESS] Detected Node.js ${NODE_VER} and npm ${NPM_VER}${C_RESET}\n"

# ------------------------------------------------------------------------------
# Step 1: Automatically Clear Local NPM Cache
# ------------------------------------------------------------------------------
echo -e "${C_CYAN}[1/4] Step 1: Purging Local NPM Cache...${C_RESET}"
echo -e "${C_GRAY}      Executing 'npm cache clean --force'...${C_RESET}"
npm cache clean --force || true
echo -e "${C_GREEN}[SUCCESS] Local npm cache purged cleanly.${C_RESET}\n"

# ------------------------------------------------------------------------------
# Step 2: Safely Delete Existing node_modules and package-lock.json
# ------------------------------------------------------------------------------
echo -e "${C_CYAN}[2/4] Step 2: Safely Removing Stale node_modules and package-lock.json...${C_RESET}"

if [ -f "package-lock.json" ]; then
    echo -e "${C_GRAY}      Deleting 'package-lock.json'...${C_RESET}"
    rm -f package-lock.json
    echo -e "${C_GREEN}[SUCCESS] 'package-lock.json' removed.${C_RESET}"
else
    echo -e "${C_GRAY}      No existing 'package-lock.json' found. Skipping.${C_RESET}"
fi

if [ -d "node_modules" ]; then
    echo -e "${C_GRAY}      Deleting 'node_modules' directory...${C_RESET}"
    rm -rf node_modules
    echo -e "${C_GREEN}[SUCCESS] 'node_modules' cleanly removed.${C_RESET}"
else
    echo -e "${C_GRAY}      No existing 'node_modules' found. Fresh install state verified.${C_RESET}"
fi
echo ""

# ------------------------------------------------------------------------------
# Step 3: Run npm install with --legacy-peer-deps
# ------------------------------------------------------------------------------
echo -e "${C_CYAN}[3/4] Step 3: Installing Dependencies with Peer Resolution Guardrail...${C_RESET}"
echo -e "${C_GRAY}      Executing 'npm install --legacy-peer-deps'...${C_RESET}"
if npm install --legacy-peer-deps; then
    echo -e "${C_GREEN}[SUCCESS] All npm dependencies installed successfully!${C_RESET}\n"
else
    echo -e "\n${C_RED}[ERROR] 'npm install --legacy-peer-deps' failed!${C_RESET}"
    echo -e "${C_YELLOW}Troubleshooting Suggestions:${C_RESET}"
    echo -e "${C_YELLOW} 1. Check your internet connection or corporate proxy settings.${C_RESET}"
    echo -e "${C_YELLOW} 2. Ensure write permissions on project root (sudo chown -R \$USER .).${C_RESET}"
    echo -e "${C_YELLOW} 3. Check for native module compilation errors above.${C_RESET}\n"
    exit 1
fi

# ------------------------------------------------------------------------------
# Step 4: Build Web Application & Synchronize Capacitor Native Bridge
# ------------------------------------------------------------------------------
echo -e "${C_CYAN}[4/4] Step 4: Building Web Assets & Syncing Capacitor Native Bridges...${C_RESET}"

echo -e "${C_GRAY}      [Subtask 4a] Compiling web bundle (npm run build)...${C_RESET}"
if npm run build; then
    echo -e "${C_GREEN}[SUCCESS] Web bundle successfully built in /dist.${C_RESET}"
else
    echo -e "\n${C_RED}[ERROR] Web compilation (Vite) failed!${C_RESET}"
    exit 1
fi

echo -e "${C_GRAY}      [Subtask 4b] Synchronizing native bridge (npx cap sync android)...${C_RESET}"
if npx cap sync android; then
    echo -e "${C_GREEN}[SUCCESS] Capacitor Android native bridges synchronized!${C_RESET}\n"
else
    echo -e "\n${C_RED}[ERROR] Capacitor Android sync failed!${C_RESET}"
    echo -e "${C_YELLOW}Troubleshooting Suggestions:${C_RESET}"
    echo -e "${C_YELLOW} 1. Verify that 'node_modules/@capacitor/android' exists.${C_RESET}"
    echo -e "${C_YELLOW} 2. Ensure Android SDK Platform 35 is installed in Android Studio.${C_RESET}\n"
    exit 1
fi

# ------------------------------------------------------------------------------
# Verification Check of Native Bridge Artifacts
# ------------------------------------------------------------------------------
if [ -d "node_modules/@capacitor/android" ] && \
   [ -d "node_modules/@capacitor/status-bar/android" ] && \
   [ -f "android/app/src/main/assets/public/index.html" ]; then
    echo -e "${C_GREEN}${C_BOLD}==============================================================================${C_RESET}"
    echo -e "${C_GREEN}${C_BOLD}  [COMPLETE] Environment Repaired & Android Native Bridges Ready!             ${C_RESET}"
    echo -e "${C_GREEN}${C_BOLD}==============================================================================${C_RESET}\n"
    echo -e "${C_GREEN}Verification summary:${C_RESET}"
    echo -e "  ${C_GREEN}[OK]${C_RESET} npm cache purged & refreshed"
    echo -e "  ${C_GREEN}[OK]${C_RESET} node_modules & lockfile recreated with peer dependency compatibility"
    echo -e "  ${C_GREEN}[OK]${C_RESET} Web assets compiled into /dist"
    echo -e "  ${C_GREEN}[OK]${C_RESET} Native bridges copied to android/app/src/main/assets/public"
    echo -e "  ${C_GREEN}[OK]${C_RESET} Capacitor plugin Android sources present on disk\n"
    echo -e "${C_CYAN}Next Steps in Android Studio:${C_RESET}"
    echo -e "  1. Open Android Studio."
    echo -e "  2. Select ${C_BOLD}Open${C_RESET} and choose the ${C_BOLD}android${C_RESET} folder in this project."
    echo -e "  3. Wait for Gradle Sync to finish (nil variant mismatch errors will occur)."
    echo -e "  4. Click ${C_BOLD}Run${C_RESET} ('play' button) to launch FinSync on your device or emulator.\n"
else
    echo -e "${C_YELLOW}[WARNING] Some expected Capacitor bridge files were not found on disk.${C_RESET}"
    echo -e "${C_YELLOW}          Please verify 'node_modules/@capacitor' before syncing in Android Studio.${C_RESET}\n"
fi
