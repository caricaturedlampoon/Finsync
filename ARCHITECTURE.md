# FinSync - System Architecture & Android Studio Integration Guide

> **Tagline**: Log · Split · Track · Analyse · Grow  
> **Tech Stack**: React 19 + TypeScript + Vite + Tailwind CSS + IndexedDB  
> **Target Platforms**: Progressive Web App (PWA) & Android Studio WebView Wrapper (APK)

---

## 1. Modular Directory Structure

The application is structured into clearly separated domains for high cohesion, low coupling, and easy navigation inside IDEs like Android Studio and VS Code:

```
src/
├── components/                 # Presentation & UI Modules
│   ├── accounts/              # Bank accounts, passbooks, credit card settlements
│   ├── analytics/             # Net Worth modal, monthly progression, chart views
│   ├── common/                # Shared UI controls: EmptyState, SkeletonLoader, Avatars
│   ├── dashboard/             # Cockpit widgets: Liquid Wealth, Recent Spends, Quick Actions
│   ├── debts/                 # Personal IOUs, Debt ledger, Group bill splitting
│   ├── investments/           # Equity/MF portfolio, SIP manager, AMFI NAV updater, Trade desk
│   ├── layout/                # Responsive Top Header, Bottom Navigation, Extended Tools
│   ├── loans/                 # Loan liabilities, amortization calculator, EMI scheduler
│   ├── notifications/         # Offline reminders & notification manager
│   ├── profile/               # User profile, circular avatar uploader, identity
│   ├── recurring/             # Recurring bills engine with duplicate prevention
│   ├── search/                # Virtualized Command Palette with quick action triggers
│   ├── security/              # Biometric / 4-digit PIN application vault
│   ├── settings/              # Settings modal, Help guide, Recycle bin, Personalization
│   └── transactions/          # Add/Edit transactions, category splits, transfers
├── context/
│   └── AppContext.tsx         # Central application state, atomic updates, and actions
├── data/
│   └── seedData.ts            # Realistic Indian demo seed data (₹ INR) & zero-state template
├── hooks/
│   ├── useGlobalShortcuts.ts  # Desktop keyboard shortcuts (Cmd/Ctrl + K, N, T)
│   └── usePWAInstall.ts       # Native PWA install prompt hooks
├── navigation/
│   ├── navigationManager.ts   # Core dynamic stack manager & Android hardware back interception
│   └── NavigationContext.tsx  # React Context and hooks (useNavigation, useRegisterModal)
├── services/
│   ├── autoBackupEngine.ts    # Background auto-backup scheduler
│   ├── googleDriveService.ts  # Cross-device cloud sync via Google Drive
│   ├── historicalPriceDb.ts   # Local IndexedDB for asset price histories
│   ├── marketPriceFetcher.ts  # AMFI NAV and Indian equity closing price synchronizer
│   └── offlineNotificationEngine.ts # Offline notification dispatcher
├── types/
│   └── index.ts               # Shared TypeScript domain models & interfaces
├── utils/
│   ├── amfiSipEngine.ts       # AMFI mutual fund catalog & automated SIP executor
│   ├── csvEngine.ts           # Strict CSV parser & bank passbook exporter
│   ├── fifoCalculator.ts      # Tax-compliant FIFO cost accounting for equities
│   ├── formatters.ts          # Indian Rupee (₹ Lakhs/Crores) & DD/MM/YYYY date formatting
│   ├── groupExpenseEngine.ts  # Simplified debt minimization algorithm for split groups
│   ├── investmentCsvEngine.ts # Broker CSV statement import/export (Zerodha, Groww)
│   ├── loanAmortizationEngine.ts # Month-by-month loan amortization & prepayment logic
│   ├── netWorthExportEngine.ts# Institutional PDF & standalone HTML wealth dossier generator
│   ├── statutoryCharges.ts    # SEBI contract note statutory charges (STT, Stamp Duty, GST)
│   ├── storageEngine.ts       # IndexedDB engine with immediate debounced write buffer
│   └── xirr.ts                # Newton-Raphson XIRR return algorithm
├── App.tsx                    # Root shell mounting NavigationProvider & GlobalModals
├── main.tsx                   # Vite React DOM entry point
└── index.css                  # Global styles, native touch rules, safe area padding
```

---

## 2. Core Architectural Pillars

### A. Dynamic Navigation Stack History (Module 1)
- **Problem Solved**: Replaced hardcoded "Back to Home" routes. Users navigating from Search, Timeline, or Cards into an Account Passbook, Holding Detail, or Settings subscreen can press Back and return to the exact origin screen and scroll position.
- **Implementation**:
  - `navigationManager.ts` maintains a runtime stack: `NavigationEntry[]`.
  - Push actions save current `window.scrollY` and push a history state (`window.history.pushState`).
  - Pop actions restore the prior view and automatically scroll back to the saved coordinates.
  - Modals and detail views register lifecycle listeners via `useRegisterModal()` and `useRegisterSubscreen()`.
  - Structured Logcat debugging logs:
    - `[Nav]: Pushed screen stack -> "Holding Detail" (subscreen) [depth: 2]`
    - `[Nav]: Popped screen stack <- "Holding Detail" (subscreen) [remaining: 1]`

### B. Native Android Hardware Back-Button Support
- **Popstate Interception**: Listens to Android hardware back press and edge-swipe gesture (`popstate` event).
- **Subscreen / Modal Dismissal**: If any modal, sheet, or subview is open, hardware back dismisses it immediately without exiting the app.
- **Exit Confirmation Toast**: If pressed while on the root Home dashboard, FinSync displays `"Press back again to exit FinSync"`. A second press within 2000ms confirms exit.

### C. APK & Android WebView Compatibility (Module 2)
- **Relative Asset Resolution**: All assets, scripts, and links use relative paths (`./`) with `base: './'` in `vite.config.ts`. This guarantees assets load seamlessly under Android's `file:///android_asset/` scheme without 404 errors.
- **Native Touch CSS Rules**:
  - `overscroll-behavior-y: none;` on `body` disables accidental browser pull-to-refresh bouncing.
  - `-webkit-tap-highlight-color: transparent;` removes default grey highlight flashes on tap.
  - `user-select: none;` on interactive controls prevents accidental text selection during fast taps.
  - `touch-action: manipulation;` eliminates the 300ms double-tap zoom delay.
  - Safe area insets: `padding-top: env(safe-area-inset-top)` and `padding-bottom: env(safe-area-inset-bottom)` protect headers and toolbars from camera cutouts and gesture bars.

### D. Mobile UI/UX & Instant Persistence (Module 3)
- **Debounced Storage Engine (`storageEngine.ts`)**:
  - Commits state updates immediately with a 150ms buffer.
  - Listens to `pagehide`, `visibilitychange`, and `beforeunload` events to execute a synchronous emergency flush before Android terminates background webview processes.
- **Tactile Touch Feedback**:
  - All interactive elements adhere to a minimum 44x44px touch target.
  - Active tactile feedback: `:active { transform: scale(0.97); opacity: 0.85; }`.
- **Empty & Loading States**:
  - `EmptyState.tsx` renders illustrative empty views with prominent call-to-action buttons.
  - `SkeletonLoader.tsx` renders shimmering skeleton rows and cards during initial load or calculations.

---

## 3. Android Studio WebView Wrapper (Sample MainActivity.kt)

To bundle FinSync into a production Android APK, open the project in Android Studio and configure your `MainActivity.kt`:

```kotlin
package com.finsync.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        val settings: WebSettings = webView.settings

        // Enable HTML5 features
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.setSupportZoom(false)

        webView.webViewClient = WebViewClient()

        // Load built web assets from file:///android_asset/dist/index.html
        webView.loadUrl("file:///android_asset/dist/index.html")

        // Forward hardware back button to WebView history
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }
}
```

---

## 4. Verification & Testing Checklist

- [x] **Dynamic Back Navigation**: Verified in Header and subviews; pops to exact origin and restores scroll position.
- [x] **Android Hardware Back**: Popstate handler dismisses open modals/sheets; root screen triggers double-back exit confirmation.
- [x] **Relative Asset Paths**: Built with `base: './'` for `file:///android_asset/` compatibility.
- [x] **Native Touch CSS**: `overscroll-behavior-y: none`, `user-select: none`, `-webkit-tap-highlight-color: transparent`, and 44px touch targets.
- [x] **Instant Storage Writes**: IndexedDB debounced writer with 150ms delay and `pagehide` immediate flush.
- [x] **Empty & Loading Placeholders**: Reusable `EmptyState` and `SkeletonLoader` components.
- [x] **Net Worth Clutter Cleaned**: Removed formula equation string; retained 6 interactive component cards.
- [x] **Net Worth Monthly Timeline**: Dossier exports explicitly use 6 trailing monthly intervals with MoM metrics.
