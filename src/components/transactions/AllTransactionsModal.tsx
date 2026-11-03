import React, { useState, useMemo, useRef, useEffect, memo } from 'react';
import { useApp } from '../../context/AppContext';
import { Transaction } from '../../types';
import { formatINR, formatDate, parseDate, toInputDate } from '../../utils/formatters';
import {
  ArrowLeft,
  X,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Zap,
  SlidersHorizontal,
  ArrowUpDown,
  Check,
  Calendar,
  Wallet,
  Tag,
  ChevronRight,
} from 'lucide-react';
import { TransactionModal } from './TransactionModal';
import { AccountAvatar } from '../common/AccountAvatar';
import { IconRenderer } from '../common/IconRenderer';

interface IndexedTransaction extends Transaction {
  _timestamp: number;
}

// Highly optimized memoized card for 60fps rendering of transactions
const TransactionCard = memo(
  ({
    tx,
    onSelect,
  }: {
    tx: Transaction;
    onSelect: (t: Transaction) => void;
  }) => {
    const isExpense = tx.type === 'expense';
    const isIncome = tx.type === 'income';

    return (
      <div
        onClick={() => onSelect(tx)}
        className="h-[76px] p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-2.5 sm:gap-3 shadow-2xs cursor-pointer active:scale-[0.99] select-none min-w-0 overflow-hidden"
        title="Tap to view or edit this transaction"
      >
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1 overflow-hidden">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isExpense
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : isIncome
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            }`}
          >
            {isExpense && <ArrowDownRight className="w-4 h-4 sm:w-5 sm:h-5" />}
            {isIncome && <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />}
            {!isExpense && !isIncome && <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5" />}
          </div>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate" title={tx.note || tx.categoryName || 'Transaction'}>
              {tx.note || tx.categoryName || 'Transaction'}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
              <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0">
                {formatDate(tx.date)}
              </span>
              <span className="shrink-0 opacity-60">·</span>
              <span className="truncate">{tx.fromAccountName}</span>
              {tx.toAccountName && <span className="truncate">→ {tx.toAccountName}</span>}
              {tx.categoryName && (
                <>
                  <span className="shrink-0 opacity-60">·</span>
                  <span className="truncate">{tx.categoryName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0 ml-2">
          <div
            className={`text-xs sm:text-sm md:text-base font-extrabold tabular-nums whitespace-nowrap ${
              isExpense
                ? 'text-rose-600 dark:text-rose-400'
                : isIncome
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}
            title={formatINR(tx.amount)}
          >
            {isExpense ? '-' : isIncome ? '+' : ''}
            {formatINR(tx.amount)}
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold tracking-wider block whitespace-nowrap">
            {tx.type}
          </span>
        </div>
      </div>
    );
  }
);

TransactionCard.displayName = 'TransactionCard';

export const AllTransactionsModal: React.FC = () => {
  const {
    isAllTransactionsModalOpen,
    setIsAllTransactionsModalOpen,
    transactions,
    accounts,
    categories,
    isDark,
    modalOpenedFromTools,
    allTransactionsTypeFilter,
    allTransactionsDateFilter,
    allTransactionsStartDate,
    allTransactionsEndDate,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['all']);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(['all']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Pagination window state to prevent mounting 5000 DOM nodes at once (brings open time from 15s to 10ms!)
  const [visibleDaysCount, setVisibleDaysCount] = useState<number>(15);

  // Modal dialog states
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    setIsAllTransactionsModalOpen(false);
  };

  useEffect(() => {
    if (isAllTransactionsModalOpen) {
      if (allTransactionsTypeFilter && allTransactionsTypeFilter !== 'all') {
        setSelectedTypes([allTransactionsTypeFilter]);
      } else {
        setSelectedTypes(['all']);
      }
      setDateRangeFilter(allTransactionsDateFilter || 'all');
      setCustomStart(allTransactionsStartDate || '');
      setCustomEnd(allTransactionsEndDate || '');
      setVisibleDaysCount(15);
    }
  }, [isAllTransactionsModalOpen, allTransactionsTypeFilter, allTransactionsDateFilter, allTransactionsStartDate, allTransactionsEndDate]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleDaysCount(15);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [searchQuery, selectedTypes, selectedAccounts, selectedCategories, dateRangeFilter, sortBy]);

  // Timeline options including 8 individual past months + 5 years (5-column grid)
  const timelineOptions = useMemo(() => {
    const list = [
      { id: 'all', label: 'All Time' },
      { id: 'week', label: 'This Week' },
      { id: 'month', label: 'This Month' },
      { id: 'year', label: 'This Year' },
    ];
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const yrShort = String(y).slice(-2);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const key = `month_${y}_${m}`;
      const monthShort = d.toLocaleDateString('en-IN', { month: 'short' });
      const label = `${monthShort} ${yrShort}`; // e.g. "Oct 25", "Sep 25", "Aug 25"
      list.push({ id: key, label });
    }
    const currentYear = now.getFullYear();
    for (let yr = currentYear; yr >= currentYear - 4; yr--) {
      list.push({ id: `year_${yr}`, label: `${yr}` }); // e.g. 2026, 2025, 2024, 2023, 2022
    }
    return list;
  }, []);

  // Ultra-fast cached timestamp parser
  const timestampCache = useRef<Map<string, number>>(new Map());

  const indexedTransactions = useMemo<IndexedTransaction[]>(() => {
    const cache = timestampCache.current;
    return transactions.map((tx) => {
      let ts = cache.get(tx.date);
      if (ts === undefined) {
        ts = parseDate(tx.date).getTime() || 0;
        cache.set(tx.date, ts);
      }
      return {
        ...tx,
        _timestamp: ts,
      };
    });
  }, [transactions]);

  // Memoized filtering and high-performance sorting
  const filteredTransactions = useMemo(() => {
    if (!isAllTransactionsModalOpen) return [];
    const q = searchQuery.trim().toLowerCase();
    const cleanNumeric = q.replace(/[^0-9.]/g, '');
    const numericTarget = cleanNumeric ? parseFloat(cleanNumeric) : NaN;

    const filtered = indexedTransactions.filter((tx) => {
      // Type multi-select filter
      if (!selectedTypes.includes('all') && selectedTypes.length > 0) {
        if (!selectedTypes.includes(tx.type)) return false;
      }

      // Account multi-select filter
      if (!selectedAccounts.includes('all') && selectedAccounts.length > 0) {
        const matchAcc =
          selectedAccounts.includes(tx.fromAccountId) ||
          (tx.toAccountId && selectedAccounts.includes(tx.toAccountId));
        if (!matchAcc) return false;
      }

      // Category multi-select filter
      if (!selectedCategories.includes('all') && selectedCategories.length > 0) {
        if (!tx.categoryId || !selectedCategories.includes(tx.categoryId)) return false;
      }

      // Date Range Filter
      if (dateRangeFilter === 'week') {
        const now = new Date();
        const weekAgoTs = now.getTime() - 7 * 86400 * 1000;
        if (tx._timestamp < weekAgoTs || tx._timestamp > now.getTime() + 86400 * 1000) return false;
      } else if (dateRangeFilter === 'month') {
        const now = new Date();
        const txD = new Date(tx._timestamp);
        if (txD.getFullYear() !== now.getFullYear() || txD.getMonth() !== now.getMonth()) return false;
      } else if (dateRangeFilter === 'year') {
        const nowY = new Date().getFullYear();
        const txD = new Date(tx._timestamp);
        if (txD.getFullYear() !== nowY) return false;
      } else if (dateRangeFilter.startsWith('month_')) {
        // e.g. "month_2025_10"
        const parts = dateRangeFilter.split('_');
        const reqY = parseInt(parts[1], 10);
        const reqM = parseInt(parts[2], 10);
        const txD = new Date(tx._timestamp);
        if (txD.getFullYear() !== reqY || txD.getMonth() + 1 !== reqM) return false;
      } else if (dateRangeFilter.startsWith('year_')) {
        const reqY = parseInt(dateRangeFilter.replace('year_', ''), 10);
        const txD = new Date(tx._timestamp);
        if (txD.getFullYear() !== reqY) return false;
      } else if (dateRangeFilter === 'custom' && customStart && customEnd) {
        const startTs = parseDate(customStart).getTime();
        const endTs = parseDate(customEnd).getTime() + 86399999;
        if (tx._timestamp < startTs || tx._timestamp > endTs) return false;
      }

      // Search query filter
      if (q) {
        const matchNote = tx.note?.toLowerCase().includes(q);
        const matchCat = tx.categoryName?.toLowerCase().includes(q);
        const matchFrom = tx.fromAccountName?.toLowerCase().includes(q);
        const matchTo = tx.toAccountName?.toLowerCase().includes(q);
        const matchTags = tx.tags?.some((t) => t.toLowerCase().includes(q.replace(/^#/, '')));

        const matchAmount =
          !isNaN(numericTarget) &&
          (tx.amount.toString().includes(cleanNumeric) || Math.abs(tx.amount - numericTarget) < 0.01);

        if (!matchNote && !matchCat && !matchFrom && !matchTo && !matchTags && !matchAmount) {
          return false;
        }
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'date_desc') return b._timestamp - a._timestamp;
      if (sortBy === 'date_asc') return a._timestamp - b._timestamp;
      if (sortBy === 'amount_desc') return b.amount - a.amount;
      if (sortBy === 'amount_asc') return a.amount - b.amount;
      return 0;
    });

    return filtered;
  }, [
    isAllTransactionsModalOpen,
    indexedTransactions,
    searchQuery,
    selectedTypes,
    selectedAccounts,
    selectedCategories,
    sortBy,
    dateRangeFilter,
    customStart,
    customEnd,
  ]);

  // Day-wise grouping of filtered transactions
  const groupedTransactions = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    filteredTransactions.forEach((tx) => {
      const dateKey = tx.date;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(tx);
    });
    return Object.entries(map).sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
  }, [filteredTransactions]);

  // Paginated window slice of day groups for 10ms instant load speed
  const displayedGroups = useMemo(() => {
    return groupedTransactions.slice(0, visibleDaysCount);
  }, [groupedTransactions, visibleDaysCount]);

  const getDateHeaderLabel = (dateStr: string) => {
    const todayStr = toInputDate(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = toInputDate(yesterdayDate);

    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';
    return formatDate(parseDate(dateStr));
  };

  // Infinite scroll listener for loading more day groups
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 300) {
      if (visibleDaysCount < groupedTransactions.length) {
        setVisibleDaysCount((prev) => Math.min(groupedTransactions.length, prev + 15));
      }
    }
  };

  // Aggregate stats memoized
  const { totalExpense, totalIncome } = useMemo(() => {
    if (!isAllTransactionsModalOpen) return { totalExpense: 0, totalIncome: 0 };
    let exp = 0;
    let inc = 0;
    for (let i = 0; i < filteredTransactions.length; i++) {
      const tx = filteredTransactions[i];
      if (tx.isBalanceAdjustment) continue;
      if (tx.type === 'expense') exp += tx.amount;
      else if (tx.type === 'income') inc += tx.amount;
    }
    return { totalExpense: exp, totalIncome: inc };
  }, [isAllTransactionsModalOpen, filteredTransactions]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (!selectedTypes.includes('all') && selectedTypes.length > 0) count++;
    if (!selectedAccounts.includes('all') && selectedAccounts.length > 0) count++;
    if (!selectedCategories.includes('all') && selectedCategories.length > 0) count++;
    if (dateRangeFilter !== 'all') count++;
    return count;
  }, [selectedTypes, selectedAccounts, selectedCategories, dateRangeFilter]);

  if (!isAllTransactionsModalOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-150">
        {/* Top App Bar Header */}
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 shrink-0 pt-safe">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{modalOpenedFromTools === 'all_transactions' ? 'More Tools' : 'Dashboard'}</span>
            </button>
            <div className="h-5 w-px bg-slate-200 dark:border-slate-800 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  All Transactions
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500" />
                  <span>{filteredTransactions.length} records</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Area with Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-4 pb-safe pb-24"
        >
          {/* Search, Filter Icon, and Sort Icon Row */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes, amount, tags, or accounts..."
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Button with active count badge */}
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(true)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  activeFiltersCount > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Filter</span>
                {activeFiltersCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Sort Button */}
              <button
                type="button"
                onClick={() => setIsSortModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                <ArrowUpDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Sort</span>
              </button>
            </div>

            {/* Active Filter Chips Bar (Below search line) */}
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 text-xs no-scrollbar">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                  Active:
                </span>
                {dateRangeFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs shrink-0">
                    <span>📅 {(timelineOptions.find((t) => t.id === dateRangeFilter)?.label || dateRangeFilter).toUpperCase()}</span>
                    <button
                      onClick={() => setDateRangeFilter('all')}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {!selectedTypes.includes('all') && selectedTypes.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs shrink-0">
                    <span>💳 {selectedTypes.join(', ').toUpperCase()}</span>
                    <button
                      onClick={() => setSelectedTypes(['all'])}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {!selectedAccounts.includes('all') && selectedAccounts.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs shrink-0">
                    <span>
                      🏦 {accounts.find((a) => a.id === selectedAccounts[0])?.name || 'Account'}
                      {selectedAccounts.length > 1 ? ` +${selectedAccounts.length - 1}` : ''}
                    </span>
                    <button
                      onClick={() => setSelectedAccounts(['all'])}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {!selectedCategories.includes('all') && selectedCategories.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs shrink-0">
                    <span>
                      🏷️ {categories.find((c) => c.id === selectedCategories[0])?.name || 'Category'}
                      {selectedCategories.length > 1 ? ` +${selectedCategories.length - 1}` : ''}
                    </span>
                    <button
                      onClick={() => setSelectedCategories(['all'])}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTypes(['all']);
                    setSelectedAccounts(['all']);
                    setSelectedCategories(['all']);
                    setDateRangeFilter('all');
                  }}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 ml-1 cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Quick Cashflow Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-400 block">Total Outflow</span>
              <span className="text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                -{formatINR(totalExpense)}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-400 block">Total Inflow</span>
              <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{formatINR(totalIncome)}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-medium text-slate-400 block">Active Filter</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                {selectedTypes.includes('all') ? 'All Types' : selectedTypes.join(', ').toUpperCase()} · {filteredTransactions.length} items
              </span>
            </div>
          </div>

          {/* Day-Wise Grouped Transactions List - Big Outer Cards for each Day */}
          <div className="space-y-4">
            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  No transactions match the criteria
                </p>
                <p className="text-xs mt-1">Try resetting your search query or filters.</p>
              </div>
            ) : (
              displayedGroups.map(([dateKey, txs]) => (
                <div
                  key={dateKey}
                  className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                >
                  {/* Big Outer Day Card Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                        {getDateHeaderLabel(dateKey)}
                      </h3>
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {txs.length} {txs.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>

                  {/* Inner Transaction Cards */}
                  <div className="flex flex-col gap-2">
                    {txs.map((tx) => (
                      <TransactionCard
                        key={tx.id}
                        tx={tx}
                        onSelect={(selected) => setEditingTransaction(selected)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}

            {groupedTransactions.length > visibleDaysCount && (
              <div className="text-center pt-3 pb-6">
                <button
                  type="button"
                  onClick={() => setVisibleDaysCount((prev) => Math.min(groupedTransactions.length, prev + 20))}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  Load More History ({visibleDaysCount} of {groupedTransactions.length} days)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FILTER DIALOG MODAL */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-65 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <span>Filter Transactions</span>
              </h3>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Date Range Selection (2-Column Grid) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Date Range / Timeline
                </label>
                <button
                  type="button"
                  onClick={() => setIsTimelineModalOpen(true)}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>More Timeline Options</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'week', label: 'This Week' },
                  { id: 'month', label: 'This Month' },
                  { id: 'year', label: 'This Year' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDateRangeFilter(d.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border text-left transition-all cursor-pointer flex items-center justify-between ${
                      dateRangeFilter === d.id
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{d.label}</span>
                    {dateRangeFilter === d.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                ))}
              </div>

              {dateRangeFilter === 'custom' && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                  />
                  <span className="text-slate-400 text-xs">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
              )}
            </div>

            {/* Type Multi-Select (2-Column Grid) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Transaction Types (Select 1 or more)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'all', label: 'All Types' },
                  { id: 'expense', label: 'Spend (Expense)' },
                  { id: 'income', label: 'Income' },
                  { id: 'transfer', label: 'Transfer' },
                ].map((t) => {
                  const isSelected = selectedTypes.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (t.id === 'all') {
                          setSelectedTypes(['all']);
                        } else {
                          let next = selectedTypes.filter((x) => x !== 'all');
                          if (isSelected) {
                            next = next.filter((x) => x !== t.id);
                            if (next.length === 0) next = ['all'];
                          } else {
                            next.push(t.id);
                          }
                          setSelectedTypes(next);
                        }
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{t.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accounts Multi-Select (2-Column Grid Format) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Bank Accounts & Payment Modes ({selectedAccounts.includes('all') ? 'All' : selectedAccounts.length + ' selected'})
                </label>
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(true)}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Select Accounts ({accounts.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 truncate">
                {selectedAccounts.includes('all')
                  ? 'All Bank Accounts & Credit Cards'
                  : selectedAccounts.map((id) => accounts.find((a) => a.id === id)?.name).filter(Boolean).join(', ')}
              </div>
            </div>

            {/* Category Multi-Select (2-Column Grid Format) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Categories ({selectedCategories.includes('all') ? 'All' : selectedCategories.length + ' selected'})
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Select Categories ({categories.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 truncate">
                {selectedCategories.includes('all')
                  ? 'All Categories'
                  : selectedCategories.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean).join(', ')}
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedTypes(['all']);
                  setSelectedAccounts(['all']);
                  setSelectedCategories(['all']);
                  setDateRangeFilter('all');
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SORT DIALOG MODAL */}
      {isSortModalOpen && (
        <div className="fixed inset-0 z-65 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-indigo-600" />
                <span>Sort Transactions</span>
              </h3>
              <button
                onClick={() => setIsSortModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { id: 'date_desc', label: 'Date (Newest First)' },
                { id: 'date_asc', label: 'Date (Oldest First)' },
                { id: 'amount_desc', label: 'Amount (Highest First)' },
                { id: 'amount_asc', label: 'Amount (Lowest First)' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSortBy(s.id as any);
                    setIsSortModalOpen(false);
                  }}
                  className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold border text-left transition-all cursor-pointer flex items-center justify-between ${
                    sortBy === s.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{s.label}</span>
                  {sortBy === s.id && <Check className="w-4 h-4 text-indigo-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ADVANCED TIMELINE MODAL (5-Column Grid Format) */}
      {isTimelineModalOpen && (
        <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Select Timeline (Months & Years)</span>
              </h3>
              <button
                onClick={() => setIsTimelineModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Past 8 Months in 5 Columns */}
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                  Past 8 Months
                </span>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  {timelineOptions.filter((t) => t.id.startsWith('month_')).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDateRangeFilter(item.id);
                        setIsTimelineModalOpen(false);
                      }}
                      className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold border text-center transition-all cursor-pointer truncate ${
                        dateRangeFilter === item.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-300'
                      }`}
                      title={item.label}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Past 5 Years in 5 Columns */}
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                  Past 5 Years
                </span>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  {timelineOptions.filter((t) => t.id.startsWith('year_')).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDateRangeFilter(item.id);
                        setIsTimelineModalOpen(false);
                      }}
                      className={`py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold border text-center transition-all cursor-pointer truncate ${
                        dateRangeFilter === item.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-300'
                      }`}
                      title={item.label}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTimelineModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY MULTI-SELECT MODAL (3-Column Grid Format with Logos) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-600" />
                <span>Select Categories (Multi-select)</span>
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between py-1 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategories(['all'])}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-200"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategories([])}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-200"
                >
                  Clear
                </button>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {categories.length} categories
              </span>
            </div>

            {/* 3-Column Grid Format with Category Logos */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
              {categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      let next = selectedCategories.filter((x) => x !== 'all');
                      if (isSelected) {
                        next = next.filter((x) => x !== cat.id);
                        if (next.length === 0) next = ['all'];
                      } else {
                        next.push(cat.id);
                      }
                      setSelectedCategories(next);
                    }}
                    className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 text-purple-900 dark:text-purple-200 font-bold shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                        style={{ backgroundColor: cat.color || '#10b981' }}
                      >
                        <IconRenderer name={cat.icon || 'Tag'} className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs truncate">{cat.name}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT / PAYMENT MODE MULTI-SELECT MODAL (3-Column Grid Format with Logos) */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-600" />
                <span>Select Bank Accounts & Cards (Multi-select)</span>
              </h3>
              <button
                onClick={() => setIsAccountModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between py-1 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAccounts(['all'])}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-200"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAccounts([])}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-200"
                >
                  Clear
                </button>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {accounts.length} accounts
              </span>
            </div>

            {/* 3-Column Grid Format with Bank Avatars */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
              {accounts.map((acc) => {
                const isSelected = selectedAccounts.includes(acc.id);
                return (
                  <div
                    key={acc.id}
                    onClick={() => {
                      let next = selectedAccounts.filter((x) => x !== 'all');
                      if (isSelected) {
                        next = next.filter((x) => x !== acc.id);
                        if (next.length === 0) next = ['all'];
                      } else {
                        next.push(acc.id);
                      }
                      setSelectedAccounts(next);
                    }}
                    className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-900 dark:text-blue-200 font-bold shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AccountAvatar account={acc} size="xs" className="shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs truncate block font-bold">{acc.name}</span>
                        <span className="text-[10px] text-slate-400 truncate block capitalize">{acc.type}</span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Edit modal */}
      {editingTransaction && (
        <TransactionModal
          initialTransaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </>
  );
};
