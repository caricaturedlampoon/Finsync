import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatINR } from '../../utils/formatters';
import { Settings, ShieldCheck, Scale } from 'lucide-react';

export const NetLiquidWealthCard: React.FC = () => {
  const { netLiquidWealth, accounts, setIsSettingsModalOpen, setIsNetWorthModalOpen } = useApp();

  const liquidAccountsCount = accounts.filter((a) => a.includeInNetLiquid).length;

  return (
    <div className="p-4 sm:p-5 md:p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-md relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 relative z-10 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 shrink-0">
              Net Liquid Wealth
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-medium shrink-0">
              {liquidAccountsCount} Accounts Configured
            </span>
          </div>

          <div
            className="text-xl sm:text-3xl md:text-4xl font-extrabold tabular-nums tracking-tight text-white mt-1 truncate block"
            title={formatINR(netLiquidWealth, true)}
          >
            {formatINR(netLiquidWealth, true)}
          </div>

          <p className="text-xs text-slate-400 mt-1 max-w-md line-clamp-2">
            Total liquid cash in savings, current accounts, and wallets configured in settings.
          </p>
        </div>

        {/* Actions CTA Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setIsNetWorthModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl border border-emerald-500/30 transition-colors shrink-0 whitespace-nowrap cursor-pointer active:scale-95"
            title="Open comprehensive Net Worth breakdown"
          >
            <Scale className="w-3.5 h-3.5 text-emerald-400" />
            <span>View Net Worth</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/15 rounded-xl border border-white/10 transition-colors shrink-0 whitespace-nowrap cursor-pointer active:scale-95"
            title="Configure included accounts in Settings"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Configure</span>
          </button>
        </div>
      </div>
    </div>
  );
};
