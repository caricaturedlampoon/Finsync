import { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ActiveTab } from '../types';

export const useGlobalShortcuts = () => {
  const {
    isAppLocked,
    setActiveTab,
    isSearchModalOpen,
    setIsSearchModalOpen,
    isTransactionModalOpen,
    setIsTransactionModalOpen,
    openTransactionModal,
    isDebtsModalOpen,
    setIsDebtsModalOpen,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isProfileHubOpen,
    setIsProfileHubOpen,
    isProfileModalOpen,
    setIsProfileModalOpen,
    isAllTransactionsModalOpen,
    setIsAllTransactionsModalOpen,
    isTradeModalOpen,
    setIsTradeModalOpen,
    isAnalysisExportModalOpen,
    setIsAnalysisExportModalOpen,
    isRecurringModalOpen,
    setIsRecurringModalOpen,
    isCategoriesModalOpen,
    setIsCategoriesModalOpen,
    isInvestmentCSVModalOpen,
    setIsInvestmentCSVModalOpen,
    isFeatureUnlocked,
    showToast,
  } = useApp();

  useEffect(() => {
    // If the entire app vault is locked, ignore in-app shortcuts
    if (isAppLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Command Palette / Search: Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsSearchModalOpen(!isSearchModalOpen);
        return;
      }

      // Check if user is typing in an editable field
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // 2. Escape: Close topmost modal
      if (e.key === 'Escape') {
        if (isSearchModalOpen) {
          e.preventDefault();
          setIsSearchModalOpen(false);
          return;
        }
        if (isTradeModalOpen) {
          e.preventDefault();
          setIsTradeModalOpen(false);
          return;
        }
        if (isAnalysisExportModalOpen) {
          e.preventDefault();
          setIsAnalysisExportModalOpen(false);
          return;
        }
        if (isTransactionModalOpen) {
          e.preventDefault();
          setIsTransactionModalOpen(false);
          return;
        }
        if (isAllTransactionsModalOpen) {
          e.preventDefault();
          setIsAllTransactionsModalOpen(false);
          return;
        }
        if (isProfileHubOpen) {
          e.preventDefault();
          setIsProfileHubOpen(false);
          return;
        }
        if (isProfileModalOpen) {
          e.preventDefault();
          setIsProfileModalOpen(false);
          return;
        }
        if (isSettingsModalOpen) {
          e.preventDefault();
          setIsSettingsModalOpen(false);
          return;
        }
        if (isDebtsModalOpen) {
          e.preventDefault();
          setIsDebtsModalOpen(false);
          return;
        }
        if (isRecurringModalOpen) {
          e.preventDefault();
          setIsRecurringModalOpen(false);
          return;
        }
        if (isCategoriesModalOpen) {
          e.preventDefault();
          setIsCategoriesModalOpen(false);
          return;
        }
        if (isInvestmentCSVModalOpen) {
          e.preventDefault();
          setIsInvestmentCSVModalOpen(false);
          return;
        }
        return;
      }

      // If typing inside an input, do not trigger single-key or tab jump shortcuts
      if (isInput) return;

      // 3. Quick New Transaction: Alt+N or 'n' (when no modal is open)
      const anyModalOpen =
        isSearchModalOpen ||
        isTransactionModalOpen ||
        isTradeModalOpen ||
        isSettingsModalOpen ||
        isDebtsModalOpen ||
        isProfileHubOpen ||
        isAllTransactionsModalOpen ||
        isAnalysisExportModalOpen;

      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !anyModalOpen) {
        if (isFeatureUnlocked('expense_entry')) {
          e.preventDefault();
          openTransactionModal('expense');
        }
        return;
      }

      if ((e.altKey && (e.key === 'n' || e.key === 'N')) && isFeatureUnlocked('expense_entry')) {
        e.preventDefault();
        openTransactionModal('expense');
        return;
      }

      // 4. Tab Navigation with Alt + [1-6]
      if (e.altKey) {
        const tabMap: Record<string, ActiveTab> = {
          '1': 'home',
          '2': 'accounts',
          '3': 'investments',
          '4': 'analytics',
          '5': 'debts',
          '6': 'split_expenses',
        };

        const targetTab = tabMap[e.key];
        if (targetTab) {
          if (targetTab === 'home' || isFeatureUnlocked(targetTab as any)) {
            e.preventDefault();
            setActiveTab(targetTab);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isAppLocked,
    isSearchModalOpen,
    setIsSearchModalOpen,
    isTransactionModalOpen,
    setIsTransactionModalOpen,
    openTransactionModal,
    isDebtsModalOpen,
    setIsDebtsModalOpen,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isProfileHubOpen,
    setIsProfileHubOpen,
    isProfileModalOpen,
    setIsProfileModalOpen,
    isAllTransactionsModalOpen,
    setIsAllTransactionsModalOpen,
    isTradeModalOpen,
    setIsTradeModalOpen,
    isAnalysisExportModalOpen,
    setIsAnalysisExportModalOpen,
    isRecurringModalOpen,
    setIsRecurringModalOpen,
    isCategoriesModalOpen,
    setIsCategoriesModalOpen,
    isInvestmentCSVModalOpen,
    setIsInvestmentCSVModalOpen,
    setActiveTab,
    isFeatureUnlocked,
  ]);
};
