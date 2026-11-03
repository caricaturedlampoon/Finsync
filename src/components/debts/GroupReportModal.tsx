import React, { useState, useMemo } from 'react';
import { ExpenseGroup, GroupExpense, Debt, Category } from '../../types';
import { formatINR, formatDate, toInputDate } from '../../utils/formatters';
import { fileService } from '../../services/fileService';
import {
  calculateGroupBalances,
  simplifyDebts,
  getMemberDisplayName,
  getMemberPhone,
  MemberBalance,
  SimplifiedDebtTransfer,
} from '../../utils/groupExpenseEngine';
import {
  generateGroupReportHTML,
  generateGroupReportCSV,
  generateGroupReportWhatsAppText,
  calculateGroupCategoryBreakdown,
  downloadGroupReportFile,
  exportGroupReportToPdf,
} from '../../utils/groupReportEngine';
import {
  X,
  FileSpreadsheet,
  Printer,
  Share2,
  Copy,
  Check,
  Users,
  Calendar,
  Sparkles,
  ArrowRight,
  Download,
  Filter,
  Search,
  CheckCircle2,
  MessageCircle,
  TrendingUp,
  Tag,
  ArrowUpDown,
  Eye,
} from 'lucide-react';
import { useRegisterOverlay } from '../../navigation/NavigationContext';
import { useApp } from '../../context/AppContext';

interface GroupReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ExpenseGroup;
  expenses: GroupExpense[];
  debts: Debt[];
  categories: Category[];
  userProfileName?: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const GroupReportModal: React.FC<GroupReportModalProps> = ({
  isOpen,
  onClose,
  group,
  expenses,
  debts,
  categories,
  userProfileName = 'You',
  showToast,
}) => {
  useRegisterOverlay(isOpen, 'group_report_modal', group?.name ? `${group.name} Report` : 'Group Report', onClose);
  const { openHtmlReportViewer } = useApp();

  const [isSimplify, setIsSimplify] = useState(true);
  const [copiedText, setCopiedText] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'settlements' | 'categories' | 'transactions'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const reportData = useMemo(() => {
    return {
      group: group || { id: '', name: '', members: [], createdAt: '' },
      expenses: expenses || [],
      debts: debts || [],
      categories: categories || [],
      userProfileName,
      isSimplify,
    };
  }, [group, expenses, debts, categories, userProfileName, isSimplify]);

  const { totalSpent, memberBalances, pairwiseDebts } = useMemo(() => {
    if (!group) return { totalSpent: 0, memberBalances: [] as MemberBalance[], pairwiseDebts: [] as SimplifiedDebtTransfer[] };
    return calculateGroupBalances(group, expenses, debts, userProfileName);
  }, [group, expenses, debts, userProfileName]);

  const settlements: SimplifiedDebtTransfer[] = useMemo(() => {
    return isSimplify ? simplifyDebts(memberBalances) : pairwiseDebts;
  }, [isSimplify, memberBalances, pairwiseDebts]);

  const categoryBreakdown = useMemo(() => {
    return calculateGroupCategoryBreakdown(expenses, categories);
  }, [expenses, categories]);

  const sortedExpenses = useMemo(() => {
    return [...expenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return sortedExpenses.filter((e) => {
      const matchesSearch =
        !searchQuery.trim() ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (e.note && e.note.toLowerCase().includes(searchQuery.toLowerCase().trim()));
      const matchesCat =
        selectedCategoryFilter === 'all' || e.categoryId === selectedCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [sortedExpenses, searchQuery, selectedCategoryFilter]);

  // Date range
  const tripPeriod = useMemo(() => {
    if (sortedExpenses.length === 0) return 'No expenses logged';
    const dates = sortedExpenses.map((e) => new Date(e.date).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    return `${formatDate(minDate)} to ${formatDate(maxDate)}`;
  }, [sortedExpenses]);

  // In-App Native HTML Report View & Crisp PDF
  const handleOpenHtmlViewer = () => {
    try {
      const html = generateGroupReportHTML(reportData);
      const safeName = group.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const dateStr = toInputDate(new Date()).replace(/-/g, '');
      openHtmlReportViewer({
        htmlContent: html,
        title: `${group.name} - Split Expense Report`,
        fileName: `${safeName}-split-report-${dateStr}.pdf`,
        badge: 'Trip Audit Dossier',
        subtitle: `${group.name} · Total Spend: ₹${formatINR(totalSpent)} · ${expenses.length} expenses`,
        reportType: 'group',
      });
    } catch (e) {
      console.error('Failed to open group report in HTML viewer', e);
      showToast('Failed to open HTML report view', 'error');
    }
  };

  // Actions: High-quality vector PDF export coupled to fileService.exportAndShare
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const handleSavePdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportGroupReportToPdf(reportData, (msg, type) => showToast(msg, type));
    } catch (e) {
      console.error('Failed to generate vector PDF report', e);
      showToast('Failed to export PDF report', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadCSV = () => {
    const csv = generateGroupReportCSV(reportData);
    const safeName = group.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const dateStr = toInputDate(new Date()).replace(/-/g, '');
    downloadGroupReportFile(csv, `${safeName}-split-report-${dateStr}.csv`, 'text/csv;charset=utf-8;');
  };

  const handleShareWhatsApp = () => {
    const msg = generateGroupReportWhatsAppText(reportData);
    const deepLink = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    try {
      window.location.href = deepLink;
      setTimeout(() => {
        const webFallback = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
        window.open(webFallback, '_blank', 'noopener,noreferrer');
      }, 700);
    } catch {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyText = async () => {
    const msg = generateGroupReportWhatsAppText(reportData);
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedText(true);
      showToast('Trip report summary copied to clipboard!', 'success');
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col h-[100dvh] w-full overflow-hidden animate-in fade-in duration-200">
      {/* Top Header */}
      <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shadow-2xs z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                {group.name} - Split Expense Report
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 shrink-0">
                Audit Dossier
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              {group.description || 'Trip expense details, categories, settlements & individual shares'}
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleOpenHtmlViewer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
            title="Open interactive in-app HTML view with print & PDF download"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">HTML View & PDF</span>
            <span className="sm:hidden">HTML</span>
          </button>

          <button
            type="button"
            onClick={handleSavePdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Quick Download Vector PDF Report"
          >
            <Printer className={`w-3.5 h-3.5 ${isExportingPdf ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isExportingPdf ? 'Exporting...' : 'Quick PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            title="Download CSV / Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel/CSV</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="p-2 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
            title="Share via WhatsApp"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Report"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Navigation Sub-Tabs */}
      <div className="shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Trip Overview & Balances
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settlements')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'settlements'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Who Pays Whom ({settlements.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'categories'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Expense Categories ({categoryBreakdown.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'transactions'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Individual Shares ({expenses.length})
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSimplify(!isSimplify)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                isSimplify
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
              title="Toggle Min-Cash-Flow debt simplification algorithm"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>{isSimplify ? 'Optimized Settlements' : 'Pairwise Settlements'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-safe min-h-0 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
          {/* Trip Hero Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/25 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 block">
                  Trip Dossier & Group Report
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                  {group.name}
                </h2>
                {group.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
                    {group.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-2">
                  <span className="flex items-center gap-1 font-semibold">
                    <Calendar className="w-3.5 h-3.5" />
                    {tripPeriod}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-semibold">
                    <Users className="w-3.5 h-3.5" />
                    {group.memberIds.length} Members
                  </span>
                  <span>•</span>
                  <span className="font-semibold">
                    {expenses.length} Total Transactions
                  </span>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0 bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-emerald-500/20">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Total Trip Spend
                </span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                  {formatINR(totalSpent)}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Avg: {formatINR(group.memberIds.length > 0 ? totalSpent / group.memberIds.length : 0)} / member
                </span>
              </div>
            </div>

            {/* Quick Action Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-500/15">
              <button
                type="button"
                onClick={handleOpenHtmlViewer}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>HTML Report & PDF</span>
              </button>

              <button
                type="button"
                onClick={handleSavePdf}
                disabled={isExportingPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-500" />
                <span>{isExportingPdf ? 'Exporting PDF...' : 'Vector PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
                <span>Download Excel (.csv)</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Share via WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                {copiedText ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{copiedText ? 'Copied Summary' : 'Copy Summary'}</span>
              </button>
            </div>
          </div>

          {/* TAB 1: OVERVIEW & BALANCES */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Member Balances Table */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>Member Balances & Contributions</span>
                  </h3>
                  <span className="text-xs text-slate-500">
                    {memberBalances.length} participants
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                        <th className="py-2.5 px-3">Member</th>
                        <th className="py-2.5 px-3 text-right">Total Paid</th>
                        <th className="py-2.5 px-3 text-right">Total Share</th>
                        <th className="py-2.5 px-3 text-right">Net Balance</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {memberBalances.map((m) => {
                        const isCreditor = m.net > 0.01;
                        const isDebtor = m.net < -0.01;
                        return (
                          <tr key={m.memberId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                              {m.memberName}
                              {m.phone && (
                                <span className="block text-[10px] text-slate-400 font-normal">
                                  {m.phone}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-200">
                              {formatINR(m.paid)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-200">
                              {formatINR(m.owes)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono font-bold ${
                                isCreditor
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isDebtor
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {isCreditor ? '+' : ''}{formatINR(m.net)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isCreditor
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : isDebtor
                                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}
                              >
                                {isCreditor
                                  ? `Gets back ${formatINR(m.net)}`
                                  : isDebtor
                                  ? `Owes ${formatINR(Math.abs(m.net))}`
                                  : 'Settled'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Settlement Cards Preview */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Recommended Settlements (Who Pays Whom)</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isSimplify ? 'Algorithmically simplified with minimum transactions' : 'Direct pairwise breakdown'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    {settlements.length} Transfers
                  </span>
                </div>

                {settlements.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700">
                    🎉 All balances are settled! No payments are pending.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {settlements.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                            {s.fromName} pays {s.toName}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Direct Settlement
                          </span>
                        </div>
                        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono shrink-0">
                          {formatINR(s.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: WHO PAYS WHOM (DETAILED SETTLEMENTS) */}
          {activeTab === 'settlements' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Who Has to Pay to Whom</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {isSimplify ? 'Optimized' : 'Pairwise'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Direct instructions for each member to settle their shares completely.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSimplify(true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSimplify
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Min-Cash-Flow (Simplified)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSimplify(false)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        !isSimplify
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Direct Pairwise
                    </button>
                  </div>
                </div>

                {settlements.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700">
                    🎉 Everything is fully settled up!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {settlements.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 flex items-center justify-between gap-4 shadow-2xs hover:border-emerald-500 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                            #{idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                {s.fromName}
                              </span>
                              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                {s.toName}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 mt-0.5 block">
                              Payment instruction for complete settlement
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            {formatINR(s.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: EXPENSE CATEGORIES BREAKDOWN */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-600" />
                    <span>Expense Categories Breakdown</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    How the total trip spend is distributed across expense categories.
                  </p>
                </div>

                <div className="space-y-3">
                  {categoryBreakdown.map((cat) => (
                    <div
                      key={cat.categoryId}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {cat.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            ({cat.count} {cat.count === 1 ? 'expense' : 'expenses'})
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                            {formatINR(cat.total)}
                          </span>
                          <span className="text-xs text-slate-400 ml-2 font-mono">
                            {cat.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(2, cat.percentage))}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INDIVIDUAL SHARES IN EACH TRANSACTION */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              {/* Filter and Search Bar */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search transaction title or notes..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    {categoryBreakdown.map((cat) => (
                      <option key={cat.categoryId} value={cat.categoryId}>
                        {cat.name} ({cat.count})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Individual Shares Table */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Transaction Ledger with Individual Member Shares
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Showing each member's exact calculated contribution for every expense.
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {filteredExpenses.length} entries
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold bg-slate-50/50 dark:bg-slate-800/30">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Title & Category</th>
                        <th className="py-2.5 px-3">Paid By</th>
                        <th className="py-2.5 px-3 text-right">Total Amount</th>
                        {group.memberIds.map((mId) => (
                          <th key={mId} className="py-2.5 px-3 text-right">
                            {getMemberDisplayName(mId, debts, userProfileName)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredExpenses.map((exp) => {
                        const cat = categories.find((c) => c.id === exp.categoryId);
                        const catName = cat?.name || 'General';
                        const payerName = getMemberDisplayName(exp.paidBy, debts, userProfileName);

                        return (
                          <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                              {formatDate(exp.date)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {exp.title}
                              </span>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span>🏷️ {catName}</span>
                                <span>•</span>
                                <span>{exp.splitType}</span>
                              </span>
                              {exp.note && (
                                <span className="text-[10px] text-slate-400 italic block mt-0.5">
                                  "{exp.note}"
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                              {payerName}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {formatINR(exp.totalAmount)}
                            </td>
                            {group.memberIds.map((mId) => {
                              const split = exp.splits.find((s) => s.memberId === mId);
                              const amt = split ? split.amount : 0;
                              return (
                                <td
                                  key={mId}
                                  className={`py-2.5 px-3 text-right font-mono ${
                                    amt > 0
                                      ? 'text-slate-800 dark:text-slate-200 font-medium'
                                      : 'text-slate-400 dark:text-slate-600'
                                  }`}
                                >
                                  {amt > 0 ? formatINR(amt) : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Footer */}
      <footer className="shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between text-xs text-slate-400 z-10">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Export compliant with Indian Rupee (₹) and standard CSV/Excel format</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSavePdf}
            disabled={isExportingPdf}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            {isExportingPdf ? 'Exporting...' : 'Save PDF'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </footer>
    </div>
  );
};
