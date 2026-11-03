import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { InvestmentHolding, InvestmentTransaction } from '../../../types';
import { computeBondMetrics } from '../../../utils/bondsSgbPfEngine';
import { formatINR, formatDate, toInputDate } from '../../../utils/formatters';
import {
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Percent,
  ShieldCheck,
  Plus,
  Coins,
  Receipt,
  Clock,
  Info,
  CheckCircle2,
  Trash2,
  Edit2,
  TrendingUp,
  X,
  AlertTriangle,
} from 'lucide-react';

interface BondDetailSectionProps {
  holding: InvestmentHolding;
  livePrice?: number;
  onOpenActionModal: (action: 'buy' | 'sell' | 'coupon' | 'interest' | 'principal_repayment') => void;
  onEditHolding: () => void;
  onDeleteTransaction?: (txId: string) => void;
}

export const BondDetailSection: React.FC<BondDetailSectionProps> = ({
  holding,
  livePrice,
  onOpenActionModal,
  onEditHolding,
  onDeleteTransaction,
}) => {
  const { updateHolding, showToast } = useApp();
  const m = computeBondMetrics(holding, livePrice);
  const isProfit = m.unrealizedGainLoss >= 0;
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'ledger'>('overview');
  const [isEditingCouponDate, setIsEditingCouponDate] = useState(false);
  const [customCouponDate, setCustomCouponDate] = useState(toInputDate(holding.nextCouponDate || m.nextCouponPaymentDate));
  const [txToDelete, setTxToDelete] = useState<InvestmentTransaction | null>(null);

  const handleSaveCouponDate = (e: React.FormEvent) => {
    e.preventDefault();
    updateHolding(holding.id, { nextCouponDate: customCouponDate });
    showToast('Next coupon date updated successfully', 'success');
    setIsEditingCouponDate(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. HERO METRIC SPOTLIGHT: Fixed-Income Bond Overview */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        {/* Top Badges & Issuer Context */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {m.bondTypeLabel}
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                ISIN: {m.isin}
              </span>
              {m.creditRating && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                  {m.creditRating} Rating
                </span>
              )}
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60">
                Realized XIRR: {m.xirr !== null ? `${m.xirr >= 0 ? '+' : ''}${m.xirr.toFixed(2)}% p.a.` : 'N/A'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Issuer: <span className="text-slate-800 dark:text-slate-200 font-bold">{m.issuer}</span>
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => onOpenActionModal('coupon')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 shadow-xs transition-all cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Record Coupon</span>
            </button>
            <button
              onClick={() => onOpenActionModal('principal_repayment')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 shadow-xs transition-all cursor-pointer"
              title="Record principal repaid (partial or full maturity)"
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Principal Back</span>
            </button>
            <button
              onClick={() => onOpenActionModal('buy')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buy More</span>
            </button>
          </div>
        </div>

        {/* 4 Primary Fixed Income Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Current Valuation */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 min-w-0 break-words whitespace-normal">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Current Valuation
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              ₹{formatINR(m.currentValuation)}
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              CMP: ₹{formatINR(m.marketPricePerUnit)} / unit
            </div>
          </div>

          {/* Capital Gain/Loss */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 min-w-0 break-words whitespace-normal">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Unrealized Gain / Loss
            </span>
            <div
              className={`text-xl sm:text-2xl font-black tabular-nums flex items-center gap-1 ${
                isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {isProfit ? <ArrowUpRight className="w-5 h-5 shrink-0" /> : <ArrowDownRight className="w-5 h-5 shrink-0" />}
              <span>
                {isProfit ? '+' : ''}₹{formatINR(m.unrealizedGainLoss)}
              </span>
            </div>
            <div className={`text-[11px] font-semibold tabular-nums ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {isProfit ? '+' : ''}{m.unrealizedGainLossPercent.toFixed(2)}% on ₹{formatINR(m.totalInvested)}
            </div>
          </div>

          {/* Coupon Rate & Annual Income */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 min-w-0 break-words whitespace-normal">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Annual Coupon Income
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              ₹{formatINR(m.annualCouponIncome)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
              {m.couponRate}% p.a. ({m.frequencyLabel})
            </div>
          </div>

          {/* Yield to Maturity (YTM) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 min-w-0 break-words whitespace-normal">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Yield to Maturity (YTM)
            </span>
            <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
              {m.ytm.toFixed(2)}%
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              Current Yield: {m.currentYield.toFixed(2)}% p.a.
            </div>
          </div>
        </div>

        {/* Detailed Bond Metadata Grid */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Face Value (Par)</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-sm">
                ₹{formatINR(m.faceValue)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Principal Repaid</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums text-sm">
                ₹{formatINR(m.totalPrincipalRepaid)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Units Held</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-sm">
                {m.unitsHeld} Units
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Purchase Price</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-sm">
                ₹{formatINR(m.purchasePricePerUnit)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Accrued Interest</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-sm">
                ₹{formatINR(m.accruedInterest)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 relative group/coupon">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Next Coupon Date</span>
                <button
                  type="button"
                  onClick={() => setIsEditingCouponDate(true)}
                  className="p-1 text-slate-400 hover:text-amber-600 rounded-lg transition-colors cursor-pointer"
                  title="Edit Next Coupon Date"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-sm block mt-0.5">
                {formatDate(m.nextCouponPaymentDate)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Maturity Date</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-sm">
                {formatDate(m.maturityDate)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{m.remainingTenureText}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TABS: Overview vs Coupon Cash Flows vs Ledger */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Yield Analysis
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'schedule'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Coupon Cash Flows ({m.cashFlowSchedule.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ledger'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Transactions ({(holding.transactions || []).length})</span>
        </button>
      </div>

      {/* 3. TAB 1: YIELD ANALYSIS & BOND SPECIFICATIONS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Yield Comparison Card */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Percent className="w-4 h-4 text-amber-500" />
              <span>Yield Mechanics & Return Breakdown</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Coupon Rate</div>
                  <div className="text-[11px] text-slate-400">Fixed annual payout on Par Face Value</div>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-amber-600 dark:text-amber-400 text-sm tabular-nums">
                    {m.couponRate.toFixed(2)}% p.a.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Current Yield</div>
                  <div className="text-[11px] text-slate-400">Annual coupon relative to current market price</div>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm tabular-nums">
                    {m.currentYield.toFixed(2)}% p.a.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Yield to Maturity (YTM)</div>
                  <div className="text-[11px] text-slate-400">Total annualized return if held until {formatDate(m.maturityDate)}</div>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                    {m.ytm.toFixed(2)}% p.a.
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-slate-600 dark:text-slate-300">
              Bond yields fluctuate inversely with secondary market price. When market price is above face value (trading at premium), YTM is lower than coupon rate. When trading at discount, YTM exceeds the coupon rate.
            </div>
          </div>

          {/* Redemption & Principal Value Card */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Capital Return & Maturity Safety</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Maturity Date:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(m.maturityDate)}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Remaining Tenure:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{m.remainingTenureText}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Maturity Redemption Value:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                  ₹{formatINR(m.redemptionValue)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Periodic Coupon Payout:</span>
                <span className="font-extrabold text-amber-600 dark:text-amber-400 text-sm tabular-nums">
                  ₹{formatINR(m.periodicCouponAmount)} ({m.frequencyLabel})
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-[11px] text-slate-600 dark:text-slate-300">
              Par capital redemption is guaranteed by the issuer at maturity ({formatDate(m.maturityDate)}). Units will be redeemed at ₹{formatINR(m.faceValue)} par value per unit.
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: SCHEDULED COUPON CASH FLOWS */}
      {activeTab === 'schedule' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                <span>Upcoming Coupon Payouts & Maturity Schedule</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Projected cash flows generated by {m.unitsHeld} units @ {m.couponRate}% p.a.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 shrink-0">
              {m.frequencyLabel}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {m.cashFlowSchedule.map((flow, idx) => (
              <div
                key={idx}
                className="p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      flow.type === 'maturity'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {flow.type === 'maturity' ? <ShieldCheck className="w-4 h-4" /> : <Coins className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{flow.description}</div>
                    <div className="text-[11px] text-slate-400">{formatDate(flow.date)}</div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`text-xs sm:text-sm font-extrabold tabular-nums ${
                      flow.type === 'maturity' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    +₹{formatINR(flow.amount)}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {flow.type === 'maturity' ? 'Par Capital' : 'Coupon Payout'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. TAB 3: TRANSACTION LEDGER */}
      {activeTab === 'ledger' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-500" />
                <span>Bond Transaction History</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Purchases, sales, interest coupon receipts, and principal repayments
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenActionModal('coupon')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 hover:bg-amber-100 cursor-pointer"
              >
                + Coupon
              </button>
              <button
                onClick={() => onOpenActionModal('buy')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                + Buy
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {(holding.transactions || []).length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No transactions recorded yet. Tap "+ Coupon" or "+ Buy" to log an entry.
              </div>
            ) : (
              (holding.transactions || [])
                .slice()
                .reverse()
                .map((tx: InvestmentTransaction) => {
                  const isCoupon = tx.type === 'interest' || tx.type === 'coupon';
                  const isBuy = tx.type === 'buy';
                  const isSell = tx.type === 'sell' || tx.type === 'principal_repayment';

                  return (
                    <div
                      key={tx.id}
                      className="p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isCoupon
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : isBuy
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {isCoupon ? <Coins className="w-4 h-4" /> : isBuy ? <Plus className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate capitalize">
                            {isCoupon ? 'Coupon Interest Received' : `${tx.type} ${tx.quantity} units`}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>{formatDate(tx.date)}</span>
                            {tx.notes && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[200px]">{tx.notes}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div
                            className={`text-xs sm:text-sm font-extrabold tabular-nums ${
                              isCoupon
                                ? 'text-amber-600 dark:text-amber-400'
                                : isBuy
                                ? 'text-slate-900 dark:text-white'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            ₹{formatINR(tx.totalAmount || tx.price * tx.quantity)}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {isCoupon ? 'Income' : `@ ₹${formatINR(tx.price)}/un`}
                          </span>
                        </div>

                        {onDeleteTransaction && (
                          <button
                            type="button"
                            onClick={() => setTxToDelete(tx)}
                            className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Transaction Deletion Confirmation Modal */}
      {txToDelete && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Transaction?
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete this transaction? This will remove the ledger entry, delete linked passbook entries, and recalculate your portfolio balances.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteTransaction) onDeleteTransaction(txToDelete.id);
                  setTxToDelete(null);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs cursor-pointer text-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Next Coupon Date Modal */}
      {isEditingCouponDate && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Update Next Coupon Date
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingCouponDate(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCouponDate} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Coupon Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={customCouponDate}
                  onChange={(e) => setCustomCouponDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingCouponDate(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-xs cursor-pointer"
                >
                  Save Date
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
