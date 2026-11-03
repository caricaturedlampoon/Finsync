import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { InvestmentAssetType, InvestmentHolding } from '../../types';
import { formatINR, formatCompactINR, formatNumber, formatDate, parseDate, toInputDate, calculateHoldingBookedProfit } from '../../utils/formatters';
import { calculateXIRR, CashFlow } from '../../utils/xirr';
import { useRegisterSubscreen } from '../../navigation/NavigationContext';
import { navigationManager } from '../../navigation/navigationManager';
import { HoldingModal } from './HoldingModal';
import { InvestmentActionModal } from './InvestmentActionModal';
import { HoldingDetailView } from './HoldingDetailView';
import { DayChangeInfoModal } from './DayChangeInfoModal';
import { FundBadge, FundVerificationModal, FundConfirmationModal } from './FundVerificationBadges';
import { ProfitLossGrowthBarChart, GrowthBarItem } from './ProfitLossGrowthBarChart';
import { BondsSummaryCard } from './specialized/BondsSummaryCard';
import { SgbSummaryCard } from './specialized/SgbSummaryCard';
import { PfSummaryCard } from './specialized/PfSummaryCard';
import { BondsPfCombinedSummaryCard } from './specialized/BondsPfCombinedSummaryCard';
import { BondHoldingItemCard } from './specialized/BondHoldingItemCard';
import { SgbHoldingItemCard } from './specialized/SgbHoldingItemCard';
import { PfHoldingItemCard } from './specialized/PfHoldingItemCard';
import {
  computeBondsSummary,
  computeSgbSummary,
  computePfSummary,
  computeBondMetrics,
  computeSgbMetrics,
  computePfMetrics,
} from '../../utils/bondsSgbPfEngine';
import { generateAssetCategoryReportHTML } from '../../utils/assetReportEngine';
import {
  calculatePortfolioDayPerformance,
  calculateHoldingDayPerformance,
} from '../../utils/investmentDayChange';
import {
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDownLeft,
  Scissors,
  Gift,
  PieChart as PieIcon,
  Award,
  ArrowUpDown,
  ChevronRight,
  FileSpreadsheet,
  ArrowUp,
  ArrowDown,
  Layers,
  Coins,
  ArrowLeft,
  Sparkles,
  Search,
  X,
  Info,
  CalendarClock,
  RefreshCw,
  BarChart3,
  Zap,
  History,
  Clock,
  Trash2,
  Share2,
  FileText,
  Sliders,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from 'recharts';

const ASSET_COLORS: Record<string, string> = {
  stock: '#2563eb', // blue
  mutual_fund: '#059669', // emerald
  bond: '#d97706', // amber
  sgb: '#eab308', // gold/yellow
  pf: '#0891b2', // cyan/teal
};

const STOCK_PALETTE = [
  '#2563eb', // blue
  '#059669', // emerald
  '#7c3aed', // purple
  '#d97706', // amber
  '#0891b2', // cyan
  '#dc2626', // red
  '#db2777', // pink
  '#4f46e5', // indigo
  '#eab308', // yellow
  '#0284c7', // sky
  '#16a34a', // green
  '#64748b', // slate
];

type TimelineButton = '1W' | '1M' | '6M' | '1Y' | 'ALL';
type SortKey = 'name' | 'amount' | 'returns';
type CategoryFilter = 'all' | 'stock' | 'mutual_fund' | 'bonds_pf';
type BondsPfSubFilter = 'all' | 'bond' | 'sgb' | 'pf';

export const InvestmentsTab: React.FC = () => {
  const {
    holdings,
    transactions,
    settings,
    openSettingsTab,
    setIsInvestmentCSVModalOpen,
    setIsSipManagerOpen,
    openAnalysisExportModal,
    openHtmlReportViewer,
    sipSchedules,
    syncMarketPrices,
    isUpdatingNavs,
    getHoldingMarketPrice,
    openTradeModal,
    deleteHoldingTransaction,
    showToast,
    selectedHoldingId,
    setSelectedHoldingId,
  } = useApp();

  const DEFAULT_INVESTMENT_CARDS = [
    { id: 'portfolio_master_summary', name: 'Portfolio Master Summary Header', visible: true, order: 1 },
    { id: 'valuation_trajectory', name: 'Valuation Trajectory Graph', visible: true, order: 2 },
    { id: 'stocks_vs_mf', name: 'Stocks vs MF Comparative Analysis', visible: true, order: 3 },
    { id: 'growth_bar_analytics', name: 'Growth Bar Analytics', visible: true, order: 4 },
    { id: 'holdings_table', name: 'Holdings Table & Filters', visible: true, order: 5 },
  ];

  const activeInvestmentCards = useMemo(() => {
    const list = (settings?.investmentCards && settings.investmentCards.length > 0)
      ? [...settings.investmentCards]
      : [...DEFAULT_INVESTMENT_CARDS];
    const seen = new Set<string>();
    return list
      .filter((c) => {
        if (!c || !c.id || seen.has(c.id)) return false;
        seen.add(c.id);
        return c.visible;
      })
      .sort((a, b) => a.order - b.order);
  }, [settings?.investmentCards]);

  const isCardVisible = (cardId: string) => {
    return activeInvestmentCards.some((c) => c.id === cardId);
  };

  const getCardOrder = (cardId: string) => {
    const c = (settings?.investmentCards || []).find((sc) => sc.id === cardId);
    return c ? c.order : 1;
  };

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  const selectedHolding = holdings.find((h) => h.id === selectedHoldingId);

  // Register holding detail subscreen with dynamic navigation stack
  useRegisterSubscreen(
    !!selectedHoldingId,
    `holding_${selectedHoldingId}`,
    selectedHolding ? `Holding: ${selectedHolding.name}` : 'Holding Detail',
    () => {
      setSelectedHoldingId(null);
    },
    {
      parentScreenKey: 'investments',
      anchorSelector: selectedHoldingId ? `[data-holding-id="${selectedHoldingId}"]` : undefined,
    }
  );

  const openHoldingDetail = (hId: string) => {
    const idx = processedHoldings.findIndex((h) => h.id === hId);
    if (idx !== -1 && idx >= visibleHoldingsCount) {
      setVisibleHoldingsCount(Math.ceil((idx + 10) / 50) * 50);
    }
    navigationManager.saveTabScroll('investments', undefined, `[data-holding-id="${hId}"]`);
    setSelectedHoldingId(hId);
  };

  // Category Toggle Filter State: 'all' | 'stock' | 'mutual_fund' | 'bonds_pf'
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  // Secondary toggle for Bonds/PF: 'all' | 'bond' | 'sgb' | 'pf'
  const [bondsPfSubFilter, setBondsPfSubFilter] = useState<BondsPfSubFilter>('all');
  const [selectedTimeline, setSelectedTimeline] = useState<TimelineButton>('1M');
  const [growthPeriod, setGrowthPeriod] = useState<'week' | 'month' | 'year'>('month');

  // Sorting & View Display Modes
  const [sortBy, setSortBy] = useState<SortKey>('amount');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [displayMode, setDisplayMode] = useState<'value' | 'returns'>('value');

  // Modals for Actions & Add Asset
  const [isHoldingModalOpen, setIsHoldingModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<InvestmentHolding | null>(null);
  const [actionModalHolding, setActionModalHolding] = useState<InvestmentHolding | null>(null);
  const [actionType, setActionType] = useState<'buy' | 'sell' | 'dividend' | 'split' | 'bonus'>('buy');
  const [isDayChangeModalOpen, setIsDayChangeModalOpen] = useState(false);
  const [dayChangeModalHolding, setDayChangeModalHolding] = useState<InvestmentHolding | null>(null);
  const [verificationModalHolding, setVerificationModalHolding] = useState<InvestmentHolding | null>(null);
  const [confirmationModalHolding, setConfirmationModalHolding] = useState<InvestmentHolding | null>(null);

  // Consolidated Chronological Sequence Activity Ledger State
  const [isAllActivityModalOpen, setIsAllActivityModalOpen] = useState(false);
  const [activitySortBy, setActivitySortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'qty-desc' | 'qty-asc'>('date-desc');
  const [activityActionFilter, setActivityActionFilter] = useState<'all' | 'buy' | 'sell' | 'dividend' | 'corporate_action'>('all');
  const [activityAssetFilter, setActivityAssetFilter] = useState<'all' | 'stock' | 'mutual_fund' | 'bond' | 'bonds_pf'>('all');
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const [activityTxToDelete, setActivityTxToDelete] = useState<{ holdingId: string; txId: string; holdingSymbol: string; txDate: string; amount: number; type: string } | null>(null);

  // High performance pagination states for 1000+ items
  const [visibleHoldingsCount, setVisibleHoldingsCount] = useState(50);
  const [visibleActivityCount, setVisibleActivityCount] = useState(50);

  useEffect(() => {
    setVisibleHoldingsCount(50);
  }, [activeFilter, bondsPfSubFilter, searchQuery, sortBy, sortAsc]);

  useEffect(() => {
    setVisibleActivityCount(50);
  }, [activityAssetFilter, activityActionFilter, activitySearchQuery, activitySortBy, isAllActivityModalOpen]);

  // Consolidated list of all stocks & mutual fund transactions across portfolio
  const allInvestmentTransactions = useMemo(() => {
    const list: Array<{
      tx: any;
      holding: InvestmentHolding;
    }> = [];

    holdings.forEach((h) => {
      (h.transactions || []).forEach((t) => {
        list.push({ tx: t, holding: h });
      });
    });

    return list;
  }, [holdings]);

  // Reset activityActionFilter to 'all' when asset filter changes
  useEffect(() => {
    setActivityActionFilter('all');
  }, [activityAssetFilter]);

  const availableActionFilters = useMemo(() => {
    if (activityAssetFilter === 'stock') {
      return [
        { id: 'all', label: 'All' },
        { id: 'buy', label: 'Buys' },
        { id: 'sell', label: 'Sells' },
        { id: 'dividend', label: 'Dividends' },
        { id: 'bonus', label: 'Bonus' },
        { id: 'split', label: 'Splits' },
        { id: 'demerger', label: 'Demergers' },
      ];
    }
    if (activityAssetFilter === 'mutual_fund') {
      return [
        { id: 'all', label: 'All' },
        { id: 'buy', label: 'Buys' },
        { id: 'sell', label: 'Sells' },
        { id: 'dividend', label: 'Dividends' },
      ];
    }
    if (activityAssetFilter === 'bonds_pf') {
      return [
        { id: 'all', label: 'All' },
        { id: 'buy', label: 'Buys/Contributions' },
        { id: 'sell', label: 'Sells/Withdrawals' },
        { id: 'interest', label: 'Interest / Coupon' },
        { id: 'principal_repayment', label: 'Principal Back' },
      ];
    }
    return [
      { id: 'all', label: 'All Actions' },
      { id: 'buy', label: 'Buys' },
      { id: 'sell', label: 'Sells' },
      { id: 'dividend', label: 'Dividends' },
      { id: 'interest', label: 'Interest' },
      { id: 'corporate_action', label: 'Corporate Actions' },
    ];
  }, [activityAssetFilter]);

  // Chronologically sorted and filtered portfolio activity
  const filteredSortedActivity = useMemo(() => {
    let result = allInvestmentTransactions;

    // Filter by Asset Type
    if (activityAssetFilter === 'bonds_pf') {
      result = result.filter(
        (item) =>
          item.holding.assetType === 'bond' ||
          item.holding.assetType === 'sgb' ||
          item.holding.assetType === 'pf'
      );
    } else if (activityAssetFilter !== 'all') {
      result = result.filter(
        (item) =>
          item.holding.assetType === activityAssetFilter ||
          (activityAssetFilter === 'bond' && item.holding.assetType === 'sgb')
      );
    }

    // Filter by Action Type
    if (activityActionFilter !== 'all') {
      if (activityActionFilter === 'buy') {
        result = result.filter((item) => item.tx.type === 'buy');
      } else if (activityActionFilter === 'sell') {
        result = result.filter((item) => item.tx.type === 'sell' || item.tx.type === 'withdrawal');
      } else if (activityActionFilter === 'dividend') {
        result = result.filter((item) => item.tx.type === 'dividend');
      } else if (activityActionFilter === 'interest') {
        result = result.filter((item) => item.tx.type === 'interest' || item.tx.type === 'coupon');
      } else if (activityActionFilter === 'principal_repayment') {
        result = result.filter((item) => item.tx.type === 'principal_repayment');
      } else if (activityActionFilter === 'bonus') {
        result = result.filter((item) => item.tx.type === 'bonus');
      } else if (activityActionFilter === 'split') {
        result = result.filter((item) => item.tx.type === 'split');
      } else if (activityActionFilter === 'demerger') {
        result = result.filter((item) => item.tx.type === 'demerger');
      } else if (activityActionFilter === 'corporate_action') {
        result = result.filter(
          (item) => item.tx.type === 'split' || item.tx.type === 'bonus' || item.tx.type === 'demerger'
        );
      }
    }

    // Search query
    if (activitySearchQuery.trim()) {
      const q = activitySearchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.holding.symbol.toLowerCase().includes(q) ||
          item.holding.name.toLowerCase().includes(q) ||
          (item.tx.notes && item.tx.notes.toLowerCase().includes(q))
      );
    }

    // Chronological sequence sorting
    return [...result].sort((a, b) => {
      const timeA = parseDate(a.tx.date).getTime() || 0;
      const timeB = parseDate(b.tx.date).getTime() || 0;

      if (activitySortBy === 'date-desc') return timeB - timeA;
      if (activitySortBy === 'date-asc') return timeA - timeB;
      if (activitySortBy === 'amount-desc') {
        const amtA = a.tx.totalAmount || ((a.tx.quantity || 0) * (a.tx.price || 0)) || 0;
        const amtB = b.tx.totalAmount || ((b.tx.quantity || 0) * (b.tx.price || 0)) || 0;
        return amtB - amtA;
      }
      if (activitySortBy === 'amount-asc') {
        const amtA = a.tx.totalAmount || ((a.tx.quantity || 0) * (a.tx.price || 0)) || 0;
        const amtB = b.tx.totalAmount || ((b.tx.quantity || 0) * (b.tx.price || 0)) || 0;
        return amtA - amtB;
      }
      if (activitySortBy === 'qty-desc') return (b.tx.quantity || 0) - (a.tx.quantity || 0);
      if (activitySortBy === 'qty-asc') return (a.tx.quantity || 0) - (b.tx.quantity || 0);
      return 0;
    });
  }, [allInvestmentTransactions, activityAssetFilter, activityActionFilter, activitySearchQuery, activitySortBy]);

  // Asset Subgroups
  const stockHoldings = useMemo(() => holdings.filter((h) => h.assetType === 'stock'), [holdings]);
  const mfHoldings = useMemo(() => holdings.filter((h) => h.assetType === 'mutual_fund'), [holdings]);
  const bondsOnlyHoldings = useMemo(() => holdings.filter((h) => h.assetType === 'bond'), [holdings]);
  const sgbHoldings = useMemo(() => holdings.filter((h) => h.assetType === 'sgb'), [holdings]);
  const pfHoldings = useMemo(() => holdings.filter((h) => h.assetType === 'pf'), [holdings]);
  const bondsPfHoldings = useMemo(
    () => holdings.filter((h) => h.assetType === 'bond' || h.assetType === 'sgb' || h.assetType === 'pf'),
    [holdings]
  );

  const bondsSummary = useMemo(() => computeBondsSummary(bondsOnlyHoldings), [bondsOnlyHoldings]);
  const sgbSummary = useMemo(() => computeSgbSummary(sgbHoldings), [sgbHoldings]);
  const pfSummary = useMemo(() => computePfSummary(pfHoldings), [pfHoldings]);

  const handleGenerateAssetTypeReport = (filter: CategoryFilter) => {
    let targetHoldings = activeHoldingsList;
    let targetType: any = filter;
    let label = 'Investment Portfolio Report';

    if (filter === 'stock') {
      targetHoldings = stockHoldings;
      targetType = 'stock';
      label = 'Stocks & Equities';
    } else if (filter === 'mutual_fund') {
      targetHoldings = mfHoldings;
      targetType = 'mutual_fund';
      label = 'Mutual Funds';
    } else if (filter === 'bonds_pf') {
      if (bondsPfSubFilter === 'bond') {
        targetHoldings = bondsOnlyHoldings;
        targetType = 'bond';
        label = 'Corporate & PSU Bonds';
      } else if (bondsPfSubFilter === 'sgb') {
        targetHoldings = sgbHoldings;
        targetType = 'sgb';
        label = 'Sovereign Gold Bonds (SGB)';
      } else if (bondsPfSubFilter === 'pf') {
        targetHoldings = pfHoldings;
        targetType = 'pf';
        label = 'Provident Funds (EPF/PPF/VPF)';
      } else {
        targetHoldings = bondsPfHoldings;
        targetType = 'bonds_pf';
        label = 'Bonds, SGBs & Provident Funds';
      }
    } else {
      targetHoldings = holdings;
      targetType = 'all';
      label = 'Complete Investment Portfolio';
    }

    try {
      const html = generateAssetCategoryReportHTML(targetType, targetHoldings);
      const dateStr = toInputDate(new Date()).replace(/-/g, '');

      openHtmlReportViewer({
        htmlContent: html,
        title: `${label} - Audit Report`,
        fileName: `${targetType}-audit-report-${dateStr}.pdf`,
        badge: `${label} Report`,
        subtitle: `${label} · ${targetHoldings.length} Active Holdings · Generated ${new Date().toLocaleDateString('en-IN')}`,
        reportType: 'investment',
      });
      showToast(`${label} report generated successfully`, 'success');
    } catch (err) {
      console.error('Failed to generate report', err);
      showToast('Error generating asset report: ' + (err as any)?.message, 'error');
    }
  };

  // Active target holdings list reflecting both main category and Bonds/PF sub-filter
  const activeHoldingsList = useMemo(() => {
    if (activeFilter === 'stock') return stockHoldings;
    if (activeFilter === 'mutual_fund') return mfHoldings;
    if (activeFilter === 'bonds_pf') {
      if (bondsPfSubFilter === 'bond') return bondsOnlyHoldings;
      if (bondsPfSubFilter === 'sgb') return sgbHoldings;
      if (bondsPfSubFilter === 'pf') return pfHoldings;
      return bondsPfHoldings;
    }
    return holdings;
  }, [activeFilter, bondsPfSubFilter, stockHoldings, mfHoldings, bondsOnlyHoldings, sgbHoldings, pfHoldings, bondsPfHoldings, holdings]);

  // Dynamic Portfolio Day Performance (reflects active filter & sub-filter)
  const portfolioDayPerf = useMemo(() => {
    return calculatePortfolioDayPerformance(activeHoldingsList, getHoldingMarketPrice);
  }, [activeHoldingsList, getHoldingMarketPrice]);

  // Dynamic Portfolio Totals (reflects active filter & sub-filter)
  const currentSummary = useMemo(() => {
    let invested = 0;
    let booked = 0;

    activeHoldingsList.forEach((h) => {
      invested += h.quantity * h.averageBuyPrice;
      const bInfo = calculateHoldingBookedProfit(h);
      booked += bInfo.bookedProfit;
    });

    const current = portfolioDayPerf.totalCurrentValue;
    const pnl = current - invested;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

    return {
      totalInvested: invested,
      totalCurrentValue: current,
      totalPnL: pnl,
      totalPnLPercent: pnlPercent,
      totalBookedProfit: booked,
      totalDayChange: portfolioDayPerf.totalDayChange,
      totalDayChangePercent: portfolioDayPerf.totalDayChangePercent,
      totalLastDayValue: portfolioDayPerf.totalLastDayValue,
      previousCloseDate: portfolioDayPerf.previousCloseDate,
      count: activeHoldingsList.length,
    };
  }, [activeHoldingsList, portfolioDayPerf]);

  // Overall Portfolio XIRR
  const portfolioXIRR = useMemo(() => {
    const cashFlows: CashFlow[] = [];

    activeHoldingsList.forEach((h) => {
      (h.transactions || []).forEach((t) => {
        const d = parseDate(t.date);
        if (t.type === 'buy') {
          cashFlows.push({ date: d, amount: -t.totalAmount });
        } else if (
          t.type === 'sell' ||
          t.type === 'dividend' ||
          t.type === 'interest' ||
          t.type === 'coupon' ||
          t.type === 'principal_repayment'
        ) {
          // If interest is compounded into balance, skip to avoid double counting with terminal value
          if (t.type === 'interest' && t.accountingType === 'compound_balance') {
            // compounded internally
          } else {
            cashFlows.push({ date: d, amount: t.totalAmount });
          }
        }
      });
    });

    if (currentSummary.totalCurrentValue > 0) {
      cashFlows.push({ date: new Date(), amount: currentSummary.totalCurrentValue });
    }

    return calculateXIRR(cashFlows);
  }, [activeHoldingsList, currentSummary.totalCurrentValue]);

  const getHoldingInvestedCost = (h: InvestmentHolding) => {
    if (h.assetType === 'pf') {
      const m = computePfMetrics(h);
      const netContrib = m.totalEmployeeContributions + m.totalEmployerContributions + m.totalVoluntaryContributions - m.totalWithdrawals;
      return Math.max(0, netContrib > 0 ? netContrib : Math.max(0, m.totalCorpusBalance - m.totalInterestCredited));
    }
    if (h.assetType === 'bond') {
      const m = computeBondMetrics(h, undefined, transactions);
      return m.totalInvested;
    }
    if (h.assetType === 'sgb') {
      const m = computeSgbMetrics(h);
      return m.totalInvestment;
    }
    return h.quantity * h.averageBuyPrice;
  };

  const getHoldingValuation = (h: InvestmentHolding, liveCMP: number) => {
    const resolvedCMP = liveCMP > 0 ? liveCMP : (h.currentPrice > 0 ? h.currentPrice : (h.averageBuyPrice > 0 ? h.averageBuyPrice : 1));
    if (h.assetType === 'pf') {
      const m = computePfMetrics(h);
      return m.totalCorpusBalance;
    }
    if (h.assetType === 'bond') {
      const m = computeBondMetrics(h, resolvedCMP, transactions);
      return m.currentValuation + m.totalInterestReceived;
    }
    if (h.assetType === 'sgb') {
      const m = computeSgbMetrics(h, resolvedCMP);
      let sgbInterest = 0;
      (h.transactions || []).forEach(t => {
        if (t.type === 'interest' || t.type === 'coupon') {
          sgbInterest += t.totalAmount || (t.price * t.quantity) || 0;
        }
      });
      return m.currentGoldValue + sgbInterest;
    }
    const booked = calculateHoldingBookedProfit(h);
    const rawVal = (h.quantity * resolvedCMP) + booked.totalRealizedProfit;
    const investedCost = h.quantity * h.averageBuyPrice;
    return rawVal > 0 ? rawVal : investedCost;
  };

  // Timeline zooming for Portfolio Valuation Over Time Line Graph (using the exact same calculation engine as the Bar Chart)
  const portfolioHistoryData = useMemo(() => {
    const targetList = activeHoldingsList;
    const now = new Date();
    let startTime: Date;
    let tickCount: number;

    if (selectedTimeline === '1W') {
      startTime = new Date(now.getTime() - 7 * 86400 * 1000);
      tickCount = 7;
    } else if (selectedTimeline === '1M') {
      startTime = new Date(now.getTime() - 30 * 86400 * 1000);
      tickCount = 10;
    } else if (selectedTimeline === '6M') {
      startTime = new Date(now.getTime() - 182 * 86400 * 1000);
      tickCount = 6;
    } else if (selectedTimeline === '1Y') {
      startTime = new Date(now.getTime() - 365 * 86400 * 1000);
      tickCount = 12;
    } else {
      let earliestTime = now.getTime();
      targetList.forEach((h) => {
        const pDate = parseDate(h.purchaseDate || h.openingDate || '').getTime();
        if (pDate && pDate < earliestTime) earliestTime = pDate;
        (h.transactions || []).forEach((t) => {
          const d = parseDate(t.date).getTime();
          if (d && d < earliestTime) earliestTime = d;
        });
      });
      if (earliestTime >= now.getTime()) {
        earliestTime = now.getTime() - 365 * 86400 * 1000;
      }
      startTime = new Date(earliestTime);
      tickCount = 12;
    }

    const computeStateAt = (timestamp: number) => {
      let invSum = 0;
      let valSum = 0;

      targetList.forEach((h) => {
        const liveCMP = getHoldingMarketPrice(h).price > 0 ? getHoldingMarketPrice(h).price : (h.currentPrice || h.averageBuyPrice || 1);
        const purchaseDateStr = h.purchaseDate || h.openingDate;
        if (purchaseDateStr) {
          const purchaseTimestamp = parseDate(purchaseDateStr).getTime();
          if (timestamp < purchaseTimestamp) {
            return;
          }
        }

        const txs = [...(h.transactions || [])]
          .filter((t) => parseDate(t.date).getTime() <= timestamp)
          .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

        if (h.assetType === 'pf') {
          const m = computePfMetrics(h);
          let pfInterest = 0;
          let pfContributions = h.openingBalance || 0;
          txs.forEach((t) => {
            const isInterest = t.type === 'interest' || t.type === 'coupon';
            const amt = t.totalAmount || t.quantity || (t.price * t.quantity) || 0;
            if (isInterest) pfInterest += amt;
            else if (t.type !== 'withdrawal' && t.type !== 'sell') {
              const emp = t.employeeAmount || 0;
              const empyr = t.employerAmount || 0;
              const vol = t.voluntaryAmount || 0;
              pfContributions += (emp || empyr || vol) ? (emp + empyr + vol) : amt;
            }
          });

          const pDate = parseDate(h.purchaseDate || h.openingDate || '2024-04-01').getTime();
          const progress = Math.min(1, Math.max(0.15, (timestamp - pDate) / (now.getTime() - pDate || 1)));
          const estInterest = (m.currentFyEstimatedInterest || 0) * progress;

          const pfInv = Math.max(0, pfContributions);
          const pfVal = pfInv + pfInterest;

          invSum += pfInv;
          valSum += pfVal;
          return;
        }

        if (h.assetType === 'bond') {
          const m = computeBondMetrics(h, liveCMP, transactions);
          let interestRec = 0;
          let principalRepaid = 0;

          txs.forEach((t) => {
            const amt = t.totalAmount || (t.price * t.quantity) || 0;
            if (t.type === 'interest' || t.type === 'coupon') {
              interestRec += amt;
            } else if (t.type === 'principal_repayment') {
              principalRepaid += amt;
            }
          });

          if (transactions && Array.isArray(transactions)) {
            const seenIds = new Set(txs.map((t) => t.id));
            transactions.forEach((tx) => {
              if (tx.investmentId === h.id && parseDate(tx.date).getTime() <= timestamp && !seenIds.has(tx.id)) {
                if (
                  tx.categoryId === 'cat_bond_interest' ||
                  tx.categoryId === 'cat_dividends' ||
                  tx.type === 'income' ||
                  (tx.tags || []).some((tag: string) => tag.toLowerCase().includes('interest') || tag.toLowerCase().includes('coupon'))
                ) {
                  interestRec += tx.amount || 0;
                }
              }
            });
          }

          const bondInv = timestamp >= now.getTime()
            ? m.totalInvested
            : Math.max(0, (h.quantity * h.averageBuyPrice) - principalRepaid);

          const bondVal = timestamp >= now.getTime()
            ? (m.currentValuation + m.totalInterestReceived)
            : (bondInv + interestRec);

          invSum += bondInv;
          valSum += bondVal;
          return;
        }

        if (h.assetType === 'sgb') {
          const m = computeSgbMetrics(h, liveCMP);
          let sgbInterestRec = 0;

          txs.forEach((t) => {
            const amt = t.totalAmount || (t.price * t.quantity) || 0;
            if (t.type === 'interest' || t.type === 'coupon') {
              sgbInterestRec += amt;
            }
          });

          if (transactions && Array.isArray(transactions)) {
            const seenIds = new Set(txs.map((t) => t.id));
            transactions.forEach((tx) => {
              if (tx.investmentId === h.id && parseDate(tx.date).getTime() <= timestamp && !seenIds.has(tx.id)) {
                if (
                  tx.categoryId === 'cat_bond_interest' ||
                  tx.categoryId === 'cat_dividends' ||
                  tx.type === 'income' ||
                  (tx.tags || []).some((tag: string) => tag.toLowerCase().includes('interest') || tag.toLowerCase().includes('coupon'))
                ) {
                  sgbInterestRec += tx.amount || 0;
                }
              }
            });
          }

          const sgbInv = timestamp >= now.getTime()
            ? m.totalInvested
            : (h.quantity * h.averageBuyPrice);

          const sgbVal = timestamp >= now.getTime()
            ? (m.currentValuation + m.totalInterestReceived)
            : ((h.quantity * liveCMP) + sgbInterestRec);

          invSum += sgbInv;
          valSum += sgbVal;
          return;
        }

        if (txs.length === 0) {
          if (timestamp >= now.getTime()) {
            invSum += h.quantity * h.averageBuyPrice;
            valSum += h.quantity * liveCMP;
          }
          return;
        }

        let q = 0;
        let cost = 0;
        let lastPrice = liveCMP;

        txs.forEach((t) => {
          if (t.type === 'buy') {
            q += t.quantity;
            cost += t.totalAmount;
            if (t.price > 0) lastPrice = t.price;
          } else if (t.type === 'sell') {
            const avgBefore = q > 0 ? cost / q : 0;
            q = Math.max(0, q - t.quantity);
            cost = Math.max(0, q * avgBefore);
            if (t.price > 0) lastPrice = t.price;
          } else if (t.type === 'split') {
            if (t.newQuantity && t.newQuantity > 0) q = t.newQuantity;
            else q += t.quantity;
            if (t.price > 0) lastPrice = t.price;
          } else if (t.type === 'bonus') {
            q += t.quantity;
            if (t.price > 0) lastPrice = t.price;
          } else if (t.type === 'demerger') {
            if (t.demergerOutcome === 'extinguish_original') {
              q = 0;
              cost = 0;
            } else {
              const costAlloc = t.costAllocationPercentage !== undefined ? t.costAllocationPercentage : 20;
              cost = Math.max(0, cost * ((100 - costAlloc) / 100));
            }
          }
        });

        invSum += cost;

        if (timestamp >= now.getTime()) {
          valSum += q * liveCMP;
        } else {
          const tFirst = txs[0] ? parseDate(txs[0].date).getTime() : timestamp;
          const progress = Math.min(1, Math.max(0, (timestamp - tFirst) / (now.getTime() - tFirst || 1)));
          const interpPrice = lastPrice + (liveCMP - lastPrice) * progress;
          valSum += q * interpPrice;
        }
      });

      return { invested: Math.round(invSum), valuation: Math.round(valSum) };
    };

    const currentActualState = computeStateAt(now.getTime());
    const liveInv = targetList.reduce((sum, h) => sum + getHoldingInvestedCost(h), 0);
    const liveVal = targetList.reduce((sum, h) => sum + getHoldingValuation(h, getHoldingMarketPrice(h).price), 0);
    const finalInv = Math.max(liveInv, currentActualState.invested);
    const finalVal = Math.max(liveVal, currentActualState.valuation);

    const formatTick = (d: Date) => {
      if (selectedTimeline === '1W' || selectedTimeline === '1M') {
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      }
      if (selectedTimeline === '6M' || selectedTimeline === '1Y') {
        return d.toLocaleDateString('en-IN', { month: 'short' });
      }
      return d.getFullYear().toString();
    };

    const points: Array<{ date: string; value: number; current: number; rawTime: number }> = [];
    const totalSpan = now.getTime() - startTime.getTime();
    const step = totalSpan > 0 ? totalSpan / Math.max(1, tickCount - 1) : 1;

    for (let i = 0; i < tickCount; i++) {
      const isLast = i === tickCount - 1;
      const ts = isLast ? now.getTime() : startTime.getTime() + i * step;
      const pointDate = new Date(ts);
      const st = isLast
        ? { invested: Math.round(finalInv), valuation: Math.round(finalVal) }
        : computeStateAt(ts);

      points.push({
        date: isLast ? 'Today' : formatTick(pointDate),
        value: st.invested,
        current: st.valuation,
        rawTime: ts,
      });
    }

    return points;
  }, [activeHoldingsList, selectedTimeline, getHoldingMarketPrice, getHoldingInvestedCost, getHoldingValuation, transactions]);


  // Generate multi-period growth series for Combined Portfolio, Stocks, and Mutual Funds
  function generateGrowthSeries(
    targetList: InvestmentHolding[],
    finalInv: number,
    finalVal: number
  ): GrowthBarItem[] {
    const now = new Date();
    const columns: GrowthBarItem[] = [];

    const computeStateAt = (timestamp: number) => {
      let invSum = 0;
      let valSum = 0;

      targetList.forEach((h) => {
        const liveCMP = getHoldingMarketPrice(h).price;
        const purchaseDateStr = h.purchaseDate || h.openingDate;
        if (purchaseDateStr) {
          const purchaseTimestamp = parseDate(purchaseDateStr).getTime();
          // Strict Purchase Date Boundary: If queried timestamp is before asset purchase, it did not exist yet!
          if (timestamp < purchaseTimestamp) {
            return;
          }
        }

        const txs = [...(h.transactions || [])]
          .filter((t) => parseDate(t.date).getTime() <= timestamp)
          .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

        if (h.assetType === 'pf') {
          const m = computePfMetrics(h);
          let pfInterest = 0;
          let pfContributions = h.openingBalance || 0;
          txs.forEach((t) => {
            const isInterest = t.type === 'interest' || t.type === 'coupon';
            const amt = t.totalAmount || t.quantity || (t.price * t.quantity) || 0;
            if (isInterest) pfInterest += amt;
            else if (t.type !== 'withdrawal' && t.type !== 'sell') {
              const emp = t.employeeAmount || 0;
              const empyr = t.employerAmount || 0;
              const vol = t.voluntaryAmount || 0;
              pfContributions += (emp || empyr || vol) ? (emp + empyr + vol) : amt;
            }
          });

          const pDate = parseDate(h.purchaseDate || h.openingDate || '2024-04-01').getTime();
          const progress = Math.min(1, Math.max(0.15, (timestamp - pDate) / (now.getTime() - pDate || 1)));
          const estInterest = (m.currentFyEstimatedInterest || 0) * progress;

          const pfInv = Math.max(0, pfContributions);
          const pfVal = pfInv + pfInterest;

          invSum += pfInv;
          valSum += pfVal;
          return;
        }

        if (h.assetType === 'bond') {
          const m = computeBondMetrics(h, liveCMP, transactions);
          let interestRec = 0;
          let principalRepaid = 0;

          txs.forEach((t) => {
            const amt = t.totalAmount || (t.price * t.quantity) || 0;
            if (t.type === 'interest' || t.type === 'coupon') {
              interestRec += amt;
            } else if (t.type === 'principal_repayment') {
              principalRepaid += amt;
            }
          });

          if (transactions && Array.isArray(transactions)) {
            const seenIds = new Set(txs.map((t) => t.id));
            transactions.forEach((tx) => {
              if (tx.investmentId === h.id && parseDate(tx.date).getTime() <= timestamp && !seenIds.has(tx.id)) {
                if (
                  tx.categoryId === 'cat_bond_interest' ||
                  tx.categoryId === 'cat_dividends' ||
                  tx.type === 'income' ||
                  (tx.tags || []).some((tag: string) => tag.toLowerCase().includes('interest') || tag.toLowerCase().includes('coupon'))
                ) {
                  interestRec += tx.amount || 0;
                }
              }
            });
          }

          const bondInv = timestamp >= now.getTime()
            ? m.totalInvested
            : Math.max(0, (h.quantity * h.averageBuyPrice) - principalRepaid);

          const bondVal = timestamp >= now.getTime()
            ? (m.currentValuation + m.totalInterestReceived)
            : (bondInv + interestRec);

          invSum += bondInv;
          valSum += bondVal;
          return;
        }

        if (h.assetType === 'sgb') {
          const m = computeSgbMetrics(h, liveCMP);
          let sgbInterestRec = 0;

          txs.forEach((t) => {
            const amt = t.totalAmount || (t.price * t.quantity) || 0;
            if (t.type === 'interest' || t.type === 'coupon') {
              sgbInterestRec += amt;
            }
          });

          if (transactions && Array.isArray(transactions)) {
            const seenIds = new Set(txs.map((t) => t.id));
            transactions.forEach((tx) => {
              if (tx.investmentId === h.id && parseDate(tx.date).getTime() <= timestamp && !seenIds.has(tx.id)) {
                if (
                  tx.categoryId === 'cat_bond_interest' ||
                  tx.categoryId === 'cat_dividends' ||
                  tx.type === 'income' ||
                  (tx.tags || []).some((tag: string) => tag.toLowerCase().includes('interest') || tag.toLowerCase().includes('coupon'))
                ) {
                  sgbInterestRec += tx.amount || 0;
                }
              }
            });
          }

          const sgbInv = timestamp >= now.getTime()
            ? m.totalInvested
            : (h.quantity * h.averageBuyPrice);

          const sgbVal = timestamp >= now.getTime()
            ? (m.currentValuation + m.totalInterestReceived)
            : ((h.quantity * liveCMP) + sgbInterestRec);

          invSum += sgbInv;
          valSum += sgbVal;
          return;
        }

        if (txs.length === 0) {
          if (timestamp >= now.getTime()) {
            invSum += h.quantity * h.averageBuyPrice;
            valSum += h.quantity * liveCMP;
          }
          return;
        }

        let q = 0;
        let cost = 0;
        let lastPrice = liveCMP;

        txs.forEach((t) => {
          if (t.type === 'buy') {
            q += t.quantity;
            cost += t.totalAmount;
            if (t.price > 0) lastPrice = t.price;
          } else if (t.type === 'sell') {
            const avgBefore = q > 0 ? cost / q : 0;
            q = Math.max(0, q - t.quantity);
            cost = Math.max(0, q * avgBefore);
            if (t.price > 0) lastPrice = t.price;
          } else if (t.type === 'split') {
            if (t.newQuantity && t.newQuantity > 0) q = t.newQuantity;
            else q += t.quantity;
            if (t.price > 0) lastPrice = t.price;
          } else if (t.type === 'bonus') {
            q += t.quantity;
            if (t.price > 0) lastPrice = t.price;
          } else if (t.type === 'demerger') {
            if (t.demergerOutcome === 'extinguish_original') {
              q = 0;
              cost = 0;
            } else {
              const costAlloc = t.costAllocationPercentage !== undefined ? t.costAllocationPercentage : 20;
              cost = Math.max(0, cost * ((100 - costAlloc) / 100));
            }
          }
        });

        invSum += cost;

        if (timestamp >= now.getTime()) {
          valSum += q * liveCMP;
        } else {
          const tFirst = txs[0] ? parseDate(txs[0].date).getTime() : timestamp;
          const progress = Math.min(1, Math.max(0, (timestamp - tFirst) / (now.getTime() - tFirst || 1)));
          const interpPrice = lastPrice + (liveCMP - lastPrice) * progress;
          valSum += q * interpPrice;
        }
      });

      return { invested: Math.round(invSum), valuation: Math.round(valSum) };
    };

    const currentActualState = computeStateAt(now.getTime());
    const resolvedFinalInv = Math.max(finalInv, currentActualState.invested);
    const resolvedFinalVal = Math.max(finalVal, currentActualState.valuation);

    if (growthPeriod === 'month') {
      for (let i = 5; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const isCurrentMonth = i === 0;
        const ts = isCurrentMonth ? now.getTime() : targetDate.getTime();
        const st = isCurrentMonth
          ? { invested: Math.round(resolvedFinalInv), valuation: Math.round(resolvedFinalVal) }
          : computeStateAt(ts);

        const label = isCurrentMonth ? 'Today' : targetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const pnl = st.valuation - st.invested;
        const pnlPct = st.invested > 0 && !isNaN(pnl) ? (pnl / st.invested) * 100 : 0;

        columns.push({
          label,
          fullDate: isCurrentMonth ? 'Today (Current)' : targetDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          valuation: st.valuation,
          invested: st.invested,
          growth: pnl,
          growthPercent: pnlPct,
          rawTime: ts,
        });
      }
    } else if (growthPeriod === 'week') {
      for (let i = 5; i >= 0; i--) {
        const isCurrentWeek = i === 0;
        const ts = isCurrentWeek ? now.getTime() : now.getTime() - i * 7 * 86400 * 1000;
        const d = new Date(ts);
        const st = isCurrentWeek
          ? { invested: Math.round(resolvedFinalInv), valuation: Math.round(resolvedFinalVal) }
          : computeStateAt(ts);

        const label = isCurrentWeek ? 'Today' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const pnl = st.valuation - st.invested;
        const pnlPct = st.invested > 0 && !isNaN(pnl) ? (pnl / st.invested) * 100 : 0;

        columns.push({
          label,
          fullDate: isCurrentWeek ? 'Today (Current)' : `Week ending ${formatDate(d)}`,
          valuation: st.valuation,
          invested: st.invested,
          growth: pnl,
          growthPercent: pnlPct,
          rawTime: ts,
        });
      }
    } else if (growthPeriod === 'year') {
      for (let i = 5; i >= 0; i--) {
        const targetYear = now.getFullYear() - i;
        const isCurrentYear = i === 0;
        const ts = isCurrentYear ? now.getTime() : new Date(targetYear, 11, 31, 23, 59, 59).getTime();
        const st = isCurrentYear
          ? { invested: Math.round(resolvedFinalInv), valuation: Math.round(resolvedFinalVal) }
          : computeStateAt(ts);

        const pnl = st.valuation - st.invested;
        const pnlPct = st.invested > 0 && !isNaN(pnl) ? (pnl / st.invested) * 100 : 0;

        columns.push({
          label: targetYear.toString(),
          fullDate: isCurrentYear ? `Year ${targetYear} (To Date)` : `Year ${targetYear}`,
          valuation: st.valuation,
          invested: st.invested,
          growth: pnl,
          growthPercent: pnlPct,
          rawTime: ts,
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const targetYear = now.getFullYear() - i * 2;
        const isCurrentYear = i === 0;
        const ts = isCurrentYear ? now.getTime() : new Date(targetYear, 11, 31, 23, 59, 59).getTime();
        const st = isCurrentYear
          ? { invested: Math.round(resolvedFinalInv), valuation: Math.round(resolvedFinalVal) }
          : computeStateAt(ts);

        const pnl = st.valuation - st.invested;
        const pnlPct = st.invested > 0 && !isNaN(pnl) ? (pnl / st.invested) * 100 : 0;

        columns.push({
          label: targetYear.toString(),
          fullDate: isCurrentYear ? `Year ${targetYear} (To Date)` : `Year ${targetYear}`,
          valuation: st.valuation,
          invested: st.invested,
          growth: pnl,
          growthPercent: pnlPct,
          rawTime: ts,
        });
      }
    }

    return columns.slice(0, 6);
  };

  const combinedGrowthData = useMemo(() => {
    const inv = holdings.reduce((sum, h) => sum + getHoldingInvestedCost(h), 0);
    const val = holdings.reduce((sum, h) => sum + getHoldingValuation(h, getHoldingMarketPrice(h).price), 0);
    return generateGrowthSeries(holdings, inv, val);
  }, [holdings, growthPeriod, getHoldingMarketPrice, transactions]);

  const stocksGrowthData = useMemo(() => {
    const inv = stockHoldings.reduce((sum, h) => sum + getHoldingInvestedCost(h), 0);
    const val = stockHoldings.reduce((sum, h) => sum + getHoldingValuation(h, getHoldingMarketPrice(h).price), 0);
    return generateGrowthSeries(stockHoldings, inv, val);
  }, [stockHoldings, growthPeriod, getHoldingMarketPrice, transactions]);

  const mfGrowthData = useMemo(() => {
    const inv = mfHoldings.reduce((sum, h) => sum + getHoldingInvestedCost(h), 0);
    const val = mfHoldings.reduce((sum, h) => sum + getHoldingValuation(h, getHoldingMarketPrice(h).price), 0);
    return generateGrowthSeries(mfHoldings, inv, val);
  }, [mfHoldings, growthPeriod, getHoldingMarketPrice, transactions]);

  const bondsPfGrowthData = useMemo(() => {
    const inv = activeHoldingsList.reduce((sum, h) => sum + getHoldingInvestedCost(h), 0);
    const val = activeHoldingsList.reduce((sum, h) => sum + getHoldingValuation(h, getHoldingMarketPrice(h).price), 0);
    return generateGrowthSeries(activeHoldingsList, inv, val);
  }, [activeHoldingsList, growthPeriod, getHoldingMarketPrice, transactions]);

  // Stocks vs Mutual Funds Comparative Analysis
  const stocksVsMfComparison = useMemo(() => {
    const stockInv = stockHoldings.reduce((sum, h) => sum + h.quantity * h.averageBuyPrice, 0);
    const stockVal = stockHoldings.reduce((sum, h) => sum + h.quantity * getHoldingMarketPrice(h).price, 0);
    const stockPnl = stockVal - stockInv;
    const stockPnlPct = stockInv > 0 ? (stockPnl / stockInv) * 100 : 0;

    const mfInv = mfHoldings.reduce((sum, h) => sum + h.quantity * h.averageBuyPrice, 0);
    const mfVal = mfHoldings.reduce((sum, h) => sum + h.quantity * getHoldingMarketPrice(h).price, 0);
    const mfPnl = mfVal - mfInv;
    const mfPnlPct = mfInv > 0 ? (mfPnl / mfInv) * 100 : 0;

    const totalVal = (stockVal + mfVal) || 1;
    const stockWeight = (stockVal / totalVal) * 100;
    const mfWeight = (mfVal / totalVal) * 100;

    return {
      stocks: {
        invested: stockInv,
        valuation: stockVal,
        pnl: stockPnl,
        pnlPercent: stockPnlPct,
        weight: stockWeight,
        count: stockHoldings.length,
      },
      mf: {
        invested: mfInv,
        valuation: mfVal,
        pnl: mfPnl,
        pnlPercent: mfPnlPct,
        weight: mfWeight,
        count: mfHoldings.length,
      },
    };
  }, [stockHoldings, mfHoldings, getHoldingMarketPrice]);

  // Overall Allocation Breakdown Data for Overall Portfolio Pie Chart
  const overallChartData = useMemo(() => {
    const map: Record<string, number> = {
      Stocks: 0,
      'Mutual Funds': 0,
      'Bonds & PF': 0,
    };

    holdings.forEach((h) => {
      const val = h.quantity * getHoldingMarketPrice(h).price;
      if (h.assetType === 'stock') map['Stocks'] += val;
      else if (h.assetType === 'mutual_fund') map['Mutual Funds'] += val;
      else if (h.assetType === 'bond' || h.assetType === 'sgb' || h.assetType === 'pf') map['Bonds & PF'] += val;
    });

    return [
      { name: 'Stocks', value: map['Stocks'], color: '#2563eb', filterKey: 'stock' as CategoryFilter },
      { name: 'Mutual Funds', value: map['Mutual Funds'], color: '#059669', filterKey: 'mutual_fund' as CategoryFilter },
      { name: 'Bonds & PF', value: map['Bonds & PF'], color: '#d97706', filterKey: 'bonds_pf' as CategoryFilter },
    ].filter((item) => item.value > 0);
  }, [holdings, getHoldingMarketPrice]);

  // Dedicated Stocks Breakdown Chart Data
  const stockBreakdownData = useMemo(() => {
    return stockHoldings
      .map((stock, idx) => {
        const livePrice = getHoldingMarketPrice(stock).price;
        const val = stock.quantity * livePrice;
        const invested = stock.quantity * stock.averageBuyPrice;
        const pnl = val - invested;
        const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
        const displayName = stock.customDisplayName || stock.name.split(/\s+/)[0] || stock.symbol;

        return {
          id: stock.id,
          name: displayName,
          fullName: stock.name,
          symbol: stock.symbol,
          value: val,
          invested,
          pnl,
          pnlPercent,
          color: STOCK_PALETTE[idx % STOCK_PALETTE.length],
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [stockHoldings, getHoldingMarketPrice]);

  // Dedicated Mutual Funds Breakdown Chart Data
  const mfBreakdownData = useMemo(() => {
    return mfHoldings
      .map((mf, idx) => {
        const livePrice = getHoldingMarketPrice(mf).price;
        const val = mf.quantity * livePrice;
        const invested = mf.quantity * mf.averageBuyPrice;
        const displayName = mf.customDisplayName || mf.name.split(/\s+/).slice(0, 2).join(' ') || mf.symbol;

        return {
          id: mf.id,
          name: displayName,
          fullName: mf.name,
          symbol: mf.symbol,
          value: val,
          invested,
          color: STOCK_PALETTE[idx % STOCK_PALETTE.length],
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [mfHoldings, getHoldingMarketPrice]);

  // Dedicated Bonds & PF Breakdown Chart Data
  const bondsPfBreakdownData = useMemo(() => {
    const targetList =
      bondsPfSubFilter === 'bond'
        ? bondsOnlyHoldings
        : bondsPfSubFilter === 'sgb'
        ? sgbHoldings
        : bondsPfSubFilter === 'pf'
        ? pfHoldings
        : bondsPfHoldings;

    return targetList
      .map((item, idx) => {
        const livePrice = getHoldingMarketPrice(item).price;
        const val = item.quantity * livePrice;
        const invested = item.quantity * item.averageBuyPrice;
        const pnl = val - invested;
        const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
        const displayName = item.customDisplayName || item.name.split(/\s+/).slice(0, 3).join(' ') || item.symbol;

        const typeLabel =
          item.assetType === 'sgb'
            ? 'SGB Gold'
            : item.assetType === 'pf'
            ? `${item.pfType || 'PF'} Corpus`
            : 'Bond / Debt';

        const color =
          item.assetType === 'sgb'
            ? '#eab308'
            : item.assetType === 'pf'
            ? '#0891b2'
            : '#d97706';

        return {
          id: item.id,
          name: displayName,
          fullName: item.name,
          symbol: item.symbol,
          value: val,
          invested,
          pnl,
          pnlPercent,
          color,
          typeLabel,
          assetType: item.assetType,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [bondsPfSubFilter, bondsOnlyHoldings, sgbHoldings, pfHoldings, bondsPfHoldings, getHoldingMarketPrice]);

  // Target default asset type for Add Holding Modal based on active filter & sub-filter
  const targetDefaultAssetType = useMemo((): InvestmentAssetType => {
    if (activeFilter === 'stock') return 'stock';
    if (activeFilter === 'mutual_fund') return 'mutual_fund';
    if (activeFilter === 'bonds_pf') {
      if (bondsPfSubFilter === 'sgb') return 'sgb';
      if (bondsPfSubFilter === 'pf') return 'pf';
      return 'bond';
    }
    return 'stock';
  }, [activeFilter, bondsPfSubFilter]);

  // Dynamic Add Asset Button Label based on active view
  const addAssetButtonLabel = useMemo(() => {
    if (activeFilter === 'stock') return 'Add Stock';
    if (activeFilter === 'mutual_fund') return 'Add Mutual Fund';
    if (activeFilter === 'bonds_pf') {
      if (bondsPfSubFilter === 'bond') return 'Add Bond';
      if (bondsPfSubFilter === 'sgb') return 'Add SGB';
      if (bondsPfSubFilter === 'pf') return 'Add PF Account';
      return 'Add Bond / PF';
    }
    return 'Add Asset';
  }, [activeFilter, bondsPfSubFilter]);

  // Filtered & Sorted Holdings List
  const processedHoldings = useMemo(() => {
    let list = [...holdings];

    if (activeFilter === 'stock') {
      list = list.filter((h) => h.assetType === 'stock');
    } else if (activeFilter === 'mutual_fund') {
      list = list.filter((h) => h.assetType === 'mutual_fund');
    } else if (activeFilter === 'bonds_pf') {
      if (bondsPfSubFilter === 'bond') {
        list = list.filter((h) => h.assetType === 'bond');
      } else if (bondsPfSubFilter === 'sgb') {
        list = list.filter((h) => h.assetType === 'sgb');
      } else if (bondsPfSubFilter === 'pf') {
        list = list.filter((h) => h.assetType === 'pf');
      } else {
        list = list.filter((h) => h.assetType === 'bond' || h.assetType === 'sgb' || h.assetType === 'pf');
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((h) => {
        const matchName = h.name?.toLowerCase().includes(q);
        const matchSymbol = h.symbol?.toLowerCase().includes(q);
        const matchCustom = h.customDisplayName?.toLowerCase().includes(q);
        const matchIsin = h.isin?.toLowerCase().includes(q);
        const matchNotes = h.notes?.toLowerCase().includes(q);
        const matchType = h.assetType?.toLowerCase().includes(q);
        return matchName || matchSymbol || matchCustom || matchIsin || matchNotes || matchType;
      });
    }

    list.sort((a, b) => {
      if (sortBy === 'name') {
        const res = (a.name || a.symbol).localeCompare(b.name || b.symbol);
        return sortAsc ? res : -res;
      }
      if (sortBy === 'amount') {
        const valA = a.quantity * getHoldingMarketPrice(a).price;
        const valB = b.quantity * getHoldingMarketPrice(b).price;
        return sortAsc ? valA - valB : valB - valA;
      }
      if (sortBy === 'returns') {
        const pnlA = a.quantity * getHoldingMarketPrice(a).price - a.quantity * a.averageBuyPrice;
        const pnlB = b.quantity * getHoldingMarketPrice(b).price - b.quantity * b.averageBuyPrice;
        return sortAsc ? pnlA - pnlB : pnlB - pnlA;
      }
      return 0;
    });

    return list;
  }, [holdings, activeFilter, bondsPfSubFilter, searchQuery, sortBy, sortAsc, getHoldingMarketPrice]);

  const displayedHoldings = useMemo(() => {
    return processedHoldings.slice(0, visibleHoldingsCount);
  }, [processedHoldings, visibleHoldingsCount]);

  const displayedActivity = useMemo(() => {
    return filteredSortedActivity.slice(0, visibleActivityCount);
  }, [filteredSortedActivity, visibleActivityCount]);

  // 1. Full-App Screen: Investment Activity Ledger
  if (isAllActivityModalOpen) {
    return (
      <div className="w-full px-2 sm:px-4 md:px-6 py-2 pb-safe pb-36 min-h-full space-y-3">
        <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAllActivityModalOpen(false)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Back to Investments"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Investment Activity Ledger
              </h2>
              <p className="text-xs text-slate-400">
                Chronological sequence of all investment transactions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAllActivityModalOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Filter and Sorting Controls Bar */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={activitySearchQuery}
                onChange={(e) => setActivitySearchQuery(e.target.value)}
                placeholder="Search by stock, MF, notes..."
                className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              {activitySearchQuery && (
                <button
                  type="button"
                  onClick={() => setActivitySearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Sort:</span>
              </span>
              <select
                value={activitySortBy}
                onChange={(e) => setActivitySortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="amount-desc">Amount (High to Low)</option>
                <option value="amount-asc">Amount (Low to High)</option>
                <option value="qty-desc">Quantity (High to Low)</option>
                <option value="qty-asc">Quantity (Low to High)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'all', label: 'All Assets' },
              { id: 'stock', label: 'Stocks' },
              { id: 'mutual_fund', label: 'Mutual Funds' },
              { id: 'bonds_pf', label: 'Bonds & PF' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActivityAssetFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activityAssetFilter === f.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1 border-t border-slate-100 dark:border-slate-800">
            {availableActionFilters.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => setActivityActionFilter(act.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  activityActionFilter === act.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {act.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span>Showing {displayedActivity.length} of {filteredSortedActivity.length} entries</span>
          </div>

          <div className="space-y-2.5">
            {displayedActivity.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Clock className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs font-semibold">No investment activity found matching the selected filters.</p>
              </div>
            ) : (
              displayedActivity.map(({ tx, holding }) => {
                const isBuy = tx.type === 'buy';
                const isSell = tx.type === 'sell';
                const isDiv = tx.type === 'dividend';
                const isSplit = tx.type === 'split';
                const isBonus = tx.type === 'bonus';
                const isDemerger = tx.type === 'demerger';
                const isStock = holding.assetType === 'stock';

                return (
                  <div
                    key={tx.id}
                    onClick={() => openHoldingDetail(holding.id)}
                    className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs cursor-pointer transition-all group"
                    title="Tap to view holding details and manage transactions"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isBuy
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : isSell
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : isDiv
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {isBuy && <ArrowDownLeft className="w-4 h-4" />}
                        {isSell && <ArrowUpRight className="w-4 h-4" />}
                        {isDiv && <Coins className="w-4 h-4" />}
                        {isSplit && <Scissors className="w-4 h-4" />}
                        {isBonus && <Gift className="w-4 h-4" />}
                        {isDemerger && <Layers className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                            {holding.customDisplayName || holding.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {holding.symbol}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold uppercase text-slate-600 dark:text-slate-300">{tx.type}</span>
                          <span>·</span>
                          <span>{formatDate(tx.date)}</span>
                          {!isDiv && !isSplit && !isBonus && !isDemerger && (
                            <>
                              <span>·</span>
                              <span>{formatNumber(tx.quantity)} {isStock ? 'sh' : 'units'} @ ₹{tx.price}</span>
                            </>
                          )}
                          {tx.notes && (
                            <>
                              <span>·</span>
                              <span className="italic truncate max-w-[150px]">{tx.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <div className="text-xs sm:text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                          {isSplit || isBonus || isDemerger ? 'Corp Action' : formatINR(tx.totalAmount || (tx.quantity * tx.price))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActivityTxToDelete({
                            holdingId: holding.id,
                            txId: tx.id,
                            holdingSymbol: holding.symbol,
                            txDate: tx.date,
                            amount: tx.totalAmount || (tx.quantity * tx.price),
                            type: tx.type,
                          });
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {filteredSortedActivity.length > visibleActivityCount && (
            <div className="text-center pt-3 pb-1">
              <button
                type="button"
                onClick={() => setVisibleActivityCount((prev) => prev + 50)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all cursor-pointer"
              >
                Load More ({visibleActivityCount} of {filteredSortedActivity.length})
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Full-App Screen: Holding Modal (Add / Edit Asset)
  if (isHoldingModalOpen) {
    return (
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 pt-2 pb-safe pb-36 min-h-full space-y-4">
        <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsHoldingModalOpen(false);
                setEditingHolding(null);
              }}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              {editingHolding ? 'Edit Holding' : 'Add Investment Asset'}
            </h2>
          </div>
        </header>
        <HoldingModal
          isOpen={isHoldingModalOpen}
          initialHolding={editingHolding}
          defaultAssetType={targetDefaultAssetType}
          onClose={() => {
            setIsHoldingModalOpen(false);
            setEditingHolding(null);
          }}
        />
      </div>
    );
  }

  // 3. Full-App Screen: Investment Action Modal (Buy / Sell / Redeem)
  if (actionModalHolding) {
    return (
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 pt-2 pb-safe pb-36 min-h-full space-y-4">
        <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActionModalHolding(null)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white capitalize">
              {actionType} Order: {actionModalHolding.name}
            </h2>
          </div>
        </header>
        <InvestmentActionModal
          holding={actionModalHolding}
          action={actionType}
          isOpen={Boolean(actionModalHolding)}
          onClose={() => setActionModalHolding(null)}
        />
      </div>
    );
  }

  // 4. Full-App Screen: 1-Day Change Breakdown
  if (isDayChangeModalOpen) {
    return (
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 pt-2 pb-safe pb-36 min-h-full space-y-4">
        <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDayChangeModalOpen(false)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              1-Day Change Performance Breakdown
            </h2>
          </div>
        </header>
        <DayChangeInfoModal
          isOpen={isDayChangeModalOpen}
          onClose={() => setIsDayChangeModalOpen(false)}
          portfolioDayPerf={portfolioDayPerf}
          singleHolding={dayChangeModalHolding}
          onSelectHolding={(hId) => setSelectedHoldingId(hId)}
          categoryFilterLabel="Portfolio"
          onRefreshPrices={() => syncMarketPrices(true)}
          isRefreshing={isUpdatingNavs}
        />
      </div>
    );
  }

  if (selectedHoldingId) {
    return (
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-2 pb-safe pb-36 min-h-full">
        <HoldingDetailView
          holdingId={selectedHoldingId}
          onBack={() => {
            setSelectedHoldingId(null);
            setActionModalHolding(null);
            setEditingHolding(null);
            setIsHoldingModalOpen(false);
          }}
        />
        <HoldingModal
          isOpen={isHoldingModalOpen}
          initialHolding={editingHolding}
          defaultAssetType={targetDefaultAssetType}
          onClose={() => {
            setIsHoldingModalOpen(false);
            setEditingHolding(null);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <div
        id="investments-main-container"
        className="flex flex-col space-y-6 pb-20"
      >
        {/* ========================================================= */}
        {/* 1. CLEAN CATEGORY TOGGLE SWITCHES / SEGMENTED FILTER BAR */}
        {/* ========================================================= */}
        <div className="space-y-2">
          {/* Primary Category Toggles */}
          <div className="p-1 sm:p-1.5 bg-slate-200/80 dark:bg-slate-800/80 rounded-2xl flex items-center justify-between gap-1 shadow-inner border border-slate-300/40 dark:border-slate-700/50">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`flex-1 py-1.5 sm:py-2 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs md:text-sm font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 ${
                activeFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs ring-1 ring-slate-900/5 dark:ring-white/10'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/40'
              }`}
            >
              <span className="truncate">All</span>
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                  activeFilter === 'all'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    : 'bg-slate-300/60 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {holdings.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('stock')}
              className={`flex-1 py-1.5 sm:py-2 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs md:text-sm font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 ${
                activeFilter === 'stock'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-1 ring-blue-500'
                  : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/40 dark:hover:bg-slate-700/40'
              }`}
            >
              <span className="truncate">Stocks</span>
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                  activeFilter === 'stock'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-300/60 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {stockHoldings.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('mutual_fund')}
              className={`flex-1 py-1.5 sm:py-2 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs md:text-sm font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 ${
                activeFilter === 'mutual_fund'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-500'
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white/40 dark:hover:bg-slate-700/40'
              }`}
            >
              <span className="truncate">Mutual Funds</span>
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                  activeFilter === 'mutual_fund'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-300/60 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {mfHoldings.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('bonds_pf')}
              className={`flex-1 py-1.5 sm:py-2 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs md:text-sm font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 ${
                activeFilter === 'bonds_pf'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md shadow-amber-600/25 ring-1 ring-amber-500'
                  : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white/40 dark:hover:bg-slate-700/40'
              }`}
            >
              <span className="truncate">Bonds/PF</span>
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                  activeFilter === 'bonds_pf'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-300/60 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {bondsPfHoldings.length}
              </span>
            </button>
          </div>

          {/* Secondary Sub-Toggle: Displayed when Bonds/PF is selected to switch between All, Bonds, SGBs, and PFs */}
          {activeFilter === 'bonds_pf' && (
            <div className="p-1 sm:p-1.5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl flex items-center justify-between gap-1 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                type="button"
                onClick={() => setBondsPfSubFilter('all')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
                  bondsPfSubFilter === 'all'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                }`}
              >
                <span className="truncate">All Bonds/PF</span>
                <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 bg-black/15 dark:bg-white/15">
                  {bondsPfHoldings.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setBondsPfSubFilter('bond')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
                  bondsPfSubFilter === 'bond'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                }`}
              >
                <span className="truncate">Bonds</span>
                <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 bg-black/15 dark:bg-white/15">
                  {bondsOnlyHoldings.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setBondsPfSubFilter('sgb')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
                  bondsPfSubFilter === 'sgb'
                    ? 'bg-yellow-600 text-white shadow-xs'
                    : 'text-yellow-900 dark:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-900/40'
                }`}
              >
                <span className="truncate">SGBs</span>
                <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 bg-black/15 dark:bg-white/15">
                  {sgbHoldings.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setBondsPfSubFilter('pf')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
                  bondsPfSubFilter === 'pf'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-cyan-900 dark:text-cyan-200 hover:bg-cyan-100 dark:hover:bg-cyan-900/40'
                }`}
              >
                <span className="truncate">PF</span>
                <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 bg-black/15 dark:bg-white/15">
                  {pfHoldings.length}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 2. DEDICATED OR DYNAMIC PORTFOLIO MASTER SUMMARY HEADER */}
        {/* ========================================================= */}
        {activeFilter === 'bonds_pf' && bondsPfSubFilter === 'all' ? (
          <BondsPfCombinedSummaryCard
            bondsSummary={bondsSummary}
            sgbSummary={sgbSummary}
            pfSummary={pfSummary}
            onAddAsset={() => {
              setEditingHolding(null);
              setIsHoldingModalOpen(true);
            }}
          />
        ) : activeFilter === 'bonds_pf' && bondsPfSubFilter === 'bond' ? (
          <BondsSummaryCard
            summary={bondsSummary}
            onAddBond={() => {
              setEditingHolding(null);
              setIsHoldingModalOpen(true);
            }}
          />
        ) : activeFilter === 'bonds_pf' && bondsPfSubFilter === 'sgb' ? (
          <SgbSummaryCard
            summary={sgbSummary}
            onAddSgb={() => {
              setEditingHolding(null);
              setIsHoldingModalOpen(true);
            }}
            onSyncGold={() => {
              if (typeof navigator !== 'undefined' && !navigator.onLine) {
                showToast('Offline Mode: Your device is currently offline. Using cached prices stored in local database.', 'info');
                return;
              }
              syncMarketPrices(true);
            }}
            isSyncing={isUpdatingNavs}
          />
        ) : activeFilter === 'bonds_pf' && bondsPfSubFilter === 'pf' ? (
          <PfSummaryCard
            summary={pfSummary}
            onAddPfAccount={() => {
              setEditingHolding(null);
              setIsHoldingModalOpen(true);
            }}
          />
        ) : (
          <div className="w-full min-w-0 overflow-hidden p-5 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            {/* Category Context & Filter Switcher */}
            <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {activeFilter === 'all'
                  ? 'Consolidated Portfolio'
                  : activeFilter === 'stock'
                  ? 'Equities & Shares'
                  : activeFilter === 'mutual_fund'
                  ? 'SIPs & Mutual Funds'
                  : bondsPfSubFilter === 'bond'
                  ? 'Fixed Income & Bonds'
                  : bondsPfSubFilter === 'sgb'
                  ? 'Sovereign Gold Bonds (SGB)'
                  : bondsPfSubFilter === 'pf'
                  ? 'Provident Funds (EPF / PPF / VPF)'
                  : 'Bonds, SGBs & Provident Funds'}
              </span>
              {activeFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>All</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {portfolioXIRR !== null && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    portfolioXIRR >= 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50'
                  }`}
                  title="Annualized Portfolio XIRR return"
                >
                  XIRR: {portfolioXIRR >= 0 ? '+' : ''}{portfolioXIRR.toFixed(2)}%
                </span>
              )}
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                {currentSummary.count} {currentSummary.count === 1 ? 'Asset' : 'Assets'}
              </span>
            </div>
          </div>

          {/* HERO METRIC: Current Valuation at the absolute top with overall gains badge */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Current Valuation
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold tabular-nums px-2.5 py-1 rounded-full shrink-0 border ${
                  currentSummary.totalPnL >= 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60'
                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/60'
                }`}
                title={`Total Returns: ${currentSummary.totalPnL >= 0 ? '+' : ''}${formatINR(currentSummary.totalPnL)} (${currentSummary.totalPnL >= 0 ? '+' : ''}${currentSummary.totalPnLPercent.toFixed(2)}%)`}
              >
                {currentSummary.totalPnL >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {currentSummary.totalPnL >= 0 ? '+' : ''}{formatINR(currentSummary.totalPnL)} ({currentSummary.totalPnL >= 0 ? '+' : ''}{currentSummary.totalPnLPercent.toFixed(2)}%)
                </span>
              </span>
            </div>
            <div
              className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight truncate block"
              title={formatINR(currentSummary.totalCurrentValue)}
            >
              {formatINR(currentSummary.totalCurrentValue)}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Across {currentSummary.count} active {currentSummary.count === 1 ? 'position' : 'positions'}
            </p>
          </div>

          {/* BALANCED 4-COLUMN METRICS GRID: Invested Value, Unrealized P&L, Booked Profit, 1-Day Change */}
          <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6">
            {/* 1. Invested Value (Moved down into balanced grid) */}
            <div className="space-y-0.5 min-w-0">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">
                Invested Value
              </span>
              <div
                className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 tabular-nums truncate block"
                title={formatINR(currentSummary.totalInvested)}
              >
                {formatINR(currentSummary.totalInvested)}
              </div>
              <span className="text-[10px] text-slate-400 block truncate">Total cost basis</span>
            </div>

            {/* 2. Unrealized P&L */}
            <div className="space-y-0.5 min-w-0">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">
                Unrealized P&L
              </span>
              <div
                className={`text-sm sm:text-base font-extrabold tabular-nums flex items-center gap-1 truncate ${
                  currentSummary.totalPnL >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
                title={`${currentSummary.totalPnL >= 0 ? '+' : ''}${formatINR(currentSummary.totalPnL)}`}
              >
                {currentSummary.totalPnL >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">{currentSummary.totalPnL >= 0 ? '+' : ''}{formatINR(currentSummary.totalPnL)}</span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                {currentSummary.totalPnLPercent >= 0 ? '+' : ''}{currentSummary.totalPnLPercent.toFixed(2)}% on cost
              </span>
            </div>

            {/* 3. Booked Profit */}
            <div className="space-y-0.5 min-w-0">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">
                Booked Profit
              </span>
              <div
                className={`text-sm sm:text-base font-extrabold tabular-nums flex items-center gap-1 truncate ${
                  currentSummary.totalBookedProfit >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
                title={`Realized Booked Profit: ${currentSummary.totalBookedProfit >= 0 ? '+' : ''}${formatINR(currentSummary.totalBookedProfit)}`}
              >
                <Coins className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">{currentSummary.totalBookedProfit >= 0 ? '+' : ''}{formatINR(currentSummary.totalBookedProfit)}</span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate">Realized gains</span>
            </div>

            {/* 4. 1-Day Change (Clickable -> Opens Breakdown & Last Day Value Screen) */}
            <button
              type="button"
              onClick={() => {
                setDayChangeModalHolding(null);
                setIsDayChangeModalOpen(true);
              }}
              className="text-left space-y-0.5 min-w-0 p-2 -m-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              title="Click to view 1-Day Change breakdown, last day value, and date"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors flex items-center gap-1">
                  1-Day Change
                  <Info className="w-3 h-3 text-slate-400 group-hover:text-primary-500 transition-colors" />
                </span>
                <span className="text-[9px] font-bold text-primary-600 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  More info →
                </span>
              </div>
              <div
                className={`text-sm sm:text-base font-extrabold tabular-nums flex items-center gap-1 truncate ${
                  currentSummary.totalDayChange >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {currentSummary.totalDayChange >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">{currentSummary.totalDayChange >= 0 ? '+' : ''}{formatINR(currentSummary.totalDayChange)}</span>
              </div>
              <span className="text-[10px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 block truncate transition-colors">
                {currentSummary.totalDayChange >= 0 ? '+' : ''}{currentSummary.totalDayChangePercent.toFixed(2)}% vs last session
              </span>
            </button>
          </div>
        </div>
        )}

        {/* LOWERED ACTION BUTTONS TOOLBAR AT BOTTOM OF CARD (Context-Aware: Irrelevant operations removed) */}
        <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* 1. Trade Stocks Action: Only shown for Stocks and Consolidated All (Removed in Bonds & MFs as requested) */}
            {(activeFilter === 'stock' || activeFilter === 'all') && (
              <button
                type="button"
                onClick={() => openTradeModal('stock')}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-xs shadow-blue-600/20 active:scale-95 transition-all cursor-pointer shrink-0"
                title="Execute Stock Buy/Sell with real-time statutory taxes, break-even price, and dual-write expense logging"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>Trade Stocks</span>
              </button>
            )}

            {/* 2. SIP Manager Action: Only shown for Mutual Funds and Consolidated All (Removed in Stocks & Bonds/PF) */}
            {(activeFilter === 'mutual_fund' || activeFilter === 'all') && (
              <button
                type="button"
                onClick={() => setIsSipManagerOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 ${
                  activeFilter === 'mutual_fund'
                    ? 'text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-xs shadow-purple-600/20 active:scale-95'
                    : 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 hover:bg-purple-100 dark:hover:bg-purple-900/40 shadow-2xs'
                }`}
                title="Manage Mutual Fund SIPs, AMFI daily closing NAV checks, and execution logs"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span>SIP ({sipSchedules.length})</span>
              </button>
            )}

            {/* 3. Sync Prices / NAVs: Context-aware title & label */}
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                  showToast('Offline Mode: Your device is currently offline. Using cached prices stored in local database.', 'info');
                  return;
                }
                syncMarketPrices(true);
              }}
              disabled={isUpdatingNavs}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              title={
                activeFilter === 'mutual_fund'
                  ? 'Fetch latest closing NAVs from AMFI portal'
                  : activeFilter === 'bonds_pf'
                  ? 'Fetch latest closing market prices & gold rates for SGBs'
                  : 'Fetch latest closing market prices & NAVs online via Yahoo Finance & AMFI'
              }
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isUpdatingNavs ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">
                {isUpdatingNavs ? 'Updating...' : activeFilter === 'mutual_fund' ? 'Sync NAVs' : 'Sync Prices'}
              </span>
              <span className="xs:hidden">{isUpdatingNavs ? '...' : 'Sync'}</span>
            </button>

            {/* 4. CSV Import/Export: Applicable to Stocks, Mutual Funds, and All (Removed in Bonds/PF) */}
            {activeFilter !== 'bonds_pf' && (
              <button
                type="button"
                onClick={() => setIsInvestmentCSVModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 rounded-xl shadow-2xs transition-colors cursor-pointer shrink-0"
                title="Import or Export Stocks and Mutual Funds via CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
                <span>CSV</span>
              </button>
            )}

            {/* 5. Chronological Sequence Activity Ledger: Automatically pre-filters to the active category */}
            <button
              type="button"
              onClick={() => {
                if (activeFilter === 'stock') setActivityAssetFilter('stock');
                else if (activeFilter === 'mutual_fund') setActivityAssetFilter('mutual_fund');
                else if (activeFilter === 'bonds_pf') setActivityAssetFilter('bonds_pf');
                else setActivityAssetFilter('all');
                setIsAllActivityModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl shadow-2xs transition-colors cursor-pointer shrink-0"
              title="View all portfolio transactions sorted in chronological sequence"
            >
              <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">Activity Ledger ({filteredSortedActivity.length})</span>
              <span className="sm:hidden">Ledger ({filteredSortedActivity.length})</span>
            </button>

            {/* 6. Export Portfolio Analysis */}
            <button
              type="button"
              onClick={() => openAnalysisExportModal('investments')}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl shadow-2xs transition-colors cursor-pointer shrink-0"
              title="Open complete portfolio analysis, asset allocation, P&L audit, and SIP schedules"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Analysis</span>
            </button>

            {/* 7. Asset Category Report Button */}
            <button
              type="button"
              onClick={() => handleGenerateAssetTypeReport(activeFilter)}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl shadow-2xs transition-colors cursor-pointer shrink-0"
              title={`Generate ${activeFilter.toUpperCase()} Audit Report`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>
                {activeFilter === 'stock'
                  ? 'Stocks Report'
                  : activeFilter === 'mutual_fund'
                  ? 'MF Report'
                  : activeFilter === 'bonds_pf'
                  ? 'Bonds/PF Report'
                  : 'Portfolio Report'}
              </span>
            </button>
          </div>

          {/* Dynamic Contextual Add Asset Button */}
          <button
            type="button"
            onClick={() => {
              setEditingHolding(null);
              setIsHoldingModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer shrink-0 ml-auto"
            title={`Add new holding (defaults to ${targetDefaultAssetType.toUpperCase()})`}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{addAssetButtonLabel}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. DEDICATED STOCKS BREAKDOWN CHART (When Stocks filter active) */}
      {/* ========================================================= */}
      {activeFilter === 'stock' && stockBreakdownData.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <PieIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  Stocks Portfolio Breakdown
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                Click any stock slice or card to open its ledger and transaction history
              </p>
            </div>
            <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40 shrink-0 self-start sm:self-auto">
              {stockBreakdownData.length} Stocks Active
            </span>
          </div>

          {/* Top 3 Stocks Highlight Banner: Displays value along with name of the top three stocks */}
          {stockBreakdownData.length > 0 && (
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>Top 3 Stocks by Valuation</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Name & Value</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {stockBreakdownData.slice(0, 3).map((item, idx) => {
                  const totalStockVal = currentSummary.totalCurrentValue || 1;
                  const percent = (item.value / totalStockVal) * 100;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedHoldingId(item.id)}
                      className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:border-blue-500/50 shadow-2xs transition-all"
                      title={`${item.fullName}: ₹${formatINR(item.value)} (${percent.toFixed(1)}%)`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 ring-1 ring-amber-400/30'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                        }`}>
                          #{idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 tabular-nums">
                            {percent.toFixed(1)}% of stocks
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums block">
                          ₹{formatINR(item.value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4 pt-1">
            <div className="h-44 sm:h-52 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    cursor="pointer"
                    onClick={(entry: any) => {
                      if (entry?.id) {
                        setSelectedHoldingId(entry.id);
                      }
                    }}
                  >
                    {stockBreakdownData.map((entry, index) => (
                      <Cell key={`stock-cell-${index}`} fill={entry.color} cursor="pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={false}
                    formatter={(val: any) => [formatINR(Number(val)), 'Current Valuation']}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Interactive Stock Breakdown Legend Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {stockBreakdownData.map((item) => {
                const totalStockVal = currentSummary.totalCurrentValue || 1;
                const percent = (item.value / totalStockVal) * 100;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedHoldingId(item.id)}
                    className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-blue-500/60 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all cursor-pointer group min-w-0 overflow-hidden"
                    title={`${item.fullName} (Click for ledger)`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">
                        {percent.toFixed(1)}%
                      </span>
                    </div>
                    <div
                      className={`text-xs font-extrabold mt-1 tabular-nums flex items-center gap-0.5 truncate ${
                        item.value > item.invested
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : item.value < item.invested
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                      title={formatINR(item.value)}
                    >
                      {item.value > item.invested && <ArrowUpRight className="w-3 h-3 shrink-0" />}
                      {item.value < item.invested && <ArrowDownRight className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{formatINR(item.value)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 tabular-nums truncate">
                      Invested: {formatINR(item.invested)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. DEDICATED MUTUAL FUNDS BREAKDOWN (When MF filter active) */}
      {/* ========================================================= */}
      {activeFilter === 'mutual_fund' && mfBreakdownData.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <PieIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  Mutual Funds Portfolio Breakdown
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                Click any mutual fund to open its NAV history and passbook transactions
              </p>
            </div>
            <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40 shrink-0 self-start sm:self-auto">
              {mfBreakdownData.length} Funds Active
            </span>
          </div>

          {/* Top 3 Mutual Funds Highlight Banner: Displays value along with name of the top three mutual funds */}
          {mfBreakdownData.length > 0 && (
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>Top 3 Mutual Funds by Valuation</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Name & Value</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {mfBreakdownData.slice(0, 3).map((item, idx) => {
                  const totalMfVal = currentSummary.totalCurrentValue || 1;
                  const percent = (item.value / totalMfVal) * 100;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedHoldingId(item.id)}
                      className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:border-emerald-500/50 shadow-2xs transition-all"
                      title={`${item.fullName}: ₹${formatINR(item.value)} (${percent.toFixed(1)}%)`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 ring-1 ring-amber-400/30'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                        }`}>
                          #{idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 tabular-nums">
                            {percent.toFixed(1)}% of funds
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums block">
                          ₹{formatINR(item.value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4 pt-1">
            <div className="h-44 sm:h-52 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mfBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    cursor="pointer"
                    onClick={(entry: any) => {
                      if (entry?.id) {
                        setSelectedHoldingId(entry.id);
                      }
                    }}
                  >
                    {mfBreakdownData.map((entry, index) => (
                      <Cell key={`mf-cell-${index}`} fill={entry.color} cursor="pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={false}
                    formatter={(val: any) => [formatINR(Number(val)), 'Current NAV Valuation']}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {mfBreakdownData.map((item) => {
                const totalVal = currentSummary.totalCurrentValue || 1;
                const percent = (item.value / totalVal) * 100;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedHoldingId(item.id)}
                    className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-emerald-500/60 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all cursor-pointer group min-w-0 overflow-hidden"
                    title={`${item.fullName} (Click for details)`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">
                        {percent.toFixed(1)}%
                      </span>
                    </div>
                    <div
                      className={`text-xs font-extrabold mt-1 tabular-nums flex items-center gap-0.5 truncate ${
                        item.value > item.invested
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : item.value < item.invested
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                      title={formatINR(item.value)}
                    >
                      {item.value > item.invested && <ArrowUpRight className="w-3 h-3 shrink-0" />}
                      {item.value < item.invested && <ArrowDownRight className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{formatINR(item.value)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 tabular-nums truncate">
                      Invested: {formatINR(item.invested)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4.5. DEDICATED BONDS & PF BREAKDOWN (When Bonds/PF filter active) */}
      {/* ========================================================= */}
      {activeFilter === 'bonds_pf' && bondsPfBreakdownData.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <PieIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  {bondsPfSubFilter === 'bond'
                    ? 'Bonds & Fixed Income Breakdown'
                    : bondsPfSubFilter === 'sgb'
                    ? 'Sovereign Gold Bonds (SGB) Breakdown'
                    : bondsPfSubFilter === 'pf'
                    ? 'Provident Funds (PF) Breakdown'
                    : 'Bonds, SGBs & PF Holdings Breakdown'}
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                Click any holding to open its ledger, coupon interest, and passbook transactions
              </p>
            </div>
            <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40 shrink-0 self-start sm:self-auto">
              {bondsPfBreakdownData.length} {bondsPfBreakdownData.length === 1 ? 'Holding' : 'Holdings'} Active
            </span>
          </div>

          {/* Top 3 Bonds/PF Highlight Banner */}
          {bondsPfBreakdownData.length > 0 && (
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>Top Holdings by Valuation</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Name & Value</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {bondsPfBreakdownData.slice(0, 3).map((item, idx) => {
                  const totalBondsVal = currentSummary.totalCurrentValue || 1;
                  const percent = (item.value / totalBondsVal) * 100;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedHoldingId(item.id)}
                      className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:border-amber-500/50 shadow-2xs transition-all"
                      title={`${item.fullName}: ₹${formatINR(item.value)} (${percent.toFixed(1)}%)`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 ring-1 ring-amber-400/30'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                        }`}>
                          #{idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 tabular-nums">
                            {item.typeLabel} · {percent.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums block">
                          ₹{formatINR(item.value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4 pt-1">
            <div className="h-44 sm:h-52 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bondsPfBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    cursor="pointer"
                    onClick={(entry: any) => {
                      if (entry?.id) {
                        setSelectedHoldingId(entry.id);
                      }
                    }}
                  >
                    {bondsPfBreakdownData.map((entry, index) => (
                      <Cell key={`bond-pf-cell-${index}`} fill={entry.color} cursor="pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={false}
                    formatter={(val: any) => [formatINR(Number(val)), 'Current Value']}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {bondsPfBreakdownData.map((item) => {
                const totalVal = currentSummary.totalCurrentValue || 1;
                const percent = (item.value / totalVal) * 100;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedHoldingId(item.id)}
                    className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-amber-500/60 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-all cursor-pointer group min-w-0 overflow-hidden"
                    title={`${item.fullName} (Click for details)`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">
                        {percent.toFixed(1)}%
                      </span>
                    </div>
                    <div
                      className={`text-xs font-extrabold mt-1 tabular-nums flex items-center gap-0.5 truncate ${
                        item.value > item.invested
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : item.value < item.invested
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                      title={formatINR(item.value)}
                    >
                      {item.value > item.invested && <ArrowUpRight className="w-3 h-3 shrink-0" />}
                      {item.value < item.invested && <ArrowDownRight className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{formatINR(item.value)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 tabular-nums truncate">
                      {item.typeLabel} · Cost: {formatINR(item.invested)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. OVERALL PORTFOLIO ASSET ALLOCATION PIE CHART (Drill-Down) */}
      {/* ========================================================= */}
      {activeFilter === 'all' && overallChartData.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                <PieIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Asset Allocation Breakdown</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                Interactive: Click any segment or card to drill down directly into that asset class
              </p>
            </div>
            <span className="text-[11px] sm:text-xs text-slate-400 font-medium tabular-nums shrink-0 self-start sm:self-auto">
              {holdings.length} Positions Active
            </span>
          </div>

          {/* Top Asset Allocation Highlight Banner: Displays value along with name of the top allocation areas */}
          {overallChartData.length > 0 && (
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>Top Asset Classes by Valuation</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Name & Value</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[...overallChartData].sort((a, b) => b.value - a.value).slice(0, 3).map((item, idx) => {
                  const totalPortfolioVal = currentSummary.totalCurrentValue || 1;
                  const percent = (item.value / totalPortfolioVal) * 100;
                  return (
                    <div
                      key={item.name}
                      onClick={() => item.filterKey && setActiveFilter(item.filterKey)}
                      className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:border-emerald-500/50 shadow-2xs transition-all"
                      title={`${item.name}: ₹${formatINR(item.value)} (${percent.toFixed(1)}%) - Click to filter`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 ring-1 ring-amber-400/30'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                        }`}>
                          #{idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 tabular-nums">
                            {percent.toFixed(1)}% of portfolio
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums block">
                          ₹{formatINR(item.value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4 pt-1">
            <div className="h-44 sm:h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={overallChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="value"
                    cursor="pointer"
                    onClick={(entry: any) => {
                      if (entry?.filterKey) {
                        setActiveFilter(entry.filterKey);
                      }
                    }}
                  >
                    {overallChartData.map((entry, index) => (
                      <Cell key={`overall-cell-${index}`} fill={entry.color} cursor="pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatINR(Number(val)), 'Current Value']}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Allocation Legend with Drill-Down Clicks */}
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-2 gap-2">
              {overallChartData.map((item) => {
                const percent =
                  currentSummary.totalCurrentValue > 0
                    ? (item.value / currentSummary.totalCurrentValue) * 100
                    : 0;
                return (
                  <div
                    key={item.name}
                    onClick={() => setActiveFilter(item.filterKey)}
                    className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-emerald-500/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer group min-w-0 overflow-hidden"
                    title={`Click to view detailed ${item.name} breakdown`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                          {item.name}
                        </span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                    </div>
                    <div
                      className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums truncate block"
                      title={formatINR(item.value)}
                    >
                      {formatINR(item.value)}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-400 tabular-nums font-semibold mt-0.5 truncate">
                      {percent.toFixed(1)}% of Portfolio
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. VALUATION OVER TIME GRAPH (Timeline Zoom) */}
      {/* ========================================================= */}
      {isCardVisible('valuation_trajectory') && (
        <div style={{ order: getCardOrder('valuation_trajectory') }} className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Valuation Trajectory Over Time</span>
              </h3>
              <span className="text-[11px] sm:text-xs text-slate-400 truncate block">
                Chronological portfolio valuation trajectory with timeline zooming
              </span>
            </div>

            {/* Timeline Buttons: 1W, 1M, 6M, 1Y, ALL */}
            <div className="flex items-center gap-1 p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0 self-start sm:self-auto">
              {(['1W', '1M', '6M', '1Y', 'ALL'] as TimelineButton[]).map((btn) => (
                <button
                  key={btn}
                  onClick={() => setSelectedTimeline(btn)}
                  className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    selectedTimeline === btn
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {btn === '1W'
                    ? 'Week'
                    : btn === '1M'
                    ? 'Month'
                    : btn === '6M'
                    ? '6M'
                    : btn === '1Y'
                    ? 'Year'
                    : 'All'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-48 sm:h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolioHistoryData} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                <defs>
                  <linearGradient id="portfolioValuationGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis
                  domain={['auto', 'auto']}
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(val) => formatCompactINR(Number(val))}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const curVal = Number(payload.find((p) => p.dataKey === 'current')?.value || 0);
                    const invVal = Number(payload.find((p) => p.dataKey === 'value')?.value || 0);
                    const diff = curVal - invVal;
                    const pct = invVal > 0 ? (diff / invVal) * 100 : 0;
                    return (
                      <div className="p-3 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-xl text-white text-xs space-y-1.5 backdrop-blur-md">
                        <div className="font-semibold text-slate-300 border-b border-slate-700/60 pb-1 flex items-center justify-between gap-3">
                          <span>{label}</span>
                          <span className={`text-[11px] font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {diff >= 0 ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400">Valuation:</span>
                          <span className="font-bold tabular-nums text-emerald-400">{formatINR(curVal)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400">Invested Basis:</span>
                          <span className="font-medium tabular-nums text-slate-300">{formatINR(invVal)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  name="current"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fill="url(#portfolioValuationGrad)"
                  dot={{ r: 2.5, fill: '#059669' }}
                  activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="value"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1.8}
                  dot={{ r: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5.5. STOCKS VS MUTUAL FUNDS COMPARATIVE OVERVIEW (Only in ALL Tab) */}
      {/* ========================================================= */}
      {isCardVisible('stocks_vs_mf') && activeFilter === 'all' && (stockHoldings.length > 0 || mfHoldings.length > 0) && (
        <div style={{ order: getCardOrder('stocks_vs_mf') }} className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Stocks vs Mutual Funds Comparative Analysis</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                Direct head-to-head capital distribution, valuation, and return diagnostics
              </p>
            </div>
            {/* Quick Filter Jump Buttons */}
            <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveFilter('stock')}
                className="px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200/60 dark:border-blue-900/40"
              >
                View Stocks ({stocksVsMfComparison.stocks.count}) →
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('mutual_fund')}
                className="px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/60 dark:border-emerald-900/40"
              >
                View MFs ({stocksVsMfComparison.mf.count}) →
              </button>
            </div>
          </div>

          {/* Allocation Split Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                Direct Equity: {stocksVsMfComparison.stocks.weight.toFixed(1)}%
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Mutual Funds: {stocksVsMfComparison.mf.weight.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${stocksVsMfComparison.stocks.weight}%` }}
                title={`Direct Stocks: ${stocksVsMfComparison.stocks.weight.toFixed(1)}%`}
              />
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${stocksVsMfComparison.mf.weight}%` }}
                title={`Mutual Funds: ${stocksVsMfComparison.mf.weight.toFixed(1)}%`}
              />
            </div>
          </div>

          {/* Side-by-Side Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Stocks Column */}
            <div
              onClick={() => setActiveFilter('stock')}
              className="p-3.5 rounded-2xl border transition-all cursor-pointer bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-blue-400 hover:bg-blue-50/20"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
                <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  Direct Equity / Stocks
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  {stocksVsMfComparison.stocks.count} Scrips
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Valuation</span>
                  <span className="font-extrabold text-slate-900 dark:text-white tabular-nums block">
                    {formatINR(stocksVsMfComparison.stocks.valuation)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Invested</span>
                  <span className="font-medium text-slate-600 dark:text-slate-300 tabular-nums block">
                    {formatINR(stocksVsMfComparison.stocks.invested)}
                  </span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/40 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">Unrealized P&L:</span>
                  <span
                    className={`font-bold tabular-nums flex items-center gap-0.5 ${
                      stocksVsMfComparison.stocks.pnl >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {stocksVsMfComparison.stocks.pnl >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {stocksVsMfComparison.stocks.pnl >= 0 ? '+' : ''}
                    {formatINR(stocksVsMfComparison.stocks.pnl)} ({stocksVsMfComparison.stocks.pnl >= 0 ? '+' : ''}
                    {stocksVsMfComparison.stocks.pnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Mutual Funds Column */}
            <div
              onClick={() => setActiveFilter('mutual_fund')}
              className="p-3.5 rounded-2xl border transition-all cursor-pointer bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-emerald-400 hover:bg-emerald-50/20"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Mutual Funds (AMFI)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                  {stocksVsMfComparison.mf.count} Schemes
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Valuation</span>
                  <span className="font-extrabold text-slate-900 dark:text-white tabular-nums block">
                    {formatINR(stocksVsMfComparison.mf.valuation)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Invested</span>
                  <span className="font-medium text-slate-600 dark:text-slate-300 tabular-nums block">
                    {formatINR(stocksVsMfComparison.mf.invested)}
                  </span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/40 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">Unrealized P&L:</span>
                  <span
                    className={`font-bold tabular-nums flex items-center gap-0.5 ${
                      stocksVsMfComparison.mf.pnl >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {stocksVsMfComparison.mf.pnl >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {stocksVsMfComparison.mf.pnl >= 0 ? '+' : ''}
                    {formatINR(stocksVsMfComparison.mf.pnl)} ({stocksVsMfComparison.mf.pnl >= 0 ? '+' : ''}
                    {stocksVsMfComparison.mf.pnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6.5. PROFIT / LOSS GROWTH BAR GRAPH (Combined, Stocks, MF) */}
      {/* Custom Bar: Invested (Blue) + Bordered Profit (Green) / Dotted Loss (Red) */}
      {/* ========================================================= */}
      {isCardVisible('growth_bar_analytics') && (
        <div style={{ order: getCardOrder('growth_bar_analytics') }} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Growth Bar Analytics</span>
            </span>
            {/* Timeframe selector: Weeks, Months, Years */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {(['week', 'month', 'year', 'all'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setGrowthPeriod(period)}
                  className={`px-2 py-1 text-[10px] sm:text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                    growthPeriod === period
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {period === 'week' ? 'Weeks' : period === 'month' ? 'Months' : period === 'year' ? 'Year' : 'All Time'}
                </button>
              ))}
            </div>
          </div>

          <ProfitLossGrowthBarChart
            combinedData={
              activeFilter === 'stock'
                ? stocksGrowthData
                : activeFilter === 'mutual_fund'
                ? mfGrowthData
                : activeFilter === 'bonds_pf'
                ? bondsPfGrowthData
                : combinedGrowthData
            }
            stocksData={stocksGrowthData}
            mfData={mfGrowthData}
            initialCategory={
              activeFilter === 'stock'
                ? 'stocks'
                : activeFilter === 'mutual_fund'
                ? 'mf'
                : 'combined'
            }
            title={
              activeFilter === 'stock'
                ? 'Stocks Growth (Direct Equities)'
                : activeFilter === 'mutual_fund'
                ? 'Mutual Funds Growth (SIPs & NAVs)'
                : activeFilter === 'bonds_pf'
                ? `${
                    bondsPfSubFilter === 'bond'
                      ? 'Bonds'
                      : bondsPfSubFilter === 'sgb'
                      ? 'SGBs'
                      : bondsPfSubFilter === 'pf'
                      ? 'Provident Funds'
                      : 'Bonds & PF'
                  } Growth & Yield`
                : 'Combined Portfolio Growth'
            }
            subtitle={`Trailing 6 ${growthPeriod === 'week' ? 'weeks' : growthPeriod === 'month' ? 'months' : 'years'} single-bar profit/loss architecture`}
            height={260}
            showCategorySwitch={activeFilter === 'all'}
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. FILTERED HOLDINGS LIST & TOOLBAR */}
      {/* ========================================================= */}
      {isCardVisible('holdings_table') && (
        <div style={{ order: getCardOrder('holdings_table') }} className="space-y-3">
          <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
            {/* Search Input for Investment Holdings, Stocks, Mutual Funds */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search holdings, stocks, mutual funds, or symbols..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

        {/* Toolbar Sub-Bar: Counts, View Mode & Sort Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              {activeFilter === 'all'
                ? `Holdings (${processedHoldings.length})`
                : activeFilter === 'stock'
                ? `Stocks (${processedHoldings.length})`
                : activeFilter === 'mutual_fund'
                ? `Mutual Funds (${processedHoldings.length})`
                : bondsPfSubFilter === 'bond'
                ? `Bonds (${processedHoldings.length})`
                : bondsPfSubFilter === 'sgb'
                ? `SGBs (${processedHoldings.length})`
                : bondsPfSubFilter === 'pf'
                ? `Provident Funds (${processedHoldings.length})`
                : `Bonds & PF (${processedHoldings.length})`}
            </span>
            {searchQuery && (
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 truncate max-w-[140px]">
                "{searchQuery}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle between Current Value and Returns */}
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[11px] font-semibold">
              <button
                onClick={() => setDisplayMode('value')}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                  displayMode === 'value'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Value
              </button>
              <button
                onClick={() => setDisplayMode('returns')}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                  displayMode === 'returns'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Returns
              </button>
            </div>

            {/* Sort Controls Bar */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSortBy('name')}
                className={`px-2 py-0.5 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                  sortBy === 'name'
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Name
              </button>
              <button
                onClick={() => setSortBy('amount')}
                className={`px-2 py-0.5 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                  sortBy === 'amount'
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Amount
              </button>
              <button
                onClick={() => setSortBy('returns')}
                className={`px-2 py-0.5 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                  sortBy === 'returns'
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                PnL
              </button>

              <button
                onClick={() => setSortAsc(!sortAsc)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={sortAsc ? 'Ascending' : 'Descending'}
              >
                {sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Holdings List Items */}
      <div className="space-y-2">
        {processedHoldings.length === 0 ? (
          <div className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400">
            <p className="text-sm font-semibold">
              No {
                activeFilter === 'all'
                  ? ''
                  : activeFilter === 'stock'
                  ? 'stock'
                  : activeFilter === 'mutual_fund'
                  ? 'mutual fund'
                  : bondsPfSubFilter === 'bond'
                  ? 'bond'
                  : bondsPfSubFilter === 'sgb'
                  ? 'SGB'
                  : bondsPfSubFilter === 'pf'
                  ? 'provident fund'
                  : 'bond or PF'
              } holdings found.
            </p>
            <p className="text-xs mt-1">Tap "+ {addAssetButtonLabel}" above to add to your portfolio.</p>
          </div>
        ) : (
          displayedHoldings.map((holding) => {
            if (holding.assetType === 'bond') {
              return (
                <BondHoldingItemCard
                  key={holding.id}
                  holding={holding}
                  livePrice={getHoldingMarketPrice(holding).price}
                  displayMode={displayMode}
                  onClick={() => openHoldingDetail(holding.id)}
                />
              );
            }
            if (holding.assetType === 'sgb') {
              return (
                <SgbHoldingItemCard
                  key={holding.id}
                  holding={holding}
                  liveGoldPrice={getHoldingMarketPrice(holding).price}
                  displayMode={displayMode}
                  onClick={() => openHoldingDetail(holding.id)}
                />
              );
            }
            if (holding.assetType === 'pf') {
              return (
                <PfHoldingItemCard
                  key={holding.id}
                  holding={holding}
                  onClick={() => openHoldingDetail(holding.id)}
                />
              );
            }

            const livePrice = getHoldingMarketPrice(holding).price;
            const investedVal = holding.quantity * holding.averageBuyPrice;
            const currentVal = holding.quantity * livePrice;
            const pnl = currentVal - investedVal;
            const pnlPercent = investedVal > 0 ? (pnl / investedVal) * 100 : 0;
            const isProfit = pnl >= 0;

            const isStock = holding.assetType === 'stock';
            const displayName = holding.customDisplayName || (holding.name.trim().split(/\s+/)[0] || holding.symbol);
            const bInfo = calculateHoldingBookedProfit(holding);

            return (
              <div
                key={holding.id}
                data-holding-id={holding.id}
                onClick={() => openHoldingDetail(holding.id)}
                className="p-2 sm:p-2.5 md:p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/90 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-2 sm:gap-3 min-w-0 overflow-hidden active:scale-[0.99]"
              >
                {/* Left Side: Avatar + Name + Units & Meta */}
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 overflow-hidden">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden shrink-0 border border-slate-200/80 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs shadow-2xs">
                    {holding.customAvatar ? (
                      <img src={holding.customAvatar} alt={holding.name} className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white font-extrabold text-[11px]"
                        style={{ backgroundColor: ASSET_COLORS[holding.assetType] || '#2563eb' }}
                      >
                        {displayName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <h4
                        className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                        title={holding.name}
                      >
                        {displayName}
                      </h4>
                      {/* Verified Badge (Green or Blue tick) / Yellow Confirmation Required Badge - Beside Fund Name only in individual list */}
                      <FundBadge
                        holding={holding}
                        onOpenVerificationModal={(h) => setVerificationModalHolding(h)}
                        onOpenConfirmationModal={(h) => setConfirmationModalHolding(h)}
                      />
                      <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 truncate max-w-[80px]">
                        {holding.symbol}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 min-w-0 overflow-hidden text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="shrink-0 font-medium">
                        {`${formatNumber(holding.quantity)} ${isStock ? 'sh' : 'un'}`}
                      </span>
                      <span className="shrink-0 opacity-60">·</span>
                      <span className="truncate tabular-nums">
                        {`CMP ${formatINR(livePrice)}`}
                      </span>
                      {holding.subscription && (
                        <>
                          <span className="shrink-0 opacity-60">·</span>
                          <span className="text-cyan-600 dark:text-cyan-400 font-semibold truncate">
                            Sub: {formatINR(holding.subscription.amount + (holding.subscription.employerAmount || 0))}/mo
                          </span>
                        </>
                      )}
                      {(() => {
                        const priceInfo = getHoldingMarketPrice(holding);
                        const dayPerf = calculateHoldingDayPerformance(holding, priceInfo);
                        const isDayPositive = dayPerf.dayChangeValue >= 0;
                        return (
                          <>
                            <span className="shrink-0 opacity-60 hidden xs:inline">·</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDayChangeModalHolding(holding);
                                setIsDayChangeModalOpen(true);
                              }}
                              className={`shrink-0 font-semibold tabular-nums hidden xs:inline hover:underline cursor-pointer ${
                                isDayPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                              }`}
                              title={`Click for 1-Day Change details: ${isDayPositive ? '+' : ''}${formatINR(dayPerf.dayChangeValue)} (${isDayPositive ? '+' : ''}${dayPerf.dayChangePercent.toFixed(2)}%)`}
                            >
                              1D: {isDayPositive ? '+' : ''}{dayPerf.dayChangePercent.toFixed(1)}%
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right Side: Financial Values */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 text-right min-w-0 ml-2">
                  <div className="min-w-0">
                    {displayMode === 'value' ? (
                      <>
                        <div
                          className={`text-xs sm:text-sm md:text-base font-extrabold tabular-nums flex items-center justify-end gap-0.5 whitespace-nowrap ${
                            currentVal > investedVal
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : currentVal < investedVal
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                          title={formatINR(currentVal)}
                        >
                          {currentVal > investedVal && <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />}
                          {currentVal < investedVal && <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />}
                          <span>{formatINR(currentVal)}</span>
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                          Cost: {formatINR(investedVal)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          className={`text-xs sm:text-sm md:text-base font-extrabold tabular-nums flex items-center justify-end gap-0.5 whitespace-nowrap ${
                            isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                          title={formatINR(pnl)}
                        >
                          {isProfit ? '+' : ''}
                          {formatINR(pnl)}
                        </div>
                        <div
                          className={`text-[10px] sm:text-[11px] font-semibold tabular-nums whitespace-nowrap ${
                            isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isProfit ? '+' : ''}
                          {pnlPercent.toFixed(2)}%
                        </div>
                      </>
                    )}
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </div>
            );
          })
        )}

        {processedHoldings.length > visibleHoldingsCount && (
          <div className="text-center pt-3 pb-1">
            <button
              type="button"
              onClick={() => setVisibleHoldingsCount((prev) => prev + 50)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              Load More Holdings ({visibleHoldingsCount} of {processedHoldings.length})
            </button>
          </div>
        )}
      </div>
    </div>
  )}

      {/* Quick Customize Investment Cards Shortcut */}
      <div className="pt-6 pb-16 mb-8 flex justify-center" style={{ order: 99 }}>
        <button
          type="button"
          onClick={() => openSettingsTab('customize')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200/50 dark:border-slate-700/50 shadow-2xs"
        >
          <Sliders className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Customize Investment Cards in Settings</span>
        </button>
      </div>

      {/* Holding Modal for Add/Edit */}
      <HoldingModal
        isOpen={isHoldingModalOpen}
        initialHolding={editingHolding}
        defaultAssetType={targetDefaultAssetType}
        onClose={() => {
          setIsHoldingModalOpen(false);
          setEditingHolding(null);
        }}
      />

      {/* Investment Action Modal (Buy / Sell / Split / Bonus / Dividend) */}
      {actionModalHolding && (
        <InvestmentActionModal
          holding={actionModalHolding}
          action={actionType}
          isOpen={Boolean(actionModalHolding)}
          onClose={() => setActionModalHolding(null)}
        />
      )}

      {/* 1-Day Change Breakdown & Last Day Value Modal */}
      <DayChangeInfoModal
        isOpen={isDayChangeModalOpen}
        onClose={() => {
          setIsDayChangeModalOpen(false);
          setDayChangeModalHolding(null);
        }}
        portfolioDayPerf={portfolioDayPerf}
        singleHolding={dayChangeModalHolding}
        onSelectHolding={(hId) => setSelectedHoldingId(hId)}
        categoryFilterLabel={
          activeFilter === 'all'
            ? 'Portfolio'
            : activeFilter === 'stock'
            ? 'Stocks'
            : activeFilter === 'mutual_fund'
            ? 'Mutual Funds'
            : bondsPfSubFilter === 'bond'
            ? 'Bonds'
            : bondsPfSubFilter === 'sgb'
            ? 'SGBs'
            : bondsPfSubFilter === 'pf'
            ? 'Provident Funds'
            : 'Bonds & PF'
        }
        onRefreshPrices={() => syncMarketPrices(true)}
        isRefreshing={isUpdatingNavs}
      />

      {/* Fund Verification Info Modal (Green or Blue Tick) */}
      <FundVerificationModal
        isOpen={Boolean(verificationModalHolding)}
        onClose={() => setVerificationModalHolding(null)}
        holding={verificationModalHolding}
        onEditHolding={(h) => {
          setEditingHolding(h);
          setIsHoldingModalOpen(true);
        }}
      />

      {/* Fund User Confirmation Required Modal (Yellow Badge) */}
      <FundConfirmationModal
        isOpen={Boolean(confirmationModalHolding)}
        onClose={() => setConfirmationModalHolding(null)}
        holding={confirmationModalHolding}
        onEditHolding={(h) => {
          setEditingHolding(h);
          setIsHoldingModalOpen(true);
        }}
      />

      {/* ========================================================= */}
      {/* 4. CONSOLIDATED CHRONOLOGICAL PORTFOLIO ACTIVITY MODAL   */}
      {/* ========================================================= */}
      {isAllActivityModalOpen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-150">
          <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col h-full overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 sm:px-8 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAllActivityModalOpen(false)}
                  className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    Investment Activity Ledger
                  </h2>
                  <p className="text-xs text-slate-400">
                    Chronological sequence of all investment transactions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAllActivityModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter and Sorting Controls Bar */}
            <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
              {/* Search & Sequence Sorting Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={activitySearchQuery}
                    onChange={(e) => setActivitySearchQuery(e.target.value)}
                    placeholder="Search by stock, MF, notes..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  {activitySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setActivitySearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Chronological Sequence Sorting Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>Sort:</span>
                  </span>

                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setActivitySortBy('date-desc')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
                        activitySortBy === 'date-desc'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Newest first (Chronological desc)"
                    >
                      <ArrowDown className="w-3 h-3" />
                      <span>Newest</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivitySortBy('date-asc')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
                        activitySortBy === 'date-asc'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Oldest first (Chronological asc)"
                    >
                      <ArrowUp className="w-3 h-3" />
                      <span>Oldest</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivitySortBy(activitySortBy === 'amount-desc' ? 'amount-asc' : 'amount-desc')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
                        activitySortBy === 'amount-desc' || activitySortBy === 'amount-asc'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>Amount</span>
                      {activitySortBy === 'amount-asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivitySortBy(activitySortBy === 'qty-desc' ? 'qty-asc' : 'qty-desc')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
                        activitySortBy === 'qty-desc' || activitySortBy === 'qty-asc'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>Units</span>
                      {activitySortBy === 'qty-asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Asset & Action Filter Chips */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-slate-400 font-semibold mr-0.5">Asset:</span>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'stock', label: 'Stocks' },
                    { id: 'mutual_fund', label: 'Mutual Funds' },
                    { id: 'bonds_pf', label: 'Bonds/PF' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setActivityAssetFilter(f.id as any)}
                      className={`px-2 py-0.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        activityAssetFilter === f.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-slate-400 font-semibold mr-0.5">Type:</span>
                  {availableActionFilters.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setActivityActionFilter(f.id as any)}
                      className={`px-2 py-0.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        activityActionFilter === f.id
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable Transactions List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
              {filteredSortedActivity.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <Clock className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-xs font-semibold">No transactions match your search or filter criteria.</p>
                  <p className="text-[11px]">Try clearing search filters to see all recorded trades.</p>
                </div>
              ) : (
                displayedActivity.map(({ tx, holding: h }) => {
                  const isBuy = tx.type === 'buy';
                  const isSell = tx.type === 'sell';
                  const isDiv = tx.type === 'dividend';
                  const isDemerger = tx.type === 'demerger';
                  const isSplit = tx.type === 'split';
                  const isBonus = tx.type === 'bonus';

                  const badgeColor = isBuy
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : isSell
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : isDiv
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';

                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shrink-0 mt-0.5 shadow-2xs"
                          style={{
                            backgroundColor:
                              h.assetType === 'stock'
                                ? '#2563eb'
                                : h.assetType === 'mutual_fund'
                                ? '#059669'
                                : '#d97706',
                          }}
                        >
                          {h.symbol.substring(0, 2).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {h.symbol}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${badgeColor}`}>
                              {tx.type}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium tabular-nums">
                              {formatDate(tx.date)}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {h.customDisplayName || h.name}
                          </p>

                          {tx.notes && (
                            <p className="text-[11px] text-slate-400 italic mt-0.5 line-clamp-1">
                              {tx.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                        <div className="text-left sm:text-right">
                          <div className="text-xs sm:text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                            {isDemerger || isSplit || isBonus ? (
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                {isDemerger ? `Demerged (${tx.demergerRatio || 'Spinoff'})` : tx.type.toUpperCase()}
                              </span>
                            ) : (
                              formatINR(tx.totalAmount || ((tx.quantity || 0) * (tx.price || 0)))
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 tabular-nums">
                            {isDiv
                              ? 'Dividend payout'
                              : `${formatNumber(tx.quantity)} ${h.assetType === 'stock' ? 'shares' : 'units'} @ ${formatINR(tx.price)}`}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHoldingId(h.id);
                              setIsAllActivityModalOpen(false);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                            title="Open holding details"
                          >
                            Holding
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActivityTxToDelete({
                                holdingId: h.id,
                                txId: tx.id,
                                holdingSymbol: h.symbol,
                                txDate: tx.date,
                                amount: tx.totalAmount || ((tx.quantity || 0) * (tx.price || 0)),
                                type: tx.type,
                              })
                            }
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                            title="Delete transaction and linked expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {filteredSortedActivity.length > visibleActivityCount && (
                <div className="text-center pt-2 pb-1">
                  <button
                    type="button"
                    onClick={() => setVisibleActivityCount((prev) => prev + 50)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    Load More Activity ({visibleActivityCount} of {filteredSortedActivity.length})
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 font-medium">
                Total {filteredSortedActivity.length} transactions shown
              </span>
              <button
                type="button"
                onClick={() => setIsAllActivityModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold hover:opacity-90 cursor-pointer transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmatory Deletion Modal for Activity Ledger */}
      {activityTxToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Transaction?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to delete this <strong className="font-semibold text-slate-800 dark:text-slate-200">{activityTxToDelete.type.toUpperCase()}</strong> transaction for {activityTxToDelete.holdingSymbol} on {formatDate(activityTxToDelete.txDate)}?
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 font-medium">
                Linked passbook expense/record will also be deleted and account balances recalculated.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActivityTxToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteHoldingTransaction(activityTxToDelete.holdingId, activityTxToDelete.txId);
                  setActivityTxToDelete(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
