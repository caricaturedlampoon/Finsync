import React from 'react';
import { UnifiedDebtsView } from './UnifiedDebtsView';

/**
 * DebtsTab - Primary Debts screen rendering the clean unified Debts & Groups ledger.
 */
export const DebtsTab: React.FC = () => {
  return <UnifiedDebtsView initialTab="individual" isModal={false} />;
};
