import React from 'react';
import { formatINR } from '../../utils/formatters';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Calendar,
  RotateCcw,
} from 'lucide-react';

export type DashboardTimeline = 'week' | 'month' | 'year' | 'all';

interface SummaryHighlightCardProps {
  totalSpending: number;
  totalIncome: number;
  periodLabel: string;
  timeline: DashboardTimeline;
  setTimeline: (t: DashboardTimeline) => void;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
  onResetCurrent: () => void;
  isCurrent: boolean;
  onOpenCustomFilter?: () => void;
  onOpenExport?: () => void;
  onFilterExpenses?: () => void;
  onFilterIncome?: () => void;
}

export const SummaryHighlightCard: React.FC<SummaryHighlightCardProps> = ({
  totalSpending,
  totalIncome,
  periodLabel,
  timeline,
  setTimeline,
  onPrev,
  onNext,
  canNext,
  onResetCurrent,
  isCurrent,
  onOpenCustomFilter,
  onOpenExport,
  onFilterExpenses,
  onFilterIncome,
}) => {
  const netSavings = totalIncome - totalSpending;
  const isNetPositive = netSavings >= 0;

  return (
    <div className="p-4 sm:p-5 md:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all space-y-4 overflow-hidden">
      {/* Top Header with Quick Timeline Toggle Buttons & Stepper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/80 min-w-0">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
            Cashflow Summary
          </span>
          <div className="flex items-center gap-2 mt-0.5 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate block">
              {periodLabel}
            </span>
            {!isCurrent && timeline !== 'all' && (
              <button
                onClick={onResetCurrent}
                className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold hover:bg-emerald-100 transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                title="Jump to current period"
              >
                <RotateCcw className="w-2.5 h-2.5 shrink-0" />
                <span>Current</span>
              </button>
            )}
          </div>
        </div>

        {/* Timeline Buttons & Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
          {(onOpenCustomFilter || onOpenExport) && (
            <div className="flex items-center gap-1 shrink-0 mr-1">
              {onOpenCustomFilter && (
                <button
                  type="button"
                  onClick={onOpenCustomFilter}
                  className="text-xs font-semibold px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Custom Filter"
                >
                  Filter
                </button>
              )}
              {onOpenExport && (
                <button
                  type="button"
                  onClick={onOpenExport}
                  className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
                  title="Export Analysis"
                >
                  Export
                </button>
              )}
            </div>
          )}

          {/* Quick Timeline Selector: Week | Month | Year | All Time */}
          <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
            {(['week', 'month', 'year', 'all'] as DashboardTimeline[]).map((t) => (
              <button
                key={t}
                onClick={() => setTimeline(t)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg capitalize transition-all whitespace-nowrap cursor-pointer ${
                  timeline === t
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t === 'week' ? 'Week' : t === 'month' ? 'Month' : t === 'year' ? 'Year' : 'All Time'}
              </button>
            ))}
          </div>

          {/* Stepper with < and > buttons (disabled in All Time) */}
          {timeline !== 'all' && (
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-xl">
              <button
                onClick={onPrev}
                className="p-1 sm:p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Previous period"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={onNext}
                disabled={!canNext}
                className={`p-1 sm:p-1.5 rounded-lg transition-colors cursor-pointer ${
                  canNext
                    ? 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                }`}
                title="Next period"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dual Prominent Columns for Spending and Income with step-down typography */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 pt-0.5 min-w-0">
        {/* Spending Column */}
        <div
          onClick={onFilterExpenses}
          className={`flex flex-col min-w-0 overflow-hidden rounded-2xl p-2 -ml-2 transition-all ${onFilterExpenses ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-[0.98]' : ''}`}
          title="Tap to view filtered spending transactions"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1 shrink-0">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
              <ArrowDownRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            <span className="truncate">Total Spending</span>
          </div>
          <div
            className="text-lg sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight truncate block"
            title={formatINR(totalSpending)}
          >
            {formatINR(totalSpending)}
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate block">
            Outflow during {periodLabel}
          </span>
        </div>

        {/* Income Column */}
        <div
          onClick={onFilterIncome}
          className={`flex flex-col border-l border-slate-100 dark:border-slate-800/80 pl-3 sm:pl-6 min-w-0 overflow-hidden rounded-2xl p-2 transition-all ${onFilterIncome ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-[0.98]' : ''}`}
          title="Tap to view filtered income transactions"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1 shrink-0">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            <span className="truncate">Total Income</span>
          </div>
          <div
            className="text-lg sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight truncate block"
            title={formatINR(totalIncome)}
          >
            {formatINR(totalIncome)}
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate block">
            Earnings & Credits
          </span>
        </div>
      </div>

      {/* Net Surplus Footnote */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs min-w-0 gap-2">
        <span className="text-slate-500 dark:text-slate-400 font-medium truncate">Net Savings Balance:</span>
        <span
          className={`font-bold tabular-nums shrink-0 whitespace-nowrap ${
            isNetPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}
          title={`${isNetPositive ? '+' : ''}${formatINR(netSavings)}`}
        >
          {isNetPositive ? '+' : ''}
          {formatINR(netSavings)}
        </span>
      </div>
    </div>
  );
};
