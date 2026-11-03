import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { InvestmentHolding } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  getFundVerificationInfo,
  FundVerificationInfo,
  parseSchemePlanDetails,
} from '../../utils/amfiValidation';
import { searchAmfiSchemes, fetchSchemeLatestNav, POPULAR_MF_SCHEMES } from '../../utils/amfiSipEngine';
import { formatINR } from '../../utils/formatters';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Building2,
  X,
  Search,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  Palette,
  Check,
} from 'lucide-react';

interface FundBadgeProps {
  holding: InvestmentHolding;
  onOpenVerificationModal: (holding: InvestmentHolding) => void;
  onOpenConfirmationModal: (holding: InvestmentHolding) => void;
}

export const FundBadge: React.FC<FundBadgeProps> = ({
  holding,
  onOpenVerificationModal,
  onOpenConfirmationModal,
}) => {
  const { settings } = useApp();
  const info: FundVerificationInfo = getFundVerificationInfo(holding);

  if (!info.isFund) return null;

  const tickColor = settings.verifiedBadgeColor || 'blue';

  if (info.status === 'verified') {
    const isBlue = tickColor === 'blue';
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenVerificationModal(holding);
        }}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 shadow-2xs transition-all cursor-pointer ${
          isBlue
            ? 'bg-blue-50 hover:bg-blue-100/90 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 dark:text-blue-300 dark:border-blue-800'
            : 'bg-emerald-50 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800'
        }`}
        title={`Verified AMFI Fund: Direct Plan & Growth Option (${isBlue ? 'Blue' : 'Green'} Tick). Tap to view verification details.`}
      >
        <CheckCircle2
          className={`w-3.5 h-3.5 shrink-0 ${
            isBlue ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}
        />
        <span className="hidden xs:inline">Verified</span>
      </button>
    );
  }

  // Yellow badge for Confirmation Required from User
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenConfirmationModal(holding);
      }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 hover:bg-amber-200/90 text-amber-800 border border-amber-300 dark:bg-amber-950/70 dark:hover:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700 shrink-0 shadow-2xs transition-all cursor-pointer"
      title="Confirmation required from user: Tap to review & confirm fund scheme"
    >
      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
      <span>Confirm</span>
      <span className="hidden xs:inline">Required</span>
    </button>
  );
};

/* ========================================================================= */
/* 1. FUND VERIFICATION INFO MODAL (For Green / Blue Tick Verified Funds)    */
/* ========================================================================= */

interface FundVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: InvestmentHolding | null;
  onEditHolding?: (holding: InvestmentHolding) => void;
}

export const FundVerificationModal: React.FC<FundVerificationModalProps> = ({
  isOpen,
  onClose,
  holding,
  onEditHolding,
}) => {
  const { settings, updateSettings, showToast, updateHolding } = useApp();
  const [showChangeScheme, setShowChangeScheme] = useState(false);
  const [changeSearchQ, setChangeSearchQ] = useState('');
  const [changeSearchResults, setChangeSearchResults] = useState<Array<{ schemeCode: string; schemeName: string; nav?: number }>>([]);
  const [isSearchingChange, setIsSearchingChange] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowChangeScheme(false);
      setChangeSearchQ('');
      setChangeSearchResults([]);
    } else if (holding) {
      setChangeSearchQ(holding.name || '');
    }
  }, [isOpen, holding]);

  useEffect(() => {
    if (!showChangeScheme || !changeSearchQ.trim() || changeSearchQ.trim().length < 2) {
      setChangeSearchResults([]);
      return;
    }

    let isMounted = true;
    setIsSearchingChange(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchAmfiSchemes(changeSearchQ);
        if (isMounted) setChangeSearchResults(results);
      } catch {
        if (isMounted) setChangeSearchResults([]);
      } finally {
        if (isMounted) setIsSearchingChange(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [changeSearchQ, showChangeScheme]);

  if (!isOpen || !holding) return null;

  const tickColor = settings.verifiedBadgeColor || 'blue';
  const planDetails = parseSchemePlanDetails(holding.amfiSchemeName || holding.name);

  const handleToggleColor = (color: 'blue' | 'green') => {
    updateSettings({ verifiedBadgeColor: color });
    showToast(`Verified badge tick set to ${color === 'blue' ? 'Blue Tick' : 'Green Tick'}`, 'success');
  };

  const handleSelectNewScheme = async (scheme: { schemeCode: string; schemeName: string; nav?: number }) => {
    if (!holding) return;
    setIsSearchingChange(true);
    let nav = scheme.nav;
    if (!nav || nav <= 0) {
      const live = await fetchSchemeLatestNav(scheme.schemeCode);
      if (live && live.nav > 0) nav = live.nav;
    }
    setIsSearchingChange(false);

    updateHolding(holding.id, {
      amfiSchemeCode: scheme.schemeCode,
      amfiSchemeName: scheme.schemeName,
      currentPrice: nav && nav > 0 ? nav : holding.currentPrice,
      isVerified: true,
      requiresConfirmation: false,
      confirmationReason: undefined,
    });

    showToast(`Changed & verified scheme: ${scheme.schemeName}`, 'success');
    setShowChangeScheme(false);
    onClose();
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 isolate overscroll-contain">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-850/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                tickColor === 'blue'
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                  Verified Mutual Fund
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    tickColor === 'blue'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {tickColor === 'blue' ? 'Blue Tick' : 'Green Tick'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Official AMFI scheme verification & live NAV active
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 text-xs">
          {/* Fund Details */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Portfolio Fund Name
              </span>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {holding.name}
              </div>
            </div>

            {holding.amfiSchemeCode && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">AMFI Scheme Code:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {holding.amfiSchemeCode}
                </span>
              </div>
            )}

            {holding.amfiSchemeName && holding.amfiSchemeName !== holding.name && (
              <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold block">Official Directory Title:</span>
                <span className="text-slate-700 dark:text-slate-300">{holding.amfiSchemeName}</span>
              </div>
            )}

            {/* Scheme Characteristics */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex-wrap">
              <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px]">
                {planDetails.planType} Plan (0% Commission)
              </span>
              <span className="px-2 py-0.5 rounded-full font-bold bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 text-[10px]">
                {planDetails.optionType} Option
              </span>
            </div>
          </div>

          {/* Verification Status Banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">Verified by System & AMFI Directory</span>
              <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
                This fund is confirmed as a direct compounding scheme. Auto-updates fetch the official end-of-day NAV daily.
              </p>
            </div>
          </div>

          {/* Change Scheme Facility */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setShowChangeScheme(!showChangeScheme);
                if (!showChangeScheme && !changeSearchQ) {
                  setChangeSearchQ(holding.name);
                }
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2 text-xs">
                <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Change / Link Different AMFI Scheme</span>
              </span>
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                {showChangeScheme ? 'Hide' : 'Change Scheme'}
              </span>
            </button>

            {showChangeScheme && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={changeSearchQ}
                    onChange={(e) => setChangeSearchQ(e.target.value)}
                    placeholder="Search 15,000+ AMFI schemes by name or code..."
                    className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {isSearchingChange && (
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {changeSearchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {changeSearchResults.map((res) => (
                      <div
                        key={res.schemeCode}
                        onClick={() => handleSelectNewScheme(res)}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500 cursor-pointer transition-all flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate text-[11px]">
                            {res.schemeName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Code: {res.schemeCode}
                          </div>
                        </div>
                        {res.nav && res.nav > 0 && (
                          <div className="text-right shrink-0 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatINR(res.nav)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Popular Verified Direct Schemes */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Popular Verified Schemes Quick Pick
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {POPULAR_MF_SCHEMES.slice(0, 6).map((p) => (
                      <div
                        key={p.code}
                        onClick={() => handleSelectNewScheme({ schemeCode: p.code, schemeName: p.name, nav: p.nav })}
                        className="p-2 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 flex items-center justify-between gap-2 cursor-pointer transition-all text-[11px]"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">₹{p.nav.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Badge Color Selector (Blue Tick vs Green Tick) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-slate-400" />
                <span>Verified Badge Tick Color</span>
              </span>
              <span className="text-[10px] text-slate-400">Personal Preference</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleToggleColor('blue')}
                className={`p-2 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                  tickColor === 'blue'
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/40'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Blue Tick</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleColor('green')}
                className={`p-2 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                  tickColor === 'green'
                    ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/40'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Green Tick</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between gap-3">
          {onEditHolding && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditHolding(holding);
              }}
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Edit Asset Details
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 ml-auto transition-opacity cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 2. FUND CONFIRMATION REQUIRED MODAL (For Yellow Badge Funds)              */
/* ========================================================================= */

interface FundConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: InvestmentHolding | null;
  onEditHolding?: (holding: InvestmentHolding) => void;
}

export const FundConfirmationModal: React.FC<FundConfirmationModalProps> = ({
  isOpen,
  onClose,
  holding,
  onEditHolding,
}) => {
  const { updateHolding, showToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ schemeCode: string; schemeName: string; nav?: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (holding) {
      setSearchQuery(holding.name || '');
      setSearchResults([]);
      setShowSearch(false);
    }
  }, [holding, isOpen]);

  // Debounced search when search is opened
  useEffect(() => {
    if (!showSearch || !searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    let isMounted = true;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchAmfiSchemes(searchQuery);
        if (isMounted) setSearchResults(results);
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
  }, [searchQuery, showSearch]);

  if (!isOpen || !holding) return null;

  const info = getFundVerificationInfo(holding);
  const planDetails = parseSchemePlanDetails(holding.amfiSchemeName || holding.name);

  // One-click Confirm & Mark Verified
  const handleConfirmVerified = () => {
    updateHolding(holding.id, {
      isVerified: true,
      requiresConfirmation: false,
      confirmationReason: undefined,
    });
    showToast(`Confirmed "${holding.name}" as Verified!`, 'success');
    onClose();
  };

  // Switch to Direct Growth variant
  const handleSwitchToDirectGrowth = async () => {
    setIsSearching(true);
    const cleaned = holding.name
      .replace(/-\s*Regular\s*Plan/gi, '')
      .replace(/-\s*IDCW(\s*Option)?/gi, '')
      .replace(/-\s*Dividend(\s*Option)?/gi, '')
      .trim();

    const query = `${cleaned} Direct Growth`;
    const res = await searchAmfiSchemes(query);
    setIsSearching(false);

    if (res.length > 0) {
      const topMatch = res[0];
      let nav = topMatch.nav;
      if (!nav || nav <= 0) {
        const liveRecord = await fetchSchemeLatestNav(topMatch.schemeCode);
        if (liveRecord && liveRecord.nav > 0) nav = liveRecord.nav;
      }

      updateHolding(holding.id, {
        amfiSchemeCode: topMatch.schemeCode,
        amfiSchemeName: topMatch.schemeName,
        currentPrice: nav && nav > 0 ? nav : holding.currentPrice,
        isVerified: true,
        requiresConfirmation: false,
        confirmationReason: undefined,
      });

      showToast(`Switched and verified "${topMatch.schemeName}"!`, 'success');
      onClose();
    } else {
      setShowSearch(true);
      setSearchQuery(query);
    }
  };

  const handleSelectScheme = async (scheme: { schemeCode: string; schemeName: string; nav?: number }) => {
    let nav = scheme.nav;
    if (!nav || nav <= 0) {
      setIsSearching(true);
      const live = await fetchSchemeLatestNav(scheme.schemeCode);
      setIsSearching(false);
      if (live && live.nav > 0) nav = live.nav;
    }

    updateHolding(holding.id, {
      amfiSchemeCode: scheme.schemeCode,
      amfiSchemeName: scheme.schemeName,
      currentPrice: nav && nav > 0 ? nav : holding.currentPrice,
      isVerified: true,
      requiresConfirmation: false,
      confirmationReason: undefined,
    });

    showToast(`Linked AMFI scheme ${scheme.schemeCode} and verified!`, 'success');
    onClose();
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 isolate overscroll-contain">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-amber-50/50 dark:bg-amber-950/20 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                Confirmation Required From User
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 truncate">
                Please verify scheme variant & AMFI link details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* Target Holding Context Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Fund in Portfolio
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {holding.name}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
              <span>Recorded Price: <strong>{formatINR(holding.currentPrice)}</strong></span>
              <span>·</span>
              <span>Quantity: <strong>{holding.quantity} units</strong></span>
            </div>
          </div>

          {/* Attention / Doubt Details Callout */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-800 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Reason Confirmation Is Required:</span>
            </div>

            {info.warnings.length > 0 ? (
              <ul className="space-y-1.5 list-disc list-inside leading-relaxed text-[11px] text-amber-900 dark:text-amber-200">
                {info.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                {info.reason || 'Please verify fund plan and link to the official AMFI database.'}
              </p>
            )}
          </div>

          {/* Scheme Quick Switcher if Regular or IDCW */}
          {(planDetails.planType === 'Regular' || planDetails.optionType === 'IDCW') && (
            <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0">
                <span className="font-bold text-sky-950 dark:text-sky-200 block text-xs">
                  Switch to Direct Plan - Growth?
                </span>
                <span className="text-[11px] text-sky-700 dark:text-sky-300 block">
                  Eliminates distributor broker fees and unlocks daily auto NAV sync.
                </span>
              </div>
              <button
                type="button"
                onClick={handleSwitchToDirectGrowth}
                disabled={isSearching}
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shrink-0 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <span>Switch to Direct Growth</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Search & Link Scheme Collapsible Section */}
          <div>
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>Search & Link Another AMFI Scheme</span>
              </span>
              <span className="text-[11px] text-slate-400">{showSearch ? 'Hide Search' : 'Open Search'}</span>
            </button>

            {showSearch && (
              <div className="mt-2.5 space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 animate-in fade-in">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 15,000+ AMFI schemes by name or code..."
                    className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {isSearching && (
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {searchResults.map((res) => (
                      <div
                        key={res.schemeCode}
                        onClick={() => handleSelectScheme(res)}
                        className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500 cursor-pointer transition-all flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate text-[11px]">
                            {res.schemeName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Code: {res.schemeCode}
                          </div>
                        </div>
                        {res.nav && res.nav > 0 && (
                          <div className="text-right shrink-0 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatINR(res.nav)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Popular Verified Direct Schemes */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Popular Verified Schemes Quick Pick
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {POPULAR_MF_SCHEMES.slice(0, 6).map((p) => (
                      <div
                        key={p.code}
                        onClick={() => handleSelectScheme({ schemeCode: p.code, schemeName: p.name, nav: p.nav })}
                        className="p-2 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 flex items-center justify-between gap-2 cursor-pointer transition-all text-[11px]"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">₹{p.nav.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmVerified}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm & Mark Verified</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
