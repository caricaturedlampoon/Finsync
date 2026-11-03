import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Account } from '../../types';
import { AccountAvatar } from '../common/AccountAvatar';
import { formatINR, toInputDate } from '../../utils/formatters';
import { X, ArrowLeft, Check, CreditCard, ArrowRightLeft } from 'lucide-react';

interface CreditCardPayModalProps {
  cardAccount: Account;
  isOpen: boolean;
  onClose: () => void;
}

export const CreditCardPayModal: React.FC<CreditCardPayModalProps> = ({
  cardAccount,
  isOpen,
  onClose,
}) => {
  const { accounts, payCreditCardBill } = useApp();

  // Due amount is the negative balance on the credit card (e.g., balance = -14500 means due = 14500)
  const fullDueAmount = Math.max(0, -cardAccount.balance);
  const eligiblePayingAccounts = accounts.filter(
    (a) => a.id !== cardAccount.id && a.type !== 'credit'
  );

  const [paymentType, setPaymentType] = useState<'full' | 'custom'>('full');
  const [customAmount, setCustomAmount] = useState<string>(fullDueAmount.toString());
  const [payingAccountId, setPayingAccountId] = useState<string>(
    eligiblePayingAccounts.length > 0 ? eligiblePayingAccounts[0].id : ''
  );
  const [date, setDate] = useState<string>(toInputDate(new Date()));
  const [note, setNote] = useState<string>('');

  if (!isOpen) return null;

  const targetAmount = paymentType === 'full' ? fullDueAmount : parseFloat(customAmount) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetAmount <= 0 || !payingAccountId) return;

    payCreditCardBill({
      creditCardAccountId: cardAccount.id,
      payingAccountId,
      amount: targetAmount,
      date,
      note: note.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-150">
      <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col h-full overflow-hidden">
        {/* Fullscreen Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 pt-safe border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <AccountAvatar account={cardAccount} size="sm" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Pay Credit Card Bill
              </h2>
              <p className="text-xs text-slate-400">{cardAccount.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-5 overflow-y-auto flex-1 text-xs sm:text-sm pb-safe pb-28">
          {/* Card Summary Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">
                Total Due Amount
              </span>
              <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                {formatINR(fullDueAmount)}
              </span>
            </div>
            {cardAccount.creditLimit && (
              <div className="text-right">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">
                  Credit Limit
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                  {formatINR(cardAccount.creditLimit)}
                </span>
              </div>
            )}
          </div>

          {/* Payment Choice: Full Due vs Custom */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setPaymentType('full')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                paymentType === 'full'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Pay Full ({formatINR(fullDueAmount)})
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentType('custom');
                setCustomAmount(fullDueAmount > 0 ? (fullDueAmount / 2).toString() : '1000');
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                paymentType === 'custom'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Custom Amount
            </button>
          </div>

          {paymentType === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Custom Payment Amount (₹)
              </label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold tabular-nums text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          )}

          {/* Paying Bank Account Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Pay From Bank / Wallet
            </label>
            <select
              value={payingAccountId}
              onChange={(e) => setPayingAccountId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {eligiblePayingAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} (Balance: {formatINR(acc.balance)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payment Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payment Reference Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. NetBanking BillDesk Ref #9842"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Confirm Payment of {formatINR(targetAmount)}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
