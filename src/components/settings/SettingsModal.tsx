import React, { useRef, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { formatINR } from '../../utils/formatters';
import { calculateStockDeliveryCharges, calculateMutualFundCharges } from '../../utils/statutoryCharges';
import { Account, DashboardWidgetConfig, DashboardWidgetId, ActiveTab } from '../../types';
import { AVAILABLE_NAV_TABS, DEFAULT_NAVIGATION_TABS } from '../layout/BottomNav';
import { AccountAvatar } from '../common/AccountAvatar';
import { AccountModal } from '../accounts/AccountModal';
import { HelpFacilitiesGuide } from './HelpFacilitiesGuide';
import { BinView } from './BinView';
import { useRegisterSubscreen } from '../../navigation/NavigationContext';
import {
  enrollDeviceBiometrics,
  getBiometricStatus,
  authenticateDeviceBiometrics,
} from '../../services/biometricAuthService';
import {
  X,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  Sun,
  Moon,
  ShieldCheck,
  Database,
  HardDriveDownload,
  HardDriveUpload,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CreditCard,
  Laptop,
  TrendingUp,
  Sliders,
  Check,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Plus,
  Edit2,
  Layers,
  Coins,
  CalendarClock,
  Sparkles,
  Tags,
  User,
  Camera,
  LayoutDashboard,
  PieChart,
  Landmark,
  Users,
  Navigation,
  Lock,
  Unlock,
  KeyRound,
  CheckCircle2,
  Receipt,
  HelpCircle,
  BookOpen,
  Compass,
  Lightbulb,
  PlayCircle,
  ExternalLink,
  ArrowRight,
  Zap,
  Fingerprint,
  Search,
  Info,
  Share2,
} from 'lucide-react';
import { AppFeatureId } from '../../types';

export type SettingsSectionId =
  | 'help_guide'
  | 'profile'
  | 'customize'
  | 'theme'
  | 'feature_lock'
  | 'security'
  | 'bank_accounts'
  | 'liquid_wealth'
  | 'data'
  | 'bin'
  | 'investment_csv'
  | 'regional'
  | 'maintenance';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    settingsInitialTab,
    setSettingsInitialTab,
    userProfile,
    updateUserProfile,
    setIsProfileModalOpen,
    settings,
    updateSettings,
    setTheme,
    isDark,
    resolvedTheme,
    toggleTheme,
    accounts,
    categories,
    recurring,
    bin,
    updateAccount,
    deleteAccount,
    showToast,
    recalculateAllBalances,
    exportCSV,
    importCSVFile,
    resetAllData,
    resetToZeroData,
    setIsInvestmentCSVModalOpen,
    setIsCategoriesModalOpen,
    setIsRecurringModalOpen,
    exportStocksCSVData,
    exportMutualFundsCSVData,
    setIsCustomizeModalOpen,
    isFeatureUnlocked,
    toggleFeatureLock,
    unlockAllFeatures,
    openTradeModal,
    setActiveTab,
    setIsBackupModalOpen,
    isGoogleDriveConnected,
    googleUser,
    lockApp,
    setAppLockConfig,
    openAnalysisExportModal,
    setIsNetWorthModalOpen,
    setIsLoansModalOpen,
    setIsDebtsModalOpen,
    openSplitExpenses,
  } = useApp();

  const ALL_APP_FEATURES: {
    id: AppFeatureId;
    name: string;
    description: string;
    hides: string;
    icon: React.ComponentType<{ className?: string }>;
    colorClass: string;
  }[] = [
    {
      id: 'expense_entry',
      name: '1. Expense / Income Entry',
      description: 'Transaction recording forms, quick + floating action button, expense & income tracking, and passbook transfers.',
      hides: 'Hides the floating "+" button from bottom nav, and quick transaction buttons from passbooks and dashboard.',
      icon: Receipt,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'analytics',
      name: '2. Analytics & Visual Insights',
      description: 'Deep financial analytics, monthly cashflow metrics, top category spending insights, and savings trends.',
      hides: 'Hides the Analytics tab from bottom navigation and Category Spending Insights widget from the dashboard.',
      icon: PieChart,
      colorClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    },
    {
      id: 'accounts',
      name: '3. Bank Accounts & Passbooks',
      description: 'Bank passbooks, cash wallets, credit card limit & utilization tracker, and balance adjustment audits.',
      hides: 'Hides the Accounts tab from bottom navigation and Bank Accounts strip from the dashboard.',
      icon: Landmark,
      colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      id: 'investments',
      name: '4. Investments & Portfolio',
      description: 'Equities & stocks, mutual funds, gold bonds, live closing NAV auto-syncing, SIP schedules, and XIRR.',
      hides: 'Hides the Investments tab from bottom navigation and Investment highlights from the dashboard.',
      icon: TrendingUp,
      colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    },
    {
      id: 'debts',
      name: '5. Debts & Loans Ledger',
      description: 'Personal lending and borrowing records, contact balance ledgers, repayment logs, and due date reminders.',
      hides: 'Hides the Debts tab, header menu shortcut, and Debts & Loans overview card from the dashboard.',
      icon: Coins,
      colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      id: 'split_expenses',
      name: '6. Split Expenses (Groups)',
      description: 'Group bill splitting (equal, exact, percentage, shares), trip expenses, flatmate budgets, and settlement calculations.',
      hides: 'Hides the Split Expenses tab and group shortcuts from the header options menu.',
      icon: Users,
      colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    },
    {
      id: 'recurring',
      name: '7. Recurring Transactions',
      description: 'Automated recurring bills, monthly house rent, scheduled salaries, and background offline execution engine.',
      hides: 'Hides the Recurring Schedules shortcut and execution notifications from menus and dashboard.',
      icon: CalendarClock,
      colorClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    },
  ];

  const unlockedFeatureCount = ALL_APP_FEATURES.filter((f) => isFeatureUnlocked(f.id)).length;

  const [selectedSection, setSelectedSection] = useState<SettingsSectionId | null>(null);

  // Register settings drilldown subscreen with dynamic navigation stack
  useRegisterSubscreen(
    isSettingsModalOpen && selectedSection !== null,
    `settings_section_${selectedSection}`,
    `Settings: ${selectedSection}`,
    () => {
      setSelectedSection(null);
    }
  );

  // Category Accordion Dropdown State (collapsed by default)
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({
    customization: false,
    security: false,
    backup: false,
    automation: false,
  });

  const toggleCategory = (catKey: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
  };

  // Profile editing state inside Settings
  const [profileName, setProfileName] = useState(userProfile.name || '');
  const [profileTagline, setProfileTagline] = useState(userProfile.tagline || '');
  const [profileEmail, setProfileEmail] = useState(userProfile.email || '');
  const [profileAvatar, setProfileAvatar] = useState(userProfile.avatarUrl || '');
  const [isProcessingProfilePhoto, setIsProcessingProfilePhoto] = useState(false);
  const profileFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userProfile) {
      setProfileName(userProfile.name || '');
      setProfileTagline(userProfile.tagline || '');
      setProfileEmail(userProfile.email || '');
      setProfileAvatar(userProfile.avatarUrl || '');
    }
  }, [userProfile, selectedSection]);

  useEffect(() => {
    if (isSettingsModalOpen) {
      if (settingsInitialTab === 'help_guide') {
        setSelectedSection('help_guide');
      } else if (settingsInitialTab === 'profile') {
        setSelectedSection('profile');
      } else if (settingsInitialTab === 'customize') {
        setSelectedSection('customize');
      } else if (settingsInitialTab === 'security') {
        setSelectedSection('security');
      } else if (settingsInitialTab === 'data') {
        setSelectedSection('data');
      } else if (settingsInitialTab === 'maintenance') {
        setSelectedSection('maintenance');
      } else {
        setSelectedSection(null);
      }
    }
  }, [isSettingsModalOpen, settingsInitialTab]);

  // Containers for auto-scroll and scroll preservation when navigating within settings
  const rootContentRef = useRef<HTMLDivElement>(null);
  const sectionContentRef = useRef<HTMLDivElement>(null);
  const savedSettingsRootScrollRef = useRef<number>(0);
  const prevSectionRef = useRef<SettingsSectionId | null>(null);

  useEffect(() => {
    if (selectedSection && !prevSectionRef.current) {
      // Just entered a section from the root list: save root scroll position
      if (rootContentRef.current) {
        savedSettingsRootScrollRef.current = rootContentRef.current.scrollTop;
      }
      sectionContentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    } else if (!selectedSection && prevSectionRef.current) {
      // Returning to root list from a section: restore root scroll position!
      requestAnimationFrame(() => {
        if (rootContentRef.current && savedSettingsRootScrollRef.current > 0) {
          rootContentRef.current.scrollTop = savedSettingsRootScrollRef.current;
        }
      });
    }
    prevSectionRef.current = selectedSection;
  }, [selectedSection]);



  // Account editing & deleting for Bank & Credit Card Security Management
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  const csvInputRef = useRef<HTMLInputElement>(null);

  // App Lock local PIN draft state
  const [newPinInput, setNewPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [showPinPlaintext, setShowPinPlaintext] = useState(false);
  const [showNewPinInput, setShowNewPinInput] = useState(false);
  const [isSettingNewPin, setIsSettingNewPin] = useState(false);
  const [bioStatus, setBioStatus] = useState(() => getBiometricStatus());
  const [isTestingBio, setIsTestingBio] = useState(false);

  // Safety confirmation dialog state
  const [resetConfirmType, setResetConfirmType] = useState<'sample' | 'zero' | null>(null);
  const [confirmInput, setConfirmInput] = useState('');

  // Local state for dashboard widgets customization (draft)
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(() => {
    return [...(settings.dashboardWidgets || [])].sort((a, b) => a.order - b.order);
  });

  const DEFAULT_ANALYTICS_CARDS = [
    { id: 'cashflow_summary', name: 'Cashflow Summary Card', visible: true, order: 1 },
    { id: 'spend_income_toggle', name: 'Spend vs Income Toggle & Header', visible: true, order: 2 },
    { id: 'category_breakdown', name: 'Category Breakdown & Treemap', visible: true, order: 3 },
    { id: 'comparative_trend', name: 'Comparative Trend Analysis', visible: true, order: 4 },
    { id: 'day_wise_spending', name: 'Day-Wise Spending Curve', visible: true, order: 5 },
    { id: 'six_month_comparison', name: '6-Month Income vs Expense', visible: true, order: 6 },
  ];

  const DEFAULT_INVESTMENT_CARDS = [
    { id: 'portfolio_master_summary', name: 'Portfolio Master Summary Header', visible: true, order: 1 },
    { id: 'valuation_trajectory', name: 'Valuation Trajectory Graph', visible: true, order: 2 },
    { id: 'stocks_vs_mf', name: 'Stocks vs MF Comparative Analysis', visible: true, order: 3 },
    { id: 'growth_bar_analytics', name: 'Growth Bar Analytics', visible: true, order: 4 },
    { id: 'holdings_table', name: 'Holdings Table & Filters', visible: true, order: 5 },
  ];

  const [analyticsCards, setAnalyticsCards] = useState<any[]>(() => {
    return (settings.analyticsCards && settings.analyticsCards.length > 0)
      ? [...settings.analyticsCards].sort((a, b) => a.order - b.order)
      : [...DEFAULT_ANALYTICS_CARDS];
  });

  const [investmentCards, setInvestmentCards] = useState<any[]>(() => {
    return (settings.investmentCards && settings.investmentCards.length > 0)
      ? [...settings.investmentCards].sort((a, b) => a.order - b.order)
      : [...DEFAULT_INVESTMENT_CARDS];
  });

  useEffect(() => {
    if (settings.dashboardWidgets) {
      setWidgets([...settings.dashboardWidgets].sort((a, b) => a.order - b.order));
    }
  }, [settings.dashboardWidgets, isSettingsModalOpen]);

  // Local state for bottom navigation customization (draft)
  const [navTabs, setNavTabs] = useState<ActiveTab[]>(() => {
    return settings.navigationTabs && settings.navigationTabs.length === 4
      ? [...settings.navigationTabs]
      : [...DEFAULT_NAVIGATION_TABS];
  });

  // Default accounts & categories (draft)
  const [defaultAccountId, setDefaultAccountId] = useState<string>(settings.defaultAccountId || '');
  const [defaultExpenseCategoryId, setDefaultExpenseCategoryId] = useState<string>(
    settings.defaultExpenseCategoryId || ''
  );
  const [defaultIncomeCategoryId, setDefaultIncomeCategoryId] = useState<string>(
    settings.defaultIncomeCategoryId || ''
  );

  useEffect(() => {
    if (isSettingsModalOpen) {
      if (settings.navigationTabs && settings.navigationTabs.length === 4) {
        setNavTabs([...settings.navigationTabs]);
      } else {
        setNavTabs([...DEFAULT_NAVIGATION_TABS]);
      }
      if (settings.analyticsCards && settings.analyticsCards.length > 0) {
        setAnalyticsCards([...settings.analyticsCards].sort((a, b) => a.order - b.order));
      }
      if (settings.investmentCards && settings.investmentCards.length > 0) {
        setInvestmentCards([...settings.investmentCards].sort((a, b) => a.order - b.order));
      }
      setDefaultAccountId(settings.defaultAccountId || '');
      setDefaultExpenseCategoryId(settings.defaultExpenseCategoryId || '');
      setDefaultIncomeCategoryId(settings.defaultIncomeCategoryId || '');
    }
  }, [settings, isSettingsModalOpen]);

  // Draft state for Feature Lock / Unlock
  const [draftFeatureLocks, setDraftFeatureLocks] = useState<Record<AppFeatureId, boolean>>({
    expense_entry: true,
    analytics: true,
    accounts: true,
    investments: true,
    debts: true,
    split_expenses: true,
    recurring: true,
  });

  useEffect(() => {
    if (selectedSection === 'feature_lock' || isSettingsModalOpen) {
      setDraftFeatureLocks({
        expense_entry: isFeatureUnlocked('expense_entry'),
        analytics: isFeatureUnlocked('analytics'),
        accounts: isFeatureUnlocked('accounts'),
        investments: isFeatureUnlocked('investments'),
        debts: isFeatureUnlocked('debts'),
        split_expenses: isFeatureUnlocked('split_expenses'),
        recurring: isFeatureUnlocked('recurring'),
      });
    }
  }, [selectedSection, isFeatureUnlocked, isSettingsModalOpen]);

  const handleToggleDraftFeature = (fId: AppFeatureId) => {
    setDraftFeatureLocks((prev) => ({
      ...prev,
      [fId]: !prev[fId],
    }));
  };

  const handleSaveFeatureLocks = () => {
    updateSettings({
      featureLocks: draftFeatureLocks,
    });
    showToast('Feature lock preferences saved successfully', 'success');
  };

  const handleUnlockAllDraftFeatures = () => {
    setDraftFeatureLocks({
      expense_entry: true,
      analytics: true,
      accounts: true,
      investments: true,
      debts: true,
      split_expenses: true,
      recurring: true,
    });
  };

  const [draftLiquidAccounts, setDraftLiquidAccounts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (selectedSection === 'liquid_wealth' || isSettingsModalOpen) {
      const initialMap: Record<string, boolean> = {};
      accounts.forEach((acc) => {
        initialMap[acc.id] = acc.includeInNetLiquid ?? true;
      });
      setDraftLiquidAccounts(initialMap);
    }
  }, [selectedSection, accounts, isSettingsModalOpen]);

  const handleToggleDraftLiquidAccount = (accountId: string) => {
    setDraftLiquidAccounts((prev) => ({
      ...prev,
      [accountId]: !prev[accountId],
    }));
  };

  const handleSaveLiquidWealth = () => {
    accounts.forEach((acc) => {
      const draftVal = draftLiquidAccounts[acc.id];
      if (draftVal !== undefined && draftVal !== acc.includeInNetLiquid) {
        updateAccount(acc.id, { includeInNetLiquid: draftVal });
      }
    });
    showToast('Liquid wealth account preferences saved successfully', 'success');
  };

  const ALL_POSSIBLE_TABS: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home Dashboard', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: PieChart },
    { id: 'accounts', label: 'Bank Accounts', icon: Landmark },
    { id: 'investments', label: 'Investments', icon: TrendingUp },
    { id: 'debts', label: 'Debts & Loans', icon: Coins },
    { id: 'split_expenses', label: 'Split Expenses', icon: Users },
  ];

  const handleNavSlotChange = (slotIndex: number, newTabId: ActiveTab) => {
    const next = [...navTabs];
    const existingIndex = next.indexOf(newTabId);
    if (existingIndex !== -1 && existingIndex !== slotIndex) {
      next[existingIndex] = next[slotIndex];
    }
    next[slotIndex] = newTabId;
    setNavTabs(next);
  };

  const handleNavMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...navTabs];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    setNavTabs(next);
  };

  const handleNavMoveDown = (index: number) => {
    if (index === navTabs.length - 1) return;
    const next = [...navTabs];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    setNavTabs(next);
  };

  const handleApplyNavPreset = (presetTabs: ActiveTab[]) => {
    setNavTabs([...presetTabs]);
  };

  const handleResetNavTabs = () => {
    const defaultTabs = [...DEFAULT_NAVIGATION_TABS];
    setNavTabs(defaultTabs);
  };

  const handleSaveCustomize = () => {
    updateSettings({
      navigationTabs: navTabs,
      dashboardWidgets: widgets,
      analyticsCards,
      investmentCards,
      defaultAccountId: defaultAccountId || undefined,
      defaultExpenseCategoryId: defaultExpenseCategoryId || undefined,
      defaultIncomeCategoryId: defaultIncomeCategoryId || undefined,
    });
    showToast('Customization preferences saved successfully', 'success');
  };

  if (!isSettingsModalOpen) return null;

  const handleClose = () => {
    setResetConfirmType(null);
    setConfirmInput('');
    setAccountToDelete(null);
    setSelectedSection(null);
    setIsSettingsModalOpen(false);
  };

  const handleCSVSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importCSVFile(file);
      e.target.value = '';
    }
  };


  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file (PNG, JPG, WebP)', 'error');
      return;
    }

    setIsProcessingProfilePhoto(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const targetSize = 256;
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setProfileAvatar(ev.target?.result as string);
          setIsProcessingProfilePhoto(false);
          return;
        }

        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;
        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        setProfileAvatar(compressed);
        setIsProcessingProfilePhoto(false);
        showToast('Photo selected! Tap "Save Changes" to apply.', 'info');
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveProfilePhoto = () => {
    setProfileAvatar('');
    showToast('Photo removed. Initials will be used.', 'info');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = profileName.trim();
    if (!trimmed) {
      showToast('Please enter your full name', 'error');
      return;
    }

    updateUserProfile({
      name: trimmed,
      tagline: profileTagline.trim(),
      email: profileEmail.trim(),
      avatarUrl: profileAvatar,
    });
    showToast('Profile updated successfully', 'success');
  };

  const handleConfirmReset = () => {
    if (resetConfirmType === 'zero') {
      resetToZeroData();
    } else if (resetConfirmType === 'sample') {
      resetAllData();
    }
    setResetConfirmType(null);
    setConfirmInput('');
    handleClose();
  };

  // Widget customizer handlers (saved via handleSaveCustomize)
  const handleToggleWidget = (id: DashboardWidgetId) => {
    const nextWidgets = widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w));
    setWidgets(nextWidgets);
  };

  const handleMoveWidgetUp = (index: number) => {
    if (index === 0) return;
    const nextWidgets = [...widgets];
    const temp = nextWidgets[index];
    nextWidgets[index] = nextWidgets[index - 1];
    nextWidgets[index - 1] = temp;
    nextWidgets.forEach((w, idx) => {
      w.order = idx + 1;
    });
    setWidgets(nextWidgets);
  };

  const handleMoveWidgetDown = (index: number) => {
    if (index === widgets.length - 1) return;
    const nextWidgets = [...widgets];
    const temp = nextWidgets[index];
    nextWidgets[index] = nextWidgets[index + 1];
    nextWidgets[index + 1] = temp;
    nextWidgets.forEach((w, idx) => {
      w.order = idx + 1;
    });
    setWidgets(nextWidgets);
  };

  const handleResetLayoutToDefault = () => {
    const defaultWidgets: DashboardWidgetConfig[] = [
      { id: 'summary_highlight', title: 'Monthly Summary Highlight', visible: true, order: 1 },
      { id: 'net_liquid_wealth', title: 'Net Liquid Wealth Card', visible: true, order: 2 },
      { id: 'accounts_strip', title: 'Bank Accounts & Passbooks', visible: true, order: 3 },
      { id: 'investment_highlights', title: 'Investment & Securities Snapshot', visible: true, order: 4 },
      { id: 'category_insight', title: 'Top Category Spending Insights', visible: true, order: 5 },
      { id: 'recent_transactions', title: 'Recent Passbook Transactions', visible: true, order: 6 },
      { id: 'debts_card', title: 'Debts & Loans Overview', visible: true, order: 7 },
    ];
    setWidgets(defaultWidgets);
    showToast('Dashboard layout reset to default. Tap "Save Customization" to apply.', 'info');
  };

  // Filter bank accounts and credit cards for security section
  const bankAndCreditAccounts = accounts.filter(
    (acc) => acc.type === 'bank' || acc.type === 'credit'
  );

  const getSectionTitle = (id: SettingsSectionId): string => {
    switch (id) {
      case 'profile':
        return 'User Profile & Identity';
      case 'customize':
        return 'Personalization & Customization';
      case 'theme':
        return 'Theme & Visual Styling';
      case 'liquid_wealth':
        return 'Net Liquid Wealth Selectors';
      case 'security':
        return 'Security, App Lock & Biometrics';
      case 'bank_accounts':
        return 'Bank Account Settings';
      case 'feature_lock':
        return 'Feature Lock / Unlock';
      case 'data':
        return 'Backup and Restore';
      case 'bin':
        return 'Recycle Bin (30-Day Auto Retention)';
      case 'investment_csv':
        return 'Investment CSV Engine';
      case 'regional':
        return 'Currency, Date & Automation';
      case 'maintenance':
        return 'Audit & Ledger Maintenance';
      case 'help_guide':
        return 'Help';
      default:
        return 'Settings';
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-150">
        {/* ========================================================= */}
        {/* TOP BAR HEADER                                            */}
        {/* ========================================================= */}
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 shrink-0 pt-safe">
          <div className="flex items-center gap-3">
            {selectedSection ? (
              <button
                type="button"
                onClick={() => setSelectedSection(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                title="Back to all settings"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Settings</span>
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <Sliders className="w-5 h-5" />
              </div>
            )}

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {selectedSection ? getSectionTitle(selectedSection) : 'Settings & Preferences'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedSection === 'help_guide'
                  ? 'Guides, step-by-step instructions, and FAQs'
                  : selectedSection === 'data'
                  ? 'Military-grade AES-256 encrypted backups & Google Drive cloud restore'
                  : selectedSection === 'bin'
                  ? '30-day automatic retention for deleted transactions, trades, accounts & holdings'
                  : selectedSection
                  ? 'Configuring selected preferences in fullscreen'
                  : 'Centralized customization hub, personal identity, security vaults, and offline data backup'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedSection !== 'help_guide' && (
              <button
                type="button"
                onClick={() => setSelectedSection('help_guide')}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-all cursor-pointer shadow-2xs group"
                title="Help & Facilities Guide"
                aria-label="Help Guide"
              >
                <HelpCircle className="w-4.5 h-4.5 text-slate-500 group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-400 transition-colors" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* ROOT VIEW: VERTICAL SCROLLED LIST OF SETTINGS             */}
        {/* ========================================================= */}
        {selectedSection === null && (
          <div ref={rootContentRef} className="p-4 sm:p-6 overflow-y-auto flex-1 max-w-3xl mx-auto w-full space-y-6 pb-safe pb-28">
            {/* 1. START WITH PROFILE: User Profile & Identity (Hero Profile Card) */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                User Profile & Identity
              </span>
              <div
                onClick={() => setSelectedSection('profile')}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4 cursor-pointer hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    {userProfile.avatarUrl ? (
                      <img
                        src={userProfile.avatarUrl}
                        alt={userProfile.name}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/30 group-hover:ring-emerald-500 transition-all shadow-xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white font-bold text-base flex items-center justify-center shadow-xs ring-2 ring-emerald-500/20 group-hover:ring-emerald-500 transition-all">
                        {userProfile.name ? userProfile.name.slice(0, 2).toUpperCase() : 'ME'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {userProfile.name}
                      </h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        Primary Profile
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {userProfile.tagline || 'Personal Account'} · Tap to edit photo and display name
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSection('profile');
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-xs active:scale-95"
                >
                  Edit Profile
                </button>
              </div>
            </div>

            {/* 2. GROUP TOGETHER: Personalization, Customization, Themes & Net Liquid Wealth */}
            {/* ======================================================= */}
            {/* 2. CATEGORY 1: CUSTOMIZATION AND PERSONALIZATION         */}
            {/* ======================================================= */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all">
              {/* Category Dropdown Header */}
              <button
                type="button"
                onClick={() => toggleCategory('customization')}
                className="w-full p-4 sm:p-4.5 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/80 transition-colors text-left cursor-pointer group select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Customization and Personalization
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300">
                        4 Options
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      Widgets, theme styling, net liquid wealth & categories
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 transition-transform duration-200 ${
                    expandedCategories.customization ? 'rotate-180' : 'rotate-0'
                  }`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </button>

              {/* Collapsible Content */}
              {expandedCategories.customization && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
                  {/* 1. Personalization & Customization */}
                  <button
                    type="button"
                    onClick={() => setSelectedSection('customize')}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <Sliders className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          Personalization & Customization
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          Configure bottom bar tabs, reorder dashboard widgets, and set entry defaults
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                        {widgets.filter((w) => w.visible).length} Active Widgets
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  {/* 2. Theme & Visual Styling */}
                  <button
                    type="button"
                    onClick={() => setSelectedSection('theme')}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        {settings.theme === 'system' ? (
                          <Laptop className="w-4.5 h-4.5" />
                        ) : isDark ? (
                          <Moon className="w-4.5 h-4.5" />
                        ) : (
                          <Sun className="w-4.5 h-4.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          Theme & Visual Styling
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          OLED Dark Mode, Daylight Light Mode & System Auto
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                        {settings.theme === 'system'
                          ? `Auto (${isDark ? 'Dark' : 'Light'})`
                          : settings.theme === 'dark'
                          ? 'Dark Mode'
                          : 'Light Mode'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  {/* 3. Net Liquid Wealth Selectors */}
                  <button
                    type="button"
                    onClick={() => setSelectedSection('liquid_wealth')}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                        <Coins className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          Net Liquid Wealth Selectors
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          Configure which bank accounts & cash wallets contribute to your liquid wealth summary
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                        {accounts.filter((a) => a.includeInNetLiquid).length} Included
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  {/* 4. Categories & Tags Manager */}
                  <button
                    type="button"
                    onClick={() => setIsCategoriesModalOpen(true)}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Tags className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          Categories & Tags Manager
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          Create, customize, and color-code income & expense categories with icons
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        {categories.length} Categories
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* ======================================================= */}
            {/* 3. CATEGORY 2: SECURITY (3 DISTINCT FACILITIES)           */}
            {/* ======================================================= */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all">
              {/* Category Dropdown Header */}
              <button
                type="button"
                onClick={() => toggleCategory('security')}
                className="w-full p-4 sm:p-4.5 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/80 transition-colors text-left cursor-pointer group select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        Security & Access Control
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                        3 Distinct Facilities
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      App lock, Bank account settings & feature permissions
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 transition-transform duration-200 ${
                    expandedCategories.security ? 'rotate-180' : 'rotate-0'
                  }`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </button>

              {/* Collapsible Content: Exactly 3 Distinct Items */}
              {expandedCategories.security && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
                  {/* Distinct Item 1: App Lock & Biometrics */}
                  <button
                    type="button"
                    onClick={() => setSelectedSection('security')}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Fingerprint className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            1. App Lock & Biometrics
                          </span>
                          {settings.isAppLockEnabled && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          Startup PIN lock, Touch ID / Face ID hardware biometrics & offline security
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        settings.isAppLockEnabled
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {settings.isAppLockEnabled ? '🔒 PIN & Bio' : '🔓 Off (Tap to Setup)'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  {/* Distinct Item 2: Bank Account Settings */}
                  <button
                    type="button"
                    onClick={() => setSelectedSection('bank_accounts')}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Landmark className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          2. Bank Account Settings
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          Edit bank accounts & credit cards, manage account numbers, card limits & safe deletion
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                        {bankAndCreditAccounts.length} Protected
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  {/* Distinct Item 3: Feature Lock / Unlock */}
                  <button
                    type="button"
                    onClick={() => setSelectedSection('feature_lock')}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Lock className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          3. Feature Lock / Unlock
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          Lock or unlock Expense entry, Analytics, Accounts, Investments, Debts, Split, or Recurring
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                        {unlockedFeatureCount} of 7 Active
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* ======================================================= */}
            {/* 4. CATEGORY 3: BACKUP AND RESTORE                         */}
            {/* ======================================================= */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all">
              {/* Category Dropdown Header */}
              <button
                type="button"
                onClick={() => toggleCategory('backup')}
                className="w-full p-4 sm:p-4.5 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/80 transition-colors text-left cursor-pointer group select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <HardDriveDownload className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        Backup and Restore
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                        3 Options
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      Encrypted AES-256 cloud/local snapshots, broker CSV import & 30-day Recycle Bin
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 transition-transform duration-200 ${
                    expandedCategories.backup ? 'rotate-180' : 'rotate-0'
                  }`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </button>

              {/* Collapsible Content */}
              {expandedCategories.backup && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
                  {/* Backup and Restore */}
                  <button
                    type="button"
                    onClick={() => setSelectedSection('data')}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          Backup and Restore
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          AES-256-GCM password-encrypted files, Google Drive cloud sync, automated daily/weekly snapshots, and CSV recovery
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono">
                        AES-256 & Drive
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  {/* Investment CSV Engine */}
                  <button
                    type="button"
                    onClick={() => setSelectedSection('investment_csv')}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          Investment CSV Engine (Stocks & Mutual Funds)
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          Import broker trade statements with automated bank fund transfers and CMP derivation
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                        Broker CSV
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  {/* Recycle Bin (30-Day Recovery) */}
                  <button
                    type="button"
                    onClick={() => setSelectedSection('bin')}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <Trash2 className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                          Recycle Bin (30-Day Recovery)
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          Auto-retains deleted transactions, trade actions, accounts, holdings & debts for 30 days before permanent purging
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        bin.length > 0
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-medium'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {bin.length} {bin.length === 1 ? 'Item' : 'Items'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* ======================================================= */}
            {/* 5. CATEGORY 4: AUTOMATION & MAINTENANCE                  */}
            {/* ======================================================= */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all">
              {/* Category Dropdown Header */}
              <button
                type="button"
                onClick={() => toggleCategory('automation')}
                className="w-full p-4 sm:p-4.5 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/80 transition-colors text-left cursor-pointer group select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        Automation & Maintenance
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300">
                        3 Tools
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      Recurring auto-execution, currency formatting & ledger recalculation
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 transition-transform duration-200 ${
                    expandedCategories.automation ? 'rotate-180' : 'rotate-0'
                  }`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </button>

              {/* Collapsible Content */}
              {expandedCategories.automation && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
                  {/* Recurring Schedules Engine */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecurringModalOpen(true);
                    }}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                        <CalendarClock className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          Recurring Schedules Engine
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          Automated monthly rent, SIP investments, salaries with 24h advance notice & duplicate prevention
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                        {recurring.length} Schedules
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  {/* Regional & Automation */}
                  <button
                    type="button"
                    onClick={() => setSelectedSection('regional')}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                          Currency, Date & Automation
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          Indian Rupee (₹ Lakhs & Crores) notation, DD/MM/YYYY formatting, recurring triggers
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 font-mono">
                        ₹ INR
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  {/* Maintenance */}
                  <button
                    type="button"
                    onClick={() => setSelectedSection('maintenance')}
                    className="w-full p-4 flex items-center justify-between gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <RefreshCw className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                          Audit & Ledger Maintenance
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          Force recalculate passbooks, clear all records to zero, or restore default sample data
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                        Maintenance
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 6. GROUP: Help & User Guides */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                Help & Reference
              </span>
              <div
                onClick={() => setSelectedSection('help_guide')}
                className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-emerald-500/10 border border-indigo-500/20 shadow-xs flex items-center justify-between gap-4 cursor-pointer hover:border-indigo-500/40 hover:scale-[1.005] transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      Help
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      Guides, step-by-step instructions, and FAQs
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs">
                  <span>Open</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* DRILL-DOWN: OPEN THAT PARTICULAR SETTING SCREEN IN FULL   */}
        {/* ========================================================= */}
        {selectedSection !== null && (
          <div ref={sectionContentRef} className="p-4 sm:p-8 overflow-y-auto flex-1 max-w-4xl mx-auto w-full space-y-6 pb-safe pb-28 text-xs sm:text-sm">
            {/* ----------------------------------------------------- */}
            {/* SCREEN: Help                                          */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'help_guide' && (
              <HelpFacilitiesGuide
                onClose={handleClose}
                onNavigateTab={(tab) => {
                  handleClose();
                  setActiveTab(tab);
                }}
                onOpenBackup={() => {
                  handleClose();
                  setIsBackupModalOpen(true);
                }}
                onOpenRecurring={() => {
                  handleClose();
                  setIsRecurringModalOpen(true);
                }}
                onOpenSection={(section) => {
                  setSelectedSection(section);
                }}
                onOpenNetWorth={() => {
                  handleClose();
                  setIsNetWorthModalOpen(true);
                }}
                onOpenLoans={() => {
                  handleClose();
                  setIsLoansModalOpen(true);
                }}
                onOpenDebts={() => {
                  handleClose();
                  setIsDebtsModalOpen(true);
                }}
                onOpenSplitExpenses={() => {
                  handleClose();
                  openSplitExpenses();
                }}
                onOpenAnalysisExport={() => {
                  handleClose();
                  openAnalysisExportModal('all');
                }}
              />
            )}

            {/* ----------------------------------------------------- */}
            {/* SCREEN: User Profile & Identity                       */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'profile' && (
              <div className="space-y-6">
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        User Profile & Identity
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Customize your display name, upload a custom circular profile avatar, and set your account bio.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  {/* Avatar Upload Card */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                          Profile Photo & Avatar
                        </span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Upload directly from your device. Image is cropped circular and saved offline.
                        </p>
                      </div>
                      <Camera className="w-4 h-4 text-slate-400" />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
                      <div className="relative group shrink-0">
                        {profileAvatar ? (
                          <img
                            src={profileAvatar}
                            alt={profileName || 'Profile Photo'}
                            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-emerald-500/30 shadow-md"
                          />
                        ) : (
                          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center shadow-md ring-4 ring-emerald-500/20">
                            {profileName ? profileName.slice(0, 2).toUpperCase() : 'ME'}
                          </div>
                        )}
                        {isProcessingProfilePhoto && (
                          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white text-xs font-semibold">
                            Processing...
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2.5 w-full sm:w-auto">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            ref={profileFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePhotoChange}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => profileFileInputRef.current?.click()}
                            disabled={isProcessingProfilePhoto}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Upload from Device</span>
                          </button>

                          {profileAvatar && (
                            <button
                              type="button"
                              onClick={handleRemoveProfilePhoto}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Recommended: Square image (PNG, JPG, or WebP). Compressed locally to maintain ultra-fast app load times.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Personal Information Inputs */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                      Account Details
                    </span>

                    <div className="space-y-4">
                      {/* Name input */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Display Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="e.g. Alex Morgan"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </div>

                      {/* Tagline / Bio input */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Tagline or Role
                        </label>
                        <input
                          type="text"
                          value={profileTagline}
                          onChange={(e) => setProfileTagline(e.target.value)}
                          placeholder="e.g. Personal Account, Freelancer, Investor"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </div>

                      {/* Email input (optional) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Email Address <span className="text-slate-400 font-normal">(Optional, offline-only)</span>
                        </label>
                        <input
                          type="email"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          placeholder="e.g. user@example.com"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSection(null)}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                    >
                      Back to Settings
                    </button>

                    <button
                      type="submit"
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      <span>Save Profile Changes</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* SCREEN: Personalization & Dashboard Layout            */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'customize' && (
              <div className="space-y-6">
                {/* Header with Quick Switcher to Dedicated Customizer */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-teal-500/10 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30 shrink-0">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Personalization & Customization
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Customize bottom buttons, reorder dashboard widgets, and set transaction defaults
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSaveCustomize}
                      className="text-xs font-bold px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 active:scale-95 cursor-pointer flex items-center gap-1.5 transition-all"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Save Changes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleClose();
                        setIsCustomizeModalOpen(true);
                      }}
                      className="text-xs font-semibold px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-800 bg-white/80 dark:bg-slate-800/80 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800 shadow-2xs cursor-pointer flex items-center gap-1.5 transition-all"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Full Customizer</span>
                    </button>
                  </div>
                </div>

                {/* BOTTOM NAVIGATION BAR (4 SLOTS) CUSTOMIZER */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>Bottom Navigation Buttons (4 Slots)</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Customize your 4 primary quick-access buttons. Swap Investments, Debts, or Split Expenses into any slot!
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetNavTabs}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-purple-600 flex items-center gap-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Reset to default tabs (Home, Accounts, Investments, Analytics)"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Default</span>
                    </button>
                  </div>

                  {/* Quick Presets */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Quick Presets
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyNavPreset(['home', 'accounts', 'investments', 'analytics'])}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/80 hover:border-purple-400 text-left cursor-pointer transition-all hover:shadow-xs group"
                      >
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          Core Finance (Default)
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          Home, Accounts, Investments, Analytics
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyNavPreset(['home', 'accounts', 'split_expenses', 'analytics'])}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/80 hover:border-purple-400 text-left cursor-pointer transition-all hover:shadow-xs group"
                      >
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          Split Bills & Trips
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          Home, Accounts, Split Exp, Analytics
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyNavPreset(['home', 'accounts', 'debts', 'analytics'])}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/80 hover:border-purple-400 text-left cursor-pointer transition-all hover:shadow-xs group"
                      >
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          Debts & Loans Ledger
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          Home, Accounts, Debts, Analytics
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyNavPreset(['home', 'investments', 'accounts', 'analytics'])}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/80 hover:border-purple-400 text-left cursor-pointer transition-all hover:shadow-xs group"
                      >
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          Portfolio & Trader
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          Home, Investments, Accounts, Analytics
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Live Preview */}
                  <div className="p-3.5 bg-slate-100/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2 text-center">
                      Live Bottom Bar Preview
                    </span>
                    <div className="grid grid-cols-5 items-center gap-1 bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-2xs">
                      {(() => {
                        const c = AVAILABLE_NAV_TABS[navTabs[0]] || AVAILABLE_NAV_TABS.home;
                        const Icon = c.icon;
                        return (
                          <div className="flex flex-col items-center justify-center text-center">
                            <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate max-w-[55px]">
                              {c.label}
                            </span>
                          </div>
                        );
                      })()}

                      {(() => {
                        const c = AVAILABLE_NAV_TABS[navTabs[1]] || AVAILABLE_NAV_TABS.accounts;
                        const Icon = c.icon;
                        return (
                          <div className="flex flex-col items-center justify-center text-center">
                            <Icon className="w-4 h-4 text-slate-500" />
                            <span className="text-[9px] font-semibold text-slate-500 mt-0.5 truncate max-w-[55px]">
                              {c.label}
                            </span>
                          </div>
                        );
                      })()}

                      <div className="flex flex-col items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                          +
                        </div>
                        <span className="text-[8px] text-slate-400 uppercase font-medium mt-0.5">
                          Add
                        </span>
                      </div>

                      {(() => {
                        const c = AVAILABLE_NAV_TABS[navTabs[2]] || AVAILABLE_NAV_TABS.investments;
                        const Icon = c.icon;
                        return (
                          <div className="flex flex-col items-center justify-center text-center">
                            <Icon className="w-4 h-4 text-slate-500" />
                            <span className="text-[9px] font-semibold text-slate-500 mt-0.5 truncate max-w-[55px]">
                              {c.label}
                            </span>
                          </div>
                        );
                      })()}

                      {(() => {
                        const c = AVAILABLE_NAV_TABS[navTabs[3]] || AVAILABLE_NAV_TABS.analytics;
                        const Icon = c.icon;
                        return (
                          <div className="flex flex-col items-center justify-center text-center">
                            <Icon className="w-4 h-4 text-slate-500" />
                            <span className="text-[9px] font-semibold text-slate-500 mt-0.5 truncate max-w-[55px]">
                              {c.label}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 4 Slots */}
                  <div className="space-y-2.5">
                    {navTabs.map((tabId, index) => {
                      const currentTabInfo = ALL_POSSIBLE_TABS.find((t) => t.id === tabId) || ALL_POSSIBLE_TABS[0];
                      const Icon = currentTabInfo.icon;

                      const slotLabels = [
                        'Slot 1: Far Left',
                        'Slot 2: Left of Add (+)',
                        'Slot 3: Right of Add (+)',
                        'Slot 4: Far Right',
                      ];

                      return (
                        <div
                          key={`slot-${index}`}
                          className="p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-black flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>

                            <div className="w-8 h-8 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300/60 dark:border-slate-700/60 flex items-center justify-center shrink-0 shadow-2xs">
                              <Icon className="w-4 h-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
                                {slotLabels[index]}
                              </span>

                              <select
                                value={tabId}
                                onChange={(e) => handleNavSlotChange(index, e.target.value as ActiveTab)}
                                className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-purple-500 shadow-2xs"
                              >
                                {ALL_POSSIBLE_TABS.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleNavMoveUp(index)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === navTabs.length - 1}
                              onClick={() => handleNavMoveDown(index)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Default Bank Account & Categories Card */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Default Accounts & Categories for Transactions</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Choose which bank account and categories are pre-selected when creating new transactions.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    {/* Default Bank Account */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                        Default Bank Account
                      </label>
                      <select
                        value={settings.defaultAccountId || ''}
                        onChange={(e) => updateSettings({ defaultAccountId: e.target.value || undefined })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                      >
                        <option value="">First Available Account (Default)</option>
                        {accounts
                          .filter((a) => !a.isArchived)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.type})
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Default Expense Category */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                        Default Expense Category
                      </label>
                      <select
                        value={settings.defaultExpenseCategoryId || ''}
                        onChange={(e) => updateSettings({ defaultExpenseCategoryId: e.target.value || undefined })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                      >
                        <option value="">First Expense Category (Default)</option>
                        {categories
                          .filter((c) => c.type === 'expense')
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Default Income Category */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                        Default Income Category
                      </label>
                      <select
                        value={settings.defaultIncomeCategoryId || ''}
                        onChange={(e) => updateSettings({ defaultIncomeCategoryId: e.target.value || undefined })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                      >
                        <option value="">First Income Category (Default)</option>
                        {categories
                          .filter((c) => c.type === 'income')
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-teal-500/10 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30 shrink-0">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Personalization & Dashboard Layout
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Reorder modules on your home dashboard using the arrows, and toggle visibility on or off.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetLayoutToDefault}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-purple-600 dark:text-purple-400 hover:bg-slate-50 shadow-xs cursor-pointer self-start sm:self-auto"
                  >
                    Reset Layout to Default
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
                  {widgets.map((widget, index) => (
                    <div
                      key={widget.id}
                      className={`p-4 flex items-center justify-between gap-3 transition-colors ${
                        widget.visible ? '' : 'bg-slate-50/50 dark:bg-slate-900/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                          #{index + 1}
                        </div>

                        <div className="min-w-0">
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">
                            {widget.title}
                          </span>
                          <span className="text-xs text-slate-400">
                            {widget.visible ? 'Displayed on Dashboard' : 'Hidden from Dashboard'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleWidget(widget.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            widget.visible
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {widget.visible ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Visible</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Hidden</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveWidgetUp(index)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Move up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={index === widgets.length - 1}
                            onClick={() => handleMoveWidgetDown(index)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Move down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ANALYTICS TAB CARDS CUSTOMIZER */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Analytics Tab Display Cards</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Reorder display cards on your Analytics tab or toggle visibility on/off.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {analyticsCards.map((card, index) => (
                      <div
                        key={card.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          card.visible
                            ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                            : 'bg-slate-100/50 dark:bg-slate-800/40 border-dashed border-slate-200 dark:border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <span className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-black flex items-center justify-center shrink-0">
                            #{index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block whitespace-normal break-words leading-snug">
                              {card.name}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">Order: #{index + 1}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setAnalyticsCards((prev) =>
                                prev.map((c) => (c.id === card.id ? { ...c, visible: !c.visible } : c))
                              );
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                              card.visible
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            {card.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            <span>{card.visible ? 'Visible' : 'Hidden'}</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => {
                                const next = [...analyticsCards];
                                const temp = next[index];
                                next[index] = next[index - 1];
                                next[index - 1] = temp;
                                next.forEach((c, idx) => (c.order = idx + 1));
                                setAnalyticsCards(next);
                              }}
                              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={index === analyticsCards.length - 1}
                              onClick={() => {
                                const next = [...analyticsCards];
                                const temp = next[index];
                                next[index] = next[index + 1];
                                next[index + 1] = temp;
                                next.forEach((c, idx) => (c.order = idx + 1));
                                setAnalyticsCards(next);
                              }}
                              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* INVESTMENTS TAB CARDS CUSTOMIZER */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Investments Tab Display Cards</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Reorder display cards on your Investments tab or toggle visibility on/off.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {investmentCards.map((card, index) => (
                      <div
                        key={card.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          card.visible
                            ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                            : 'bg-slate-100/50 dark:bg-slate-800/40 border-dashed border-slate-200 dark:border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <span className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-black flex items-center justify-center shrink-0">
                            #{index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block whitespace-normal break-words leading-snug">
                              {card.name}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">Order: #{index + 1}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setInvestmentCards((prev) =>
                                prev.map((c) => (c.id === card.id ? { ...c, visible: !c.visible } : c))
                              );
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                              card.visible
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            {card.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            <span>{card.visible ? 'Visible' : 'Hidden'}</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => {
                                const next = [...investmentCards];
                                const temp = next[index];
                                next[index] = next[index - 1];
                                next[index - 1] = temp;
                                next.forEach((c, idx) => (c.order = idx + 1));
                                setInvestmentCards(next);
                              }}
                              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={index === investmentCards.length - 1}
                              onClick={() => {
                                const next = [...investmentCards];
                                const temp = next[index];
                                next[index] = next[index + 1];
                                next[index + 1] = temp;
                                next.forEach((c, idx) => (c.order = idx + 1));
                                setInvestmentCards(next);
                              }}
                              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Customization Action Bar */}
                <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleResetLayoutToDefault}
                    className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
                  >
                    Reset Layout to Default
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustomize}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Save Customization</span>
                  </button>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* SCREEN: Theme & Visual Styling                        */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'theme' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Theme & Visual Appearance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select your preferred contrast and aesthetic theme. Changes are applied instantly across the entire application and saved offline.
                  </p>
                </div>

                {/* 3 Theme Options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Option 1: Dark Mode */}
                  <div
                    onClick={() => setTheme('dark')}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer bg-slate-950 text-white space-y-3 relative overflow-hidden group ${
                      settings.theme === 'dark'
                        ? 'border-emerald-500 ring-4 ring-emerald-500/20 shadow-lg'
                        : 'border-slate-800 opacity-80 hover:opacity-100 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center border border-slate-700">
                        <Moon className="w-5 h-5" />
                      </div>
                      {settings.theme === 'dark' && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Active
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-sm block text-white">Dark Mode</span>
                      <span className="text-[11px] font-semibold text-emerald-400 block mt-0.5">OLED Midnight</span>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Deep midnight palette with gentle typography. Maximizes battery efficiency on OLED & AMOLED mobile screens.
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Light Mode */}
                  <div
                    onClick={() => setTheme('light')}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer bg-white text-slate-900 space-y-3 relative overflow-hidden group ${
                      settings.theme === 'light'
                        ? 'border-emerald-600 ring-4 ring-emerald-500/20 shadow-lg'
                        : 'border-slate-200 opacity-80 hover:opacity-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
                        <Sun className="w-5 h-5" />
                      </div>
                      {settings.theme === 'light' && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Active
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-sm block text-slate-900">Light Mode</span>
                      <span className="text-[11px] font-semibold text-amber-600 block mt-0.5">Daylight Paper</span>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Crisp white paper theme optimized for bright daylight conditions and high clarity outdoor readability.
                      </p>
                    </div>
                  </div>

                  {/* Option 3: System Default */}
                  <div
                    onClick={() => setTheme('system')}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white space-y-3 relative overflow-hidden group ${
                      settings.theme === 'system'
                        ? 'border-emerald-500 ring-4 ring-emerald-500/20 shadow-lg'
                        : 'border-slate-200 dark:border-slate-800 opacity-80 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                        <Laptop className="w-5 h-5" />
                      </div>
                      {settings.theme === 'system' && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Auto
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-sm block">System Auto</span>
                      <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 block mt-0.5">
                        Matches Device OS ({isDark ? 'Dark' : 'Light'})
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Automatically switches between light and dark according to your device's sunrise/sunset or system schedule.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Live Theme Preview Box */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Live Preview ({resolvedTheme === 'dark' ? 'Dark Mode Active' : 'Light Mode Active'})
                    </span>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
                      <span>Quick Switch Mode</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Sample Bank Account</span>
                      <span className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums block mt-1">₹45,280.00</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 inline-block">● Active Asset</span>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">Grocery & Supplies</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">HDFC Bank · 18/10/2026</span>
                      </div>
                      <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">-₹1,450.00</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* SCREEN: Feature Lock & Module Manager                 */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'feature_lock' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-600" />
                      <span>Feature Lock & Module Manager</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Toggle active modules to customize your workspace. Locked modules hide tabs and dashboard cards.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={handleUnlockAllDraftFeatures}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      Unlock All
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFeatureLocks}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Save Features</span>
                    </button>
                  </div>
                </div>

                {/* Modules Grid */}
                <div className="space-y-3">
                  {ALL_APP_FEATURES.map((feature) => {
                    const isUnlocked = draftFeatureLocks[feature.id] ?? true;
                    const FeatureIcon = feature.icon;
                    return (
                      <div
                        key={feature.id}
                        onClick={() => handleToggleDraftFeature(feature.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 group ${
                          isUnlocked
                            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50'
                            : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-75'
                        }`}
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isUnlocked ? feature.colorClass : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            <FeatureIcon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {feature.name}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isUnlocked
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                                }`}
                              >
                                {isUnlocked ? 'Unlocked' : 'Locked'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                              {feature.description}
                            </p>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1">
                              {feature.hides}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <span
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                              isUnlocked
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isUnlocked ? (
                              <>
                                <Unlock className="w-3.5 h-3.5" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>Locked</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Save Button */}
                <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleUnlockAllDraftFeatures}
                    className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
                  >
                    Unlock All Modules
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFeatureLocks}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Save Feature Configuration</span>
                  </button>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* ----------------------------------------------------- */}
            {/* SCREEN: Security, App Lock & Biometrics               */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'security' && (
              <div className="space-y-6">
                {/* ----------------------------------------------------- */}
                {/* 1. STARTUP APP LOCK & BIOMETRIC VAULT (FEATURED TOP)  */}
                {/* ----------------------------------------------------- */}
                <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-slate-900/10 border-2 border-emerald-500/30 dark:border-emerald-500/25 space-y-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md transition-all ${
                        settings.isAppLockEnabled
                          ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-600/30 ring-4 ring-emerald-500/20'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                        <Fingerprint className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                            Startup App Lock & Biometric Vault
                          </h3>
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            settings.isAppLockEnabled
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                          }`}>
                            {settings.isAppLockEnabled ? 'Active (Secured)' : 'Off (Open Access)'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          Requires authentication every time this app opens. Works on mobile & desktop web via Touch ID, Face ID, Windows Hello, and offline 4-digit PIN.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setAppLockConfig(!settings.isAppLockEnabled)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 ${
                          settings.isAppLockEnabled
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/50'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                        }`}
                      >
                        {settings.isAppLockEnabled ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Disable Lock</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Enable App Lock</span>
                          </>
                        )}
                      </button>

                      {settings.isAppLockEnabled && (
                        <button
                          type="button"
                          onClick={() => {
                            handleClose();
                            lockApp();
                          }}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                          title="Immediately test the App Lock screen"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Lock Now (Test)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {settings.isAppLockEnabled ? (
                    <div className="pt-4 border-t border-emerald-500/20 dark:border-slate-800 space-y-4 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {/* PIN Configuration Card */}
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                4-Digit Security PIN
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60">
                                {isSettingNewPin
                                  ? 'Configuring'
                                  : showPinPlaintext
                                    ? `PIN: ${settings.appLockPin || '1234'}`
                                    : 'PIN: • • • •'}
                              </span>
                              {!isSettingNewPin && (
                                <button
                                  type="button"
                                  onClick={() => setShowPinPlaintext((prev) => !prev)}
                                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                  title={showPinPlaintext ? 'Hide PIN' : 'Reveal PIN'}
                                >
                                  {showPinPlaintext ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>

                          {isSettingNewPin ? (
                            <div className="space-y-3 pt-1">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                                    New 4-Digit PIN
                                  </label>
                                  <div className="relative">
                                    <input
                                      type={showNewPinInput ? 'text' : 'password'}
                                      maxLength={4}
                                      value={newPinInput}
                                      onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                      placeholder="••••"
                                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-emerald-500 rounded-xl text-sm font-mono font-bold text-center tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                                    Confirm PIN
                                  </label>
                                  <div className="relative">
                                    <input
                                      type={showNewPinInput ? 'text' : 'password'}
                                      maxLength={4}
                                      value={pinConfirmInput}
                                      onChange={(e) => setPinConfirmInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                      placeholder="••••"
                                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-emerald-500 rounded-xl text-sm font-mono font-bold text-center tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => setShowNewPinInput((prev) => !prev)}
                                  className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                                >
                                  {showNewPinInput ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  <span>{showNewPinInput ? 'Hide Digits' : 'Show Digits'}</span>
                                </button>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsSettingNewPin(false);
                                      setNewPinInput('');
                                      setPinConfirmInput('');
                                    }}
                                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (newPinInput.length !== 4) {
                                        showToast('PIN must be exactly 4 digits', 'error');
                                        return;
                                      }
                                      if (newPinInput !== pinConfirmInput) {
                                        showToast('PINs do not match. Please re-enter.', 'error');
                                        return;
                                      }
                                      setAppLockConfig(true, newPinInput, settings.useBiometricsIfAvailable ?? true);
                                      setIsSettingNewPin(false);
                                      setNewPinInput('');
                                      setPinConfirmInput('');
                                      showToast('Security PIN updated successfully', 'success');
                                    }}
                                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-xs"
                                  >
                                    Save PIN
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between pt-1">
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Protected by your private 4-digit code.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewPinInput('');
                                  setPinConfirmInput('');
                                  setIsSettingNewPin(true);
                                }}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer transition-colors"
                              >
                                Change PIN
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Hardware Biometrics (Touch ID / Face ID) */}
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Fingerprint className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                Device Biometrics
                              </span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              bioStatus.enrolled
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {bioStatus.enrolled ? 'Enrolled' : 'Ready to Enroll'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Uses your phone's native fingerprint or face sensor (Android Biometrics / Touch ID) with 4-digit PIN fallback.
                          </p>
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Hardware Authenticator</span>
                            </div>
                            <button
                              type="button"
                              disabled={isTestingBio}
                              onClick={async () => {
                                setIsTestingBio(true);
                                try {
                                  if (bioStatus.enrolled) {
                                    const res = await authenticateDeviceBiometrics();
                                    if (res.success) {
                                      showToast('Fingerprint sensor verified successfully!', 'success');
                                    } else {
                                      showToast(res.error || 'Biometric test cancelled', 'error');
                                    }
                                  } else {
                                    const res = await enrollDeviceBiometrics();
                                    if (res.success) {
                                      setBioStatus(getBiometricStatus());
                                      showToast('Fingerprint registered for FinSync!', 'success');
                                    } else {
                                      showToast(res.error || 'Biometric enrollment cancelled', 'error');
                                    }
                                  }
                                } catch (e: any) {
                                  showToast(e.message || 'Biometric operation failed', 'error');
                                } finally {
                                  setIsTestingBio(false);
                                  setBioStatus(getBiometricStatus());
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer transition-colors"
                            >
                              {isTestingBio
                                ? 'Scanning...'
                                : bioStatus.enrolled
                                  ? 'Test Fingerprint'
                                  : 'Register Fingerprint'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-slate-400" />
                        <span>Startup lock is currently off. Anyone opening this app can view balances directly.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAppLockConfig(true, '1234', true)}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 cursor-pointer"
                      >
                        Enable App Lock
                      </button>
                    </div>
                  )}
                </div>

                {/* ----------------------------------------------------- */}
                {/* 2. BANK ACCOUNT SETTINGS LINK                         */}
                {/* ----------------------------------------------------- */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Bank Account Settings & Card Protection
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Manage passbook credentials, edit credit limits, and adjust balances for {bankAndCreditAccounts.length} protected accounts.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedSection('bank_accounts')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0 self-start sm:self-auto"
                  >
                    <span>Manage Bank Accounts</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* ----------------------------------------------------- */}
                {/* Android Local Security & Obfuscation Architecture     */}
                {/* ----------------------------------------------------- */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 space-y-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <h4 className="text-sm font-bold text-white">
                        Android Local Security Architecture
                      </h4>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Offline-First Hardened
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Production security implementations active for both Android release builds and this offline web environment:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Security Layer 1: SQLCipher & KeyStore */}
                    <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-xs font-bold text-white">1. SQLCipher Room Encryption</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Room database is encrypted with 256-bit AES-GCM via SQLCipher. Key generated and stored in hardware-backed <strong>Android KeyStore</strong>. Zero unencrypted SQLite data on disk.
                      </p>
                    </div>

                    {/* Security Layer 2: R8 / ProGuard */}
                    <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                        <span className="text-xs font-bold text-white">2. Strict R8/ProGuard Obfuscation</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Class repackaging (<code>-repackageclasses</code>), resource shrinking, and stripping of all <code>android.util.Log</code> statements in release builds to prevent reverse engineering.
                      </p>
                    </div>

                    {/* Security Layer 3: APK Signature Verification */}
                    <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="text-xs font-bold text-white">3. Local APK Signature Verification</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Automated launch check in <code>FinSyncApp.kt</code> verifies release certificate SHA-256 fingerprint. Detects repackaging, cracking, and injected code.
                      </p>
                    </div>

                    {/* Security Layer 4: Biometric / PIN Lock */}
                    <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Fingerprint className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs font-bold text-white">4. BiometricPrompt / Device PIN</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Optional startup lock prompt supporting biometric fingerprint / face unlock and device credentials. Users can freely enable or disable it anytime.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* SCREEN: Bank Account Settings                         */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'bank_accounts' && (
              <div className="space-y-6">
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Bank Account Settings & Card Limits
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Protected Zone: To prevent accidental disruption to transaction history, critical Bank Accounts and Credit Cards can be configured, edited, or deleted safely here.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEditingAccount(null);
                      setIsAccountModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all shrink-0 cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Bank / Card</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {bankAndCreditAccounts.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                      <p className="text-xs font-semibold">No bank accounts or credit cards registered yet.</p>
                    </div>
                  ) : (
                    bankAndCreditAccounts.map((account) => {
                      const isCredit = account.type === 'credit';
                      return (
                        <div
                          key={account.id}
                          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-500/40 transition-all"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <AccountAvatar account={account} size="md" className="rounded-xl shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {account.name}
                                </h4>
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                    isCredit
                                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                      : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                                  }`}
                                >
                                  {isCredit ? 'Credit Card' : 'Bank Account'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                {account.accountNumber ? (
                                  <span className="font-mono">Account •••• {account.accountNumber}</span>
                                ) : (
                                  <span>Standard Account</span>
                                )}
                                <span>·</span>
                                <span>
                                  Balance:{' '}
                                  <strong className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                                    {formatINR(account.balance)}
                                  </strong>
                                </span>
                                {isCredit && account.creditLimit && (
                                  <>
                                    <span>·</span>
                                    <span>
                                      Limit:{' '}
                                      <strong className="text-slate-700 dark:text-slate-300 tabular-nums">
                                        {formatINR(account.creditLimit)}
                                      </strong>
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAccount(account);
                                setIsAccountModalOpen(true);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                              title="Edit account credentials"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (accounts.length <= 1) {
                                  showToast('Cannot delete the only remaining account.', 'error');
                                  return;
                                }
                                setAccountToDelete(account);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                              title="Delete account with safety check"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>
                    Passbook balance integrity is protected. Modifying initial balances or deleting accounts preserves historical ledger integrity via automatic recalculation.
                  </p>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* SCREEN: Net Liquid Wealth Selectors                   */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'liquid_wealth' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Net Liquid Wealth Selectors
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Select which accounts contribute to your liquid wealth summary. Tap any account to toggle its inclusion, then tap Save Changes.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveLiquidWealth}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Save Changes</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
                  {accounts.map((acc) => {
                    const isIncluded = draftLiquidAccounts[acc.id] ?? (acc.includeInNetLiquid ?? true);
                    return (
                      <div
                        key={acc.id}
                        onClick={() => handleToggleDraftLiquidAccount(acc.id)}
                        className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <AccountAvatar account={acc} size="md" className="rounded-xl shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white block text-sm truncate">
                              {acc.name}
                            </span>
                            <span className="text-xs text-slate-400 capitalize">
                              {acc.type} · Balance:{' '}
                              <strong className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                                {formatINR(acc.balance)}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                              isIncluded
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {isIncluded ? (
                              <>
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Included</span>
                              </>
                            ) : (
                              <span>Excluded</span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Save Action Bar */}
                <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleSaveLiquidWealth}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Save Liquid Wealth Accounts</span>
                  </button>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* SCREEN: Backup and Restore                            */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'data' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Backup and Restore
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Military-grade AES-256-GCM encrypted files, Google Drive cloud integration, and automatic scheduled snapshots.
                  </p>
                </div>

                {/* Primary Encrypted Backup & Google Drive Control Card */}
                <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/25 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 shrink-0">
                        <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                          Universal Backup & Cloud Hub
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Universal cross-version recovery active. Restores encrypted backups (.finsync.enc, .expmgr.enc) across versions, as well as JSON backups (.json, .bk) and Google Drive snapshots.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsBackupModalOpen(true)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer shrink-0 flex items-center justify-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Open Backup and Restore Tool</span>
                    </button>
                  </div>

                  {/* Summary Status Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-emerald-500/15">
                    <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Encryption Standard
                      </span>
                      <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 font-mono mt-0.5 block">
                        AES-256-GCM (100k PBKDF2)
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Google Drive Status
                      </span>
                      <span className={`text-xs font-bold mt-0.5 block truncate ${isGoogleDriveConnected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                        {isGoogleDriveConnected ? (googleUser?.email || 'Connected') : 'Not Connected'}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Automated Backups
                      </span>
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-0.5 block capitalize">
                        {settings.autoBackupSchedule || 'Daily'} (Local & Drive)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Strict Passbook CSV */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Strict Passbook CSV Engine</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Export and import complete passbook records with chronological balance recalculation.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={exportCSV}
                      className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export Strict CSV</span>
                    </button>

                    <label className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-xs transition-colors cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>Import Strict CSV (Auto-Sync)</span>
                      <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleCSVSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Comprehensive Financial & Investment Analysis Dossier */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Executive Analysis & Investment Portfolio Audit</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Generate comprehensive summary dossiers with Net Worth, Cash Flows, Categories, Asset Allocation, and P&L tables.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openAnalysisExportModal('all')}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export Analysis Dossier</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Supported Formats:</span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-medium">Print / Save as PDF</span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-medium">CSV Workbook</span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-medium">Markdown</span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-medium">HTML Dossier</span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-medium">JSON Audit</span>
                  </div>
                </div>

                {/* 30-Day Recycle Bin Feature Card */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>Recycle Bin (30-Day Auto Retention)</span>
                          {bin.length > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                              {bin.length} {bin.length === 1 ? 'item' : 'items'}
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Review deleted transactions, trades, bank accounts, holdings & debts. Restores them back to active state or permanently purges them.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedSection('bin')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Open Bin ({bin.length})</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* SCREEN: Recycle Bin (30-Day Auto Retention)           */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'bin' && (
              <div className="space-y-4">
                <BinView onClose={() => setSelectedSection(null)} />
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* SCREEN: Investment CSV Engine                         */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'investment_csv' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Investment CSV Engine (Stocks & Mutual Funds)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Import broker trade books (Zerodha, Groww, AngelOne) with automated bank transfers and CMP derivation.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-sm block">
                        Broker CSV Import Manager
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Select a funding bank account and upload your trade statement.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsInvestmentCSVModalOpen(true)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all shrink-0 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Open Investment CSV Importer</span>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => exportStocksCSVData()}
                      className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-blue-500" />
                      <span>Export Stocks CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => exportMutualFundsCSVData()}
                      className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-emerald-500" />
                      <span>Export Mutual Funds CSV</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* SCREEN: Currency, Regional & Automation               */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'regional' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Currency, Date & Automation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Configured for Indian Rupee notation (₹ Lakhs & Crores) and standard DD/MM/YYYY formatting.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-sm">
                        Currency Notation
                      </span>
                      <span className="text-xs text-slate-400">
                        Indian Rupee (₹) grouped by Thousands, Lakhs, and Crores
                      </span>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold font-mono shrink-0">
                      ₹ INR (Standard)
                    </span>
                  </div>

                  <div className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-sm">
                        Date Format
                      </span>
                      <span className="text-xs text-slate-400">
                        Indian Standard Day/Month/Year chronological notation
                      </span>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold font-mono shrink-0">
                      DD/MM/YYYY
                    </span>
                  </div>

                  <div
                    onClick={() => {
                      updateSettings({ autoProcessRecurring: !settings.autoProcessRecurring });
                      showToast(
                        settings.autoProcessRecurring
                          ? 'Automatic recurring execution disabled'
                          : 'Automatic recurring execution enabled',
                        'info'
                      );
                    }}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-sm">
                        Auto-Process Due Recurring Transactions
                      </span>
                      <span className="text-xs text-slate-400">
                        Automatically post scheduled SIPs and monthly bills when due date arrives
                      </span>
                    </div>
                    <span
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 ${
                        settings.autoProcessRecurring
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {settings.autoProcessRecurring ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Enabled</span>
                        </>
                      ) : (
                        <span>Disabled</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* SCREEN: Audit & Ledger Maintenance                    */}
            {/* ----------------------------------------------------- */}
            {selectedSection === 'maintenance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Audit & Ledger Maintenance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Recompute passbook balances from transactions, or safely clear/reset application data.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Force Recalculate */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white block text-sm">
                        Recalculate Balances & Purge Abandoned Transactions
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Recomputes every account, holding, debt & loan balance from source while detecting and purging abandoned transactions from deleted loans, holdings, or accounts.
                      </span>
                    </div>
                    <button
                      onClick={recalculateAllBalances}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Recalculate Balances</span>
                    </button>
                  </div>

                  {/* Reset to Zero */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                    <div>
                      <span className="font-semibold text-amber-900 dark:text-amber-200 block text-sm flex items-center gap-1.5">
                        <Trash2 className="w-4 h-4 text-amber-600" />
                        <span>Reset App to Zero (Clear All Records)</span>
                      </span>
                      <span className="text-xs text-amber-700/80 dark:text-amber-300/70">
                        Clears all transactions, holdings, and debts. Sets balances to ₹0 for a fresh start.
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setResetConfirmType('zero');
                        setConfirmInput('');
                      }}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 transition-colors shrink-0 shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset to Zero</span>
                    </button>
                  </div>

                  {/* Reset to Initial Sample Data */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                    <div>
                      <span className="font-semibold text-rose-900 dark:text-rose-200 block text-sm flex items-center gap-1.5">
                        <RotateCcw className="w-4 h-4 text-rose-600" />
                        <span>Reset to Initial Sample Data</span>
                      </span>
                      <span className="text-xs text-rose-700/80 dark:text-rose-300/70">
                        Re-populates realistic Indian accounts (HDFC, ICICI Credit Card, Demat) and sample holdings.
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setResetConfirmType('sample');
                        setConfirmInput('');
                      }}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-colors shrink-0 shadow-xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset to Sample</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AccountModal for Bank & Credit Card Creation/Editing */}
      <AccountModal
        isOpen={isAccountModalOpen}
        initialAccount={editingAccount}
        onClose={() => {
          setIsAccountModalOpen(false);
          setEditingAccount(null);
        }}
      />

      {/* Safe Account Deletion Confirmation Dialog */}
      {accountToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete "{accountToDelete.name}"?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                This is a critical bank account with a current balance of <strong className="text-slate-700 dark:text-slate-300">{formatINR(accountToDelete.balance)}</strong>. Deleting it will remove linked passbook transactions.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteAccount(accountToDelete.id);
                  setAccountToDelete(null);
                }}
                className="py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Yes, Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Confirmation Dialog for App Resets */}
      {resetConfirmType && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {resetConfirmType === 'zero'
                  ? 'Confirm Reset App to Zero?'
                  : 'Confirm Reset to Sample Data?'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {resetConfirmType === 'zero'
                  ? 'This action will clear all transactions, investment ledgers, and debts. All account balances will be set to ₹0. This cannot be undone.'
                  : 'This action will replace all current data with the default Indian seed accounts and demo transactions.'}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl text-xs space-y-1.5">
              <span className="text-slate-500 dark:text-slate-400 block font-medium">
                Type <strong className="text-rose-600 dark:text-rose-400 font-mono">RESET</strong> to proceed safely:
              </span>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="RESET"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-center uppercase tracking-widest text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setResetConfirmType(null);
                  setConfirmInput('');
                }}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmInput.trim().toUpperCase() !== 'RESET'}
                onClick={handleConfirmReset}
                className="py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-rose-600/20 transition-all"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
