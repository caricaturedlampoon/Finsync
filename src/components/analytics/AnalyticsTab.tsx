import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Category, Transaction } from '../../types';
import { formatINR, parseDate, formatDate, toInputDate } from '../../utils/formatters';
import { CategoryDrilldown } from './CategoryDrilldown';
import { navigationManager } from '../../navigation/navigationManager';
import { SummaryHighlightCard, DashboardTimeline } from '../dashboard/SummaryHighlightCard';
import {
  PieChart as PieIcon,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Layers,
  ChevronRight,
  ChevronLeft,
  Award,
  CreditCard,
  Percent,
  LineChart as LineChartIcon,
  RotateCcw,
  BarChart3,
  Flame,
  Sparkles,
  Share2,
  Download,
  Wallet,
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
  BarChart,
  Bar,
  ComposedChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';

import { useRegisterSubscreen } from '../../navigation/NavigationContext';

export type AnalyticsTimeline = 'week' | 'month' | 'year' | 'all' | 'custom';

export const AnalyticsTab: React.FC = () => {
  const { transactions, categories, settings, openSettingsTab, openAnalysisExportModal, openAllTransactionsFiltered, drilldownCategory, setDrilldownCategory } = useApp();

  const DEFAULT_ANALYTICS_CARDS = [
    { id: 'cashflow_summary', name: 'Cashflow Summary Card', visible: true, order: 1 },
    { id: 'spend_income_toggle', name: 'Spend vs Income Toggle & Header', visible: true, order: 2 },
    { id: 'category_breakdown', name: 'Category Breakdown & Treemap', visible: true, order: 3 },
    { id: 'day_wise_spending', name: 'Day-Wise Spending Curve', visible: true, order: 4 },
    { id: 'comparative_trend', name: 'Comparative Trend Analysis', visible: true, order: 5 },
    { id: 'six_month_comparison', name: '6-Month Income vs Expense', visible: true, order: 6 },
  ];

  const activeAnalyticsCards = useMemo(() => {
    const list = (settings?.analyticsCards && settings.analyticsCards.length > 0)
      ? [...settings.analyticsCards]
      : [...DEFAULT_ANALYTICS_CARDS];
    const seen = new Set<string>();
    return list
      .filter((c) => {
        if (!c || !c.id || seen.has(c.id)) return false;
        seen.add(c.id);
        return c.visible;
      })
      .sort((a, b) => a.order - b.order);
  }, [settings?.analyticsCards]);

  const [timeline, setTimeline] = useState<AnalyticsTimeline>('month');
  const [dateOffset, setDateOffset] = useState<number>(0);
  const [chartMode, setChartMode] = useState<'expense' | 'income'>('expense');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [dayWiseChartType, setDayWiseChartType] = useState<'bar' | 'line'>('bar');
  const [sixMonthViewMode, setSixMonthViewMode] = useState<'both' | 'income' | 'expense'>('both');
  const [sixMonthChartType, setSixMonthChartType] = useState<'bar' | 'line'>('bar');

  const getCardOrder = (cardId: string) => {
    const c = (settings?.analyticsCards || []).find((sc) => sc.id === cardId);
    return c ? c.order : 1;
  };

  // Register Category Drilldown subscreen with dynamic stack
  useRegisterSubscreen(
    !!drilldownCategory,
    `category_${drilldownCategory?.id}`,
    drilldownCategory ? `Category: ${drilldownCategory.name}` : 'Category Drilldown',
    () => {
      setDrilldownCategory(null);
    }
  );

  // Compute Current and Previous Period Date Boundaries with dateOffset support
  const { currentPeriodTxs, prevPeriodTxs, periodLabel, prevPeriodLabel, isCurrent, canNext } = useMemo(() => {
    const now = new Date();
    let curStart = new Date();
    let curEnd = new Date();
    let prevStart = new Date();
    let prevEnd = new Date();
    let pLabel = 'This Month';
    let prevLabel = 'Previous Month';
    let current = true;
    let allowedNext = false;

    if (timeline === 'week') {
      const endOffsetDays = dateOffset * 7;
      const startOffsetDays = endOffsetDays - 6;

      curEnd = new Date(now.getTime() + endOffsetDays * 24 * 60 * 60 * 1000);
      curEnd.setHours(23, 59, 59, 999);
      curStart = new Date(now.getTime() + startOffsetDays * 24 * 60 * 60 * 1000);
      curStart.setHours(0, 0, 0, 0);

      prevEnd = new Date(curStart.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
      prevStart.setHours(0, 0, 0, 0);

      pLabel = `${formatDate(curStart)} – ${formatDate(curEnd)}`;
      prevLabel = `${formatDate(prevStart)} – ${formatDate(prevEnd)}`;
      current = dateOffset === 0;
      allowedNext = dateOffset < 0;
    } else if (timeline === 'month') {
      const targetYear = now.getFullYear();
      const targetMonth = now.getMonth() + dateOffset;
      const refDate = new Date(targetYear, targetMonth, 1);

      curStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1, 0, 0, 0);
      curEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59);

      prevStart = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1, 0, 0, 0);
      prevEnd = new Date(refDate.getFullYear(), refDate.getMonth(), 0, 23, 59, 59);

      pLabel = refDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      prevLabel = prevStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      current = dateOffset === 0;
      allowedNext = dateOffset < 0;
    } else if (timeline === 'year') {
      const refYear = now.getFullYear() + dateOffset;
      curStart = new Date(refYear, 0, 1, 0, 0, 0);
      curEnd = new Date(refYear, 11, 31, 23, 59, 59);

      prevStart = new Date(refYear - 1, 0, 1, 0, 0, 0);
      prevEnd = new Date(refYear - 1, 11, 31, 23, 59, 59);

      pLabel = `Year ${refYear}`;
      prevLabel = `Year ${refYear - 1}`;
      current = dateOffset === 0;
      allowedNext = dateOffset < 0;
    } else if (timeline === 'all') {
      curStart = new Date(0);
      curEnd = new Date(8640000000000000);
      prevStart = new Date(0);
      prevEnd = new Date(0);
      pLabel = 'All Time';
      prevLabel = '';
      current = true;
      allowedNext = false;
    } else if (timeline === 'custom') {
      if (customStartDate && customEndDate) {
        curStart = parseDate(customStartDate);
        curEnd = parseDate(customEndDate);
        curEnd.setHours(23, 59, 59);

        const diffDays = Math.max(1, Math.round((curEnd.getTime() - curStart.getTime()) / (1000 * 60 * 60 * 24)));
        prevEnd = new Date(curStart);
        prevEnd.setDate(prevEnd.getDate() - 1);
        prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - diffDays);
        pLabel = `${formatDate(curStart)} – ${formatDate(curEnd)}`;
        prevLabel = 'Previous Period';
      }
      current = true;
      allowedNext = false;
    }

    const curStartStr = toInputDate(curStart);
    const curEndStr = toInputDate(curEnd);
    const prevStartStr = toInputDate(prevStart);
    const prevEndStr = toInputDate(prevEnd);

    const curTxs: Transaction[] = [];
    const pTxs: Transaction[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const d = tx.date;
      if (d >= curStartStr && d <= curEndStr) {
        curTxs.push(tx);
      } else if (d >= prevStartStr && d <= prevEndStr) {
        pTxs.push(tx);
      }
    }

    return {
      currentPeriodTxs: curTxs,
      prevPeriodTxs: pTxs,
      periodLabel: pLabel,
      prevPeriodLabel: prevLabel,
      isCurrent: current,
      canNext: allowedNext,
      curStartStr,
      curEndStr,
    };
  }, [transactions, timeline, dateOffset, customStartDate, customEndDate]);

  const handlePrev = () => setDateOffset((prev) => prev - 1);
  const handleNext = () => setDateOffset((prev) => Math.min(0, prev + 1));
  const handleResetCurrent = () => setDateOffset(0);

  const { totalSpending, totalIncome } = useMemo(() => {
    let spend = 0;
    let income = 0;
    currentPeriodTxs.forEach((tx) => {
      if (tx.isBalanceAdjustment) return;
      if (tx.type === 'expense') spend += tx.amount;
      else if (tx.type === 'income') income += tx.amount;
    });
    return { totalSpending: spend, totalIncome: income };
  }, [currentPeriodTxs]);

  // Aggregate Category Breakdown Data for Current Period
  const { categoryData, totalPeriodAmount, currentPeriodIncome, currentPeriodExpense } = useMemo(() => {
    let incomeSum = 0;
    let expenseSum = 0;
    const catSumMap: Record<string, { amount: number; count: number; name: string; color: string; id: string }> = {};

    currentPeriodTxs.forEach((tx) => {
      if (tx.isBalanceAdjustment) return;
      if (tx.type === 'income') incomeSum += tx.amount;
      if (tx.type === 'expense') {
        expenseSum += tx.amount;
        if (chartMode === 'expense') {
          const catKey = tx.categoryId || 'uncategorized';
          if (!catSumMap[catKey]) {
            const c = tx.categoryId ? categories.find((cat) => cat.id === tx.categoryId) : undefined;
            catSumMap[catKey] = {
              id: catKey,
              name: tx.categoryName || c?.name || 'General',
              amount: 0,
              count: 0,
              color: c?.color || '#059669',
            };
          }
          catSumMap[catKey].amount += tx.amount;
          catSumMap[catKey].count += 1;
        }
      } else if (chartMode === 'income' && tx.type === 'income') {
        const catKey = tx.categoryId || 'uncategorized';
        if (!catSumMap[catKey]) {
          const c = tx.categoryId ? categories.find((cat) => cat.id === tx.categoryId) : undefined;
          catSumMap[catKey] = {
            id: catKey,
            name: tx.categoryName || c?.name || 'General',
            amount: 0,
            count: 0,
            color: c?.color || '#10b981',
          };
        }
        catSumMap[catKey].amount += tx.amount;
        catSumMap[catKey].count += 1;
      }
    });

    const sortedList = Object.values(catSumMap).sort((a, b) => b.amount - a.amount);
    const total = chartMode === 'expense' ? expenseSum : incomeSum;

    return {
      categoryData: sortedList,
      totalPeriodAmount: total,
      currentPeriodIncome: incomeSum,
      currentPeriodExpense: expenseSum,
    };
  }, [currentPeriodTxs, categories, chartMode]);

  const prevPeriodTotal = useMemo(() => {
    let sum = 0;
    prevPeriodTxs.forEach((tx) => {
      if (tx.isBalanceAdjustment) return;
      if (tx.type === chartMode) sum += tx.amount;
    });
    return sum;
  }, [prevPeriodTxs, chartMode]);

  const diffAmount = totalPeriodAmount - prevPeriodTotal;
  const percentChange = prevPeriodTotal > 0 ? (diffAmount / prevPeriodTotal) * 100 : 0;

  const comparativeTrendData = useMemo(() => {
    if (timeline === 'year') {
      const curSums = new Array(12).fill(0);
      const prevSums = new Array(12).fill(0);

      for (let i = 0; i < currentPeriodTxs.length; i++) {
        const tx = currentPeriodTxs[i];
        if (tx.isBalanceAdjustment || tx.type !== chartMode) continue;
        const m = parseInt(tx.date.substring(5, 7), 10) - 1;
        if (m >= 0 && m < 12) curSums[m] += tx.amount;
      }

      for (let i = 0; i < prevPeriodTxs.length; i++) {
        const tx = prevPeriodTxs[i];
        if (tx.isBalanceAdjustment || tx.type !== chartMode) continue;
        const m = parseInt(tx.date.substring(5, 7), 10) - 1;
        if (m >= 0 && m < 12) prevSums[m] += tx.amount;
      }

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return monthNames.map((mName, mIdx) => ({
        label: mName,
        current: curSums[mIdx],
        previous: prevSums[mIdx],
      }));
    } else if (timeline === 'week') {
      const curMap = new Array(7).fill(0);
      const prevMap = new Array(7).fill(0);

      const now = new Date();
      const endOffsetDays = dateOffset * 7;
      const startOffsetDays = endOffsetDays - 6;
      const curStart = new Date(now.getTime() + startOffsetDays * 24 * 60 * 60 * 1000);
      curStart.setHours(0, 0, 0, 0);

      const prevStart = new Date(curStart.getTime() - 7 * 24 * 60 * 60 * 1000);

      for (let i = 0; i < currentPeriodTxs.length; i++) {
        const tx = currentPeriodTxs[i];
        if (tx.isBalanceAdjustment || tx.type !== chartMode) continue;
        const diffDays = Math.floor((parseDate(tx.date).getTime() - curStart.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) curMap[diffDays] += tx.amount;
      }

      for (let i = 0; i < prevPeriodTxs.length; i++) {
        const tx = prevPeriodTxs[i];
        if (tx.isBalanceAdjustment || tx.type !== chartMode) continue;
        const diffDays = Math.floor((parseDate(tx.date).getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) prevMap[diffDays] += tx.amount;
      }

      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return dayNames.map((dName, dIdx) => ({
        label: dName,
        current: curMap[dIdx],
        previous: prevMap[dIdx],
      }));
    } else {
      const curMap = new Array(31).fill(0);
      const prevMap = new Array(31).fill(0);

      for (let i = 0; i < currentPeriodTxs.length; i++) {
        const tx = currentPeriodTxs[i];
        if (tx.isBalanceAdjustment || tx.type !== chartMode) continue;
        const dayNum = parseInt(tx.date.substring(8, 10), 10) - 1;
        if (dayNum >= 0 && dayNum < 31) curMap[dayNum] += tx.amount;
      }

      for (let i = 0; i < prevPeriodTxs.length; i++) {
        const tx = prevPeriodTxs[i];
        if (tx.isBalanceAdjustment || tx.type !== chartMode) continue;
        const dayNum = parseInt(tx.date.substring(8, 10), 10) - 1;
        if (dayNum >= 0 && dayNum < 31) prevMap[dayNum] += tx.amount;
      }

      return curMap.map((val, idx) => ({
        label: `Day ${idx + 1}`,
        current: val,
        previous: prevMap[idx],
      }));
    }
  }, [currentPeriodTxs, prevPeriodTxs, timeline, chartMode, dateOffset]);

  const dayWiseSpendAnalysis = useMemo(() => {
    const map: Record<string, number> = {};
    let maxSpend = 0;

    const expenseTxs = currentPeriodTxs.filter((tx) => tx.type === 'expense' && !tx.isBalanceAdjustment);

    if (timeline === 'year' || timeline === 'all') {
      expenseTxs.forEach((tx) => {
        const dObj = parseDate(tx.date);
        const key = timeline === 'year'
          ? dObj.toLocaleDateString('en-IN', { month: 'short' })
          : dObj.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        map[key] = (map[key] || 0) + tx.amount;
      });

      const dayWiseSpendData = Object.entries(map).map(([keyLabel, amount]) => {
        if (amount > maxSpend) maxSpend = amount;
        return {
          date: keyLabel,
          label: keyLabel,
          weekday: '',
          amount: Math.round(amount),
          isPeak: false,
        };
      });

      const peakItem = dayWiseSpendData.find((d) => d.amount === maxSpend);
      if (peakItem) peakItem.isPeak = true;

      return {
        dayWiseSpendData,
        peakSpendDay: peakItem ? { label: peakItem.label, amount: peakItem.amount } : null,
      };
    }

    expenseTxs.forEach((tx) => {
      const dStr = tx.date;
      map[dStr] = (map[dStr] || 0) + tx.amount;
    });

    const dayWiseSpendData = Object.entries(map)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([dateStr, amount]) => {
        if (amount > maxSpend) maxSpend = amount;
        const dObj = parseDate(dateStr);
        return {
          date: dateStr,
          label: dObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          weekday: dObj.toLocaleDateString('en-IN', { weekday: 'short' }),
          amount: Math.round(amount),
          isPeak: false,
        };
      });

    const peakItem = dayWiseSpendData.find((d) => d.amount === maxSpend);
    if (peakItem) peakItem.isPeak = true;

    return {
      dayWiseSpendData,
      peakSpendDay: peakItem ? { label: peakItem.label, amount: peakItem.amount } : null,
    };
  }, [currentPeriodTxs, timeline]);

  const sixMonthFlowData = useMemo(() => {
    const now = new Date();
    const months: Array<{ fullMonth: string; monthLabel: string; income: number; expense: number; surplus: number; savingsRate: number }> = [];
    let totalIncome6M = 0;
    let totalExpense6M = 0;
    let peakInc = -1;
    let peakExp = -1;
    let peakIncObj: any = null;
    let peakExpObj: any = null;

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      let inc = 0;
      let exp = 0;

      transactions.forEach((tx) => {
        if (tx.isBalanceAdjustment) return;
        if (tx.date >= startStr && tx.date <= endStr) {
          if (tx.type === 'income') inc += tx.amount;
          if (tx.type === 'expense') exp += tx.amount;
        }
      });

      const surplus = inc - exp;
      const savingsRate = inc > 0 ? (surplus / inc) * 100 : 0;
      totalIncome6M += inc;
      totalExpense6M += exp;

      const fullMonth = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const monthLabel = d.toLocaleDateString('en-IN', { month: 'short' });

      if (inc > peakInc) {
        peakInc = inc;
        peakIncObj = { monthLabel, income: inc };
      }
      if (exp > peakExp) {
        peakExp = exp;
        peakExpObj = { monthLabel, expense: exp };
      }

      months.push({ fullMonth, monthLabel, income: inc, expense: exp, surplus, savingsRate });
    }

    const netSurplus6M = totalIncome6M - totalExpense6M;
    const overallSavingsRate = totalIncome6M > 0 ? (netSurplus6M / totalIncome6M) * 100 : 0;

    return {
      months,
      totalIncome6M,
      totalExpense6M,
      netSurplus6M,
      overallSavingsRate,
      avgMonthlyIncome: totalIncome6M / 6,
      avgMonthlyExpense: totalExpense6M / 6,
      peakIncomeMonth: peakIncObj,
      peakExpenseMonth: peakExpObj,
    };
  }, [transactions]);

  const summaryStats = useMemo(() => {
    const validExpenseTxs = currentPeriodTxs.filter((tx) => tx.type === 'expense' && !tx.isBalanceAdjustment);
    let highestExp = 0;
    validExpenseTxs.forEach((tx) => {
      if (tx.amount > highestExp) highestExp = tx.amount;
    });

    const txCount = currentPeriodTxs.filter((tx) => !tx.isBalanceAdjustment).length;
    let daysCount = timeline === 'week' ? 7 : timeline === 'month' ? 30 : timeline === 'year' ? 365 : 30;
    if (timeline === 'all') {
      if (currentPeriodTxs.length > 0) {
        const sorted = [...currentPeriodTxs].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
        const earliest = parseDate(sorted[0].date).getTime();
        daysCount = Math.max(1, Math.round((Date.now() - earliest) / (1000 * 60 * 60 * 24)));
      } else {
        daysCount = 1;
      }
    }
    const dailyAvg = currentPeriodExpense / daysCount;

    const topCat = categoryData[0];
    const savingsSurplus = currentPeriodIncome - currentPeriodExpense;
    const savingsSurplusRate = currentPeriodIncome > 0 ? (savingsSurplus / currentPeriodIncome) * 100 : 0;

    return {
      dailyAverage: dailyAvg,
      highestExpense: highestExp,
      txCount,
      topCategoryName: topCat?.name || 'N/A',
      topCategoryAmount: topCat?.amount || 0,
      savingsSurplus,
      savingsSurplusRate,
    };
  }, [currentPeriodTxs, currentPeriodExpense, currentPeriodIncome, categoryData, timeline]);

  useRegisterSubscreen(
    !!drilldownCategory,
    `category_drilldown_${drilldownCategory?.id}`,
    drilldownCategory ? `Category: ${drilldownCategory.name}` : 'Category Drilldown',
    () => setDrilldownCategory(null),
    {
      parentScreenKey: 'analytics',
    }
  );

  const renderAnalyticsCard = (cardId: string) => {
    switch (cardId) {
      case 'cashflow_summary':
        return (
          <SummaryHighlightCard
            key="cashflow_summary"
            totalSpending={totalSpending}
            totalIncome={totalIncome}
            periodLabel={periodLabel}
            timeline={timeline === 'custom' ? 'month' : (timeline as DashboardTimeline)}
            setTimeline={(t) => {
              setTimeline(t);
              setDateOffset(0);
            }}
            onPrev={handlePrev}
            onNext={handleNext}
            canNext={canNext}
            onResetCurrent={handleResetCurrent}
            isCurrent={isCurrent}
            onOpenCustomFilter={() => setTimeline('custom')}
            onOpenExport={openAnalysisExportModal}
            onFilterExpenses={() => openAllTransactionsFiltered('expense', timeline)}
            onFilterIncome={() => openAllTransactionsFiltered('income', timeline)}
          />
        );

      case 'spend_income_toggle':
        return (
          <div key="spend_income_toggle" className="space-y-4">
            {timeline === 'custom' && (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">From:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">To:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                <button
                  onClick={() => setChartMode('expense')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                    chartMode === 'expense'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Spend Analysis</span>
                </button>
                <button
                  onClick={() => setChartMode('income')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                    chartMode === 'income'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Income Analysis</span>
                </button>
              </div>

              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {periodLabel}
              </span>
            </div>
          </div>
        );

      case 'day_wise_spending':
        return (
          <div key="day_wise_spending" className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Day-Wise Trends of Spends</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {dayWiseSpendAnalysis.dayWiseSpendData.length} Days Active
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Daily cash outflows with peak spending highlights for {periodLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                {dayWiseSpendAnalysis.peakSpendDay && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-300">
                    <Flame className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                    <span>Peak: {dayWiseSpendAnalysis.peakSpendDay.label} (₹{formatINR(dayWiseSpendAnalysis.peakSpendDay.amount)})</span>
                  </div>
                )}

                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setDayWiseChartType('bar')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      dayWiseChartType === 'bar'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Bar Chart"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDayWiseChartType('line')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      dayWiseChartType === 'line'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Line Chart"
                  >
                    <LineChartIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {dayWiseSpendAnalysis.dayWiseSpendData.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <Calendar className="w-7 h-7 mx-auto mb-1.5 opacity-40" />
                <p className="text-xs font-semibold">No daily expense outflows recorded for {periodLabel}.</p>
              </div>
            ) : (
              <div className="h-60 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  {dayWiseChartType === 'bar' ? (
                    <BarChart data={dayWiseSpendAnalysis.dayWiseSpendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip
                        cursor={false}
                        formatter={(val: any) => [`₹${formatINR(Number(val))}`, 'Daily Spent']}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc', fontSize: '12px' }}
                      />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                        {dayWiseSpendAnalysis.dayWiseSpendData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.isPeak ? '#f97316' : '#f43f5e'} fillOpacity={entry.isPeak ? 1 : 0.88} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <LineChart data={dayWiseSpendAnalysis.dayWiseSpendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip
                        cursor={false}
                        formatter={(val: any) => [`₹${formatINR(Number(val))}`, 'Daily Outflow']}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc', fontSize: '12px' }}
                      />
                      <Line type="monotone" dataKey="amount" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4, fill: '#f43f5e' }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );

      case 'category_breakdown':
        return (
          <div key="category_breakdown" className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  {chartMode === 'expense' ? 'Total Expenditure' : 'Total Revenue'}
                </span>
                <div className={`text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight mt-0.5 ${chartMode === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatINR(totalPeriodAmount)}
                </div>
              </div>
              <span className="text-xs text-slate-400">Tap any category to drill down</span>
            </div>
            {categoryData.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <PieIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">No {chartMode} transactions found for {periodLabel}.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="amount"
                        onClick={(entry) => setDrilldownCategory(categories.find((c) => c.id === entry.id) || null)}
                        cursor="pointer"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        cursor={false}
                        formatter={(value: number) => [formatINR(value), 'Total']}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {categoryData.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setDrilldownCategory(categories.find((c) => c.id === item.id) || null)}
                      className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 border border-slate-100 dark:border-slate-800 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-400">{item.count} transactions</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">{formatINR(item.amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'comparative_trend':
        return (
          <div key="comparative_trend" className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <LineChartIcon className="w-4 h-4 text-emerald-600" />
                <span>Comparative Trend Line Chart</span>
              </h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparativeTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="current" stroke={chartMode === 'expense' ? '#f43f5e' : '#06b6d4'} strokeWidth={2.5} />
                  <Line type="monotone" dataKey="previous" stroke="#f97316" strokeWidth={2} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'six_month_comparison':
        return (
          <div key="six_month_comparison" className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <span>Trailing 6-Month Inflow vs Outflow Flow</span>
            </h3>
            <div className="h-60 sm:h-64 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sixMonthFlowData.months} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="monthLabel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${formatINR(Number(val))}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }} />
                  <Bar dataKey="income" fill="#10b981" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="expense" fill="#f43f5e" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (drilldownCategory) {
    return (
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-2 pb-safe pb-36 min-h-full">
        <CategoryDrilldown
          category={drilldownCategory}
          transactions={currentPeriodTxs}
          periodLabel={periodLabel}
          onBack={() => setDrilldownCategory(null)}
        />
      </div>
    );
  }

  return (
    <div
      id="analytics-main-container"
      className="space-y-6 pb-20"
      >
        {activeAnalyticsCards.map((card) => renderAnalyticsCard(card.id))}

        {/* Quick Customize Analytics Cards Shortcut */}
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={() => openSettingsTab('customize')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200/50 dark:border-slate-700/50 shadow-2xs"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Customize Analytics Cards in Settings</span>
          </button>
        </div>
      </div>
  );
};
