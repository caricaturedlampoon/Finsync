/**
 * Real-World Portfolio & Holding 1-Day Change Engine
 *
 * Implements standard financial accounting for 1-Day Performance matching
 * professional brokerage and portfolio apps (e.g., Zerodha Kite, Groww, INDmoney).
 *
 * Principles:
 * 1. Last Day Value (Previous Session Value):
 *    Value of positions held at the close of the PREVIOUS business trading session:
 *    Last Day Value = Overnight Quantity × Previous Close Price (or NAV).
 *
 * 2. Day Change (₹):
 *    - For overnight positions: Overnight Quantity × (Current Market Price - Previous Close Price)
 *    - For positions bought today: Units Bought Today × (Current Market Price - Execution Buy Price)
 *    - For positions sold today: Units Sold Today × (Execution Sell Price - Previous Close Price)
 *    Total Day Change = Sum of changes across overnight and intraday movements.
 *    Equivalently: (Today's Valuation + Today's Realized Sell Proceeds) - (Last Day Valuation + Today's Purchase Outflow).
 *
 * 3. 1-Day Change (%):
 *    Total Day Change / (Last Day Valuation + Today's Purchase Outflow) × 100.
 *
 * 4. Trading Day Calendar:
 *    Automatically resolves previous business day (skipping weekends & NSE/BSE holidays).
 */

import { InvestmentHolding, InvestmentAssetType } from '../types';
import { getMostRecentTradingDay, getPreviousTradingDay } from '../services/marketPriceFetcher';

export interface HoldingDayPerformance {
  holdingId: string;
  symbol: string;
  name: string;
  customDisplayName?: string;
  assetType: InvestmentAssetType;
  currentQuantity: number;
  yesterdayQuantity: number;
  currentPrice: number;
  previousClosePrice: number;
  currentDate: string;
  previousCloseDate: string;
  lastDayValue: number;
  todayValue: number;
  dayChangeValue: number;
  dayChangePercent: number;
  isDayPositive: boolean;
  todayBoughtQty: number;
  todayBoughtCost: number;
  todaySoldQty: number;
  todaySoldProceeds: number;
  hasTradesToday: boolean;
}

export interface PortfolioDayPerformance {
  totalCurrentValue: number;
  totalLastDayValue: number;
  totalDayChange: number;
  totalDayChangePercent: number;
  isDayPositive: boolean;
  previousCloseDate: string;
  currentDate: string;
  holdingPerformances: HoldingDayPerformance[];
  gainers: HoldingDayPerformance[];
  losers: HoldingDayPerformance[];
  unchanged: HoldingDayPerformance[];
  totalHoldingsCount: number;
  gainersCount: number;
  losersCount: number;
  todayTotalBoughtCost: number;
  todayTotalSoldProceeds: number;
}

/**
 * Format a YYYY-MM-DD date into a friendly readable business day format
 * e.g. "Thursday, 15 Oct 2026" or "15 Oct 2026"
 */
export function formatTradingDate(isoDateStr?: string, includeDayOfWeek: boolean = true): string {
  if (!isoDateStr) return 'Previous Trading Session';
  try {
    const parts = isoDateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const options: Intl.DateTimeFormatOptions = {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          ...(includeDayOfWeek ? { weekday: 'short' } : {}),
        };
        return d.toLocaleDateString('en-IN', options);
      }
    }
    return isoDateStr;
  } catch {
    return isoDateStr;
  }
}

/**
 * Calculate 1-Day performance for a single holding with intraday trade awareness
 */
export function calculateHoldingDayPerformance(
  holding: InvestmentHolding,
  marketPriceInfo?: {
    price: number;
    previousPrice: number;
    date: string;
    previousDate?: string;
  }
): HoldingDayPerformance {
  const currentPrice = marketPriceInfo?.price ?? holding.currentPrice;
  const currentDate = marketPriceInfo?.date || holding.lastPriceUpdate || getMostRecentTradingDay();

  // Resolve previous close date
  const resolvedPrevDate =
    marketPriceInfo?.previousDate ||
    holding.previousCloseDate ||
    getPreviousTradingDay(currentDate);

  // Resolve previous close price:
  // If not explicitly provided, and no valid fallback exists, default to current price (0% change)
  let previousClosePrice = marketPriceInfo?.previousPrice ?? holding.previousClosePrice ?? 0;
  if (!previousClosePrice || previousClosePrice <= 0) {
    previousClosePrice = currentPrice;
  }

  // Check for transactions executed today (or on current price date)
  let todayBoughtQty = 0;
  let todayBoughtCost = 0;
  let todaySoldQty = 0;
  let todaySoldProceeds = 0;

  const txs = holding.transactions || [];
  for (const t of txs) {
    if (t.date && t.date >= currentDate) {
      if (t.type === 'buy') {
        todayBoughtQty += t.quantity;
        todayBoughtCost += t.totalAmount > 0 ? t.totalAmount : t.quantity * t.price;
      } else if (t.type === 'sell') {
        todaySoldQty += t.quantity;
        todaySoldProceeds += t.totalAmount > 0 ? t.totalAmount : t.quantity * t.price;
      }
    }
  }

  const hasTradesToday = todayBoughtQty > 0 || todaySoldQty > 0;

  // Quantity held overnight at the close of previous trading day
  const yesterdayQuantity = Math.max(0, holding.quantity - todayBoughtQty + todaySoldQty);

  // Values
  const lastDayValue = yesterdayQuantity * previousClosePrice;
  const todayValue = holding.quantity * currentPrice;

  // Day Change (₹)
  let dayChangeValue = 0;
  if (!hasTradesToday) {
    // Normal overnight holding: quantity * (current - previous)
    dayChangeValue = holding.quantity * (currentPrice - previousClosePrice);
  } else {
    // Real-world portfolio accounting with intraday trades:
    // Overnight position gain + intraday purchases gain + intraday sells gain
    const overnightGain = yesterdayQuantity * (currentPrice - previousClosePrice);
    const avgBuyPriceToday = todayBoughtQty > 0 ? todayBoughtCost / todayBoughtQty : currentPrice;
    const intradayBuyGain = todayBoughtQty * (currentPrice - avgBuyPriceToday);
    const intradaySellGain = todaySoldQty > 0 ? todaySoldProceeds - todaySoldQty * previousClosePrice : 0;
    dayChangeValue = overnightGain + intradayBuyGain + intradaySellGain;
  }

  // Day Change (%)
  const effectiveBase = lastDayValue + todayBoughtCost;
  const dayChangePercent =
    effectiveBase > 0
      ? (dayChangeValue / effectiveBase) * 100
      : previousClosePrice > 0
      ? ((currentPrice - previousClosePrice) / previousClosePrice) * 100
      : 0;

  return {
    holdingId: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    customDisplayName: holding.customDisplayName,
    assetType: holding.assetType,
    currentQuantity: holding.quantity,
    yesterdayQuantity,
    currentPrice,
    previousClosePrice,
    currentDate,
    previousCloseDate: resolvedPrevDate,
    lastDayValue,
    todayValue,
    dayChangeValue,
    dayChangePercent,
    isDayPositive: dayChangeValue >= 0,
    todayBoughtQty,
    todayBoughtCost,
    todaySoldQty,
    todaySoldProceeds,
    hasTradesToday,
  };
}

/**
 * Calculate dynamic 1-Day performance for the entire portfolio or filtered list of holdings
 */
export function calculatePortfolioDayPerformance(
  holdings: InvestmentHolding[],
  getHoldingMarketPrice: (h: InvestmentHolding) => {
    price: number;
    previousPrice: number;
    date: string;
    previousDate?: string;
  }
): PortfolioDayPerformance {
  const activeHoldings = holdings.filter((h) => h.quantity > 0 || (h.transactions && h.transactions.some((t) => t.date >= getMostRecentTradingDay())));

  let totalCurrentVal = 0;
  let totalLastDayVal = 0;
  let totalDayChangeVal = 0;
  let todayTotalBoughtCost = 0;
  let todayTotalSoldProceeds = 0;

  const performances: HoldingDayPerformance[] = [];

  // Track previous close dates to find the dominant trading date
  const prevDateCounts: Record<string, number> = {};

  for (const h of activeHoldings) {
    const pInfo = getHoldingMarketPrice(h);
    const perf = calculateHoldingDayPerformance(h, pInfo);
    performances.push(perf);

    totalCurrentVal += perf.todayValue;
    totalLastDayVal += perf.lastDayValue;
    totalDayChangeVal += perf.dayChangeValue;
    todayTotalBoughtCost += perf.todayBoughtCost;
    todayTotalSoldProceeds += perf.todaySoldProceeds;

    if (perf.previousCloseDate) {
      prevDateCounts[perf.previousCloseDate] = (prevDateCounts[perf.previousCloseDate] || 0) + 1;
    }
  }

  // Determine the primary previous close date (the most common or fallback to previous trading day)
  let primaryPrevDate = '';
  let maxCount = -1;
  for (const [date, count] of Object.entries(prevDateCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primaryPrevDate = date;
    }
  }
  if (!primaryPrevDate) {
    primaryPrevDate = getPreviousTradingDay(getMostRecentTradingDay());
  }

  const currentDate = getMostRecentTradingDay();

  const totalEffectiveBase = totalLastDayVal + todayTotalBoughtCost;
  const totalDayChangePercent =
    totalEffectiveBase > 0 ? (totalDayChangeVal / totalEffectiveBase) * 100 : 0;

  // Sort gainers and losers
  const gainers = performances
    .filter((p) => p.dayChangeValue > 0)
    .sort((a, b) => b.dayChangeValue - a.dayChangeValue);

  const losers = performances
    .filter((p) => p.dayChangeValue < 0)
    .sort((a, b) => a.dayChangeValue - b.dayChangeValue);

  const unchanged = performances.filter((p) => p.dayChangeValue === 0);

  // All performances sorted by absolute value of day change
  const holdingPerformances = [...performances].sort(
    (a, b) => Math.abs(b.dayChangeValue) - Math.abs(a.dayChangeValue)
  );

  return {
    totalCurrentValue: totalCurrentVal,
    totalLastDayValue: totalLastDayVal,
    totalDayChange: totalDayChangeVal,
    totalDayChangePercent,
    isDayPositive: totalDayChangeVal >= 0,
    previousCloseDate: primaryPrevDate,
    currentDate,
    holdingPerformances,
    gainers,
    losers,
    unchanged,
    totalHoldingsCount: performances.length,
    gainersCount: gainers.length,
    losersCount: losers.length,
    todayTotalBoughtCost,
    todayTotalSoldProceeds,
  };
}
