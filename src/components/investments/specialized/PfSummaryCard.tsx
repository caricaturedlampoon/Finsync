import React from 'react';
import { PfSummaryMetrics, getCurrentFinancialYear } from '../../../utils/bondsSgbPfEngine';
import { formatINR } from '../../../utils/formatters';
import { ShieldCheck, ArrowDownRight, ArrowUpRight, TrendingUp, PiggyBank, Briefcase, Landmark } from 'lucide-react';

interface PfSummaryCardProps {
  summary: PfSummaryMetrics;
  onAddPfAccount?: () => void;
}

export const PfSummaryCard: React.FC<PfSummaryCardProps> = ({ summary, onAddPfAccount }) => {
  const currentFY = getCurrentFinancialYear();

  return (
    <div className="p-4 sm:p-6 lg:p-7 rounded-3xl bg-gradient-to-br from-cyan-500/15 via-blue-500/5 to-transparent dark:from-cyan-950/40 dark:via-slate-900 dark:to-slate-900 border border-cyan-200/80 dark:border-cyan-900/60 shadow-xs space-y-5 sm:space-y-6 w-full min-w-0 overflow-hidden">
      {/* Header Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <PiggyBank className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 shrink-0">
                Provident Fund Corpus & Ledger
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300/60 dark:border-cyan-800/60 shrink-0">
                {summary.totalAccountsCount} {summary.totalAccountsCount === 1 ? 'Account' : 'Accounts'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60 shrink-0">
                Corpus XIRR: {summary.portfolioXirr !== null ? `${summary.portfolioXirr >= 0 ? '+' : ''}${summary.portfolioXirr.toFixed(2)}%` : '8.25%'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate" title="Employees' Provident Fund (EPF), Public Provident Fund (PPF) & Voluntary PF">
              Employees' Provident Fund (EPF), Public Provident Fund (PPF) & Voluntary PF
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap sm:flex-nowrap">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/60 shrink-0">
            Current {currentFY} Active
          </span>
          {onAddPfAccount && (
            <button
              type="button"
              onClick={onAddPfAccount}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs cursor-pointer active:scale-95 shrink-0"
            >
              + Add PF Account
            </button>
          )}
        </div>
      </div>

      {/* Hero Metric: Total PF Balance */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
            Total Accumulated PF Corpus Balance
          </span>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sovereign Backed & Tax-Exempt (EEE)</span>
          </span>
        </div>
        <div
          className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white tabular-nums truncate block"
          title={`₹${formatINR(summary.totalPfBalance)}`}
        >
          ₹{formatINR(summary.totalPfBalance)}
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap pt-1 min-w-0">
          <div className="truncate">
            Employee Share: <strong className="text-slate-800 dark:text-slate-200">₹{formatINR(summary.totalEmployeeContributions)}</strong>
          </div>
          {summary.hasEmployerContribution && (
            <>
              <span className="hidden sm:inline">·</span>
              <div className="truncate">
                Employer Share: <strong className="text-slate-800 dark:text-slate-200">₹{formatINR(summary.totalEmployerContributions)}</strong>
              </div>
            </>
          )}
          {summary.totalVoluntaryContributions > 0 && (
            <>
              <span className="hidden sm:inline">·</span>
              <div className="truncate">
                VPF Share: <strong className="text-slate-800 dark:text-slate-200">₹{formatINR(summary.totalVoluntaryContributions)}</strong>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Grid of Secondary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 min-w-0">
        {/* Cumulative Interest Credited */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Total Interest Credited
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums truncate block"
            title={`₹${formatINR(summary.totalInterestCredited)}`}
          >
            ₹{formatINR(summary.totalInterestCredited)}
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            Past Financial Years
          </span>
        </div>

        {/* Current FY Contributions */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            {currentFY} Contributions
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl font-black text-cyan-600 dark:text-cyan-400 tabular-nums truncate block"
            title={`₹${formatINR(summary.currentFyContributions)}`}
          >
            ₹{formatINR(summary.currentFyContributions)}
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            Deposited this financial year
          </span>
        </div>

        {/* Current FY Interest (Accrual Estimate) */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            {currentFY} Est. Accrued Interest
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums truncate block"
            title={`₹${formatINR(summary.currentFyEstimatedInterest)}`}
          >
            ₹{formatINR(summary.currentFyEstimatedInterest)}
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            Accruing (Credit at FY end)
          </span>
        </div>

        {/* Total Withdrawals */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Total Withdrawals
          </span>
          <div
            className="text-base sm:text-lg lg:text-xl font-black text-slate-700 dark:text-slate-300 tabular-nums truncate block"
            title={`₹${formatINR(summary.totalWithdrawals)}`}
          >
            ₹{formatINR(summary.totalWithdrawals)}
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            Advances & claims settled
          </span>
        </div>
      </div>
    </div>
  );
};
