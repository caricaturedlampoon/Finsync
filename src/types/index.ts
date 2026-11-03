export type AccountType = 'bank' | 'credit' | 'cash' | 'demat' | 'wallet' | 'debt';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  balance: number;
  accountNumber?: string;
  icon: string;
  color: string;
  includeInNetLiquid: boolean;
  notes?: string;
  creditLimit?: number; // for credit cards
  billingCycleDay?: number; // e.g. 15th of month
  paymentDueDay?: number; // e.g. 5th of next month
  customLogoUrl?: string; // custom uploaded icon/logo data URL
  createdAt: string;
  order?: number; // Sequence customization for display
  isArchived?: boolean; // Account archiving facility
  isSystemDebtAccount?: boolean; // Dedicated Debt management account
  isLocked?: boolean; // System-managed locked account (cannot be manually edited directly)
  isSystemLoanAccount?: boolean; // Dedicated Loan system account
  loanId?: string; // Associated loan ID
}

export interface AccountAdjustment {
  id: string;
  accountId: string;
  oldBalance: number;
  newBalance: number;
  difference: number; // positive for credit/inflow, negative for debit/outflow
  timestamp: string; // ISO timestamp
  note?: string;
}

export type CategoryType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isDefault?: boolean;
  order?: number;
}

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  time?: string; // Formatted 12-hour time (e.g. 03:51 PM)
  amount: number;
  type: TransactionType;
  categoryId?: string; // Optional for transfers
  categoryName?: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId?: string;
  toAccountName?: string;
  note: string;
  tags: string[];
  debtId?: string;
  debtActionType?: 'lent' | 'borrowed' | 'settle' | string;
  loanId?: string;
  investmentId?: string;
  investmentTransactionId?: string; // Links to holding ledger transaction id
  parentTransactionId?: string; // Companion fee or linked transaction id
  isInvestmentTransfer?: boolean;
  isInvestmentProfit?: boolean; // Profit booked on selling holding categorized as income
  isInvestmentLoss?: boolean; // Loss booked on selling holding categorized as expense
  realizedGainLoss?: number;
  isBalanceAdjustment?: boolean; // Critical: manual adjustments excluded from expense/income totals
  recurringId?: string; // ID of recurring schedule that generated this transaction
  recurringExecutionDate?: string; // Scheduled cycle date (YYYY-MM-DD)
  bulkActionId?: string; // Links to bulk action for audit and atomic reversion
  createdAt: string;
}

export type InvestmentAssetType = 'stock' | 'mutual_fund' | 'bond' | 'sgb' | 'pf';

export type PfType = 'EPF' | 'PPF' | 'VPF' | 'GPF' | 'CUSTOM';

export interface HoldingSubscription {
  enabled: boolean;
  amount: number;
  dayOfMonth: number; // 1 to 28
  fromAccountId?: string;
  employerAmount?: number; // Optional employer matching contribution for EPF
  status?: 'ACTIVE' | 'PAUSED' | 'active' | 'paused';
  notes?: string;
  lastExecutedMonthYear?: string;
}

export type BondType =
  | 'g_sec'
  | 't_bill'
  | 'corporate'
  | 'psu'
  | 'tax_free'
  | 'zero_coupon'
  | 'other';

export type InvestmentActionType =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'split'
  | 'bonus'
  | 'demerger'
  | 'interest'
  | 'coupon'
  | 'principal_repayment'
  | 'contribution'
  | 'withdrawal'
  | 'redemption'
  | 'premature_redemption';

export interface DemergedStockAllocation {
  id?: string;
  symbol: string;
  name: string;
  ratioA: number; // spinoff shares
  ratioB: number; // per parent shares held (e.g. ratioA : ratioB)
  costAllocationPercentage: number; // % of parent acquisition cost apportioned
  listingPrice?: number;
  allottedShares?: number;
  sharesAllotted?: number;
  allocatedCost?: number;
  calculatedAvgPrice?: number;
  demergedHoldingId?: string;
}

export interface InvestmentTransaction {
  id: string;
  holdingId: string;
  date: string;
  type: InvestmentActionType;
  quantity: number;
  price: number;
  totalAmount: number;
  linkedTransactionId?: string;
  linkedFeeTransactionId?: string; // Direct link to statutory charges / tax expense transaction
  accountingType?: 'transfer' | 'expense' | 'income' | 'corporate_action' | 'compound_balance' | 'payout_bank';
  notes?: string;
  splitRatio?: string;
  bonusRatio?: string;
  demergerRatio?: string;
  demergerOutcome?: 'keep_original' | 'extinguish_original'; // Demerger mode: keep original vs all new companies created
  costAllocationPercentage?: number;
  demergedHoldingId?: string;
  demergedSymbol?: string;
  demergedName?: string;
  demergedEntities?: DemergedStockAllocation[];
  oldQuantity?: number;
  newQuantity?: number;
  sipId?: string;
  schemeCode?: string;
  logMonthYear?: string;
  charges?: number;
  bulkActionId?: string; // Links to bulk action for audit and atomic reversion
  // Bonds, SGB & PF specific transaction fields
  employeeAmount?: number; // PF Employee share
  employerAmount?: number; // PF Employer share (EPF)
  voluntaryAmount?: number; // PF VPF share
  financialYear?: string; // e.g. "2025-26", "2026-27"
  goldRatePerGram?: number; // SGB Gold reference rate on trade date
  couponPeriod?: string; // e.g. "H1 FY26", "Q2 FY27"
  accruedDays?: number; // Days of accrued interest at settlement
  runningBalance?: number; // Calculated running corpus/balance
}

export type SipStatus = 'ACTIVE' | 'PAUSED';

export interface SipSchedule {
  id: string;
  portfolioId?: string;
  schemeCode: string; // AMFI Scheme Code (e.g. 120503)
  schemeName: string;
  installmentAmount: number;
  sipDate: number; // Day of month (1 - 28)
  fromAccountId?: string;
  status: SipStatus;
  frequency: 'MONTHLY';
  holdingId?: string;
  createdAt: string;
  lastExecutedMonthYear?: string; // YYYY-MM
  lastExecutedDate?: string;
  lastNavPrice?: number;
  lastUnitsAllotted?: number;
  notes?: string;
}

export interface SipExecutionRecord {
  id: string;
  sipId: string;
  schemeCode: string;
  schemeName: string;
  installmentAmount: number;
  units: number;
  navPrice: number;
  transactionDate: string;
  logMonthYear: string; // YYYY-MM
  status: 'EXECUTED' | 'SKIPPED_HOLIDAY' | 'FAILED';
  message?: string;
  createdAt: string;
  holdingTransactionId?: string;
  holdingId?: string;
  linkedTransactionId?: string;
}

export interface InvestmentHolding {
  id: string;
  symbol: string;
  name: string;
  customDisplayName?: string; // Custom display name or nickname to differentiate similarly named holdings
  assetType: InvestmentAssetType;
  dematAccountId: string;
  quantity: number;
  averageBuyPrice: number;
  purchaseDate?: string; // Date of initial asset acquisition (YYYY-MM-DD)
  currentPrice: number;
  previousClosePrice?: number; // Last business working day closing price/NAV for 1D change
  previousCloseDate?: string; // Date of last business working day
  lastPriceUpdate: string;
  notes?: string;
  isin?: string; // ISIN code for stocks or bonds
  amfiSchemeCode?: string; // AMFI scheme code for mutual funds (e.g. '122639')
  amfiSchemeName?: string; // Official AMFI scheme name
  customAvatar?: string; // Base64 data URL or custom image URL uploaded from device
  transactions?: InvestmentTransaction[]; // Individual holding buy/sell/dividend ledger
  isVerified?: boolean; // Verified badge status (green or blue tick)
  requiresConfirmation?: boolean; // User confirmation required status (yellow badge)
  confirmationReason?: string; // Explanation for why confirmation is needed
  // Bond Specific Fields
  bondType?: BondType; // G-Sec, T-Bill, Corporate, PSU, Tax-Free, Zero-Coupon
  issuer?: string; // e.g. "Reserve Bank of India", "Rural Electrification Corp"
  creditRating?: string; // e.g. "CRISIL AAA", "SOVEREIGN", "CARE AA+"
  couponRate?: number; // Annual coupon interest rate percentage (e.g. 7.75 for 7.75% p.a.)
  couponFrequency?: 'monthly' | 'quarterly' | 'semi_annually' | 'annually' | 'at_maturity'; // Payout frequency
  maturityDate?: string; // Bond / SGB maturity date (YYYY-MM-DD)
  faceValue?: number; // Face value / Par value per bond unit (e.g. 1000)
  ytm?: number; // Yield to maturity percentage
  redemptionValue?: number; // Value realized upon maturity (usually faceValue * units)
  accruedInterest?: number; // Accrued interest to date
  callPutDate?: string; // Call/Put option date for callable bonds
  // SGB Specific Fields
  trancheSeries?: string; // e.g. "2023-24 Series IV", "SGB 2028-IV"
  rbiIssuePrice?: number; // Issue price fixed by RBI (e.g. 6263 per gram)
  rbiIssueDate?: string; // Official allotment issue date
  goldReferencePrice?: number; // Latest market/IBJA reference gold price per gram
  goldPriceDate?: string; // Date of gold reference price
  goldPriceSource?: string; // Source e.g. "IBJA (India Bullion & Jewellers Assoc)"
  prematureRedemptionDate?: string; // 5-year lockin completion date for premature exit
  // PF Specific Fields
  pfType?: PfType; // Type of provident fund: EPF, PPF, VPF, GPF, CUSTOM
  uanOrAccountNumber?: string; // Universal Account Number (UAN) or PPF/GPF account number
  interestRate?: number; // Annual interest percentage for PF / Bonds (e.g. 8.25 for EPF, 7.10 for PPF)
  openingBalance?: number; // Opening corpus balance
  openingDate?: string; // Opening date of account
  interestCalculationMethod?: string; // e.g. "Monthly Running Balance with Annual Compounding"
  subscription?: HoldingSubscription; // Configurable monthly subscription
  bulkActionId?: string; // Bulk action audit ID if created via bulk import
}

export type DebtType = 'lent' | 'borrowed';

export interface Debt {
  id: string;
  personName: string;
  phone?: string;
  type: DebtType; // lent (they owe me) | borrowed (I owe them)
  principalAmount: number;
  currentBalance: number;
  dueDate?: string;
  interestRate?: number;
  status: 'active' | 'settled';
  notes?: string;
  createdAt: string;
  accountId?: string; // Funding or receiving user account
  initialTransactionId?: string; // Linked passbook transfer transaction
}

export interface ExpenseGroup {
  id: string;
  name: string;
  description?: string;
  memberIds: string[]; // ['user_me', contactId1, contactId2, ...]
  avatarColor?: string;
  createdAt: string;
}

export type GroupSplitType = 'EQUAL' | 'EXACT' | 'PERCENT' | 'SHARES';

export interface GroupExpenseSplit {
  memberId: string; // 'user_me' or contactId
  amount: number;
  percentage?: number;
  shares?: number;
}

export interface GroupExpense {
  id: string;
  groupId: string;
  title: string;
  totalAmount: number;
  paidBy: string; // 'user_me' or contactId
  paidByName?: string;
  date: string; // YYYY-MM-DD
  time?: string;
  splitType: GroupSplitType;
  splits: GroupExpenseSplit[];
  note?: string;
  categoryId?: string; // personal expense category
  accountId?: string; // bank/cash account used when user_me pays
  includeMyShareInPersonal?: boolean;
  linkedPersonalTxId?: string;
  linkedDebtTxIds?: string[];
  createdAt: string;
}

export interface DebtRepayment {
  id: string;
  debtId: string;
  date: string;
  amount: number;
  accountId: string;
  linkedTransactionId: string;
  note?: string;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  categoryId?: string;
  categoryName?: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId?: string;
  toAccountName?: string;
  frequency: RecurringFrequency;
  startDate: string;
  nextExecutionDate: string;
  lastExecutedDate?: string;
  note: string;
  tags: string[];
  isActive: boolean;
  autoExecute: boolean;
}

export type AppTheme = 'dark' | 'light' | 'system';

export type DashboardWidgetId =
  | 'summary_highlight'
  | 'net_liquid_wealth'
  | 'accounts_strip'
  | 'investment_highlights'
  | 'recent_transactions'
  | 'category_insight'
  | 'debts_card';

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  title: string;
  visible: boolean;
  order: number;
}

export interface UserProfile {
  name: string;
  avatarUrl?: string; // base64 / data URL
  email?: string;
  tagline?: string;
}

export type ActiveTab = 'home' | 'analytics' | 'accounts' | 'investments' | 'debts' | 'split_expenses';

export type AppFeatureId =
  | 'expense_entry'
  | 'analytics'
  | 'accounts'
  | 'investments'
  | 'debts'
  | 'split_expenses'
  | 'recurring';

export interface AppFeatureConfig {
  id: AppFeatureId;
  name: string;
  description: string;
  iconName: string;
}

export interface CardConfig {
  id: string;
  name: string;
  visible: boolean;
  order: number;
}

export interface AppSettings {
  theme: AppTheme;
  currencySymbol: string;
  dateFormat: string;
  dashboardWidgets: DashboardWidgetConfig[];
  analyticsCards?: CardConfig[];
  investmentCards?: CardConfig[];
  autoProcessRecurring: boolean;
  userProfile?: UserProfile;
  defaultAccountId?: string;
  defaultExpenseCategoryId?: string;
  defaultIncomeCategoryId?: string;
  navigationTabs?: ActiveTab[];
  featureLocks?: Partial<Record<AppFeatureId, boolean>>;
  verifiedBadgeColor?: 'blue' | 'green'; // verified badge tick color preference: blue or green tick
  autoBackupSchedule?: 'off' | 'daily' | 'weekly';
  autoBackupTarget?: 'local' | 'google_drive' | 'both';
  autoBackupPassword?: string;
  lastAutoBackupTimestamp?: number;
  isAppLockEnabled?: boolean;
  appLockPin?: string;
  useBiometricsIfAvailable?: boolean;
}

export interface PassbookRow {
  transaction: Transaction;
  dateFormatted: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balanceAfter: number;
  isAdjustment: boolean;
}

export type BinItemType =
  | 'transaction'
  | 'trade_action'
  | 'account'
  | 'holding'
  | 'category'
  | 'debt'
  | 'debt_record'
  | 'recurring'
  | 'sip'
  | 'group'
  | 'group_expense'
  | 'loan';

export interface BinItem {
  id: string; // unique bin identifier: bin_<timestamp>_<random>
  originalId: string; // original entity ID before deletion
  itemType: BinItemType;
  title: string; // descriptive title (e.g. "Swiggy Food Delivery", "Buy 10 TATASTEEL", "HDFC Savings Account")
  subtitle?: string; // context subtitle (e.g. "Expense • ₹450 • HDFC Bank Savings • 2026-10-20")
  amount?: number; // monetary value if applicable
  deletedAt: string; // ISO 8601 string of deletion timestamp
  expiresAt: string; // ISO 8601 string of expiration timestamp (deletedAt + 30 days)
  payload: any; // complete snapshot required for full data & ledger restoration
  metadata?: {
    accountName?: string;
    fromAccountName?: string;
    toAccountName?: string;
    categoryName?: string;
    symbol?: string;
    holdingId?: string;
    holdingName?: string;
    debtPersonName?: string;
    groupName?: string;
    notes?: string;
    tradeType?: string;
    quantity?: number;
    price?: number;
    [key: string]: any;
  };
}

export interface Loan {
  id: string;
  name: string;
  totalAmount: number;
  interestRate: number; // Annual % e.g. 8.5
  emiAmount: number;
  startDate: string; // YYYY-MM-DD
  paymentDay: number; // 1-31
  fundingAccountId: string; // Account from which EMI is debited
  loanAccountId: string; // System-managed locked account with negative balance
  tenureMonths?: number;
  notes?: string;
  createdAt: string;
  isActive: boolean;
}

export interface AppNotification {
  id: string;
  type:
    | 'daily_expense'
    | 'portfolio_daily'
    | 'portfolio_weekly'
    | 'portfolio_change'
    | 'category_spend'
    | 'recurring_sip'
    | 'pending_debt'
    | 'report_downloaded'
    | 'budget_alert';
  title: string;
  message: string;
  timestamp: string; // ISO string
  read: boolean;
  actionType?:
    | 'add_expense'
    | 'view_portfolio'
    | 'view_debts'
    | 'view_recurring'
    | 'view_analytics'
    | 'view_loans'
    | 'view_report'
    | 'view_budget'
    | 'view_calendar';
  extra?: {
    fileUri?: string;
    filename?: string;
    mimeType?: string;
    [key: string]: any;
  };
}

export type BudgetHealthColor = 'green' | 'orange' | 'red';

export interface MonthlyBudget {
  monthKey: string; // 'YYYY-MM'
  totalSpendCap: number; // overall monthly limit
  categoryBudgets: Record<string, number>; // categoryId -> limit amount
  selectedCategoryIds: string[]; // only categories explicitly chosen for budgeting
  updatedAt: string;
}

export interface CategoryBudgetProgress {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  limit: number;
  spent: number;
  left: number;
  percentUsed: number;
  health: BudgetHealthColor;
}

export interface MonthlyBudgetOverview {
  monthKey: string;
  totalSpendCap: number;
  totalSpent: number;
  totalLeft: number;
  totalPercentUsed: number;
  overallHealth: BudgetHealthColor;
  categoryProgress: CategoryBudgetProgress[];
}

export interface NotificationSettings {
  dailyExpenseReminder: {
    enabled: boolean;
    time: string; // "20:00"
    lastSentDate?: string;
  };
  portfolioDailyUpdate: {
    enabled: boolean;
    time: string; // "08:00"
    lastSentDate?: string;
  };
  portfolioWeeklySummary: {
    enabled: boolean;
    time: string; // "19:00"
    dayOfWeek: number; // 0 = Sunday
    lastSentDate?: string;
  };
  portfolioSignificantChange: {
    enabled: boolean;
    thresholdPercent: number; // default 2.5%
    lastCheckedDate?: string;
  };
  categorySpendAlerts: {
    enabled: boolean;
    thresholdPercent: number; // default 80%
    customLimits: Record<string, number>;
  };
  recurringSipReminders: {
    enabled: boolean;
    advanceHours: number; // default 24
  };
  pendingDebtAlerts: {
    enabled: boolean;
    daysThreshold: number; // default 7
  };
}

export type BulkActionType = 'TRANSACTION_CSV' | 'INVESTMENT_CSV' | 'STOCK_CSV' | 'MUTUAL_FUND_CSV';
export type BulkActionStatus = 'COMPLETED' | 'REVERTED';

export interface BulkAction {
  id: string; // generated ID e.g. "bulk_1729000000000"
  actionType: BulkActionType;
  fileName: string;
  timestamp: number; // epoch ms
  totalRows: number;
  status: BulkActionStatus;
  affectedAccountIds?: string[];
  importedTransactionIds?: string[];
  importedHoldingIds?: string[];
  importedHoldingTransactionIds?: string[];
  createdAt?: string;
}

export interface HtmlReportPayload {
  htmlContent: string;
  title: string;
  fileName: string;
  badge?: string;
  subtitle?: string;
  reportType?: 'analysis' | 'net_worth' | 'group' | 'debts' | 'custom';
}

