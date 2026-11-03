import { Account, Category, Transaction, TransactionType, InvestmentHolding } from '../types';
import { formatDateTimeHHMM, extractTimeHHMM, parseDate, toInputDate } from './formatters';

export const STRICT_CSV_HEADERS = [
  'Date',
  'Category',
  'Amount',
  'Note',
  'Type',
  'Payment mode',
  'To payment Mode',
  'Tags',
] as const;

export interface CSVParseResult {
  success: boolean;
  transactions?: Transaction[];
  createdAccounts?: Account[];
  createdCategories?: Category[];
  errorMessage?: string;
  totalParsed?: number;
}

/**
 * Escape a CSV field value
 */
function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate CSV string adhering strictly to the schema (Date column includes DD/MM/YYYY HH:MM)
 */
export function exportToStrictCSV(transactions: Transaction[]): string {
  const headerLine = STRICT_CSV_HEADERS.join(',');
  const rows = transactions.map((t) => {
    // Format date as DD/MM/YYYY HH:MM strictly in the Date column
    const dateFormatted = formatDateTimeHHMM(t.date, t.time, t.createdAt);
    const category = t.categoryName || 'General';
    const amount = Number(t.amount).toFixed(2);
    const note = t.note || '';
    // Capitalize Type (Expense, Income, Transfer)
    const type = t.type.charAt(0).toUpperCase() + t.type.slice(1);
    const paymentMode = t.fromAccountName || 'Cash';
    const toPaymentMode = t.type === 'transfer' ? (t.toAccountName || '') : '';
    const tags = Array.isArray(t.tags) ? t.tags.join(';') : '';

    return [
      escapeCSV(dateFormatted),
      escapeCSV(category),
      escapeCSV(amount),
      escapeCSV(note),
      escapeCSV(type),
      escapeCSV(paymentMode),
      escapeCSV(toPaymentMode),
      escapeCSV(tags),
    ].join(',');
  });

  return [headerLine, ...rows].join('\n');
}

/**
 * Parse a standard CSV line taking quotes into account
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse and validate strict CSV content
 */
export function parseStrictCSV(
  csvContent: string,
  existingAccounts: Account[],
  existingCategories: Category[],
  bulkActionId?: string
): CSVParseResult {
  const cleanContent = csvContent.replace(/^\uFEFF/, '').trim();
  if (!cleanContent) {
    return { success: false, errorMessage: 'The CSV file is empty.' };
  }

  const lines = cleanContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 1) {
    return { success: false, errorMessage: 'The CSV file has no content.' };
  }

  // Validate Header Row
  const rawHeader = parseCSVLine(lines[0]);
  const normalizedHeader = rawHeader.map((h) => h.trim().toLowerCase());
  const expectedHeader = STRICT_CSV_HEADERS.map((h) => h.toLowerCase());

  // Check that all required headers exist
  const missingHeaders: string[] = [];
  for (let i = 0; i < STRICT_CSV_HEADERS.length; i++) {
    const expected = expectedHeader[i];
    if (!normalizedHeader.includes(expected)) {
      missingHeaders.push(STRICT_CSV_HEADERS[i]);
    }
  }

  if (missingHeaders.length > 0) {
    return {
      success: false,
      errorMessage: `Strict CSV header mismatch. Missing required columns: ${missingHeaders.join(', ')}. Expected: ${STRICT_CSV_HEADERS.join(', ')}`,
    };
  }

  // Create header index lookup
  const colIndex: { [key: string]: number } = {};
  STRICT_CSV_HEADERS.forEach((h) => {
    colIndex[h] = normalizedHeader.indexOf(h.toLowerCase());
  });

  const parsedTransactions: Transaction[] = [];
  const accountsMap = new Map<string, Account>();
  const categoriesMap = new Map<string, Category>();

  existingAccounts.forEach((acc) => accountsMap.set(acc.name.toLowerCase(), acc));
  existingCategories.forEach((cat) => categoriesMap.set(cat.name.toLowerCase(), cat));

  const newlyCreatedAccounts: Account[] = [];
  const newlyCreatedCategories: Category[] = [];

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const line = lines[rowIdx];
    if (!line.trim()) continue;

    const cols = parseCSVLine(line);
    const dateStr = cols[colIndex['Date']] || '';
    const catStr = cols[colIndex['Category']] || 'General';
    const amountStr = cols[colIndex['Amount']] || '0';
    const noteStr = cols[colIndex['Note']] || '';
    const typeRaw = (cols[colIndex['Type']] || 'Expense').toLowerCase();
    const payModeStr = cols[colIndex['Payment mode']] || 'Cash';
    const toPayModeStr = cols[colIndex['To payment Mode']] || '';
    const tagsStr = cols[colIndex['Tags']] || '';

    // Validate Date and extract Time (HH:MM)
    const parsedDate = parseDate(dateStr);
    if (isNaN(parsedDate.getTime())) {
      return {
        success: false,
        errorMessage: `Row ${rowIdx + 1}: Invalid date format "${dateStr}". Expected DD/MM/YYYY HH:MM or DD/MM/YYYY.`,
      };
    }
    const isoDate = toInputDate(parsedDate);
    const timeHHMM = extractTimeHHMM(dateStr, parsedDate.toISOString());

    // Validate Amount
    const cleanAmount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      return {
        success: false,
        errorMessage: `Row ${rowIdx + 1}: Invalid amount "${amountStr}". Amount must be a positive number.`,
      };
    }

    // Validate Type
    let transType: TransactionType = 'expense';
    if (typeRaw.includes('income')) {
      transType = 'income';
    } else if (typeRaw.includes('transfer')) {
      transType = 'transfer';
    } else if (typeRaw.includes('expense')) {
      transType = 'expense';
    } else {
      return {
        success: false,
        errorMessage: `Row ${rowIdx + 1}: Invalid transaction type "${cols[colIndex['Type']] || ''}". Must be Expense, Income, or Transfer.`,
      };
    }

    // Ensure 'from' account exists
    let fromAcc = accountsMap.get(payModeStr.toLowerCase());
    if (!fromAcc) {
      fromAcc = {
        id: `acc_csv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: payModeStr,
        type: payModeStr.toLowerCase().includes('card') ? 'credit' : 'bank',
        initialBalance: 0,
        balance: 0,
        icon: 'Landmark',
        color: '#2563eb',
        includeInNetLiquid: true,
        createdAt: new Date().toISOString(),
      };
      accountsMap.set(payModeStr.toLowerCase(), fromAcc);
      newlyCreatedAccounts.push(fromAcc);
    }

    // Ensure 'to' account exists for transfer
    let toAcc: Account | undefined = undefined;
    if (transType === 'transfer' && toPayModeStr) {
      toAcc = accountsMap.get(toPayModeStr.toLowerCase());
      if (!toAcc) {
        toAcc = {
          id: `acc_csv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: toPayModeStr,
          type: 'bank',
          initialBalance: 0,
          balance: 0,
          icon: 'Landmark',
          color: '#059669',
          includeInNetLiquid: true,
          createdAt: new Date().toISOString(),
        };
        accountsMap.set(toPayModeStr.toLowerCase(), toAcc);
        newlyCreatedAccounts.push(toAcc);
      }
    }

    // Ensure Category exists
    let cat = categoriesMap.get(catStr.toLowerCase());
    if (!cat) {
      cat = {
        id: `cat_csv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: catStr,
        type: transType === 'income' ? 'income' : 'expense',
        icon: 'Tag',
        color: transType === 'income' ? '#059669' : '#dc2626',
      };
      categoriesMap.set(catStr.toLowerCase(), cat);
      newlyCreatedCategories.push(cat);
    }

    const tags = tagsStr
      ? tagsStr
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const transaction: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      date: isoDate,
      time: timeHHMM,
      amount: cleanAmount,
      type: transType,
      categoryId: cat.id,
      categoryName: cat.name,
      fromAccountId: fromAcc.id,
      fromAccountName: fromAcc.name,
      toAccountId: toAcc ? toAcc.id : undefined,
      toAccountName: toAcc ? toAcc.name : undefined,
      note: noteStr,
      tags,
      bulkActionId,
      createdAt: parsedDate.toISOString(),
    };

    parsedTransactions.push(transaction);
  }

  return {
    success: true,
    transactions: parsedTransactions,
    createdAccounts: newlyCreatedAccounts,
    createdCategories: newlyCreatedCategories,
    totalParsed: parsedTransactions.length,
  };
}

/**
 * Auto-recalculates all account balances chronologically from initial balance,
 * taking into account transactions and investment holding market valuations for Demat accounts.
 */
export function recalculateBalances(
  accounts: Account[],
  transactions: Transaction[],
  holdings?: InvestmentHolding[]
): Account[] {
  // Map of account ID to cash ledger balance
  const balanceMap = new Map<string, number>();

  accounts.forEach((acc) => {
    balanceMap.set(acc.id, acc.initialBalance || 0);
  });

  // Linear single-pass accumulation (addition/subtraction is commutative, no sort needed)
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (tx.isBalanceAdjustment) {
      const targetId = tx.fromAccountId;
      if (targetId) {
        const current = balanceMap.get(targetId) ?? 0;
        if (tx.type === 'income') {
          balanceMap.set(targetId, current + tx.amount);
        } else {
          balanceMap.set(targetId, current - tx.amount);
        }
      }
    } else if (tx.type === 'expense') {
      const current = balanceMap.get(tx.fromAccountId) ?? 0;
      balanceMap.set(tx.fromAccountId, current - tx.amount);
    } else if (tx.type === 'income') {
      const targetId = tx.fromAccountId || tx.toAccountId;
      if (targetId) {
        const current = balanceMap.get(targetId) ?? 0;
        balanceMap.set(targetId, current + tx.amount);
      }
    } else if (tx.type === 'transfer') {
      if (tx.fromAccountId && tx.toAccountId && tx.fromAccountId === tx.toAccountId) {
        // self-transfer: net 0
      } else {
        if (tx.fromAccountId) {
          const fromBal = balanceMap.get(tx.fromAccountId) ?? 0;
          balanceMap.set(tx.fromAccountId, fromBal - tx.amount);
        }
        if (tx.toAccountId) {
          const toBal = balanceMap.get(tx.toAccountId) ?? 0;
          balanceMap.set(tx.toAccountId, toBal + tx.amount);
        }
      }
    }
  }

  // Calculate holdings metrics for Demat accounts
  const dematHoldingsMap = new Map<string, { marketValue: number; costBasis: number; count: number }>();
  if (holdings && holdings.length > 0) {
    for (const h of holdings) {
      if (!h.dematAccountId || h.quantity <= 0) continue;
      const current = dematHoldingsMap.get(h.dematAccountId) || { marketValue: 0, costBasis: 0, count: 0 };
      const mVal = h.quantity * (h.currentPrice || h.averageBuyPrice);
      const cBasis = h.quantity * h.averageBuyPrice;
      dematHoldingsMap.set(h.dematAccountId, {
        marketValue: current.marketValue + mVal,
        costBasis: current.costBasis + cBasis,
        count: current.count + 1,
      });
    }
  }

  return accounts.map((acc) => {
    let finalBal = balanceMap.get(acc.id) ?? acc.initialBalance ?? 0;

    // For Demat accounts: the balance of the funded account reflects investment market values
    if (acc.type === 'demat') {
      const hData = dematHoldingsMap.get(acc.id);
      if (hData && hData.count > 0) {
        const unrealizedPnL = hData.marketValue - hData.costBasis;
        if (finalBal >= hData.costBasis) {
          // Normal case: user transferred funds into demat and bought holdings
          finalBal = finalBal + unrealizedPnL;
        } else {
          // Directly created holdings or partial transfers: reflect full holdings market value + uninvested cash
          const uninvestedCash = Math.max(0, finalBal);
          finalBal = uninvestedCash + hData.marketValue;
        }
      }
    }

    return {
      ...acc,
      balance: Number(finalBal.toFixed(2)),
    };
  });
}
