import React, { useState, useMemo, useRef, useEffect, memo } from 'react';
import { useApp } from '../../context/AppContext';
import { Transaction, TransactionType, Account, InvestmentHolding } from '../../types';
import { formatINR, formatDate, parseDate } from '../../utils/formatters';
import { AccountAvatar } from '../common/AccountAvatar';
import {
  Search,
  ArrowLeft,
  X,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Calendar,
  Tag,
  Hash,
  Coins,
  Landmark,
  TrendingUp,
  LayoutDashboard,
  PieChart,
  Users,
  Settings,
  FileSpreadsheet,
  CalendarClock,
  Tags,
  Trash2,
  ChevronRight,
  Zap,
  Sliders,
  ShieldCheck,
  Lock,
  Scale,
  Calculator,
  HandCoins,
} from 'lucide-react';
import { TransactionModal } from '../transactions/TransactionModal';

interface IndexedSearchTx extends Transaction {
  _timestamp: number;
  _searchContent: string;
  _dateFormatted: string;
}

// Fixed item height (76px card + 8px gap)
const ITEM_HEIGHT = 84;
const BUFFER = 6;

type SearchScopeTab = 'all' | 'transactions' | 'accounts' | 'holdings' | 'actions';

// Highly optimized memoized card for 60fps virtualization
const SearchTransactionCard = memo(
  ({
    tx,
    onSelect,
  }: {
    tx: IndexedSearchTx;
    onSelect: (t: Transaction) => void;
  }) => {
    const isExpense = tx.type === 'expense';
    const isIncome = tx.type === 'income';

    return (
      <div
        onClick={() => onSelect(tx)}
        className="h-[76px] p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-3 shadow-2xs cursor-pointer active:scale-[0.99] select-none"
        title="Tap to view or edit this transaction"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isExpense
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : isIncome
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            }`}
          >
            {isExpense && <ArrowDownRight className="w-4 h-4" />}
            {isIncome && <ArrowUpRight className="w-4 h-4" />}
            {!isExpense && !isIncome && <ArrowLeftRight className="w-4 h-4" />}
          </div>

          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {tx.note || tx.categoryName || 'Transaction'}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0">
                {tx._dateFormatted}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[10px] border border-slate-200 dark:border-slate-700 truncate shrink-0">
                <Landmark className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                <span className="truncate">{tx.fromAccountName}</span>
              </span>
              {tx.toAccountName && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[10px] border border-slate-200 dark:border-slate-700 truncate shrink-0">
                  <span>→</span>
                  <span className="truncate">{tx.toAccountName}</span>
                </span>
              )}
              {tx.categoryName && (
                <>
                  <span>·</span>
                  <span className="truncate">{tx.categoryName}</span>
                </>
              )}
            </div>
            {tx.tags && tx.tags.length > 0 && (
              <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
                {tx.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] text-slate-400 dark:text-slate-500 font-mono truncate"
                  >
                    #{tag.replace(/^#/, '')}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div
            className={`text-sm sm:text-base font-extrabold tabular-nums ${
              isExpense
                ? 'text-rose-600 dark:text-rose-400'
                : isIncome
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}
          >
            {isExpense ? '-' : isIncome ? '+' : ''}
            {formatINR(tx.amount)}
          </div>
          <span className="text-[10px] text-slate-400 uppercase font-semibold">
            {tx.type}
          </span>
        </div>
      </div>
    );
  }
);

SearchTransactionCard.displayName = 'SearchTransactionCard';

export const SearchModal: React.FC = () => {
  const {
    isSearchModalOpen,
    setIsSearchModalOpen,
    transactions,
    accounts,
    holdings,
    categories,
    isDark,
    setActiveTab,
    setSelectedAccountId,
    openTransactionModal,
    openTradeModal,
    openAnalysisExportModal,
    setIsSipManagerOpen,
    setIsCategoriesModalOpen,
    openSettingsTab,
    openSplitExpenses,
    openBin,
    settings,
    lockApp,
    getHoldingMarketPrice,
    isFeatureUnlocked,
    setIsNetWorthModalOpen,
    setIsLoansModalOpen,
    setIsDebtsModalOpen,
  } = useApp();

  const [keyword, setKeyword] = useState('');
  const [scopeTab, setScopeTab] = useState<SearchScopeTab>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Virtualization state & refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(650);

  const handleClose = () => {
    setIsSearchModalOpen(false);
  };

  // Instant autofocus without animation hitch
  useEffect(() => {
    if (isSearchModalOpen) {
      setScrollTop(0);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isSearchModalOpen]);

  // Keep track of viewport container height
  useEffect(() => {
    if (!isSearchModalOpen) return;
    const updateHeight = () => {
      if (scrollContainerRef.current) {
        setViewportHeight(scrollContainerRef.current.clientHeight || 650);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [isSearchModalOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isSearchModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editingTransaction) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen, editingTransaction]);

  // 1. Pre-index all transactions once (timestamps + fast unified search string)
  const indexedTransactions = useMemo<IndexedSearchTx[]>(() => {
    return transactions.map((tx) => {
      const parsed = parseDate(tx.date);
      const time = parsed.getTime() || 0;
      const formattedDate = formatDate(tx.date);
      const tagsStr = (tx.tags || []).join(' ').toLowerCase();
      const searchContent = `${(tx.note || '').toLowerCase()} ${(tx.categoryName || '').toLowerCase()} ${(tx.fromAccountName || '').toLowerCase()} ${(tx.toAccountName || '').toLowerCase()} ${tagsStr} ${tx.amount} ${formatINR(tx.amount).toLowerCase()} ${tx.date} ${formattedDate.toLowerCase()}`;

      return {
        ...tx,
        _timestamp: time,
        _dateFormatted: formattedDate,
        _searchContent: searchContent,
      };
    });
  }, [transactions]);

  // 2. Extract top distinct tags across transactions for quick filter pills
  const availableTags = useMemo(() => {
    const tagCount: Record<string, number> = {};
    for (let i = 0; i < transactions.length; i++) {
      const tags = transactions[i].tags;
      if (tags && tags.length > 0) {
        for (let j = 0; j < tags.length; j++) {
          const cleaned = tags[j].trim().replace(/^#/, '');
          if (cleaned) {
            tagCount[cleaned] = (tagCount[cleaned] || 0) + 1;
          }
        }
      }
    }
    return Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [transactions]);

  // 3. Search & filter logic for transactions
  const filteredTransactions = useMemo(() => {
    const rawQuery = keyword.trim().toLowerCase();

    // Check for amount comparison operator like > 1000, < 500, >= 2000, <= 100
    const compMatch = rawQuery.match(/^([><]=?)\s*([₹\s,]*)([0-9.]+)/);
    let compOperator: string | null = null;
    let compValue: number | null = null;
    if (compMatch) {
      compOperator = compMatch[1];
      compValue = parseFloat(compMatch[3]);
    }

    const tokens = rawQuery ? rawQuery.split(/\s+/).filter(Boolean) : [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thirtyDaysAgoTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const customStartTime = customStartDate ? parseDate(customStartDate).getTime() : 0;
    const customEndTime = customEndDate ? parseDate(customEndDate).getTime() + 86400000 : Infinity;

    return indexedTransactions.filter((tx) => {
      // Amount comparison operator (e.g. >500)
      if (compOperator && compValue !== null && !isNaN(compValue)) {
        if (compOperator === '>' && !(tx.amount > compValue)) return false;
        if (compOperator === '>=' && !(tx.amount >= compValue)) return false;
        if (compOperator === '<' && !(tx.amount < compValue)) return false;
        if (compOperator === '<=' && !(tx.amount <= compValue)) return false;
      }

      // Multi-token search against unified pre-indexed search string
      if (tokens.length > 0 && !compOperator) {
        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i].replace(/^[₹#]/, '');
          if (token && !tx._searchContent.includes(token)) {
            return false;
          }
        }
      }

      // Type filter
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && tx.categoryId !== selectedCategory) {
        return false;
      }

      // Account filter
      if (
        selectedAccount !== 'all' &&
        tx.fromAccountId !== selectedAccount &&
        tx.toAccountId !== selectedAccount
      ) {
        return false;
      }

      // Date Range filters using pre-parsed numeric timestamp
      if (dateFilter === 'this_month') {
        const d = new Date(tx._timestamp);
        if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) {
          return false;
        }
      } else if (dateFilter === 'last_30_days') {
        if (tx._timestamp < thirtyDaysAgoTime || tx._timestamp > now.getTime()) {
          return false;
        }
      } else if (dateFilter === 'custom') {
        if (customStartDate && tx._timestamp < customStartTime) return false;
        if (customEndDate && tx._timestamp > customEndTime) return false;
      }

      return true;
    });
  }, [
    indexedTransactions,
    keyword,
    selectedType,
    selectedCategory,
    selectedAccount,
    dateFilter,
    customStartDate,
    customEndDate,
  ]);

  // 4. Matching Accounts
  const matchingAccounts = useMemo(() => {
    const raw = keyword.trim().toLowerCase();
    return accounts.filter((acc) => {
      if (!raw) return true;
      const matchName = acc.name.toLowerCase().includes(raw);
      const matchNum = acc.accountNumber && acc.accountNumber.toLowerCase().includes(raw);
      const matchType = acc.type.toLowerCase().includes(raw);
      return matchName || matchNum || matchType;
    });
  }, [accounts, keyword]);

  // 5. Matching Holdings
  const matchingHoldings = useMemo(() => {
    const raw = keyword.trim().toLowerCase();
    return holdings.filter((h) => {
      if (!raw) return true;
      const matchSym = h.symbol.toLowerCase().includes(raw);
      const matchName = h.name.toLowerCase().includes(raw);
      const matchType = h.assetType.toLowerCase().includes(raw);
      return matchSym || matchName || matchType;
    });
  }, [holdings, keyword]);

  // 6. Quick Actions list
  const allQuickActions = useMemo(() => {
    const list = [
      {
        id: 'log_expense',
        title: 'Log New Expense',
        description: 'Record an expense outflow with category & account',
        icon: ArrowDownRight,
        color: 'text-rose-600 bg-rose-500/10',
        action: () => {
          handleClose();
          openTransactionModal('expense');
        },
        allowed: isFeatureUnlocked('expense_entry'),
        keywords: 'expense spend money payment cash buy',
      },
      {
        id: 'log_income',
        title: 'Log New Income',
        description: 'Record incoming salary, dividends, or deposits',
        icon: ArrowUpRight,
        color: 'text-emerald-600 bg-emerald-500/10',
        action: () => {
          handleClose();
          openTransactionModal('income');
        },
        allowed: isFeatureUnlocked('expense_entry'),
        keywords: 'income salary credit dividend deposit revenue earn',
      },
      {
        id: 'transfer',
        title: 'Transfer Between Accounts',
        description: 'Internal fund movement between bank & cards',
        icon: ArrowLeftRight,
        color: 'text-blue-600 bg-blue-500/10',
        action: () => {
          handleClose();
          openTransactionModal('transfer');
        },
        allowed: isFeatureUnlocked('expense_entry'),
        keywords: 'transfer move bank to bank payment self',
      },
      {
        id: 'trade',
        title: 'Buy or Sell Investment Holding',
        description: 'Execute stock or mutual fund portfolio transactions',
        icon: TrendingUp,
        color: 'text-indigo-600 bg-indigo-500/10',
        action: () => {
          handleClose();
          openTradeModal('stock');
        },
        allowed: isFeatureUnlocked('investments'),
        keywords: 'trade buy sell stock mutual fund share holding inv equity',
      },
      {
        id: 'dossier',
        title: 'Generate Executive Report / PDF',
        description: 'Export institutional financial dossier & growth analysis',
        icon: FileSpreadsheet,
        color: 'text-emerald-600 bg-emerald-500/10',
        action: () => {
          handleClose();
          openAnalysisExportModal('all');
        },
        allowed: isFeatureUnlocked('analytics'),
        keywords: 'report pdf analysis export statement dossier print download',
      },
      {
        id: 'sips',
        title: 'SIP Schedules & Auto-Debits',
        description: 'Automated recurring mutual fund investments',
        icon: CalendarClock,
        color: 'text-teal-600 bg-teal-500/10',
        action: () => {
          handleClose();
          setIsSipManagerOpen(true);
        },
        allowed: isFeatureUnlocked('investments'),
        keywords: 'sip mutual fund auto debit monthly schedule recur',
      },
      {
        id: 'categories',
        title: 'Categories & Budgets',
        description: 'Customize income and expense spending categories',
        icon: Tags,
        color: 'text-purple-600 bg-purple-500/10',
        action: () => {
          handleClose();
          setIsCategoriesModalOpen(true);
        },
        allowed: true,
        keywords: 'categories budget tags labels manage',
      },
      {
        id: 'settings',
        title: 'Settings & Cloud Backups',
        description: 'Configure security, Google Drive backups & vaults',
        icon: Settings,
        color: 'text-slate-600 bg-slate-500/10',
        action: () => {
          handleClose();
          openSettingsTab('all');
        },
        allowed: true,
        keywords: 'settings configure theme backup drive export reset pin lock',
      },
      {
        id: 'recycle_bin',
        title: 'Recycle Bin',
        description: '30-day recoverable deleted items',
        icon: Trash2,
        color: 'text-amber-600 bg-amber-500/10',
        action: () => {
          handleClose();
          openBin();
        },
        allowed: true,
        keywords: 'bin recycle trash recover restore deleted',
      },
      {
        id: 'net_worth_cockpit',
        title: 'Consolidated Net Worth Balance Sheet',
        description: 'Interactive 6-term wealth breakdown & monthly trajectory',
        icon: Scale,
        color: 'text-emerald-600 bg-emerald-500/10',
        action: () => {
          handleClose();
          setIsNetWorthModalOpen(true);
        },
        allowed: isFeatureUnlocked('analytics'),
        keywords: 'net worth balance sheet capital wealth assets liabilities audit',
      },
      {
        id: 'loans_manager',
        title: 'Loans, EMIs & Amortization Manager',
        description: 'Manage home/car loans with monthly EMI schedule',
        icon: Calculator,
        color: 'text-indigo-600 bg-indigo-500/10',
        action: () => {
          handleClose();
          setIsLoansModalOpen(true);
        },
        allowed: isFeatureUnlocked('debts'),
        keywords: 'loan emi interest amortization tenure borrow debt liability',
      },
      {
        id: 'debts_ledger',
        title: 'Debts & Personal IOUs Ledger',
        description: 'Track money you lent to others or borrowed',
        icon: HandCoins,
        color: 'text-cyan-600 bg-cyan-500/10',
        action: () => {
          handleClose();
          setIsDebtsModalOpen(true);
        },
        allowed: isFeatureUnlocked('debts'),
        keywords: 'debts iou lent borrowed lend borrow money friends ledger',
      },
      {
        id: 'split_groups',
        title: 'Split Expenses & Group Ledgers',
        description: 'Equal, percentage, exact and share-based bill splitting',
        icon: Users,
        color: 'text-teal-600 bg-teal-500/10',
        action: () => {
          handleClose();
          openSplitExpenses();
        },
        allowed: isFeatureUnlocked('split_expenses'),
        keywords: 'split group expenses bills trip roommates flatmates share',
      },
    ];

    if (settings.isAppLockEnabled) {
      list.push({
        id: 'lock_app',
        title: 'Lock App Vault Now',
        description: 'Immediately secure FinSync behind your PIN',
        icon: Lock,
        color: 'text-rose-600 bg-rose-500/10',
        action: () => {
          handleClose();
          lockApp();
        },
        allowed: true,
        keywords: 'lock secure vault protect pin biometrics',
      });
    }

    return list.filter((a) => a.allowed);
  }, [
    isFeatureUnlocked,
    settings.isAppLockEnabled,
    openTransactionModal,
    openTradeModal,
    openAnalysisExportModal,
    setIsSipManagerOpen,
    setIsCategoriesModalOpen,
    openSettingsTab,
    openBin,
    lockApp,
    setIsNetWorthModalOpen,
    setIsLoansModalOpen,
    setIsDebtsModalOpen,
    openSplitExpenses,
  ]);

  const matchingActions = useMemo(() => {
    const raw = keyword.trim().toLowerCase();
    if (!raw) return allQuickActions;
    return allQuickActions.filter(
      (a) =>
        a.title.toLowerCase().includes(raw) ||
        a.description.toLowerCase().includes(raw) ||
        a.keywords.includes(raw)
    );
  }, [allQuickActions, keyword]);

  // Quick Navigation Destinations
  const navDestinations = useMemo(() => {
    return [
      {
        id: 'nav_home',
        label: 'Dashboard Home',
        icon: LayoutDashboard,
        action: () => {
          handleClose();
          setActiveTab('home');
        },
      },
      {
        id: 'nav_accounts',
        label: 'Bank Accounts & Passbooks',
        icon: Landmark,
        action: () => {
          handleClose();
          setSelectedAccountId(null);
          setActiveTab('accounts');
        },
      },
      {
        id: 'nav_investments',
        label: 'Investment Portfolio',
        icon: TrendingUp,
        action: () => {
          handleClose();
          setActiveTab('investments');
        },
      },
      {
        id: 'nav_analytics',
        label: 'Cashflow Analytics & Charts',
        icon: PieChart,
        action: () => {
          handleClose();
          setActiveTab('analytics');
        },
      },
      {
        id: 'nav_debts',
        label: 'Debts & Loans Ledger',
        icon: Coins,
        action: () => {
          handleClose();
          setActiveTab('debts');
        },
      },
      {
        id: 'nav_split',
        label: 'Split Group Expenses',
        icon: Users,
        action: () => {
          handleClose();
          openSplitExpenses();
        },
      },
      {
        id: 'nav_net_worth',
        label: 'Net Worth Balance Sheet',
        icon: Scale,
        action: () => {
          handleClose();
          setIsNetWorthModalOpen(true);
        },
      },
      {
        id: 'nav_loans',
        label: 'Loans & EMI Amortization',
        icon: Calculator,
        action: () => {
          handleClose();
          setIsLoansModalOpen(true);
        },
      },
    ];
  }, [setActiveTab, setSelectedAccountId, openSplitExpenses, setIsNetWorthModalOpen, setIsLoansModalOpen]);

  // Aggregate stats
  const totalAmount = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < filteredTransactions.length; i++) {
      sum += filteredTransactions[i].amount;
    }
    return sum;
  }, [filteredTransactions]);

  const resetFilters = () => {
    setKeyword('');
    setSelectedType('all');
    setSelectedCategory('all');
    setSelectedAccount('all');
    setDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // Virtualization window calculations
  const totalItems = filteredTransactions.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER);
  const endIndex = Math.min(totalItems, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER);
  const visibleTransactions = useMemo(
    () => filteredTransactions.slice(startIndex, endIndex),
    [filteredTransactions, startIndex, endIndex]
  );
  const topSpacer = startIndex * ITEM_HEIGHT;
  const bottomSpacer = Math.max(0, (totalItems - endIndex) * ITEM_HEIGHT);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  if (!isSearchModalOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-150">
        <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col h-full overflow-hidden">
          {/* Top Bar with Enhanced Command Search Input */}
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0 pt-safe">
            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors active:scale-95"
              title="Close (Escape)"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search transactions, accounts, holdings, or type action (e.g. 'expense', '>1000')..."
                className="w-full pl-10 pr-20 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {keyword && (
                  <button
                    type="button"
                    onClick={() => setKeyword('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-200/60 dark:bg-slate-700 rounded border border-slate-300/60 dark:border-slate-600">
                  ESC
                </kbd>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer active:scale-95"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scope Segment Tabs */}
          <div className="px-4 sm:px-6 py-2 bg-slate-100/60 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'transactions', label: `Transactions (${filteredTransactions.length})` },
                { id: 'accounts', label: `Accounts (${matchingAccounts.length})` },
                { id: 'holdings', label: `Investments (${matchingHoldings.length})` },
                { id: 'actions', label: `Actions (${matchingActions.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScopeTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  scopeTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Scope Content Area */}
          {scopeTab === 'all' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 pb-6 sm:pb-8">
              {/* If user typed a query, show instant matches across Actions, Accounts, Holdings, and Transactions */}
              {keyword ? (
                <>
                  {/* Matching Actions */}
                  {matchingActions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Quick Actions ({matchingActions.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {matchingActions.slice(0, 4).map((action) => {
                          const Icon = action.icon;
                          return (
                            <button
                              key={action.id}
                              onClick={action.action}
                              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40 text-left transition-all flex items-center gap-3 cursor-pointer group active:scale-[0.99]"
                            >
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${action.color}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                  {action.title}
                                </span>
                                <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                                  {action.description}
                                </span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Matching Accounts */}
                  {matchingAccounts.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Accounts & Passbooks ({matchingAccounts.length})
                        </h4>
                        <button
                          onClick={() => setScopeTab('accounts')}
                          className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                        >
                          View all
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {matchingAccounts.slice(0, 4).map((acc) => (
                          <div
                            key={acc.id}
                            onClick={() => {
                              handleClose();
                              setSelectedAccountId(acc.id);
                              setActiveTab('accounts');
                            }}
                            className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 cursor-pointer transition-colors flex items-center justify-between gap-3 active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <AccountAvatar account={acc} size="sm" className="rounded-xl shrink-0" />
                              <div className="min-w-0">
                                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block truncate">
                                  {acc.name}
                                </span>
                                <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">
                                  {acc.type} {acc.accountNumber ? `· ...${acc.accountNumber}` : ''}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums block">
                                {formatINR(acc.balance)}
                              </span>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                Open Passbook →
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Holdings */}
                  {matchingHoldings.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Holdings & Assets ({matchingHoldings.length})
                        </h4>
                        <button
                          onClick={() => setScopeTab('holdings')}
                          className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                        >
                          View all
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {matchingHoldings.slice(0, 4).map((h) => {
                          const marketPrice = getHoldingMarketPrice(h).price;
                          const currentVal = h.quantity * marketPrice;
                          return (
                            <div
                              key={h.id}
                              onClick={() => {
                                handleClose();
                                setActiveTab('investments');
                              }}
                              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 cursor-pointer transition-colors flex items-center justify-between gap-3 active:scale-[0.99]"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {h.symbol}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold text-slate-400">
                                    {h.assetType}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                                  {h.name}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums block">
                                  {formatINR(currentVal)}
                                </span>
                                <span className="text-[10px] text-slate-400 tabular-nums">
                                  {h.quantity} units @ ₹{marketPrice}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Matching Transactions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Matching Transactions ({filteredTransactions.length})
                      </h4>
                      {filteredTransactions.length > 5 && (
                        <button
                          onClick={() => setScopeTab('transactions')}
                          className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                        >
                          Show all with filters
                        </button>
                      )}
                    </div>

                    {filteredTransactions.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 italic">
                        No transactions matched "{keyword}".
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredTransactions.slice(0, 6).map((tx) => (
                          <SearchTransactionCard
                            key={tx.id}
                            tx={tx}
                            onSelect={(t) => setEditingTransaction(t)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* When keyword is empty: Show Quick Actions & Fast Navigation */
                <>
                  {/* Quick Action Grid */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Instant Quick Actions
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">1-Click Launch</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {allQuickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.id}
                            onClick={action.action}
                            className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-left transition-all flex items-start gap-3 cursor-pointer group shadow-2xs active:scale-[0.98]"
                          >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${action.color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                {action.title}
                              </span>
                              <span className="text-[11px] text-slate-400 truncate block mt-0.5 line-clamp-1">
                                {action.description}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Navigation Destinations */}
                  <div className="space-y-2.5 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Jump to Section
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {navDestinations.map((dest) => {
                        const Icon = dest.icon;
                        return (
                          <button
                            key={dest.id}
                            onClick={dest.action}
                            className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left transition-all cursor-pointer group active:scale-[0.98]"
                          >
                            <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                              {dest.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent Transactions Preview */}
                  <div className="space-y-2.5 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Recent Transactions
                      </h4>
                      <button
                        onClick={() => setScopeTab('transactions')}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        All Transactions ({transactions.length})
                      </button>
                    </div>

                    <div className="space-y-2">
                      {indexedTransactions.slice(0, 5).map((tx) => (
                        <SearchTransactionCard
                          key={tx.id}
                          tx={tx}
                          onSelect={(t) => setEditingTransaction(t)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Scope: Actions Only */}
          {scopeTab === 'actions' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-6 sm:pb-8">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quick Actions & Shortcuts</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {matchingActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={action.action}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-all flex items-center gap-3.5 cursor-pointer shadow-2xs group active:scale-[0.98]"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${action.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {action.title}
                        </span>
                        <span className="text-xs text-slate-400 truncate block mt-0.5">
                          {action.description}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scope: Accounts Only */}
          {scopeTab === 'accounts' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 pb-6 sm:pb-8">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Accounts ({matchingAccounts.length})
                </h3>
                <span className="text-xs text-slate-400">Tap an account to open its passbook</span>
              </div>

              {matchingAccounts.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-8 text-center">No accounts matched your search.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {matchingAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      onClick={() => {
                        handleClose();
                        setSelectedAccountId(acc.id);
                        setActiveTab('accounts');
                      }}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-2xs active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AccountAvatar account={acc} size="md" className="rounded-xl shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">
                            {acc.name}
                          </span>
                          <span className="text-xs text-slate-400 uppercase font-semibold block truncate mt-0.5">
                            {acc.type} {acc.accountNumber ? `· ...${acc.accountNumber}` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums block">
                          {formatINR(acc.balance)}
                        </span>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          View Passbook →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Scope: Holdings Only */}
          {scopeTab === 'holdings' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 pb-6 sm:pb-8">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Investments & Assets ({matchingHoldings.length})
                </h3>
                <span className="text-xs text-slate-400">Tap to view in Investments</span>
              </div>

              {matchingHoldings.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-8 text-center">No investment holdings matched your search.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {matchingHoldings.map((h) => {
                    const price = getHoldingMarketPrice(h).price;
                    const val = h.quantity * price;
                    const invested = h.quantity * h.averageBuyPrice;
                    const pnl = val - invested;

                    return (
                      <div
                        key={h.id}
                        onClick={() => {
                          handleClose();
                          setActiveTab('investments');
                        }}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-2xs active:scale-[0.98]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {h.symbol}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              {h.assetType}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 truncate block mt-0.5">
                            {h.name}
                          </span>
                          <span className="text-[11px] text-slate-500 tabular-nums block mt-1">
                            {h.quantity} units · Avg ₹{h.averageBuyPrice}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums block">
                            {formatINR(val)}
                          </span>
                          <span
                            className={`text-xs font-bold tabular-nums block ${
                              pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {pnl >= 0 ? '+' : ''}{formatINR(pnl)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Scope: Full Transactions with rich filters & virtualization */}
          {scopeTab === 'transactions' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Quick Suggestion Chips */}
              <div className="px-4 sm:px-6 py-2 bg-slate-50/90 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5 text-xs shrink-0">
                <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap mr-1">
                  Quick:
                </span>

                <button
                  type="button"
                  onClick={() => setKeyword('< 500')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap font-medium transition-colors cursor-pointer"
                >
                  &lt; ₹500
                </button>
                <button
                  type="button"
                  onClick={() => setKeyword('> 1000')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap font-medium transition-colors cursor-pointer"
                >
                  &gt; ₹1,000
                </button>
                <button
                  type="button"
                  onClick={() => setKeyword('> 5000')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap font-medium transition-colors cursor-pointer"
                >
                  &gt; ₹5,000
                </button>

                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setKeyword(`#${tag}`)}
                    className={`px-2.5 py-1 rounded-lg whitespace-nowrap font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                      keyword.toLowerCase().includes(tag.toLowerCase())
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Hash className="w-3 h-3 text-slate-400" />
                    <span>{tag}</span>
                  </button>
                ))}
              </div>

              {/* Filter Dropdown Bar */}
              <div className="px-4 sm:px-6 py-2.5 bg-slate-50/50 dark:bg-slate-900/90 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs shrink-0">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="all">All Types</option>
                  <option value="expense">Expenses Only</option>
                  <option value="income">Income Only</option>
                  <option value="transfer">Transfers Only</option>
                </select>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="all">All Accounts</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>

                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="all">All Dates</option>
                  <option value="this_month">This Month</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="custom">Custom Date Range</option>
                </select>

                {dateFilter === 'custom' && (
                  <div className="flex items-center gap-1.5 ml-1">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                )}

                {(keyword ||
                  selectedType !== 'all' ||
                  selectedCategory !== 'all' ||
                  selectedAccount !== 'all' ||
                  dateFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:underline font-semibold text-xs ml-auto cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Results Summary Bar */}
              <div className="px-5 py-2.5 bg-slate-100/50 dark:bg-slate-800/20 text-xs flex items-center justify-between border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                <span>
                  Found <strong className="text-slate-900 dark:text-white">{filteredTransactions.length}</strong> matching transaction(s)
                </span>
                <span className="tabular-nums">
                  Cumulative: <strong className="text-slate-900 dark:text-white">{formatINR(totalAmount)}</strong>
                </span>
              </div>

              {/* Virtualized Transaction Results List */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="overflow-y-auto flex-1 p-4 sm:p-5 relative will-change-scroll pb-6 sm:pb-8"
              >
                {filteredTransactions.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 dark:text-slate-500">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No transactions matched "{keyword || 'your filters'}".
                    </p>
                    <p className="text-xs mt-1">
                      Try searching an exact amount (e.g. 1250), condition (&gt;1000), note, account, or tag.
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* Top Virtual Spacer */}
                    {topSpacer > 0 && <div style={{ height: `${topSpacer}px` }} />}

                    {/* Visible Window of Items */}
                    <div className="space-y-2">
                      {visibleTransactions.map((tx) => (
                        <SearchTransactionCard
                          key={tx.id}
                          tx={tx}
                          onSelect={(t) => setEditingTransaction(t)}
                        />
                      ))}
                    </div>

                    {/* Bottom Virtual Spacer */}
                    {bottomSpacer > 0 && <div style={{ height: `${bottomSpacer}px` }} />}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded edit modal when editing from search */}
      {editingTransaction && (
        <TransactionModal
          initialTransaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </>
  );
};
