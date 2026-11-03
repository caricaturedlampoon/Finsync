import React from 'react';
import { BondsSummaryMetrics } from '../../../utils/bondsSgbPfEngine';
import { formatINR } from '../../../utils/formatters';
import { Landmark, ArrowUpRight, ArrowDownRight, Percent, Calendar, ShieldCheck, Wallet, Coins } from 'lucide-react';

interface BondsSummaryCardProps {
  summary: BondsSummaryMetrics;
  onAddBond?: () => void;
}

export const BondsSummaryCard: React.FC<BondsSummaryCardProps> = ({ summary, onAddBond }) => {
  const isProfit = summary.unrealizedGainLoss >= 0;

  return (
    <div className="p-4 sm:p-6 lg:p-7 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 border border-amber-200/80 dark:border-amber-900/60 shadow-xs space-y-5 sm:space-y-6 w-full min-w-0 overflow-hidden">
      {/* Header Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Landmark className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 shrink-0">
                Fixed-Income & Bonds Portfolio
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60 shrink-0">
                {summary.totalBondsCount} {summary.totalBondsCount === 1 ? 'Bond' : 'Bonds'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60 shrink-0">
                Realized XIRR: {summary.portfolioXirr !== null ? `${summary.portfolioXirr >= 0 ? '+' : ''}${summary.portfolioXirr.toFixed(2)}%` : 'N/A'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate" title="Government Securities (G-Sec), PSU NCDs, Corporate & Tax-Free Bonds">
              Government Securities (G-Sec), PSU NCDs, Corporate & Tax-Free Bonds
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap sm:flex-nowrap">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
            {summary.totalUnitsHeld} Units Held
          </span>
          {onAddBond && (
            <button
              type="button"
              onClick={onAddBond}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              + Add Bond
            </button>
          )}
        </div>
      </div>

      {/* Main Hero Metrics */}
      <div className="grid grid-cols-2 gap-3 min-w-0">
        {/* Current Valuation */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Current Valuation
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-slate-900 dark:text-white tabular-nums truncate block"
            title={formatINR(summary.currentValuation)}
          >
            {formatINR(summary.currentValuation)}
          </div>
          <div
            className="text-[11px] text-slate-400 tabular-nums truncate block"
            title={`Invested: ${formatINR(summary.totalInvested)}`}
          >
            Invested: {formatINR(summary.totalInvested)}
          </div>
        </div>

        {/* Interest Accrued (Unrealized P&L) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Interest Accrued (Unrealized P&L)
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums truncate block"
            title={formatINR(summary.totalAccruedInterest)}
          >
            {formatINR(summary.totalAccruedInterest)}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums truncate block" title="Interest accrued across active bonds">
            Accrued across active bonds
          </div>
        </div>

        {/* Annual Coupon Income */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Annual Coupon Income
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums truncate block"
            title={formatINR(summary.annualCouponIncome)}
          >
            {formatINR(summary.annualCouponIncome)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 min-w-0 truncate">
            <Percent className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="truncate">Avg Coupon: {summary.weightedCouponRate.toFixed(2)}% p.a.</span>
          </div>
        </div>

        {/* Interest Received */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Interest Received
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums truncate block"
            title={formatINR(summary.totalInterestReceived)}
          >
            {formatINR(summary.totalInterestReceived)}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums truncate block" title="Total coupon interest credited">
            Total coupon interest credited
          </div>
        </div>
      </div>
    </div>
  );
};
