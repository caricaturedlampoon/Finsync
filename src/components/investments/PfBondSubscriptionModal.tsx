import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { InvestmentHolding } from '../../types';
import { formatINR, toInputDate, formatDate } from '../../utils/formatters';
import {
  X,
  Calendar,
  Clock,
  Landmark,
  Coins,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Layers,
  History,
  TrendingUp,
  Percent,
} from 'lucide-react';

interface EditSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: InvestmentHolding;
}

export const EditSubscriptionModal: React.FC<EditSubscriptionModalProps> = ({
  isOpen,
  onClose,
  holding,
}) => {
  const { updateHolding, accounts, showToast } = useApp();

  const currentSub = holding.subscription;
  const isPf = holding.assetType === 'pf';

  const [enabled, setEnabled] = useState(currentSub?.enabled ?? true);
  const [amount, setAmount] = useState((currentSub?.amount ?? 5000).toString());
  const [employerAmount, setEmployerAmount] = useState((currentSub?.employerAmount ?? 0).toString());
  const [dayOfMonth, setDayOfMonth] = useState((currentSub?.dayOfMonth ?? 5).toString());
  const [fromAccountId, setFromAccountId] = useState(currentSub?.fromAccountId || accounts[0]?.id || '');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>(
    (currentSub?.status?.toUpperCase() as 'ACTIVE' | 'PAUSED') || 'ACTIVE'
  );
  const [notes, setNotes] = useState(currentSub?.notes || '');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount) || 0;
    const parsedEmployer = parseFloat(employerAmount) || 0;
    const parsedDay = Math.min(31, Math.max(1, parseInt(dayOfMonth, 10) || 5));

    updateHolding(holding.id, {
      subscription: {
        enabled,
        amount: parsedAmount,
        employerAmount: isPf ? parsedEmployer : undefined,
        dayOfMonth: parsedDay,
        fromAccountId: fromAccountId || undefined,
        status,
        notes: notes.trim() || undefined,
      },
    });

    showToast(`Monthly subscription for ${holding.name} updated`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Monthly Subscription Settings
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                {holding.customDisplayName || holding.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Active / Paused Status Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">Subscription Status</span>
              <span className="text-[11px] text-slate-400">
                {status === 'ACTIVE' ? 'Active · Scheduled every month' : 'Paused · No recurring logs'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStatus((prev) => (prev === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'))}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                status === 'ACTIVE'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {status === 'ACTIVE' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{status}</span>
            </button>
          </div>

          {/* Monthly Amount Input */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isPf ? 'Monthly Member / Employee Contribution (₹)' : 'Monthly Subscription Amount (₹)'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
              <input
                type="number"
                required
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000"
                className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Employer Matching Contribution (for EPF) */}
          {isPf && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Employer Matching Contribution (₹) <span className="font-normal text-slate-400">(Optional for EPF)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={employerAmount}
                  onChange={(e) => setEmployerAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Total monthly accumulation will be ₹{(parseFloat(amount) || 0) + (parseFloat(employerAmount) || 0)}.
              </p>
            </div>
          )}

          {/* Day of Month */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Day of Month
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">1st to 31st</span>
            </div>

            {/* Deduct from Bank Account */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Deduct From Bank
              </label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs truncate"
              >
                <option value="">Unlinked (Ledger Only)</option>
                {accounts
                  .filter((a) => !a.isArchived && !a.isSystemDebtAccount)
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (₹{acc.balance.toLocaleString('en-IN')})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Salary deduction on 5th"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer"
            >
              Save Subscription
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// ADD MULTIPLE OLD SUBSCRIPTIONS MODAL
// =========================================================================
interface AddPastSubscriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: InvestmentHolding;
}

export const AddPastSubscriptionsModal: React.FC<AddPastSubscriptionsModalProps> = ({
  isOpen,
  onClose,
  holding,
}) => {
  const { addMultipleHoldingTransactions, accounts, showToast } = useApp();
  const isPf = holding.assetType === 'pf';

  // Mode: 'range' (bulk generator) vs 'manual_rows'
  const [mode, setMode] = useState<'range' | 'manual_rows'>('range');

  // Range generator state
  const defaultMonthlyAmt = (holding.subscription?.amount || 5000) + (holding.subscription?.employerAmount || 0);
  const [monthlyAmount, setMonthlyAmount] = useState(defaultMonthlyAmt.toString());
  const [startMonthYear, setStartMonthYear] = useState('2025-04'); // e.g. FY 2025-26 start
  const [endMonthYear, setEndMonthYear] = useState('2026-03');
  const [executionDay, setExecutionDay] = useState(holding.subscription?.dayOfMonth?.toString() || '5');
  const [linkPassbook, setLinkPassbook] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(holding.subscription?.fromAccountId || accounts[0]?.id || '');
  const [rangeNotes, setRangeNotes] = useState(isPf ? 'Monthly PF Subscription' : 'Bond Subscription Installment');

  // Manual rows state
  const [manualRows, setManualRows] = useState<Array<{ date: string; amount: string; note: string }>>([
    { date: toInputDate(new Date(Date.now() - 90 * 86400000)), amount: defaultMonthlyAmt.toString(), note: 'Past installment 1' },
    { date: toInputDate(new Date(Date.now() - 60 * 86400000)), amount: defaultMonthlyAmt.toString(), note: 'Past installment 2' },
    { date: toInputDate(new Date(Date.now() - 30 * 86400000)), amount: defaultMonthlyAmt.toString(), note: 'Past installment 3' },
  ]);

  // Computed range months preview
  const generatedRangeList = useMemo(() => {
    if (!startMonthYear || !endMonthYear) return [];
    const [startYear, startMonth] = startMonthYear.split('-').map(Number);
    const [endYear, endMonth] = endMonthYear.split('-').map(Number);

    if (isNaN(startYear) || isNaN(startMonth) || isNaN(endYear) || isNaN(endMonth)) return [];

    const list: Array<{ date: string; monthLabel: string; amount: number }> = [];
    const parsedAmt = parseFloat(monthlyAmount) || 0;
    const parsedDay = Math.min(31, Math.max(1, parseInt(executionDay, 10) || 5));

    let curY = startYear;
    let curM = startMonth;

    while (curY < endYear || (curY === endYear && curM <= endMonth)) {
      const lastDayOfMonth = new Date(curY, curM, 0).getDate();
      const actualDay = Math.min(parsedDay, lastDayOfMonth);
      const dayStr = actualDay < 10 ? `0${actualDay}` : `${actualDay}`;
      const monthStr = curM < 10 ? `0${curM}` : `${curM}`;
      const dateStr = `${curY}-${monthStr}-${dayStr}`;
      const dObj = new Date(curY, curM - 1, actualDay);
      const mLabel = dObj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

      list.push({ date: dateStr, monthLabel: mLabel, amount: parsedAmt });

      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    return list;
  }, [startMonthYear, endMonthYear, monthlyAmount, executionDay]);

  const handleAddRow = () => {
    const lastRow = manualRows[manualRows.length - 1];
    const nextDate = lastRow ? lastRow.date : toInputDate(new Date());
    setManualRows([...manualRows, { date: nextDate, amount: monthlyAmount, note: `Subscription ${manualRows.length + 1}` }]);
  };

  const handleRemoveRow = (index: number) => {
    setManualRows(manualRows.filter((_, idx) => idx !== index));
  };

  const handleUpdateRow = (index: number, field: 'date' | 'amount' | 'note', val: string) => {
    setManualRows(manualRows.map((r, idx) => (idx === index ? { ...r, [field]: val } : r)));
  };

  const handleSaveRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (generatedRangeList.length === 0) {
      showToast('No months selected in range', 'error');
      return;
    }

    const txsToSubmit = generatedRangeList.map((item) => ({
      date: item.date,
      type: 'buy' as const,
      quantity: isPf ? item.amount : (holding.currentPrice > 0 ? Number((item.amount / holding.currentPrice).toFixed(4)) : 1),
      price: isPf ? 1 : (holding.currentPrice || holding.averageBuyPrice || 1000),
      totalAmount: item.amount,
      notes: `${rangeNotes} (${item.monthLabel})`,
      accountingType: linkPassbook ? ('transfer' as const) : ('corporate_action' as const),
    }));

    addMultipleHoldingTransactions(
      holding.id,
      txsToSubmit,
      linkPassbook,
      linkPassbook ? selectedAccount : undefined
    );

    onClose();
  };

  const handleSaveManualRows = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = manualRows.filter((r) => parseFloat(r.amount) > 0);
    if (validRows.length === 0) {
      showToast('Please add at least one valid old subscription', 'error');
      return;
    }

    const txsToSubmit = validRows.map((r) => {
      const amt = parseFloat(r.amount);
      return {
        date: r.date,
        type: 'buy' as const,
        quantity: isPf ? amt : (holding.currentPrice > 0 ? Number((amt / holding.currentPrice).toFixed(4)) : 1),
        price: isPf ? 1 : (holding.currentPrice || holding.averageBuyPrice || 1000),
        totalAmount: amt,
        notes: r.note.trim() || 'Old Subscription',
        accountingType: linkPassbook ? ('transfer' as const) : ('corporate_action' as const),
      };
    });

    addMultipleHoldingTransactions(
      holding.id,
      txsToSubmit,
      linkPassbook,
      linkPassbook ? selectedAccount : undefined
    );

    onClose();
  };

  const totalRangeAmount = generatedRangeList.reduce((sum, item) => sum + item.amount, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Add Multiple Old Subscriptions
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-[280px]">
                Backfill past monthly contributions for {holding.customDisplayName || holding.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-5 pt-2">
          <button
            type="button"
            onClick={() => setMode('range')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              mode === 'range'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Batch Date Range (Fastest)
          </button>
          <button
            type="button"
            onClick={() => setMode('manual_rows')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              mode === 'manual_rows'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Custom Multiple Rows ({manualRows.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {mode === 'range' ? (
            <form onSubmit={handleSaveRange} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    From Month & Year
                  </label>
                  <input
                    type="month"
                    required
                    value={startMonthYear}
                    onChange={(e) => setStartMonthYear(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    To Month & Year
                  </label>
                  <input
                    type="month"
                    required
                    value={endMonthYear}
                    onChange={(e) => setEndMonthYear(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Contribution (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={monthlyAmount}
                    onChange={(e) => setMonthlyAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Deposit Day of Month
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={executionDay}
                    onChange={(e) => setExecutionDay(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Passbook Linking Option */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 dark:text-white">
                  <input
                    type="checkbox"
                    checked={linkPassbook}
                    onChange={(e) => setLinkPassbook(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Also link to Bank Account Passbook</span>
                </label>
                {linkPassbook && (
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      Choose Source Bank Account
                    </label>
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs truncate"
                    >
                      {accounts
                        .filter((a) => !a.isArchived && !a.isSystemDebtAccount)
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} (₹{acc.balance.toLocaleString('en-IN')})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Preview Box */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200">
                    Preview: {generatedRangeList.length} Monthly Subscriptions
                  </span>
                  <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
                    {formatINR(totalRangeAmount)} Total
                  </span>
                </div>
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1 pr-1">
                  {generatedRangeList.slice(0, 12).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 py-0.5 border-b border-emerald-200/40 dark:border-emerald-800/30 last:border-0">
                      <span>{item.date} ({item.monthLabel})</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatINR(item.amount)}</span>
                    </div>
                  ))}
                  {generatedRangeList.length > 12 && (
                    <div className="text-[10px] text-slate-400 text-center pt-1">
                      ...and {generatedRangeList.length - 12} more past months
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generatedRangeList.length === 0}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  Add {generatedRangeList.length} Subscriptions ({formatINR(totalRangeAmount)})
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSaveManualRows} className="space-y-4">
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {manualRows.map((row, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Entry #{idx + 1}
                      </span>
                      {manualRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Date</label>
                        <input
                          type="date"
                          required
                          value={row.date}
                          onChange={(e) => handleUpdateRow(idx, 'date', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Amount (₹)</label>
                        <input
                          type="number"
                          required
                          min="1"
                          step="any"
                          value={row.amount}
                          onChange={(e) => handleUpdateRow(idx, 'amount', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs font-bold"
                        />
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={row.note}
                        onChange={(e) => handleUpdateRow(idx, 'note', e.target.value)}
                        placeholder="Description (e.g. Month 1 deposit)"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddRow}
                className="w-full py-2 rounded-xl border border-dashed border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Another Old Subscription</span>
              </button>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  Save {manualRows.length} Old Subscriptions
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// ADD MANUAL INTEREST MODAL (User adds interest manually for PF / Bonds)
// =========================================================================
interface AddManualInterestModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: InvestmentHolding;
}

export const AddManualInterestModal: React.FC<AddManualInterestModalProps> = ({
  isOpen,
  onClose,
  holding,
}) => {
  const { addMultipleHoldingTransactions, accounts, showToast } = useApp();
  const isPf = holding.assetType === 'pf';

  const defaultDate = toInputDate(new Date());
  const [interestDate, setInterestDate] = useState(defaultDate);
  const [interestRate, setInterestRate] = useState(
    (holding.interestRate || holding.couponRate || (isPf ? 8.25 : 7.75)).toString()
  );

  // Auto-calculated interest estimate based on balance
  const currentValuation = holding.quantity * (holding.currentPrice || holding.averageBuyPrice || 1);
  const estimatedAnnualInterest = useMemo(() => {
    const rate = parseFloat(interestRate) || 0;
    return Number(((currentValuation * rate) / 100).toFixed(2));
  }, [currentValuation, interestRate]);

  const [interestAmount, setInterestAmount] = useState(estimatedAnnualInterest > 0 ? estimatedAnnualInterest.toString() : '5000');
  const [compoundIntoBalance, setCompoundIntoBalance] = useState(isPf ? true : false);
  const [payoutAccountId, setPayoutAccountId] = useState(holding.dematAccountId || accounts[0]?.id || '');
  const [interestNotes, setInterestNotes] = useState(
    isPf
      ? `EPFO Annual Interest Credited @ ${holding.interestRate || 8.25}%`
      : `Coupon Interest received for ${holding.symbol} @ ${holding.couponRate || 7.75}%`
  );

  if (!isOpen) return null;

  const handleApplyEstimate = () => {
    setInterestAmount(estimatedAnnualInterest.toString());
    showToast(`Applied estimate: ₹${estimatedAnnualInterest.toLocaleString('en-IN')}`, 'info');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(interestAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Please enter a valid interest amount', 'error');
      return;
    }

    const txToSubmit = {
      date: interestDate,
      type: 'interest' as const,
      // For compounded PF: quantity is added to accumulated balance at zero cost basis!
      // For cash payout to bank: quantity is 1
      quantity: compoundIntoBalance ? parsedAmount : 1,
      price: compoundIntoBalance ? 1 : 0,
      totalAmount: parsedAmount,
      notes: interestNotes.trim() || 'Manual Interest Credited',
      accountingType: 'income' as const,
    };

    addMultipleHoldingTransactions(
      holding.id,
      [txToSubmit],
      !compoundIntoBalance, // link to bank passbook if paid out as cash
      !compoundIntoBalance ? payoutAccountId : undefined
    );

    showToast(
      compoundIntoBalance
        ? `Added ₹${parsedAmount.toLocaleString('en-IN')} interest (compounded into balance)`
        : `Added ₹${parsedAmount.toLocaleString('en-IN')} interest credited to bank account`,
      'success'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Add Manual Interest / Coupon
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                {holding.customDisplayName || holding.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Quick Calculator Helper Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 block">
                Estimated Annual Interest ({interestRate}% on ₹{Math.round(currentValuation).toLocaleString('en-IN')})
              </span>
              <span className="text-sm font-extrabold text-amber-900 dark:text-amber-200 tabular-nums">
                ₹{estimatedAnnualInterest.toLocaleString('en-IN')}
              </span>
            </div>
            <button
              type="button"
              onClick={handleApplyEstimate}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow-xs cursor-pointer shrink-0"
            >
              Apply Estimate
            </button>
          </div>

          {/* Date of Interest Credit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Credit Date
              </label>
              <input
                type="date"
                required
                value={interestDate}
                onChange={(e) => setInterestDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Interest Rate (% p.a.)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  placeholder="8.25"
                  className="w-full pl-3 pr-7 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 font-bold">%</span>
              </div>
            </div>
          </div>

          {/* Interest Amount (Manually Entered) */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Interest Amount Credited (₹) <span className="text-emerald-600 dark:text-emerald-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
              <input
                type="number"
                required
                min="0.01"
                step="any"
                value={interestAmount}
                onChange={(e) => setInterestAmount(e.target.value)}
                placeholder="e.g. 15280"
                className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-base text-slate-900 dark:text-white tabular-nums"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Enter the exact amount declared/credited in your EPFO passbook or bond statement.
            </p>
          </div>

          {/* Compounding Option */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 dark:text-white">
              <input
                type="radio"
                name="interestType"
                checked={compoundIntoBalance}
                onChange={() => setCompoundIntoBalance(true)}
                className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span>Compound into Fund Balance (Standard for PF & Cumulative Bonds)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 dark:text-white">
              <input
                type="radio"
                name="interestType"
                checked={!compoundIntoBalance}
                onChange={() => setCompoundIntoBalance(false)}
                className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span>Credit to Bank Account as Cash Inflow (Coupon Payout)</span>
            </label>

            {!compoundIntoBalance && (
              <div className="pt-2">
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Choose Bank Account for Interest Deposit
                </label>
                <select
                  value={payoutAccountId}
                  onChange={(e) => setPayoutAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs truncate"
                >
                  {accounts
                    .filter((a) => !a.isArchived && !a.isSystemDebtAccount)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (₹{acc.balance.toLocaleString('en-IN')})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={interestNotes}
              onChange={(e) => setInterestNotes(e.target.value)}
              placeholder="e.g. EPFO FY 2025-26 Annual Interest"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md shadow-amber-600/20 active:scale-95 transition-all cursor-pointer"
            >
              Save Interest (₹{parseFloat(interestAmount) > 0 ? parseFloat(interestAmount).toLocaleString('en-IN') : '0'})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
