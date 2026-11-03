import React from 'react';
import { InvestmentHolding } from '../../../types';
import { computePfMetrics, getCurrentFinancialYear } from '../../../utils/bondsSgbPfEngine';
import { formatINR } from '../../../utils/formatters';
import { PiggyBank, ShieldCheck, ChevronRight, Briefcase } from 'lucide-react';

interface PfHoldingItemCardProps {
  holding: InvestmentHolding;
  onClick: () => void;
}

export const PfHoldingItemCard: React.FC<PfHoldingItemCardProps> = ({ holding, onClick }) => {
  const m = computePfMetrics(holding);
  const currentFY = getCurrentFinancialYear();

  return (
    <div
      data-holding-id={holding.id}
      onClick={onClick}
      className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/90 hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3 min-w-0 overflow-hidden active:scale-[0.99]"
    >
      {/* Left Column: PF Icon + Account Name & Meta */}
      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-cyan-200/80 dark:border-cyan-900/60 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-sm shadow-2xs">
          <PiggyBank className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <h4
              className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors"
              title={m.accountName}
            >
              {m.accountName}
            </h4>
            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200/50 dark:border-cyan-800/50 shrink-0">
              {m.pfType}
            </span>
            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shrink-0">
              {m.interestRate}% p.a.
            </span>
            {m.xirr !== null && (
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50 shrink-0 tabular-nums">
                XIRR {m.xirr >= 0 ? '+' : ''}{m.xirr.toFixed(1)}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 min-w-0 overflow-hidden text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="font-mono text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
              {m.accountIdentifier}
            </span>
            {m.monthlySubscription?.enabled && (
              <>
                <span className="opacity-50">·</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold truncate">
                  Monthly: ₹{formatINR(m.monthlySubscription.totalMonthly)}
                </span>
              </>
            )}
            {m.currentFyContributions > 0 && (
              <>
                <span className="opacity-50 hidden sm:inline">·</span>
                <span className="text-slate-600 dark:text-slate-300 font-medium tabular-nums hidden sm:inline">
                  {currentFY}: ₹{formatINR(m.currentFyContributions)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Total Corpus Balance */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-right min-w-0 ml-2">
        <div className="min-w-0">
          <div
            className="text-xs sm:text-sm md:text-base font-extrabold text-slate-900 dark:text-white tabular-nums flex items-center justify-end gap-0.5 whitespace-nowrap"
            title={`Total Corpus: ₹${formatINR(m.totalCorpusBalance)}`}
          >
            <span>₹{formatINR(m.totalCorpusBalance)}</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums whitespace-nowrap">
            +₹{formatINR(m.totalInterestCredited)} interest
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-cyan-500 transition-colors shrink-0" />
      </div>
    </div>
  );
};
