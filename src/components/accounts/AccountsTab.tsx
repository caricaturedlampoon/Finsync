import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { Account } from '../../types';
import { formatINR, adjustHexColor, isColorLight } from '../../utils/formatters';
import { AccountAvatar } from '../common/AccountAvatar';
import { PassbookView } from './PassbookView';
import { AccountModal } from './AccountModal';
import { CreditCardPayModal } from './CreditCardPayModal';
import {
  Plus,
  ChevronRight,
  ChevronDown,
  CreditCard,
  Edit2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Archive,
  X,
  Check,
  ShieldCheck,
  Landmark,
  Wallet,
  Settings,
  Lock,
} from 'lucide-react';

import { useRegisterSubscreen, useRegisterOverlay } from '../../navigation/NavigationContext';
import { navigationManager } from '../../navigation/navigationManager';

export const AccountsTab: React.FC = () => {
  const {
    accounts,
    selectedAccountId,
    setSelectedAccountId,
    reorderAccounts,
    openSettingsTab,
    netLiquidWealth,
  } = useApp();

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [payingCard, setPayingCard] = useState<Account | null>(null);
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [isBankSettingsModalOpen, setIsBankSettingsModalOpen] = useState(false);
  const [reorderList, setReorderList] = useState<Account[]>([]);

  // Collapsible section states (collapsed by default, expanded on explicit toggle)
  const [isBanksOpen, setIsBanksOpen] = useState(false);
  const [isCreditCardsOpen, setIsCreditCardsOpen] = useState(false);
  const [isWalletsOpen, setIsWalletsOpen] = useState(false);
  const [isDebtsOpen, setIsDebtsOpen] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const passbookLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedAccount && passbookLayerRef.current) {
      passbookLayerRef.current.scrollTop = 0;
    }
  }, [selectedAccount]);

  useEffect(() => {
    if (isBankSettingsModalOpen || isReorderModalOpen) {
      document.body.style.overflow = 'hidden';
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isBankSettingsModalOpen, isReorderModalOpen]);

  // Register passbook subscreen with dynamic stack
  useRegisterSubscreen(
    !!selectedAccountId,
    `passbook_${selectedAccountId}`,
    selectedAccount ? `Passbook: ${selectedAccount.name}` : 'Passbook',
    () => {
      setSelectedAccountId(null);
      setIsAccountModalOpen(false);
      setEditingAccount(null);
    },
    {
      parentScreenKey: 'accounts',
      anchorSelector: selectedAccountId ? `[data-account-id="${selectedAccountId}"]` : undefined,
    }
  );

  const openAccountPassbook = (accId: string) => {
    navigationManager.saveTabScroll('accounts', undefined, `[data-account-id="${accId}"]`);
    setSelectedAccountId(accId);
  };

  // Register overlays and sheets
  useRegisterOverlay(isReorderModalOpen, 'accounts_reorder_modal', 'Reorder Accounts', () => setIsReorderModalOpen(false));
  useRegisterOverlay(isBankSettingsModalOpen, 'accounts_bank_settings_modal', 'Bank Settings', () => setIsBankSettingsModalOpen(false));
  useRegisterOverlay(!!payingCard, 'accounts_pay_card_modal', 'Pay Credit Card', () => setPayingCard(null));
  useRegisterOverlay(isAccountModalOpen, 'account_edit_modal', editingAccount ? 'Edit Account' : 'New Account', () => {
    setIsAccountModalOpen(false);
    setEditingAccount(null);
  });

  // Sort accounts by custom sequence order
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  }, [accounts]);

  const activeAccounts = useMemo(() => {
    return sortedAccounts.filter((a) => !a.isArchived);
  }, [sortedAccounts]);

  const archivedAccounts = useMemo(() => {
    return sortedAccounts.filter((a) => a.isArchived);
  }, [sortedAccounts]);

  const displayedAccounts = viewTab === 'active' ? activeAccounts : archivedAccounts;

  // Group accounts into: 1. Bank Accounts, 2. Credit Cards, 3. Wallets, 4. Special Debt Ledgers
  const groupedAccounts = useMemo(() => {
    const banks = displayedAccounts.filter((a) => a.type === 'bank' || a.type === 'demat');
    const creditCards = displayedAccounts.filter((a) => a.type === 'credit');
    const wallets = displayedAccounts.filter(
      (a) => a.type === 'wallet' || a.type === 'cash'
    );
    const systemDebts = displayedAccounts.filter(
      (a) => a.isSystemDebtAccount || a.id === 'acc_debt_ledger' || a.type === 'debt'
    );

    // Sums
    const totalBankBalance = banks.reduce((sum, a) => sum + a.balance, 0);

    const totalCreditLimit = creditCards.reduce((sum, a) => sum + (a.creditLimit || 0), 0);
    const totalCreditSpent = creditCards.reduce(
      (sum, a) => sum + (a.balance < 0 ? Math.abs(a.balance) : 0),
      0
    );

    const totalWalletBalance = wallets.reduce((sum, a) => sum + a.balance, 0);
    const totalDebtBalance = systemDebts.reduce((sum, a) => sum + a.balance, 0);

    return {
      banks,
      creditCards,
      wallets,
      systemDebts,
      totalBankBalance,
      totalCreditLimit,
      totalCreditSpent,
      totalWalletBalance,
      totalDebtBalance,
    };
  }, [displayedAccounts]);

  // Net Liquid Wealth Summary
  const balanceSummary = useMemo(() => {
    let bankAndCash = 0;
    let creditOutstanding = 0;

    activeAccounts.forEach((acc) => {
      if (acc.isSystemDebtAccount) return;
      if (acc.type === 'credit') {
        if (acc.balance < 0) {
          creditOutstanding += Math.abs(acc.balance);
        }
      } else {
        bankAndCash += acc.balance;
      }
    });

    return {
      bankAndCash,
      creditOutstanding,
      netCustomBalance: netLiquidWealth,
    };
  }, [activeAccounts, netLiquidWealth]);

  const handleOpenReorder = () => {
    setReorderList([...activeAccounts]);
    setIsReorderModalOpen(true);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const nextList = [...reorderList];
    const temp = nextList[index];
    nextList[index] = nextList[index - 1];
    nextList[index - 1] = temp;
    setReorderList(nextList);
  };

  const handleMoveDown = (index: number) => {
    if (index >= reorderList.length - 1) return;
    const nextList = [...reorderList];
    const temp = nextList[index];
    nextList[index] = nextList[index + 1];
    nextList[index + 1] = temp;
    setReorderList(nextList);
  };

  const handleSaveReorder = () => {
    const orderedIds = reorderList.map((a) => a.id);
    reorderAccounts(orderedIds);
    setIsReorderModalOpen(false);
  };

  // Format due day helper e.g. 5 -> 5th
  const formatDueDay = (day?: number) => {
    if (!day) return null;
    const s = ['th', 'st', 'nd', 'rd'];
    const v = day % 100;
    const suffix = s[(v - 20) % 10] || s[v] || s[0];
    return `${day}${suffix}`;
  };

  // Account Row: For credit cards shows Credit Limit, Due Date, Available Limit, Credit Utilised & usage line (green if <= 30%)
  // For other accounts shows Logo + Name on left, Current Balance on right
  const renderSingleLineAccountRow = (account: Account) => {
    if (account.type === 'credit') {
      const limit = account.creditLimit || 0;
      const creditUtilised = Math.max(0, -account.balance);
      const availableLimit = Math.max(0, limit + account.balance);
      const dueDayFormatted = formatDueDay(account.paymentDueDay);
      const utilizationPercent = limit > 0 ? (creditUtilised / limit) * 100 : 0;
      const isUnder30 = utilizationPercent <= 30;

      const accountColor = account.color || '#4f46e5';
      const darkerColor = adjustHexColor(accountColor, -24);
      const isLight = isColorLight(accountColor);
      const textColorClass = isLight ? 'text-slate-900' : 'text-white';
      const subTextColorClass = isLight ? 'text-slate-800' : 'text-white/80';
      const frostedBadgeClass = isLight
        ? 'bg-black/10 text-slate-900 border border-black/15'
        : 'bg-white/20 text-white border border-white/25';
      const dueBadgeClass = isLight
        ? 'bg-amber-600/15 text-amber-900 font-bold border border-amber-600/25'
        : 'bg-amber-400/25 text-amber-200 font-bold border border-amber-300/30';

      return (
        <div
          key={account.id}
          data-account-id={account.id}
          onClick={() => openAccountPassbook(account.id)}
          style={{
            background: `linear-gradient(135deg, ${accountColor} 0%, ${darkerColor} 100%)`,
            boxShadow: `0 12px 28px -6px ${accountColor}45, 0 4px 12px -2px ${accountColor}25`,
          }}
          className={`relative p-3.5 sm:p-4 rounded-2xl border border-white/25 hover:shadow-lg cursor-pointer transition-all group space-y-2.5 overflow-hidden ${textColorClass}`}
        >
          {/* Subtle specular lighting matching Passbook */}
          <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-white/15 blur-xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-black/15 blur-xl pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />

          {/* Top Row: Card Details on left, Available Limit on right */}
          <div className="flex items-center justify-between gap-2 relative z-10">
            {/* Left: Card Logo, Name, Credit Limit & Due Date */}
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <AccountAvatar
                account={account}
                size="sm"
                className="rounded-xl shrink-0 ring-1 ring-white/60 shadow-xs"
              />
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className={`text-sm font-bold truncate drop-shadow-xs ${textColorClass}`}>
                    {account.name}
                  </span>
                  {account.accountNumber && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 tabular-nums ${frostedBadgeClass}`}>
                      •••• {account.accountNumber}
                    </span>
                  )}
                  {account.isArchived && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400 text-slate-900 shrink-0">
                      Archived
                    </span>
                  )}
                </div>

                {dueDayFormatted && (
                  <div className={`text-[10px] sm:text-[11px] inline-block px-1.5 py-0.2 rounded-md ${dueBadgeClass}`}>
                    Due: {dueDayFormatted}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Available Limit */}
            <div className="flex items-center gap-2 shrink-0 text-right">
              <div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider block opacity-80 ${textColorClass}`}>
                  Available Limit
                </span>
                <span className={`text-sm sm:text-base font-extrabold tabular-nums tracking-tight block drop-shadow-xs ${textColorClass}`}>
                  ₹{formatINR(availableLimit)}
                </span>
              </div>

              <ChevronRight className="w-4 h-4 opacity-75 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
          </div>

          {/* Usage Line and Credit Utilised */}
          <div className="pt-2 border-t border-white/20 space-y-1 relative z-10">
            <div className="flex items-center justify-between text-[11px]">
              <span className={subTextColorClass}>
                <span>Credit Utilised:</span>{' '}
                <strong className="font-extrabold tabular-nums">
                  ₹{formatINR(creditUtilised)}
                </strong>{' '}
                <span className="opacity-75 font-medium">/ ₹{formatINR(limit)}</span>
              </span>

              <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${frostedBadgeClass}`}>
                {utilizationPercent.toFixed(1)}% used
              </span>
            </div>

            {/* Usage track */}
            <div className="w-full h-1.5 rounded-full bg-black/20 dark:bg-white/20 overflow-hidden ring-1 ring-white/20">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isUnder30
                    ? 'bg-emerald-400'
                    : utilizationPercent <= 70
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(isUnder30 ? 3.5 : 2, utilizationPercent)
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    const accountColor = account.color || '#059669';
    const darkerColor = adjustHexColor(accountColor, -24);
    const isLight = isColorLight(accountColor);
    const textColorClass = isLight ? 'text-slate-900' : 'text-white';
    const frostedBadgeClass = isLight
      ? 'bg-black/10 text-slate-900 border border-black/15'
      : 'bg-white/20 text-white border border-white/25';

    return (
      <div
        key={account.id}
        data-account-id={account.id}
        onClick={() => openAccountPassbook(account.id)}
        style={{
          background: `linear-gradient(135deg, ${accountColor} 0%, ${darkerColor} 100%)`,
          boxShadow: `0 12px 28px -6px ${accountColor}45, 0 4px 12px -2px ${accountColor}25`,
        }}
        className={`relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border border-white/25 hover:shadow-lg cursor-pointer transition-all group overflow-hidden ${textColorClass}`}
      >
        {/* Subtle specular lighting matching Passbook */}
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-white/15 blur-xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-black/15 blur-xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />

        {/* Left: Account Logo & Name */}
        <div className="flex items-center gap-3 min-w-0 pr-3 relative z-10">
          <AccountAvatar
            account={account}
            size="sm"
            className="rounded-xl shrink-0 ring-1 ring-white/60 shadow-xs"
          />
          <div className="min-w-0 flex items-center gap-2">
            <span className={`text-sm font-bold truncate drop-shadow-xs ${textColorClass}`}>
              {account.name}
            </span>
            {account.type === 'demat' && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${frostedBadgeClass}`}>
                Demat
              </span>
            )}
            {account.accountNumber && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 tabular-nums ${frostedBadgeClass}`}>
                •••• {account.accountNumber}
              </span>
            )}
            {account.isArchived && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400 text-slate-900 shrink-0">
                Archived
              </span>
            )}
            {account.isLocked && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500 text-white shrink-0 flex items-center gap-1 shadow-2xs">
                <Lock className="w-2.5 h-2.5" />
                <span>Locked Loan</span>
              </span>
            )}
            {(account.isSystemDebtAccount || account.id === 'acc_debt_ledger') && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${frostedBadgeClass}`}>
                Debt Ledger
              </span>
            )}
          </div>
        </div>

        {/* Right: Current Balance Only */}
        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <span
            className={`text-sm sm:text-base font-extrabold tabular-nums tracking-tight drop-shadow-xs ${textColorClass}`}
          >
            {formatINR(account.balance, true)}
          </span>
          <ChevronRight className="w-4 h-4 opacity-75 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </div>
    );
  };

  if (selectedAccount) {
    return (
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-2 pb-safe pb-36 min-h-full">
        <PassbookView
          account={selectedAccount}
          onBack={() => {
            setSelectedAccountId(null);
            setIsAccountModalOpen(false);
            setEditingAccount(null);
          }}
          onEditAccount={(acc) => {
            if (acc.isSystemDebtAccount) return;
            setEditingAccount(acc);
            setIsAccountModalOpen(true);
          }}
        />
        <AccountModal
          isOpen={isAccountModalOpen}
          initialAccount={editingAccount}
          onClose={() => {
            setIsAccountModalOpen(false);
            setEditingAccount(null);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <div id="accounts-main-container" className="space-y-6 pb-20">
        {/* Top Banner: Net Balance with Settings Logo */}
        <div className="p-4 sm:p-5 md:p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between gap-4 relative z-10 min-w-0">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                Net Balance
              </span>
              <div
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold tabular-nums tracking-tight text-white mt-1 truncate block"
                title={formatINR(balanceSummary.netCustomBalance, true)}
              >
                {formatINR(balanceSummary.netCustomBalance, true)}
              </div>
            </div>

            {/* Settings Logo Button */}
            <button
              type="button"
              onClick={() => setIsBankSettingsModalOpen(true)}
              className="p-2.5 sm:p-3 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center"
              title="Bank & Accounts Settings"
              aria-label="Bank and Accounts Settings"
            >
              <Settings className="w-5 h-5 text-emerald-400" />
            </button>
          </div>

          {/* Clean Pillar Breakdown */}
          <div className="mt-4 pt-3.5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs relative z-10 min-w-0">
            <div className="min-w-0 overflow-hidden">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium truncate">
                Bank & Cash
              </span>
              <span
                className="text-xs sm:text-sm md:text-base font-bold text-emerald-400 tabular-nums truncate block mt-0.5"
                title={formatINR(balanceSummary.bankAndCash)}
              >
                {formatINR(balanceSummary.bankAndCash)}
              </span>
            </div>

            <div className="min-w-0 overflow-hidden">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium truncate">
                Credit Outstanding
              </span>
              <span
                className="text-xs sm:text-sm md:text-base font-bold text-rose-400 tabular-nums truncate block mt-0.5"
                title={formatINR(balanceSummary.creditOutstanding)}
              >
                {formatINR(balanceSummary.creditOutstanding)}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 min-w-0 overflow-hidden">
              <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium truncate">
                Net Assets
              </span>
              <span className="text-xs sm:text-sm md:text-base font-bold text-slate-200 tabular-nums truncate block mt-0.5">
                ₹{formatINR(balanceSummary.netCustomBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Filter Strip and Account List Wrapper */}
        <div className="space-y-6">
          {/* Optional Filter Strip: Active vs Archived accounts */}
          {archivedAccounts.length > 0 && (
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setViewTab('active')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewTab === 'active'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Active
              </button>

              <button
                type="button"
                onClick={() => setViewTab('archived')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewTab === 'archived'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archived</span>
              </button>
            </div>
          )}

          {/* Account Sections */}
          {displayedAccounts.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                {viewTab === 'active' ? <Landmark className="w-6 h-6" /> : <Archive className="w-6 h-6" />}
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                {viewTab === 'active' ? 'No Active Accounts' : 'No Archived Accounts'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {viewTab === 'active'
                  ? 'Tap the Settings icon in the top card to add your first bank account.'
                  : 'Accounts you archive will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SECTION 1: BANK ACCOUNTS (Savings, Current, Demat) */}
              <div className="space-y-3">
                <div
                  onClick={() => setIsBanksOpen(!isBanksOpen)}
                  className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 cursor-pointer hover:border-slate-300 transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Bank Accounts
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums">
                      ₹{formatINR(groupedAccounts.totalBankBalance)}
                    </span>
                    <div className="text-slate-400 p-1">
                      {isBanksOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {isBanksOpen && (
                  groupedAccounts.banks.length === 0 ? (
                    <div className="p-5 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                      No bank accounts configured yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupedAccounts.banks.map(renderSingleLineAccountRow)}
                    </div>
                  )
                )}
              </div>

              {/* SECTION 2: CREDIT CARDS */}
              <div className="space-y-3">
                <div
                  onClick={() => setIsCreditCardsOpen(!isCreditCardsOpen)}
                  className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 cursor-pointer hover:border-slate-300 transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Credit Cards
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums">
                      ₹{formatINR(groupedAccounts.totalCreditSpent)}
                    </span>
                    <div className="text-slate-400 p-1">
                      {isCreditCardsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {isCreditCardsOpen && (
                  groupedAccounts.creditCards.length === 0 ? (
                    <div className="p-5 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                      No credit cards configured.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupedAccounts.creditCards.map(renderSingleLineAccountRow)}
                    </div>
                  )
                )}
              </div>

              {/* SECTION 3: WALLETS & CASH */}
              <div className="space-y-3">
                <div
                  onClick={() => setIsWalletsOpen(!isWalletsOpen)}
                  className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 cursor-pointer hover:border-slate-300 transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Wallets & Cash
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      ₹{formatINR(groupedAccounts.totalWalletBalance)}
                    </span>
                    <div className="text-slate-400 p-1">
                      {isWalletsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {isWalletsOpen && (
                  groupedAccounts.wallets.length === 0 ? (
                    <div className="p-5 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                      No wallets or cash accounts configured.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupedAccounts.wallets.map(renderSingleLineAccountRow)}
                    </div>
                  )
                )}
              </div>

              {/* SECTION 4: DEBT & LOAN LEDGER (Special System Ledger) */}
              {groupedAccounts.systemDebts.length > 0 && (
                <div className="space-y-3">
                  <div
                    onClick={() => setIsDebtsOpen(!isDebtsOpen)}
                    className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 cursor-pointer hover:border-slate-300 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            Debt & Loan Ledger
                          </h3>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800/60 shrink-0">
                            System Ledger
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs sm:text-sm font-black tabular-nums ${
                          groupedAccounts.totalDebtBalance >= 0
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        ₹{formatINR(groupedAccounts.totalDebtBalance, true)}
                      </span>
                      <div className="text-slate-400 p-1">
                        {isDebtsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {isDebtsOpen && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupedAccounts.systemDebts.map(renderSingleLineAccountRow)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* BANK TAB SETTINGS (Fullscreen on tapping Settings logo)  */}
      {/* ======================================================== */}
      {isBankSettingsModalOpen && createPortal(
        <div className="fixed inset-0 z-[250] bg-slate-50 dark:bg-slate-950 flex flex-col h-full w-full overflow-hidden isolate animate-in slide-in-from-bottom duration-200 overscroll-contain">
          {/* Fullscreen Sticky Header */}
          <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 pt-safe flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsBankSettingsModalOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                title="Back to Accounts"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Accounts</span>
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Bank & Accounts Settings
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add new accounts, reorder sequence, and manage protected security
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsBankSettingsModalOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* Fullscreen Content Area */}
          <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1 max-w-3xl mx-auto w-full space-y-6 pb-safe pb-28">
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 block">
                Account Actions
              </span>

              {/* Action 1: Add New Account */}
              <button
                type="button"
                onClick={() => {
                  setIsBankSettingsModalOpen(false);
                  setEditingAccount(null);
                  setIsAccountModalOpen(true);
                }}
                className="w-full p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 hover:border-emerald-500/40 text-left transition-all cursor-pointer flex items-center justify-between shadow-xs group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                    <Plus className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors block">
                      Add New Account
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Create a savings account, credit card, demat, or cash wallet
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>

              {/* Action 2: Reorder Sequence */}
              <button
                type="button"
                onClick={() => {
                  setIsBankSettingsModalOpen(false);
                  handleOpenReorder();
                }}
                className="w-full p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:border-blue-500/40 text-left transition-all cursor-pointer flex items-center justify-between shadow-xs group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
                    <ArrowUpDown className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block">
                      Reorder Account Sequence
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Arrange the display order of bank accounts across the entire application
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>

              {/* Action 3: Protected Edit Zone */}
              <button
                type="button"
                onClick={() => {
                  setIsBankSettingsModalOpen(false);
                  openSettingsTab('security');
                }}
                className="w-full p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 hover:border-purple-500/40 text-left transition-all cursor-pointer flex items-center justify-between shadow-xs group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors block">
                      Protected Edit & Security Management
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Edit sensitive credentials, update bank account numbers, or delete accounts
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            </div>

            {/* Direct Quick Edit List of Active Accounts */}
            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 block">
                Direct Account Quick Edit
              </span>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 shadow-xs overflow-hidden">
                {activeAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <AccountAvatar account={acc} size="md" className="shrink-0 rounded-xl" />
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">
                          {acc.name}
                        </span>
                        <span className="text-xs text-slate-400 capitalize">
                          {acc.type === 'credit'
                            ? `Credit Card · Limit: ₹${formatINR(acc.creditLimit || 0)} · Avail: ₹${formatINR(Math.max(0, (acc.creditLimit || 0) + acc.balance))}`
                            : `${acc.type} · ₹${formatINR(acc.balance)}`}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsBankSettingsModalOpen(false);
                        setEditingAccount(acc);
                        setIsAccountModalOpen(true);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 active:scale-95"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Account Sequence Reordering Fullscreen Screen */}
      {isReorderModalOpen && createPortal(
        <div className="fixed inset-0 z-[280] bg-slate-50 dark:bg-slate-950 flex flex-col h-full w-full overflow-hidden isolate animate-in slide-in-from-bottom duration-200 overscroll-contain">
          <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 pt-safe flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsReorderModalOpen(false);
                  setIsBankSettingsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                title="Back to Bank Settings"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Settings</span>
              </button>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Customize Account Sequence
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Arrange the order in which bank accounts appear across the app
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsReorderModalOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1 max-w-2xl mx-auto w-full space-y-2 pb-safe pb-28">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 block mb-2">
              Drag or use arrows to change position
            </span>
            {reorderList.map((acc, index) => (
              <div
                key={acc.id}
                className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <span className="w-6 text-center text-xs font-bold text-slate-400 tabular-nums shrink-0">
                    {index + 1}
                  </span>
                  <AccountAvatar account={acc} size="sm" className="shrink-0 rounded-xl" />
                  <div className="min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block truncate">
                      {acc.name}
                    </span>
                    <span className="text-[11px] text-slate-400 capitalize">
                      {acc.type === 'credit'
                        ? `Limit: ₹${formatINR(acc.creditLimit || 0)} · Avail: ₹${formatINR(Math.max(0, (acc.creditLimit || 0) + acc.balance))}`
                        : `${acc.type} · ${formatINR(acc.balance, true)}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMoveUp(index)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={index === reorderList.length - 1}
                    onClick={() => handleMoveDown(index)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsReorderModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveReorder}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Sequence</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Account Modal for Add/Edit */}
      <AccountModal
        isOpen={isAccountModalOpen}
        initialAccount={editingAccount}
        onClose={() => {
          setIsAccountModalOpen(false);
          setEditingAccount(null);
        }}
      />

      {/* Credit Card Bill Pay Modal */}
      {payingCard && (
        <CreditCardPayModal
          cardAccount={payingCard}
          isOpen={Boolean(payingCard)}
          onClose={() => setPayingCard(null)}
        />
      )}
    </>
  );
};
