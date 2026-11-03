import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Category, Transaction } from '../../types';
import { formatINR, formatDate } from '../../utils/formatters';
import { IconRenderer } from '../common/IconRenderer';
import { TransactionModal } from '../transactions/TransactionModal';
import { ArrowLeft, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Edit2, Trash2, AlertTriangle } from 'lucide-react';

interface CategoryDrilldownProps {
  category: Category;
  transactions: Transaction[];
  periodLabel: string;
  onBack: () => void;
}

export const CategoryDrilldown: React.FC<CategoryDrilldownProps> = ({
  category,
  transactions,
  periodLabel,
  onBack,
}) => {
  const { deleteTransaction } = useApp();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="space-y-4 pb-20">
      {/* Back Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Analytics</span>
        </button>
        <span className="text-xs text-slate-400 font-medium">{periodLabel}</span>
      </div>

      {/* Category Hero Summary Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
            style={{ backgroundColor: category.color }}
          >
            <IconRenderer name={category.icon} className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Category Drill-Down
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {category.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {transactions.length} record(s) during {periodLabel}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Category Total
          </span>
          <div
            className={`text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight ${
              category.type === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {formatINR(totalAmount, true)}
          </div>
        </div>
      </div>

      {/* Transaction List for this Category */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Transactions in this category
        </h3>

        {transactions.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400">
            <p className="text-sm font-semibold">No transactions for this category in the selected period.</p>
          </div>
        ) : (
          transactions.map((tx) => {
            const isExpense = tx.type === 'expense';
            const isIncome = tx.type === 'income';

            return (
              <div
                key={tx.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isExpense
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : isIncome
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {isExpense && <ArrowDownRight className="w-4 h-4" />}
                    {isIncome && <ArrowUpRight className="w-4 h-4" />}
                    {!isExpense && !isIncome && <ArrowLeftRight className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {tx.note || tx.categoryName}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>{formatDate(tx.date)}</span>
                      <span>·</span>
                      <span>{tx.fromAccountName}</span>
                      {tx.toAccountName && <span>→ {tx.toAccountName}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className={`text-base font-extrabold tabular-nums ${
                      isExpense
                        ? 'text-rose-600 dark:text-rose-400'
                        : isIncome
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {isExpense ? '-' : isIncome ? '+' : ''}
                    {formatINR(tx.amount)}
                  </div>

                  <button
                    onClick={() => setEditingTransaction(tx)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setTxToDelete(tx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Delete transaction"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editingTransaction && (
        <TransactionModal
          initialTransaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {/* Delete Transaction Confirmation Dialog */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Transaction?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to delete this <strong className="font-semibold text-slate-800 dark:text-slate-200">₹{formatINR(txToDelete.amount)}</strong> entry from {formatDate(txToDelete.date)}? Linked account balances will be restored automatically.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteTransaction(txToDelete.id);
                  setTxToDelete(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
