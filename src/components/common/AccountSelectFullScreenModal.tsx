import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { Account, AccountType } from '../../types';
import { formatINR } from '../../utils/formatters';
import { AccountAvatar } from './AccountAvatar';
import { useRegisterOverlay } from '../../navigation/NavigationContext';
import {
  ArrowLeft,
  Search,
  X,
  Check,
  Landmark,
  CreditCard,
  Wallet,
  Coins,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';

interface AccountSelectFullScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (account: Account) => void;
  selectedAccountId?: string;
  title?: string;
  subtitle?: string;
  excludeAccountId?: string;
  allowSystemDebtAccount?: boolean;
}

export const AccountSelectFullScreenModal: React.FC<AccountSelectFullScreenModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedAccountId,
  title = 'Select Account',
  subtitle = 'Choose bank, credit card or wallet',
  excludeAccountId,
  allowSystemDebtAccount = false,
}) => {
  const { accounts } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useRegisterOverlay(isOpen, 'account_select_modal', title, onClose);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Filter out archived accounts and optional exclusions
  const availableAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (acc.isArchived) return false;
      if (!allowSystemDebtAccount && acc.isSystemDebtAccount) return false;
      if (excludeAccountId && acc.id === excludeAccountId) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const matchName = acc.name.toLowerCase().includes(q);
      const matchType = acc.type.toLowerCase().includes(q);
      const matchNumber = acc.accountNumber ? acc.accountNumber.includes(q) : false;
      return matchName || matchType || matchNumber;
    });
  }, [accounts, allowSystemDebtAccount, excludeAccountId, searchQuery]);

  // Group into Bank Accounts, Credit Cards, and Wallets
  const groupedAccounts = useMemo(() => {
    const banks = availableAccounts.filter((a) => a.type === 'bank' || a.type === 'demat');
    const creditCards = availableAccounts.filter((a) => a.type === 'credit');
    const wallets = availableAccounts.filter((a) => a.type === 'wallet' || a.type === 'cash');
    const others = availableAccounts.filter(
      (a) => a.type !== 'bank' && a.type !== 'demat' && a.type !== 'credit' && a.type !== 'wallet' && a.type !== 'cash'
    );

    return [
      {
        id: 'banks',
        title: 'Bank Accounts',
        icon: Landmark,
        colorClass: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
        accounts: banks,
      },
      {
        id: 'credit_cards',
        title: 'Credit Cards',
        icon: CreditCard,
        colorClass: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
        accounts: creditCards,
      },
      {
        id: 'wallets',
        title: 'Wallets & Cash',
        icon: Wallet,
        colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
        accounts: wallets,
      },
      ...(others.length > 0
        ? [
            {
              id: 'others',
              title: 'Other Accounts',
              icon: Coins,
              colorClass: 'text-purple-600 dark:text-purple-400 bg-purple-500/10',
              accounts: others,
            },
          ]
        : []),
    ];
  }, [availableAccounts]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAccountClick = (account: Account) => {
    onSelect(account);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[300] bg-white dark:bg-slate-950 flex flex-col h-full w-full overflow-hidden isolate animate-in slide-in-from-bottom duration-200 overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-select-title"
    >
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shrink-0 pt-safe">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2
                id="account-select-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate"
              >
                {title}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-none mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Search Bar */}
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-3 pt-1">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by bank name, type or last 4 digits..."
              className="w-full pl-10 pr-9 py-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content: Grouped List */}
      <main className="max-w-2xl mx-auto w-full flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6 pb-safe pb-24">
        {availableAccounts.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-200/80 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No matching accounts found
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              No active bank accounts, cards or wallets matched &quot;{searchQuery}&quot;.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-3.5 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl"
            >
              Clear Search
            </button>
          </div>
        ) : (
          groupedAccounts.map((group) => {
            if (group.accounts.length === 0) return null;
            const GroupIcon = group.icon;

            return (
              <section key={group.id} className="space-y-2">
                {/* Section Header with category badge, count & collapsible arrow */}
                <button
                  type="button"
                  onClick={() => toggleGroupCollapse(group.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer select-none group/header"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${group.colorClass}`}>
                      <GroupIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 group-hover/header:text-slate-900 dark:group-hover/header:text-white transition-colors">
                      {group.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {group.accounts.length}
                    </span>
                    <div className="p-0.5 text-slate-400 group-hover/header:text-slate-700 dark:group-hover/header:text-slate-200">
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          collapsedGroups[group.id] ? '-rotate-90' : 'rotate-0'
                        }`}
                      />
                    </div>
                  </div>
                </button>

                {/* Account Rows in Group (collapsible) */}
                {!collapsedGroups[group.id] && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs animate-in fade-in duration-100">
                  {group.accounts.map((account) => {
                    const isSelected = account.id === selectedAccountId;
                    const isCredit = account.type === 'credit';
                    const outstanding = isCredit ? Math.max(0, -account.balance) : 0;
                    const available =
                      isCredit && account.creditLimit
                        ? Math.max(0, account.creditLimit + account.balance)
                        : null;

                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => handleAccountClick(account)}
                        className={`w-full p-3.5 sm:p-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer group active:bg-slate-100 dark:active:bg-slate-800 ${
                          isSelected
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AccountAvatar
                            account={account}
                            size="md"
                            className="rounded-xl shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                {account.name}
                              </span>
                              {account.accountNumber && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ••{account.accountNumber}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 capitalize truncate">
                              <span>{account.type}</span>
                              {isCredit && account.paymentDueDay && (
                                <>
                                  <span>·</span>
                                  <span>Due: {account.paymentDueDay}th</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right balance & select indicator */}
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <div>
                            {isCredit ? (
                              <div>
                                <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums block">
                                  {formatINR(outstanding)}
                                </span>
                                {available !== null && (
                                  <span className="text-[10px] text-slate-400 tabular-nums block leading-tight">
                                    Avail: {formatINR(available)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div>
                                <span
                                  className={`text-xs sm:text-sm font-bold tabular-nums block ${
                                    account.balance < 0
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {formatINR(account.balance, true)}
                                </span>
                                <span className="text-[10px] text-slate-400 block leading-tight">
                                  Balance
                                </span>
                              </div>
                            )}
                          </div>

                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'border border-slate-300 dark:border-slate-700 text-transparent group-hover:border-slate-400'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </main>
    </div>,
    document.body
  );
};
