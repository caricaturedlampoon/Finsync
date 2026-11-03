import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
} from 'lucide-react';
import { InvestmentHolding } from '../../types';
import { formatINR } from '../../utils/formatters';
import {
  HoldingDayPerformance,
  PortfolioDayPerformance,
  formatTradingDate,
} from '../../utils/investmentDayChange';

interface DayChangeInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioDayPerf: PortfolioDayPerformance;
  singleHolding?: InvestmentHolding | null;
  onSelectHolding?: (holdingId: string) => void;
  categoryFilterLabel?: string;
  onRefreshPrices?: () => void;
  isRefreshing?: boolean;
}

export const DayChangeInfoModal: React.FC<DayChangeInfoModalProps> = ({
  isOpen,
  onClose,
  portfolioDayPerf,
  singleHolding,
  onSelectHolding,
  categoryFilterLabel = 'Portfolio',
  onRefreshPrices,
  isRefreshing = false,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'gainers' | 'losers' | 'unchanged'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMethodology, setShowMethodology] = useState(false);

  if (!isOpen) return null;

  // If a single holding was passed in, find its specific performance or fallback
  const singleHoldingPerf = singleHolding
    ? portfolioDayPerf.holdingPerformances.find((p) => p.holdingId === singleHolding.id)
    : null;

  const isSingle = !!singleHoldingPerf;

  const lastDayValue = isSingle
    ? singleHoldingPerf.lastDayValue
    : portfolioDayPerf.totalLastDayValue;
  const todayValue = isSingle
    ? singleHoldingPerf.todayValue
    : portfolioDayPerf.totalCurrentValue;
  const dayChangeVal = isSingle
    ? singleHoldingPerf.dayChangeValue
    : portfolioDayPerf.totalDayChange;
  const dayChangePct = isSingle
    ? singleHoldingPerf.dayChangePercent
    : portfolioDayPerf.totalDayChangePercent;
  const isPositive = dayChangeVal >= 0;

  const previousDateStr = isSingle
    ? singleHoldingPerf.previousCloseDate
    : portfolioDayPerf.previousCloseDate;
  const currentDateStr = isSingle
    ? singleHoldingPerf.currentDate
    : portfolioDayPerf.currentDate;

  // Filter list of holdings for portfolio view
  const filteredList = portfolioDayPerf.holdingPerformances.filter((h) => {
    if (activeTab === 'gainers' && h.dayChangeValue <= 0) return false;
    if (activeTab === 'losers' && h.dayChangeValue >= 0) return false;
    if (activeTab === 'unchanged' && h.dayChangeValue !== 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = h.name.toLowerCase().includes(q);
      const matchSymbol = h.symbol.toLowerCase().includes(q);
      const matchCustom = h.customDisplayName?.toLowerCase().includes(q);
      return matchName || matchSymbol || matchCustom;
    }
    return true;
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 isolate">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                  {isSingle
                    ? `${singleHoldingPerf.customDisplayName || singleHoldingPerf.name} 1-Day Change`
                    : `${categoryFilterLabel} 1-Day Change`}
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                  Daily P&L
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Day-over-day movement vs previous trading session close
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onRefreshPrices && (
              <button
                type="button"
                onClick={onRefreshPrices}
                disabled={isRefreshing}
                title="Refresh latest prices from market"
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary-500' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Hero Section: Last Day Value vs Today Value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 1. Last Day Value Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 dark:from-slate-800/60 dark:to-slate-800/30 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  Last Day Value
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300">
                  Prev Close
                </span>
              </div>

              <div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                  {formatINR(lastDayValue)}
                </div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mt-0.5">
                  <span>As of {formatTradingDate(previousDateStr)}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed border-t border-slate-200/60 dark:border-slate-700/60 pt-2">
                {isSingle
                  ? `Position of ${singleHoldingPerf.yesterdayQuantity} units at prev close price ${formatINR(singleHoldingPerf.previousClosePrice)}`
                  : 'Total closing valuation on the previous trading session (excluding trades executed today)'}
              </p>
            </div>

            {/* 2. Today's Live Value Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 dark:from-slate-800/60 dark:to-slate-800/30 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  Today's Value
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300">
                  Live CMP
                </span>
              </div>

              <div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                  {formatINR(todayValue)}
                </div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mt-0.5">
                  <span>As of {formatTradingDate(currentDateStr)}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed border-t border-slate-200/60 dark:border-slate-700/60 pt-2">
                {isSingle
                  ? `Position of ${singleHoldingPerf.currentQuantity} units at current price ${formatINR(singleHoldingPerf.currentPrice)}`
                  : 'Current market value based on latest available prices & NAVs'}
              </p>
            </div>
          </div>

          {/* 3. 1-Day Net Change Spotlight Banner */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isPositive
                ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-100'
                : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40 text-rose-950 dark:text-rose-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  isPositive
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                }`}
              >
                {isPositive ? (
                  <ArrowUpRight className="w-6 h-6" />
                ) : (
                  <ArrowDownRight className="w-6 h-6" />
                )}
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-75 block">
                  Net 1-Day Difference
                </span>
                <div className="text-xl sm:text-2xl font-black tabular-nums tracking-tight flex items-baseline gap-2">
                  <span>
                    {isPositive ? '+' : ''}
                    {formatINR(dayChangeVal)}
                  </span>
                  <span
                    className={`text-sm sm:text-base font-extrabold ${
                      isPositive
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    ({isPositive ? '+' : ''}
                    {dayChangePct.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs opacity-80 sm:text-right">
              <div>
                Movement vs {formatTradingDate(previousDateStr, false)}
              </div>
              <div className="font-semibold text-[11px] opacity-70">
                {isPositive ? 'Day profit gained' : 'Day loss incurred'}
              </div>
            </div>
          </div>

          {/* Intraday Trading Info Notice (if trades were executed today) */}
          {((isSingle && singleHoldingPerf.hasTradesToday) ||
            (!isSingle && (portfolioDayPerf.todayTotalBoughtCost > 0 || portfolioDayPerf.todayTotalSoldProceeds > 0))) && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Intraday Trading Activity Today</span>
              </div>
              <p className="leading-relaxed opacity-90 text-[11px]">
                {isSingle ? (
                  <>
                    Today's trades: {singleHoldingPerf.todayBoughtQty > 0 && `Bought ${singleHoldingPerf.todayBoughtQty} units (${formatINR(singleHoldingPerf.todayBoughtCost)}). `}
                    {singleHoldingPerf.todaySoldQty > 0 && `Sold ${singleHoldingPerf.todaySoldQty} units (${formatINR(singleHoldingPerf.todaySoldProceeds)}). `}
                    In accordance with real-world brokerage accounting (e.g. Zerodha/Groww), today's new buys are measured from execution price, while overnight holdings are measured against yesterday's close price.
                  </>
                ) : (
                  <>
                    New purchases made today ({formatINR(portfolioDayPerf.todayTotalBoughtCost)}) are benchmarked from their purchase price, ensuring newly added holdings do not distort yesterday's close baseline.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Asset Contributions (When in Portfolio view) */}
          {!isSingle && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Holdings Breakdown ({portfolioDayPerf.totalHoldingsCount})
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      activeTab === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    All ({portfolioDayPerf.totalHoldingsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('gainers')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      activeTab === 'gainers'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    Gainers ({portfolioDayPerf.gainersCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('losers')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      activeTab === 'losers'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    Losers ({portfolioDayPerf.losersCount})
                  </button>
                </div>
              </div>

              {/* Search input if more than 5 holdings */}
              {portfolioDayPerf.totalHoldingsCount > 4 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter holdings by name or symbol..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              {/* Holdings List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No holdings match your current filter.
                  </div>
                ) : (
                  filteredList.map((h) => {
                    const isHP = h.dayChangeValue >= 0;
                    return (
                      <div
                        key={h.holdingId}
                        onClick={() => {
                          if (onSelectHolding) {
                            onSelectHolding(h.holdingId);
                            onClose();
                          }
                        }}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          onSelectHolding ? 'cursor-pointer hover:border-primary-400 hover:shadow-xs' : ''
                        } bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {h.customDisplayName || h.name}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">
                              {h.symbol}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                            <span>
                              Prev: {formatINR(h.previousClosePrice)}
                            </span>
                            <span>→</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              CMP: {formatINR(h.currentPrice)}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span>
                              Last Day: {formatINR(h.lastDayValue)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`text-xs sm:text-sm font-extrabold tabular-nums ${
                              isHP
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isHP ? '+' : ''}
                            {formatINR(h.dayChangeValue)}
                          </div>
                          <span
                            className={`text-[10px] font-semibold tabular-nums block ${
                              isHP
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isHP ? '+' : ''}
                            {h.dayChangePercent.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Educational / Transparency Accordion */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-850/30">
            <button
              type="button"
              onClick={() => setShowMethodology(!showMethodology)}
              className="w-full p-3.5 text-left flex items-center justify-between gap-2 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <HelpCircle className="w-4 h-4 text-primary-500 shrink-0" />
                <span>How Real-World Apps Calculate 1-Day Change</span>
              </div>
              {showMethodology ? (
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {showMethodology && (
              <div className="p-3.5 pt-0 text-xs text-slate-600 dark:text-slate-400 space-y-2.5 border-t border-slate-200/60 dark:border-slate-800/60 leading-relaxed">
                <div className="flex items-start gap-2 pt-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 dark:text-white block">
                      1. Last Business Day Value:
                    </strong>
                    The portfolio's valuation is anchored to the closing price/NAV on the last business session ({formatTradingDate(previousDateStr, false)}). Weekend and holiday market closures are accounted for.
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 dark:text-white block">
                      2. Intraday New Purchases:
                    </strong>
                    If you bought shares today, their performance is measured from your buy price rather than yesterday's close, preventing phantom gains/losses.
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 dark:text-white block">
                      3. Difference from Total P&L:
                    </strong>
                    Total P&L measures all-time gain since initial purchase. 1-Day change isolates today's single market session movement.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
            <span>Trading session: {formatTradingDate(previousDateStr, false)} → Today</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 transition-colors shadow-xs"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
