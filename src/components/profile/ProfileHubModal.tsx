import React from 'react';
import { useApp } from '../../context/AppContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import {
  ArrowLeft,
  X,
  User,
  Settings,
  ReceiptText,
  Coins,
  CalendarClock,
  Tags,
  TrendingUp,
  Database,
  Download,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Users,
  HelpCircle,
} from 'lucide-react';

export const ProfileHubModal: React.FC = () => {
  const {
    isProfileHubOpen,
    setIsProfileHubOpen,
    userProfile,
    settings,
    openSettingsTab,
    setIsAllTransactionsModalOpen,
    setIsDebtsModalOpen,
    openSplitExpenses,
    setIsRecurringModalOpen,
    setIsCategoriesModalOpen,
    setIsInvestmentCSVModalOpen,
    setActiveTab,
    setIsBackupModalOpen,
    clearModalOpenedFromTools,
    setIsExtendedToolsOpen,
  } = useApp();

  const { isInstalled, isInstallable, install } = usePWAInstall();

  if (!isProfileHubOpen) return null;

  const handleClose = () => {
    setIsProfileHubOpen(false);
  };

  const getInitials = (text: string) => {
    const parts = (text || '').trim().split(/\s+/);
    if (!parts[0]) return 'ME';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-screen-title"
    >
      {/* Top Sticky App Bar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors pt-safe">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleClose}
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 group"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-sm font-semibold hidden sm:inline">Back</span>
            </button>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
            <div className="min-w-0">
              <h1
                id="profile-screen-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate"
              >
                Profile & Extended Hub
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-none truncate mt-0.5">
                Account identity & full management tools
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                handleClose();
                openSettingsTab('profile');
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Edit in Settings</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6 flex-1 pb-safe pb-36">
        {/* ========================================================= */}
        {/* FIRST CARD: USER NAME AND PROFILE PICTURE ENLARGED        */}
        {/* ========================================================= */}
        <section
          aria-label="User Profile Card"
          className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/20 dark:from-slate-900 dark:via-emerald-950/20 dark:to-teal-950/10 border border-emerald-500/20 dark:border-emerald-500/30 shadow-sm relative overflow-hidden"
        >
          {/* Subtle Decorative Glow */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-2xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            {/* Enlarged Avatar */}
            <div className="relative shrink-0">
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt={userProfile.name}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-emerald-500/30 shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white font-black text-3xl sm:text-4xl flex items-center justify-center ring-4 ring-emerald-500/30 shadow-lg tracking-wider">
                  {getInitials(userProfile.name)}
                </div>
              )}
              <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
              <div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate max-w-full">
                    {userProfile.name}
                  </h2>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Profile
                  </span>
                </div>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium mt-1 truncate">
                  {userProfile.tagline || 'Personal Finance Account'}
                </p>
                {userProfile.email && (
                  <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {userProfile.email}
                  </p>
                )}
              </div>

              {/* Action Banner: Profile editable only from Settings */}
              <div className="mt-4 pt-3 border-t border-emerald-500/10 dark:border-emerald-500/20 flex flex-wrap items-center justify-center sm:justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Profile editable exclusively in Settings</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    openSettingsTab('profile');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <Settings className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* BRAND IDENTITY CARD: FINSYNC DETAILED LOGO & TAGLINE      */}
        {/* ========================================================= */}
        <section
          aria-label="FinSync App Identity"
          className="p-5 sm:p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-md relative overflow-hidden flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left"
        >
          <img
            src="/assets/aistudio/1000127183_6a8d46a3.png"
            alt="FinSync - Log Split Track Analyse Grow"
            className="w-20 sm:w-24 h-20 sm:h-24 rounded-2xl object-cover shadow-lg shrink-0"
          />
          <div className="space-y-1 min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h2 className="text-lg font-black tracking-tight text-white">FinSync</h2>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Official
              </span>
            </div>
            <p className="text-xs font-bold text-emerald-400 tracking-wide">
              Log • Split • Track • Analyse • Grow
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Offline-first Personal Finance & Investment Tracker tailored for Indian Rupee notation, bank passbooks, portfolio management, and split expense groups.
            </p>
          </div>
        </section>

        {/* ========================================================= */}
        {/* VERTICALLY ARRANGED ITEMS AVAILABLE BY TAPPING 3 DOTS     */}
        {/* ========================================================= */}
        <section aria-label="Extended Tools & Navigation" className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Extended Tools & Quick Access (3-Dots Menu)
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Full Navigation
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
            {/* 1. All Transactions Screen */}
            <button
              type="button"
              onClick={() => {
                handleClose();
                setIsAllTransactionsModalOpen(true);
              }}
              className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <ReceiptText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    All Transactions
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    Passbook ledger, search, type filters & CSV download
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-500 transition-all shrink-0" />
            </button>

            {/* 2. Investments & Portfolio */}
            <button
              type="button"
              onClick={() => {
                clearModalOpenedFromTools();
                setIsExtendedToolsOpen(false);
                handleClose();
                setActiveTab('investments');
              }}
              className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Investments & Portfolio
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    Mutual funds, stocks, SGBs, live NAVs & XIRR returns
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 group-hover:text-blue-500 transition-all shrink-0" />
            </button>

            {/* 3. Debts & Loans */}
            <button
              type="button"
              onClick={() => {
                handleClose();
                setIsDebtsModalOpen(true);
              }}
              className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <Coins className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    Debts & Loans Ledger
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    Track money lent to friends and borrowed loan balances
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 group-hover:text-amber-500 transition-all shrink-0" />
            </button>

            {/* 3. Split Expenses (Group Bills & Shared Trip Ledgers) */}
            <button
              type="button"
              onClick={() => {
                handleClose();
                openSplitExpenses();
              }}
              className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    Split Expenses
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    Group bills, shared trip ledgers & split settlement calculations
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 group-hover:text-teal-500 transition-all shrink-0" />
            </button>

            {/* 3. Recurring Schedules */}
            <button
              type="button"
              onClick={() => {
                handleClose();
                setIsRecurringModalOpen(true);
              }}
              className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    Recurring Schedules
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    Monthly rent, subscriptions, salary credits & bills
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 group-hover:text-sky-500 transition-all shrink-0" />
            </button>

            {/* 4. Categories & Tags */}
            <button
              type="button"
              onClick={() => {
                handleClose();
                setIsCategoriesModalOpen(true);
              }}
              className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <Tags className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    Categories & Tags
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    Manage income & expense categories with icons and colors
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-500 transition-all shrink-0" />
            </button>


            {/* Encrypted Backup & Google Drive Cloud Sync */}
            <button
              type="button"
              onClick={() => {
                handleClose();
                setIsBackupModalOpen(true);
              }}
              className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    Encrypted Backup & Google Drive
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    AES-256-GCM password protection, Google Drive cloud sync & auto-backups
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-500 transition-all shrink-0" />
            </button>


            {/* Help */}
            <button
              type="button"
              onClick={() => {
                handleClose();
                openSettingsTab('help_guide');
              }}
              className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Help
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    Guides, step-by-step instructions, and FAQs
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 group-hover:text-indigo-500 transition-all shrink-0" />
            </button>

            {/* 6. Settings & Preferences */}
            <button
              type="button"
              onClick={() => {
                handleClose();
                openSettingsTab('all');
              }}
              className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <Settings className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                    All Settings & Preferences
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    Theme (Dark/Light/Auto), default accounts, currency, audit & backups
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-all shrink-0" />
            </button>

            {/* 7. Investment CSV Engine */}
            <button
              type="button"
              onClick={() => {
                handleClose();
                setIsInvestmentCSVModalOpen(true);
              }}
              className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Investment CSV Engine
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    Import broker trade books (Zerodha, Groww) with auto bank transfers
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 group-hover:text-indigo-500 transition-all shrink-0" />
            </button>

            {/* 8. Data & Offline Backups */}
            <button
              type="button"
              onClick={() => {
                handleClose();
                openSettingsTab('data');
              }}
              className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <Database className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Data & Offline Backups
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    Export & import CSV passbooks, full device JSON snapshots
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 group-hover:text-blue-500 transition-all shrink-0" />
            </button>

            {/* 9. Install App on Device (if applicable) */}
            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  install();
                }}
                className="w-full p-4 flex items-center justify-between gap-4 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 transition-colors text-left cursor-pointer group bg-emerald-50/40 dark:bg-emerald-950/20"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
                    <Download className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-300 block">
                      Install App on Phone / Desktop
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      100% offline standalone Progressive Web App
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>
            )}
          </div>
        </section>

        {/* Quick App Info & Security Footer Card */}
        <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>Local Device Storage & Encryption</span>
          </div>
          <span className="font-mono text-[11px] bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5 rounded-md">
            v2.4 PWA
          </span>
        </div>
      </main>
    </div>
  );
};
