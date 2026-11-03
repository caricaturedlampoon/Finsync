import React from 'react';
import { UnifiedDebtsView } from './UnifiedDebtsView';

/**
 * SplitExpensesTab - Primary Split Expenses screen rendering the clean unified Debts & Groups ledger.
 */
export const SplitExpensesTab: React.FC = () => {
  return <UnifiedDebtsView initialTab="groups" isModal={false} />;
};
