#!/usr/bin/env bash
# ==============================================================================
# FinSync - Automated Environment & Build Setup Script
# ==============================================================================
# Validates node_modules, installs peer dependencies, compiles web assets,
# syncs Capacitor native bridges, and optionally builds the Android debug APK.
#
# Usage:
#   ./build_setup.sh              # Syncs web assets and native bridges
#   ./build_setup.sh --build-apk  # Also compiles Android debug APK
# ==============================================================================

set -e

# Change to script directory (root of project)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=========================================================================="
echo " 🚀 FinSync Android & Web Build Setup"
echo "=========================================================================="

# 1. Check & Install Node Modules
if [ ! -d "node_modules/@capacitor/android" ]; then
    echo "📦 [Step 1/3] 'node_modules/@capacitor/android' missing. Installing dependencies..."
    npm install --legacy-peer-deps
else
    echo "✅ [Step 1/3] Node modules and Capacitor plugins verified on disk."
fi

# 2. Build Web Application
echo "⚙️  [Step 2/3] Building production web assets (Vite)..."
npm run build

# 3. Sync Web Assets with Android Capacitor Project
echo "🔄 [Step 3/3] Syncing assets with Android project (npx cap sync android)..."
npx cap sync android

echo "=========================================================================="
echo "🎉 Setup & Capacitor sync completed successfully!"
echo "   You can now open the 'android/' folder in Android Studio and run/sync."
echo "=========================================================================="

# Optional: Assemble APK if requested
if [[ "$*" == *"--build-apk"* ]] || [[ "$*" == *"--apk"* ]]; then
    echo ""
    echo "🔨 Building Android Debug APK via Gradle..."
    cd android
    if [ -f "./gradlew" ]; then
        chmod +x ./gradlew
        ./gradlew assembleDebug
        echo "✅ Debug APK generated at: android/app/build/outputs/apk/debug/app-debug.apk"
    else
        echo "❌ gradlew not found in android/ directory."
        exit 1
    fi
fi
