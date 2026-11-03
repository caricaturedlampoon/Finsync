# FinSync — Troubleshooting & Environment Repair Guide

This document provides deep architectural explanations of common installation, build, and Gradle sync issues in FinSync, along with automated and manual mechanisms to resolve each error.

---

## ⚡ 1-Click Automated Recovery Scripts

When facing `npm install` errors, stale caches, peer dependency conflicts, or missing Capacitor Android bridge files, run the automated troubleshooter:

### Windows:
Double-click or run from Command Prompt / PowerShell:
```cmd
fix_and_install.bat
```

### macOS / Linux / WSL:
```bash
chmod +x fix_and_install.sh
./fix_and_install.sh
```

### What These Scripts Automate:
1. **Purges npm cache**: Runs `npm cache clean --force` to eliminate corrupted package tarballs and checksum mismatches (`EINTEGRITY`).
2. **Safe recursive deletion**: Safely removes `package-lock.json` and `node_modules` (including PowerShell fallback on Windows to bypass path length and lock limitations).
3. **Peer dependency guardrail**: Runs `npm install --legacy-peer-deps` to guarantee clean installation with React 19.
4. **Build & Bridge Sync**: Runs `npm run build` and `npx cap sync android` to guarantee `/dist` and `android/app/src/main/assets/public/` are synchronized with native Android plugin references.
5. **Color-coded diagnostics**: Outputs clear, color-coded status indicators at every stage.

---

## 🔍 Common Failure Modes, Mechanisms & Cures

### 1. `npm ERR! code ERESOLVE` (Could not resolve dependency)
* **Symptom:**
  ```text
  npm ERR! code ERESOLVE
  npm ERR! ERESOLVE could not resolve
  npm ERR! While resolving: ...
  npm ERR! Conflicting peer dependency: react@^18.0.0
  ```
* **Mechanism:**
  FinSync leverages React 19. Certain transitive dependencies or legacy plugin definitions specify React 18 in their `peerDependencies`. By default, npm v7+ strictly enforces peer dependency resolution trees and halts when versions diverge.
* **Cure:**
  Always install using the `--legacy-peer-deps` flag:
  ```bash
  npm install --legacy-peer-deps
  ```
  *(Automated in `fix_and_install.bat` and `fix_and_install.sh`)*.

---

### 2. `npm ERR! code EPERM` or `EBUSY` (File Locking on Windows)
* **Symptom:**
  ```text
  npm ERR! code EBUSY
  npm ERR! syscall unlink
  npm ERR! path C:\...\node_modules\...
  npm ERR! resource busy or locked
  ```
* **Mechanism:**
  On Windows, open handles in Visual Studio Code, Android Studio's Gradle daemon, or active Node processes prevent files in `node_modules` from being unlinked.
* **Cure:**
  1. Close running development servers (`Ctrl+C` in your terminal).
  2. If using Android Studio, stop the Gradle daemon (`./gradlew --stop` inside the `android/` directory).
  3. Run `fix_and_install.bat` (which uses recursive PowerShell force-removal with exception catching).

---

### 3. `No matching variant of project :capacitor-status-bar was found... - No variants exist.`
* **Symptom:**
  ```text
  A problem occurred configuring project ':app'.
  > Could not resolve all dependencies for configuration ':app:debugCompileClasspath'.
     > Could not create task ':capacitor-status-bar:compileDebugAndroidTestSources'.
        > No matching variant of project :capacitor-status-bar was found.
  ```
* **Mechanism:**
  `android/capacitor.settings.gradle` links Capacitor plugins directly to `../node_modules/@capacitor/<plugin>/android`.
  If you open the `android/` directory in Android Studio before executing `npm install`, the path does not exist on disk. Gradle constructs a phantom stub project with zero variants (`release` or `debug`), causing Gradle sync to fail.
* **Cure:**
  1. Run `npm install --legacy-peer-deps` from the project root.
  2. Run `npm run build && npx cap sync android`.
  3. In Android Studio: Click **File** -> **Sync Project with Gradle Files**.

---

### 4. Gradle & Java Version Mismatch (`Unsupported class file major version 65`)
* **Symptom:**
  ```text
  Unsupported class file major version 65
  > Failed to apply plugin 'com.android.internal.application'.
  ```
* **Mechanism:**
  - Class file major version 65 corresponds to **Java 21**.
  - Class file major version 61 corresponds to **Java 17**.
  Older Gradle versions (< 8.5) cannot parse Java 21 bytecode.
* **FinSync Setup & Cure:**
  FinSync is pre-configured with:
  - **Gradle:** `8.11.1` (Supports Java 17, 21, and 22).
  - **Android Gradle Plugin (AGP):** `8.7.3`.
  - **Kotlin:** `2.0.21` with Compose Compiler Plugin `2.0.21` and KSP `2.0.21-1.0.28`.
  - **Target JDK:** `Java 21 (JDK 21)` (configured in `android/app/build.gradle` and root `android/build.gradle`).
  
  In Android Studio:
  1. Open **Settings** / **Preferences** (`Ctrl+Alt+S` or `Cmd+,`).
  2. Go to **Build, Execution, Deployment** -> **Build Tools** -> **Gradle**.
  3. Under **Gradle JDK**, select **Embedded JDK (version 21)** or your installed **JDK 21**.

---

### 5. Blank / White Screen on Android App Launch
* **Symptom:**
  The app launches on the emulator or physical device, but displays an empty white screen.
* **Mechanism:**
  The native WebView loads assets from `android/app/src/main/assets/public/index.html`. If the web assets were not compiled before running the Android build, this directory contains stale or missing HTML/JS bundles.
* **Cure:**
  Compile web assets and copy them into native assets:
  ```bash
  npm run build:android
  ```
  *(Or execute `./build_setup.sh` / `build_setup.bat`)*.

---

### 6. CORS / Network Request Blocked on External Market APIs
* **Symptom:**
  `Fetch API cannot load https://query1.finance.yahoo.com/... No 'Access-Control-Allow-Origin' header is present.`
* **Mechanism:**
  Browsers and WebViews enforce strict Cross-Origin Resource Sharing (CORS). External financial endpoints (Yahoo Finance, AMFI India) do not return CORS headers for client-side web origins.
* **Cure:**
  FinSync automatically routes all market quote requests through **Capacitor Native HTTP** (`CapacitorHttp.get`) via `src/services/networkClient.ts`.
  On Android, this executes through native OkHttp/Java HTTP client threads, completely bypassing browser CORS restrictions and setting proper `User-Agent` headers.

---

### 7. Encrypted Database / SQLCipher Decryption Error on Upgrade
* **Symptom:**
  `file is not a database: sqlite3_exec failed: file is not a database (code 26)`
* **Mechanism:**
  SQLCipher uses Android Keystore keys generated at first run. If an app was previously compiled with plaintext SQLite and then switched to SQLCipher without migration, the cipher header mismatches.
* **Cure:**
  FinSync's `AppDatabase.kt` includes automated schema migration and KeyStore fallback. If developing locally and switching database modes:
  1. On emulator/device, tap and hold FinSync -> **App Info** -> **Storage & Cache** -> **Clear Storage**.
  2. Re-launch the app. A fresh 256-bit AES master key will be minted in the Android KeyStore.

---

## 📊 Environment Compatibility Matrix

| Component | Tested Version | Compatible Range |
| :--- | :--- | :--- |
| **Node.js** | `v20.18.0` LTS | `>= v18.0.0` |
| **npm** | `v10.8.2` | `>= v9.0.0` |
| **Gradle** | `8.11.1` | `8.7` - `8.12` |
| **Android Gradle Plugin** | `8.7.3` | `8.7.0` - `8.7.3` |
| **Compile / Target SDK** | `35` (Android 15) | `34` - `35` |
| **Min SDK** | `24` (Android 7.0) | `24` |
| **Kotlin** | `2.0.21` | `2.0.21` |
| **KSP** | `2.0.21-1.0.28` | `2.0.21-1.0.28` |
| **JDK** | `21` (Java 21) | `21` (LTS) |
| **Android Studio** | `2024.2+ (Ladybug / Meerkat)` | `2024.1+ (Koala+)` |
