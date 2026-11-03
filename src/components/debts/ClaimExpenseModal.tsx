import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { parseExpenseClaimPayload, ExpenseClaimPayload } from '../../utils/groupExpenseEngine';
import { formatINR, formatDate } from '../../utils/formatters';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import {
  X,
  Check,
  Receipt,
  Users,
  CreditCard,
  Tag,
  Landmark,
  Edit2,
  Calendar,
  Sparkles,
  Smartphone,
  ChevronDown,
  Info,
} from 'lucide-react';

export const ClaimExpenseModal: React.FC = () => {
  const {
    accounts,
    categories,
    userProfile,
    importGroupExpenseFromClaim,
    setIsDebtsModalOpen,
    showToast,
  } = useApp();

  const { isInstallable, install } = usePWAInstall();

  const [isOpen, setIsOpen] = useState(false);
  const [claimPayload, setClaimPayload] = useState<ExpenseClaimPayload | null>(null);

  // Selected member identity
  const [selectedMemberName, setSelectedMemberName] = useState('');
  const [customShareAmount, setCustomShareAmount] = useState('');

  // Editable fields ("or edit")
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editTotalAmount, setEditTotalAmount] = useState('');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');

  // Dual-entry settings: Bank Account and Category
  const [categoryId, setCategoryId] = useState('cat_dining');
  const [accountId, setAccountId] = useState('');

  // Eligible accounts for paying
  const eligibleAccounts = useMemo(() => {
    return accounts.filter((a) => !a.isArchived && !a.isSystemDebtAccount && a.type !== 'debt');
  }, [accounts]);

  // Inspect URL query on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const dataParam = searchParams.get('data') || searchParams.get('claim');

      if (dataParam) {
        const parsed = parseExpenseClaimPayload(dataParam);
        if (parsed && parsed.shares && parsed.shares.length > 0) {
          setClaimPayload(parsed);
          setEditTitle(parsed.title);
          setEditTotalAmount(parsed.amount.toString());
          setEditPaidBy(parsed.paidBy);
          setEditDate(parsed.date);
          setEditNote(parsed.note || '');

          // Find best matching member name
          const userProfName = (userProfile?.name || '').trim().toLowerCase();
          const match = parsed.shares.find(
            (s) =>
              s.name.trim().toLowerCase() === userProfName ||
              s.name.trim().toLowerCase() === 'you' ||
              s.name.trim().toLowerCase() === 'me'
          );

          if (match) {
            setSelectedMemberName(match.name);
            setCustomShareAmount(match.amount.toString());
          } else {
            // Default to first non-payer or first member
            const nonPayer = parsed.shares.find((s) => s.name.toLowerCase() !== parsed.paidBy.toLowerCase());
            const chosen = nonPayer || parsed.shares[0];
            setSelectedMemberName(chosen.name);
            setCustomShareAmount(chosen.amount.toString());
          }

          if (eligibleAccounts.length > 0) {
            setAccountId(eligibleAccounts[0].id);
          }

          setIsOpen(true);
        }
      }
    } catch (e) {
      console.error('Error reading claim parameter', e);
    }
  }, [userProfile, eligibleAccounts]);

  const cleanUrl = () => {
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    cleanUrl();
  };

  if (!isOpen || !claimPayload) return null;

  // Selected share
  const activeShare = claimPayload.shares.find((s) => s.name === selectedMemberName);
  const shareAmount = parseFloat(customShareAmount) || (activeShare ? activeShare.amount : 0);
  const currentTotalAmount = parseFloat(editTotalAmount) || claimPayload.amount;

  // Is user the payer?
  const isUserPayer =
    selectedMemberName.toLowerCase() === editPaidBy.toLowerCase() ||
    editPaidBy.toLowerCase() === 'you' ||
    editPaidBy.toLowerCase() === (userProfile?.name || '').toLowerCase();

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberName.trim()) {
      showToast('Please select which participant you are', 'error');
      return;
    }

    const finalTitle = editTitle.trim() || claimPayload.title;
    const finalPaidBy = editPaidBy.trim() || claimPayload.paidBy;

    // Update shares with custom share amount for the user
    const updatedShares = claimPayload.shares.map((s) => {
      if (s.name === selectedMemberName) {
        return { ...s, amount: shareAmount };
      }
      return s;
    });

    const res = importGroupExpenseFromClaim({
      groupName: claimPayload.gName,
      title: finalTitle,
      totalAmount: currentTotalAmount,
      paidByName: finalPaidBy,
      userMemberName: selectedMemberName,
      userShareAmount: shareAmount,
      date: editDate || claimPayload.date,
      time: claimPayload.time,
      note: editNote.trim() || undefined,
      splitType: claimPayload.splitType,
      shares: updatedShares,
      categoryId,
      accountId: accountId || undefined,
    });

    if (res.success) {
      setIsOpen(false);
      cleanUrl();
      setIsDebtsModalOpen(true);
    }
  };

  return (
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Group Expense Receipt</h2>
              <p className="text-xs text-slate-500 truncate">{claimPayload.gName}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                isEditing
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title="Edit Receipt Details"
            >
              <Edit2 className="w-3 h-3" />
              <span>{isEditing ? 'Done' : 'Edit'}</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleImport} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Editable Details Mode */}
          {isEditing ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Edit Receipt Details</span>
                </span>
                <span className="text-[10px] text-slate-400">Modify before saving</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Expense Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Total Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editTotalAmount}
                    onChange={(e) => setEditTotalAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Paid By
                  </label>
                  <input
                    type="text"
                    value={editPaidBy}
                    onChange={(e) => setEditPaidBy(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Your Share Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={customShareAmount}
                    onChange={(e) => setCustomShareAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-600 dark:text-emerald-400 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Note
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Optional note"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>
          ) : (
            /* Normal Receipt Card */
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {claimPayload.gName}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                    {editTitle || claimPayload.title}
                  </h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    Paid by <strong className="text-slate-800 dark:text-slate-200 font-bold">{editPaidBy || claimPayload.paidBy}</strong> · {formatDate(editDate || claimPayload.date)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                    ₹{formatINR(currentTotalAmount)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Total bill</span>
                </div>
              </div>

              {(editNote || claimPayload.note) && (
                <p className="text-xs text-slate-600 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 italic">
                  "{editNote || claimPayload.note}"
                </p>
              )}
            </div>
          )}

          {/* Breakdown List */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Bill Breakdown:</span>
            <div className="space-y-1 max-h-32 overflow-y-auto rounded-xl bg-slate-50 dark:bg-slate-800/40 p-2 border border-slate-200/60 dark:border-slate-800">
              {claimPayload.shares.map((s, idx) => (
                <div
                  key={`${s.name}_${idx}`}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{s.name}</span>
                  <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                    ₹{formatINR(s.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Select User's Identity in this Split */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Which member are you in this split?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {claimPayload.shares.map((s, idx) => {
                const isSelected = selectedMemberName === s.name;
                return (
                  <button
                    key={`${s.name}_${idx}`}
                    type="button"
                    onClick={() => {
                      setSelectedMemberName(s.name);
                      setCustomShareAmount(s.amount.toString());
                    }}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold truncate">{s.name}</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold tabular-nums">
                      ₹{formatINR(s.amount)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calculated Net Effect Card */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Your Calculated Share:
              </span>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                ₹{formatINR(shareAmount)}
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
              {isUserPayer
                ? `You paid this expense. ₹${formatINR(shareAmount)} is your personal share, and ₹${formatINR(currentTotalAmount - shareAmount)} will be created as receivables in other members' debt ledgers.`
                : `You owe ₹${formatINR(shareAmount)} to ${editPaidBy || claimPayload.paidBy}. This will be added to ${editPaidBy || claimPayload.paidBy}'s debt ledger as a payable liability and logged in your personal expenses.`}
            </p>
          </div>

          {/* Choose Bank Account & Category */}
          <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Choose Bank Account</span>
                </label>
                <span className="text-[10px] text-slate-400">
                  {isUserPayer ? 'Deducts full bill' : 'Link for payment/repayment'}
                </span>
              </div>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                {eligibleAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (Balance: ₹{formatINR(a.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Personal Expense Category</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                {categories
                  .filter((c) => c.type === 'expense')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* PWA Offline Banner */}
          {isInstallable && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Install app to track debts 100% offline
                </span>
              </div>
              <button
                type="button"
                onClick={install}
                className="px-2.5 py-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-lg shrink-0 cursor-pointer"
              >
                Install
              </button>
            </div>
          )}

          {/* Action CTAs */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save Receipt Entry</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
