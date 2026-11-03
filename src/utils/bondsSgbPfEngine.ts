import { InvestmentHolding, InvestmentTransaction, PfType, BondType } from '../types';
import { parseDate, toInputDate } from './formatters';
import {
  calculateBondXIRR,
  calculateSgbXIRR,
  calculatePfXIRR,
  calculateBondsPortfolioXIRR,
  calculateSgbPortfolioXIRR,
  calculatePfPortfolioXIRR,
} from './xirr';

// ============================================================================
// SOVEREIGN GOLD BONDS (SGB) CONSTANTS & ENGINE
// ============================================================================

export const DEFAULT_SGB_GOLD_PRICE = 14420; // Reference 24K 999 domestic gold price (₹/gram) as of Oct 2026
export const DEFAULT_SGB_GOLD_SOURCE = 'IBJA (India Bullion & Jewellers Association Domestic Benchmark)';
export const DEFAULT_SGB_PRICE_DATE = '2026-10-31';
export const STANDARD_SGB_COUPON_RATE = 2.5; // 2.50% p.a. sovereign interest guaranteed by RBI

export interface SgbHoldingMetrics {
  holdingId: string;
  trancheName: string;
  rbiIssuePrice: number;
  issueDate?: string;
  maturityDate?: string;
  gramsHeld: number;
  purchasePricePerGram: number;
  totalInvested: number;
  goldReferencePrice: number;
  goldPriceDate: string;
  goldPriceSource: string;
  currentGoldValue: number;
  unrealizedGoldGain: number;
  unrealizedGoldGainPercent: number;
  annualInterestRate: number;
  annualInterestIncome: number;
  semiAnnualInterestPayout: number;
  totalInterestReceived: number;
  totalSgbValue: number; // Current Gold Value (clarified as gold-linked capital)
  totalRealizedAndUnrealizedReturn: number; // Gold gain + interest received
  isPrematureRedemptionEligible: boolean;
  prematureRedemptionDate?: string;
  remainingTenureMonths: number;
  remainingTenureText: string;
  rbiSeriesCode?: string;
  xirr: number | null;
}

export interface SgbSummaryMetrics {
  totalInvestment: number;
  currentGoldValue: number;
  goldReferencePrice: number;
  goldPriceDate: string;
  goldPriceSource: string;
  totalUnrealizedGain: number;
  totalUnrealizedGainPercent: number;
  totalInterestEarned: number;
  annualInterestIncome: number;
  totalHoldingsCount: number;
  totalGrams: number;
  portfolioXirr: number | null;
}

/**
 * Calculate comprehensive SGB metrics for an individual holding.
 * Follows RBI Sovereign Gold Bond rules:
 * 1. Interest is strictly 2.50% p.a. on the original issue/allotment face value, not CMP.
 * 2. Semi-annual interest is paid every 6 months directly to bank account.
 * 3. Premature redemption is permitted after 5 years from issue date on interest payment dates.
 * 4. Tenure is 8 years. Capital gains on maturity are 100% tax-free under Section 47(viic) of IT Act.
 */
export function computeSgbMetrics(
  holding: InvestmentHolding,
  liveGoldPriceOverride?: number
): SgbHoldingMetrics {
  const gramsHeld = Math.max(0, holding.quantity || 0);
  const purchasePricePerGram = holding.averageBuyPrice > 0 ? holding.averageBuyPrice : 5000;
  const totalInvested = gramsHeld * purchasePricePerGram;

  const goldReferencePrice =
    liveGoldPriceOverride && liveGoldPriceOverride > 0
      ? liveGoldPriceOverride
      : holding.goldReferencePrice && holding.goldReferencePrice > 0
      ? holding.goldReferencePrice
      : holding.currentPrice > 0
      ? holding.currentPrice
      : DEFAULT_SGB_GOLD_PRICE;

  const goldPriceDate = holding.goldPriceDate || holding.lastPriceUpdate || DEFAULT_SGB_PRICE_DATE;
  const goldPriceSource = holding.goldPriceSource || DEFAULT_SGB_GOLD_SOURCE;

  const currentGoldValue = Math.round(gramsHeld * goldReferencePrice);
  const unrealizedGoldGain = currentGoldValue - totalInvested;
  const unrealizedGoldGainPercent = totalInvested > 0 ? (unrealizedGoldGain / totalInvested) * 100 : 0;

  // RBI Allotment/Issue Face Value (falls back to averageBuyPrice or ₹5,000)
  const rbiIssuePrice =
    holding.rbiIssuePrice && holding.rbiIssuePrice > 0
      ? holding.rbiIssuePrice
      : holding.faceValue && holding.faceValue > 0
      ? holding.faceValue
      : purchasePricePerGram;

  const annualInterestRate =
    holding.couponRate !== undefined && holding.couponRate > 0
      ? holding.couponRate
      : STANDARD_SGB_COUPON_RATE;

  // Calculated on original issue price per RBI guidelines
  const annualInterestIncome = Math.round((gramsHeld * rbiIssuePrice * annualInterestRate) / 100);
  const semiAnnualInterestPayout = Math.round(annualInterestIncome / 2);

  // Total interest payouts received in transaction ledger
  let totalInterestReceived = 0;
  (holding.transactions || []).forEach((t) => {
    if (t.type === 'interest' || t.type === 'coupon' || t.type === 'dividend') {
      totalInterestReceived += t.totalAmount || t.price * t.quantity || 0;
    }
  });

  // Calculate Dates & Maturity
  const now = new Date();
  let issueDateStr = holding.rbiIssueDate || holding.purchaseDate;
  if (!issueDateStr && holding.transactions && holding.transactions.length > 0) {
    issueDateStr = holding.transactions[0].date;
  }
  if (!issueDateStr) {
    issueDateStr = '2023-11-15';
  }

  const issueDate = parseDate(issueDateStr);
  const prematureDate = new Date(issueDate);
  prematureDate.setFullYear(prematureDate.getFullYear() + 5);
  const prematureRedemptionDateStr =
    holding.prematureRedemptionDate || toInputDate(prematureDate);

  let maturityDateStr = holding.maturityDate;
  if (!maturityDateStr) {
    const matDate = new Date(issueDate);
    matDate.setFullYear(matDate.getFullYear() + 8);
    maturityDateStr = toInputDate(matDate);
  }
  const maturityDate = parseDate(maturityDateStr);

  const isPrematureRedemptionEligible = now.getTime() >= prematureDate.getTime();

  // Remaining maturity time
  const msRemaining = maturityDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const remainingTenureMonths = Math.max(0, Math.round(daysRemaining / 30.4375));

  let remainingTenureText = '';
  if (msRemaining <= 0) {
    remainingTenureText = 'Matured';
  } else {
    const years = Math.floor(remainingTenureMonths / 12);
    const months = remainingTenureMonths % 12;
    if (years > 0 && months > 0) {
      remainingTenureText = `${years}y ${months}m remaining`;
    } else if (years > 0) {
      remainingTenureText = `${years} years remaining`;
    } else {
      remainingTenureText = `${months} months remaining`;
    }
  }

  const trancheName =
    holding.trancheSeries ||
    holding.customDisplayName ||
    holding.name ||
    holding.symbol;

  return {
    holdingId: holding.id,
    trancheName,
    rbiIssuePrice,
    issueDate: issueDateStr,
    maturityDate: maturityDateStr,
    gramsHeld,
    purchasePricePerGram,
    totalInvested,
    goldReferencePrice,
    goldPriceDate,
    goldPriceSource,
    currentGoldValue,
    unrealizedGoldGain,
    unrealizedGoldGainPercent,
    annualInterestRate,
    annualInterestIncome,
    semiAnnualInterestPayout,
    totalInterestReceived,
    totalSgbValue: currentGoldValue,
    totalRealizedAndUnrealizedReturn: unrealizedGoldGain + totalInterestReceived,
    isPrematureRedemptionEligible,
    prematureRedemptionDate: prematureRedemptionDateStr,
    remainingTenureMonths,
    remainingTenureText,
    rbiSeriesCode: holding.symbol,
    xirr: calculateSgbXIRR(holding, goldReferencePrice),
  };
}

export function computeSgbSummary(
  sgbHoldings: InvestmentHolding[],
  liveGoldPriceOverride?: number
): SgbSummaryMetrics {
  let totalInvestment = 0;
  let currentGoldValue = 0;
  let totalInterestEarned = 0;
  let annualInterestIncome = 0;
  let totalGrams = 0;

  const refPrice =
    liveGoldPriceOverride ||
    (sgbHoldings.length > 0 && sgbHoldings[0].goldReferencePrice) ||
    DEFAULT_SGB_GOLD_PRICE;

  sgbHoldings.forEach((holding) => {
    const m = computeSgbMetrics(holding, refPrice);
    totalInvestment += m.totalInvested;
    currentGoldValue += m.currentGoldValue;
    totalInterestEarned += m.totalInterestReceived;
    annualInterestIncome += m.annualInterestIncome;
    totalGrams += m.gramsHeld;
  });

  const totalUnrealizedGain = currentGoldValue - totalInvestment;
  const totalUnrealizedGainPercent =
    totalInvestment > 0 ? (totalUnrealizedGain / totalInvestment) * 100 : 0;

  const sampleHolding = sgbHoldings[0];
  const goldPriceDate =
    sampleHolding?.goldPriceDate || sampleHolding?.lastPriceUpdate || DEFAULT_SGB_PRICE_DATE;
  const goldPriceSource = sampleHolding?.goldPriceSource || DEFAULT_SGB_GOLD_SOURCE;

  return {
    totalInvestment,
    currentGoldValue,
    goldReferencePrice: refPrice,
    goldPriceDate,
    goldPriceSource,
    totalUnrealizedGain,
    totalUnrealizedGainPercent,
    totalInterestEarned,
    annualInterestIncome,
    totalHoldingsCount: sgbHoldings.length,
    totalGrams,
    portfolioXirr: calculateSgbPortfolioXIRR(sgbHoldings, refPrice),
  };
}

// ============================================================================
// BONDS (FIXED-INCOME) ENGINE & CASH FLOW SCHEDULE
// ============================================================================

export interface BondHoldingMetrics {
  holdingId: string;
  name: string;
  issuer: string;
  bondType: BondType;
  bondTypeLabel: string;
  isin: string;
  creditRating?: string;
  unitsHeld: number;
  faceValue: number;
  purchasePricePerUnit: number;
  totalInvested: number;
  marketPricePerUnit: number;
  currentValuation: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  couponRate: number; // % p.a.
  frequency: 'monthly' | 'quarterly' | 'semi_annually' | 'annually' | 'at_maturity';
  frequencyLabel: string;
  currentYield: number; // % p.a. (Coupon / CMP)
  ytm: number; // % p.a. Yield to maturity
  annualCouponIncome: number;
  periodicCouponAmount: number;
  totalInterestReceived: number;
  totalPrincipalRepaid: number;
  accruedInterest: number;
  nextCouponPaymentDate: string;
  maturityDate: string;
  redemptionValue: number;
  remainingTenureText: string;
  xirr: number | null;
  cashFlowSchedule: Array<{
    date: string;
    type: 'coupon' | 'maturity' | 'call';
    amount: number;
    description: string;
  }>;
}

export interface BondsSummaryMetrics {
  currentValuation: number;
  totalInvested: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  totalInterestReceived: number;
  totalAccruedInterest: number;
  annualCouponIncome: number;
  totalBondsCount: number;
  totalUnitsHeld: number;
  weightedCouponRate: number;
  weightedYtm: number;
  portfolioXirr: number | null;
}

export const BOND_TYPE_LABELS: Record<BondType, string> = {
  g_sec: 'Government Security (G-Sec)',
  t_bill: 'Treasury Bill (T-Bill)',
  corporate: 'Corporate Bond / NCD',
  psu: 'PSU / Navratna Bond',
  tax_free: 'Tax-Free Infrastructure Bond',
  zero_coupon: 'Zero-Coupon Bond',
  other: 'Fixed Income Bond',
};

/**
 * Calculates accrued interest using actual/365 convention
 */
export function calculateBondAccruedInterest(
  faceValue: number,
  units: number,
  couponRate: number,
  lastCouponDateStr: string,
  asOfDateStr?: string
): number {
  if (couponRate <= 0 || units <= 0 || faceValue <= 0) return 0;
  const lastDate = parseDate(lastCouponDateStr);
  const asOfDate = asOfDateStr ? parseDate(asOfDateStr) : new Date();

  const msElapsed = asOfDate.getTime() - lastDate.getTime();
  if (msElapsed <= 0) return 0;

  const daysElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24));
  const annualTotal = (units * faceValue * couponRate) / 100;
  const accrued = (annualTotal * daysElapsed) / 365;

  return Math.round(accrued * 100) / 100;
}

/**
 * Approximate Yield to Maturity (YTM) using the standard textbook formula:
 * YTM ≈ [ C + (F - P) / n ] / [ (F + P) / 2 ]
 */
export function calculateBondYtm(
  faceValue: number,
  currentPrice: number,
  couponRate: number,
  maturityDateStr?: string,
  asOfDateStr?: string
): number {
  if (faceValue <= 0 || currentPrice <= 0) return couponRate;
  if (!maturityDateStr) return (faceValue * couponRate) / currentPrice;

  const asOf = asOfDateStr ? parseDate(asOfDateStr) : new Date();
  const matDate = parseDate(maturityDateStr);
  const diffMs = matDate.getTime() - asOf.getTime();
  const remainingYears = Math.max(0.2, diffMs / (1000 * 60 * 60 * 24 * 365.25));

  const annualCoupon = (faceValue * couponRate) / 100;
  const capitalGainPerYear = (faceValue - currentPrice) / remainingYears;
  const averagePrice = (faceValue + currentPrice) / 2;

  const ytm = ((annualCoupon + capitalGainPerYear) / averagePrice) * 100;
  return Math.max(0, Math.round(ytm * 100) / 100);
}

/**
 * Generates the upcoming periodic coupon payout dates based on frequency
 */
export function generateBondNextDates(
  maturityDateStr: string,
  frequency: 'monthly' | 'quarterly' | 'semi_annually' | 'annually' | 'at_maturity',
  purchaseDateStr?: string,
  nextCouponDateOverride?: string
): { nextCouponDate: string; schedule: Array<{ date: string; amount: number; description: string; type: 'coupon' | 'maturity' | 'call' }> } {
  const now = new Date();
  const matDate = parseDate(maturityDateStr || '2031-10-15');
  const basePurchase = nextCouponDateOverride
    ? parseDate(nextCouponDateOverride)
    : (purchaseDateStr ? parseDate(purchaseDateStr) : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));

  let stepMonths = 6;
  if (frequency === 'monthly') stepMonths = 1;
  else if (frequency === 'quarterly') stepMonths = 3;
  else if (frequency === 'semi_annually') stepMonths = 6;
  else if (frequency === 'annually') stepMonths = 12;
  else if (frequency === 'at_maturity') {
    return {
      nextCouponDate: toInputDate(matDate),
      schedule: [{ date: toInputDate(matDate), type: 'maturity', amount: 0, description: 'Cumulative Interest at Maturity' }],
    };
  }

  const futureSchedule: Array<{ date: string; amount: number; description: string; type: 'coupon' | 'maturity' | 'call' }> = [];
  const cur = new Date(basePurchase);

  let nextCouponDate = '';

  if (nextCouponDateOverride) {
    const overrideDate = parseDate(nextCouponDateOverride);
    if (overrideDate.getTime() <= matDate.getTime()) {
      nextCouponDate = toInputDate(overrideDate);
      futureSchedule.push({
        date: nextCouponDate,
        type: 'coupon',
        amount: 0,
        description: `Scheduled Coupon Payout (${frequency.replace('_', ' ')})`,
      });
      cur.setTime(overrideDate.getTime());
    }
  }

  while (cur.getTime() < matDate.getTime() && futureSchedule.length < 10) {
    cur.setMonth(cur.getMonth() + stepMonths);
    if (cur.getTime() <= matDate.getTime()) {
      const dStr = toInputDate(cur);
      if (!nextCouponDate || parseDate(nextCouponDate).getTime() <= now.getTime()) {
        if (cur.getTime() > now.getTime()) {
          nextCouponDate = dStr;
        }
      }
      if (!futureSchedule.some((s) => s.date === dStr)) {
        futureSchedule.push({
          date: dStr,
          type: 'coupon',
          amount: 0,
          description: `Scheduled Coupon Payout (${frequency.replace('_', ' ')})`,
        });
      }
    }
  }

  if (!nextCouponDate || parseDate(nextCouponDate).getTime() <= now.getTime()) {
    const validFuture = futureSchedule.find((s) => parseDate(s.date).getTime() > now.getTime());
    nextCouponDate = validFuture ? validFuture.date : toInputDate(matDate);
  }

  return { nextCouponDate, schedule: futureSchedule };
}

export function computeBondMetrics(
  holding: InvestmentHolding,
  liveMarketPriceOverride?: number,
  globalTransactions?: any[]
): BondHoldingMetrics {
  const unitsHeld = Math.max(0, holding.quantity || 0);
  const originalFaceValue = holding.faceValue && holding.faceValue > 0 ? holding.faceValue : 1000;
  const purchasePricePerUnit = holding.averageBuyPrice > 0 ? holding.averageBuyPrice : (holding.currentPrice || originalFaceValue);
  const rawInvested = unitsHeld * purchasePricePerUnit;

  const marketPricePerUnit =
    liveMarketPriceOverride && liveMarketPriceOverride > 0
      ? liveMarketPriceOverride
      : holding.currentPrice > 0
      ? holding.currentPrice
      : purchasePricePerUnit;

  // Sum all received interest payouts and principal repayments from ledger AND global transactions
  let totalInterestReceived = 0;
  let totalPrincipalRepaid = 0;
  const seenTxIds = new Set<string>();

  (holding.transactions || []).forEach((t) => {
    seenTxIds.add(t.id);
    if (t.type === 'interest' || t.type === 'coupon') {
      totalInterestReceived += t.totalAmount || t.price * t.quantity || 0;
    } else if (t.type === 'principal_repayment') {
      totalPrincipalRepaid += t.totalAmount || t.price * t.quantity || 0;
    }
  });

  if (globalTransactions && Array.isArray(globalTransactions)) {
    globalTransactions.forEach((tx: any) => {
      if (tx.investmentId === holding.id && !seenTxIds.has(tx.id)) {
        if (
          tx.categoryId === 'cat_bond_interest' ||
          tx.categoryId === 'cat_dividends' ||
          tx.type === 'income' ||
          (tx.tags || []).some((tag: string) => tag.toLowerCase().includes('interest') || tag.toLowerCase().includes('coupon'))
        ) {
          totalInterestReceived += tx.amount || 0;
        }
      }
    });
  }

  const principalRepaidPerUnit = unitsHeld > 0 ? totalPrincipalRepaid / unitsHeld : 0;
  const faceValue = Math.max(0, originalFaceValue - principalRepaidPerUnit);

  // Principal Back reduces invested cost directly
  const totalInvested = Math.max(0, rawInvested - totalPrincipalRepaid);
  const rawValuation = unitsHeld * marketPricePerUnit;
  const currentValuation = Math.max(0, rawValuation - totalPrincipalRepaid);

  const unrealizedGainLoss = totalInterestReceived;
  const unrealizedGainLossPercent = totalInvested > 0 ? (unrealizedGainLoss / totalInvested) * 100 : 0;

  const couponRate = holding.couponRate !== undefined ? holding.couponRate : 7.5;
  const frequency = holding.couponFrequency || 'semi_annually';
  const frequencyLabel =
    frequency === 'monthly'
      ? 'Monthly'
      : frequency === 'quarterly'
      ? 'Quarterly'
      : frequency === 'semi_annually'
      ? 'Semi-Annually'
      : frequency === 'annually'
      ? 'Annually'
      : 'At Maturity';

  let periodsPerYear = 2;
  if (frequency === 'monthly') periodsPerYear = 12;
  else if (frequency === 'quarterly') periodsPerYear = 4;
  else if (frequency === 'semi_annually') periodsPerYear = 2;
  else if (frequency === 'annually') periodsPerYear = 1;
  else if (frequency === 'at_maturity') periodsPerYear = 0;

  // Annual Coupon Income based strictly on Face Value (Par)
  const annualCouponIncome = Math.round(((unitsHeld * faceValue * couponRate) / 100) * 100) / 100;
  const periodicCouponAmount =
    periodsPerYear > 0 ? Math.round((annualCouponIncome / periodsPerYear) * 100) / 100 : annualCouponIncome;

  const currentYield =
    marketPricePerUnit > 0
      ? Math.round(((faceValue * couponRate) / marketPricePerUnit) * 100) / 100
      : couponRate;

  const maturityDateStr = holding.maturityDate || '2031-10-15';
  const ytm =
    holding.ytm !== undefined
      ? holding.ytm
      : calculateBondYtm(faceValue, marketPricePerUnit, couponRate, maturityDateStr);

  const now = new Date();
  const matDate = parseDate(maturityDateStr);
  const remainingMs = matDate.getTime() - now.getTime();
  const remainingMonths = Math.max(0, Math.round(remainingMs / (1000 * 60 * 60 * 24 * 30.4375)));
  const remainingYears = Math.floor(remainingMonths / 12);
  const remMonthsPart = remainingMonths % 12;
  const remainingTenureText =
    remainingMs <= 0
      ? 'Matured'
      : remainingYears > 0
      ? `${remainingYears}y ${remMonthsPart}m remaining`
      : `${remainingMonths} months remaining`;

  // Issuer deduction
  let issuer = holding.issuer || '';
  if (!issuer) {
    if (holding.name.toLowerCase().includes('goi') || holding.symbol.toLowerCase().includes('goi')) {
      issuer = 'Government of India (RBI)';
    } else if (holding.name.toLowerCase().includes('rec')) {
      issuer = 'Rural Electrification Corporation Ltd (REC)';
    } else if (holding.name.toLowerCase().includes('pfc')) {
      issuer = 'Power Finance Corporation (PFC)';
    } else if (holding.name.toLowerCase().includes('nhai')) {
      issuer = 'National Highways Authority of India (NHAI)';
    } else if (holding.name.toLowerCase().includes('hdfc')) {
      issuer = 'HDFC Bank Ltd';
    } else {
      issuer = holding.name.split(/\s+/).slice(0, 2).join(' ') || 'Bond Issuer';
    }
  }

  // Bond Type deduction
  let bondType: BondType = holding.bondType || 'corporate';
  if (!holding.bondType) {
    if (holding.name.toLowerCase().includes('goi') || holding.name.toLowerCase().includes('g-sec')) {
      bondType = 'g_sec';
    } else if (holding.name.toLowerCase().includes('t-bill') || holding.name.toLowerCase().includes('treasury')) {
      bondType = 't_bill';
    } else if (holding.name.toLowerCase().includes('tax free') || holding.name.toLowerCase().includes('tax-free')) {
      bondType = 'tax_free';
    } else if (holding.name.toLowerCase().includes('rec') || holding.name.toLowerCase().includes('pfc') || holding.name.toLowerCase().includes('ntpc')) {
      bondType = 'psu';
    }
  }

  // Calculate next coupon date and cash flow schedule
  const { nextCouponDate, schedule } = generateBondNextDates(
    maturityDateStr,
    frequency,
    holding.purchaseDate,
    holding.nextCouponDate
  );

  const nowTime = now.getTime();
  const pastSchedules = schedule
    .filter((s) => parseDate(s.date).getTime() <= nowTime)
    .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

  let accrualStartDateStr = holding.purchaseDate || '2025-04-15';
  if (pastSchedules.length > 0) {
    accrualStartDateStr = pastSchedules[0].date;
  }

  const accruedInterest =
    holding.accruedInterest !== undefined
      ? holding.accruedInterest
      : calculateBondAccruedInterest(faceValue, unitsHeld, couponRate, accrualStartDateStr);

  const populatedSchedule = schedule.map((s) => ({
    ...s,
    amount: periodicCouponAmount,
  }));

  // Add final redemption on maturity
  const redemptionValue = holding.redemptionValue || unitsHeld * faceValue;
  if (populatedSchedule.length > 0) {
    populatedSchedule.push({
      date: maturityDateStr,
      type: 'maturity',
      amount: redemptionValue,
      description: `Par Capital Redemption (${unitsHeld} units @ ₹${faceValue} face value)`,
    });
  }

  const finalNextCouponDate = holding.nextCouponDate || nextCouponDate;

  return {
    holdingId: holding.id,
    name: holding.name,
    issuer,
    bondType,
    bondTypeLabel: BOND_TYPE_LABELS[bondType] || 'Bond',
    isin: holding.isin || 'INE' + holding.symbol.padEnd(9, '0').toUpperCase(),
    creditRating: holding.creditRating || (bondType === 'g_sec' ? 'SOVEREIGN' : 'CRISIL AAA'),
    unitsHeld,
    faceValue,
    purchasePricePerUnit,
    totalInvested,
    marketPricePerUnit,
    currentValuation,
    unrealizedGainLoss,
    unrealizedGainLossPercent,
    couponRate,
    frequency,
    frequencyLabel,
    currentYield,
    ytm,
    annualCouponIncome,
    periodicCouponAmount,
    totalInterestReceived,
    totalPrincipalRepaid,
    accruedInterest,
    nextCouponPaymentDate: finalNextCouponDate,
    maturityDate: maturityDateStr,
    redemptionValue,
    remainingTenureText,
    xirr: calculateBondXIRR(holding as any, now, currentValuation),
    cashFlowSchedule: populatedSchedule as any,
  };
}

export function computeBondsSummary(
  bondHoldings: InvestmentHolding[],
  getHoldingMarketPrice?: (h: InvestmentHolding) => { price: number }
): BondsSummaryMetrics {
  let currentValuation = 0;
  let totalInvested = 0;
  let totalInterestReceived = 0;
  let totalAccruedInterest = 0;
  let annualCouponIncome = 0;
  let totalUnitsHeld = 0;
  let couponWeightedSum = 0;
  let ytmWeightedSum = 0;

  bondHoldings.forEach((h) => {
    const livePrice = getHoldingMarketPrice ? getHoldingMarketPrice(h).price : h.currentPrice;
    const m = computeBondMetrics(h, livePrice);
    currentValuation += m.currentValuation;
    totalInvested += m.totalInvested;
    totalInterestReceived += m.totalInterestReceived;
    totalAccruedInterest += m.accruedInterest;
    annualCouponIncome += m.annualCouponIncome;
    totalUnitsHeld += m.unitsHeld;
    couponWeightedSum += m.couponRate * m.currentValuation;
    ytmWeightedSum += m.ytm * m.currentValuation;
  });

  const unrealizedGainLoss = totalAccruedInterest;
  const unrealizedGainLossPercent =
    totalInvested > 0 ? (unrealizedGainLoss / totalInvested) * 100 : 0;
  const weightedCouponRate =
    currentValuation > 0 ? couponWeightedSum / currentValuation : 0;
  const weightedYtm =
    currentValuation > 0 ? ytmWeightedSum / currentValuation : 0;

  return {
    currentValuation,
    totalInvested,
    unrealizedGainLoss,
    unrealizedGainLossPercent,
    totalInterestReceived,
    totalAccruedInterest,
    annualCouponIncome,
    totalBondsCount: bondHoldings.length,
    totalUnitsHeld,
    weightedCouponRate: Math.round(weightedCouponRate * 100) / 100,
    weightedYtm: Math.round(weightedYtm * 100) / 100,
    portfolioXirr: calculateBondsPortfolioXIRR(bondHoldings),
  };
}

// ============================================================================
// PROVIDENT FUND (PF) ENGINE & PASSBOOK LEDGER
// ============================================================================

export interface PfFinancialYearRecord {
  financialYear: string; // e.g. "FY 2025-26"
  openingBalance: number;
  employeeContributions: number;
  employerContributions: number;
  voluntaryContributions: number;
  withdrawals: number;
  interestCredited: number;
  closingBalance: number;
  transactions: InvestmentTransaction[];
}

export interface PfHoldingMetrics {
  holdingId: string;
  accountName: string;
  pfType: PfType;
  pfTypeLabel: string;
  accountIdentifier: string; // UAN or Account Number
  interestRate: number; // e.g. 8.25% p.a.
  interestCalculationMethod: string;
  totalCorpusBalance: number;
  totalEmployeeContributions: number;
  totalEmployerContributions: number;
  totalVoluntaryContributions: number;
  totalInterestCredited: number;
  totalWithdrawals: number;
  currentFyContributions: number; // For FY 2026-27
  currentFyEstimatedInterest: number; // Estimated accrual for ongoing FY
  monthlySubscription?: {
    enabled: boolean;
    employeeAmount: number;
    employerAmount: number;
    totalMonthly: number;
    dayOfMonth: number;
  };
  lastUpdatedDate: string;
  xirr: number | null;
  financialYearLedger: PfFinancialYearRecord[];
}

export interface PfSummaryMetrics {
  totalPfBalance: number;
  totalEmployeeContributions: number;
  totalEmployerContributions: number;
  totalVoluntaryContributions: number;
  totalInterestCredited: number;
  totalWithdrawals: number;
  currentFyContributions: number;
  currentFyEstimatedInterest: number;
  totalAccountsCount: number;
  hasEmployerContribution: boolean; // false for PPF-only portfolios
  portfolioXirr: number | null;
}

export const PF_SCHEME_LABELS: Record<PfType, string> = {
  EPF: "Employees' Provident Fund (EPF)",
  PPF: 'Public Provident Fund (PPF)',
  VPF: "Voluntary Provident Fund (VPF)",
  GPF: 'General Provident Fund (GPF)',
  CUSTOM: 'Custom Provident Fund',
};

/**
 * Determine Indian Financial Year from date (e.g. 2026-05-10 -> "FY 2026-27")
 */
export function getIndianFinancialYear(dateStr: string): string {
  const d = parseDate(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  if (month >= 4) {
    return `FY ${year}-${String(year + 1).slice(-2)}`;
  } else {
    return `FY ${year - 1}-${String(year).slice(-2)}`;
  }
}

/**
 * Identify current active Financial Year
 */
export function getCurrentFinancialYear(): string {
  return getIndianFinancialYear(toInputDate(new Date()));
}

export function computePfMetrics(holding: InvestmentHolding): PfHoldingMetrics {
  const pfType: PfType = holding.pfType || 'EPF';
  const interestRate =
    holding.interestRate !== undefined && holding.interestRate > 0
      ? holding.interestRate
      : pfType === 'EPF'
      ? 8.25
      : pfType === 'PPF'
      ? 7.1
      : 8.0;

  const accountIdentifier = holding.uanOrAccountNumber || (pfType === 'EPF' ? 'UAN 101489201934' : 'PPF Acc 31089201');
  const accountName = holding.customDisplayName || holding.name || PF_SCHEME_LABELS[pfType];

  const currentFY = getCurrentFinancialYear();

  // Process transaction ledger chronologically (Opening balance is always 0; corpus derived from subscriptions + interest - withdrawals)
  const txs = [...(holding.transactions || [])].sort((a, b) => {
    return parseDate(a.date).getTime() - parseDate(b.date).getTime();
  });

  const initialCorpus = (holding.openingBalance !== undefined && holding.openingBalance > 0)
    ? holding.openingBalance
    : (holding.quantity > 0 ? holding.quantity : 0);

  let runningBalance = 0;
  let totalEmployee = 0;
  let totalEmployer = 0;
  let totalVoluntary = 0;
  let totalInterest = 0;
  let totalWithdrawals = 0;
  let currentFyContribSum = 0;

  const fyMap: Record<string, PfFinancialYearRecord> = {};

  txs.forEach((t) => {
    const fy = t.financialYear || getIndianFinancialYear(t.date);
    if (!fyMap[fy]) {
      fyMap[fy] = {
        financialYear: fy,
        openingBalance: runningBalance,
        employeeContributions: 0,
        employerContributions: 0,
        voluntaryContributions: 0,
        withdrawals: 0,
        interestCredited: 0,
        closingBalance: runningBalance,
        transactions: [],
      };
    }

    fyMap[fy].transactions.push(t);

    const isWithdrawal = t.type === 'sell' || t.type === 'withdrawal';
    const isInterest = t.type === 'interest' || t.type === 'coupon';

    if (isWithdrawal) {
      const amt = t.totalAmount || t.quantity;
      totalWithdrawals += amt;
      runningBalance = Math.max(0, runningBalance - amt);
      fyMap[fy].withdrawals += amt;
    } else if (isInterest) {
      const amt = t.totalAmount || t.price * t.quantity;
      totalInterest += amt;
      runningBalance += amt;
      fyMap[fy].interestCredited += amt;
    } else {
      // Contribution or buy
      let empAmt = t.employeeAmount || 0;
      let empyrAmt = t.employerAmount || 0;
      let volAmt = t.voluntaryAmount || 0;

      if (!empAmt && !empyrAmt && !volAmt) {
        // If unspecified, split based on notes or standard 50-50 for EPF
        const totalAmt = t.totalAmount || t.quantity;
        if (pfType === 'EPF' && t.notes?.toLowerCase().includes('employer')) {
          empAmt = totalAmt / 2;
          empyrAmt = totalAmt / 2;
        } else if (pfType === 'PPF') {
          empAmt = totalAmt;
        } else {
          empAmt = totalAmt;
        }
      }

      totalEmployee += empAmt;
      totalEmployer += empyrAmt;
      totalVoluntary += volAmt;
      const totalContr = empAmt + empyrAmt + volAmt;

      runningBalance += totalContr;
      fyMap[fy].employeeContributions += empAmt;
      fyMap[fy].employerContributions += empyrAmt;
      fyMap[fy].voluntaryContributions += volAmt;

      if (fy === currentFY) {
        currentFyContribSum += totalContr;
      }
    }

    fyMap[fy].closingBalance = runningBalance;
  });

  // If no transactions or no explicit contribution amounts, derive principal contributions from running balance
  if (txs.length === 0 && runningBalance === 0) {
    runningBalance = holding.openingBalance || holding.quantity || 0;
  }

  if (totalEmployee === 0 && totalEmployer === 0 && totalVoluntary === 0 && runningBalance > 0) {
    const netPrincipal = Math.max(0, runningBalance - totalInterest);
    if (pfType === 'PPF' || pfType === 'VPF') {
      totalEmployee = netPrincipal;
    } else {
      totalEmployee = netPrincipal / 2;
      totalEmployer = netPrincipal / 2;
    }
  }

  // Estimated accrual interest for current FY using official EPFO monthly running balance formula
  const estimatedRes = calculatePfMonthlyRunningBalanceInterest(
    initialCorpus,
    txs,
    interestRate,
    toInputDate(new Date())
  );
  const currentFyEstimatedInterest = estimatedRes.totalInterest;

  const financialYearLedger = Object.values(fyMap).sort((a, b) => b.financialYear.localeCompare(a.financialYear));

  return {
    holdingId: holding.id,
    accountName,
    pfType,
    pfTypeLabel: PF_SCHEME_LABELS[pfType] || 'Provident Fund',
    accountIdentifier,
    interestRate,
    interestCalculationMethod:
      holding.interestCalculationMethod ||
      (pfType === 'EPF'
        ? 'Monthly Running Balance with Annual Compounding (EPFO Rules)'
        : 'Minimum Balance between 5th & End of Month (PPF Rules)'),
    totalCorpusBalance: runningBalance,
    totalEmployeeContributions: totalEmployee,
    totalEmployerContributions: totalEmployer,
    totalVoluntaryContributions: totalVoluntary,
    totalInterestCredited: totalInterest,
    totalWithdrawals,
    currentFyContributions: currentFyContribSum,
    currentFyEstimatedInterest,
    monthlySubscription: holding.subscription
      ? {
          enabled: holding.subscription.enabled,
          employeeAmount: holding.subscription.amount,
          employerAmount: holding.subscription.employerAmount || 0,
          totalMonthly: holding.subscription.amount + (holding.subscription.employerAmount || 0),
          dayOfMonth: holding.subscription.dayOfMonth || 5,
        }
      : undefined,
    lastUpdatedDate: holding.lastPriceUpdate || toInputDate(new Date()),
    xirr: calculatePfXIRR(holding),
    financialYearLedger,
  };
}

export function computePfSummary(pfHoldings: InvestmentHolding[]): PfSummaryMetrics {
  let totalPfBalance = 0;
  let totalEmployee = 0;
  let totalEmployer = 0;
  let totalVoluntary = 0;
  let totalInterest = 0;
  let totalWithdrawals = 0;
  let currentFyContribSum = 0;
  let currentFyInterestSum = 0;

  pfHoldings.forEach((h) => {
    const m = computePfMetrics(h);
    totalPfBalance += m.totalCorpusBalance;
    totalEmployee += m.totalEmployeeContributions;
    totalEmployer += m.totalEmployerContributions;
    totalVoluntary += m.totalVoluntaryContributions;
    totalInterest += m.totalInterestCredited;
    totalWithdrawals += m.totalWithdrawals;
    currentFyContribSum += m.currentFyContributions;
    currentFyInterestSum += m.currentFyEstimatedInterest;
  });

  const hasEmployerContribution = pfHoldings.some((h) => (h.pfType || 'EPF') === 'EPF');

  return {
    totalPfBalance,
    totalEmployeeContributions: totalEmployee,
    totalEmployerContributions: totalEmployer,
    totalVoluntaryContributions: totalVoluntary,
    totalInterestCredited: totalInterest,
    totalWithdrawals,
    currentFyContributions: currentFyContribSum,
    currentFyEstimatedInterest: currentFyInterestSum,
    totalAccountsCount: pfHoldings.length,
    hasEmployerContribution,
    portfolioXirr: calculatePfPortfolioXIRR(pfHoldings),
  };
}

export function calculatePfMonthlyRunningBalanceInterest(
  openingBalance: number,
  transactions: InvestmentTransaction[],
  interestRate: number,
  asOfDateStr?: string
): { totalInterest: number; sumOfMonthlyBalances: number } {
  const asOf = asOfDateStr ? parseDate(asOfDateStr) : new Date();
  const targetFy = getIndianFinancialYear(toInputDate(asOf));
  const [_, yearsPart] = targetFy.split(' ');
  if (!yearsPart) {
    const interest = (openingBalance * (interestRate / 100));
    return { totalInterest: Math.round(interest), sumOfMonthlyBalances: openingBalance * 12 };
  }

  const [startYearStr] = yearsPart.split('-');
  const startYear = parseInt(startYearStr, 10);

  const prevFyOpening = getPrevFyClosingBalance(openingBalance, transactions, startYear);
  let currentBal = prevFyOpening;
  let sumOfBalances = 0;
  let monthsCount = 0;

  for (let m = 0; m < 12; m++) {
    const calendarYear = m <= 8 ? startYear : startYear + 1;
    const calendarMonth = m <= 8 ? m + 4 : m - 8;

    const monthStartDate = new Date(calendarYear, calendarMonth - 1, 1);
    if (monthStartDate.getTime() > asOf.getTime()) {
      break;
    }

    let netAdditions = 0;
    transactions.forEach((t) => {
      const tDate = parseDate(t.date);
      if (tDate.getFullYear() === calendarYear && (tDate.getMonth() + 1) === calendarMonth) {
        if (tDate.getTime() <= asOf.getTime()) {
          const isWithdrawal = t.type === 'sell' || t.type === 'withdrawal';
          const isInterest = t.type === 'interest' || t.type === 'coupon';
          if (!isWithdrawal && !isInterest) {
            const emp = t.employeeAmount || 0;
            const empyr = t.employerAmount || 0;
            const vol = t.voluntaryAmount || 0;
            const amt = (emp || empyr || vol) ? (emp + empyr + vol) : (t.totalAmount || t.quantity || 0);
            netAdditions += amt;
          } else if (isWithdrawal) {
            const amt = t.totalAmount || t.quantity || 0;
            netAdditions -= amt;
          }
        }
      }
    });

    const monthOpening = currentBal;
    currentBal = Math.max(0, currentBal + netAdditions);
    const monthClosing = currentBal;

    sumOfBalances += monthClosing;
    monthsCount++;
  }

  if (monthsCount === 0) monthsCount = 1;

  // EPFO formula: (Sum of Monthly Opening Balances * Interest Rate) / 1200
  const totalInterest = (sumOfBalances * interestRate) / 1200;

  return {
    totalInterest: Math.round(Math.max(1, totalInterest) * 100) / 100,
    sumOfMonthlyBalances: sumOfBalances,
  };
}

function getPrevFyClosingBalance(openingBalance: number, transactions: InvestmentTransaction[], startYear: number): number {
  const cutoffDate = new Date(startYear, 3, 1);
  let bal = openingBalance;
  (transactions || []).forEach((t) => {
    const tDate = parseDate(t.date);
    if (tDate.getTime() < cutoffDate.getTime()) {
      const isWithdrawal = t.type === 'sell' || t.type === 'withdrawal';
      const isInterest = t.type === 'interest' || t.type === 'coupon';
      const amt = t.totalAmount || (t.price * t.quantity) || t.quantity || 0;
      if (isWithdrawal) {
        bal = Math.max(0, bal - amt);
      } else if (isInterest) {
        bal += amt;
      } else {
        const emp = t.employeeAmount || 0;
        const empyr = t.employerAmount || 0;
        const vol = t.voluntaryAmount || 0;
        const contr = (emp || empyr || vol) ? (emp + empyr + vol) : amt;
        bal += contr;
      }
    }
  });
  return bal;
}

/**
 * Calculates suggested PF interest taking March 31 closing balance of previous FY
 * plus current FY monthly subscriptions up to asOfDateStr using EPFO monthly running balance formula.
 */
export function computePfSuggestedInterest(holding: InvestmentHolding, asOfDateStr: string): number {
  const m = computePfMetrics(holding);
  const rate = m.interestRate;
  const res = calculatePfMonthlyRunningBalanceInterest(holding.openingBalance || 0, holding.transactions || [], rate, asOfDateStr);
  return res.totalInterest;
}
