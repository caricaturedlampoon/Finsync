import React from 'react';
import { SgbSummaryMetrics } from '../../../utils/bondsSgbPfEngine';
import { formatINR, formatDate } from '../../../utils/formatters';
import { Coins, ArrowUpRight, ArrowDownRight, Info, ShieldCheck, Scale, RefreshCw, TrendingUp } from 'lucide-react';

interface SgbSummaryCardProps {
  summary: SgbSummaryMetrics;
  onAddSgb?: () => void;
  onSyncGold?: () => void;
  isSyncing?: boolean;
}

export const SgbSummaryCard: React.FC<SgbSummaryCardProps> = ({ summary, onAddSgb, onSyncGold, isSyncing }) => {
  const isProfit = summary.totalUnrealizedGain >= 0;

  return (
    <div className="p-4 sm:p-6 lg:p-7 rounded-3xl bg-gradient-to-br from-yellow-500/15 via-amber-500/5 to-transparent dark:from-yellow-950/40 dark:via-slate-900 dark:to-slate-900 border border-yellow-300/80 dark:border-yellow-900/60 shadow-xs space-y-5 sm:space-y-6 w-full min-w-0 overflow-hidden">
      {/* Header Context with Gold Price Ticker & XIRR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center shrink-0 shadow-2xs">
            <Coins className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400 shrink-0">
                Sovereign Gold Bonds (SGB)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-950/80 text-yellow-800 dark:text-yellow-300 border border-yellow-300/60 dark:border-yellow-800/60 shrink-0">
                {summary.totalGrams} Grams Held
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60 flex items-center gap-1 shrink-0">
                <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">XIRR: {summary.portfolioXirr !== null ? `${summary.portfolioXirr >= 0 ? '+' : ''}${summary.portfolioXirr.toFixed(2)}%` : 'N/A'}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate" title="RBI Guaranteed 999 Purity Gold with 2.50% Annual Sovereign Interest">
              RBI Guaranteed 999 Purity Gold with 2.50% Annual Sovereign Interest
            </p>
          </div>
        </div>

        {/* Live Reference Gold Price Badge via goldprice.dev */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto max-w-full flex-wrap sm:flex-nowrap">
          <div className="p-2 sm:p-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-yellow-200 dark:border-yellow-900/60 flex items-center gap-2 sm:gap-2.5 shadow-2xs max-w-full min-w-0">
            <Scale className="w-4 h-4 text-yellow-500 shrink-0" />
            <div className="text-left sm:text-right min-w-0 flex-1">
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-between sm:justify-end gap-1">
                <span>Gold Ref (24K / 999)</span>
                {onSyncGold && (
                  <button
                    type="button"
                    onClick={onSyncGold}
                    disabled={isSyncing}
                    title="Refresh live 24K gold spot price via goldprice.dev"
                    className="p-0.5 rounded hover:bg-yellow-100 dark:hover:bg-yellow-950/80 text-yellow-600 dark:text-yellow-400 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums truncate">
                ₹{formatINR(summary.goldReferencePrice)} / gram
              </div>
              <div className="text-[9px] text-slate-400 truncate max-w-full">
                Source: {summary.goldPriceSource.split('(')[0].trim()} · {formatDate(summary.goldPriceDate)}
              </div>
            </div>
          </div>
          {onAddSgb && (
            <button
              type="button"
              onClick={onAddSgb}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white shadow-xs shrink-0 cursor-pointer transition-all active:scale-95"
            >
              + Add SGB
            </button>
          )}
        </div>
      </div>

      {/* Main Financial Metrics */}
      <div className="grid grid-cols-2 gap-3 min-w-0">
        {/* Current Gold Valuation */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-1 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
              Current Gold Value
            </span>
            <span className="text-[9px] font-semibold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/60 px-1.5 py-0.2 rounded shrink-0">
              Gold Linked
            </span>
          </div>
          <div
            className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-slate-900 dark:text-white tabular-nums truncate block"
            title={`₹${formatINR(summary.currentGoldValue)}`}
          >
            ₹{formatINR(summary.currentGoldValue)}
          </div>
          <div
            className="text-[11px] text-slate-400 tabular-nums truncate block"
            title={`Total Investment: ₹${formatINR(summary.totalInvestment)}`}
          >
            Total Investment: ₹{formatINR(summary.totalInvestment)}
          </div>
        </div>

        {/* Unrealized Gold Gain / Loss */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Gold Price Appreciation
          </span>
          <div
            className={`text-base sm:text-lg lg:text-xl xl:text-2xl font-black tabular-nums flex items-center gap-1 min-w-0 overflow-hidden ${
              isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
            title={`${isProfit ? '+' : ''}₹${formatINR(summary.totalUnrealizedGain)}`}
          >
            {isProfit ? <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" /> : <ArrowDownRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />}
            <span className="truncate">
              {isProfit ? '+' : ''}₹{formatINR(summary.totalUnrealizedGain)}
            </span>
          </div>
          <div
            className={`text-[11px] font-semibold tabular-nums truncate block ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
            title={`${isProfit ? '+' : ''}${summary.totalUnrealizedGainPercent.toFixed(2)}% on acquisition`}
          >
            {isProfit ? '+' : ''}{summary.totalUnrealizedGainPercent.toFixed(2)}% on acquisition
          </div>
        </div>

        {/* Annual Sovereign Interest (2.5% on issue price) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-1 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
              Annual Interest (2.5%)
            </span>
            <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded shrink-0">
              Fixed Income
            </span>
          </div>
          <div
            className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums truncate block"
            title={`₹${formatINR(summary.annualInterestIncome)}`}
          >
            ₹{formatINR(summary.annualInterestIncome)}
          </div>
          <div
            className="text-[11px] text-slate-400 tabular-nums truncate block"
            title={`Paid semi-annually (₹${formatINR(summary.annualInterestIncome / 2)} / 6 mo)`}
          >
            Paid semi-annually (₹{formatINR(summary.annualInterestIncome / 2)} / 6 mo)
          </div>
        </div>

        {/* Cumulative Interest Earned */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Interest Earned To Date
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums truncate block"
            title={`₹${formatINR(summary.totalInterestEarned)}`}
          >
            ₹{formatINR(summary.totalInterestEarned)}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums truncate block" title="Credited directly to bank account">
            Credited directly to bank account
          </div>
        </div>
      </div>

      {/* Valuation & Dual-Engine Return Clarity Notice */}
      <div className="p-3.5 rounded-2xl bg-yellow-50/80 dark:bg-yellow-950/30 border border-yellow-200/70 dark:border-yellow-900/40 space-y-2 min-w-0 overflow-hidden">
        <div className="flex items-start gap-2 text-xs text-yellow-950 dark:text-yellow-200 min-w-0">
          <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="font-bold flex items-center gap-1.5 flex-wrap min-w-0 leading-normal">
              <span className="shrink-0">Total SGB Portfolio Valuation:</span>
              <span className="text-slate-900 dark:text-white tabular-nums font-black truncate">
                ₹{formatINR(summary.currentGoldValue)}
              </span>
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 break-words">
                (Pure gold asset valuation; excludes received bank interest to avoid double counting)
              </span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2 sm:gap-3 flex-wrap min-w-0 leading-normal">
              <span className="break-words">
                Total Realized + Unrealized Wealth Created: <strong className="text-emerald-700 dark:text-emerald-400">₹{formatINR(summary.totalUnrealizedGain + summary.totalInterestEarned)}</strong>
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold break-words">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>100% Tax-Free Capital Gains upon maturity (Sec 47(viic))</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

