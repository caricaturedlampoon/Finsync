import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigation } from '../../navigation/NavigationContext';
import {
  Landmark,
  UserCheck,
  Calculator,
  TrendingUp,
  Users,
  Coins,
  CalendarClock,
  ReceiptText,
  Tags,
  Bell,
  Settings,
  HelpCircle,
  X,
  ArrowLeft,
  ShieldCheck,
  Layers,
  Trash2,
  Scale,
  FileText,
  History,
  PiggyBank,
  CalendarDays,
  PieChart,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  Search,
} from 'lucide-react';

interface ExtendedToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ToolDefinition {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  isActive: boolean;
  badge?: string;
  badgeColor?: string;
  action: () => void;
}

const STORAGE_KEY_ORDER = 'finsync_more_tools_order_v1';
const STORAGE_KEY_HIDDEN = 'finsync_more_tools_hidden_v1';

export const ExtendedToolsModal: React.FC<ExtendedToolsModalProps> = ({ isOpen, onClose }) => {
  const {
    activeTab,
    setActiveTab,
    setSelectedAccountId,
    setIsProfileHubOpen,
    setIsAllTransactionsModalOpen,
    openDebts,
    openSplitExpenses,
    setIsRecurringModalOpen,
    setIsCategoriesModalOpen,
    setIsLoansModalOpen,
    setIsNotificationsModalOpen,
    setIsNetWorthModalOpen,
    openAnalysisExportModal,
    openSettingsTab,
    setIsBinOpen,
    bin,
    setIsBulkActionsModalOpen,
    bulkActions,
    setIsBudgetModalOpen,
    setIsCalendarModalOpen,
    setIsExtendedToolsOpen,
    markModalOpenedFromTools,
    showToast,
  } = useApp();

  const { pushScreen } = useNavigation();

  // State for customization mode
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customizeFilter, setCustomizeFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [customizeSearch, setCustomizeSearch] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Saved user custom ordering
  const [savedOrder, setSavedOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ORDER);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse tools order', e);
    }
    return [];
  });

  // Saved hidden tool IDs
  const [hiddenToolIds, setHiddenToolIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_HIDDEN);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse hidden tools', e);
    }
    return [];
  });

  // Seamless navigation handler for tab-based tools
  const handleOpenTab = (tab: any, preAction?: () => void) => {
    if (preAction) preAction();
    pushScreen(tab);
    setIsExtendedToolsOpen(false);
    setActiveTab(tab);
  };

  // Seamless navigation handler for full-screen / modal-based tools
  const handleOpenModal = (openAction: () => void, modalId: string) => {
    markModalOpenedFromTools(modalId);
    setIsExtendedToolsOpen(false);
    openAction();
  };

  // Base tool list with clean metadata (all unnecessary 'New' and 'Ledger' tags removed)
  const baseTools: ToolDefinition[] = [
    {
      id: 'bank',
      title: 'Accounts',
      subtitle: 'Banks, Cash & Wallets',
      icon: Landmark,
      colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      isActive: activeTab === 'accounts',
      action: () => {
        handleOpenTab('accounts', () => setSelectedAccountId(null));
      },
    },
    {
      id: 'all_transactions',
      title: 'All Transactions',
      subtitle: 'Search & filter entries',
      icon: ReceiptText,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => setIsAllTransactionsModalOpen(true), 'all_transactions');
      },
    },
    {
      id: 'investments',
      title: 'Investments',
      subtitle: 'Stocks, MFs, PF & SGB',
      icon: TrendingUp,
      colorClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
      isActive: activeTab === 'investments',
      action: () => {
        handleOpenTab('investments');
      },
    },
    {
      id: 'net_worth',
      title: 'Net Worth',
      subtitle: 'Consolidated Wealth',
      icon: Scale,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => setIsNetWorthModalOpen(true), 'net_worth');
      },
    },
    {
      id: 'analytics',
      title: 'Analytics',
      subtitle: 'Trends & Cash Flow',
      icon: PieChart,
      colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      isActive: activeTab === 'analytics',
      action: () => {
        handleOpenTab('analytics');
      },
    },
    {
      id: 'budget',
      title: 'Budget',
      subtitle: 'Monthly Caps & Alerts',
      icon: PiggyBank,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => setIsBudgetModalOpen(true), 'budget');
      },
    },
    {
      id: 'spend_calendar',
      title: 'Spend Calendar',
      subtitle: 'Daily Spends & Income',
      icon: CalendarDays,
      colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => setIsCalendarModalOpen(true), 'spend_calendar');
      },
    },
    {
      id: 'loans',
      title: 'Loans',
      subtitle: 'EMIs & Amortization',
      icon: Calculator,
      colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => setIsLoansModalOpen(true), 'loans');
      },
    },
    {
      id: 'split_expenses',
      title: 'Split Bills',
      subtitle: 'Group Expense Splits',
      icon: Users,
      colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      isActive: activeTab === 'split_expenses',
      action: () => {
        handleOpenTab('split_expenses', () => openSplitExpenses());
      },
    },
    {
      id: 'debts',
      title: 'Debts',
      subtitle: 'Borrow & lend tracking',
      icon: Coins,
      colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      isActive: activeTab === 'debts',
      action: () => {
        handleOpenTab('debts', () => openDebts());
      },
    },
    {
      id: 'recurring',
      title: 'Recurring',
      subtitle: 'Automated SIPs & Bills',
      icon: CalendarClock,
      colorClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => setIsRecurringModalOpen(true), 'recurring');
      },
    },
    {
      id: 'profile',
      title: 'Profile',
      subtitle: 'Account & Vault PIN',
      icon: UserCheck,
      colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => setIsProfileHubOpen(true), 'profile');
      },
    },
    {
      id: 'categories',
      title: 'Categories',
      subtitle: 'Expense & Income Tags',
      icon: Tags,
      colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => setIsCategoriesModalOpen(true), 'categories');
      },
    },
    {
      id: 'notifications',
      title: 'Reminders',
      subtitle: 'Alerts & Due Dates',
      icon: Bell,
      colorClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => setIsNotificationsModalOpen(true), 'notifications');
      },
    },
    {
      id: 'bin',
      title: 'Recycle Bin',
      subtitle:
        bin && bin.length > 0
          ? `${bin.length} in Bin`
          : 'Trash & 30D Restore',
      icon: Trash2,
      colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      badge: bin && bin.length > 0 ? String(bin.length) : undefined,
      badgeColor: 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      isActive: false,
      action: () => {
        handleOpenModal(() => setIsBinOpen(true), 'bin');
      },
    },
    {
      id: 'backup',
      title: 'Backup',
      subtitle: 'Cloud & Vault Export',
      icon: ShieldCheck,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => openSettingsTab('data'), 'backup');
      },
    },
    {
      id: 'reports',
      title: 'Reports',
      subtitle: 'PDF & CSV Export',
      icon: FileText,
      colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => openAnalysisExportModal('all'), 'reports');
      },
    },
    {
      id: 'bulk_actions',
      title: 'Bulk History',
      subtitle: 'Import History & Revert',
      icon: History,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      isActive: false,
      badge:
        bulkActions && bulkActions.filter((b) => b.status === 'COMPLETED').length > 0
          ? `${bulkActions.filter((b) => b.status === 'COMPLETED').length} Active`
          : undefined,
      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
      action: () => {
        handleOpenModal(() => setIsBulkActionsModalOpen(true), 'bulk_actions');
      },
    },
    {
      id: 'settings',
      title: 'Settings',
      subtitle: 'App preferences & vault',
      icon: Settings,
      colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => openSettingsTab('all'), 'settings');
      },
    },
    {
      id: 'help',
      title: 'Guide',
      subtitle: 'Help & FAQs',
      icon: HelpCircle,
      colorClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      isActive: false,
      action: () => {
        handleOpenModal(() => openSettingsTab('help_guide'), 'help');
      },
    },
  ];

  const defaultIds = useMemo(() => baseTools.map((t) => t.id), []);

  // Compute effective ordered list of IDs (saved IDs first, then any newly added default tools)
  const effectiveOrder = useMemo(() => {
    const validSaved = savedOrder.filter((id) => defaultIds.includes(id));
    const missing = defaultIds.filter((id) => !validSaved.includes(id));
    return [...validSaved, ...missing];
  }, [savedOrder, defaultIds]);

  // Persist order helper
  const handleUpdateOrder = (newOrder: string[]) => {
    setSavedOrder(newOrder);
    try {
      localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(newOrder));
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle tool visibility
  const handleToggleVisibility = (id: string) => {
    setHiddenToolIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Reorder tool up or down
  const handleMoveTool = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= effectiveOrder.length) return;
    const newOrder = [...effectiveOrder];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);
    handleUpdateOrder(newOrder);
  };

  // Move tool directly to top of sequence
  const handleMoveToTop = (index: number) => {
    if (index === 0) return;
    const newOrder = [...effectiveOrder];
    const [moved] = newOrder.splice(index, 1);
    newOrder.unshift(moved);
    handleUpdateOrder(newOrder);
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      return;
    }
    const fromIndex = effectiveOrder.indexOf(draggingId);
    const toIndex = effectiveOrder.indexOf(targetId);
    if (fromIndex !== -1 && toIndex !== -1) {
      const newOrder = [...effectiveOrder];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      handleUpdateOrder(newOrder);
    }
    setDraggingId(null);
  };

  // Reset tools to default order and show all
  const handleResetToDefault = () => {
    setSavedOrder(defaultIds);
    setHiddenToolIds([]);
    try {
      localStorage.removeItem(STORAGE_KEY_ORDER);
      localStorage.removeItem(STORAGE_KEY_HIDDEN);
      showToast('Tools restored to default order and visibility', 'success');
    } catch (e) {
      console.error(e);
    }
  };

  // Show all hidden tools
  const handleShowAll = () => {
    setHiddenToolIds([]);
    try {
      localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify([]));
      showToast('All tools are now visible', 'success');
    } catch (e) {
      console.error(e);
    }
  };

  // Fast tool lookup map
  const toolsMap = useMemo(() => {
    const map = new Map<string, ToolDefinition>();
    baseTools.forEach((tool) => map.set(tool.id, tool));
    return map;
  }, [baseTools]);

  // All tools ordered according to user's custom preference
  const orderedAllTools = useMemo(() => {
    return effectiveOrder
      .map((id) => toolsMap.get(id))
      .filter((tool): tool is ToolDefinition => Boolean(tool));
  }, [effectiveOrder, toolsMap]);

  // Tools currently visible in normal mode
  const visibleTools = useMemo(() => {
    return orderedAllTools.filter((tool) => !hiddenToolIds.includes(tool.id));
  }, [orderedAllTools, hiddenToolIds]);

  // Filtered tools in customize mode
  const customizeFilteredTools = useMemo(() => {
    return orderedAllTools.filter((tool) => {
      const isHidden = hiddenToolIds.includes(tool.id);
      if (customizeFilter === 'visible' && isHidden) return false;
      if (customizeFilter === 'hidden' && !isHidden) return false;
      if (customizeSearch.trim()) {
        const query = customizeSearch.toLowerCase().trim();
        return (
          tool.title.toLowerCase().includes(query) ||
          tool.subtitle.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [orderedAllTools, hiddenToolIds, customizeFilter, customizeSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
      {/* Crisp Compact Top Header with Back button, title, Customize button, Settings shortcut (LEFT of cross icon), and Close button */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 sm:px-6 pt-safe pb-2.5 sm:pb-3 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0 active:scale-95"
            title="Back to Previous Screen"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-2xs">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
              More Tools
            </h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 shrink-0">
              {isCustomizing
                ? `${orderedAllTools.length} Total`
                : `${visibleTools.length} ${visibleTools.length === 1 ? 'Action' : 'Actions'}`}
            </span>
          </div>
        </div>

        {/* Right side controls: Customize, Settings Shortcut (immediately to the left of cross icon), and Close */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Reorder / Visibility Customize Button */}
          <button
            type="button"
            onClick={() => setIsCustomizing((prev) => !prev)}
            className={`px-2.5 sm:px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
              isCustomizing
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={isCustomizing ? 'Done customizing' : 'Reorder & toggle visibility'}
            aria-label="Customize tools order and visibility"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">{isCustomizing ? 'Done' : 'Customize'}</span>
          </button>

          {/* Settings Shortcut - positioned immediately to the left of the cross icon */}
          <button
            type="button"
            onClick={() => {
              markModalOpenedFromTools('settings');
              setIsExtendedToolsOpen(false);
              openSettingsTab('all');
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 active:scale-95"
            title="App Settings & Preferences"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>

          {/* Close modal cross icon */}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 active:scale-95"
            title="Close Tools"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Customization Toolbar when customize mode is active */}
      {isCustomizing && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/60 px-3.5 sm:px-6 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-medium text-xs">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Drag or use arrows to reorder • Tap eye to show/hide</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 font-semibold transition-colors cursor-pointer text-xs"
              title="Reset order"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCustomizing(false)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer shadow-2xs text-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Full Screen Body */}
      <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 lg:p-6 pb-safe pb-24">
        <div className="max-w-4xl mx-auto w-full">
          {/* CUSTOMIZE MODE LIST VIEW */}
          {isCustomizing ? (
            <div className="space-y-2">
              {orderedAllTools.map((item) => {
                const effectiveIndex = effectiveOrder.indexOf(item.id);
                const Icon = item.icon;
                const isHidden = hiddenToolIds.includes(item.id);
                const isDragging = draggingId === item.id;

                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => handleDragStart(item.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(item.id)}
                      className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-2xl border transition-all ${
                        isDragging
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 opacity-75 ring-2 ring-emerald-500/40'
                          : isHidden
                          ? 'bg-slate-100/60 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-800 opacity-60'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {/* Drag Handle */}
                      <div
                        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0 p-0.5"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      {/* Position Index */}
                      <span className="w-5 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                        #{effectiveIndex + 1}
                      </span>

                      {/* Tool Icon */}
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${item.colorClass}`}
                      >
                        <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                      </div>

                      {/* Tool details */}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>

                      {/* Reorder and Visibility Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Move to Top */}
                        <button
                          type="button"
                          onClick={() => handleMoveToTop(effectiveIndex)}
                          disabled={effectiveIndex === 0}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer hidden sm:flex items-center justify-center ${
                            effectiveIndex === 0
                              ? 'text-slate-300 dark:text-slate-700 border-transparent cursor-not-allowed'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                          title="Move to Top"
                          aria-label="Move to Top"
                        >
                          <ChevronsUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Move Up */}
                        <button
                          type="button"
                          onClick={() => handleMoveTool(effectiveIndex, 'up')}
                          disabled={effectiveIndex === 0}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            effectiveIndex === 0
                              ? 'text-slate-300 dark:text-slate-700 border-transparent cursor-not-allowed'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                          title="Move Up"
                          aria-label="Move Up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          onClick={() => handleMoveTool(effectiveIndex, 'down')}
                          disabled={effectiveIndex === effectiveOrder.length - 1}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            effectiveIndex === effectiveOrder.length - 1
                              ? 'text-slate-300 dark:text-slate-700 border-transparent cursor-not-allowed'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                          title="Move Down"
                          aria-label="Move Down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        {/* Toggle Visibility (Eye / EyeOff) */}
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(item.id)}
                          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer font-semibold text-xs ${
                            isHidden
                              ? 'bg-slate-200/70 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                              : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                          }`}
                          title={isHidden ? 'Show tool in menu' : 'Hide tool from menu'}
                          aria-label={isHidden ? 'Show tool' : 'Hide tool'}
                        >
                          {isHidden ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                              <span className="hidden sm:inline">Show</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span className="hidden sm:inline">Visible</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : visibleTools.length === 0 ? (
            /* Edge case: All tools hidden */
            <div className="py-16 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4 border border-slate-200 dark:border-slate-700">
                <EyeOff className="w-7 h-7" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                All Tools Are Hidden
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                You have turned off visibility for all tools. Unhide them anytime to restore your dashboard.
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleShowAll}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  Show All Tools
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomizing(true)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Customize Selection
                </button>
              </div>
            </div>
          ) : (
            /* STANDARD 2-COLUMN MATRIX VIEW IN USER PREFERRED ORDER */
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {visibleTools.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    className={`flex items-center gap-3 px-3.5 py-3 sm:px-4 sm:py-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-150 active:scale-[0.98] group overflow-hidden min-h-[58px] sm:min-h-[64px] ${
                      item.isActive
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500/50 shadow-2xs ring-1 ring-emerald-500/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 shadow-2xs'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 group-hover:scale-105 ${item.colorClass}`}
                    >
                      <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {item.title}
                        </h3>
                        {item.badge && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                              item.badgeColor ||
                              'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-snug">
                        {item.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Crisp Compact Footer Bar with safe area padding */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 pt-2.5 pb-safe flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {isCustomizing
              ? 'Arrange tools in your preferred sequence'
              : 'Tap any tool to launch'}
          </span>
          {!isCustomizing && (
            <button
              type="button"
              onClick={() => setIsCustomizing(true)}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer hidden sm:inline"
            >
              • Customize Order & Visibility
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs active:scale-95"
        >
          Close
        </button>
      </footer>
    </div>
  );
};
