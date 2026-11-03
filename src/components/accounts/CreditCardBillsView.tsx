import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Account, Transaction, PassbookRow } from '../../types';
import {
  formatINR,
  formatDate,
  parseDate,
  formatDateTimeHHMM,
  getTransactionTimestamp,
  adjustHexColor,
  isColorLight,
  toInputDate,
} from '../../utils/formatters';
import { AccountAvatar } from '../common/AccountAvatar';
import { IconRenderer } from '../common/IconRenderer';
import { CreditCardPayModal } from './CreditCardPayModal';
import { TransactionModal } from '../transactions/TransactionModal';
import { fileService } from '../../services/fileService';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Receipt,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Download,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpDown,
  Edit2,
  Trash2,
  Sparkles,
  Settings,
} from 'lucide-react';

interface BillingCycle {
  id: string;
  label: string;
  subLabel: string;
  isCurrent: boolean;
  isPrevious: boolean;
  cycleMonthIndex: number;
  cycleYear: number;
  startDate: Date;
  endDate: Date;
  formattedRange: string;
  dueDate: Date | null;
  formattedDueDate: string | null;
  transactions: Transaction[];
  totalSpend: number;
  totalPayments: number;
  netAmount: number;
  status: 'active' | 'paid' | 'due' | 'zero';
}

interface CreditCardBillsViewProps {
  account: Account;
  isOpen: boolean;
  onClose: () => void;
}

export const CreditCardBillsView: React.FC<CreditCardBillsViewProps> = ({
  account,
  isOpen,
  onClose,
}) => {
  const { transactions, updateAccount, deleteTransaction } = useApp();

  useEffect(() => {
    if (isOpen) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [isOpen, account.id]);

  // Selected cycle to view individual statement passbook
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  // Search and filters inside statement passbook
  const [filterType, setFilterType] = useState<'all' | 'debit' | 'credit'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // Quick Pay Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payTargetAmount, setPayTargetAmount] = useState<number | undefined>(undefined);

  // Edit / Delete Transaction Modal inside Bills
  const [selectedRowForAction, setSelectedRowForAction] = useState<PassbookRow | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState(false);

  // Configure Bill Cycle Day Modal
  const [isCycleConfigOpen, setIsCycleConfigOpen] = useState(false);
  const [editCycleDay, setEditCycleDay] = useState(account.billingCycleDay?.toString() || '25');
  const [editDueDay, setEditDueDay] = useState(account.paymentDueDay?.toString() || '');

  // Bill day defaults to account.billingCycleDay or 25
  const billDay = account.billingCycleDay || 25;
  const paymentDueDay = account.paymentDueDay;

  // Generate 18 historical and active cycles
  const billingCycles = useMemo<BillingCycle[]>(() => {
    const cycles: BillingCycle[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed
    const todayDate = today.getDate();

    // Determine the anchor target month/year for the "Current Month" cycle
    // If todayDate >= billDay, the current active cycle ends in (currentMonth + 1)
    // If todayDate < billDay, the current active cycle ends in currentMonth
    let anchorYear = currentYear;
    let anchorMonth = todayDate >= billDay ? currentMonth + 1 : currentMonth;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Filter all transactions concerning this credit card
    const cardTransactions = transactions.filter(
      (tx) => tx.fromAccountId === account.id || tx.toAccountId === account.id
    );

    for (let offset = 0; offset < 18; offset++) {
      // Target end month for this cycle
      let endMonth = anchorMonth - offset;
      let endYear = anchorYear;
      while (endMonth < 0) {
        endMonth += 12;
        endYear -= 1;
      }

      // Start month is endMonth - 1
      let startMonth = endMonth - 1;
      let startYear = endYear;
      if (startMonth < 0) {
        startMonth += 12;
        startYear -= 1;
      }

      // Compute exact Start Date: billDay of startMonth at 00:00:00
      const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate();
      const actualStartDay = Math.min(billDay, daysInStartMonth);
      const startDate = new Date(startYear, startMonth, actualStartDay, 0, 0, 0, 0);

      // Compute exact End Date: (billDay - 1) of endMonth at 23:59:59.999
      let actualEndDay: number;
      if (billDay === 1) {
        // Special case: 1st of month means entire startMonth
        const daysInMonth = new Date(startYear, startMonth + 1, 0).getDate();
        actualEndDay = daysInMonth;
      } else {
        const daysInEndMonth = new Date(endYear, endMonth + 1, 0).getDate();
        actualEndDay = Math.min(billDay - 1, daysInEndMonth);
      }
      const endDate = billDay === 1
        ? new Date(startYear, startMonth, actualEndDay, 23, 59, 59, 999)
        : new Date(endYear, endMonth, actualEndDay, 23, 59, 59, 999);

      // Compute Due Date
      let dueDate: Date | null = null;
      let formattedDueDate: string | null = null;
      if (paymentDueDay) {
        // Due day in the month of cycle end or following
        let dueMonth = endMonth;
        let dueYear = endYear;
        if (paymentDueDay <= actualEndDay) {
          dueMonth += 1;
          if (dueMonth > 11) {
            dueMonth = 0;
            dueYear += 1;
          }
        }
        const daysInDueMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
        const actualDueDay = Math.min(paymentDueDay, daysInDueMonth);
        dueDate = new Date(dueYear, dueMonth, actualDueDay, 23, 59, 59);
        formattedDueDate = `${actualDueDay} ${monthNames[dueMonth]} ${dueYear}`;
      } else {
        // Default standard grace period ~15-20 days after bill generation
        const estimatedDue = new Date(endDate);
        estimatedDue.setDate(estimatedDue.getDate() + 18);
        dueDate = estimatedDue;
        formattedDueDate = `${estimatedDue.getDate()} ${monthNames[estimatedDue.getMonth()]} ${estimatedDue.getFullYear()}`;
      }

      // Filter transactions within [startDate, endDate]
      const cycleTxs = cardTransactions.filter((tx) => {
        const txTimestamp = getTransactionTimestamp(tx);
        return txTimestamp >= startDate.getTime() && txTimestamp <= endDate.getTime();
      });

      // Calculate totals:
      // Debit = spend/expense from card or transfer out
      // Credit = payment received into card or refund/transfer in
      let totalSpend = 0;
      let totalPayments = 0;

      cycleTxs.forEach((tx) => {
        if (tx.fromAccountId === account.id) {
          totalSpend += tx.amount;
        }
        if (tx.toAccountId === account.id) {
          totalPayments += tx.amount;
        }
      });

      const netAmount = totalSpend - totalPayments;

      // Status determination
      let status: 'active' | 'paid' | 'due' | 'zero' = 'due';
      if (offset === 0) {
        status = 'active';
      } else if (totalSpend === 0 && totalPayments === 0) {
        status = 'zero';
      } else if (netAmount <= 0) {
        status = 'paid';
      } else {
        status = 'due';
      }

      // Cycle Label naming as requested:
      // 0: "Current Month"
      // 1: "Previous Month"
      // 2+: "Sep 2024", "Aug 2024", etc.
      let label = '';
      let subLabel = '';
      if (offset === 0) {
        label = 'Current Month';
        subLabel = `Active Statement • ${fullMonthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;
      } else if (offset === 1) {
        label = 'Previous Month';
        subLabel = `Generated Statement • ${fullMonthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;
      } else {
        label = `${monthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;
        subLabel = `${fullMonthNames[endDate.getMonth()]} ${endDate.getFullYear()} Statement`;
      }

      const formattedRange = `${startDate.getDate()} ${monthNames[startDate.getMonth()]} ${startDate.getFullYear()} – ${endDate.getDate()} ${monthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;

      cycles.push({
        id: `cycle-${endYear}-${endMonth}-${offset}`,
        label,
        subLabel,
        isCurrent: offset === 0,
        isPrevious: offset === 1,
        cycleMonthIndex: endMonth,
        cycleYear: endYear,
        startDate,
        endDate,
        formattedRange,
        dueDate,
        formattedDueDate,
        transactions: cycleTxs,
        totalSpend,
        totalPayments,
        netAmount,
        status,
      });
    }

    return cycles;
  }, [transactions, account.id, billDay, paymentDueDay]);

  // Selected active cycle object
  const activeCycle = useMemo(() => {
    if (!selectedCycleId) return null;
    return billingCycles.find((c) => c.id === selectedCycleId) || null;
  }, [billingCycles, selectedCycleId]);

  // Prepare passbook rows for the selected cycle
  const cyclePassbookRows = useMemo<PassbookRow[]>(() => {
    if (!activeCycle) return [];

    // Sort transactions chronologically to calculate running cycle balance
    const sortedChronological = [...activeCycle.transactions].sort((a, b) => {
      const timeA = getTransactionTimestamp(a);
      const timeB = getTransactionTimestamp(b);
      return timeA - timeB;
    });

    let runningSpend = 0;
    const rows: PassbookRow[] = sortedChronological.map((tx) => {
      const isDebit = tx.fromAccountId === account.id;
      const isCredit = tx.toAccountId === account.id;

      if (isDebit) {
        runningSpend += tx.amount;
      }
      if (isCredit) {
        runningSpend -= tx.amount;
      }

      let description = tx.categoryName || 'Transaction';
      if (tx.type === 'transfer') {
        description = isCredit ? `Payment from ${tx.fromAccountName}` : `Transfer to ${tx.toAccountName}`;
      }

      return {
        transaction: tx,
        dateFormatted: formatDate(tx.date),
        debit: isDebit ? tx.amount : null,
        credit: isCredit ? tx.amount : null,
        balanceAfter: runningSpend,
        description,
        isAdjustment: Boolean(tx.isBalanceAdjustment),
      };
    });

    return rows;
  }, [activeCycle, account.id]);

  // Filter & sort for the active cycle's passbook rows
  const filteredCycleRows = useMemo(() => {
    return cyclePassbookRows.filter((row) => {
      if (filterType === 'debit' && row.debit === null) return false;
      if (filterType === 'credit' && row.credit === null) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchDesc = row.description.toLowerCase().includes(q);
        const matchCat = row.transaction.categoryName?.toLowerCase().includes(q);
        const matchNote = row.transaction.note?.toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchNote) return false;
      }
      return true;
    });
  }, [cyclePassbookRows, filterType, searchTerm]);

  const sortedCycleRows = useMemo(() => {
    const list = [...filteredCycleRows];
    switch (sortBy) {
      case 'date-desc':
        return list.sort((a, b) => getTransactionTimestamp(b.transaction) - getTransactionTimestamp(a.transaction));
      case 'date-asc':
        return list.sort((a, b) => getTransactionTimestamp(a.transaction) - getTransactionTimestamp(b.transaction));
      case 'amount-desc':
        return list.sort((a, b) => b.transaction.amount - a.transaction.amount);
      case 'amount-asc':
        return list.sort((a, b) => a.transaction.amount - b.transaction.amount);
      default:
        return list;
    }
  }, [filteredCycleRows, sortBy]);

  // Export current cycle statement to CSV
  const handleExportCycleCSV = () => {
    if (!activeCycle) return;
    const headers = [
      'Date',
      'Time',
      'Description',
      'Category',
      'Type',
      'Debit (Spent)',
      'Credit (Paid)',
      'Net Cycle Balance',
      'Note',
    ];

    const rows = sortedCycleRows.map((row) => {
      const tx = row.transaction;
      const dateFormatted = formatDate(tx.date);
      const timeFormatted = tx.time || '';
      return [
        `"${dateFormatted}"`,
        `"${timeFormatted}"`,
        `"${(row.description || '').replace(/"/g, '""')}"`,
        `"${(tx.categoryName || '').replace(/"/g, '""')}"`,
        `"${tx.type}"`,
        row.debit !== null ? row.debit.toFixed(2) : '',
        row.credit !== null ? row.credit.toFixed(2) : '',
        row.balanceAfter.toFixed(2),
        `"${(tx.note || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const filename = `Bill_${account.name.replace(/\s+/g, '_')}_${activeCycle.label.replace(/\s+/g, '_')}.csv`;
    fileService.exportAndShare({
      filename,
      content: csvContent,
      mimeType: 'text/csv;charset=utf-8;',
      title: `${account.name} Statement (${activeCycle.label})`,
      dialogTitle: 'Save or Share Credit Card Statement',
    });
  };

  // Handle saving cycle day configuration
  const handleSaveCycleConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const cycleDayNum = parseInt(editCycleDay, 10);
    const dueDayNum = editDueDay ? parseInt(editDueDay, 10) : undefined;

    if (isNaN(cycleDayNum) || cycleDayNum < 1 || cycleDayNum > 31) return;

    updateAccount(account.id, {
      billingCycleDay: cycleDayNum,
      paymentDueDay: dueDayNum && !isNaN(dueDayNum) ? dueDayNum : undefined,
    });

    setIsCycleConfigOpen(false);
  };

  if (!isOpen) return null;

  const accountColor = account.color || '#4f46e5';
  const darkerColor = adjustHexColor(accountColor, -24);
  const isLight = isColorLight(accountColor);
  const textColorClass = isLight ? 'text-slate-900' : 'text-white';

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Main Navigation Header */}
      <div className="px-4 py-3.5 sm:px-6 sm:py-4 pt-safe border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3 shadow-2xs z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (selectedCycleId) {
                // If in cycle passbook detail, go back to cycles list
                setSelectedCycleId(null);
              } else {
                // Otherwise exit Bills view back to Passbook
                onClose();
              }
            }}
            className="p-2 -ml-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
            title={selectedCycleId ? 'Back to Bills list' : 'Back to Passbook'}
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <AccountAvatar account={account} size="sm" />

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
              <Receipt className="w-5 h-5 text-indigo-500 shrink-0" />
              <span className="truncate">
                {selectedCycleId && activeCycle ? `${activeCycle.label} Passbook` : `${account.name} Bills`}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {selectedCycleId && activeCycle
                ? `${activeCycle.formattedRange}`
                : `Billing Cycle on ${billDay}th of month • ${billingCycles.length} Statements`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedCycleId && activeCycle && (
            <button
              type="button"
              onClick={handleExportCycleCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Export statement as CSV"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Export Statement</span>
            </button>
          )}

          {!selectedCycleId && (
            <button
              type="button"
              onClick={() => setIsCycleConfigOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Configure bill generation day"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Bill Date: {billDay}th</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            title="Close Bills"
            aria-label="Close Bills"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-safe pb-28">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ========================================================================= */}
          {/* VIEW A: BILLING CYCLES LIST (VERTICALLY ARRANGED CARDS)                  */}
          {/* ========================================================================= */}
          {!selectedCycleId && (
            <div className="space-y-6">
              {/* Top Overview Banner */}
              <div
                style={{
                  background: `linear-gradient(135deg, ${accountColor} 0%, ${darkerColor} 100%)`,
                  boxShadow: `0 16px 36px -8px ${accountColor}45, 0 8px 16px -4px ${accountColor}25`,
                }}
                className={`relative p-5 sm:p-6 rounded-3xl border border-white/20 shadow-xl overflow-hidden ${textColorClass}`}
              >
                <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-white/15 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-black/20 blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Credit Card Billing Cycles
                    </span>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-xs">
                      {account.name}
                    </h1>
                    <p className="text-xs opacity-90 max-w-md">
                      Monthly statements generated on the <strong>{billDay}th</strong> of every month. Each cycle runs from <strong>{billDay}th</strong> of previous month to <strong>{billDay === 1 ? 'month-end' : `${billDay - 1}th`}</strong> of this month.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">
                        Live Outstanding
                      </span>
                      <span className="text-lg sm:text-xl font-black tabular-nums">
                        ₹{formatINR(Math.max(0, -account.balance))}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPayTargetAmount(Math.max(0, -account.balance));
                        setIsPayModalOpen(true);
                      }}
                      className="px-4 py-3 bg-white text-rose-700 hover:bg-white/95 rounded-2xl text-xs font-bold shadow-lg flex items-center gap-2 transition-all cursor-pointer active:scale-95 shrink-0"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Pay Total Due</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Cycle Cards Section Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <span>Monthly Statements & Cycles</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tap any billing card to open its custom cycle passbook and detailed transactions.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {billingCycles.length} Cycles
                </span>
              </div>

              {/* Vertically Arranged Billing Cards */}
              <div className="space-y-3.5">
                {billingCycles.map((cycle) => {
                  const isCurrent = cycle.isCurrent;
                  const isPrevious = cycle.isPrevious;

                  return (
                    <div
                      key={cycle.id}
                      onClick={() => setSelectedCycleId(cycle.id)}
                      className={`group relative p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer overflow-hidden ${
                        isCurrent
                          ? 'bg-gradient-to-r from-indigo-50/80 via-white to-sky-50/50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-sky-950/20 border-indigo-200 dark:border-indigo-800/80 shadow-md hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 ring-1 ring-indigo-500/10'
                          : isPrevious
                          ? 'bg-gradient-to-r from-amber-50/60 via-white to-orange-50/40 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 border-amber-200/80 dark:border-amber-800/60 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Left: Cycle identity & date range */}
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div
                            className={`p-3 rounded-2xl shrink-0 transition-transform group-hover:scale-105 ${
                              isCurrent
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                : isPrevious
                                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <Receipt className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                                {cycle.label}
                              </h4>

                              {/* Badges */}
                              {isCurrent && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                  <Clock className="w-3 h-3" />
                                  <span>Current Cycle (Unbilled)</span>
                                </span>
                              )}
                              {isPrevious && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Latest Bill</span>
                                </span>
                              )}

                              {cycle.status === 'paid' && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Paid</span>
                                </span>
                              )}
                              {cycle.status === 'due' && !isCurrent && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Payment Due</span>
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{cycle.formattedRange}</span>
                            </p>

                            {cycle.formattedDueDate && (
                              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                Payment Due: <span className="text-indigo-600 dark:text-indigo-400">{cycle.formattedDueDate}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Metrics & CTA */}
                        <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                          {/* Total Spend */}
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                              Total Spend
                            </span>
                            <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                              ₹{formatINR(cycle.totalSpend)}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              {cycle.transactions.length} {cycle.transactions.length === 1 ? 'tx' : 'txs'}
                            </span>
                          </div>

                          {/* Net / Paid */}
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                              {isCurrent ? 'Net Unbilled' : 'Net Billed'}
                            </span>
                            <span
                              className={`text-sm sm:text-base font-extrabold tabular-nums ${
                                cycle.netAmount > 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              ₹{formatINR(Math.max(0, cycle.netAmount))}
                            </span>
                            {cycle.totalPayments > 0 && (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block">
                                Paid: ₹{formatINR(cycle.totalPayments)}
                              </span>
                            )}
                          </div>

                          {/* Action Arrow */}
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/50 transition-colors shrink-0">
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW B: CUSTOM DATE SELECTED CYCLE PASSBOOK TRANSACTIONS                   */}
          {/* ========================================================================= */}
          {selectedCycleId && activeCycle && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Back to all cycles pill */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedCycleId(null)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>All Billing Cycles</span>
                </button>

                <span className="text-xs text-slate-400 font-medium">
                  Cycle Interval: {activeCycle.formattedRange}
                </span>
              </div>

              {/* Top Summary Card for this Selected Billing Cycle */}
              <div
                style={{
                  background: `linear-gradient(135deg, ${accountColor} 0%, ${darkerColor} 100%)`,
                  boxShadow: `0 16px 36px -8px ${accountColor}45, 0 8px 16px -4px ${accountColor}25`,
                }}
                className={`relative p-5 sm:p-6 rounded-3xl border border-white/20 shadow-xl overflow-hidden ${textColorClass}`}
              >
                <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-white/15 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-black/20 blur-2xl pointer-events-none" />

                <div className="relative z-10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-md">
                          {activeCycle.label}
                        </span>
                        {activeCycle.isCurrent && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-900">
                            Current Active Cycle
                          </span>
                        )}
                        {activeCycle.status === 'paid' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400 text-slate-900 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Settled
                          </span>
                        )}
                      </div>

                      <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                        {activeCycle.subLabel}
                      </h2>
                      <p className="text-xs opacity-85 flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{activeCycle.formattedRange}</span>
                      </p>
                    </div>

                    {/* Pay Bill Shortcut for this Cycle */}
                    {activeCycle.netAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayTargetAmount(activeCycle.netAmount);
                          setIsPayModalOpen(true);
                        }}
                        className="px-4 py-2.5 bg-white text-rose-700 hover:bg-white/95 rounded-2xl text-xs font-extrabold shadow-lg flex items-center gap-2 transition-all cursor-pointer active:scale-95 shrink-0 self-start sm:self-auto"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Pay This Bill (₹{formatINR(activeCycle.netAmount)})</span>
                      </button>
                    )}
                  </div>

                  {/* 3 Metrics Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20">
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 flex items-center gap-1 block">
                        <TrendingDown className="w-3.5 h-3.5" />
                        Total Spends
                      </span>
                      <span className="text-xl sm:text-2xl font-black tabular-nums mt-0.5 block">
                        ₹{formatINR(activeCycle.totalSpend)}
                      </span>
                      <span className="text-[11px] opacity-80 block">
                        Debits & card purchases
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20">
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 flex items-center gap-1 block">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Payments & Credits
                      </span>
                      <span className="text-xl sm:text-2xl font-black tabular-nums mt-0.5 block">
                        ₹{formatINR(activeCycle.totalPayments)}
                      </span>
                      <span className="text-[11px] opacity-80 block">
                        Payments & refunds received
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20">
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">
                        {activeCycle.isCurrent ? 'Current Unbilled Balance' : 'Net Statement Amount'}
                      </span>
                      <span className="text-xl sm:text-2xl font-black tabular-nums mt-0.5 block">
                        ₹{formatINR(Math.max(0, activeCycle.netAmount))}
                      </span>
                      <span className="text-[11px] opacity-80 block">
                        {activeCycle.formattedDueDate ? `Due: ${activeCycle.formattedDueDate}` : 'Due within grace period'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cycle Passbook Controls (Filters & Search) */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFilterType('all')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        filterType === 'all'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      All ({activeCycle.transactions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('debit')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        filterType === 'debit'
                          ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Spends (-₹)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('credit')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        filterType === 'credit'
                          ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Payments (+₹)
                    </button>
                  </div>

                  {/* Sort dropdown */}
                  <div className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
                    <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-transparent font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer text-xs"
                    >
                      <option value="date-desc">Newest</option>
                      <option value="date-asc">Oldest</option>
                      <option value="amount-desc">High Amount</option>
                      <option value="amount-asc">Low Amount</option>
                    </select>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search cycle transactions..."
                    className="w-36 sm:w-48 bg-transparent text-xs outline-none font-medium text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Transactions Ledger for this Billing Cycle */}
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {sortedCycleRows.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      No transactions in this billing cycle.
                    </p>
                    <p className="text-xs mt-1 text-slate-400">
                      Transactions dated between {activeCycle.formattedRange} will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedCycleRows.map((row) => {
                      const tx = row.transaction;
                      const isCredit = row.credit !== null;

                      return (
                        <div
                          key={tx.id}
                          onClick={() => setSelectedRowForAction(row)}
                          className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group active:bg-slate-100 dark:active:bg-slate-800 min-w-0"
                          title="Tap to Edit or Delete transaction"
                        >
                          {/* Line 1: Title on left | Date on right */}
                          <div className="flex items-center justify-between gap-2.5 text-xs sm:text-sm min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                              <span className="font-semibold text-slate-900 dark:text-white truncate">
                                {row.description}
                              </span>
                              {tx.note && (
                                <span className="text-[11px] text-slate-400 truncate hidden md:inline">
                                  — {tx.note}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 shrink-0 font-medium tabular-nums">
                              <Calendar className="w-3 h-3 opacity-60" />
                              <span>{formatDate(tx.date)}</span>
                              {tx.time && (
                                <>
                                  <span className="opacity-40">•</span>
                                  <Clock className="w-3 h-3 opacity-60" />
                                  <span>{tx.time}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Line 2: Category & Tags on left | Amount & Running Balance on right */}
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1 overflow-hidden">
                              {tx.categoryName && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                                  <span>{tx.categoryName}</span>
                                </span>
                              )}
                              {tx.tags && tx.tags.length > 0 && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                                  #{tx.tags[0]}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span
                                className={`font-black tabular-nums text-xs sm:text-sm ${
                                  isCredit
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isCredit ? '+' : '-'}₹{formatINR(row.credit ?? row.debit ?? 0)}
                              </span>

                              <span className="text-[10px] font-medium text-slate-400 tabular-nums hidden sm:inline">
                                (Cycle Bal: ₹{formatINR(row.balanceAfter)})
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Action Sheet / Modal when tapping a Transaction */}
      {selectedRowForAction && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Transaction Details
                </h3>
                <p className="text-xs text-slate-400">
                  {formatDateTimeHHMM(
                    selectedRowForAction.transaction.date,
                    selectedRowForAction.transaction.time,
                    selectedRowForAction.transaction.createdAt
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRowForAction(null);
                  setConfirmDeleteTx(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Description</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedRowForAction.description}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Amount</span>
                <span
                  className={`text-base font-black tabular-nums ${
                    selectedRowForAction.credit !== null
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {selectedRowForAction.credit !== null ? '+' : '-'}₹
                  {formatINR(selectedRowForAction.credit ?? selectedRowForAction.debit ?? 0)}
                </span>
              </div>
              {selectedRowForAction.transaction.categoryName && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Category</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedRowForAction.transaction.categoryName}
                  </span>
                </div>
              )}
              {selectedRowForAction.transaction.note && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Note</span>
                  <span className="italic text-slate-700 dark:text-slate-300">
                    {selectedRowForAction.transaction.note}
                  </span>
                </div>
              )}
            </div>

            {confirmDeleteTx ? (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-3">
                <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                  Are you sure you want to delete this transaction? This will permanently update your card balance and statement totals.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteTx(false)}
                    className="flex-1 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteTransaction(selectedRowForAction.transaction.id);
                      setSelectedRowForAction(null);
                      setConfirmDeleteTx(false);
                    }}
                    className="flex-1 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-500 shadow-md cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTransaction(selectedRowForAction.transaction);
                    setSelectedRowForAction(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit Transaction</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteTx(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 font-semibold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Transaction</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bill Date Configuration Modal */}
      {isCycleConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-500" />
                <span>Configure Bill Cycle</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCycleConfigOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCycleConfig} className="mt-4 space-y-4 text-xs sm:text-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Set your credit card statement generation day. Your billing cycle will run from this day of the previous month to the day before in the current month.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bill Generation Day of Month (1 - 31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={editCycleDay}
                  onChange={(e) => setEditCycleDay(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold tabular-nums text-base focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Due Day of Month (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editDueDay}
                  onChange={(e) => setEditDueDay(e.target.value)}
                  placeholder="e.g. 15"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold tabular-nums text-base focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCycleConfigOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md cursor-pointer"
                >
                  Update Cycle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Pay Modal */}
      {isPayModalOpen && (
        <CreditCardPayModal
          isOpen={isPayModalOpen}
          cardAccount={account}
          onClose={() => setIsPayModalOpen(false)}
        />
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <TransactionModal
          initialTransaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </div>
  );
};
