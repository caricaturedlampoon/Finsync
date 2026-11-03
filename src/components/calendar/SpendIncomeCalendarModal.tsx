import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  TrendingDown,
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Tag,
  CreditCard,
  Calendar,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatINR, formatDate } from '../../utils/formatters';
import { IconRenderer } from '../common/IconRenderer';
import { Transaction } from '../../types';

interface SpendIncomeCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpendIncomeCalendarModal: React.FC<SpendIncomeCalendarModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { transactions, categories, accounts, openTransactionModal } = useApp();

  // Current selected month & year
  const [activeDate, setActiveDate] = useState<Date>(() => new Date());
  // Selected single date for drilldown (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const [selectedDayStr, setSelectedDayStr] = useState<string>(todayStr);

  const currentYear = activeDate.getFullYear();
  const currentMonth = activeDate.getMonth(); // 0 - 11
  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const monthName = activeDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Navigation handlers
  const handlePrevMonth = () => {
    setActiveDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setActiveDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setActiveDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDayStr(todayStr);
  };

  // Group transactions for the current month by day string 'YYYY-MM-DD'
  const { dailyData, monthSpendTotal, monthIncomeTotal, peakSpendDay } = useMemo(() => {
    const dailyMap: Record<
      string,
      { spend: number; income: number; transactions: Transaction[] }
    > = {};

    let totalSpend = 0;
    let totalIncome = 0;
    let maxSpend = 0;
    let maxSpendDay = '';

    for (const t of transactions) {
      if (!t.date || !t.date.startsWith(monthKey)) continue;

      if (!dailyMap[t.date]) {
        dailyMap[t.date] = { spend: 0, income: 0, transactions: [] };
      }

      dailyMap[t.date].transactions.push(t);

      const amt = Number(t.amount) || 0;
      if (t.type === 'expense') {
        dailyMap[t.date].spend += amt;
        totalSpend += amt;
        if (dailyMap[t.date].spend > maxSpend) {
          maxSpend = dailyMap[t.date].spend;
          maxSpendDay = t.date;
        }
      } else if (t.type === 'income') {
        dailyMap[t.date].income += amt;
        totalIncome += amt;
      }
    }

    return {
      dailyData: dailyMap,
      monthSpendTotal: totalSpend,
      monthIncomeTotal: totalIncome,
      peakSpendDay: maxSpendDay,
    };
  }, [transactions, monthKey]);

  // Construct Calendar Grid
  // Days of week: Mon, Tue, Wed, Thu, Fri, Sat, Sun
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const totalDays = lastDayOfMonth.getDate();

    // In JS: 0 = Sun, 1 = Mon ... 6 = Sat
    // Convert to 0 = Mon ... 6 = Sun
    let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startingDayOfWeek < 0) startingDayOfWeek = 6;

    // Previous month trailing days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    const cells: {
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      spend: number;
      income: number;
    }[] = [];

    // Trailing days from previous month
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevMonth = currentMonth === 0 ? 12 : currentMonth;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(dayNum).padStart(
        2,
        '0'
      )}`;
      cells.push({
        dayNumber: dayNum,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        spend: 0,
        income: 0,
      });
    }

    // Days of current month
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
        dayNum
      ).padStart(2, '0')}`;
      const dayStats = dailyData[dateStr] || { spend: 0, income: 0 };
      cells.push({
        dayNumber: dayNum,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        spend: dayStats.spend,
        income: dayStats.income,
      });
    }

    // Next month leading days to complete the week rows
    const remainingCells = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonth = currentMonth === 11 ? 1 : currentMonth + 2;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(i).padStart(
        2,
        '0'
      )}`;
      cells.push({
        dayNumber: i,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        spend: 0,
        income: 0,
      });
    }

    return cells;
  }, [currentYear, currentMonth, dailyData, todayStr]);

  // Selected Day's Transactions
  const selectedDayDetails = useMemo(() => {
    if (!selectedDayStr) return null;
    const stats = dailyData[selectedDayStr] || {
      spend: 0,
      income: 0,
      transactions: [],
    };

    // Sort transactions by time / creation
    const sorted = [...stats.transactions].sort((a, b) => {
      const timeA = a.time || '12:00 PM';
      const timeB = b.time || '12:00 PM';
      return timeB.localeCompare(timeA);
    });

    const [y, m, d] = selectedDayStr.split('-');
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return {
      dateStr: selectedDayStr,
      formattedDate,
      spend: stats.spend,
      income: stats.income,
      net: stats.income - stats.spend,
      transactions: sorted,
    };
  }, [selectedDayStr, dailyData]);

  const netCashFlow = monthIncomeTotal - monthSpendTotal;

  // Categories map for quick lookup
  const categoriesMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Format compact number for calendar cell
  const formatCompactINR = (val: number) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)}L`;
    }
    if (val >= 1000) {
      return `₹${(val / 1000).toFixed(1)}k`;
    }
    return `₹${Math.round(val)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
      {/* Top App Bar */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 pt-safe pb-3 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95 shrink-0"
            title="Back to Tools"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-2xs">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Spend & Income Calendar
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                Daily Ledger
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Daily spend in Red and income in Green with monthly toggles
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleJumpToToday}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition cursor-pointer active:scale-95"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            Today
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 max-w-5xl w-full mx-auto pb-safe">
        {/* Month Navigation & Summary Bar */}
        <div className="bg-white dark:bg-slate-900 p-2 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95"
            title="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {monthName}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tap any date to inspect daily itemized expenses & income
            </p>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95"
            title="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Metric Cards: Month Total Spend (Red), Income (Green), Net Flow */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {/* Total Spend */}
          <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-3 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              <span>Total Spend</span>
            </div>
            <div className="text-base sm:text-xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
              -{formatINR(monthSpendTotal)}
            </div>
            {peakSpendDay && (
              <div className="text-[10px] text-rose-500/90 dark:text-rose-400/80 mt-1 truncate">
                Peak: {peakSpendDay.slice(8)}th ({formatINR(dailyData[peakSpendDay]?.spend || 0)})
              </div>
            )}
          </div>

          {/* Total Income */}
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-3 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Total Income</span>
            </div>
            <div className="text-base sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
              +{formatINR(monthIncomeTotal)}
            </div>
            <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
              {Object.values(dailyData).filter((d) => d.income > 0).length} inflow days
            </div>
          </div>

          {/* Net Flow */}
          <div
            className={`border rounded-2xl p-3 sm:p-4 shadow-2xs ${
              netCashFlow >= 0
                ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60'
                : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
            }`}
          >
            <div
              className={`flex items-center gap-1.5 text-xs font-semibold mb-1 ${
                netCashFlow >= 0
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              <span>Net Flow</span>
            </div>
            <div
              className={`text-base sm:text-xl font-extrabold tracking-tight ${
                netCashFlow >= 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {netCashFlow >= 0 ? `+${formatINR(netCashFlow)}` : `-${formatINR(Math.abs(netCashFlow))}`}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {netCashFlow >= 0 ? 'Surplus Saved' : 'Deficit'}
            </div>
          </div>
        </div>

        {/* Custom Calendar Grid */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 text-center py-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/60">
            {calendarGrid.map((cell, idx) => {
              const isSelected = cell.dateStr === selectedDayStr;
              const hasSpend = cell.spend > 0;
              const hasIncome = cell.income > 0;

              return (
                <button
                  key={`${cell.dateStr}_${idx}`}
                  type="button"
                  onClick={() => cell.isCurrentMonth && setSelectedDayStr(cell.dateStr)}
                  disabled={!cell.isCurrentMonth}
                  className={`min-h-[72px] sm:min-h-[88px] p-1.5 sm:p-2 flex flex-col justify-between text-left transition cursor-pointer relative ${
                    !cell.isCurrentMonth
                      ? 'bg-slate-50/40 dark:bg-slate-900/40 opacity-30 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500'
                      : cell.isToday
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {/* Day header row */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                        cell.isToday
                          ? 'bg-emerald-600 text-white font-bold'
                          : isSelected
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Small dot indicator if transactions exist */}
                    {(hasSpend || hasIncome) && (
                      <div className="flex items-center gap-0.5">
                        {hasSpend && <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                        {hasIncome && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </div>
                    )}
                  </div>

                  {/* Daily Spend in Red & Daily Income in Green */}
                  <div className="w-full mt-1 space-y-0.5">
                    {hasSpend ? (
                      <div className="text-[10px] sm:text-xs font-bold text-rose-600 dark:text-rose-400 truncate">
                        -{formatCompactINR(cell.spend)}
                      </div>
                    ) : null}

                    {hasIncome ? (
                      <div className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
                        +{formatCompactINR(cell.income)}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Transaction Drilldown */}
        {selectedDayDetails && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{selectedDayDetails.formattedDate}</span>
                  {selectedDayDetails.dateStr === todayStr && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      Today
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-3 text-xs mt-1">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    Spent: -{formatINR(selectedDayDetails.spend)}
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Income: +{formatINR(selectedDayDetails.income)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openTransactionModal('expense')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Log Spend
                </button>
                <button
                  type="button"
                  onClick={() => openTransactionModal('income')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Log Income
                </button>
              </div>
            </div>

            {/* Transaction List for the Day */}
            {selectedDayDetails.transactions.length === 0 ? (
              <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                No recorded transactions on this day.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {selectedDayDetails.transactions.map((tx) => {
                  const cat = tx.categoryId ? categoriesMap.get(tx.categoryId) : undefined;
                  const isExpense = tx.type === 'expense';
                  const isIncome = tx.type === 'income';

                  return (
                    <div
                      key={tx.id}
                      className="py-3 flex items-center justify-between gap-3 first:pt-1 last:pb-1"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor: cat ? `${cat.color}15` : isExpense ? '#ef444415' : '#10b98115',
                            borderColor: cat ? `${cat.color}30` : isExpense ? '#ef444430' : '#10b98130',
                            color: cat?.color || (isExpense ? '#ef4444' : '#10b981'),
                          }}
                        >
                          {cat ? (
                            <IconRenderer name={cat.icon} className="w-5 h-5" />
                          ) : isExpense ? (
                            <ArrowDownLeft className="w-5 h-5" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {tx.note || tx.categoryName || (isExpense ? 'Expense' : isIncome ? 'Income' : 'Transfer')}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {tx.time && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {tx.time}
                              </span>
                            )}
                            <span>{tx.fromAccountName || 'Account'}</span>
                            {cat && (
                              <span className="inline-flex items-center gap-0.5">
                                • {cat.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Red for spend, Green for income */}
                      <div
                        className={`text-sm sm:text-base font-extrabold tracking-tight shrink-0 ${
                          isExpense
                            ? 'text-rose-600 dark:text-rose-400'
                            : isIncome
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {isExpense
                          ? `-${formatINR(tx.amount)}`
                          : isIncome
                          ? `+${formatINR(tx.amount)}`
                          : formatINR(tx.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
