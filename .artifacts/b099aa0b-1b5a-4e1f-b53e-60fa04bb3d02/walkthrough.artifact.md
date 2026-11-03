# FinSync Engineering Walkthrough & Change Log

This document details all technical enhancements, architectural overhauls, UI/UX upgrades, and bug fixes implemented across FinSync.

## Summary of Accomplishments

### 1. Bulk Generator & Bulk History Enhancements
- **Dynamic Category Filtering**: Categorization in the Bulk Generator modal dynamically filters by transaction type (`expense` vs `income`).
- **To Account Support**: Added To Account selection for income generation, mirroring the transaction entry modal.
- **Modernized UX**: Rebuilt the Bulk Generator form with interactive type switcher tabs, account avatar selector tiles, and colored category icon tiles.
- **PF Bulk Action History**: Recorded Provident Fund (PF) bulk subscription logs in **Bulk History** with full atomic reversion and balance recalculation support.

### 2. Investment Activity Ledger & Action Modals
- **Full-Screen Activity Ledger**: Upgraded the Consolidated Investment Activity Ledger modal to occupy full screen (`fixed inset-0 z-50 h-screen w-screen`).
- **Asset-Dependent Actions**: Enforced strict asset-dependent action types (omitting Split/Demerger for Mutual Funds & Bonds; including Interest/Coupon and Principal Back for Bonds and PF).
- **Dynamic Type Filter Chips**: Added asset-aware action type filter chips ("Type") below the asset filter in the Activity Ledger screen.

### 3. Comprehensive Bonds & Fixed-Income Overhaul
- **Face Value (Par) & Coupon Calculations**: Anchored annual coupon income and accrued interest calculations strictly to Face Value ($Annual Coupon = \frac{\text{Units} \times \text{Face Value} \times \text{Rate}}{100}$).
- **Amortizing Principal Repayment**: When Principal Back is logged, remaining Face Value and Current Valuation decrease smoothly by the repaid installment amount ($\text{Face Value} = \text{Original} - \frac{\text{Principal Repaid}}{\text{Units}}$), avoiding premature zeroing out.
- **Zero Unrealized Capital P&L**: Fixed-income bonds now track valuation at amortized cost with zero volatile unrealized capital gains/losses. Coupon interest received is fully incorporated into total returns (`unrealizedGainLoss = totalInterestReceived`).
- **Custom Next Coupon Date & Pencil Edit**: Added a pencil edit icon (`Edit2`) next to the Next Coupon Date card in `BondDetailSection.tsx`, with backend scheduling (`generateBondNextDates`) anchored to the user's custom override.
- **Accrued Interest Fix**: Anchored accrued interest start dates to the most recent past scheduled coupon date (`pastSchedules[0].date`), ensuring logging a past coupon payment does not zero out active accrued interest.
- **Two-Column Layouts**: Arranged Bonds and SGB summary cards and holding item cards in clean, responsive 2-column grid layouts (`grid grid-cols-2 gap-3`).

### 4. Comprehensive Asset & Holding Reports with Embedded SVG Graphs
- **Asset Report Engine (`assetReportEngine.ts`)**: Built a robust report compilation engine generating clean HTML/PDF audit dossiers for categories (Stocks, Mutual Funds, Bonds/PF, Portfolio) and individual holdings/PF accounts.
- **Embedded SVG Graphs**: Included **Profit/Loss Bar Analytics charts** (`buildProfitLossBarChartSVG`) and **Asset Class Distribution Donut Charts** (`buildAssetAllocationDonutSVG`) inside all generated reports.
- **Bug Fixes**: Resolved `toInputDate is not defined` import errors and elevated `HtmlReportViewerModal` z-index to `z-[999]` for guaranteed topmost rendering.

## Verification & Build Status
- **Web Build**: Successfully built via Vite (`npm run build`).
- **Capacitor Sync**: Successfully synced (`npx cap sync android`).
- **Android Gradle Build**: Successfully compiled (`app:assembleDebug`) with zero errors.
