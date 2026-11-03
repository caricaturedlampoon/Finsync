import React, { useState } from 'react';
import { InvestmentHolding, InvestmentTransaction } from '../../../types';
import { computeSgbMetrics } from '../../../utils/bondsSgbPfEngine';
import { formatINR, formatDate } from '../../../utils/formatters';
import {
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Scale,
  ShieldCheck,
  Plus,
  Receipt,
  Clock,
  Info,
  CheckCircle2,
  Trash2,
  Lock,
  Unlock,
  AlertCircle,
} from 'lucide-react';

interface SgbDetailSectionProps {
  holding: InvestmentHolding;
  liveGoldPrice?: number;
  onOpenActionModal: (action: 'buy' | 'sell' | 'coupon' | 'interest') => void;
  onEditHolding: () => void;
  onDeleteTransaction?: (txId: string) => void;
}

export const SgbDetailSection: React.FC<SgbDetailSectionProps> = ({
  holding,
  liveGoldPrice,
  onOpenActionModal,
  onEditHolding,
  onDeleteTransaction,
}) => {
  const m = computeSgbMetrics(holding, liveGoldPrice);
  const isProfit = m.unrealizedGoldGain >= 0;
  const [activeTab, setActiveTab] = useState<'overview' | 'redemption' | 'ledger'>('overview');

  return (
    <div className="space-y-6">
      {/* 1. HERO METRIC SPOTLIGHT: SGB Gold-Linked Valuation */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        {/* Top Badges & Tranche Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">
                Sovereign Gold Bond Tranche
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-yellow-50 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 border border-yellow-200/50 dark:border-yellow-800/50">
                {m.gramsHeld} {m.gramsHeld === 1 ? 'Gram' : 'Grams'} Held
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                2.50% Sovereign Interest
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60">
                XIRR: {m.xirr !== null ? `${m.xirr >= 0 ? '+' : ''}${m.xirr.toFixed(2)}% p.a.` : 'N/A'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Tranche / Series: <span className="text-slate-800 dark:text-slate-200 font-bold">{m.trancheName}</span>
              {m.rbiSeriesCode && <span className="text-xs text-slate-400 ml-1">({m.rbiSeriesCode})</span>}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenActionModal('interest')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-500 text-white font-bold text-xs hover:bg-yellow-600 shadow-xs transition-all cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Record Interest</span>
            </button>
            <button
              onClick={() => onOpenActionModal('buy')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Grams</span>
            </button>
          </div>
        </div>

        {/* 4 Primary SGB Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Current Gold-Linked Value */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 min-w-0 break-words whitespace-normal">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Current Gold Valuation
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              ₹{formatINR(m.currentGoldValue)}
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              {m.gramsHeld}g @ ₹{formatINR(m.goldReferencePrice)}/g
            </div>
          </div>

          {/* Gold Capital Appreciation */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 min-w-0 break-words whitespace-normal">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Gold Capital Gain
            </span>
            <div
              className={`text-xl sm:text-2xl font-black tabular-nums flex items-center gap-1 ${
                isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {isProfit ? <ArrowUpRight className="w-5 h-5 shrink-0" /> : <ArrowDownRight className="w-5 h-5 shrink-0" />}
              <span>
                {isProfit ? '+' : ''}₹{formatINR(m.unrealizedGoldGain)}
              </span>
            </div>
            <div className={`text-[11px] font-semibold tabular-nums ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {isProfit ? '+' : ''}{m.unrealizedGoldGainPercent.toFixed(2)}% on ₹{formatINR(m.totalInvested)}
            </div>
          </div>

          {/* Annual Sovereign Interest */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 min-w-0 break-words whitespace-normal">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Annual Interest (2.5%)
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              ₹{formatINR(m.annualInterestIncome)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
              ₹{formatINR(m.semiAnnualInterestPayout)} every 6 months
            </div>
          </div>

          {/* Total Interest Received */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 min-w-0 break-words whitespace-normal">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Interest Earned To Date
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              ₹{formatINR(m.totalInterestReceived)}
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              Credited directly to Bank
            </div>
          </div>
        </div>

        {/* Tranche & RBI Issue Specifications Grid */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Units in Grams</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-sm">
                {m.gramsHeld} Grams
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">RBI Issue Price</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-sm">
                ₹{formatINR(m.rbiIssuePrice)} / g
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Purchase Rate</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-sm">
                ₹{formatINR(m.purchasePricePerGram)} / g
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Gold Reference</span>
              <span className="font-bold text-yellow-600 dark:text-yellow-400 tabular-nums text-sm">
                ₹{formatINR(m.goldReferencePrice)} / g
              </span>
              <span className="text-[9px] text-slate-400 block">{m.goldPriceSource.split('(')[0]}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Issue Date</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-sm">
                {formatDate(m.issueDate)}
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

      {/* 2. SUB-NAVIGATION TABS: Overview vs Premature Exit vs Ledger */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Gold Scheme Rules
        </button>
        <button
          onClick={() => setActiveTab('redemption')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'redemption'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Premature Redemption & Exit</span>
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
          <span>Ledger History ({(holding.transactions || []).length})</span>
        </button>
      </div>

      {/* 3. TAB 1: GOLD SCHEME RULES & DUAL BENEFIT ANALYSIS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sovereign Interest Rule Details */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-500" />
              <span>SGB Interest Calculation Mechanics</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-yellow-50/70 dark:bg-yellow-950/40 border border-yellow-200/60 dark:border-yellow-900/40 space-y-1">
                <div className="font-bold text-yellow-900 dark:text-yellow-200">
                  Calculated Strictly on Original Issue Price
                </div>
                <div className="text-[11px] text-yellow-800/80 dark:text-yellow-300/80">
                  Per RBI directives, the 2.50% annual coupon is calculated on the initial allotment price (₹{formatINR(m.rbiIssuePrice)}/g), NOT on fluctuating secondary market gold rates.
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Applicable Sovereign Rate:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">2.50% p.a.</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Payment Schedule:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Semi-annually (Every 6 months)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Semi-Annual Credit to Bank:</span>
                <span className="font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                  ₹{formatINR(m.semiAnnualInterestPayout)}
                </span>
              </div>
            </div>
          </div>

          {/* Tax-Exemption & Capital Protection */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Tax Advantages & Sovereign Guarantee</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Capital Gains Tax on Maturity:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">100% Tax-Exempt (Sec 47)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Sovereign Credit Risk:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Zero (Backed by Govt of India)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Holding Format:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Demat / RBI Certificate</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Combined Value Created:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ₹{formatINR(m.totalRealizedAndUnrealizedReturn)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-[11px] text-slate-600 dark:text-slate-300">
              Unlike physical gold jewelry or ETFs, SGBs carry zero making charges, zero GST, zero storage costs, and pay additional cash income while retaining full upside of pure gold prices.
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: PREMATURE REDEMPTION & EXIT ELIGIBILITY */}
      {activeTab === 'redemption' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span>Premature Exit Window & Maturity Timelines</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Rules governing premature RBI redemptions vs secondary stock exchange exits
              </p>
            </div>
            {m.isPrematureRedemptionEligible ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60 flex items-center gap-1">
                <Unlock className="w-3.5 h-3.5" />
                <span>Eligible for Exit</span>
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/60 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Lock-in Active</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* 5-Year Premature Window */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                5-Year RBI Premature Exit Window
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                RBI permits premature redemption from the 5th year onward, strictly on interest payout dates. Redemption price is determined by the simple average of closing gold prices of 999 purity for the previous 3 business days published by IBJA.
              </p>
              <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                <span className="text-slate-400">5-Year Threshold Date:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(m.prematureRedemptionDate)}</span>
              </div>
            </div>

            {/* 8-Year Final Maturity */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                8-Year Final Sovereign Maturity
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                At final maturity (8 years from allotment), the gold bonds are automatically redeemed by RBI with proceeds credited directly to your bank account. Capital gains are completely tax-free under Section 47(viic).
              </p>
              <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                <span className="text-slate-400">Final Maturity Date:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(m.maturityDate)} ({m.remainingTenureText})</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200/60 dark:border-yellow-900/40 text-xs text-yellow-900 dark:text-yellow-200 flex items-start gap-2">
            <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <strong>Secondary Exchange Liquidity:</strong> Even during the initial 5-year lock-in period, dematerialized SGB units can be bought or sold freely on the NSE / BSE stock exchanges at prevailing market quotes.
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: TRANSACTION LEDGER */}
      {activeTab === 'ledger' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-yellow-500" />
                <span>SGB Tranche Ledger</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Allotments, secondary market purchases, semi-annual interest payouts, and redemptions
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenActionModal('interest')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border border-yellow-200/60 dark:border-yellow-800/60 hover:bg-yellow-100 cursor-pointer"
              >
                + Interest
              </button>
              <button
                onClick={() => onOpenActionModal('buy')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                + Add Grams
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {(holding.transactions || []).length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No transactions recorded yet. Tap "+ Interest" or "+ Add Grams" to log an entry.
              </div>
            ) : (
              (holding.transactions || [])
                .slice()
                .reverse()
                .map((tx: InvestmentTransaction) => {
                  const isInterest = tx.type === 'interest' || tx.type === 'coupon';
                  const isBuy = tx.type === 'buy';

                  return (
                    <div
                      key={tx.id}
                      className="p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isInterest
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/60 dark:text-yellow-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {isInterest ? <Coins className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate capitalize">
                            {isInterest ? 'Semi-Annual SGB Interest' : `Purchased ${tx.quantity} Grams`}
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
                              isInterest
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            ₹{formatINR(tx.totalAmount || tx.price * tx.quantity)}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {isInterest ? 'Interest Income' : `@ ₹${formatINR(tx.price)}/g`}
                          </span>
                        </div>

                        {onDeleteTransaction && (
                          <button
                            type="button"
                            onClick={() => onDeleteTransaction(tx.id)}
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
    </div>
  );
};
