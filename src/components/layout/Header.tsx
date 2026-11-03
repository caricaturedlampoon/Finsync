import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useNavigation } from '../../navigation/NavigationContext';
import {
  Search,
  MoreVertical,
  Download,
  ShieldCheck,
  Lock,
  ArrowLeft,
  PieChart,
  Landmark,
  TrendingUp,
  Coins,
  Users,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    settings,
    userProfile,
    setIsProfileHubOpen,
    setIsSearchModalOpen,
    setIsExtendedToolsOpen,
    lockApp,
  } = useApp();

  const { goBack } = useNavigation();

  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  const getInitials = (text: string) => {
    const parts = (text || '').trim().split(/\s+/);
    if (!parts[0]) return 'U';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Dynamic time-based greeting for Home Screen
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const isHome = activeTab === 'home';

  // Screen-specific metadata for contextual top app bars
  const getScreenMeta = () => {
    switch (activeTab) {
      case 'analytics':
        return { title: 'Analysis & Reports', icon: PieChart, subtitle: 'Insights, cash flows & graphs' };
      case 'accounts':
        return { title: 'Bank Accounts', icon: Landmark, subtitle: 'Passbooks & liquid assets' };
      case 'investments':
        return { title: 'Investments & Portfolio', icon: TrendingUp, subtitle: 'Stocks, Mutual Funds, SGBs & XIRR' };
      case 'debts':
        return { title: 'Debts Ledger', icon: Coins, subtitle: 'Borrowed & lent tracking' };
      case 'split_expenses':
        return { title: 'Split Expenses', icon: Users, subtitle: 'Group bills & settlements' };
      default:
        return { title: 'FinSync', icon: Landmark, subtitle: 'Log Split Track Analyse Grow' };
    }
  };

  const screenMeta = getScreenMeta();
  const ScreenIcon = screenMeta.icon;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-all pt-safe">
        <div
          className={`max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 transition-all ${
            isHome ? 'h-16 sm:h-20' : 'h-14 sm:h-16'
          }`}
        >
          {/* Left Zone */}
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            {isHome ? (
              /* HOME SCREEN ONLY HEADER: Profile Photo on left + 2-Line Dynamic Greeting */
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsProfileHubOpen(true)}
                  className="p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-emerald-500/30 shrink-0"
                  aria-label={userProfile.name ? `${userProfile.name}'s Profile & Hub` : 'Open Profile & Hub'}
                  title="Open Profile & Settings Hub"
                >
                  <div className="relative shrink-0">
                    {userProfile.avatarUrl ? (
                      <img
                        src={userProfile.avatarUrl}
                        alt={userProfile.name}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-emerald-500/30 group-hover:ring-emerald-500 shadow-xs transition-all"
                      />
                    ) : (
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center ring-2 ring-emerald-500/30 group-hover:ring-emerald-500 shadow-xs transition-all">
                        {getInitials(userProfile.name)}
                      </div>
                    )}
                  </div>
                </button>

                {/* Two-line Dynamic Greeting: Line 1 = Greeting, Line 2 = User Name */}
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight block truncate">
                    {getGreeting()}
                  </span>
                  <span className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-white leading-tight block truncate mt-0.5">
                    {userProfile.name || 'Friend'}
                  </span>
                </div>
              </div>
            ) : (
              /* OTHER SCREENS: Contextual Top App Bar with dynamic stack Back button */
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button
                  type="button"
                  onClick={goBack}
                  className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0 active:scale-95"
                  aria-label="Back to Previous Screen"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-700/60">
                    <ScreenIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate leading-none">
                      {screenMeta.title}
                    </h1>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-none">
                      {screenMeta.subtitle}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* PWA Install Button */}
            {!isInstalled && isInstallable && (
              <button
                onClick={install}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/50 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800/60"
                title="Install app on device"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
            )}

            {isIOS && !isInstalled && (
              <button
                onClick={() => setShowIOSModal(true)}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <span>Add to Home</span>
              </button>
            )}

            {/* Universal Command & Search Button */}
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="h-9 sm:h-10 px-2.5 sm:px-3 flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/70 hover:bg-slate-200/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer active:scale-95 border border-slate-200/60 dark:border-slate-700/50"
              aria-label="Universal search and command palette (Press ⌘K or Ctrl+K)"
              title="Search transactions, accounts, holdings & actions (⌘K / Ctrl+K)"
            >
              <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="hidden sm:inline text-xs font-semibold text-slate-700 dark:text-slate-200">
                Search
              </span>
              <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 shadow-2xs leading-none">
                ⌘K
              </kbd>
            </button>

            {/* Quick Vault Lock Button (shown when App Lock is configured) */}
            {settings.isAppLockEnabled && (
              <button
                type="button"
                onClick={lockApp}
                className="w-10 h-10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition-all cursor-pointer ring-1 ring-emerald-500/20"
                aria-label="Lock App Vault"
                title="Lock App Vault Now (PIN & Biometrics)"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}

            {/* Three-Dots Button -> Opens Extended More Tools Screen */}
            <button
              type="button"
              onClick={() => setIsExtendedToolsOpen(true)}
              className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              aria-label="More Tools & Quick Actions"
              title="More Tools & Quick Actions"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* iOS Installation Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Install on iPhone / iPad</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              To use FinSync as a standalone offline app on iOS:
            </p>
            <ol className="mt-3 text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
              <li>
                Tap the <strong className="text-slate-900 dark:text-white">Share</strong> button in Safari's bottom toolbar.
              </li>
              <li>
                Scroll down and tap <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong>.
              </li>
              <li>Launch from your home screen for full offline performance!</li>
            </ol>
            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800 text-sm font-semibold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
