import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Info,
  ShieldCheck,
  Building2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';
import {
  analyzeSchemeDoubts,
  parseSchemePlanDetails,
  SchemeDoubtAnalysis,
  SchemePlanDetails,
} from '../../utils/amfiValidation';

export interface AmfiCandidateScheme {
  schemeCode: string;
  schemeName: string;
  nav?: number;
  planType?: 'Direct' | 'Regular';
  optionType?: 'Growth' | 'IDCW';
}

interface AmfiFundConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scheme: AmfiCandidateScheme) => void;
  scheme: AmfiCandidateScheme | null;
  holdingContext?: {
    holdingName?: string;
    holdingSymbol?: string;
    holdingPrice?: number;
    averageBuyPrice?: number;
  };
  onSearchDirectGrowth?: (suggestedQuery: string) => void;
}

export const AmfiFundConfirmModal: React.FC<AmfiFundConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  scheme,
  holdingContext,
  onSearchDirectGrowth,
}) => {
  const [hasAcknowledgedDoubt, setHasAcknowledgedDoubt] = useState(false);

  // Analyze scheme for potential doubts
  const analysis: SchemeDoubtAnalysis = useMemo(() => {
    if (!scheme) {
      return {
        hasDoubt: false,
        isRegularPlan: false,
        isIdcwOption: false,
        isNavDivergent: false,
        isNameMismatch: false,
        warnings: [],
      };
    }
    return analyzeSchemeDoubts(scheme, holdingContext);
  }, [scheme, holdingContext]);

  const planDetails: SchemePlanDetails = useMemo(() => {
    if (!scheme) return { planType: 'Direct', optionType: 'Growth', amcName: undefined };
    return parseSchemePlanDetails(scheme.schemeName);
  }, [scheme]);

  if (!isOpen || !scheme) return null;

  const planType = scheme.planType || planDetails.planType;
  const optionType = scheme.optionType || planDetails.optionType;

  const isDoubtSevere = analysis.isRegularPlan || analysis.isIdcwOption || analysis.isNavDivergent;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 isolate overscroll-contain">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                analysis.hasDoubt
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {analysis.hasDoubt ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                {analysis.hasDoubt ? 'Confirm AMFI Fund Selection' : 'Verify AMFI Scheme Link'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {analysis.hasDoubt
                  ? 'Please review potential variant or price mismatches'
                  : 'Official AMFI mutual fund verification'}
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Target Holding Context (if linking to an existing portfolio position) */}
          {holdingContext?.holdingName && (
            <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                Linking To Portfolio Holding:
              </span>
              <div className="font-bold text-slate-900 dark:text-white truncate">
                {holdingContext.holdingName}
              </div>
              {holdingContext.holdingPrice && holdingContext.holdingPrice > 0 && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Current Recorded Price: <strong className="text-slate-700 dark:text-slate-300">{formatINR(holdingContext.holdingPrice)}</strong>
                </div>
              )}
            </div>
          )}

          {/* Selected AMFI Fund Details Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/60 to-slate-50 dark:from-emerald-950/20 dark:to-slate-850 border border-emerald-200/80 dark:border-emerald-900/40 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block mb-1">
                  Selected AMFI Scheme
                </span>
                <div className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                  {scheme.schemeName}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    AMFI Code: {scheme.schemeCode}
                  </span>
                  {planDetails.amcName && (
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      {planDetails.amcName}
                    </span>
                  )}
                </div>
              </div>

              {scheme.nav && scheme.nav > 0 && (
                <div className="text-right shrink-0 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Latest NAV
                  </span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums block">
                    {formatINR(scheme.nav)}
                  </span>
                </div>
              )}
            </div>

            {/* Scheme Variant Badges */}
            <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex-wrap">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                Plan Characteristics:
              </span>

              {/* Plan Type Badge */}
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  planType === 'Direct'
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                }`}
              >
                {planType === 'Direct' ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                )}
                {planType} Plan
              </span>

              {/* Option Type Badge */}
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  optionType === 'Growth'
                    ? 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
                    : 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                }`}
              >
                {optionType} Option
              </span>
            </div>
          </div>

          {/* Doubt / Warning Callouts */}
          {analysis.hasDoubt ? (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Important Checks Required</span>
                </div>

                <ul className="space-y-1.5 text-xs leading-relaxed list-disc list-inside">
                  {analysis.warnings.map((warn, i) => (
                    <li key={i} className="text-amber-900 dark:text-amber-200">
                      {warn}
                    </li>
                  ))}
                </ul>
              </div>

              {/* One-Tap Direct Growth Switcher Recommendation */}
              {(analysis.isRegularPlan || analysis.isIdcwOption) && onSearchDirectGrowth && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border border-sky-200 dark:border-sky-800 flex items-center justify-between gap-3">
                  <div className="min-w-0 text-xs">
                    <span className="font-bold text-sky-950 dark:text-sky-200 block">
                      Looking for Direct Plan - Growth?
                    </span>
                    <span className="text-[11px] text-sky-700 dark:text-sky-300">
                      Direct plans have zero distributor fees and higher compounding NAVs.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (analysis.suggestedAlternativeQuery) {
                        onSearchDirectGrowth(analysis.suggestedAlternativeQuery);
                        onClose();
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shrink-0 flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                  >
                    <span>Switch to Direct Growth</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Explicit User Acknowledgment Checkbox */}
              {isDoubtSevere && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={hasAcknowledgedDoubt}
                    onChange={(e) => setHasAcknowledgedDoubt(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    I have verified these details and confirm this is the exact fund variant I hold.
                  </span>
                </label>
              )}
            </div>
          ) : (
            /* All clear confirmation note */
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold block">All Checks Passed</span>
                <span className="text-[11px] opacity-90">
                  Verified as Direct Plan - Growth variant. Daily NAV updates will synchronize automatically.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel / Back to Search
          </button>

          <button
            type="button"
            disabled={isDoubtSevere && !hasAcknowledgedDoubt}
            onClick={() => {
              onConfirm(scheme);
              onClose();
            }}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
              isDoubtSevere && !hasAcknowledgedDoubt
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm & Link Scheme</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
