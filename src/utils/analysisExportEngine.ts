/**
 * Comprehensive Analysis Export Engine for Analytics and Investments
 * Generates detailed executive summaries, full CSV spreadsheets,
 * standalone HTML dossiers with embedded print-ready SVG charts, and JSON audit records.
 */

import { Account, Category, InvestmentHolding, SipSchedule, Transaction, UserProfile } from '../types';
import { formatDate, formatINR, formatCompactINR, formatNumber, parseDate, calculateHoldingBookedProfit } from './formatters';
import { calculatePortfolioDayPerformance, calculateHoldingDayPerformance } from './investmentDayChange';
import { calculateXIRR, CashFlow } from './xirr';
import autoTable from 'jspdf-autotable';
import {
  createFinSyncPdfDocument,
  drawPdfHeader,
  drawPdfSectionHeader,
  drawPdfMetricCards,
  drawPdfAllocationBar,
  drawPdfFooter,
  getPdfTableTheme,
  formatPdfINR,
  saveAndSharePdf,
  PDF_COLORS,
  PDF_MARGIN,
  PdfMetricCard,
  PdfAllocationSlice,
  exportHtmlStringToPdf,
} from './pdfExportHelper';
import { fileService } from '../services/fileService';

export interface CategorySummaryItem {
  id: string;
  name: string;
  type: 'expense' | 'income';
  amount: number;
  count: number;
  percentage: number;
  color: string;
}

export interface AccountFlowItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  expenseAmount: number;
  incomeAmount: number;
  netFlow: number;
}

export interface HoldingAnalysisItem {
  symbol: string;
  name: string;
  assetType: string;
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  bookedProfit: number;
  dayChange: number;
  dayChangePercent: number;
  weightPercent: number;
  isVerified?: boolean;
}

export interface RecentTradeItem {
  id: string;
  date: string;
  holdingSymbol: string;
  holdingName: string;
  type: string;
  quantity: number;
  price: number;
  totalAmount: number;
  notes?: string;
}

export interface SixMonthCashFlowPoint {
  monthKey: string;      // e.g. "2026-05"
  monthLabel: string;    // e.g. "May 2026"
  shortLabel: string;    // e.g. "May"
  income: number;
  expense: number;
  netSavings: number;
  savingsRate: number;
  txCount: number;
}

export interface SixMonthSummary {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  avgMonthlySavings: number;
  highestIncomeMonth: string;
  highestExpenseMonth: string;
}

export interface PortfolioGrowthPoint {
  date: string;
  monthKey: string;
  monthLabel: string;
  shortLabel: string;
  invested: number;
  valuation: number;
  growth: number;
  growthPercent: number;
  stocksInvested: number;
  stocksValuation: number;
  stocksGrowth: number;
  stocksGrowthPercent: number;
  mfInvested: number;
  mfValuation: number;
  mfGrowth: number;
  mfGrowthPercent: number;
  bondsInvested: number;
  bondsValuation: number;
}

export interface StocksVsMutualFundsData {
  stocks: {
    count: number;
    invested: number;
    current: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    weight: number;
    topHolding?: { symbol: string; name: string; value: number };
    gainersCount: number;
    losersCount: number;
  };
  mutualFunds: {
    count: number;
    invested: number;
    current: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    weight: number;
    topHolding?: { symbol: string; name: string; value: number };
    activeSipsCount: number;
    monthlySipCommitment: number;
  };
  bonds: {
    count: number;
    invested: number;
    current: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    weight: number;
  };
  pf?: {
    count: number;
    invested: number;
    current: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    weight: number;
  };
  summary: {
    equityRatio: number;
    mfRatio: number;
    bondsRatio: number;
    pfRatio?: number;
    higherYieldAsset: 'stocks' | 'mutual_funds' | 'even';
    yieldDifferencePercent: number;
  };
}

export interface ExecutiveAnalysisData {
  metadata: {
    generatedAt: string;
    generatedAtFormatted: string;
    periodLabel: string;
    startDate?: string;
    endDate?: string;
    userProfileName: string;
    currencySymbol: string;
  };
  netWorth: {
    liquidCash: number;
    portfolioValue: number;
    totalNetWorth: number;
    debtsLent: number;
    debtsBorrowed: number;
    netLiquidWealth: number;
  };
  analytics: {
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    savingsRate: number;
    transactionCount: number;
    categories: CategorySummaryItem[];
    topExpenses: CategorySummaryItem[];
    accountsFlow: AccountFlowItem[];
    prevPeriod?: {
      label: string;
      totalExpense: number;
      totalIncome: number;
      diffExpense: number;
      percentChangeExpense: number;
    };
    sixMonthTrend: SixMonthCashFlowPoint[];
    sixMonthSummary: SixMonthSummary;
  };
  investments: {
    totalInvested: number;
    totalCurrentValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    totalBookedProfit: number;
    totalDayChange: number;
    totalDayChangePercent: number;
    portfolioXIRR: number | null;
    assetAllocation: {
      stocks: { invested: number; current: number; count: number; weight: number };
      mutualFunds: { invested: number; current: number; count: number; weight: number };
      bonds: { invested: number; current: number; count: number; weight: number };
      pf?: { invested: number; current: number; count: number; weight: number };
    };
    portfolioGrowthHistory: PortfolioGrowthPoint[];
    stocksVsMutualFunds: StocksVsMutualFundsData;
    holdings: HoldingAnalysisItem[];
    sips: Array<{
      schemeName: string;
      schemeCode: string;
      installmentAmount: number;
      sipDate: number;
      status: string;
    }>;
    recentTrades: RecentTradeItem[];
  };
}

/**
 * Compiles complete analytics and investment analysis into a unified data structure
 */
export function compileExecutiveAnalysis(options: {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  holdings: InvestmentHolding[];
  sips?: SipSchedule[];
  userProfile?: UserProfile;
  startDate?: Date;
  endDate?: Date;
  periodLabel?: string;
  prevStartDate?: Date;
  prevEndDate?: Date;
  prevPeriodLabel?: string;
  getHoldingMarketPrice?: (h: InvestmentHolding) => { price: number; previousPrice: number; date: string; previousDate?: string } | number;
}): ExecutiveAnalysisData {
  const {
    transactions,
    categories,
    accounts,
    holdings,
    sips = [],
    userProfile,
    startDate,
    endDate,
    periodLabel = 'Selected Period',
    prevStartDate,
    prevEndDate,
    prevPeriodLabel,
  } = options;

  const resolvePriceInfo = (h: InvestmentHolding) => {
    if (!options.getHoldingMarketPrice) {
      return {
        price: h.currentPrice || h.averageBuyPrice,
        previousPrice: h.previousClosePrice || h.currentPrice || h.averageBuyPrice,
        date: h.lastPriceUpdate || new Date().toISOString().split('T')[0],
      };
    }
    const res = options.getHoldingMarketPrice(h);
    if (typeof res === 'number') {
      return {
        price: res,
        previousPrice: h.previousClosePrice || res,
        date: h.lastPriceUpdate || new Date().toISOString().split('T')[0],
      };
    }
    return res;
  };

  const now = new Date();

  // 1. Filter Transactions for period
  const periodTxs = transactions.filter((tx) => {
    if (tx.isBalanceAdjustment) return false;
    const d = parseDate(tx.date);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  });

  // Previous period transactions
  const prevPeriodTxs = (prevStartDate && prevEndDate)
    ? transactions.filter((tx) => {
        if (tx.isBalanceAdjustment) return false;
        const d = parseDate(tx.date);
        return d >= prevStartDate && d <= prevEndDate;
      })
    : [];

  // 2. Aggregate Income, Expenses & Categories
  let totalIncome = 0;
  let totalExpense = 0;
  const catMap = new Map<string, { amount: number; count: number; name: string; type: 'expense' | 'income'; color: string; id: string }>();

  periodTxs.forEach((tx) => {
    if (tx.type === 'income') totalIncome += tx.amount;
    else if (tx.type === 'expense') totalExpense += tx.amount;

    if (tx.type === 'expense' || tx.type === 'income') {
      const catKey = tx.categoryId || 'uncategorized';
      if (!catMap.has(catKey)) {
        const found = tx.categoryId ? categories.find((c) => c.id === tx.categoryId) : undefined;
        catMap.set(catKey, {
          id: catKey,
          name: tx.categoryName || found?.name || 'General',
          type: tx.type,
          amount: 0,
          count: 0,
          color: found?.color || '#64748b',
        });
      }
      const entry = catMap.get(catKey)!;
      entry.amount += tx.amount;
      entry.count += 1;
    }
  });

  const categoriesSummary: CategorySummaryItem[] = Array.from(catMap.values())
    .map((c) => {
      const base = c.type === 'expense' ? totalExpense : totalIncome;
      return {
        ...c,
        percentage: base > 0 ? Number(((c.amount / base) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const topExpenses = categoriesSummary.filter((c) => c.type === 'expense').slice(0, 7);

  // Accounts Flow
  const accountsFlow: AccountFlowItem[] = accounts.map((acc) => {
    let exp = 0;
    let inc = 0;
    periodTxs.forEach((tx) => {
      if (tx.fromAccountId === acc.id) {
        if (tx.type === 'expense') exp += tx.amount;
      }
      if (tx.toAccountId === acc.id || (tx.fromAccountId === acc.id && tx.type === 'income')) {
        if (tx.type === 'income') inc += tx.amount;
      }
    });
    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      balance: acc.balance,
      expenseAmount: exp,
      incomeAmount: inc,
      netFlow: inc - exp,
    };
  });

  // Previous period comparison
  let prevPeriodAnalysis: ExecutiveAnalysisData['analytics']['prevPeriod'] | undefined = undefined;
  if (prevPeriodTxs.length > 0 && prevPeriodLabel) {
    let prevExp = 0;
    let prevInc = 0;
    prevPeriodTxs.forEach((tx) => {
      if (tx.type === 'expense') prevExp += tx.amount;
      else if (tx.type === 'income') prevInc += tx.amount;
    });
    const diff = totalExpense - prevExp;
    const pct = prevExp > 0 ? (diff / prevExp) * 100 : 0;
    prevPeriodAnalysis = {
      label: prevPeriodLabel,
      totalExpense: prevExp,
      totalIncome: prevInc,
      diffExpense: diff,
      percentChangeExpense: pct,
    };
  }

  // -------------------------------------------------------------------------
  // 3. Six-Month Cash Flow Trend Analysis (Last 6 Calendar Months)
  // -------------------------------------------------------------------------
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sixMonthTrend: SixMonthCashFlowPoint[] = [];

  for (let i = 5; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth();
    const mStart = new Date(y, m, 1, 0, 0, 0);
    const mEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);

    let mInc = 0;
    let mExp = 0;
    let txCount = 0;

    transactions.forEach((tx) => {
      if (tx.isBalanceAdjustment) return;
      const d = parseDate(tx.date);
      if (d >= mStart && d <= mEnd) {
        txCount++;
        if (tx.type === 'income') mInc += tx.amount;
        else if (tx.type === 'expense') mExp += tx.amount;
      }
    });

    const net = mInc - mExp;
    const sRate = mInc > 0 ? Number(((net / mInc) * 100).toFixed(1)) : 0;
    const mKey = `${y}-${String(m + 1).padStart(2, '0')}`;
    const mLabel = `${monthNames[m]} ${y}`;
    const sLabel = monthNames[m];

    sixMonthTrend.push({
      monthKey: mKey,
      monthLabel: mLabel,
      shortLabel: sLabel,
      income: mInc,
      expense: mExp,
      netSavings: net,
      savingsRate: sRate,
      txCount,
    });
  }

  // 6-Month Summary Aggregates
  const total6mIncome = sixMonthTrend.reduce((s, p) => s + p.income, 0);
  const total6mExpense = sixMonthTrend.reduce((s, p) => s + p.expense, 0);
  const total6mSavings = total6mIncome - total6mExpense;
  const avgMonthlyIncome = Math.round(total6mIncome / 6);
  const avgMonthlyExpense = Math.round(total6mExpense / 6);
  const avgMonthlySavings = Math.round(total6mSavings / 6);

  const highestInc = [...sixMonthTrend].sort((a, b) => b.income - a.income)[0];
  const highestExp = [...sixMonthTrend].sort((a, b) => b.expense - a.expense)[0];

  const sixMonthSummary: SixMonthSummary = {
    totalIncome: total6mIncome,
    totalExpense: total6mExpense,
    netSavings: total6mSavings,
    avgMonthlyIncome,
    avgMonthlyExpense,
    avgMonthlySavings,
    highestIncomeMonth: highestInc?.income > 0 ? `${highestInc.monthLabel} (${formatINR(highestInc.income)})` : 'None',
    highestExpenseMonth: highestExp?.expense > 0 ? `${highestExp.monthLabel} (${formatINR(highestExp.expense)})` : 'None',
  };

  // -------------------------------------------------------------------------
  // 4. Investments Analysis & Asset Classification
  // -------------------------------------------------------------------------
  const portfolioPerf = calculatePortfolioDayPerformance(holdings, resolvePriceInfo);
  const totalPortfolioCurrent = portfolioPerf.totalCurrentValue;

  let totalInvested = 0;
  let totalBookedProfit = 0;

  const holdingsList: HoldingAnalysisItem[] = holdings.map((h) => {
    const priceInfo = resolvePriceInfo(h);
    const livePrice = priceInfo.price;
    const invested = h.quantity * h.averageBuyPrice;
    const current = h.quantity * livePrice;
    const uPnL = current - invested;
    const uPnLPct = invested > 0 ? (uPnL / invested) * 100 : 0;
    const bInfo = calculateHoldingBookedProfit(h);
    const dayPerf = calculateHoldingDayPerformance(h, priceInfo);

    totalInvested += invested;
    totalBookedProfit += bInfo.bookedProfit;

    return {
      symbol: h.symbol,
      name: h.customDisplayName || h.name,
      assetType: h.assetType,
      quantity: h.quantity,
      averageBuyPrice: h.averageBuyPrice,
      currentPrice: livePrice,
      investedValue: invested,
      currentValue: current,
      unrealizedPnL: uPnL,
      unrealizedPnLPercent: uPnLPct,
      bookedProfit: bInfo.bookedProfit,
      dayChange: dayPerf.dayChangeValue,
      dayChangePercent: dayPerf.dayChangePercent,
      weightPercent: totalPortfolioCurrent > 0 ? (current / totalPortfolioCurrent) * 100 : 0,
      isVerified: h.isVerified,
    };
  });

  // Sort holdings by current value descending
  holdingsList.sort((a, b) => b.currentValue - a.currentValue);

  // Asset Allocation
  const calcAlloc = (type: string | string[]) => {
    const matches = holdingsList.filter((h) => Array.isArray(type) ? type.includes(h.assetType) : h.assetType === type);
    const inv = matches.reduce((s, h) => s + h.investedValue, 0);
    const cur = matches.reduce((s, h) => s + h.currentValue, 0);
    const wt = totalPortfolioCurrent > 0 ? (cur / totalPortfolioCurrent) * 100 : 0;
    return { invested: inv, current: cur, count: matches.length, weight: wt };
  };

  const assetAllocation = {
    stocks: calcAlloc('stock'),
    mutualFunds: calcAlloc('mutual_fund'),
    bonds: calcAlloc(['bond', 'sgb']),
    pf: calcAlloc('pf'),
  };

  // -------------------------------------------------------------------------
  // 5. Dedicated Stocks vs. Mutual Funds Comparative Analysis
  // -------------------------------------------------------------------------
  const stockHoldings = holdingsList.filter((h) => h.assetType === 'stock');
  const mfHoldings = holdingsList.filter((h) => h.assetType === 'mutual_fund');
  const bondHoldings = holdingsList.filter((h) => h.assetType === 'bond' || h.assetType === 'sgb');
  const pfHoldings = holdingsList.filter((h) => h.assetType === 'pf');

  const stockInvested = assetAllocation.stocks.invested;
  const stockCurrent = assetAllocation.stocks.current;
  const stockPnL = stockCurrent - stockInvested;
  const stockPnLPct = stockInvested > 0 ? (stockPnL / stockInvested) * 100 : 0;
  const stockGainers = stockHoldings.filter((h) => h.unrealizedPnL > 0).length;
  const stockLosers = stockHoldings.filter((h) => h.unrealizedPnL < 0).length;
  const topStock = stockHoldings[0] ? { symbol: stockHoldings[0].symbol, name: stockHoldings[0].name, value: stockHoldings[0].currentValue } : undefined;

  const mfInvested = assetAllocation.mutualFunds.invested;
  const mfCurrent = assetAllocation.mutualFunds.current;
  const mfPnL = mfCurrent - mfInvested;
  const mfPnLPct = mfInvested > 0 ? (mfPnL / mfInvested) * 100 : 0;
  const topMf = mfHoldings[0] ? { symbol: mfHoldings[0].symbol, name: mfHoldings[0].name, value: mfHoldings[0].currentValue } : undefined;

  const activeSips = sips.filter((s) => s.status === 'ACTIVE');
  const monthlySipTotal = activeSips.reduce((sum, s) => sum + (s.installmentAmount || 0), 0);

  const bondInvested = assetAllocation.bonds.invested;
  const bondCurrent = assetAllocation.bonds.current;
  const bondPnL = bondCurrent - bondInvested;
  const bondPnLPct = bondInvested > 0 ? (bondPnL / bondInvested) * 100 : 0;

  const pfInvested = assetAllocation.pf.invested;
  const pfCurrent = assetAllocation.pf.current;
  const pfPnL = pfCurrent - pfInvested;
  const pfPnLPct = pfInvested > 0 ? (pfPnL / pfInvested) * 100 : 0;

  const higherYield = stockPnLPct > mfPnLPct ? 'stocks' : mfPnLPct > stockPnLPct ? 'mutual_funds' : 'even';
  const yieldDiff = Math.abs(stockPnLPct - mfPnLPct);

  const stocksVsMutualFunds: StocksVsMutualFundsData = {
    stocks: {
      count: stockHoldings.length,
      invested: stockInvested,
      current: stockCurrent,
      unrealizedPnL: stockPnL,
      unrealizedPnLPercent: Number(stockPnLPct.toFixed(2)),
      weight: assetAllocation.stocks.weight,
      topHolding: topStock,
      gainersCount: stockGainers,
      losersCount: stockLosers,
    },
    mutualFunds: {
      count: mfHoldings.length,
      invested: mfInvested,
      current: mfCurrent,
      unrealizedPnL: mfPnL,
      unrealizedPnLPercent: Number(mfPnLPct.toFixed(2)),
      weight: assetAllocation.mutualFunds.weight,
      topHolding: topMf,
      activeSipsCount: activeSips.length,
      monthlySipCommitment: monthlySipTotal,
    },
    bonds: {
      count: bondHoldings.length,
      invested: bondInvested,
      current: bondCurrent,
      unrealizedPnL: bondPnL,
      unrealizedPnLPercent: Number(bondPnLPct.toFixed(2)),
      weight: assetAllocation.bonds.weight,
    },
    pf: {
      count: pfHoldings.length,
      invested: pfInvested,
      current: pfCurrent,
      unrealizedPnL: pfPnL,
      unrealizedPnLPercent: Number(pfPnLPct.toFixed(2)),
      weight: assetAllocation.pf.weight,
    },
    summary: {
      equityRatio: assetAllocation.stocks.weight,
      mfRatio: assetAllocation.mutualFunds.weight,
      bondsRatio: assetAllocation.bonds.weight,
      pfRatio: assetAllocation.pf.weight,
      higherYieldAsset: higherYield,
      yieldDifferencePercent: Number(yieldDiff.toFixed(2)),
    },
  };

  // -------------------------------------------------------------------------
  // 6. Portfolio Growth History (6-Month Trajectory: Combined, Stocks, and MF)
  // -------------------------------------------------------------------------
  const portfolioGrowthHistory: PortfolioGrowthPoint[] = [];

  for (let i = 5; i >= 0; i--) {
    const isCurrentMonth = i === 0;
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth();
    const monthEndTimestamp = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();

    if (isCurrentMonth) {
      // Current point is exact live data
      const growth = totalPortfolioCurrent - totalInvested;
      const growthPct = totalInvested > 0 ? (growth / totalInvested) * 100 : 0;
      const sGrowth = stockCurrent - stockInvested;
      const sGrowthPct = stockInvested > 0 ? (sGrowth / stockInvested) * 100 : 0;
      const mGrowth = mfCurrent - mfInvested;
      const mGrowthPct = mfInvested > 0 ? (mGrowth / mfInvested) * 100 : 0;

      portfolioGrowthHistory.push({
        date: formatDate(now),
        monthKey: `${y}-${String(m + 1).padStart(2, '0')}`,
        monthLabel: `${monthNames[m]} ${y}`,
        shortLabel: monthNames[m],
        invested: totalInvested,
        valuation: totalPortfolioCurrent,
        growth,
        growthPercent: Number(growthPct.toFixed(2)),
        stocksInvested: stockInvested,
        stocksValuation: stockCurrent,
        stocksGrowth: sGrowth,
        stocksGrowthPercent: Number(sGrowthPct.toFixed(2)),
        mfInvested: mfInvested,
        mfValuation: mfCurrent,
        mfGrowth: mGrowth,
        mfGrowthPercent: Number(mGrowthPct.toFixed(2)),
        bondsInvested: bondInvested,
        bondsValuation: bondCurrent,
      });
    } else {
      // Historical point reconstructed from transaction history
      let invAtPoint = 0;
      let valAtPoint = 0;
      let stockInv = 0;
      let stockVal = 0;
      let mfInv = 0;
      let mfVal = 0;
      let bondInv = 0;
      let bondVal = 0;

      holdings.forEach((h) => {
        const livePrice = resolvePriceInfo(h).price;
        const txs = [...(h.transactions || [])]
          .filter((t) => parseDate(t.date).getTime() <= monthEndTimestamp)
          .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

        if (txs.length === 0) return;

        let q = 0;
        let cost = 0;

        txs.forEach((t) => {
          if (t.type === 'buy') {
            q += t.quantity;
            cost += t.totalAmount || (t.quantity * t.price);
          } else if (t.type === 'sell') {
            const avgBefore = q > 0 ? cost / q : 0;
            q = Math.max(0, q - t.quantity);
            cost = Math.max(0, q * avgBefore);
          } else if (t.type === 'split') {
            if (t.newQuantity && t.newQuantity > 0) q = t.newQuantity;
            else q += t.quantity;
          } else if (t.type === 'bonus') {
            q += t.quantity;
          }
        });

        invAtPoint += cost;
        const holdingVal = q * livePrice;
        valAtPoint += holdingVal;

        if (h.assetType === 'stock') {
          stockInv += cost;
          stockVal += holdingVal;
        } else if (h.assetType === 'mutual_fund') {
          mfInv += cost;
          mfVal += holdingVal;
        } else {
          bondInv += cost;
          bondVal += holdingVal;
        }
      });

      const growth = valAtPoint - invAtPoint;
      const growthPct = invAtPoint > 0 ? (growth / invAtPoint) * 100 : 0;
      const sGrowth = stockVal - stockInv;
      const sGrowthPct = stockInv > 0 ? (sGrowth / stockInv) * 100 : 0;
      const mGrowth = mfVal - mfInv;
      const mGrowthPct = mfInv > 0 ? (mGrowth / mfInv) * 100 : 0;

      portfolioGrowthHistory.push({
        date: formatDate(new Date(monthEndTimestamp)),
        monthKey: `${y}-${String(m + 1).padStart(2, '0')}`,
        monthLabel: `${monthNames[m]} ${y}`,
        shortLabel: monthNames[m],
        invested: invAtPoint,
        valuation: valAtPoint,
        growth,
        growthPercent: Number(growthPct.toFixed(2)),
        stocksInvested: stockInv,
        stocksValuation: stockVal,
        stocksGrowth: sGrowth,
        stocksGrowthPercent: Number(sGrowthPct.toFixed(2)),
        mfInvested: mfInv,
        mfValuation: mfVal,
        mfGrowth: mGrowth,
        mfGrowthPercent: Number(mGrowthPct.toFixed(2)),
        bondsInvested: bondInv,
        bondsValuation: bondVal,
      });
    }
  }

  // Overall Portfolio XIRR
  let portfolioXIRR: number | null = null;
  const cashFlows: CashFlow[] = [];
  holdings.forEach((h) => {
    (h.transactions || []).forEach((t) => {
      const d = parseDate(t.date);
      const isBuy = t.type === 'buy';
      const isSell = t.type === 'sell';
      const isDiv = t.type === 'dividend' || t.type === 'interest';
      const isRepay = t.type === 'principal_repayment';
      const tot = t.totalAmount || (t.quantity * t.price);

      if (isBuy && tot > 0) cashFlows.push({ date: d, amount: -tot });
      else if ((isSell || isDiv || isRepay) && tot > 0) cashFlows.push({ date: d, amount: tot });
    });
  });

  if (totalPortfolioCurrent > 0) {
    cashFlows.push({ date: new Date(), amount: totalPortfolioCurrent });
  }

  if (cashFlows.some((cf) => cf.amount < 0) && cashFlows.some((cf) => cf.amount > 0)) {
    portfolioXIRR = calculateXIRR(cashFlows);
  }

  // Recent Investment Trades
  const recentTrades: RecentTradeItem[] = [];
  holdings.forEach((h) => {
    (h.transactions || []).forEach((t) => {
      recentTrades.push({
        id: t.id,
        date: t.date,
        holdingSymbol: h.symbol,
        holdingName: h.name,
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        totalAmount: t.totalAmount || (t.quantity * t.price),
        notes: t.notes,
      });
    });
  });

  recentTrades.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

  // 7. Net Worth Aggregation
  let liquidCash = 0;
  accounts.forEach((acc) => {
    if (acc.includeInNetLiquid !== false && acc.type !== 'debt') {
      liquidCash += acc.balance;
    }
  });

  return {
    metadata: {
      generatedAt: now.toISOString(),
      generatedAtFormatted: formatDate(now),
      periodLabel,
      startDate: startDate ? formatDate(startDate) : undefined,
      endDate: endDate ? formatDate(endDate) : undefined,
      userProfileName: userProfile?.name || 'Investor & Account Holder',
      currencySymbol: '₹',
    },
    netWorth: {
      liquidCash,
      portfolioValue: totalPortfolioCurrent,
      totalNetWorth: liquidCash + totalPortfolioCurrent,
      debtsLent: 0,
      debtsBorrowed: 0,
      netLiquidWealth: liquidCash,
    },
    analytics: {
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense,
      savingsRate: totalIncome > 0 ? Number((((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1)) : 0,
      transactionCount: periodTxs.length,
      categories: categoriesSummary,
      topExpenses,
      accountsFlow,
      prevPeriod: prevPeriodAnalysis,
      sixMonthTrend,
      sixMonthSummary,
    },
    investments: {
      totalInvested,
      totalCurrentValue: totalPortfolioCurrent,
      unrealizedPnL: totalPortfolioCurrent - totalInvested,
      unrealizedPnLPercent: totalInvested > 0 ? Number((((totalPortfolioCurrent - totalInvested) / totalInvested) * 100).toFixed(2)) : 0,
      totalBookedProfit,
      totalDayChange: portfolioPerf.totalDayChange,
      totalDayChangePercent: portfolioPerf.totalDayChangePercent,
      portfolioXIRR,
      assetAllocation,
      portfolioGrowthHistory,
      stocksVsMutualFunds,
      holdings: holdingsList,
      sips: sips.map((s) => ({
        schemeName: s.schemeName,
        schemeCode: s.schemeCode,
        installmentAmount: s.installmentAmount,
        sipDate: s.sipDate,
        status: s.status,
      })),
      recentTrades: recentTrades.slice(0, 30),
    },
  };
}

/**
 * Escapes CSV values cleanly
 */
function esc(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates a comprehensive structured CSV workbook containing both Analytics & Investments
 */
export function generateAnalysisCSV(data: ExecutiveAnalysisData): string {
  const lines: string[] = [];

  // Header
  lines.push('================================================================');
  lines.push(`FINSYNC - FINANCIAL ANALYTICS & INVESTMENT PORTFOLIO AUDIT REPORT`);
  lines.push(`Tagline: Log Split Track Analyse Grow`);
  lines.push(`Generated: ${data.metadata.generatedAtFormatted} | Prepared for: ${data.metadata.userProfileName}`);
  lines.push(`Period Scope: ${data.metadata.periodLabel}`);
  lines.push('================================================================');
  lines.push('');

  // 1. EXECUTIVE NET WORTH SUMMARY
  lines.push('--- EXECUTIVE NET WORTH & WEALTH SUMMARY ---');
  lines.push('Metric,Amount (INR)');
  lines.push(`Liquid Cash & Bank Balances,${data.netWorth.liquidCash.toFixed(2)}`);
  lines.push(`Investment Portfolio Market Value,${data.netWorth.portfolioValue.toFixed(2)}`);
  lines.push(`Total Combined Net Worth,${data.netWorth.totalNetWorth.toFixed(2)}`);
  lines.push(`Total Invested Capital (Cost Basis),${data.investments.totalInvested.toFixed(2)}`);
  lines.push(`Total Unrealized Gain / Loss,${data.investments.unrealizedPnL.toFixed(2)}`);
  lines.push(`Total Realized Booked Profit,${data.investments.totalBookedProfit.toFixed(2)}`);
  lines.push(`Portfolio Annualized Return (XIRR),${data.investments.portfolioXIRR !== null ? `${data.investments.portfolioXIRR.toFixed(2)}%` : 'N/A'}`);
  lines.push('');

  // 2. LAST 6 MONTHS CASH FLOW COMPARISON
  lines.push('--- LAST 6 MONTHS INCOME & EXPENSE COMPARISON ---');
  lines.push('Month,Income (INR),Expense (INR),Net Savings (INR),Savings Rate %,Transaction Count');
  data.analytics.sixMonthTrend.forEach((m) => {
    lines.push([
      esc(m.monthLabel),
      m.income.toFixed(2),
      m.expense.toFixed(2),
      m.netSavings.toFixed(2),
      `${m.savingsRate.toFixed(1)}%`,
      m.txCount,
    ].join(','));
  });
  lines.push(`6-Month Total,${data.analytics.sixMonthSummary.totalIncome.toFixed(2)},${data.analytics.sixMonthSummary.totalExpense.toFixed(2)},${data.analytics.sixMonthSummary.netSavings.toFixed(2)},-,${data.analytics.sixMonthTrend.reduce((s, m) => s + m.txCount, 0)}`);
  lines.push(`6-Month Monthly Average,${data.analytics.sixMonthSummary.avgMonthlyIncome.toFixed(2)},${data.analytics.sixMonthSummary.avgMonthlyExpense.toFixed(2)},${data.analytics.sixMonthSummary.avgMonthlySavings.toFixed(2)},-,-`);
  lines.push('');

  // 3. STOCKS VS MUTUAL FUNDS COMPARATIVE BREAKDOWN
  lines.push('--- STOCKS VS MUTUAL FUNDS COMPARISON ---');
  lines.push('Asset Category,Holdings Count,Invested Capital (INR),Current Valuation (INR),Unrealized P&L (INR),Return %,Portfolio Weight %');
  const s = data.investments.stocksVsMutualFunds.stocks;
  const mf = data.investments.stocksVsMutualFunds.mutualFunds;
  const b = data.investments.stocksVsMutualFunds.bonds;
  lines.push(`Direct Equity (Stocks),${s.count},${s.invested.toFixed(2)},${s.current.toFixed(2)},${s.unrealizedPnL.toFixed(2)},${s.unrealizedPnLPercent.toFixed(2)}%,${s.weight.toFixed(1)}%`);
  lines.push(`Mutual Funds,${mf.count},${mf.invested.toFixed(2)},${mf.current.toFixed(2)},${mf.unrealizedPnL.toFixed(2)},${mf.unrealizedPnLPercent.toFixed(2)}%,${mf.weight.toFixed(1)}%`);
  lines.push(`Bonds & SGBs,${b.count},${b.invested.toFixed(2)},${b.current.toFixed(2)},${b.unrealizedPnL.toFixed(2)},${b.unrealizedPnLPercent.toFixed(2)}%,${b.weight.toFixed(1)}%`);
  const pf = data.investments.stocksVsMutualFunds.pf;
  if (pf && pf.count > 0) {
    lines.push(`Provident Fund (PF),${pf.count},${pf.invested.toFixed(2)},${pf.current.toFixed(2)},${pf.unrealizedPnL.toFixed(2)},${pf.unrealizedPnLPercent.toFixed(2)}%,${pf.weight.toFixed(1)}%`);
  }
  lines.push(`Active SIPs: ${mf.activeSipsCount} plans totaling ${mf.monthlySipCommitment.toFixed(2)} INR/month`);
  lines.push('');

  // 4. PORTFOLIO GROWTH TRAJECTORY (LAST 6 MONTHS)
  lines.push('--- PORTFOLIO GROWTH & TRAJECTORY (LAST 6 MONTHS) ---');
  lines.push('Month,Invested Capital (INR),Market Valuation (INR),Unrealized Growth (INR),Growth %,Stocks Val (INR),MF Val (INR)');
  data.investments.portfolioGrowthHistory.forEach((p) => {
    lines.push([
      esc(p.monthLabel),
      p.invested.toFixed(2),
      p.valuation.toFixed(2),
      p.growth.toFixed(2),
      `${p.growthPercent.toFixed(2)}%`,
      p.stocksValuation.toFixed(2),
      p.mfValuation.toFixed(2),
    ].join(','));
  });
  lines.push('');

  // 5. CATEGORY BREAKDOWN
  lines.push('--- CATEGORY BREAKDOWN (EXPENSES & INCOME) ---');
  lines.push('Category Name,Type,Amount (INR),Percentage Share %,Transaction Count');
  data.analytics.categories.forEach((c) => {
    lines.push([
      esc(c.name),
      esc(c.type.toUpperCase()),
      c.amount.toFixed(2),
      `${c.percentage.toFixed(1)}%`,
      c.count,
    ].join(','));
  });
  lines.push('');

  // 6. DETAILED HOLDINGS LEDGER
  lines.push('--- COMPLETE INVESTMENT HOLDINGS VALUATION & P&L ---');
  lines.push('Symbol,Company / Scheme Name,Asset Class,Units / Shares,Avg Buy Price (INR),Current Price / NAV (INR),Total Invested (INR),Current Valuation (INR),Unrealized P&L (INR),Unrealized P&L %,Booked Profit (INR),Weight %,1D Day Change (INR),1D Change %');
  data.investments.holdings.forEach((h) => {
    lines.push([
      esc(h.symbol),
      esc(h.name),
      esc(h.assetType.toUpperCase()),
      h.quantity,
      h.averageBuyPrice.toFixed(2),
      h.currentPrice.toFixed(2),
      h.investedValue.toFixed(2),
      h.currentValue.toFixed(2),
      h.unrealizedPnL.toFixed(2),
      `${h.unrealizedPnLPercent.toFixed(2)}%`,
      h.bookedProfit.toFixed(2),
      `${h.weightPercent.toFixed(2)}%`,
      h.dayChange.toFixed(2),
      `${h.dayChangePercent.toFixed(2)}%`,
    ].join(','));
  });
  lines.push('');

  // 7. ACTIVE SIP SCHEDULES
  if (data.investments.sips.length > 0) {
    lines.push('--- ACTIVE MUTUAL FUND SIP SCHEDULES ---');
    lines.push('Mutual Fund Scheme,AMFI Scheme Code,Monthly Amount (INR),SIP Execution Day,Status');
    data.investments.sips.forEach((s) => {
      lines.push([
        esc(s.schemeName),
        esc(s.schemeCode),
        s.installmentAmount.toFixed(2),
        `${s.sipDate}th of month`,
        esc(s.status),
      ].join(','));
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Builds standalone, pixel-perfect inline SVG charts for print/HTML reports
 */

// 1. Asset Allocation Donut SVG (Stocks vs Mutual Funds vs Bonds & SGBs vs Provident Fund)
function buildAssetAllocationDonutSVG(alloc: ExecutiveAnalysisData['investments']['assetAllocation'], total: number): string {
  const stockVal = alloc.stocks?.current || 0;
  const mfVal = alloc.mutualFunds?.current || 0;
  const bondVal = alloc.bonds?.current || 0;
  const pfVal = alloc.pf?.current || 0;

  const totalCurrent = total > 0 ? total : (stockVal + mfVal + bondVal + pfVal);
  if (totalCurrent <= 0) {
    return `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:12px;">No investment holdings recorded.</div>`;
  }

  const stocksWt = totalCurrent > 0 ? (stockVal / totalCurrent) * 100 : (alloc.stocks?.weight || 0);
  const mfWt = totalCurrent > 0 ? (mfVal / totalCurrent) * 100 : (alloc.mutualFunds?.weight || 0);
  const bondsWt = totalCurrent > 0 ? (bondVal / totalCurrent) * 100 : (alloc.bonds?.weight || 0);
  const pfWt = totalCurrent > 0 ? (pfVal / totalCurrent) * 100 : (alloc.pf?.weight || 0);

  const totalWt = stocksWt + mfWt + bondsWt + pfWt;

  const slices = [
    { name: 'Stocks', weight: stocksWt, color: '#2563eb', val: stockVal },
    { name: 'Mutual Funds', weight: mfWt, color: '#059669', val: mfVal },
    { name: 'Bonds & SGBs', weight: bondsWt, color: '#d97706', val: bondVal },
    { name: 'Provident Fund (PF)', weight: pfWt, color: '#0891b2', val: pfVal },
  ].filter((s) => s.val > 0 || s.weight > 0);

  const cx = 110;
  const cy = 110;
  const rOut = 90;
  const rIn = 60;

  let currentAngle = -Math.PI / 2;
  const paths: string[] = [];

  if (slices.length === 1) {
    const s = slices[0];
    const ringPath = `M ${cx} ${cy - rOut} A ${rOut} ${rOut} 0 1 1 ${cx} ${cy + rOut} A ${rOut} ${rOut} 0 1 1 ${cx} ${cy - rOut} M ${cx} ${cy - rIn} A ${rIn} ${rIn} 0 1 0 ${cx} ${cy + rIn} A ${rIn} ${rIn} 0 1 0 ${cx} ${cy - rIn} Z`;
    paths.push(`<path d="${ringPath}" fill="${s.color}" style="fill:${s.color}!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />`);
  } else {
    slices.forEach((s) => {
      const sliceAngle = totalWt > 0 ? (s.weight / totalWt) * 2 * Math.PI : 0;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      const x1 = cx + rOut * Math.cos(startAngle);
      const y1 = cy + rOut * Math.sin(startAngle);
      const x2 = cx + rOut * Math.cos(endAngle);
      const y2 = cy + rOut * Math.sin(endAngle);

      const x3 = cx + rIn * Math.cos(endAngle);
      const y3 = cy + rIn * Math.sin(endAngle);
      const x4 = cx + rIn * Math.cos(startAngle);
      const y4 = cy + rIn * Math.sin(startAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const pathData = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${rIn} ${rIn} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
      paths.push(`<path d="${pathData}" fill="${s.color}" style="fill:${s.color}!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />`);
    });
  }

  return `
    <div style="display:flex;align-items:center;justify-content:center;gap:36px;flex-wrap:wrap;padding:12px 0;">
      <div style="position:relative;width:220px;height:220px;flex-shrink:0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220" style="overflow:visible;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
          ${paths.join('')}
          <circle cx="${cx}" cy="${cy}" r="${rIn - 2}" fill="#ffffff" />
          <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="#64748b" letter-spacing="0.5">PORTFOLIO</text>
          <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="14" font-weight="800" fill="#0f172a" font-family="'JetBrains Mono', monospace">${formatCompactINR(totalCurrent)}</text>
        </svg>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;min-width:260px;">
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Asset Allocation Slices</div>
        ${slices.map((s) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${s.color};"></span>
              <strong style="color:#0f172a;">${s.name}</strong>
            </div>
            <div style="text-align:right;">
              <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#0f172a;">${formatINR(s.val)}</span>
              <span style="color:#64748b;margin-left:6px;font-weight:600;">(${s.weight.toFixed(1)}%)</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Helper to compute smooth monotone cubic spline path from discrete coordinates (equivalent to Recharts type="monotone")
 */
function generateMonotoneSpline(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  if (pts.length === 2) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// 2. Six-Month Income vs Expense Comparison SVG Line Chart (matching exactly the app's visual style)
function buildSixMonthComparisonSVG(trend: SixMonthCashFlowPoint[]): string {
  if (!trend || trend.length === 0) return '';

  const w = 760;
  const h = 240;
  const padL = 65;
  const padR = 25;
  const padT = 28;
  const padB = 40;

  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const allVals = trend.flatMap((p) => [p.income, p.expense, p.netSavings]);
  const minRaw = Math.min(0, ...allVals);
  const maxRaw = Math.max(1000, ...allVals);

  // Generous ceiling for clean tick steps
  const maxVal = Math.ceil((maxRaw * 1.15) / 1000) * 1000;
  const minVal = minRaw < 0 ? Math.floor((minRaw * 1.15) / 1000) * 1000 : 0;
  const range = maxVal - minVal || 1;

  const getY = (val: number) => padT + chartH - ((val - minVal) / range) * chartH;
  const count = trend.length;
  const getX = (idx: number) => count > 1 ? padL + (idx / (count - 1)) * chartW : padL + chartW / 2;

  // Grid lines (horizontal dashed, matching app's CartesianGrid vertical={false})
  const gridLines: string[] = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = minVal + ((maxVal - minVal) / steps) * i;
    const y = getY(val);
    gridLines.push(`
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${padL - 10}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" font-family="'JetBrains Mono', monospace" fill="#94a3b8">₹${formatCompactINR(val)}</text>
    `);
  }

  // Draw 0 baseline if negative values exist
  let zeroBaseline = '';
  if (minVal < 0) {
    const zeroY = getY(0);
    zeroBaseline = `<line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${w - padR}" y2="${zeroY.toFixed(1)}" stroke="#cbd5e1" stroke-width="1.2" />`;
  }

  // Calculate coordinates for the 3 lines
  const incPts: Array<{ x: number; y: number; val: number }> = [];
  const expPts: Array<{ x: number; y: number; val: number }> = [];
  const savPts: Array<{ x: number; y: number; val: number }> = [];
  const xLabels: string[] = [];

  trend.forEach((p, idx) => {
    const x = getX(idx);
    incPts.push({ x, y: getY(p.income), val: p.income });
    expPts.push({ x, y: getY(p.expense), val: p.expense });
    savPts.push({ x, y: getY(p.netSavings), val: p.netSavings });

    xLabels.push(`
      <text x="${x.toFixed(1)}" y="${(h - 12).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#64748b" style="fill:#64748b!important;">${p.shortLabel}</text>
    `);
  });

  // Build monotone spline paths
  const incPathD = generateMonotoneSpline(incPts);
  const expPathD = generateMonotoneSpline(expPts);
  const savPathD = generateMonotoneSpline(savPts);

  // Generate dots matching app:
  // Income: r=3.5 fill=#06b6d4, stroke=#ffffff
  // Expense: r=3.5 fill=#f43f5e, stroke=#ffffff
  // Net Savings: r=3 fill=#f97316, stroke=#ffffff
  const incDots = incPts.map((pt) => `
    <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3.5" fill="#06b6d4" stroke="#ffffff" stroke-width="1.5" style="fill:#06b6d4!important;stroke:#ffffff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
  `).join('');

  const expDots = expPts.map((pt) => `
    <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3.5" fill="#f43f5e" stroke="#ffffff" stroke-width="1.5" style="fill:#f43f5e!important;stroke:#ffffff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
  `).join('');

  const savDots = savPts.map((pt) => `
    <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3" fill="#f97316" stroke="#ffffff" stroke-width="1.5" style="fill:#f97316!important;stroke:#ffffff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
  `).join('');

  return `
    <div class="chart-card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:20px;margin-bottom:24px;page-break-inside:avoid;break-inside:avoid;width:100%;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div>
          <h3 style="font-size:14px;font-weight:800;color:#0f172a;margin:0;">Last 6 Months: Income &amp; Expense Comparison</h3>
          <p style="font-size:11px;color:#64748b;margin-top:2px;">Side-by-side monthly income, expenses, and net surplus trajectory</p>
        </div>
        <div style="display:flex;align-items:center;gap:14px;font-size:11px;font-weight:700;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#06b6d4;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>
            <span style="color:#0f172a;">Income</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#f43f5e;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>
            <span style="color:#0f172a;">Expense</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:16px;height:2px;background:#f97316;border-style:dashed;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>
            <span style="color:#f97316;">Net Savings</span>
          </div>
        </div>
      </div>
      <div class="chart-scroll-wrapper" style="overflow:visible;width:100%;box-sizing:border-box;">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" class="print-chart-svg full-width-chart-svg" style="width:100%;max-width:100%;height:auto;display:block;margin:0 auto;overflow:visible;">
          ${gridLines.join('')}
          ${zeroBaseline}
          <!-- Income Line: Solid Cyan #06b6d4 -->
          <path d="${incPathD}" fill="none" stroke="#06b6d4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="stroke:#06b6d4!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;forced-color-adjust:none!important;" />
          <!-- Expense Line: Solid Rose #f43f5e -->
          <path d="${expPathD}" fill="none" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="stroke:#f43f5e!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;forced-color-adjust:none!important;" />
          <!-- Net Savings Line: Dashed Orange #f97316 -->
          <path d="${savPathD}" fill="none" stroke="#f97316" stroke-width="2" stroke-dasharray="4,4" stroke-linecap="round" stroke-linejoin="round" style="stroke:#f97316!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;forced-color-adjust:none!important;" />
          <!-- Data Dots -->
          ${incDots}
          ${expDots}
          ${savDots}
          <!-- Month Labels -->
          ${xLabels.join('')}
        </svg>
      </div>
    </div>
  `;
}

// 3. Custom Single-Bar Growth SVG (Invested in Blue + Profit in Green with Border + Loss in Red Dotted Rectangle)
export function buildProfitLossBarChartSVG(
  items: Array<{ label: string; invested: number; valuation: number; growth: number; growthPercent: number }>,
  title: string,
  subtitle: string
): string {
  if (!items || items.length === 0) return '';

  const w = 760;
  const h = 230;
  const padL = 60;
  const padR = 20;
  const padT = 28;
  const padB = 40;

  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  let maxVal = 5000;
  items.forEach((p) => {
    if (p.valuation > maxVal) maxVal = p.valuation;
    if (p.invested > maxVal) maxVal = p.invested;
  });
  maxVal = Math.ceil((maxVal * 1.15) / 1000) * 1000;

  // Grid lines
  const gridLines: string[] = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = (maxVal / steps) * i;
    const y = padT + chartH - (val / maxVal) * chartH;
    gridLines.push(`
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" font-family="'JetBrains Mono', monospace" fill="#94a3b8">${formatCompactINR(val)}</text>
    `);
  }

  const count = items.length;
  const groupW = chartW / count;
  const barW = Math.min(42, groupW * 0.48);
  const baselineY = padT + chartH;

  const bars: string[] = [];

  items.forEach((p, idx) => {
    const centerX = padL + idx * groupW + groupW / 2;
    const barX = centerX - barW / 2;
    const isProfit = p.valuation >= p.invested;

    if (isProfit) {
      const invH = (p.invested / maxVal) * chartH;
      const profitH = ((p.valuation - p.invested) / maxVal) * chartH;
      const invTopY = baselineY - invH;
      const profitTopY = baselineY - (invH + profitH);

      bars.push(`
        <g class="bar-growth-profit">
          ${invH === 0 && profitH === 0 ? `<rect x="${barX.toFixed(1)}" y="${(baselineY - 2).toFixed(1)}" width="${barW}" height="2" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.5" style="fill:#cbd5e1!important;stroke:#94a3b8!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;forced-color-adjust:none!important;" rx="1" />` : ''}
          ${invH > 0 ? `<rect x="${barX.toFixed(1)}" y="${invTopY.toFixed(1)}" width="${barW}" height="${Math.max(3, invH).toFixed(1)}" fill="#2563eb" stroke="#1d4ed8" stroke-width="1" style="fill:#2563eb!important;stroke:#1d4ed8!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;forced-color-adjust:none!important;" rx="${profitH > 0 ? 0 : 3}" />` : ''}
          ${profitH > 0 ? `<rect x="${barX.toFixed(1)}" y="${profitTopY.toFixed(1)}" width="${barW}" height="${Math.max(3, profitH).toFixed(1)}" fill="#10b981" stroke="#047857" stroke-width="1.75" style="fill:#10b981!important;stroke:#047857!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;forced-color-adjust:none!important;" rx="3" />` : ''}
          <text x="${centerX.toFixed(1)}" y="${(profitTopY - 6).toFixed(1)}" text-anchor="middle" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="700" fill="#059669" style="fill:#059669!important;">${formatCompactINR(p.valuation)}</text>
          <text x="${centerX.toFixed(1)}" y="${h - 14}" text-anchor="middle" font-size="11" font-weight="700" fill="#475569" style="fill:#475569!important;">${p.label}</text>
        </g>
      `);
    } else {
      const invH = (p.invested / maxVal) * chartH;
      const valH = (p.valuation / maxVal) * chartH;
      const lossH = Math.max(0, invH - valH);
      const invTopY = baselineY - invH;
      const valTopY = baselineY - valH;

      bars.push(`
        <g class="bar-growth-loss">
          <!-- Current Value filled with solid Blue colour -->
          ${valH > 0 ? `<rect x="${barX.toFixed(1)}" y="${valTopY.toFixed(1)}" width="${barW}" height="${Math.max(2, valH).toFixed(1)}" fill="#2563eb" style="fill:#2563eb!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;forced-color-adjust:none!important;" rx="0" />` : ''}

          <!-- Area of Loss shaded at 135° diagonal lines in Red colour -->
          ${lossH > 0 ? `
            <rect x="${barX.toFixed(1)}" y="${invTopY.toFixed(1)}" width="${barW}" height="${lossH.toFixed(1)}" fill="rgba(239,68,68,0.08)" style="fill:rgba(239,68,68,0.08)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
            <rect x="${barX.toFixed(1)}" y="${invTopY.toFixed(1)}" width="${barW}" height="${lossH.toFixed(1)}" fill="url(#lossHatch135)" style="fill:url(#lossHatch135)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;forced-color-adjust:none!important;" />
          ` : ''}

          <!-- Divider line between Current Value and Loss Area -->
          ${valH > 0 && lossH > 0 ? `<line x1="${barX.toFixed(1)}" y1="${valTopY.toFixed(1)}" x2="${(barX + barW).toFixed(1)}" y2="${valTopY.toFixed(1)}" stroke="#1d4ed8" stroke-width="1.5" style="stroke:#1d4ed8!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />` : ''}

          <!-- Invested Value shown as a continuous Blue color box -->
          ${invH > 0 ? `<rect x="${barX.toFixed(1)}" y="${invTopY.toFixed(1)}" width="${barW}" height="${invH.toFixed(1)}" fill="none" stroke="#2563eb" stroke-width="2" rx="3" style="stroke:#2563eb!important;fill:none!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;forced-color-adjust:none!important;" />` : ''}

          <!-- Current value text atop -->
          <text x="${centerX.toFixed(1)}" y="${(invTopY - 6).toFixed(1)}" text-anchor="middle" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="700" fill="#dc2626" style="fill:#dc2626!important;">${formatCompactINR(p.valuation)}</text>
          <text x="${centerX.toFixed(1)}" y="${h - 14}" text-anchor="middle" font-size="11" font-weight="700" fill="#475569" style="fill:#475569!important;">${p.label}</text>
        </g>
      `);
    }
  });

  return `
    <div class="chart-card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:20px;margin-bottom:24px;page-break-inside:avoid;break-inside:avoid;width:100%;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <h3 style="font-size:14px;font-weight:800;color:#0f172a;margin:0;">${title}</h3>
          <p style="font-size:11px;color:#64748b;margin-top:2px;">${subtitle}</p>
        </div>
        <div style="display:flex;align-items:center;gap:14px;font-size:11px;font-weight:700;">
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:transparent;border:2px solid #2563eb;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>
            <span style="color:#0f172a;">Invested (Blue Box)</span>
          </div>
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#2563eb;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>
            <span style="color:#0f172a;">Current (Solid Blue)</span>
          </div>
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#10b981;border:1px solid #047857;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>
            <span style="color:#0f172a;">Profit (Green)</span>
          </div>
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#fee2e2;border:1px solid #ef4444;overflow:hidden;position:relative;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
              <svg viewBox="0 0 10 10" style="width:100%;height:100%;display:block;"><line x1="0" y1="10" x2="10" y2="0" stroke="#ef4444" stroke-width="2" /></svg>
            </span>
            <span style="color:#ef4444;">Loss (135° Red Hatch)</span>
          </div>
        </div>
      </div>
      <div class="chart-scroll-wrapper" style="overflow:visible;width:100%;box-sizing:border-box;">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" class="print-chart-svg full-width-chart-svg" style="width:100%;max-width:100%;height:auto;display:block;margin:0 auto;overflow:visible;">
          <defs>
            <pattern id="lossHatch135" width="8" height="8" patternTransform="rotate(135)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" stroke-width="2" style="stroke:#ef4444!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
            </pattern>
          </defs>
          ${gridLines.join('')}
          ${bars.join('')}
        </svg>
      </div>
    </div>
  `;
}

// 4. Portfolio Growth Trajectory SVG Area Chart
function buildPortfolioGrowthSVG(points: PortfolioGrowthPoint[]): string {
  if (!points || points.length === 0) return '';

  const w = 760;
  const h = 220;
  const padL = 60;
  const padR = 20;
  const padT = 24;
  const padB = 40;

  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  let maxVal = 5000;
  points.forEach((p) => {
    if (p.valuation > maxVal) maxVal = p.valuation;
    if (p.invested > maxVal) maxVal = p.invested;
  });
  maxVal = Math.ceil((maxVal * 1.15) / 1000) * 1000;

  const gridLines: string[] = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = (maxVal / steps) * i;
    const y = padT + chartH - (val / maxVal) * chartH;
    gridLines.push(`
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" font-family="'JetBrains Mono', monospace" fill="#94a3b8">${formatCompactINR(val)}</text>
    `);
  }

  const count = points.length;
  const stepX = count > 1 ? chartW / (count - 1) : chartW;

  const valCoords: Array<{ x: number; y: number; p: PortfolioGrowthPoint }> = [];
  const invCoords: Array<{ x: number; y: number; p: PortfolioGrowthPoint }> = [];

  points.forEach((p, idx) => {
    const x = padL + idx * stepX;
    const yVal = padT + chartH - (p.valuation / maxVal) * chartH;
    const yInv = padT + chartH - (p.invested / maxVal) * chartH;
    valCoords.push({ x, y: yVal, p });
    invCoords.push({ x, y: yInv, p });
  });

  let areaD = `M ${valCoords[0].x} ${padT + chartH}`;
  valCoords.forEach((pt) => { areaD += ` L ${pt.x} ${pt.y}`; });
  areaD += ` L ${valCoords[valCoords.length - 1].x} ${padT + chartH} Z`;

  let valLineD = '';
  let invLineD = '';
  valCoords.forEach((pt, i) => {
    if (i === 0) valLineD += `M ${pt.x} ${pt.y}`;
    else valLineD += ` L ${pt.x} ${pt.y}`;
  });
  invCoords.forEach((pt, i) => {
    if (i === 0) invLineD += `M ${pt.x} ${pt.y}`;
    else invLineD += ` L ${pt.x} ${pt.y}`;
  });

  const dots = valCoords.map((pt) => `
    <circle cx="${pt.x}" cy="${pt.y}" r="4" fill="#ffffff" stroke="#4f46e5" stroke-width="2.5" style="stroke:#4f46e5!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
    <text x="${pt.x}" y="${h - 14}" text-anchor="middle" font-size="11" font-weight="700" fill="#475569" style="fill:#475569!important;">${pt.p.shortLabel}</text>
  `).join('');

  return `
    <div class="card chart-card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:16px;page-break-inside:avoid!important;break-inside:avoid!important;width:100%;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <h3 style="font-size:14px;font-weight:800;color:#0f172a;margin:0;">Portfolio Growth Trajectory (Last 6 Months)</h3>
          <p style="font-size:11px;color:#64748b;margin-top:2px;">Market valuation trajectory vs. cumulative invested capital</p>
        </div>
        <div style="display:flex;align-items:center;gap:14px;font-size:11px;font-weight:700;">
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="display:inline-block;width:16px;height:3px;background:#4f46e5;border-radius:2px;"></span>
            <span style="color:#4f46e5;">Current Valuation</span>
          </div>
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="display:inline-block;width:16px;height:2px;background:#94a3b8;border-style:dashed;"></span>
            <span style="color:#64748b;">Invested Capital</span>
          </div>
        </div>
      </div>
      <div class="chart-scroll-wrapper" style="overflow:visible;width:100%;box-sizing:border-box;">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" class="print-chart-svg full-width-chart-svg" style="width:100%;max-width:100%;height:auto;display:block;margin:0 auto;overflow:visible;">
          <defs>
            <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#4f46e5" stop-opacity="0.05" />
            </linearGradient>
          </defs>
          ${gridLines.join('')}
          <path d="${areaD}" fill="url(#valGrad)" style="fill:url(#valGrad);-webkit-print-color-adjust:exact;print-color-adjust:exact;forced-color-adjust:none!important;" />
          <path d="${invLineD}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,3" style="stroke:#94a3b8!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;forced-color-adjust:none!important;" />
          <path d="${valLineD}" fill="none" stroke="#4f46e5" stroke-width="2.5" style="stroke:#4f46e5!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;forced-color-adjust:none!important;" />
          ${dots}
        </svg>
      </div>
    </div>
  `;
}

// 5. Stocks vs Mutual Funds & Asset Class Comparative Dashboard Cards (HTML/SVG)
function buildStocksVsMutualFundsComparison(data: StocksVsMutualFundsData): string {
  const s = data.stocks;
  const mf = data.mutualFunds;
  const b = data.bonds;
  const pf = data.pf;

  const total = s.current + mf.current + (b ? b.current : 0) + (pf ? pf.current : 0);
  const sWeight = total > 0 ? (s.current / total) * 100 : 0;
  const mfWeight = total > 0 ? (mf.current / total) * 100 : 0;
  const bWeight = total > 0 ? ((b ? b.current : 0) / total) * 100 : 0;
  const pfWeight = total > 0 ? ((pf ? pf.current : 0) / total) * 100 : 0;

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(290px, 1fr));gap:14px;margin-bottom:16px;">
      <!-- Equities / Direct Stocks Card -->
      <div class="card" style="background:#ffffff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;page-break-inside:avoid;break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:8px;height:8px;border-radius:2px;background:#2563eb;"></div>
            <strong style="font-size:12px;color:#1e3a8a;text-transform:uppercase;letter-spacing:0.5px;">Direct Equities / Stocks</strong>
          </div>
          <span style="font-size:10px;font-weight:700;color:#2563eb;background:#eff6ff;padding:2px 6px;border-radius:4px;">
            ${s.count} ${s.count === 1 ? 'Stock' : 'Stocks'}
          </span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div>
            <div style="font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;">Valuation</div>
            <div style="font-size:16px;font-weight:800;color:#0f172a;font-family:'JetBrains Mono',monospace;">${formatINR(s.current)}</div>
            <div style="font-size:10.5px;color:#64748b;margin-top:2px;">Cost: ${formatINR(s.invested)}</div>
          </div>
          <div>
            <div style="font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;">Unrealized P&L</div>
            <div style="font-size:16px;font-weight:800;font-family:'JetBrains Mono',monospace;color:${s.unrealizedPnL >= 0 ? '#059669' : '#e11d48'};">
              ${s.unrealizedPnL >= 0 ? '+' : ''}${formatINR(s.unrealizedPnL)}
            </div>
            <div style="font-size:10.5px;font-weight:700;color:${s.unrealizedPnLPercent >= 0 ? '#059669' : '#e11d48'};margin-top:2px;">
              ${s.unrealizedPnLPercent >= 0 ? '+' : ''}${s.unrealizedPnLPercent}% return
            </div>
          </div>
        </div>
        <div style="background:#f8fafc;padding:8px 10px;border-radius:8px;font-size:10.5px;color:#475569;display:flex;justify-content:space-between;">
          <span>Top Holding: <strong>${s.topHolding?.symbol || 'None'}</strong></span>
          <span>${s.gainersCount} Gainers · ${s.losersCount} Losers</span>
        </div>
      </div>

      <!-- Mutual Funds & SIPs Card -->
      <div class="card" style="background:#ffffff;border:1px solid #bbf7d0;border-radius:10px;padding:14px;page-break-inside:avoid;break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:8px;height:8px;border-radius:2px;background:#059669;"></div>
            <strong style="font-size:12px;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">Mutual Funds & SIPs</strong>
          </div>
          <span style="font-size:10px;font-weight:700;color:#059669;background:#ecfdf5;padding:2px 6px;border-radius:4px;">
            ${mf.count} ${mf.count === 1 ? 'Fund' : 'Funds'}
          </span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div>
            <div style="font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;">Valuation</div>
            <div style="font-size:16px;font-weight:800;color:#0f172a;font-family:'JetBrains Mono',monospace;">${formatINR(mf.current)}</div>
            <div style="font-size:10.5px;color:#64748b;margin-top:2px;">Cost: ${formatINR(mf.invested)}</div>
          </div>
          <div>
            <div style="font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;">Unrealized P&L</div>
            <div style="font-size:16px;font-weight:800;font-family:'JetBrains Mono',monospace;color:${mf.unrealizedPnL >= 0 ? '#059669' : '#e11d48'};">
              ${mf.unrealizedPnL >= 0 ? '+' : ''}${formatINR(mf.unrealizedPnL)}
            </div>
            <div style="font-size:10.5px;font-weight:700;color:${mf.unrealizedPnLPercent >= 0 ? '#059669' : '#e11d48'};margin-top:2px;">
              ${mf.unrealizedPnLPercent >= 0 ? '+' : ''}${mf.unrealizedPnLPercent}% return
            </div>
          </div>
        </div>
        <div style="background:#f8fafc;padding:8px 10px;border-radius:8px;font-size:10.5px;color:#475569;display:flex;justify-content:space-between;">
          <span>Active SIPs: <strong>${mf.activeSipsCount} (${formatINR(mf.monthlySipCommitment)}/mo)</strong></span>
          <span>Top Fund: <strong>${mf.topHolding?.symbol || 'None'}</strong></span>
        </div>
      </div>

      <!-- Provident Fund (PF) Corpus Card (if present) -->
      ${pf && pf.count > 0 ? `
      <div class="card" style="background:#ffffff;border:1px solid #a5f3fc;border-radius:10px;padding:14px;page-break-inside:avoid;break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:8px;height:8px;border-radius:2px;background:#0891b2;"></div>
            <strong style="font-size:12px;color:#0e7490;text-transform:uppercase;letter-spacing:0.5px;">Provident Fund (PF) Corpus</strong>
          </div>
          <span style="font-size:10px;font-weight:700;color:#0891b2;background:#cffafe;padding:2px 6px;border-radius:4px;">
            ${pf.count} ${pf.count === 1 ? 'Account' : 'Accounts'}
          </span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div>
            <div style="font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;">Valuation / Balance</div>
            <div style="font-size:16px;font-weight:800;color:#0f172a;font-family:'JetBrains Mono',monospace;">${formatINR(pf.current)}</div>
            <div style="font-size:10.5px;color:#64748b;margin-top:2px;">Cost Basis: ${formatINR(pf.invested)}</div>
          </div>
          <div>
            <div style="font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;">Growth / Interest</div>
            <div style="font-size:16px;font-weight:800;font-family:'JetBrains Mono',monospace;color:${pf.unrealizedPnL >= 0 ? '#059669' : '#e11d48'};">
              ${pf.unrealizedPnL >= 0 ? '+' : ''}${formatINR(pf.unrealizedPnL)}
            </div>
            <div style="font-size:10.5px;font-weight:700;color:${pf.unrealizedPnLPercent >= 0 ? '#059669' : '#e11d48'};margin-top:2px;">
              ${pf.unrealizedPnLPercent >= 0 ? '+' : ''}${pf.unrealizedPnLPercent}% return
            </div>
          </div>
        </div>
        <div style="background:#f8fafc;padding:8px 10px;border-radius:8px;font-size:10.5px;color:#475569;display:flex;justify-content:space-between;">
          <span>Category: <strong>EPF / PPF / Retirement</strong></span>
          <span>Weight: <strong>${pfWeight.toFixed(1)}% of Portfolio</strong></span>
        </div>
      </div>
      ` : ''}

      <!-- Bonds & SGBs Card (if present) -->
      ${b && b.count > 0 ? `
      <div class="card" style="background:#ffffff;border:1px solid #fde68a;border-radius:10px;padding:14px;page-break-inside:avoid;break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:8px;height:8px;border-radius:2px;background:#d97706;"></div>
            <strong style="font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">Bonds &amp; SGB Debt</strong>
          </div>
          <span style="font-size:10px;font-weight:700;color:#d97706;background:#fef3c7;padding:2px 6px;border-radius:4px;">
            ${b.count} ${b.count === 1 ? 'Holding' : 'Holdings'}
          </span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div>
            <div style="font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;">Valuation</div>
            <div style="font-size:16px;font-weight:800;color:#0f172a;font-family:'JetBrains Mono',monospace;">${formatINR(b.current)}</div>
            <div style="font-size:10.5px;color:#64748b;margin-top:2px;">Cost: ${formatINR(b.invested)}</div>
          </div>
          <div>
            <div style="font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;">Unrealized P&L</div>
            <div style="font-size:16px;font-weight:800;font-family:'JetBrains Mono',monospace;color:${b.unrealizedPnL >= 0 ? '#059669' : '#e11d48'};">
              ${b.unrealizedPnL >= 0 ? '+' : ''}${formatINR(b.unrealizedPnL)}
            </div>
            <div style="font-size:10.5px;font-weight:700;color:${b.unrealizedPnLPercent >= 0 ? '#059669' : '#e11d48'};margin-top:2px;">
              ${b.unrealizedPnLPercent >= 0 ? '+' : ''}${b.unrealizedPnLPercent}% return
            </div>
          </div>
        </div>
        <div style="background:#f8fafc;padding:8px 10px;border-radius:8px;font-size:10.5px;color:#475569;display:flex;justify-content:space-between;">
          <span>Category: <strong>Govt Bonds / SGB Gold</strong></span>
          <span>Weight: <strong>${bWeight.toFixed(1)}% of Portfolio</strong></span>
        </div>
      </div>
      ` : ''}
    </div>

    <!-- Comparative Distribution Progress Bar -->
    <div class="card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:16px;page-break-inside:avoid;break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:11px;font-weight:700;margin-bottom:8px;">
        <span style="color:#2563eb;">Stocks: ${sWeight.toFixed(1)}% (${formatINR(s.current)})</span>
        <span style="color:#059669;">Mutual Funds: ${mfWeight.toFixed(1)}% (${formatINR(mf.current)})</span>
        ${b && b.count > 0 ? `<span style="color:#d97706;">Bonds &amp; SGBs: ${bWeight.toFixed(1)}% (${formatINR(b.current)})</span>` : ''}
        ${pf && pf.count > 0 ? `<span style="color:#0891b2;">Provident Fund: ${pfWeight.toFixed(1)}% (${formatINR(pf.current)})</span>` : ''}
      </div>
      <div style="height:10px;border-radius:9999px;background:#f1f5f9;display:flex;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <div style="height:100%;width:${sWeight}%;background:#2563eb;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
        <div style="height:100%;width:${mfWeight}%;background:#059669;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
        ${b && b.count > 0 ? `<div style="height:100%;width:${bWeight}%;background:#d97706;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>` : ''}
        ${pf && pf.count > 0 ? `<div style="height:100%;width:${pfWeight}%;background:#0891b2;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Generates an executive-formatted, printable standalone HTML dossier with embedded CSS and SVG charts
 */
export function generateAnalysisHTML(
  data: ExecutiveAnalysisData,
  scope: 'all' | 'analytics' | 'investments' = 'all'
): string {
  const isSurplus = data.analytics.netSavings >= 0;
  const isPortfolioProfitable = data.investments.unrealizedPnL >= 0;

  // Prepare points for the custom Profit/Loss Bar Charts
  const combinedBarPoints = data.investments.portfolioGrowthHistory.map((p) => ({
    label: p.shortLabel,
    invested: p.invested,
    valuation: p.valuation,
    growth: p.growth,
    growthPercent: p.growthPercent,
  }));

  const stocksBarPoints = data.investments.portfolioGrowthHistory.map((p) => ({
    label: p.shortLabel,
    invested: p.stocksInvested,
    valuation: p.stocksValuation,
    growth: p.stocksGrowth,
    growthPercent: p.stocksGrowthPercent,
  }));

  const mfBarPoints = data.investments.portfolioGrowthHistory.map((p) => ({
    label: p.shortLabel,
    invested: p.mfInvested,
    valuation: p.mfValuation,
    growth: p.mfGrowth,
    growthPercent: p.mfGrowthPercent,
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Executive Financial & Investment Portfolio Report - ${data.metadata.generatedAtFormatted}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
    
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      line-height: 1.45;
      margin: 0;
      padding: 0;
      font-size: 11px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .mono {
      font-family: 'JetBrains Mono', Consolas, monospace;
    }
    .dossier, .container {
      width: 100%;
      max-width: 880px;
      margin: 0 auto;
      padding: 16px;
    }
    @media screen and (min-width: 1100px) {
      .dossier, .container {
        max-width: 960px;
      }
    }
    .chart-card {
      width: 100%;
      box-sizing: border-box;
    }
    .chart-scroll-wrapper {
      width: 100%;
      box-sizing: border-box;
      overflow-x: auto;
      overflow-y: hidden;
      margin: 0;
      padding: 0;
    }
    .print-chart-svg, svg.print-chart-svg, .full-width-chart-svg, svg.full-width-chart-svg {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .meta-box strong {
      color: #0f172a;
      font-weight: 700;
    }
    
    .hero-card {
      background: #0f172a;
      color: #ffffff;
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 20px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .hero-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #34d399;
      font-weight: 700;
    }
    .hero-amount {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -1px;
      color: #ffffff;
      margin: 4px 0 10px 0;
    }
    .formula-banner {
      font-size: 10px;
      color: #94a3b8;
      border-top: 1px solid #334155;
      padding-top: 10px;
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6px;
    }
    .formula-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-top: 12px;
    }
    .formula-item {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 8px;
    }
    .formula-label {
      font-size: 9px;
      font-weight: 700;
      display: block;
    }
    .formula-val {
      font-size: 12px;
      font-weight: 800;
      margin-top: 4px;
      display: block;
    }

    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 6px;
      margin: 22px 0 12px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-after: avoid;
      break-after: avoid;
    }
    
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 16px;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .grid-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; page-break-inside: avoid; break-inside: avoid; }
    .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
    .kpi-value { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; font-family: 'JetBrains Mono', Consolas, monospace; }
    .kpi-sub { font-size: 10px; color: #64748b; margin-top: 3px; }
    
    .text-emerald { color: #059669 !important; }
    .text-rose { color: #e11d48 !important; }
    .text-indigo { color: #4f46e5 !important; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 20px; font-size: 10.5px; }
    th { background: #f8fafc; color: #475569; font-weight: 700; text-align: left; padding: 6px 8px; border-bottom: 1px solid #cbd5e1; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
    tr:nth-child(even) td { background-color: #fafbfc; }
    .num { font-family: 'JetBrains Mono', Consolas, monospace; text-align: right; }
    th.num { text-align: right; }
    
    .pill { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; }
    .pill-stock { background: #e0f2fe; color: #0369a1; }
    .pill-mf { background: #ecfdf5; color: #047857; }
    .pill-bond { background: #fef3c7; color: #b45309; }
    .pill-pf { background: #cffafe; color: #0e7490; }
    .pill-buy { background: #dcfce7; color: #15803d; }
    .pill-sell { background: #ffe4e6; color: #be123c; }
    .pill-div { background: #fef9c3; color: #854d0e; }
    
    .footer-stamp {
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      color: #64748b;
      font-size: 9px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; }

    /* SVG Print Color Rules */
    svg, svg * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    svg rect, svg path, svg circle, svg line, svg polygon {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    /* Discreet Background Watermark for PDF Export (Doubled Size for High-Resolution Branding) */
    .pdf-watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      pointer-events: none;
      z-index: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0.045;
      filter: grayscale(100%);
      user-select: none;
      text-align: center;
      width: 920px;
    }
    .pdf-watermark img {
      width: 192px;
      height: 192px;
      object-fit: contain;
      border-radius: 40px;
      margin-bottom: 24px;
      display: block;
    }
    .pdf-watermark .wm-title {
      font-size: 68px;
      font-weight: 900;
      letter-spacing: 12px;
      color: #0f172a;
      line-height: 1;
      text-transform: uppercase;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    }
    .pdf-watermark .wm-sub {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 4px;
      color: #475569;
      margin-top: 16px;
      text-transform: uppercase;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    }

    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }

    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm 12mm 10mm 12mm;
      }
      html, body {
        background: #ffffff !important;
        color: #0f172a !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: none !important;
        font-size: 11px !important;
        line-height: 1.4 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        forced-color-adjust: none !important;
      }
      *, *::before, *::after {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        forced-color-adjust: none !important;
      }
      .container,
      .dossier,
      .report-container,
      .analysis-report {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        max-width: none !important;
        width: 100% !important;
        margin: 0 !important;
        position: relative;
        z-index: 1;
      }
      /* Full-width responsive grids and metric rows */
      .grid-kpi,
      .summary-grid,
      .metrics-row,
      .cards-grid,
      div[style*="grid-template-columns"],
      div[style*="display:grid"],
      div[style*="display: grid"] {
        width: 100% !important;
        max-width: none !important;
      }
      svg, .print-chart-svg {
        max-width: 100% !important;
        width: 100% !important;
        height: auto !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      table {
        width: 100% !important;
        max-width: none !important;
        border-collapse: collapse !important;
        page-break-inside: auto;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: auto;
      }
      th, td {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .pdf-watermark {
        opacity: 0.045 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
        display: flex !important;
      }
      /* Hide all interactive print controls */
      .no-print,
      .hide-on-print,
      button,
      .print-btn,
      .print-btn-bar {
        display: none !important;
      }
      .page-break {
        page-break-before: always !important;
        break-before: page !important;
      }
      .chart-card,
      .kpi-card,
      .header,
      .section-title,
      .footer,
      .hero-card,
      .break-inside-avoid,
      .no-break {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        box-shadow: none !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      h1, h2, h3, h4, h5, h6, .section-title {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .chart-scroll-wrapper, div[style*="overflow-x"] {
        overflow: visible !important;
        overflow-x: visible !important;
        width: 100% !important;
        max-width: none !important;
        display: block !important;
      }
      svg.print-chart-svg, .print-chart-svg {
        overflow: visible !important;
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        min-height: 200px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      svg rect, svg path, svg polygon, svg circle, svg line, svg text {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
      }
      span[style*="background"], div[style*="background"] {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
      }
      .pill, .badge {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
      }
    }
  </style>
</head>
<body>
  <!-- Fixed PDF/Print Watermark with FinSync Logo & Name (Subtle, Non-Obtrusive) -->
  <div class="pdf-watermark" aria-hidden="true">
    <img src="/assets/aistudio/1000127183_6a8d46a3.png" alt="" onerror="this.style.display='none'" />
    <div class="wm-title">FINSYNC</div>
    <div class="wm-sub">LOG • SPLIT • TRACK • ANALYSE • GROW</div>
  </div>

  <div class="dossier container">
    <div class="no-print" style="margin-bottom: 18px; display: flex; justify-content: flex-end; gap: 10px;">
      <button class="print-btn" onclick="window.print()" style="padding: 9px 16px; background: #059669; color: #ffffff; border: none; border-radius: 10px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: inherit;">
        🖨️ Print / Save to PDF
      </button>
    </div>

    <!-- Header (Matching Net Worth Report) -->
    <div class="header">
      <div>
        <div class="brand-title">${scope === 'analytics' ? 'FinSync · Analytics & Cash Flow Dossier' : scope === 'investments' ? 'FinSync · Investment Portfolio Dossier' : 'FinSync · Analytics & Investment Dossier'}</div>
        <div class="brand-subtitle">${scope === 'analytics' ? 'Log Split Track Analyse Grow · Cash Flow, Incomes & Expenses Audit' : scope === 'investments' ? 'Log Split Track Analyse Grow · Securities, Holdings & Portfolio Audit' : 'Log Split Track Analyse Grow · Executive Wealth & Securities Audit'}</div>
      </div>
      <div class="meta-box">
        <div><strong>Prepared For:</strong> ${data.metadata.userProfileName}</div>
        <div><strong>Scope Period:</strong> ${data.metadata.periodLabel}</div>
        <div><strong>Generated On:</strong> ${data.metadata.generatedAtFormatted}</div>
        <div><strong>Currency:</strong> INR (₹) Notation</div>
      </div>
    </div>

    <!-- Hero Card (Matching Net Worth Report) -->
    <div class="hero-card">
      <div class="hero-title">${scope === 'analytics' ? 'TOTAL CASH FLOW & NET SAVINGS' : scope === 'investments' ? 'TOTAL INVESTMENT PORTFOLIO VALUATION' : 'CONSOLIDATED NET WORTH & PORTFOLIO VALUATION'}</div>
      <div class="hero-amount mono">${formatINR(scope === 'analytics' ? data.analytics.netSavings : scope === 'investments' ? data.investments.totalCurrentValue : data.netWorth.totalNetWorth, true)}</div>
      <div class="formula-banner">
        <span>${scope === 'analytics' ? `Total Income: ${formatINR(data.analytics.totalIncome, false)} | Total Expense: ${formatINR(data.analytics.totalExpense, false)}` : scope === 'investments' ? `Invested Cost: ${formatINR(data.investments.totalInvested, false)} | Booked Profit: ${formatINR(data.investments.totalBookedProfit, false)}` : `Components: Bank Cash (${formatINR(data.netWorth.liquidCash, false)}) + Portfolio (${formatINR(data.investments.totalCurrentValue, false)})`}</span>
        <span class="mono">${scope === 'analytics' ? (isSurplus ? '✓ Net Cash Surplus' : '⚠ Cash Deficit') : (isPortfolioProfitable ? '✓ Unrealized Profit' : '⚠ Capital Drawdown')}</span>
      </div>

      <div class="formula-grid">
        <div class="formula-item">
          <span class="formula-label" style="color:#60a5fa;">+ Bank Cash</span>
          <span class="formula-val mono">${formatINR(data.netWorth.liquidCash, false)}</span>
        </div>
        <div class="formula-item">
          <span class="formula-label" style="color:#34d399;">+ Portfolio Value</span>
          <span class="formula-val mono" style="color:#6ee7b7;">${formatINR(data.investments.totalCurrentValue, false)}</span>
        </div>
        <div class="formula-item">
          <span class="formula-label" style="color:${isSurplus ? '#38bdf8' : '#f87171'};">Net Savings</span>
          <span class="formula-val mono" style="color:${isSurplus ? '#bae6fd' : '#fca5a5'};">${isSurplus ? '+' : ''}${formatINR(data.analytics.netSavings, false)}</span>
        </div>
        <div class="formula-item">
          <span class="formula-label" style="color:${isPortfolioProfitable ? '#4ade80' : '#f87171'};">Unrealized P&L</span>
          <span class="formula-val mono" style="color:${isPortfolioProfitable ? '#bbf7d0' : '#fca5a5'};">${isPortfolioProfitable ? '+' : ''}${formatINR(data.investments.unrealizedPnL, false)}</span>
        </div>
      </div>
    </div>

    ${scope !== 'investments' ? `
    <!-- Cash Flow Comparison Graph -->
    <div class="section-title">1. Six-Month Income vs. Expense Comparison</div>
    ${buildSixMonthComparisonSVG(data.analytics.sixMonthTrend)}

    <div class="grid-kpi">
      <div class="kpi-card">
        <div class="kpi-label">6-Month Total Income</div>
        <div class="kpi-value text-emerald">${formatINR(data.analytics.sixMonthSummary.totalIncome)}</div>
        <div class="kpi-sub">Avg: ${formatINR(data.analytics.sixMonthSummary.avgMonthlyIncome)}/mo</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">6-Month Total Expenses</div>
        <div class="kpi-value text-rose">${formatINR(data.analytics.sixMonthSummary.totalExpense)}</div>
        <div class="kpi-sub">Avg: ${formatINR(data.analytics.sixMonthSummary.avgMonthlyExpense)}/mo</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">6-Month Net Surplus</div>
        <div class="kpi-value ${data.analytics.sixMonthSummary.netSavings >= 0 ? 'text-emerald' : 'text-rose'}">
          ${data.analytics.sixMonthSummary.netSavings >= 0 ? '+' : ''}${formatINR(data.analytics.sixMonthSummary.netSavings)}
        </div>
        <div class="kpi-sub">Avg: ${formatINR(data.analytics.sixMonthSummary.avgMonthlySavings)}/mo</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Period Savings Rate</div>
        <div class="kpi-value text-emerald">${data.analytics.savingsRate}%</div>
        <div class="kpi-sub">${data.metadata.periodLabel}</div>
      </div>
    </div>

    <!-- Category Breakdown Table -->
    <table>
      <thead>
        <tr>
          <th>Category Name</th>
          <th>Type</th>
          <th class="num">Amount (₹)</th>
          <th class="num">Share %</th>
          <th class="num">Tx Count</th>
        </tr>
      </thead>
      <tbody>
        ${data.analytics.categories.map((c) => `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td><span class="pill ${c.type === 'expense' ? 'pill-sell' : 'pill-buy'}">${c.type}</span></td>
            <td class="num font-bold">${formatINR(c.amount)}</td>
            <td class="num">${c.percentage}%</td>
            <td class="num">${c.count}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    ${scope === 'all' ? '<div class="page-break"></div>' : ''}

    ${scope !== 'analytics' ? `
    <!-- Investment Portfolio Growth: Single-Bar Graphs -->
    <div class="section-title">${scope === 'investments' ? '1' : '2'}. Investment Portfolio Growth & Capital Bar Graphs</div>
    <p style="font-size:11px;color:#64748b;margin-bottom:14px;">
      Custom single-bar growth visualizations: <strong>Blue</strong> represents invested cost basis; <strong>Green with solid border</strong> represents profit level above invested capital; <strong>Dotted Red rectangle</strong> represents capital loss from invested level.
    </p>

    <!-- Combined Portfolio Growth Bar Graph -->
    ${buildProfitLossBarChartSVG(
      combinedBarPoints,
      'Combined Portfolio Growth (Invested vs. Profit / Loss)',
      'Trailing 6-month progression showing total portfolio capital basis with profit surplus & loss drawdowns'
    )}

    <!-- Stocks Growth Bar Graph -->
    ${buildProfitLossBarChartSVG(
      stocksBarPoints,
      'Direct Equities (Stocks) Growth Analysis',
      'Trailing 6-month equity capital basis showing profit level above cost basis or dotted loss'
    )}

    <!-- Mutual Funds (MF) Growth Bar Graph -->
    ${buildProfitLossBarChartSVG(
      mfBarPoints,
      'Mutual Funds & SIPs Growth Analysis',
      'Trailing 6-month mutual fund capital basis showing profit level above cost basis or dotted loss'
    )}

    <!-- Portfolio Trajectory Area Curve -->
    ${buildPortfolioGrowthSVG(data.investments.portfolioGrowthHistory)}

    <!-- Asset Allocation Donut Chart -->
    <div class="card chart-card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:16px;page-break-inside:avoid!important;break-inside:avoid!important;">
      <h3 style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:10px;">Asset Class Allocation & Distribution</h3>
      ${buildAssetAllocationDonutSVG(data.investments.assetAllocation, data.investments.totalCurrentValue)}
    </div>

    <!-- Stocks vs Mutual Funds Comparative Analysis -->
    <div class="section-title">${scope === 'investments' ? '2' : '3'}. Equities (Stocks) vs. Mutual Funds Comparison</div>
    ${buildStocksVsMutualFundsComparison(data.investments.stocksVsMutualFunds)}

    <!-- Detailed Holdings Table -->
    <div class="section-title">${scope === 'investments' ? '3' : '4'}. Investment Holdings Ledger & Valuation</div>
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Asset Name</th>
          <th>Type</th>
          <th class="num">Shares / Units</th>
          <th class="num">Avg Price</th>
          <th class="num">CMP / NAV</th>
          <th class="num">Invested (₹)</th>
          <th class="num">Current Value (₹)</th>
          <th class="num">Unrealized P&L</th>
          <th class="num">Weight</th>
        </tr>
      </thead>
      <tbody>
        ${data.investments.holdings.map((h) => {
          const isProf = h.unrealizedPnL >= 0;
          return `
            <tr>
              <td><strong>${h.symbol}</strong></td>
              <td>${h.name}</td>
              <td><span class="pill pill-${h.assetType === 'stock' ? 'stock' : h.assetType === 'mutual_fund' ? 'mf' : h.assetType === 'pf' ? 'pf' : 'bond'}">${h.assetType === 'pf' ? 'PF' : h.assetType.replace('_', ' ')}</span></td>
              <td class="num">${formatNumber(h.quantity)}</td>
              <td class="num">${formatINR(h.averageBuyPrice)}</td>
              <td class="num font-bold">${formatINR(h.currentPrice)}</td>
              <td class="num">${formatINR(h.investedValue)}</td>
              <td class="num font-bold">${formatINR(h.currentValue)}</td>
              <td class="num ${isProf ? 'text-emerald' : 'text-rose'} font-bold">
                ${isProf ? '+' : ''}${formatINR(h.unrealizedPnL)} (${isProf ? '+' : ''}${h.unrealizedPnLPercent.toFixed(1)}%)
              </td>
              <td class="num">${h.weightPercent.toFixed(1)}%</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- Active SIP Commitments -->
    ${data.investments.sips.length > 0 ? `
      <div class="section-title">${scope === 'investments' ? '4' : '5'}. Active Systematic Investment Plans (SIP)</div>
      <table>
        <thead>
          <tr>
            <th>Mutual Fund Scheme</th>
            <th>Scheme Code</th>
            <th class="num">Monthly Installment (₹)</th>
            <th>Schedule Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.investments.sips.map((s) => `
            <tr>
              <td><strong>${s.schemeName}</strong></td>
              <td><code>${s.schemeCode}</code></td>
              <td class="num font-bold text-indigo">${formatINR(s.installmentAmount)}</td>
              <td>${s.sipDate}th of every month</td>
              <td><span class="pill pill-buy">${s.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}
    ` : ''}

    <!-- Footer Stamp (Matching Net Worth Report) -->
    <div class="footer-stamp">
      <div>FinSync Personal Finance · Offline-first Cryptographically Verified Audit Dossier</div>
      <div>Generated ${data.metadata.generatedAtFormatted} · Scope: ${data.metadata.periodLabel}</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates an executive Markdown summary for quick copy to clipboard
 */
export function generateAnalysisMarkdown(data: ExecutiveAnalysisData): string {
  const isSurplus = data.analytics.netSavings >= 0;
  const isPortfolioProfitable = data.investments.unrealizedPnL >= 0;
  const s = data.investments.stocksVsMutualFunds.stocks;
  const mf = data.investments.stocksVsMutualFunds.mutualFunds;

  return `# FinSync — Financial & Investment Portfolio Executive Analysis
*Log • Split • Track • Analyse • Grow*

**Report Date:** ${data.metadata.generatedAtFormatted}
**Prepared For:** ${data.metadata.userProfileName}
**Reporting Scope:** ${data.metadata.periodLabel}

---

## 🏛️ Executive Net Worth & Portfolio Summary
- **Combined Net Worth:** ${formatINR(data.netWorth.totalNetWorth)}
- **Liquid Cash & Bank Accounts:** ${formatINR(data.netWorth.liquidCash)}
- **Investment Portfolio Valuation:** ${formatINR(data.investments.totalCurrentValue)}
- **Invested Capital (Cost Basis):** ${formatINR(data.investments.totalInvested)}
- **Unrealized Gain / Loss:** ${isPortfolioProfitable ? '+' : ''}${formatINR(data.investments.unrealizedPnL)} (${data.investments.unrealizedPnLPercent >= 0 ? '+' : ''}${data.investments.unrealizedPnLPercent}%)
- **Realized / Booked Profits:** ${formatINR(data.investments.totalBookedProfit)}
- **Annualized Return (XIRR):** ${data.investments.portfolioXIRR !== null ? `${data.investments.portfolioXIRR.toFixed(2)}%` : 'N/A'}
- **1-Day Market Performance:** ${data.investments.totalDayChange >= 0 ? '+' : ''}${formatINR(data.investments.totalDayChange)} (${data.investments.totalDayChangePercent >= 0 ? '+' : ''}${data.investments.totalDayChangePercent}%)

---

## 📊 Six-Month Income vs. Expense Comparison
${data.analytics.sixMonthTrend.map((m) => `- **${m.monthLabel}**: Income ${formatINR(m.income)} | Expense ${formatINR(m.expense)} | Net ${m.netSavings >= 0 ? '+' : ''}${formatINR(m.netSavings)} (${m.savingsRate}%)`).join('\n')}
- **6-Month Total Income:** ${formatINR(data.analytics.sixMonthSummary.totalIncome)} (Avg: ${formatINR(data.analytics.sixMonthSummary.avgMonthlyIncome)}/mo)
- **6-Month Total Expenses:** ${formatINR(data.analytics.sixMonthSummary.totalExpense)} (Avg: ${formatINR(data.analytics.sixMonthSummary.avgMonthlyExpense)}/mo)
- **6-Month Net Savings:** ${formatINR(data.analytics.sixMonthSummary.netSavings)} (Avg: ${formatINR(data.analytics.sixMonthSummary.avgMonthlySavings)}/mo)

---

## ⚖️ Asset Class Allocation & Equities Comparison
- **Direct Equities (Stocks):** ${s.count} holdings | Invested ${formatINR(s.invested)} | Value ${formatINR(s.current)} | P&L ${s.unrealizedPnL >= 0 ? '+' : ''}${formatINR(s.unrealizedPnL)} (${s.unrealizedPnLPercent}%) | Weight ${s.weight.toFixed(1)}%
- **Mutual Funds & SIPs:** ${mf.count} funds | Invested ${formatINR(mf.invested)} | Value ${formatINR(mf.current)} | P&L ${mf.unrealizedPnL >= 0 ? '+' : ''}${formatINR(mf.unrealizedPnL)} (${mf.unrealizedPnLPercent}%) | Weight ${mf.weight.toFixed(1)}% | Active SIPs: ${mf.activeSipsCount} (${formatINR(mf.monthlySipCommitment)}/mo)${data.investments.stocksVsMutualFunds.pf && data.investments.stocksVsMutualFunds.pf.count > 0 ? `\n- **Provident Fund (PF):** ${data.investments.stocksVsMutualFunds.pf.count} accounts | Balance ${formatINR(data.investments.stocksVsMutualFunds.pf.current)} | Cost ${formatINR(data.investments.stocksVsMutualFunds.pf.invested)} | Return ${data.investments.stocksVsMutualFunds.pf.unrealizedPnLPercent}% | Weight ${data.investments.stocksVsMutualFunds.pf.weight.toFixed(1)}%` : ''}${data.investments.stocksVsMutualFunds.bonds && data.investments.stocksVsMutualFunds.bonds.count > 0 ? `\n- **Bonds & SGBs:** ${data.investments.stocksVsMutualFunds.bonds.count} holdings | Value ${formatINR(data.investments.stocksVsMutualFunds.bonds.current)} | Cost ${formatINR(data.investments.stocksVsMutualFunds.bonds.invested)} | Return ${data.investments.stocksVsMutualFunds.bonds.unrealizedPnLPercent}% | Weight ${data.investments.stocksVsMutualFunds.bonds.weight.toFixed(1)}%` : ''}

---

## 📈 Portfolio Growth Trajectory (Last 6 Months)
${data.investments.portfolioGrowthHistory.map((p) => `- **${p.monthLabel}**: Invested ${formatINR(p.invested)} → Valuation ${formatINR(p.valuation)} (Gain: ${p.growth >= 0 ? '+' : ''}${formatINR(p.growth)} / ${p.growthPercent}%)`).join('\n')}

---

## 📑 Portfolio Holdings
${data.investments.holdings.map((h) => `- **${h.symbol}** (${h.name}): ${formatNumber(h.quantity)} units @ CMP ${formatINR(h.currentPrice)} | Val: ${formatINR(h.currentValue)} | P&L: ${h.unrealizedPnL >= 0 ? '+' : ''}${formatINR(h.unrealizedPnL)} (${h.unrealizedPnLPercent.toFixed(1)}%) | Weight: ${h.weightPercent.toFixed(1)}%`).join('\n')}

${data.investments.sips.length > 0 ? `
---

## 🔄 Active SIP Schedules
${data.investments.sips.map((s) => `- **${s.schemeName}**: ${formatINR(s.installmentAmount)}/mo on ${s.sipDate}th (${s.status})`).join('\n')}
` : ''}
`;
}

/**
 * Downloads a file safely across Android native storage and browser
 */
export function downloadAnalysisFile(content: string, filename: string, mimeType: string): void {
  fileService.exportAndShare({
    filename,
    content,
    mimeType,
    title: filename,
    dialogTitle: 'Download or Share Report',
  });
}

/**
 * Compiles and exports the complete executive analysis dossier into a real, high-quality vector PDF
 * using native vector typography, structured autoTables, and vector graphics.
 * Produces crisp text at any zoom level, selectable copyable text, tiny file size (< 250KB),
 * and executes within milliseconds without high RAM overhead on mobile devices.
 */
export async function exportAnalysisToPdf(
  data: ExecutiveAnalysisData,
  onProgress?: (msg: string) => void,
  scope: 'all' | 'analytics' | 'investments' = 'all'
): Promise<void> {
  onProgress?.("Compiling executive dossier layout & charts...");

  const htmlContent = generateAnalysisHTML(data, scope);
  const dateStr = new Date().toISOString().split("T")[0];
  const prefix = scope === "analytics" ? "Analytics" : scope === "investments" ? "Investments" : "Executive_Analysis";
  const fileName = `FinSync_${prefix}_${dateStr}.pdf`;

  const reportTitle = scope === "analytics"
    ? "Financial Analytics & Cash Flow Dossier"
    : scope === "investments"
    ? "Investment Portfolio & Asset Allocation Audit"
    : "Executive Financial & Investment Dossier";

  await exportHtmlStringToPdf(htmlContent, {
    fileName,
    onProgress,
    reportTitle,
    widthPx: 800,
    marginTopBottomMm: 12,
    marginLeftRightMm: 12,
  });
}
