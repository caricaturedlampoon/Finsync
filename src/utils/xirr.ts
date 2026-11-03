/**
 * XIRR (Extended Internal Rate of Return) Engine
 * Calculates annualized rate of return for irregular cash flows with high numerical stability.
 */

import { InvestmentHolding } from '../types';

export interface CashFlow {
  date: Date;
  amount: number; // Negative for purchases/investments, Positive for returns/sales/current value
}

/**
 * Calculates net present value of cash flows given rate r
 */
function npv(r: number, cashFlows: CashFlow[], t0: Date): number {
  let val = 0;
  const d0 = t0.getTime();
  const msInYear = 1000 * 60 * 60 * 24 * 365.25;

  for (const cf of cashFlows) {
    const years = (cf.date.getTime() - d0) / msInYear;
    val += cf.amount / Math.pow(1 + r, years);
  }
  return val;
}

/**
 * Derivative of NPV with respect to r
 */
function dnpv(r: number, cashFlows: CashFlow[], t0: Date): number {
  let val = 0;
  const d0 = t0.getTime();
  const msInYear = 1000 * 60 * 60 * 24 * 365.25;

  for (const cf of cashFlows) {
    const years = (cf.date.getTime() - d0) / msInYear;
    if (years === 0) continue;
    val -= (years * cf.amount) / Math.pow(1 + r, years + 1);
  }
  return val;
}

/**
 * Calculate XIRR as a percentage (e.g. 18.45)
 */
export function calculateXIRR(cashFlows: CashFlow[]): number | null {
  if (cashFlows.length < 2) return null;

  // Check if we have at least one positive and one negative cash flow
  let hasPos = false;
  let hasNeg = false;
  let totalInvested = 0;
  let totalReturned = 0;

  for (const cf of cashFlows) {
    if (cf.amount > 0) {
      hasPos = true;
      totalReturned += cf.amount;
    }
    if (cf.amount < 0) {
      hasNeg = true;
      totalInvested += Math.abs(cf.amount);
    }
  }

  if (!hasPos || !hasNeg) return null;

  // Sort chronologically
  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date;
  const tEnd = sorted[sorted.length - 1].date;
  const daySpan = (tEnd.getTime() - t0.getTime()) / (1000 * 60 * 60 * 24);

  // If time span is very short (< 7 days), return simple gain percentage
  if (daySpan < 7) {
    if (totalInvested === 0) return 0;
    const gain = ((totalReturned - totalInvested) / totalInvested) * 100;
    return Math.min(Math.max(gain, -99.9), 999.9);
  }

  // Initial rate guess based on simple CAGR or return
  let r = 0.15;
  const maxIterations = 100;
  const tolerance = 1e-5;

  for (let i = 0; i < maxIterations; i++) {
    // Avoid -1 boundary condition
    if (r <= -0.99) r = -0.95;

    const f = npv(r, sorted, t0);
    const df = dnpv(r, sorted, t0);

    if (Math.abs(df) < 1e-9) {
      break;
    }

    const nextR = r - f / df;
    if (Math.abs(nextR - r) < tolerance) {
      const percentage = nextR * 100;
      // Cap reasonable display ranges (-99% to +5000%)
      if (isNaN(percentage) || !isFinite(percentage)) break;
      return Math.min(Math.max(percentage, -99.9), 5000);
    }
    r = nextR;
  }

  // Fallback: Bisection search between -0.99 and 5.0
  let low = -0.99;
  let high = 5.0;
  let fLow = npv(low, sorted, t0);
  let fHigh = npv(high, sorted, t0);

  if (fLow * fHigh <= 0) {
    for (let i = 0; i < 50; i++) {
      const mid = (low + high) / 2;
      const fMid = npv(mid, sorted, t0);
      if (Math.abs(fMid) < tolerance || (high - low) / 2 < tolerance) {
        return mid * 100;
      }
      if (fMid * fLow > 0) {
        low = mid;
        fLow = fMid;
      } else {
        high = mid;
        fHigh = fMid;
      }
    }
  }

  // Graceful fallback to annualized return if iteration limits hit
  const years = Math.max(0.1, daySpan / 365.25);
  const totalReturnRatio = totalReturned / (totalInvested || 1);
  if (totalInvested <= 0 || totalReturnRatio <= 0) {
    console.debug('[FinSync:XIRR]: Zero/negative investment cost basis fallback -> 0.00%');
    return 0;
  }
  const annualized = (Math.pow(Math.max(0.01, totalReturnRatio), 1 / years) - 1) * 100;
  if (isNaN(annualized) || !isFinite(annualized)) {
    console.debug('[FinSync:XIRR]: Non-finite iteration result fallback -> 0.00%');
    return 0;
  }
  const bounded = Math.min(Math.max(annualized, -99.9), 1000);
  console.debug(`[FinSync:XIRR]: Calculated fallback annualized rate -> ${bounded.toFixed(2)}%`);
  return bounded;
}

export interface BondCashFlowTransaction {
  id?: string;
  type: string; // 'buy' | 'interest' | 'coupon' | 'principal_repayment' | 'sell' | 'dividend'
  date: string;
  totalAmount: number;
  quantity?: number;
  price?: number;
  notes?: string;
}

export interface BondHoldingModel {
  quantity: number;
  averageBuyPrice?: number;
  currentPrice: number;
  couponRate?: number; // e.g. 7.75 for 7.75% p.a.
  couponFrequency?: 'monthly' | 'quarterly' | 'semi_annually' | 'annually' | 'at_maturity';
  maturityDate?: string; // YYYY-MM-DD
  faceValue?: number; // e.g. 1000
  lastPriceUpdate?: string;
  transactions?: BondCashFlowTransaction[];
}

export interface BondCashFlowScheduleItem {
  id: string;
  date: string;
  type: 'PURCHASE' | 'COUPON_INTEREST' | 'PRINCIPAL_REPAYMENT' | 'SELL' | 'TERMINAL_VALUATION';
  amount: number; // Negative for cash outflow, Positive for cash inflow
  description: string;
  isLogged: boolean;
  isRealized: boolean; // On or before evaluation date
  isProjected: boolean; // Future cash flow
}

export interface BondSummaryMetrics {
  totalInvested: number;
  totalInterestReceived: number;
  totalInterestProjected: number;
  totalPrincipalRepaid: number;
  pendingPrincipal: number;
  currentValuation: number;
  couponPerPeriod: number;
  frequencyDivisor: number;
  annualCouponAmount: number;
  nextCouponDate: string | null;
  nextCouponAmount: number;
  realizedXIRR: number | null;
  projectedYTM: number | null;
  schedule: BondCashFlowScheduleItem[];
}

/**
 * Returns month interval and frequency divisor for bond coupon payouts.
 */
export function getBondFrequencyDetails(freq?: string): { intervalMonths: number; divisor: number; label: string } {
  switch (freq) {
    case 'monthly':
      return { intervalMonths: 1, divisor: 12, label: 'Monthly (12x/yr)' };
    case 'quarterly':
      return { intervalMonths: 3, divisor: 4, label: 'Quarterly (4x/yr)' };
    case 'semi_annually':
      return { intervalMonths: 6, divisor: 2, label: 'Semi-Annually (2x/yr)' };
    case 'at_maturity':
      return { intervalMonths: 0, divisor: 1, label: 'At Maturity' };
    case 'annually':
    default:
      return { intervalMonths: 12, divisor: 1, label: 'Annually (1x/yr)' };
  }
}

/**
 * Generates an end-to-end schedule of all bond cash flows:
 * 1. Initial Purchase Outflows (-Price * Qty - Fees)
 * 2. Periodic Coupon Interest Inflows (Monthly, Quarterly, Semi-Annually, Annually)
 * 3. Principal Repayments / Amortizations (+Capital returned)
 * 4. Maturity Redemption / Terminal Valuation
 */
export function generateBondCashFlowSchedule(
  holding: BondHoldingModel,
  evaluationDate: Date = new Date()
): BondCashFlowScheduleItem[] {
  const schedule: BondCashFlowScheduleItem[] = [];
  const evalTime = evaluationDate.getTime();
  const txs = holding.transactions || [];

  // 1. Process all logged purchase transactions
  let earliestBuyDate: Date | null = null;
  let loggedBuysTotal = 0;

  for (const t of txs) {
    const d = new Date(t.date);
    if (isNaN(d.getTime())) continue;

    if (t.type === 'buy') {
      const amount = Math.abs(t.totalAmount);
      loggedBuysTotal += amount;
      if (!earliestBuyDate || d.getTime() < earliestBuyDate.getTime()) {
        earliestBuyDate = d;
      }
      schedule.push({
        id: t.id || `buy-${d.getTime()}`,
        date: t.date.slice(0, 10),
        type: 'PURCHASE',
        amount: -amount,
        description: t.notes || `Bond Purchase (${t.quantity || holding.quantity} units @ ₹${t.price || holding.averageBuyPrice})`,
        isLogged: true,
        isRealized: true,
        isProjected: false,
      });
    } else if (t.type === 'sell') {
      const amount = Math.abs(t.totalAmount);
      schedule.push({
        id: t.id || `sell-${d.getTime()}`,
        date: t.date.slice(0, 10),
        type: 'SELL',
        amount: amount,
        description: t.notes || `Bond Sale (${t.quantity} units @ ₹${t.price})`,
        isLogged: true,
        isRealized: d.getTime() <= evalTime,
        isProjected: d.getTime() > evalTime,
      });
    }
  }

  // Fallback: If no buy transaction logged, create initial purchase from averageBuyPrice
  if (schedule.filter((s) => s.type === 'PURCHASE').length === 0 && holding.quantity > 0) {
    const buyPrice = holding.averageBuyPrice || holding.currentPrice || 1000;
    const initialDate = holding.lastPriceUpdate ? new Date(holding.lastPriceUpdate) : new Date(evalTime - 365 * 86400 * 1000);
    earliestBuyDate = initialDate;
    schedule.push({
      id: 'initial-buy-derived',
      date: initialDate.toISOString().slice(0, 10),
      type: 'PURCHASE',
      amount: -(holding.quantity * buyPrice),
      description: `Initial Allotment (${holding.quantity} units @ ₹${buyPrice})`,
      isLogged: false,
      isRealized: true,
      isProjected: false,
    });
  }

  // 2. Identify logged coupon interest & principal repayment transactions
  const loggedCoupons = txs.filter((t) => t.type === 'interest' || t.type === 'coupon' || t.type === 'dividend');
  const loggedPrincipal = txs.filter((t) => t.type === 'principal_repayment');

  for (const t of loggedCoupons) {
    const d = new Date(t.date);
    if (isNaN(d.getTime())) continue;
    const amount = Math.abs(t.totalAmount);
    schedule.push({
      id: t.id || `coupon-${d.getTime()}`,
      date: t.date.slice(0, 10),
      type: 'COUPON_INTEREST',
      amount: amount,
      description: t.notes || 'Coupon Interest Received (Logged)',
      isLogged: true,
      isRealized: d.getTime() <= evalTime,
      isProjected: d.getTime() > evalTime,
    });
  }

  for (const t of loggedPrincipal) {
    const d = new Date(t.date);
    if (isNaN(d.getTime())) continue;
    const amount = Math.abs(t.totalAmount);
    schedule.push({
      id: t.id || `repay-${d.getTime()}`,
      date: t.date.slice(0, 10),
      type: 'PRINCIPAL_REPAYMENT',
      amount: amount,
      description: t.notes || 'Principal Repayment (Logged)',
      isLogged: true,
      isRealized: d.getTime() <= evalTime,
      isProjected: d.getTime() > evalTime,
    });
  }

  // 3. Periodic Coupon Schedule Formulator (Monthly / Quarterly / Semi-Annual / Annual)
  const rate = holding.couponRate || 0;
  const fv = holding.faceValue || 1000;
  const qty = holding.quantity || 0;
  const freqDetails = getBondFrequencyDetails(holding.couponFrequency);

  if (rate > 0 && fv > 0 && qty > 0 && earliestBuyDate) {
    const periodCouponAmount = Number(((qty * fv * (rate / 100)) / freqDetails.divisor).toFixed(2));
    const maturityDateObj = holding.maturityDate ? new Date(holding.maturityDate) : null;
    const maxDate = maturityDateObj && !isNaN(maturityDateObj.getTime())
      ? maturityDateObj
      : new Date(evalTime + 365 * 3 * 86400 * 1000); // 3 years default horizon if no maturity specified

    // Generate coupon payment dates stepping forward from earliest purchase
    const cursor = new Date(earliestBuyDate);
    cursor.setMonth(cursor.getMonth() + freqDetails.intervalMonths);

    // Limit generation to prevent infinite loops (max 120 periods = 10 years monthly)
    let periodIndex = 1;
    while (cursor.getTime() <= maxDate.getTime() && periodIndex <= 120) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const yearMonth = dateStr.slice(0, 7);

      // Check if user already logged an interest payment in this exact month
      const alreadyLogged = loggedCoupons.some((t) => t.date.slice(0, 7) === yearMonth);

      if (!alreadyLogged) {
        const isPast = cursor.getTime() <= evalTime;
        schedule.push({
          id: `periodic-coupon-${periodIndex}-${yearMonth}`,
          date: dateStr,
          type: 'COUPON_INTEREST',
          amount: periodCouponAmount,
          description: `${freqDetails.label.split(' ')[0]} Coupon Interest (${rate}% p.a. on Par ₹${fv * qty})`,
          isLogged: false,
          isRealized: isPast,
          isProjected: !isPast,
        });
      }

      cursor.setMonth(cursor.getMonth() + freqDetails.intervalMonths);
      periodIndex++;
    }

    // 4. Principal Redemption at Maturity (Maturity Repayment)
    if (maturityDateObj && !isNaN(maturityDateObj.getTime())) {
      const matDateStr = maturityDateObj.toISOString().slice(0, 10);
      const matYearMonth = matDateStr.slice(0, 7);
      const alreadyLoggedMaturity = loggedPrincipal.some((t) => t.date.slice(0, 7) === matYearMonth);

      if (!alreadyLoggedMaturity) {
        const isPast = maturityDateObj.getTime() <= evalTime;
        const totalPar = qty * fv;
        schedule.push({
          id: `maturity-principal-${matDateStr}`,
          date: matDateStr,
          type: 'PRINCIPAL_REPAYMENT',
          amount: totalPar,
          description: `Principal Back Payment at Maturity (${qty} units @ Par ₹${fv})`,
          isLogged: false,
          isRealized: isPast,
          isProjected: !isPast,
        });
      }
    }
  }

  // Sort schedule chronologically
  schedule.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return schedule;
}

/**
 * Builds cash flows for XIRR calculation specifically formulated for Fixed Income & Bonds.
 * - All purchase outflows (negative)
 * - All realized coupon interests & principal back repayments (positive)
 * - Current terminal valuation at today (positive) if bond is still held and not past maturity
 */
export function buildBondCashFlows(
  holding: BondHoldingModel,
  evaluationDate: Date = new Date(),
  currentValuationOverride?: number
): CashFlow[] {
  const schedule = generateBondCashFlowSchedule(holding, evaluationDate);
  const cashFlows: CashFlow[] = [];
  const evalTime = evaluationDate.getTime();

  // Include all realized cash flows (on or before evaluation date)
  for (const item of schedule) {
    if (item.isRealized) {
      const d = new Date(item.date);
      if (!isNaN(d.getTime())) {
        cashFlows.push({ date: d, amount: item.amount });
      }
    }
  }

  // If the bond is still currently held (not past maturity or maturity has not returned full principal),
  // add the terminal holding valuation as of evaluation date
  const isMatured = holding.maturityDate ? new Date(holding.maturityDate).getTime() < evalTime : false;
  const remainingVal =
    currentValuationOverride !== undefined
      ? currentValuationOverride
      : holding.quantity * (holding.currentPrice || holding.averageBuyPrice || holding.faceValue || 0);

  if (!isMatured && remainingVal > 0) {
    cashFlows.push({ date: evaluationDate, amount: remainingVal });
  }

  return cashFlows;
}

/**
 * Calculates realized XIRR for a bond holding incorporating:
 * - Negative cash outflows on purchase dates
 * - Positive periodic coupon interest payments (monthly/quarterly/semi-annual/annual)
 * - Positive principal back payments (amortized or at maturity)
 * - Positive terminal valuation at current clean/dirty price
 */
export function calculateBondXIRR(
  holding: BondHoldingModel,
  evaluationDate: Date = new Date(),
  currentValuationOverride?: number
): number | null {
  const cfs = buildBondCashFlows(holding, evaluationDate, currentValuationOverride);
  return calculateXIRR(cfs);
}

/**
 * Calculates comprehensive financial metrics & yield statistics for a Bond holding.
 */
export function calculateBondMetrics(
  holding: BondHoldingModel,
  evaluationDate: Date = new Date()
): BondSummaryMetrics {
  const schedule = generateBondCashFlowSchedule(holding, evaluationDate);
  const evalTime = evaluationDate.getTime();

  let totalInvested = 0;
  let totalInterestReceived = 0;
  let totalInterestProjected = 0;
  let totalPrincipalRepaid = 0;
  let nextCouponDate: string | null = null;
  let nextCouponAmount = 0;

  for (const item of schedule) {
    if (item.type === 'PURCHASE') {
      totalInvested += Math.abs(item.amount);
    } else if (item.type === 'COUPON_INTEREST') {
      if (item.isRealized) {
        totalInterestReceived += item.amount;
      } else {
        totalInterestProjected += item.amount;
        if (!nextCouponDate || new Date(item.date).getTime() < new Date(nextCouponDate).getTime()) {
          nextCouponDate = item.date;
          nextCouponAmount = item.amount;
        }
      }
    } else if (item.type === 'PRINCIPAL_REPAYMENT') {
      if (item.isRealized) {
        totalPrincipalRepaid += item.amount;
      }
    }
  }

  const fv = holding.faceValue || 1000;
  const totalPar = holding.quantity * fv;
  const pendingPrincipal = Math.max(0, totalPar - totalPrincipalRepaid);
  const currentValuation = holding.quantity * (holding.currentPrice || holding.averageBuyPrice || fv);

  const freqDetails = getBondFrequencyDetails(holding.couponFrequency);
  const rate = holding.couponRate || 0;
  const couponPerPeriod = Number(((holding.quantity * fv * (rate / 100)) / freqDetails.divisor).toFixed(2));
  const annualCouponAmount = couponPerPeriod * freqDetails.divisor;

  const realizedXIRR = calculateBondXIRR(holding, evaluationDate);

  // Projected Yield to Maturity (YTM) calculation over the entire bond lifecycle
  const lifeCashFlows: CashFlow[] = [];
  for (const item of schedule) {
    const d = new Date(item.date);
    if (!isNaN(d.getTime())) {
      lifeCashFlows.push({ date: d, amount: item.amount });
    }
  }
  const projectedYTM = calculateXIRR(lifeCashFlows);

  return {
    totalInvested,
    totalInterestReceived,
    totalInterestProjected,
    totalPrincipalRepaid,
    pendingPrincipal,
    currentValuation,
    couponPerPeriod,
    frequencyDivisor: freqDetails.divisor,
    annualCouponAmount,
    nextCouponDate,
    nextCouponAmount,
    realizedXIRR,
    projectedYTM,
    schedule,
  };
}

/**
 * Builds cash flows for a Sovereign Gold Bond (SGB) holding:
 * - Purchase outflows (-invested amount on allotment/purchase dates)
 * - Semi-annual 2.5% RBI sovereign coupon interest receipts (+interest payouts)
 * - Redemption / Premature exit proceeds (+sales receipts)
 * - Terminal current gold market valuation (+grams * currentGoldPrice as of today)
 */
export function buildSgbCashFlows(
  holding: InvestmentHolding,
  currentGoldPriceOverride?: number,
  evaluationDate: Date = new Date()
): CashFlow[] {
  const cashFlows: CashFlow[] = [];
  const evalTime = evaluationDate.getTime();
  const txs = holding.transactions || [];

  const grams = Math.max(0, holding.quantity || 0);
  const purchasePricePerGram = holding.averageBuyPrice > 0 ? holding.averageBuyPrice : 5000;
  const rbiIssuePrice = holding.rbiIssuePrice || holding.faceValue || purchasePricePerGram;

  // 1. Initial Allotment / Purchase Outflows
  const buyTxs = txs.filter((t) => t.type === 'buy');
  let earliestDate: Date | null = null;

  if (buyTxs.length > 0) {
    buyTxs.forEach((t) => {
      const d = new Date(t.date);
      if (!isNaN(d.getTime())) {
        const amt = Math.abs(t.totalAmount || t.price * t.quantity);
        cashFlows.push({ date: d, amount: -amt });
        if (!earliestDate || d.getTime() < earliestDate.getTime()) {
          earliestDate = d;
        }
      }
    });
  } else if (grams > 0) {
    const issueDateStr = holding.rbiIssueDate || holding.purchaseDate || '2023-11-15';
    const d = new Date(issueDateStr);
    earliestDate = d;
    cashFlows.push({
      date: isNaN(d.getTime()) ? new Date(evalTime - 365 * 86400 * 1000) : d,
      amount: -(grams * purchasePricePerGram),
    });
  }

  // 2. Realized Sovereign Interest Payouts (2.50% p.a. semi-annually)
  const interestTxs = txs.filter(
    (t) => t.type === 'interest' || t.type === 'coupon' || t.type === 'dividend'
  );

  if (interestTxs.length > 0) {
    interestTxs.forEach((t) => {
      const d = new Date(t.date);
      if (!isNaN(d.getTime()) && d.getTime() <= evalTime) {
        cashFlows.push({ date: d, amount: Math.abs(t.totalAmount || t.price * t.quantity) });
      }
    });
  } else if (grams > 0 && earliestDate) {
    // Generate standard RBI semi-annual coupon payouts (every 6 months from issue)
    const semiAnnualCoupon = (grams * rbiIssuePrice * 0.025) / 2;
    const cursor = new Date(earliestDate);
    cursor.setMonth(cursor.getMonth() + 6);

    while (cursor.getTime() <= evalTime) {
      cashFlows.push({ date: new Date(cursor), amount: semiAnnualCoupon });
      cursor.setMonth(cursor.getMonth() + 6);
    }
  }

  // 3. Sells or Premature Redemptions
  const sellTxs = txs.filter((t) => t.type === 'sell');
  sellTxs.forEach((t) => {
    const d = new Date(t.date);
    if (!isNaN(d.getTime()) && d.getTime() <= evalTime) {
      cashFlows.push({ date: d, amount: Math.abs(t.totalAmount || t.price * t.quantity) });
    }
  });

  // 4. Terminal Holding Gold Valuation as of evaluation date
  const goldPrice =
    currentGoldPriceOverride && currentGoldPriceOverride > 0
      ? currentGoldPriceOverride
      : holding.goldReferencePrice && holding.goldReferencePrice > 0
      ? holding.goldReferencePrice
      : holding.currentPrice > 0
      ? holding.currentPrice
      : 7480;

  const currentValuation = grams * goldPrice;
  if (currentValuation > 0) {
    cashFlows.push({ date: evaluationDate, amount: currentValuation });
  }

  return cashFlows;
}

/**
 * Calculates realized XIRR for a Sovereign Gold Bond holding
 */
export function calculateSgbXIRR(
  holding: InvestmentHolding,
  currentGoldPriceOverride?: number,
  evaluationDate: Date = new Date()
): number | null {
  const cfs = buildSgbCashFlows(holding, currentGoldPriceOverride, evaluationDate);
  return calculateXIRR(cfs);
}

/**
 * Builds cash flows for a Provident Fund (PF / EPF / PPF) account:
 * - Opening balance cash outflow on account opening date
 * - Monthly employee, employer & voluntary contribution cash outflows on deposit dates
 * - Partial withdrawals / claim advances cash inflows
 * - Terminal total corpus valuation as of evaluation date
 */
export function buildPfCashFlows(
  holding: InvestmentHolding,
  evaluationDate: Date = new Date()
): CashFlow[] {
  const cashFlows: CashFlow[] = [];
  const evalTime = evaluationDate.getTime();
  const txs = [...(holding.transactions || [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let earliestDate: Date | null = null;

  // 1. Opening Balance Outflow
  if (holding.openingBalance && holding.openingBalance > 0) {
    const openDateStr =
      holding.purchaseDate || (txs.length > 0 ? txs[0].date : '2022-04-01');
    const d = new Date(openDateStr);
    earliestDate = isNaN(d.getTime()) ? new Date(evalTime - 365 * 2 * 86400 * 1000) : d;
    cashFlows.push({ date: earliestDate, amount: -holding.openingBalance });
  }

  // 2. Contributions & Withdrawals from Ledger
  let totalContrib = 0;

  txs.forEach((t) => {
    const d = new Date(t.date);
    if (isNaN(d.getTime()) || d.getTime() > evalTime) return;

    if (!earliestDate || d.getTime() < earliestDate.getTime()) {
      earliestDate = d;
    }

    const isWithdrawal = t.type === 'sell' || t.type === 'withdrawal';
    const isInterest = t.type === 'interest' || t.type === 'coupon';

    if (isWithdrawal) {
      const amt = Math.abs(t.totalAmount || t.quantity);
      cashFlows.push({ date: d, amount: amt });
    } else if (isInterest) {
      // Internal compounding interest is already reflected in the terminal corpus balance,
      // so do not count as external cash flow to avoid double counting.
    } else {
      // Contribution (Employee + Employer + Voluntary)
      const emp = t.employeeAmount || 0;
      const empyr = t.employerAmount || 0;
      const vol = t.voluntaryAmount || 0;
      const total = emp + empyr + vol || t.totalAmount || t.quantity || 0;

      if (total > 0) {
        totalContrib += total;
        cashFlows.push({ date: d, amount: -total });
      }
    }
  });

  // Fallback if no contributions logged yet but quantity > 0
  if (cashFlows.length === 0 && holding.quantity > 0) {
    const d = holding.purchaseDate ? new Date(holding.purchaseDate) : new Date(evalTime - 365 * 86400 * 1000);
    cashFlows.push({ date: d, amount: -holding.quantity });
  }

  // 3. Terminal Total Corpus Balance as of evaluation date
  // Determine running balance
  let currentCorpus = 0;
  if (holding.openingBalance) currentCorpus += holding.openingBalance;

  txs.forEach((t) => {
    const isWithdrawal = t.type === 'sell' || t.type === 'withdrawal';
    const isInterest = t.type === 'interest' || t.type === 'coupon';
    if (isWithdrawal) {
      currentCorpus = Math.max(0, currentCorpus - Math.abs(t.totalAmount || t.quantity));
    } else if (isInterest) {
      currentCorpus += Math.abs(t.totalAmount || t.price * t.quantity);
    } else {
      const total = (t.employeeAmount || 0) + (t.employerAmount || 0) + (t.voluntaryAmount || 0) || t.totalAmount || t.quantity;
      currentCorpus += total;
    }
  });

  if (currentCorpus <= 0 && holding.quantity > 0) {
    currentCorpus = holding.quantity;
  }

  if (currentCorpus > 0) {
    cashFlows.push({ date: evaluationDate, amount: currentCorpus });
  }

  return cashFlows;
}

/**
 * Calculates realized XIRR for a Provident Fund account
 */
export function calculatePfXIRR(
  holding: InvestmentHolding,
  evaluationDate: Date = new Date()
): number | null {
  const cfs = buildPfCashFlows(holding, evaluationDate);
  return calculateXIRR(cfs);
}

/**
 * Calculates overall Portfolio XIRR across all Fixed-Income & Bond holdings
 */
export function calculateBondsPortfolioXIRR(
  bondHoldings: InvestmentHolding[],
  evaluationDate: Date = new Date()
): number | null {
  const allCashFlows: CashFlow[] = [];
  bondHoldings.forEach((h) => {
    if (h.quantity > 0 || (h.transactions && h.transactions.length > 0)) {
      const cfs = buildBondCashFlows(h as any, evaluationDate);
      allCashFlows.push(...cfs);
    }
  });
  return calculateXIRR(allCashFlows);
}

/**
 * Calculates overall Portfolio XIRR across all Sovereign Gold Bond (SGB) holdings
 */
export function calculateSgbPortfolioXIRR(
  sgbHoldings: InvestmentHolding[],
  liveGoldPriceOverride?: number,
  evaluationDate: Date = new Date()
): number | null {
  const allCashFlows: CashFlow[] = [];
  sgbHoldings.forEach((h) => {
    if (h.quantity > 0 || (h.transactions && h.transactions.length > 0)) {
      const cfs = buildSgbCashFlows(h, liveGoldPriceOverride, evaluationDate);
      allCashFlows.push(...cfs);
    }
  });
  return calculateXIRR(allCashFlows);
}

/**
 * Calculates overall Portfolio XIRR across all Provident Fund (PF) accounts
 */
export function calculatePfPortfolioXIRR(
  pfHoldings: InvestmentHolding[],
  evaluationDate: Date = new Date()
): number | null {
  const allCashFlows: CashFlow[] = [];
  pfHoldings.forEach((h) => {
    if (h.quantity > 0 || (h.transactions && h.transactions.length > 0) || (h.openingBalance && h.openingBalance > 0)) {
      const cfs = buildPfCashFlows(h, evaluationDate);
      allCashFlows.push(...cfs);
    }
  });
  return calculateXIRR(allCashFlows);
}


