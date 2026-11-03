import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RecurringFrequency, RecurringTransaction, TransactionType } from '../../types';
import { formatINR, formatDate, toInputDate } from '../../utils/formatters';
import { X, ArrowLeft, Plus, CalendarClock, Play, Edit2, Trash2, Check, ArrowRightLeft, AlertTriangle } from 'lucide-react';

export const RecurringModal: React.FC = () => {
  const {
    isRecurringModalOpen,
    setIsRecurringModalOpen,
    recurring,
    accounts,
    categories,
    addRecurring,
    updateRecurring,
    deleteRecurring,
    executeRecurringNow,
    upcoming24hRecurring,
    isRecurringAlreadyExecuted,
  } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);
  const [itemToDelete, setItemToDelete] = useState<RecurringTransaction | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [nextExecutionDate, setNextExecutionDate] = useState(toInputDate(new Date()));
  const [autoExecute, setAutoExecute] = useState(true);
  const [note, setNote] = useState('');

  if (!isRecurringModalOpen) return null;

  const handleClose = () => {
    setIsRecurringModalOpen(false);
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const handleOpenForm = (item?: RecurringTransaction) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setAmount(item.amount.toString());
      setType(item.type);
      setCategoryId(item.categoryId || '');
      setFromAccountId(item.fromAccountId);
      setToAccountId(item.toAccountId || '');
      setFrequency(item.frequency);
      setNextExecutionDate(toInputDate(item.nextExecutionDate));
      setAutoExecute(item.autoExecute);
      setNote(item.note || '');
    } else {
      setEditingItem(null);
      setName('');
      setAmount('');
      setType('expense');
      const defaultExpCat = categories.find((c) => c.type === 'expense');
      setCategoryId(defaultExpCat ? defaultExpCat.id : (categories[0]?.id || ''));
      setFromAccountId(accounts[0]?.id || '');
      setToAccountId(accounts[1]?.id || '');
      setFrequency('monthly');
      setNextExecutionDate(toInputDate(new Date()));
      setAutoExecute(true);
      setNote('');
    }
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(amount);
    if (!name.trim() || isNaN(parsedAmt) || parsedAmt <= 0) return;

    const fromAcc = accounts.find((a) => a.id === fromAccountId) || accounts[0];
    const toAcc = type === 'transfer' ? accounts.find((a) => a.id === toAccountId) : undefined;
    const cat = categories.find((c) => c.id === categoryId) || categories[0];

    if (editingItem) {
      updateRecurring(editingItem.id, {
        name: name.trim(),
        amount: parsedAmt,
        type,
        categoryId: cat.id,
        categoryName: cat.name,
        fromAccountId: fromAcc.id,
        fromAccountName: fromAcc.name,
        toAccountId: toAcc ? toAcc.id : undefined,
        toAccountName: toAcc ? toAcc.name : undefined,
        frequency,
        nextExecutionDate,
        autoExecute,
        note: note.trim(),
      });
    } else {
      addRecurring({
        name: name.trim(),
        amount: parsedAmt,
        type,
        categoryId: cat.id,
        categoryName: cat.name,
        fromAccountId: fromAcc.id,
        fromAccountName: fromAcc.name,
        toAccountId: toAcc ? toAcc.id : undefined,
        toAccountName: toAcc ? toAcc.name : undefined,
        frequency,
        startDate: toInputDate(new Date()),
        nextExecutionDate,
        note: note.trim(),
        tags: ['Recurring', frequency],
        isActive: true,
        autoExecute,
      });
    }

    setIsFormOpen(false);
    setEditingItem(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-white dark:bg-slate-900 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-150">
        <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col h-full overflow-hidden">
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 pt-safe border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Recurring Transactions Engine
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Strictly executes 1 entry per cycle with 24-hour advance notice & duplicate prevention
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Row */}
          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Active Schedules ({recurring.filter((r) => r.isActive).length})
            </span>
            <button
              type="button"
              onClick={() => handleOpenForm()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Create Schedule</span>
            </button>
          </div>

          {/* Schedules List */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1 bg-slate-50/70 dark:bg-slate-950/70 pb-safe pb-24">
            {/* 24-HOUR ADVANCE NOTICE BANNER */}
            {upcoming24hRecurring.length > 0 && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-sky-500/10 to-emerald-500/10 border-2 border-amber-500/30 dark:border-amber-500/25 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <CalendarClock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                        24-Hour Advance Execution Notice
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300">
                        {upcoming24hRecurring.length} scheduled in &lt;24h
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                      The following transaction(s) will automatically execute on their due date. Duplicate prevention is active to ensure strictly one entry is created per cycle.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-amber-500/20">
                  {upcoming24hRecurring.map((uItem) => (
                    <div
                      key={uItem.id}
                      className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-500/20 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                          {uItem.name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                          From: {uItem.fromAccountName} · Due: {formatDate(uItem.nextExecutionDate)}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums block">
                          {formatINR(uItem.amount)}
                        </span>
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                          Single Entry
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recurring.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <CalendarClock className="w-10 h-10 mx-auto mb-2.5 opacity-40 text-slate-500" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No recurring schedules created yet.</p>
                <p className="text-xs mt-1 text-slate-400">
                  Add monthly rent, SIPs, or utility bills to auto-log them.
                </p>
              </div>
            ) : (
              recurring.map((item) => {
                const alreadyExecuted = isRecurringAlreadyExecuted(item, item.nextExecutionDate);
                const isDueWithin24h = upcoming24hRecurring.some((u) => u.id === item.id);

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.name}
                        </h4>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 border border-sky-100 dark:border-sky-900/40">
                          {item.frequency}
                        </span>
                        {item.autoExecute && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                            Auto-Run (1x)
                          </span>
                        )}
                        {alreadyExecuted && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>Logged This Cycle</span>
                          </span>
                        )}
                        {!alreadyExecuted && isDueWithin24h && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                            Due in &lt;24h
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{item.categoryName}</span>
                        <span>·</span>
                        <span>From: {item.fromAccountName}</span>
                        {item.toAccountName && <span>→ {item.toAccountName}</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Next run: <strong className="text-slate-600 dark:text-slate-300 font-semibold">{formatDate(item.nextExecutionDate)}</strong>
                        {item.lastExecutedDate && ` · Last run: ${formatDate(item.lastExecutedDate)}`}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                      <div className="text-left sm:text-right">
                        <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                          {formatINR(item.amount)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {alreadyExecuted ? (
                          <button
                            type="button"
                            disabled
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold cursor-not-allowed border border-slate-200/50 dark:border-slate-700/50"
                            title="This recurring cycle has already been logged. Multiple duplicate entries are blocked."
                          >
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Recorded</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => executeRecurringNow(item.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200/60 dark:border-emerald-800/40 text-xs font-semibold cursor-pointer transition-colors"
                            title="Execute this scheduled transaction (guaranteed 1 entry only)"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Run Now</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenForm(item)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                          title="Edit schedule"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                          title="Delete schedule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Schedule Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingItem ? 'Edit Recurring Schedule' : 'Create Recurring Schedule'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Schedule Title
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Monthly Rent, Parag Parikh SIP, Netflix"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="10000"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold tabular-nums text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Transaction Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TransactionType)}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfer (SIP / Savings)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Next Date
                  </label>
                  <input
                    type="date"
                    required
                    value={nextExecutionDate}
                    onChange={(e) => setNextExecutionDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  From Account
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatINR(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {type === 'transfer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    To Destination Account
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id} disabled={a.id === fromAccountId}>
                        {a.name} ({formatINR(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoExecute}
                    onChange={(e) => setAutoExecute(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Auto-execute automatically on app launch when due
                  </span>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm"
                >
                  {editingItem ? 'Save Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmatory Delete Schedule Dialog */}
      {itemToDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Recurring Schedule?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to delete <strong className="font-semibold text-slate-800 dark:text-slate-200">"{itemToDelete.name}"</strong> ({formatINR(itemToDelete.amount)} · {itemToDelete.frequency})? Past recorded transactions will not be altered.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteRecurring(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
