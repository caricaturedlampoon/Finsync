import React from 'react';
import { InvestmentHolding } from '../../../types';
import { computeBondMetrics } from '../../../utils/bondsSgbPfEngine';
import { formatINR, formatDate } from '../../../utils/formatters';
import { Landmark, ArrowUpRight, ArrowDownRight, Calendar, Percent, ShieldCheck } from 'lucide-react';

interface BondHoldingItemCardProps {
  holding: InvestmentHolding;
  livePrice?: number;
  displayMode: 'value' | 'returns';
  onClick: () => void;
}

export const BondHoldingItemCard: React.FC<BondHoldingItemCardProps> = ({
  holding,
  livePrice,
  displayMode,
  onClick,
}) => {
  const m = computeBondMetrics(holding, livePrice);
  const isProfit = m.unrealizedGainLoss >= 0;

  return (
    <div
      data-holding-id={holding.id}
      onClick={onClick}
      className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/90 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3 min-w-0 overflow-hidden active:scale-[0.99]"
    >
      {/* Left Column: Icon + Name & Bond Details */}
      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-amber-200/80 dark:border-amber-900/60 bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-sm shadow-2xs">
          <Landmark className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <h4
              className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors"
              title={m.name}
            >
              {m.name}
            </h4>
            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50 shrink-0">
              {m.bondTypeLabel.split('(')[0].trim()}
            </span>
            {m.creditRating && (
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                {m.creditRating}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 min-w-0 overflow-hidden text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {m.unitsHeld} {m.unitsHeld === 1 ? 'unit' : 'units'} · FV ₹{formatINR(m.faceValue)}
            </span>
            <span className="opacity-50">·</span>
            <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {m.couponRate}% {m.frequencyLabel}
            </span>
            <span className="opacity-50">·</span>
            <span className="tabular-nums">
              YTM: {m.ytm.toFixed(2)}%
            </span>
            {m.xirr !== null && (
              <>
                <span className="opacity-50">·</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  XIRR: {m.xirr >= 0 ? '+' : ''}{m.xirr.toFixed(1)}%
                </span>
              </>
            )}
            {m.accruedInterest > 0 && (
              <>
                <span className="opacity-50 hidden sm:inline">·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium tabular-nums hidden sm:inline">
                  Accrued: ₹{formatINR(m.accruedInterest)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Financial Values */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-right min-w-0 ml-2">
        <div className="min-w-0">
          {displayMode === 'value' ? (
            <>
              <div
                className={`text-xs sm:text-sm md:text-base font-extrabold tabular-nums flex items-center justify-end gap-0.5 whitespace-nowrap ${
                  m.currentValuation > m.totalInvested
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : m.currentValuation < m.totalInvested
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
                }`}
                title={`Valuation: ₹${formatINR(m.currentValuation)}`}
              >
                {m.currentValuation > m.totalInvested && <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />}
                {m.currentValuation < m.totalInvested && <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />}
                <span>₹{formatINR(m.currentValuation)}</span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                Cost: ₹{formatINR(m.totalInvested)}
              </div>
            </>
          ) : (
            <>
              <div
                className={`text-xs sm:text-sm md:text-base font-extrabold tabular-nums flex items-center justify-end gap-0.5 whitespace-nowrap ${
                  isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
                title={`Capital PnL: ₹${formatINR(m.unrealizedGainLoss)}`}
              >
                {isProfit ? '+' : ''}₹{formatINR(m.unrealizedGainLoss)}
              </div>
              <div
                className={`text-[10px] sm:text-[11px] font-semibold tabular-nums whitespace-nowrap ${
                  isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isProfit ? '+' : ''}{m.unrealizedGainLossPercent.toFixed(2)}%
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
