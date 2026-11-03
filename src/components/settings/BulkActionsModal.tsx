import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { BulkAction, TransactionType } from '../../types';
import { formatINR, formatDate } from '../../utils/formatters';
import { AccountAvatar } from '../common/AccountAvatar';
import { IconRenderer } from '../common/IconRenderer';
import {
  History,
  RotateCcw,
  FileSpreadsheet,
  TrendingUp,
  ReceiptText,
  AlertTriangle,
  X,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  Clock,
  Layers,
  Info,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Tag,
  Check,
} from 'lucide-react';

interface BulkActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkActionsModal: React.FC<BulkActionsModalProps> = ({ isOpen, onClose }) => {
  const { bulkActions = [], revertBulkAction, deleteBulkActionLog, accounts, categories, addBulkTransactions, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'history' | 'generator'>('history');
  const [confirmRevertAction, setConfirmRevertAction] = useState<BulkAction | null>(null);
  const [confirmDeleteLogAction, setConfirmDeleteLogAction] = useState<BulkAction | null>(null);
  const [isReverting, setIsReverting] = useState(false);

  // Bulk Generator form states
  const [genName, setGenName] = useState('Monthly Expense');
  const [genAmount, setGenAmount] = useState('5000');
  const [genType, setGenType] = useState<TransactionType>('expense');
  const [genCategoryId, setGenCategoryId] = useState(categories[0]?.id || '');
  const [genFromAccId, setGenFromAccId] = useState(accounts[0]?.id || '');
  const [genToAccId, setGenToAccId] = useState(accounts[1]?.id || accounts[0]?.id || '');
  const [startMonthYear, setStartMonthYear] = useState('2025-04');
  const [endMonthYear, setEndMonthYear] = useState('2026-03');
  const [executionDay, setExecutionDay] = useState('5');
  const [genNote, setGenNote] = useState('');

  // Picker modal states
  const [accountPickerTarget, setAccountPickerTarget] = useState<'from' | 'to' | null>(null);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  const selectedFromAcc = useMemo(() => accounts.find((a) => a.id === genFromAccId) || accounts[0], [accounts, genFromAccId]);
  const selectedToAcc = useMemo(() => accounts.find((a) => a.id === genToAccId) || accounts[1] || accounts[0], [accounts, genToAccId]);
  const selectedCategory = useMemo(() => {
    const matched = categories.find((c) => c.id === genCategoryId && c.type === genType);
    if (matched) return matched;
    return categories.find((c) => c.type === genType) || categories[0];
  }, [categories, genCategoryId, genType]);

  const generatedRangeList = useMemo(() => {
    if (!startMonthYear || !endMonthYear) return [];
    const [startYear, startMonth] = startMonthYear.split('-').map(Number);
    const [endYear, endMonth] = endMonthYear.split('-').map(Number);

    if (isNaN(startYear) || isNaN(startMonth) || isNaN(endYear) || isNaN(endMonth)) return [];

    const list: Array<{ date: string; monthLabel: string }> = [];
    const parsedDay = Math.min(31, Math.max(1, parseInt(executionDay, 10) || 5));

    let curY = startYear;
    let curM = startMonth;

    while (curY < endYear || (curY === endYear && curM <= endMonth)) {
      const lastDayOfMonth = new Date(curY, curM, 0).getDate();
      const actualDay = Math.min(parsedDay, lastDayOfMonth);
      const dayStr = actualDay < 10 ? `0${actualDay}` : `${actualDay}`;
      const monthStr = curM < 10 ? `0${curM}` : `${curM}`;
      const dateStr = `${curY}-${monthStr}-${dayStr}`;
      const dObj = new Date(curY, curM - 1, actualDay);
      const mLabel = dObj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

      list.push({ date: dateStr, monthLabel: mLabel });

      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }
    return list;
  }, [startMonthYear, endMonthYear, executionDay]);

  if (!isOpen) return null;

  const handleGenerateBulk = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(genAmount);
    if (!genName.trim() || isNaN(parsedAmt) || parsedAmt <= 0 || generatedRangeList.length === 0) {
      showToast('Please verify name, amount and date range', 'error');
      return;
    }

    const fromAcc = selectedFromAcc;
    const toAcc = selectedToAcc;
    const cat = selectedCategory;

    const rawTxs = generatedRangeList.map((item) => ({
      date: item.date,
      amount: parsedAmt,
      type: genType,
      categoryId: genType === 'transfer' ? undefined : cat?.id,
      categoryName: genType === 'transfer' ? 'Transfer' : (cat?.name || 'General'),
      fromAccountId: genType === 'income' ? undefined : fromAcc.id,
      toAccountId: genType === 'income' ? toAcc.id : genType === 'transfer' ? toAcc.id : undefined,
      note: `${genName.trim()} (${item.monthLabel})${genNote ? ` - ${genNote}` : ''}`,
    }));

    addBulkTransactions(genName.trim(), rawTxs);
    setActiveTab('history');
  };

  const handleConfirmRevert = () => {
    if (!confirmRevertAction) return;
    setIsReverting(true);
    try {
      revertBulkAction(confirmRevertAction.id);
      setConfirmRevertAction(null);
    } finally {
      setIsReverting(false);
    }
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return 'Unknown date';
    const date = new Date(ts);
    const dateFormatted = formatDate(date);
    const timeFormatted = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateFormatted} • ${timeFormatted}`;
  };

  const getActionBadge = (type: string) => {
    switch (type) {
      case 'TRANSACTION_CSV':
        return {
          label: 'Transaction / Bulk',
          icon: ReceiptText,
          bgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
      case 'STOCK_CSV':
        return {
          label: 'Stock CSV',
          icon: TrendingUp,
          bgClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        };
      case 'MUTUAL_FUND_CSV':
        return {
          label: 'Mutual Fund CSV',
          icon: Layers,
          bgClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        };
      default:
        return {
          label: 'Investment CSV',
          icon: FileSpreadsheet,
          bgClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
        };
    }
  };

  const activeBulkActionsCount = bulkActions.filter((b) => b.status === 'COMPLETED').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
      {/* Top App Bar & Sub-Tabs */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 pt-safe pb-2.5 sm:pb-3 flex flex-col gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0 active:scale-95"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-2xs">
              <History className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                Bulk History
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shrink-0">
                {activeBulkActionsCount} Active
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            History Log ({bulkActions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('generator')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'generator'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            + Bulk Generator
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-6 sm:pb-8">
        <div className="max-w-3xl mx-auto w-full space-y-4">
          {activeTab === 'generator' ? (
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Bulk Transaction Generator
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automatically generate multiple expense, income, or transfer transactions across a From & To date range in one click. Tracked in Bulk History for atomic reversion.
                </p>
              </div>

              <form onSubmit={handleGenerateBulk} className="space-y-4 text-xs">
                {/* Interactive Type Switcher Tabs (Inspired by Transaction Entry Modal) */}
                <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setGenType('expense');
                      const firstCat = categories.find((c) => c.type === 'expense');
                      if (firstCat) setGenCategoryId(firstCat.id);
                    }}
                    className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      genType === 'expense'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Expense</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenType('income');
                      const firstCat = categories.find((c) => c.type === 'income');
                      if (firstCat) setGenCategoryId(firstCat.id);
                    }}
                    className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      genType === 'income'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>Income</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenType('transfer');
                    }}
                    className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      genType === 'transfer'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Transfer</span>
                  </button>
                </div>

                {/* Transaction Name Input */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Transaction Name / Title</label>
                  <input
                    type="text"
                    required
                    value={genName}
                    onChange={(e) => setGenName(e.target.value)}
                    placeholder="e.g. Monthly Office Rent"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                {/* Amount Input with Currency Symbol & Formatted Preview */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Amount per Entry (₹)</label>
                    {parseFloat(genAmount) > 0 && (
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatINR(parseFloat(genAmount) || 0)}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      value={genAmount}
                      onChange={(e) => setGenAmount(e.target.value)}
                      placeholder="15000"
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                </div>

                {/* Account & Category Selection - Interactive Card Tiles (Transaction Modal Reference) */}
                {genType === 'transfer' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700 dark:text-slate-300">From & To Accounts</label>
                      <span className="text-[10px] text-slate-400 font-medium">Tap card to change</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* From Account Card */}
                      <button
                        type="button"
                        onClick={() => setAccountPickerTarget('from')}
                        className="w-full h-[84px] rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-blue-500 px-3 py-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group shadow-xs active:scale-95"
                      >
                        <div className="shrink-0 group-hover:scale-105 transition-transform">
                          {selectedFromAcc && <AccountAvatar account={selectedFromAcc} size="sm" />}
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate w-full px-1 mt-1">
                          {selectedFromAcc ? selectedFromAcc.name : 'Select Account'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums font-semibold truncate w-full">
                          {selectedFromAcc ? formatINR(selectedFromAcc.balance, true) : 'Choose bank'}
                        </span>
                      </button>

                      {/* To Account Card */}
                      <button
                        type="button"
                        onClick={() => setAccountPickerTarget('to')}
                        className="w-full h-[84px] rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-blue-500 px-3 py-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group shadow-xs active:scale-95"
                      >
                        <div className="shrink-0 group-hover:scale-105 transition-transform">
                          {selectedToAcc && <AccountAvatar account={selectedToAcc} size="sm" />}
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate w-full px-1 mt-1">
                          {selectedToAcc ? selectedToAcc.name : 'Select Destination'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums font-semibold truncate w-full">
                          {selectedToAcc ? formatINR(selectedToAcc.balance, true) : 'Choose bank'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        {genType === 'income' ? 'Deposit To Account & Income Category' : 'Paid From Account & Expense Category'}
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">Tap card to change</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Account Tile Card */}
                      <button
                        type="button"
                        onClick={() => setAccountPickerTarget(genType === 'income' ? 'to' : 'from')}
                        className="w-full h-[84px] rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-emerald-500 px-3 py-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group shadow-xs active:scale-95"
                      >
                        <div className="shrink-0 group-hover:scale-105 transition-transform">
                          {genType === 'income' ? (
                            selectedToAcc && <AccountAvatar account={selectedToAcc} size="sm" />
                          ) : (
                            selectedFromAcc && <AccountAvatar account={selectedFromAcc} size="sm" />
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate w-full px-1 mt-1">
                          {genType === 'income'
                            ? selectedToAcc ? selectedToAcc.name : 'Select Account'
                            : selectedFromAcc ? selectedFromAcc.name : 'Select Account'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums font-semibold truncate w-full">
                          {genType === 'income'
                            ? selectedToAcc ? formatINR(selectedToAcc.balance, true) : 'Choose bank'
                            : selectedFromAcc ? formatINR(selectedFromAcc.balance, true) : 'Choose bank'}
                        </span>
                      </button>

                      {/* Category Tile Card */}
                      <button
                        type="button"
                        onClick={() => setIsCategoryPickerOpen(true)}
                        className="w-full h-[84px] rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-emerald-500 px-3 py-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group shadow-xs active:scale-95"
                      >
                        <div
                          className="w-7 h-7 rounded-xl flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0"
                          style={{ backgroundColor: selectedCategory?.color || '#10b981' }}
                        >
                          <IconRenderer name={selectedCategory?.icon || 'Tag'} className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate w-full px-1 mt-1">
                          {selectedCategory ? selectedCategory.name : 'Select Category'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate w-full capitalize">
                          {genType} Category
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Date Range Picker Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">From Month</label>
                    <input
                      type="month"
                      required
                      value={startMonthYear}
                      onChange={(e) => setStartMonthYear(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">To Month</label>
                    <input
                      type="month"
                      required
                      value={endMonthYear}
                      onChange={(e) => setEndMonthYear(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Day of Month (1-31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      required
                      value={executionDay}
                      onChange={(e) => setExecutionDay(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Generation Preview Card */}
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-1">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 block">Preview Generation:</span>
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 block">
                    Will generate <strong>{generatedRangeList.length}</strong> transactions totaling <strong>{formatINR(generatedRangeList.length * (parseFloat(genAmount) || 0))}</strong> across {startMonthYear} to {endMonthYear}.
                  </span>
                </div>

                {/* Submit Action Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/25 cursor-pointer active:scale-95 transition-all"
                  >
                    Generate {generatedRangeList.length} Transactions & Log in History
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Informational Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-850/80 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                  <Info className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Atomic Reversion & Balance Recalculation:
                  </span>{' '}
                  All bulk CSV imports and bulk-generated transactions are tracked here. Reverting an item automatically removes all associated transaction records while recalculating account passbook balances.
                </div>
              </div>

              {/* List of Bulk Actions */}
              {bulkActions.length === 0 ? (
                <div className="py-16 text-center px-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-850 flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800">
                    <History className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    No Bulk Actions Logged
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    When you import transactions via CSV or use the Bulk Generator, an audit log will be created here allowing full review and one-tap reversion.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bulkActions.map((action) => {
                    const badge = getActionBadge(action.actionType);
                    const BadgeIcon = badge.icon;
                    const isReverted = action.status === 'REVERTED';

                    return (
                      <div
                        key={action.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          isReverted
                            ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 opacity-80'
                            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Left: Badges & File details */}
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Action Badge */}
                              <div
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badge.bgClass}`}
                              >
                                <BadgeIcon className="w-3.5 h-3.5" />
                                <span>{badge.label}</span>
                              </div>

                              {/* Status Badge */}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isReverted
                                    ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                                    : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                }`}
                              >
                                {isReverted ? (
                                  <>
                                    <RotateCcw className="w-3 h-3" />
                                    REVERTED
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    COMPLETED
                                  </>
                                )}
                              </span>
                            </div>

                            {/* File Name & Stats */}
                            <div>
                              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                                {action.fileName}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTimestamp(action.timestamp)}
                                </span>
                                <span>•</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {action.totalRows} record{action.totalRows !== 1 ? 's' : ''} generated
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                            {!isReverted ? (
                              <button
                                type="button"
                                onClick={() => setConfirmRevertAction(action)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/20 transition-all cursor-pointer active:scale-95 shadow-2xs"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Delete & Revert</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500 italic pr-2">
                                Records reverted
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => setConfirmDeleteLogAction(action)}
                              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete this bulk action log"
                              aria-label="Delete bulk action log"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Account Picker Overlay Modal */}
      {accountPickerTarget && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Select {accountPickerTarget === 'from' ? 'From' : 'To'} Account
              </h3>
              <button
                type="button"
                onClick={() => setAccountPickerTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {accounts
                .filter((a) => (accountPickerTarget === 'to' && genType === 'transfer' ? a.id !== genFromAccId : true))
                .map((acc) => {
                  const isSelected =
                    accountPickerTarget === 'from' ? acc.id === genFromAccId : acc.id === genToAccId;

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        if (accountPickerTarget === 'from') setGenFromAccId(acc.id);
                        else setGenToAccId(acc.id);
                        setAccountPickerTarget(null);
                      }}
                      className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-slate-900 dark:text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <AccountAvatar account={acc} size="sm" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            {acc.name}
                          </span>
                          <span className="text-[10px] text-slate-400 capitalize block">
                            {acc.type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatINR(acc.balance)}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Category Picker Overlay Modal */}
      {isCategoryPickerOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                Select {genType} Category
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryPickerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto grid grid-cols-2 gap-2 flex-1 pr-1">
              {categories
                .filter((c) => c.type === genType)
                .map((cat) => {
                  const isSelected = cat.id === genCategoryId;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setGenCategoryId(cat.id);
                        setIsCategoryPickerOpen(false);
                      }}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-slate-900 dark:text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                        style={{ backgroundColor: cat.color || '#10b981' }}
                      >
                        <IconRenderer name={cat.icon || 'Tag'} className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">
                        {cat.name}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Safety Confirmation Dialog */}
      {confirmRevertAction && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Revert Bulk Action?
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Reverting this bulk action will delete{' '}
              <strong className="text-rose-600 dark:text-rose-400 font-bold">
                {confirmRevertAction.totalRows}
              </strong>{' '}
              records and adjust your account balances accordingly. This action cannot be undone.
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs mb-5 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Name / File:</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {confirmRevertAction.fileName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Created On:</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {formatTimestamp(confirmRevertAction.timestamp)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmRevertAction(null)}
                disabled={isReverting}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleConfirmRevert}
                disabled={isReverting}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isReverting ? 'REVERTING...' : 'CONFIRM REVERSION'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Confirmation Dialog for Deleting Bulk Action Log */}
      {confirmDeleteLogAction && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Delete Bulk Action Log?
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              {confirmDeleteLogAction.status !== 'REVERTED' ? (
                <>
                  <strong className="text-rose-600 dark:text-rose-400 font-bold">Warning:</strong> This bulk record is still{' '}
                  <strong className="font-bold">ACTIVE</strong> ({confirmDeleteLogAction.totalRows} records). If you delete this log entry now, you will{' '}
                  <strong className="text-rose-600 dark:text-rose-400 font-bold">no longer be able to automatically revert or undo</strong>{' '}
                  these records.
                </>
              ) : (
                <>
                  Are you sure you want to remove the log for <strong>{confirmDeleteLogAction.fileName}</strong>? The records have already been reverted, and this log entry will be permanently deleted from history.
                </>
              )}
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs mb-5 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Name / File:</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {confirmDeleteLogAction.fileName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Status:</span>
                <span className={`font-bold ${confirmDeleteLogAction.status === 'REVERTED' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {confirmDeleteLogAction.status === 'REVERTED' ? 'REVERTED' : 'ACTIVE'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Created On:</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {formatTimestamp(confirmDeleteLogAction.timestamp)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteLogAction(null)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteBulkActionLog(confirmDeleteLogAction.id);
                  setConfirmDeleteLogAction(null);
                }}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                CONFIRM DELETION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
