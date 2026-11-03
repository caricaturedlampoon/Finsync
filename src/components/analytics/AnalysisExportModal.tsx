import React, { useState, useMemo } from 'react';
import { printHtmlReport } from '../../utils/pdfExportHelper';
import { useApp } from '../../context/AppContext';
import {
  compileExecutiveAnalysis,
  generateAnalysisCSV,
  generateAnalysisHTML,
  generateAnalysisMarkdown,
  downloadAnalysisFile,
  exportAnalysisToPdf,
  ExecutiveAnalysisData,
} from '../../utils/analysisExportEngine';
import { formatINR, formatCompactINR, formatDate, toInputDate, formatNumber } from '../../utils/formatters';
import {
  X,
  FileSpreadsheet,
  Printer,
  FileCode,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Calendar,
  Wallet,
  Download,
  Share2,
  LineChart as LineChartIcon,
  BarChart3,
  ChevronRight,
  Activity,
  ArrowUpDown,
  Search,
  Zap,
  ArrowLeft,
  Eye,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  ComposedChart,
} from 'recharts';
import { ProfitLossGrowthBarChart } from '../investments/ProfitLossGrowthBarChart';

export type ExportScope = 'all' | 'analytics' | 'investments';
export type ExportPeriod = 'month' | 'year' | 'all' | 'custom';
export type PreviewTab = 'charts' | 'overview' | 'holdings' | 'cashflow';

const ASSET_COLORS = {
  stocks: '#2563eb', // Blue
  mutualFunds: '#059669', // Emerald
  bonds: '#d97706', // Amber
  pf: '#0891b2', // Cyan / PF
};

export const AnalysisExportModal: React.FC = () => {
  const {
    isAnalysisExportModalOpen,
    setIsAnalysisExportModalOpen,
    analysisExportInitialScope = 'all',
    transactions,
    categories,
    accounts,
    holdings,
    sipSchedules,
    userProfile,
    getHoldingMarketPrice,
    showToast,
    openHtmlReportViewer,
  } = useApp();

  const [scope, setScope] = useState<ExportScope>('all');
  const [period, setPeriod] = useState<ExportPeriod>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [activeTab, setActiveTab] = useState<PreviewTab>('charts');
  const [holdingSearch, setHoldingSearch] = useState('');
  const [holdingSortBy, setHoldingSortBy] = useState<'value' | 'pnl' | 'name'>('value');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Sync initial scope whenever modal opens
  React.useEffect(() => {
    if (isAnalysisExportModalOpen) {
      setScope(analysisExportInitialScope || 'all');
      setCopiedMarkdown(false);
      setActiveTab('charts');
    }
  }, [isAnalysisExportModalOpen, analysisExportInitialScope]);

  const handleClose = () => {
    setIsAnalysisExportModalOpen(false);
  };

  // Compute date ranges based on period selection
  const { startDate, endDate, periodLabel, prevStartDate, prevEndDate, prevPeriodLabel } = useMemo(() => {
    const now = new Date();
    if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const pStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      const pEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return {
        startDate: start,
        endDate: end,
        periodLabel: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
        prevStartDate: pStart,
        prevEndDate: pEnd,
        prevPeriodLabel: pStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      };
    } else if (period === 'year') {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      const pStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0);
      const pEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      return {
        startDate: start,
        endDate: end,
        periodLabel: `Financial Year ${now.getFullYear()}`,
        prevStartDate: pStart,
        prevEndDate: pEnd,
        prevPeriodLabel: `Financial Year ${now.getFullYear() - 1}`,
      };
    } else if (period === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      return {
        startDate: start,
        endDate: end,
        periodLabel: `${formatDate(start)} to ${formatDate(end)}`,
      };
    }
    // 'all'
    return {
      periodLabel: 'All-Time Records',
    };
  }, [period, customStartDate, customEndDate]);

  // Compile full analysis dataset
  const analysisData: ExecutiveAnalysisData = useMemo(() => {
    return compileExecutiveAnalysis({
      transactions,
      categories,
      accounts,
      holdings,
      sips: sipSchedules,
      userProfile,
      startDate,
      endDate,
      periodLabel,
      prevStartDate,
      prevEndDate,
      prevPeriodLabel,
      getHoldingMarketPrice,
    });
  }, [
    transactions,
    categories,
    accounts,
    holdings,
    sipSchedules,
    userProfile,
    startDate,
    endDate,
    periodLabel,
    prevStartDate,
    prevEndDate,
    prevPeriodLabel,
    getHoldingMarketPrice,
  ]);

  // Datasets for Custom Profit/Loss Bar Charts (Combined, Stocks, Mutual Funds)
  // Must be called unconditionally before any early returns to respect React Rules of Hooks
  const combinedGrowthBars = useMemo(() => {
    return analysisData.investments.portfolioGrowthHistory.map((p) => ({
      label: p.shortLabel,
      fullDate: `${p.monthLabel} (Combined Portfolio)`,
      invested: p.invested,
      valuation: p.valuation,
      growth: p.growth,
      growthPercent: p.growthPercent,
    }));
  }, [analysisData.investments.portfolioGrowthHistory]);

  const stocksGrowthBars = useMemo(() => {
    return analysisData.investments.portfolioGrowthHistory.map((p) => ({
      label: p.shortLabel,
      fullDate: `${p.monthLabel} (Equities & Stocks)`,
      invested: p.stocksInvested,
      valuation: p.stocksValuation,
      growth: p.stocksGrowth,
      growthPercent: p.stocksGrowthPercent,
    }));
  }, [analysisData.investments.portfolioGrowthHistory]);

  const mfGrowthBars = useMemo(() => {
    return analysisData.investments.portfolioGrowthHistory.map((p) => ({
      label: p.shortLabel,
      fullDate: `${p.monthLabel} (Mutual Funds & SIPs)`,
      invested: p.mfInvested,
      valuation: p.mfValuation,
      growth: p.mfGrowth,
      growthPercent: p.mfGrowthPercent,
    }));
  }, [analysisData.investments.portfolioGrowthHistory]);

  if (!isAnalysisExportModalOpen) return null;

  // Actions: In-App HTML Viewer & Crisp PDF
  const handleOpenHtmlViewer = () => {
    const htmlContent = generateAnalysisHTML(analysisData, scope);
    const dateStr = toInputDate(new Date()).replace(/-/g, '');
    const prefix = scope === 'analytics' ? 'cash-flow' : scope === 'investments' ? 'portfolio' : 'financial-analysis';
    const scopeLabel = scope === 'analytics' ? 'Cash Flow Analysis' : scope === 'investments' ? 'Portfolio Wealth Dossier' : 'Executive Financial Analysis';
    openHtmlReportViewer({
      htmlContent,
      title: `${scopeLabel} (${periodLabel})`,
      fileName: `${prefix}-dossier-${dateStr}.pdf`,
      badge: 'Executive Dossier',
      subtitle: `FinSync Audit Dossier · Period: ${periodLabel} · Scope: ${scope}`,
      reportType: 'analysis',
    });
  };

  const handleExportPDF = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);

    try {
      await exportAnalysisToPdf(analysisData, undefined, scope);
      // App notification (system notification) is dispatched automatically by fileService
    } catch (err) {
      console.error('Failed to export PDF, falling back to HTML download', err);
      showToast('PDF download issue. Falling back to HTML dossier...', 'error');
      handleDownloadHTML();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrintHTML = () => {
    showToast('Opening print dialog (A4 full-width format)...', 'info');
    const htmlContent = generateAnalysisHTML(analysisData, scope);
    printHtmlReport(htmlContent);
  };

  const handleDownloadHTML = () => {
    const htmlContent = generateAnalysisHTML(analysisData, scope);
    const dateStr = toInputDate(new Date()).replace(/-/g, '');
    const prefix = scope === 'analytics' ? 'analytics' : scope === 'investments' ? 'investments' : 'financial-analysis';
    downloadAnalysisFile(htmlContent, `${prefix}-dossier-${dateStr}.html`, 'text/html');
  };

  const handleDownloadCSV = () => {
    const csvContent = generateAnalysisCSV(analysisData);
    const dateStr = toInputDate(new Date()).replace(/-/g, '');
    downloadAnalysisFile(csvContent, `financial-investment-audit-${dateStr}.csv`, 'text/csv;charset=utf-8;');
  };

  const handleCopyMarkdown = async () => {
    const md = generateAnalysisMarkdown(analysisData);
    try {
      await navigator.clipboard.writeText(md);
      setCopiedMarkdown(true);
      showToast('Executive Markdown summary copied to clipboard!', 'success');
      setTimeout(() => setCopiedMarkdown(false), 2500);
    } catch {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(analysisData, null, 2);
    const dateStr = toInputDate(new Date()).replace(/-/g, '');
    downloadAnalysisFile(jsonStr, `analysis-investment-data-${dateStr}.json`, 'application/json');
  };

  const isNetSurplus = analysisData.analytics.netSavings >= 0;
  const isPortfolioProfitable = analysisData.investments.unrealizedPnL >= 0;

  // Asset allocation pie data
  const assetAllocationData = [
    {
      name: 'Stocks',
      value: analysisData.investments.assetAllocation.stocks.current,
      invested: analysisData.investments.assetAllocation.stocks.invested,
      weight: analysisData.investments.assetAllocation.stocks.weight,
      color: ASSET_COLORS.stocks,
    },
    {
      name: 'Mutual Funds',
      value: analysisData.investments.assetAllocation.mutualFunds.current,
      invested: analysisData.investments.assetAllocation.mutualFunds.invested,
      weight: analysisData.investments.assetAllocation.mutualFunds.weight,
      color: ASSET_COLORS.mutualFunds,
    },
    {
      name: 'Bonds & SGBs',
      value: analysisData.investments.assetAllocation.bonds.current,
      invested: analysisData.investments.assetAllocation.bonds.invested,
      weight: analysisData.investments.assetAllocation.bonds.weight,
      color: ASSET_COLORS.bonds,
    },
    {
      name: 'Provident Fund (PF)',
      value: analysisData.investments.assetAllocation.pf?.current || 0,
      invested: analysisData.investments.assetAllocation.pf?.invested || 0,
      weight: analysisData.investments.assetAllocation.pf?.weight || 0,
      color: ASSET_COLORS.pf,
    },
  ].filter((item) => item.value > 0);

  // Category expense pie data
  const categoryExpenseData = analysisData.analytics.topExpenses.map((c) => ({
    name: c.name,
    value: c.amount,
    percentage: c.percentage,
    color: c.color,
  }));

  // Filtered and sorted holdings
  const filteredHoldings = analysisData.investments.holdings
    .filter((h) => {
      if (!holdingSearch.trim()) return true;
      const q = holdingSearch.toLowerCase().trim();
      return (
        h.symbol.toLowerCase().includes(q) ||
        h.name.toLowerCase().includes(q) ||
        h.assetType.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (holdingSortBy === 'value') return b.currentValue - a.currentValue;
      if (holdingSortBy === 'pnl') return b.unrealizedPnL - a.unrealizedPnL;
      return a.symbol.localeCompare(b.symbol);
    });

  const stocksData = analysisData.investments.stocksVsMutualFunds.stocks;
  const mfData = analysisData.investments.stocksVsMutualFunds.mutualFunds;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col h-[100dvh] w-full overflow-hidden animate-in fade-in duration-200">
      {/* Fullscreen Sticky Top Header */}
      <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 pt-safe flex items-center justify-between gap-3 shadow-2xs z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 -ml-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Back / Close"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <img
            src="/assets/aistudio/1000127183_6a8d46a3.png"
            alt="FinSync"
            className="w-9 h-9 rounded-xl object-cover shrink-0 shadow-xs ring-1 ring-emerald-500/20"
          />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                FinSync Executive Financial Analysis
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 shrink-0">
                Executive Dossier
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              FinSync · Log • Split • Track • Analyse • Grow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleOpenHtmlViewer}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-all cursor-pointer shrink-0 active:scale-95"
            title="Open interactive in-app HTML view with print & PDF download"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">HTML View & PDF</span>
            <span className="sm:hidden">HTML View</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer shrink-0 shadow-2xs active:scale-95 disabled:opacity-60"
            title="Download publication-grade executive PDF dossier"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
            <span className="sm:hidden">{isExportingPdf ? '...' : 'PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Report"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Fullscreen Body: Scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-safe pb-24 min-h-0 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
          {/* Controls: Scope & Period Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Scope Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Analysis Scope
              </label>
              <div className="p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`flex-1 py-1.5 sm:py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                    scope === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Combined
                </button>
                <button
                  type="button"
                  onClick={() => setScope('analytics')}
                  className={`flex-1 py-1.5 sm:py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                    scope === 'analytics'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Cash Flow
                </button>
                <button
                  type="button"
                  onClick={() => setScope('investments')}
                  className={`flex-1 py-1.5 sm:py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                    scope === 'investments'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Portfolio
                </button>
              </div>
            </div>

            {/* Period Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Reporting Period
              </label>
              <div className="p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex items-center gap-1">
                {(['month', 'year', 'all', 'custom'] as ExportPeriod[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`flex-1 py-1.5 sm:py-2 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                      period === p
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {p === 'month' ? 'Month' : p === 'year' ? 'Year' : p === 'all' ? 'All Time' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Date Inputs */}
          {period === 'custom' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center gap-4 text-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-semibold">From Date:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-semibold">To Date:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Navigation Tabs Inside Report Preview */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveTab('charts')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'charts'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Visual Charts</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Executive Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('holdings')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'holdings'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>Holdings ({analysisData.investments.holdings.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cashflow')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'cashflow'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                <span>Cash Flow ({analysisData.analytics.categories.length})</span>
              </button>
            </div>

            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Scope: {periodLabel}
            </span>
          </div>

          {/* TAB 1: VISUAL CHARTS & GRAPHS */}
          {activeTab === 'charts' && (
            <div className="space-y-6 animate-fade-in">
              {/* Custom Profit & Loss Growth Bar Chart: Combined, Stocks, Mutual Funds */}
              <ProfitLossGrowthBarChart
                combinedData={combinedGrowthBars}
                stocksData={stocksGrowthBars}
                mfData={mfGrowthBars}
                title="Capital Growth & Returns (Combined, Stocks & Mutual Funds)"
                subtitle="Custom single-bar analysis: Blue invested base + Green bordered profit / Red dotted loss"
                height={260}
                showCategorySwitch={true}
              />

              {/* Chart 1: 6-Month Income vs Expense Line Chart Comparison */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <LineChartIcon className="w-4 h-4 text-cyan-500" />
                      <span>Last 6 Months: Income & Expense Comparison</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Side-by-side comparison of inflows, outflows, and net savings curve
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" />
                      <span className="text-slate-700 dark:text-slate-300">Income</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]" />
                      <span className="text-slate-700 dark:text-slate-300">Expense</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-0.5 bg-[#f97316] rounded-full" />
                      <span className="text-orange-600 dark:text-orange-400">Net Savings</span>
                    </div>
                  </div>
                </div>

                {/* 6-Month Line Chart matching AnalyticsTab */}
                <div className="h-64 sm:h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={analysisData.analytics.sixMonthTrend}
                      margin={{ top: 12, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                      <XAxis
                        dataKey="shortLabel"
                        axisLine={false}
                        tickLine={false}
                        stroke="#94a3b8"
                        fontSize={11}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        stroke="#94a3b8"
                        fontSize={11}
                        tickFormatter={(v) => `₹${formatCompactINR(Number(v))}`}
                      />
                      <Tooltip
                        cursor={false}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="p-3 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-xl text-xs space-y-1.5 text-white">
                                <p className="font-extrabold text-slate-200 border-b border-slate-800 pb-1">
                                  {data.monthLabel}
                                </p>
                                <div className="flex justify-between gap-4 text-[#06b6d4] font-semibold">
                                  <span>Income:</span>
                                  <span className="tabular-nums font-mono">{formatINR(data.income)}</span>
                                </div>
                                <div className="flex justify-between gap-4 text-[#f43f5e] font-semibold">
                                  <span>Expense:</span>
                                  <span className="tabular-nums font-mono">{formatINR(data.expense)}</span>
                                </div>
                                <div className="flex justify-between gap-4 pt-1 border-t border-slate-800 font-bold text-[#f97316]">
                                  <span>Net Savings:</span>
                                  <span className="tabular-nums font-mono">
                                    {data.netSavings >= 0 ? '+' : ''}{formatINR(data.netSavings)}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400">
                                  Savings Rate: {data.savingsRate}% · {data.txCount} transactions
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        height={28}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="income"
                        name="Income"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#06b6d4' }}
                        activeDot={{ r: 5, stroke: '#f97316', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="expense"
                        name="Expense"
                        stroke="#f43f5e"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#f43f5e' }}
                        activeDot={{ r: 5, stroke: '#06b6d4', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="netSavings"
                        name="Net Savings"
                        stroke="#f97316"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 2, fill: '#f97316' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 6-Month Key Aggregates Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/50">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/40">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">6M Total Income</span>
                    <div className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono mt-0.5">
                      {formatINR(analysisData.analytics.sixMonthSummary.totalIncome)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/40">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">6M Total Expenses</span>
                    <div className="text-xs sm:text-sm font-extrabold text-rose-600 dark:text-rose-400 tabular-nums font-mono mt-0.5">
                      {formatINR(analysisData.analytics.sixMonthSummary.totalExpense)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/40">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">6M Net Surplus</span>
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums font-mono mt-0.5">
                      {analysisData.analytics.sixMonthSummary.netSavings >= 0 ? '+' : ''}
                      {formatINR(analysisData.analytics.sixMonthSummary.netSavings)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/40">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Monthly Avg Savings</span>
                    <div className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono mt-0.5">
                      {formatINR(analysisData.analytics.sixMonthSummary.avgMonthlySavings)}/mo
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart 2: Portfolio Growth Trajectory (Last 6 Months) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-500" />
                      <span>Portfolio Growth & Wealth Trajectory</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Cumulative invested capital vs. market portfolio valuation over time
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-indigo-600 rounded-full" />
                      <span className="text-indigo-600 dark:text-indigo-400">Market Valuation</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-slate-400 border-dashed" />
                      <span className="text-slate-600 dark:text-slate-400">Invested Capital</span>
                    </div>
                  </div>
                </div>

                <div className="h-64 sm:h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={analysisData.investments.portfolioGrowthHistory}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                      <XAxis
                        dataKey="shortLabel"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(v) => formatCompactINR(v)}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl text-xs space-y-1.5">
                                <p className="font-extrabold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">
                                  {data.monthLabel}
                                </p>
                                <div className="flex justify-between gap-4 text-indigo-600 dark:text-indigo-400 font-bold">
                                  <span>Valuation:</span>
                                  <span className="tabular-nums font-mono">{formatINR(data.valuation)}</span>
                                </div>
                                <div className="flex justify-between gap-4 text-slate-500 font-semibold">
                                  <span>Invested:</span>
                                  <span className="tabular-nums font-mono">{formatINR(data.invested)}</span>
                                </div>
                                <div className="flex justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-800 font-bold text-emerald-600 dark:text-emerald-400">
                                  <span>Net Growth:</span>
                                  <span className="tabular-nums font-mono">
                                    {data.growth >= 0 ? '+' : ''}{formatINR(data.growth)} ({data.growthPercent}%)
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="valuation"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        fill="url(#growthGrad)"
                        dot={{ r: 4, fill: '#ffffff', stroke: '#4f46e5', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="invested"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grid: Asset Allocation Donut + Stocks vs Mutual Funds Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Asset Class Allocation Donut Chart */}
                <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Asset Class Allocation
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Portfolio weight distribution
                      </p>
                    </div>
                    <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                      {formatINR(analysisData.investments.totalCurrentValue)}
                    </span>
                  </div>

                  <div className="h-52 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={assetAllocationData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                        >
                          {assetAllocationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => [formatINR(Number(value)), 'Valuation']}
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderRadius: '12px',
                            border: '1px solid #1e293b',
                            color: '#ffffff',
                            fontSize: '11px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Allocation Legend Chips */}
                  <div className="space-y-1.5 pt-1">
                    {assetAllocationData.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/40 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold tabular-nums text-slate-900 dark:text-white mr-2">
                            {formatINR(item.value)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">
                            {item.weight.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Stocks vs. Mutual Funds Deep Dive */}
                <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Stocks vs. Mutual Funds Comparison
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Comparative performance and yield profile
                    </p>
                  </div>

                  {/* Side-by-Side Mini Cards */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Equities */}
                    <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">
                          Equities (Stocks)
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                          {stocksData.count}
                        </span>
                      </div>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums font-mono">
                        {formatINR(stocksData.current)}
                      </div>
                      <div className="text-[10px] text-slate-500">Cost: {formatINR(stocksData.invested)}</div>
                      <div
                        className={`text-xs font-bold pt-1 ${
                          stocksData.unrealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {stocksData.unrealizedPnL >= 0 ? '+' : ''}
                        {stocksData.unrealizedPnLPercent}% return
                      </div>
                    </div>

                    {/* Mutual Funds */}
                    <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                          Mutual Funds
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                          {mfData.count}
                        </span>
                      </div>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums font-mono">
                        {formatINR(mfData.current)}
                      </div>
                      <div className="text-[10px] text-slate-500">Cost: {formatINR(mfData.invested)}</div>
                      <div
                        className={`text-xs font-bold pt-1 ${
                          mfData.unrealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {mfData.unrealizedPnL >= 0 ? '+' : ''}
                        {mfData.unrealizedPnLPercent}% return
                      </div>
                    </div>
                  </div>

                  {/* Relative Weight Distribution Bar */}
                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/40 space-y-2">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-blue-600">Equities: {stocksData.weight.toFixed(1)}%</span>
                      <span className="text-emerald-600">Mutual Funds: {mfData.weight.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                      <div style={{ width: `${stocksData.weight}%` }} className="bg-blue-600 h-full" />
                      <div style={{ width: `${mfData.weight}%` }} className="bg-emerald-600 h-full" />
                      <div style={{ width: `${analysisData.investments.stocksVsMutualFunds.bonds.weight}%` }} className="bg-amber-500 h-full" />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                      <span>Active SIP Commitments:</span>
                      <strong className="text-indigo-600 dark:text-indigo-400">
                        {mfData.activeSipsCount} plans ({formatINR(mfData.monthlySipCommitment)}/mo)
                      </strong>
                    </div>
                  </div>

                  {/* Top Category Spending Quick Bar */}
                  {categoryExpenseData.length > 0 && (
                    <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/40 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Top Spending Categories ({periodLabel})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {categoryExpenseData.slice(0, 4).map((c) => (
                          <span
                            key={c.name}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            {c.name}: <strong>{formatINR(c.value)}</strong> ({c.percentage}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXECUTIVE OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-fade-in">
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Net Worth */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Combined Net Worth
                  </span>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 tabular-nums truncate">
                    {formatINR(analysisData.netWorth.totalNetWorth)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Liquid Cash: {formatINR(analysisData.netWorth.liquidCash)}
                  </div>
                </div>

                {/* Portfolio Value */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Portfolio Value
                  </span>
                  <div className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums truncate">
                    {formatINR(analysisData.investments.totalCurrentValue)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Cost Basis: {formatINR(analysisData.investments.totalInvested)}
                  </div>
                </div>

                {/* Unrealized P&L */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Unrealized P&L
                  </span>
                  <div
                    className={`text-base sm:text-lg font-black mt-1 tabular-nums truncate flex items-center gap-0.5 ${
                      isPortfolioProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isPortfolioProfitable ? '+' : ''}
                    {formatINR(analysisData.investments.unrealizedPnL)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {analysisData.investments.unrealizedPnLPercent >= 0 ? '+' : ''}
                    {analysisData.investments.unrealizedPnLPercent}% return
                  </div>
                </div>

                {/* Savings Rate / XIRR */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Savings Rate / XIRR
                  </span>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums truncate">
                    {analysisData.analytics.savingsRate}%
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    XIRR: {analysisData.investments.portfolioXIRR !== null ? `${analysisData.investments.portfolioXIRR.toFixed(1)}%` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Cash Flow Highlights & Summary */}
              <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 text-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Period Cash Inflow: <strong className="text-emerald-600">{formatINR(analysisData.analytics.totalIncome)}</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Outflow: <strong className="text-rose-600">{formatINR(analysisData.analytics.totalExpense)}</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Net: <strong className={isNetSurplus ? 'text-emerald-600' : 'text-rose-600'}>{formatINR(analysisData.analytics.netSavings)}</strong>
                    </span>
                  </div>
                  <div className="text-slate-500">
                    {analysisData.analytics.transactionCount} transactions | {analysisData.investments.holdings.length} securities
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/40 grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="font-bold text-slate-400 text-[10px] uppercase block">6-Month Highs</span>
                    <p className="mt-0.5">Highest Income: <strong>{analysisData.analytics.sixMonthSummary.highestIncomeMonth}</strong></p>
                    <p>Highest Spend: <strong>{analysisData.analytics.sixMonthSummary.highestExpenseMonth}</strong></p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 text-[10px] uppercase block">Averages</span>
                    <p className="mt-0.5">Monthly Inflow Avg: <strong>{formatINR(analysisData.analytics.sixMonthSummary.avgMonthlyIncome)}</strong></p>
                    <p>Monthly Outflow Avg: <strong>{formatINR(analysisData.analytics.sixMonthSummary.avgMonthlyExpense)}</strong></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HOLDINGS LEDGER */}
          {activeTab === 'holdings' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name, symbol, or type..."
                    value={holdingSearch}
                    onChange={(e) => setHoldingSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 font-semibold">Sort by:</span>
                  <select
                    value={holdingSortBy}
                    onChange={(e) => setHoldingSortBy(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <option value="value">Current Valuation</option>
                    <option value="pnl">Unrealized P&L</option>
                    <option value="name">Symbol Name</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 max-h-80">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Asset Name</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Units</th>
                      <th className="py-2.5 px-3 text-right">CMP (₹)</th>
                      <th className="py-2.5 px-3 text-right">Invested (₹)</th>
                      <th className="py-2.5 px-3 text-right">Value (₹)</th>
                      <th className="py-2.5 px-3 text-right">P&L (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredHoldings.map((h) => {
                      const isProf = h.unrealizedPnL >= 0;
                      return (
                        <tr key={h.symbol} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{h.symbol}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300 truncate max-w-[140px]">{h.name}</td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              h.assetType === 'stock'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              {h.assetType.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">{formatNumber(h.quantity)}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-mono">{formatINR(h.currentPrice)}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-500">{formatINR(h.investedValue)}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-mono font-bold text-slate-900 dark:text-white">
                            {formatINR(h.currentValue)}
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums font-mono font-bold ${isProf ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isProf ? '+' : ''}{formatINR(h.unrealizedPnL)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: CASH FLOW BREAKDOWN */}
          {activeTab === 'cashflow' && (
            <div className="space-y-4 animate-fade-in">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Category Spending Breakdown
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {analysisData.analytics.categories.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="font-bold text-slate-800 dark:text-slate-200">{c.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">({c.type})</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold tabular-nums text-slate-900 dark:text-white">{formatINR(c.amount)}</div>
                      <div className="text-[10px] text-slate-400">{c.percentage}% · {c.count} tx</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Channels Action Grid */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
              Download & Export Formats
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Primary Action: App Native HTML Viewer & Crisp PDF */}
              <button
                type="button"
                onClick={handleOpenHtmlViewer}
                className="sm:col-span-2 flex items-center justify-between p-4.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-700/20 active:scale-[0.99] transition-all cursor-pointer group text-left ring-1 ring-white/20"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                      <span>Preview HTML Report & Download PDF</span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/25 text-white tracking-wider">
                        Recommended
                      </span>
                    </div>
                    <div className="text-xs text-white/90 mt-0.5">
                      Inspect interactive HTML report in-app with A4 paper sheet mode, zoom controls, and download crisp publication PDF directly.
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 opacity-90 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
              </button>

              {/* Action 1: Direct Export to PDF */}
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={isExportingPdf}
                className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/60 text-slate-900 dark:text-white shadow-xs active:scale-[0.99] transition-all cursor-pointer group text-left disabled:opacity-75"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm flex items-center gap-1.5">
                      <span>{isExportingPdf ? 'Compiling PDF...' : 'Quick Download PDF'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Direct background compilation with vector text & embedded charts
                    </div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0" />
              </button>

              {/* Action 2: Multi-Section CSV Spreadsheet */}
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-900 dark:text-white shadow-xs active:scale-[0.99] transition-all cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm">Download CSV Workbook</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Excel / Google Sheets compatible with 6-month trend & stocks vs MF
                    </div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0" />
              </button>

              {/* Action 3: Copy Executive Markdown to Clipboard */}
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-500/60 dark:hover:border-purple-500/60 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-900 dark:text-white shadow-xs active:scale-[0.99] transition-all cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    {copiedMarkdown ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-extrabold text-sm flex items-center gap-2">
                      <span>Copy Markdown Summary</span>
                      {copiedMarkdown && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded font-bold">
                          Copied!
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Formatted summary with comparison data for emails or Notion
                    </div>
                  </div>
                </div>
                <Copy className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors shrink-0" />
              </button>

              {/* Action 4: Standalone HTML Dossier & JSON */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadHTML}
                  className="flex-1 flex items-center justify-center gap-2 py-4 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500/60 text-slate-900 dark:text-white font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer"
                  title="Download standalone HTML file with embedded inline SVG charts"
                >
                  <FileCode className="w-4 h-4 text-blue-500" />
                  <span>Save HTML Dossier</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJSON}
                  className="flex-1 flex items-center justify-center gap-2 py-4 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500/60 text-slate-900 dark:text-white font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer"
                  title="Download complete raw JSON data representation"
                >
                  <Download className="w-4 h-4 text-amber-500" />
                  <span>Download JSON</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Sticky Bottom Footer */}
      <footer className="shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between text-xs text-slate-400 z-10">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="truncate">FinSync · Indian Rupee (₹) standard notation, FIFO gains & AMFI NAVs</span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
        >
          Close Report
        </button>
      </footer>
    </div>
  );
};
