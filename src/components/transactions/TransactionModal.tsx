import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { Account, Category, Transaction, TransactionType } from '../../types';
import { formatINR, toInputDate } from '../../utils/formatters';
import { IconRenderer } from '../common/IconRenderer';
import { AccountAvatar } from '../common/AccountAvatar';
import { AccountSelectFullScreenModal } from '../common/AccountSelectFullScreenModal';
import { MaterialDatePickerDialog, formatToM3Date } from '../common/MaterialDatePickerDialog';
import { MaterialTimePickerDialog, formatTime12h } from '../common/MaterialTimePickerDialog';
import { useRegisterOverlay } from '../../navigation/NavigationContext';
import { hapticsService } from '../../services/hapticsService';
import {
  X,
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Check,
  Tag,
  Trash2,
  Layers,
  Search,
  ChevronRight,
  Sparkles,
  Calendar,
  Clock,
} from 'lucide-react';

interface TransactionModalProps {
  initialTransaction?: Transaction | null;
  onClose?: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  initialTransaction,
  onClose,
}) => {
  const {
    isTransactionModalOpen,
    setIsTransactionModalOpen,
    transactionModalInitialType,
    accounts,
    categories,
    settings,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useApp();

  const isOpen = initialTransaction !== undefined ? Boolean(initialTransaction) : isTransactionModalOpen;

  const [type, setType] = useState<TransactionType>(() => {
    if (initialTransaction) return initialTransaction.type;
    try {
      const draft = localStorage.getItem('finsync_draft_transaction');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.type) return parsed.type;
      }
    } catch {}
    return transactionModalInitialType || 'expense';
  });

  const [amount, setAmount] = useState<string>(() => {
    if (initialTransaction) return initialTransaction.amount.toString();
    try {
      const draft = localStorage.getItem('finsync_draft_transaction');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.amount) return parsed.amount;
      }
    } catch {}
    return '';
  });

  const [date, setDate] = useState<string>(() => {
    if (initialTransaction) return toInputDate(initialTransaction.date);
    try {
      const draft = localStorage.getItem('finsync_draft_transaction');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.date) return parsed.date;
      }
    } catch {}
    return toInputDate(new Date());
  });

  const [formattedDateDisplay, setFormattedDateDisplay] = useState<string>(() => {
    if (initialTransaction) {
      const initDateObj = new Date(initialTransaction.date);
      if (!isNaN(initDateObj.getTime())) return formatToM3Date(initDateObj);
    }
    return formatToM3Date(new Date());
  });

  const [formattedTimeDisplay, setFormattedTimeDisplay] = useState<string>(() => {
    if (initialTransaction?.time) return initialTransaction.time;
    return formatTime12h(new Date());
  });

  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState<boolean>(false);

  const [fromAccountId, setFromAccountId] = useState<string>(() => {
    if (initialTransaction) return initialTransaction.fromAccountId;
    try {
      const draft = localStorage.getItem('finsync_draft_transaction');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.fromAccountId) return parsed.fromAccountId;
      }
    } catch {}
    const sorted = [...accounts].filter((a) => !a.isArchived).sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    const preferredAcc = (settings.defaultAccountId && sorted.find((a) => a.id === settings.defaultAccountId)) || sorted[0];
    return preferredAcc?.id || '';
  });

  const [toAccountId, setToAccountId] = useState<string>(() => {
    if (initialTransaction) return initialTransaction.toAccountId || '';
    try {
      const draft = localStorage.getItem('finsync_draft_transaction');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.toAccountId) return parsed.toAccountId;
      }
    } catch {}
    const sorted = [...accounts].filter((a) => !a.isArchived).sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    const preferredAcc = (settings.defaultAccountId && sorted.find((a) => a.id === settings.defaultAccountId)) || sorted[0];
    const secondAcc = sorted.length > 1 ? (sorted.find((a) => a.id !== preferredAcc?.id) || sorted[1]) : undefined;
    return secondAcc?.id || '';
  });

  const [categoryId, setCategoryId] = useState<string>(() => {
    if (initialTransaction) return initialTransaction.categoryId || '';
    try {
      const draft = localStorage.getItem('finsync_draft_transaction');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.categoryId) return parsed.categoryId;
      }
    } catch {}
    const preferredExpCat = (settings.defaultExpenseCategoryId && categories.find((c) => c.id === settings.defaultExpenseCategoryId && c.type === 'expense')) || categories.find((c) => c.type === 'expense');
    return preferredExpCat?.id || '';
  });

  const [note, setNote] = useState<string>(() => {
    if (initialTransaction) return initialTransaction.note || '';
    try {
      const draft = localStorage.getItem('finsync_draft_transaction');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.note) return parsed.note;
      }
    } catch {}
    return '';
  });

  const [tagsInput, setTagsInput] = useState<string>(() => {
    if (initialTransaction?.tags) return initialTransaction.tags.join(', ');
    try {
      const draft = localStorage.getItem('finsync_draft_transaction');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.tagsInput) return parsed.tagsInput;
      }
    } catch {}
    return '';
  });

  const [isInvestmentTransfer, setIsInvestmentTransfer] = useState<boolean>(() => initialTransaction?.isInvestmentTransfer ?? true);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  // Modals for "View All Accounts" and "View All Categories"
  const [allAccountsTarget, setAllAccountsTarget] = useState<'from' | 'to' | null>(null);
  const [isAllCategoriesOpen, setIsAllCategoriesOpen] = useState<boolean>(false);
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [categorySearch, setCategorySearch] = useState<string>('');

  // Sorted and filtered accounts
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  }, [accounts]);

  const activeAccounts = useMemo(() => {
    return sortedAccounts.filter((a) => !a.isArchived);
  }, [sortedAccounts]);

  const filteredCategories = useMemo(() => {
    let list: Category[] = [];
    if (type === 'expense') list = categories.filter((c) => c.type === 'expense');
    else if (type === 'income') list = categories.filter((c) => c.type === 'income');
    return [...list].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  }, [categories, type]);

  // Sync state when initialTransaction changes or when modal is opened afresh
  useEffect(() => {
    setConfirmDelete(false);
    if (initialTransaction) {
      setType(initialTransaction.type);
      setAmount(initialTransaction.amount.toString());
      setDate(toInputDate(initialTransaction.date));
      const initDateObj = new Date(initialTransaction.date);
      if (!isNaN(initDateObj.getTime())) {
        setFormattedDateDisplay(formatToM3Date(initDateObj));
      } else {
        setFormattedDateDisplay(formatToM3Date(new Date()));
      }
      setFormattedTimeDisplay(initialTransaction.time || formatTime12h(new Date()));
      setCategoryId(initialTransaction.categoryId || '');
      setFromAccountId(initialTransaction.fromAccountId);
      setToAccountId(initialTransaction.toAccountId || '');
      setNote(initialTransaction.note || '');
      setTagsInput(initialTransaction.tags?.join(', ') || '');
      setIsInvestmentTransfer(initialTransaction.isInvestmentTransfer ?? true);
    }
  }, [initialTransaction?.id, isOpen]);

  // Form draft auto-saver: Cache active keystrokes to storage
  useEffect(() => {
    if (initialTransaction || !isOpen) return;
    const timer = setTimeout(() => {
      if (amount || note || tagsInput) {
        try {
          localStorage.setItem(
            'finsync_draft_transaction',
            JSON.stringify({
              type,
              amount,
              date,
              time: formattedTimeDisplay,
              fromAccountId,
              toAccountId,
              categoryId,
              note,
              tagsInput,
              isInvestmentTransfer,
            })
          );
        } catch {
          // ignore
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [initialTransaction, isOpen, type, amount, date, formattedTimeDisplay, fromAccountId, toAccountId, categoryId, note, tagsInput, isInvestmentTransfer]);

  // Adjust category selection when type switches
  useEffect(() => {
    if (initialTransaction) return;
    if (type === 'expense') {
      const cat =
        (settings.defaultExpenseCategoryId &&
          categories.find((c) => c.id === settings.defaultExpenseCategoryId && c.type === 'expense')) ||
        categories.find((c) => c.type === 'expense');
      if (cat) setCategoryId(cat.id);
    } else if (type === 'income') {
      const cat =
        (settings.defaultIncomeCategoryId &&
          categories.find((c) => c.id === settings.defaultIncomeCategoryId && c.type === 'income')) ||
        categories.find((c) => c.type === 'income');
      if (cat) setCategoryId(cat.id);
    }
  }, [type, categories, initialTransaction, settings.defaultExpenseCategoryId, settings.defaultIncomeCategoryId]);

  const handleClose = () => {
    if (onClose) onClose();
    setIsTransactionModalOpen(false);
    setAllAccountsTarget(null);
    setIsAllCategoriesOpen(false);
  };

  // Register TransactionModal and its internal dialog pickers
  useRegisterOverlay(
    isOpen,
    'transaction_modal',
    initialTransaction ? 'Edit Transaction' : 'Record Transaction',
    handleClose
  );
  useRegisterOverlay(!!allAccountsTarget, 'transaction_accounts_target', 'Select Account', () => setAllAccountsTarget(null));
  useRegisterOverlay(isAllCategoriesOpen, 'transaction_categories_modal', 'Select Category', () => setIsAllCategoriesOpen(false));
  useRegisterOverlay(isDatePickerOpen, 'transaction_datepicker_modal', 'Select Date', () => setIsDatePickerOpen(false));
  useRegisterOverlay(isTimePickerOpen, 'transaction_timepicker_modal', 'Select Time', () => setIsTimePickerOpen(false));

  // Close with Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (allAccountsTarget) {
          setAllAccountsTarget(null);
        } else if (isAllCategoriesOpen) {
          setIsAllCategoriesOpen(false);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allAccountsTarget, isAllCategoriesOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const fromAcc = accounts.find((a) => a.id === fromAccountId) || accounts[0];
    const toAcc = type === 'transfer' ? accounts.find((a) => a.id === toAccountId) : undefined;
    const cat = type === 'transfer' ? undefined : categories.find((c) => c.id === categoryId);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (initialTransaction) {
      updateTransaction(initialTransaction.id, {
        date,
        time: formattedTimeDisplay,
        amount: parsedAmount,
        type,
        categoryId: cat ? cat.id : undefined,
        categoryName: cat ? cat.name : 'Transfer',
        fromAccountId: fromAcc.id,
        fromAccountName: fromAcc.name,
        toAccountId: toAcc ? toAcc.id : undefined,
        toAccountName: toAcc ? toAcc.name : undefined,
        note: note.trim(),
        tags,
        isInvestmentTransfer: type === 'transfer' ? isInvestmentTransfer : false,
      });
    } else {
      addTransaction({
        date,
        time: formattedTimeDisplay,
        amount: parsedAmount,
        type,
        categoryId: cat ? cat.id : undefined,
        categoryName: cat ? cat.name : 'Transfer',
        fromAccountId: fromAcc.id,
        fromAccountName: fromAcc.name,
        toAccountId: toAcc ? toAcc.id : undefined,
        toAccountName: toAcc ? toAcc.name : undefined,
        note: note.trim(),
        tags,
        isInvestmentTransfer: type === 'transfer' ? isInvestmentTransfer : false,
      });
      // Clear saved draft on successful record
      try {
        localStorage.removeItem('finsync_draft_transaction');
      } catch {
        // ignore
      }
    }

    hapticsService.notificationSuccess();
    handleClose();
  };

  const handleDelete = () => {
    if (!initialTransaction) return;
    deleteTransaction(initialTransaction.id);
    handleClose();
  };

  const parsedAmtNum = parseFloat(amount);
  const selectedFromAccount = accounts.find((a) => a.id === fromAccountId);
  const selectedToAccount = accounts.find((a) => a.id === toAccountId);
  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Accounts search filtering for "View All" modal
  const modalAccountsList = sortedAccounts.filter((a) => {
    if (allAccountsTarget === 'to' && a.id === fromAccountId) return false;
    if (!accountSearch.trim()) return true;
    const q = accountSearch.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) ||
      (a.accountNumber && a.accountNumber.includes(q))
    );
  });

  // Category search filtering for "View All" modal
  const modalCategoriesList = filteredCategories.filter((c) => {
    if (!categorySearch.trim()) return true;
    return c.name.toLowerCase().includes(categorySearch.toLowerCase());
  });

  if (!isOpen || typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[250] bg-white dark:bg-slate-900 flex flex-col overflow-hidden isolate animate-in slide-in-from-bottom duration-200 overscroll-contain">
        {/* Fullscreen Sticky Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0 pt-safe">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Back / Close"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                {initialTransaction ? 'Edit Transaction' : 'Record Transaction'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                {type === 'transfer' ? 'Account Transfer' : `${type} Entry`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">{initialTransaction ? 'Update' : 'Save'}</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-6 overflow-y-auto overscroll-contain flex-1 max-w-4xl mx-auto w-full pb-safe pb-36">
            {/* Type selector tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  type === 'expense'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Expense</span>
              </button>

              <button
                type="button"
                onClick={() => setType('income')}
                className={`py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  type === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Income</span>
              </button>

              <button
                type="button"
                onClick={() => setType('transfer')}
                className={`py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  type === 'transfer'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Transfer</span>
              </button>
            </div>

            {/* Date & Time Selector Bar with Calendar & Round Wall Clock Icons */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-xs">
              {/* Date Input with Calendar Icon */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Date
                  </label>
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="relative">
                  <input
                    type="date"
                    max={toInputDate(new Date())}
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      const d = new Date(e.target.value);
                      if (!isNaN(d.getTime())) {
                        setFormattedDateDisplay(formatToM3Date(d));
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white tabular-nums outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Time Input with Round Wall Clock Icon Trigger */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Time
                  </label>
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsTimePickerOpen(true)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white text-left flex items-center justify-between cursor-pointer hover:bg-slate-750 transition-colors"
                  title="Open round wall clock time picker"
                >
                  <span className="truncate">{formattedTimeDisplay}</span>
                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </button>
              </div>
            </div>

            {/* Amount input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Amount (₹)
                </label>
                {!isNaN(parsedAmtNum) && parsedAmtNum > 0 && (
                  <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatINR(parsedAmtNum)}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  required
                  autoFocus={!initialTransaction}
                  value={amount}
                  onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xl font-bold tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Account & Category Selection - Compact Half-Height Cards */}
            {type === 'transfer' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    From & To Accounts
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Tap to change</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* From Account Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setAccountSearch('');
                      setAllAccountsTarget('from');
                    }}
                    className="w-full h-[84px] rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:border-blue-500/60 px-3 py-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group shadow-xs active:scale-95"
                  >
                    <div className="shrink-0 group-hover:scale-105 transition-transform">
                      {selectedFromAccount && (
                        <AccountAvatar account={selectedFromAccount} size="sm" />
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate w-full px-1 mt-1 group-hover:text-blue-600 transition-colors">
                      {selectedFromAccount ? selectedFromAccount.name : 'Select Account'}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 tabular-nums font-semibold truncate w-full">
                      {selectedFromAccount ? formatINR(selectedFromAccount.balance, true) : 'Choose bank'}
                    </span>
                  </button>

                  {/* To Account Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setAccountSearch('');
                      setAllAccountsTarget('to');
                    }}
                    className="w-full h-[84px] rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:border-blue-500/60 px-3 py-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group shadow-xs active:scale-95"
                  >
                    <div className="shrink-0 group-hover:scale-105 transition-transform">
                      {selectedToAccount && (
                        <AccountAvatar account={selectedToAccount} size="sm" />
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate w-full px-1 mt-1 group-hover:text-blue-600 transition-colors">
                      {selectedToAccount ? selectedToAccount.name : 'Select Target Account'}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 tabular-nums font-semibold truncate w-full">
                      {selectedToAccount ? formatINR(selectedToAccount.balance, true) : 'Choose bank'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Payment Mode & Category
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Tap to change</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Selected / Default Account Tile */}
                  <button
                    type="button"
                    onClick={() => {
                      setAccountSearch('');
                      setAllAccountsTarget('from');
                    }}
                    className="w-full h-[84px] rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:border-emerald-500/60 px-3 py-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group shadow-xs active:scale-95"
                  >
                    <div className="shrink-0 group-hover:scale-105 transition-transform">
                      {selectedFromAccount && (
                        <AccountAvatar account={selectedFromAccount} size="sm" />
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate w-full px-1 mt-1 group-hover:text-emerald-600 transition-colors">
                      {selectedFromAccount ? selectedFromAccount.name : 'Select Account'}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 tabular-nums font-semibold truncate w-full">
                      {selectedFromAccount ? formatINR(selectedFromAccount.balance, true) : 'Choose bank'}
                    </span>
                  </button>

                  {/* Selected / Default Category Tile */}
                  <button
                    type="button"
                    onClick={() => {
                      setCategorySearch('');
                      setIsAllCategoriesOpen(true);
                    }}
                    className="w-full h-[84px] rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:border-emerald-500/60 px-3 py-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group shadow-xs active:scale-95"
                  >
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0"
                      style={{ backgroundColor: selectedCategory?.color || '#10b981' }}
                    >
                      <IconRenderer name={selectedCategory?.icon || 'Tag'} className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate w-full px-1 mt-1 group-hover:text-emerald-600 transition-colors">
                      {selectedCategory ? selectedCategory.name : 'Select Category'}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 capitalize font-medium truncate w-full">
                      {selectedCategory ? `${selectedCategory.type} Category` : 'Choose'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Note / Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Note / Description
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Swiggy gourmet dinner, D-Mart monthly rations"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Tags (comma-separated) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tags (comma separated)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Tag className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="UPI, Needs, Discretionary, Vacation"
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {/* Quick Tag suggestions */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['UPI', 'Card', 'Cash', 'Food', 'Bill', 'Needs', 'Wants'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const current = tagsInput
                        ? tagsInput.split(',').map((t) => t.trim())
                        : [];
                      if (!current.includes(tag)) {
                        setTagsInput(current.length > 0 ? `${tagsInput}, ${tag}` : tag);
                      }
                    }}
                    className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              {initialTransaction ? (
                confirmDelete ? (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                    <span className="text-xs font-semibold text-rose-600">Delete entry?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs active:scale-95 transition-all shadow-xs cursor-pointer"
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                )
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-8 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{initialTransaction ? 'Update Entry' : 'Save Entry'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

      {/* Dedicated Full-Screen Grouped Account Selection View */}
      <AccountSelectFullScreenModal
        isOpen={allAccountsTarget !== null}
        onClose={() => setAllAccountsTarget(null)}
        onSelect={(acc) => {
          if (allAccountsTarget === 'from') {
            setFromAccountId(acc.id);
          } else {
            setToAccountId(acc.id);
          }
          setAllAccountsTarget(null);
        }}
        selectedAccountId={allAccountsTarget === 'from' ? fromAccountId : toAccountId}
        excludeAccountId={allAccountsTarget === 'to' ? fromAccountId : undefined}
        title={allAccountsTarget === 'to' ? 'Select Destination Account' : 'Select Payment / From Account'}
        subtitle="Grouped by Bank Accounts, Credit Cards, and Wallets"
      />

      {/* FULL-SCREEN Category Selection (Accommodates up to 16 items with compact icons and labels) */}
      {isAllCategoriesOpen && createPortal(
        <div className="fixed inset-0 z-[300] bg-white dark:bg-slate-900 flex flex-col h-full w-full overflow-hidden isolate animate-in slide-in-from-bottom duration-200 overscroll-contain">
          {/* Top Bar with Back action */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0 pt-safe">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAllCategoriesOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Back to Entry"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Select {type === 'expense' ? 'Expense' : 'Income'} Category</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {filteredCategories.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Tap any category to select and return</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAllCategoriesOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Compact Search filter */}
          <div className="px-4 sm:px-6 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="relative max-w-xl mx-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search category name..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Categories Grid: 4 columns x 4 rows = 16 items visible at once */}
          <div className="p-3 sm:p-5 overflow-y-auto flex-1 pb-6 sm:pb-8">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-2.5 max-w-4xl mx-auto">
              {modalCategoriesList.map((cat) => {
                const isSelected = cat.id === categoryId;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(cat.id);
                      setIsAllCategoriesOpen(false);
                    }}
                    className={`aspect-square p-2 sm:p-2.5 rounded-2xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer relative overflow-hidden active:scale-95 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/30 shadow-xs'
                        : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white mb-1.5 shadow-xs shrink-0"
                      style={{ backgroundColor: cat.color }}
                    >
                      <IconRenderer name={cat.icon} className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold truncate w-full px-0.5 leading-tight block">
                      {cat.name}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium truncate w-full mt-0.5 block capitalize">
                      {cat.type}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Material 3 Date Picker Dialog */}
      <MaterialDatePickerDialog
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        initialDate={new Date(date)}
        onSelect={(dateObj, formattedStr) => {
          setDate(toInputDate(dateObj));
          setFormattedDateDisplay(formattedStr);
        }}
      />

      {/* Material 3 Time Picker Dialog */}
      <MaterialTimePickerDialog
        isOpen={isTimePickerOpen}
        onClose={() => setIsTimePickerOpen(false)}
        initialTime={formattedTimeDisplay}
        onSelect={(timeStr) => {
          setFormattedTimeDisplay(timeStr);
        }}
      />
    </>,
    document.body
  );
};
