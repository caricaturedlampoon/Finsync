import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatINR, formatCompactINR } from '../../utils/formatters';
import { TrendingUp, Layers, Award, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';

export interface GrowthBarItem {
  label: string;
  fullDate?: string;
  invested: number;
  valuation: number;
  growth: number;
  growthPercent: number;
  [key: string]: any;
}

interface ProfitLossGrowthBarChartProps {
  combinedData: GrowthBarItem[];
  stocksData?: GrowthBarItem[];
  mfData?: GrowthBarItem[];
  initialCategory?: 'combined' | 'stocks' | 'mf';
  title?: string;
  subtitle?: string;
  height?: number;
  showCategorySwitch?: boolean;
}

/**
 * Custom SVG Bar Shape:
 * - In Profit (valuation >= invested): Base is solid Blue (#2563eb) up to invested, stacked top is Green (#10b981) with solid dark green border (#047857) reaching Current Value.
 * - In Loss (valuation < invested):
 *   - The invested value is shown as a continuous Blue color box (stroke="#2563eb", strokeWidth=2).
 *   - Current value is filled with solid Blue colour (#2563eb).
 *   - The area of loss (between current value and invested value) is shaded with 135° diagonal lines in Red colour (#ef4444).
 *   - Top indicator renders the Current Value.
 */
const CustomProfitLossBarShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload || width <= 0 || height <= 0) return null;

  const invested = Math.max(0, payload.invested || 0);
  const valuation = Math.max(0, payload.valuation || 0);
  const benchmarkMax = Math.max(invested, valuation, 1);

  // Height is the total distance from baseline to benchmarkMax
  const baselineY = y + height;
  const scale = height / benchmarkMax;

  const isProfit = valuation >= invested;
  const barWidth = Math.max(12, Math.min(38, width * 0.72));
  const barX = x + (width - barWidth) / 2;

  // Exact Y position of Current Value (valuation)
  const valuationHeight = Math.max(0, valuation * scale);
  const valuationTopY = baselineY - valuationHeight;

  if (isProfit) {
    // 1. PROFIT:
    // Base bar: Invested value in Blue
    // Top bar: Profit in Green stacked ABOVE the invested level, bordered with solid dark green
    // Top of bar reaches Current Value (valuationTopY)
    const investedHeight = Math.max(0, invested * scale);
    const profitHeight = Math.max(0, (valuation - invested) * scale);

    const investedTopY = baselineY - investedHeight;
    const profitTopY = valuationTopY;

    return (
      <g className="cursor-pointer group">
        {/* Top of bar indicates Current Value */}
        <text
          x={barX + barWidth / 2}
          y={profitTopY - 6}
          textAnchor="middle"
          fontSize={10}
          fontWeight="700"
          fill="#059669"
          style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          className="font-mono select-none"
        >
          {formatCompactINR(valuation)}
        </text>

        {/* Blue bar for Invested Value */}
        {investedHeight > 0 && (
          <rect
            x={barX}
            y={investedTopY}
            width={barWidth}
            height={investedHeight}
            fill="#2563eb"
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            rx={profitHeight > 0 ? 0 : 3}
            className="transition-all duration-200"
          />
        )}

        {/* Green bar for Profit above Invested, with solid green border */}
        {profitHeight > 0 && (
          <rect
            x={barX}
            y={profitTopY}
            width={barWidth}
            height={profitHeight}
            fill="#10b981"
            stroke="#047857"
            strokeWidth={1.75}
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            rx={3}
            className="transition-all duration-200"
          />
        )}

        {/* Invested baseline separator */}
        {profitHeight > 0 && investedHeight > 0 && (
          <line
            x1={barX}
            y1={investedTopY}
            x2={barX + barWidth}
            y2={investedTopY}
            stroke="#1d4ed8"
            strokeWidth={1}
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          />
        )}
      </g>
    );
  } else {
    // 2. LOSS:
    // User Specification:
    // - Invested value shown as a continuous Blue color box
    // - Current value is filled with Blue colour
    // - The area of loss is shaded at 135° lines in Red colour
    const investedHeight = Math.max(0, invested * scale);
    const investedTopY = baselineY - investedHeight;
    const lossHeight = Math.max(0, investedHeight - valuationHeight);
    const lossTopY = investedTopY;

    return (
      <g className="cursor-pointer group">
        <defs>
          <pattern
            id="lossHatch135"
            width="8"
            height="8"
            patternTransform="rotate(135)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="#ef4444"
              strokeWidth={2}
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            />
          </pattern>
        </defs>

        {/* Current Value indicator text atop */}
        <text
          x={barX + barWidth / 2}
          y={investedTopY - 6}
          textAnchor="middle"
          fontSize={10}
          fontWeight="700"
          fill="#dc2626"
          style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          className="font-mono select-none"
        >
          {formatCompactINR(valuation)}
        </text>

        {/* Current Value filled with solid Blue colour */}
        {valuationHeight > 0 && (
          <rect
            x={barX}
            y={valuationTopY}
            width={barWidth}
            height={valuationHeight}
            fill="#2563eb"
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            rx={0}
            className="transition-all duration-200"
          />
        )}

        {/* Area of Loss shaded at 135° diagonal lines in Red colour */}
        {lossHeight > 0 && (
          <>
            {/* Subtle soft red underlay */}
            <rect
              x={barX}
              y={lossTopY}
              width={barWidth}
              height={lossHeight}
              fill="rgba(239, 68, 68, 0.08)"
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            />
            {/* 135° Red diagonal hatching lines */}
            <rect
              x={barX}
              y={lossTopY}
              width={barWidth}
              height={lossHeight}
              fill="url(#lossHatch135)"
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
              className="transition-all duration-200"
            />
          </>
        )}

        {/* Divider line separating Current Value (Blue) from Loss Area (135° Red) */}
        {valuationHeight > 0 && lossHeight > 0 && (
          <line
            x1={barX}
            y1={valuationTopY}
            x2={barX + barWidth}
            y2={valuationTopY}
            stroke="#1d4ed8"
            strokeWidth={1.5}
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          />
        )}

        {/* The Invested Value is shown as a continuous Blue color box enclosing the full capital */}
        {investedHeight > 0 && (
          <rect
            x={barX}
            y={investedTopY}
            width={barWidth}
            height={investedHeight}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2}
            rx={3}
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            className="transition-all duration-200"
          />
        )}
      </g>
    );
  }
};

export const ProfitLossGrowthBarChart: React.FC<ProfitLossGrowthBarChartProps> = ({
  combinedData,
  stocksData,
  mfData,
  initialCategory = 'combined',
  title = 'Portfolio Growth & Capital Analysis',
  subtitle = 'Invested value (Continuous Blue box), Current value (Solid Blue) with 135° Red shaded loss & Green profit',
  height = 250,
  showCategorySwitch = true,
}) => {
  const [selectedCat, setSelectedCat] = useState<'combined' | 'stocks' | 'mf'>(initialCategory);

  React.useEffect(() => {
    setSelectedCat(initialCategory);
  }, [initialCategory]);

  const activeDataset: GrowthBarItem[] = React.useMemo(() => {
    let source = combinedData;
    if (selectedCat === 'stocks' && stocksData && stocksData.length > 0) source = stocksData;
    else if (selectedCat === 'mf' && mfData && mfData.length > 0) source = mfData;

    return source.map((item) => ({
      ...item,
      // The bar chart dataKey uses benchmarkMax so props.height matches the max value
      benchmarkMax: Math.max(item.invested, item.valuation, 1),
    }));
  }, [selectedCat, combinedData, stocksData, mfData]);

  // Aggregate current summary for the selected category
  const latestItem = activeDataset[activeDataset.length - 1];
  const totalVal = latestItem ? latestItem.valuation : 0;
  const totalInv = latestItem ? latestItem.invested : 0;
  const totalGain = totalVal - totalInv;
  const totalGainPct = totalInv > 0 ? (totalGain / totalInv) * 100 : 0;
  const isProfitable = totalGain >= 0;

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-4">
      {/* Header with Title & Category Segmented Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
              <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                {!showCategorySwitch && title
                  ? title
                  : selectedCat === 'combined'
                  ? (title || 'Combined Portfolio Growth')
                  : selectedCat === 'stocks'
                  ? 'Stocks Growth (Direct Equities)'
                  : 'Mutual Funds Growth (SIPs & Lumpsum)'}
              </span>
            </h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums shrink-0 ${
                isProfitable
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
              }`}
            >
              {isProfitable ? '+' : ''}
              {totalGainPct.toFixed(1)}%
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {subtitle}
          </p>
        </div>

        {/* Category Switcher Tabs */}
        {showCategorySwitch && (
          <div className="flex items-center gap-1 p-1 bg-slate-200/80 dark:bg-slate-800 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedCat('combined')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedCat === 'combined'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Combined
            </button>
            <button
              type="button"
              onClick={() => setSelectedCat('stocks')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedCat === 'stocks'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              Stocks
            </button>
            <button
              type="button"
              onClick={() => setSelectedCat('mf')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedCat === 'mf'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              Mutual Funds
            </button>
          </div>
        )}
      </div>

      {/* The Bar Chart */}
      <div style={{ height }} className="w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={activeDataset}
            margin={{ top: 28, right: 10, left: -10, bottom: 0 }}
            barCategoryGap="20%"
          >
            <defs>
              <pattern
                id="lossHatch135"
                width="8"
                height="8"
                patternTransform="rotate(135)"
                patternUnits="userSpaceOnUse"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="8"
                  stroke="#ef4444"
                  strokeWidth={2}
                  style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={(v) => formatCompactINR(v)}
            />
            <Tooltip
              cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload as GrowthBarItem;
                  const isGain = d.valuation >= d.invested;
                  const diff = d.valuation - d.invested;
                  const diffPct = d.invested > 0 ? (diff / d.invested) * 100 : 0;

                  return (
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl text-xs space-y-2 min-w-[210px]">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {d.fullDate || d.label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            isGain
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isGain ? 'Profit Surplus' : 'Capital Loss'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-xs border-2 border-blue-600 bg-transparent shrink-0" />
                            <span>Invested Basis (Box):</span>
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                            {formatINR(d.invested)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 shrink-0" />
                            <span>Current Value (Solid Blue):</span>
                          </span>
                          <span className="font-mono font-extrabold tabular-nums text-slate-900 dark:text-white">
                            {formatINR(d.valuation)}
                          </span>
                        </div>

                        <div
                          className={`flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800 font-bold ${
                            isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {isGain ? (
                              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 border border-emerald-700 shrink-0" />
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-xs bg-red-50 dark:bg-red-950/40 border border-red-500 overflow-hidden relative shrink-0">
                                <svg className="w-full h-full" viewBox="0 0 10 10">
                                  <line x1="0" y1="10" x2="10" y2="0" stroke="#ef4444" strokeWidth="2" />
                                </svg>
                              </span>
                            )}
                            <span>{isGain ? 'Net Profit:' : 'Drawdown Loss (135° Red):'}</span>
                          </span>
                          <span className="font-mono tabular-nums">
                            {isGain ? '+' : ''}
                            {formatINR(diff)} ({diffPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="benchmarkMax"
              shape={<CustomProfitLossBarShape />}
              maxBarSize={38}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Visual Legend explaining the bar representation */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/40 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {/* Part 1: Invested continuous blue box */}
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-xs border-2 border-blue-600 bg-transparent shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Invested Value (Continuous Blue Box)
            </span>
          </div>

          {/* Part 2: Current value solid blue */}
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-xs bg-blue-600 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Current Value (Solid Blue)
            </span>
          </div>

          {/* Part 3: Profit */}
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-xs bg-emerald-500 border border-emerald-800 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Profit Surplus (Green + Border)
            </span>
          </div>

          {/* Part 4: Loss Area shaded at 135° lines in red */}
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-xs bg-red-50 dark:bg-red-950/40 border border-red-500 overflow-hidden relative shrink-0 flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 14 14" preserveAspectRatio="none">
                <line x1="0" y1="14" x2="14" y2="0" stroke="#ef4444" strokeWidth="2" />
                <line x1="-5" y1="9" x2="9" y2="-5" stroke="#ef4444" strokeWidth="2" />
                <line x1="5" y1="19" x2="19" y2="5" stroke="#ef4444" strokeWidth="2" />
              </svg>
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Loss Area (135° Red Hatching)
            </span>
          </div>
        </div>

        {/* Current status summary */}
        <div className="text-[11px] font-semibold text-slate-500">
          Cost: <strong className="text-blue-600 dark:text-blue-400 font-mono">{formatINR(totalInv)}</strong> · Val: <strong className="text-slate-900 dark:text-white font-mono">{formatINR(totalVal)}</strong>
        </div>
      </div>
    </div>
  );
};
