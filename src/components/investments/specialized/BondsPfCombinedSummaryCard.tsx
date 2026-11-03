import React from 'react';
import { BondsSummaryMetrics, SgbSummaryMetrics, PfSummaryMetrics } from '../../../utils/bondsSgbPfEngine';
import { formatINR } from '../../../utils/formatters';
import { Landmark, ShieldCheck, Percent, Coins, PiggyBank } from 'lucide-react';

interface BondsPfCombinedSummaryCardProps {
  bondsSummary: BondsSummaryMetrics;
  sgbSummary: SgbSummaryMetrics;
  pfSummary: PfSummaryMetrics;
  onAddAsset?: () => void;
}

export const BondsPfCombinedSummaryCard: React.FC<BondsPfCombinedSummaryCardProps> = ({
  bondsSummary,
  sgbSummary,
  pfSummary,
  onAddAsset,
}) => {
  const combinedValuation = bondsSummary.currentValuation + sgbSummary.currentGoldValue + pfSummary.totalPfBalance;
  const combinedInvested = bondsSummary.totalInvested + sgbSummary.totalInvestment + pfSummary.totalEmployeeContributions + pfSummary.totalEmployerContributions;
  const combinedAccruedInterest = bondsSummary.totalAccruedInterest;
  const combinedInterestReceived = bondsSummary.totalInterestReceived + sgbSummary.totalInterestEarned + pfSummary.totalInterestCredited;
  const combinedAnnualIncome = bondsSummary.annualCouponIncome + sgbSummary.annualInterestIncome + (pfSummary.currentFyEstimatedInterest || 0);
  const totalAssetsCount = bondsSummary.totalBondsCount + sgbSummary.totalSgbCount + pfSummary.totalAccountsCount;

  return (
    <div className="p-4 sm:p-6 lg:p-7 rounded-3xl bg-gradient-to-br from-amber-500/15 via-yellow-500/5 to-transparent dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 border border-amber-200/80 dark:border-amber-900/60 shadow-xs space-y-5 sm:space-y-6 w-full min-w-0 overflow-hidden">
      {/* Header Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Landmark className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 shrink-0">
                Bonds, SGBs & Provident Funds (Combined)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60 shrink-0">
                {totalAssetsCount} Assets / Accounts
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate" title="Consolidated Fixed-Income, Gold Bonds & Retirement Corpus">
              Consolidated Fixed-Income, Gold Bonds & Retirement Corpus
            </p>
          </div>
        </div>

        {onAddAsset && (
          <button
            type="button"
            onClick={onAddAsset}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 self-start sm:self-auto"
          >
            + Add Asset
          </button>
        )}
      </div>

      {/* Main Hero Metrics in 2 Columns */}
      <div className="grid grid-cols-2 gap-3 min-w-0">
        {/* Current Valuation */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Current Valuation
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-slate-900 dark:text-white tabular-nums truncate block"
            title={formatINR(combinedValuation)}
          >
            {formatINR(combinedValuation)}
          </div>
          <div
            className="text-[11px] text-slate-400 tabular-nums truncate block"
            title={`Invested: ${formatINR(combinedInvested)}`}
          >
            Invested: {formatINR(combinedInvested)}
          </div>
        </div>

        {/* Interest Accrued (Unrealized P&L) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Interest Accrued (Unrealized P&L)
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums truncate block"
            title={formatINR(combinedAccruedInterest)}
          >
            {formatINR(combinedAccruedInterest)}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums truncate block" title="Interest accrued across fixed-income assets">
            Accrued across active bonds
          </div>
        </div>

        {/* Annual Income */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Annual Income
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums truncate block"
            title={formatINR(combinedAnnualIncome)}
          >
            {formatINR(combinedAnnualIncome)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 min-w-0 truncate">
            <Coins className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="truncate">Combined yearly yield</span>
          </div>
        </div>

        {/* Interest Received */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Interest Received
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums truncate block"
            title={formatINR(combinedInterestReceived)}
          >
            {formatINR(combinedInterestReceived)}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums truncate block" title="Total interest credited to date">
            Total interest credited to date
          </div>
        </div>
      </div>
    </div>
  );
};
