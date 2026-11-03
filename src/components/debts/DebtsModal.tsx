import React from 'react';
import { useApp } from '../../context/AppContext';
import { UnifiedDebtsView } from './UnifiedDebtsView';

/**
 * DebtsModal - Full-screen modal presentation of the unified Debts & Split Ledger.
 * Uses the pristine UnifiedDebtsView component.
 */
export const DebtsModal: React.FC = () => {
  const { isDebtsModalOpen, setIsDebtsModalOpen, initialDebtCategoryTab } = useApp();

  if (!isDebtsModalOpen) return null;

  return (
    <UnifiedDebtsView
      isModal={true}
      initialTab={initialDebtCategoryTab}
      onClose={() => setIsDebtsModalOpen(false)}
    />
  );
};
