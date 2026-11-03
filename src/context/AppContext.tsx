import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  getCalculatedSeedData,
  getZeroSeedData,
  INITIAL_HOLDINGS,
  INITIAL_TRANSACTIONS,
} from '../data/seedData';
import {
  Account,
  AppSettings,
  AppTheme,
  Category,
  Debt,
  DebtRepayment,
  ExpenseGroup,
  GroupExpense,
  GroupExpenseSplit,
  InvestmentHolding,
  InvestmentTransaction,
  PassbookRow,
  RecurringTransaction,
  SipSchedule,
  SipExecutionRecord,
  Transaction,
  TransactionType,
  UserProfile,
  ActiveTab,
  AppFeatureId,
  DemergedStockAllocation,
  BinItem,
  BinItemType,
  Loan,
  AccountAdjustment,
  BulkAction,
  BulkActionStatus,
  BulkActionType,
  HtmlReportPayload,
} from '../types';
import { generateHistoricalEmiCatchup } from '../utils/loanAmortizationEngine';
import { evaluateOfflineReminders, syncAllNativeScheduledReminders } from '../services/offlineNotificationEngine';
import { exportToStrictCSV, parseStrictCSV, recalculateBalances } from '../utils/csvEngine';
import {
  downloadCSVFile,
  exportMutualFundsCSV,
  exportStocksCSV,
  importMutualFundsCSV,
  importStocksCSV,
} from '../utils/investmentCsvEngine';
import { formatINR, formatDate, parseDate, toInputDate, getDebtContactSummary, getLatestTransactionPrice, getHoldingSharesAsOfDate, getHoldingStateAsOfDate, getTransactionTimestamp } from '../utils/formatters';
import { computeHoldingFifo } from '../utils/fifoCalculator';
import { navigationManager } from '../navigation/navigationManager';
import {
  executePendingSips,
  updateMutualFundsNavFromAmfi,
  fetchSchemeLatestNav,
  searchAmfiSchemes,
  KNOWN_MF_ALIASES,
  MutualFundNavUpdateResult,
  isSipExecutionMatchingTx,
  pruneOrphanSipExecutions,
  reconcileSipSchedules,
} from '../utils/amfiSipEngine';
import {
  getAllAssetMeta,
  getAssetMeta,
  getHistoricalPrices,
  AssetPriceMeta,
  pruneUnheldAssets,
} from '../services/historicalPriceDb';
import { loadPersistedState, DebouncedStorageWriter } from '../utils/storageEngine';
import { capacitorLifecycle } from '../services/capacitorLifecycle';
import {
  syncActiveAssetsPrices,
  handlePostImportHistoricalSync,
  getAssetIdentification,
  getPreviousTradingDay,
  getMostRecentTradingDay,
} from '../services/marketPriceFetcher';
import { User } from 'firebase/auth';
import { encryptBackupData, decryptBackupData } from '../utils/cryptoBackup';
import {
  initGoogleAuth,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOutGoogle,
  uploadEncryptedBackupToDrive,
  listDriveBackups,
  downloadDriveBackup,
  deleteDriveBackup,
  DriveBackupFile,
  getGoogleAccessToken,
} from '../services/googleDriveService';
import { checkAndDispatchBudgetAlerts } from '../services/budgetEngine';
import { checkAndExecuteAutoBackup } from '../services/autoBackupEngine';
import { fileService } from '../services/fileService';

export const SYSTEM_DEBT_ACCOUNT_ID = 'acc_debt_ledger';

export const DEFAULT_DEBT_ACCOUNT: Account = {
  id: SYSTEM_DEBT_ACCOUNT_ID,
  name: 'Debt & Loan Ledger',
  type: 'debt',
  initialBalance: 0,
  balance: 0,
  icon: 'Coins',
  color: '#8b5cf6',
  includeInNetLiquid: false,
  notes: 'Dedicated system account for tracking loans lent, borrowed liabilities and repayments',
  isSystemDebtAccount: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  order: 99,
};

export const SYSTEM_DEMAT_ACCOUNT_ID = 'acc_zerodha';

export const DEFAULT_DEMAT_ACCOUNT: Account = {
  id: SYSTEM_DEMAT_ACCOUNT_ID,
  name: 'Zerodha Demat',
  type: 'demat',
  initialBalance: 0,
  balance: 0,
  icon: 'TrendingUp',
  color: '#0ea5e9',
  includeInNetLiquid: false,
  notes: 'Primary trading and depository participant account',
  createdAt: '2026-09-01T00:00:00.000Z',
  order: 2,
};

const STORAGE_KEY = 'finsync_store_v1';
const storageWriter = new DebouncedStorageWriter<any>(STORAGE_KEY, 500);

export type { ActiveTab } from '../types';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  // Data
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  holdings: InvestmentHolding[];
  debts: Debt[];
  recurring: RecurringTransaction[];
  settings: AppSettings;
  loans: Loan[];
  accountAdjustments: AccountAdjustment[];
  bulkActions: BulkAction[];

  // Navigation & Modals
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
  selectedHoldingId: string | null;
  setSelectedHoldingId: (id: string | null) => void;
  drilldownCategory: any | null;
  setDrilldownCategory: (cat: any | null) => void;
  selectedDebtId: string | null;
  setSelectedDebtId: (id: string | null) => void;
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;

  isLoansModalOpen: boolean;
  setIsLoansModalOpen: (open: boolean) => void;
  isExtendedToolsOpen: boolean;
  setIsExtendedToolsOpen: (open: boolean) => void;
  modalOpenedFromTools: string | null;
  markModalOpenedFromTools: (modalId: string) => void;
  clearModalOpenedFromTools: () => void;
  handleModalToolClosed: (modalId: string) => void;
  isNotificationsModalOpen: boolean;
  setIsNotificationsModalOpen: (open: boolean) => void;
  isNetWorthModalOpen: boolean;
  setIsNetWorthModalOpen: (open: boolean) => void;
  isBulkActionsModalOpen: boolean;
  setIsBulkActionsModalOpen: (open: boolean) => void;
  isBudgetModalOpen: boolean;
  setIsBudgetModalOpen: (open: boolean) => void;
  openBudgetModal: () => void;
  isCalendarModalOpen: boolean;
  setIsCalendarModalOpen: (open: boolean) => void;
  openCalendarModal: () => void;

  isTransactionModalOpen: boolean;
  setIsTransactionModalOpen: (open: boolean) => void;
  transactionModalInitialType: TransactionType;
  setTransactionModalInitialType: (type: TransactionType) => void;
  openTransactionModal: (initialType?: TransactionType) => void;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;
  isDebtsModalOpen: boolean;
  setIsDebtsModalOpen: (open: boolean) => void;
  initialDebtCategoryTab: 'individual' | 'groups';
  setInitialDebtCategoryTab: (tab: 'individual' | 'groups') => void;
  openSplitExpenses: () => void;
  openDebts: () => void;
  isRecurringModalOpen: boolean;
  setIsRecurringModalOpen: (open: boolean) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;
  settingsInitialTab: 'help_guide' | 'profile' | 'customize' | 'security' | 'data' | 'maintenance' | 'all';
  setSettingsInitialTab: (tab: 'help_guide' | 'profile' | 'customize' | 'security' | 'data' | 'maintenance' | 'all') => void;
  openSettingsTab: (tab: 'help_guide' | 'profile' | 'customize' | 'security' | 'data' | 'maintenance' | 'all') => void;
  isCustomizeModalOpen: boolean;
  setIsCustomizeModalOpen: (open: boolean) => void;
  isCategoriesModalOpen: boolean;
  setIsCategoriesModalOpen: (open: boolean) => void;
  isInvestmentCSVModalOpen: boolean;
  setIsInvestmentCSVModalOpen: (open: boolean) => void;
  isTradeModalOpen: boolean;
  setIsTradeModalOpen: (open: boolean) => void;
  tradeModalInitialType: 'stock' | 'mutual_fund';
  tradeModalInitialHoldingId?: string;
  tradeModalInitialAction?: 'buy' | 'sell';
  openTradeModal: (
    type?: 'stock' | 'mutual_fund',
    holdingId?: string,
    action?: 'buy' | 'sell'
  ) => void;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  isProfileHubOpen: boolean;
  setIsProfileHubOpen: (open: boolean) => void;
  isAllTransactionsModalOpen: boolean;
  setIsAllTransactionsModalOpen: (open: boolean) => void;
  allTransactionsTypeFilter: 'all' | 'expense' | 'income';
  allTransactionsDateFilter: string;
  allTransactionsStartDate?: string;
  allTransactionsEndDate?: string;
  openAllTransactionsFiltered: (type?: 'all' | 'expense' | 'income', dateFilter?: string, startDate?: string, endDate?: string) => void;
  isAnalysisExportModalOpen: boolean;
  setIsAnalysisExportModalOpen: (open: boolean) => void;
  analysisExportInitialScope: 'all' | 'analytics' | 'investments';
  setAnalysisExportInitialScope: (scope: 'all' | 'analytics' | 'investments') => void;
  openAnalysisExportModal: (scope?: 'all' | 'analytics' | 'investments') => void;
  isHtmlReportViewerOpen: boolean;
  setIsHtmlReportViewerOpen: (open: boolean) => void;
  htmlReportPayload: HtmlReportPayload | null;
  setHtmlReportPayload: (payload: HtmlReportPayload | null) => void;
  openHtmlReportViewer: (payload: HtmlReportPayload) => void;
  closeHtmlReportViewer: () => void;
  userProfile: UserProfile;
  updateUserProfile: (profile: Partial<UserProfile>) => void;

  addLoan: (params: {
    name: string;
    totalAmount: number;
    interestRate: number;
    emiAmount: number;
    startDate: string;
    paymentDay: number;
    fundingAccountId: string;
    tenureMonths?: number;
    notes?: string;
  }) => void;
  updateLoan: (id: string, updates: Partial<Loan>) => void;
  deleteLoan: (id: string) => void;
  payLoanEmi: (params: {
    loanId: string;
    date: string;
    fundingAccountId?: string;
  }) => void;
  prepayLoan: (params: {
    loanId: string;
    amount: number;
    date: string;
    feeAmount?: number;
    fundingAccountId?: string;
  }) => void;

  // Passbook & Liquid Wealth Computations
  netLiquidWealth: number;
  getAccountPassbook: (accountId: string) => PassbookRow[];

  // Mutations
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  addAccount: (acc: Omit<Account, 'id' | 'balance' | 'createdAt'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  reorderAccounts: (orderedIds: string[]) => void;
  archiveAccount: (accountId: string) => void;
  unarchiveAccount: (accountId: string) => void;
  reconcileAccountBalance: (id: string, newBalance: number, note?: string) => void;
  adjustAccountBalance: (id: string, newBalance: number, note?: string) => void;
  updateAccountAdjustment: (id: string, updates: Partial<AccountAdjustment>) => void;
  deleteAccountAdjustment: (id: string) => void;
  getAccountAdjustments: (accountId: string) => AccountAdjustment[];
  payCreditCardBill: (params: {
    creditCardAccountId: string;
    payingAccountId: string;
    amount: number;
    date: string;
    note?: string;
  }) => void;

  addCategory: (cat: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (orderedIds: string[]) => void;

  addHolding: (
    holding: Omit<InvestmentHolding, 'id'>,
    transferOptions?: {
      isTransfer?: boolean;
      fromAccountId?: string;
      toAccountId?: string;
      transferDate?: string;
      notes?: string;
    }
  ) => void;
  updateHolding: (id: string, updates: Partial<InvestmentHolding>) => void;
  deleteHolding: (id: string) => void;
  addHoldingTransaction: (holdingId: string, tx: Omit<InvestmentTransaction, 'id' | 'holdingId'>) => void;
  addMultipleHoldingTransactions: (
    holdingId: string,
    txs: Array<Omit<InvestmentTransaction, 'id' | 'holdingId'>>,
    linkPassbook?: boolean,
    accountId?: string
  ) => void;
  updateHoldingTransaction: (holdingId: string, updatedTx: InvestmentTransaction) => void;
  deleteHoldingTransaction: (holdingId: string, txId: string) => void;
  recordInvestmentAction: (params: {
    holdingId: string;
    action:
      | 'buy'
      | 'sell'
      | 'dividend'
      | 'split'
      | 'bonus'
      | 'demerger'
      | 'interest'
      | 'coupon'
      | 'principal_repayment';
    quantity: number;
    price: number;
    accountId?: string;
    targetDematAccountId?: string;
    asTransfer?: boolean;
    date: string;
    note?: string;
    categorizeProfitAsIncome?: boolean;
    categorizeLossAsExpense?: boolean;
    profitCategoryId?: string;
    lossCategoryId?: string;
    splitRatio?: string;
    bonusRatio?: string;
    demergerRatio?: string;
    costAllocationPercentage?: number;
    demergedSymbol?: string;
    demergedName?: string;
    demergedInitialPrice?: number;
    demergedEntities?: DemergedStockAllocation[];
    demergerOutcome?: 'keep_original' | 'extinguish_original';
    oldQuantity?: number;
    newQuantity?: number;
    adjustCMP?: boolean;
    chargesAmount?: number;
    logChargesAsExpense?: boolean;
    chargesNote?: string;
  }) => void;

  // Investment CSV Import & Export
  importStocksWithTransfers: (
    csvContent: string,
    bankAccountId?: string,
    options?: { includeCharges?: boolean; fileName?: string; dematAccountId?: string }
  ) => { success: boolean; message: string; importedCount?: number; bulkActionId?: string };
  importMutualFundsWithTransfers: (
    csvContent: string,
    bankAccountId?: string,
    options?: { includeCharges?: boolean; fileName?: string; dematAccountId?: string }
  ) => { success: boolean; message: string; importedCount?: number; bulkActionId?: string };
  exportStocksCSVData: (options?: { includeCharges?: boolean }) => void;
  exportMutualFundsCSVData: (options?: { includeCharges?: boolean }) => void;

  addDebt: (debt: Omit<Debt, 'id' | 'createdAt'> & { fundingAccountId?: string; date?: string }) => void;
  updateDebt: (id: string, updates: Partial<Debt>) => void;
  deleteDebt: (id: string) => void;
  addDebtContact: (contact: { personName: string; phone?: string; dueDate?: string; notes?: string }) => string;
  recordDebtTransaction: (params: {
    debtId: string;
    type: 'paid' | 'received' | 'adjustment';
    amount: number;
    accountId?: string;
    date: string;
    time?: string;
    note?: string;
  }) => void;
  deleteDebtRecord: (txId: string) => void;

  // Groups & Split Expenses
  groups: ExpenseGroup[];
  groupExpenses: GroupExpense[];
  addGroup: (group: Omit<ExpenseGroup, 'id' | 'createdAt'>) => string;
  updateGroup: (id: string, updates: Partial<ExpenseGroup>) => void;
  deleteGroup: (id: string) => void;
  addGroupExpense: (expense: Omit<GroupExpense, 'id' | 'createdAt'>) => string;
  updateGroupExpense: (id: string, updates: Partial<GroupExpense>) => void;
  deleteGroupExpense: (id: string) => void;
  settleGroupDebt: (params: {
    groupId: string;
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    accountId?: string;
    date?: string;
    note?: string;
  }) => void;
  importGroupExpenseFromClaim: (payload: {
    groupName: string;
    title: string;
    totalAmount: number;
    paidByName: string;
    userMemberName: string;
    userShareAmount: number;
    date: string;
    time?: string;
    note?: string;
    splitType?: string;
    shares: { name: string; amount: number; memberId?: string }[];
    categoryId?: string;
    accountId?: string;
  }) => { success: boolean; groupId: string; expenseId: string };

  addRecurring: (rec: Omit<RecurringTransaction, 'id'>) => void;
  updateRecurring: (id: string, updates: Partial<RecurringTransaction>) => void;
  deleteRecurring: (id: string) => void;
  executeRecurringNow: (id: string) => void;
  upcoming24hRecurring: RecurringTransaction[];
  isRecurringAlreadyExecuted: (rec: RecurringTransaction, targetDate?: string) => boolean;

  // SIP Management with AMFI Integration
  sipSchedules: SipSchedule[];
  sipExecutions: SipExecutionRecord[];
  isSipManagerOpen: boolean;
  setIsSipManagerOpen: (open: boolean) => void;
  addSipSchedule: (sip: Omit<SipSchedule, 'id' | 'createdAt'>) => void;
  updateSipSchedule: (id: string, updates: Partial<SipSchedule>) => void;
  deleteSipSchedule: (id: string) => void;
  deleteSipExecution: (id: string) => void;
  clearSipExecutions: () => void;
  toggleSipStatus: (id: string) => void;
  runSipWorkerNow: (options?: { forceCheck?: boolean }) => Promise<{ success: boolean; message: string; count: number }>;
  // Automated Historical Price Resolution Engine
  priceMetaMap: Map<string, AssetPriceMeta>;
  isSyncingPrices: boolean;
  syncMarketPrices: (forceRefresh?: boolean, targetHoldingId?: string) => Promise<{ success: boolean; count: number; message: string }>;
  getHoldingMarketPrice: (holding: InvestmentHolding) => {
    price: number;
    previousPrice: number;
    date: string;
    previousDate?: string;
    isOffline: boolean;
    isUpdating: boolean;
    change1D: number;
    change1DPercent: number;
  };
  autoUpdateMutualFundsNav: (silent?: boolean, openModal?: boolean) => Promise<{ success: boolean; count: number; message: string; result?: MutualFundNavUpdateResult }>;
  updateSingleHoldingNav: (holdingId: string, schemeCodeOverride?: string) => Promise<{ success: boolean; message: string; nav?: number }>;
  linkHoldingAmfiScheme: (holdingId: string, schemeCode: string, schemeName: string, autoFetchNav?: boolean) => Promise<{ success: boolean; message: string; nav?: number }>;
  isUpdatingNavs: boolean;

  updateSettings: (updates: Partial<AppSettings>) => void;
  theme: AppTheme;
  resolvedTheme: 'dark' | 'light';
  isDark: boolean;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;

  // Feature Lock / Unlock System
  isFeatureUnlocked: (featureId: AppFeatureId) => boolean;
  toggleFeatureLock: (featureId: AppFeatureId) => void;
  setFeatureLock: (featureId: AppFeatureId, unlocked: boolean) => void;
  unlockAllFeatures: () => void;

  // Strict CSV & Encrypted Backup
  exportCSV: () => void;
  importCSVFile: (file: File) => Promise<boolean>;
  revertBulkAction: (bulkActionId: string) => { success: boolean; message: string };
  deleteBulkActionLog: (bulkActionId: string) => void;
  exportEncryptedBackup: (passphrase?: string) => Promise<boolean>;
  restoreEncryptedBackup: (
    fileOrContent: File | string,
    passphrase?: string
  ) => Promise<{ success: boolean; requiresPassword?: boolean; message?: string }>;
  isBackupModalOpen: boolean;
  setIsBackupModalOpen: (open: boolean) => void;

  // User Authentication & Cloud Sync
  googleUser: User | null;
  isGoogleDriveConnected: boolean;
  loginWithGoogle: () => Promise<User | null>;
  loginWithEmail: (email: string, pass: string) => Promise<User | null>;
  registerWithEmail: (email: string, pass: string, name?: string) => Promise<User | null>;
  logoutAccount: () => Promise<void>;
  connectGoogleDrive: () => Promise<void>;
  disconnectGoogleDrive: () => Promise<void>;
  backupToGoogleDrive: (passphrase?: string) => Promise<DriveBackupFile>;
  restoreFromGoogleDrive: (fileId: string, passphrase?: string) => Promise<boolean>;
  listGoogleDriveBackups: () => Promise<DriveBackupFile[]>;
  deleteGoogleDriveBackup: (fileId: string) => Promise<void>;

  recalculateAllBalances: () => void;
  resetAllData: () => void;
  resetToZeroData: () => void;

  // Startup App Lock (Biometric / PIN)
  isAppLocked: boolean;
  unlockApp: (enteredPin?: string) => boolean;
  lockApp: () => void;
  setAppLockConfig: (enabled: boolean, pin?: string, useBiometrics?: boolean) => void;

  // Toast System
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;

  // 30-Day Recycle Bin System
  bin: BinItem[];
  restoreFromBin: (binItemId: string) => void;
  deletePermanentlyFromBin: (binItemId: string) => void;
  emptyBin: () => void;
  restoreAllFromBin: (itemType?: BinItemType) => void;
  isBinOpen: boolean;
  setIsBinOpen: (open: boolean) => void;
  openBin: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Recompute holding quantity, cost basis, and current market price (CMP) from full transaction ledger.
 * Follows strict FIFO (First-In, First-Out) principle for share sales:
 * - Buys enqueue chronological lots of [quantity, price, date].
 * - Sells deplete the earliest open buy lots first.
 * - Remaining holding average buy price is strictly derived from the remaining un-sold lots.
 * - Stock splits adjust existing open lots proportionally.
 * - Bonus shares add zero-cost lots (or proportionately distribute cost).
 * - CMP is determined by the latest chronological transaction price.
 */
export const recomputeHoldingFromLedger = (
  holding: InvestmentHolding,
  ledger: InvestmentTransaction[]
): InvestmentHolding => {
  const safeLedger = ledger || [];

  // Sanitize any demerger transactions on parent holding:
  // Parent quantity delta must be 0 (spinoff shares belong strictly to demerged child holdings)
  const sanitizedLedger = safeLedger.map((t) => {
    if (t.type === 'demerger') {
      return {
        ...t,
        quantity: 0,
      };
    }
    return t;
  });

  // Always keep stored ledger in true chronological sequence by trade date
  const sortedLedger = [...sanitizedLedger].sort((a, b) => {
    const timeA = parseDate(a.date).getTime() || 0;
    const timeB = parseDate(b.date).getTime() || 0;
    return timeA - timeB;
  });

  // Specialized recalculation for Provident Fund (PF) holdings
  if (holding.assetType === 'pf') {
    let pfRunning = 0; // Opening balance is always 0
    let netContributions = 0;

    sortedLedger.forEach((t) => {
      const isWithdrawal = t.type === 'sell' || t.type === 'withdrawal';
      const isInterest = t.type === 'interest' || t.type === 'coupon';
      const amt = t.totalAmount || (t.price * t.quantity) || t.quantity || 0;

      if (isWithdrawal) {
        pfRunning = Math.max(0, pfRunning - amt);
        netContributions = Math.max(0, netContributions - amt);
      } else if (isInterest) {
        pfRunning += amt;
      } else {
        const emp = t.employeeAmount || 0;
        const empyr = t.employerAmount || 0;
        const vol = t.voluntaryAmount || 0;
        const contr = (emp || empyr || vol) ? (emp + empyr + vol) : amt;
        pfRunning += contr;
        netContributions += contr;
      }
    });

    const resolvedPfQty = Number(Math.max(0, pfRunning).toFixed(2));
    const resolvedNetContrib = Number(Math.max(0, netContributions).toFixed(2));
    const resolvedAvgBuyPrice = resolvedPfQty > 0 ? Number((resolvedNetContrib / resolvedPfQty).toFixed(6)) : 1;

    return {
      ...holding,
      quantity: resolvedPfQty,
      openingBalance: 0, // Opening balance is always 0
      averageBuyPrice: resolvedAvgBuyPrice,
      currentPrice: 1,
      transactions: sortedLedger,
    };
  }

  // Specialized recalculation for Bonds (Fixed Income) holdings
  if (holding.assetType === 'bond') {
    let unitsRemaining = 0;
    let totalInvestedCost = 0;

    sortedLedger.forEach((t) => {
      const amt = t.totalAmount || (t.price * t.quantity) || 0;
      if (t.type === 'buy') {
        unitsRemaining += t.quantity;
        totalInvestedCost += amt;
      } else if (t.type === 'sell') {
        const avgCost = unitsRemaining > 0 ? totalInvestedCost / unitsRemaining : 0;
        unitsRemaining = Math.max(0, unitsRemaining - t.quantity);
        totalInvestedCost = Math.max(0, totalInvestedCost - t.quantity * avgCost);
      } else if (t.type === 'principal_repayment') {
        if (t.quantity > 0 && t.quantity < unitsRemaining && (!t.totalAmount || t.totalAmount === t.quantity * t.price)) {
          unitsRemaining = Math.max(0, unitsRemaining - t.quantity);
        }
        // principal_repayment does not reduce purchase price per unit; capital return is handled centrally in computeBondMetrics
      }
    });

    const resolvedQty = Number(Math.max(0, unitsRemaining).toFixed(4));
    const resolvedAvgPrice = resolvedQty > 0 ? Number((totalInvestedCost / resolvedQty).toFixed(2)) : (holding.averageBuyPrice || 1000);

    return {
      ...holding,
      quantity: resolvedQty,
      averageBuyPrice: resolvedAvgPrice,
      currentPrice: resolvedAvgPrice,
      transactions: sortedLedger,
    };
  }

  if (sanitizedLedger.length === 0) {
    return {
      ...holding,
      quantity: 0,
      averageBuyPrice: 0,
      transactions: [],
    };
  }

  // Calculate FIFO strictly from the remaining ledger history without stale carryovers
  const fifoResult = computeHoldingFifo(sanitizedLedger, 0);
  const { currentPrice, lastPriceUpdate } = getLatestTransactionPrice(
    sanitizedLedger,
    holding.currentPrice,
    holding.lastPriceUpdate,
    holding.assetType
  );

  // Preserve automated current price from market DB if positive, otherwise fallback to latest transaction price
  const finalPrice = holding.currentPrice > 0 ? holding.currentPrice : currentPrice;
  const finalPriceDate = holding.currentPrice > 0 ? (holding.lastPriceUpdate || lastPriceUpdate) : lastPriceUpdate;

  const resolvedQty = fifoResult.remainingQuantity > 0.00001 ? Number(fifoResult.remainingQuantity.toFixed(4)) : 0;
  const resolvedAvgPrice = resolvedQty > 0 ? fifoResult.averageBuyPrice : 0;

  return {
    ...holding,
    quantity: resolvedQty,
    averageBuyPrice: resolvedAvgPrice,
    currentPrice: finalPrice,
    lastPriceUpdate: finalPriceDate,
    transactions: sortedLedger,
  };
};

// Helper: Check if a recurring item has already been executed for a specific date or cycle
export const isRecurringAlreadyExecuted = (
  rec: RecurringTransaction,
  targetDate: string,
  transactionsList: Transaction[]
): boolean => {
  if (!rec) return false;
  const todayStr = toInputDate(new Date());

  // 1. Direct check on schedule's lastExecutedDate
  if (rec.lastExecutedDate && (rec.lastExecutedDate === targetDate || rec.lastExecutedDate === todayStr)) {
    return true;
  }

  // 2. Scan transactions list for tagged recurringId or matching signature
  return (transactionsList || []).some((tx) => {
    // If tagged directly with recurringId
    if (tx.recurringId && tx.recurringId === rec.id) {
      if (tx.recurringExecutionDate === targetDate || tx.date === targetDate || tx.date === todayStr) {
        return true;
      }
    }
    // Strict fallback signature to prevent duplicate entries from multiple clicks or auto runs
    const matchesAccount = tx.fromAccountId === rec.fromAccountId;
    const matchesAmount = Math.abs(tx.amount - rec.amount) < 0.01;
    const matchesType = tx.type === rec.type;
    const matchesDate = tx.date === targetDate || tx.date === todayStr;
    const matchesName =
      Boolean(tx.note && tx.note.toLowerCase().includes(rec.name.toLowerCase())) ||
      Boolean(tx.tags && tx.tags.includes('Scheduled'));

    if (matchesAccount && matchesAmount && matchesType && matchesDate && matchesName) {
      return true;
    }
    return false;
  });
};

// Helper: Identify recurring transactions due within the next 24 hours
export const getUpcomingRecurring24h = (recurringList: RecurringTransaction[]): RecurringTransaction[] => {
  const now = new Date();
  const todayStr = toInputDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toInputDate(tomorrow);

  return (recurringList || []).filter((rec) => {
    if (!rec.isActive) return false;
    return rec.nextExecutionDate === todayStr || rec.nextExecutionDate === tomorrowStr;
  });
};

// Helper: 30-Day Auto Retention Period for Recycle Bin
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const pruneExpiredBinItems = (binItems: BinItem[]): BinItem[] => {
  const now = Date.now();
  return (binItems || []).filter((item) => {
    if (!item.deletedAt) return false;
    const deletedTime = new Date(item.deletedAt).getTime();
    if (isNaN(deletedTime)) return false;
    return now - deletedTime <= THIRTY_DAYS_MS;
  });
};

export function sanitizeLoadedAppData(parsed: any) {
  if (!parsed || !parsed.accounts || !parsed.transactions) {
    const seed = getCalculatedSeedData();
    return { ...seed, loans: [] };
  }

  // Ensure system debt account exists in accounts array
  let rawAccounts: Account[] = parsed.accounts || [];
  const hasDebtAccount = rawAccounts.some(
    (a: Account) => a.isSystemDebtAccount || a.id === SYSTEM_DEBT_ACCOUNT_ID || a.type === 'debt'
  );
  if (!hasDebtAccount) {
    rawAccounts = [...rawAccounts, DEFAULT_DEBT_ACCOUNT];
  }

  // Ensure at least one Demat account exists in accounts array for investment transfers
  const hasDematAccount = rawAccounts.some((a: Account) => a.type === 'demat');
  if (!hasDematAccount) {
    rawAccounts = [...rawAccounts, DEFAULT_DEMAT_ACCOUNT];
  }

  const isZeroState =
    (!parsed.transactions || parsed.transactions.length === 0) &&
    (!parsed.holdings || parsed.holdings.length === 0) &&
    (!parsed.debts || parsed.debts.length === 0);

  // Ensure sequential display order on all accounts and heal legacy 180000 bug
  rawAccounts = rawAccounts.map((a: Account, idx: number) => {
    let initialBal = a.initialBalance !== undefined ? a.initialBalance : a.balance;
    if (isZeroState) {
      initialBal = 0;
    } else if (a.id === 'acc_hdfc' && initialBal === 180000) {
      initialBal = 95000;
    }
    return {
      ...a,
      initialBalance: initialBal,
      balance: isZeroState ? 0 : a.balance,
      order: a.order !== undefined ? a.order : idx,
    };
  });

  // Reconcile and heal missing transactions for sample debts so contacts have full transaction records
  let finalTransactions: Transaction[] = Array.isArray(parsed.transactions) ? [...parsed.transactions] : [];
  const rawDebts: Debt[] = Array.isArray(parsed.debts) ? [...parsed.debts] : [];

  const hasDebtHarshit = rawDebts.some((d) => d.id === 'debt_harshit');
  if (hasDebtHarshit && !finalTransactions.some((tx) => tx.debtId === 'debt_harshit')) {
    const seedHarshitTx = INITIAL_TRANSACTIONS.find((tx) => tx.id === 'tx_seed_debt_harshit');
    if (seedHarshitTx) finalTransactions.push(seedHarshitTx);
  }

  const hasDebtPriya = rawDebts.some((d) => d.id === 'debt_priya');
  if (hasDebtPriya && !finalTransactions.some((tx) => tx.debtId === 'debt_priya')) {
    const seedPriyaTx = INITIAL_TRANSACTIONS.find((tx) => tx.id === 'tx_seed_debt_priya');
    if (seedPriyaTx) finalTransactions.push(seedPriyaTx);
  }

  const hasDebtRahul = rawDebts.some((d) => d.id === 'debt_rahul');
  if (hasDebtRahul) {
    if (!finalTransactions.some((tx) => tx.id === 'tx_seed_debt_rahul_lend')) {
      const lendTx = INITIAL_TRANSACTIONS.find((tx) => tx.id === 'tx_seed_debt_rahul_lend');
      if (lendTx) finalTransactions.unshift(lendTx);
    }
    const oldSeed9Idx = finalTransactions.findIndex((tx) => tx.id === 'tx_seed_9');
    const newSeed9 = INITIAL_TRANSACTIONS.find((tx) => tx.id === 'tx_seed_9');
    if (newSeed9) {
      if (oldSeed9Idx >= 0 && finalTransactions[oldSeed9Idx].type !== 'transfer') {
        finalTransactions[oldSeed9Idx] = newSeed9;
      } else if (oldSeed9Idx < 0 && !finalTransactions.some((tx) => tx.debtId === 'debt_rahul' && tx.tags?.includes('Received'))) {
        finalTransactions.push(newSeed9);
      }
    }
  }

  const hasDebtAutoLoan = rawDebts.some((d) => d.id === 'debt_auto_loan');
  if (hasDebtAutoLoan && !finalTransactions.some((tx) => tx.debtId === 'debt_auto_loan')) {
    const autoSeedTxs = INITIAL_TRANSACTIONS.filter(
      (tx) => tx.debtId === 'debt_auto_loan' || tx.id === 'tx_seed_auto_dealer_payment'
    );
    finalTransactions.push(...autoSeedTxs);
  }

  // Update debts principal and currentBalance from getDebtContactSummary
  let updatedDebts = rawDebts;
  if (updatedDebts.length > 0) {
    updatedDebts = updatedDebts.map((d: Debt) => {
      const summary = getDebtContactSummary(d, finalTransactions);
      return {
        ...d,
        currentBalance: Math.abs(summary.netBalance),
        type: summary.netBalance >= 0 ? 'lent' : 'borrowed',
        status: Math.abs(summary.netBalance) <= 0.001 ? 'settled' : 'active',
        principalAmount: Math.max(d.principalAmount || 0, Math.abs(summary.netBalance)),
      };
    });
  }

  // Dedicated Audit Ledger Migration (Isolate balance adjustments from transactions)
  let finalAdjustments: AccountAdjustment[] = Array.isArray(parsed.accountAdjustments)
    ? [...parsed.accountAdjustments]
    : [];
  const existingAdjIds = new Set(finalAdjustments.map((a) => a.id));

  const legacyAdjustmentTxs: Transaction[] = [];
  const cleanTransactions: Transaction[] = [];

  finalTransactions.forEach((tx) => {
    const isLegacyAdj =
      tx.isBalanceAdjustment === true ||
      tx.categoryName === 'Adjustment' ||
      (tx.tags && tx.tags.includes('BalanceAdjustment'));

    if (isLegacyAdj) {
      legacyAdjustmentTxs.push(tx);
    } else {
      cleanTransactions.push(tx);
    }
  });

  if (legacyAdjustmentTxs.length > 0) {
    const accountBalanceDiffMap = new Map<string, number>();

    legacyAdjustmentTxs.forEach((tx) => {
      const diff = tx.type === 'income' ? tx.amount : -tx.amount;
      const targetAccId = tx.fromAccountId;
      if (targetAccId) {
        accountBalanceDiffMap.set(
          targetAccId,
          (accountBalanceDiffMap.get(targetAccId) || 0) + diff
        );
      }

      const adjId = `adj_${tx.id}`;
      if (!existingAdjIds.has(adjId)) {
        let parsedNewBalance: number | null = null;
        const match = tx.note?.match(/Balance Adjustment to ₹\s*([0-9,.]+)/i);
        if (match) {
          const num = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(num)) parsedNewBalance = num;
        }

        const fallbackNewBalance = parsedNewBalance !== null ? parsedNewBalance : tx.amount;
        const oldBalance = fallbackNewBalance - diff;

        finalAdjustments.push({
          id: adjId,
          accountId: targetAccId || '',
          oldBalance,
          newBalance: fallbackNewBalance,
          difference: diff,
          timestamp: tx.createdAt || tx.date,
          note: tx.note ? tx.note.replace(/^Adjustment:\s*/i, '') : 'Balance adjustment',
        });
        existingAdjIds.add(adjId);
      }
    });

    // Update rawAccounts initialBalance with diff so recalculateBalances without legacy tx keeps exact balance
    rawAccounts = rawAccounts.map((acc) => {
      const diff = accountBalanceDiffMap.get(acc.id) || 0;
      if (diff !== 0) {
        return {
          ...acc,
          initialBalance: (acc.initialBalance || 0) + diff,
        };
      }
      return acc;
    });

    finalTransactions = cleanTransactions;
  }

  // Remove legacy system adjustment categories from categories list
  let finalCategories: Category[] = Array.isArray(parsed.categories) ? [...parsed.categories] : [];
  finalCategories = finalCategories.filter(
    (c) => c.name.toLowerCase() !== 'adjustment' && c.id !== 'cat_adjustment'
  );

  // Ensure essential investment categorization categories exist
  if (!finalCategories.some((c) => c.id === 'cat_capital_gains')) {
    finalCategories.push({
      id: 'cat_capital_gains',
      name: 'Capital Gains & Profit Booked',
      type: 'income',
      icon: 'TrendingUp',
      color: '#10b981',
      isDefault: true,
    });
  }
  if (!finalCategories.some((c) => c.id === 'cat_investment_loss')) {
    finalCategories.push({
      id: 'cat_investment_loss',
      name: 'Investment Losses',
      type: 'expense',
      icon: 'TrendingDown',
      color: '#ef4444',
      isDefault: true,
    });
  }
  if (!finalCategories.some((c) => c.id === 'cat_investment_taxes')) {
    finalCategories.push({
      id: 'cat_investment_taxes',
      name: 'Investment Charges & Taxes',
      type: 'expense',
      icon: 'Receipt',
      color: '#8b5cf6',
      isDefault: true,
    });
  }
  if (!finalCategories.some((c) => c.id === 'cat_bond_interest')) {
    finalCategories.push({
      id: 'cat_bond_interest',
      name: 'Bonds Interest',
      type: 'income',
      icon: 'Landmark',
      color: '#f59e0b',
      isDefault: true,
    });
  }

  // Migration: Convert any old PF subscription transactions logged as expenses into transfers
  const tempRecalcHoldings = (parsed.holdings || []).map((h: InvestmentHolding) =>
    h.transactions && h.transactions.length > 0 ? recomputeHoldingFromLedger(h, h.transactions) : h
  );
  const pfHoldingIds = new Set(tempRecalcHoldings.filter((h: InvestmentHolding) => h.assetType === 'pf').map((h: InvestmentHolding) => h.id));
  const dematAcc = rawAccounts.find((a: Account) => a.type === 'demat') || rawAccounts[0];

  finalTransactions = finalTransactions.map((tx: Transaction) => {
    if (tx.investmentId && pfHoldingIds.has(tx.investmentId) && tx.type === 'expense' && !tx.toAccountId) {
      return {
        ...tx,
        type: 'transfer' as const,
        toAccountId: dematAcc ? dematAcc.id : tx.fromAccountId,
        toAccountName: dematAcc ? dematAcc.name : 'Investment Account',
        categoryName: 'Transfer',
      };
    }
    return tx;
  });

  // Re-sync all account balances from transactions to ensure 100% consistency with passbook
  const recalculatedAccounts = recalculateBalances(rawAccounts, finalTransactions);

  // Re-sync holdings from transaction ledgers so CMP reflects the transaction with latest date
  const recalculatedHoldings = (parsed.holdings || []).map((h: InvestmentHolding) => {
    const recomputed = h.transactions && h.transactions.length > 0
      ? recomputeHoldingFromLedger(h, h.transactions)
      : h;

    // Hydrate missing previousClosePrice (e.g. from prior localStorage schema or legacy data)
    if (!recomputed.previousClosePrice || recomputed.previousClosePrice <= 0) {
      const seedMatch = INITIAL_HOLDINGS.find(
        (ih) => ih.id === recomputed.id || ih.symbol === recomputed.symbol
      );
      if (seedMatch?.previousClosePrice) {
        return {
          ...recomputed,
          previousClosePrice: seedMatch.previousClosePrice,
          previousCloseDate: seedMatch.previousCloseDate || '2026-10-15',
        };
      }
    }
    return recomputed;
  });

  let finalHoldings = recalculatedHoldings;

  finalHoldings = finalHoldings.map((h: InvestmentHolding) => {
    if (h.id === 'inv_sgb' || h.symbol === 'SGB2028IV') {
      return {
        ...h,
        couponRate: h.couponRate || 2.5,
        couponFrequency: h.couponFrequency || 'semi_annually',
        faceValue: h.faceValue || 5120,
        maturityDate: h.maturityDate || '2028-11-12',
      };
    }
    if (h.id === 'inv_quant' || h.symbol === 'QUANT_SC') {
      return {
        ...h,
        requiresConfirmation: false,
        confirmationReason: undefined,
        notes: h.notes && h.notes.includes('pending')
          ? 'High alpha small cap fund - Direct Plan Growth'
          : h.notes,
      };
    }
    return h;
  });

  const rawSips: SipSchedule[] =
    Array.isArray(parsed.sips) ? parsed.sips : [];
  const rawSipExecutions: SipExecutionRecord[] = parsed.sipExecutions || [];

  // Clean up any historical orphan executed logs whose transactions were deleted
  const sanitizedSipExecutions = pruneOrphanSipExecutions(rawSipExecutions, finalHoldings);
  const sanitizedSips = reconcileSipSchedules(rawSips, finalHoldings);

  const rawGroups: ExpenseGroup[] =
    Array.isArray(parsed.groups) ? parsed.groups : [];
  const rawGroupExpenses: GroupExpense[] =
    Array.isArray(parsed.groupExpenses) ? parsed.groupExpenses : [];

  // Validate & restore navigationTabs settings (heal if missing or affected by broken build)
  let rawSettings: AppSettings = parsed.settings || {};
  const validNavTabKeys: ActiveTab[] = ['home', 'accounts', 'investments', 'analytics', 'debts', 'split_expenses'];
  const currentNavTabs = rawSettings.navigationTabs;

  const isBrokenArray =
    Array.isArray(currentNavTabs) &&
    currentNavTabs.length === 4 &&
    currentNavTabs[0] === 'home' &&
    currentNavTabs[1] === 'accounts' &&
    currentNavTabs[2] === 'split_expenses' &&
    currentNavTabs[3] === 'analytics';

  if (
    !Array.isArray(currentNavTabs) ||
    currentNavTabs.length !== 4 ||
    isBrokenArray ||
    !currentNavTabs.every((tab) => validNavTabKeys.includes(tab))
  ) {
    rawSettings = {
      ...rawSettings,
      navigationTabs: ['home', 'accounts', 'investments', 'analytics'],
    };
  }

  return {
    ...parsed,
    settings: rawSettings,
    transactions: finalTransactions,
    accounts: recalculatedAccounts,
    holdings: finalHoldings,
    debts: updatedDebts,
    sips: sanitizedSips,
    sipExecutions: sanitizedSipExecutions,
    groups: rawGroups,
    groupExpenses: rawGroupExpenses,
    loans: Array.isArray(parsed.loans) ? parsed.loans : [],
    bin: Array.isArray(parsed.bin) ? pruneExpiredBinItems(parsed.bin) : [],
    categories: finalCategories,
    accountAdjustments: finalAdjustments,
    bulkActions: Array.isArray(parsed.bulkActions) ? parsed.bulkActions : [],
  };
}


export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronous initial state from localStorage or seed
  const [data, setData] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return sanitizeLoadedAppData(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to parse cached FinSync data', e);
    }
    const seed = getCalculatedSeedData();
    return { ...seed, loans: [] };
  });

  // Asynchronous hydration from high-capacity IndexedDB (handles 100MB+ / 500,000+ transactions seamlessly)
  useEffect(() => {
    loadPersistedState(STORAGE_KEY, null).then((persisted: any) => {
      if (persisted && persisted.accounts && persisted.transactions) {
        setData(sanitizeLoadedAppData(persisted));
      }
    }).catch((err) => {
      console.warn('IndexedDB initial load note:', err);
    }).finally(() => {
      capacitorLifecycle.hideSplashScreen();
    });

    // Android Lifecycle: flush state immediately when app is backgrounded or minimized
    capacitorLifecycle.setOnAppPause(() => {
      console.log('[Lifecycle]: App paused / backgrounded -> flushing storage immediately');
      storageWriter.flushImmediate();
    });
  }, []);

  const [activeTab, setActiveTabRaw] = useState<ActiveTab>('home');
  const [modalOpenedFromTools, setModalOpenedFromTools] = useState<string | null>(null);
  const [tabWhenToolOpened, setTabWhenToolOpened] = useState<ActiveTab | null>(null);
  const [isExtendedToolsOpen, setIsExtendedToolsOpen] = useState(false);

  const markModalOpenedFromTools = useCallback((modalId: string) => {
    setModalOpenedFromTools(modalId);
    setActiveTabRaw((currentTab) => {
      setTabWhenToolOpened(currentTab);
      return currentTab;
    });
  }, []);

  const clearModalOpenedFromTools = useCallback(() => {
    setModalOpenedFromTools(null);
    setTabWhenToolOpened(null);
  }, []);

  const setActiveTab = useCallback((tab: ActiveTab) => {
    // Capture current active tab scroll before switching tabs
    navigationManager.saveTabScroll(activeTab);
    navigationManager.startTransition(tab);
    // When switching active tab explicitly, clear any tool modal origin so it doesn't reopen extended tools
    setModalOpenedFromTools(null);
    setTabWhenToolOpened(null);
    setIsExtendedToolsOpen(false);
    setSelectedAccountId(null);
    setSelectedHoldingId(null);
    setDrilldownCategory(null);
    setSelectedDebtId(null);
    setSelectedGroupId(null);
    setActiveTabRaw(tab);
  }, [activeTab]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null);
  const [drilldownCategory, setDrilldownCategory] = useState<any | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Modals
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionModalInitialType, setTransactionModalInitialType] = useState<TransactionType>('expense');
  const openTransactionModal = (initialType?: TransactionType) => {
    if (initialType) {
      setTransactionModalInitialType(initialType);
    }
    setIsTransactionModalOpen(true);
    window.dispatchEvent(new CustomEvent('finsync:open-transaction-modal', { detail: { type: initialType } }));
  };
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isDebtsModalOpen, setIsDebtsModalOpen] = useState(false);
  const [initialDebtCategoryTab, setInitialDebtCategoryTab] = useState<'individual' | 'groups'>('individual');

  const openSplitExpenses = () => {
    setInitialDebtCategoryTab('groups');
    setActiveTab('split_expenses');
  };

  const openDebts = () => {
    setInitialDebtCategoryTab('individual');
    setActiveTab('debts');
  };
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isSipManagerOpen, setIsSipManagerOpen] = useState(false);
  const [isUpdatingNavs, setIsUpdatingNavs] = useState(false);
  const [priceMetaMap, setPriceMetaMap] = useState<Map<string, AssetPriceMeta>>(new Map());
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'help_guide' | 'profile' | 'customize' | 'security' | 'data' | 'maintenance' | 'all'>('all');
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isBinOpen, setIsBinOpen] = useState(false);

  const openBin = () => setIsBinOpen(true);

  // Automated 30-Day Recycle Bin Prune on mount
  useEffect(() => {
    if (data.bin && data.bin.length > 0) {
      const pruned = pruneExpiredBinItems(data.bin);
      if (pruned.length !== data.bin.length) {
        setData((prev: any) => ({ ...prev, bin: pruned }));
      }
    }
  }, []);

  // Initialize client-side Firebase Auth listener for Google Drive session
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user) => setGoogleUser(user),
      () => setGoogleUser(null)
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Automated Daily & Weekly Scheduled Encrypted Backups Engine
  useEffect(() => {
    if (data.settings.autoBackupSchedule && data.settings.autoBackupSchedule !== 'off') {
      checkAndExecuteAutoBackup(data, data.settings, (msg) => {
        showToast(msg, 'success');
        updateSettings({ lastAutoBackupTimestamp: Date.now() });
      });
    }
  }, [data.settings.autoBackupSchedule, data.settings.lastAutoBackupTimestamp]);

  // Automated Historical Price Resolution Engine: Initial Load & Active Holdings Sync
  useEffect(() => {
    let isMounted = true;

    const initAndSync = async () => {
      try {
        const metaMap = await getAllAssetMeta();
        if (isMounted && metaMap.size > 0) {
          setPriceMetaMap(metaMap);
          // Sync existing holdings with latest prices from IndexedDB
          setData((prev: any) => {
            const nextHoldings = (prev.holdings || []).map((h: InvestmentHolding) => {
              const ident = getAssetIdentification(h);
              if (ident && metaMap.has(ident.assetKey)) {
                const m = metaMap.get(ident.assetKey)!;
                if (m.latestPrice > 0) {
                  return {
                    ...h,
                    currentPrice: m.latestPrice,
                    lastPriceUpdate: m.latestDate,
                    previousClosePrice: m.previousClosePrice || h.previousClosePrice,
                    previousCloseDate: m.previousCloseDate || h.previousCloseDate,
                  };
                }
              }
              return h;
            });
            return { ...prev, holdings: nextHoldings };
          });
        }

        // Trigger smart holiday & offline aware background sync for active holdings (quantity > 0)
        setIsSyncingPrices(true);
        setIsUpdatingNavs(true);
        const updatedMeta = await syncActiveAssetsPrices(data.holdings || []);
        if (isMounted) {
          setPriceMetaMap(updatedMeta);
          setData((prev: any) => {
            const nextHoldings = (prev.holdings || []).map((h: InvestmentHolding) => {
              const ident = getAssetIdentification(h);
              if (ident && updatedMeta.has(ident.assetKey)) {
                const m = updatedMeta.get(ident.assetKey)!;
                if (m.latestPrice > 0) {
                  return {
                    ...h,
                    currentPrice: m.latestPrice,
                    lastPriceUpdate: m.latestDate,
                    previousClosePrice: m.previousClosePrice || h.previousClosePrice,
                    previousCloseDate: m.previousCloseDate || h.previousCloseDate,
                  };
                }
              }
              return h;
            });
            return { ...prev, holdings: nextHoldings };
          });
        }
      } catch (err) {
        console.warn('[PriceSync] Silent fallback to local cache:', err);
      } finally {
        if (isMounted) {
          setIsSyncingPrices(false);
          setIsUpdatingNavs(false);
        }
      }
    };

    initAndSync();

    return () => {
      isMounted = false;
    };
  }, []);

  const openSettingsTab = (tab: 'help_guide' | 'profile' | 'customize' | 'security' | 'data' | 'maintenance' | 'all') => {
    setSettingsInitialTab(tab);
    setIsSettingsModalOpen(true);
  };

  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isInvestmentCSVModalOpen, setIsInvestmentCSVModalOpen] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [tradeModalInitialType, setTradeModalInitialType] = useState<'stock' | 'mutual_fund'>('stock');
  const [tradeModalInitialHoldingId, setTradeModalInitialHoldingId] = useState<string | undefined>(undefined);
  const [tradeModalInitialAction, setTradeModalInitialAction] = useState<'buy' | 'sell' | undefined>(undefined);

  const openTradeModal = (
    type: 'stock' | 'mutual_fund' = 'stock',
    holdingId?: string,
    action?: 'buy' | 'sell'
  ) => {
    setTradeModalInitialType(type);
    setTradeModalInitialHoldingId(holdingId);
    setTradeModalInitialAction(action);
    setIsTradeModalOpen(true);
  };
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileHubOpen, setIsProfileHubOpen] = useState(false);
  const [isAllTransactionsModalOpen, setIsAllTransactionsModalOpen] = useState(false);
  const [allTransactionsTypeFilter, setAllTransactionsTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [allTransactionsDateFilter, setAllTransactionsDateFilter] = useState<string>('all');
  const [allTransactionsStartDate, setAllTransactionsStartDate] = useState<string>('');
  const [allTransactionsEndDate, setAllTransactionsEndDate] = useState<string>('');

  const openAllTransactionsFiltered = (
    type: 'all' | 'expense' | 'income' = 'all',
    dateFilter: string = 'all',
    startDate?: string,
    endDate?: string
  ) => {
    setAllTransactionsTypeFilter(type);
    setAllTransactionsDateFilter(dateFilter);
    setAllTransactionsStartDate(startDate || '');
    setAllTransactionsEndDate(endDate || '');
    setIsAllTransactionsModalOpen(true);
  };

  const [isAnalysisExportModalOpen, setIsAnalysisExportModalOpen] = useState(false);
  const [analysisExportInitialScope, setAnalysisExportInitialScope] = useState<'all' | 'analytics' | 'investments'>('all');

  const openAnalysisExportModal = (scope: 'all' | 'analytics' | 'investments' = 'all') => {
    setAnalysisExportInitialScope(scope);
    setIsAnalysisExportModalOpen(true);
  };

  const [isHtmlReportViewerOpen, setIsHtmlReportViewerOpen] = useState(false);
  const [htmlReportPayload, setHtmlReportPayload] = useState<HtmlReportPayload | null>(null);

  const openHtmlReportViewer = useCallback((payload: HtmlReportPayload) => {
    setHtmlReportPayload(payload);
    setIsHtmlReportViewerOpen(true);
  }, []);

  const closeHtmlReportViewer = useCallback(() => {
    setIsHtmlReportViewerOpen(false);
  }, []);

  const [isLoansModalOpen, setIsLoansModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isNetWorthModalOpen, setIsNetWorthModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  const openBudgetModal = () => setIsBudgetModalOpen(true);
  const openCalendarModal = () => setIsCalendarModalOpen(true);

  const handleModalToolClosed = useCallback((modalId: string) => {
    setModalOpenedFromTools((current) => {
      if (current === modalId) {
        setIsExtendedToolsOpen(true);
        return null;
      }
      return current;
    });
  }, []);

  // Automatically re-open Extended Tools when a tool modal that originated from Extended Tools closes,
  // BUT NOT if the user explicitly navigated to another tab (e.g. Accounts, Investments) or opened another modal.
  useEffect(() => {
    if (modalOpenedFromTools) {
      const isStillOpen =
        (modalOpenedFromTools === 'all_transactions' && isAllTransactionsModalOpen) ||
        (modalOpenedFromTools === 'net_worth' && isNetWorthModalOpen) ||
        (modalOpenedFromTools === 'bulk_actions' && isBulkActionsModalOpen) ||
        (modalOpenedFromTools === 'budget' && isBudgetModalOpen) ||
        (modalOpenedFromTools === 'spend_calendar' && isCalendarModalOpen) ||
        (modalOpenedFromTools === 'loans' && isLoansModalOpen) ||
        (modalOpenedFromTools === 'recurring' && isRecurringModalOpen) ||
        (modalOpenedFromTools === 'profile' && isProfileHubOpen) ||
        (modalOpenedFromTools === 'categories' && isCategoriesModalOpen) ||
        (modalOpenedFromTools === 'notifications' && isNotificationsModalOpen) ||
        (modalOpenedFromTools === 'bin' && isBinOpen) ||
        (modalOpenedFromTools === 'reports' && isAnalysisExportModalOpen) ||
        ((modalOpenedFromTools === 'settings' || modalOpenedFromTools === 'backup' || modalOpenedFromTools === 'help') && isSettingsModalOpen);

      if (!isStillOpen) {
        setModalOpenedFromTools(null);
        // Only re-open extended tools if:
        // 1. The active tab has not changed (user did not navigate to Accounts, Investments, Debts, etc.)
        // 2. No other destination modal was opened
        const tabChanged = tabWhenToolOpened !== null && activeTab !== tabWhenToolOpened;
        const isAnotherModalOpen =
          isLoansModalOpen ||
          isDebtsModalOpen ||
          isTransactionModalOpen ||
          isSearchModalOpen ||
          isProfileHubOpen ||
          isProfileModalOpen ||
          isRecurringModalOpen ||
          isCustomizeModalOpen ||
          isCategoriesModalOpen ||
          isInvestmentCSVModalOpen ||
          isSipManagerOpen ||
          isBackupModalOpen ||
          isBinOpen ||
          isAnalysisExportModalOpen ||
          isTradeModalOpen ||
          isNotificationsModalOpen ||
          isAllTransactionsModalOpen ||
          isNetWorthModalOpen ||
          isBulkActionsModalOpen ||
          isBudgetModalOpen ||
          isCalendarModalOpen;

        if (!tabChanged && !isAnotherModalOpen) {
          setIsExtendedToolsOpen(true);
        }
      }
    }
  }, [
    modalOpenedFromTools,
    tabWhenToolOpened,
    activeTab,
    isAllTransactionsModalOpen,
    isNetWorthModalOpen,
    isBulkActionsModalOpen,
    isLoansModalOpen,
    isRecurringModalOpen,
    isProfileHubOpen,
    isCategoriesModalOpen,
    isNotificationsModalOpen,
    isBinOpen,
    isAnalysisExportModalOpen,
    isSettingsModalOpen,
    isDebtsModalOpen,
    isTransactionModalOpen,
    isSearchModalOpen,
    isProfileModalOpen,
    isCustomizeModalOpen,
    isInvestmentCSVModalOpen,
    isSipManagerOpen,
    isBackupModalOpen,
    isTradeModalOpen,
  ]);

  // Background Reminder Evaluator & Native Android Alarms Synchronization (works screen-off / in other apps)
  useEffect(() => {
    // 1. In-memory evaluation
    evaluateOfflineReminders({
      transactions: data.transactions,
      holdings: data.holdings,
      recurring: data.recurring,
      sips: data.sips,
      debts: data.debts,
      categories: data.categories,
    });

    // 2. Synchronize native Android system alarms (scheduled via AlarmManager for background / screen-off execution)
    syncAllNativeScheduledReminders({
      recurring: data.recurring,
      sips: data.sips,
      loans: data.loans,
      debts: data.debts,
    }).catch((e) => console.warn('[FinSync] Native alarm sync note:', e));

    const notifTimer = setInterval(() => {
      evaluateOfflineReminders({
        transactions: data.transactions,
        holdings: data.holdings,
        recurring: data.recurring,
        sips: data.sips,
        debts: data.debts,
        categories: data.categories,
      });
    }, 60000);

    return () => clearInterval(notifTimer);
  }, [data.transactions, data.holdings, data.recurring, data.debts, data.sips, data.loans]);

  // User Profile
  const defaultUserProfile: UserProfile = {
    name: 'Alex Morgan',
    avatarUrl: '',
    email: '',
    tagline: 'Personal Account',
  };

  const userProfile: UserProfile = data.settings?.userProfile || defaultUserProfile;

  const updateUserProfile = (profileUpdates: Partial<UserProfile>) => {
    const nextProfile: UserProfile = {
      ...userProfile,
      ...profileUpdates,
    };
    setData((prev: any) => ({
      ...prev,
      settings: {
        ...(prev.settings || {}),
        userProfile: nextProfile,
      },
    }));
    showToast('Profile updated successfully', 'success');
  };

  // Toast System - Minimal and necessary toasts only; ignores trivial informative chatter
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Filter out routine, non-critical 'info' toasts to keep in-app toasts minimal & uncluttered
    if (type === 'info') return;

    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Persist asynchronously via high-capacity IndexedDB (with debouncing to ensure 60fps UI)
  useEffect(() => {
    storageWriter.scheduleSave(data);
  }, [data]);

  // Track system OS color-scheme preference for real-time reactivity
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const themePreference: AppTheme = data.settings?.theme || 'dark';
  const isDark: boolean =
    themePreference === 'system' ? systemPrefersDark : themePreference === 'dark';
  const resolvedTheme: 'dark' | 'light' = isDark ? 'dark' : 'light';

  // Synchronize .dark class on html element, native color-scheme, data-theme, and meta theme-color
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    root.setAttribute('data-theme', resolvedTheme);

    // Update browser chrome / Android navigation status bar color
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', isDark ? '#090d16' : '#f8fafc');
    }

    // Synchronize native Android Status Bar style & background color
    capacitorLifecycle.setStatusBarTheme(isDark);
  }, [isDark, resolvedTheme]);

  // Check and auto-execute due recurring transactions on initial mount with strict duplicate prevention
  useEffect(() => {
    if (!data.settings?.autoProcessRecurring) return;

    const todayStr = toInputDate(new Date());
    let executedCount = 0;
    const newTransactions: Transaction[] = [];
    const updatedRecurring = [...data.recurring];

    updatedRecurring.forEach((rec, idx) => {
      if (!rec.isActive || !rec.autoExecute) return;
      if (rec.nextExecutionDate <= todayStr) {
        // STRICT DUPLICATE CHECK: Strictly provide only one automatic entry per cycle
        const alreadyDone =
          isRecurringAlreadyExecuted(rec, rec.nextExecutionDate, data.transactions) ||
          isRecurringAlreadyExecuted(rec, todayStr, data.transactions);

        // Advance next execution date
        const nextDate = new Date(rec.nextExecutionDate);
        if (rec.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        else if (rec.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        else if (rec.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        else if (rec.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

        if (alreadyDone) {
          // Already recorded for this period, advance schedule without creating a duplicate transaction
          updatedRecurring[idx] = {
            ...rec,
            nextExecutionDate: toInputDate(nextDate),
          };
          return;
        }

        executedCount++;
        const newTx: Transaction = {
          id: `tx_rec_${Date.now()}_${idx}`,
          date: todayStr,
          amount: rec.amount,
          type: rec.type,
          categoryId: rec.categoryId || 'cat_misc',
          categoryName: rec.categoryName || 'Recurring',
          fromAccountId: rec.fromAccountId,
          fromAccountName: rec.fromAccountName,
          toAccountId: rec.toAccountId,
          toAccountName: rec.toAccountName,
          note: `[Auto-Recurring] ${rec.name}${rec.note ? ' - ' + rec.note : ''}`,
          tags: [...(rec.tags || []), 'Scheduled', 'AutoRecurring'],
          recurringId: rec.id,
          recurringExecutionDate: rec.nextExecutionDate,
          createdAt: new Date().toISOString(),
        };
        newTransactions.push(newTx);

        updatedRecurring[idx] = {
          ...rec,
          lastExecutedDate: todayStr,
          nextExecutionDate: toInputDate(nextDate),
        };
      }
    });

    if (executedCount > 0) {
      const combinedTxs = [...newTransactions, ...data.transactions];
      const recalculated = recalculateBalances(data.accounts, combinedTxs);
      setData((prev: any) => ({
        ...prev,
        accounts: recalculated,
        transactions: combinedTxs,
        recurring: updatedRecurring,
      }));
      showToast(`Processed ${executedCount} scheduled recurring transaction(s)`, 'success');
    }
  }, []);

  // Compute Net Liquid Wealth
  // Rule: (Total of Selected Bank Accounts + Cash Wallets) - (Outstanding of Selected Credit Cards)
  const netLiquidWealth = data.accounts
    .filter((acc: Account) => acc.includeInNetLiquid)
    .reduce((sum: number, acc: Account) => {
      if (acc.type === 'credit') {
        const outstanding = acc.balance < 0 ? -acc.balance : 0;
        return sum - outstanding;
      }
      return sum + acc.balance;
    }, 0);

  // Compute individual account passbook chronologically
  const getAccountPassbook = (accountId: string): PassbookRow[] => {
    const acc = data.accounts.find((a: Account) => a.id === accountId);
    if (!acc) return [];

    const relevant = data.transactions.filter(
      (tx: Transaction) => tx.fromAccountId === accountId || tx.toAccountId === accountId
    );

    // Sort chronologically (oldest first) taking date and timestamp into account to compute running balances correctly
    const sorted = [...relevant].sort((a, b) => {
      const timeA = getTransactionTimestamp(a);
      const timeB = getTransactionTimestamp(b);
      return timeA - timeB;
    });

    let running = acc.initialBalance || 0;
    const rows: PassbookRow[] = [];

    for (const tx of sorted) {
      let debit: number | null = null;
      let credit: number | null = null;
      const isAdjustment = Boolean(tx.isBalanceAdjustment);

      let description = tx.note || tx.categoryName || (tx.type === 'transfer' ? 'Transfer' : 'Transaction');

      if (isAdjustment) {
        description = tx.note || 'Balance Adjustment';
        if (tx.type === 'income') {
          credit = tx.amount;
          running += tx.amount;
        } else {
          debit = tx.amount;
          running -= tx.amount;
        }
      } else if (tx.type === 'income') {
        // Income is credited into the account (deposit / inflow)
        credit = tx.amount;
        running += tx.amount;
        description = tx.note || tx.categoryName || 'Income Credit';
      } else if (tx.type === 'expense') {
        // Expense is debited from the account (withdrawal / outflow)
        debit = tx.amount;
        running -= tx.amount;
        description = tx.note || tx.categoryName || 'Expense';
      } else if (tx.type === 'transfer') {
        if (tx.fromAccountId === accountId && tx.toAccountId === accountId) {
          // Self-transfer: internal transfer with no net balance impact
          description = tx.note || 'Internal Transfer';
        } else if (tx.fromAccountId === accountId) {
          // Outflow from this account to destination
          debit = tx.amount;
          running -= tx.amount;
          description = tx.note || `Transfer to ${tx.toAccountName || 'Account'}`;
        } else if (tx.toAccountId === accountId) {
          // Inflow into this account from source
          credit = tx.amount;
          running += tx.amount;
          description = tx.note || `Transfer from ${tx.fromAccountName || 'Account'}`;
        }
      }

      rows.push({
        transaction: tx,
        dateFormatted: formatDate(tx.date),
        description,
        debit,
        credit,
        balanceAfter: running,
        isAdjustment,
      });
    }

    // Return reversed so newest transaction is at top
    return rows.reverse();
  };

  // Add Transaction
  const addTransaction = (txData: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTx: Transaction = {
      ...txData,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    const nextTransactions = [newTx, ...data.transactions];
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

    setData((prev: any) => ({
      ...prev,
      transactions: nextTransactions,
      accounts: nextAccounts,
    }));

    if (newTx.type === 'expense') {
      checkAndDispatchBudgetAlerts(nextTransactions, data.categories).catch(() => {});
    }

    showToast('Transaction recorded successfully', 'success');
  };

  // Update Transaction
  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    const nextTransactions = data.transactions.map((tx: Transaction) =>
      tx.id === id ? { ...tx, ...updates } : tx
    );
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

    setData((prev: any) => ({
      ...prev,
      transactions: nextTransactions,
      accounts: nextAccounts,
    }));

    checkAndDispatchBudgetAlerts(nextTransactions, data.categories).catch(() => {});

    showToast('Transaction updated and balances recalculated', 'info');
  };

  // Delete Transaction with complete bidirectional link to holdings ledger and companion fees
  const deleteTransaction = (id: string) => {
    const targetTx = data.transactions.find((t: Transaction) => t.id === id);

    // Identify companion fee transactions (e.g. statutory taxes/charges logged with this trade, or companion EMI interest/charges)
    const companionIds = new Set<string>();
    data.transactions.forEach((tx: Transaction) => {
      if (tx.parentTransactionId === id || (targetTx?.parentTransactionId && tx.id === targetTx.parentTransactionId)) {
        companionIds.add(tx.id);
      }
      if (
        targetTx?.investmentId &&
        tx.investmentId === targetTx.investmentId &&
        tx.date === targetTx.date &&
        tx.categoryId === 'cat_investment_taxes' &&
        tx.id !== id
      ) {
        companionIds.add(tx.id);
      }
      if (
        targetTx?.loanId &&
        tx.loanId === targetTx.loanId &&
        tx.date === targetTx.date &&
        tx.id !== id &&
        ((targetTx.tags?.includes('emi') && tx.tags?.includes('emi')) ||
         (targetTx.tags?.includes('prepayment') && tx.tags?.includes('prepayment')))
      ) {
        companionIds.add(tx.id);
      }
    });

    const nextTransactions = data.transactions.filter(
      (tx: Transaction) => tx.id !== id && !companionIds.has(tx.id)
    );

    // Synchronize holding ledger: remove corresponding holding transaction across all holdings
    const removedHoldingTxs: InvestmentTransaction[] = [];
    let nextHoldings = data.holdings.map((h: InvestmentHolding) => {
      const hasMatch = (h.transactions || []).some(
        (t) =>
          t.linkedTransactionId === id ||
          t.linkedFeeTransactionId === id ||
          (targetTx?.investmentTransactionId && t.id === targetTx.investmentTransactionId)
      );

      if (!hasMatch && h.id !== targetTx?.investmentId) return h;

      const filteredLedger = (h.transactions || []).filter((t) => {
        if (t.linkedTransactionId === id) {
          removedHoldingTxs.push(t);
          return false;
        }
        if (targetTx?.investmentTransactionId && t.id === targetTx.investmentTransactionId) {
          removedHoldingTxs.push(t);
          return false;
        }
        if (t.linkedFeeTransactionId === id) {
          t.charges = undefined;
          return true;
        }
        return true;
      });

      return recomputeHoldingFromLedger(h, filteredLedger);
    });

    const nextAccounts = recalculateBalances(data.accounts, nextTransactions, nextHoldings);

    // Remove matching execution records from SIP execution logs
    const removedSipExecutions = (data.sipExecutions || []).filter((exec: SipExecutionRecord) => {
      if (targetTx && isSipExecutionMatchingTx(exec, undefined, targetTx, undefined)) return true;
      return removedHoldingTxs.some((ht) => {
        const holding = data.holdings.find((h: InvestmentHolding) => h.id === ht.holdingId);
        return isSipExecutionMatchingTx(exec, ht, undefined, holding);
      });
    });
    const removedSipExecIds = new Set(removedSipExecutions.map((e: SipExecutionRecord) => e.id));
    const nextSipExecutions = (data.sipExecutions || []).filter(
      (e: SipExecutionRecord) => !removedSipExecIds.has(e.id)
    );
    const nextSips = reconcileSipSchedules(data.sips || [], nextHoldings);

    // Synchronize debts: strictly recalculate debt balances from remaining transactions
    let nextDebts = data.debts;
    if (targetTx?.debtId) {
      const targetDebt = data.debts.find((d: Debt) => d.id === targetTx.debtId);
      if (targetDebt) {
        const summary = getDebtContactSummary(targetDebt, nextTransactions);
        const updatedDebt: Debt = {
          ...targetDebt,
          currentBalance: Math.abs(summary.netBalance),
          type: summary.netBalance >= 0 ? 'lent' : 'borrowed',
          status: Math.abs(summary.netBalance) <= 0.001 ? 'settled' : 'active',
        };
        nextDebts = data.debts.map((d: Debt) => (d.id === targetDebt.id ? updatedDebt : d));
      }
    }

    // Clean up any group expenses that referenced this transaction or its companions
    const allDeletedIds = new Set([id, ...companionIds]);
    const nextGroupExpenses = (data.groupExpenses || []).map((ge: GroupExpense) => {
      let changed = false;
      const nextGe = { ...ge };
      if (nextGe.linkedPersonalTxId && allDeletedIds.has(nextGe.linkedPersonalTxId)) {
        nextGe.linkedPersonalTxId = undefined;
        nextGe.includeMyShareInPersonal = false;
        changed = true;
      }
      if (nextGe.linkedDebtTxIds && nextGe.linkedDebtTxIds.some((tId) => allDeletedIds.has(tId))) {
        nextGe.linkedDebtTxIds = nextGe.linkedDebtTxIds.filter((tId) => !allDeletedIds.has(tId));
        changed = true;
      }
      return changed ? nextGe : ge;
    });

    // Record into Recycle Bin (30-day retention)
    let nextBin = pruneExpiredBinItems(data.bin || []);
    if (targetTx) {
      const companions = data.transactions.filter((tx: Transaction) => companionIds.has(tx.id));
      const binItem: BinItem = {
        id: `bin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        originalId: id,
        itemType: 'transaction',
        title: targetTx.note || targetTx.categoryName || `${targetTx.type === 'transfer' ? 'Transfer' : targetTx.type === 'income' ? 'Income' : 'Expense'} Transaction`,
        subtitle: `${targetTx.type.toUpperCase()} • ₹${targetTx.amount.toLocaleString('en-IN')} • ${targetTx.fromAccountName}${targetTx.toAccountName ? ` → ${targetTx.toAccountName}` : ''} • Date: ${targetTx.date}`,
        amount: targetTx.amount,
        deletedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        payload: {
          transaction: targetTx,
          companionTransactions: companions,
          linkedSipExecutions: removedSipExecutions,
        },
        metadata: {
          type: targetTx.type,
          fromAccountId: targetTx.fromAccountId,
          fromAccountName: targetTx.fromAccountName,
          toAccountId: targetTx.toAccountId,
          toAccountName: targetTx.toAccountName,
          date: targetTx.date,
          categoryName: targetTx.categoryName,
          debtId: targetTx.debtId,
          investmentId: targetTx.investmentId,
          investmentTransactionId: targetTx.investmentTransactionId,
          notes: targetTx.note,
        },
      };
      nextBin = [binItem, ...nextBin];
    }

    setData((prev: any) => ({
      ...prev,
      transactions: nextTransactions,
      accounts: nextAccounts,
      holdings: nextHoldings,
      debts: nextDebts,
      groupExpenses: nextGroupExpenses,
      sips: nextSips,
      sipExecutions: nextSipExecutions,
      bin: nextBin,
    }));

    showToast('Transaction moved to Bin (recoverable for 30 days)', 'info');
  };

  // ===================== LOAN & EMI MANAGEMENT MODULE =====================
  const addLoan = (params: {
    name: string;
    totalAmount: number;
    interestRate: number;
    emiAmount: number;
    startDate: string;
    paymentDay: number;
    fundingAccountId: string;
    tenureMonths?: number;
    notes?: string;
  }) => {
    const loanAccountId = `acc_loan_${Date.now()}`;
    const loanId = `loan_${Date.now()}`;

    // 1. Auto-create locked system account
    const loanAccount: Account = {
      id: loanAccountId,
      name: `${params.name}`,
      type: 'debt',
      initialBalance: -params.totalAmount, // Starts at negative balance equal to -Loan Amount
      balance: -params.totalAmount,
      icon: 'Calculator',
      color: '#6366f1',
      includeInNetLiquid: false,
      notes: `System-managed loan liability account for ${params.name}`,
      isLocked: true, // locked
      isSystemLoanAccount: true,
      loanId,
      createdAt: new Date().toISOString(),
      order: data.accounts.length,
    };

    // 2. Ensure "Interest Paid" expense category exists
    let existingCat = data.categories.find(
      (c: Category) => c.name.toLowerCase() === 'interest paid' && c.type === 'expense'
    );
    let updatedCategories = [...data.categories];
    if (!existingCat) {
      existingCat = {
        id: `cat_interest_paid_${Date.now()}`,
        name: 'Interest Paid',
        type: 'expense',
        icon: 'Percent',
        color: '#dc2626',
        isDefault: true,
      };
      updatedCategories.push(existingCat);
    }

    const fundingAccount =
      data.accounts.find((a: Account) => a.id === params.fundingAccountId) || data.accounts[0];

    const newLoan: Loan = {
      id: loanId,
      name: params.name,
      totalAmount: params.totalAmount,
      interestRate: params.interestRate,
      emiAmount: params.emiAmount,
      startDate: params.startDate,
      paymentDay: params.paymentDay,
      fundingAccountId: params.fundingAccountId,
      loanAccountId,
      tenureMonths: params.tenureMonths,
      notes: params.notes,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    // 3. Historical Auto-Catchup
    const catchup = generateHistoricalEmiCatchup({
      loan: newLoan,
      fundingAccount,
      loanAccount,
      interestCategory: existingCat,
    });

    const newTxs: Transaction[] = catchup.transactions.map((txData, index) => ({
      ...txData,
      id: `tx_loan_${Date.now()}_${index}`,
      loanId: newLoan.id,
      tags: txData.tags || [],
      createdAt: new Date().toISOString(),
    }));

    const combinedTxs = [...data.transactions, ...newTxs];
    const combinedAccounts = [...data.accounts, loanAccount];
    const recalculated = recalculateBalances(combinedAccounts, combinedTxs);

    setData((prev: any) => ({
      ...prev,
      loans: [...(prev.loans || []), newLoan],
      accounts: recalculated,
      categories: updatedCategories,
      transactions: combinedTxs,
    }));

    showToast(
      `Loan "${newLoan.name}" created with ${newTxs.length} historical catch-up records`,
      'success'
    );
  };

  const updateLoan = (id: string, updates: Partial<Loan>) => {
    setData((prev: any) => {
      const nextLoans = (prev.loans || []).map((l: Loan) =>
        l.id === id ? { ...l, ...updates } : l
      );
      return { ...prev, loans: nextLoans };
    });
    showToast('Loan parameters updated', 'success');
  };

  const deleteLoan = (id: string) => {
    const targetLoan = (data.loans || []).find((l: Loan) => l.id === id);
    if (!targetLoan) return;

    // Remove locked loan account
    const nextAccounts = data.accounts.filter((a: Account) => a.id !== targetLoan.loanAccountId);
    const nextLoans = (data.loans || []).filter((l: Loan) => l.id !== id);

    // Identify ALL transactions associated with this loan:
    // 1. Direct loanId match
    // 2. Either fromAccountId or toAccountId is the loan's system account
    // 3. Transactions with 'loan' tag and the loan's name / ID
    // 4. Notes matching this loan's EMI or prepayment payments
    const loanTxIdsToDelete = new Set<string>();
    const loanNameLower = targetLoan.name.trim().toLowerCase();

    data.transactions.forEach((tx: Transaction) => {
      const isDirectLoanId = tx.loanId === targetLoan.id;
      const isLoanAccount =
        tx.fromAccountId === targetLoan.loanAccountId || tx.toAccountId === targetLoan.loanAccountId;

      const noteLower = (tx.note || '').toLowerCase();
      const tags = (tx.tags || []).map((t) => t.toLowerCase());
      const isLoanTag = tags.includes('loan');
      const isNameMatch = noteLower.includes(loanNameLower) || tags.includes(loanNameLower);
      const isEmiOrPrepayNote =
        noteLower.includes('emi') ||
        noteLower.includes('prepayment') ||
        noteLower.includes('principal repayment') ||
        noteLower.includes('interest component');

      const isHeuristicLoanTx = isLoanTag && isNameMatch && isEmiOrPrepayNote;

      if (isDirectLoanId || isLoanAccount || isHeuristicLoanTx) {
        loanTxIdsToDelete.add(tx.id);
      }
    });

    // Cascade to companion transactions (e.g. fees or interest linked via parentTransactionId)
    data.transactions.forEach((tx: Transaction) => {
      if (tx.parentTransactionId && loanTxIdsToDelete.has(tx.parentTransactionId)) {
        loanTxIdsToDelete.add(tx.id);
      }
    });

    const deletedTxs = data.transactions.filter((tx: Transaction) => loanTxIdsToDelete.has(tx.id));
    const nextTxs = data.transactions.filter((tx: Transaction) => !loanTxIdsToDelete.has(tx.id));
    const recalculated = recalculateBalances(nextAccounts, nextTxs, data.holdings);

    // Save to Recycle Bin for 30-day recovery
    let nextBin = pruneExpiredBinItems(data.bin || []);
    const binItem: BinItem = {
      id: `bin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      originalId: id,
      itemType: 'loan',
      title: `Loan: ${targetLoan.name}`,
      subtitle: `Total Facility: ₹${targetLoan.totalAmount.toLocaleString('en-IN')} • ${deletedTxs.length} linked transactions`,
      amount: targetLoan.totalAmount,
      deletedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
      payload: {
        loan: targetLoan,
        loanAccount: data.accounts.find((a: Account) => a.id === targetLoan.loanAccountId),
        linkedTransactions: deletedTxs,
      },
      metadata: {
        loanName: targetLoan.name,
        totalAmount: targetLoan.totalAmount,
        interestRate: targetLoan.interestRate,
      },
    };
    nextBin = [binItem, ...nextBin];

    setData((prev: any) => ({
      ...prev,
      loans: nextLoans,
      accounts: recalculated,
      transactions: nextTxs,
      bin: nextBin,
    }));

    showToast(
      `Loan "${targetLoan.name}" and all ${deletedTxs.length} associated expenses & transactions deleted`,
      'info'
    );
  };

  const prepayLoan = (params: {
    loanId: string;
    amount: number;
    date: string;
    feeAmount?: number;
    fundingAccountId?: string;
  }) => {
    const loan = (data.loans || []).find((l: Loan) => l.id === params.loanId);
    if (!loan) return;

    const fundingAccId = params.fundingAccountId || loan.fundingAccountId;
    const fundingAcc = data.accounts.find((a: Account) => a.id === fundingAccId) || data.accounts[0];
    const loanAcc = data.accounts.find((a: Account) => a.id === loan.loanAccountId);
    if (!fundingAcc || !loanAcc) return;

    const newTransactions: Transaction[] = [];
    const prepayTxId = `tx_prepay_${Date.now()}_1`;
    const feeTxId = `tx_prepay_${Date.now()}_2`;

    // 1. Principal prepayment -> Transfer from funding bank to loan account
    newTransactions.push({
      id: prepayTxId,
      amount: params.amount,
      type: 'transfer',
      fromAccountId: fundingAcc.id,
      fromAccountName: fundingAcc.name,
      toAccountId: loanAcc.id,
      toAccountName: loanAcc.name,
      date: params.date,
      note: `${loan.name} - Lump-sum Principal Prepayment`,
      tags: ['loan', 'prepayment', 'principal', loan.name.toLowerCase()],
      loanId: loan.id,
      createdAt: new Date().toISOString(),
    });

    // 2. Excess fee/charges -> Expense under "Interest Paid"
    if (params.feeAmount && params.feeAmount > 0) {
      const interestCat =
        data.categories.find(
          (c: Category) => c.name.toLowerCase() === 'interest paid' && c.type === 'expense'
        ) || data.categories[0];

      newTransactions.push({
        id: feeTxId,
        amount: params.feeAmount,
        type: 'expense',
        fromAccountId: fundingAcc.id,
        fromAccountName: fundingAcc.name,
        categoryId: interestCat.id,
        categoryName: interestCat.name,
        date: params.date,
        note: `${loan.name} - Prepayment Processing Fee`,
        tags: ['loan', 'prepayment', 'fee', loan.name.toLowerCase()],
        loanId: loan.id,
        parentTransactionId: prepayTxId,
        createdAt: new Date().toISOString(),
      });
    }

    const combinedTxs = [...data.transactions, ...newTransactions];
    const recalculated = recalculateBalances(data.accounts, combinedTxs);

    setData((prev: any) => ({
      ...prev,
      accounts: recalculated,
      transactions: combinedTxs,
    }));

    showToast(`Prepayment of ₹${params.amount.toLocaleString('en-IN')} recorded`, 'success');
  };

  const payLoanEmi = (params: {
    loanId: string;
    date: string;
    fundingAccountId?: string;
  }) => {
    const loan = (data.loans || []).find((l: Loan) => l.id === params.loanId);
    if (!loan) return;

    const fundingAccId = params.fundingAccountId || loan.fundingAccountId;
    const fundingAcc = data.accounts.find((a: Account) => a.id === fundingAccId) || data.accounts[0];
    const loanAcc = data.accounts.find((a: Account) => a.id === loan.loanAccountId);
    if (!fundingAcc || !loanAcc) return;

    const remainingPrincipal = Math.abs(loanAcc.balance);
    const monthlyRate = (loan.interestRate || 0) / (12 * 100);
    const interestComponent = Math.round(remainingPrincipal * monthlyRate * 100) / 100;
    const principalComponent = Math.min(loan.emiAmount - interestComponent, remainingPrincipal);

    const newTransactions: Transaction[] = [];
    const prTxId = `tx_emi_pr_${Date.now()}`;
    const intTxId = `tx_emi_int_${Date.now()}`;

    if (principalComponent > 0) {
      newTransactions.push({
        id: prTxId,
        amount: principalComponent,
        type: 'transfer',
        fromAccountId: fundingAcc.id,
        fromAccountName: fundingAcc.name,
        toAccountId: loanAcc.id,
        toAccountName: loanAcc.name,
        date: params.date,
        note: `${loan.name} - Monthly EMI Principal Repayment`,
        tags: ['loan', 'emi', 'principal', loan.name.toLowerCase()],
        loanId: loan.id,
        parentTransactionId: intTxId,
        createdAt: new Date().toISOString(),
      });
    }

    if (interestComponent > 0) {
      const interestCat =
        data.categories.find(
          (c: Category) => c.name.toLowerCase() === 'interest paid' && c.type === 'expense'
        ) || data.categories[0];

      newTransactions.push({
        id: intTxId,
        amount: interestComponent,
        type: 'expense',
        fromAccountId: fundingAcc.id,
        fromAccountName: fundingAcc.name,
        categoryId: interestCat.id,
        categoryName: interestCat.name,
        date: params.date,
        note: `${loan.name} - Monthly EMI Interest Component (${loan.interestRate}% p.a.)`,
        tags: ['loan', 'emi', 'interest', loan.name.toLowerCase()],
        loanId: loan.id,
        parentTransactionId: prTxId,
        createdAt: new Date().toISOString(),
      });
    }

    const combinedTxs = [...data.transactions, ...newTransactions];
    const recalculated = recalculateBalances(data.accounts, combinedTxs);

    setData((prev: any) => ({
      ...prev,
      accounts: recalculated,
      transactions: combinedTxs,
    }));

    showToast(`EMI of ₹${loan.emiAmount.toLocaleString('en-IN')} paid for ${loan.name}`, 'success');
  };

  // Add Account
  const addAccount = (accData: Omit<Account, 'id' | 'balance' | 'createdAt'>) => {
    const newAcc: Account = {
      ...accData,
      id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      balance: accData.initialBalance,
      order: accData.order !== undefined ? accData.order : data.accounts.length,
      createdAt: new Date().toISOString(),
    };
    const nextAccounts = recalculateBalances([...data.accounts, newAcc], data.transactions);
    setData((prev: any) => ({ ...prev, accounts: nextAccounts }));
    showToast(`Account "${newAcc.name}" created`, 'success');
  };

  // Update Account
  const updateAccount = (id: string, updates: Partial<Account>) => {
    const nextAccounts = data.accounts.map((acc: Account) =>
      acc.id === id ? { ...acc, ...updates } : acc
    );
    const recalculated = recalculateBalances(nextAccounts, data.transactions);
    setData((prev: any) => ({ ...prev, accounts: recalculated }));
    showToast('Account details updated', 'info');
  };

  // Reorder accounts display sequence
  const reorderAccounts = (orderedIds: string[]) => {
    setData((prev: any) => {
      const accountMap = new Map<string, Account>(
        prev.accounts.map((a: Account) => [a.id, a] as [string, Account])
      );
      const reordered: Account[] = [];
      orderedIds.forEach((id, index) => {
        const acc = accountMap.get(id);
        if (acc) {
          reordered.push({ ...acc, order: index });
          accountMap.delete(id);
        }
      });
      // Append any remaining accounts
      let nextOrder = orderedIds.length;
      accountMap.forEach((acc) => {
        reordered.push({ ...acc, order: nextOrder++ });
      });
      return { ...prev, accounts: reordered };
    });
    showToast('Bank accounts sequence updated', 'success');
  };

  // Archive Account facility
  const archiveAccount = (accountId: string) => {
    const acc = data.accounts.find((a: Account) => a.id === accountId);
    if (acc?.isSystemDebtAccount) {
      showToast('The dedicated Debt Account cannot be archived.', 'error');
      return;
    }
    setData((prev: any) => ({
      ...prev,
      accounts: prev.accounts.map((a: Account) =>
        a.id === accountId ? { ...a, isArchived: true } : a
      ),
    }));
    showToast(`Account "${acc?.name || ''}" archived. Hidden from active view.`, 'info');
  };

  // Unarchive Account facility
  const unarchiveAccount = (accountId: string) => {
    const acc = data.accounts.find((a: Account) => a.id === accountId);
    setData((prev: any) => ({
      ...prev,
      accounts: prev.accounts.map((a: Account) =>
        a.id === accountId ? { ...a, isArchived: false } : a
      ),
    }));
    showToast(`Account "${acc?.name || ''}" restored to active accounts.`, 'success');
  };

  // Delete Account
  const deleteAccount = (id: string) => {
    const acc = data.accounts.find((a: Account) => a.id === id);
    if (acc?.isSystemDebtAccount) {
      showToast('The dedicated Debt Account cannot be deleted.', 'error');
      return;
    }
    const nextAccounts = data.accounts.filter((a: Account) => a.id !== id);
    const fallbackAccountId = nextAccounts[0]?.id || '';
    // Remap any holdings that had this demat account
    const nextHoldings = data.holdings.map((h: InvestmentHolding) =>
      h.dematAccountId === id ? { ...h, dematAccountId: fallbackAccountId } : h
    );
    // Remove transactions linked to this account
    const linkedTxs = data.transactions.filter(
      (tx: Transaction) => tx.fromAccountId === id || tx.toAccountId === id
    );
    const nextTransactions = data.transactions.filter(
      (tx: Transaction) => tx.fromAccountId !== id && tx.toAccountId !== id
    );
    const recalculated = recalculateBalances(nextAccounts, nextTransactions);

    let nextBin = pruneExpiredBinItems(data.bin || []);
    if (acc) {
      const binItem: BinItem = {
        id: `bin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        originalId: id,
        itemType: 'account',
        title: acc.name,
        subtitle: `${acc.type.toUpperCase()} • Balance: ₹${acc.balance.toLocaleString('en-IN')}${acc.accountNumber ? ` • Acc: ••••${acc.accountNumber}` : ''}`,
        amount: acc.balance,
        deletedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        payload: {
          account: acc,
          linkedTransactions: linkedTxs,
        },
        metadata: {
          accountName: acc.name,
          accountType: acc.type,
          accountNumber: acc.accountNumber,
          balance: acc.balance,
        },
      };
      nextBin = [binItem, ...nextBin];
    }

    setData((prev: any) => ({
      ...prev,
      accounts: recalculated,
      transactions: nextTransactions,
      holdings: nextHoldings,
      bin: nextBin,
    }));
    if (selectedAccountId === id) setSelectedAccountId(null);
    showToast(`Account "${acc?.name || ''}" moved to Bin (recoverable for 30 days)`, 'info');
  };

  // Dedicated Audit Ledger: Reconcile Account Balance
  const reconcileAccountBalance = (accountId: string, newBalance: number, note?: string) => {
    const targetAccount = data.accounts.find((a: Account) => a.id === accountId);
    if (!targetAccount) return;

    const diff = newBalance - targetAccount.balance;
    if (Math.abs(diff) < 0.000001) {
      showToast('Account balance is already equal to this value', 'info');
      return;
    }

    const adjustmentRecord: AccountAdjustment = {
      id: `adj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      accountId,
      oldBalance: targetAccount.balance,
      newBalance,
      difference: diff,
      timestamp: new Date().toISOString(),
      note: note?.trim() || undefined,
    };

    // Atomic update: calculate delta, insert record into account_adjustments, and update Account balance directly
    const nextAccounts = data.accounts.map((a: Account) => {
      if (a.id === accountId) {
        return {
          ...a,
          balance: newBalance,
          initialBalance: (a.initialBalance || 0) + diff,
        };
      }
      return a;
    });

    const nextAdjustments = [adjustmentRecord, ...(data.accountAdjustments || [])];

    setData((prev: any) => ({
      ...prev,
      accounts: nextAccounts,
      accountAdjustments: nextAdjustments,
    }));

    showToast(
      `Reconciled balance of "${targetAccount.name}" to ${formatINR(newBalance)} (Audit ledger logged)`,
      'success'
    );
  };

  // Backward-compatible alias
  const adjustAccountBalance = reconcileAccountBalance;

  const getAccountAdjustments = (accountId: string): AccountAdjustment[] => {
    return (data.accountAdjustments || []).filter((a: AccountAdjustment) => a.accountId === accountId);
  };

  // Update an individual Account Adjustment record (e.g. adjust reconciled value, note, timestamp)
  const updateAccountAdjustment = (id: string, updates: Partial<AccountAdjustment>) => {
    const targetAdj = (data.accountAdjustments || []).find((a: AccountAdjustment) => a.id === id);
    if (!targetAdj) return;

    let delta = 0;
    let updatedDiff = targetAdj.difference;

    if (updates.newBalance !== undefined && updates.newBalance !== targetAdj.newBalance) {
      updatedDiff = updates.newBalance - targetAdj.oldBalance;
      delta = updates.newBalance - targetAdj.newBalance;
    }

    const updatedAdj: AccountAdjustment = {
      ...targetAdj,
      ...updates,
      difference: updatedDiff,
    };

    const nextAdjustments = (data.accountAdjustments || []).map((a: AccountAdjustment) =>
      a.id === id ? updatedAdj : a
    );

    const nextAccounts = delta !== 0
      ? data.accounts.map((acc: Account) => {
          if (acc.id === targetAdj.accountId) {
            return {
              ...acc,
              balance: acc.balance + delta,
              initialBalance: (acc.initialBalance || 0) + delta,
            };
          }
          return acc;
        })
      : data.accounts;

    setData((prev: any) => ({
      ...prev,
      accounts: nextAccounts,
      accountAdjustments: nextAdjustments,
    }));

    showToast('Adjustment record updated', 'info');
  };

  // Delete an individual Account Adjustment record and restore account balance
  const deleteAccountAdjustment = (id: string) => {
    const targetAdj = (data.accountAdjustments || []).find((a: AccountAdjustment) => a.id === id);
    if (!targetAdj) return;

    const delta = targetAdj.difference;
    const nextAccounts = data.accounts.map((acc: Account) => {
      if (acc.id === targetAdj.accountId) {
        return {
          ...acc,
          balance: acc.balance - delta,
          initialBalance: (acc.initialBalance || 0) - delta,
        };
      }
      return acc;
    });

    const nextAdjustments = (data.accountAdjustments || []).filter((a: AccountAdjustment) => a.id !== id);

    setData((prev: any) => ({
      ...prev,
      accounts: nextAccounts,
      accountAdjustments: nextAdjustments,
    }));

    showToast('Adjustment removed and account balance restored', 'info');
  };

  // Pay Credit Card Bill with auto-logged transfer
  const payCreditCardBill = (params: {
    creditCardAccountId: string;
    payingAccountId: string;
    amount: number;
    date: string;
    note?: string;
  }) => {
    const cc = data.accounts.find((a: Account) => a.id === params.creditCardAccountId);
    const payingAcc = data.accounts.find((a: Account) => a.id === params.payingAccountId);
    if (!cc || !payingAcc) return;

    const newTx: Transaction = {
      id: `tx_cc_pay_${Date.now()}`,
      date: params.date,
      amount: params.amount,
      type: 'transfer',
      categoryId: undefined,
      categoryName: 'Bill Payment',
      fromAccountId: payingAcc.id,
      fromAccountName: payingAcc.name,
      toAccountId: cc.id,
      toAccountName: cc.name,
      note: params.note || `Credit Card Bill Payment (${cc.name})`,
      tags: ['CreditCardPayment', 'Bill'],
      createdAt: new Date().toISOString(),
    };

    const nextTransactions = [newTx, ...data.transactions];
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

    setData((prev: any) => ({
      ...prev,
      transactions: nextTransactions,
      accounts: nextAccounts,
    }));

    showToast(`Credit card bill payment of ₹${params.amount} recorded!`, 'success');
  };

  // Category mutations
  const addCategory = (catData: Omit<Category, 'id'>) => {
    const newCat: Category = {
      ...catData,
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setData((prev: any) => ({ ...prev, categories: [...prev.categories, newCat] }));
    showToast(`Category "${newCat.name}" added`, 'success');
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setData((prev: any) => ({
      ...prev,
      categories: prev.categories.map((c: Category) => (c.id === id ? { ...c, ...updates } : c)),
    }));
    showToast('Category updated', 'info');
  };

  const deleteCategory = (id: string) => {
    const cat = data.categories.find((c: Category) => c.id === id);
    let nextBin = pruneExpiredBinItems(data.bin || []);
    if (cat) {
      const binItem: BinItem = {
        id: `bin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        originalId: id,
        itemType: 'category',
        title: `Category: ${cat.name}`,
        subtitle: `${cat.type.toUpperCase()} Category`,
        deletedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        payload: { category: cat },
        metadata: { categoryName: cat.name, type: cat.type },
      };
      nextBin = [binItem, ...nextBin];
    }
    setData((prev: any) => ({
      ...prev,
      categories: prev.categories.filter((c: Category) => c.id !== id),
      bin: nextBin,
    }));
    showToast(`Category "${cat?.name || ''}" moved to Bin (recoverable for 30 days)`, 'info');
  };

  const reorderCategories = (orderedIds: string[]) => {
    setData((prev: any) => {
      const catMap = new Map<string, Category>(
        (prev.categories || []).map((c: Category) => [c.id, c] as [string, Category])
      );
      const reordered: Category[] = [];
      orderedIds.forEach((id, index) => {
        const cat = catMap.get(id);
        if (cat) {
          reordered.push({ ...cat, order: index });
          catMap.delete(id);
        }
      });
      // Append any remaining categories
      let nextOrder = orderedIds.length;
      catMap.forEach((cat) => {
        reordered.push({ ...cat, order: nextOrder++ });
      });
      return { ...prev, categories: reordered };
    });
    showToast('Categories sequence updated', 'success');
  };

  // Investment holding mutations
  const addHolding = (
    holdingData: Omit<InvestmentHolding, 'id'>,
    transferOptions?: {
      isTransfer?: boolean;
      fromAccountId?: string;
      toAccountId?: string;
      transferDate?: string;
      notes?: string;
    }
  ) => {
    const newHoldingId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const effectiveDate = transferOptions?.transferDate || holdingData.purchaseDate || toInputDate(new Date());
    const initialTxs: InvestmentTransaction[] =
      holdingData.transactions && holdingData.transactions.length > 0
        ? holdingData.transactions.map((t) => ({ ...t, holdingId: newHoldingId }))
        : holdingData.quantity > 0
        ? [
            {
              id: `inv_tx_${Date.now()}_init`,
              holdingId: newHoldingId,
              date: effectiveDate,
              type: 'buy',
              quantity: holdingData.quantity,
              price: holdingData.averageBuyPrice,
              totalAmount: Number((holdingData.quantity * holdingData.averageBuyPrice).toFixed(2)),
              accountingType: transferOptions?.isTransfer ? 'transfer' : 'corporate_action',
              notes: transferOptions?.notes || 'Initial asset acquisition',
            },
          ]
        : [];

    const newHolding: InvestmentHolding = {
      ...holdingData,
      id: newHoldingId,
      transactions: initialTxs,
    };
    const nextHoldings = [...data.holdings, newHolding];

    let nextTransactions = data.transactions;
    if (transferOptions?.isTransfer && transferOptions.fromAccountId && transferOptions.toAccountId) {
      const totalCost = Number((holdingData.quantity * holdingData.averageBuyPrice).toFixed(2));
      if (totalCost > 0) {
        const fromAcc = data.accounts.find((a: Account) => a.id === transferOptions.fromAccountId);
        const toAcc = data.accounts.find((a: Account) => a.id === transferOptions.toAccountId);
        const transferTx: Transaction = {
          id: `tx_transfer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          amount: totalCost,
          type: 'transfer',
          categoryId: 'cat_investments',
          categoryName: 'Investments',
          date: effectiveDate,
          fromAccountId: transferOptions.fromAccountId,
          fromAccountName: fromAcc?.name || 'Bank',
          toAccountId: transferOptions.toAccountId,
          toAccountName: toAcc?.name || 'Demat',
          note: transferOptions.notes || `Investment Transfer: ${holdingData.symbol} (${holdingData.quantity} units @ ₹${holdingData.averageBuyPrice})`,
          tags: ['Investment', 'Transfer', holdingData.symbol],
          isInvestmentTransfer: true,
          investmentId: newHoldingId,
          createdAt: new Date().toISOString(),
        };
        nextTransactions = [transferTx, ...data.transactions];
      }
    }

    const nextAccounts = recalculateBalances(data.accounts, nextTransactions, nextHoldings);
    setData((prev: any) => ({ ...prev, holdings: nextHoldings, transactions: nextTransactions, accounts: nextAccounts }));
    showToast(`Holding "${newHolding.symbol}" added`, 'success');

    // Trigger automated background price fetching for the newly added active asset
    syncActiveAssetsPrices(nextHoldings, { singleNewAsset: newHolding }).then((updatedMeta) => {
      setPriceMetaMap(updatedMeta);
      setData((prev: any) => {
        const next = (prev.holdings || []).map((h: InvestmentHolding) => {
          const ident = getAssetIdentification(h);
          if (ident && updatedMeta.has(ident.assetKey)) {
            const m = updatedMeta.get(ident.assetKey)!;
            if (m.latestPrice > 0) {
              return {
                ...h,
                currentPrice: m.latestPrice,
                lastPriceUpdate: m.latestDate,
                previousClosePrice: m.previousClosePrice || h.previousClosePrice,
                previousCloseDate: m.previousCloseDate || h.previousCloseDate,
              };
            }
          }
          return h;
        });
        const refreshedAccounts = recalculateBalances(prev.accounts, prev.transactions, next);
        return { ...prev, holdings: next, accounts: refreshedAccounts };
      });
    });
  };

  const updateHolding = (id: string, updates: Partial<InvestmentHolding>) => {
    setData((prev: any) => {
      const nextHoldings = prev.holdings.map((h: InvestmentHolding) =>
        h.id === id
          ? {
              ...h,
              ...updates,
              lastPriceUpdate:
                updates.lastPriceUpdate ||
                (updates.currentPrice !== undefined ? toInputDate(new Date()) : h.lastPriceUpdate),
            }
          : h
      );
      const nextAccounts = recalculateBalances(prev.accounts, prev.transactions, nextHoldings);
      return {
        ...prev,
        holdings: nextHoldings,
        accounts: nextAccounts,
      };
    });
    showToast('Holding updated', 'info');
  };

  const deleteHolding = (id: string) => {
    const target = data.holdings.find((h: InvestmentHolding) => h.id === id);
    const nextHoldings = data.holdings.filter((h: InvestmentHolding) => h.id !== id);

    // Collect ALL associated transaction IDs:
    // 1. Direct investmentId match
    // 2. Linked transaction and fee transaction IDs from holding's ledger
    // 3. Transactions pointing to any transaction in target.transactions via investmentTransactionId
    // 4. Companion statutory taxes/charges and dividend/coupon income
    const holdingTxIdsToDelete = new Set<string>();
    const symLower = target ? target.symbol.trim().toLowerCase() : '';
    const nameLower = target ? (target.name || '').trim().toLowerCase() : '';
    const removedHoldingTxs = target?.transactions || [];

    removedHoldingTxs.forEach((ht: InvestmentTransaction) => {
      if (ht.linkedTransactionId) holdingTxIdsToDelete.add(ht.linkedTransactionId);
      if (ht.linkedFeeTransactionId) holdingTxIdsToDelete.add(ht.linkedFeeTransactionId);
    });

    data.transactions.forEach((tx: Transaction) => {
      if (tx.investmentId === id) {
        holdingTxIdsToDelete.add(tx.id);
      }
      if (tx.investmentTransactionId && removedHoldingTxs.some((ht: InvestmentTransaction) => ht.id === tx.investmentTransactionId)) {
        holdingTxIdsToDelete.add(tx.id);
      }
      if (symLower) {
        const noteLower = (tx.note || '').toLowerCase();
        const tags = (tx.tags || []).map((t) => t.toLowerCase());
        const isSymMatch = tags.includes(symLower) || noteLower.includes(symLower);
        const isTradeOrIncome =
          tx.isInvestmentTransfer ||
          tx.isInvestmentProfit ||
          tx.isInvestmentLoss ||
          tx.categoryId === 'cat_investment_taxes' ||
          tags.includes('dividend') ||
          tags.includes('coupon') ||
          tags.includes('interest');
        if (isSymMatch && isTradeOrIncome) {
          holdingTxIdsToDelete.add(tx.id);
        }
      }
    });

    // Cascade to any companion transactions
    data.transactions.forEach((tx: Transaction) => {
      if (tx.parentTransactionId && holdingTxIdsToDelete.has(tx.parentTransactionId)) {
        holdingTxIdsToDelete.add(tx.id);
      }
    });

    const linkedTxs = data.transactions.filter((tx: Transaction) => holdingTxIdsToDelete.has(tx.id));
    const nextTransactions = data.transactions.filter((tx: Transaction) => !holdingTxIdsToDelete.has(tx.id));
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions, nextHoldings);

    // Remove any SIP executions matching this holding or its transactions
    const removedSipExecutions = (data.sipExecutions || []).filter((exec: SipExecutionRecord) => {
      if (exec.holdingId === id) return true;
      if (target && (exec.schemeCode === target.amfiSchemeCode || exec.schemeCode === target.symbol)) return true;
      return removedHoldingTxs.some((ht: InvestmentTransaction) => isSipExecutionMatchingTx(exec, ht, undefined, target));
    });
    const removedSipExecIds = new Set(removedSipExecutions.map((e: SipExecutionRecord) => e.id));
    const nextSipExecutions = (data.sipExecutions || []).filter(
      (e: SipExecutionRecord) => !removedSipExecIds.has(e.id)
    );
    const nextSips = reconcileSipSchedules(data.sips || [], nextHoldings);

    let nextBin = pruneExpiredBinItems(data.bin || []);
    if (target) {
      const worth = target.quantity * (target.currentPrice || target.averageBuyPrice);
      const binItem: BinItem = {
        id: `bin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        originalId: id,
        itemType: 'holding',
        title: `${target.symbol} - ${target.name}`,
        subtitle: `${target.assetType.toUpperCase()} • ${target.quantity} Units • Current Price: ₹${target.currentPrice || target.averageBuyPrice}`,
        amount: worth,
        deletedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        payload: {
          holding: target,
          linkedTransactions: linkedTxs,
          linkedSipExecutions: removedSipExecutions,
        },
        metadata: {
          symbol: target.symbol,
          holdingName: target.name,
          assetType: target.assetType,
          quantity: target.quantity,
          price: target.currentPrice,
        },
      };
      nextBin = [binItem, ...nextBin];
    }

    setData((prev: any) => ({
      ...prev,
      holdings: nextHoldings,
      transactions: nextTransactions,
      accounts: nextAccounts,
      sips: nextSips,
      sipExecutions: nextSipExecutions,
      bin: nextBin,
    }));
    showToast(`Holding "${target?.symbol || ''}" moved to Bin (recoverable for 30 days)`, 'info');

    // Prune unheld or deleted assets from local IndexedDB storage
    syncActiveAssetsPrices(nextHoldings).then((updatedMeta) => {
      setPriceMetaMap(updatedMeta);
    });
  };

  const addHoldingTransaction = (holdingId: string, tx: Omit<InvestmentTransaction, 'id' | 'holdingId'>) => {
    const target = data.holdings.find((h: InvestmentHolding) => h.id === holdingId);
    if (!target) return;

    const newTx: InvestmentTransaction = {
      ...tx,
      id: `inv_tx_${Date.now()}`,
      holdingId,
    };

    const nextLedger = [...(target.transactions || []), newTx];
    const updatedHolding = recomputeHoldingFromLedger(target, nextLedger);

    const nextHoldings = data.holdings.map((h: InvestmentHolding) =>
      h.id === holdingId ? updatedHolding : h
    );

    setData((prev: any) => ({ ...prev, holdings: nextHoldings }));
    showToast('Ledger entry added', 'success');
  };

  const addMultipleHoldingTransactions = (
    holdingId: string,
    txs: Array<Omit<InvestmentTransaction, 'id' | 'holdingId'>>,
    linkPassbook?: boolean,
    accountId?: string
  ) => {
    const target = data.holdings.find((h: InvestmentHolding) => h.id === holdingId);
    if (!target || txs.length === 0) return;

    const baseTime = Date.now();
    const bulkActionId = `bulk_pf_${baseTime}`;
    const newTxs: InvestmentTransaction[] = txs.map((tx, idx) => {
      const txId = `inv_tx_${baseTime}_${idx}_${Math.random().toString(36).substring(2, 5)}`;
      const linkedPassbookId = linkPassbook && accountId ? `tx_passbook_${baseTime}_${idx}` : undefined;
      return {
        ...tx,
        id: txId,
        holdingId,
        linkedTransactionId: linkedPassbookId,
        bulkActionId,
      };
    });

    const nextLedger = [...(target.transactions || []), ...newTxs];
    const updatedHolding = recomputeHoldingFromLedger(target, nextLedger);

    const nextHoldings = data.holdings.map((h: InvestmentHolding) =>
      h.id === holdingId ? updatedHolding : h
    );

    let nextTransactions = [...data.transactions];
    let nextAccounts = data.accounts;

    if (linkPassbook && accountId) {
      const account = data.accounts.find((a: Account) => a.id === accountId);
      const dematAccount = data.accounts.find((a: Account) => a.type === 'demat') || data.accounts[0];
      if (account) {
        newTxs.forEach((t) => {
          const isInterest = t.type === 'interest';
          const isPf = target.assetType === 'pf';
          // PF interest compounds internally into corpus without hitting bank passbook
          if (isPf && isInterest) return;

          const passbookTx: Transaction = {
            id: t.linkedTransactionId!,
            date: t.date,
            amount: t.totalAmount,
            type: isInterest ? 'income' : (isPf ? 'transfer' : 'expense'),
            fromAccountId: account.id,
            fromAccountName: account.name,
            toAccountId: isInterest ? undefined : (dematAccount ? dematAccount.id : account.id),
            toAccountName: isInterest ? undefined : (dematAccount ? dematAccount.name : account.name),
            categoryName: isInterest ? 'Interest Credit' : (isPf ? 'Transfer' : 'Investment'),
            note: t.notes || `${isInterest ? 'Interest Credited' : 'Monthly Contribution'} for ${target.name || target.symbol}`,
            tags: [isPf ? 'Provident Fund' : 'Bond', target.symbol],
            investmentId: holdingId,
            investmentTransactionId: t.id,
            bulkActionId,
            createdAt: new Date().toISOString(),
          };
          nextTransactions.push(passbookTx);
        });
        nextAccounts = recalculateBalances(nextAccounts, nextTransactions);
      }
    }

    const bulkRecord: BulkAction = {
      id: bulkActionId,
      actionType: 'TRANSACTION_CSV',
      fileName: `PF Bulk Subscriptions (${target.symbol || target.name})`,
      timestamp: Date.now(),
      totalRows: newTxs.length,
      status: 'COMPLETED',
      importedHoldingIds: [holdingId],
    };

    setData((prev: any) => ({
      ...prev,
      holdings: nextHoldings,
      transactions: nextTransactions,
      accounts: nextAccounts,
      bulkActions: [bulkRecord, ...(prev.bulkActions || [])],
    }));
    showToast(`Added ${newTxs.length} entries for ${target.symbol}`, 'success');
  };

  const deleteHoldingTransaction = (holdingId: string, txId: string) => {
    const targetHolding = data.holdings.find((h: InvestmentHolding) => h.id === holdingId);
    if (!targetHolding) return;

    const removedTx = targetHolding.transactions?.find((t: InvestmentTransaction) => t.id === txId);
    const nextLedger = targetHolding.transactions?.filter((t: InvestmentTransaction) => t.id !== txId) || [];
    const updatedHolding = recomputeHoldingFromLedger(targetHolding, nextLedger);

    const nextHoldings = data.holdings.map((h: InvestmentHolding) =>
      h.id === holdingId ? updatedHolding : h
    );

    // Identify all linked passbook expenses, transfers, and statutory tax/fee transactions to delete
    const txIdsToDelete = new Set<string>();

    if (removedTx?.linkedTransactionId) {
      txIdsToDelete.add(removedTx.linkedTransactionId);
    }
    if (removedTx?.linkedFeeTransactionId) {
      txIdsToDelete.add(removedTx.linkedFeeTransactionId);
    }

    // Direct pointer scan (strictly by ID to avoid deleting multiple transactions)
    data.transactions.forEach((tx: Transaction) => {
      if (tx.investmentTransactionId === txId) {
        txIdsToDelete.add(tx.id);
      }
      if (removedTx?.linkedTransactionId && tx.id === removedTx.linkedTransactionId) {
        txIdsToDelete.add(tx.id);
      }
      if (removedTx?.id && tx.investmentTransactionId === removedTx.id) {
        txIdsToDelete.add(tx.id);
      }
      // Also match companion charges/tax expense created alongside this trade
      if (
        removedTx &&
        tx.investmentId === holdingId &&
        tx.date === removedTx.date &&
        tx.categoryId === 'cat_investment_taxes' &&
        removedTx.charges &&
        Math.abs(tx.amount - removedTx.charges) < 0.05
      ) {
        txIdsToDelete.add(tx.id);
      }
    });

    const linkedPassbookTxs = data.transactions.filter((tx: Transaction) => txIdsToDelete.has(tx.id));
    const nextTransactions = data.transactions.filter(
      (tx: Transaction) => !txIdsToDelete.has(tx.id)
    );
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions, nextHoldings);

    // Clean up SIP execution logs matching this removed holding transaction
    const removedSipExecutions = (data.sipExecutions || []).filter((exec: SipExecutionRecord) =>
      isSipExecutionMatchingTx(exec, removedTx, undefined, targetHolding)
    );
    const removedSipExecIds = new Set(removedSipExecutions.map((e: SipExecutionRecord) => e.id));
    const nextSipExecutions = (data.sipExecutions || []).filter(
      (e: SipExecutionRecord) => !removedSipExecIds.has(e.id)
    );
    const nextSips = reconcileSipSchedules(data.sips || [], nextHoldings);

    let nextBin = pruneExpiredBinItems(data.bin || []);
    if (removedTx) {
      const tradeAmount = removedTx.totalAmount || (removedTx.quantity * removedTx.price) || 0;
      const binItem: BinItem = {
        id: `bin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        originalId: txId,
        itemType: 'trade_action',
        title: `${removedTx.type.toUpperCase()} ${removedTx.quantity} units of ${targetHolding.symbol}`,
        subtitle: `${targetHolding.name} • Price: ₹${removedTx.price} • Amount: ₹${tradeAmount.toLocaleString('en-IN')} • Date: ${removedTx.date}`,
        amount: tradeAmount,
        deletedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        payload: {
          holdingId,
          holdingSymbol: targetHolding.symbol,
          holdingName: targetHolding.name,
          tradeTransaction: removedTx,
          linkedPassbookTransactions: linkedPassbookTxs,
          linkedSipExecutions: removedSipExecutions,
        },
        metadata: {
          holdingSymbol: targetHolding.symbol,
          holdingName: targetHolding.name,
          holdingId,
          tradeType: removedTx.type,
          quantity: removedTx.quantity,
          price: removedTx.price,
          date: removedTx.date,
          notes: removedTx.notes,
        },
      };
      nextBin = [binItem, ...nextBin];
    }

    setData((prev: any) => ({
      ...prev,
      holdings: nextHoldings,
      transactions: nextTransactions,
      accounts: nextAccounts,
      sips: nextSips,
      sipExecutions: nextSipExecutions,
      bin: nextBin,
    }));
    storageWriter.flushImmediate({
      ...data,
      holdings: nextHoldings,
      transactions: nextTransactions,
      accounts: nextAccounts,
      sips: nextSips,
      sipExecutions: nextSipExecutions,
      bin: nextBin,
    });
    showToast(
      removedSipExecutions.length > 0
        ? `Trade action & corresponding SIP execution log removed for "${targetHolding.symbol}"`
        : `Trade action on "${targetHolding.symbol}" moved to Bin (recoverable for 30 days)`,
      'info'
    );
  };

  const updateHoldingTransaction = (holdingId: string, updatedTx: InvestmentTransaction) => {
    const targetHolding = data.holdings.find((h: InvestmentHolding) => h.id === holdingId);
    if (!targetHolding) return;

    const nextLedger = (targetHolding.transactions || []).map((t: InvestmentTransaction) =>
      t.id === updatedTx.id ? updatedTx : t
    );
    const updatedHolding = recomputeHoldingFromLedger(targetHolding, nextLedger);

    const nextHoldings = data.holdings.map((h: InvestmentHolding) =>
      h.id === holdingId ? updatedHolding : h
    );

    let nextTransactions = data.transactions;
    if (updatedTx.linkedTransactionId) {
      nextTransactions = data.transactions.map((tx: Transaction) => {
        if (tx.id === updatedTx.linkedTransactionId) {
          return {
            ...tx,
            date: updatedTx.date,
            amount: updatedTx.totalAmount,
            description: `${updatedTx.type.toUpperCase()}: ${targetHolding.name || targetHolding.symbol} (${updatedTx.quantity} units)`,
          };
        }
        return tx;
      });
    }
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

    setData((prev: any) => ({
      ...prev,
      holdings: nextHoldings,
      transactions: nextTransactions,
      accounts: nextAccounts,
    }));
    showToast('Ledger entry updated', 'success');
  };

  // Record investment purchase, sale, dividend, split, bonus shares, demerger spinoff, bond coupon interest, or principal repayment
  const recordInvestmentAction = (params: {
    holdingId: string;
    action:
      | 'buy'
      | 'sell'
      | 'dividend'
      | 'split'
      | 'bonus'
      | 'demerger'
      | 'interest'
      | 'coupon'
      | 'principal_repayment';
    quantity: number;
    price: number;
    accountId?: string;
    targetDematAccountId?: string;
    asTransfer?: boolean;
    date: string;
    note?: string;
    categorizeProfitAsIncome?: boolean;
    categorizeLossAsExpense?: boolean;
    profitCategoryId?: string;
    lossCategoryId?: string;
    splitRatio?: string;
    bonusRatio?: string;
    demergerRatio?: string;
    costAllocationPercentage?: number;
    demergedSymbol?: string;
    demergedName?: string;
    demergedInitialPrice?: number;
    demergedEntities?: DemergedStockAllocation[];
    demergerOutcome?: 'keep_original' | 'extinguish_original';
    oldQuantity?: number;
    newQuantity?: number;
    adjustCMP?: boolean;
    chargesAmount?: number;
    logChargesAsExpense?: boolean;
    chargesNote?: string;
  }) => {
    const holding = data.holdings.find((h: InvestmentHolding) => h.id === params.holdingId);
    if (!holding) return;

    const action = params.action;
    const isDemerger = action === 'demerger';
    const isCorporateAction = action === 'split' || action === 'bonus' || isDemerger;
    const isDividend = action === 'dividend';
    const isInterest = action === 'interest' || action === 'coupon';
    const isPrincipalRepayment = action === 'principal_repayment';
    const isBuy = action === 'buy';
    const isSell = action === 'sell';

    const account = params.accountId
      ? data.accounts.find((a: Account) => a.id === params.accountId)
      : data.accounts.find((a: Account) => a.id === holding.dematAccountId) || data.accounts[0];

    // For buy/sell/dividend/interest: totalAmount is cash amount.
    // For split, bonus, and demerger: totalAmount is 0 (cost-free corporate action).
    const totalAmount = isDividend || isInterest
      ? params.price
      : isPrincipalRepayment
      ? (params.quantity > 0 && params.price > 0 ? params.quantity * params.price : params.price)
      : isCorporateAction
      ? 0
      : params.quantity * params.price;

    const txId = `tx_inv_${Date.now()}`;
    const ledgerTxId = `inv_tx_${Date.now()}`;

    // For corporate actions (split/bonus/demerger), compute adjusted prices
    let corpActionPrice = params.price;
    let corpActionNewQty: number | undefined = undefined;

    if (isCorporateAction) {
      // Determine shares held in account as on the action date (supporting historical / retroactive actions)
      const sharesAsOfDate = params.oldQuantity !== undefined && params.oldQuantity > 0
        ? params.oldQuantity
        : (getHoldingSharesAsOfDate(holding, params.date) || holding.quantity);

      if (action === 'split') {
        const oldQty = sharesAsOfDate;
        const newQty = params.newQuantity && params.newQuantity > 0
          ? params.newQuantity
          : params.quantity > 0
          ? oldQty + params.quantity
          : oldQty;
        corpActionNewQty = newQty;
        if (params.price && params.price > 0) {
          corpActionPrice = params.price;
        } else if (params.adjustCMP !== false && oldQty > 0 && newQty > 0) {
          const splitRatio = newQty / oldQty;
          corpActionPrice = Number((holding.currentPrice / splitRatio).toFixed(2));
        } else {
          corpActionPrice = holding.currentPrice;
        }
      } else if (action === 'bonus') {
        const oldQty = sharesAsOfDate;
        const bonusShares = params.quantity;
        const newQty = oldQty + bonusShares;
        corpActionNewQty = newQty;
        if (params.price && params.price > 0) {
          corpActionPrice = params.price;
        } else if (params.adjustCMP !== false && newQty > 0) {
          corpActionPrice = Number(((holding.currentPrice * oldQty) / newQty).toFixed(2));
        } else {
          corpActionPrice = holding.currentPrice;
        }
      }
    }

    // Handle Demerger (supports single or MULTIPLE spinoff companies)
    if (isDemerger) {
      let rawEntities: DemergedStockAllocation[] = [];

      if (params.demergedEntities && params.demergedEntities.length > 0) {
        rawEntities = params.demergedEntities;
      } else {
        const ratioStr = params.demergerRatio || '1:1';
        let rA = 1;
        let rB = 1;
        if (ratioStr.includes(':')) {
          const parts = ratioStr.split(':').map(Number);
          if (parts[0] > 0 && parts[1] > 0) {
            rA = parts[0];
            rB = parts[1];
          }
        }
        rawEntities = [
          {
            symbol: (params.demergedSymbol || `${holding.symbol}-NEW`).toUpperCase().trim(),
            name: params.demergedName || `${holding.name} Demerged Spinoff`,
            ratioA: rA,
            ratioB: rB,
            costAllocationPercentage: params.costAllocationPercentage !== undefined ? params.costAllocationPercentage : 20,
            listingPrice: params.demergedInitialPrice || params.price,
          },
        ];
      }

      // Determine parent shares held and cost basis strictly as of the demerger date
      const { quantity: asOfDateShares, averageBuyPrice: asOfDateAvgPrice } = getHoldingStateAsOfDate(holding, params.date);
      const eligibleParentShares = params.oldQuantity !== undefined && params.oldQuantity > 0
        ? params.oldQuantity
        : (asOfDateShares > 0 ? asOfDateShares : holding.quantity);
      const eligibleParentAvgBuyPrice = asOfDateAvgPrice > 0 ? asOfDateAvgPrice : holding.averageBuyPrice;
      const parentTotalCost = eligibleParentShares * eligibleParentAvgBuyPrice;
      let totalCostAllocatedPct = 0;
      let nextHoldings = [...data.holdings];
      const processedEntities: DemergedStockAllocation[] = [];

      for (let i = 0; i < rawEntities.length; i++) {
        const item = rawEntities[i];
        if (!item.symbol || !item.symbol.trim()) continue;

        const costAllocPct = Math.min(100, Math.max(0, item.costAllocationPercentage || 0));
        totalCostAllocatedPct += costAllocPct;

        const rA = item.ratioA > 0 ? item.ratioA : 1;
        const rB = item.ratioB > 0 ? item.ratioB : 1;
        const rMultiplier = rA / rB;
        const demergedShares = Math.floor(eligibleParentShares * rMultiplier);
        const allocatedCostToDemerged = Number((parentTotalCost * (costAllocPct / 100)).toFixed(2));
        const demergedAvgBuyPrice = demergedShares > 0 ? Number((allocatedCostToDemerged / demergedShares).toFixed(2)) : 0;
        const demergedCMP = (item.listingPrice && item.listingPrice > 0)
          ? item.listingPrice
          : (demergedAvgBuyPrice > 0 ? demergedAvgBuyPrice : 100);

        const demergedSym = item.symbol.toUpperCase().trim();
        const demergedName = item.name?.trim() || `${holding.name} Spinoff`;
        let targetDemergedId = `inv_${demergedSym.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}_${i}`;

        const existingIdx = nextHoldings.findIndex((h) => h.symbol.toUpperCase() === demergedSym);

        const demergedInboundTx: InvestmentTransaction = {
          id: `inv_tx_demerger_in_${Date.now()}_${i}`,
          holdingId: targetDemergedId,
          date: params.date,
          type: 'buy',
          quantity: demergedShares,
          price: demergedAvgBuyPrice,
          totalAmount: allocatedCostToDemerged,
          accountingType: 'corporate_action',
          notes: `Allotted in ${holding.symbol} demerger (${rA}:${rB} ratio, ${costAllocPct}% cost allocation)`,
        };

        if (existingIdx >= 0) {
          targetDemergedId = nextHoldings[existingIdx].id;
          demergedInboundTx.holdingId = targetDemergedId;
          const existingH = nextHoldings[existingIdx];
          const updatedExisting = recomputeHoldingFromLedger(existingH, [
            ...(existingH.transactions || []),
            demergedInboundTx,
          ]);
          nextHoldings[existingIdx] = updatedExisting;
        } else {
          const newHolding: InvestmentHolding = {
            id: targetDemergedId,
            symbol: demergedSym,
            name: demergedName,
            assetType: 'stock',
            dematAccountId: holding.dematAccountId,
            quantity: demergedShares,
            averageBuyPrice: demergedAvgBuyPrice,
            currentPrice: demergedCMP,
            previousClosePrice: demergedCMP,
            lastPriceUpdate: params.date,
            notes: `Demerged from ${holding.name} (${holding.symbol}) on ${params.date}. Cost of acquisition: ${costAllocPct}% apportioned.`,
            transactions: [demergedInboundTx],
            isVerified: true,
          };
          nextHoldings.push(newHolding);
        }

        processedEntities.push({
          ...item,
          ratioA: rA,
          ratioB: rB,
          demergedHoldingId: targetDemergedId,
          allottedShares: demergedShares,
          allocatedCost: allocatedCostToDemerged,
          calculatedAvgPrice: demergedAvgBuyPrice,
        });
      }

      // Determine outcome: Does original parent company remain or was it extinguished / replaced by all new companies?
      const isExtinguishOriginal =
        params.demergerOutcome === 'extinguish_original' ||
        (params.demergerOutcome === undefined && totalCostAllocatedPct >= 99.99);

      const totalSharesAdded = processedEntities.reduce((sum, e) => sum + (e.allottedShares || 0), 0);

      if (isExtinguishOriginal) {
        // Complete demerger: All new companies created. Original company does NOT remain in active holdings.
        nextHoldings = nextHoldings.filter((h) => h.id !== holding.id);

        setData((prev: any) => ({
          ...prev,
          holdings: nextHoldings,
        }));

        showToast(
          `Demerger completed! ${processedEntities.length} new company stocks created (+${totalSharesAdded} shares). Original (${holding.symbol}) was extinguished and replaced.`,
          'success'
        );
        return;
      }

      // Spinoff / Carve-Out: Original company remains in portfolio with retained cost basis
      const retainedCostMultiplier = Math.max(0, (100 - totalCostAllocatedPct) / 100);
      const retainedParentCost = Number((parentTotalCost * retainedCostMultiplier).toFixed(2));
      const postDemergerParentAvgBuyPrice =
        eligibleParentShares > 0
          ? Number((retainedParentCost / eligibleParentShares).toFixed(2))
          : holding.averageBuyPrice;

      const primaryEntity = processedEntities[0];
      const summaryNotes =
        params.note ||
        (processedEntities.length === 1
          ? `Demerger: ${primaryEntity?.symbol} (${primaryEntity?.ratioA}:${primaryEntity?.ratioB}, ${primaryEntity?.costAllocationPercentage}% cost)`
          : `Demerger (${processedEntities.length} spinoffs): ${processedEntities
              .map((e) => `${e.symbol} (${e.costAllocationPercentage}%)`)
              .join(', ')}`);

      // Record Demerger in Parent Holding
      const parentDemergerLedgerTx: InvestmentTransaction = {
        id: ledgerTxId,
        holdingId: holding.id,
        date: params.date,
        type: 'demerger',
        quantity: 0, // Parent share quantity delta is 0 in a spinoff
        price: postDemergerParentAvgBuyPrice,
        totalAmount: 0,
        accountingType: 'corporate_action',
        notes: summaryNotes,
        demergerRatio: primaryEntity ? `${primaryEntity.ratioA}:${primaryEntity.ratioB}` : '1:1',
        demergerOutcome: 'keep_original',
        costAllocationPercentage: totalCostAllocatedPct,
        demergedHoldingId: primaryEntity?.demergedHoldingId,
        demergedSymbol: primaryEntity?.symbol,
        demergedName: primaryEntity?.name,
        demergedEntities: processedEntities,
        oldQuantity: eligibleParentShares,
        newQuantity: eligibleParentShares, // Parent quantity does not change
      };

      const updatedParent = recomputeHoldingFromLedger(holding, [
        ...(holding.transactions || []),
        parentDemergerLedgerTx,
      ]);
      nextHoldings = nextHoldings.map((h) => (h.id === holding.id ? updatedParent : h));

      setData((prev: any) => ({
        ...prev,
        holdings: nextHoldings,
      }));

      showToast(
        `Demerger completed! ${processedEntities.length} spinoff stock(s) added (+${totalSharesAdded} shares). ${holding.symbol} retained with adjusted avg cost ₹${postDemergerParentAvgBuyPrice}.`,
        'success'
      );
      return;
    }

    const feeTxId = `tx_fee_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const hasFee = Boolean(params.logChargesAsExpense && params.chargesAmount && params.chargesAmount > 0);

    const holdingLedgerEntry: InvestmentTransaction = {
      id: ledgerTxId,
      holdingId: holding.id,
      date: params.date,
      type: action,
      quantity: isDividend || isInterest ? 1 : isPrincipalRepayment ? (params.quantity > 0 ? params.quantity : 1) : params.quantity,
      price: isDividend || isInterest ? 0 : isCorporateAction ? corpActionPrice : params.price,
      totalAmount,
      linkedTransactionId: isCorporateAction ? undefined : txId,
      linkedFeeTransactionId: (!isCorporateAction && hasFee) ? feeTxId : undefined,
      accountingType: isDividend || isInterest ? 'income' : isPrincipalRepayment ? 'transfer' : isCorporateAction ? 'corporate_action' : params.asTransfer ? 'transfer' : isBuy ? 'expense' : 'income',
      notes: params.note,
      splitRatio: params.splitRatio,
      bonusRatio: params.bonusRatio,
      oldQuantity: isCorporateAction ? holding.quantity : undefined,
      newQuantity: isCorporateAction ? corpActionNewQty : undefined,
      charges: params.chargesAmount && params.chargesAmount > 0 ? Number(params.chargesAmount.toFixed(2)) : undefined,
    };

    // Recompute holding quantity, cost basis, and CMP derived strictly from transaction ledger
    const nextLedger = [...(holding.transactions || []), holdingLedgerEntry];
    const updatedHolding = recomputeHoldingFromLedger(holding, nextLedger);

    let nextTransactions = [...data.transactions];
    let nextAccounts = data.accounts;

    // Only create passbook / cash transactions if NOT a corporate action (split/bonus)
    if (!isCorporateAction && account) {
      // 1. Resolve Demat Account (Custom Demat or default Demat)
      const dematAccount =
        (params.targetDematAccountId ? data.accounts.find((a: Account) => a.id === params.targetDematAccountId) : null) ||
        (holding.dematAccountId ? data.accounts.find((a: Account) => a.id === holding.dematAccountId) : null) ||
        data.accounts.find((a: Account) => a.type === 'demat') ||
        DEFAULT_DEMAT_ACCOUNT;

      // Ensure holding is linked to the resolved Demat account
      if (dematAccount && updatedHolding.dematAccountId !== dematAccount.id) {
        updatedHolding.dematAccountId = dematAccount.id;
      }

      if (isBuy) {
        // Investment Purchase: Funds transfer from user's Bank account to custom Demat account
        const buyTransferTx: Transaction = {
          id: txId,
          date: params.date,
          amount: totalAmount,
          type: 'transfer',
          categoryId: 'cat_investment',
          categoryName: 'Investment Purchase',
          fromAccountId: account.id,
          fromAccountName: account.name,
          toAccountId: dematAccount.id,
          toAccountName: dematAccount.name,
          note: params.note || `Investment Purchase: Bought ${params.quantity} ${holding.symbol} @ ₹${params.price} (Transferred to ${dematAccount.name})`,
          tags: ['Investment', holding.assetType, holding.symbol, dematAccount.name],
          investmentId: holding.id,
          investmentTransactionId: ledgerTxId,
          isInvestmentTransfer: true,
          createdAt: new Date().toISOString(),
        };
        nextTransactions = [buyTransferTx, ...nextTransactions];
      } else if (isSell) {
        // Calculate Cost Basis and Realized Gain/Loss on position sale
        const costPerUnit = holding.averageBuyPrice > 0 ? holding.averageBuyPrice : params.price;
        const totalCostBasis = Number((params.quantity * costPerUnit).toFixed(2));
        const grossProceeds = Number((params.quantity * params.price).toFixed(2));
        const totalFee = params.chargesAmount || 0;
        const feeDeduction = params.logChargesAsExpense ? 0 : totalFee;
        const netProceeds = Math.max(0, Number((grossProceeds - feeDeduction).toFixed(2)));
        const realizedGainLoss = Number((netProceeds - totalCostBasis).toFixed(2));

        const isProfit = realizedGainLoss > 0;
        const isLoss = realizedGainLoss < 0;

        const shouldCategorizeProfit = isProfit && params.categorizeProfitAsIncome !== false;
        const shouldCategorizeLoss = isLoss && params.categorizeLossAsExpense !== false;

        if (shouldCategorizeProfit) {
          // Categorize Booked Profit as Income (e.g. Capital Gains & Profit Booked)
          const profitTx: Transaction = {
            id: `${txId}_profit`,
            date: params.date,
            amount: realizedGainLoss,
            type: 'income',
            categoryId: params.profitCategoryId || 'cat_capital_gains',
            categoryName: 'Capital Gains & Profit Booked',
            fromAccountId: account.id,
            fromAccountName: account.name,
            note: `Profit booked on selling ${params.quantity} of ${holding.symbol} @ ₹${params.price} (Cost Basis: ₹${totalCostBasis})${params.note ? ` (${params.note})` : ''}`,
            tags: ['Profit', 'CapitalGains', 'Investment', holding.symbol],
            investmentId: holding.id,
            investmentTransactionId: ledgerTxId,
            isInvestmentProfit: true,
            realizedGainLoss: realizedGainLoss,
            createdAt: new Date().toISOString(),
          };

          // Principal invested capital returned from Demat to Bank as Transfer
          const capitalReturnTx: Transaction = {
            id: txId,
            date: params.date,
            amount: totalCostBasis,
            type: 'transfer',
            fromAccountId: dematAccount.id,
            fromAccountName: dematAccount.name,
            toAccountId: account.id,
            toAccountName: account.name,
            note: `Invested capital returned on selling ${params.quantity} of ${holding.symbol} from ${dematAccount.name}`,
            tags: ['Investment', 'CapitalReturn', holding.symbol],
            investmentId: holding.id,
            investmentTransactionId: ledgerTxId,
            isInvestmentTransfer: true,
            createdAt: new Date().toISOString(),
          };

          nextTransactions = [profitTx, capitalReturnTx, ...nextTransactions];
        } else if (shouldCategorizeLoss) {
          // Categorize Booked Loss as Expense (e.g. Investment Losses)
          const lossAmt = Math.abs(realizedGainLoss);
          const lossTx: Transaction = {
            id: `${txId}_loss`,
            date: params.date,
            amount: lossAmt,
            type: 'expense',
            categoryId: params.lossCategoryId || 'cat_investment_loss',
            categoryName: 'Investment Losses',
            fromAccountId: account.id,
            fromAccountName: account.name,
            note: `Loss booked on selling ${params.quantity} of ${holding.symbol} @ ₹${params.price} (Cost Basis: ₹${totalCostBasis})${params.note ? ` (${params.note})` : ''}`,
            tags: ['Loss', 'InvestmentLoss', 'Investment', holding.symbol],
            investmentId: holding.id,
            investmentTransactionId: ledgerTxId,
            isInvestmentLoss: true,
            realizedGainLoss: realizedGainLoss,
            createdAt: new Date().toISOString(),
          };

          // Capital released from Demat to Bank (cost basis transfer)
          const capitalReturnTx: Transaction = {
            id: txId,
            date: params.date,
            amount: totalCostBasis,
            type: 'transfer',
            fromAccountId: dematAccount.id,
            fromAccountName: dematAccount.name,
            toAccountId: account.id,
            toAccountName: account.name,
            note: `Capital released on selling ${params.quantity} of ${holding.symbol} from ${dematAccount.name}`,
            tags: ['Investment', 'CapitalReturn', holding.symbol],
            investmentId: holding.id,
            investmentTransactionId: ledgerTxId,
            isInvestmentTransfer: true,
            createdAt: new Date().toISOString(),
          };

          nextTransactions = [lossTx, capitalReturnTx, ...nextTransactions];
        } else {
          // Standard full proceeds transfer from Demat to Bank
          const proceedsTx: Transaction = {
            id: txId,
            date: params.date,
            amount: netProceeds,
            type: 'transfer',
            fromAccountId: dematAccount.id,
            fromAccountName: dematAccount.name,
            toAccountId: account.id,
            toAccountName: account.name,
            note: `Sale proceeds for ${params.quantity} ${holding.symbol} credited to ${account.name}`,
            tags: ['Investment', 'Sale', holding.symbol],
            investmentId: holding.id,
            investmentTransactionId: ledgerTxId,
            isInvestmentTransfer: true,
            createdAt: new Date().toISOString(),
          };
          nextTransactions = [proceedsTx, ...nextTransactions];
        }
      } else if (isDividend || isInterest || isPrincipalRepayment) {
        // PF interest compounds internally into corpus and does not hit bank passbook as bank income
        if (!(holding.assetType === 'pf' && isInterest)) {
          if (isPrincipalRepayment) {
            // Principal Repayment is a transfer of capital from Demat back to user's bank account
            const principalTransferTx: Transaction = {
              id: txId,
              date: params.date,
              amount: totalAmount,
              type: 'transfer',
              fromAccountId: dematAccount.id,
              fromAccountName: dematAccount.name,
              toAccountId: account.id,
              toAccountName: account.name,
              note: `Principal Repayment received for ${params.quantity} units of ${holding.symbol}${params.note ? ` (${params.note})` : ''}`,
              tags: ['Investment', 'PrincipalBack', holding.symbol],
              investmentId: holding.id,
              investmentTransactionId: ledgerTxId,
              isInvestmentTransfer: true,
              createdAt: new Date().toISOString(),
            };
            nextTransactions = [principalTransferTx, ...nextTransactions];
          } else {
            // Bond Coupon Interest vs Stock Dividends
            const isBondInterest = (holding.assetType === 'bond' || holding.assetType === 'sgb') && isInterest;

            const incNote = isInterest
              ? `${holding.assetType === 'bond' ? 'Bond Coupon' : 'Coupon'} Interest received for ${holding.symbol}${params.note ? ` (${params.note})` : ''}`
              : `Dividend received for ${holding.symbol}${params.note ? ` (${params.note})` : ''}`;

            const incCategory = isBondInterest
              ? 'cat_bond_interest'
              : 'cat_dividend';

            const incCategoryName = isBondInterest
              ? 'Bonds Interest'
              : 'Dividends & Interest';

            const incomeTx: Transaction = {
              id: txId,
              date: params.date,
              amount: totalAmount,
              type: 'income',
              categoryId: incCategory,
              categoryName: incCategoryName,
              fromAccountId: account.id,
              fromAccountName: account.name,
              note: incNote,
              tags: ['Investment', holding.assetType, holding.symbol, isBondInterest ? 'BondsInterest' : 'Interest'],
              investmentId: holding.id,
              investmentTransactionId: ledgerTxId,
              createdAt: new Date().toISOString(),
            };
            nextTransactions = [incomeTx, ...nextTransactions];
          }
        }
      }

      // Automatic Dual-Write Expense Logging for Statutory Charges & Taxes with bidirectional pointers
      if (hasFee && params.chargesAmount) {
        const feeTx: Transaction = {
          id: feeTxId,
          date: params.date,
          amount: Number(params.chargesAmount.toFixed(2)),
          type: 'expense',
          categoryId: 'cat_investment_taxes',
          categoryName: 'Investment Charges & Taxes',
          fromAccountId: account.id,
          fromAccountName: account.name,
          note: params.chargesNote || `Investment Charges & Taxes: ${action.toUpperCase()} ${holding.symbol}`,
          tags: ['Charges', 'Taxes', 'Investment', holding.symbol],
          investmentId: holding.id,
          investmentTransactionId: ledgerTxId,
          parentTransactionId: txId,
          createdAt: new Date().toISOString(),
        };
        nextTransactions = [feeTx, ...nextTransactions];
      }

      const intermediateHoldings = data.holdings.map((h: InvestmentHolding) =>
        h.id === holding.id ? updatedHolding : h
      );
      nextAccounts = recalculateBalances(data.accounts, nextTransactions, intermediateHoldings);
    }

    const nextHoldings = data.holdings.map((h: InvestmentHolding) =>
      h.id === holding.id ? updatedHolding : h
    );

    setData((prev: any) => ({
      ...prev,
      holdings: nextHoldings,
      transactions: nextTransactions,
      accounts: nextAccounts,
    }));
    storageWriter.flushImmediate({
      ...data,
      holdings: nextHoldings,
      transactions: nextTransactions,
      accounts: nextAccounts,
    });

    if (action === 'split') {
      showToast(`Stock split applied for ${holding.symbol}: Shares updated from ${holding.quantity} to ${updatedHolding.quantity}`, 'success');
    } else if (action === 'bonus') {
      showToast(`Bonus shares credited for ${holding.symbol}: +${params.quantity} free shares (Total: ${updatedHolding.quantity})`, 'success');
    } else if (isDividend) {
      showToast(`Dividend of ₹${totalAmount} credited as income to ${account.name}`, 'success');
    } else if (isInterest) {
      showToast(`Coupon Interest of ₹${totalAmount} credited as income to ${account.name}`, 'success');
    } else if (isPrincipalRepayment) {
      showToast(`Principal Back of ₹${params.price} logged successfully`, 'success');
    } else {
      showToast(`${isBuy ? 'Purchased' : 'Sold'} ${params.quantity} units of ${holding.symbol} (CMP: ₹${updatedHolding.currentPrice})`, 'success');
    }
  };

  // Investment CSV Import & Export with Bank Account Transfer Integration
  const importStocksWithTransfers = (
    csvContent: string,
    bankAccountId?: string,
    options?: { includeCharges?: boolean; fileName?: string; dematAccountId?: string }
  ) => {
    const isNoneBank = !bankAccountId || bankAccountId === 'none';
    const bankAccount = isNoneBank ? undefined : data.accounts.find((a: Account) => a.id === bankAccountId);
    const dematAccount =
      (options?.dematAccountId ? data.accounts.find((a: Account) => a.id === options.dematAccountId) : undefined) ||
      data.accounts.find((a: Account) => a.type === 'demat') ||
      bankAccount ||
      data.accounts[0];

    const bulkActionId = `bulk_stock_${Date.now()}`;
    const result = importStocksCSV(
      csvContent,
      dematAccount ? dematAccount.id : 'acc_zerodha',
      data.holdings,
      bankAccount ? { id: bankAccount.id, name: bankAccount.name } : undefined,
      {
        includeCharges: options?.includeCharges !== false,
        linkToBankAccount: !isNoneBank,
        bulkActionId,
      }
    );

    if (!result.success) {
      showToast(result.errorMessage || 'Failed to parse Stocks CSV', 'error');
      return { success: false, message: result.errorMessage || 'Error' };
    }

    const nextTransactions = [...result.generatedTransactions, ...data.transactions];
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions, result.updatedHoldings);

    const bulkRecord: BulkAction = {
      id: bulkActionId,
      actionType: 'STOCK_CSV',
      fileName: options?.fileName || `Stocks_Import_${toInputDate(new Date())}.csv`,
      timestamp: Date.now(),
      totalRows: result.importedTransactionsCount,
      status: 'COMPLETED',
      importedTransactionIds: result.generatedTransactions.map((t) => t.id),
      importedHoldingIds: result.updatedHoldings.filter((h) => h.bulkActionId === bulkActionId).map((h) => h.id),
      affectedAccountIds: [bankAccount?.id, dematAccount?.id].filter(Boolean) as string[],
      createdAt: new Date().toISOString(),
    };

    setData((prev: any) => ({
      ...prev,
      holdings: result.updatedHoldings,
      transactions: nextTransactions,
      accounts: nextAccounts,
      bulkActions: [bulkRecord, ...(prev.bulkActions || [])],
    }));

    // Post-Import Trigger Hook:
    // Extract unique symbols from successfully imported dataset and trigger background historical price sync
    handlePostImportHistoricalSync(result.updatedHoldings).then(() => {
      getAllAssetMeta().then((metaMap) => {
        setPriceMetaMap(metaMap);
        setData((prev: any) => {
          const nextHoldings = (prev.holdings || []).map((h: InvestmentHolding) => {
            const ident = getAssetIdentification(h);
            if (ident && metaMap.has(ident.assetKey)) {
              const m = metaMap.get(ident.assetKey)!;
              if (m.latestPrice > 0) {
                return {
                  ...h,
                  currentPrice: m.latestPrice,
                  lastPriceUpdate: m.latestDate,
                  previousClosePrice: m.previousClosePrice || h.previousClosePrice,
                  previousCloseDate: m.previousCloseDate || h.previousCloseDate,
                };
              }
            }
            return h;
          });
          return { ...prev, holdings: nextHoldings };
        });
      });
    });

    showToast(result.summaryMessage || 'Stocks imported successfully', 'success');
    return {
      success: true,
      message: result.summaryMessage || 'Success',
      importedCount: result.importedTransactionsCount,
      bulkActionId,
    };
  };

  const importMutualFundsWithTransfers = (
    csvContent: string,
    bankAccountId?: string,
    options?: { includeCharges?: boolean; fileName?: string; dematAccountId?: string }
  ) => {
    const isNoneBank = !bankAccountId || bankAccountId === 'none';
    const bankAccount = isNoneBank ? undefined : data.accounts.find((a: Account) => a.id === bankAccountId);
    const dematAccount =
      (options?.dematAccountId ? data.accounts.find((a: Account) => a.id === options.dematAccountId) : undefined) ||
      data.accounts.find((a: Account) => a.type === 'demat') ||
      bankAccount ||
      data.accounts[0];

    const bulkActionId = `bulk_mf_${Date.now()}`;
    const result = importMutualFundsCSV(
      csvContent,
      dematAccount ? dematAccount.id : 'acc_zerodha',
      data.holdings,
      bankAccount ? { id: bankAccount.id, name: bankAccount.name } : undefined,
      {
        includeCharges: options?.includeCharges !== false,
        linkToBankAccount: !isNoneBank,
        bulkActionId,
      }
    );

    if (!result.success) {
      showToast(result.errorMessage || 'Failed to parse Mutual Funds CSV', 'error');
      return { success: false, message: result.errorMessage || 'Error' };
    }

    const nextTransactions = [...result.generatedTransactions, ...data.transactions];
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions, result.updatedHoldings);

    const bulkRecord: BulkAction = {
      id: bulkActionId,
      actionType: 'MUTUAL_FUND_CSV',
      fileName: options?.fileName || `Mutual_Funds_Import_${toInputDate(new Date())}.csv`,
      timestamp: Date.now(),
      totalRows: result.importedTransactionsCount,
      status: 'COMPLETED',
      importedTransactionIds: result.generatedTransactions.map((t) => t.id),
      importedHoldingIds: result.updatedHoldings.filter((h) => h.bulkActionId === bulkActionId).map((h) => h.id),
      affectedAccountIds: bankAccount ? [bankAccount.id] : [],
      createdAt: new Date().toISOString(),
    };

    setData((prev: any) => ({
      ...prev,
      holdings: result.updatedHoldings,
      transactions: nextTransactions,
      accounts: nextAccounts,
      bulkActions: [bulkRecord, ...(prev.bulkActions || [])],
    }));

    // Post-Import Trigger Hook:
    // Extract unique mutual fund scheme codes and trigger background historical NAV sync
    handlePostImportHistoricalSync(result.updatedHoldings).then(() => {
      getAllAssetMeta().then((metaMap) => {
        setPriceMetaMap(metaMap);
        setData((prev: any) => {
          const nextHoldings = (prev.holdings || []).map((h: InvestmentHolding) => {
            const ident = getAssetIdentification(h);
            if (ident && metaMap.has(ident.assetKey)) {
              const m = metaMap.get(ident.assetKey)!;
              if (m.latestPrice > 0) {
                return {
                  ...h,
                  currentPrice: m.latestPrice,
                  lastPriceUpdate: m.latestDate,
                  previousClosePrice: m.previousClosePrice || h.previousClosePrice,
                  previousCloseDate: m.previousCloseDate || h.previousCloseDate,
                };
              }
            }
            return h;
          });
          return { ...prev, holdings: nextHoldings };
        });
      });
    });

    showToast(result.summaryMessage || 'Mutual funds imported successfully', 'success');
    return {
      success: true,
      message: result.summaryMessage || 'Success',
      importedCount: result.importedTransactionsCount,
      bulkActionId,
    };
  };

  const exportStocksCSVData = (options?: { includeCharges?: boolean }) => {
    const content = exportStocksCSV(data.holdings, options);
    const dateStr = formatDate(new Date()).replace(/\//g, '-');
    const suffix = options?.includeCharges ? '_With_Charges' : '_Clean';
    downloadCSVFile(`Stocks_Portfolio_${dateStr}${suffix}.csv`, content);
    showToast(`Stocks CSV (${options?.includeCharges ? 'with charges' : 'without charges'}) exported successfully`, 'success');
  };

  const exportMutualFundsCSVData = (options?: { includeCharges?: boolean }) => {
    const content = exportMutualFundsCSV(data.holdings, options);
    const dateStr = formatDate(new Date()).replace(/\//g, '-');
    const suffix = options?.includeCharges ? '_With_Charges' : '_Clean';
    downloadCSVFile(`Mutual_Funds_Portfolio_${dateStr}${suffix}.csv`, content);
    showToast(`Mutual Funds CSV (${options?.includeCharges ? 'with charges' : 'without charges'}) exported successfully`, 'success');
  };

  // Debt Mutations with Dedicated Debt Account Passbook Transfer Integration
  const addDebt = (
    debtData: Omit<Debt, 'id' | 'createdAt'> & { fundingAccountId?: string; date?: string }
  ) => {
    const debtId = `debt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newDebt: Debt = {
      id: debtId,
      personName: debtData.personName,
      type: debtData.type,
      principalAmount: debtData.principalAmount,
      currentBalance: debtData.principalAmount,
      dueDate: debtData.dueDate,
      interestRate: debtData.interestRate,
      status: 'active',
      notes: debtData.notes,
      accountId: debtData.fundingAccountId || debtData.accountId,
      createdAt: new Date().toISOString(),
    };

    let debtAccount = data.accounts.find(
      (a: Account) => a.isSystemDebtAccount || a.id === SYSTEM_DEBT_ACCOUNT_ID || a.type === 'debt'
    );
    let currentAccounts = [...data.accounts];
    if (!debtAccount) {
      debtAccount = DEFAULT_DEBT_ACCOUNT;
      currentAccounts.push(debtAccount);
    }

    const fundingAccId = debtData.fundingAccountId || debtData.accountId;
    const fundingAccount = currentAccounts.find((a: Account) => a.id === fundingAccId);

    let nextTransactions = [...data.transactions];

    // If a user account was selected for lend or borrow, create the transfer transaction!
    if (fundingAccount) {
      const isLent = debtData.type === 'lent';
      const txId = `tx_debt_${Date.now()}`;
      const txDate = debtData.date || toInputDate(new Date());

      const transferTx: Transaction = {
        id: txId,
        date: txDate,
        amount: debtData.principalAmount,
        type: 'transfer',
        fromAccountId: isLent ? fundingAccount.id : debtAccount.id,
        fromAccountName: isLent ? fundingAccount.name : debtAccount.name,
        toAccountId: isLent ? debtAccount.id : fundingAccount.id,
        toAccountName: isLent ? debtAccount.name : fundingAccount.name,
        note: isLent
          ? `Lent to ${debtData.personName}${debtData.notes ? ` (${debtData.notes})` : ''}`
          : `Borrowed from ${debtData.personName}${debtData.notes ? ` (${debtData.notes})` : ''}`,
        tags: ['Debt', isLent ? 'Lent' : 'Borrowed', debtData.personName],
        debtId: debtId,
        createdAt: new Date().toISOString(),
      };

      newDebt.initialTransactionId = txId;
      nextTransactions = [transferTx, ...nextTransactions];
    }

    const nextAccounts = recalculateBalances(currentAccounts, nextTransactions);

    setData((prev: any) => ({
      ...prev,
      debts: [...prev.debts, newDebt],
      transactions: nextTransactions,
      accounts: nextAccounts,
    }));

    showToast(
      debtData.type === 'lent'
        ? `Recorded loan of ₹${debtData.principalAmount} lent to ${debtData.personName}`
        : `Recorded ₹${debtData.principalAmount} borrowed from ${debtData.personName}`,
      'success'
    );
  };

  const updateDebt = (id: string, updates: Partial<Debt>) => {
    setData((prev: any) => ({
      ...prev,
      debts: prev.debts.map((d: Debt) => (d.id === id ? { ...d, ...updates } : d)),
    }));
    showToast('Debt details updated', 'info');
  };

  const deleteDebt = (id: string) => {
    const targetDebt = data.debts.find((d: Debt) => d.id === id);
    const nextDebts = data.debts.filter((d: Debt) => d.id !== id);

    // Identify ALL transactions associated with this debt:
    // 1. Direct debtId match
    // 2. Initial transaction logged upon creation
    // 3. Companion transactions
    const debtTxIdsToDelete = new Set<string>();
    if (targetDebt?.initialTransactionId) {
      debtTxIdsToDelete.add(targetDebt.initialTransactionId);
    }
    data.transactions.forEach((tx: Transaction) => {
      if (tx.debtId === id) {
        debtTxIdsToDelete.add(tx.id);
      }
    });
    data.transactions.forEach((tx: Transaction) => {
      if (tx.parentTransactionId && debtTxIdsToDelete.has(tx.parentTransactionId)) {
        debtTxIdsToDelete.add(tx.id);
      }
    });

    const linkedTxs = data.transactions.filter((tx: Transaction) => debtTxIdsToDelete.has(tx.id));
    const nextTransactions = data.transactions.filter((tx: Transaction) => !debtTxIdsToDelete.has(tx.id));
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions, data.holdings);

    let nextBin = pruneExpiredBinItems(data.bin || []);
    if (targetDebt) {
      const binItem: BinItem = {
        id: `bin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        originalId: id,
        itemType: 'debt',
        title: `Debt: ${targetDebt.personName}`,
        subtitle: `${targetDebt.type === 'lent' ? 'Lent (Asset)' : 'Borrowed (Liability)'} • Balance: ₹${targetDebt.currentBalance.toLocaleString('en-IN')}`,
        amount: targetDebt.currentBalance,
        deletedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        payload: { debt: targetDebt, linkedTransactions: linkedTxs },
        metadata: { personName: targetDebt.personName, debtType: targetDebt.type },
      };
      nextBin = [binItem, ...nextBin];
    }

    setData((prev: any) => ({
      ...prev,
      debts: nextDebts,
      transactions: nextTransactions,
      accounts: nextAccounts,
      bin: nextBin,
    }));
    if (selectedDebtId === id) setSelectedDebtId(null);
    showToast(`Debt ledger for "${targetDebt?.personName || ''}" moved to Bin (recoverable for 30 days)`, 'info');
  };



  // Add Debt Contact (Screen 2: "Add debt")
  const addDebtContact = (contactData: { personName: string; phone?: string; dueDate?: string; notes?: string }): string => {
    const debtId = `debt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newDebt: Debt = {
      id: debtId,
      personName: contactData.personName.trim(),
      phone: contactData.phone?.trim() || undefined,
      type: 'lent',
      principalAmount: 0,
      currentBalance: 0,
      dueDate: contactData.dueDate || undefined,
      status: 'active',
      notes: contactData.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setData((prev: any) => ({
      ...prev,
      debts: [newDebt, ...prev.debts],
    }));

    showToast(`Contact "${newDebt.personName}" added`, 'success');
    return debtId;
  };

  // Record Debt Transaction (Screen 4: "Add record")
  // All debts to be recorded as a transfer from chosen account to dedicated Debt ledger account
  const recordDebtTransaction = (params: {
    debtId: string;
    type: 'paid' | 'received' | 'adjustment';
    amount: number;
    accountId?: string;
    date: string;
    time?: string;
    note?: string;
  }) => {
    const targetDebt = data.debts.find((d: Debt) => d.id === params.debtId);
    if (!targetDebt) return;

    let debtAccount = data.accounts.find(
      (a: Account) => a.isSystemDebtAccount || a.id === SYSTEM_DEBT_ACCOUNT_ID || a.type === 'debt'
    );
    let currentAccounts = [...data.accounts];
    if (!debtAccount) {
      debtAccount = DEFAULT_DEBT_ACCOUNT;
      currentAccounts.push(debtAccount);
    }

    const userAccount = params.accountId
      ? currentAccounts.find((a: Account) => a.id === params.accountId)
      : currentAccounts.find((a: Account) => !a.isArchived && !a.isSystemDebtAccount && a.type !== 'debt') || currentAccounts[0];

    const txId = `tx_debt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const isPaid = params.type === 'paid';
    const isAdjustment = params.type === 'adjustment';

    let transferTx: Transaction;

    if (isAdjustment) {
      transferTx = {
        id: txId,
        date: params.date,
        amount: params.amount,
        type: 'income',
        fromAccountId: debtAccount.id,
        fromAccountName: debtAccount.name,
        note: params.note ? `Adjustment: ${params.note}` : `Debt Adjustment for ${targetDebt.personName}`,
        tags: ['Debt', 'Adjustment', targetDebt.personName],
        debtId: targetDebt.id,
        isBalanceAdjustment: true,
        createdAt: new Date().toISOString(),
      };
    } else {
      // Paid: user gave money to contact. Outflow from userAccount to debtAccount.
      // Received: user collected money from contact. Inflow from debtAccount to userAccount.
      const fromAcc = isPaid ? userAccount! : debtAccount;
      const toAcc = isPaid ? debtAccount : userAccount!;
      const directionTag = isPaid ? 'Paid' : 'Received';
      const defaultNote = isPaid
        ? `Paid to ${targetDebt.personName}`
        : `Received from ${targetDebt.personName}`;

      transferTx = {
        id: txId,
        date: params.date,
        amount: params.amount,
        type: 'transfer',
        fromAccountId: fromAcc.id,
        fromAccountName: fromAcc.name,
        toAccountId: toAcc.id,
        toAccountName: toAcc.name,
        note: params.note?.trim() || defaultNote,
        tags: ['Debt', directionTag, targetDebt.personName],
        debtId: targetDebt.id,
        createdAt: new Date().toISOString(),
      };
    }

    const nextTransactions = [transferTx, ...data.transactions];
    const nextAccounts = recalculateBalances(currentAccounts, nextTransactions);

    // Compute updated net balance for this debt
    const summary = getDebtContactSummary(targetDebt, nextTransactions);
    const updatedDebt: Debt = {
      ...targetDebt,
      currentBalance: Math.abs(summary.netBalance),
      type: summary.netBalance >= 0 ? 'lent' : 'borrowed',
      status: Math.abs(summary.netBalance) <= 0.001 ? 'settled' : 'active',
      principalAmount: Math.max(targetDebt.principalAmount, Math.abs(summary.netBalance)),
    };

    const nextDebts = data.debts.map((d: Debt) => (d.id === targetDebt.id ? updatedDebt : d));

    setData((prev: any) => ({
      ...prev,
      debts: nextDebts,
      transactions: nextTransactions,
      accounts: nextAccounts,
    }));

    showToast(`Record of ₹${params.amount} saved for ${targetDebt.personName}`, 'success');
  };

  // Delete a specific debt transaction record
  const deleteDebtRecord = (txId: string) => {
    const txToDelete = data.transactions.find((t: Transaction) => t.id === txId);
    if (!txToDelete || !txToDelete.debtId) return;

    const nextTransactions = data.transactions.filter((t: Transaction) => t.id !== txId);
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

    const targetDebt = data.debts.find((d: Debt) => d.id === txToDelete.debtId);
    let nextDebts = data.debts;

    if (targetDebt) {
      const summary = getDebtContactSummary(targetDebt, nextTransactions);
      const updatedDebt: Debt = {
        ...targetDebt,
        currentBalance: Math.abs(summary.netBalance),
        type: summary.netBalance >= 0 ? 'lent' : 'borrowed',
        status: Math.abs(summary.netBalance) <= 0.001 ? 'settled' : 'active',
      };
      nextDebts = data.debts.map((d: Debt) => (d.id === targetDebt.id ? updatedDebt : d));
    }

    let nextBin = pruneExpiredBinItems(data.bin || []);
    const binItem: BinItem = {
      id: `bin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      originalId: txId,
      itemType: 'debt_record',
      title: `Debt Record for ${targetDebt?.personName || 'Contact'}`,
      subtitle: `₹${txToDelete.amount.toLocaleString('en-IN')} • ${txToDelete.note || 'Debt payment/record'} • Date: ${txToDelete.date}`,
      amount: txToDelete.amount,
      deletedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
      payload: { transaction: txToDelete, debtId: txToDelete.debtId },
      metadata: { debtPersonName: targetDebt?.personName, date: txToDelete.date, notes: txToDelete.note },
    };
    nextBin = [binItem, ...nextBin];

    setData((prev: any) => ({
      ...prev,
      debts: nextDebts,
      transactions: nextTransactions,
      accounts: nextAccounts,
      bin: nextBin,
    }));

    showToast('Debt record moved to Bin (recoverable for 30 days)', 'info');
  };

  // Group Expense Mutations
  const addGroup = (groupData: Omit<ExpenseGroup, 'id' | 'createdAt'>): string => {
    const groupId = `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newGroup: ExpenseGroup = {
      ...groupData,
      id: groupId,
      createdAt: new Date().toISOString(),
    };
    setData((prev: any) => ({
      ...prev,
      groups: [newGroup, ...(prev.groups || [])],
    }));
    showToast(`Group "${newGroup.name}" created`, 'success');
    return groupId;
  };

  const updateGroup = (id: string, updates: Partial<ExpenseGroup>) => {
    setData((prev: any) => ({
      ...prev,
      groups: (prev.groups || []).map((g: ExpenseGroup) => (g.id === id ? { ...g, ...updates } : g)),
    }));
    showToast('Group updated', 'info');
  };

  const deleteGroup = (id: string) => {
    const targetGroup = (data.groups || []).find((g: ExpenseGroup) => g.id === id);
    const expensesToDelete = (data.groupExpenses || []).filter((e: GroupExpense) => e.groupId === id);
    const linkedTxIds = new Set<string>();
    expensesToDelete.forEach((e: GroupExpense) => {
      if (e.linkedPersonalTxId) linkedTxIds.add(e.linkedPersonalTxId);
      if (e.linkedDebtTxIds) e.linkedDebtTxIds.forEach((tId) => linkedTxIds.add(tId));
    });

    data.transactions.forEach((tx: Transaction) => {
      const note = tx.note || '';
      const tags = (tx.tags || []).map((t) => t.toLowerCase());
      const gNameLower = (targetGroup?.name || '').toLowerCase();
      if (tags.includes('groupexpense') && (tags.includes(gNameLower) || (gNameLower && note.toLowerCase().includes(gNameLower)))) {
        linkedTxIds.add(tx.id);
      }
      if (tx.parentTransactionId && linkedTxIds.has(tx.parentTransactionId)) {
        linkedTxIds.add(tx.id);
      }
    });

    const linkedTxs = data.transactions.filter((tx: Transaction) => linkedTxIds.has(tx.id));
    const nextTransactions = data.transactions.filter((tx: Transaction) => !linkedTxIds.has(tx.id));
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions, data.holdings);
    const nextGroups = (data.groups || []).filter((g: ExpenseGroup) => g.id !== id);
    const nextGroupExpenses = (data.groupExpenses || []).filter((e: GroupExpense) => e.groupId !== id);

    const nextDebts = data.debts.map((d: Debt) => {
      const summary = getDebtContactSummary(d, nextTransactions);
      return {
        ...d,
        currentBalance: Math.abs(summary.netBalance),
        type: summary.netBalance >= 0 ? 'lent' : 'borrowed',
        status: Math.abs(summary.netBalance) <= 0.001 ? 'settled' : 'active',
      } as Debt;
    });

    let nextBin = pruneExpiredBinItems(data.bin || []);
    if (targetGroup) {
      const binItem: BinItem = {
        id: `bin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        originalId: id,
        itemType: 'group',
        title: `Group: ${targetGroup.name}`,
        subtitle: `${expensesToDelete.length} expenses • ${targetGroup.memberIds.length} members`,
        deletedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        payload: {
          group: targetGroup,
          groupExpenses: expensesToDelete,
          linkedTransactions: linkedTxs,
        },
        metadata: { groupName: targetGroup.name },
      };
      nextBin = [binItem, ...nextBin];
    }

    setData((prev: any) => ({
      ...prev,
      groups: nextGroups,
      groupExpenses: nextGroupExpenses,
      transactions: nextTransactions,
      accounts: nextAccounts,
      debts: nextDebts,
      bin: nextBin,
    }));
    showToast(`Group "${targetGroup?.name || ''}" moved to Bin (recoverable for 30 days)`, 'info');
  };

  const addGroupExpense = (expenseData: Omit<GroupExpense, 'id' | 'createdAt'>): string => {
    const expenseId = `ge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const group = (data.groups || []).find((g: ExpenseGroup) => g.id === expenseData.groupId);
    const groupName = group ? group.name : 'Group';

    const linkedDebtTxIds: string[] = [];
    let linkedPersonalTxId: string | undefined = undefined;
    const newTransactions: Transaction[] = [];

    let debtAccount = data.accounts.find(
      (a: Account) => a.isSystemDebtAccount || a.id === SYSTEM_DEBT_ACCOUNT_ID || a.type === 'debt'
    );
    let currentAccounts = [...data.accounts];
    if (!debtAccount) {
      debtAccount = DEFAULT_DEBT_ACCOUNT;
      currentAccounts.push(debtAccount);
    }

    const payerAccount = expenseData.accountId
      ? currentAccounts.find((a: Account) => a.id === expenseData.accountId)
      : undefined;

    const isUserMePayer = expenseData.paidBy === 'user_me';

    if (isUserMePayer) {
      // User paid: each other member owes user_me their split share
      expenseData.splits.forEach((split) => {
        if (split.memberId !== 'user_me' && split.amount > 0) {
          const contact = data.debts.find((d: Debt) => d.id === split.memberId);
          const contactName = contact ? contact.personName : split.memberId;
          const txId = `tx_ge_debt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          linkedDebtTxIds.push(txId);

          const fromAcc = payerAccount || debtAccount!;
          const transferTx: Transaction = {
            id: txId,
            date: expenseData.date,
            amount: split.amount,
            type: 'transfer',
            fromAccountId: fromAcc.id,
            fromAccountName: fromAcc.name,
            toAccountId: debtAccount!.id,
            toAccountName: debtAccount!.name,
            note: `[${groupName}] ${expenseData.title} (${contactName}'s share)`,
            tags: ['Debt', 'Lent', 'GroupExpense', groupName, contactName],
            debtId: split.memberId,
            createdAt: new Date().toISOString(),
          };
          newTransactions.push(transferTx);
        }
      });

      // Record personal share in passbook if payerAccount is linked
      const userSplit = expenseData.splits.find((s) => s.memberId === 'user_me');
      if (userSplit && userSplit.amount > 0 && payerAccount && expenseData.includeMyShareInPersonal !== false) {
        const pTxId = `tx_ge_personal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        linkedPersonalTxId = pTxId;
        const personalExpenseTx: Transaction = {
          id: pTxId,
          date: expenseData.date,
          amount: userSplit.amount,
          type: 'expense',
          categoryId: expenseData.categoryId || 'cat_dining',
          categoryName: data.categories.find((c: Category) => c.id === expenseData.categoryId)?.name || 'Dining & Food',
          fromAccountId: payerAccount.id,
          fromAccountName: payerAccount.name,
          note: `[${groupName}] ${expenseData.title} (My Share)`,
          tags: ['GroupExpense', groupName, 'PersonalShare'],
          createdAt: new Date().toISOString(),
        };
        newTransactions.push(personalExpenseTx);
      }
    } else {
      // Another contact paid: user owes that payer if user_me has a share > 0
      const userSplit = expenseData.splits.find((s) => s.memberId === 'user_me');
      if (userSplit && userSplit.amount > 0) {
        const payerContact = data.debts.find((d: Debt) => d.id === expenseData.paidBy);
        const payerName = payerContact ? payerContact.personName : expenseData.paidByName || 'Contact';
        const txId = `tx_ge_borrow_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        linkedDebtTxIds.push(txId);

        const borrowTx: Transaction = {
          id: txId,
          date: expenseData.date,
          amount: userSplit.amount,
          type: 'transfer',
          fromAccountId: debtAccount!.id,
          fromAccountName: debtAccount!.name,
          toAccountId: debtAccount!.id,
          note: `[${groupName}] Paid by ${payerName}: ${expenseData.title} (Your share)`,
          tags: ['Debt', 'Received', 'GroupExpense', groupName, payerName],
          debtId: expenseData.paidBy,
          createdAt: new Date().toISOString(),
        };
        newTransactions.push(borrowTx);

        // Dual-entry: personal expense record for user's share from debtAccount (₹0 bank deduction)
        if (expenseData.includeMyShareInPersonal !== false) {
          const pTxId = `tx_ge_personal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          linkedPersonalTxId = pTxId;
          const personalExpenseTx: Transaction = {
            id: pTxId,
            date: expenseData.date,
            amount: userSplit.amount,
            type: 'expense',
            categoryId: expenseData.categoryId || 'cat_dining',
            categoryName: data.categories.find((c: Category) => c.id === expenseData.categoryId)?.name || 'Dining & Food',
            fromAccountId: debtAccount!.id,
            fromAccountName: debtAccount!.name,
            note: `[${groupName}] ${expenseData.title} (My share paid by ${payerName})`,
            tags: ['GroupExpense', groupName, 'PersonalShare', 'UnsettledLiability'],
            createdAt: new Date().toISOString(),
          };
          newTransactions.push(personalExpenseTx);
        }
      }
    }

    const nextTransactions = [...newTransactions, ...data.transactions];
    const nextAccounts = recalculateBalances(currentAccounts, nextTransactions);

    const touchedDebtIds = new Set(newTransactions.filter((t) => t.debtId).map((t) => t.debtId!));
    const nextDebts = data.debts.map((d: Debt) => {
      if (!touchedDebtIds.has(d.id)) return d;
      const summary = getDebtContactSummary(d, nextTransactions);
      return {
        ...d,
        currentBalance: Math.abs(summary.netBalance),
        type: summary.netBalance >= 0 ? 'lent' : 'borrowed',
        status: Math.abs(summary.netBalance) <= 0.001 ? 'settled' : 'active',
      } as Debt;
    });

    const newExpense: GroupExpense = {
      ...expenseData,
      id: expenseId,
      linkedDebtTxIds,
      linkedPersonalTxId,
      createdAt: new Date().toISOString(),
    };

    setData((prev: any) => ({
      ...prev,
      groupExpenses: [newExpense, ...(prev.groupExpenses || [])],
      transactions: nextTransactions,
      accounts: nextAccounts,
      debts: nextDebts,
    }));

    showToast(`Expense "${newExpense.title}" added to ${groupName}`, 'success');
    return expenseId;
  };

  const updateGroupExpense = (id: string, updates: Partial<GroupExpense>) => {
    // Delete old transactions, re-post with updated values
    const oldExpense = (data.groupExpenses || []).find((e: GroupExpense) => e.id === id);
    if (!oldExpense) return;

    // Remove old linked transactions first
    const linkedIds = new Set<string>();
    if (oldExpense.linkedPersonalTxId) linkedIds.add(oldExpense.linkedPersonalTxId);
    if (oldExpense.linkedDebtTxIds) oldExpense.linkedDebtTxIds.forEach((tId: string) => linkedIds.add(tId));

    const cleanedTransactions = data.transactions.filter((t: Transaction) => !linkedIds.has(t.id));
    const mergedExpense: GroupExpense = { ...oldExpense, ...updates };

    const group = (data.groups || []).find((g: ExpenseGroup) => g.id === mergedExpense.groupId);
    const groupName = group ? group.name : 'Group';

    const linkedDebtTxIds: string[] = [];
    let linkedPersonalTxId: string | undefined = undefined;
    const newTransactions: Transaction[] = [];

    let debtAccount = data.accounts.find(
      (a: Account) => a.isSystemDebtAccount || a.id === SYSTEM_DEBT_ACCOUNT_ID || a.type === 'debt'
    ) || DEFAULT_DEBT_ACCOUNT;

    const payerAccount = mergedExpense.accountId
      ? data.accounts.find((a: Account) => a.id === mergedExpense.accountId)
      : undefined;

    const isUserMePayer = mergedExpense.paidBy === 'user_me';

    if (isUserMePayer) {
      mergedExpense.splits.forEach((split) => {
        if (split.memberId !== 'user_me' && split.amount > 0) {
          const contact = data.debts.find((d: Debt) => d.id === split.memberId);
          const contactName = contact ? contact.personName : split.memberId;
          const txId = `tx_ge_debt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          linkedDebtTxIds.push(txId);

          const fromAcc = payerAccount || debtAccount;
          const transferTx: Transaction = {
            id: txId,
            date: mergedExpense.date,
            amount: split.amount,
            type: 'transfer',
            fromAccountId: fromAcc.id,
            fromAccountName: fromAcc.name,
            toAccountId: debtAccount.id,
            toAccountName: debtAccount.name,
            note: `[${groupName}] ${mergedExpense.title} (${contactName}'s share)`,
            tags: ['Debt', 'Lent', 'GroupExpense', groupName, contactName],
            debtId: split.memberId,
            createdAt: new Date().toISOString(),
          };
          newTransactions.push(transferTx);
        }
      });

      const userSplit = mergedExpense.splits.find((s) => s.memberId === 'user_me');
      if (userSplit && userSplit.amount > 0 && payerAccount && mergedExpense.includeMyShareInPersonal !== false) {
        const pTxId = `tx_ge_personal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        linkedPersonalTxId = pTxId;
        const personalExpenseTx: Transaction = {
          id: pTxId,
          date: mergedExpense.date,
          amount: userSplit.amount,
          type: 'expense',
          categoryId: mergedExpense.categoryId || 'cat_dining',
          categoryName: data.categories.find((c: Category) => c.id === mergedExpense.categoryId)?.name || 'Dining & Food',
          fromAccountId: payerAccount.id,
          fromAccountName: payerAccount.name,
          note: `[${groupName}] ${mergedExpense.title} (My Share)`,
          tags: ['GroupExpense', groupName, 'PersonalShare'],
          createdAt: new Date().toISOString(),
        };
        newTransactions.push(personalExpenseTx);
      }
    } else {
      const userSplit = mergedExpense.splits.find((s) => s.memberId === 'user_me');
      if (userSplit && userSplit.amount > 0) {
        const payerContact = data.debts.find((d: Debt) => d.id === mergedExpense.paidBy);
        const payerName = payerContact ? payerContact.personName : mergedExpense.paidByName || 'Contact';
        const txId = `tx_ge_borrow_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        linkedDebtTxIds.push(txId);

        const borrowTx: Transaction = {
          id: txId,
          date: mergedExpense.date,
          amount: userSplit.amount,
          type: 'transfer',
          fromAccountId: debtAccount.id,
          fromAccountName: debtAccount.name,
          toAccountId: debtAccount.id,
          note: `[${groupName}] Paid by ${payerName}: ${mergedExpense.title} (Your share)`,
          tags: ['Debt', 'Received', 'GroupExpense', groupName, payerName],
          debtId: mergedExpense.paidBy,
          createdAt: new Date().toISOString(),
        };
        newTransactions.push(borrowTx);

        // Dual-entry personal expense record for user's share
        if (mergedExpense.includeMyShareInPersonal !== false) {
          const pTxId = `tx_ge_personal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          linkedPersonalTxId = pTxId;
          const personalExpenseTx: Transaction = {
            id: pTxId,
            date: mergedExpense.date,
            amount: userSplit.amount,
            type: 'expense',
            categoryId: mergedExpense.categoryId || 'cat_dining',
            categoryName: data.categories.find((c: Category) => c.id === mergedExpense.categoryId)?.name || 'Dining & Food',
            fromAccountId: debtAccount.id,
            fromAccountName: debtAccount.name,
            note: `[${groupName}] ${mergedExpense.title} (My share paid by ${payerName})`,
            tags: ['GroupExpense', groupName, 'PersonalShare', 'UnsettledLiability'],
            createdAt: new Date().toISOString(),
          };
          newTransactions.push(personalExpenseTx);
        }
      }
    }

    const nextTransactions = [...newTransactions, ...cleanedTransactions];
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

    const nextDebts = data.debts.map((d: Debt) => {
      const summary = getDebtContactSummary(d, nextTransactions);
      return {
        ...d,
        currentBalance: Math.abs(summary.netBalance),
        type: summary.netBalance >= 0 ? 'lent' : 'borrowed',
        status: Math.abs(summary.netBalance) <= 0.001 ? 'settled' : 'active',
      } as Debt;
    });

    const finalUpdatedExpense: GroupExpense = {
      ...mergedExpense,
      linkedDebtTxIds,
      linkedPersonalTxId,
    };

    setData((prev: any) => ({
      ...prev,
      groupExpenses: (prev.groupExpenses || []).map((e: GroupExpense) => (e.id === id ? finalUpdatedExpense : e)),
      transactions: nextTransactions,
      accounts: nextAccounts,
      debts: nextDebts,
    }));

    showToast('Group expense updated', 'success');
  };

  const deleteGroupExpense = (id: string) => {
    const targetExpense = (data.groupExpenses || []).find((e: GroupExpense) => e.id === id);
    if (!targetExpense) return;

    const linkedIds = new Set<string>();
    if (targetExpense.linkedPersonalTxId) linkedIds.add(targetExpense.linkedPersonalTxId);
    if (targetExpense.linkedDebtTxIds) targetExpense.linkedDebtTxIds.forEach((tId: string) => linkedIds.add(tId));

    data.transactions.forEach((tx: Transaction) => {
      const note = tx.note || '';
      const tags = (tx.tags || []).map((t) => t.toLowerCase());
      if (tags.includes('groupexpense') && note.includes(targetExpense.title)) {
        linkedIds.add(tx.id);
      }
      if (tx.parentTransactionId && linkedIds.has(tx.parentTransactionId)) {
        linkedIds.add(tx.id);
      }
    });

    const linkedTxs = data.transactions.filter((t: Transaction) => linkedIds.has(t.id));
    const nextTransactions = data.transactions.filter((t: Transaction) => !linkedIds.has(t.id));
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions, data.holdings);

    const nextDebts = data.debts.map((d: Debt) => {
      const summary = getDebtContactSummary(d, nextTransactions);
      return {
        ...d,
        currentBalance: Math.abs(summary.netBalance),
        type: summary.netBalance >= 0 ? 'lent' : 'borrowed',
        status: Math.abs(summary.netBalance) <= 0.001 ? 'settled' : 'active',
      } as Debt;
    });

    let nextBin = pruneExpiredBinItems(data.bin || []);
    const binItem: BinItem = {
      id: `bin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      originalId: id,
      itemType: 'group_expense',
      title: `Group Expense: ${targetExpense.title}`,
      subtitle: `Total: ₹${targetExpense.totalAmount.toLocaleString('en-IN')} • Date: ${targetExpense.date}`,
      amount: targetExpense.totalAmount,
      deletedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
      payload: {
        groupExpense: targetExpense,
        linkedTransactions: linkedTxs,
      },
      metadata: { notes: targetExpense.note, date: targetExpense.date },
    };
    nextBin = [binItem, ...nextBin];

    setData((prev: any) => ({
      ...prev,
      groupExpenses: (prev.groupExpenses || []).filter((e: GroupExpense) => e.id !== id),
      transactions: nextTransactions,
      accounts: nextAccounts,
      debts: nextDebts,
      bin: nextBin,
    }));

    showToast(`Group expense "${targetExpense.title}" moved to Bin (recoverable for 30 days)`, 'info');
  };

  const settleGroupDebt = (params: {
    groupId: string;
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    accountId?: string;
    date?: string;
    note?: string;
  }) => {
    const { groupId, fromMemberId, toMemberId, amount, accountId, date, note } = params;
    const group = (data.groups || []).find((g: ExpenseGroup) => g.id === groupId);
    const groupName = group ? group.name : 'Group';
    const txDate = date || toInputDate(new Date());

    if (fromMemberId === 'user_me' && toMemberId !== 'user_me') {
      recordDebtTransaction({
        debtId: toMemberId,
        type: 'paid',
        amount,
        accountId,
        date: txDate,
        note: `[${groupName}] Settle Up${note ? `: ${note}` : ''}`,
      });
    } else if (toMemberId === 'user_me' && fromMemberId !== 'user_me') {
      recordDebtTransaction({
        debtId: fromMemberId,
        type: 'received',
        amount,
        accountId,
        date: txDate,
        note: `[${groupName}] Settle Up received${note ? `: ${note}` : ''}`,
      });
    }

    const fromName = fromMemberId === 'user_me' ? 'You' : (data.debts.find((d: Debt) => d.id === fromMemberId)?.personName || 'Member');
    const toName = toMemberId === 'user_me' ? 'You' : (data.debts.find((d: Debt) => d.id === toMemberId)?.personName || 'Member');

    const settlementExpense: Omit<GroupExpense, 'id' | 'createdAt'> = {
      groupId,
      title: `Settlement: ${fromName} → ${toName}`,
      totalAmount: amount,
      paidBy: fromMemberId,
      paidByName: fromName,
      date: txDate,
      splitType: 'EXACT',
      splits: [
        { memberId: toMemberId, amount: amount },
      ],
      note: note || `Settlement payment`,
    };

    const newExpense: GroupExpense = {
      ...settlementExpense,
      id: `ge_settle_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };

    setData((prev: any) => ({
      ...prev,
      groupExpenses: [newExpense, ...(prev.groupExpenses || [])],
    }));

    showToast(`Settled ₹${amount} between ${fromName} and ${toName}`, 'success');
  };

  const importGroupExpenseFromClaim = (payload: {
    groupName: string;
    title: string;
    totalAmount: number;
    paidByName: string;
    userMemberName: string;
    userShareAmount: number;
    date: string;
    time?: string;
    note?: string;
    splitType?: string;
    shares: { name: string; amount: number; memberId?: string }[];
    categoryId?: string;
    accountId?: string;
  }): { success: boolean; groupId: string; expenseId: string } => {
    // 1. Locate or create group
    let group = (data.groups || []).find(
      (g: ExpenseGroup) => g.name.trim().toLowerCase() === payload.groupName.trim().toLowerCase()
    );

    let nextDebts = [...data.debts];
    let memberIds: string[] = group ? [...group.memberIds] : ['user_me'];

    const getOrCreateContact = (personName: string): string => {
      const cleanName = personName.trim();
      if (!cleanName || cleanName.toLowerCase() === 'you' || cleanName.toLowerCase() === 'me' || cleanName.toLowerCase() === payload.userMemberName.toLowerCase()) {
        return 'user_me';
      }
      const existing = nextDebts.find((d) => d.personName.toLowerCase() === cleanName.toLowerCase());
      if (existing) return existing.id;

      const newId = `debt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newContact: Debt = {
        id: newId,
        personName: cleanName,
        type: 'lent',
        principalAmount: 0,
        currentBalance: 0,
        status: 'active',
        notes: `Auto-imported contact from ${payload.groupName}`,
        createdAt: new Date().toISOString(),
      };
      nextDebts.push(newContact);
      return newId;
    };

    // Ensure all members in shares have contacts
    const memberIdMap = new Map<string, string>(); // name -> memberId
    payload.shares.forEach((s) => {
      const isUser = s.name.trim().toLowerCase() === payload.userMemberName.trim().toLowerCase() || s.name.trim().toLowerCase() === 'you';
      if (isUser) {
        memberIdMap.set(s.name, 'user_me');
      } else {
        const cId = getOrCreateContact(s.name);
        memberIdMap.set(s.name, cId);
        if (!memberIds.includes(cId)) {
          memberIds.push(cId);
        }
      }
    });

    // Payer contact ID
    const isUserPayer =
      payload.paidByName.trim().toLowerCase() === 'you' ||
      payload.paidByName.trim().toLowerCase() === 'me' ||
      payload.paidByName.trim().toLowerCase() === payload.userMemberName.trim().toLowerCase() ||
      payload.paidByName.trim().toLowerCase() === (userProfile?.name || '').trim().toLowerCase();

    const payerMemberId = isUserPayer ? 'user_me' : getOrCreateContact(payload.paidByName);
    if (!memberIds.includes(payerMemberId)) {
      memberIds.push(payerMemberId);
    }

    let targetGroupId = group ? group.id : '';
    let nextGroups = [...(data.groups || [])];

    if (!group) {
      targetGroupId = `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newGroup: ExpenseGroup = {
        id: targetGroupId,
        name: payload.groupName.trim(),
        description: `Imported via WhatsApp link`,
        memberIds,
        avatarColor: '#059669',
        createdAt: new Date().toISOString(),
      };
      nextGroups = [newGroup, ...nextGroups];
    } else {
      nextGroups = nextGroups.map((g) => (g.id === group!.id ? { ...g, memberIds: Array.from(new Set([...g.memberIds, ...memberIds])) } : g));
    }

    // Build splits
    const splits: GroupExpenseSplit[] = payload.shares.map((s) => {
      const isUser = s.name.trim().toLowerCase() === payload.userMemberName.trim().toLowerCase() || s.name.trim().toLowerCase() === 'you';
      return {
        memberId: isUser ? 'user_me' : (memberIdMap.get(s.name) || getOrCreateContact(s.name)),
        amount: isUser ? payload.userShareAmount : s.amount,
      };
    });

    setData((prev: any) => ({
      ...prev,
      groups: nextGroups,
      debts: nextDebts,
    }));

    const expenseId = addGroupExpense({
      groupId: targetGroupId,
      title: payload.title.trim(),
      totalAmount: payload.totalAmount,
      paidBy: payerMemberId,
      paidByName: payload.paidByName,
      date: payload.date || toInputDate(new Date()),
      time: payload.time,
      splitType: (payload.splitType as any) || 'EQUAL',
      splits,
      note: payload.note,
      categoryId: payload.categoryId || 'cat_dining',
      accountId: payload.accountId,
      includeMyShareInPersonal: true,
    });

    showToast(`Imported expense "${payload.title}" into "${payload.groupName}"!`, 'success');
    return { success: true, groupId: targetGroupId, expenseId };
  };

  // Recurring Transactions Mutations
  const addRecurring = (recData: Omit<RecurringTransaction, 'id'>) => {
    const newRec: RecurringTransaction = {
      ...recData,
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setData((prev: any) => ({ ...prev, recurring: [...prev.recurring, newRec] }));
    showToast(`Recurring schedule "${newRec.name}" created`, 'success');
  };

  const updateRecurring = (id: string, updates: Partial<RecurringTransaction>) => {
    setData((prev: any) => ({
      ...prev,
      recurring: prev.recurring.map((r: RecurringTransaction) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    }));
    showToast('Recurring schedule updated', 'info');
  };

  const deleteRecurring = (id: string) => {
    const targetRec = data.recurring.find((r: RecurringTransaction) => r.id === id);
    let nextBin = pruneExpiredBinItems(data.bin || []);
    if (targetRec) {
      const binItem: BinItem = {
        id: `bin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        originalId: id,
        itemType: 'recurring',
        title: `Scheduled: ${targetRec.name}`,
        subtitle: `${targetRec.frequency.toUpperCase()} • ₹${targetRec.amount.toLocaleString('en-IN')} • Next: ${targetRec.nextExecutionDate}`,
        amount: targetRec.amount,
        deletedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        payload: { recurring: targetRec },
        metadata: { notes: targetRec.note, frequency: targetRec.frequency },
      };
      nextBin = [binItem, ...nextBin];
    }
    setData((prev: any) => ({
      ...prev,
      recurring: prev.recurring.filter((r: RecurringTransaction) => r.id !== id),
      bin: nextBin,
    }));
    showToast(`Recurring schedule "${targetRec?.name || ''}" moved to Bin (recoverable for 30 days)`, 'info');
  };

  const upcoming24hRecurring = useMemo(() => {
    return getUpcomingRecurring24h(data.recurring || []);
  }, [data.recurring]);

  const checkIsRecurringExecuted = (rec: RecurringTransaction, targetDate?: string): boolean => {
    return isRecurringAlreadyExecuted(rec, targetDate || rec.nextExecutionDate, data.transactions || []);
  };

  const executeRecurringNow = (id: string) => {
    const rec = data.recurring.find((r: RecurringTransaction) => r.id === id);
    if (!rec) return;

    const todayStr = toInputDate(new Date());

    // STRICT DUPLICATE CHECK: Prevent manual duplicate executions for the same period
    const alreadyDone =
      isRecurringAlreadyExecuted(rec, rec.nextExecutionDate, data.transactions) ||
      isRecurringAlreadyExecuted(rec, todayStr, data.transactions);

    if (alreadyDone) {
      showToast(
        `"${rec.name}" has already been recorded for this cycle on ${formatDate(rec.lastExecutedDate || todayStr)}. Duplicate entry prevented.`,
        'info'
      );
      return;
    }

    const newTx: Transaction = {
      id: `tx_rec_manual_${Date.now()}`,
      date: todayStr,
      amount: rec.amount,
      type: rec.type,
      categoryId: rec.categoryId || 'cat_misc',
      categoryName: rec.categoryName || 'Recurring',
      fromAccountId: rec.fromAccountId,
      fromAccountName: rec.fromAccountName,
      toAccountId: rec.toAccountId,
      toAccountName: rec.toAccountName,
      note: `[Manual Execution] ${rec.name}${rec.note ? ' - ' + rec.note : ''}`,
      tags: [...(rec.tags || []), 'Scheduled', 'ManualRun'],
      recurringId: rec.id,
      recurringExecutionDate: rec.nextExecutionDate,
      createdAt: new Date().toISOString(),
    };

    const nextTransactions = [newTx, ...data.transactions];
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

    const nextDate = new Date();
    if (rec.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
    else if (rec.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    else if (rec.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
    else if (rec.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

    const nextRecurring = data.recurring.map((r: RecurringTransaction) =>
      r.id === id
        ? {
            ...r,
            lastExecutedDate: todayStr,
            nextExecutionDate: toInputDate(nextDate),
          }
        : r
    );

    setData((prev: any) => ({
      ...prev,
      transactions: nextTransactions,
      accounts: nextAccounts,
      recurring: nextRecurring,
    }));

    showToast(`Executed "${rec.name}" for ₹${rec.amount} (1x entry logged)`, 'success');
  };

  // Mutual Fund Systematic Investment Plan (SIP) Tracker Mutations
  const sipSchedules: SipSchedule[] = data.sips || [];
  const sipExecutions: SipExecutionRecord[] = data.sipExecutions || [];

  const addSipSchedule = (sip: Omit<SipSchedule, 'id' | 'createdAt'>) => {
    const newSip: SipSchedule = {
      ...sip,
      id: `sip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setData((prev: any) => ({
      ...prev,
      sips: [...(prev.sips || []), newSip],
    }));
    showToast(`SIP for "${sip.schemeName}" scheduled on ${sip.sipDate}th`, 'success');
  };

  const updateSipSchedule = (id: string, updates: Partial<SipSchedule>) => {
    setData((prev: any) => ({
      ...prev,
      sips: (prev.sips || []).map((s: SipSchedule) => (s.id === id ? { ...s, ...updates } : s)),
    }));
    showToast('SIP schedule updated', 'info');
  };

  const deleteSipSchedule = (id: string) => {
    const targetSip = (data.sips || []).find((s: SipSchedule) => s.id === id);
    let nextBin = pruneExpiredBinItems(data.bin || []);
    if (targetSip) {
      const binItem: BinItem = {
        id: `bin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        originalId: id,
        itemType: 'sip',
        title: `SIP: ${targetSip.schemeName}`,
        subtitle: `Monthly ₹${targetSip.installmentAmount.toLocaleString('en-IN')} on ${targetSip.sipDate}th • ${targetSip.status}`,
        amount: targetSip.installmentAmount,
        deletedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        payload: { sip: targetSip },
        metadata: { schemeName: targetSip.schemeName, schemeCode: targetSip.schemeCode },
      };
      nextBin = [binItem, ...nextBin];
    }
    setData((prev: any) => ({
      ...prev,
      sips: (prev.sips || []).filter((s: SipSchedule) => s.id !== id),
      bin: nextBin,
    }));
    showToast(`SIP schedule "${targetSip?.schemeName || ''}" moved to Bin (recoverable for 30 days)`, 'info');
  };

  const deleteSipExecution = (logId: string) => {
    const targetLog = (data.sipExecutions || []).find((l: SipExecutionRecord) => l.id === logId);
    if (!targetLog) return;

    const nextExecutions = (data.sipExecutions || []).filter((l: SipExecutionRecord) => l.id !== logId);

    // If an associated transaction is still present in a holding ledger, clean it up
    let nextHoldings = data.holdings;
    let nextTransactions = data.transactions;
    let nextAccounts = data.accounts;
    let txRemoved = false;

    nextHoldings = (data.holdings || []).map((h: InvestmentHolding) => {
      const hasMatch = (h.transactions || []).some((t: InvestmentTransaction) =>
        isSipExecutionMatchingTx(targetLog, t, undefined, h)
      );
      if (!hasMatch) return h;

      const remaining = (h.transactions || []).filter((t: InvestmentTransaction) => {
        const matches = isSipExecutionMatchingTx(targetLog, t, undefined, h);
        if (matches) txRemoved = true;
        return !matches;
      });
      return recomputeHoldingFromLedger(h, remaining);
    });

    const matchingPassbookTxs = (data.transactions || []).filter((t: Transaction) =>
      isSipExecutionMatchingTx(targetLog, undefined, t, undefined)
    );
    if (matchingPassbookTxs.length > 0) {
      const idsToDelete = new Set(matchingPassbookTxs.map((t: Transaction) => t.id));
      nextTransactions = data.transactions.filter((t: Transaction) => !idsToDelete.has(t.id));
      nextAccounts = recalculateBalances(data.accounts, nextTransactions);
    }

    const nextSips = reconcileSipSchedules(data.sips || [], nextHoldings);

    setData((prev: any) => ({
      ...prev,
      sipExecutions: nextExecutions,
      holdings: nextHoldings,
      transactions: nextTransactions,
      accounts: nextAccounts,
      sips: nextSips,
    }));

    showToast(
      txRemoved
        ? `Execution log and portfolio allotment entry for "${targetLog.schemeName}" removed`
        : `Execution log for "${targetLog.schemeName}" removed`,
      'info'
    );
  };

  const clearSipExecutions = () => {
    setData((prev: any) => ({
      ...prev,
      sipExecutions: [],
    }));
    showToast('SIP execution logs cleared', 'info');
  };

  // =========================================================================
  // 30-DAY RECYCLE BIN RESTORATION & PURGE ENGINE
  // =========================================================================

  const restoreFromBin = (binItemId: string) => {
    const item = (data.bin || []).find((b: BinItem) => b.id === binItemId);
    if (!item) {
      showToast('Item not found in Bin', 'error');
      return;
    }

    const nextBin = (data.bin || []).filter((b: BinItem) => b.id !== binItemId);

    switch (item.itemType) {
      case 'transaction': {
        const tx: Transaction = item.payload.transaction;
        const companions: Transaction[] = item.payload.companionTransactions || [];
        const restoredTxs = [tx, ...companions];

        // Ensure fromAccount exists in accounts, fallback to first active if deleted
        const fallbackAccId = data.accounts[0]?.id || '';
        const fallbackAccName = data.accounts[0]?.name || 'Primary Account';
        const sanitizedTxs = restoredTxs.map((t) => {
          let fromId = t.fromAccountId;
          let fromName = t.fromAccountName;
          if (!data.accounts.some((a: Account) => a.id === fromId)) {
            fromId = fallbackAccId;
            fromName = fallbackAccName;
          }
          return { ...t, fromAccountId: fromId, fromAccountName: fromName };
        });

        // Prevent duplicate IDs
        const existingTxIds = new Set(data.transactions.map((t: Transaction) => t.id));
        const newTxsToAdd = sanitizedTxs.filter((t) => !existingTxIds.has(t.id));

        const nextTransactions = [...newTxsToAdd, ...data.transactions];
        const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

        // If transaction was linked to debt, update debt summary
        let nextDebts = data.debts;
        if (tx.debtId) {
          const targetDebt = data.debts.find((d: Debt) => d.id === tx.debtId);
          if (targetDebt) {
            const summary = getDebtContactSummary(targetDebt, nextTransactions);
            nextDebts = data.debts.map((d: Debt) =>
              d.id === tx.debtId
                ? {
                    ...d,
                    currentBalance: Math.abs(summary.netBalance),
                    type: summary.netBalance >= 0 ? 'lent' : 'borrowed',
                    status: Math.abs(summary.netBalance) <= 0.001 ? 'settled' : 'active',
                  }
                : d
            );
          }
        }

        const restoredSipExecs: SipExecutionRecord[] = item.payload.linkedSipExecutions || [];
        const existingExecIds = new Set((data.sipExecutions || []).map((e: SipExecutionRecord) => e.id));
        const newExecsToAdd = restoredSipExecs.filter((e) => !existingExecIds.has(e.id));
        const nextSipExecutions = [...newExecsToAdd, ...(data.sipExecutions || [])];
        const nextSips = reconcileSipSchedules(data.sips || [], data.holdings || []);

        setData((prev: any) => ({
          ...prev,
          transactions: nextTransactions,
          accounts: nextAccounts,
          debts: nextDebts,
          sips: nextSips,
          sipExecutions: nextSipExecutions,
          bin: nextBin,
        }));
        showToast(`Transaction "${item.title}" restored successfully`, 'success');
        break;
      }

      case 'trade_action': {
        const { holdingId, tradeTransaction, linkedPassbookTransactions, linkedSipExecutions } = item.payload;
        const targetHolding = data.holdings.find(
          (h: InvestmentHolding) => h.id === holdingId || h.symbol === item.metadata?.holdingSymbol
        );

        let nextHoldings = data.holdings;
        if (targetHolding) {
          const nextLedger = [...(targetHolding.transactions || []), tradeTransaction];
          const updatedHolding = recomputeHoldingFromLedger(targetHolding, nextLedger);
          nextHoldings = data.holdings.map((h: InvestmentHolding) =>
            h.id === targetHolding.id ? updatedHolding : h
          );
        } else {
          // Re-create holding if it was deleted
          const restoredHolding: InvestmentHolding = {
            id: holdingId || `inv_${Date.now()}`,
            symbol: item.metadata?.holdingSymbol || 'RESTORED',
            name: item.metadata?.holdingName || item.metadata?.holdingSymbol || 'Restored Asset',
            assetType: 'stock',
            dematAccountId: data.accounts.find((a: Account) => a.type === 'demat')?.id || data.accounts[0]?.id || '',
            quantity: tradeTransaction.quantity || 0,
            averageBuyPrice: tradeTransaction.price || 0,
            currentPrice: tradeTransaction.price || 0,
            lastPriceUpdate: tradeTransaction.date || toInputDate(new Date()),
            transactions: [tradeTransaction],
          };
          nextHoldings = [...data.holdings, recomputeHoldingFromLedger(restoredHolding, [tradeTransaction])];
        }

        const existingTxIds = new Set(data.transactions.map((t: Transaction) => t.id));
        const passbookTxsToAdd = (linkedPassbookTransactions || []).filter(
          (t: Transaction) => !existingTxIds.has(t.id)
        );
        const nextTransactions = [...passbookTxsToAdd, ...data.transactions];
        const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

        const restoredTradeSipExecs: SipExecutionRecord[] = linkedSipExecutions || [];
        const existingTradeExecIds = new Set((data.sipExecutions || []).map((e: SipExecutionRecord) => e.id));
        const newTradeExecsToAdd = restoredTradeSipExecs.filter((e) => !existingTradeExecIds.has(e.id));
        const nextSipExecutions = [...newTradeExecsToAdd, ...(data.sipExecutions || [])];
        const nextSips = reconcileSipSchedules(data.sips || [], nextHoldings);

        setData((prev: any) => ({
          ...prev,
          holdings: nextHoldings,
          transactions: nextTransactions,
          accounts: nextAccounts,
          sips: nextSips,
          sipExecutions: nextSipExecutions,
          bin: nextBin,
        }));
        showToast(`Trade action "${item.title}" restored to portfolio`, 'success');
        break;
      }

      case 'account': {
        const { account, linkedTransactions } = item.payload;
        // Avoid duplicate ID
        const filteredAccounts = data.accounts.filter((a: Account) => a.id !== account.id);
        const nextAccountsList = [...filteredAccounts, account];

        const existingTxIds = new Set(data.transactions.map((t: Transaction) => t.id));
        const restoredTxs = (linkedTransactions || []).filter((t: Transaction) => !existingTxIds.has(t.id));
        const nextTransactions = [...restoredTxs, ...data.transactions];
        const nextAccounts = recalculateBalances(nextAccountsList, nextTransactions);

        setData((prev: any) => ({
          ...prev,
          accounts: nextAccounts,
          transactions: nextTransactions,
          bin: nextBin,
        }));
        showToast(`Bank account "${item.title}" restored successfully`, 'success');
        break;
      }

      case 'holding': {
        const { holding, linkedTransactions } = item.payload;
        const filteredHoldings = data.holdings.filter((h: InvestmentHolding) => h.id !== holding.id);
        const nextHoldings = [...filteredHoldings, holding];

        const existingTxIds = new Set(data.transactions.map((t: Transaction) => t.id));
        const restoredTxs = (linkedTransactions || []).filter((t: Transaction) => !existingTxIds.has(t.id));
        const nextTransactions = [...restoredTxs, ...data.transactions];
        const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

        setData((prev: any) => ({
          ...prev,
          holdings: nextHoldings,
          transactions: nextTransactions,
          accounts: nextAccounts,
          bin: nextBin,
        }));
        showToast(`Investment holding "${item.title}" restored`, 'success');
        break;
      }

      case 'category': {
        const { category } = item.payload;
        const filteredCategories = data.categories.filter((c: Category) => c.id !== category.id);
        setData((prev: any) => ({
          ...prev,
          categories: [...filteredCategories, category],
          bin: nextBin,
        }));
        showToast(`Category "${category.name}" restored`, 'success');
        break;
      }

      case 'debt': {
        const { debt, linkedTransactions } = item.payload;
        const filteredDebts = data.debts.filter((d: Debt) => d.id !== debt.id);
        const nextDebts = [...filteredDebts, debt];

        const existingTxIds = new Set(data.transactions.map((t: Transaction) => t.id));
        const restoredTxs = (linkedTransactions || []).filter((t: Transaction) => !existingTxIds.has(t.id));
        const nextTransactions = [...restoredTxs, ...data.transactions];
        const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

        setData((prev: any) => ({
          ...prev,
          debts: nextDebts,
          transactions: nextTransactions,
          accounts: nextAccounts,
          bin: nextBin,
        }));
        showToast(`Debt ledger for "${debt.personName}" restored`, 'success');
        break;
      }

      case 'debt_record': {
        const { transaction } = item.payload;
        const existingTxIds = new Set(data.transactions.map((t: Transaction) => t.id));
        const nextTransactions = existingTxIds.has(transaction.id)
          ? data.transactions
          : [transaction, ...data.transactions];
        const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

        let nextDebts = data.debts;
        if (transaction.debtId) {
          const targetDebt = data.debts.find((d: Debt) => d.id === transaction.debtId);
          if (targetDebt) {
            const summary = getDebtContactSummary(targetDebt, nextTransactions);
            nextDebts = data.debts.map((d: Debt) =>
              d.id === transaction.debtId
                ? {
                    ...d,
                    currentBalance: Math.abs(summary.netBalance),
                    type: summary.netBalance >= 0 ? 'lent' : 'borrowed',
                    status: Math.abs(summary.netBalance) <= 0.001 ? 'settled' : 'active',
                  }
                : d
            );
          }
        }

        setData((prev: any) => ({
          ...prev,
          debts: nextDebts,
          transactions: nextTransactions,
          accounts: nextAccounts,
          bin: nextBin,
        }));
        showToast('Debt record restored', 'success');
        break;
      }

      case 'recurring': {
        const { recurring } = item.payload;
        const filteredRecurring = data.recurring.filter((r: RecurringTransaction) => r.id !== recurring.id);
        setData((prev: any) => ({
          ...prev,
          recurring: [...filteredRecurring, recurring],
          bin: nextBin,
        }));
        showToast(`Recurring schedule "${recurring.name}" restored`, 'success');
        break;
      }

      case 'sip': {
        const { sip } = item.payload;
        const filteredSips = (data.sips || []).filter((s: SipSchedule) => s.id !== sip.id);
        setData((prev: any) => ({
          ...prev,
          sips: [...filteredSips, sip],
          bin: nextBin,
        }));
        showToast(`SIP schedule "${sip.schemeName}" restored`, 'success');
        break;
      }

      case 'group': {
        const { group, groupExpenses, linkedTransactions } = item.payload;
        const filteredGroups = (data.groups || []).filter((g: ExpenseGroup) => g.id !== group.id);
        const filteredGroupExpenses = (data.groupExpenses || []).filter(
          (e: GroupExpense) => e.groupId !== group.id
        );

        const nextGroups = [...filteredGroups, group];
        const nextGroupExpenses = [...filteredGroupExpenses, ...(groupExpenses || [])];

        const existingTxIds = new Set(data.transactions.map((t: Transaction) => t.id));
        const restoredTxs = (linkedTransactions || []).filter((t: Transaction) => !existingTxIds.has(t.id));
        const nextTransactions = [...restoredTxs, ...data.transactions];
        const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

        setData((prev: any) => ({
          ...prev,
          groups: nextGroups,
          groupExpenses: nextGroupExpenses,
          transactions: nextTransactions,
          accounts: nextAccounts,
          bin: nextBin,
        }));
        showToast(`Group "${group.name}" restored`, 'success');
        break;
      }

      case 'group_expense': {
        const { groupExpense, linkedTransactions } = item.payload;
        const filteredExpenses = (data.groupExpenses || []).filter(
          (e: GroupExpense) => e.id !== groupExpense.id
        );
        const nextGroupExpenses = [...filteredExpenses, groupExpense];

        const existingTxIds = new Set(data.transactions.map((t: Transaction) => t.id));
        const restoredTxs = (linkedTransactions || []).filter((t: Transaction) => !existingTxIds.has(t.id));
        const nextTransactions = [...restoredTxs, ...data.transactions];
        const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

        setData((prev: any) => ({
          ...prev,
          groupExpenses: nextGroupExpenses,
          transactions: nextTransactions,
          accounts: nextAccounts,
          bin: nextBin,
        }));
        showToast(`Group expense "${groupExpense.title}" restored`, 'success');
        break;
      }

      case 'loan': {
        const { loan, loanAccount, linkedTransactions } = item.payload;
        const filteredLoans = (data.loans || []).filter((l: Loan) => l.id !== loan.id);
        const nextLoans = [...filteredLoans, loan];

        // Restore loan account if it was removed
        let nextAccounts = data.accounts;
        if (loanAccount && !data.accounts.some((a: Account) => a.id === loanAccount.id)) {
          nextAccounts = [...data.accounts, loanAccount];
        }

        const existingTxIds = new Set(data.transactions.map((t: Transaction) => t.id));
        const restoredTxs = (linkedTransactions || []).filter((t: Transaction) => !existingTxIds.has(t.id));
        const nextTransactions = [...restoredTxs, ...data.transactions];
        const recalculated = recalculateBalances(nextAccounts, nextTransactions, data.holdings);

        setData((prev: any) => ({
          ...prev,
          loans: nextLoans,
          accounts: recalculated,
          transactions: nextTransactions,
          bin: nextBin,
        }));
        showToast(`Loan "${loan.name}" and ${restoredTxs.length} associated transactions restored`, 'success');
        break;
      }

      default:
        showToast('Unknown item type in Bin', 'error');
    }
  };

  const deletePermanentlyFromBin = (binItemId: string) => {
    setData((prev: any) => ({
      ...prev,
      bin: (prev.bin || []).filter((b: BinItem) => b.id !== binItemId),
    }));
    showToast('Item permanently removed from Bin', 'info');
  };

  const emptyBin = () => {
    setData((prev: any) => ({
      ...prev,
      bin: [],
    }));
    showToast('All items in Bin have been permanently deleted', 'info');
  };

  const restoreAllFromBin = (itemType?: BinItemType) => {
    const itemsToRestore = itemType
      ? (data.bin || []).filter((b: BinItem) => b.itemType === itemType)
      : [...(data.bin || [])];

    if (itemsToRestore.length === 0) {
      showToast('No items to restore in Bin', 'info');
      return;
    }

    itemsToRestore.forEach((item: BinItem) => {
      restoreFromBin(item.id);
    });

    showToast(`Restored ${itemsToRestore.length} items from Bin`, 'success');
  };

  const toggleSipStatus = (id: string) => {
    setData((prev: any) => {
      const target = (prev.sips || []).find((s: SipSchedule) => s.id === id);
      const nextStatus = target?.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      return {
        ...prev,
        sips: (prev.sips || []).map((s: SipSchedule) =>
          s.id === id ? { ...s, status: nextStatus } : s
        ),
      };
    });
  };

  const runSipWorkerNow = async (_options?: { forceCheck?: boolean }) => {
    try {
      const allExistingTxs = (data.holdings || []).flatMap(
        (h: InvestmentHolding) => h.transactions || []
      );

      const result = await executePendingSips({
        sips: sipSchedules,
        existingTransactions: allExistingTxs,
        holdings: data.holdings || [],
      });

      if (result.executedSips.length > 0) {
        setData((prev: any) => {
          const updatedSipsMap = new Map(result.executedSips.map((s) => [s.id, s]));
          const nextSips = (prev.sips || []).map(
            (s: SipSchedule) => updatedSipsMap.get(s.id) || s
          );

          // Append newly executed transaction into the matched holding ledger
          const nextHoldings = (prev.holdings || []).map((h: InvestmentHolding) => {
            const newTxsForHolding = result.createdTransactions.filter(
              (tx) => tx.holdingId === h.id
            );
            if (newTxsForHolding.length > 0) {
              const updatedLedger = [...(h.transactions || []), ...newTxsForHolding];
              return recomputeHoldingFromLedger(h, updatedLedger);
            }
            return h;
          });

          return {
            ...prev,
            sips: nextSips,
            holdings: nextHoldings,
            sipExecutions: [...result.executionRecords, ...(prev.sipExecutions || [])].slice(0, 50),
          };
        });

        showToast(result.summaryMessage, 'success');
        return { success: true, message: result.summaryMessage, count: result.executedSips.length };
      } else {
        if (result.executionRecords.length > 0) {
          setData((prev: any) => ({
            ...prev,
            sipExecutions: [...result.executionRecords, ...(prev.sipExecutions || [])].slice(0, 50),
          }));
        }
        showToast(result.summaryMessage, result.isHolidayOrWeekend ? 'info' : 'info');
        return { success: true, message: result.summaryMessage, count: 0 };
      }
    } catch (err: any) {
      showToast(`SIP worker failed: ${err?.message || 'Network error'}`, 'error');
      return { success: false, message: err?.message || 'Network error', count: 0 };
    }
  };

  // Automated Historical Price Resolution Engine
  const getHoldingMarketPrice = (holding: InvestmentHolding) => {
    const ident = getAssetIdentification(holding);
    const meta = ident ? priceMetaMap.get(ident.assetKey) : null;
    let livePrice = holding.currentPrice;
    let updateDate = holding.lastPriceUpdate || toInputDate(new Date());
    let prevPrice = holding.previousClosePrice;
    let prevDate = holding.previousCloseDate;
    let isOffline = true;
    let isUpdating = false;

    if (meta && meta.latestPrice > 0) {
      livePrice = meta.latestPrice;
      updateDate = meta.latestDate;
      if (meta.previousClosePrice && meta.previousClosePrice > 0) {
        prevPrice = meta.previousClosePrice;
        prevDate = meta.previousCloseDate;
      }
      isOffline = meta.status === 'cached';
      isUpdating = meta.status === 'updating';
    }

    // Fallback 1: match with INITIAL_HOLDINGS seed data if previousClosePrice is not set
    if (!prevPrice || prevPrice <= 0) {
      const seedMatch = INITIAL_HOLDINGS.find(
        (ih) => ih.id === holding.id || ih.symbol === holding.symbol
      );
      if (seedMatch?.previousClosePrice) {
        prevPrice = seedMatch.previousClosePrice;
        prevDate = seedMatch.previousCloseDate;
      }
    }

    // Fallback 2: check if holding has a transaction specifically on the previous trading day
    if (!prevPrice || prevPrice <= 0) {
      const expectedPrevTradingDay = getPreviousTradingDay(updateDate);
      const prevDayTxs = (holding.transactions || [])
        .filter((t) => t.price > 0 && t.date && t.date === expectedPrevTradingDay)
        .sort((a, b) => b.date.localeCompare(a.date));
      if (prevDayTxs.length > 0) {
        prevPrice = prevDayTxs[0].price;
        prevDate = prevDayTxs[0].date;
      }
    }

    // Final fallback: if previous close is still not found, default to livePrice (0% change)
    if (!prevPrice || prevPrice <= 0) {
      prevPrice = livePrice;
    }

    // Always ensure previousDate is defined
    if (!prevDate) {
      prevDate = getPreviousTradingDay(updateDate);
    }

    const diff = livePrice - prevPrice;
    const diffPercent = prevPrice > 0 ? (diff / prevPrice) * 100 : 0;

    return {
      price: livePrice,
      previousPrice: prevPrice,
      date: updateDate,
      previousDate: prevDate,
      isOffline,
      isUpdating,
      change1D: diff,
      change1DPercent: diffPercent,
    };
  };

  const syncMarketPrices = async (forceRefresh = false, targetHoldingId?: string) => {
    setIsSyncingPrices(true);
    setIsUpdatingNavs(true);
    try {
      let targets = data.holdings || [];
      if (targetHoldingId) {
        targets = targets.filter((h: InvestmentHolding) => h.id === targetHoldingId);
      }
      const updatedMeta = await syncActiveAssetsPrices(targets, { forceRefresh: true });
      setPriceMetaMap(updatedMeta);

      let updatedCount = 0;
      setData((prev: any) => {
        const nextHoldings = (prev.holdings || []).map((h: InvestmentHolding) => {
          const ident = getAssetIdentification(h);
          if (ident && updatedMeta.has(ident.assetKey)) {
            const m = updatedMeta.get(ident.assetKey)!;
            if (m.latestPrice > 0) {
              updatedCount++;
              if (h.assetType === 'sgb') {
                return {
                  ...h,
                  currentPrice: m.latestPrice,
                  goldReferencePrice: m.latestPrice,
                  goldPriceDate: m.latestDate,
                  goldPriceSource: 'IBJA Domestic Benchmark (24K / 999 Parity)',
                  lastPriceUpdate: m.latestDate,
                  previousClosePrice: m.previousClosePrice || h.previousClosePrice,
                  previousCloseDate: m.previousCloseDate || h.previousCloseDate,
                };
              }
              return {
                ...h,
                currentPrice: m.latestPrice,
                lastPriceUpdate: m.latestDate,
                previousClosePrice: m.previousClosePrice || h.previousClosePrice,
                previousCloseDate: m.previousCloseDate || h.previousCloseDate,
              };
            }
          }
          return h;
        });
        return { ...prev, holdings: nextHoldings };
      });

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const msg = isOnline
        ? `Market prices synced for ${updatedCount} asset(s) (Yahoo, AMFI & Goldprice.dev)`
        : 'Offline mode: Using cached prices from local database';
      showToast(msg, isOnline ? 'success' : 'info');
      return { success: true, count: updatedCount, message: msg };
    } catch (err: any) {
      console.warn('[SyncMarketPrices] Fallback to cache:', err);
      showToast('Using cached prices (offline mode)', 'info');
      return { success: false, count: 0, message: err?.message || 'Offline' };
    } finally {
      setIsSyncingPrices(false);
      setIsUpdatingNavs(false);
    }
  };

  const autoUpdateMutualFundsNav = async (silent = false, _openModal = false) => {
    const res = await syncMarketPrices(true);
    return {
      success: res.success,
      count: res.count,
      message: res.message,
    };
  };

  // Link official AMFI Scheme Code & Name to a holding and optionally fetch live closing NAV
  const linkHoldingAmfiScheme = async (
    holdingId: string,
    schemeCode: string,
    schemeName: string,
    autoFetchNav = true
  ) => {
    setIsUpdatingNavs(true);
    try {
      let nav = 0;
      let navDateStr = toInputDate(new Date());

      if (autoFetchNav) {
        const navRecord = await fetchSchemeLatestNav(schemeCode, true);
        if (navRecord && navRecord.nav > 0) {
          nav = Number(navRecord.nav.toFixed(4));
          if (navRecord.parsedDate) {
            navDateStr = toInputDate(navRecord.parsedDate);
          }
        }
      }

      setData((prev: any) => ({
        ...prev,
        holdings: (prev.holdings || []).map((h: InvestmentHolding) => {
          if (h.id !== holdingId) return h;
          return {
            ...h,
            amfiSchemeCode: schemeCode,
            amfiSchemeName: schemeName,
            currentPrice: nav > 0 ? nav : h.currentPrice,
            lastPriceUpdate: nav > 0 ? navDateStr : h.lastPriceUpdate,
          };
        }),
      }));

      // Also trigger historical sync for this newly linked scheme
      syncMarketPrices(true, holdingId);

      const msg = nav > 0
        ? `Linked "${schemeName}" & updated NAV to ₹${nav.toFixed(4)}`
        : `Linked "${schemeName}" [AMFI: ${schemeCode}]`;
      showToast(msg, 'success');
      return { success: true, message: msg, nav };
    } catch (err: any) {
      const errMsg = `Failed to link AMFI scheme: ${err?.message || 'Error'}`;
      showToast(errMsg, 'error');
      return { success: false, message: errMsg };
    } finally {
      setIsUpdatingNavs(false);
    }
  };

  // Update a single holding's CMP / NAV from AMFI or Yahoo Finance
  const updateSingleHoldingNav = async (holdingId: string, _schemeCodeOverride?: string) => {
    const res = await syncMarketPrices(true, holdingId);
    return { success: res.success, message: res.message, nav: undefined };
  };

  // Automatic daily SIP background check & Mutual Fund CMP auto-update
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const key = `sip_mf_last_check_${todayStr}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, 'checked');
      // Silent background SIP run
      executePendingSips({
        sips: sipSchedules,
        existingTransactions: (data.holdings || []).flatMap(
          (h: InvestmentHolding) => h.transactions || []
        ),
        holdings: data.holdings || [],
      })
        .then((res) => {
          if (res.executedSips.length > 0) {
            setData((prev: any) => {
              const map = new Map(res.executedSips.map((s) => [s.id, s]));
              const nextSips = (prev.sips || []).map((s: SipSchedule) => map.get(s.id) || s);
              const nextHoldings = (prev.holdings || []).map((h: InvestmentHolding) => {
                const txs = res.createdTransactions.filter((tx) => tx.holdingId === h.id);
                return txs.length > 0
                  ? recomputeHoldingFromLedger(h, [...(h.transactions || []), ...txs])
                  : h;
              });
              return {
                ...prev,
                sips: nextSips,
                holdings: nextHoldings,
                sipExecutions: [...res.executionRecords, ...(prev.sipExecutions || [])].slice(0, 50),
              };
            });
          }
        })
        .catch(() => {});

      // Silent background MF CMP auto-update using the same AMFI feed
      updateMutualFundsNavFromAmfi(data.holdings || [])
        .then((mfRes) => {
          if (mfRes.updatedCount > 0) {
            setData((prev: any) => ({
              ...prev,
              holdings: mfRes.updatedHoldings,
            }));
          }
        })
        .catch(() => {});
    }
  }, []);

  // Settings
  const updateSettings = (updates: Partial<AppSettings>) => {
    setData((prev: any) => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
    }));
    showToast('Preferences updated', 'info');
  };

  // Startup App Lock (Biometric / PIN)
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    try {
      const isLockConfigured = Boolean(data.settings?.isAppLockEnabled);
      if (!isLockConfigured) return false;
      const sessionUnlocked = sessionStorage.getItem('app_vault_unlocked');
      return sessionUnlocked !== 'true';
    } catch {
      return false;
    }
  });

  const unlockApp = (enteredPin?: string): boolean => {
    const requiredPin = data.settings?.appLockPin || '1234';
    if (!data.settings?.isAppLockEnabled) {
      setIsAppLocked(false);
      return true;
    }
    // If enteredPin is provided, verify against configured PIN
    if (enteredPin) {
      if (enteredPin === requiredPin) {
        try { sessionStorage.setItem('app_vault_unlocked', 'true'); } catch {}
        setIsAppLocked(false);
        showToast('Vault unlocked successfully', 'success');
        return true;
      }
      return false;
    }
    // Biometric instant unlock
    try { sessionStorage.setItem('app_vault_unlocked', 'true'); } catch {}
    setIsAppLocked(false);
    showToast('Vault unlocked via Biometrics', 'success');
    return true;
  };

  const lockApp = () => {
    try { sessionStorage.removeItem('app_vault_unlocked'); } catch {}
    setIsAppLocked(true);
    showToast('Vault locked', 'info');
  };

  const setAppLockConfig = (enabled: boolean, pin?: string, useBiometrics = true) => {
    updateSettings({
      isAppLockEnabled: enabled,
      appLockPin: pin !== undefined ? pin : (data.settings?.appLockPin || '1234'),
      useBiometricsIfAvailable: useBiometrics,
    });
    if (!enabled) {
      try { sessionStorage.removeItem('app_vault_unlocked'); } catch {}
      setIsAppLocked(false);
      showToast('Startup lock disabled (open access)', 'info');
    } else {
      try { sessionStorage.setItem('app_vault_unlocked', 'true'); } catch {}
      showToast('Startup lock enabled with PIN & Biometrics', 'success');
    }
  };

  const setTheme = (newTheme: AppTheme) => {
    updateSettings({ theme: newTheme });
    const label =
      newTheme === 'system'
        ? 'System theme (Auto)'
        : newTheme === 'dark'
        ? 'Dark Mode (OLED)'
        : 'Light Mode (Daylight)';
    showToast(`Applied ${label}`, 'info');
  };

  const toggleTheme = () => {
    // Toggle between light and dark based on the current resolved theme
    const nextTheme: AppTheme = isDark ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
    showToast(`Switched to ${nextTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}`, 'info');
  };

  // Feature Lock / Unlock System
  const isFeatureUnlocked = (featureId: AppFeatureId): boolean => {
    if (data.settings?.featureLocks && data.settings.featureLocks[featureId] === false) {
      return false;
    }
    return true;
  };

  const toggleFeatureLock = (featureId: AppFeatureId) => {
    const current = isFeatureUnlocked(featureId);
    const nextLocks = {
      ...(data.settings?.featureLocks || {}),
      [featureId]: !current,
    };
    updateSettings({ featureLocks: nextLocks });
    const nameMap: Record<AppFeatureId, string> = {
      expense_entry: 'Expense/Income Entry',
      analytics: 'Analytics',
      accounts: 'Bank Accounts',
      investments: 'Investments',
      debts: 'Debts',
      split_expenses: 'Split Expenses',
      recurring: 'Recurring Transactions',
    };
    showToast(
      !current
        ? `Unlocked "${nameMap[featureId] || featureId}" (visible)`
        : `Locked "${nameMap[featureId] || featureId}" (hidden from app)`,
      'info'
    );
  };

  const setFeatureLock = (featureId: AppFeatureId, unlocked: boolean) => {
    const nextLocks = {
      ...(data.settings?.featureLocks || {}),
      [featureId]: unlocked,
    };
    updateSettings({ featureLocks: nextLocks });
  };

  const unlockAllFeatures = () => {
    updateSettings({
      featureLocks: {
        expense_entry: true,
        analytics: true,
        accounts: true,
        investments: true,
        debts: true,
        split_expenses: true,
        recurring: true,
      },
    });
    showToast('All app features unlocked & visible', 'success');
  };

  // Recalculate all balances manually and purge abandoned transactions from deleted loans, holdings, debts, or accounts
  const recalculateAllBalances = () => {
    // 1. Gather all currently existing valid entity IDs
    const validAccountIds = new Set(data.accounts.map((a: Account) => a.id));
    const validLoanIds = new Set((data.loans || []).map((l: Loan) => l.id));
    const validHoldingIds = new Set((data.holdings || []).map((h: InvestmentHolding) => h.id));
    const validDebtIds = new Set((data.debts || []).map((d: Debt) => d.id));

    // Also collect names for heuristic orphan detection
    const validLoanNames = (data.loans || []).map((l: Loan) => l.name.trim().toLowerCase());
    const validHoldingSymbols = (data.holdings || []).map((h: InvestmentHolding) => h.symbol.trim().toLowerCase());

    // 2. Identify abandoned / orphaned transactions
    const abandonedTxIds = new Set<string>();

    data.transactions.forEach((tx: Transaction) => {
      // Rule A: Non-existent account references (fromAccountId must exist; transfer toAccountId must exist)
      if (!validAccountIds.has(tx.fromAccountId)) {
        abandonedTxIds.add(tx.id);
        return;
      }
      if (tx.type === 'transfer' && tx.toAccountId && !validAccountIds.has(tx.toAccountId)) {
        abandonedTxIds.add(tx.id);
        return;
      }

      // Rule B: Orphaned loan transaction (explicit loanId points to deleted loan)
      if (tx.loanId && !validLoanIds.has(tx.loanId)) {
        abandonedTxIds.add(tx.id);
        return;
      }

      // Rule C: Heuristic orphan loan transaction (tagged loan/emi/prepayment with no matching existing loan)
      const tags = (tx.tags || []).map((t) => t.toLowerCase());
      const noteLower = (tx.note || '').toLowerCase();
      const isLoanTagged = tags.includes('loan');
      const isEmiOrPrepay =
        tags.includes('emi') ||
        tags.includes('prepayment') ||
        noteLower.includes('emi') ||
        noteLower.includes('prepayment') ||
        noteLower.includes('interest component') ||
        noteLower.includes('principal repayment');

      if (isLoanTagged && isEmiOrPrepay) {
        const matchesAnyActiveLoan = validLoanNames.some(
          (name: string) => name && (noteLower.includes(name) || tags.includes(name))
        );
        if (!matchesAnyActiveLoan && validLoanNames.length > 0) {
          abandonedTxIds.add(tx.id);
          return;
        } else if (!matchesAnyActiveLoan && validLoanNames.length === 0) {
          // If 0 active loans exist in the database, all loan EMI/prepay transactions are abandoned
          abandonedTxIds.add(tx.id);
          return;
        }
      }

      // Rule D: Orphaned holding transaction (investmentId points to deleted holding)
      if (tx.investmentId && !validHoldingIds.has(tx.investmentId)) {
        abandonedTxIds.add(tx.id);
        return;
      }

      // Rule E: Orphaned debt transaction (debtId points to deleted debt contact)
      if (tx.debtId && !validDebtIds.has(tx.debtId)) {
        abandonedTxIds.add(tx.id);
        return;
      }

      // Rule F: Orphaned investment statutory taxes whose trade parent/holding was removed
      if (tx.categoryId === 'cat_investment_taxes') {
        const hasParent =
          tx.parentTransactionId &&
          data.transactions.some((t: Transaction) => t.id === tx.parentTransactionId && !abandonedTxIds.has(t.id));
        const hasHolding = tx.investmentId && validHoldingIds.has(tx.investmentId);
        const matchesHoldingSymbol = validHoldingSymbols.some((sym: string) => sym && noteLower.includes(sym));
        if (!hasParent && !hasHolding && !matchesHoldingSymbol) {
          abandonedTxIds.add(tx.id);
          return;
        }
      }
    });

    // Cascade: companion transactions whose parent is abandoned
    data.transactions.forEach((tx: Transaction) => {
      if (tx.parentTransactionId && abandonedTxIds.has(tx.parentTransactionId)) {
        abandonedTxIds.add(tx.id);
      }
    });

    const cleanTransactions = data.transactions.filter((tx: Transaction) => !abandonedTxIds.has(tx.id));

    // 3. Recompute holding ledgers from remaining transactions
    const recalculatedHoldings = (data.holdings || []).map((h: InvestmentHolding) =>
      h.transactions && h.transactions.length > 0
        ? recomputeHoldingFromLedger(h, h.transactions)
        : h
    );

    // 4. Recalculate all account balances from initial balances + clean transactions + holdings
    const recalculatedAccounts = recalculateBalances(data.accounts, cleanTransactions, recalculatedHoldings);

    // 5. Synchronize all active debt contact summaries strictly from clean transactions
    const recalculatedDebts = (data.debts || []).map((d: Debt) => {
      const summary = getDebtContactSummary(d, cleanTransactions);
      return {
        ...d,
        currentBalance: Math.abs(summary.netBalance),
        type: summary.netBalance >= 0 ? 'lent' : 'borrowed',
        status: Math.abs(summary.netBalance) <= 0.001 ? 'settled' : 'active',
      } as Debt;
    });

    // 6. Clean dangling transaction references in groupExpenses
    const cleanTxIdsSet = new Set(cleanTransactions.map((t: Transaction) => t.id));
    const cleanGroupExpenses = (data.groupExpenses || []).map((ge: GroupExpense) => ({
      ...ge,
      linkedPersonalTxId:
        ge.linkedPersonalTxId && cleanTxIdsSet.has(ge.linkedPersonalTxId) ? ge.linkedPersonalTxId : undefined,
      linkedDebtTxIds: (ge.linkedDebtTxIds || []).filter((id: string) => cleanTxIdsSet.has(id)),
    }));

    setData((prev: any) => ({
      ...prev,
      transactions: cleanTransactions,
      accounts: recalculatedAccounts,
      holdings: recalculatedHoldings,
      debts: recalculatedDebts,
      groupExpenses: cleanGroupExpenses,
    }));

    if (abandonedTxIds.size > 0) {
      showToast(
        `Recalculation complete: Purged ${abandonedTxIds.size} abandoned old transaction${abandonedTxIds.size === 1 ? '' : 's'} and resynchronized all passbooks & ledgers`,
        'success'
      );
    } else {
      showToast(
        'All passbook balances, investment portfolios, debts, and loan records successfully verified and recalculated from source',
        'success'
      );
    }
  };

  // Strict CSV Export
  const exportCSV = () => {
    try {
      const csvStr = exportToStrictCSV(data.transactions);
      const filename = `FinSync_Transactions_${toInputDate(new Date())}.csv`;
      fileService.exportAndShare({
        filename,
        content: csvStr,
        mimeType: 'text/csv;charset=utf-8;',
        title: 'FinSync Transactions Ledger',
        dialogTitle: 'Save or Share Transactions CSV',
      });
      showToast('Strict CSV exported successfully', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to export CSV', 'error');
    }
  };

  // Strict CSV Import
  const importCSVFile = async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const bulkActionId = `bulk_tx_${Date.now()}`;
      const result = parseStrictCSV(text, data.accounts, data.categories, bulkActionId);

      if (!result.success || !result.transactions) {
        showToast(result.errorMessage || 'Failed to parse CSV.', 'error');
        return false;
      }

      const mergedAccounts = [...data.accounts, ...(result.createdAccounts || [])];
      const mergedCategories = [...data.categories, ...(result.createdCategories || [])];
      const mergedTransactions = [...result.transactions, ...data.transactions];

      // Auto-recalculate all account balances chronologically from initial setup balance
      const recalculated = recalculateBalances(mergedAccounts, mergedTransactions);

      const bulkRecord: BulkAction = {
        id: bulkActionId,
        actionType: 'TRANSACTION_CSV',
        fileName: file.name,
        timestamp: Date.now(),
        totalRows: result.totalParsed || result.transactions.length,
        status: 'COMPLETED',
        importedTransactionIds: result.transactions.map((t) => t.id),
        affectedAccountIds: Array.from(new Set(result.transactions.map((t) => t.fromAccountId).filter(Boolean))),
        createdAt: new Date().toISOString(),
      };

      setData((prev: any) => ({
        ...prev,
        accounts: recalculated,
        categories: mergedCategories,
        transactions: mergedTransactions,
        bulkActions: [bulkRecord, ...(prev.bulkActions || [])],
      }));

      showToast(
        `Successfully imported ${result.totalParsed} transactions with automatic balance recalculation!`,
        'success'
      );
      return true;
    } catch (err: any) {
      console.error(err);
      showToast(`Error reading CSV: ${err.message || 'Corrupt file'}`, 'error');
      return false;
    }
  };

  // Safe Reversion of Bulk Actions
  const revertBulkAction = (bulkActionId: string): { success: boolean; message: string } => {
    const bulkAction = (data.bulkActions || []).find((b: BulkAction) => b.id === bulkActionId);
    if (!bulkAction) {
      showToast('Bulk action not found', 'error');
      return { success: false, message: 'Bulk action not found' };
    }
    if (bulkAction.status === 'REVERTED') {
      showToast('This bulk action has already been reverted', 'info');
      return { success: false, message: 'Already reverted' };
    }

    // 1. Remove transactions that have this bulkActionId
    const remainingTransactions = (data.transactions || []).filter(
      (tx: Transaction) => tx.bulkActionId !== bulkActionId
    );
    const removedTxsCount = (data.transactions || []).length - remainingTransactions.length;

    // 2. Remove/revert holdings and their ledger entries
    let removedHoldingTxsCount = 0;
    const nextHoldings = (data.holdings || [])
      .map((h: InvestmentHolding) => {
        const initialCount = (h.transactions || []).length;
        const remainingLedger = (h.transactions || []).filter(
          (t: InvestmentTransaction) => t.bulkActionId !== bulkActionId
        );
        removedHoldingTxsCount += initialCount - remainingLedger.length;

        // If the holding was created as part of this bulk action and now has 0 remaining transactions
        if (remainingLedger.length === 0 && h.bulkActionId === bulkActionId) {
          return null;
        }

        return recomputeHoldingFromLedger(h, remainingLedger);
      })
      .filter((h: InvestmentHolding | null): h is InvestmentHolding => h !== null);

    // 3. Recalculate account balances chronologically
    const recalculatedAccounts = recalculateBalances(data.accounts, remainingTransactions);

    // 4. Update bulk action status
    const nextBulkActions = (data.bulkActions || []).map((b: BulkAction) =>
      b.id === bulkActionId ? { ...b, status: 'REVERTED' as BulkActionStatus } : b
    );

    setData((prev: any) => ({
      ...prev,
      transactions: remainingTransactions,
      holdings: nextHoldings,
      accounts: recalculatedAccounts,
      bulkActions: nextBulkActions,
    }));

    const totalDeleted = removedTxsCount + removedHoldingTxsCount;
    const successMsg = `Successfully reverted "${bulkAction.fileName}": ${totalDeleted} record(s) removed and account balances adjusted.`;
    showToast(successMsg, 'success');
    return { success: true, message: successMsg };
  };

  const deleteBulkActionLog = (bulkActionId: string) => {
    setData((prev: any) => ({
      ...prev,
      bulkActions: (prev.bulkActions || []).filter((b: BulkAction) => b.id !== bulkActionId),
    }));
    showToast('Bulk action audit record removed from history', 'info');
  };

  const addBulkTransactions = (
    actionName: string,
    rawTxs: Array<{ date: string; amount: number; type: TransactionType; categoryId?: string; categoryName?: string; fromAccountId: string; toAccountId?: string; note?: string }>
  ) => {
    const bulkActionId = `bulk_tx_gen_${Date.now()}`;
    const newTxs: Transaction[] = rawTxs.map((r, i) => ({
      id: `tx_bulk_gen_${Date.now()}_${i}`,
      date: r.date,
      amount: r.amount,
      type: r.type,
      categoryId: r.categoryId,
      categoryName: r.categoryName || (r.type === 'transfer' ? 'Transfer' : 'General'),
      fromAccountId: r.fromAccountId,
      toAccountId: r.toAccountId,
      note: r.note || actionName,
      bulkActionId,
      createdAt: new Date().toISOString(),
    }));

    const nextTransactions = [...newTxs, ...data.transactions];
    const nextAccounts = recalculateBalances(data.accounts, nextTransactions);

    const bulkRecord: BulkAction = {
      id: bulkActionId,
      actionType: 'TRANSACTION_CSV',
      fileName: actionName,
      timestamp: Date.now(),
      totalRows: newTxs.length,
      status: 'COMPLETED',
      importedTransactionIds: newTxs.map((t) => t.id),
    };

    setData((prev: any) => ({
      ...prev,
      transactions: nextTransactions,
      accounts: nextAccounts,
      bulkActions: [bulkRecord, ...(prev.bulkActions || [])],
    }));

    showToast(`Successfully generated ${newTxs.length} bulk transactions`, 'success');
  };


  // App-Exclusive Encrypted Backup Engine (AES-256-GCM with User Account Multi-Wrapping)
  const exportEncryptedBackup = async (passphrase?: string): Promise<boolean> => {
    try {
      const encryptedStr = await encryptBackupData(data, {
        user: googleUser
          ? { uid: googleUser.uid, email: googleUser.email, displayName: googleUser.displayName }
          : null,
        customPassword: passphrase,
      });
      const dateStr = toInputDate(new Date());
      const fileName = `FinSync_Backup_${dateStr}.finsync.enc`;
      await fileService.exportAndShare({
        filename: fileName,
        content: encryptedStr,
        mimeType: 'application/octet-stream',
        title: 'FinSync Encrypted Vault Backup',
        dialogTitle: 'Save or Share FinSync Backup',
      });
      const accountMsg = googleUser?.email
        ? `Account-protected encrypted backup exported (.finsync.enc) for ${googleUser.email}`
        : 'App-locked encrypted backup exported (.finsync.enc)';
      showToast(accountMsg, 'success');
      return true;
    } catch (e: any) {
      console.warn('[ExportEncrypted]', e);
      showToast(e?.message || 'Failed to export encrypted backup', 'error');
      return false;
    }
  };

  const restoreEncryptedBackup = async (
    fileOrContent: File | string,
    passphrase?: string
  ): Promise<{ success: boolean; requiresPassword?: boolean; message?: string }> => {
    try {
      let rawContent: string;
      if (typeof fileOrContent === 'string') {
        rawContent = fileOrContent;
      } else {
        rawContent = await fileOrContent.text();
      }

      const decryptResult = await decryptBackupData(rawContent, {
        user: googleUser
          ? { uid: googleUser.uid, email: googleUser.email, displayName: googleUser.displayName }
          : null,
        password: passphrase,
      });

      if (!decryptResult.success || !decryptResult.data) {
        if (decryptResult.requiresPassword) {
          // Graceful prompt for password/account without throwing
          return {
            success: false,
            requiresPassword: true,
            message: decryptResult.message || 'Password, PIN, or Account login required to decrypt backup.',
          };
        }
        showToast(decryptResult.message || 'Failed to read backup file.', 'error');
        return {
          success: false,
          requiresPassword: false,
          message: decryptResult.message || 'Failed to read backup file.',
        };
      }

      const restored = decryptResult.data;
      
      // Ensure raw accounts list exists and has system debt account
      let rawAccounts: Account[] = Array.isArray(restored.accounts) ? restored.accounts : data.accounts;
      const hasDebtAccount = rawAccounts.some(
        (a: Account) => a.isSystemDebtAccount || a.id === SYSTEM_DEBT_ACCOUNT_ID || a.type === 'debt'
      );
      if (!hasDebtAccount) {
        rawAccounts = [...rawAccounts, DEFAULT_DEBT_ACCOUNT];
      }

      rawAccounts = rawAccounts.map((a: Account, idx: number) => ({
        ...a,
        order: a.order !== undefined ? a.order : idx,
      }));

      const rawTransactions = Array.isArray(restored.transactions) ? restored.transactions : [];
      const recalculated = recalculateBalances(rawAccounts, rawTransactions);
      const recalculatedHoldings = (restored.holdings || []).map((h: InvestmentHolding) =>
        h.transactions && h.transactions.length > 0
          ? recomputeHoldingFromLedger(h, h.transactions)
          : h
      );

      const fullData = {
        accounts: recalculated,
        categories: Array.isArray(restored.categories) && restored.categories.length > 0 ? restored.categories : data.categories,
        transactions: rawTransactions,
        holdings: recalculatedHoldings,
        debts: Array.isArray(restored.debts) ? restored.debts : [],
        recurring: Array.isArray(restored.recurring) ? restored.recurring : [],
        groups: Array.isArray(restored.groups) ? restored.groups : [],
        groupExpenses: Array.isArray(restored.groupExpenses) ? restored.groupExpenses : [],
        sips: Array.isArray(restored.sips) ? restored.sips : [],
        sipExecutions: Array.isArray(restored.sipExecutions) ? restored.sipExecutions : [],
        userProfile: restored.userProfile || data.userProfile,
        bin: Array.isArray(restored.bin) ? pruneExpiredBinItems(restored.bin) : (data.bin || []),
        accountAdjustments: Array.isArray(restored.accountAdjustments) ? restored.accountAdjustments : [],
        settings: {
          ...data.settings,
          ...(restored.settings || {}),
        },
      };

      setData(fullData);

      const unlockNote = decryptResult.unlockedVia === 'account'
        ? `Unlocked with account (${googleUser?.email || 'credentials'})`
        : 'Recalculated balances from source';

      showToast(`Encrypted backup verified & restored successfully! (${unlockNote})`, 'success');
      return { success: true };
    } catch (e: any) {
      console.warn('[BackupRestore]', e);
      const msg = e?.message || 'Failed to decrypt and restore backup file';
      showToast(msg, 'error');
      return { success: false, requiresPassword: false, message: msg };
    }
  };

  // User Authentication & Cloud Sync Actions
  const loginWithGoogle = async (): Promise<User | null> => {
    try {
      const { user } = await signInWithGoogle();
      setGoogleUser(user);
      showToast(`Signed in as ${user.email || 'Google User'}`, 'success');
      return user;
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      showToast(err?.message || 'Google sign-in cancelled or failed', 'error');
      return null;
    }
  };

  const loginWithEmail = async (email: string, pass: string): Promise<User | null> => {
    try {
      const user = await signInWithEmail(email, pass);
      setGoogleUser(user);
      showToast(`Signed in as ${user.email}`, 'success');
      return user;
    } catch (err: any) {
      console.warn('Email sign-in error:', err);
      showToast(err?.message || 'Email or password incorrect', 'error');
      return null;
    }
  };

  const registerWithEmail = async (email: string, pass: string, name?: string): Promise<User | null> => {
    try {
      const user = await signUpWithEmail(email, pass, name);
      setGoogleUser(user);
      showToast(`Account created for ${user.email}`, 'success');
      return user;
    } catch (err: any) {
      console.warn('Email registration error:', err);
      showToast(err?.message || 'Registration failed', 'error');
      return null;
    }
  };

  const logoutAccount = async () => {
    try {
      await signOutGoogle();
      setGoogleUser(null);
      showToast('Logged out of account', 'info');
    } catch (err: any) {
      console.warn('Logout error:', err);
      showToast('Failed to log out', 'error');
    }
  };

  const connectGoogleDrive = async () => {
    await loginWithGoogle();
  };

  const disconnectGoogleDrive = async () => {
    await logoutAccount();
  };

  const backupToGoogleDrive = async (passphrase?: string): Promise<DriveBackupFile> => {
    const token = getGoogleAccessToken();
    if (!token) {
      throw new Error('Google Drive is not connected. Please sign in with Google first.');
    }
    const encryptedContent = await encryptBackupData(data, {
      user: googleUser
        ? { uid: googleUser.uid, email: googleUser.email, displayName: googleUser.displayName }
        : null,
      customPassword: passphrase,
    });
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `FinSync_Cloud_${dateStr}.finsync.enc`;
    const res = await uploadEncryptedBackupToDrive(fileName, encryptedContent, token);
    showToast('Encrypted backup successfully uploaded to Google Drive!', 'success');
    return res;
  };

  const restoreFromGoogleDrive = async (fileId: string, passphrase?: string): Promise<boolean> => {
    const token = getGoogleAccessToken();
    if (!token) {
      throw new Error('Google Drive is not connected. Please sign in with Google first.');
    }
    const encryptedContent = await downloadDriveBackup(fileId, token);
    const res = await restoreEncryptedBackup(encryptedContent, passphrase);
    return res.success;
  };

  const listGoogleDriveBackups = async (): Promise<DriveBackupFile[]> => {
    const token = getGoogleAccessToken();
    if (!token) return [];
    return await listDriveBackups(token);
  };

  const deleteGoogleDriveBackup = async (fileId: string): Promise<void> => {
    const token = getGoogleAccessToken();
    if (!token) return;
    await deleteDriveBackup(fileId, token);
    showToast('Backup removed from Google Drive', 'info');
  };



  // Reset to sample scenario
  // Reset all state to sample Indian scenario
  const resetAllData = () => {
    const seed = getCalculatedSeedData();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    } catch (e) {
      console.error('Failed to sync sample state to localStorage', e);
    }
    storageWriter.scheduleSave(seed);
    setSelectedAccountId(null);
    setSelectedDebtId(null);
    setData(seed);
    showToast('Reset application to sample Indian scenario', 'info');
  };

  // Reset to clear zero state
  const resetToZeroData = () => {
    const zero = getZeroSeedData();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(zero));
    } catch (e) {
      console.error('Failed to sync zero state to localStorage', e);
    }
    storageWriter.scheduleSave(zero);
    setSelectedAccountId(null);
    setSelectedDebtId(null);
    setData(zero);
    showToast('Application cleared to zero slate', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        accounts: data.accounts,
        categories: data.categories,
        transactions: data.transactions,
        holdings: data.holdings,
        debts: data.debts,
        recurring: data.recurring,
        settings: data.settings,
        loans: data.loans || [],
        accountAdjustments: data.accountAdjustments || [],
        bulkActions: data.bulkActions || [],

        activeTab,
        setActiveTab,
        selectedAccountId,
        setSelectedAccountId,
        selectedHoldingId,
        setSelectedHoldingId,
        drilldownCategory,
        setDrilldownCategory,
        selectedDebtId,
        setSelectedDebtId,
        selectedGroupId,
        setSelectedGroupId,

        isTransactionModalOpen,
        setIsTransactionModalOpen,
        transactionModalInitialType,
        setTransactionModalInitialType,
        openTransactionModal,
        isSearchModalOpen,
        setIsSearchModalOpen,
        isDebtsModalOpen,
        setIsDebtsModalOpen,
        initialDebtCategoryTab,
        setInitialDebtCategoryTab,
        openSplitExpenses,
        openDebts,
        isRecurringModalOpen,
        setIsRecurringModalOpen,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
        settingsInitialTab,
        setSettingsInitialTab,
        openSettingsTab,
        isCustomizeModalOpen,
        setIsCustomizeModalOpen,
        isCategoriesModalOpen,
        setIsCategoriesModalOpen,
        isInvestmentCSVModalOpen,
        setIsInvestmentCSVModalOpen,
        isTradeModalOpen,
        setIsTradeModalOpen,
        tradeModalInitialType,
        tradeModalInitialHoldingId,
        tradeModalInitialAction,
        openTradeModal,
        isProfileModalOpen,
        setIsProfileModalOpen,
        isProfileHubOpen,
        setIsProfileHubOpen,
        isAllTransactionsModalOpen,
        setIsAllTransactionsModalOpen,
        allTransactionsTypeFilter,
        allTransactionsDateFilter,
        allTransactionsStartDate,
        allTransactionsEndDate,
        openAllTransactionsFiltered,
        isAnalysisExportModalOpen,
        setIsAnalysisExportModalOpen,
        analysisExportInitialScope,
        setAnalysisExportInitialScope,
        openAnalysisExportModal,
        isHtmlReportViewerOpen,
        setIsHtmlReportViewerOpen,
        htmlReportPayload,
        setHtmlReportPayload,
        openHtmlReportViewer,
        closeHtmlReportViewer,
        isLoansModalOpen,
        setIsLoansModalOpen,
        isExtendedToolsOpen,
        setIsExtendedToolsOpen,
        modalOpenedFromTools,
        markModalOpenedFromTools,
        clearModalOpenedFromTools,
        handleModalToolClosed,
        isNotificationsModalOpen,
        setIsNotificationsModalOpen,
        isNetWorthModalOpen,
        setIsNetWorthModalOpen,
        isBulkActionsModalOpen,
        setIsBulkActionsModalOpen,
        isBudgetModalOpen,
        setIsBudgetModalOpen,
        openBudgetModal,
        isCalendarModalOpen,
        setIsCalendarModalOpen,
        openCalendarModal,
        userProfile,
        updateUserProfile,


        addLoan,
        updateLoan,
        deleteLoan,
        payLoanEmi,
        prepayLoan,

        netLiquidWealth,
        getAccountPassbook,

        addTransaction,
        updateTransaction,
        deleteTransaction,

        addAccount,
        updateAccount,
        deleteAccount,
        reorderAccounts,
        archiveAccount,
        unarchiveAccount,
        reconcileAccountBalance,
        adjustAccountBalance,
        updateAccountAdjustment,
        deleteAccountAdjustment,
        getAccountAdjustments,
        payCreditCardBill,

        addCategory,
        updateCategory,
        deleteCategory,
        reorderCategories,

        addHolding,
        updateHolding,
        deleteHolding,
        addHoldingTransaction,
        addMultipleHoldingTransactions,
        updateHoldingTransaction,
        deleteHoldingTransaction,
        recordInvestmentAction,

        importStocksWithTransfers,
        importMutualFundsWithTransfers,
        exportStocksCSVData,
        exportMutualFundsCSVData,

        addDebt,
        updateDebt,
        deleteDebt,
        addDebtContact,
        recordDebtTransaction,
        deleteDebtRecord,

        groups: data.groups || [],
        groupExpenses: data.groupExpenses || [],
        addGroup,
        updateGroup,
        deleteGroup,
        addGroupExpense,
        updateGroupExpense,
        deleteGroupExpense,
        settleGroupDebt,
        importGroupExpenseFromClaim,

        addRecurring,
        updateRecurring,
        deleteRecurring,
        executeRecurringNow,
        upcoming24hRecurring,
        isRecurringAlreadyExecuted: checkIsRecurringExecuted,

        sipSchedules,
        sipExecutions,
        isSipManagerOpen,
        setIsSipManagerOpen,
        addSipSchedule,
        updateSipSchedule,
        deleteSipSchedule,
        deleteSipExecution,
        clearSipExecutions,
        toggleSipStatus,
        runSipWorkerNow,
        priceMetaMap,
        isSyncingPrices,
        syncMarketPrices,
        getHoldingMarketPrice,
        autoUpdateMutualFundsNav,
        updateSingleHoldingNav,
        linkHoldingAmfiScheme,
        isUpdatingNavs: isSyncingPrices || isUpdatingNavs,

        updateSettings,
        theme: themePreference,
        resolvedTheme,
        isDark,
        setTheme,
        toggleTheme,

        isFeatureUnlocked,
        toggleFeatureLock,
        setFeatureLock,
        unlockAllFeatures,

        exportCSV,
        importCSVFile,
        revertBulkAction,
        deleteBulkActionLog,
        addBulkTransactions,
        exportEncryptedBackup,
        restoreEncryptedBackup,
        isBackupModalOpen,
        setIsBackupModalOpen,

        googleUser,
        isGoogleDriveConnected: Boolean(googleUser),
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logoutAccount,
        connectGoogleDrive,
        disconnectGoogleDrive,
        backupToGoogleDrive,
        restoreFromGoogleDrive,
        listGoogleDriveBackups,
        deleteGoogleDriveBackup,

        recalculateAllBalances,
        resetAllData,
        resetToZeroData,

        isAppLocked,
        unlockApp,
        lockApp,
        setAppLockConfig,

        toasts,
        showToast,
        dismissToast,

        // 30-Day Recycle Bin System
        bin: data.bin || [],
        restoreFromBin,
        deletePermanentlyFromBin,
        emptyBin,
        restoreAllFromBin,
        isBinOpen,
        setIsBinOpen,
        openBin,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
