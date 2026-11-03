import React from 'react';
import { InvestmentHolding } from '../../../types';
import { computeSgbMetrics } from '../../../utils/bondsSgbPfEngine';
import { formatINR } from '../../../utils/formatters';
import { Coins, ArrowUpRight, ArrowDownRight, Sparkles, Scale, Clock } from 'lucide-react';

interface SgbHoldingItemCardProps {
  holding: InvestmentHolding;
  liveGoldPrice?: number;
  displayMode: 'value' | 'returns';
  onClick: () => void;
}

export const SgbHoldingItemCard: React.FC<SgbHoldingItemCardProps> = ({
  holding,
  liveGoldPrice,
  displayMode,
  onClick,
}) => {
  const m = computeSgbMetrics(holding, liveGoldPrice);
  const isProfit = m.unrealizedGoldGain >= 0;

  return (
    <div
      data-holding-id={holding.id}
      onClick={onClick}
      className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/90 hover:border-yellow-400 dark:hover:border-yellow-600 hover:shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3 min-w-0 overflow-hidden active:scale-[0.99]"
    >
      {/* Left Column: Gold Icon + Tranche & Grams Details */}
      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-yellow-300/80 dark:border-yellow-900/60 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 flex items-center justify-center font-bold text-sm shadow-2xs">
          <Coins className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <h4
              className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors"
              title={m.trancheName}
            >
              {m.trancheName}
            </h4>
            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-yellow-100/80 dark:bg-yellow-950/70 text-yellow-800 dark:text-yellow-300 border border-yellow-300/50 dark:border-yellow-800/50 shrink-0">
              {m.gramsHeld} {m.gramsHeld === 1 ? 'gram' : 'grams'}
            </span>
            {m.isPrematureRedemptionEligible ? (
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50 shrink-0">
                Exit Window Open
              </span>
            ) : (
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                <span>{m.remainingTenureText}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 min-w-0 overflow-hidden text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
              Buy: ₹{formatINR(m.purchasePricePerGram)}/g
            </span>
            <span className="opacity-50">·</span>
            <span className="tabular-nums">
              Gold Ref: ₹{formatINR(m.goldReferencePrice)}/g
            </span>
            <span className="opacity-50">·</span>
            <span className="font-semibold text-yellow-600 dark:text-yellow-400 tabular-nums">
              2.50% Sovereign Interest
            </span>
            {m.xirr !== null && (
              <>
                <span className="opacity-50">·</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  XIRR: {m.xirr >= 0 ? '+' : ''}{m.xirr.toFixed(1)}%
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
                  m.currentGoldValue > m.totalInvested
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : m.currentGoldValue < m.totalInvested
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
                }`}
                title={`Current Gold Valuation: ₹${formatINR(m.currentGoldValue)}`}
              >
                {m.currentGoldValue > m.totalInvested && <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />}
                {m.currentGoldValue < m.totalInvested && <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />}
                <span>₹{formatINR(m.currentGoldValue)}</span>
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
                title={`Gold Gain: ₹${formatINR(m.unrealizedGoldGain)}`}
              >
                {isProfit ? '+' : ''}₹{formatINR(m.unrealizedGoldGain)}
              </div>
              <div
                className={`text-[10px] sm:text-[11px] font-semibold tabular-nums whitespace-nowrap ${
                  isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isProfit ? '+' : ''}{m.unrealizedGoldGainPercent.toFixed(2)}%
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
