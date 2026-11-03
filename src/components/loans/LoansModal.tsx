import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Loan, Account, Transaction } from '../../types';
import { formatINR, formatDate, toInputDate } from '../../utils/formatters';
import {
  calculateMonthlyEmi,
  calculateLoanSummary,
  generateAmortizationSchedule,
  generateHistoricalEmiCatchup,
  AmortizationScheduleRow,
} from '../../utils/loanAmortizationEngine';
import {
  X,
  Plus,
  Landmark,
  Percent,
  Calendar,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Scale,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ChevronRight,
  ArrowUpRight,
  ArrowLeftRight,
  Shield,
  Trash2,
  Edit2,
  DollarSign,
  PieChart as PieChartIcon,
  Calculator,
  Lock,
} from 'lucide-react';

interface LoansModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoansModal: React.FC<LoansModalProps> = ({ isOpen, onClose }) => {
  const {
    loans,
    accounts,
    transactions,
    categories,
    addLoan,
    updateLoan,
    deleteLoan,
    payLoanEmi,
    prepayLoan,
    showToast,
  } = useApp();

  const [activeLoanId, setActiveLoanId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPrepayOpen, setIsPrepayOpen] = useState(false);
  const [isEditScheduleOpen, setIsEditScheduleOpen] = useState(false);

  // Form states for New Loan
  const [loanName, setLoanName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [tenureYears, setTenureYears] = useState('5');
  const [startDate, setStartDate] = useState(toInputDate(new Date()));
  const [paymentDay, setPaymentDay] = useState('5');
  const [fundingAccountId, setFundingAccountId] = useState(() => {
    const bank = accounts.find((a) => !a.isArchived && a.type === 'bank' && !a.isLocked);
    return bank ? bank.id : accounts[0]?.id || '';
  });

  // Prepayment Form states
  const [prepayAmount, setPrepayAmount] = useState('');
  const [prepayDate, setPrepayDate] = useState(toInputDate(new Date()));
  const [prepayFee, setPrepayFee] = useState('');
  const [prepayFundingAcc, setPrepayFundingAcc] = useState('');

  // Selected Loan
  const selectedLoan = useMemo(() => {
    if (!activeLoanId && loans.length > 0) return loans[0];
    return loans.find((l) => l.id === activeLoanId) || loans[0] || null;
  }, [loans, activeLoanId]);

  // Selected Loan Financial Summary
  const loanSummary = useMemo(() => {
    if (!selectedLoan) return null;
    return calculateLoanSummary(selectedLoan, transactions, accounts);
  }, [selectedLoan, transactions, accounts]);

  // Selected Loan Amortization Schedule
  const amortizationSchedule = useMemo(() => {
    if (!selectedLoan) return [];
    return generateAmortizationSchedule(selectedLoan);
  }, [selectedLoan]);

  // Auto-compute suggested EMI during creation
  const suggestedEmi = useMemo(() => {
    const p = parseFloat(totalAmount) || 0;
    const r = parseFloat(interestRate) || 0;
    const tenureMonths = (parseFloat(tenureYears) || 5) * 12;
    if (p > 0 && tenureMonths > 0) {
      return calculateMonthlyEmi(p, r, tenureMonths);
    }
    return 0;
  }, [totalAmount, interestRate, tenureYears]);

  if (!isOpen) return null;

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(totalAmount);
    const r = parseFloat(interestRate);
    const emi = parseFloat(emiAmount) || suggestedEmi;
    const day = parseInt(paymentDay, 10);

    if (!loanName.trim()) {
      showToast('Please provide a Loan Name', 'error');
      return;
    }
    if (isNaN(p) || p <= 0) {
      showToast('Please enter a valid loan amount', 'error');
      return;
    }
    if (isNaN(r) || r < 0) {
      showToast('Please enter a valid annual interest rate', 'error');
      return;
    }
    if (isNaN(emi) || emi <= 0) {
      showToast('Please enter a valid monthly EMI amount', 'error');
      return;
    }
    if (!fundingAccountId) {
      showToast('Please select a funding bank account', 'error');
      return;
    }

    addLoan({
      name: loanName.trim(),
      totalAmount: p,
      interestRate: r,
      emiAmount: emi,
      startDate,
      paymentDay: day >= 1 && day <= 31 ? day : 5,
      fundingAccountId,
      tenureMonths: (parseFloat(tenureYears) || 5) * 12,
    });

    setIsCreateOpen(false);
    setLoanName('');
    setTotalAmount('');
    setInterestRate('');
    setEmiAmount('');
  };

  const handlePrepaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    const amt = parseFloat(prepayAmount);
    const fee = parseFloat(prepayFee) || 0;
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid prepayment amount', 'error');
      return;
    }
    const accId = prepayFundingAcc || selectedLoan.fundingAccountId;

    prepayLoan({
      loanId: selectedLoan.id,
      amount: amt,
      date: prepayDate,
      feeAmount: fee,
      fundingAccountId: accId,
    });

    setIsPrepayOpen(false);
    setPrepayAmount('');
    setPrepayFee('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
      {/* Top App Bar */}
      <header className="px-4 sm:px-6 py-3.5 sm:py-4 pt-safe border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Loan & EMI Management
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Locked System Accounts</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track amortizations, principal transfers, interest expenses & prepayments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">New Loan</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Loan Manager"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Loan Selection Tabs if multiple loans */}
      {loans.length > 1 && (
        <div className="flex overflow-x-auto gap-2 px-4 sm:px-6 py-2.5 border-b border-slate-200/80 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          {loans.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setActiveLoanId(l.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                selectedLoan?.id === l.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      {/* Main Full Screen Body */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-safe pb-24">
        <div className="max-w-5xl mx-auto space-y-6">
          {loans.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
                <Calculator className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  No Active Loans Configured
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Track your Home Loan, Car Loan, Education Loan, or Personal Loan. FinSync auto-generates locked accounts, historical EMI catch-ups, and principal-interest splits!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
              >
                + Add Your First Loan
              </button>
            </div>
          ) : selectedLoan && loanSummary ? (
            /* Active Loan Details & Analytics */
            <div className="space-y-6">
              {/* Top Summary Card */}
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                          {selectedLoan.name}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-indigo-200 border border-white/10">
                          {selectedLoan.interestRate}% p.a.
                        </span>
                      </div>
                      <p className="text-xs text-indigo-200/80 mt-0.5">
                        EMI: ₹{formatINR(selectedLoan.emiAmount)} / month · Due on {selectedLoan.paymentDay}th
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setIsPrepayOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Prepay / Lump Sum</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLoan(selectedLoan.id)}
                        className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/80 text-white transition-colors cursor-pointer"
                        title="Delete Loan & System Account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Visual Analytics Progress Bar */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-200">
                        Principal Repaid: ₹{formatINR(loanSummary.principalPaid)} ({loanSummary.repaymentProgressPercent.toFixed(1)}%)
                      </span>
                      <span className="font-bold text-white tabular-nums">
                        Remaining: ₹{formatINR(loanSummary.principalRemaining)}
                      </span>
                    </div>

                    {/* Amortization Progress Bar */}
                    <div className="w-full h-3.5 rounded-full bg-white/10 overflow-hidden p-0.5 flex">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500"
                        style={{ width: `${loanSummary.repaymentProgressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* 4 Analytics KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/10">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                        Total Borrowed
                      </span>
                      <div className="text-base sm:text-lg font-black tabular-nums mt-0.5">
                        ₹{formatINR(loanSummary.totalBorrowing)}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                        Total Paid (Principal+Int)
                      </span>
                      <div className="text-base sm:text-lg font-black tabular-nums mt-0.5 text-emerald-300">
                        ₹{formatINR(loanSummary.totalAmountPaid)}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                        Interest Paid So Far
                      </span>
                      <div className="text-base sm:text-lg font-black tabular-nums mt-0.5 text-rose-300">
                        ₹{formatINR(loanSummary.cumulativeInterestPaid)}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                        Next Due Date
                      </span>
                      <div className="text-base sm:text-lg font-black tabular-nums mt-0.5">
                        {loanSummary.nextDueDate ? formatDate(loanSummary.nextDueDate) : 'Completed'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Breakdown Ratio Chart (Cumulative Interest vs Principal Paid) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ratio Card */}
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <PieChartIcon className="w-4 h-4 text-indigo-500" />
                      <span>Cumulative Interest vs. Principal Ratio</span>
                    </h4>
                  </div>

                  {/* Dual Split Stacked Bar Chart */}
                  <div className="space-y-2">
                    <div className="w-full h-6 rounded-xl overflow-hidden flex bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full bg-emerald-500 transition-all flex items-center justify-center text-[10px] font-bold text-white px-2"
                        style={{ width: `${100 - loanSummary.interestToPrincipalRatio}%` }}
                      >
                        {100 - loanSummary.interestToPrincipalRatio > 15 && 'Principal'}
                      </div>
                      <div
                        className="h-full bg-rose-500 transition-all flex items-center justify-center text-[10px] font-bold text-white px-2"
                        style={{ width: `${loanSummary.interestToPrincipalRatio}%` }}
                      >
                        {loanSummary.interestToPrincipalRatio > 15 && 'Interest'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Principal: ₹{formatINR(loanSummary.principalPaid)} ({(100 - loanSummary.interestToPrincipalRatio).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Interest: ₹{formatINR(loanSummary.cumulativeInterestPaid)} ({loanSummary.interestToPrincipalRatio.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Principal portion reduces the locked loan liability balance directly via transfers. The interest component is accounted as an expense under "Interest Paid".
                  </p>
                </div>

                {/* Account Details & Flexibility */}
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-indigo-500" />
                    <span>Funding & System Account Details</span>
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Debited From (Bank):</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {accounts.find((a) => a.id === selectedLoan.fundingAccountId)?.name || 'Default Bank'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Locked System Account:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>{selectedLoan.name} (Locked)</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Monthly Payment Day:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {selectedLoan.paymentDay}th of every month
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsEditScheduleOpen(true)}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Amortization Schedule Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <span>Amortization Schedule & Historical Catch-up</span>
                  </h4>
                  <span className="text-xs text-slate-400">
                    {amortizationSchedule.length} Total Installments
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto bg-white dark:bg-slate-900 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3 px-3.5">#</th>
                        <th className="py-3 px-3.5">Due Date</th>
                        <th className="py-3 px-3.5 text-right">Opening (₹)</th>
                        <th className="py-3 px-3.5 text-right">EMI (₹)</th>
                        <th className="py-3 px-3.5 text-right text-emerald-600 dark:text-emerald-400">Principal (₹)</th>
                        <th className="py-3 px-3.5 text-right text-rose-500">Interest (₹)</th>
                        <th className="py-3 px-3.5 text-right">Closing (₹)</th>
                        <th className="py-3 px-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {amortizationSchedule.slice(0, 36).map((row) => (
                        <tr
                          key={row.monthIndex}
                          className={row.isHistorical ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''}
                        >
                          <td className="py-2.5 px-3.5 font-bold">{row.monthIndex}</td>
                          <td className="py-2.5 px-3.5">{formatDate(row.date)}</td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums">{formatINR(row.openingBalance)}</td>
                          <td className="py-2.5 px-3.5 text-right font-bold tabular-nums">{formatINR(row.emi)}</td>
                          <td className="py-2.5 px-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatINR(row.principal)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-semibold text-rose-500 tabular-nums">
                            {formatINR(row.interest)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums font-bold">
                            {formatINR(row.closingBalance)}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            {row.isHistorical ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Paid</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                <Clock className="w-3 h-3" />
                                <span>Upcoming</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {amortizationSchedule.length > 36 && (
                    <div className="p-2.5 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
                      Showing first 36 installments of {amortizationSchedule.length}.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>

        {/* Create Loan Modal Overlay */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-500" />
                  <span>Configure New Loan</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateLoan} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Loan Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC Home Loan, Car Loan, Education Loan"
                    value={loanName}
                    onChange={(e) => setLoanName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Total Loan Amount (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1000"
                      step="any"
                      placeholder="e.g. 2500000"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Annual Interest Rate (%) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="40"
                      step="0.01"
                      placeholder="e.g. 8.5"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Monthly EMI Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="100"
                      step="any"
                      placeholder={suggestedEmi > 0 ? `Calculated: ₹${suggestedEmi}` : 'e.g. 35000'}
                      value={emiAmount}
                      onChange={(e) => setEmiAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white"
                    />
                    {suggestedEmi > 0 && (
                      <button
                        type="button"
                        onClick={() => setEmiAmount(String(suggestedEmi))}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-1 hover:underline block"
                      >
                        Auto-fill: ₹{formatINR(suggestedEmi)}/mo
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Estimated Tenure (Years)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={tenureYears}
                      onChange={(e) => setTenureYears(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      EMI Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Monthly Payment Day (1-31) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      required
                      value={paymentDay}
                      onChange={(e) => setPaymentDay(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Debit Funding Bank Account *
                  </label>
                  <select
                    value={fundingAccountId}
                    onChange={(e) => setFundingAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs text-slate-900 dark:text-white"
                  >
                    {accounts
                      .filter((a) => !a.isArchived && !a.isLocked && a.type !== 'debt')
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type.toUpperCase()} · ₹{formatINR(acc.balance)})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 text-[11px] text-indigo-900 dark:text-indigo-200 space-y-1">
                  <p className="font-bold">✨ Historical Auto-Catchup:</p>
                  <p>
                    If the Start Date is in the past, FinSync will automatically generate all historical EMI transfers and interest expenses up to today, accurately syncing your account balances!
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/20"
                  >
                    Create & Catchup Loan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Prepayment / Extra Payment Modal Overlay */}
        {isPrepayOpen && selectedLoan && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-500" />
                  <span>Log Lump-Sum Prepayment</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsPrepayOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePrepaymentSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Prepayment Principal Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="100"
                    step="any"
                    placeholder="e.g. 50000"
                    value={prepayAmount}
                    onChange={(e) => setPrepayAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    This amount directly reduces your negative loan principal balance.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={prepayDate}
                      onChange={(e) => setPrepayDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Prepayment Fee / Charge (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={prepayFee}
                      onChange={(e) => setPrepayFee(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Funding Account
                  </label>
                  <select
                    value={prepayFundingAcc || selectedLoan.fundingAccountId}
                    onChange={(e) => setPrepayFundingAcc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs text-slate-900 dark:text-white"
                  >
                    {accounts
                      .filter((a) => !a.isArchived && !a.isLocked && a.type !== 'debt')
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} (₹{formatINR(acc.balance)})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPrepayOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/20"
                  >
                    Record Prepayment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Payment Day Schedule Overlay */}
        {isEditScheduleOpen && selectedLoan && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Update Monthly Payment Day
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    New Monthly Due Day (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    defaultValue={selectedLoan.paymentDay}
                    id="newPaymentDayInput"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditScheduleOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const val = parseInt((document.getElementById('newPaymentDayInput') as HTMLInputElement)?.value, 10);
                      if (val >= 1 && val <= 31) {
                        updateLoan(selectedLoan.id, { paymentDay: val });
                        setIsEditScheduleOpen(false);
                        showToast(`Monthly payment day updated to ${val}th`, 'success');
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full Screen Footer Bar */}
        <footer className="px-4 sm:px-6 py-3 border-t border-slate-200/80 dark:border-slate-800 flex justify-end shrink-0 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors"
          >
            Close
          </button>
        </footer>
      </div>
  );
};
