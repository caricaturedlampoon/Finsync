import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DashboardWidgetConfig, DashboardWidgetId, ActiveTab } from '../../types';
import { AVAILABLE_NAV_TABS, DEFAULT_NAVIGATION_TABS } from '../layout/BottomNav';
import {
  X,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Eye,
  EyeOff,
  Sliders,
  Navigation,
  RotateCcw,
  LayoutDashboard,
  PieChart,
  Landmark,
  TrendingUp,
  Coins,
  Users,
  CheckCircle2,
} from 'lucide-react';

const ALL_POSSIBLE_TABS: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'home', label: 'Home Dashboard', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics', icon: PieChart },
  { id: 'accounts', label: 'Bank Accounts', icon: Landmark },
  { id: 'investments', label: 'Investments', icon: TrendingUp },
  { id: 'debts', label: 'Debts & Loans', icon: Coins },
  { id: 'split_expenses', label: 'Split Expenses', icon: Users },
];

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

export const CustomizeAppModal: React.FC = () => {
  const {
    isCustomizeModalOpen,
    setIsCustomizeModalOpen,
    settings,
    updateSettings,
    accounts,
    categories,
    showToast,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'navigation' | 'widgets' | 'analytics' | 'investments' | 'defaults'>('navigation');

  const [navTabs, setNavTabs] = useState<ActiveTab[]>(() => {
    return settings.navigationTabs && settings.navigationTabs.length === 4
      ? [...settings.navigationTabs]
      : [...DEFAULT_NAVIGATION_TABS];
  });

  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(() => {
    return [...(settings.dashboardWidgets || [])].sort((a, b) => a.order - b.order);
  });

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

  const [defaultAccountId, setDefaultAccountId] = useState<string>(settings.defaultAccountId || '');
  const [defaultExpenseCategoryId, setDefaultExpenseCategoryId] = useState<string>(
    settings.defaultExpenseCategoryId || ''
  );
  const [defaultIncomeCategoryId, setDefaultIncomeCategoryId] = useState<string>(
    settings.defaultIncomeCategoryId || ''
  );
  const [verifiedBadgeColor, setVerifiedBadgeColor] = useState<'blue' | 'green'>(
    settings.verifiedBadgeColor || 'blue'
  );

  useEffect(() => {
    if (isCustomizeModalOpen) {
      if (settings.navigationTabs && settings.navigationTabs.length === 4) {
        setNavTabs([...settings.navigationTabs]);
      } else {
        setNavTabs([...DEFAULT_NAVIGATION_TABS]);
      }
      if (settings.dashboardWidgets) {
        setWidgets([...settings.dashboardWidgets].sort((a, b) => a.order - b.order));
      }
      if (settings.analyticsCards && settings.analyticsCards.length > 0) {
        setAnalyticsCards([...settings.analyticsCards].sort((a, b) => a.order - b.order));
      } else {
        setAnalyticsCards([...DEFAULT_ANALYTICS_CARDS]);
      }
      if (settings.investmentCards && settings.investmentCards.length > 0) {
        setInvestmentCards([...settings.investmentCards].sort((a, b) => a.order - b.order));
      } else {
        setInvestmentCards([...DEFAULT_INVESTMENT_CARDS]);
      }
      setDefaultAccountId(settings.defaultAccountId || '');
      setDefaultExpenseCategoryId(settings.defaultExpenseCategoryId || '');
      setDefaultIncomeCategoryId(settings.defaultIncomeCategoryId || '');
      setVerifiedBadgeColor(settings.verifiedBadgeColor || 'blue');
    }
  }, [isCustomizeModalOpen, settings]);

  if (!isCustomizeModalOpen) return null;

  const handleClose = () => {
    setIsCustomizeModalOpen(false);
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

  const handleNavSlotChange = (slotIndex: number, newTabId: ActiveTab) => {
    const next = [...navTabs];
    const existingIndex = next.indexOf(newTabId);
    if (existingIndex !== -1 && existingIndex !== slotIndex) {
      next[existingIndex] = next[slotIndex];
    }
    next[slotIndex] = newTabId;
    setNavTabs(next);
  };

  const handleResetNavToDefault = () => {
    setNavTabs([...DEFAULT_NAVIGATION_TABS]);
    showToast('Reset navigation tabs to default', 'info');
  };

  const handleToggleVisibility = (id: DashboardWidgetId) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newWidgets = [...widgets];
    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[index - 1];
    newWidgets[index - 1] = temp;
    newWidgets.forEach((w, idx) => {
      w.order = idx + 1;
    });
    setWidgets(newWidgets);
  };

  const handleMoveDown = (index: number) => {
    if (index === widgets.length - 1) return;
    const newWidgets = [...widgets];
    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[index + 1];
    newWidgets[index + 1] = temp;
    newWidgets.forEach((w, idx) => {
      w.order = idx + 1;
    });
    setWidgets(newWidgets);
  };

  const handleToggleCardVisible = (list: any[], setList: (items: any[]) => void, id: string) => {
    setList(list.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item)));
  };

  const handleCardMoveUp = (list: any[], setList: (items: any[]) => void, index: number) => {
    if (index === 0) return;
    const next = [...list];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    next.forEach((item, idx) => (item.order = idx + 1));
    setList(next);
  };

  const handleCardMoveDown = (list: any[], setList: (items: any[]) => void, index: number) => {
    if (index === list.length - 1) return;
    const next = [...list];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    next.forEach((item, idx) => (item.order = idx + 1));
    setList(next);
  };

  const handleSave = () => {
    updateSettings({
      navigationTabs: navTabs,
      dashboardWidgets: widgets,
      analyticsCards,
      investmentCards,
      defaultAccountId: defaultAccountId || undefined,
      defaultExpenseCategoryId: defaultExpenseCategoryId || undefined,
      defaultIncomeCategoryId: defaultIncomeCategoryId || undefined,
      verifiedBadgeColor,
    });
    showToast('Preferences saved successfully', 'success');
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-slate-900 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-150">
      <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col h-full overflow-hidden">
        {/* Fullscreen Sticky Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0 pt-safe">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Customize Preferences
              </h2>
              <p className="text-xs text-slate-400">Navigation tabs, dashboard widgets & defaults</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 sm:px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save Preferences</span>
            </button>
            <button onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('navigation')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'navigation'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Tab Bar Navigation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('widgets')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'widgets'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Dashboard Layout
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('analytics')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'analytics'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Analytics Cards
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('investments')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'investments'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Investment Cards
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('defaults')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'defaults'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Defaults
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 pb-safe pb-24">
          {/* SUBTAB 1: NAVIGATION TABS CUSTOMIZATION (FEATURE 2) */}
          {activeSubTab === 'navigation' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Bottom Navigation Bar (4 Slots)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Customize your 4 primary quick-access buttons. Swap Investments, Debts, or Split Expenses into any slot!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetNavToDefault}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-purple-600 flex items-center gap-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Reset to default tabs (Home, Accounts, Investments, Analytics)"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Default</span>
                </button>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Quick Presets
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNavTabs(['home', 'accounts', 'investments', 'analytics'])}
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
                    onClick={() => setNavTabs(['home', 'accounts', 'split_expenses', 'analytics'])}
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
                    onClick={() => setNavTabs(['home', 'accounts', 'debts', 'analytics'])}
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
                    onClick={() => setNavTabs(['home', 'investments', 'accounts', 'analytics'])}
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
          )}

          {/* SUBTAB 2: DASHBOARD LAYOUT */}
          {activeSubTab === 'widgets' && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Reorder modules on your home dashboard using the arrows, and toggle visibility on or off.
              </p>
              {widgets.map((widget, index) => (
                <div
                  key={widget.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    widget.visible
                      ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      : 'bg-slate-100/50 dark:bg-slate-800/40 border-dashed border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(widget.id)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                        widget.visible
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-400 hover:bg-slate-300'
                      }`}
                      title={widget.visible ? 'Hide from Dashboard' : 'Show on Dashboard'}
                    >
                      {widget.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block truncate">
                        {widget.title}
                      </span>
                      <span className="text-[10px] text-slate-400">Order: #{widget.order}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveUp(index)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === widgets.length - 1}
                      onClick={() => handleMoveDown(index)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUBTAB 3: ANALYTICS CARDS */}
          {activeSubTab === 'analytics' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Reorder display cards on your Analytics tab using the arrows, and toggle visibility on or off.
              </p>
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
                    <button
                      type="button"
                      onClick={() => handleToggleCardVisible(analyticsCards, setAnalyticsCards, card.id)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                        card.visible
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-400 hover:bg-slate-300'
                      }`}
                      title={card.visible ? 'Hide from Analytics Tab' : 'Show on Analytics Tab'}
                    >
                      {card.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
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
                      disabled={index === 0}
                      onClick={() => handleCardMoveUp(analyticsCards, setAnalyticsCards, index)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === analyticsCards.length - 1}
                      onClick={() => handleCardMoveDown(analyticsCards, setAnalyticsCards, index)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUBTAB 4: INVESTMENT CARDS */}
          {activeSubTab === 'investments' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Reorder display cards on your Investments tab using the arrows, and toggle visibility on or off.
              </p>
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
                    <button
                      type="button"
                      onClick={() => handleToggleCardVisible(investmentCards, setInvestmentCards, card.id)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                        card.visible
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-400 hover:bg-slate-300'
                      }`}
                      title={card.visible ? 'Hide from Investments Tab' : 'Show on Investments Tab'}
                    >
                      {card.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
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
                      disabled={index === 0}
                      onClick={() => handleCardMoveUp(investmentCards, setInvestmentCards, index)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === investmentCards.length - 1}
                      onClick={() => handleCardMoveDown(investmentCards, setInvestmentCards, index)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUBTAB 5: DEFAULT ACCOUNT & CATEGORIES */}
          {activeSubTab === 'defaults' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose default preselected account and categories for the transaction modal.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Payment Account
                </label>
                <select
                  value={defaultAccountId}
                  onChange={(e) => setDefaultAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">First Available Account (Default)</option>
                  {accounts
                    .filter((a) => !a.isArchived && !a.isSystemDebtAccount)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type.toUpperCase()})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Expense Category
                </label>
                <select
                  value={defaultExpenseCategoryId}
                  onChange={(e) => setDefaultExpenseCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">First Available Expense Category</option>
                  {categories
                    .filter((c) => c.type === 'expense')
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Income Category
                </label>
                <select
                  value={defaultIncomeCategoryId}
                  onChange={(e) => setDefaultIncomeCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">First Available Income Category</option>
                  {categories
                    .filter((c) => c.type === 'income')
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Fund Verified Badge Tick Color Preference */}
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fund Verified Badge Tick Color
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
                  Choose between Blue Tick or Green Tick for verified funds beside fund names in individual lists.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVerifiedBadgeColor('blue')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                      verifiedBadgeColor === 'blue'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/30'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Blue Tick</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerifiedBadgeColor('green')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                      verifiedBadgeColor === 'green'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/30'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Green Tick</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Save Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
};
