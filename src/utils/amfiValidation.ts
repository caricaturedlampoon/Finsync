/**
 * AMFI Mutual Fund Validation & Doubt Detection Engine
 *
 * Prevents wrong selection and accidental mislinking of mutual funds.
 * Identifies high-risk selection errors:
 * 1. Regular Plan vs Direct Plan confusion (distributor commission vs zero commission).
 * 2. IDCW (Dividend payout) vs Growth option confusion.
 * 3. Severe NAV divergence vs user's entered purchase price or existing holding price.
 * 4. Fund category / AMC name mismatch between holding and selected scheme.
 */

import { InvestmentHolding } from '../types';

export interface SchemePlanDetails {
  planType: 'Direct' | 'Regular';
  optionType: 'Growth' | 'IDCW';
  amcName?: string;
  categoryName?: string;
}

export interface SchemeDoubtAnalysis {
  hasDoubt: boolean;
  isRegularPlan: boolean;
  isIdcwOption: boolean;
  isNavDivergent: boolean;
  isNameMismatch: boolean;
  navDifferencePercent?: number;
  warnings: string[];
  suggestedAlternativeQuery?: string;
  holdingPrice?: number;
  schemeNav?: number;
}

const COMMON_AMCS = [
  'Parag Parikh',
  'PPFAS',
  'HDFC',
  'SBI',
  'ICICI Prudential',
  'Mirae Asset',
  'Nippon India',
  'Axis',
  'Kotak',
  'Quant',
  'UTI',
  'Tata',
  'DSP',
  'Motilal Oswal',
  'Aditya Birla Sun Life',
  'Bandhan',
  'Franklin Templeton',
  'Edelweiss',
  'Invesco',
  'Canara Robeco',
  'Sundaram',
  'PGIM India',
  'HSBC',
  'Mahindra Manulife',
];

const CATEGORY_KEYWORDS = [
  'Flexi Cap',
  'Small Cap',
  'Mid Cap',
  'Large Cap',
  'Large & Mid Cap',
  'Multi Cap',
  'ELSS',
  'Tax Saver',
  'Index',
  'Nifty 50',
  'Nifty Next 50',
  'Corporate Bond',
  'Liquid',
  'Overnight',
  'Money Market',
  'Short Term',
  'Balanced Advantage',
  'Hybrid',
  'Arbitrage',
  'Gold',
  'Silver',
];

/**
 * Parse scheme name to extract plan type, option type, AMC, and category
 */
export function parseSchemePlanDetails(schemeName: string): SchemePlanDetails {
  const lower = (schemeName || '').toLowerCase();

  // Plan Type: Direct vs Regular
  const isRegular = lower.includes('regular') || (!lower.includes('direct') && !lower.includes('dir'));
  const planType: 'Direct' | 'Regular' = isRegular ? 'Regular' : 'Direct';

  // Option Type: Growth vs IDCW / Dividend
  const isIdcw = lower.includes('idcw') || lower.includes('dividend') || lower.includes('div') || lower.includes('payout');
  const optionType: 'Growth' | 'IDCW' = isIdcw ? 'IDCW' : 'Growth';

  // AMC Name
  let amcName: string | undefined;
  for (const amc of COMMON_AMCS) {
    if (lower.includes(amc.toLowerCase())) {
      amcName = amc;
      break;
    }
  }

  // Category
  let categoryName: string | undefined;
  for (const cat of CATEGORY_KEYWORDS) {
    if (lower.includes(cat.toLowerCase())) {
      categoryName = cat;
      break;
    }
  }

  return {
    planType,
    optionType,
    amcName,
    categoryName,
  };
}

/**
 * Analyze candidate scheme against holding context to detect any doubts,
 * discrepancies, or high-risk mismatch patterns.
 */
export function analyzeSchemeDoubts(
  scheme: {
    schemeCode: string;
    schemeName: string;
    nav?: number;
    planType?: 'Direct' | 'Regular';
    optionType?: 'Growth' | 'IDCW';
  },
  context?: {
    holdingName?: string;
    holdingSymbol?: string;
    holdingPrice?: number;
    averageBuyPrice?: number;
  }
): SchemeDoubtAnalysis {
  const planDetails = parseSchemePlanDetails(scheme.schemeName);
  const planType = scheme.planType || planDetails.planType;
  const optionType = scheme.optionType || planDetails.optionType;

  const warnings: string[] = [];

  // 1. Check Regular Plan
  const isRegularPlan = planType === 'Regular';
  if (isRegularPlan) {
    warnings.push(
      'Regular Plan Warning: This is a Regular plan which includes intermediary distributor commissions and typically has a lower NAV than the Direct plan. Most self-directed investors (e.g. Zerodha Coin, Groww) hold Direct plans.'
    );
  }

  // 2. Check IDCW / Dividend Option
  const isIdcwOption = optionType === 'IDCW';
  if (isIdcwOption) {
    warnings.push(
      'IDCW (Dividend) Option Warning: This option distributes periodic income rather than reinvesting capital gains. Most long-term wealth accumulation portfolios use the Growth option.'
    );
  }

  // 3. Check Price / NAV Divergence
  let isNavDivergent = false;
  let navDifferencePercent: number | undefined;
  const referencePrice = context?.holdingPrice || context?.averageBuyPrice || 0;

  if (referencePrice > 0 && scheme.nav && scheme.nav > 0) {
    const diff = Math.abs(scheme.nav - referencePrice);
    const diffPct = (diff / referencePrice) * 100;
    navDifferencePercent = diffPct;

    // A difference > 35% strongly indicates a completely different fund or wrong option
    if (diffPct > 35) {
      isNavDivergent = true;
      warnings.push(
        `Major Price Divergence (${diffPct.toFixed(1)}%): Scheme NAV is ₹${scheme.nav.toFixed(2)}, whereas your holding's recorded price is ₹${referencePrice.toFixed(2)}. Please verify this is the exact fund you intended to link.`
      );
    }
  }

  // 4. Check Name / Category Mismatch
  let isNameMismatch = false;
  if (context?.holdingName && context.holdingName.trim().length > 3) {
    const holdingLower = context.holdingName.toLowerCase();
    const schemeLower = scheme.schemeName.toLowerCase();

    // Check AMC mismatch
    if (planDetails.amcName) {
      const amcLower = planDetails.amcName.toLowerCase();
      // If holding has another known AMC, flag it
      for (const otherAmc of COMMON_AMCS) {
        if (otherAmc.toLowerCase() !== amcLower && holdingLower.includes(otherAmc.toLowerCase())) {
          isNameMismatch = true;
          warnings.push(
            `Fund House Mismatch: Your holding name contains "${otherAmc}", but the selected scheme is managed by "${planDetails.amcName}".`
          );
          break;
        }
      }
    }

    // Check category mismatch (e.g., holding is Small Cap but scheme is Large Cap)
    if (planDetails.categoryName) {
      const catLower = planDetails.categoryName.toLowerCase();
      for (const otherCat of ['small cap', 'large cap', 'mid cap', 'flexi cap', 'elss', 'corporate bond']) {
        if (otherCat !== catLower && holdingLower.includes(otherCat) && !schemeLower.includes(otherCat)) {
          isNameMismatch = true;
          warnings.push(
            `Category Mismatch: Your holding mentions "${otherCat.toUpperCase()}", but the selected fund is categorized under "${planDetails.categoryName.toUpperCase()}".`
          );
          break;
        }
      }
    }
  }

  const hasDoubt = isRegularPlan || isIdcwOption || isNavDivergent || isNameMismatch;

  // Prepare suggested alternative query if user picked Regular or IDCW
  let suggestedAlternativeQuery: string | undefined;
  if (isRegularPlan || isIdcwOption) {
    let cleanName = scheme.schemeName
      .replace(/-\s*Regular\s*Plan/gi, '')
      .replace(/-\s*IDCW(\s*Option)?/gi, '')
      .replace(/-\s*Dividend(\s*Option)?/gi, '')
      .replace(/-\s*Growth(\s*Option)?/gi, '')
      .trim();

    suggestedAlternativeQuery = `${cleanName} Direct Growth`;
  }

  return {
    hasDoubt,
    isRegularPlan,
    isIdcwOption,
    isNavDivergent,
    isNameMismatch,
    navDifferencePercent,
    warnings,
    suggestedAlternativeQuery,
    holdingPrice: referencePrice > 0 ? referencePrice : undefined,
    schemeNav: scheme.nav,
  };
}

/**
 * Checks whether an investment holding is a fund (mutual fund or debt fund)
 * and should display the fund verification badge beside its name.
 * Stocks (equities) and Sovereign Gold Bonds (SGB) are not funds.
 */
export function isFundHolding(holding: InvestmentHolding | { assetType?: string; name?: string; amfiSchemeCode?: string; symbol?: string }): boolean {
  if (!holding) return false;
  if (holding.assetType === 'mutual_fund') return true;
  if (holding.amfiSchemeCode && /^\d+$/.test(holding.amfiSchemeCode.trim())) return true;
  if (holding.assetType === 'stock' || holding.assetType === 'sgb') return false;

  const nameLower = (holding.name || '').toLowerCase();
  const symLower = (holding.symbol || '').toLowerCase();

  if (symLower.includes('_mf') || symLower.includes('fund')) return true;

  return (
    nameLower.includes('fund') ||
    nameLower.includes('flexi cap') ||
    nameLower.includes('small cap') ||
    nameLower.includes('mid cap') ||
    nameLower.includes('large cap') ||
    nameLower.includes('elss') ||
    nameLower.includes('index') ||
    nameLower.includes('debt') ||
    nameLower.includes('liquid') ||
    nameLower.includes('overnight') ||
    nameLower.includes('hybrid') ||
    nameLower.includes('balanced advantage') ||
    nameLower.includes('arbitrage') ||
    nameLower.includes('corporate bond')
  );
}

export interface FundVerificationInfo {
  isFund: boolean;
  status: 'verified' | 'confirmation_required' | 'not_fund';
  reason?: string;
  schemeCode?: string;
  schemeName?: string;
  planType?: 'Direct' | 'Regular';
  optionType?: 'Growth' | 'IDCW';
  warnings: string[];
}

/**
 * Evaluates whether a fund holding is Verified (Green/Blue tick)
 * or requires User Confirmation (Yellow badge).
 */
export function getFundVerificationInfo(holding: InvestmentHolding): FundVerificationInfo {
  const isFund = isFundHolding(holding);
  if (!isFund) {
    return {
      isFund: false,
      status: 'not_fund',
      warnings: [],
    };
  }

  // 1. Explicit user flag: requires confirmation
  if (holding.requiresConfirmation === true) {
    const warnings = holding.confirmationReason ? [holding.confirmationReason] : ['Confirmation required by user.'];
    return {
      isFund: true,
      status: 'confirmation_required',
      reason: holding.confirmationReason || 'User confirmation required to verify fund scheme variant & official NAV source.',
      schemeCode: holding.amfiSchemeCode,
      schemeName: holding.amfiSchemeName || holding.name,
      warnings,
    };
  }

  // 2. Explicit user flag: verified
  if (holding.isVerified === true) {
    const planDetails = parseSchemePlanDetails(holding.amfiSchemeName || holding.name);
    return {
      isFund: true,
      status: 'verified',
      schemeCode: holding.amfiSchemeCode,
      schemeName: holding.amfiSchemeName || holding.name,
      planType: planDetails.planType,
      optionType: planDetails.optionType,
      warnings: [],
    };
  }

  // 3. Unlinked Fund: Missing AMFI scheme code
  if (!holding.amfiSchemeCode || !/^\d+$/.test(holding.amfiSchemeCode.trim())) {
    return {
      isFund: true,
      status: 'confirmation_required',
      reason: 'Unlinked Fund: Needs confirmation to link with official AMFI scheme code for auto-updated daily closing NAV.',
      warnings: ['No official AMFI Scheme Code linked.'],
    };
  }

  // 4. Automated doubt analysis on linked scheme
  const doubtAnalysis = analyzeSchemeDoubts(
    {
      schemeCode: holding.amfiSchemeCode,
      schemeName: holding.amfiSchemeName || holding.name,
      nav: holding.currentPrice,
    },
    {
      holdingName: holding.name,
      holdingPrice: holding.currentPrice,
      averageBuyPrice: holding.averageBuyPrice,
    }
  );

  const planDetails = parseSchemePlanDetails(holding.amfiSchemeName || holding.name);

  if (doubtAnalysis.hasDoubt) {
    return {
      isFund: true,
      status: 'confirmation_required',
      reason: doubtAnalysis.warnings[0] || 'Plan variant or price check required.',
      schemeCode: holding.amfiSchemeCode,
      schemeName: holding.amfiSchemeName || holding.name,
      planType: planDetails.planType,
      optionType: planDetails.optionType,
      warnings: doubtAnalysis.warnings,
    };
  }

  // All automated checks passed: Verified Direct Plan & Growth option!
  return {
    isFund: true,
    status: 'verified',
    schemeCode: holding.amfiSchemeCode,
    schemeName: holding.amfiSchemeName || holding.name,
    planType: planDetails.planType,
    optionType: planDetails.optionType,
    warnings: [],
  };
}

