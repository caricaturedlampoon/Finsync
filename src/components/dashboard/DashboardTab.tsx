import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Debt } from '../../types';
import { formatINR, formatDate, parseDate, toInputDate, getDebtContactSummary, adjustHexColor, isColorLight } from '../../utils/formatters';
import { SummaryHighlightCard, DashboardTimeline } from './SummaryHighlightCard';
import { NetLiquidWealthCard } from './NetLiquidWealthCard';
import { IconRenderer } from '../common/IconRenderer';
import { AccountAvatar } from '../common/AccountAvatar';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronRight,
  TrendingUp,
  Landmark,
  Plus,
  Sliders,
  Coins,
  ArrowDownLeft,
  Users,
  CalendarClock,
  Search,
} from 'lucide-react';

export const DashboardTab: React.FC = () => {
  const {
    transactions,
    accounts,
    holdings,
    categories,
    debts,
    groups,
    settings,
    getHoldingMarketPrice,
    setSelectedAccountId,
    setSelectedDebtId,
    setIsDebtsModalOpen,
    setInitialDebtCategoryTab,
    setActiveTab,
    openSettingsTab,
    setIsAllTransactionsModalOpen,
    openAllTransactionsFiltered,
    setIsRecurringModalOpen,
    upcoming24hRecurring,
    isFeatureUnlocked,
    openTransactionModal,
    setIsSearchModalOpen,
  } = useApp();

  const [timeline, setTimeline] = useState<DashboardTimeline>('month');
  const [dateOffset, setDateOffset] = useState<number>(0);

  // Compute Active Period Date Boundaries and Labels based on timeline + dateOffset
  const { filteredTransactions, periodLabel, isCurrent, canNext, totalSpending, totalIncome } = useMemo(() => {
    const now = new Date();
    let curStart = new Date(0);
    let curEnd = new Date(8640000000000000);
    let pLabel = 'All Time';
    let current = true;
    let allowedNext = false;

    if (timeline === 'month') {
      const targetYear = now.getFullYear();
      const targetMonth = now.getMonth() + dateOffset;
      const refDate = new Date(targetYear, targetMonth, 1);

      curStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1, 0, 0, 0);
      curEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59);

      pLabel = refDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      current = dateOffset === 0;
      allowedNext = dateOffset < 0; // can advance up to current month
    } else if (timeline === 'year') {
      const refYear = now.getFullYear() + dateOffset;
      curStart = new Date(refYear, 0, 1, 0, 0, 0);
      curEnd = new Date(refYear, 11, 31, 23, 59, 59);

      pLabel = `Year ${refYear}`;
      current = dateOffset === 0;
      allowedNext = dateOffset < 0;
    } else if (timeline === 'week') {
      // 7-day window with offset
      const endOffsetDays = dateOffset * 7;
      const startOffsetDays = endOffsetDays - 6;

      const endDate = new Date(now.getTime() + endOffsetDays * 24 * 60 * 60 * 1000);
      endDate.setHours(23, 59, 59, 999);

      const startDate = new Date(now.getTime() + startOffsetDays * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);

      curStart = startDate;
      curEnd = endDate;

      pLabel = `${formatDate(startDate)} – ${formatDate(endDate)}`;
      current = dateOffset === 0;
      allowedNext = dateOffset < 0;
    } else if (timeline === 'all') {
      pLabel = 'All Time';
      current = true;
      allowedNext = false;
    }

    const startIso = timeline === 'all' ? '' : toInputDate(curStart);
    const endIso = timeline === 'all' ? '' : toInputDate(curEnd);

    const list = timeline === 'all'
      ? transactions
      : transactions.filter((tx) => tx.date >= startIso && tx.date <= endIso);

    let spending = 0;
    let income = 0;

    list.forEach((tx) => {
      // Rule: Manual balance adjustments MUST NOT be counted as Expense or Income in Dashboard totals
      if (tx.isBalanceAdjustment) return;

      if (tx.type === 'expense') {
        spending += tx.amount;
      } else if (tx.type === 'income') {
        income += tx.amount;
      }
    });

    return {
      filteredTransactions: list,
      periodLabel: pLabel,
      isCurrent: current,
      canNext: allowedNext,
      totalSpending: spending,
      totalIncome: income,
      startIso,
      endIso,
    };
  }, [transactions, timeline, dateOffset]);

  const handlePrev = () => setDateOffset((prev) => prev - 1);
  const handleNext = () => setDateOffset((prev) => Math.min(0, prev + 1));
  const handleResetCurrent = () => setDateOffset(0);

  // Investment Snapshot with Dynamic Online Automated Price Resolution
  const { totalInvested, totalCurrentVal, totalPnL } = useMemo(() => {
    let inv = 0;
    let cur = 0;
    holdings.forEach((h) => {
      const price = getHoldingMarketPrice(h).price;
      inv += h.quantity * h.averageBuyPrice;
      cur += h.quantity * price;
    });
    return {
      totalInvested: inv,
      totalCurrentVal: cur,
      totalPnL: cur - inv,
    };
  }, [holdings, getHoldingMarketPrice]);

  // Category Insights for this period (excluding balance adjustments)
  const topCategories = useMemo(() => {
    const catMap: Record<string, { name: string; amount: number; color: string }> = {};
    filteredTransactions
      .filter((tx) => tx.type === 'expense' && !tx.isBalanceAdjustment)
      .forEach((tx) => {
        const catKey = tx.categoryId || 'uncategorized';
        if (!catMap[catKey]) {
          const c = tx.categoryId ? categories.find((cat) => cat.id === tx.categoryId) : undefined;
          catMap[catKey] = {
            name: tx.categoryName || c?.name || 'General',
            amount: 0,
            color: c?.color || '#059669',
          };
        }
        catMap[catKey].amount += tx.amount;
      });

    return Object.values(catMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [filteredTransactions, categories]);

  // Dynamic Unsettled Debts Summary with O(N+M) Map lookup
  const { totalLent, totalBorrowed, unsettledDebts } = useMemo(() => {
    let lent = 0;
    let borrowed = 0;
    const list: Array<{ debt: Debt; netBalance: number; status: 'owes_you' | 'you_owe' | 'settled' }> = [];

    // Pre-group transactions by debtId for instant O(1) lookup per debt
    const txByDebt = new Map<string, typeof transactions>();
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (tx.debtId) {
        let arr = txByDebt.get(tx.debtId);
        if (!arr) {
          arr = [];
          txByDebt.set(tx.debtId, arr);
        }
        arr.push(tx);
      }
    }

    debts.forEach((d) => {
      const summary = getDebtContactSummary(d, transactions, txByDebt.get(d.id));
      if (summary.status === 'owes_you') {
        lent += summary.netBalance;
        list.push({ debt: d, netBalance: summary.netBalance, status: summary.status });
      } else if (summary.status === 'you_owe') {
        borrowed += Math.abs(summary.netBalance);
        list.push({ debt: d, netBalance: Math.abs(summary.netBalance), status: summary.status });
      }
    });

    return { totalLent: lent, totalBorrowed: borrowed, unsettledDebts: list };
  }, [debts, transactions]);

  // Sort dashboard widgets by user defined order and filter visible + unlocked
  const activeWidgets = useMemo(() => {
    const widgets = settings.dashboardWidgets || [];
    const seen = new Set<string>();
    return [...widgets]
      .filter((w) => {
        if (!w || !w.id || seen.has(w.id)) return false;
        seen.add(w.id);
        if (!w.visible) return false;
        if (w.id === 'accounts_strip' && !isFeatureUnlocked('accounts')) return false;
        if (w.id === 'investment_highlights' && !isFeatureUnlocked('investments')) return false;
        if (w.id === 'category_insight' && !isFeatureUnlocked('analytics')) return false;
        if (w.id === 'debts_card' && !isFeatureUnlocked('debts')) return false;
        if (w.id === 'recent_transactions' && !isFeatureUnlocked('expense_entry')) return false;
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }, [settings.dashboardWidgets, isFeatureUnlocked]);

  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case 'summary_highlight':
        return (
          <SummaryHighlightCard
            key="summary_highlight"
            totalSpending={totalSpending}
            totalIncome={totalIncome}
            periodLabel={periodLabel}
            timeline={timeline}
            setTimeline={(t) => {
              setTimeline(t);
              setDateOffset(0);
            }}
            onPrev={handlePrev}
            onNext={handleNext}
            canNext={canNext}
            onResetCurrent={handleResetCurrent}
            isCurrent={isCurrent}
            onFilterExpenses={() => openAllTransactionsFiltered('expense', timeline)}
            onFilterIncome={() => openAllTransactionsFiltered('income', timeline)}
          />
        );

      case 'net_liquid_wealth':
        return <NetLiquidWealthCard key="net_liquid_wealth" />;

      case 'accounts_strip':
        return (
          <div
            key="accounts_strip"
            className="p-4 sm:p-5 md:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3.5 gap-2 min-w-0">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  Bank Accounts & Passbooks
                </h3>
                <p className="text-[11px] text-slate-400 truncate">Tap an account to open its chronological passbook</p>
              </div>
              <button
                onClick={() => setActiveTab('accounts')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
              >
                <span>All Accounts</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {[...accounts]
                .filter((acc) => !acc.isArchived)
                .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
                .slice(0, 4)
                .map((acc) => {
                  const accountColor = acc.color || (acc.type === 'credit' ? '#4f46e5' : '#059669');
                  const darkerColor = adjustHexColor(accountColor, -24);
                  const isLight = isColorLight(accountColor);
                  const textColorClass = isLight ? 'text-slate-900' : 'text-white';
                  const monoBadgeClass = isLight
                    ? 'bg-black/10 text-slate-800 border-black/15'
                    : 'bg-white/20 text-white border-white/25';

                  return (
                    <div
                      key={acc.id}
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setActiveTab('accounts');
                      }}
                      style={{
                        background: `linear-gradient(135deg, ${accountColor} 0%, ${darkerColor} 100%)`,
                        boxShadow: `0 10px 24px -6px ${accountColor}45, 0 4px 10px -2px ${accountColor}25`,
                      }}
                      className={`relative p-3 sm:p-3.5 rounded-2xl border border-white/25 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between overflow-hidden min-w-0 active:scale-[0.99] group ${textColorClass}`}
                    >
                      {/* Decorative specular passbook highlights */}
                      <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-white/15 blur-xl pointer-events-none" />
                      <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-black/15 blur-xl pointer-events-none" />
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />

                      <div className="flex items-center justify-between gap-1 min-w-0 relative z-10">
                        <AccountAvatar account={acc} size="sm" className="rounded-xl shrink-0 ring-1 ring-white/60 shadow-xs" />
                        {acc.accountNumber && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md border shrink-0 tabular-nums ${monoBadgeClass}`}>
                            ...{acc.accountNumber}
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5 min-w-0 relative z-10">
                        <span className={`text-xs font-bold truncate block drop-shadow-xs ${textColorClass}`}>
                          {acc.name}
                        </span>
                        <span
                          className={`text-xs sm:text-sm font-extrabold tabular-nums block mt-0.5 truncate drop-shadow-xs ${textColorClass}`}
                          title={
                            acc.type === 'credit'
                              ? `Available Limit: ₹${formatINR(Math.max(0, (acc.creditLimit || 0) + acc.balance))}`
                              : formatINR(acc.balance)
                          }
                        >
                          {acc.type === 'credit'
                            ? `Avail: ₹${formatINR(Math.max(0, (acc.creditLimit || 0) + acc.balance))}`
                            : formatINR(acc.balance)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        );

      case 'investment_highlights':
        return (
          <div
            key="investment_highlights"
            onClick={() => setActiveTab('investments')}
            className="p-4 sm:p-5 md:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-emerald-500/40 transition-all overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3 gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  Investments & Assets Snapshot
                </h3>
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0 whitespace-nowrap">
                <span>View Portfolio</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 min-w-0">
              <div className="min-w-0 overflow-hidden">
                <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium truncate">Invested</span>
                <span
                  className="text-xs sm:text-sm md:text-base font-bold text-slate-800 dark:text-slate-200 tabular-nums truncate block mt-0.5"
                  title={formatINR(totalInvested)}
                >
                  {formatINR(totalInvested)}
                </span>
              </div>
              <div className="min-w-0 overflow-hidden">
                <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium truncate">Current Value</span>
                <span
                  className="text-xs sm:text-sm md:text-base font-extrabold text-slate-900 dark:text-white tabular-nums truncate block mt-0.5"
                  title={formatINR(totalCurrentVal)}
                >
                  {formatINR(totalCurrentVal)}
                </span>
              </div>
              <div className="min-w-0 overflow-hidden">
                <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium truncate">Unrealized P&L</span>
                <span
                  className={`text-xs sm:text-sm md:text-base font-extrabold tabular-nums block mt-0.5 truncate ${
                    totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                  title={`${totalPnL >= 0 ? '+' : ''}${formatINR(totalPnL)}`}
                >
                  {totalPnL >= 0 ? '+' : ''}
                  {formatINR(totalPnL)}
                </span>
              </div>
            </div>
          </div>
        );

      case 'recent_transactions': {
        const displayList = (filteredTransactions.length > 0 ? filteredTransactions : transactions).slice(0, 4);

        return (
          <div
            key="recent_transactions"
            className="p-4 sm:p-5 md:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3.5 gap-2 min-w-0">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  Recent Transactions
                </h3>
                <span className="text-[11px] text-slate-400 font-medium truncate block">
                  Showing 4 latest records · {transactions.length} total
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAllTransactionsModalOpen(true)}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span>See All</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>

            {displayList.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No transactions recorded for {periodLabel}.</p>
            ) : (
              <div className="space-y-2">
                {displayList.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  const isIncome = tx.type === 'income';

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setIsAllTransactionsModalOpen(true)}
                      className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 cursor-pointer transition-colors flex items-center justify-between gap-2.5 sm:gap-3 min-w-0 overflow-hidden active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 overflow-hidden">
                        <div
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isExpense
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : isIncome
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {isExpense && <ArrowDownRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                          {isIncome && <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                          {!isExpense && !isIncome && <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                        </div>

                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {tx.note || tx.categoryName}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-0.5 min-w-0 truncate">
                            <span className="shrink-0">{formatDate(tx.date)}</span>
                            <span className="shrink-0">·</span>
                            <span className="truncate">{tx.fromAccountName}</span>
                            {tx.toAccountName && <span className="truncate">→ {tx.toAccountName}</span>}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`text-xs sm:text-sm md:text-base font-extrabold tabular-nums shrink-0 whitespace-nowrap ml-2 text-right ${
                          isExpense
                            ? 'text-rose-600 dark:text-rose-400'
                            : isIncome
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}
                        title={`${isExpense ? '-' : isIncome ? '+' : ''}${formatINR(tx.amount)}`}
                      >
                        {isExpense ? '-' : isIncome ? '+' : ''}
                        {formatINR(tx.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {transactions.length > 4 && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-center">
                <button
                  type="button"
                  onClick={() => setIsAllTransactionsModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>See All Transactions ({transactions.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      }

      case 'category_insight':
        return (
          <div
            key="category_insight"
            onClick={() => setActiveTab('analytics')}
            className="p-4 sm:p-5 md:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-emerald-500/40 transition-all overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3.5 gap-2 min-w-0">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  Top Spending Categories
                </h3>
                <span className="text-[11px] text-slate-400 truncate block">Distribution for {periodLabel}</span>
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0 whitespace-nowrap">
                <span>Analytics</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </span>
            </div>

            {topCategories.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No spending recorded in this period.</p>
            ) : (
              <div className="space-y-2.5 min-w-0">
                {topCategories.map((c) => {
                  const percent = totalSpending > 0 ? (c.amount / totalSpending) * 100 : 0;
                  return (
                    <div key={c.name} className="space-y-1 min-w-0">
                      <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {c.name}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums shrink-0 whitespace-nowrap">
                          {formatINR(c.amount)} ({percent.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${percent}%`, backgroundColor: c.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      // Requirement 4: Debts Card at bottom of Home screen displaying only unsettled debts
      case 'debts_card':
        return (
          <div
            key="debts_card"
            className="p-4 sm:p-5 md:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3.5 gap-2 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    Debts & Personal Loans
                  </h3>
                  <span className="text-[11px] text-slate-400 truncate block">
                    {unsettledDebts.length} Unsettled Records
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setInitialDebtCategoryTab('individual');
                  setIsDebtsModalOpen(true);
                }}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
              >
                <span>Full Ledger</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>

            {/* Lent vs Borrowed Summary Pill */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 mb-2.5 min-w-0">
              <div className="min-w-0 overflow-hidden">
                <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium truncate">To Receive (Lent)</span>
                <span
                  className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums truncate block mt-0.5"
                  title={formatINR(totalLent)}
                >
                  +{formatINR(totalLent)}
                </span>
              </div>
              <div className="border-l border-slate-200 dark:border-slate-700 pl-3 min-w-0 overflow-hidden">
                <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium truncate">To Repay (Borrowed)</span>
                <span
                  className="text-sm sm:text-base font-extrabold text-rose-600 dark:text-rose-400 tabular-nums truncate block mt-0.5"
                  title={formatINR(totalBorrowed)}
                >
                  -{formatINR(totalBorrowed)}
                </span>
              </div>
            </div>

            {/* List of active unsettled debts */}
            {unsettledDebts.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">All debts and personal loans are fully settled!</p>
            ) : (
              <div className="space-y-1.5 min-w-0">
                {unsettledDebts.slice(0, 3).map(({ debt: d, netBalance, status }) => {
                  const isLent = status === 'owes_you';
                  return (
                    <div
                      key={d.id}
                      onClick={() => {
                        setSelectedDebtId(d.id);
                        setIsDebtsModalOpen(true);
                      }}
                      className="p-2.5 sm:p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800/80 cursor-pointer transition-colors flex items-center justify-between gap-2 min-w-0 overflow-hidden active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 overflow-hidden">
                        <div
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isLent
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isLent ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                            {d.personName}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate block">
                            {isLent ? 'They owe you' : 'You owe them'} {d.dueDate ? `· Due ${formatDate(d.dueDate)}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs sm:text-sm font-bold tabular-nums whitespace-nowrap block ${
                            isLent ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                          title={formatINR(netBalance)}
                        >
                          {formatINR(netBalance)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {groups.length > 0 && (
              <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate max-w-[200px] sm:max-w-none">
                    {groups.length} active group{groups.length !== 1 ? 's' : ''} ({groups.map((g) => g.name).slice(0, 2).join(', ')}{groups.length > 2 ? '...' : ''})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInitialDebtCategoryTab('groups');
                    setIsDebtsModalOpen(true);
                  }}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
                >
                  <span>Groups</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {/* 24-HOUR ADVANCE NOTICE BANNER FOR RECURRING AUTO-EXECUTION */}
      {upcoming24hRecurring && upcoming24hRecurring.length > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-sky-500/10 to-emerald-500/10 border-2 border-amber-500/30 dark:border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                  24-Hour Notice: Auto-Debit Tomorrow
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300">
                  {upcoming24hRecurring.length} scheduled
                </span>
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/80 truncate mt-0.5">
                {upcoming24hRecurring.map((r) => `${r.name} (${formatINR(r.amount)})`).join(', ')} — Will auto-execute once. Single-entry duplicate protection active.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsRecurringModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 self-end sm:self-auto cursor-pointer transition-colors shadow-xs"
          >
            Review Schedules
          </button>
        </div>
      )}

      {/* Render user customized widgets in order */}
      {activeWidgets.map((widget) => renderWidget(widget.id))}

      {/* Quick Customize App & Bottom Bar Shortcut */}
      <div className="pt-2 flex justify-center">
        <button
          type="button"
          onClick={() => openSettingsTab('customize')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200/50 dark:border-slate-700/50"
        >
          <Sliders className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Customize in Settings (Layout & Bottom Bar)</span>
        </button>
      </div>
    </div>
  );
};
