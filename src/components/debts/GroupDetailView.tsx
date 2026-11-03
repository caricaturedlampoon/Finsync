import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ExpenseGroup, GroupExpense, Debt, Account } from '../../types';
import { formatINR, formatDate, toInputDate } from '../../utils/formatters';
import {
  calculateGroupBalances,
  generateExpenseWhatsAppShare,
  generateSettlementWhatsAppShare,
  getMemberDisplayName,
  getMemberPhone,
  simplifyDebts,
  SimplifiedDebtTransfer,
} from '../../utils/groupExpenseEngine';
import { AddGroupExpenseModal } from './AddGroupExpenseModal';
import { GroupReportModal } from './GroupReportModal';
import { GroupShareModal } from './GroupShareModal';
import {
  ArrowLeft,
  Plus,
  Share2,
  Receipt,
  Users,
  Sparkles,
  CheckCircle2,
  Trash2,
  Edit2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar,
  ExternalLink,
  X,
  CreditCard,
  MessageCircle,
  UserPlus,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { useRegisterOverlay } from '../../navigation/NavigationContext';

interface GroupDetailViewProps {
  groupId: string;
  onBack: () => void;
}

export const GroupDetailView: React.FC<GroupDetailViewProps> = ({ groupId, onBack }) => {
  const {
    groups,
    groupExpenses,
    debts,
    accounts,
    categories,
    userProfile,
    deleteGroupExpense,
    deleteGroup,
    settleGroupDebt,
    updateGroup,
    addDebtContact,
    showToast,
  } = useApp();

  const group = groups.find((g) => g.id === groupId);

  // Tabs: 'transactions' | 'balances'
  const [activeTab, setActiveTab] = useState<'transactions' | 'balances'>('transactions');
  const [isSimplifyDebts, setIsSimplifyDebts] = useState(true);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<GroupExpense | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [shareModalState, setShareModalState] = useState<{
    isOpen: boolean;
    expense?: GroupExpense | null;
    settlement?: SimplifiedDebtTransfer | null;
  }>({ isOpen: false });

  // Settle-up modal state
  const [settleModalData, setSettleModalData] = useState<{
    isOpen: boolean;
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
    amount: number;
    phone?: string;
  } | null>(null);

  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(toInputDate(new Date()));
  const [settleAccountId, setSettleAccountId] = useState(() => {
    const defaultAcc = accounts.find((a) => !a.isArchived && !a.isSystemDebtAccount && a.type !== 'debt');
    return defaultAcc ? defaultAcc.id : '';
  });
  const [settleNote, setSettleNote] = useState('');

  // Selected Expense Detail Action Sheet
  const [selectedExpenseForView, setSelectedExpenseForView] = useState<GroupExpense | null>(null);

  // Add Member to Group state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  // Register Tier 1 Modals & Overlays
  useRegisterOverlay(isAddExpenseOpen, 'group_add_expense_modal', 'Add Group Expense', () => setIsAddExpenseOpen(false));
  useRegisterOverlay(isReportModalOpen, 'group_report_modal', 'Group Report', () => setIsReportModalOpen(false));
  useRegisterOverlay(!!settleModalData, 'group_settle_modal', 'Settle Balance', () => setSettleModalData(null));
  useRegisterOverlay(!!selectedExpenseForView, 'group_expense_view', 'Expense Details', () => setSelectedExpenseForView(null));
  useRegisterOverlay(isAddMemberOpen, 'group_add_member_modal', 'Add Group Member', () => setIsAddMemberOpen(false));

  const nonMemberContacts = useMemo(() => {
    return debts.filter((d) => !group?.memberIds.includes(d.id));
  }, [debts, group?.memberIds]);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !group) return;

    const contactId = addDebtContact({
      personName: newMemberName.trim(),
      phone: newMemberPhone.trim() || undefined,
    });

    if (!group.memberIds.includes(contactId)) {
      updateGroup(group.id, {
        memberIds: [...group.memberIds, contactId],
      });
      showToast(`Added ${newMemberName.trim()} to ${group.name}`, 'success');
    }

    setNewMemberName('');
    setNewMemberPhone('');
    setIsAddMemberOpen(false);
  };

  const handleAddExistingContact = (contactId: string) => {
    if (!group) return;
    if (!group.memberIds.includes(contactId)) {
      updateGroup(group.id, {
        memberIds: [...group.memberIds, contactId],
      });
      const contact = debts.find((d) => d.id === contactId);
      showToast(`Added ${contact?.personName || 'member'} to ${group.name}`, 'success');
    }
    setIsAddMemberOpen(false);
  };

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full">
        <p className="text-sm text-slate-500">Group not found or has been deleted.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl"
        >
          Back to Groups
        </button>
      </div>
    );
  }

  const [visibleExpenseCount, setVisibleExpenseCount] = useState(50);

  useEffect(() => {
    setVisibleExpenseCount(50);
  }, [groupId]);

  // Filter expenses for this group with fast string comparison
  const thisGroupExpenses = useMemo(() => {
    return groupExpenses
      .filter((e) => e.groupId === group.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [groupExpenses, group.id]);

  const displayedGroupExpenses = useMemo(() => {
    return thisGroupExpenses.slice(0, visibleExpenseCount);
  }, [thisGroupExpenses, visibleExpenseCount]);

  // Compute Balances
  const { totalSpent, userNetBalance, memberBalances, pairwiseDebts } = useMemo(() => {
    return calculateGroupBalances(group, groupExpenses, debts, userProfile?.name || 'You');
  }, [group, groupExpenses, debts, userProfile]);

  // Display Debts: either simplified via Min-Cash-Flow or standard pairwise
  const displayTransfers: SimplifiedDebtTransfer[] = useMemo(() => {
    if (isSimplifyDebts) {
      return simplifyDebts(memberBalances);
    }
    return pairwiseDebts;
  }, [isSimplifyDebts, memberBalances, pairwiseDebts]);

  // Eligible accounts for settling up
  const eligibleAccounts = useMemo(() => {
    return accounts.filter((a) => !a.isArchived && !a.isSystemDebtAccount && a.type !== 'debt');
  }, [accounts]);

  // Open Settle Up Modal
  const handleOpenSettleModal = (transfer: SimplifiedDebtTransfer) => {
    const phone = getMemberPhone(transfer.fromId === 'user_me' ? transfer.toId : transfer.fromId, debts);
    setSettleModalData({
      isOpen: true,
      fromId: transfer.fromId,
      fromName: transfer.fromName,
      toId: transfer.toId,
      toName: transfer.toName,
      amount: transfer.amount,
      phone,
    });
    setSettleAmount(transfer.amount.toString());
    setSettleDate(toInputDate(new Date()));
    setSettleNote(`Settle group balance`);
  };

  // Submit Settlement
  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleModalData) return;
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    settleGroupDebt({
      groupId: group.id,
      fromMemberId: settleModalData.fromId,
      toMemberId: settleModalData.toId,
      amount: amt,
      accountId: settleAccountId || undefined,
      date: settleDate,
      note: settleNote.trim() || undefined,
    });

    setSettleModalData(null);
  };

  // Share expense via GroupShareModal
  const handleShareExpenseWhatsApp = (exp: GroupExpense, e: React.MouseEvent) => {
    e.stopPropagation();
    setShareModalState({
      isOpen: true,
      expense: exp,
      settlement: null,
    });
  };

  // WhatsApp reminder for settle up via GroupShareModal
  const handleShareSettlementWhatsApp = (transfer: SimplifiedDebtTransfer, e: React.MouseEvent) => {
    e.stopPropagation();
    setShareModalState({
      isOpen: true,
      expense: null,
      settlement: transfer,
    });
  };

  // Summary share for entire group via GroupShareModal
  const handleShareGroupSummaryWhatsApp = () => {
    setShareModalState({
      isOpen: true,
      expense: null,
      settlement: null,
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 pt-safe border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
              {group.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-semibold">
                <Users className="w-3.5 h-3.5" />
                {group.memberIds.length} members
              </span>
              {group.description && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[150px] sm:max-w-xs">{group.description}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions: Export Report (PDF/Excel), WhatsApp Summary, Simplify Debts Toggle & Delete Group */}
        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            title="Generate PDF or Excel/CSV Split Report"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Report & Export</span>
          </button>
          <button
            type="button"
            onClick={handleShareGroupSummaryWhatsApp}
            title="Share Group Summary on WhatsApp"
            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsSimplifyDebts(!isSimplifyDebts)}
            title="Min-Cash-Flow Debts Simplification"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isSimplifyDebts
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Simplify</span>
          </button>
          {confirmDeleteGroup ? (
            <div className="flex items-center gap-1 animate-in fade-in bg-rose-50 dark:bg-rose-950/40 px-2 py-1 rounded-xl border border-rose-200 dark:border-rose-900/60">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">Delete group?</span>
              <button
                type="button"
                onClick={() => {
                  deleteGroup(group.id);
                  onBack();
                }}
                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] active:scale-95 transition-all cursor-pointer"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteGroup(false)}
                className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteGroup(true)}
              title="Delete Group"
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 pb-safe pb-28">
        {/* Group Summary Card */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Group Spent</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                {formatINR(totalSpent)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your Net Balance</p>
              {userNetBalance > 0.01 ? (
                <div>
                  <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                    +{formatINR(userNetBalance)}
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Others owe you</p>
                </div>
              ) : userNetBalance < -0.01 ? (
                <div>
                  <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
                    -{formatINR(Math.abs(userNetBalance))}
                  </p>
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">You owe group</p>
                </div>
              ) : (
                <div>
                  <p className="text-xl sm:text-2xl font-black text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                    ₹0.00
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500">Settled up</p>
                </div>
              )}
            </div>
          </div>

          {/* Export Report Action Row */}
          <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Detailed trip audit, individual shares & settlement instructions
            </span>
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 flex items-center gap-1.5 cursor-pointer bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Generate PDF / Excel Report</span>
            </button>
          </div>
        </div>

        {/* Prominent Primary "Add Group Expense" Action Card */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                Log Expense for {group.name}
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Record a shared bill, dinner split, travel fare, or grocery expense
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingExpense(null);
              setIsAddExpenseOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-teal-600/20 transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Group Expense</span>
          </button>
        </div>

        {/* Group Members Bar with Add Member button (FEATURE 8) */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Group Members ({group.memberIds.length})</span>
            </span>
            <button
              type="button"
              onClick={() => setIsAddMemberOpen(true)}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 flex items-center gap-1.5 cursor-pointer bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {group.memberIds.map((mId) => {
              const name = getMemberDisplayName(mId, debts, userProfile?.name || 'You');
              const isMe = mId === 'user_me';
              return (
                <div
                  key={mId}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                    isMe
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white ${
                      isMe ? 'bg-emerald-600' : 'bg-slate-500'
                    }`}
                  >
                    {name[0]?.toUpperCase() || 'M'}
                  </div>
                  <span className="truncate max-w-[120px]">{name}</span>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setIsAddMemberOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>+ Member</span>
            </button>
          </div>
        </div>

        {/* Segmented Tabs: Transactions vs Balances */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Transactions ({thisGroupExpenses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('balances')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'balances'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Balances & Settle Up ({displayTransfers.length})</span>
          </button>
        </div>

        {/* TAB 1: TRANSACTIONS LIST */}
        {activeTab === 'transactions' && (
          <div className="space-y-2.5">
            {thisGroupExpenses.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                <Receipt className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No expenses recorded yet</p>
                <p className="text-xs text-slate-500 mt-1">Tap &quot;Add Group Expense&quot; below to split your first bill</p>
              </div>
            ) : (
              displayedGroupExpenses.map((exp) => {
                const payerName = getMemberDisplayName(exp.paidBy, debts, userProfile?.name || 'You');
                const userSplit = exp.splits.find((s) => s.memberId === 'user_me');
                const isUserPayer = exp.paidBy === 'user_me';

                return (
                  <div
                    key={exp.id}
                    onClick={() => setSelectedExpenseForView(exp)}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 transition-all flex items-center justify-between gap-3 cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-xs shrink-0">
                        {payerName[0]?.toUpperCase() || 'E'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{exp.title}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <span>Paid by <strong className="font-semibold text-slate-700 dark:text-slate-300">{payerName}</strong></span>
                          <span>•</span>
                          <span>{formatDate(exp.date)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Amount & Share info */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                          {formatINR(exp.totalAmount)}
                        </p>
                        {userSplit ? (
                          <p className={`text-[11px] font-bold tabular-nums ${
                            isUserPayer ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {isUserPayer ? `You lent ${formatINR(exp.totalAmount - userSplit.amount)}` : `Your share ${formatINR(userSplit.amount)}`}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400">Not involved</p>
                        )}
                      </div>

                      {/* WhatsApp quick share button */}
                      <button
                        type="button"
                        onClick={(e) => handleShareExpenseWhatsApp(exp, e)}
                        title="Share on WhatsApp"
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {thisGroupExpenses.length > visibleExpenseCount && (
              <div className="text-center pt-2 pb-1">
                <button
                  type="button"
                  onClick={() => setVisibleExpenseCount((prev) => prev + 50)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  Load More Expenses ({visibleExpenseCount} of {thisGroupExpenses.length})
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BALANCES & SETTLE UP */}
        {activeTab === 'balances' && (
          <div className="space-y-4">
            {/* Member Net Summary Strip */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Member Net Positions</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {memberBalances.map((m) => (
                  <div
                    key={m.memberId}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {m.memberName} {m.memberId === 'user_me' ? '(You)' : ''}
                    </p>
                    <p className={`text-xs font-black tabular-nums mt-0.5 ${
                      m.net > 0.01 ? 'text-emerald-600 dark:text-emerald-400' : m.net < -0.01 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                    }`}>
                      {m.net > 0.01 ? `+${formatINR(m.net)}` : m.net < -0.01 ? `-${formatINR(Math.abs(m.net))}` : '₹0.00'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Transfers / Settle Up Recommendations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isSimplifyDebts ? 'Optimized Settlements (Min-Cash-Flow)' : 'Pairwise Direct Debts'}
                </p>
                <span className="text-[11px] text-slate-400">
                  {displayTransfers.length} transaction{displayTransfers.length !== 1 ? 's' : ''} to settle
                </span>
              </div>

              {displayTransfers.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                  <p className="text-sm font-bold">All balances are completely settled!</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Nobody in this group owes anything.</p>
                </div>
              ) : (
                displayTransfers.map((trans, idx) => {
                  const isUserInvolved = trans.fromId === 'user_me' || trans.toId === 'user_me';
                  const userIsDebtor = trans.fromId === 'user_me';

                  return (
                    <div
                      key={`${trans.fromId}_${trans.toId}_${idx}`}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isUserInvolved
                          ? 'bg-white dark:bg-slate-900 border-emerald-500/30 dark:border-emerald-500/20 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {trans.fromName}
                            </span>
                            <span className="text-xs text-slate-400">owes</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {trans.toName}
                            </span>
                          </div>
                          {isUserInvolved && (
                            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {userIsDebtor ? 'You need to pay' : 'You are receiving this'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Action & Amount */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                          {formatINR(trans.amount)}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Settle Up Action */}
                          <button
                            type="button"
                            onClick={() => handleOpenSettleModal(trans)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                          >
                            <span>Settle Up</span>
                          </button>

                          {/* WhatsApp Reminder Share */}
                          <button
                            type="button"
                            onClick={(e) => handleShareSettlementWhatsApp(trans, e)}
                            title="Send WhatsApp Reminder"
                            className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating CTA Button: "Add Group Expense" */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shrink-0">
        <button
          type="button"
          onClick={() => {
            setEditingExpense(null);
            setIsAddExpenseOpen(true);
          }}
          className="w-full py-3.5 px-4 rounded-full sm:rounded-2xl bg-white hover:bg-slate-100 dark:bg-white dark:hover:bg-slate-100 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-black/10 active:scale-[0.99] transition-all cursor-pointer border border-slate-200 dark:border-transparent"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Add Group Expense</span>
        </button>
      </div>

      {/* Settle Up Modal Sheet */}
      {settleModalData && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Settle Balance</h3>
                <p className="text-xs text-slate-500">
                  {settleModalData.fromName} → {settleModalData.toName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSettle} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Settlement Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  required
                  min="0.01"
                  value={settleAmount}
                  onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-lg font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-hidden"
                />
              </div>

              {(settleModalData.fromId === 'user_me' || settleModalData.toId === 'user_me') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {settleModalData.fromId === 'user_me' ? 'Paid from Account' : 'Received into Account'}
                  </label>
                  <select
                    value={settleAccountId}
                    onChange={(e) => setSettleAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    {eligibleAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatINR(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Note</label>
                  <input
                    type="text"
                    value={settleNote}
                    onChange={(e) => setSettleNote(e.target.value)}
                    placeholder="e.g. Google Pay / Cash"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSettleModalData(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  Confirm Settle Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Expense Detail Sheet */}
      {selectedExpenseForView && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{selectedExpenseForView.title}</h3>
                <p className="text-xs text-slate-500">{formatDate(selectedExpenseForView.date)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExpenseForView(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Bill Amount:</span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatINR(selectedExpenseForView.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Paid by:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {getMemberDisplayName(selectedExpenseForView.paidBy, debts, userProfile?.name || 'You')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Split Method:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">
                  {selectedExpenseForView.splitType}
                </span>
              </div>
              {selectedExpenseForView.note && (
                <div className="pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                  Note: {selectedExpenseForView.note}
                </div>
              )}
            </div>

            {/* Split breakdown */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Member Breakdown:</p>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {selectedExpenseForView.splits.map((s) => (
                  <div key={s.memberId} className="flex justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {getMemberDisplayName(s.memberId, debts, userProfile?.name || 'You')}
                    </span>
                    <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatINR(s.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2">
              {confirmDeleteExpense ? (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 animate-in fade-in">
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Delete this expense?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        deleteGroupExpense(selectedExpenseForView.id);
                        setSelectedExpenseForView(null);
                        setConfirmDeleteExpense(false);
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs active:scale-95 transition-all shadow-xs cursor-pointer"
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteExpense(false)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleShareExpenseWhatsApp(selectedExpenseForView, e)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingExpense(selectedExpenseForView);
                      setSelectedExpenseForView(null);
                      setIsAddExpenseOpen(true);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteExpense(true)}
                    className="py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Group Expense Modal */}
      <AddGroupExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => {
          setIsAddExpenseOpen(false);
          setEditingExpense(null);
        }}
        group={group}
        existingExpense={editingExpense}
      />

      {/* Add Member to Group Modal (FEATURE 8) */}
      {isAddMemberOpen && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsAddMemberOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Member to Group</h3>
                  <p className="text-[11px] text-slate-400">Add to {group.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Member Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Rahul, Priya, Vikram"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number / UPI (Optional)
                </label>
                <input
                  type="text"
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  placeholder="e.g. 9876543210 or name@upi"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Optional: Pick from existing contacts not yet in this group */}
              {nonMemberContacts.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Or Add from Existing Contacts ({nonMemberContacts.length})
                  </span>
                  <div className="max-h-32 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 p-1 bg-slate-50/50 dark:bg-slate-800">
                    {nonMemberContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => handleAddExistingContact(contact.id)}
                        className="w-full p-2 flex items-center justify-between text-left hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {contact.personName[0]?.toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {contact.personName}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                          + Add
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newMemberName.trim()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Add Member</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Report & Export Modal (PDF, Excel/CSV, WhatsApp) */}
      <GroupReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        group={group}
        expenses={thisGroupExpenses}
        debts={debts}
        categories={categories}
        userProfileName={userProfile?.name || 'You'}
        showToast={showToast}
      />

      {/* Group Native Intent Share Modal (z-[999]) */}
      <GroupShareModal
        isOpen={shareModalState.isOpen}
        onClose={() => setShareModalState({ isOpen: false })}
        group={group}
        expense={shareModalState.expense}
        settlement={shareModalState.settlement}
      />
    </div>
  );
};
