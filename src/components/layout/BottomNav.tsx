import React from 'react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { ActiveTab } from '../../types';
import {
  LayoutDashboard,
  PieChart,
  Landmark,
  TrendingUp,
  Coins,
  Users,
  Plus,
} from 'lucide-react';

export interface TabConfig {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const AVAILABLE_NAV_TABS: Record<ActiveTab, TabConfig> = {
  home: {
    id: 'home',
    label: 'Home',
    icon: LayoutDashboard,
  },
  analytics: {
    id: 'analytics',
    label: 'Analytics',
    icon: PieChart,
  },
  accounts: {
    id: 'accounts',
    label: 'Accounts',
    icon: Landmark,
  },
  investments: {
    id: 'investments',
    label: 'Investments',
    icon: TrendingUp,
  },
  debts: {
    id: 'debts',
    label: 'Debts',
    icon: Coins,
  },
  split_expenses: {
    id: 'split_expenses',
    label: 'Split Exp',
    icon: Users,
  },
};

export const DEFAULT_NAVIGATION_TABS: ActiveTab[] = ['home', 'accounts', 'investments', 'analytics'];

export const BottomNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setSelectedAccountId,
    setSelectedHoldingId,
    setDrilldownCategory,
    setSelectedDebtId,
    setSelectedGroupId,
    setIsTransactionModalOpen,
    settings,
    isFeatureUnlocked,
    selectedAccountId,
    selectedHoldingId,
    drilldownCategory,
    selectedDebtId,
    selectedGroupId,
  } = useApp();

  const isSecondScreen = (() => {
    if (activeTab === 'accounts' && selectedAccountId !== null) return true;
    if (activeTab === 'investments' && selectedHoldingId !== null) return true;
    if (activeTab === 'analytics' && drilldownCategory !== null) return true;
    if (activeTab === 'debts' && selectedDebtId !== null) return true;
    if (activeTab === 'split_expenses' && selectedGroupId !== null) return true;
    return false;
  })();

  if (isSecondScreen) {
    return null;
  }

  const isTabUnlocked = (tabKey: ActiveTab): boolean => {
    if (tabKey === 'home') return true;
    if (tabKey === 'analytics') return isFeatureUnlocked('analytics');
    if (tabKey === 'accounts') return isFeatureUnlocked('accounts');
    if (tabKey === 'investments') return isFeatureUnlocked('investments');
    if (tabKey === 'debts') return isFeatureUnlocked('debts');
    if (tabKey === 'split_expenses') return isFeatureUnlocked('split_expenses');
    return true;
  };

  const isAddUnlocked = isFeatureUnlocked('expense_entry');

  // Candidate tabs in user priority order
  const baseTabs: ActiveTab[] =
    settings.navigationTabs &&
    Array.isArray(settings.navigationTabs) &&
    settings.navigationTabs.length === 4 &&
    settings.navigationTabs.every((tab) => Boolean(AVAILABLE_NAV_TABS[tab]))
      ? settings.navigationTabs
      : DEFAULT_NAVIGATION_TABS;

  // Filter out locked tabs
  const candidateTabs: ActiveTab[] = [
    'home',
    'accounts',
    'investments',
    'analytics',
    'debts',
    'split_expenses',
  ];
  const unlockedCandidates: ActiveTab[] = candidateTabs.filter(isTabUnlocked);

  let navTabs: ActiveTab[] = baseTabs.filter(isTabUnlocked);

  // If filtered tabs are fewer than 4, fill with other unlocked tabs
  for (const candidate of unlockedCandidates) {
    if (navTabs.length >= 4) break;
    if (!navTabs.includes(candidate)) {
      navTabs.push(candidate);
    }
  }

  // Ensure active tab is included in nav tabs if unlocked
  if (isTabUnlocked(activeTab) && !navTabs.includes(activeTab)) {
    if (navTabs.length >= 3) {
      navTabs[2] = activeTab;
    } else {
      navTabs.push(activeTab);
    }
  }

  // Fallback to at least home if all else is locked
  if (navTabs.length === 0) {
    navTabs = ['home'];
  }

  const handleTabClick = (tab: ActiveTab) => {
    if (tab === 'accounts' && activeTab === 'accounts') {
      setSelectedAccountId(null);
    }
    if (tab === 'investments' && activeTab === 'investments') {
      setSelectedHoldingId(null);
    }
    if (tab === 'analytics' && activeTab === 'analytics') {
      setDrilldownCategory(null);
    }
    if (tab === 'debts' && activeTab === 'debts') {
      setSelectedDebtId(null);
    }
    if (tab === 'split_expenses' && activeTab === 'split_expenses') {
      setSelectedGroupId(null);
    }
    if (tab === activeTab) {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } else {
      setActiveTab(tab);
    }
  };

  const renderTabButton = (tabKey: ActiveTab) => {
    const config = AVAILABLE_NAV_TABS[tabKey] || AVAILABLE_NAV_TABS.home;
    const Icon = config.icon;
    const isActive = activeTab === config.id;

    return (
      <button
        key={config.id}
        onClick={() => handleTabClick(config.id)}
        className={`relative flex flex-col items-center justify-center h-full min-w-[44px] min-h-[44px] transition-colors cursor-pointer ${
          isActive
            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
        aria-label={config.label}
      >
        <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`} />
        <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[62px]">
          {config.label}
        </span>
        {isActive && (
          <motion.div
            layoutId="activeTabIndicator"
            className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-0.5"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.3)] transition-colors keyboard-hide">
      <div className="max-w-lg mx-auto px-3 sm:px-6 relative">
        {/* Floating Action Button (+) centered - ONLY shown when Expense/Income Entry feature is UNLOCKED */}
        {isAddUnlocked && (
          <div className="absolute left-1/2 -top-5 -translate-x-1/2 z-50">
            <button
              onClick={() => setIsTransactionModalOpen(true)}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center transition-all focus:outline-none focus:ring-4 focus:ring-emerald-500/20 cursor-pointer"
              aria-label="Add transaction (Expense, Income, or Transfer)"
              title="Record New Transaction"
            >
              <Plus className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
            </button>
          </div>
        )}

        {/* Bottom Tab Items Layout */}
        {isAddUnlocked && navTabs.length >= 4 ? (
          <div className="grid grid-cols-5 items-center h-16">
            <div className="col-span-1">{renderTabButton(navTabs[0])}</div>
            <div className="col-span-1">{renderTabButton(navTabs[1])}</div>
            <div className="col-span-1 pointer-events-none flex items-end justify-center pb-1">
              <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Add
              </span>
            </div>
            <div className="col-span-1">{renderTabButton(navTabs[2])}</div>
            <div className="col-span-1">{renderTabButton(navTabs[3])}</div>
          </div>
        ) : (
          <div className="flex items-center justify-around h-16">
            {navTabs.map((tab) => (
              <div key={tab} className="flex-1 flex justify-center">
                {renderTabButton(tab)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
