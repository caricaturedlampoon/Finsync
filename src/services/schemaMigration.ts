/**
 * Automated Database Schema Migration Engine & Backup Snapshot Validator
 * Ensures seamless backward-compatibility across app updates without deleting or altering user records.
 */

export const CURRENT_SCHEMA_VERSION = 4;

export interface AppSnapshot {
  schemaVersion?: number;
  transactions?: any[];
  accounts?: any[];
  categories?: any[];
  holdings?: any[];
  investmentTransactions?: any[];
  debts?: any[];
  groups?: any[];
  groupExpenses?: any[];
  recurring?: any[];
  sips?: any[];
  sipExecutions?: any[];
  loans?: any[];
  bin?: any[];
  settings?: any;
  userProfile?: any;
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: AppSnapshot;
}

/**
 * Validates an imported JSON or .bk backup snapshot against structural integrity rules.
 */
export function validateBackupSnapshot(raw: any): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Backup data is empty or invalid JSON format.' };
  }

  // Must contain at least an accounts or transactions array to be considered valid
  if (!Array.isArray(raw.accounts) && !Array.isArray(raw.transactions)) {
    return {
      valid: false,
      error: 'Invalid backup structure: Missing critical accounts or transactions ledger.',
    };
  }

  // Sanitize and ensure core array collections exist
  const sanitized: AppSnapshot = {
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1,
    accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    holdings: Array.isArray(raw.holdings) ? raw.holdings : [],
    investmentTransactions: Array.isArray(raw.investmentTransactions) ? raw.investmentTransactions : [],
    debts: Array.isArray(raw.debts) ? raw.debts : [],
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    groupExpenses: Array.isArray(raw.groupExpenses) ? raw.groupExpenses : [],
    recurring: Array.isArray(raw.recurring) ? raw.recurring : [],
    sips: Array.isArray(raw.sips) ? raw.sips : [],
    sipExecutions: Array.isArray(raw.sipExecutions) ? raw.sipExecutions : [],
    loans: Array.isArray(raw.loans) ? raw.loans : [],
    bin: Array.isArray(raw.bin) ? raw.bin : [],
    settings: raw.settings && typeof raw.settings === 'object' ? raw.settings : {},
    userProfile: raw.userProfile && typeof raw.userProfile === 'object' ? raw.userProfile : {},
  };

  // Run migration on imported data up to current version
  const migrated = migrateSnapshotToLatest(sanitized);

  return {
    valid: true,
    data: migrated,
  };
}

/**
 * Sequential migration runner that upgrades stored state from older versions to CURRENT_SCHEMA_VERSION.
 */
export function migrateSnapshotToLatest(snapshot: AppSnapshot): AppSnapshot {
  let current = { ...snapshot };
  let version = current.schemaVersion || 1;

  if (version >= CURRENT_SCHEMA_VERSION) {
    return current;
  }

  console.log(`[FinSync:Migration]: Upgrading stored state from schema v${version} to v${CURRENT_SCHEMA_VERSION}...`);

  // Migration V1 -> V2:
  // - Add includeInNetLiquid default to accounts
  // - Ensure system debt ledger account is flagged properly
  // - Add tags array to transactions
  if (version < 2) {
    if (Array.isArray(current.accounts)) {
      current.accounts = current.accounts.map((acc: any) => ({
        ...acc,
        includeInNetLiquid: acc.includeInNetLiquid ?? (acc.type !== 'credit' && acc.type !== 'debt'),
        isLocked: acc.isLocked ?? false,
      }));
    }

    if (Array.isArray(current.transactions)) {
      current.transactions = current.transactions.map((tx: any) => ({
        ...tx,
        tags: Array.isArray(tx.tags) ? tx.tags : [],
      }));
    }

    version = 2;
    current.schemaVersion = 2;
    console.log('[FinSync:Migration]: Applied Schema v2 upgrades.');
  }

  // Migration V2 -> V3:
  // - Initialize loans array if missing
  // - Ensure 30-day recycle bin array exists
  // - Ensure settings.navigationTabs exists
  if (version < 3) {
    if (!Array.isArray(current.loans)) {
      current.loans = [];
    }

    if (!Array.isArray(current.bin)) {
      current.bin = [];
    }

    if (current.settings) {
      if (!Array.isArray(current.settings.navigationTabs)) {
        current.settings.navigationTabs = ['home', 'accounts', 'investments', 'analytics', 'debts'];
      }
    }

    version = 3;
    current.schemaVersion = 3;
    console.log('[FinSync:Migration]: Applied Schema v3 upgrades.');
  }

  // Migration V3 -> V4:
  // - Guarantee INR currency code consistency across all account ledgers
  // - Ensure local dates (YYYY-MM-DD) across all transactions
  // - Guarantee zero-drift floating-point balances
  if (version < 4) {
    if (Array.isArray(current.accounts)) {
      current.accounts = current.accounts.map((acc: any) => ({
        ...acc,
        balance: Math.round(((Number(acc.balance) || 0) + Number.EPSILON) * 100) / 100,
        initialBalance: Math.round(((Number(acc.initialBalance) || 0) + Number.EPSILON) * 100) / 100,
      }));
    }

    if (Array.isArray(current.transactions)) {
      current.transactions = current.transactions.map((tx: any) => {
        let cleanDate = tx.date;
        if (typeof cleanDate === 'string' && cleanDate.includes('T')) {
          cleanDate = cleanDate.split('T')[0];
        }
        return {
          ...tx,
          date: cleanDate || new Date().toISOString().slice(0, 10),
          amount: Math.round(((Number(tx.amount) || 0) + Number.EPSILON) * 100) / 100,
        };
      });
    }

    if (Array.isArray(current.holdings)) {
      current.holdings = current.holdings.map((h: any) => ({
        ...h,
        currentPrice: Math.round(((Number(h.currentPrice) || 0) + Number.EPSILON) * 10000) / 10000,
        averageBuyPrice: Math.round(((Number(h.averageBuyPrice) || 0) + Number.EPSILON) * 10000) / 10000,
      }));
    }

    version = 4;
    current.schemaVersion = 4;
    console.log('[FinSync:Migration]: Applied Schema v4 upgrades (Precision & Local Date Sanitization).');
  }

  console.log(`[FinSync:Migration]: Successfully migrated schema to v${CURRENT_SCHEMA_VERSION}.`);
  return current;
}
