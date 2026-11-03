import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  X,
  ArrowLeft,
  Scale,
  Landmark,
  CreditCard,
  HandCoins,
  Coins,
  TrendingUp,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  TrendingDown,
  Printer,
  Download,
  Activity,
  FileText,
  Eye,
} from 'lucide-react';
import { formatINR, formatCompactINR, formatDate, parseDate } from '../../utils/formatters';
import { InvestmentHolding } from '../../types';
import {
  printNetWorthPDF,
  exportNetWorthPDF,
  downloadNetWorthHTML,
  generateNetWorthHTML,
  NetWorthExportData,
} from '../../utils/netWorthExportEngine';

interface NetWorthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TimelinePeriod = 'week' | 'month' | 'year' | 'all';
type ChartMetric = 'net_worth' | 'assets' | 'liabilities';
type LineChartMetric = 'net_worth' | 'assets' | 'liabilities' | 'compare';

interface NetWorthGrowthPoint {
  label: string;
  fullDate: string;
  netWorth: number;
  net_worth: number;
  assets: number;
  liabilities: number;
  growth: number;
  growthPercent: number;
  rawTime: number;
}

export const NetWorthModal: React.FC<NetWorthModalProps> = ({ isOpen, onClose }) => {
  const {
    accounts,
    transactions,
    debts,
    holdings,
    loans,
    userProfile,
    getHoldingMarketPrice,
    showToast,
    setActiveTab,
    setSelectedAccountId,
    netLiquidWealth,
    setIsDebtsModalOpen,
    setInitialDebtCategoryTab,
    setIsLoansModalOpen,
    clearModalOpenedFromTools,
    setIsExtendedToolsOpen,
    openHtmlReportViewer,
  } = useApp();

  const [growthPeriod, setGrowthPeriod] = useState<TimelinePeriod>('month');
  const [lineTimeline, setLineTimeline] = useState<'month' | 'year' | 'all'>('month');
  const [pieMode, setPieMode] = useState<'assets' | 'assets_vs_liabilities'>('assets');
  const [barMetric, setBarMetric] = useState<ChartMetric>('net_worth');
  const [lineMetric, setLineMetric] = useState<LineChartMetric>('compare');
  const [isExporting, setIsExporting] = useState(false);

  const mainScrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isOpen) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = 0;
      }
    }
  }, [isOpen]);

  // Quick navigation handler for interactive breakdown
  const handleNavigateSection = (sectionId: string) => {
    // Explicit reference navigation: clear any pending tool origin so user is not brought back to More Tools
    clearModalOpenedFromTools();
    setIsExtendedToolsOpen(false);

    switch (sectionId) {
      case 'bank':
      case 'accounts':
      case 'credit_card':
        setActiveTab('accounts');
        setSelectedAccountId(null);
        onClose();
        break;
      case 'stocks':
      case 'mf':
      case 'pf_bonds':
      case 'investments':
        setActiveTab('investments');
        onClose();
        break;
      case 'lent':
      case 'borrowed':
      case 'debts':
        setIsDebtsModalOpen(true);
        setInitialDebtCategoryTab('individual');
        onClose();
        break;
      case 'loans':
      case 'liabilities':
        setIsLoansModalOpen(true);
        onClose();
        break;
      default:
        break;
    }
  };

  // ---------------------------------------------------------
  // 1. Current Real-Time Net Worth Calculation Components
  // Formula:
  // Net Worth = sum of all bank balances - Credit card dues + money lend - money borrowed + Investments - Loans
  // ---------------------------------------------------------

  // 1a. Bank Balances (Uses Net Liquid Wealth)
  const bankAccounts = useMemo(() => {
    return accounts.filter(
      (a) =>
        !a.isArchived &&
        !a.isSystemLoanAccount &&
        !a.isSystemDebtAccount &&
        (a.type === 'bank' || a.type === 'cash' || a.type === 'wallet' || a.type === 'demat')
    );
  }, [accounts]);

  const totalBankBalances = netLiquidWealth;

  // 1b. Credit Card Dues (Credit cards with negative balance)
  const creditCardAccounts = useMemo(() => {
    return accounts.filter((a) => !a.isArchived && a.type === 'credit');
  }, [accounts]);

  const totalCreditCardDues = useMemo(() => {
    return creditCardAccounts.reduce((sum, a) => sum + (a.balance < 0 ? Math.abs(a.balance) : 0), 0);
  }, [creditCardAccounts]);

  // 1c. Money Lent (Active receivables from others)
  const activeDebtsLent = useMemo(() => {
    return debts.filter((d) => d.status === 'active' && d.type === 'lent');
  }, [debts]);

  const totalMoneyLent = useMemo(() => {
    return activeDebtsLent.reduce((sum, d) => sum + Math.max(0, d.currentBalance), 0);
  }, [activeDebtsLent]);

  // 1d. Money Borrowed (Active payables / IOUs owed to others)
  const activeDebtsBorrowed = useMemo(() => {
    return debts.filter((d) => d.status === 'active' && d.type === 'borrowed');
  }, [debts]);

  const totalMoneyBorrowed = useMemo(() => {
    return activeDebtsBorrowed.reduce((sum, d) => sum + Math.max(0, d.currentBalance), 0);
  }, [activeDebtsBorrowed]);

  // 1e. Investments (Stocks, Mutual Funds, PF, Bonds, SGB)
  const stockHoldings = useMemo(() => holdings.filter((h) => h.assetType === 'stock'), [holdings]);
  const mfHoldings = useMemo(() => holdings.filter((h) => h.assetType === 'mutual_fund'), [holdings]);
  const pfHoldings = useMemo(() => holdings.filter((h) => h.assetType === 'pf'), [holdings]);
  const bondHoldings = useMemo(
    () => holdings.filter((h) => h.assetType === 'bond' || h.assetType === 'sgb'),
    [holdings]
  );

  const stocksValuation = useMemo(() => {
    return stockHoldings.reduce((sum, h) => sum + h.quantity * getHoldingMarketPrice(h).price, 0);
  }, [stockHoldings, getHoldingMarketPrice]);

  const mfValuation = useMemo(() => {
    return mfHoldings.reduce((sum, h) => sum + h.quantity * getHoldingMarketPrice(h).price, 0);
  }, [mfHoldings, getHoldingMarketPrice]);

  const pfValuation = useMemo(() => {
    return pfHoldings.reduce((sum, h) => sum + h.quantity * getHoldingMarketPrice(h).price, 0);
  }, [pfHoldings, getHoldingMarketPrice]);

  const bondValuation = useMemo(() => {
    return bondHoldings.reduce((sum, h) => sum + h.quantity * getHoldingMarketPrice(h).price, 0);
  }, [bondHoldings, getHoldingMarketPrice]);

  const totalInvestments = stocksValuation + mfValuation + pfValuation + bondValuation;

  // 1f. Loans Liability (Outstanding principal remaining)
  const activeLoans = useMemo(() => loans.filter((l) => l.isActive), [loans]);

  const totalLoans = useMemo(() => {
    return activeLoans.reduce((sum, l) => {
      const loanAcc = accounts.find((a) => a.id === l.loanAccountId);
      const remaining = loanAcc ? Math.max(0, Math.abs(loanAcc.balance)) : l.totalAmount;
      return sum + remaining;
    }, 0);
  }, [activeLoans, accounts]);

  // Total Gross Assets & Total Liabilities
  const totalGrossAssets = totalBankBalances + totalMoneyLent + totalInvestments;
  const totalLiabilities = totalMoneyBorrowed + totalLoans;

  // Net Worth = Net Liquid Wealth + Money Lent - Money Borrowed + Investments - Loans
  const netWorth = totalGrossAssets - totalLiabilities;

  // ---------------------------------------------------------
  // 2. Wealth Distribution Pie / Donut Data
  // ---------------------------------------------------------
  const assetDistributionData = useMemo(() => {
    const rawItems = [
      {
        id: 'bank',
        name: 'Bank & Liquid Cash',
        value: Math.max(0, totalBankBalances),
        color: '#3b82f6', // Blue
        icon: Landmark,
      },
      {
        id: 'stocks',
        name: 'Direct Stocks',
        value: Math.max(0, stocksValuation),
        color: '#8b5cf6', // Violet
        icon: TrendingUp,
      },
      {
        id: 'mf',
        name: 'Mutual Funds',
        value: Math.max(0, mfValuation),
        color: '#10b981', // Emerald
        icon: Coins,
      },
      {
        id: 'pf_bonds',
        name: 'PF & Sovereign Bonds',
        value: Math.max(0, pfValuation + bondValuation),
        color: '#f59e0b', // Amber
        icon: ShieldCheck,
      },
      {
        id: 'lent',
        name: 'Money Lent (Receivables)',
        value: Math.max(0, totalMoneyLent),
        color: '#06b6d4', // Cyan
        icon: HandCoins,
      },
    ];

    const totalVal = rawItems.reduce((acc, curr) => acc + curr.value, 0) || 1;
    return rawItems
      .filter((item) => item.value > 0)
      .map((item) => ({
        ...item,
        percentage: ((item.value / totalVal) * 100).toFixed(1),
      }));
  }, [totalBankBalances, stocksValuation, mfValuation, pfValuation, bondValuation, totalMoneyLent]);

  const assetsVsLiabilitiesData = useMemo(() => {
    const total = Math.max(1, totalGrossAssets + totalLiabilities);
    return [
      {
        id: 'assets',
        name: 'Gross Assets',
        value: Math.max(0, totalGrossAssets),
        color: '#10b981',
        icon: TrendingUp,
        percentage: ((Math.max(0, totalGrossAssets) / total) * 100).toFixed(1),
      },
      {
        id: 'liabilities',
        name: 'Total Liabilities',
        value: Math.max(0, totalLiabilities),
        color: '#ef4444',
        icon: TrendingDown,
        percentage: ((Math.max(0, totalLiabilities) / total) * 100).toFixed(1),
      },
    ];
  }, [totalGrossAssets, totalLiabilities]);

  const activePieData = pieMode === 'assets' ? assetDistributionData : assetsVsLiabilitiesData;

  // Compute historical Net Worth point at any timestamp
  const computeNetWorthAt = useCallback(
    (timestamp: number) => {
      let histBankBalance = totalBankBalances;
      let histCreditDue = totalCreditCardDues;

      transactions.forEach((tx) => {
        const txTime = parseDate(tx.date).getTime();
        if (txTime > timestamp) {
          const fromAcc = accounts.find((a) => a.id === tx.fromAccountId);
          const toAcc = tx.toAccountId ? accounts.find((a) => a.id === tx.toAccountId) : null;

          if (fromAcc) {
            if (fromAcc.type === 'credit') {
              histCreditDue = Math.max(0, histCreditDue - tx.amount);
            } else if (
              fromAcc.type === 'bank' ||
              fromAcc.type === 'cash' ||
              fromAcc.type === 'wallet' ||
              fromAcc.type === 'demat'
            ) {
              histBankBalance += tx.amount;
            }
          }

          if (toAcc) {
            if (toAcc.type === 'credit') {
              histCreditDue += tx.amount;
            } else if (
              toAcc.type === 'bank' ||
              toAcc.type === 'cash' ||
              toAcc.type === 'wallet' ||
              toAcc.type === 'demat'
            ) {
              histBankBalance -= tx.amount;
            }
          }
        }
      });

      let histInvestments = 0;
      holdings.forEach((h: InvestmentHolding) => {
        let q = 0;
        let cost = 0;
        const liveCMP = getHoldingMarketPrice(h).price || h.currentPrice || h.averageBuyPrice;
        let lastPrice = liveCMP;

        const txs = [...(h.transactions || [])].sort(
          (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
        );

        txs.forEach((t) => {
          const tTime = parseDate(t.date).getTime();
          if (tTime <= timestamp) {
            if (t.type === 'buy') {
              q += t.quantity;
              cost += t.totalAmount;
              if (t.price > 0) lastPrice = t.price;
            } else if (t.type === 'sell') {
              const avg = q > 0 ? cost / q : 0;
              q = Math.max(0, q - t.quantity);
              cost = Math.max(0, q * avg);
              if (t.price > 0) lastPrice = t.price;
            } else if (t.type === 'split' || t.type === 'bonus') {
              q += t.quantity;
            }
          }
        });

        if (timestamp >= Date.now()) {
          histInvestments += q * liveCMP;
        } else {
          const tFirst = txs[0] ? parseDate(txs[0].date).getTime() : timestamp;
          const progress = Math.min(1, Math.max(0, (timestamp - tFirst) / (Date.now() - tFirst || 1)));
          const interpPrice = lastPrice + (liveCMP - lastPrice) * progress;
          histInvestments += q * interpPrice;
        }
      });

      let histLent = 0;
      let histBorrowed = 0;
      debts.forEach((d) => {
        const dCreated = parseDate(d.createdAt || '2020-01-01').getTime();
        if (dCreated <= timestamp) {
          if (d.type === 'lent') histLent += d.currentBalance;
          else histBorrowed += d.currentBalance;
        }
      });

      let histLoans = 0;
      activeLoans.forEach((l) => {
        const lStart = parseDate(l.startDate || '2020-01-01').getTime();
        if (lStart <= timestamp) {
          const progress = Math.min(1, Math.max(0, (timestamp - lStart) / (Date.now() - lStart || 1)));
          const currentRemaining = accounts.find((a) => a.id === l.loanAccountId)
            ? Math.abs(accounts.find((a) => a.id === l.loanAccountId)!.balance)
            : l.totalAmount;
          const estRemaining = l.totalAmount - (l.totalAmount - currentRemaining) * progress;
          histLoans += estRemaining;
        }
      });

      const calcAssets = Math.round(histBankBalance + histLent + histInvestments);
      const calcLiabilities = Math.round(histCreditDue + histBorrowed + histLoans);
      const calcNetWorth = calcAssets - calcLiabilities;

      return {
        assets: calcAssets,
        liabilities: calcLiabilities,
        netWorth: calcNetWorth,
      };
    },
    [
      totalBankBalances,
      totalCreditCardDues,
      transactions,
      accounts,
      holdings,
      getHoldingMarketPrice,
      debts,
      activeLoans,
    ]
  );

  // Dedicated Monthly Timeline Data Generator for Net Worth Dossier & PDF Reports
  const getMonthlyReportTimelineData = useCallback(
    (monthsCount: number = 6): NetWorthGrowthPoint[] => {
      const now = new Date();
      const columns: NetWorthGrowthPoint[] = [];

      for (let i = monthsCount - 1; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const isCurrent = i === 0;
        const ts = isCurrent ? now.getTime() : targetDate.getTime();
        const monthName = targetDate.toLocaleDateString('en-IN', { month: 'short' });
        const yr = targetDate.getFullYear().toString().slice(-2);
        const st = isCurrent
          ? { assets: totalGrossAssets, liabilities: totalLiabilities, netWorth }
          : computeNetWorthAt(ts);

        columns.push({
          label: isCurrent ? 'Current' : `${monthName} '${yr}`,
          fullDate: isCurrent ? 'Current (Live)' : targetDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          netWorth: Math.round(st.netWorth),
          net_worth: Math.round(st.netWorth),
          assets: Math.round(st.assets),
          liabilities: Math.round(st.liabilities),
          growth: 0,
          growthPercent: 0,
          rawTime: ts,
        });
      }

      for (let i = 0; i < columns.length; i++) {
        if (i === 0) {
          columns[i].growth = 0;
          columns[i].growthPercent = 0;
        } else {
          const prev = columns[i - 1].netWorth;
          const curr = columns[i].netWorth;
          const change = curr - prev;
          const pct = prev !== 0 ? (change / Math.abs(prev)) * 100 : 0;
          columns[i].growth = change;
          columns[i].growthPercent = pct;
        }
      }

      return columns;
    },
    [computeNetWorthAt, totalGrossAssets, totalLiabilities, netWorth]
  );

  // Earliest historical date calculation across all modules
  const earliestHistoricalTime = useMemo(() => {
    const now = new Date();
    let earliest = now.getTime();

    transactions.forEach((tx) => {
      const d = parseDate(tx.date).getTime();
      if (d && d < earliest) earliest = d;
    });

    holdings.forEach((h) => {
      const pDate = parseDate(h.purchaseDate || h.openingDate || '').getTime();
      if (pDate && pDate < earliest) earliest = pDate;
      (h.transactions || []).forEach((t) => {
        const d = parseDate(t.date).getTime();
        if (d && d < earliest) earliest = d;
      });
    });

    debts.forEach((d) => {
      const cDate = parseDate(d.createdAt || '').getTime();
      if (cDate && cDate < earliest) earliest = cDate;
    });

    if (earliest >= now.getTime()) {
      earliest = now.getTime() - 3 * 365 * 86400 * 1000;
    }

    return earliest;
  }, [transactions, holdings, debts]);

  // ---------------------------------------------------------
  // 3. Historical Net Worth Growth Timeline Computation
  // (Weeks, Months, Years, All Time for Bar Chart)
  // ---------------------------------------------------------
  const growthTimelineData = useMemo(() => {
    const now = new Date();
    const columns: NetWorthGrowthPoint[] = [];

    if (growthPeriod === 'week') {
      for (let i = 5; i >= 0; i--) {
        const isCurrent = i === 0;
        const ts = isCurrent ? now.getTime() : now.getTime() - i * 7 * 86400 * 1000;
        const d = new Date(ts);
        const st = isCurrent
          ? { assets: totalGrossAssets, liabilities: totalLiabilities, netWorth }
          : computeNetWorthAt(ts);

        const label = isCurrent ? 'Now' : `W-${i} (${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`;
        const fullDate = isCurrent ? 'Current Week' : `Week ending ${formatDate(d)}`;

        columns.push({
          label,
          fullDate,
          netWorth: Math.round(st.netWorth),
          net_worth: Math.round(st.netWorth),
          assets: Math.round(st.assets),
          liabilities: Math.round(st.liabilities),
          growth: 0,
          growthPercent: 0,
          rawTime: ts,
        });
      }
    } else if (growthPeriod === 'month') {
      for (let i = 5; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const isCurrent = i === 0;
        const ts = isCurrent ? now.getTime() : targetDate.getTime();
        const monthName = targetDate.toLocaleDateString('en-IN', { month: 'short' });
        const yr = targetDate.getFullYear().toString().slice(-2);
        const st = isCurrent
          ? { assets: totalGrossAssets, liabilities: totalLiabilities, netWorth }
          : computeNetWorthAt(ts);

        columns.push({
          label: isCurrent ? 'Current' : `${monthName} '${yr}`,
          fullDate: isCurrent ? 'Current (Live)' : targetDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          netWorth: Math.round(st.netWorth),
          net_worth: Math.round(st.netWorth),
          assets: Math.round(st.assets),
          liabilities: Math.round(st.liabilities),
          growth: 0,
          growthPercent: 0,
          rawTime: ts,
        });
      }
    } else if (growthPeriod === 'year') {
      for (let i = 4; i >= 0; i--) {
        const targetYear = now.getFullYear() - i;
        const isCurrent = i === 0;
        const ts = isCurrent ? now.getTime() : new Date(targetYear, 11, 31, 23, 59, 59).getTime();
        const st = isCurrent
          ? { assets: totalGrossAssets, liabilities: totalLiabilities, netWorth }
          : computeNetWorthAt(ts);

        columns.push({
          label: targetYear.toString(),
          fullDate: isCurrent ? `Year ${targetYear} (To Date)` : `Year ${targetYear}`,
          netWorth: Math.round(st.netWorth),
          net_worth: Math.round(st.netWorth),
          assets: Math.round(st.assets),
          liabilities: Math.round(st.liabilities),
          growth: 0,
          growthPercent: 0,
          rawTime: ts,
        });
      }
    } else {
      // 'all' time: 6 bars spanning from earliest historical date to today
      const startTime = earliestHistoricalTime;
      const totalSpan = now.getTime() - startTime;
      const tickCount = 6;
      const step = totalSpan > 0 ? totalSpan / Math.max(1, tickCount - 1) : 1;

      for (let i = 0; i < tickCount; i++) {
        const isCurrent = i === tickCount - 1;
        const ts = isCurrent ? now.getTime() : startTime + i * step;
        const d = new Date(ts);
        const st = isCurrent
          ? { assets: totalGrossAssets, liabilities: totalLiabilities, netWorth }
          : computeNetWorthAt(ts);

        const label = isCurrent ? 'Today' : d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        const fullDate = isCurrent ? 'Today (Current)' : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

        columns.push({
          label,
          fullDate,
          netWorth: Math.round(st.netWorth),
          net_worth: Math.round(st.netWorth),
          assets: Math.round(st.assets),
          liabilities: Math.round(st.liabilities),
          growth: 0,
          growthPercent: 0,
          rawTime: ts,
        });
      }
    }

    for (let i = 0; i < columns.length; i++) {
      if (i === 0) {
        columns[i].growth = 0;
        columns[i].growthPercent = 0;
      } else {
        const prev = columns[i - 1].netWorth;
        const curr = columns[i].netWorth;
        const change = curr - prev;
        const pct = prev !== 0 ? (change / Math.abs(prev)) * 100 : 0;
        columns[i].growth = change;
        columns[i].growthPercent = pct;
      }
    }

    return columns;
  }, [
    growthPeriod,
    totalGrossAssets,
    totalLiabilities,
    netWorth,
    computeNetWorthAt,
    earliestHistoricalTime,
  ]);

  // Line Chart Data Generator for Growth Trend Line Chart (Months, Years, All Time)
  const lineChartData = useMemo(() => {
    const now = new Date();
    const columns: NetWorthGrowthPoint[] = [];

    if (lineTimeline === 'month') {
      const tickCount = 12;
      for (let i = tickCount - 1; i >= 0; i--) {
        const isCurrent = i === 0;
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const ts = isCurrent ? now.getTime() : targetDate.getTime();
        const monthName = targetDate.toLocaleDateString('en-IN', { month: 'short' });
        const yr = targetDate.getFullYear().toString().slice(-2);
        const st = isCurrent
          ? { assets: totalGrossAssets, liabilities: totalLiabilities, netWorth }
          : computeNetWorthAt(ts);

        columns.push({
          label: isCurrent ? 'Today' : `${monthName} '${yr}`,
          fullDate: isCurrent ? 'Today (Current)' : targetDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          netWorth: Math.round(st.netWorth),
          net_worth: Math.round(st.netWorth),
          assets: Math.round(st.assets),
          liabilities: Math.round(st.liabilities),
          growth: 0,
          growthPercent: 0,
          rawTime: ts,
        });
      }
    } else if (lineTimeline === 'year') {
      const tickCount = 5;
      for (let i = tickCount - 1; i >= 0; i--) {
        const targetYear = now.getFullYear() - i;
        const isCurrent = i === 0;
        const ts = isCurrent ? now.getTime() : new Date(targetYear, 11, 31, 23, 59, 59).getTime();
        const st = isCurrent
          ? { assets: totalGrossAssets, liabilities: totalLiabilities, netWorth }
          : computeNetWorthAt(ts);

        columns.push({
          label: targetYear.toString(),
          fullDate: isCurrent ? `Year ${targetYear} (To Date)` : `Year ${targetYear}`,
          netWorth: Math.round(st.netWorth),
          net_worth: Math.round(st.netWorth),
          assets: Math.round(st.assets),
          liabilities: Math.round(st.liabilities),
          growth: 0,
          growthPercent: 0,
          rawTime: ts,
        });
      }
    } else {
      // 'all' time: 12 smooth ticks spanning from earliest historical date to today
      const startTime = earliestHistoricalTime;
      const totalSpan = now.getTime() - startTime;
      const tickCount = 12;
      const step = totalSpan > 0 ? totalSpan / Math.max(1, tickCount - 1) : 1;

      for (let i = 0; i < tickCount; i++) {
        const isCurrent = i === tickCount - 1;
        const ts = isCurrent ? now.getTime() : startTime + i * step;
        const d = new Date(ts);
        const st = isCurrent
          ? { assets: totalGrossAssets, liabilities: totalLiabilities, netWorth }
          : computeNetWorthAt(ts);

        const label = isCurrent ? 'Today' : d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        const fullDate = isCurrent ? 'Today (Current)' : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

        columns.push({
          label,
          fullDate,
          netWorth: Math.round(st.netWorth),
          net_worth: Math.round(st.netWorth),
          assets: Math.round(st.assets),
          liabilities: Math.round(st.liabilities),
          growth: 0,
          growthPercent: 0,
          rawTime: ts,
        });
      }
    }

    return columns;
  }, [lineTimeline, totalGrossAssets, totalLiabilities, netWorth, computeNetWorthAt, earliestHistoricalTime]);


  // Growth summary statistics over selected timeline
  const growthStats = useMemo(() => {
    if (growthTimelineData.length < 2) return null;
    const startPoint = growthTimelineData[0];
    const endPoint = growthTimelineData[growthTimelineData.length - 1];
    const netChange = endPoint.netWorth - startPoint.netWorth;
    const percentChange =
      startPoint.netWorth !== 0 ? (netChange / Math.abs(startPoint.netWorth)) * 100 : 0;

    let peak = -Infinity;
    growthTimelineData.forEach((pt) => {
      if (pt.netWorth > peak) peak = pt.netWorth;
    });

    return {
      startNetWorth: startPoint.netWorth,
      currentNetWorth: endPoint.netWorth,
      netChange,
      percentChange,
      peakNetWorth: peak,
    };
  }, [growthTimelineData]);

  const buildExportData = (): NetWorthExportData => {
    const monthlyTimeline = getMonthlyReportTimelineData(6);
    return {
      userProfile,
      netWorth,
      totalGrossAssets,
      totalLiabilities,
      totalBankBalances,
      totalCreditCardDues,
      totalMoneyLent,
      totalMoneyBorrowed,
      totalInvestments,
      totalLoans,
      bankAccounts,
      creditCardAccounts,
      activeDebtsLent,
      activeDebtsBorrowed,
      stockHoldings: stockHoldings.map((h) => ({
        holding: h,
        cmp: getHoldingMarketPrice(h).price,
        currentVal: h.quantity * getHoldingMarketPrice(h).price,
      })),
      mfHoldings: mfHoldings.map((h) => ({
        holding: h,
        cmp: getHoldingMarketPrice(h).price,
        currentVal: h.quantity * getHoldingMarketPrice(h).price,
      })),
      pfHoldings: pfHoldings.map((h) => ({
        holding: h,
        cmp: getHoldingMarketPrice(h).price,
        currentVal: h.quantity * getHoldingMarketPrice(h).price,
      })),
      bondHoldings: bondHoldings.map((h) => ({
        holding: h,
        cmp: getHoldingMarketPrice(h).price,
        currentVal: h.quantity * getHoldingMarketPrice(h).price,
      })),
      activeLoans: activeLoans.map((l) => {
        const acc = accounts.find((a) => a.id === l.loanAccountId);
        const remaining = acc ? Math.max(0, Math.abs(acc.balance)) : l.totalAmount;
        return { loan: l, remaining };
      }),
      distributionData: assetDistributionData,
      timelinePeriod: 'month',
      growthTimelineData: monthlyTimeline,
    };
  };

  // Open In-App Native HTML Report Viewer & Crisp PDF
  const handleOpenHtmlViewer = () => {
    try {
      const exportData = buildExportData();
      const html = generateNetWorthHTML(exportData);
      const dateStr = new Date().toISOString().split('T')[0];
      openHtmlReportViewer({
        htmlContent: html,
        title: 'Net Worth Balance Sheet & Solvency Statement',
        fileName: `FinSync_Net_Worth_${dateStr}.pdf`,
        badge: 'Executive Balance Sheet',
        subtitle: `Total Assets: ${formatINR(totalGrossAssets)} · Liabilities: ${formatINR(totalLiabilities)} · Net Worth: ${formatINR(netWorth)}`,
        reportType: 'net_worth',
      });
    } catch (e) {
      console.error('Error generating HTML report view', e);
      showToast('Failed to open HTML report view', 'error');
    }
  };

  // Handle Export PDF (Accounts for Monthly Progression instead of weeks)
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const exportData = buildExportData();
      await exportNetWorthPDF(exportData, (msg, type) => showToast(msg, type));
    } catch (err) {
      console.error('Export error', err);
      showToast('Failed to generate PDF. Downloading HTML fallback...', 'error');
      handleDownloadHTML();
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadHTML = () => {
    try {
      const exportData = buildExportData();
      downloadNetWorthHTML(exportData);
      showToast('HTML Dossier downloaded successfully.', 'success');
    } catch (e) {
      showToast('Failed to download dossier.', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
      {/* Crisp Full Screen Top App Bar */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-8 py-2.5 sm:py-3.5 pt-safe flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer mr-0.5"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Scale className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Net Worth
              </h1>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.2 rounded-full border border-emerald-200 dark:border-emerald-800">
                Real-Time
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              Consolidated Assets & Liabilities
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Close Net Worth"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Full Screen Scrollable Body */}
      <main ref={mainScrollRef as any} className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 pb-safe pb-24">
        <div className="max-w-5xl mx-auto w-full space-y-5 sm:space-y-6">
          {/* ======================================================== */}
          {/* 1. HERO NET WORTH CARD WITH FORMULA ACCORDION */}
          {/* ======================================================== */}
          <div className="p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-linear-to-br from-slate-900 via-slate-900 to-slate-950 text-white border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute -right-12 -bottom-12 w-56 h-56 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
            <div className="absolute -left-12 -top-12 w-56 h-56 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                    Consolidated Net Worth
                  </span>
                  <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                    · {bankAccounts.length} Banks · {holdings.length} Holdings · {activeLoans.length} Loans
                  </span>
                </div>

                {/* Consolidated Card Right-Side Action Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* HTML View Button */}
                  <button
                    type="button"
                    onClick={handleOpenHtmlViewer}
                    className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                    title="Open interactive in-app HTML balance sheet"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>HTML View</span>
                  </button>

                  {/* PDF Print / Export Button */}
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-emerald-300 bg-white/10 hover:bg-white/20 active:scale-95 rounded-xl border border-white/20 transition-all cursor-pointer shrink-0 shadow-xs disabled:opacity-50"
                    title="Export beautiful PDF Dossier with all charts and tables"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PDF Print</span>
                  </button>

                  {/* Download HTML Button */}
                  <button
                    type="button"
                    onClick={handleDownloadHTML}
                    className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors cursor-pointer shrink-0"
                    title="Download standalone HTML report"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Net Worth Headline Display */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div
                  className="text-3xl sm:text-5xl font-extrabold tracking-tight tabular-nums text-white"
                  title={formatINR(netWorth, true)}
                >
                  {formatINR(netWorth, true)}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${
                      netWorth >= 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {netWorth >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {netWorth >= 0 ? 'Positive Wealth' : 'Net Liability'}
                  </span>
                </div>
              </div>

              {/* Wealth Components Breakdown Bar */}
              <div className="pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-medium text-slate-400 mb-2.5 flex items-center justify-between flex-wrap gap-2">
                  <span className="font-semibold text-slate-300">
                    Wealth Components Breakdown
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Click any card to open module
                  </span>
                </div>

                {/* 6 Terms Grid - Interactive Navigation */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
                  {/* 1. Bank Balances (+) -> Accounts */}
                  <button
                    type="button"
                    onClick={() => handleNavigateSection('bank')}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 hover:border-blue-400/50 flex flex-col justify-between text-left transition-all cursor-pointer active:scale-95 group shadow-xs"
                    title="Click to view all Bank & Cash Accounts"
                  >
                    <div className="flex items-center justify-between gap-1 text-blue-400 text-[11px] font-bold">
                      <div className="flex items-center gap-1.5 truncate">
                        <Landmark className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">+ Bank & Cash</span>
                      </div>
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <div className="text-sm font-extrabold tabular-nums text-white mt-1.5 truncate">
                      {formatINR(totalBankBalances, false)}
                    </div>
                    <span className="text-[9px] text-slate-400 group-hover:text-blue-300 font-medium transition-colors mt-0.5 truncate block">
                      Accounts →
                    </span>
                  </button>

                  {/* 2. Credit Card Dues (-) -> Accounts */}
                  <button
                    type="button"
                    onClick={() => handleNavigateSection('credit_card')}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 hover:border-rose-400/50 flex flex-col justify-between text-left transition-all cursor-pointer active:scale-95 group shadow-xs"
                    title="Click to manage Credit Card dues in Accounts"
                  >
                    <div className="flex items-center justify-between gap-1 text-rose-400 text-[11px] font-bold">
                      <div className="flex items-center gap-1.5 truncate">
                        <CreditCard className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">− CC Dues</span>
                      </div>
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <div className="text-sm font-extrabold tabular-nums text-rose-300 mt-1.5 truncate">
                      {formatINR(totalCreditCardDues, false)}
                    </div>
                    <span className="text-[9px] text-slate-400 group-hover:text-rose-300 font-medium transition-colors mt-0.5 truncate block">
                      Cards →
                    </span>
                  </button>

                  {/* 3. Money Lent (+) -> Debts */}
                  <button
                    type="button"
                    onClick={() => handleNavigateSection('lent')}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 hover:border-cyan-400/50 flex flex-col justify-between text-left transition-all cursor-pointer active:scale-95 group shadow-xs"
                    title="Click to view Receivables / Money Lent in Debts"
                  >
                    <div className="flex items-center justify-between gap-1 text-cyan-400 text-[11px] font-bold">
                      <div className="flex items-center gap-1.5 truncate">
                        <HandCoins className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">+ Money Lent</span>
                      </div>
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <div className="text-sm font-extrabold tabular-nums text-white mt-1.5 truncate">
                      {formatINR(totalMoneyLent, false)}
                    </div>
                    <span className="text-[9px] text-slate-400 group-hover:text-cyan-300 font-medium transition-colors mt-0.5 truncate block">
                      Debts →
                    </span>
                  </button>

                  {/* 4. Money Borrowed (-) -> Debts */}
                  <button
                    type="button"
                    onClick={() => handleNavigateSection('borrowed')}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 hover:border-amber-400/50 flex flex-col justify-between text-left transition-all cursor-pointer active:scale-95 group shadow-xs"
                    title="Click to view Payables / Money Borrowed in Debts"
                  >
                    <div className="flex items-center justify-between gap-1 text-amber-400 text-[11px] font-bold">
                      <div className="flex items-center gap-1.5 truncate">
                        <Coins className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">− Borrowed</span>
                      </div>
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <div className="text-sm font-extrabold tabular-nums text-amber-300 mt-1.5 truncate">
                      {formatINR(totalMoneyBorrowed, false)}
                    </div>
                    <span className="text-[9px] text-slate-400 group-hover:text-amber-300 font-medium transition-colors mt-0.5 truncate block">
                      Debts →
                    </span>
                  </button>

                  {/* 5. Investments (+) -> Investments */}
                  <button
                    type="button"
                    onClick={() => handleNavigateSection('investments')}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 hover:border-emerald-400/50 flex flex-col justify-between text-left transition-all cursor-pointer active:scale-95 group shadow-xs"
                    title="Click to view Portfolio (Stocks, Mutual Funds, Bonds) in Investments"
                  >
                    <div className="flex items-center justify-between gap-1 text-emerald-400 text-[11px] font-bold">
                      <div className="flex items-center gap-1.5 truncate">
                        <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">+ Investments</span>
                      </div>
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <div className="text-sm font-extrabold tabular-nums text-emerald-300 mt-1.5 truncate">
                      {formatINR(totalInvestments, false)}
                    </div>
                    <span className="text-[9px] text-slate-400 group-hover:text-emerald-300 font-medium transition-colors mt-0.5 truncate block">
                      Investments →
                    </span>
                  </button>

                  {/* 6. Loans (-) -> Loans */}
                  <button
                    type="button"
                    onClick={() => handleNavigateSection('loans')}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 hover:border-indigo-400/50 flex flex-col justify-between text-left transition-all cursor-pointer active:scale-95 group shadow-xs"
                    title="Click to manage Loans & EMIs in Loans Manager"
                  >
                    <div className="flex items-center justify-between gap-1 text-indigo-400 text-[11px] font-bold">
                      <div className="flex items-center gap-1.5 truncate">
                        <Calculator className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">− Loans</span>
                      </div>
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <div className="text-sm font-extrabold tabular-nums text-indigo-300 mt-1.5 truncate">
                      {formatINR(totalLoans, false)}
                    </div>
                    <span className="text-[9px] text-slate-400 group-hover:text-indigo-300 font-medium transition-colors mt-0.5 truncate block">
                      Loans →
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 2. PIE CHART: WEALTH DISTRIBUTION */}
          {/* ======================================================== */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Wealth Distribution
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Asset & liability allocation breakdown
                </p>
              </div>

              {/* Segmented View Control */}
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 self-start sm:self-auto border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setPieMode('assets')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    pieMode === 'assets'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Assets
                </button>
                <button
                  type="button"
                  onClick={() => setPieMode('assets_vs_liabilities')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    pieMode === 'assets_vs_liabilities'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Assets vs Debt
                </button>
              </div>
            </div>

            {/* Pie Chart Display & Visual Legend */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              {/* Donut Chart */}
              <div className="lg:col-span-6 flex flex-col items-center justify-center relative min-h-[240px]">
                {activePieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={activePieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={3}
                        stroke="transparent"
                      >
                        {activePieData.map((entry, index) => (
                          <Cell key={`cell-${entry.id}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: any) => [formatINR(Number(val), true), name]}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          color: '#f8fafc',
                          fontSize: '12px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No active assets logged yet.
                  </div>
                )}

                {/* Donut Center Total Label */}
                {activePieData.length > 0 && (
                  <div className="absolute pointer-events-none text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      {pieMode === 'assets' ? 'Total Assets' : 'Net Total'}
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tabular-nums block">
                      {formatCompactINR(pieMode === 'assets' ? totalGrossAssets : netWorth)}
                    </span>
                  </div>
                )}
              </div>

              {/* Interactive Legend List */}
              <div className="lg:col-span-6 space-y-2">
                {activePieData.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigateSection(item.id)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-800 hover:border-emerald-500/40 text-xs transition-all cursor-pointer text-left group active:scale-[0.99] shadow-2xs"
                      title={`Click to open ${item.name} in its dedicated workspace`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 group-hover:scale-110 transition-transform"
                          style={{ backgroundColor: item.color }}
                        />
                        <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {item.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                          {formatINR(item.value, false)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                          ({item.percentage}%)
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:text-emerald-500 transition-opacity ml-1 shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 3. BAR GRAPH: GROWTH ACROSS TIMELINES WITH METRIC TOGGLE */}
          {/* ======================================================== */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Growth Bar Chart
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Interval comparisons for Net Worth, Assets, and Liabilities
                </p>
              </div>

              {/* Controls: Metric Switcher + Timeline Switcher */}
              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                {/* Metric Selector for Bar */}
                <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                  {(
                    [
                      { key: 'net_worth', label: 'Net Worth' },
                      { key: 'assets', label: 'Assets' },
                      { key: 'liabilities', label: 'Liabilities' },
                    ] as { key: ChartMetric; label: string }[]
                  ).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setBarMetric(m.key)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        barMetric === m.key
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Timeline selector (Weeks, Months, Years, All Time) */}
                <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                  {(
                    [
                      { key: 'week', label: 'Weeks' },
                      { key: 'month', label: 'Months' },
                      { key: 'year', label: 'Years' },
                      { key: 'all', label: 'All Time' },
                    ] as { key: TimelinePeriod; label: string }[]
                  ).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setGrowthPeriod(p.key)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        growthPeriod === p.key
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Growth Metrics Summary Strip */}
            {growthStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Initial
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {formatINR(growthStats.startNetWorth, false)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Current
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {formatINR(growthStats.currentNetWorth, false)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Net Change
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-extrabold tabular-nums flex items-center gap-1 ${
                      growthStats.netChange >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {growthStats.netChange >= 0 ? '+' : ''}
                    {formatINR(growthStats.netChange, false)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Growth %
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-extrabold tabular-nums flex items-center gap-1 ${
                      growthStats.percentChange >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {growthStats.percentChange >= 0 ? '+' : ''}
                    {growthStats.percentChange.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* Recharts Bar Chart */}
            <div className="w-full pt-2 min-h-[270px]">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={growthTimelineData}
                  margin={{ top: 22, right: 12, left: 10, bottom: 6 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => formatCompactINR(v)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const pt = payload[0].payload as NetWorthGrowthPoint;
                      return (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-white shadow-xl text-xs space-y-1.5 min-w-[200px]">
                          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1">
                            {pt.fullDate}
                          </div>
                          <div className="flex justify-between items-center text-slate-300">
                            <span>Net Worth:</span>
                            <span className="font-extrabold tabular-nums text-emerald-400">
                              {formatINR(pt.netWorth, true)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-400">
                            <span>Gross Assets:</span>
                            <span className="font-semibold tabular-nums text-blue-400">
                              {formatINR(pt.assets, false)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-400">
                            <span>Total Liabilities:</span>
                            <span className="font-semibold tabular-nums text-rose-400">
                              {formatINR(pt.liabilities, false)}
                            </span>
                          </div>
                          {pt.growth !== 0 && (
                            <div className="flex justify-between items-center pt-1 border-t border-slate-800 text-[11px]">
                              <span>Period Change:</span>
                              <span
                                className={`font-bold tabular-nums ${
                                  pt.growth >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {pt.growth >= 0 ? '+' : ''}
                                {formatINR(pt.growth, false)} ({pt.growthPercent.toFixed(1)}%)
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey={barMetric === 'net_worth' ? 'netWorth' : barMetric}
                    isAnimationActive={false}
                    radius={[6, 6, 0, 0]}
                    shape={(props: any) => {
                      const { x, y, width, height, value } = props;
                      const isNegative = value < 0;
                      let fillColor = '#10b981';
                      if (barMetric === 'assets') fillColor = '#3b82f6';
                      else if (barMetric === 'liabilities') fillColor = '#f43f5e';
                      else if (isNegative) fillColor = '#f43f5e';

                      const barWidth = Math.max(16, Math.min(44, width * 0.7));
                      const barX = x + (width - barWidth) / 2;
                      const barY = isNegative ? y : y;
                      const barH = Math.max(4, Math.abs(height));

                      return (
                        <g>
                          <rect
                            x={barX}
                            y={barY}
                            width={barWidth}
                            height={barH}
                            fill={fillColor}
                            rx={4}
                            ry={4}
                          />
                          <text
                            x={barX + barWidth / 2}
                            y={isNegative ? barY + barH + 14 : barY - 6}
                            textAnchor="middle"
                            fill={fillColor}
                            fontSize={10}
                            fontWeight="bold"
                            className="tabular-nums"
                          >
                            {formatCompactINR(value)}
                          </text>
                        </g>
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 4. LINE / AREA CHART: CONTINUOUS GROWTH TRAJECTORY */}
          {/* ======================================================== */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Growth Trend Line Chart
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Continuous wealth trajectory with multi-metric comparative curves
                </p>
              </div>

              {/* Line Chart Controls: Metric Switcher + Timeline Switcher */}
              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                {/* Metric Selector */}
                <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                  {(
                    [
                      { key: 'compare', label: 'Compare All' },
                      { key: 'net_worth', label: 'Net Worth' },
                      { key: 'assets', label: 'Assets' },
                      { key: 'liabilities', label: 'Liabilities' },
                    ] as { key: LineChartMetric; label: string }[]
                  ).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setLineMetric(m.key)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        lineMetric === m.key
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Timeline Selector for Line Chart (Months, Years, All Time) */}
                <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                  {(
                    [
                      { key: 'month', label: 'Months' },
                      { key: 'year', label: 'Years' },
                      { key: 'all', label: 'All Time' },
                    ] as { key: 'month' | 'year' | 'all'; label: string }[]
                  ).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setLineTimeline(t.key)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        lineTimeline === t.key
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Line / Area Chart View */}
            <div className="w-full pt-2 min-h-[280px]">
              <ResponsiveContainer width="100%" height={260}>
                {lineMetric === 'compare' ? (
                  <LineChart
                    data={lineChartData}
                    margin={{ top: 20, right: 14, left: 10, bottom: 6 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => formatCompactINR(v)}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [formatINR(Number(val), true), name]}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '8px', fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="assets"
                      name="Gross Assets"
                      stroke="#3b82f6"
                      strokeWidth={2.4}
                      dot={{ r: 3.5, fill: '#3b82f6' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="netWorth"
                      name="Net Worth"
                      stroke="#10b981"
                      strokeWidth={2.8}
                      dot={{ r: 4, fill: '#10b981' }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="liabilities"
                      name="Total Liabilities"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={{ r: 3, fill: '#f43f5e' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                ) : (
                  <AreaChart
                    data={lineChartData}
                    margin={{ top: 20, right: 14, left: 10, bottom: 6 }}
                  >
                    <defs>
                      <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={
                            lineMetric === 'assets'
                              ? '#3b82f6'
                              : lineMetric === 'liabilities'
                              ? '#f43f5e'
                              : '#10b981'
                          }
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor={
                            lineMetric === 'assets'
                              ? '#3b82f6'
                              : lineMetric === 'liabilities'
                              ? '#f43f5e'
                              : '#10b981'
                          }
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => formatCompactINR(v)}
                    />
                    <Tooltip
                      formatter={(val: any) => [
                        formatINR(Number(val), true),
                        lineMetric === 'assets'
                          ? 'Gross Assets'
                          : lineMetric === 'liabilities'
                          ? 'Total Liabilities'
                          : 'Net Worth',
                      ]}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={lineMetric === 'net_worth' ? 'netWorth' : lineMetric}
                      name={
                        lineMetric === 'assets'
                          ? 'Gross Assets'
                          : lineMetric === 'liabilities'
                          ? 'Total Liabilities'
                          : 'Net Worth'
                      }
                      stroke={
                        lineMetric === 'assets'
                          ? '#3b82f6'
                          : lineMetric === 'liabilities'
                          ? '#f43f5e'
                          : '#10b981'
                      }
                      strokeWidth={2.8}
                      fillOpacity={1}
                      fill="url(#metricGrad)"
                      dot={{
                        r: 4,
                        fill:
                          lineMetric === 'assets'
                            ? '#3b82f6'
                            : lineMetric === 'liabilities'
                            ? '#f43f5e'
                            : '#10b981',
                      }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 5. INTERACTIVE BALANCE SHEET NAVIGATOR (ONE-CLICK JUMP) */}
          {/* ======================================================== */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Interactive Asset & Liability Breakdown
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Click any category to seamlessly jump to its dedicated manager
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Card 1: Bank & Liquid Accounts */}
              <button
                type="button"
                onClick={() => handleNavigateSection('bank')}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400/60 text-left transition-all cursor-pointer group shadow-2xs active:scale-[0.99] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/60 flex items-center gap-1">
                      <span>Accounts</span>
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-3">
                    Bank & Liquid Cash
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {bankAccounts.length} active savings, current & cash accounts
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 mt-3 flex items-baseline justify-between">
                  <span className="text-[11px] font-medium text-slate-400">Total Liquid</span>
                  <span className="font-extrabold text-sm tabular-nums text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {formatINR(totalBankBalances, false)}
                  </span>
                </div>
              </button>

              {/* Card 2: Investments Portfolio */}
              <button
                type="button"
                onClick={() => handleNavigateSection('investments')}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-400/60 text-left transition-all cursor-pointer group shadow-2xs active:scale-[0.99] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                      <span>Investments</span>
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-3">
                    Investment Holdings
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {holdings.length} holdings · Stocks, MFs, PF & Bonds
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 mt-3 flex items-baseline justify-between">
                  <span className="text-[11px] font-medium text-slate-400">Valuation</span>
                  <span className="font-extrabold text-sm tabular-nums text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {formatINR(totalInvestments, false)}
                  </span>
                </div>
              </button>

              {/* Card 3: Debts & Counterparty Balances */}
              <button
                type="button"
                onClick={() => handleNavigateSection('debts')}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-cyan-400/60 text-left transition-all cursor-pointer group shadow-2xs active:scale-[0.99] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                      <HandCoins className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-200/60 dark:border-cyan-800/60 flex items-center gap-1">
                      <span>Debts</span>
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-3">
                    Debts & Split Expenses
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Lent: {formatINR(totalMoneyLent, false)} · Borrowed: {formatINR(totalMoneyBorrowed, false)}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 mt-3 flex items-baseline justify-between">
                  <span className="text-[11px] font-medium text-slate-400">Net Receivable</span>
                  <span
                    className={`font-extrabold text-sm tabular-nums ${
                      totalMoneyLent >= totalMoneyBorrowed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {totalMoneyLent >= totalMoneyBorrowed ? '+' : ''}
                    {formatINR(totalMoneyLent - totalMoneyBorrowed, false)}
                  </span>
                </div>
              </button>

              {/* Card 4: Credit Card Liabilities */}
              <button
                type="button"
                onClick={() => handleNavigateSection('credit_card')}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-rose-400/60 text-left transition-all cursor-pointer group shadow-2xs active:scale-[0.99] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200/60 dark:border-rose-800/60 flex items-center gap-1">
                      <span>Cards</span>
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-3">
                    Credit Card Outstanding
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {creditCardAccounts.length} credit card statements
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 mt-3 flex items-baseline justify-between">
                  <span className="text-[11px] font-medium text-slate-400">Total Dues</span>
                  <span className="font-extrabold text-sm tabular-nums text-rose-600 dark:text-rose-400">
                    {formatINR(totalCreditCardDues, false)}
                  </span>
                </div>
              </button>

              {/* Card 5: Long-term Loans & EMIs */}
              <button
                type="button"
                onClick={() => handleNavigateSection('loans')}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-400/60 text-left transition-all cursor-pointer group shadow-2xs active:scale-[0.99] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1">
                      <span>Loans</span>
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-3">
                    Loans & EMIs
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {activeLoans.length} active structured loan facilities
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 mt-3 flex items-baseline justify-between">
                  <span className="text-[11px] font-medium text-slate-400">Principal Due</span>
                  <span className="font-extrabold text-sm tabular-nums text-indigo-600 dark:text-indigo-400">
                    {formatINR(totalLoans, false)}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Crisp Full Screen Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Info className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="hidden sm:inline">
            Net Worth synchronizes in real-time with accounts, investment prices & loans.
          </span>
          <span className="sm:hidden">Auto-syncs with all accounts.</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Dossier</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs sm:text-sm font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Done
          </button>
        </div>
      </footer>
    </div>
  );
};
