/**
 * FinSync - Personal Finance & Investment Tracker
 * Tagline: Log Split Track Analyse Grow
 * Fully offline-capable, responsive, and customizable.
 * Specialized for Indian Rupee (₹ / INR) notation and DD/MM/YYYY dates.
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import type { ActiveTab } from './types';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import {
  HomeView,
  AccountsLedgerView,
  InvestmentsPortfolioView,
  AnalyticsView,
  DebtsLedgerView,
  SplitExpensesView,
} from './views';
import { TransactionModal } from './components/transactions/TransactionModal';
import { SearchModal } from './components/search/SearchModal';
import { AllTransactionsModal } from './components/transactions/AllTransactionsModal';
import { ProfileHubModal } from './components/profile/ProfileHubModal';
import { DebtsModal } from './components/debts/DebtsModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { RecurringModal } from './components/recurring/RecurringModal';
import { ProfileModal } from './components/profile/ProfileModal';
import { CustomizeAppModal } from './components/settings/CustomizeAppModal';
import { CategoriesModal } from './components/categories/CategoriesModal';
import { InvestmentCSVModal } from './components/investments/InvestmentCSVModal';
import { SipManagerModal } from './components/investments/SipManagerModal';
import { ClaimExpenseModal } from './components/debts/ClaimExpenseModal';
import { EncryptedBackupModal } from './components/settings/EncryptedBackupModal';
import { BinModal } from './components/settings/BinModal';
import { AnalysisExportModal } from './components/analytics/AnalysisExportModal';
import { NetWorthModal } from './components/analytics/NetWorthModal';
import { ExtendedToolsModal } from './components/layout/ExtendedToolsModal';
import { BulkActionsModal } from './components/settings/BulkActionsModal';
import { LoansModal } from './components/loans/LoansModal';
import { NotificationManagerModal } from './components/notifications/NotificationManagerModal';
import { TradeExecutionModal } from './components/investments/TradeExecutionModal';
import { MonthlyBudgetModal } from './components/budget/MonthlyBudgetModal';
import { SpendIncomeCalendarModal } from './components/calendar/SpendIncomeCalendarModal';
import { HtmlReportViewerModal } from './components/common/HtmlReportViewerModal';
import { ToastContainer } from './components/common/ToastContainer';
import { OfflineBanner } from './components/common/OfflineBanner';
import { AppLockScreen } from './components/security/AppLockScreen';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

const MainContent: React.FC = () => {
  const { activeTab, setActiveTab, settings, isFeatureUnlocked } = useApp();
  const [visitedTabs, setVisitedTabs] = React.useState<Set<ActiveTab>>(() => new Set(['home', activeTab]));

  const availableNavTabs = React.useMemo(() => {
    const configured = settings?.navigationTabs && settings.navigationTabs.length === 4
      ? settings.navigationTabs
      : ['home', 'accounts', 'investments', 'analytics'] as ActiveTab[];
    return configured.filter((tab) => {
      if (tab === 'home') return true;
      return isFeatureUnlocked(tab as any);
    });
  }, [settings?.navigationTabs, isFeatureUnlocked]);

  React.useEffect(() => {
    // If current tab is locked by user, immediately switch to home dashboard
    if (activeTab === 'analytics' && !isFeatureUnlocked('analytics')) {
      setActiveTab('home');
    } else if (activeTab === 'accounts' && !isFeatureUnlocked('accounts')) {
      setActiveTab('home');
    } else if (activeTab === 'investments' && !isFeatureUnlocked('investments')) {
      setActiveTab('home');
    } else if (activeTab === 'debts' && !isFeatureUnlocked('debts')) {
      setActiveTab('home');
    } else if (activeTab === 'split_expenses' && !isFeatureUnlocked('split_expenses')) {
      setActiveTab('home');
    }
  }, [activeTab, isFeatureUnlocked, setActiveTab]);

  React.useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const prevTabRef = React.useRef<ActiveTab>(activeTab);
  React.useLayoutEffect(() => {
    if (prevTabRef.current !== activeTab) {
      navigationManager.setCurrentScreen(activeTab);
      navigationManager.restoreTabScroll(activeTab);
      navigationManager.endTransition();
      prevTabRef.current = activeTab;
    }
  }, [activeTab]);

  return (
    <main
      className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-1 pb-16 sm:pb-20"
    >
      {visitedTabs.has('home') && (
        <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}>
          <HomeView />
        </div>
      )}
      {visitedTabs.has('analytics') && isFeatureUnlocked('analytics') && (
        <div style={{ display: activeTab === 'analytics' ? 'block' : 'none' }}>
          <AnalyticsView />
        </div>
      )}
      {visitedTabs.has('accounts') && isFeatureUnlocked('accounts') && (
        <div style={{ display: activeTab === 'accounts' ? 'block' : 'none' }}>
          <AccountsLedgerView />
        </div>
      )}
      {visitedTabs.has('investments') && isFeatureUnlocked('investments') && (
        <div style={{ display: activeTab === 'investments' ? 'block' : 'none' }}>
          <InvestmentsPortfolioView />
        </div>
      )}
      {visitedTabs.has('debts') && isFeatureUnlocked('debts') && (
        <div style={{ display: activeTab === 'debts' ? 'block' : 'none' }}>
          <DebtsLedgerView />
        </div>
      )}
      {visitedTabs.has('split_expenses') && isFeatureUnlocked('split_expenses') && (
        <div style={{ display: activeTab === 'split_expenses' ? 'block' : 'none' }}>
          <SplitExpensesView />
        </div>
      )}
    </main>
  );
};

import { NavigationProvider, useRegisterModal } from './navigation/NavigationContext';
import { navigationManager } from './navigation/navigationManager';

const GlobalModals: React.FC = () => {
  const {
    isTransactionModalOpen,
    setIsTransactionModalOpen,
    isSearchModalOpen,
    setIsSearchModalOpen,
    isAllTransactionsModalOpen,
    setIsAllTransactionsModalOpen,
    isProfileHubOpen,
    setIsProfileHubOpen,
    isDebtsModalOpen,
    setIsDebtsModalOpen,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isRecurringModalOpen,
    setIsRecurringModalOpen,
    isProfileModalOpen,
    setIsProfileModalOpen,
    isCustomizeModalOpen,
    setIsCustomizeModalOpen,
    isCategoriesModalOpen,
    setIsCategoriesModalOpen,
    isInvestmentCSVModalOpen,
    setIsInvestmentCSVModalOpen,
    isSipManagerOpen,
    setIsSipManagerOpen,
    isBackupModalOpen,
    setIsBackupModalOpen,
    isBinOpen,
    setIsBinOpen,
    isAnalysisExportModalOpen,
    setIsAnalysisExportModalOpen,
    isTradeModalOpen,
    setIsTradeModalOpen,
    tradeModalInitialType,
    tradeModalInitialHoldingId,
    tradeModalInitialAction,
    isExtendedToolsOpen,
    setIsExtendedToolsOpen,
    isLoansModalOpen,
    setIsLoansModalOpen,
    isNotificationsModalOpen,
    setIsNotificationsModalOpen,
    isNetWorthModalOpen,
    setIsNetWorthModalOpen,
    isBulkActionsModalOpen,
    setIsBulkActionsModalOpen,
    isBudgetModalOpen,
    setIsBudgetModalOpen,
    isCalendarModalOpen,
    setIsCalendarModalOpen,
    isHtmlReportViewerOpen,
    closeHtmlReportViewer,
  } = useApp();

  // Register modal back-button handlers
  useRegisterModal(isHtmlReportViewerOpen, 'html_report_viewer', 'HTML Report Viewer', closeHtmlReportViewer);
  useRegisterModal(isTransactionModalOpen, 'transaction', 'New Transaction', () => setIsTransactionModalOpen(false));
  useRegisterModal(isSearchModalOpen, 'search', 'Search & Quick Actions', () => setIsSearchModalOpen(false));
  useRegisterModal(isAllTransactionsModalOpen, 'all_transactions', 'All Transactions', () => setIsAllTransactionsModalOpen(false));
  useRegisterModal(isProfileHubOpen, 'profile_hub', 'Profile Hub', () => setIsProfileHubOpen(false));
  useRegisterModal(isDebtsModalOpen, 'debts', 'Debts & IOUs', () => setIsDebtsModalOpen(false));
  useRegisterModal(isSettingsModalOpen, 'settings', 'Settings', () => setIsSettingsModalOpen(false));
  useRegisterModal(isRecurringModalOpen, 'recurring', 'Recurring Automation', () => setIsRecurringModalOpen(false));
  useRegisterModal(isProfileModalOpen, 'profile', 'Edit Profile', () => setIsProfileModalOpen(false));
  useRegisterModal(isCustomizeModalOpen, 'customize', 'Customize Dashboard', () => setIsCustomizeModalOpen(false));
  useRegisterModal(isCategoriesModalOpen, 'categories', 'Manage Categories', () => setIsCategoriesModalOpen(false));
  useRegisterModal(isInvestmentCSVModalOpen, 'investment_csv', 'Investment CSV Importer', () => setIsInvestmentCSVModalOpen(false));
  useRegisterModal(isSipManagerOpen, 'sip_manager', 'SIP Manager', () => setIsSipManagerOpen(false));
  useRegisterModal(isBackupModalOpen, 'backup', 'Backup & Cloud Sync', () => setIsBackupModalOpen(false));
  useRegisterModal(isBinOpen, 'bin', 'Recycle Bin', () => setIsBinOpen(false));
  useRegisterModal(isAnalysisExportModalOpen, 'analysis_export', 'Export Analysis Dossier', () => setIsAnalysisExportModalOpen(false));
  useRegisterModal(isNetWorthModalOpen, 'net_worth', 'Net Worth Balance Sheet', () => setIsNetWorthModalOpen(false));
  useRegisterModal(isBulkActionsModalOpen, 'bulk_actions', 'Bulk History', () => setIsBulkActionsModalOpen(false));
  useRegisterModal(isBudgetModalOpen, 'budget', 'Monthly Budget', () => setIsBudgetModalOpen(false));
  useRegisterModal(isCalendarModalOpen, 'spend_calendar', 'Spend & Income Calendar', () => setIsCalendarModalOpen(false));
  useRegisterModal(isLoansModalOpen, 'loans', 'Loans & EMI Manager', () => setIsLoansModalOpen(false));
  useRegisterModal(isNotificationsModalOpen, 'notifications', 'Notifications', () => setIsNotificationsModalOpen(false));
  useRegisterModal(isTradeModalOpen, 'trade', 'Trade Execution Desk', () => setIsTradeModalOpen(false));
  useRegisterModal(isExtendedToolsOpen, 'extended_tools', 'Extended Tools Matrix', () => setIsExtendedToolsOpen(false));

  return (
    <>
      {isTransactionModalOpen && <TransactionModal />}
      {isSearchModalOpen && <SearchModal />}
      {isAllTransactionsModalOpen && <AllTransactionsModal />}
      {isProfileHubOpen && <ProfileHubModal />}
      {isDebtsModalOpen && <DebtsModal />}
      {isSettingsModalOpen && <SettingsModal />}
      {isRecurringModalOpen && <RecurringModal />}
      {isProfileModalOpen && <ProfileModal />}
      {isCustomizeModalOpen && <CustomizeAppModal />}
      {isCategoriesModalOpen && <CategoriesModal />}
      {isInvestmentCSVModalOpen && <InvestmentCSVModal />}
      {isSipManagerOpen && <SipManagerModal />}
      <ClaimExpenseModal />
      <EncryptedBackupModal />
      {isBinOpen && <BinModal />}
      {isAnalysisExportModalOpen && <AnalysisExportModal />}
      {isNetWorthModalOpen && (
        <NetWorthModal
          isOpen={isNetWorthModalOpen}
          onClose={() => setIsNetWorthModalOpen(false)}
        />
      )}
      {isBulkActionsModalOpen && (
        <BulkActionsModal
          isOpen={isBulkActionsModalOpen}
          onClose={() => setIsBulkActionsModalOpen(false)}
        />
      )}
      {isExtendedToolsOpen && (
        <ExtendedToolsModal
          isOpen={isExtendedToolsOpen}
          onClose={() => setIsExtendedToolsOpen(false)}
        />
      )}
      {isLoansModalOpen && (
        <LoansModal
          isOpen={isLoansModalOpen}
          onClose={() => setIsLoansModalOpen(false)}
        />
      )}
      {isNotificationsModalOpen && (
        <NotificationManagerModal
          isOpen={isNotificationsModalOpen}
          onClose={() => setIsNotificationsModalOpen(false)}
        />
      )}
      {isTradeModalOpen && (
        <TradeExecutionModal
          isOpen={isTradeModalOpen}
          onClose={() => setIsTradeModalOpen(false)}
          initialAssetType={tradeModalInitialType}
          initialHoldingId={tradeModalInitialHoldingId}
          initialAction={tradeModalInitialAction}
        />
      )}
      {isBudgetModalOpen && (
        <MonthlyBudgetModal
          isOpen={isBudgetModalOpen}
          onClose={() => setIsBudgetModalOpen(false)}
        />
      )}
      {isCalendarModalOpen && (
        <SpendIncomeCalendarModal
          isOpen={isCalendarModalOpen}
          onClose={() => setIsCalendarModalOpen(false)}
        />
      )}
      <HtmlReportViewerModal />
      <ToastContainer />
    </>
  );
};

const AppShell: React.FC = () => {
  const { isAppLocked } = useApp();
  useGlobalShortcuts();

  if (isAppLocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
        <AppLockScreen />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      <OfflineBanner />
      <Header />
      <div className="flex-1 w-full">
        <MainContent />
      </div>
      <BottomNav />

      {/* Global Modals & Notifications */}
      <GlobalModals />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="FinSync App Recovery">
      <AppProvider>
        <NavigationProvider>
          <AppShell />
        </NavigationProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
