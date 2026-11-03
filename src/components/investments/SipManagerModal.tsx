import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SipSchedule, SipExecutionRecord } from '../../types';
import { formatINR, formatDate } from '../../utils/formatters';
import { POPULAR_MF_SCHEMES, searchAmfiSchemes } from '../../utils/amfiSipEngine';
import {
  X,
  ArrowLeft,
  Plus,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Landmark,
  ShieldAlert,
  Search,
  Sparkles,
} from 'lucide-react';

export const SipManagerModal: React.FC = () => {
  const {
    isSipManagerOpen,
    setIsSipManagerOpen,
    sipSchedules,
    sipExecutions,
    addSipSchedule,
    updateSipSchedule,
    deleteSipSchedule,
    deleteSipExecution,
    clearSipExecutions,
    toggleSipStatus,
    runSipWorkerNow,
    accounts,
    holdings,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'schedules' | 'new' | 'logs'>('schedules');
  const [isRunningWorker, setIsRunningWorker] = useState(false);
  const [sipToDelete, setSipToDelete] = useState<SipSchedule | null>(null);
  const [logToDelete, setLogToDelete] = useState<SipExecutionRecord | null>(null);
  const [isConfirmingClearLogs, setIsConfirmingClearLogs] = useState(false);

  // Form state
  const [schemeCode, setSchemeCode] = useState('');
  const [schemeName, setSchemeName] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('5000');
  const [sipDate, setSipDate] = useState('15');
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id || '');
  const [notes, setNotes] = useState('');

  // Scheme Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ schemeCode: string; schemeName: string; nav?: number }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (activeTab !== 'new') return;
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    let isMounted = true;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchAmfiSchemes(searchQuery);
        if (isMounted) setSearchResults(res);
      } catch {
        if (isMounted) setSearchResults([]);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    }, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, activeTab]);

  if (!isSipManagerOpen) return null;

  const handleClose = () => {
    setIsSipManagerOpen(false);
  };

  const handlePickPopularScheme = (popular: { code: string; name: string; nav: number }) => {
    setSchemeCode(popular.code);
    setSchemeName(popular.name);
  };

  const handleCreateSip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schemeCode.trim() || !schemeName.trim()) return;

    const amount = parseFloat(installmentAmount) || 1000;
    const day = Math.min(28, Math.max(1, parseInt(sipDate, 10) || 15));

    // Match or link with existing holding if available
    const matchedHolding = holdings.find(
      (h) =>
        h.symbol === schemeCode ||
        h.name.toLowerCase().includes(schemeName.toLowerCase()) ||
        schemeName.toLowerCase().includes(h.name.toLowerCase())
    );

    addSipSchedule({
      schemeCode: schemeCode.trim(),
      schemeName: schemeName.trim(),
      installmentAmount: amount,
      sipDate: day,
      fromAccountId: fromAccountId || undefined,
      status: 'ACTIVE',
      frequency: 'MONTHLY',
      holdingId: matchedHolding ? matchedHolding.id : undefined,
      notes: notes.trim() || undefined,
    });

    // Reset and return to schedules
    setSchemeCode('');
    setSchemeName('');
    setNotes('');
    setActiveTab('schedules');
  };

  const handleTriggerWorker = async () => {
    setIsRunningWorker(true);
    await runSipWorkerNow();
    setIsRunningWorker(false);
  };

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-150">
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 border-x border-slate-200 dark:border-slate-800 shadow-xl">
        {/* Fullscreen Sticky Header */}
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0"
              title="Back to Investments"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Investments</span>
            </button>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                  Mutual Fund SIP Manager
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shrink-0">
                  AMFI Tracker
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Automated monthly tracking with official AMFI closing NAV & Next Business Day Forward Look
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Tab Navigation & Live Action Buttons */}
        <div className="px-4 sm:px-8 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800 rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('schedules')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'schedules'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Active SIPs ({sipSchedules.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('new')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'new'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create SIP</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Execution Logs ({sipExecutions.length})
            </button>
          </div>

          <button
            type="button"
            disabled={isRunningWorker}
            onClick={handleTriggerWorker}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Fetch today's official closing NAV from AMFI and execute pending SIPs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunningWorker ? 'animate-spin' : ''}`} />
            <span>{isRunningWorker ? 'Fetching AMFI Feed...' : 'Run SIP Check Now'}</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-8 space-y-5 overflow-y-auto flex-1 pb-24">
          {/* TAB 1: SCHEDULES */}
          {activeTab === 'schedules' && (
            <div className="space-y-3">
              {sipSchedules.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                  <CalendarClock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    No SIP schedules configured yet
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                    Add your mutual fund SIPs to automatically track monthly installments and unit allotments.
                  </p>
                  <button
                    onClick={() => setActiveTab('new')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Set up your first SIP
                  </button>
                </div>
              ) : (
                sipSchedules.map((sip) => {
                  const isExecutedThisMonth = sip.lastExecutedMonthYear === currentMonthStr;
                  const isPendingThisMonth =
                    sip.status === 'ACTIVE' &&
                    today.getDate() >= sip.sipDate &&
                    !isExecutedThisMonth;

                  return (
                    <div
                      key={sip.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {sip.schemeName}
                          </h4>
                          <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                            Code: {sip.schemeCode}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              sip.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {sip.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          <span>
                            Amount:{' '}
                            <strong className="text-slate-900 dark:text-white font-bold">
                              {formatINR(sip.installmentAmount)}
                            </strong>{' '}
                            / month
                          </span>
                          <span>·</span>
                          <span>
                            Scheduled on: <strong>{sip.sipDate}th of month</strong>
                          </span>
                          {sip.fromAccountId && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Landmark className="w-3 h-3" />
                                {accounts.find((a) => a.id === sip.fromAccountId)?.name || 'Bank Account'}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Status message */}
                        <div className="pt-1 text-[11px]">
                          {isExecutedThisMonth ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Executed for {currentMonthStr} ({sip.lastUnitsAllotted} units @ ₹{sip.lastNavPrice})
                            </span>
                          ) : isPendingThisMonth ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Scheduled date passed ({sip.sipDate}th). Awaiting open market day NAV.
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              Next scheduled execution: {sip.sipDate}th of next business window.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => toggleSipStatus(sip.id)}
                          className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                            sip.status === 'ACTIVE'
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                          title={sip.status === 'ACTIVE' ? 'Pause SIP' : 'Resume SIP'}
                        >
                          {sip.status === 'ACTIVE' ? (
                            <>
                              <Pause className="w-3.5 h-3.5" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Resume</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSipToDelete(sip)}
                          className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                          title="Delete SIP"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: CREATE NEW SIP */}
          {activeTab === 'new' && (
            <form onSubmit={handleCreateSip} className="space-y-4">
              {/* Popular Schemes Picker for 1-click fill */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Popular Mutual Fund Schemes (Click to auto-populate)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {POPULAR_MF_SCHEMES.map((pop) => (
                    <button
                      key={pop.code}
                      type="button"
                      onClick={() => handlePickPopularScheme(pop)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg text-left transition-all cursor-pointer ${
                        schemeCode === pop.code
                          ? 'bg-purple-600 text-white font-bold'
                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                      }`}
                    >
                      {pop.name.split('-')[0].trim()} ({pop.code})
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    AMFI Scheme Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={schemeCode}
                    onChange={(e) => setSchemeCode(e.target.value)}
                    placeholder="e.g. 120503 or 119551"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Find on amfiindia.com or fund factsheet.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Scheme Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={schemeName}
                    onChange={(e) => setSchemeName(e.target.value)}
                    placeholder="e.g. Mirae Asset Large Cap Direct Growth"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Installment (₹) *
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    required
                    value={installmentAmount}
                    onChange={(e) => setInstallmentAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SIP Date of Month (1 - 28) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    required
                    value={sipDate}
                    onChange={(e) => setSipDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Funding Bank Account
                  </label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="">None / External</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Mandate ID, folio number, goals"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>How AMFI Next Business Day Allotment Works:</span>
                </div>
                <p>
                  1. If scheduled SIP date falls on a weekend or public holiday, the tracker waits for the
                  first open business day and fetches that day's fresh official closing NAV.
                </p>
                <p>
                  2. Units are allocated strictly as: <code>units = installmentAmount / navPrice</code>.
                </p>
                <p>3. Exactly one execution row per month is recorded (no duplicate double-buying).</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('schedules')}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Create & Activate SIP
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: EXECUTION LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              {sipExecutions.length > 0 && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Execution History ({sipExecutions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearLogs(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    title="Clear all recorded execution logs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Logs</span>
                  </button>
                </div>
              )}

              {sipExecutions.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  No execution logs recorded yet. Tap "Run SIP Check Now" to process pending allotments.
                </div>
              ) : (
                sipExecutions.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 text-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full ${
                            log.status === 'EXECUTED'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {log.status === 'EXECUTED' ? 'Allotted' : 'Deferred (Holiday/Weekend)'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {log.schemeName}
                        </span>
                        {log.schemeCode && (
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            ({log.schemeCode})
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                        {log.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 ml-2">
                      <div className="text-right">
                        <span className="text-[11px] font-semibold text-slate-400 block whitespace-nowrap">
                          {log.transactionDate}
                        </span>
                        {log.status === 'EXECUTED' && (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums block whitespace-nowrap">
                            {formatINR(log.installmentAmount)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setLogToDelete(log)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer shrink-0"
                        title="Delete this execution log entry"
                        aria-label="Delete execution log entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmatory Delete Individual Log Dialog */}
      {logToDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Execution Log?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Remove execution log for <strong className="font-semibold text-slate-800 dark:text-slate-200">"{logToDelete.schemeName}"</strong> from {logToDelete.transactionDate}? If any corresponding portfolio allotment transaction exists, it will also be cleaned up.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setLogToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSipExecution(logToDelete.id);
                  setLogToDelete(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmatory Clear All Logs Dialog */}
      {isConfirmingClearLogs && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Clear All Execution Logs?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to clear all {sipExecutions.length} recorded SIP execution logs? This removes historical logs without affecting existing holding balances.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingClearLogs(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSipExecutions();
                  setIsConfirmingClearLogs(false);
                }}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmatory Delete SIP Dialog */}
      {sipToDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete SIP Schedule?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to delete the SIP schedule for <strong className="font-semibold text-slate-800 dark:text-slate-200">"{sipToDelete.schemeName}"</strong> ({formatINR(sipToDelete.installmentAmount)} on day {sipToDelete.sipDate})? Past recorded ledger purchases will not be affected.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSipToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSipSchedule(sipToDelete.id);
                  setSipToDelete(null);
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
