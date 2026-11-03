import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { Account, PassbookRow, Transaction, AccountAdjustment } from '../../types';
import { formatINR, formatDate, parseDate, adjustHexColor, isColorLight, formatDateTimeHHMM, getTransactionTimestamp, extractTimeHHMM, toInputDate } from '../../utils/formatters';
import { IconRenderer } from '../common/IconRenderer';
import { AccountAvatar } from '../common/AccountAvatar';
import { TransactionModal } from '../transactions/TransactionModal';
import { CreditCardPayModal } from './CreditCardPayModal';
import { CreditCardBillsView } from './CreditCardBillsView';
import { useRegisterOverlay } from '../../navigation/NavigationContext';
import { fileService } from '../../services/fileService';
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Edit2,
  Trash2,
  SlidersHorizontal,
  Download,
  Plus,
  Check,
  X,
  CreditCard,
  Receipt,
  ArrowUpDown,
  Tag,
  Calendar,
  ShieldCheck,
  Search,
  Info,
  History,
  Clock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface PassbookViewProps {
  account: Account;
  onBack: () => void;
  onEditAccount: (acc: Account) => void;
}

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

const formatDueDay = (day?: number) => {
  if (!day) return null;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  const suffix = s[(v - 20) % 10] || s[v] || s[0];
  return `${day}${suffix}`;
};

export const PassbookView: React.FC<PassbookViewProps> = ({
  account: initialAccount,
  onBack,
  onEditAccount,
}) => {
  const { accounts, transactions, getAccountPassbook, deleteTransaction, reconcileAccountBalance, getAccountAdjustments, updateAccountAdjustment, deleteAccountAdjustment, setIsTransactionModalOpen, openSettingsTab } =
    useApp();

  const account = accounts.find((a) => a.id === initialAccount.id) || initialAccount;

  const [filterType, setFilterType] = useState<'all' | 'debit' | 'credit'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isAdjustmentLedgerOpen, setIsAdjustmentLedgerOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');

  // Dedicated Audit Ledger Reconciliations for this account
  const adjustments = useMemo(() => {
    return getAccountAdjustments(account.id);
  }, [getAccountAdjustments, account.id, accounts]);

  const netVariance = useMemo(() => {
    return adjustments.reduce((sum, adj) => sum + adj.difference, 0);
  }, [adjustments]);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isPayBillOpen, setIsPayBillOpen] = useState(false);
  const [isBillsOpen, setIsBillsOpen] = useState(false);
  const [newBalanceInput, setNewBalanceInput] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedRowForAction, setSelectedRowForAction] = useState<PassbookRow | null>(null);
  const [confirmDeleteRowTx, setConfirmDeleteRowTx] = useState(false);

  // States for Adjustment Ledger tap action sheet and edit modal
  const [selectedAdjustmentForAction, setSelectedAdjustmentForAction] = useState<AccountAdjustment | null>(null);
  const [confirmDeleteAdjustment, setConfirmDeleteAdjustment] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<AccountAdjustment | null>(null);
  const [editAdjBalance, setEditAdjBalance] = useState('');
  const [editAdjNote, setEditAdjNote] = useState('');
  const [editAdjDate, setEditAdjDate] = useState('');
  const [editAdjTime, setEditAdjTime] = useState('');

  // Register Passbook overlays & sheets with dynamic hardware back sequence
  useRegisterOverlay(isAdjustModalOpen, 'passbook_adjust_modal', 'Adjust Balance', () => setIsAdjustModalOpen(false));
  useRegisterOverlay(isPayBillOpen, 'passbook_pay_bill_modal', 'Pay Credit Card Bill', () => setIsPayBillOpen(false));
  useRegisterOverlay(isBillsOpen, 'passbook_bills_modal', 'Credit Card Bills', () => setIsBillsOpen(false));
  useRegisterOverlay(isInfoOpen, 'passbook_info_modal', 'Account Info', () => setIsInfoOpen(false));
  useRegisterOverlay(isAdjustmentLedgerOpen, 'passbook_adjustment_ledger', 'Adjustment Ledger', () => setIsAdjustmentLedgerOpen(false));
  useRegisterOverlay(!!selectedRowForAction, 'passbook_row_action', 'Passbook Action Sheet', () => setSelectedRowForAction(null));
  useRegisterOverlay(!!selectedAdjustmentForAction, 'passbook_adj_action', 'Adjustment Action Sheet', () => setSelectedAdjustmentForAction(null));
  useRegisterOverlay(!!editingAdjustment, 'passbook_edit_adj', 'Edit Adjustment', () => setEditingAdjustment(null));

  // Memoize passbook row calculation so keystrokes in search don't re-calculate running balances
  const passbookRows = useMemo(() => {
    return getAccountPassbook(account.id);
  }, [getAccountPassbook, account.id, transactions, account.initialBalance]);

  // Filter passbook rows
  const filteredRows = useMemo(() => {
    return passbookRows.filter((row) => {
      if (filterType === 'debit' && row.debit === null) return false;
      if (filterType === 'credit' && row.credit === null) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchDesc = row.description.toLowerCase().includes(q);
        const matchCat = row.transaction.categoryName ? row.transaction.categoryName.toLowerCase().includes(q) : false;
        const matchNote = row.transaction.note?.toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchNote) return false;
      }
      return true;
    });
  }, [passbookRows, filterType, searchTerm]);

  const [visibleCount, setVisibleCount] = useState(250);

  // Reset pagination when account, filter or search changes
  useEffect(() => {
    setVisibleCount(250);
  }, [account.id, filterType, searchTerm, sortBy]);

  useEffect(() => {
    if (selectedRowForAction) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedRowForAction]);

  // Sort rows based on sortBy selection taking date & timestamp into account
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (sortBy === 'date-desc') {
        return getTransactionTimestamp(b.transaction) - getTransactionTimestamp(a.transaction);
      }
      if (sortBy === 'date-asc') {
        return getTransactionTimestamp(a.transaction) - getTransactionTimestamp(b.transaction);
      }
      const amtA = a.transaction.amount;
      const amtB = b.transaction.amount;
      if (sortBy === 'amount-desc') {
        return amtB - amtA;
      }
      if (sortBy === 'amount-asc') {
        return amtA - amtB;
      }
      return 0;
    });
  }, [filteredRows, sortBy]);

  const displayedRows = useMemo(() => {
    return sortedRows.slice(0, visibleCount);
  }, [sortedRows, visibleCount]);

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(newBalanceInput);
    if (!isNaN(parsed)) {
      const targetBal = account.type === 'credit' && parsed > 0 ? -parsed : parsed;
      reconcileAccountBalance(
        account.id,
        targetBal,
        adjustNote
      );
      setIsAdjustModalOpen(false);
      setNewBalanceInput('');
      setAdjustNote('');
    }
  };

  // Export individual passbook as CSV with DD/MM/YYYY HH:MM strictly in Date column
  const handleExportPassbookCSV = () => {
    const headers = ['Date', 'Particulars / Description', 'Category', 'Debit (Withdrawal)', 'Credit (Deposit)', 'Current Balance'];
    const rows = sortedRows.map((r) => [
      formatDateTimeHHMM(r.transaction.date, r.transaction.time, r.transaction.createdAt),
      `"${r.description.replace(/"/g, '""')}"`,
      `"${r.transaction.categoryName || ''}"`,
      r.debit !== null ? r.debit.toFixed(2) : '',
      r.credit !== null ? r.credit.toFixed(2) : '',
      r.balanceAfter.toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const filename = `Passbook_${account.name.replace(/\s+/g, '_')}_${formatDate(new Date()).replace(/\//g, '-')}.csv`;
    fileService.exportAndShare({
      filename,
      content: csvContent,
      mimeType: 'text/csv;charset=utf-8;',
      title: `${account.name} Passbook Ledger`,
      dialogTitle: 'Save or Share Passbook',
    });
  };

  // Export adjustment audit ledger as CSV
  const handleExportAdjustmentsCSV = () => {
    const headers = ['Timestamp', 'Date', 'Time', 'Old Balance', 'New Balance', 'Variance', 'Reason / Note'];
    const rows = adjustments.map((adj) => {
      const dt = new Date(adj.timestamp);
      const dateStr = formatDate(dt);
      const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      return [
        `"${adj.timestamp}"`,
        `"${dateStr}"`,
        `"${timeStr}"`,
        adj.oldBalance.toFixed(2),
        adj.newBalance.toFixed(2),
        adj.difference.toFixed(2),
        `"${(adj.note || 'Balance reconciliation').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const filename = `Adjustments_${account.name.replace(/\s+/g, '_')}_${formatDate(new Date()).replace(/\//g, '-')}.csv`;
    fileService.exportAndShare({
      filename,
      content: csvContent,
      mimeType: 'text/csv;charset=utf-8;',
      title: `${account.name} Adjustments Ledger`,
      dialogTitle: 'Save or Share Adjustments Ledger',
    });
  };

  const handleEditAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdjustment) return;
    const parsed = parseFloat(editAdjBalance);
    if (isNaN(parsed)) return;

    // Build timestamp from edited date & time
    const baseDate = parseDate(editAdjDate);
    const [h, m] = (editAdjTime || '00:00').split(':').map(Number);
    baseDate.setHours(h || 0, m || 0, 0, 0);

    updateAccountAdjustment(editingAdjustment.id, {
      newBalance: parsed,
      note: editAdjNote.trim() || undefined,
      timestamp: baseDate.toISOString(),
    });

    setEditingAdjustment(null);
  };


  const handleRowClick = (row: PassbookRow) => {
    setSelectedRowForAction(row);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Navigation & Back Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Accounts</span>
        </button>

        <div className="flex items-center gap-2">
          {account.type === 'credit' && (
            <button
              onClick={() => setIsBillsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/70 dark:border-indigo-800/60 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
              title="View Monthly Bills & Billing Cycles"
            >
              <Receipt className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Bills</span>
            </button>
          )}
          <button
            onClick={handleExportPassbookCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Export this Passbook as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Passbook</span>
          </button>
          {(account.type === 'bank' || account.type === 'credit') ? (
            <button
              onClick={() => openSettingsTab('security')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl hover:bg-emerald-100 transition-colors"
              title="Bank accounts & credit cards are protected. Manage in Settings."
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Protected (Settings)</span>
              <span className="sm:hidden">Protected</span>
            </button>
          ) : (
            <button
              onClick={() => onEditAccount(account)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Account Passbook Master Header Card - Customised Color Fills the Entire Card */}
      {(() => {
        const accountColor = account.color || '#059669';
        const darkerColor = adjustHexColor(accountColor, -24);
        const isLight = isColorLight(accountColor);
        const textColorClass = isLight ? 'text-slate-900' : 'text-white';
        const frostedBtnClass = isLight
          ? 'bg-black/10 hover:bg-black/20 text-slate-900 border border-black/15 shadow-2xs'
          : 'bg-white/20 hover:bg-white/30 text-white border border-white/25 shadow-2xs';
        const frostedBadgeClass = isLight
          ? 'bg-black/10 text-slate-900 border border-black/15 backdrop-blur-xs'
          : 'bg-white/20 text-white border border-white/25 backdrop-blur-xs';

        return (
          <div
            style={{
              background: `linear-gradient(135deg, ${accountColor} 0%, ${darkerColor} 100%)`,
              boxShadow: `0 16px 36px -8px ${accountColor}45, 0 8px 16px -4px ${accountColor}25`,
            }}
            className={`relative p-5 sm:p-6 rounded-3xl border border-white/25 shadow-xl overflow-hidden transition-all duration-300 ${textColorClass}`}
          >
            {/* Subtle decorative physical passbook / metallic card specular lighting */}
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-white/15 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-black/20 blur-2xl pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0 relative z-10">
              <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <AccountAvatar
                  account={account}
                  size="md"
                  className="rounded-2xl shrink-0 ring-2 ring-white/60 shadow-md"
                />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                    <h2
                      className={`text-base sm:text-xl font-extrabold truncate drop-shadow-xs ${textColorClass}`}
                      title={account.name}
                    >
                      {account.name}
                    </h2>
                    <span
                      className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${frostedBadgeClass}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current opacity-80" />
                      <span>{account.type}</span>
                    </span>
                    {account.accountNumber && (
                      <span className={`text-[10px] sm:text-[11px] font-mono px-1.5 py-0.5 rounded-md shrink-0 ${frostedBadgeClass}`}>
                        •••• {account.accountNumber}
                      </span>
                    )}

                    {/* Quick Action Toolbar: Info (i), Search, and Add Entry (+) */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-0.5">
                      {/* Small "i" info icon button */}
                      <button
                        type="button"
                        onClick={() => setIsInfoOpen(true)}
                        className={`p-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${frostedBtnClass}`}
                        title="View opening balance & account info"
                        aria-label="View account info"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>

                      {/* Search icon / expandable search bar */}
                      {isSearchExpanded ? (
                        <div
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl shadow-xs animate-in fade-in duration-150 ${
                            isLight
                              ? 'bg-black/10 border border-black/20 text-slate-900'
                              : 'bg-white/20 backdrop-blur-md border border-white/30 text-white'
                          }`}
                        >
                          <Search className="w-3.5 h-3.5 opacity-70 shrink-0" />
                          <input
                            type="text"
                            autoFocus
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search passbook..."
                            className="w-24 sm:w-36 bg-transparent text-xs outline-none font-medium placeholder-current opacity-90"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSearchTerm('');
                              setIsSearchExpanded(false);
                            }}
                            className="opacity-70 hover:opacity-100 p-0.5 cursor-pointer"
                            title="Close search"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsSearchExpanded(true)}
                          className={`p-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
                            searchTerm
                              ? 'bg-white text-slate-900 font-bold shadow-md'
                              : frostedBtnClass
                          }`}
                          title={searchTerm ? `Searching: "${searchTerm}"` : 'Search this passbook'}
                          aria-label="Search passbook"
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Small "+" Add Entry button */}
                      <button
                        type="button"
                        onClick={() => setIsTransactionModalOpen(true)}
                        className="p-1.5 rounded-xl bg-white text-slate-900 hover:bg-white/90 active:scale-95 shadow-md transition-all cursor-pointer shrink-0 flex items-center justify-center font-bold"
                        title="Add Entry to this passbook"
                        aria-label="Add Entry"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {account.type === 'credit' ? (
                <div className="flex flex-col sm:items-end justify-between sm:justify-center min-w-0 shrink-0 gap-1.5">
                  <div className="flex items-center sm:items-end justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 sm:justify-end">
                      <div className="sm:text-right">
                        <span className="text-[10px] sm:text-[11px] opacity-80 font-semibold uppercase tracking-wider block">
                          Available Limit
                        </span>
                        <div
                          className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight tabular-nums truncate block drop-shadow-xs"
                          title={formatINR(Math.max(0, (account.creditLimit || 0) + account.balance))}
                        >
                          {formatINR(Math.max(0, (account.creditLimit || 0) + account.balance))}
                        </div>
                      </div>

                      {/* Adjustment Edit Sign for credit cards */}
                      <button
                        type="button"
                        onClick={() => {
                          setNewBalanceInput(account.balance < 0 ? Math.abs(account.balance).toString() : account.balance.toString());
                          setIsAdjustModalOpen(true);
                        }}
                        className={`p-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center justify-center ${frostedBtnClass}`}
                        title="Adjust balance"
                        aria-label="Adjust balance"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Credit Card Action Buttons: Bills & Pay Bill */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsBillsOpen(true)}
                        className="px-3 py-1.5 bg-white text-indigo-700 hover:bg-white/95 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap cursor-pointer active:scale-95"
                        title="View monthly credit card bills and cycle statements"
                      >
                        <Receipt className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                        <span>Bills</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPayBillOpen(true)}
                        className="px-3 py-1.5 bg-white text-rose-700 hover:bg-white/95 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap cursor-pointer active:scale-95"
                      >
                        <CreditCard className="w-3.5 h-3.5 shrink-0" />
                        <span>Pay Bill</span>
                      </button>
                    </div>
                  </div>

                  {/* Payment Due Date */}
                  {account.paymentDueDay && (
                    <div className="text-xs opacity-90 font-semibold sm:text-right">
                      Payment Due: {formatDueDay(account.paymentDueDay)} of month
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center sm:items-end justify-between sm:justify-center flex-row sm:flex-col min-w-0 shrink-0">
                  <span className="text-[10px] sm:text-[11px] opacity-80 font-medium">Live Current Balance</span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight tabular-nums truncate block drop-shadow-xs"
                      title={formatINR(account.balance)}
                    >
                      {formatINR(account.balance)}
                    </div>
                    {/* Small edit icon right beside current balance to edit it */}
                    <button
                      type="button"
                      onClick={() => {
                        setNewBalanceInput(account.balance.toString());
                        setIsAdjustModalOpen(true);
                      }}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${frostedBtnClass}`}
                      title="Adjust live balance"
                      aria-label="Adjust live balance"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Credit Card Utilization & Usage Bar */}
            {account.type === 'credit' && (
              <div className="mt-4 pt-3 border-t border-white/20 space-y-1.5 relative z-10">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="opacity-85 font-semibold">
                      Credit Utilised:
                    </span>
                    <span className="font-extrabold tabular-nums">
                      {formatINR(Math.max(0, -account.balance))}
                    </span>
                    {account.creditLimit && (
                      <span className="opacity-75 font-medium">
                        / Limit: <strong className="font-bold tabular-nums">{formatINR(account.creditLimit)}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold tabular-nums">
                      {((Math.max(0, -account.balance) / (account.creditLimit || 1)) * 100).toFixed(1)}% used
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${frostedBadgeClass}`}
                    >
                      {((Math.max(0, -account.balance) / (account.creditLimit || 1)) * 100) <= 30
                        ? 'Optimal (<30%)'
                        : ((Math.max(0, -account.balance) / (account.creditLimit || 1)) * 100) <= 70
                        ? 'Moderate'
                        : 'High Usage'}
                    </span>
                  </div>
                </div>

                {/* The line indicating usage */}
                <div className="w-full h-2 rounded-full bg-black/25 overflow-hidden ring-1 ring-white/20">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      ((Math.max(0, -account.balance) / (account.creditLimit || 1)) * 100) <= 30
                        ? 'bg-emerald-300'
                        : ((Math.max(0, -account.balance) / (account.creditLimit || 1)) * 100) <= 70
                        ? 'bg-amber-300'
                        : 'bg-rose-300'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          2,
                          ((Math.max(0, -account.balance) / (account.creditLimit || 1)) * 100)
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Filter and Quick Sort controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Debit/Credit filters */}
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    filterType === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('debit')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    filterType === 'debit'
                      ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Debits (-₹)
                </button>
                <button
                  onClick={() => setFilterType('credit')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    filterType === 'credit'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Credits (+₹)
                </button>
              </div>

              {/* Quick Sort dropdown */}
              <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs shrink-0">
                <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer text-xs"
                >
                  <option value="date-desc">Newest</option>
                  <option value="date-asc">Oldest</option>
                  <option value="amount-desc">High Amount</option>
                  <option value="amount-asc">Low Amount</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium shrink-0">
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <span>"{searchTerm}"</span>
                  <X className="w-3 h-3" />
                </button>
              )}
              <span className="tabular-nums font-semibold text-slate-500 dark:text-slate-400 text-xs">
                {sortedRows.length} {sortedRows.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
          </div>

      {/* INDIVIDUAL PASSBOOK LEDGER - Compact 2-Line Row Layout (Visible Without Scrolling) */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {sortedRows.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm font-medium">No passbook records found.</p>
            <p className="text-xs mt-1">Tap (+) below to record your first transaction for this account.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayedRows.map((row) => {
                const tx = row.transaction;
                const isCredit = row.credit !== null;

                return (
                  <div
                    key={tx.id}
                    onClick={() => handleRowClick(row)}
                    className="px-3.5 py-2.5 sm:px-5 sm:py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group active:bg-slate-100 dark:active:bg-slate-800 min-w-0"
                    title="Tap to Edit or Delete transaction"
                  >
                    {/* Line 1 (Top): Transaction Title/Note on the left | Date on the right */}
                    <div className="flex items-center justify-between gap-2.5 text-xs sm:text-sm min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {row.description}
                        </span>
                        {tx.isBalanceAdjustment ? (
                          <span className="shrink-0 text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                            Adjustment
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-normal truncate hidden sm:inline">
                            · {tx.categoryName || (tx.type === 'transfer' ? 'Transfer' : 'General')}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium tabular-nums ml-2">
                        {row.dateFormatted}
                      </span>
                    </div>

                    {/* Line 2 (Bottom): Credit/Debit Amount on left (+ in green, - in red) | Bal: ₹X,XX,XXX on right */}
                    <div className="flex items-center justify-between gap-2.5 mt-1 text-xs sm:text-sm min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <span
                          className={`font-bold tabular-nums text-xs sm:text-sm md:text-base shrink-0 whitespace-nowrap ${
                            isCredit
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isCredit ? `+${formatINR(row.credit!)}` : `-${formatINR(row.debit || tx.amount)}`}
                        </span>
                        {tx.tags && tx.tags.length > 0 && (
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px] hidden md:inline">
                            [{tx.tags.join(', ')}]
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2 text-right">
                        <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                          Bal: <strong className="font-semibold text-slate-800 dark:text-slate-200">{formatINR(row.balanceAfter)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {sortedRows.length > visibleCount && (
              <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 font-medium">
                  Showing {Math.min(visibleCount, sortedRows.length)} of {sortedRows.length.toLocaleString('en-IN')} entries
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 100)}
                    className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    Load 100 More
                  </button>
                  {sortedRows.length > visibleCount + 500 && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 1000)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      Load 1,000 More
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setVisibleCount(sortedRows.length)}
                    className="px-3.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Show All
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tap Action Modal / Sheet giving direct option to EDIT or DELETE */}
      {selectedRowForAction && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150 isolate"
          onClick={() => setSelectedRowForAction(null)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Passbook Entry
                </h3>
                <span className="text-xs text-slate-400">{selectedRowForAction.dateFormatted}</span>
              </div>
              <button
                onClick={() => {
                  setSelectedRowForAction(null);
                  setConfirmDeleteRowTx(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-2.5 overflow-hidden min-w-0">
              <div className="flex justify-between items-start gap-2.5 min-w-0">
                <span className="text-xs text-slate-500 shrink-0">Particulars:</span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white text-right break-words min-w-0 max-w-[70%]">
                  {selectedRowForAction.description}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2.5 min-w-0">
                <span className="text-xs text-slate-500 shrink-0">Amount:</span>
                <span
                  className={`text-sm font-bold tabular-nums whitespace-nowrap ${
                    selectedRowForAction.credit !== null
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {selectedRowForAction.credit !== null
                    ? `+${formatINR(selectedRowForAction.credit)}`
                    : `-${formatINR(selectedRowForAction.debit || selectedRowForAction.transaction.amount)}`}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2.5 min-w-0">
                <span className="text-xs text-slate-500 shrink-0">Post Balance:</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                  {formatINR(selectedRowForAction.balanceAfter)}
                </span>
              </div>
              {selectedRowForAction.transaction.categoryName && (
                <div className="flex justify-between items-center gap-2.5 min-w-0">
                  <span className="text-xs text-slate-500 shrink-0">Category:</span>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {selectedRowForAction.transaction.categoryName}
                  </span>
                </div>
              )}
              {selectedRowForAction.transaction.note && (
                <div className="flex justify-between items-start gap-2.5 min-w-0">
                  <span className="text-xs text-slate-500 shrink-0">Note:</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300 text-right break-words min-w-0 max-w-[70%]">
                    {selectedRowForAction.transaction.note}
                  </span>
                </div>
              )}
            </div>

            {/* Tap Action Buttons: Edit or Delete */}
            {confirmDeleteRowTx ? (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2.5 animate-in fade-in">
                <div className="text-center">
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    Delete this passbook entry?
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Linked account balance will be restored automatically.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteRowTx(false)}
                    className="py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const txId = selectedRowForAction.transaction.id;
                      deleteTransaction(txId);
                      setSelectedRowForAction(null);
                      setConfirmDeleteRowTx(false);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const tx = selectedRowForAction.transaction;
                    setSelectedRowForAction(null);
                    setTimeout(() => {
                      setEditingTransaction(tx);
                    }, 50);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit Entry</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteRowTx(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 font-semibold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Entry</span>
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Manual Live Balance Adjustment Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Adjust {account.type === 'credit' ? 'Credit Card Balance' : 'Account Live Balance'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-3 text-xs sm:text-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {account.type === 'credit'
                  ? `Enter current outstanding spent amount for ${account.name} (currently ${formatINR(Math.max(0, -account.balance))}). The system will auto-calculate the difference and log a balance adjustment transaction.`
                  : `Enter the exact verified balance of ${account.name}. The system will auto-calculate the difference and log a balance adjustment transaction in your passbook.`}
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {account.type === 'credit' ? 'Current Outstanding / Spent (₹)' : 'New Actual Balance (₹)'}
                </label>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  required
                  value={newBalanceInput}
                  onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  onChange={(e) => setNewBalanceInput(e.target.value)}
                  placeholder={account.type === 'credit' ? 'e.g. 5000' : 'e.g. 25000'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold tabular-nums text-base focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason / Adjustment Note (Optional)
                </label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="e.g. Bank statement reconciliation, cash count"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Info Modal (Triggered by small "i" icon) */}
      {isInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Account Details
                  </h3>
                  <span className="text-[11px] text-slate-400">Ledger overview</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Account Name</span>
                <span className="font-bold text-slate-900 dark:text-white">{account.name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Account Type</span>
                <span className="font-semibold text-slate-900 dark:text-white capitalize">{account.type}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Opening Balance</span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">{formatINR(account.initialBalance)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Total Ledger Entries</span>
                <span className="font-semibold text-slate-900 dark:text-white">{passbookRows.length} entries</span>
              </div>
              {account.accountNumber && (
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Account Number</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">•••• {account.accountNumber}</span>
                </div>
              )}
              {account.type === 'credit' && account.creditLimit && (
                <>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Credit Limit</span>
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums">{formatINR(account.creditLimit)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Available Credit</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatINR(account.creditLimit + account.balance)}
                    </span>
                  </div>
                  {account.paymentDueDay && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">Due Day</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{account.paymentDueDay}th of month</span>
                    </div>
                  )}
                </>
              )}
              {account.notes && (
                <div className="py-1">
                  <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Notes:</span>
                  <span className="text-slate-700 dark:text-slate-300 italic">{account.notes}</span>
                </div>
              )}

              {/* See Adjustment Ledger Button */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsInfoOpen(false);
                    setIsAdjustmentLedgerOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-50/80 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-200/70 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 transition-all group cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                      <History className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>See Adjustment Ledger</span>
                        {adjustments.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-amber-500/20 text-amber-800 dark:text-amber-300">
                            {adjustments.length}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-amber-700 dark:text-amber-400">
                        {adjustments.length === 0
                          ? 'View audit reconciliations & variance'
                          : `${adjustments.length} reconciliation record${adjustments.length === 1 ? '' : 's'}`}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Adjustment Ledger - App Fullscreen View */}
      {isAdjustmentLedgerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-200">
          {/* Sticky Fullscreen Top Header */}
          <div className="px-4 py-3.5 sm:px-6 sm:py-4 pt-safe border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3 shadow-2xs z-10 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setIsAdjustmentLedgerOpen(false);
                }}
                className="p-2 -ml-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
                title="Back to Passbook"
                aria-label="Back to Passbook"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                  <History className="w-5 h-5 text-amber-500 shrink-0" />
                  <span className="truncate">Adjustment Ledger</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {account.name} • Audit Trail & Variance
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {adjustments.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportAdjustmentsCSV}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Export Adjustment Audit Trail as CSV"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsAdjustmentLedgerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Metric KPI Mini-Banner */}
          <div className="px-4 py-3 sm:px-6 grid grid-cols-3 gap-2.5 bg-slate-100/60 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/80 text-xs shrink-0">
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider block">
                Adjustments
              </span>
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                {adjustments.length}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider block">
                Net Variance
              </span>
              <span
                className={`text-sm sm:text-base font-black tabular-nums truncate block ${
                  netVariance > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : netVariance < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {netVariance > 0 ? `+${formatINR(netVariance)}` : netVariance < 0 ? `-${formatINR(Math.abs(netVariance))}` : '₹0.00'}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider block">
                Live Balance
              </span>
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums truncate block">
                {formatINR(account.balance)}
              </span>
            </div>
          </div>

          {/* Hint banner */}
          <div className="px-4 py-2 sm:px-6 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/40 dark:border-amber-900/30 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 shrink-0">
            <span className="flex items-center gap-1.5 font-medium">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Tap any adjustment entry below to edit reconciled value, notes, or delete it.</span>
            </span>
          </div>

          {/* Scrollable list of adjustments */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-3 pb-safe pb-24">
            {adjustments.length === 0 ? (
              <div className="py-16 px-4 text-center max-w-sm mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-3.5 shadow-2xs">
                  <History className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  No balance adjustments yet
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  When you reconcile or adjust this account's balance with actual statements or physical cash counts, an immutable audit trail is logged here.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdjustmentLedgerOpen(false);
                    setNewBalanceInput(account.balance < 0 ? Math.abs(account.balance).toString() : account.balance.toString());
                    setIsAdjustModalOpen(true);
                  }}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Reconcile Balance</span>
                </button>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-2.5">
                {adjustments.map((adj) => {
                  const dt = new Date(adj.timestamp);
                  const isPositive = adj.difference > 0;
                  const dateStr = formatDate(dt);
                  const timeStr = dt.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });

                  return (
                    <div
                      key={adj.id}
                      onClick={() => {
                        setSelectedAdjustmentForAction(adj);
                        setConfirmDeleteAdjustment(false);
                      }}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2.5 hover:border-amber-400/80 dark:hover:border-amber-500/80 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <History className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white text-sm truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {adj.note || 'Balance Reconciliation'}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-black px-2.5 py-1 rounded-full tabular-nums shrink-0 ${
                            isPositive
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {isPositive ? `+${formatINR(adj.difference)}` : `-${formatINR(Math.abs(adj.difference))}`}
                        </span>
                      </div>

                      {/* Transition flow */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums bg-slate-50 dark:bg-slate-850/60 p-2.5 rounded-xl">
                        <span>Previous: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{formatINR(adj.oldBalance)}</strong></span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Reconciled: <strong className="text-slate-900 dark:text-white font-bold">{formatINR(adj.newBalance)}</strong></span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Audit Verified • Tap to edit or delete</span>
                        </span>
                        <span className="flex items-center gap-1 tabular-nums">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{dateStr} • {timeStr}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fullscreen Sticky Bottom Footer */}
          <div className="p-4 sm:px-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsAdjustmentLedgerOpen(false);
                setNewBalanceInput(account.balance < 0 ? Math.abs(account.balance).toString() : account.balance.toString());
                setIsAdjustModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-200/60 dark:border-amber-800/60 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Adjustment</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAdjustmentLedgerOpen(false)}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Back to Passbook
            </button>
          </div>
        </div>
      )}

      {/* Adjustment Action Sheet / Modal (Edit or Delete) */}
      {selectedAdjustmentForAction && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Adjustment Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedAdjustmentForAction(null);
                  setConfirmDeleteAdjustment(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Details Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Account:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{account.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Reconciled Balance:</span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatINR(selectedAdjustmentForAction.newBalance)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Previous Balance:</span>
                <span className="text-slate-600 dark:text-slate-400 tabular-nums">
                  {formatINR(selectedAdjustmentForAction.oldBalance)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Adjustment Variance:</span>
                <span
                  className={`font-black tabular-nums ${
                    selectedAdjustmentForAction.difference >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {selectedAdjustmentForAction.difference >= 0
                    ? `+${formatINR(selectedAdjustmentForAction.difference)}`
                    : `-${formatINR(Math.abs(selectedAdjustmentForAction.difference))}`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Date & Time:</span>
                <span className="text-slate-700 dark:text-slate-300 tabular-nums">
                  {formatDate(new Date(selectedAdjustmentForAction.timestamp))} • {new Date(selectedAdjustmentForAction.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
              {selectedAdjustmentForAction.note && (
                <div className="flex justify-between items-start gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/60">
                  <span className="text-slate-500 shrink-0">Note:</span>
                  <span className="text-right text-slate-700 dark:text-slate-300 break-words max-w-[70%]">
                    {selectedAdjustmentForAction.note}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons: Edit or Delete */}
            {confirmDeleteAdjustment ? (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2.5 animate-in fade-in">
                <div className="text-center">
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    Delete this adjustment record?
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Account balance will be restored by reversing this variance.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAdjustment(false)}
                    className="py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteAccountAdjustment(selectedAdjustmentForAction.id);
                      setSelectedAdjustmentForAction(null);
                      setConfirmDeleteAdjustment(false);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const adj = selectedAdjustmentForAction;
                    setEditingAdjustment(adj);
                    setEditAdjBalance(adj.newBalance.toString());
                    setEditAdjNote(adj.note || '');
                    const d = new Date(adj.timestamp);
                    setEditAdjDate(toInputDate(d));
                    setEditAdjTime(extractTimeHHMM(null, adj.timestamp));
                    setSelectedAdjustmentForAction(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit Record</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteAdjustment(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 font-semibold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Record</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Adjustment Modal */}
      {editingAdjustment && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-500" />
                <span>Edit Adjustment</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingAdjustment(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditAdjustmentSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Reconciled Balance (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  value={editAdjBalance}
                  onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  onChange={(e) => setEditAdjBalance(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Original pre-reconcile balance was {formatINR(editingAdjustment.oldBalance)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editAdjDate}
                    onChange={(e) => setEditAdjDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Time (HH:MM)
                  </label>
                  <input
                    type="time"
                    value={editAdjTime}
                    onChange={(e) => setEditAdjTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Reason / Note
                </label>
                <input
                  type="text"
                  value={editAdjNote}
                  onChange={(e) => setEditAdjNote(e.target.value)}
                  placeholder="e.g. Month-end bank statement alignment"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAdjustment(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Card Bill Pay Modal */}
      {account.type === 'credit' && (
        <CreditCardPayModal
          isOpen={isPayBillOpen}
          cardAccount={account}
          onClose={() => setIsPayBillOpen(false)}
        />
      )}

      {/* Credit Card Bills & Statements Fullscreen View */}
      {account.type === 'credit' && (
        <CreditCardBillsView
          account={account}
          isOpen={isBillsOpen}
          onClose={() => setIsBillsOpen(false)}
        />
      )}

      {/* Edit Transaction Modal if selected */}
      {editingTransaction && (
        <TransactionModal
          initialTransaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </div>
  );
};
