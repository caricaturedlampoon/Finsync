import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { InvestmentHolding, InvestmentTransaction } from '../../../types';
import { computePfMetrics, getCurrentFinancialYear } from '../../../utils/bondsSgbPfEngine';
import { generatePfAccountReportHTML } from '../../../utils/assetReportEngine';
import { formatINR, formatDate, toInputDate } from '../../../utils/formatters';
import {
  PiggyBank,
  ShieldCheck,
  Calendar,
  Percent,
  Plus,
  Receipt,
  Clock,
  Info,
  CheckCircle2,
  Trash2,
  Briefcase,
  User,
  ArrowDownRight,
  TrendingUp,
  Download,
  Building2,
  FileText,
} from 'lucide-react';

interface PfDetailSectionProps {
  holding: InvestmentHolding;
  onOpenActionModal: (action: 'buy' | 'sell' | 'interest' | 'coupon') => void;
  onEditHolding: () => void;
  onDeleteTransaction?: (txId: string) => void;
  onOpenBulkSubscriptions?: () => void;
}

export const PfDetailSection: React.FC<PfDetailSectionProps> = ({
  holding,
  onOpenActionModal,
  onEditHolding,
  onDeleteTransaction,
  onOpenBulkSubscriptions,
}) => {
  const { openHtmlReportViewer } = useApp();
  const m = computePfMetrics(holding);
  const currentFY = getCurrentFinancialYear();
  const [activeTab, setActiveTab] = useState<'passbook' | 'breakdown' | 'transactions'>('passbook');
  const isEpf = m.pfType === 'EPF';

  const handleGenerateAccountReport = () => {
    const html = generatePfAccountReportHTML(holding);
    const safeName = m.accountName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const dateStr = toInputDate(new Date()).replace(/-/g, '');
    openHtmlReportViewer({
      htmlContent: html,
      title: `${m.accountName} - PF Account Audit Report`,
      fileName: `${safeName}-pf-report-${dateStr}.pdf`,
      badge: `${m.pfType} Account Report`,
      subtitle: `${m.accountName} · Corpus: ₹${formatINR(m.totalCorpusBalance)} · Rate: ${m.interestRate}% p.a.`,
      reportType: 'investment',
    });
  };

  return (
    <div className="space-y-6 pb-28 sm:pb-32">
      {/* 1. HERO METRIC SPOTLIGHT: Provident Fund Corpus */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        {/* Top Badges & Account Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                {m.pfTypeLabel}
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200/50 dark:border-cyan-800/50">
                {m.accountIdentifier}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                {m.interestRate}% p.a. Sovereign Interest
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60">
                XIRR: {m.xirr !== null ? `${m.xirr >= 0 ? '+' : ''}${m.xirr.toFixed(2)}% p.a.` : `${m.interestRate}%`}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Account Name: <span className="text-slate-800 dark:text-slate-200 font-bold">{m.accountName}</span>
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleGenerateAccountReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-xs transition-all cursor-pointer"
              title="Generate & Export Individual PF Account Audit Report"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PF Report</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenActionModal('buy')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 shadow-xs transition-all cursor-pointer"
              title="Add single contribution or deposit"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Contribution</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenActionModal('sell')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 shadow-xs transition-all cursor-pointer"
              title="Log partial or full withdrawal claim"
            >
              <ArrowDownRight className="w-3.5 h-3.5 rotate-180" />
              <span>Withdrawal</span>
            </button>

            {onOpenBulkSubscriptions && (
              <button
                type="button"
                onClick={onOpenBulkSubscriptions}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 shadow-xs transition-all cursor-pointer"
                title="Bulk generate monthly deposits across a date range"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Bulk Subscriptions</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenActionModal('interest')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 text-white font-bold text-xs hover:bg-cyan-700 shadow-xs transition-all cursor-pointer"
              title="Record annual interest credit"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Credit Interest</span>
            </button>
          </div>
        </div>

        {/* 4 Primary Corpus Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Total Corpus Balance */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 min-w-0 break-words whitespace-normal">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Corpus Balance
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              ₹{formatINR(m.totalCorpusBalance)}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
              +₹{formatINR(m.totalInterestCredited)} interest credited
            </div>
          </div>

          {/* Employee Contribution Total */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 min-w-0 break-words whitespace-normal">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Employee Share
            </span>
            <div className="text-xl sm:text-2xl font-black text-cyan-700 dark:text-cyan-400 tabular-nums">
              ₹{formatINR(m.totalEmployeeContributions)}
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              Personal monthly deduction
            </div>
          </div>

          {/* Employer Contribution (EPF) or Voluntary Share */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 min-w-0 break-words whitespace-normal">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              {isEpf ? 'Employer Share' : 'Voluntary (VPF) Share'}
            </span>
            <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
              ₹{formatINR(isEpf ? m.totalEmployerContributions : m.totalVoluntaryContributions)}
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              {isEpf ? 'Company matching share' : 'Additional voluntary deposits'}
            </div>
          </div>

          {/* Current FY Contributions */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 min-w-0 break-words whitespace-normal">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              {currentFY} Additions
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              ₹{formatINR(m.currentFyContributions)}
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              Est. Accrual: ~₹{formatINR(m.currentFyEstimatedInterest)}
            </div>
          </div>
        </div>

        {/* Detailed Account Metadata Grid */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">PF Scheme</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{m.pfType}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Interest Rate</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-sm">
                {m.interestRate}% p.a.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Monthly Deduction</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400 tabular-nums text-sm">
                {m.monthlySubscription?.enabled ? `₹${formatINR(m.monthlySubscription.totalMonthly)} / mo` : 'Manual'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Withdrawals</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-sm">
                ₹{formatINR(m.totalWithdrawals)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TABS: FY Passbook vs Account Breakdown vs Raw Ledger */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('passbook')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'passbook'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Annual Passbook ({m.financialYearLedger.length} FYs)</span>
        </button>
        <button
          onClick={() => setActiveTab('breakdown')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'breakdown'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Scheme Rules & Interest
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'transactions'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>All Transactions ({(holding.transactions || []).length})</span>
        </button>
      </div>

      {/* 3. TAB 1: AUTHENTIC INDIAN PF ANNUAL PASSBOOK */}
      {activeTab === 'passbook' && (
        <div className="space-y-4">
          {m.financialYearLedger.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              No financial year transactions found. Log a contribution or initial opening balance.
            </div>
          ) : (
            m.financialYearLedger.map((fyRecord) => (
              <div
                key={fyRecord.financialYear}
                className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                      {fyRecord.financialYear}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300">
                      {fyRecord.transactions.length} Entries
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Closing Balance</span>
                    <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                      ₹{formatINR(fyRecord.closingBalance)}
                    </span>
                  </div>
                </div>

                {/* Financial Year Summary Stats Table */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <span className="text-[10px] text-slate-400 block">Opening Balance</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                      ₹{formatINR(fyRecord.openingBalance)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <span className="text-[10px] text-slate-400 block">Employee Deposit</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                      ₹{formatINR(fyRecord.employeeContributions)}
                    </span>
                  </div>

                  {isEpf && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                      <span className="text-[10px] text-slate-400 block">Employer Deposit</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                        ₹{formatINR(fyRecord.employerContributions)}
                      </span>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <span className="text-[10px] text-slate-400 block">Interest Credited</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +₹{formatINR(fyRecord.interestCredited)}
                    </span>
                  </div>
                </div>

                {/* Individual Monthly Transaction Entries for this FY */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800/60 overflow-hidden">
                  {fyRecord.transactions.map((tx) => {
                    const isInterest = tx.type === 'interest' || tx.type === 'coupon';
                    const isWithdrawal = tx.type === 'sell' || tx.type === 'withdrawal';
                    const amt = tx.totalAmount || tx.quantity;

                    return (
                      <div
                        key={tx.id}
                        className="p-2.5 sm:p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-slate-400 font-mono text-[11px] shrink-0">
                            {formatDate(tx.date)}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {isInterest ? 'Annual Interest Credit' : isWithdrawal ? 'Corpus Withdrawal' : tx.notes || 'Monthly Contribution'}
                            </div>
                            {tx.employeeAmount !== undefined && (
                              <div className="text-[10px] text-slate-400">
                                Emp: ₹{formatINR(tx.employeeAmount)} {tx.employerAmount ? `· Empyr: ₹${formatINR(tx.employerAmount)}` : ''}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-bold tabular-nums text-xs ${
                              isInterest
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isWithdrawal
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {isWithdrawal ? '-' : '+'}₹{formatINR(amt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 4. TAB 2: SCHEME RULES & INTEREST METHODOLOGY */}
      {activeTab === 'breakdown' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Percent className="w-4 h-4 text-cyan-600" />
              <span>Interest Methodology</span>
            </h4>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <p>
                <strong>Calculation Method:</strong> {m.interestCalculationMethod}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Interest is computed on monthly running balances at {m.interestRate}% per annum, and credited annually at the end of each financial year (March 31) into your provident fund account.
              </p>
              <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200/60 dark:border-cyan-900/40 text-[11px]">
                Current {currentFY} Estimated Accrued Interest: <strong>₹{formatINR(m.currentFyEstimatedInterest)}</strong> (credited automatically upon FY closure).
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Exempt-Exempt-Exempt (EEE) Status</span>
            </h4>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Provident Funds enjoy full sovereign backing under the Ministry of Labour & Employment / Ministry of Finance.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <li>Contributions are tax-deductible under Section 80C (up to ₹1.5 Lakhs).</li>
                <li>Interest earned is completely tax-free.</li>
                <li>Withdrawals after 5 years of continuous service are 100% tax-exempt.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: ALL TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-cyan-600" />
                <span>Full Ledger History</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All monthly deposits, voluntary contributions, interest credits, and withdrawals
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenActionModal('interest')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/60 hover:bg-cyan-100 cursor-pointer"
              >
                + Interest
              </button>
              <button
                onClick={() => onOpenActionModal('buy')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                + Contribution
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {(holding.transactions || []).length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No transactions recorded yet. Tap "+ Contribution" to log a deposit.
              </div>
            ) : (
              (holding.transactions || [])
                .slice()
                .reverse()
                .map((tx: InvestmentTransaction) => {
                  const isInterest = tx.type === 'interest' || tx.type === 'coupon';
                  const isWithdrawal = tx.type === 'sell' || tx.type === 'withdrawal';
                  const amt = tx.totalAmount || tx.quantity;

                  return (
                    <div
                      key={tx.id}
                      className="p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isInterest
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : isWithdrawal
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
                          }`}
                        >
                          {isInterest ? <TrendingUp className="w-4 h-4" /> : isWithdrawal ? <ArrowDownRight className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate capitalize">
                            {isInterest ? 'Annual Interest Credit' : isWithdrawal ? 'Corpus Withdrawal' : tx.notes || 'PF Contribution'}
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
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isWithdrawal
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {isWithdrawal ? '-' : '+'}₹{formatINR(amt)}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {isInterest ? 'Interest' : isWithdrawal ? 'Debit' : 'Deposit'}
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
