import React from 'react';
import { UnifiedDebtsView } from '../components/debts/UnifiedDebtsView';

/**
 * SplitExpensesView - Shared Group Expenses, Bills & Settlements
 * Presents the clean, crisp unified Debts & Groups ledger with Groups tab active.
 */
export const SplitExpensesView: React.FC = () => {
  return <UnifiedDebtsView initialTab="groups" isModal={false} />;
};
