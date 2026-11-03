import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Debt, Transaction, ExpenseGroup } from '../../types';
import {
  formatINR,
  formatDate,
  toInputDate,
  getDebtContactSummary,
  SYSTEM_DEBT_ACCOUNT_ID,
} from '../../utils/formatters';
import { calculateGroupBalances } from '../../utils/groupExpenseEngine';
import {
  generateConsolidatedDebtsReportHTML,
  generateContactStatementHTML,
} from '../../utils/debtsReportEngine';
import { GroupDetailView } from './GroupDetailView';
import { CreateGroupModal } from './CreateGroupModal';
import { CustomTransactionShareModal } from './CustomTransactionShareModal';
import { AccountAvatar } from '../common/AccountAvatar';
import { AccountSelectFullScreenModal } from '../common/AccountSelectFullScreenModal';
import {
  X,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  User,
  Users,
  Calendar,
  Clock,
  Landmark,
  FileText,
  Edit2,
  Trash2,
  HelpCircle,
  Coins,
  ArrowLeft,
  SlidersHorizontal,
  Phone,
  Share2,
  Printer,
  Search,
} from 'lucide-react';

export type DebtScreen = 'dashboard' | 'add_contact' | 'contact_detail' | 'add_record';

export interface UnifiedDebtsViewProps {
  initialTab?: 'individual' | 'groups';
  isModal?: boolean;
  onClose?: () => void;
}

export const UnifiedDebtsView: React.FC<UnifiedDebtsViewProps> = ({
  initialTab,
  isModal = false,
  onClose,
}) => {
  const {
    debts,
    transactions,
    accounts,
    selectedDebtId,
    setSelectedDebtId,
    selectedGroupId,
    setSelectedGroupId,
    addDebtContact,
    updateDebt,
    deleteDebt,
    recordDebtTransaction,
    deleteDebtRecord,
    groups,
    groupExpenses,
    userProfile,
    initialDebtCategoryTab,
    openHtmlReportViewer,
    showToast,
    setActiveTab,
  } = useApp();

  const [currentScreen, setCurrentScreen] = useState<DebtScreen>('dashboard');
  const [activeContactId, setActiveContactId] = useState<string | null>(null);

  // Top Tab Bar: 'individual' | 'groups'
  const [debtCategoryTab, setDebtCategoryTab] = useState<'individual' | 'groups'>(() => {
    return initialTab || initialDebtCategoryTab || 'individual';
  });
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isDebtAccountSelectOpen, setIsDebtAccountSelectOpen] = useState(false);

  // Screen 1: Dashboard filter tabs ('all' | 'lending' | 'borrowing') + search
  const [dashboardFilter, setDashboardFilter] = useState<'all' | 'lending' | 'borrowing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Screen 2: Add Debt Contact Form state
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactDueDate, setContactDueDate] = useState('');
  const [contactNotes, setContactNotes] = useState('');

  // Screen 3: Detail View Filter Tabs ('all' | 'paid' | 'received' | 'adjustments')
  const [detailFilter, setDetailFilter] = useState<'all' | 'paid' | 'received' | 'adjustments'>('all');
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editNameVal, setEditNameVal] = useState('');
  const [editPhoneVal, setEditPhoneVal] = useState('');
  const [editDueDateVal, setEditDueDateVal] = useState('');
  const [editNotesVal, setEditNotesVal] = useState('');
  const [confirmDeleteContact, setConfirmDeleteContact] = useState(false);
  const [selectedDebtTxForAction, setSelectedDebtTxForAction] = useState<Transaction | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState(false);

  // Custom Transaction & Debt Share Modal state
  const [customShareState, setCustomShareState] = useState<{
    isOpen: boolean;
    debt: Debt | null;
    transaction?: Transaction | null;
  }>({ isOpen: false, debt: null, transaction: null });

  // Screen 4: Add Record Form state
  const [recordType, setRecordType] = useState<'paid' | 'received' | 'adjustment'>('paid');
  const [recordDate, setRecordDate] = useState(toInputDate(new Date()));
  const [recordTime, setRecordTime] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  });
  const [recordAmount, setRecordAmount] = useState('');
  const [recordNote, setRecordNote] = useState('');

  // Eligible bank / cash accounts (exclude system debt ledger)
  const eligibleAccounts = useMemo(() => {
    return accounts.filter((a) => !a.isArchived && !a.isSystemDebtAccount && a.type !== 'debt');
  }, [accounts]);

  const [recordAccountId, setRecordAccountId] = useState(() => eligibleAccounts[0]?.id || '');

  // Keep recordAccountId valid
  useEffect(() => {
    if (eligibleAccounts.length > 0 && !eligibleAccounts.some((a) => a.id === recordAccountId)) {
      setRecordAccountId(eligibleAccounts[0].id);
    }
  }, [eligibleAccounts, recordAccountId]);

  // Synchronize initial state when initialTab or selectedDebtId changes
  useEffect(() => {
    if (initialTab) {
      setDebtCategoryTab(initialTab);
    } else if (initialDebtCategoryTab) {
      setDebtCategoryTab(initialDebtCategoryTab);
    }
  }, [initialTab, initialDebtCategoryTab]);

  useEffect(() => {
    if (selectedDebtId) {
      setActiveContactId(selectedDebtId);
      setCurrentScreen('contact_detail');
    }
  }, [selectedDebtId]);

  // Active contact if in detail or add record view
  const activeContact = debts.find((d) => d.id === activeContactId) || null;
  const activeContactSummary = activeContact ? getDebtContactSummary(activeContact, transactions) : null;

  // --- AUTOMATIC SUMMARY CALCULATIONS FOR DASHBOARD ---
  const { totalReceivable, totalPayable, contactsWithSummary } = useMemo(() => {
    let sumReceivable = 0;
    let sumPayable = 0;

    const txByDebt = new Map<string, typeof transactions>();
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (tx.debtId) {
        let arr = txByDebt.get(tx.debtId);
        if (!arr) {
          arr = [];
          txByDebt.set(tx.debtId, arr);
        }
        arr.push(tx);
      }
    }

    const list = debts.map((d) => {
      const s = getDebtContactSummary(d, transactions, txByDebt.get(d.id));
      if (s.netBalance > 0.001) {
        sumReceivable += s.netBalance;
      } else if (s.netBalance < -0.001) {
        sumPayable += Math.abs(s.netBalance);
      }
      return {
        contact: d,
        summary: s,
      };
    });

    return {
      totalReceivable: sumReceivable,
      totalPayable: sumPayable,
      contactsWithSummary: list,
    };
  }, [debts, transactions]);

  // Groups Summary Calculations
  const groupStats = useMemo(() => {
    let totalSpentAll = 0;
    let netBalanceAll = 0;

    const list = groups.map((g) => {
      const b = calculateGroupBalances(g, groupExpenses, debts, userProfile?.name || 'You');
      totalSpentAll += b.totalSpent;
      netBalanceAll += b.userNetBalance;
      const count = groupExpenses.filter((e) => e.groupId === g.id).length;
      return {
        group: g,
        balances: b,
        expenseCount: count,
      };
    });

    return {
      totalSpentAll,
      netBalanceAll,
      groupsWithBalances: list,
    };
  }, [groups, groupExpenses, debts, userProfile]);

  // Filtered contacts on dashboard
  const filteredContacts = useMemo(() => {
    return contactsWithSummary.filter(({ contact, summary }) => {
      if (dashboardFilter === 'lending' && summary.status !== 'owes_you') return false;
      if (dashboardFilter === 'borrowing' && summary.status !== 'you_owe') return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        contact.personName.toLowerCase().includes(q) ||
        (contact.phone && contact.phone.toLowerCase().includes(q)) ||
        (contact.notes && contact.notes.toLowerCase().includes(q))
      );
    });
  }, [contactsWithSummary, dashboardFilter, searchQuery]);

  // Filtered groups on dashboard
  const filteredGroups = useMemo(() => {
    if (!groupSearchQuery.trim()) return groupStats.groupsWithBalances;
    const q = groupSearchQuery.toLowerCase().trim();
    return groupStats.groupsWithBalances.filter(({ group }) =>
      group.name.toLowerCase().includes(q)
    );
  }, [groupStats.groupsWithBalances, groupSearchQuery]);

  const handleCloseAll = () => {
    setSelectedDebtId(null);
    setActiveContactId(null);
    setCurrentScreen('dashboard');
    setIsHelpOpen(false);
    setIsEditingContact(false);
    setConfirmDeleteContact(false);
    if (isModal && onClose) {
      onClose();
    } else {
      setActiveTab('home');
    }
  };

  // Navigate to Screen 2: Add Debt Contact
  const handleOpenAddContact = () => {
    setContactName('');
    setContactPhone('');
    setContactDueDate('');
    setContactNotes('');
    setCurrentScreen('add_contact');
  };

  // Submit Screen 2: Add Debt Contact
  const handleAddContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;

    const newId = addDebtContact({
      personName: contactName.trim(),
      phone: contactPhone.trim() || undefined,
      dueDate: contactDueDate || undefined,
      notes: contactNotes.trim() || undefined,
    });

    setActiveContactId(newId);
    setSelectedDebtId(newId);
    setCurrentScreen('contact_detail');
  };

  // Open Screen 4: Add Transaction Record for active contact
  const handleOpenAddRecord = () => {
    setRecordAmount('');
    setRecordDate(toInputDate(new Date()));
    const now = new Date();
    setRecordTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
    setRecordNote('');
    setRecordType('paid');
    setCurrentScreen('add_record');
  };

  // Submit Screen 4: Add Record
  const handleRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(recordAmount);
    if (!activeContactId || isNaN(parsedAmt) || parsedAmt <= 0) return;

    recordDebtTransaction({
      debtId: activeContactId,
      type: recordType,
      amount: parsedAmt,
      accountId: recordAccountId || undefined,
      date: recordDate,
      time: recordTime,
      note: recordNote.trim() || undefined,
    });

    setCurrentScreen('contact_detail');
  };

  // Save Contact Edit in Screen 3
  const handleSaveContactEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContact || !editNameVal.trim()) return;

    updateDebt(activeContact.id, {
      personName: editNameVal.trim(),
      phone: editPhoneVal.trim() || undefined,
      dueDate: editDueDateVal || undefined,
      notes: editNotesVal.trim() || undefined,
    });

    setIsEditingContact(false);
  };

  // Delete Contact in Screen 3
  const handleDeleteContact = () => {
    if (!activeContact) return;
    deleteDebt(activeContact.id);
    setActiveContactId(null);
    setSelectedDebtId(null);
    setCurrentScreen('dashboard');
  };

  const handleOpenDebtsReport = () => {
    try {
      const html = generateConsolidatedDebtsReportHTML({
        debts,
        transactions,
        accounts,
        userProfileName: userProfile?.name || 'Primary User',
        filterType: dashboardFilter,
      });
      const dateStr = toInputDate(new Date()).replace(/-/g, '');
      openHtmlReportViewer({
        htmlContent: html,
        title: 'Debts & Loans Ledger Dossier',
        fileName: `debts-audit-dossier-${dateStr}.pdf`,
        badge: 'Debts Audit Dossier',
        subtitle: `Receivable: ₹${formatINR(totalReceivable)} · Payable: ₹${formatINR(totalPayable)} · ${debts.length} contacts`,
        reportType: 'debts',
      });
    } catch (err) {
      console.error('Failed to open debts report', err);
      showToast('Failed to generate debts report', 'error');
    }
  };

  const handleOpenContactStatement = (contact: Debt) => {
    try {
      const html = generateContactStatementHTML(
        contact,
        transactions,
        accounts,
        userProfile?.name || 'You'
      );
      const safeName = contact.personName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const dateStr = toInputDate(new Date()).replace(/-/g, '');
      openHtmlReportViewer({
        htmlContent: html,
        title: `Statement of Account - ${contact.personName}`,
        fileName: `statement-${safeName}-${dateStr}.pdf`,
        badge: 'Statement of Account',
        subtitle: `${contact.personName} · ${contact.phone || 'No phone'}`,
        reportType: 'debts',
      });
    } catch (err) {
      console.error('Failed to open contact statement', err);
      showToast('Failed to generate contact statement', 'error');
    }
  };

  // Outer container styling: full screen modal overlay vs crisp responsive page tab container
  const outerContainerClass = isModal
    ? 'fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-150'
    : 'w-full max-w-4xl mx-auto flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden min-h-[calc(100vh-11rem)] relative mb-16';

  const innerContainerClass = isModal
    ? 'w-full max-w-4xl mx-auto flex-1 flex flex-col h-full overflow-hidden relative'
    : 'w-full flex-1 flex flex-col overflow-hidden relative';

  return (
    <div className={outerContainerClass}>
      <div className={innerContainerClass}>
        {/* ========================================================================= */}
        {/* SCREEN 1: DEBTS DASHBOARD (MAIN OVERVIEW: INDIVIDUAL OR GROUPS)            */}
        {/* ========================================================================= */}
        {currentScreen === 'dashboard' && (
          debtCategoryTab === 'groups' && selectedGroupId ? (
            <GroupDetailView groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />
          ) : (
            <div className="flex flex-col h-full">
              {/* Top Bar: Title + Segmented toggle ("Individual Debts" | "Groups") + navigation actions */}
              <div className={`flex items-center justify-between px-3 sm:px-5 py-3 ${isModal ? 'pt-safe' : ''} border-b border-slate-100 dark:border-slate-800 shrink-0 gap-2 bg-white dark:bg-slate-900 sticky top-0 z-10`}>
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={handleCloseAll}
                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 transition-colors"
                    title={isModal ? 'Close' : 'Return to Home'}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  {/* Top Tab Bar Toggle ("Individual Debts" | "Groups") */}
                  <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl text-xs font-semibold shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setDebtCategoryTab('individual');
                        setSelectedGroupId(null);
                      }}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        debtCategoryTab === 'individual'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Individual ({debts.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDebtCategoryTab('groups');
                        setSelectedGroupId(null);
                      }}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        debtCategoryTab === 'groups'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Groups ({groups.length})</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {debtCategoryTab === 'groups' && (
                    <button
                      type="button"
                      onClick={() => setIsCreateGroupOpen(true)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">New Group</span>
                    </button>
                  )}
                  {debtCategoryTab === 'individual' && (
                    <button
                      type="button"
                      onClick={handleOpenDebtsReport}
                      className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Debts Audit Dossier & PDF"
                    >
                      <Printer className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Help & Ledger Logic"
                  >
                    <HelpCircle className="w-5 h-5" />
                  </button>
                  {isModal && (
                    <button
                      type="button"
                      onClick={handleCloseAll}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      title="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* TAB 1: INDIVIDUAL DEBTS VIEW */}
              {debtCategoryTab === 'individual' && (
                <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 pb-24">
                  {/* Filter Tabs: Toggle buttons for "All", "Lending", and "Borrowing" */}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setDashboardFilter('all')}
                      className={`py-2 rounded-xl transition-all cursor-pointer ${
                        dashboardFilter === 'all'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                      }`}
                    >
                      All ({contactsWithSummary.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardFilter('lending')}
                      className={`py-2 rounded-xl transition-all cursor-pointer ${
                        dashboardFilter === 'lending'
                          ? 'bg-emerald-600 text-white shadow-xs font-bold'
                          : 'text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400'
                      }`}
                    >
                      Lending ({contactsWithSummary.filter((c) => c.summary.status === 'owes_you').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardFilter('borrowing')}
                      className={`py-2 rounded-xl transition-all cursor-pointer ${
                        dashboardFilter === 'borrowing'
                          ? 'bg-rose-600 text-white shadow-xs font-bold'
                          : 'text-slate-500 hover:text-rose-600 dark:hover:text-rose-400'
                      }`}
                    >
                      Borrowing ({contactsWithSummary.filter((c) => c.summary.status === 'you_owe').length})
                    </button>
                  </div>

                  {/* Search Bar for Individual Contacts */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search contacts by name, phone or note..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-emerald-500 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-colors"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Summary Cards Top Row: Payable Card & Receivable Card */}
                  <div className="grid grid-cols-2 gap-3.5">
                    {/* Payable Card */}
                    <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 relative overflow-hidden">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                          Total Payable
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                          <ArrowUpRight className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-lg sm:text-xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                        {formatINR(totalPayable)}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">You owe to others</span>
                    </div>

                    {/* Receivable Card */}
                    <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 relative overflow-hidden">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          Total Receivable
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                          <ArrowDownLeft className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatINR(totalReceivable)}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Others owe you</span>
                    </div>
                  </div>

                  {/* Contact List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Contacts ({filteredContacts.length})
                      </span>
                    </div>

                    {filteredContacts.length === 0 ? (
                      <div className="py-12 text-center space-y-2 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <User className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                        <p className="text-xs font-semibold text-slate-500">
                          {searchQuery ? 'No contacts match your search' : 'No debt contacts found'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Tap the circular <strong className="text-emerald-600">+</strong> button below to add a contact.
                        </p>
                      </div>
                    ) : (
                      filteredContacts.map(({ contact, summary }) => {
                        const isOwesYou = summary.status === 'owes_you';
                        const isYouOwe = summary.status === 'you_owe';

                        return (
                          <div
                            key={contact.id}
                            onClick={() => {
                              setActiveContactId(contact.id);
                              setSelectedDebtId(contact.id);
                              setCurrentScreen('contact_detail');
                            }}
                            className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 cursor-pointer transition-all flex items-center justify-between gap-2.5 sm:gap-3 group min-w-0 overflow-hidden active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 overflow-hidden">
                              <div
                                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isOwesYou
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : isYouOwe
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {contact.personName.substring(0, 2).toUpperCase()}
                              </div>

                              <div className="min-w-0 flex-1 overflow-hidden">
                                <h4
                                  className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
                                  title={contact.personName}
                                >
                                  {contact.personName}
                                </h4>
                                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] mt-0.5 truncate">
                                  <span
                                    className={`font-semibold shrink-0 ${
                                      isOwesYou
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : isYouOwe
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {isOwesYou ? 'owes you' : isYouOwe ? 'you owe' : 'all settled'}
                                  </span>
                                  {contact.dueDate && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-600 shrink-0">·</span>
                                      <span className="text-slate-400 truncate">Due {formatDate(contact.dueDate)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
                              <div className="text-right">
                                <div
                                  className={`text-xs sm:text-sm font-extrabold tabular-nums whitespace-nowrap ${
                                    isOwesYou
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : isYouOwe
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-slate-400'
                                  }`}
                                  title={formatINR(Math.abs(summary.netBalance))}
                                >
                                  {formatINR(Math.abs(summary.netBalance))}
                                </div>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap block">
                                  {summary.transactions.length} record{summary.transactions.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: GROUPS LIST (SCREEN A) */}
              {debtCategoryTab === 'groups' && (
                <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 pb-24">
                  {/* Group Summary Cards: Total Group Expenditure & Net Balance Status */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 relative overflow-hidden">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Total Group Spending
                      </span>
                      <div className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                        ₹{formatINR(groupStats.totalSpentAll)}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Across {groups.length} groups</span>
                    </div>

                    <div
                      className={`p-4 rounded-2xl border relative overflow-hidden ${
                        groupStats.netBalanceAll > 0.01
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                          : groupStats.netBalanceAll < -0.01
                          ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40 text-rose-600 dark:text-rose-400'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-500'
                      }`}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Your Group Net Position
                      </span>
                      <div className="text-lg sm:text-xl font-extrabold tabular-nums">
                        {groupStats.netBalanceAll > 0.01
                          ? `+₹${formatINR(groupStats.netBalanceAll)}`
                          : groupStats.netBalanceAll < -0.01
                          ? `-₹${formatINR(Math.abs(groupStats.netBalanceAll))}`
                          : '₹0.00'}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {groupStats.netBalanceAll > 0.01
                          ? 'You are owed overall'
                          : groupStats.netBalanceAll < -0.01
                          ? 'You owe overall'
                          : 'All settled up'}
                      </span>
                    </div>
                  </div>

                  {/* Search Bar for Expense Groups */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={groupSearchQuery}
                      onChange={(e) => setGroupSearchQuery(e.target.value)}
                      placeholder="Search groups by name..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-emerald-500 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-colors"
                    />
                    {groupSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setGroupSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Group Cards List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Expense Groups ({filteredGroups.length})
                      </span>
                    </div>

                    {filteredGroups.length === 0 ? (
                      <div className="py-12 text-center space-y-2 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                        <p className="text-xs font-semibold text-slate-500">
                          {groupSearchQuery ? 'No groups match your search' : 'No expense groups yet'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Create a group to split trip expenses, bills, or dining with friends.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsCreateGroupOpen(true)}
                          className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                        >
                          Create First Group
                        </button>
                      </div>
                    ) : (
                      filteredGroups.map(({ group, balances, expenseCount }) => {
                        const isOwed = balances.userNetBalance > 0.01;
                        const isOwing = balances.userNetBalance < -0.01;

                        return (
                          <div
                            key={group.id}
                            onClick={() => setSelectedGroupId(group.id)}
                            className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 cursor-pointer transition-all flex items-center justify-between gap-3 group min-w-0 active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs"
                                style={{ backgroundColor: group.avatarColor || '#059669' }}
                              >
                                {group.name[0]?.toUpperCase() || 'G'}
                              </div>

                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                  {group.name}
                                </h4>
                                <p className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                                  <span>{group.memberIds.length} members</span>
                                  <span>•</span>
                                  <span>Total ₹{formatINR(balances.totalSpent)}</span>
                                  <span>•</span>
                                  <span>{expenseCount} bill{expenseCount !== 1 ? 's' : ''}</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <span
                                  className={`text-xs sm:text-sm font-extrabold tabular-nums block ${
                                    isOwed
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : isOwing
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {isOwed
                                    ? `+₹${formatINR(balances.userNetBalance)}`
                                    : isOwing
                                    ? `-₹${formatINR(Math.abs(balances.userNetBalance))}`
                                    : '₹0.00'}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold block ${
                                    isOwed
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : isOwing
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {isOwed ? 'You are owed' : isOwing ? 'You owe group' : 'All settled'}
                                </span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Floating Action Button (FAB): Bottom-right circular + button */}
              <div className="absolute bottom-5 right-5 z-20">
                <button
                  type="button"
                  onClick={() => {
                    if (debtCategoryTab === 'groups') {
                      setIsCreateGroupOpen(true);
                    } else {
                      handleOpenAddContact();
                    }
                  }}
                  className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title={debtCategoryTab === 'groups' ? 'Create Expense Group' : 'Add Debt Contact'}
                >
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </button>
              </div>
            </div>
          )
        )}

        {/* ========================================================================= */}
        {/* SCREEN 2: ADD DEBT CONTACT ("Add debt")                                   */}
        {/* ========================================================================= */}
        {currentScreen === 'add_contact' && (
          <form onSubmit={handleAddContactSubmit} className="flex flex-col h-full bg-white dark:bg-slate-900">
            {/* Top Bar: Title "Add debt" with back navigation */}
            <div className={`flex items-center justify-between px-5 py-4 ${isModal ? 'pt-safe' : ''} border-b border-slate-100 dark:border-slate-800 shrink-0`}>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCurrentScreen('dashboard')}
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  title="Back to Debts"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Add Debt Contact</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseAll}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Form Field 1: Name of the person */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Name of the person</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Rahul Sharma, Amit Gupta"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Form Field 2: Phone number */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Phone Number (Optional)</span>
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210 (for WhatsApp/SMS)"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Form Field 3: Expected repayment due date */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Expected Repayment Due Date (Optional)</span>
                </label>
                <input
                  type="date"
                  value={contactDueDate}
                  onChange={(e) => setContactDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Form Field 4: Description / Notes */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Notes / Purpose (Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  placeholder="e.g. Goa trip advance, emergency medical loan..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 pb-safe pb-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentScreen('dashboard')}
                className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!contactName.trim()}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
              >
                Save Contact & Open Ledger
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 3: PERSON DEBT DETAIL VIEW                                         */}
        {/* ========================================================================= */}
        {currentScreen === 'contact_detail' && activeContact && activeContactSummary && (
          <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            {/* Header Bar: Contact name, back button, edit icon, delete icon */}
            <div className={`flex items-center justify-between px-5 py-4 ${isModal ? 'pt-safe' : ''} border-b border-slate-100 dark:border-slate-800 shrink-0`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentScreen('dashboard');
                    setActiveContactId(null);
                    setSelectedDebtId(null);
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  title="Back to Debts List"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                    {activeContact.personName}
                  </h2>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    {activeContact.phone ? (
                      <span className="font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{activeContact.phone}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditNameVal(activeContact.personName);
                          setEditPhoneVal('');
                          setEditDueDateVal(activeContact.dueDate ? toInputDate(activeContact.dueDate) : '');
                          setEditNotesVal(activeContact.notes || '');
                          setIsEditingContact(true);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                        <span>+ Add Phone</span>
                      </button>
                    )}
                    <span>•</span>
                    <span>{activeContactSummary.transactions.length} entries</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenContactStatement(activeContact)}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl cursor-pointer transition-colors"
                  title="View Statement of Account & Download PDF"
                >
                  <FileText className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCustomShareState({
                      isOpen: true,
                      debt: activeContact,
                      transaction: null,
                    })
                  }
                  className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl cursor-pointer transition-colors"
                  title="Share Reminder (WhatsApp & Messages)"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditNameVal(activeContact.personName);
                    setEditPhoneVal(activeContact.phone || '');
                    setEditDueDateVal(activeContact.dueDate ? toInputDate(activeContact.dueDate) : '');
                    setEditNotesVal(activeContact.notes || '');
                    setIsEditingContact(true);
                  }}
                  className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  title="Edit Contact"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteContact(true)}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                  title="Delete Contact"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCloseAll}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Summary Card: Total Balance (Receivable / Payable), Paid breakdown, Received breakdown, Due date */}
              <div
                className={`p-5 rounded-3xl border ${
                  activeContactSummary.status === 'owes_you'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : activeContactSummary.status === 'you_owe'
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {activeContactSummary.status === 'owes_you'
                      ? 'Receivable Balance (owes you)'
                      : activeContactSummary.status === 'you_owe'
                      ? 'Payable Balance (you owe)'
                      : 'Settled Balance'}
                  </span>
                  {activeContact.dueDate && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/70 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300">
                      Due: {formatDate(activeContact.dueDate)}
                    </span>
                  )}
                </div>

                <div
                  className={`text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight mt-1 ${
                    activeContactSummary.status === 'owes_you'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : activeContactSummary.status === 'you_owe'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {formatINR(Math.abs(activeContactSummary.netBalance))}
                </div>

                {/* Paid vs Received Breakdown Row */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-black/5 dark:border-white/10 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Total Paid (Lent)</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatINR(activeContactSummary.totalPaid)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Total Received</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatINR(activeContactSummary.totalReceived)}
                    </span>
                  </div>
                </div>

                {activeContact.notes && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-2.5 pt-2 border-t border-black/5 dark:border-white/5">
                    "{activeContact.notes}"
                  </p>
                )}
              </div>

              {/* Filter Bar: Tabs for All, Paid, Received, Adjustments */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-semibold">
                {(['all', 'paid', 'received', 'adjustments'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDetailFilter(tab)}
                    className={`flex-1 py-1.5 rounded-xl capitalize transition-all cursor-pointer ${
                      detailFilter === tab
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Transaction History List: Chronological log */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                  Transaction History
                </span>

                {(() => {
                  const txs = activeContactSummary.transactions.filter((tx) => {
                    const isPaidTx =
                      tx.toAccountId === SYSTEM_DEBT_ACCOUNT_ID ||
                      (tx.tags && (tx.tags.includes('Paid') || tx.tags.includes('Lent')));
                    const isReceivedTx =
                      tx.fromAccountId === SYSTEM_DEBT_ACCOUNT_ID ||
                      (tx.tags && (tx.tags.includes('Received') || tx.tags.includes('Repayment')));

                    if (detailFilter === 'all') return true;
                    if (detailFilter === 'paid') return isPaidTx && !tx.isBalanceAdjustment;
                    if (detailFilter === 'received') return isReceivedTx && !tx.isBalanceAdjustment;
                    if (detailFilter === 'adjustments') return Boolean(tx.isBalanceAdjustment);
                    return true;
                  });

                  if (txs.length === 0) {
                    return (
                      <div className="py-8 text-center space-y-1.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <p className="text-xs text-slate-400">No transaction records under this filter</p>
                        <button
                          type="button"
                          onClick={handleOpenAddRecord}
                          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          + Add first record
                        </button>
                      </div>
                    );
                  }

                  return txs.map((tx) => {
                    const isAdjustment = Boolean(tx.isBalanceAdjustment);
                    const isPaid =
                      tx.toAccountId === SYSTEM_DEBT_ACCOUNT_ID ||
                      (tx.tags && (tx.tags.includes('Paid') || tx.tags.includes('Lent')));
                    const isReceived = !isPaid && !isAdjustment;

                    return (
                      <div
                        key={tx.id}
                        onClick={() => {
                          setSelectedDebtTxForAction(tx);
                          setConfirmDeleteRecord(false);
                        }}
                        className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2.5 sm:gap-3 cursor-pointer transition-colors group min-w-0 overflow-hidden"
                        title="Tap to view entry details"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 overflow-hidden">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isAdjustment
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                : isReceived
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isAdjustment ? (
                              <SlidersHorizontal className="w-4 h-4" />
                            ) : isReceived ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 overflow-hidden">
                            <span
                              className="text-xs font-bold text-slate-900 dark:text-white block truncate"
                              title={
                                tx.note ||
                                (isPaid
                                  ? 'Paid to contact'
                                  : isReceived
                                  ? 'Received from contact'
                                  : 'Balance Adjustment')
                              }
                            >
                              {tx.note ||
                                (isPaid
                                  ? 'Paid to contact'
                                  : isReceived
                                  ? 'Received from contact'
                                  : 'Balance Adjustment')}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 truncate">
                              <span className="shrink-0">{formatDate(tx.date)}</span>
                              {tx.fromAccountName && !isAdjustment && (
                                <>
                                  <span className="shrink-0 opacity-60">·</span>
                                  <span className="truncate">
                                    {isPaid
                                      ? `From: ${tx.fromAccountName}`
                                      : `Into: ${tx.toAccountName || tx.fromAccountName}`}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Amount & clean chevron */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
                          <span
                            className={`text-xs sm:text-sm font-extrabold tabular-nums whitespace-nowrap ${
                              isAdjustment
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : isReceived
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                            title={formatINR(tx.amount)}
                          >
                            {isReceived ? '+' : isPaid ? '-' : ''}
                            {formatINR(tx.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomShareState({
                                isOpen: true,
                                debt: activeContact,
                                transaction: tx,
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 cursor-pointer"
                            title="Share entry via WhatsApp & SMS"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Primary Action Button: "Add Record" button at the bottom */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 pb-safe pb-8">
              <button
                type="button"
                onClick={handleOpenAddRecord}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Record</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 4: ADD TRANSACTION RECORD ("Add record")                           */}
        {/* ========================================================================= */}
        {currentScreen === 'add_record' && activeContact && (
          <form onSubmit={handleRecordSubmit} className="flex flex-col h-full relative bg-white dark:bg-slate-900">
            {/* Top Bar: Title "Add record" with back navigation */}
            <div className={`flex items-center justify-between px-5 py-4 ${isModal ? 'pt-safe' : ''} border-b border-slate-100 dark:border-slate-800 shrink-0`}>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCurrentScreen('contact_detail')}
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  title="Back to Contact"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">Add Record</h2>
                  <span className="text-[10px] text-slate-400 block">{activeContact.personName}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAll}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Type Selector Toggle: Paid (Outflow) vs Received (Inflow) vs Adjustment */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setRecordType('paid')}
                  className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    recordType === 'paid'
                      ? 'bg-rose-600 text-white shadow-xs font-bold'
                      : 'text-slate-500 hover:text-rose-600'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Paid (Lent)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecordType('received')}
                  className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    recordType === 'received'
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'text-slate-500 hover:text-emerald-600'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Received</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecordType('adjustment')}
                  className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    recordType === 'adjustment'
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Adjustment</span>
                </button>
              </div>

              {/* Date & Time Selector Row */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Date</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Time</span>
                  </label>
                  <input
                    type="text"
                    value={recordTime}
                    onChange={(e) => setRecordTime(e.target.value)}
                    placeholder="e.g. 09:19 AM"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Amount Input Field */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Amount
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-500">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    autoFocus
                    value={recordAmount}
                    onChange={(e) => setRecordAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white bg-transparent outline-none tabular-nums"
                  />
                </div>
              </div>

              {/* Account / Target Picker */}
              {recordType !== 'adjustment' && (() => {
                const selectedDebtAccount = eligibleAccounts.find((a) => a.id === recordAccountId) || eligibleAccounts[0];
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-slate-500" />
                        <span>{recordType === 'paid' ? 'Paid From Linked Account' : 'Received Into Linked Account'}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsDebtAccountSelectOpen(true)}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>

                    <div
                      onClick={() => setIsDebtAccountSelectOpen(true)}
                      className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-500/60 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {selectedDebtAccount && (
                          <AccountAvatar account={selectedDebtAccount} size="sm" className="rounded-xl shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors">
                            {selectedDebtAccount ? selectedDebtAccount.name : 'Select Account'}
                          </div>
                          <div className="text-[11px] text-slate-400 capitalize truncate">
                            {selectedDebtAccount
                              ? `${selectedDebtAccount.type}${selectedDebtAccount.accountNumber ? ` · ••${selectedDebtAccount.accountNumber}` : ''}`
                              : 'Tap to choose account'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                          {selectedDebtAccount ? formatINR(selectedDebtAccount.balance, true) : ''}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 block leading-tight px-1">
                      Transfers between this account and the system Debt Ledger maintaining real liquid balances.
                    </span>
                  </div>
                );
              })()}

              {/* Other Details Section: Note Input */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Write a note</span>
                </label>
                <input
                  type="text"
                  value={recordNote}
                  onChange={(e) => setRecordNote(e.target.value)}
                  placeholder={
                    recordType === 'paid'
                      ? 'e.g. Lent cash for groceries'
                      : recordType === 'received'
                      ? 'e.g. GPay repayment received'
                      : 'e.g. Waiver or interest adjustment'
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            {/* Floating Action Button to submit */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0 pb-safe pb-8">
              <span className="text-xs text-slate-400 font-medium">Ready to record entry</span>
              <button
                type="submit"
                disabled={!recordAmount || parseFloat(recordAmount) <= 0}
                className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title="Save Transaction"
              >
                <Check className="w-6 h-6 stroke-[3]" />
              </button>
            </div>
          </form>
        )}

        {/* Edit Contact Modal Popup */}
        {isEditingContact && activeContact && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Contact Details</h3>
                <button
                  type="button"
                  onClick={() => setIsEditingContact(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveContactEdit} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editNameVal}
                    onChange={(e) => setEditNameVal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                    Phone Number (for WhatsApp & SMS)
                  </label>
                  <input
                    type="tel"
                    value={editPhoneVal}
                    onChange={(e) => setEditPhoneVal(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                    Due Date for Repayment
                  </label>
                  <input
                    type="date"
                    value={editDueDateVal}
                    onChange={(e) => setEditDueDateVal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                    Additional Details / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={editNotesVal}
                    onChange={(e) => setEditNotesVal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingContact(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirm Delete Contact Popup */}
        {confirmDeleteContact && activeContact && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Delete "{activeContact.personName}"?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This will delete the contact and all associated debt transaction transfer records, updating your account balances.
              </p>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteContact(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteContact}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  Delete Contact
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Debt Transaction Detail & Delete Modal */}
        {selectedDebtTxForAction && (
          <div
            className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setSelectedDebtTxForAction(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full sm:max-w-md shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Debt Transaction Detail
                  </h3>
                  <span className="text-xs text-slate-400">{formatDate(selectedDebtTxForAction.date)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDebtTxForAction(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Record Type:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedDebtTxForAction.isBalanceAdjustment
                      ? 'Balance Adjustment'
                      : selectedDebtTxForAction.toAccountId === SYSTEM_DEBT_ACCOUNT_ID ||
                        (selectedDebtTxForAction.tags &&
                          (selectedDebtTxForAction.tags.includes('Paid') ||
                            selectedDebtTxForAction.tags.includes('Lent')))
                      ? 'Paid to Contact (Lent)'
                      : 'Received from Contact (Collected)'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Amount:</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {formatINR(selectedDebtTxForAction.amount)}
                  </span>
                </div>
                {selectedDebtTxForAction.note && (
                  <div className="flex justify-between items-start pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Note:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 text-right max-w-[65%]">
                      {selectedDebtTxForAction.note}
                    </span>
                  </div>
                )}
                {selectedDebtTxForAction.fromAccountName && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Linked Account:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {selectedDebtTxForAction.fromAccountName}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-1">
                {confirmDeleteRecord ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteDebtRecord(selectedDebtTxForAction.id);
                      setSelectedDebtTxForAction(null);
                      setConfirmDeleteRecord(false);
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Delete Entry</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDebtTxForAction(null)}
                      className="py-3 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer text-center"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeContact) {
                          setCustomShareState({
                            isOpen: true,
                            debt: activeContact,
                            transaction: selectedDebtTxForAction,
                          });
                          setSelectedDebtTxForAction(null);
                        }
                      }}
                      className="py-3 px-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      title="Share transaction update via WhatsApp or SMS"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Share</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteRecord(true)}
                      className="py-3 px-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
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

        {/* Help & Ledger Logic Modal */}
        {isHelpOpen && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Debts & Ledger Guide</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">
                    Lending (Receivable — Owes You)
                  </span>
                  Money you paid or lent to a friend or contact. The balance is positive (Green) and decreases when they repay you.
                </div>

                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                  <span className="font-bold text-rose-700 dark:text-rose-400 block mb-0.5">
                    Borrowing (Payable — You Owe)
                  </span>
                  Money you received or borrowed from someone. The balance is negative (Red) and settles when you repay them.
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                    Dedicated System Debt Ledger
                  </span>
                  All debt payments and repayments are recorded as automated transfers with the app's Debt Ledger account. This ensures your bank balances reflect real cash flow without artificially inflating monthly income or expenses!
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}

        {/* Dedicated Full-Screen Grouped Account Selection View */}
        <AccountSelectFullScreenModal
          isOpen={isDebtAccountSelectOpen}
          onClose={() => setIsDebtAccountSelectOpen(false)}
          onSelect={(acc) => {
            setRecordAccountId(acc.id);
            setIsDebtAccountSelectOpen(false);
          }}
          selectedAccountId={recordAccountId}
          title={recordType === 'paid' ? 'Paid From Linked Account' : 'Received Into Linked Account'}
          subtitle="Grouped by Bank Accounts, Credit Cards, and Wallets"
        />

        {/* Create Group Modal */}
        <CreateGroupModal
          isOpen={isCreateGroupOpen}
          onClose={() => setIsCreateGroupOpen(false)}
          onGroupCreated={(newGroupId) => {
            setIsCreateGroupOpen(false);
            setDebtCategoryTab('groups');
            setSelectedGroupId(newGroupId);
          }}
        />

        {/* Custom Transaction & Debt Share Modal */}
        {customShareState.isOpen && customShareState.debt && (
          <CustomTransactionShareModal
            isOpen={customShareState.isOpen}
            onClose={() => setCustomShareState({ isOpen: false, debt: null, transaction: null })}
            debt={customShareState.debt}
            transaction={customShareState.transaction}
          />
        )}
      </div>
    </div>
  );
};
