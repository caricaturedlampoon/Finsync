import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ExpenseGroup, GroupExpense, GroupSplitType, GroupExpenseSplit, Debt, Account } from '../../types';
import { formatINR, toInputDate } from '../../utils/formatters';
import {
  calculateEqualSplits,
  calculateExactSplitsRemainder,
  calculatePercentageSplits,
  calculateSharesSplits,
  getMemberDisplayName,
} from '../../utils/groupExpenseEngine';
import {
  X,
  Plus,
  Receipt,
  Calculator,
  Calendar,
  Clock,
  User,
  CreditCard,
  Tag,
  Check,
  AlertCircle,
  Percent,
  Divide,
  Hash,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Search,
  Layers,
} from 'lucide-react';
import { AccountAvatar } from '../common/AccountAvatar';
import { AccountSelectFullScreenModal } from '../common/AccountSelectFullScreenModal';
import { IconRenderer } from '../common/IconRenderer';

interface AddGroupExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ExpenseGroup;
  existingExpense?: GroupExpense | null;
}

export const AddGroupExpenseModal: React.FC<AddGroupExpenseModalProps> = ({
  isOpen,
  onClose,
  group,
  existingExpense,
}) => {
  const {
    debts,
    accounts,
    categories,
    userProfile,
    addGroupExpense,
    updateGroupExpense,
    showToast,
  } = useApp();

  // Basic Form States
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paidBy, setPaidBy] = useState('user_me');
  const [date, setDate] = useState(toInputDate(new Date()));
  const [time, setTime] = useState(() => {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  });
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('cat_dining');
  const [accountId, setAccountId] = useState('');
  const [includeMyShareInPersonal, setIncludeMyShareInPersonal] = useState(true);

  // Split Mode: EQUAL, EXACT, PERCENT, SHARES
  const [splitType, setSplitType] = useState<GroupSplitType>('EQUAL');

  // Involvement Map: memberId -> boolean
  const [involvedMembers, setInvolvedMembers] = useState<Record<string, boolean>>({});

  // Custom Input Maps:
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentShares, setPercentShares] = useState<Record<string, string>>({});
  const [unitShares, setUnitShares] = useState<Record<string, string>>({});

  // Mini-calculator popover
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');

  // Filter bank/cash accounts eligible for payer
  const eligibleAccounts = useMemo(() => {
    return accounts.filter((a) => !a.isArchived && !a.isSystemDebtAccount && a.type !== 'debt');
  }, [accounts]);

  // Full-screen Account & Category selection screens
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  const expenseCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'expense');
  }, [categories]);

  const modalAccountsList = useMemo(() => {
    if (!accountSearch.trim()) return eligibleAccounts;
    const q = accountSearch.toLowerCase();
    return eligibleAccounts.filter(
      (a) => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)
    );
  }, [eligibleAccounts, accountSearch]);

  const modalCategoriesList = useMemo(() => {
    if (!categorySearch.trim()) return expenseCategories;
    const q = categorySearch.toLowerCase();
    return expenseCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [expenseCategories, categorySearch]);

  const selectedAccount = useMemo(() => {
    return eligibleAccounts.find((a) => a.id === accountId) || eligibleAccounts[0];
  }, [eligibleAccounts, accountId]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === categoryId) || categories[0];
  }, [categories, categoryId]);

  // Initialize or reset form on open
  useEffect(() => {
    if (isOpen) {
      if (existingExpense) {
        setTitle(existingExpense.title);
        setAmountStr(existingExpense.totalAmount.toString());
        setPaidBy(existingExpense.paidBy);
        setDate(existingExpense.date);
        setTime(existingExpense.time || '');
        setNote(existingExpense.note || '');
        setCategoryId(existingExpense.categoryId || 'cat_dining');
        setAccountId(existingExpense.accountId || (eligibleAccounts[0]?.id || ''));
        setIncludeMyShareInPersonal(existingExpense.includeMyShareInPersonal !== false);
        setSplitType(existingExpense.splitType);

        // Prepopulate involvement & custom values
        const invMap: Record<string, boolean> = {};
        const exactMap: Record<string, string> = {};
        const pMap: Record<string, string> = {};
        const sMap: Record<string, string> = {};

        group.memberIds.forEach((mId) => {
          const split = existingExpense.splits.find((s) => s.memberId === mId);
          if (split) {
            invMap[mId] = true;
            exactMap[mId] = split.amount.toString();
            if (split.percentage !== undefined) pMap[mId] = split.percentage.toString();
            if (split.shares !== undefined) sMap[mId] = split.shares.toString();
          } else {
            invMap[mId] = false;
            exactMap[mId] = '0';
            pMap[mId] = '0';
            sMap[mId] = '1';
          }
        });

        setInvolvedMembers(invMap);
        setExactAmounts(exactMap);
        setPercentShares(pMap);
        setUnitShares(sMap);
      } else {
        setTitle('');
        setAmountStr('');
        setPaidBy('user_me');
        setDate(toInputDate(new Date()));
        const d = new Date();
        setTime(d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
        setNote('');
        setCategoryId('cat_dining');
        setAccountId(eligibleAccounts[0]?.id || '');
        setIncludeMyShareInPersonal(true);
        setSplitType('EQUAL');

        // All group members involved by default
        const invMap: Record<string, boolean> = {};
        const exactMap: Record<string, string> = {};
        const pMap: Record<string, string> = {};
        const sMap: Record<string, string> = {};

        group.memberIds.forEach((mId) => {
          invMap[mId] = true;
          exactMap[mId] = '';
          pMap[mId] = (100 / group.memberIds.length).toFixed(1);
          sMap[mId] = '1';
        });

        setInvolvedMembers(invMap);
        setExactAmounts(exactMap);
        setPercentShares(pMap);
        setUnitShares(sMap);
      }
      setIsCalcOpen(false);
      setCalcExpression('');
    }
  }, [isOpen, existingExpense, group, eligibleAccounts]);

  const totalAmount = parseFloat(amountStr) || 0;

  // Active member IDs checked for split
  const activeMemberIds = useMemo(() => {
    return group.memberIds.filter((mId) => involvedMembers[mId]);
  }, [group.memberIds, involvedMembers]);

  // Compute calculated splits depending on mode
  const computedSplits = useMemo((): { splits: GroupExpenseSplit[]; isValid: boolean; errorMsg?: string } => {
    if (activeMemberIds.length === 0) {
      return { splits: [], isValid: false, errorMsg: 'Select at least one member to split with' };
    }
    if (totalAmount <= 0) {
      return { splits: [], isValid: false, errorMsg: 'Enter an amount greater than zero' };
    }

    if (splitType === 'EQUAL') {
      const splits = calculateEqualSplits(totalAmount, activeMemberIds);
      return { splits, isValid: true };
    }

    if (splitType === 'EXACT') {
      let sum = 0;
      const splits: GroupExpenseSplit[] = activeMemberIds.map((mId) => {
        const val = parseFloat(exactAmounts[mId] || '0') || 0;
        sum += val;
        return {
          memberId: mId,
          amount: Math.round(val * 100) / 100,
        };
      });

      const diff = Math.round((totalAmount - sum) * 100) / 100;
      if (Math.abs(diff) > 0.05) {
        return {
          splits,
          isValid: false,
          errorMsg: diff > 0 ? `₹${formatINR(diff)} remaining to allocate` : `Over-allocated by ₹${formatINR(Math.abs(diff))}`,
        };
      }
      return { splits, isValid: true };
    }

    if (splitType === 'PERCENT') {
      let sumPct = 0;
      const memberPercents = activeMemberIds.map((mId) => {
        const pct = parseFloat(percentShares[mId] || '0') || 0;
        sumPct += pct;
        return { memberId: mId, percentage: pct };
      });

      const diff = Math.round((100 - sumPct) * 10) / 10;
      if (Math.abs(diff) > 0.5) {
        return {
          splits: [],
          isValid: false,
          errorMsg: diff > 0 ? `${diff}% remaining (Total must be 100%)` : `Percentages exceed 100% by ${Math.abs(diff)}%`,
        };
      }

      const splits = calculatePercentageSplits(totalAmount, memberPercents);
      return { splits, isValid: true };
    }

    if (splitType === 'SHARES') {
      const memberShares = activeMemberIds.map((mId) => {
        const sh = parseFloat(unitShares[mId] || '1') || 1;
        return { memberId: mId, shares: Math.max(0.1, sh) };
      });

      const splits = calculateSharesSplits(totalAmount, memberShares);
      return { splits, isValid: true };
    }

    return { splits: [], isValid: false };
  }, [splitType, totalAmount, activeMemberIds, exactAmounts, percentShares, unitShares]);

  // Mini Calculator evaluate
  const handleEvaluateCalc = () => {
    try {
      // Clean and evaluate math expression safely
      const sanitized = calcExpression.replace(/[^0-9+\-*/.]/g, '');
      if (!sanitized) return;
      // eslint-disable-next-line no-eval
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result === 'number' && !isNaN(result) && result >= 0) {
        const rounded = Math.round(result * 100) / 100;
        setAmountStr(rounded.toString());
        setIsCalcOpen(false);
        setCalcExpression('');
        showToast(`Calculated: ₹${formatINR(rounded)}`, 'info');
      }
    } catch {
      showToast('Invalid math expression', 'error');
    }
  };

  // Toggle member involvement
  const toggleMemberInvolvement = (mId: string) => {
    setInvolvedMembers((prev) => ({
      ...prev,
      [mId]: !prev[mId],
    }));
  };

  // Auto-distribute remainder for exact amounts
  const handleAutoFillRemainder = (targetMemberId: string) => {
    let otherSum = 0;
    activeMemberIds.forEach((mId) => {
      if (mId !== targetMemberId) {
        otherSum += parseFloat(exactAmounts[mId] || '0') || 0;
      }
    });
    const remainder = Math.max(0, Math.round((totalAmount - otherSum) * 100) / 100);
    setExactAmounts((prev) => ({
      ...prev,
      [targetMemberId]: remainder.toString(),
    }));
  };

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter an expense title', 'error');
      return;
    }
    if (totalAmount <= 0) {
      showToast('Please enter an amount', 'error');
      return;
    }
    if (!computedSplits.isValid || computedSplits.splits.length === 0) {
      showToast(computedSplits.errorMsg || 'Please fix the split allocation', 'error');
      return;
    }

    const payerName = getMemberDisplayName(paidBy, debts, userProfile?.name || 'You');

    const expensePayload: Omit<GroupExpense, 'id' | 'createdAt'> = {
      groupId: group.id,
      title: title.trim(),
      totalAmount,
      paidBy,
      paidByName: payerName,
      date,
      time,
      splitType,
      splits: computedSplits.splits,
      note: note.trim() || undefined,
      categoryId,
      accountId: paidBy === 'user_me' ? accountId : undefined,
      includeMyShareInPersonal,
    };

    if (existingExpense) {
      updateGroupExpense(existingExpense.id, expensePayload);
    } else {
      addGroupExpense(expensePayload);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
      {/* Top App Bar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {existingExpense ? 'Edit Group Expense' : 'Add Group Expense'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs">{group.name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close Expense"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Main Full Screen Form Body */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4">
          {/* Title & Amount Container */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Description / Title
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Beach Shack Dinner, Taxi, Villa Booking"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-500"
                />
                <Receipt className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            {/* Total Amount + Mini-calculator toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Amount (₹)</label>
                <button
                  type="button"
                  onClick={() => setIsCalcOpen(!isCalcOpen)}
                  className={`text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                    isCalcOpen
                      ? 'bg-emerald-500 text-white'
                      : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  Mini Calc
                </button>
              </div>

              <div className="relative">
                <div className="absolute left-3.5 top-2.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">₹</div>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xl font-black text-slate-900 dark:text-white tabular-nums placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Inline Mini-Calculator Drawer */}
              {isCalcOpen && (
                <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in duration-100">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={calcExpression}
                      onChange={(e) => setCalcExpression(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleEvaluateCalc();
                        }
                      }}
                      placeholder="e.g. 450 + 120 * 2"
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleEvaluateCalc}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-500 cursor-pointer"
                    >
                      Apply =
                    </button>
                  </div>
                  {/* Quick helper buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['+100', '+500', '+1000', '+2000'].map((btn) => (
                      <button
                        key={btn}
                        type="button"
                        onClick={() => {
                          const curr = parseFloat(amountStr) || 0;
                          const addVal = parseFloat(btn.replace('+', ''));
                          setAmountStr((curr + addVal).toString());
                        }}
                        className="px-2 py-1 bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold rounded-lg text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        {btn}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCalcExpression('')}
                      className="ml-auto px-2 py-1 text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payer Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Paid By</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaidBy('user_me')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  paidBy === 'user_me'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-bold'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  You
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">You ({userProfile?.name || 'Me'})</p>
                </div>
              </button>

              {group.memberIds
                .filter((mId) => mId !== 'user_me')
                .map((mId) => {
                  const name = getMemberDisplayName(mId, debts);
                  const isSelected = paidBy === mId;
                  return (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => setPaidBy(mId)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                        {name[0]?.toUpperCase() || 'M'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{name}</p>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* DUAL-ENTRY LOGIC: Personal Expense Category & Payment Account */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            {paidBy === 'user_me' ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                    Paid from Account
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountSearch('');
                      setIsAccountPickerOpen(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-xs max-w-[200px]"
                  >
                    {selectedAccount && <AccountAvatar account={selectedAccount} size="xs" />}
                    <span className="truncate flex-1 text-left">{selectedAccount?.name || 'Select Account'}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">Change</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    Category for Your Share
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCategorySearch('');
                      setIsCategoryPickerOpen(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-xs max-w-[200px]"
                  >
                    {selectedCategory && (
                      <div
                        className="w-4 h-4 rounded-md flex items-center justify-center text-white shrink-0 text-[10px]"
                        style={{ backgroundColor: selectedCategory.color }}
                      >
                        <IconRenderer name={selectedCategory.icon} className="w-2.5 h-2.5" />
                      </div>
                    )}
                    <span className="truncate flex-1 text-left">{selectedCategory?.name || 'Select Category'}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">Change</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-500 leading-relaxed">
                  💡 <strong>Dual-Entry:</strong> Full bill will be deducted from your account. Your share is logged as personal expense, and friends' shares are posted to their receivable debt ledgers.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    Category for Your Share
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCategorySearch('');
                      setIsCategoryPickerOpen(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-xs max-w-[200px]"
                  >
                    {selectedCategory && (
                      <div
                        className="w-4 h-4 rounded-md flex items-center justify-center text-white shrink-0 text-[10px]"
                        style={{ backgroundColor: selectedCategory.color }}
                      >
                        <IconRenderer name={selectedCategory.icon} className="w-2.5 h-2.5" />
                      </div>
                    )}
                    <span className="truncate flex-1 text-left">{selectedCategory?.name || 'Select Category'}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">Change</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-500 leading-relaxed">
                  💡 <strong>Dual-Entry:</strong> ₹0 deducted from bank accounts now. Your calculated share is logged under personal expenses, and added as a payable debt to {getMemberDisplayName(paidBy, debts)}.
                </p>
              </>
            )}
          </div>

          {/* Split Mode Picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Split Method</label>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {activeMemberIds.length} member{activeMemberIds.length !== 1 ? 's' : ''} involved
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSplitType('EQUAL')}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  splitType === 'EQUAL'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <Divide className="w-3.5 h-3.5" />
                <span>Equal</span>
              </button>

              <button
                type="button"
                onClick={() => setSplitType('EXACT')}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  splitType === 'EXACT'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <span>₹ Exact</span>
              </button>

              <button
                type="button"
                onClick={() => setSplitType('PERCENT')}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  splitType === 'PERCENT'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>%</span>
              </button>

              <button
                type="button"
                onClick={() => setSplitType('SHARES')}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  splitType === 'SHARES'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                <span>Shares</span>
              </button>
            </div>
          </div>

          {/* Members Breakdown & Custom Share Inputs */}
          <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-50/50 dark:bg-slate-800/40">
            {group.memberIds.map((mId) => {
              const name = getMemberDisplayName(mId, debts, userProfile?.name || 'You');
              const isInvolved = !!involvedMembers[mId];
              const computedSplit = computedSplits.splits.find((s) => s.memberId === mId);

              return (
                <div
                  key={mId}
                  className={`flex items-center justify-between gap-3 p-2 rounded-xl transition-colors ${
                    isInvolved
                      ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xs'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isInvolved}
                      onChange={() => toggleMemberInvolvement(mId)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {name} {mId === 'user_me' ? '(You)' : ''}
                      </p>
                      {isInvolved && computedSplit && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                          Share: ₹{formatINR(computedSplit.amount)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Mode-Specific Member Inputs */}
                  {isInvolved && (
                    <div className="flex items-center gap-2 shrink-0">
                      {splitType === 'EXACT' && (
                        <div className="flex items-center gap-1">
                          <div className="relative">
                            <span className="absolute left-2 top-1.5 text-xs text-slate-400">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={exactAmounts[mId] || ''}
                              onChange={(e) =>
                                setExactAmounts({ ...exactAmounts, [mId]: e.target.value })
                              }
                              className="w-24 pl-5 pr-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-right focus:outline-hidden focus:border-emerald-500"
                            />
                          </div>
                          <button
                            type="button"
                            title="Fill remaining balance to this person"
                            onClick={() => handleAutoFillRemainder(mId)}
                            className="p-1 text-[10px] bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white rounded text-slate-700 dark:text-slate-300 font-bold"
                          >
                            Fill
                          </button>
                        </div>
                      )}

                      {splitType === 'PERCENT' && (
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="0"
                            value={percentShares[mId] || ''}
                            onChange={(e) =>
                              setPercentShares({ ...percentShares, [mId]: e.target.value })
                            }
                            className="w-20 pl-2 pr-5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-right focus:outline-hidden focus:border-emerald-500"
                          />
                          <span className="absolute right-2 top-1.5 text-xs text-slate-400">%</span>
                        </div>
                      )}

                      {splitType === 'SHARES' && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={unitShares[mId] || '1'}
                            onChange={(e) =>
                              setUnitShares({ ...unitShares, [mId]: e.target.value })
                            }
                            className="w-16 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-center focus:outline-hidden focus:border-emerald-500"
                          />
                          <span className="text-xs text-slate-500">share{parseFloat(unitShares[mId] || '1') !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Validation Warning / Error Notice */}
          {!computedSplits.isValid && computedSplits.errorMsg && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center gap-2 text-xs font-medium text-amber-800 dark:amber-300">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{computedSplits.errorMsg}</span>
            </div>
          )}

          {/* Date & Note Collapsible or Compact Row */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Optional Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Notes or bill info"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!computedSplits.isValid}
              className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                computedSplits.isValid
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{existingExpense ? 'Save Changes' : 'Save Expense'}</span>
            </button>
          </div>
        </form>
      </main>

      {/* FULL-SCREEN Account Selection (Grouped by Banks, Credit Cards, Wallets) */}
      <AccountSelectFullScreenModal
        isOpen={isAccountPickerOpen}
        onClose={() => setIsAccountPickerOpen(false)}
        onSelect={(acc) => {
          setAccountId(acc.id);
          setIsAccountPickerOpen(false);
        }}
        selectedAccountId={accountId}
        title="Select Payment Bank Account"
        subtitle="Grouped by Bank Accounts, Credit Cards, and Wallets"
      />

      {/* FULL-SCREEN Category Selection (Accommodates up to 16 items with compact icons and labels) */}
      {isCategoryPickerOpen && (
        <div className="fixed inset-0 z-70 bg-white dark:bg-slate-900 flex flex-col h-full w-full overflow-hidden animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsCategoryPickerOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Back to Entry"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Select Expense Category</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {expenseCategories.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Tap any category to select and return</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCategoryPickerOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 sm:px-6 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="relative max-w-xl mx-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search category name..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="p-3 sm:p-5 overflow-y-auto flex-1">
            <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 gap-2 sm:gap-2.5 max-w-4xl mx-auto">
              {modalCategoriesList.map((cat) => {
                const isSelected = cat.id === categoryId;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(cat.id);
                      setIsCategoryPickerOpen(false);
                    }}
                    className={`p-2 sm:p-2.5 rounded-2xl border flex flex-col items-center justify-between text-center transition-all cursor-pointer min-h-[76px] sm:min-h-[82px] relative overflow-hidden active:scale-95 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/30 shadow-xs'
                        : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                    <div
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white mb-1 shadow-xs shrink-0"
                      style={{ backgroundColor: cat.color }}
                    >
                      <IconRenderer name={cat.icon} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-bold truncate w-full leading-tight block">
                      {cat.name}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium truncate w-full mt-0.5 block capitalize">
                      {cat.type}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
