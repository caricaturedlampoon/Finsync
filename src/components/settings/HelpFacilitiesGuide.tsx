import React, { useState } from 'react';
import {
  BookOpen,
  Zap,
  Search,
  X,
  ChevronDown,
  Check,
  Lightbulb,
  HelpCircle,
  ArrowRight,
  LayoutDashboard,
  Receipt,
  Landmark,
  CreditCard,
  TrendingUp,
  CalendarClock,
  Coins,
  Users,
  PieChart,
  ShieldCheck,
  Database,
  Sliders,
  Scale,
  Calculator,
  FileSpreadsheet,
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';
import { calculateStockDeliveryCharges, calculateMutualFundCharges } from '../../utils/statutoryCharges';
import { ActiveTab } from '../../types';
import { SettingsSectionId } from './SettingsModal';

interface HelpFacilitiesGuideProps {
  onClose: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenBackup: () => void;
  onOpenRecurring: () => void;
  onOpenSection: (section: SettingsSectionId) => void;
  onOpenNetWorth?: () => void;
  onOpenLoans?: () => void;
  onOpenDebts?: () => void;
  onOpenSplitExpenses?: () => void;
  onOpenAnalysisExport?: () => void;
}

export const HelpFacilitiesGuide: React.FC<HelpFacilitiesGuideProps> = ({
  onClose,
  onNavigateTab,
  onOpenBackup,
  onOpenRecurring,
  onOpenSection,
  onOpenNetWorth,
  onOpenLoans,
  onOpenDebts,
  onOpenSplitExpenses,
  onOpenAnalysisExport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>('dashboard_liquid_wealth');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('All');

  // Interactive SEBI Sandbox State
  const [demoType, setDemoType] = useState<'stock' | 'mf'>('stock');
  const [demoAction, setDemoAction] = useState<'buy' | 'sell'>('buy');
  const [demoQty, setDemoQty] = useState<number>(50);
  const [demoPrice, setDemoPrice] = useState<number>(1420);
  const [demoBrokerage, setDemoBrokerage] = useState<number>(20);

  const facilities = [
    {
      id: 'dashboard_liquid_wealth',
      category: 'Daily Banking & Cash',
      title: '1. Dashboard & Net Liquid Wealth',
      tagline: 'High-level financial cockpit with Net Liquid Wealth vs Gross Portfolio tracking',
      icon: LayoutDashboard,
      colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300',
      actionLabel: 'Go to Dashboard',
      onAction: () => onNavigateTab('home'),
      overview:
        'The Dashboard gives you an immediate financial snapshot. It distinguishes your "Net Liquid Wealth" (readily spendable cash and bank balances minus credit card liabilities) from your "Gross Total Net Worth" (which locks in long-term stocks, mutual funds, and gold bonds).',
      steps: [
        'View your Net Liquid Wealth highlight card at the very top to ensure you maintain a comfortable cash cushion.',
        'Review the Gross Total Wealth, monthly income, expense totals, and net savings rate in the Summary cards.',
        'Check quick action shortcuts to log transactions, trade securities, and view bank passbooks.',
        'Customize widget order or toggle widgets on/off in Settings → Customize Dashboard.',
      ],
      features: [
        'Calculates Net Liquid Wealth = (Bank Balances + Cash Wallets) − Credit Card Debts',
        'Tracks Month-to-Date (MTD) vs Year-to-Date (YTD) spending and savings velocity',
        'Displays Day-Change tracking for equity and mutual fund holdings',
        'Quick access to recent transactions, recurring schedules, and debt status',
      ],
      proTip:
        'Keep your Net Liquid Wealth positive! Never treat credit card limits as liquid funds; always budget against actual liquid cash in savings accounts.',
    },
    {
      id: 'transactions_entry',
      category: 'Daily Banking & Cash',
      title: '2. Expense, Income & Transfer Entry',
      tagline: 'Log single transactions, category splits, and inter-account bank transfers',
      icon: Receipt,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
      actionLabel: 'View Recent Transactions',
      onAction: () => onNavigateTab('home'),
      overview:
        'Record any expense, income credit, or transfer between your own accounts. Every transaction directly updates account passbooks and analytics with zero lag.',
      steps: [
        'Tap the glowing "+" button at the center of the bottom navigation or click "Add Transaction" anywhere.',
        'Select the transaction type: Expense (money out), Income (money in), or Transfer (between accounts).',
        'Choose the Bank / Wallet account, enter the amount in Rupees, pick a Category, and add optional notes/payee.',
        'Tap "Save Transaction". The corresponding bank balance updates immediately in real-time.',
      ],
      features: [
        'Indian Rupee notation (₹ Lakhs and Crores) supported natively',
        'Custom categories with color codes and intuitive icons',
        'Bi-directional Transfers: automatically debits source account and credits destination account',
        'Instant search and filter by date, category, account, or keywords',
      ],
      proTip:
        'When transferring money between your own accounts (e.g. Bank to Cash or HDFC to ICICI), always use the "Transfer" tab so it does not falsely count as an expense or income.',
    },
    {
      id: 'accounts_passbooks',
      category: 'Daily Banking & Cash',
      title: '3. Bank Accounts, Wallets & Passbooks',
      tagline: 'Indian bank passbook experience with running balances and debit/credit audits',
      icon: Landmark,
      colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300',
      actionLabel: 'Open Accounts Tab',
      onAction: () => onNavigateTab('accounts'),
      overview:
        'Manage all your bank accounts (Savings, Current, Fixed Deposits), physical cash wallets, and UPI handles in one place. Each account features a full Indian Bank Passbook view showing running balances.',
      steps: [
        'Go to the "Accounts" tab to see all your active bank accounts, cash wallets, and credit cards.',
        'Click "Add Account" to add a new bank (HDFC, SBI, ICICI, etc.) with its initial balance and account type.',
        'Click "View Passbook" on any account card to view its ledger with Date, Particulars, Debit, Credit, and Balance.',
        'Use "Reconcile Balance" if you need to adjust for bank interest or SMS discrepancy.',
      ],
      features: [
        'Running Balance audit: every line calculates the precise account balance after that specific entry',
        'Filtering by Debits only, Credits only, or date ranges',
        'Passbook export to CSV for tax filing or external accounting',
        'Multi-bank support: easily separate personal, business, and emergency fund accounts',
      ],
      proTip:
        'Set your primary daily-use bank as the "Default Account" in Settings so new transactions pre-select it automatically.',
    },
    {
      id: 'credit_cards',
      category: 'Daily Banking & Cash',
      title: '4. Credit Cards & Limit Utilization',
      tagline: 'Monitor credit limits, keep utilization <30%, and log statement settlements',
      icon: CreditCard,
      colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300',
      actionLabel: 'View Credit Cards',
      onAction: () => onNavigateTab('accounts'),
      overview:
        'Credit cards represent debt liabilities. FinSync monitors your total credit limit against your outstanding unbilled spends, warning you if your credit utilization exceeds 30% to protect your CIBIL score.',
      steps: [
        'Add a new account with type "Credit Card", specifying its Total Credit Limit (e.g. ₹2,00,000).',
        'When you swipe or purchase online, log an Expense with your Credit Card as the payment account.',
        'The card displays real-time utilization (e.g. 18% Used) with color-coded alerts.',
        'When paying your credit card bill from your savings account, use "Pay Credit Card Bill" or log a Transfer from your Savings Account to the Credit Card.',
      ],
      features: [
        'CIBIL Health Alert: Visual indicator turns amber above 30% and red above 50% utilization',
        'One-click "Pay Credit Card Bill" settlement modal',
        'Separates card outstanding from liquid cash for accurate Net Liquid Wealth calculations',
        'Tracks available remaining credit limit in real-time',
      ],
      proTip:
        'Credit bureaus (CIBIL/Experian) penalize credit scores if credit utilization crosses 30%. Pay your outstanding bill before the statement generation date.',
    },
    {
      id: 'investments_portfolio',
      category: 'Investments & Wealth',
      title: '5. Investments & Portfolio Holdings',
      tagline: 'Track Equities, AMFI Mutual Funds, Sovereign Gold Bonds, and live closing NAVs',
      icon: TrendingUp,
      colorClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300',
      actionLabel: 'Open Portfolio',
      onAction: () => onNavigateTab('investments'),
      overview:
        'Keep your complete wealth portfolio organized across Indian Stocks (NSE/BSE), Mutual Funds (AMFI), and Sovereign Gold Bonds (SGB). Features real-time closing NAV updates, unrealized P&L, and FIFO cost accounting.',
      steps: [
        'Open the "Investments" tab from the bottom navigation or menu.',
        'Click "+ Add Holding" to manually record stocks or mutual fund units, or use "Execute Trade" for automated bank debit.',
        'Tap "Sync Live NAVs" to fetch the latest official closing NAVs directly from the AMFI official portal.',
        'Inspect your total invested value, current market value, overall return percentage, and Day-Change.',
      ],
      features: [
        'AMFI India official closing NAV integration (40,000+ mutual fund schemes supported)',
        'Day Change calculation: monitors today\'s portfolio swing versus yesterday\'s close',
        'FIFO (First-In, First-Out) ledger for accurate realized capital gains calculations',
        'CSV Import & Export for bulk portfolio onboarding from Zerodha, Groww, or CAMS/KFintech',
      ],
      proTip:
        'AMFI publishes official mutual fund NAVs every business evening after 9:00 PM IST. Tap "Sync Live NAVs" at night or morning to sync your entire mutual fund portfolio with one tap.',
    },
    {
      id: 'trade_execution',
      category: 'Investments & Wealth',
      title: '6. Dual-Write Trade Execution Desk',
      tagline: 'Execute stock/MF trades with simultaneous bank passbook deduction and SEBI tax note',
      icon: Zap,
      colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
      actionLabel: 'Go to Investments',
      onAction: () => onNavigateTab('investments'),
      overview:
        'The Dual-Write Trade Desk bridges your investments with your bank accounts. When you Buy, it adds units to your portfolio AND deducts the exact total cost (including SEBI statutory taxes) from your selected bank account. When you Sell, it credits net proceeds to your bank.',
      steps: [
        'Open the "Investments" tab from the bottom navigation or menu.',
        'Choose Buy or Sell, select the Asset Type (Stock or Mutual Fund), and select the security.',
        'Enter the Quantity (Shares/Units) and Price per Share. Quick presets are available for zero-brokerage or discount brokers.',
        'Review the SEBI statutory breakdown: Securities Transaction Tax (STT), Stamp Duty, Exchange Turnover Fee, and GST.',
        'Click "Execute & Record Dual Entry". Both your investment ledger and bank passbook are updated in a single atomic transaction.',
      ],
      features: [
        'SEBI Compliant Contract Note: exact breakdown of STT (0.1%), Stamp Duty (0.015%), Exchange fee (0.00297%), and 18% GST',
        'Auto-deducts CDSL/NSDL Depository DP charges (₹15.93 flat) on stock sales',
        'Dual-write transaction log automatically tags the bank passbook entry as [INVESTMENT_TRADE]',
        'Prevents double-entry errors between investment portfolio and bank accounts',
      ],
      proTip:
        'Below is a live interactive SEBI contract note sandbox! Change values to see how statutory taxes change in real time.',
      hasInteractiveSandbox: true,
    },
    {
      id: 'sip_manager',
      category: 'Investments & Wealth',
      title: '7. SIP (Systematic Investment Plan) Scheduler',
      tagline: 'Automate mutual fund SIP schedules with bank deductions and worker execution',
      icon: CalendarClock,
      colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300',
      actionLabel: 'Manage SIPs',
      onAction: () => onNavigateTab('investments'),
      overview:
        'Keep your automated investments on track. Create Monthly, Weekly, or Bi-weekly SIP mandates mapped to your primary bank account. The background worker reminds you and generates trade entries on due dates.',
      steps: [
        'Navigate to Investments → Click "SIP Manager" or "+ Add SIP".',
        'Select the mutual fund scheme, set the monthly SIP amount (e.g. ₹5,000), and pick the day of the month (e.g. 5th).',
        'Assign the funding bank account where the auto-debit takes place.',
        'When a SIP executes, the app automatically fetches the prevailing NAV, computes allotted units, and logs the passbook debit.',
      ],
      features: [
        'Auto-next-due-date calculation: handles weekends and market holidays',
        'Pause / Resume SIP toggles without deleting your SIP history',
        'XIRR performance calculation for active SIP cohorts',
        'Summary card showing total monthly SIP commitment vs monthly income',
      ],
      proTip:
        'Aim to schedule your SIP deductions 2 to 3 days after your salary credit date to ensure sufficient balance and prevent auto-debit bounces.',
    },
    {
      id: 'bond_cashflow',
      category: 'Investments & Wealth',
      title: '8. Sovereign Gold Bonds & Coupon Cash Flow Schedule',
      tagline: 'Track Sovereign Gold Bond maturities and 2.5% semi-annual interest schedules in passbook layout',
      icon: Coins,
      colorClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
      badgeColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/80 dark:text-yellow-300',
      actionLabel: 'View Bond Holdings',
      onAction: () => onNavigateTab('investments'),
      overview:
        'Sovereign Gold Bonds (SGB) pay a guaranteed 2.50% annual interest split into two semi-annual payouts. FinSync features a passbook-inspired schedule that details every past and upcoming coupon payout, along with final maturity redemption.',
      steps: [
        'Add an SGB holding (e.g. SGB 2023-24 Series IV) with issue price and units (grams).',
        'Click on the bond card to open "Holding Details" and navigate to "View Schedule / Cash Flow".',
        'The schedule displays all coupon payout dates, expected interest in Rupees, and maturity redemption.',
        'Click "Mark Logged in Bank" once you receive the RBI interest credit into your bank account.',
      ],
      features: [
        '2-Line Passbook layout inspired by traditional Indian bank passbooks',
        'Filter tabs: "All", "Coupons Only", "Pending Payouts", and "Logged in Bank"',
        'Automatic calculation of semi-annual interest = (Nominal Issue Price × Units × 2.5%) / 2',
        'Tax exemption tracker: SGB capital gains on redemption through RBI are 100% tax-free',
      ],
      proTip:
        'SGB coupon interest (2.5%) is taxable under "Income from Other Sources", but the final capital gains at 8-year maturity are completely exempt from tax for individuals under Section 47 of the Income Tax Act.',
    },
    {
      id: 'debts_loans',
      category: 'Debts & Bill Splitting',
      title: '9. Debts & Personal Loans Ledger',
      tagline: 'Track money you lent to friends or borrowed, repayment installments, and due dates',
      icon: Coins,
      colorClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300',
      actionLabel: 'Open Debts Ledger',
      onAction: () => onNavigateTab('debts'),
      overview:
        'Never forget who owes you money or what you need to return. The Debts Ledger maintains a running statement for every person you lend to or borrow from, with full partial-repayment histories.',
      steps: [
        'Switch to the "Debts" tab in the bottom navigation.',
        'Select "Lent" (You gave money to someone) or "Borrowed" (You took money from someone).',
        'Enter the contact name, amount, interest rate (optional), and repayment due date.',
        'When a payment is received or made, click "Record Repayment" to reduce the pending balance.',
      ],
      features: [
        'Clear distinction between "You are owed" (Assets) and "You owe" (Liabilities)',
        'Partial settlement tracking: log multiple installments until balance reaches zero',
        'Optionally link repayments to a bank account to update your passbook balance',
        'Reminders for overdue debts and upcoming settlement dates',
      ],
      proTip:
        'Money you lent to reliable friends is an asset, but money you borrowed reduces your Net Liquid Wealth. Keep your borrowed balance at zero whenever possible.',
    },
    {
      id: 'split_expenses',
      category: 'Debts & Bill Splitting',
      title: '10. Split Expenses & Group Ledgers',
      tagline: 'Split trip and flatmate bills equally, by exact amount, percentage, or shares',
      icon: Users,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
      actionLabel: 'Open Split Groups',
      onAction: () => onNavigateTab('split_expenses'),
      overview:
        'Easily split dinners, vacation road trips, and apartment rent with roommates without awkward calculations. Features 4 split strategies and an automated Debt-Simplification settlement matrix.',
      steps: [
        'Go to the "Split Expenses" tab and click "+ Create New Group" (e.g. "Goa Trip" or "Flat 402").',
        'Add group members (e.g. You, Rahul, Priya, Amit).',
        'Add an expense: select who paid (e.g. Rahul paid ₹4,000 for dinner) and how to split (Equal, Exact, %, or Shares).',
        'Click "Settlement Matrix" to see the simplified minimum transactions needed to settle everyone.',
      ],
      features: [
        '4 Splitting Modes: Split Equally, By Exact Amounts, By Percentages, or By Custom Shares',
        'Simplified Debt Settlement algorithm: minimizes the total number of inter-person cash transfers',
        'One-click "Claim to Personal Expense": imports your personal share directly into your personal budget',
        'WhatsApp-ready settlement summary generator for easy sharing with friends',
      ],
      proTip:
        'After a group trip is over, click "Settle Up" on individual members. You can record the settlement as an actual bank credit in your personal passbook!',
    },
    {
      id: 'analytics_insights',
      category: 'Daily Banking & Cash',
      title: '11. Analytics & Visual Spending Insights',
      tagline: 'Deep visual breakdown of spending categories, monthly cashflow, and savings rate',
      icon: PieChart,
      colorClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
      badgeColor: 'bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300',
      actionLabel: 'Open Analytics',
      onAction: () => onNavigateTab('analytics'),
      overview:
        'Turn numbers into actionable insights. Analyze your top expenditure categories, monthly savings velocity, and cashflow surplus over time with intuitive visual charts.',
      steps: [
        'Open the "Analytics" tab from the navigation bar.',
        'Toggle between Month-to-Date (MTD), Year-to-Date (YTD), or custom date ranges.',
        'Click on any slice in the Category Donut Chart to open Category Drilldown and inspect all underlying expenses.',
        'Review the Monthly Cashflow Bar Chart to ensure your green (Income) bars consistently surpass red (Expense) bars.',
      ],
      features: [
        'Category Donut Chart with percentage share and total rupee amount',
        'Cashflow Comparison: Income vs Expenses vs Net Savings over the past 6 months',
        'Category Drilldown: tap any category (e.g. Food & Dining) to see every transaction logged under it',
        'Savings Rate metric: shows exactly what percentage of your income was retained as wealth',
      ],
      proTip:
        'Financial planners recommend saving at least 20% to 30% of your take-home income. Check your Savings Rate gauge in Analytics to see if you meet this benchmark.',
    },
    {
      id: 'recurring_bills',
      category: 'Daily Banking & Cash',
      title: '12. Automated Recurring Bills & Salary',
      tagline: 'Set up recurring rent, salaries, subscriptions, and SIPs with 24h advance notice & duplicate prevention',
      icon: CalendarClock,
      colorClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300',
      actionLabel: 'Manage Recurring',
      onAction: () => {
        onClose();
        onOpenRecurring();
      },
      overview:
        'Never forget monthly rent, insurance premiums, or utility bills. Recurring transactions run automatically with a 24-hour advance execution notice and strict duplicate prevention to ensure only one entry is logged per scheduled cycle.',
      steps: [
        'Open Settings → Click "Recurring Schedules Engine" (or access via Automation & Maintenance dropdown).',
        'Click "+ Add Recurring Schedule".',
        'Set Title (e.g. "House Rent"), Amount, Account, Category, Frequency (Monthly/Weekly/Yearly), and Due Day.',
        'The engine notifies you 24 hours in advance and safely auto-creates exactly one entry per cycle, blocking manual duplicate clicks.',
      ],
      features: [
        '24-Hour Advance Execution Notice banner on both Dashboard and Recurring Manager',
        'Strict duplicate prevention: automatically enforces only one transaction per cycle',
        'Manual "Recorded" button disables automatically if already logged in the active cycle',
        'Supports Monthly, Bi-weekly, Weekly, and Annual recurring cycles offline',
        'Supports both Recurring Incomes (Salary credit) and Recurring Expenses (Rent, Subscriptions, EMIs)',
      ],
      proTip:
        'Set your monthly salary as an automated recurring income on your pay day so your monthly cashflow analytics reflect your earnings right on time.',
    },
    {
      id: 'security_lock',
      category: 'Security & System Tools',
      title: '13. Security, App Lock & Bank Account Settings',
      tagline: '3 distinct security facilities: App Lock & Biometrics, Bank Account Settings, and Feature Lock/Unlock',
      icon: ShieldCheck,
      colorClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      badgeColor: 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300',
      actionLabel: 'Configure Security',
      onAction: () => onOpenSection('security'),
      overview:
        'Your financial data is guarded across 3 distinct security facilities: 1) App Lock & Biometrics (4-digit startup PIN and Touch ID/Face ID), 2) Bank Account Settings (protected bank/card credentials, limits, and safe deletion), and 3) Feature Lock/Unlock (selective module access).',
      steps: [
        'Open Settings → Expand the "Security & Access Control" dropdown.',
        '1. App Lock & Biometrics: Toggle master PIN or WebAuthn platform biometrics (Touch ID / Face ID).',
        '2. Bank Account Settings: Configure protected bank passbooks, credit card limits, and safe account deletion.',
        '3. Feature Lock / Unlock: Selectively lock or unlock 7 modules (Expense entry, Analytics, Accounts, Investments, Debts, Split, Recurring).',
      ],
      features: [
        '3 distinct security facilities organized under a crisp collapsible dropdown',
        'Local 4-digit cryptographic PIN verification & WebAuthn biometric hardware unlock',
        'Protected Bank Account Settings zone for sensitive balance and credit limit modifications',
        'Granular Feature Lock/Unlock to hide or display specific modules as needed',
        'Android local security architecture with SQLCipher AES-256 and KeyStore protection',
      ],
      proTip:
        'Use Bank Account Settings to review and set accurate credit limits on credit cards, which keeps your Net Liquid Wealth calculation exact.',
    },
    {
      id: 'cloud_backup_sync',
      category: 'Security & System Tools',
      title: '14. Backup and Restore',
      tagline: 'End-to-end encrypted AES-256 local backups, Google Drive sync, and seamless recovery',
      icon: Database,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
      actionLabel: 'Open Backup and Restore',
      onAction: () => {
        onClose();
        onOpenBackup();
      },
      overview:
        'FinSync is 100% offline-first: your financial records are stored securely on your device. For cross-device continuity and disaster recovery, you can use Google Drive sync or export military-grade AES-256 encrypted backups.',
      steps: [
        'Click "Settings" → "Backup and Restore" or tap "Cloud Backup" in the header.',
        'To sync across multiple phones or PCs, click "Connect Cross-Device Sync" and sign in with your email or Google account.',
        'To create a portable offline backup, enter a secret password and click "Export Encrypted Backup (.exp)".',
        'To restore on a new phone, select your backup file, enter your encryption password, and all your accounts, investments, and transactions will be restored instantly.',
      ],
      features: [
        'Military-grade AES-256-GCM encryption with PBKDF2 key derivation (100,000 rounds)',
        'Synthetic fallback security: cross-device sync operates seamlessly even if remote OAuth providers are unconfigured or blocked',
        'ZIP and JSON export formats compatible with spreadsheets and data analysis tools',
        'Automated backup reminder prompt so you never lose financial records',
      ],
      proTip:
        'Keep an encrypted `.exp` backup file saved in your Google Drive or personal email once a month for peace of mind.',
    },
    {
      id: 'customization_system',
      category: 'Security & System Tools',
      title: '15. Settings Categories, Dropdowns & Quick Help',
      tagline: 'Crisp collapsible category dropdowns with quick "i" shortcut button on top right of Settings',
      icon: Sliders,
      colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
      badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-950/80 dark:text-slate-300',
      actionLabel: 'Customize App',
      onAction: () => onOpenSection('customize'),
      overview:
        'The Settings screen is organized into crisp, collapsible category dropdowns with smooth rotating arrow indicators. Quickly jump into Help at any time using the small "i" button on the top right of Settings.',
      steps: [
        'Open Settings: Profile card is highlighted at the very top.',
        'Expand "Customization and Personalization" to access all 4 options: Layout, Theme, Net Liquid Wealth, and Categories.',
        'Expand "Security & Access Control" to access the 3 distinct security facilities.',
        'Expand "Backup and Restore" or "Automation & Maintenance" to manage backups, CSVs, and recurring schedules.',
        'Tap the small "i" icon on the top right corner of the Settings screen to open this Help guide instantly.',
      ],
      features: [
        'Collapsible category accordions with smooth drop-down arrows',
        'Customization and Personalization groups all 4 personalization options together',
        'Top-right "i" shortcut button for one-tap direct access to Help & Facilities',
        'Direct Recurring Schedules Engine integration accessible right from Settings',
      ],
      proTip:
        'You can tap any category header to expand or collapse it, keeping your Settings screen clean and uncluttered.',
    },
    {
      id: 'net_worth_cockpit',
      category: 'Investments & Wealth',
      title: '16. Consolidated Net Worth Balance Sheet',
      tagline: 'Consolidated capital health, 6-term wealth breakdown & monthly progression',
      icon: Scale,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
      actionLabel: 'Open Net Worth Cockpit',
      onAction: () => {
        onClose();
        if (onOpenNetWorth) {
          onOpenNetWorth();
        } else {
          onNavigateTab('analytics');
        }
      },
      overview:
        'View your true consolidated financial standing across all asset classes and liabilities in one institutional balance sheet. Consolidates bank balances, credit card dues, money lent, money borrowed, investment holdings, and loans.',
      steps: [
        'Open the Net Worth Cockpit via the Dashboard hero highlight or Command Palette Search.',
        'Inspect the 6 interactive wealth breakdown cards (+ Bank & Cash, − CC Dues, + Money Lent, − Borrowed, + Investments, − Loans).',
        'Tap any breakdown card to jump directly to its dedicated management screen.',
        'Toggle between Weeks, Months, and Years to evaluate historical capital growth trajectories.',
        'Click "Export PDF Dossier" or "Download HTML" to archive institutional audit reports.',
      ],
      features: [
        'Exact algebraic accounting: (Banks − CC Dues + Lent − Borrowed + Investments − Loans)',
        'Interactive quick navigation cards: tap any term to jump to Accounts, Debts, Investments, or Loans',
        'Multi-frequency growth curves: weekly, monthly, and yearly historical trajectory curves',
        'Direct export to high-fidelity PDF dossier and standalone HTML audit file',
      ],
      proTip:
        'Net Worth is your ultimate scorecard. Reviewing it once every month ensures all accounts, liabilities, and holdings remain aligned.',
    },
    {
      id: 'loans_emi_manager',
      category: 'Debts & Bill Splitting',
      title: '17. Loans, EMIs & Amortization Manager',
      tagline: 'Track loan liabilities, automated monthly EMI deduction & amortization',
      icon: Calculator,
      colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300',
      actionLabel: 'Open Loans & EMI Manager',
      onAction: () => {
        onClose();
        if (onOpenLoans) {
          onOpenLoans();
        } else {
          onNavigateTab('debts');
        }
      },
      overview:
        'Manage Home Loans, Car Loans, Personal Loans, and Education Loans with full amortization tables and automatic passbook EMI deductions.',
      steps: [
        'Open Loans & EMI Manager from Tools, Settings, or Command Search.',
        'Click "+ Add New Loan" with loan amount, annual interest rate, tenure, and monthly EMI payment date.',
        'Designate a funding bank account for automated monthly EMI debit.',
        'Inspect the complete amortization table detailing principal vs interest split for every month.',
        'Optionally log prepayments to shorten your tenure and calculate total interest savings.',
      ],
      features: [
        'Dedicated system liability account linked directly to Net Worth balance sheet',
        'Full month-by-month amortization schedule with principal and interest breakdown',
        'Automated EMI payment processing with passbook debit entries',
        'Prepayment and foreclosure calculator with instant interest savings projection',
      ],
      proTip:
        'Even a small lump-sum annual prepayment towards principal significantly reduces total interest paid and cuts loan tenure by years.',
    },
    {
      id: 'executive_pdf_dossier',
      category: 'Investments & Wealth',
      title: '18. Executive PDF Dossier & Growth Analytics',
      tagline: 'Institutional wealth audit with 6 trailing monthly intervals & capital health',
      icon: FileSpreadsheet,
      colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300',
      actionLabel: 'Generate Wealth Dossier',
      onAction: () => {
        onClose();
        if (onOpenAnalysisExport) {
          onOpenAnalysisExport();
        } else {
          onNavigateTab('analytics');
        }
      },
      overview:
        'Generate comprehensive executive summary dossiers formatted for A4 printing and PDF archival, accounting for monthly milestone intervals and asset allocations.',
      steps: [
        'Open Executive Analysis Dossier from Settings → Data & Cloud, or from the Net Worth modal.',
        'Select your report scope: Consolidated Balance Sheet, Investment Audit, or Cashflow Statement.',
        'Review the executive summary, asset allocations, monthly progression timeline, and holdings audit.',
        'Click "Print / Save as PDF" or "Download HTML Report" for instant zero-dependency sharing.',
      ],
      features: [
        'Institutional presentation with A4 print layout and crisp typography',
        'Monthly interval progression: accounts for 6 trailing monthly milestones with MoM indicators',
        'SEBI-compliant statutory and asset allocation breakdowns',
        'Zero-network dependency: runs 100% locally on your device without cloud upload',
      ],
      proTip:
        'Save an executive PDF report at the end of every financial quarter for offline wealth record-keeping and tax preparation.',
    },
  ];

  const categoryPills = [
    'All',
    'Daily Banking & Cash',
    'Investments & Wealth',
    'Debts & Bill Splitting',
    'Security & System Tools',
  ];

  const filteredFacilities = facilities.filter((fac) => {
    // Check Category Filter
    if (activeCategoryFilter !== 'All' && fac.category !== activeCategoryFilter) {
      return false;
    }
    // Check Search Query
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      fac.title.toLowerCase().includes(query) ||
      fac.tagline.toLowerCase().includes(query) ||
      fac.category.toLowerCase().includes(query) ||
      fac.overview.toLowerCase().includes(query) ||
      fac.features.some((f) => f.toLowerCase().includes(query)) ||
      fac.steps.some((s) => s.toLowerCase().includes(query)) ||
      fac.proTip.toLowerCase().includes(query)
    );
  });

  // Calculate simulated contract note for interactive sandbox
  const isStock = demoType === 'stock';
  const turnover = demoQty * demoPrice;
  const stockCharges = calculateStockDeliveryCharges({
    type: demoAction,
    quantity: demoQty,
    price: demoPrice,
    brokeragePerOrder: demoBrokerage,
    isBSE: false,
  });
  const mfCharges = calculateMutualFundCharges(turnover, demoPrice, 0);
  const totalCharges = isStock ? stockCharges.totalCharges : mfCharges.totalCharges;
  const netBankImpact =
    demoAction === 'buy' ? -(turnover + totalCharges) : turnover - totalCharges;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hero Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 border border-indigo-500/20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Help
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Guides, step-by-step instructions, and FAQs
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Search Bar & Filters */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any facility, question, or keyword (e.g. 'passbook', 'SIP', 'split bills', 'SEBI taxes', 'credit utilization', 'cloud sync')..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filter Quick Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          <span className="text-slate-400 font-semibold shrink-0 mr-1">Filter by:</span>
          {categoryPills.map((cat) => {
            const isSelected = activeCategoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            );
          })}
          {(activeCategoryFilter !== 'All' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setActiveCategoryFilter('All');
                setSearchQuery('');
              }}
              className="px-2 py-1 text-rose-600 dark:text-rose-400 font-bold hover:underline shrink-0 ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span>Showing {filteredFacilities.length} of {facilities.length} facilities</span>
          <span>Click on any facility below to expand its guide</span>
        </div>
      </div>

      {/* Empty Search State */}
      {filteredFacilities.length === 0 && (
        <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <HelpCircle className="w-10 h-10 text-slate-400 mx-auto stroke-1" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            No facilities found matching &quot;{searchQuery}&quot;
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try searching for common terms like &quot;trade&quot;, &quot;passbook&quot;, &quot;SIP&quot;, &quot;split&quot;, &quot;PIN&quot;, or &quot;backup&quot;.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveCategoryFilter('All');
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs cursor-pointer"
          >
            Clear Search & Reset
          </button>
        </div>
      )}

      {/* Vertical Facility Cards */}
      <div className="space-y-3.5">
        {filteredFacilities.map((fac) => {
          const Icon = fac.icon;
          const isExpanded = selectedFacilityId === fac.id;

          return (
            <div
              key={fac.id}
              className={`rounded-2xl transition-all border ${
                isExpanded
                  ? 'bg-white dark:bg-slate-900 border-indigo-500/40 shadow-md ring-1 ring-indigo-500/20'
                  : 'bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
              }`}
            >
              {/* Card Header Row (Clickable to expand/collapse) */}
              <div
                onClick={() => setSelectedFacilityId(isExpanded ? null : fac.id)}
                className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${fac.colorClass}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                        {fac.title}
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fac.badgeColor}`}
                      >
                        {fac.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {fac.tagline}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg hidden sm:inline-block ${
                      isExpanded
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isExpanded ? 'Hide Details' : 'Read Guide'}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Expanded Content Body */}
              {isExpanded && (
                <div className="px-4 pb-5 sm:px-6 sm:pb-6 pt-1 border-t border-slate-100 dark:border-slate-800/80 space-y-5 animate-in fade-in duration-150">
                  {/* Quick Action Banner */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      <strong className="text-slate-900 dark:text-white">Facility Overview: </strong>
                      {fac.overview}
                    </p>
                    {fac.actionLabel && fac.onAction && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fac.onAction?.();
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs shrink-0 cursor-pointer active:scale-95 transition-all"
                      >
                        <span>{fac.actionLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Two-Column Grid: Step-by-Step Instructions & Key Capabilities */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* How to Use Steps */}
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
                          1
                        </span>
                        <span>How to Use (Step-by-Step)</span>
                      </h5>
                      <div className="space-y-2.5">
                        {fac.steps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                            <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-snug">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Key Capabilities */}
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">
                          ✓
                        </span>
                        <span>Key Capabilities & Highlights</span>
                      </h5>
                      <div className="space-y-2">
                        {fac.features.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-snug">{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pro Tip Callout */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                      <strong className="font-bold">Pro-Tip & Financial Best Practice: </strong>
                      {fac.proTip}
                    </div>
                  </div>

                  {/* Interactive SEBI Sandbox if Dual-Write Trade Desk */}
                  {fac.hasInteractiveSandbox && (
                    <div className="pt-2 space-y-4">
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-4">
                        <div>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>Interactive SEBI Contract Note & Tax Simulator</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono font-bold">
                              EDUCATIONAL SIMULATOR
                            </span>
                          </h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Interactive demo: test how quantity, price, and brokerages affect statutory charges and bank debit/credit.
                          </p>
                        </div>

                        {/* Interactive Simulator Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Asset Type
                            </label>
                            <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                              <button
                                type="button"
                                onClick={() => setDemoType('stock')}
                                className={`py-1 text-xs font-bold rounded cursor-pointer ${
                                  demoType === 'stock'
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                Stock
                              </button>
                              <button
                                type="button"
                                onClick={() => setDemoType('mf')}
                                className={`py-1 text-xs font-bold rounded cursor-pointer ${
                                  demoType === 'mf'
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                Mutual Fund
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Trade Action
                            </label>
                            <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                              <button
                                type="button"
                                onClick={() => setDemoAction('buy')}
                                className={`py-1 text-xs font-bold rounded cursor-pointer ${
                                  demoAction === 'buy'
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                Buy
                              </button>
                              <button
                                type="button"
                                onClick={() => setDemoAction('sell')}
                                className={`py-1 text-xs font-bold rounded cursor-pointer ${
                                  demoAction === 'sell'
                                    ? 'bg-rose-600 text-white'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                Sell
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Quantity (Shares/Units)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={demoQty}
                              onChange={(e) => setDemoQty(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Price per Unit (₹)
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="0.05"
                              value={demoPrice}
                              onChange={(e) => setDemoPrice(Math.max(1, parseFloat(e.target.value) || 1))}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>

                        {/* Live Calculation Output Card */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-500 block">Gross Trade Turnover</span>
                            <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
                              {formatINR(turnover)}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {demoQty} × ₹{demoPrice.toFixed(2)}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-500 block">SEBI Taxes & Fees</span>
                            <span className="text-base font-extrabold font-mono text-rose-600 dark:text-rose-400">
                              ₹{totalCharges.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                              {isStock ? (
                                <>STT: ₹{stockCharges.stt.toFixed(1)} | Stamp: ₹{stockCharges.stampDuty.toFixed(1)} | GST: ₹{stockCharges.gst.toFixed(1)}</>
                              ) : (
                                <>Stamp Duty: ₹{mfCharges.stampDuty.toFixed(2)}</>
                              )}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-500 block">
                              Net Bank Passbook Impact
                            </span>
                            <span
                              className={`text-base font-extrabold font-mono ${
                                demoAction === 'buy' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {demoAction === 'buy' ? '-' : '+'}
                              {formatINR(Math.abs(netBankImpact))}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {demoAction === 'buy' ? 'Debited from Bank' : 'Credited to Bank'}
                            </span>
                          </div>
                        </div>

                        {/* Statutory Tax Cheat Sheet Table */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-[11px] text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                              <tr>
                                <th className="py-2 px-3">Statutory Levy</th>
                                <th className="py-2 px-3">Official Rate</th>
                                <th className="py-2 px-3">Applicability</th>
                                <th className="py-2 px-3">Governing Body</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                              <tr>
                                <td className="py-1.5 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                                  Securities Transaction Tax (STT)
                                </td>
                                <td className="py-1.5 px-3 text-amber-600 dark:text-amber-400 font-bold">
                                  0.10% (Equity) / 0.001% (MF Sell)
                                </td>
                                <td className="py-1.5 px-3 font-sans text-slate-500">Buy & Sell of Delivery Shares</td>
                                <td className="py-1.5 px-3 font-sans text-slate-400">CBDT (Ministry of Finance)</td>
                              </tr>
                              <tr>
                                <td className="py-1.5 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                                  Stamp Duty
                                </td>
                                <td className="py-1.5 px-3 text-indigo-600 dark:text-indigo-400 font-bold">
                                  0.015% (Buy) / 0.005% (MF)
                                </td>
                                <td className="py-1.5 px-3 font-sans text-slate-500">Purchase / Allotment only</td>
                                <td className="py-1.5 px-3 font-sans text-slate-400">Indian Stamp Act</td>
                              </tr>
                              <tr>
                                <td className="py-1.5 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                                  CDSL / NSDL DP Charges
                                </td>
                                <td className="py-1.5 px-3 text-rose-600 dark:text-rose-400 font-bold">
                                  ₹15.93 flat per scrip
                                </td>
                                <td className="py-1.5 px-3 font-sans text-slate-500">Stock Selling (Delivery debit)</td>
                                <td className="py-1.5 px-3 font-sans text-slate-400">Depository (CDSL/NSDL)</td>
                              </tr>
                              <tr>
                                <td className="py-1.5 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                                  Goods & Services Tax (GST)
                                </td>
                                <td className="py-1.5 px-3 text-purple-600 dark:text-purple-400 font-bold">
                                  18.00%
                                </td>
                                <td className="py-1.5 px-3 font-sans text-slate-500">On Brokerage + SEBI + Exchange Fee</td>
                                <td className="py-1.5 px-3 font-sans text-slate-400">CBIC</td>
                              </tr>
                              <tr>
                                <td className="py-1.5 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                                  Short Term Capital Gains (STCG)
                                </td>
                                <td className="py-1.5 px-3 text-rose-600 dark:text-rose-400 font-bold">
                                  20.00% flat
                                </td>
                                <td className="py-1.5 px-3 font-sans text-slate-500">Equity held &lt; 12 months</td>
                                <td className="py-1.5 px-3 font-sans text-slate-400">Income Tax</td>
                              </tr>
                              <tr>
                                <td className="py-1.5 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                                  Long Term Capital Gains (LTCG)
                                </td>
                                <td className="py-1.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">
                                  12.50% (Exempt up to ₹1.25L)
                                </td>
                                <td className="py-1.5 px-3 font-sans text-slate-500">Equity held &gt; 12 months</td>
                                <td className="py-1.5 px-3 font-sans text-slate-400">Income Tax</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
