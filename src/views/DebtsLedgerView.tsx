import React from 'react';
import { UnifiedDebtsView } from '../components/debts/UnifiedDebtsView';

/**
 * DebtsLedgerView - Borrowed & Lent IOUs and Individual Repayments
 * Presents the clean, crisp unified Debts & Groups ledger with Individual tab active.
 */
export const DebtsLedgerView: React.FC = () => {
  return <UnifiedDebtsView initialTab="individual" isModal={false} />;
};
