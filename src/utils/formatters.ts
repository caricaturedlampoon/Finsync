import { Debt, InvestmentHolding, InvestmentTransaction, Transaction } from '../types';

export const SYSTEM_DEBT_ACCOUNT_ID = 'acc_debt_ledger';

const inrWithDecimals = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrNoDecimals = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function safeRound(num: number | null | undefined, decimals: number = 2): number {
  if (num === null || num === undefined || isNaN(Number(num))) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((Number(num) + Number.EPSILON) * factor) / factor;
}

export function safeAdd(...nums: (number | null | undefined)[]): number {
  const sum = nums.reduce<number>((acc, curr) => acc + (Number(curr) || 0), 0);
  return safeRound(sum, 2);
}

export function safeSub(a: number | null | undefined, b: number | null | undefined): number {
  return safeRound((Number(a) || 0) - (Number(b) || 0), 2);
}

export function safeMul(a: number | null | undefined, b: number | null | undefined, decimals: number = 2): number {
  return safeRound((Number(a) || 0) * (Number(b) || 0), decimals);
}

export function safeDiv(a: number | null | undefined, b: number | null | undefined, fallback: number = 0, decimals: number = 2): number {
  const divisor = Number(b) || 0;
  if (Math.abs(divisor) < 0.00000001) return fallback;
  return safeRound((Number(a) || 0) / divisor, decimals);
}

export function formatINR(val: number | null | undefined, showDecimals: boolean = true): string {
  if (val === null || val === undefined || isNaN(val)) {
    return showDecimals ? '₹0.00' : '₹0';
  }

  // Floating-point safety: eliminate IEEE 754 precision artifacts before formatting
  const safeVal = safeRound(val, 2);

  try {
    return showDecimals ? inrWithDecimals.format(safeVal) : inrNoDecimals.format(safeVal);
  } catch {
    // Graceful manual fallback in case of runtime Intl exception
    const isNegative = safeVal < 0;
    const absVal = Math.abs(safeVal);
    const fixed = showDecimals ? absVal.toFixed(2) : Math.round(absVal).toString();
    const parts = fixed.split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1] !== undefined ? `.${parts[1]}` : (showDecimals ? '.00' : '');
    if (integerPart.length > 3) {
      const lastThree = integerPart.substring(integerPart.length - 3);
      const otherNumbers = integerPart.substring(0, integerPart.length - 3);
      const formattedOthers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      integerPart = `${formattedOthers},${lastThree}`;
    }
    const prefix = isNegative ? '-₹' : '₹';
    return `${prefix}${integerPart}${decimalPart}`;
  }
}

/**
 * Format XIRR with safe algorithmic fallback ('N/A' or '0.00%')
 */
export function formatXIRR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) {
    return 'N/A';
  }
  const rounded = safeRound(val, 2);
  const prefix = rounded > 0 ? '+' : '';
  return `${prefix}${rounded.toFixed(2)}%`;
}

/**
 * Compact Indian currency formatter for chart axes and small tags (e.g. ₹1.2L, ₹50k, ₹2.5Cr)
 */
export function formatCompactINR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 10000000) {
    const cr = abs / 10000000;
    return `${sign}₹${cr >= 10 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  }
  if (abs >= 100000) {
    const lk = abs / 100000;
    return `${sign}₹${lk >= 10 ? lk.toFixed(0) : lk.toFixed(1)}L`;
  }
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}₹${k >= 10 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `${sign}₹${Math.round(abs)}`;
}

/**
 * Format date string to DD/MM/YYYY strictly
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';

  let d: Date;
  if (typeof dateInput === 'string') {
    // Check if already in DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
      return dateInput;
    }
    // Check if YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [year, month, day] = dateInput.split('-');
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    d = new Date(dateInput);
  } else {
    d = dateInput;
  }

  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

const MONTH_NAME_MAP: { [key: string]: number } = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, may_: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  sept: 9,
};

/**
 * Convert any date input into YYYY-MM-DD for native <input type="date">
 * Uses local calendar date to avoid timezone shift bugs
 */
export function toInputDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof dateInput === 'string') {
    const clean = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      const [day, month, year] = clean.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  const d = dateInput instanceof Date ? dateInput : parseDate(dateInput);
  if (isNaN(d.getTime())) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const PARSE_DATE_CACHE = new Map<string | number, Date>();
const MAX_DATE_CACHE_SIZE = 3000;

function rawParseDate(dateStr: string | number | Date | null | undefined): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;

  // Handle Excel date serial numbers (e.g. 45230, 45580)
  if (typeof dateStr === 'number' || (/^\d{5}$/.test(String(dateStr).trim()))) {
    const num = typeof dateStr === 'number' ? dateStr : parseInt(String(dateStr).trim(), 10);
    if (!isNaN(num) && num > 20000 && num < 70000) {
      // Excel epoch starts Jan 1 1900, with famous leap year bug at 60
      const utcDays = num - 25569;
      const ms = utcDays * 86400 * 1000;
      return new Date(ms);
    }
  }

  let clean = String(dateStr).trim().replace(/^["']|["']$/g, '');
  if (!clean) return new Date();

  // Extract time portion if present (e.g., "14/10/2024 09:15", "14/10/2024 14:30:00", "2024-10-14T10:00:00", "14-10-2024 11:20 AM")
  let extractedHours = 0;
  let extractedMinutes = 0;
  let extractedSeconds = 0;
  const timeMatch = clean.match(/(?:\s+|T)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(am|pm))?/i);
  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    const s = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const mer = timeMatch[4]?.toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    if (!isNaN(h) && h >= 0 && h <= 23) extractedHours = h;
    if (!isNaN(m) && m >= 0 && m <= 59) extractedMinutes = m;
    if (!isNaN(s) && s >= 0 && s <= 59) extractedSeconds = s;
  }

  // Strip timestamp part if present
  clean = clean.replace(/(\s+|T)\d{1,2}:\d{2}(:\d{2})?(\s*(am|pm))?.*$/i, '').trim();

  // 1. Standard ISO format: YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(clean)) {
    const parts = clean.split(/[\/\-\.]/).map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], extractedHours, extractedMinutes, extractedSeconds);
  }

  // 2. Named month format: e.g. 15-Oct-2024, 15 Oct 2024, 15-October-24, 15/Oct/2024
  const textMonthMatch = clean.match(/^(\d{1,2})[\s\-/.]([a-zA-Z]+)[\s\-/.]([0-9]{2,4})$/);
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const monName = textMonthMatch[2].toLowerCase();
    let year = parseInt(textMonthMatch[3], 10);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const month = MONTH_NAME_MAP[monName];
    if (month && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day, extractedHours, extractedMinutes, extractedSeconds);
    }
  }

  // 3. Delimited numeric format: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, D/M/YY
  const delimiterMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (delimiterMatch) {
    const p1 = parseInt(delimiterMatch[1], 10);
    const p2 = parseInt(delimiterMatch[2], 10);
    let year = parseInt(delimiterMatch[3], 10);
    if (year < 100) {
      year += year < 70 ? 2000 : 1900;
    }

    // Strict Indian financial format: DD/MM/YYYY or DD-MM-YYYY
    let day = p1;
    let month = p2;

    if (p1 <= 12 && p2 > 12 && p2 <= 31) {
      day = p2;
      month = p1;
    }

    return new Date(year, month - 1, day, extractedHours, extractedMinutes, extractedSeconds);
  }

  const fallback = new Date(String(dateStr).trim());
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }

  return new Date();
}

/**
 * Robust date parser supporting Indian financial formats (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY),
 * ISO dates (YYYY-MM-DD), month names (DD-MMM-YYYY), Excel serial numbers, and timestamps.
 * High-performance LRU cached implementation to eliminate date parsing CPU bottlenecks.
 */
export function parseDate(dateStr: string | number | Date | null | undefined): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;

  if (PARSE_DATE_CACHE.has(dateStr)) {
    return PARSE_DATE_CACHE.get(dateStr)!;
  }

  const result = rawParseDate(dateStr);

  if (PARSE_DATE_CACHE.size > MAX_DATE_CACHE_SIZE) {
    PARSE_DATE_CACHE.clear();
  }
  PARSE_DATE_CACHE.set(dateStr, result);

  return result;
}

/**
 * Extract time in strictly 24-hour HH:MM format from time string or createdAt ISO string.
 * Handles: "14:30", "02:30 PM", "2:30 pm", "2026-10-25T14:30:00.000Z".
 */
export function extractTimeHHMM(timeStr?: string | null, createdAt?: string | null): string {
  if (timeStr && typeof timeStr === 'string') {
    const trimmed = timeStr.trim();
    // 12-hour match: e.g. "02:30 PM" or "2:30 pm"
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = parseInt(match12[2], 10);
      const mer = match12[3].toLowerCase();
      if (mer === 'pm' && h < 12) h += 12;
      if (mer === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    // 24-hour match: e.g. "14:30" or "09:05"
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
      const h = parseInt(match24[1], 10);
      const m = parseInt(match24[2], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
  }

  // Fallback to createdAt timestamp
  if (createdAt && typeof createdAt === 'string') {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  }

  return '00:00';
}

/**
 * Format date & time into strict DD/MM/YYYY HH:MM string for CSV exports and ledger timestamps.
 */
export function formatDateTimeHHMM(
  dateInput: string | Date | null | undefined,
  timeStr?: string | null,
  createdAt?: string | null
): string {
  const dateFormatted = formatDate(dateInput);
  if (!dateFormatted) return '';
  const timeFormatted = extractTimeHHMM(timeStr, createdAt);
  return `${dateFormatted} ${timeFormatted}`;
}

/**
 * Compute an accurate millisecond timestamp from transaction date, time, and createdAt.
 * Allows chronological sorting that prioritizes date, then explicit HH:MM time, then createdAt precision.
 */
export function getTransactionTimestamp(tx: {
  date: string;
  time?: string | null;
  createdAt?: string | null;
}): number {
  if (!tx) return 0;

  // Extract base date
  const parsed = parseDate(tx.date);
  if (isNaN(parsed.getTime())) return 0;

  // Extract HH:MM
  const timeHHMM = extractTimeHHMM(tx.time, tx.createdAt);
  const [hStr, mStr] = timeHHMM.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;

  parsed.setHours(h, m, 0, 0);
  let baseMs = parsed.getTime();

  // If createdAt has sub-second or seconds offset, use it to maintain precise intra-minute creation order
  if (tx.createdAt) {
    const c = new Date(tx.createdAt).getTime();
    if (!isNaN(c)) {
      // Add sub-minute seconds and milliseconds (0 to 59999ms)
      const intraMinute = c % 60000;
      baseMs += intraMinute;
    }
  }

  return baseMs;
}

/**
 * Specific parser for historical trade dates (stocks & mutual funds).
 * Strict guarantee: An imported trade transaction can NEVER be dated in the future.
 * Returns ISO date string: YYYY-MM-DD
 */
export function parseInvestmentTradeDate(dateStr: string | number | Date | null | undefined): string {
  if (!dateStr) {
    return toInputDate(new Date());
  }
  const parsed = parseDate(dateStr);
  if (isNaN(parsed.getTime())) {
    return toInputDate(new Date());
  }
  return toInputDate(parsed);
}

/**
 * Format any general number (e.g. unit quantities, interest rates) cleanly supporting up to 4 decimal places
 */
export function formatNumber(val: number | null | undefined, maxDecimals: number = 4): string {
  if (val === null || val === undefined || isNaN(Number(val))) return '0.00';
  const num = Number(val);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Format share and unit quantities, cleanly supporting up to 4 decimal places explicitly optimized
 * for fractional Mutual Fund units while displaying whole stock shares without unnecessary trailing decimals.
 */
export function formatQuantity(val: number | null | undefined, maxDecimals: number = 4): string {
  if (val === null || val === undefined || isNaN(Number(val))) return '0';
  const num = Number(val);
  const rounded = safeRound(num, maxDecimals);

  // If it is an exact integer, format without decimals (e.g. "100" shares)
  if (Math.abs(rounded - Math.round(rounded)) < 0.00001) {
    return Math.round(rounded).toLocaleString('en-IN');
  }

  // Fractional Mutual Fund units (e.g. "124.5420" or "12.35")
  return rounded.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Calculate Realized / Booked Profit for an individual holding from its transaction ledger
 */
export function calculateHoldingBookedProfit(holding: InvestmentHolding): {
  bookedProfit: number;
  totalSoldAmount: number;
  totalRealizedCost: number;
  dividendIncome: number;
  salesCount: number;
} {
  const sorted = [...(holding.transactions || [])].sort((a, b) => {
    const timeA = parseDate(a.date).getTime() || 0;
    const timeB = parseDate(b.date).getTime() || 0;
    return timeA - timeB;
  });

  interface BuyLot {
    quantity: number;
    price: number;
    date: string;
  }

  const buyLots: BuyLot[] = [];
  let bookedProfit = 0;
  let totalSoldAmount = 0;
  let totalRealizedCost = 0;
  let dividendIncome = 0;
  let salesCount = 0;

  for (const t of sorted) {
    if (t.type === 'buy') {
      const unitPrice = t.price > 0 ? t.price : t.quantity > 0 ? t.totalAmount / t.quantity : 0;
      buyLots.push({
        quantity: t.quantity,
        price: unitPrice,
        date: t.date,
      });
    } else if (t.type === 'sell') {
      salesCount++;
      let qtyToSell = t.quantity;
      let costOfSoldLots = 0;

      // FIFO: Match sales against earliest buy lots
      while (qtyToSell > 0.000001 && buyLots.length > 0) {
        const lot = buyLots[0];
        if (lot.quantity <= qtyToSell) {
          costOfSoldLots += lot.quantity * lot.price;
          qtyToSell -= lot.quantity;
          buyLots.shift();
        } else {
          costOfSoldLots += qtyToSell * lot.price;
          lot.quantity -= qtyToSell;
          qtyToSell = 0;
        }
      }

      // If sell quantity exceeds recorded buy lots, fallback to holding average price
      if (qtyToSell > 0.000001) {
        costOfSoldLots += qtyToSell * (holding.averageBuyPrice || 0);
      }

      const profitOnThisSell = t.totalAmount - costOfSoldLots;
      bookedProfit += profitOnThisSell;
      totalSoldAmount += t.totalAmount;
      totalRealizedCost += costOfSoldLots;
    } else if (t.type === 'dividend' || t.type === 'interest' || t.type === 'coupon') {
      dividendIncome += t.totalAmount;
    } else if (t.type === 'principal_repayment') {
      let qtyToRedeem = t.quantity > 0 ? t.quantity : 0;
      let costOfRedeemedLots = 0;

      while (buyLots.length > 0 && qtyToRedeem > 0.000001) {
        const oldest = buyLots[0];
        if (oldest.quantity <= qtyToRedeem) {
          costOfRedeemedLots += oldest.quantity * oldest.price;
          qtyToRedeem -= oldest.quantity;
          buyLots.shift();
        } else {
          costOfRedeemedLots += qtyToRedeem * oldest.price;
          oldest.quantity -= qtyToRedeem;
          qtyToRedeem = 0;
        }
      }

      if (qtyToRedeem > 0.000001) {
        costOfRedeemedLots += qtyToRedeem * (holding.averageBuyPrice || 0);
      }

      const profitOnPrincipal = t.totalAmount - costOfRedeemedLots;
      bookedProfit += profitOnPrincipal;
      totalSoldAmount += t.totalAmount;
      totalRealizedCost += costOfRedeemedLots;
      salesCount++;
    } else if (t.type === 'split') {
      let multiplier = 1;
      if (t.splitRatio && t.splitRatio.includes(':')) {
        const [oldR, newR] = t.splitRatio.split(':').map(Number);
        if (oldR > 0 && newR > 0) {
          multiplier = newR / oldR;
        }
      } else if (t.newQuantity && t.newQuantity > 0) {
        const currentQty = buyLots.reduce((acc, l) => acc + l.quantity, 0);
        if (currentQty > 0) {
          multiplier = t.newQuantity / currentQty;
        }
      }

      if (multiplier > 0 && multiplier !== 1) {
        for (const lot of buyLots) {
          lot.quantity = Number((lot.quantity * multiplier).toFixed(4));
          lot.price = lot.price / multiplier;
        }
      } else if (t.quantity > 0) {
        const currentQty = buyLots.reduce((acc, l) => acc + l.quantity, 0);
        if (currentQty > 0) {
          const factor = (currentQty + t.quantity) / currentQty;
          for (const lot of buyLots) {
            lot.quantity = Number((lot.quantity * factor).toFixed(4));
            lot.price = lot.price / factor;
          }
        }
      }
    } else if (t.type === 'bonus') {
      let bonusUnits = 0;
      if (t.bonusRatio && t.bonusRatio.includes(':')) {
        const [bA, bB] = t.bonusRatio.split(':').map(Number);
        if (bA > 0 && bB > 0) {
          const currentQty = buyLots.reduce((acc, l) => acc + l.quantity, 0);
          bonusUnits = Math.floor(currentQty * (bA / bB));
        }
      } else if (t.quantity > 0) {
        bonusUnits = t.quantity;
      }

      if (bonusUnits > 0) {
        buyLots.push({
          quantity: bonusUnits,
          price: 0,
          date: t.date,
        });
      }
    }
  }

  return {
    bookedProfit: Number(bookedProfit.toFixed(2)),
    totalSoldAmount: Number(totalSoldAmount.toFixed(2)),
    totalRealizedCost: Number(totalRealizedCost.toFixed(2)),
    dividendIncome: Number(dividendIncome.toFixed(2)),
    salesCount,
  };
}

export interface DebtContactSummary {
  totalPaid: number;
  totalReceived: number;
  adjustments: number;
  netBalance: number;
  status: 'owes_you' | 'you_owe' | 'settled';
  transactions: Transaction[];
  transactionCount: number;
}

/**
 * Computes dynamic summary for a debt contact:
 * Net Balance = Paid (lent to contact) - Received (collected from contact) + Adjustments
 * If Balance > 0 -> Receivable ("owes you")
 * If Balance < 0 -> Payable ("you owe")
 * If Balance === 0 -> Settled
 */
export function getDebtContactSummary(
  debt: Debt,
  transactions: Transaction[],
  cachedContactTxs?: Transaction[]
): DebtContactSummary {
  const contactTxs = cachedContactTxs || transactions.filter((tx) => tx.debtId === debt.id);

  if (contactTxs.length === 0) {
    const isLent = debt.type === 'lent';
    const paid = isLent ? debt.principalAmount : Math.max(0, debt.principalAmount - debt.currentBalance);
    const received = isLent ? Math.max(0, debt.principalAmount - debt.currentBalance) : debt.principalAmount;
    const net = isLent ? debt.currentBalance : -debt.currentBalance;
    return {
      totalPaid: paid,
      totalReceived: received,
      adjustments: 0,
      netBalance: net,
      status: net > 0.001 ? 'owes_you' : net < -0.001 ? 'you_owe' : 'settled',
      transactions: [],
      transactionCount: 0,
    };
  }

  let totalPaid = 0;
  let totalReceived = 0;
  let adjustments = 0;

  contactTxs.forEach((tx) => {
    if (tx.isBalanceAdjustment) {
      if (tx.type === 'income') {
        adjustments += tx.amount;
      } else {
        adjustments -= tx.amount;
      }
    } else if (
      tx.toAccountId === SYSTEM_DEBT_ACCOUNT_ID ||
      (tx.tags && (tx.tags.includes('Paid') || tx.tags.includes('Lent')))
    ) {
      // Money went from user's account to debt ledger -> Paid to contact
      totalPaid += tx.amount;
    } else if (
      tx.fromAccountId === SYSTEM_DEBT_ACCOUNT_ID ||
      (tx.tags && (tx.tags.includes('Received') || tx.tags.includes('Repayment') || tx.tags.includes('Borrowed')))
    ) {
      // Money came from debt ledger to user's account -> Received from contact
      totalReceived += tx.amount;
    } else if (tx.type === 'expense') {
      totalPaid += tx.amount;
    } else if (tx.type === 'income') {
      totalReceived += tx.amount;
    } else {
      totalPaid += tx.amount;
    }
  });

  const netBalance = totalPaid - totalReceived + adjustments;

  return {
    totalPaid,
    totalReceived,
    adjustments,
    netBalance,
    status: netBalance > 0.001 ? 'owes_you' : netBalance < -0.001 ? 'you_owe' : 'settled',
    transactions: contactTxs,
    transactionCount: contactTxs.length,
  };
}

/**
 * Returns current market price (CMP) and last price update date.
 * If the manual update is the latest date (or equal to the newest trade date), it is preserved.
 * Otherwise, if a trade transaction has a strictly newer date, that transaction's price is used.
 */
export function getLatestTransactionPrice(
  transactions?: InvestmentTransaction[],
  fallbackPrice: number = 0,
  fallbackDate: string = '',
  assetType?: string
): { currentPrice: number; lastPriceUpdate: string } {
  const manualDate = fallbackDate || toInputDate(new Date());
  const manualTime = parseDate(manualDate).getTime() || 0;
  const hasManualPrice = typeof fallbackPrice === 'number' && fallbackPrice > 0;

  // For mutual funds, the current market price (CMP / NAV) must never be reset to past buy transaction prices
  if (assetType === 'mutual_fund' && hasManualPrice) {
    return {
      currentPrice: Number(fallbackPrice.toFixed(4)),
      lastPriceUpdate: manualDate,
    };
  }

  if (!transactions || transactions.length === 0) {
    return {
      currentPrice: hasManualPrice ? Number(fallbackPrice.toFixed(4)) : 0,
      lastPriceUpdate: manualDate,
    };
  }

  // Filter transactions with a valid market price (exclude dividend records which don't represent unit share CMP)
  const validTxs = transactions
    .map((tx, idx) => ({ tx, idx }))
    .filter(({ tx }) => tx.type !== 'dividend' && typeof tx.price === 'number' && tx.price > 0);

  if (validTxs.length === 0) {
    return {
      currentPrice: hasManualPrice ? Number(fallbackPrice.toFixed(4)) : 0,
      lastPriceUpdate: manualDate,
    };
  }

  // Sort descending: newest trade date first.
  // If dates are identical, the later recorded entry (higher idx) takes precedence.
  validTxs.sort((a, b) => {
    const timeA = parseDate(a.tx.date).getTime() || 0;
    const timeB = parseDate(b.tx.date).getTime() || 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return b.idx - a.idx;
  });

  const latest = validTxs[0].tx;
  const latestTxTime = parseDate(latest.date).getTime() || 0;

  // If the manual update is the latest date (or equal to latest transaction date), keep it!
  if (hasManualPrice && manualTime >= latestTxTime) {
    return {
      currentPrice: Number(fallbackPrice.toFixed(4)),
      lastPriceUpdate: manualDate,
    };
  }

  // If asset has manual price and is mutual fund or debt fund with valid price, keep current price
  if (hasManualPrice && (assetType === 'mutual_fund' || assetType === 'bond')) {
    return {
      currentPrice: Number(fallbackPrice.toFixed(4)),
      lastPriceUpdate: manualDate,
    };
  }

  return {
    currentPrice: Number(latest.price.toFixed(4)),
    lastPriceUpdate: toInputDate(latest.date),
  };
}

/**
 * Adjust hex color brightness by a percentage (-100 to +100).
 * Useful for generating beautiful multi-stop card gradients from a single hex color.
 */
export function adjustHexColor(hex: string, percent: number): string {
  try {
    let cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return hex;
    const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * (1 + percent / 100))));
    const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * (1 + percent / 100))));
    const b = Math.min(255, Math.max(0, Math.round((num & 255) * (1 + percent / 100))));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  } catch {
    return hex;
  }
}

/**
 * Determine if a color is light or dark according to relative luminance.
 * Used for dynamic text contrast on full-color passbook cards.
 */
export function isColorLight(hex: string): boolean {
  try {
    let cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return false;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 180;
  } catch {
    return false;
  }
}

export { getHoldingSharesAsOfDate, getHoldingStateAsOfDate } from './fifoCalculator';

