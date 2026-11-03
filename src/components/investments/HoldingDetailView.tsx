import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { InvestmentHolding, InvestmentTransaction } from '../../types';
import { formatINR, formatNumber, formatDate, parseDate, toInputDate, parseInvestmentTradeDate, calculateHoldingBookedProfit } from '../../utils/formatters';
import { computeHoldingFifo } from '../../utils/fifoCalculator';
import { calculateXIRR, CashFlow, calculateBondXIRR, calculateBondMetrics, BondSummaryMetrics, BondCashFlowScheduleItem } from '../../utils/xirr';
import { InvestmentActionModal } from './InvestmentActionModal';
import { HoldingModal } from './HoldingModal';
import { DayChangeInfoModal } from './DayChangeInfoModal';
import { AmfiFundConfirmModal, AmfiCandidateScheme } from './AmfiFundConfirmModal';
import { FundBadge, FundVerificationModal, FundConfirmationModal } from './FundVerificationBadges';
import { calculateHoldingDayPerformance } from '../../utils/investmentDayChange';
import { generateIndividualHoldingReportHTML } from '../../utils/assetReportEngine';
import { EditSubscriptionModal, AddPastSubscriptionsModal, AddManualInterestModal } from './PfBondSubscriptionModal';
import { useRegisterOverlay } from '../../navigation/NavigationContext';
import { BondDetailSection } from './specialized/BondDetailSection';
import { SgbDetailSection } from './specialized/SgbDetailSection';
import { PfDetailSection } from './specialized/PfDetailSection';
import {
  ArrowLeft,
  TrendingUp,
  ShoppingCart,
  Banknote,
  Coins,
  Scissors,
  Gift,
  Layers,
  Edit2,
  Trash2,
  RefreshCw,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  X,
  Building2,
  Info,
  Camera,
  Upload,
  ChevronRight,
  Sparkles,
  Search,
  CheckCircle2,
  Plus,
  FileText,
} from 'lucide-react';
import { searchAmfiSchemes, POPULAR_MF_SCHEMES, isMutualFundEligible } from '../../utils/amfiSipEngine';
import { compressImageThumbnail } from '../../services/imageCompression';
import { getHistoricalPrices } from '../../services/historicalPriceDb';
import { getAssetIdentification } from '../../services/marketPriceFetcher';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

const ASSET_COLORS: Record<string, string> = {
  stock: '#2563eb',
  mutual_fund: '#059669',
  bond: '#d97706',
  sgb: '#eab308',
  pf: '#0891b2',
};

interface HoldingDetailViewProps {
  holdingId: string;
  onBack: () => void;
  onOpenAction?: (action: 'buy' | 'sell' | 'dividend' | 'split' | 'bonus' | 'interest' | 'coupon' | 'principal_repayment') => void;
  onEditHolding?: (holding: InvestmentHolding) => void;
}

type TimelineButton = '1W' | '1M' | '6M' | '1Y' | 'ALL';

export const HoldingDetailView: React.FC<HoldingDetailViewProps> = ({
  holdingId,
  onBack,
  onOpenAction,
  onEditHolding,
}) => {
  const {
    holdings,
    deleteHolding,
    deleteHoldingTransaction,
    updateHoldingTransaction,
    updateHolding,
    accounts,
    syncMarketPrices,
    isUpdatingNavs,
    updateSingleHoldingNav,
    getHoldingMarketPrice,
    openTradeModal,
    openHtmlReportViewer,
  } = useApp();

  const holding = holdings.find((h) => h.id === holdingId);
  const [selectedTimeline, setSelectedTimeline] = useState<TimelineButton>('1M');
  const [dbHistoricalPrices, setDbHistoricalPrices] = useState<Array<{ date: string; price: number }>>([]);
  const [selectedLedgerTx, setSelectedLedgerTx] = useState<InvestmentTransaction | null>(null);
  const [confirmDeleteLedgerTx, setConfirmDeleteLedgerTx] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDayChangeModalOpen, setIsDayChangeModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [isEditSubOpen, setIsEditSubOpen] = useState(false);
  const [isPastSubsOpen, setIsPastSubsOpen] = useState(false);
  const [isManualInterestOpen, setIsManualInterestOpen] = useState(false);

  // Load historical daily prices from IndexedDB and scroll to top on open
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden';
    document.body.style.touchAction = 'auto';
    document.body.style.position = '';
    document.documentElement.style.overflow = 'auto';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    let isMounted = true;
    if (!holding) return;
    const ident = getAssetIdentification(holding);
    if (!ident) return;

    getHistoricalPrices(ident.assetKey).then((prices) => {
      if (isMounted && prices.length > 0) {
        setDbHistoricalPrices(prices);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [(holding ? holding.id : ''), (holding ? holding.symbol : ''), (holding ? holding.amfiSchemeCode : ''), (holding ? holding.lastPriceUpdate : 0)]);

  // AMFI Scheme Linking Modal State
  const [isLinkingSchemeModalOpen, setIsLinkingSchemeModalOpen] = useState(false);
  const [schemeSearchQ, setSchemeSearchQ] = useState('');
  const [schemeSearchResults, setSchemeSearchResults] = useState<
    Array<{ schemeCode: string; schemeName: string; nav?: number; planType?: 'Direct' | 'Regular'; optionType?: 'Growth' | 'IDCW' }>
  >([]);
  const [isSearchingSchemes, setIsSearchingSchemes] = useState(false);
  const [pendingSchemeForConfirm, setPendingSchemeForConfirm] = useState<AmfiCandidateScheme | null>(null);
  const [detailSchemeFilter, setDetailSchemeFilter] = useState<'all' | 'direct' | 'regular' | 'growth'>('direct');

  // Register Tier 1 modal overlays
  useRegisterOverlay(isDayChangeModalOpen, 'holding_day_change_modal', 'Day Change Details', () => setIsDayChangeModalOpen(false));
  useRegisterOverlay(isVerificationModalOpen, 'holding_verify_modal', 'Fund Verification', () => setIsVerificationModalOpen(false));
  useRegisterOverlay(isConfirmationModalOpen, 'holding_confirm_modal', 'Fund Confirmation', () => setIsConfirmationModalOpen(false));
  useRegisterOverlay(isLinkingSchemeModalOpen, 'holding_link_scheme_modal', 'Link AMFI Scheme', () => setIsLinkingSchemeModalOpen(false));
  useRegisterOverlay(!!pendingSchemeForConfirm, 'holding_pending_scheme', 'Confirm Scheme', () => setPendingSchemeForConfirm(null));
  useRegisterOverlay(isEditSubOpen, 'holding_edit_sub_modal', 'Edit Subscription', () => setIsEditSubOpen(false));
  useRegisterOverlay(isPastSubsOpen, 'holding_past_subs_modal', 'Past Subscriptions', () => setIsPastSubsOpen(false));
  useRegisterOverlay(isManualInterestOpen, 'holding_manual_interest_modal', 'Manual Interest', () => setIsManualInterestOpen(false));
  useRegisterOverlay(!!selectedLedgerTx, 'holding_ledger_tx_sheet', 'Ledger Trade Action', () => setSelectedLedgerTx(null));

  const filteredDetailSearchResults = useMemo(() => {
    if (detailSchemeFilter === 'all') return schemeSearchResults;
    return schemeSearchResults.filter((res) => {
      const isRegular = res.planType === 'Regular' || res.schemeName.toLowerCase().includes('regular');
      const isDirect = !isRegular || res.planType === 'Direct';
      const isIdcw = res.optionType === 'IDCW' || res.schemeName.toLowerCase().includes('idcw') || res.schemeName.toLowerCase().includes('dividend');
      const isGrowth = !isIdcw || res.optionType === 'Growth';

      if (detailSchemeFilter === 'direct') return isDirect;
      if (detailSchemeFilter === 'regular') return isRegular;
      if (detailSchemeFilter === 'growth') return isGrowth;
      return true;
    });
  }, [schemeSearchResults, detailSchemeFilter]);

  useEffect(() => {
    if (!isLinkingSchemeModalOpen) return;
    if (!schemeSearchQ.trim() || schemeSearchQ.trim().length < 2) {
      setSchemeSearchResults([]);
      return;
    }

    let isMounted = true;
    setIsSearchingSchemes(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchAmfiSchemes(schemeSearchQ);
        if (isMounted) setSchemeSearchResults(res);
      } catch {
        if (isMounted) setSchemeSearchResults([]);
      } finally {
        if (isMounted) setIsSearchingSchemes(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [schemeSearchQ, isLinkingSchemeModalOpen]);

  // Direct modal controls ensuring holding operations work seamlessly from individual stock or bond
  const [internalActionType, setInternalActionType] = useState<
    'buy' | 'sell' | 'dividend' | 'split' | 'bonus' | 'demerger' | 'interest' | 'coupon' | 'principal_repayment' | null
  >(null);
  const [internalEditModalOpen, setInternalEditModalOpen] = useState(false);

  // Edit Ledger Transaction State (preserving all earlier version details)
  const [editingTx, setEditingTx] = useState<InvestmentTransaction | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editRatio, setEditRatio] = useState('');
  const [editAccountingType, setEditAccountingType] = useState<string>('manual_ledger');
  const [editNotes, setEditNotes] = useState('');

  // Transaction Ledger Chronological Sorting state
  const [txSortBy, setTxSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'qty-desc' | 'qty-asc'>('date-desc');

  // Sorted Transactions List
  const sortedTransactions = useMemo(() => {
    const list = [...(holding?.transactions || [])];
    return list.sort((a, b) => {
      const timeA = parseDate(a.date).getTime() || 0;
      const timeB = parseDate(b.date).getTime() || 0;

      if (txSortBy === 'date-desc') {
        return timeB - timeA;
      }
      if (txSortBy === 'date-asc') {
        return timeA - timeB;
      }
      if (txSortBy === 'amount-desc') {
        const amtA = a.totalAmount || ((a.quantity || 0) * (a.price || 0));
        const amtB = b.totalAmount || ((b.quantity || 0) * (b.price || 0));
        return amtB - amtA;
      }
      if (txSortBy === 'amount-asc') {
        const amtA = a.totalAmount || ((a.quantity || 0) * (a.price || 0));
        const amtB = b.totalAmount || ((b.quantity || 0) * (b.price || 0));
        return amtA - amtB;
      }
      if (txSortBy === 'qty-desc') {
        return (b.quantity || 0) - (a.quantity || 0);
      }
      if (txSortBy === 'qty-asc') {
        return (a.quantity || 0) - (b.quantity || 0);
      }
      return 0;
    });
  }, [holding?.transactions, txSortBy]);

  const handleTriggerAction = (
    action: 'buy' | 'sell' | 'dividend' | 'split' | 'bonus' | 'demerger' | 'interest' | 'coupon' | 'principal_repayment'
  ) => {
    if (!holding) return;
    if ((action === 'buy' || action === 'sell') && holding.assetType === 'stock') {
      openTradeModal('stock', holding.id, action);
      return;
    }
    setInternalActionType(action);
  };

  const handleTriggerEdit = () => {
    setInternalEditModalOpen(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !holding) return;
    try {
      const compressed = await compressImageThumbnail(file, { maxWidth: 100, maxHeight: 100, quality: 0.85 });
      if (compressed) {
        updateHolding(holding.id, { customAvatar: compressed });
      }
    } catch (err) {
      console.warn('Failed to compress avatar thumbnail', err);
    }
  };

  const openEditTxModal = (tx: InvestmentTransaction) => {
    setEditingTx(tx);
    setEditDate(toInputDate(tx.date));
    setEditQty(tx.quantity.toString());
    setEditPrice(tx.price.toString());
    setEditAmount(tx.totalAmount.toString());
    setEditRatio(tx.splitRatio || tx.bonusRatio || '');
    setEditAccountingType(tx.accountingType || 'manual_ledger');
    setEditNotes(tx.notes || '');
  };

  const handleSaveEditTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !holding) return;

    const validDate = parseInvestmentTradeDate(editDate);
    const isDividendOrCoupon = editingTx.type === 'dividend' || editingTx.type === 'interest' || editingTx.type === 'coupon';
    const isCorp = editingTx.type === 'split' || editingTx.type === 'bonus';

    let q = parseFloat(editQty);
    let p = parseFloat(editPrice) || 0;
    let tot = 0;

    if (isDividendOrCoupon) {
      tot = parseFloat(editAmount) || 0;
      if (tot <= 0) return;
      q = editingTx.quantity || 1;
      p = 0;
    } else {
      if (isNaN(q) || q <= 0) return;
      tot = isCorp ? 0 : (parseFloat(editAmount) || Number((q * p).toFixed(2)));
    }

    const updated: InvestmentTransaction = {
      ...editingTx,
      date: validDate,
      quantity: q,
      price: p,
      totalAmount: tot,
      splitRatio: editingTx.type === 'split' ? editRatio || undefined : undefined,
      bonusRatio: editingTx.type === 'bonus' ? editRatio || undefined : undefined,
      accountingType: editAccountingType as any,
      notes: editNotes.trim() || undefined,
    };

    updateHoldingTransaction(holding.id, updated);
    setEditingTx(null);
  };

  const dematAccount = accounts.find((a) => a.id === holding?.dematAccountId);

  const livePriceInfo = useMemo(() => (holding ? getHoldingMarketPrice(holding) : null), [holding, getHoldingMarketPrice]);
  const liveCMP = livePriceInfo?.price ?? holding?.currentPrice ?? 0;

  // Computed Financial Metrics with Day Performance
  const holdingDayPerf = useMemo(() => {
    if (!holding) return null;
    return calculateHoldingDayPerformance(holding, livePriceInfo || undefined);
  }, [holding, livePriceInfo]);

  const isBond = holding?.assetType === 'bond' || holding?.assetType === 'sgb';
  const isPf = holding?.assetType === 'pf';
  const isStock = holding?.assetType === 'stock';

  const bondMetrics = useMemo(() => {
    if (!holding || !isBond) return null;
    return calculateBondMetrics(holding);
  }, [holding, isBond]);

  const [showBondSchedule, setShowBondSchedule] = useState(false);
  const [bondScheduleFilter, setBondScheduleFilter] = useState<'all' | 'coupons' | 'pending' | 'logged'>('all');

  const filteredBondSchedule = useMemo(() => {
    if (!bondMetrics) return [];
    return bondMetrics.schedule.filter((item) => {
      if (bondScheduleFilter === 'coupons') return item.type === 'COUPON_INTEREST';
      if (bondScheduleFilter === 'pending') return item.type === 'COUPON_INTEREST' && !item.isLogged;
      if (bondScheduleFilter === 'logged') return item.isLogged;
      return true;
    });
  }, [bondMetrics, bondScheduleFilter]);

  const { investedAmount, currentVal, pnl, pnlPercent, xirrValue, dayChangeVal, dayChangePct } = useMemo(() => {
    if (!holding) {
      return {
        investedAmount: 0,
        currentVal: 0,
        pnl: 0,
        pnlPercent: 0,
        xirrValue: 0,
        dayChangeVal: 0,
        dayChangePct: 0,
      };
    }
    const inv = holding.quantity * holding.averageBuyPrice;
    const cur = holding.quantity * liveCMP;
    const diff = cur - inv;
    const pct = inv > 0 ? (diff / inv) * 100 : 0;
    const dVal = holdingDayPerf?.dayChangeValue ?? 0;
    const dPct = holdingDayPerf?.dayChangePercent ?? 0;

    if (isBond) {
      return {
        investedAmount: inv,
        currentVal: cur,
        pnl: diff,
        pnlPercent: pct,
        xirrValue: calculateBondXIRR(holding),
        dayChangeVal: dVal,
        dayChangePct: dPct,
      };
    }

    const cashFlows: CashFlow[] = [];
    (holding.transactions || []).forEach((t) => {
      const d = parseDate(t.date);
      if (t.type === 'buy') cashFlows.push({ date: d, amount: -t.totalAmount });
      else if (
        t.type === 'sell' ||
        t.type === 'dividend' ||
        t.type === 'interest' ||
        t.type === 'coupon' ||
        t.type === 'principal_repayment'
      ) {
        // If interest was compounded into units/balance, it is already reflected in `cur` (final cash flow), so skip to avoid double counting
        if (t.type === 'interest' && t.accountingType === 'compound_balance') {
          // Do not treat as an external payout
        } else {
          cashFlows.push({ date: d, amount: t.totalAmount });
        }
      }
    });
    if (cur > 0) cashFlows.push({ date: new Date(), amount: cur });

    return {
      investedAmount: inv,
      currentVal: cur,
      pnl: diff,
      pnlPercent: pct,
      xirrValue: calculateXIRR(cashFlows),
      dayChangeVal: dVal,
      dayChangePct: dPct,
    };
  }, [holding, liveCMP, holdingDayPerf, isBond, isPf]);

  // Realized / Booked Profit metrics
  const bookedProfitInfo = useMemo(() => {
    if (!holding) {
      return { bookedProfit: 0, totalSoldAmount: 0, totalRealizedCost: 0, dividendIncome: 0, salesCount: 0 };
    }
    return calculateHoldingBookedProfit(holding);
  }, [holding]);

  // Map each individual sell transaction to its strict FIFO realized / booked gain
  const perTxProfitMap = useMemo(() => {
    if (!holding) return new Map<string, number>();
    const fifoResult = computeHoldingFifo(holding.transactions || [], holding.averageBuyPrice);
    return fifoResult.perTransactionProfits;
  }, [holding?.transactions, holding?.averageBuyPrice]);

  // Timeline zoom calculation for holding historical valuation
  const timelineData = useMemo(() => {
    if (!holding) return [];
    const now = new Date();
    let startTime: Date;
    let tickCount: number;
    let intervalMs: number;

    if (selectedTimeline === '1W') {
      startTime = new Date(now.getTime() - 7 * 86400 * 1000);
      tickCount = 7;
      intervalMs = 86400 * 1000;
    } else if (selectedTimeline === '1M') {
      startTime = new Date(now.getTime() - 30 * 86400 * 1000);
      tickCount = 10;
      intervalMs = 3 * 86400 * 1000;
    } else if (selectedTimeline === '6M') {
      startTime = new Date(now.getTime() - 182 * 86400 * 1000);
      tickCount = 12;
      intervalMs = 15 * 86400 * 1000;
    } else if (selectedTimeline === '1Y') {
      startTime = new Date(now.getTime() - 365 * 86400 * 1000);
      tickCount = 12;
      intervalMs = 30 * 86400 * 1000;
    } else {
      let earliestTime = now.getTime();
      (holding.transactions || []).forEach((t) => {
        const d = parseDate(t.date).getTime();
        if (d && d < earliestTime) earliestTime = d;
      });
      const minSpan = now.getTime() - 90 * 86400 * 1000;
      startTime = new Date(Math.min(earliestTime, minSpan));
      const totalMs = now.getTime() - startTime.getTime();
      tickCount = 12;
      intervalMs = Math.max(86400 * 1000, totalMs / tickCount);
    }

    const txs = [...(holding.transactions || [])].sort(
      (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
    );

    const computeAt = (timestamp: number) => {
      const pDate = parseDate(holding.purchaseDate || holding.openingDate || '2020-01-01').getTime();
      if (timestamp < pDate) {
        return { invested: 0, valuation: 0 };
      }

      const pastTxs = txs.filter((t) => parseDate(t.date).getTime() <= timestamp);
      let q = holding.assetType === 'pf' ? (holding.openingBalance || 0) : 0;
      let cost = holding.assetType === 'pf' ? (holding.openingBalance || 0) : 0;
      let interestRec = 0;
      let principalRepaid = 0;
      let lastPrice = holding.currentPrice;

      if (pastTxs.length === 0) {
        if (timestamp >= now.getTime()) {
          const finalVal = holding.assetType === 'pf' ? holding.quantity : holding.quantity * liveCMP;
          const finalCost = holding.assetType === 'pf' ? (holding.openingBalance || holding.quantity) : holding.quantity * holding.averageBuyPrice;
          return { invested: Math.round(finalCost), valuation: Math.round(finalVal) };
        }
        return { invested: Math.round(holding.openingBalance || 0), valuation: Math.round(holding.openingBalance || 0) };
      }

      pastTxs.forEach((t) => {
        if (holding.assetType === 'pf') {
          const isWithdrawal = t.type === 'sell' || t.type === 'withdrawal';
          const isInterest = t.type === 'interest' || t.type === 'coupon';
          const amt = t.totalAmount || t.quantity || (t.price * t.quantity) || 0;

          if (isWithdrawal) {
            q = Math.max(0, q - amt);
            cost = Math.max(0, cost - amt);
          } else if (isInterest) {
            interestRec += amt;
            q += amt;
          } else {
            const emp = t.employeeAmount || 0;
            const empyr = t.employerAmount || 0;
            const vol = t.voluntaryAmount || 0;
            const contr = (emp || empyr || vol) ? (emp + empyr + vol) : amt;
            q += contr;
            cost += contr;
          }
        } else {
          if (t.type === 'buy') {
            q += t.quantity;
            cost += t.totalAmount;
            if (t.price > 0) lastPrice = t.price;
          } else if (t.type === 'sell') {
            const avgBefore = q > 0 ? cost / q : 0;
            q = Math.max(0, q - t.quantity);
            cost = Math.max(0, q * avgBefore);
            if (t.price > 0) lastPrice = t.price;
          } else if (t.type === 'split') {
            if (t.newQuantity && t.newQuantity > 0) q = t.newQuantity;
            else q += t.quantity;
            if (t.price > 0) lastPrice = t.price;
          } else if (t.type === 'bonus') {
            q += t.quantity;
            if (t.price > 0) lastPrice = t.price;
          } else if (t.type === 'demerger') {
            if (t.demergerOutcome === 'extinguish_original') {
              q = 0;
              cost = 0;
            } else {
              const costAlloc = t.costAllocationPercentage !== undefined ? t.costAllocationPercentage : 20;
              cost = Math.max(0, cost * ((100 - costAlloc) / 100));
            }
          } else if (t.type === 'interest' || t.type === 'coupon') {
            const interestAmt = t.totalAmount || (t.price * t.quantity) || 0;
            interestRec += interestAmt;
          } else if (t.type === 'principal_repayment') {
            const prAmt = t.totalAmount || (t.price * t.quantity) || 0;
            principalRepaid += prAmt;
          } else if (t.type === 'withdrawal') {
            const avgBefore = q > 0 ? cost / q : 0;
            const wAmt = t.totalAmount || t.quantity;
            q = Math.max(0, q - wAmt);
            cost = Math.max(0, q * avgBefore);
          }
        }
      });

      if (holding.assetType === 'bond') {
        const bondInv = Math.max(0, (holding.quantity * holding.averageBuyPrice) - principalRepaid);
        const bondVal = bondInv + interestRec;
        return { invested: Math.round(bondInv), valuation: Math.round(bondVal) };
      }

      if (holding.assetType === 'sgb') {
        const sgbInv = holding.quantity * holding.averageBuyPrice;
        const sgbVal = (holding.quantity * liveCMP) + interestRec;
        return { invested: Math.round(sgbInv), valuation: Math.round(sgbVal) };
      }

      if (timestamp >= now.getTime()) {
        const finalVal = holding.assetType === 'pf' ? (cost + interestRec) : q * liveCMP;
        const finalCost = cost;
        return { invested: Math.round(finalCost), valuation: Math.round(finalVal) };
      }

      let livePrice = holding.assetType === 'pf' ? 1 : liveCMP;
      if (holding.assetType !== 'pf' && dbHistoricalPrices.length > 0) {
        const iso = new Date(timestamp).toISOString().split('T')[0];
        let matched = dbHistoricalPrices[0].price;
        for (const p of dbHistoricalPrices) {
          if (p.date <= iso) {
            matched = p.price;
          } else {
            break;
          }
        }
        livePrice = matched;
      } else if (holding.assetType !== 'pf') {
        const tFirst = pastTxs[0] ? parseDate(pastTxs[0].date).getTime() : timestamp;
        const progress = Math.min(1, Math.max(0, (timestamp - tFirst) / (now.getTime() - tFirst || 1)));
        livePrice = lastPrice + (liveCMP - lastPrice) * progress;
      }

      return { invested: Math.round(cost), valuation: Math.round(holding.assetType === 'pf' ? q : q * livePrice) };
    };

    const formatTick = (d: Date) => {
      if (selectedTimeline === '1W' || selectedTimeline === '1M') {
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      }
      if (selectedTimeline === '6M' || selectedTimeline === '1Y') {
        return d.toLocaleDateString('en-IN', { month: 'short' });
      }
      return d.getFullYear().toString();
    };

    const points: Array<{ date: string; value: number; current: number; rawTime: number }> = [];

    for (let i = 0; i <= tickCount; i++) {
      const t = new Date(startTime.getTime() + i * intervalMs);
      if (t.getTime() > now.getTime()) break;
      const st = computeAt(t.getTime());
      points.push({
        date: formatTick(t),
        value: st.invested,
        current: st.valuation,
        rawTime: t.getTime(),
      });
    }

    if (points.length === 0 || now.getTime() - points[points.length - 1].rawTime > 12 * 3600 * 1000) {
      points.push({
        date: 'Today',
        value: Math.round(investedAmount),
        current: Math.round(currentVal),
        rawTime: now.getTime(),
      });
    } else {
      points[points.length - 1].date = 'Today';
      points[points.length - 1].value = Math.round(investedAmount);
      points[points.length - 1].current = Math.round(currentVal);
    }

    return points;
  }, [holding, selectedTimeline, dbHistoricalPrices, liveCMP, investedAmount, currentVal]);

  const handleGenerateHoldingReport = () => {
    if (!holding) return;
    const html = generateIndividualHoldingReportHTML(holding);
    const safeName = holding.symbol.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const dateStr = toInputDate(new Date()).replace(/-/g, '');
    openHtmlReportViewer({
      htmlContent: html,
      title: `${holding.name} (${holding.symbol}) - Asset Audit Report`,
      fileName: `${safeName}-holding-report-${dateStr}.pdf`,
      badge: `${holding.symbol} Report`,
      subtitle: `${holding.name} · ${holding.assetType.toUpperCase().replace('_', ' ')} · Qty: ${holding.quantity}`,
      reportType: 'investment',
    });
  };

  const handleDeleteThisHolding = () => {
    if (holding) {
      deleteHolding(holding.id);
    }
    onBack();
  };

  if (!holding) {
    return (
      <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 animate-in fade-in">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
          <Layers className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Holding Extinguished or Removed</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            This asset was extinguished via corporate action (e.g. 2-way split-up demerger) or removed from the portfolio.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Investments</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 sm:pb-32 animate-in fade-in duration-150">
      {/* Top Navigation & Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs min-w-0 overflow-hidden">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 overflow-hidden">
          {/* Backward navigation: Only left arrow, no text "Investments" */}
          <button
            onClick={onBack}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
            title="Back to Investments"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Small Stock/Asset Avatar Block with Device Upload */}
          <div className="relative group/avatar shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs shadow-xs">
              {holding.customAvatar ? (
                <img src={holding.customAvatar} alt={holding.name} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white font-extrabold text-xs"
                  style={{ backgroundColor: ASSET_COLORS[holding.assetType] || '#2563eb' }}
                >
                  {holding.symbol.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <label
              className="absolute inset-0 bg-black/60 text-white rounded-2xl flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer shadow-xs"
              title="Upload custom logo from device"
            >
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </label>
          </div>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
              <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-slate-900 dark:text-white truncate" title={holding.customDisplayName || holding.name}>
                {holding.customDisplayName || holding.name}
              </h2>
              {/* Verified (Green/Blue tick) or Confirmation Required (Yellow) Badge in individual view */}
              <FundBadge
                holding={holding}
                onOpenVerificationModal={() => setIsVerificationModalOpen(true)}
                onOpenConfirmationModal={() => setIsConfirmationModalOpen(true)}
              />
              {holding.customDisplayName && (
                <span className="text-xs text-slate-400 font-medium truncate max-w-[120px]" title={holding.name}>
                  ({holding.name})
                </span>
              )}
              <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shrink-0">
                {holding.symbol}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 capitalize shrink-0">
                · {holding.assetType.replace('_', ' ')}
              </span>
            </div>
            {dematAccount && (
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                Linked Demat: <span className="font-semibold text-slate-600 dark:text-slate-300">{dematAccount.name}</span>
                {holding.isin ? ` · ISIN: ${holding.isin}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Top Right Edit & Delete Actions */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={handleGenerateHoldingReport}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            title="Generate & Export Audit Report for this Asset"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Report</span>
          </button>

          <button
            onClick={handleTriggerEdit}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-all cursor-pointer"
            title="Edit Asset Details"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1 animate-in fade-in">
              <span className="text-xs text-rose-600 font-semibold">Confirm delete?</span>
              <button
                onClick={handleDeleteThisHolding}
                className="px-2.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-500 cursor-pointer"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Delete Holding"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {holding.assetType === 'bond' ? (
        <BondDetailSection
          holding={holding}
          livePrice={liveCMP}
          onOpenActionModal={(act) => handleTriggerAction(act)}
          onEditHolding={handleTriggerEdit}
          onDeleteTransaction={(txId) => deleteHoldingTransaction(holding.id, txId)}
        />
      ) : holding.assetType === 'sgb' ? (
        <SgbDetailSection
          holding={holding}
          liveGoldPrice={liveCMP}
          onOpenActionModal={(act) => handleTriggerAction(act)}
          onEditHolding={handleTriggerEdit}
          onDeleteTransaction={(txId) => deleteHoldingTransaction(holding.id, txId)}
        />
      ) : holding.assetType === 'pf' ? (
        <PfDetailSection
          holding={holding}
          onOpenActionModal={(act) => handleTriggerAction(act)}
          onEditHolding={handleTriggerEdit}
          onDeleteTransaction={(txId) => deleteHoldingTransaction(holding.id, txId)}
          onOpenBulkSubscriptions={() => setIsPastSubsOpen(true)}
        />
      ) : (
        <>
          {/* Main Stats Spotlight Card */}
          <div className="p-4 sm:p-5 md:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 min-w-0">
          <div className="min-w-0 overflow-hidden">
            <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium truncate">
              {isPf ? 'Total Corpus Units' : 'Holding Units / Shares'}
            </span>
            <div
              className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate block"
              title={isPf ? formatINR(holding.quantity) : `${formatNumber(holding.quantity)} ${isStock ? 'shares' : 'units'}`}
            >
              {isPf ? formatINR(holding.quantity) : `${formatNumber(holding.quantity)} ${isStock ? 'sh' : 'un'}`}
            </div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate block">
              {isPf ? `Rate: ${holding.interestRate || 8.25}% p.a.` : `Avg: ${formatINR(holding.averageBuyPrice)}`}
            </span>
            {holding.purchaseDate && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block truncate mt-0.5" title={`Purchased on ${formatDate(holding.purchaseDate)}`}>
                Bought: {formatDate(holding.purchaseDate)}
              </span>
            )}
          </div>

          <div className="min-w-0 overflow-hidden">
            <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium truncate">
              {isPf ? 'Sovereign Interest Yield' : holding.assetType === 'mutual_fund' ? 'Latest Closing NAV' : 'Current Market Price'}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap min-w-0">
              <span
                className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900 dark:text-white tabular-nums truncate block"
                title={isPf ? `${holding.interestRate || 8.25}% p.a.` : formatINR(liveCMP)}
              >
                {isPf
                  ? `${holding.interestRate || 8.25}% p.a.`
                  : holding.assetType === 'mutual_fund' || holding.amfiSchemeCode
                  ? `₹${liveCMP.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                  : formatINR(liveCMP)}
              </span>
              {!isPf && (
                <button
                  onClick={() => syncMarketPrices(true, holding.id)}
                  disabled={isUpdatingNavs}
                  className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                  title="Fetch latest closing price or NAV online via Yahoo Finance & AMFI"
                >
                  <RefreshCw className={`w-3 h-3 text-emerald-600 dark:text-emerald-400 ${isUpdatingNavs ? 'animate-spin' : ''}`} />
                  <span>{isUpdatingNavs ? '...' : 'Sync'}</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5 min-w-0 truncate text-[10px] text-slate-500 dark:text-slate-400">
              {(() => {
                if (isPf) {
                  return (
                    <span className="text-cyan-600 dark:text-cyan-400 font-semibold truncate">
                      {holding.pfType || 'EPF'} Sovereign Scheme
                    </span>
                  );
                }
                const pInfo = livePriceInfo || getHoldingMarketPrice(holding);
                return (
                  <>
                    <span className="truncate">
                      as of {formatDate(pInfo.date)}
                    </span>
                    <span className="shrink-0 opacity-60">·</span>
                    <span className="shrink-0 font-medium uppercase text-[9px]">
                      {pInfo.isUpdating ? 'Updating...' : pInfo.isOffline ? 'Offline' : 'Live'}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="min-w-0 overflow-hidden">
            <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium truncate">Current Valuation</span>
            <div
              className={`text-base sm:text-lg md:text-xl font-extrabold tabular-nums mt-0.5 flex items-center gap-0.5 truncate block ${
                currentVal > investedAmount
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : currentVal < investedAmount
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}
              title={formatINR(currentVal)}
            >
              {currentVal > investedAmount && <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />}
              {currentVal < investedAmount && <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{formatINR(currentVal)}</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate block">
              Cost: {formatINR(investedAmount)}
            </span>
          </div>

          <div className="min-w-0 overflow-hidden">
            <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium truncate">Unrealized P&L</span>
            <div
              className={`text-base sm:text-lg md:text-xl font-extrabold tabular-nums mt-0.5 truncate block ${
                pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
              title={`${pnl >= 0 ? '+' : ''}${formatINR(pnl)} (${pnlPercent.toFixed(2)}%)`}
            >
              {pnl >= 0 ? '+' : ''}
              {formatINR(pnl)} ({pnlPercent.toFixed(1)}%)
            </div>
            <span className="text-[10px] text-slate-400 block truncate">
              XIRR: {xirrValue !== null ? `${xirrValue >= 0 ? '+' : ''}${xirrValue.toFixed(1)}%` : 'N/A'}
            </span>
          </div>
        </div>

        {/* 1-Day Change Spotlight beside Booked Profit (Clickable -> Opens Breakdown) */}
        <button
          type="button"
          onClick={() => setIsDayChangeModalOpen(true)}
          className="w-full text-left p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2.5 min-w-0 overflow-hidden cursor-pointer group transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          title="Click to view 1-Day Change breakdown, previous session close value, and date"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 ${dayChangeVal >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
              {dayChangeVal >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors flex items-center gap-1">
                  1-Day Change
                  <Info className="w-3 h-3 text-slate-400 group-hover:text-primary-500 transition-colors" />
                </span>
                <span className="text-[10px] text-slate-400 truncate">
                  (Prev close: {formatINR(holdingDayPerf?.previousClosePrice ?? 0)})
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-slate-400 truncate block">
                Single day movement vs previous session · <span className="text-primary-600 dark:text-primary-400 font-semibold">Tap for details</span>
              </span>
            </div>
          </div>

          <div className="text-right shrink-0 ml-2">
            <span
              className={`text-xs sm:text-sm md:text-base font-extrabold tabular-nums whitespace-nowrap block ${dayChangeVal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
              title={`${dayChangeVal >= 0 ? '+' : ''}${formatINR(dayChangeVal)}`}
            >
              {dayChangeVal >= 0 ? '+' : ''}{formatINR(dayChangeVal)}
            </span>
            <span className={`text-[10px] sm:text-[11px] font-semibold tabular-nums whitespace-nowrap block ${dayChangeVal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {dayChangeVal >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%
            </span>
          </div>
        </button>

        {/* Realized / Booked Profit Spotlight */}
        {(bookedProfitInfo.salesCount > 0 || bookedProfitInfo.bookedProfit !== 0 || bookedProfitInfo.dividendIncome > 0) && (
          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2.5 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 ${bookedProfitInfo.bookedProfit >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                <Coins className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                  Booked Profit (Realized Gains)
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-400 truncate block">
                  {bookedProfitInfo.salesCount} sale{bookedProfitInfo.salesCount !== 1 ? 's' : ''} (Sold: {formatINR(bookedProfitInfo.totalSoldAmount)})
                </span>
              </div>
            </div>

            <div className="text-right shrink-0 ml-2">
              <span
                className={`text-xs sm:text-sm md:text-base font-extrabold tabular-nums whitespace-nowrap block ${bookedProfitInfo.bookedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                title={`${bookedProfitInfo.bookedProfit >= 0 ? '+' : ''}${formatINR(bookedProfitInfo.bookedProfit)}`}
              >
                {bookedProfitInfo.bookedProfit >= 0 ? '+' : ''}{formatINR(bookedProfitInfo.bookedProfit)}
              </span>
              {bookedProfitInfo.dividendIncome > 0 && (
                <span className="text-[10px] text-slate-400 block tabular-nums whitespace-nowrap">
                  + {formatINR(bookedProfitInfo.dividendIncome)} div
                </span>
              )}
            </div>
          </div>
        )}

        {/* Operations Bar: Tailored precisely to asset type without redundant trade/corporate action controls */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          {holding.assetType === 'mutual_fund' ? (
            /* 3. Mutual Fund Operations: Invest Units, Redeem Units, Record Dividend (No Trade / Corp Actions) */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleTriggerAction('buy')}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                title="Add lump sum or SIP investment purchase units at closing NAV"
              >
                <Plus className="w-4 h-4" />
                <span>Invest / Add Units</span>
              </button>
              <button
                type="button"
                onClick={() => handleTriggerAction('sell')}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
                title="Redeem mutual fund units at latest NAV"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Redeem Units</span>
              </button>
              <button
                type="button"
                onClick={() => handleTriggerAction('dividend')}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-amber-600/20 active:scale-95 transition-all cursor-pointer"
                title="Record IDCW (Dividend) payout credited to bank account"
              >
                <Coins className="w-4 h-4" />
                <span>Record Dividend</span>
              </button>
            </div>
          ) : (
            /* 4. Stocks: Real-Time Trade Execution and Stock Corporate Actions (Bonus, Split, Demerger, Dividend) */
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => openTradeModal('stock', holding.id)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                title="Trade shares with real-time statutory taxes, break-even price & bank passbook debit/credit"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Trade (Buy / Sell)</span>
              </button>
              <button
                type="button"
                onClick={() => handleTriggerAction('dividend')}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
                title="Corporate Actions: Dividends, Bonus Issue, Stock Split & Demerger Spinoff"
              >
                <Layers className="w-4 h-4" />
                <span>Corporate Actions</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Provident Fund (PF) Management & Interest Crediting Card */}
      {isPf && (
        <div className="p-4 sm:p-5 md:p-6 rounded-3xl bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/60 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-200 dark:border-cyan-800/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm sm:text-base font-bold text-cyan-950 dark:text-cyan-200">
                  {holding.pfType || 'EPF'} Provident Fund Management
                </h3>
                {holding.uanOrAccountNumber && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300">
                    UAN / A/C: {holding.uanOrAccountNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-cyan-900/80 dark:text-cyan-300/80">
                Sovereign interest credited periodically ({holding.interestRate || 8.25}% p.a.). Manage monthly wage deductions, employer matching, and historical deposits.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                holding.subscription?.status === 'paused'
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
              }`}>
                {holding.subscription ? (holding.subscription.status === 'paused' ? 'Paused' : 'Active Subscription') : 'No Auto-Sub'}
              </span>
              {holding.subscription && (
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {formatINR(holding.subscription.amount + (holding.subscription.employerAmount || 0))}/mo
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-cyan-200/60 dark:border-cyan-800/40">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Total Fund Corpus
              </span>
              <span className="text-sm sm:text-base font-extrabold text-cyan-700 dark:text-cyan-300 tabular-nums block mt-0.5">
                {formatINR(currentVal)}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                Govt backed sovereign
              </span>
            </div>

            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-cyan-200/60 dark:border-cyan-800/40">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Member Deposits
              </span>
              <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tabular-nums block mt-0.5">
                {formatINR(investedAmount)}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                Net capital invested
              </span>
            </div>

            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-cyan-200/60 dark:border-cyan-800/40">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Interest Compounded
              </span>
              <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums block mt-0.5">
                +{formatINR(Math.max(0, currentVal - investedAmount))}
              </span>
              <span className="text-[10px] text-emerald-500 block truncate">
                {investedAmount > 0 ? `+${(((currentVal - investedAmount) / investedAmount) * 100).toFixed(2)}% gain` : 'Tax-free'}
              </span>
            </div>

            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-cyan-200/60 dark:border-cyan-800/40">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Sovereign Rate
              </span>
              <span className="text-sm sm:text-base font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums block mt-0.5">
                {holding.interestRate || 8.25}% p.a.
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                Compounded annually
              </span>
            </div>
          </div>

          {/* PF Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditSubOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{holding.subscription ? 'Edit Monthly Subscription' : 'Set Up Monthly Subscription'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPastSubsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>+ Add Multiple Old Subscriptions</span>
            </button>
            <button
              type="button"
              onClick={() => setIsManualInterestOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+ Add Manual Interest</span>
            </button>
          </div>
        </div>
      )}

      {/* Bond & Fixed Income Cash Flow Formulation Card */}
      {isBond && bondMetrics && (
        <div className="p-5 sm:p-6 rounded-3xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200 dark:border-amber-800/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-200">
                  Bond Cash Flow Formulation & Accurate XIRR Mapping
                </h3>
              </div>
              <p className="text-xs text-amber-900/80 dark:text-amber-300/80">
                Models initial purchase outflows, periodic coupon interest inflows ({holding.couponFrequency || 'annual'}), and principal back repayments.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {holding.couponRate && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-bold">
                  {holding.couponRate}% p.a.
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-bold capitalize">
                {holding.couponFrequency || 'Annually'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-semibold">
                Par: ₹{holding.faceValue || 1000}
              </span>
            </div>
          </div>

          {/* 4 Bond Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-amber-200/60 dark:border-amber-800/40">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Interest Received
              </span>
              <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums block mt-0.5">
                {formatINR(bondMetrics.totalInterestReceived)}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                {bondMetrics.schedule.filter((s) => s.type === 'COUPON_INTEREST' && s.isRealized).length} periodic payouts
              </span>
            </div>

            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-amber-200/60 dark:border-amber-800/40">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Next Payout
              </span>
              <span className="text-sm sm:text-base font-extrabold text-amber-700 dark:text-amber-300 tabular-nums block mt-0.5">
                {bondMetrics.nextCouponAmount > 0 ? formatINR(bondMetrics.nextCouponAmount) : 'Matured'}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                {bondMetrics.nextCouponDate ? formatDate(bondMetrics.nextCouponDate) : 'No pending coupons'}
              </span>
            </div>

            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-amber-200/60 dark:border-amber-800/40">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Principal Status
              </span>
              <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tabular-nums block mt-0.5">
                {formatINR(bondMetrics.pendingPrincipal)}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                {bondMetrics.totalPrincipalRepaid > 0 ? `${formatINR(bondMetrics.totalPrincipalRepaid)} repaid` : 'Repayment at maturity'}
              </span>
            </div>

            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-amber-200/60 dark:border-amber-800/40">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Realized XIRR / YTM
              </span>
              <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums block mt-0.5">
                {bondMetrics.realizedXIRR !== null ? `${bondMetrics.realizedXIRR >= 0 ? '+' : ''}${bondMetrics.realizedXIRR.toFixed(2)}%` : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                Life YTM: {bondMetrics.projectedYTM !== null ? `${bondMetrics.projectedYTM.toFixed(2)}%` : 'N/A'}
              </span>
            </div>
          </div>

          {/* Bond Monthly Subscription & Manual Coupon Controls */}
          <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
            <button
              type="button"
              onClick={() => setIsEditSubOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{holding.subscription ? `Edit Bond Subscription (${formatINR(holding.subscription.amount)}/mo)` : 'Set Up Monthly Subscription'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPastSubsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>+ Add Multiple Old Subscriptions</span>
            </button>
            <button
              type="button"
              onClick={() => setIsManualInterestOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+ Add Manual Coupon / Interest</span>
            </button>
          </div>

          {/* Passbook-Inspired Bond Cash Flow Schedule */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowBondSchedule(!showBondSchedule)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/95 dark:bg-slate-900/95 rounded-2xl border border-amber-300 dark:border-amber-800 text-xs font-bold text-amber-950 dark:text-amber-200 hover:bg-amber-100/50 cursor-pointer transition-all shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Banknote className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">Bond Passbook & Settlement Schedule ({bondMetrics.schedule.length} Events)</span>
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-300 font-semibold">
                  Passbook Format
                </span>
              </div>
              <span className="shrink-0 text-amber-700 dark:text-amber-400 font-semibold">
                {showBondSchedule ? 'Hide Passbook ▲' : 'Open Passbook ▼'}
              </span>
            </button>

            {showBondSchedule && (
              <div className="mt-3 bg-white dark:bg-slate-900 rounded-2xl border border-amber-300/80 dark:border-amber-800/80 overflow-hidden shadow-xs">
                {/* Passbook Controls & Filter Chips */}
                <div className="p-3 sm:p-3.5 bg-amber-50/70 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: 'all', label: 'All Events', count: bondMetrics.schedule.length },
                      { id: 'coupons', label: 'Coupons Only', count: bondMetrics.schedule.filter((s) => s.type === 'COUPON_INTEREST').length },
                      { id: 'pending', label: 'Pending Payouts', count: bondMetrics.schedule.filter((s) => s.type === 'COUPON_INTEREST' && !s.isLogged).length },
                      { id: 'logged', label: 'Logged in Bank', count: bondMetrics.schedule.filter((s) => s.isLogged).length },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setBondScheduleFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          bondScheduleFilter === tab.id
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'bg-white/80 dark:bg-slate-800/80 text-amber-950 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>

                  <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80 font-medium">
                    Showing {filteredBondSchedule.length} entries
                  </span>
                </div>

                {/* Passbook Table Headers */}
                <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <span className="col-span-2">Payout Date</span>
                  <span className="col-span-5">Particulars / Event Details</span>
                  <span className="col-span-3 text-right">Cash Flow (+ / -)</span>
                  <span className="col-span-2 text-right">Passbook Status</span>
                </div>

                {/* Passbook Rows */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredBondSchedule.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      No cash flow events match the selected filter.
                    </div>
                  ) : (
                    filteredBondSchedule.map((item) => {
                      const isOutflow = item.amount < 0;
                      return (
                        <div
                          key={item.id}
                          className="p-3.5 sm:px-4 sm:py-3 hover:bg-amber-50/40 dark:hover:bg-slate-800/50 transition-colors space-y-1.5 sm:space-y-0"
                        >
                          <div className="sm:grid sm:grid-cols-12 sm:gap-3 sm:items-center">
                            {/* Date Column */}
                            <div className="sm:col-span-2 flex items-center justify-between sm:block">
                              <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {formatDate(item.date)}
                              </span>
                              <span
                                className={`sm:hidden px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.type === 'PURCHASE'
                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                    : item.type === 'COUPON_INTEREST'
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                    : 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300'
                                }`}
                              >
                                {item.type.replace('_', ' ')}
                              </span>
                            </div>

                            {/* Particulars & Description Column */}
                            <div className="sm:col-span-5 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.type === 'PURCHASE'
                                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                      : item.type === 'COUPON_INTEREST'
                                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                      : 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300'
                                  }`}
                                >
                                  {item.type.replace('_', ' ')}
                                </span>
                                <span className="font-semibold text-slate-900 dark:text-white truncate">
                                  {item.description}
                                </span>
                              </div>
                            </div>

                            {/* Cash Flow Amount (+/-) */}
                            <div className="sm:col-span-3 flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                              <span className="sm:hidden text-[11px] text-slate-400">Cash Flow:</span>
                              <span
                                className={`font-bold tabular-nums text-xs sm:text-sm ${
                                  isOutflow ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {isOutflow ? '-' : '+'}{formatINR(Math.abs(item.amount))}
                              </span>
                            </div>

                            {/* Passbook Status & Action */}
                            <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-1.5">
                              {item.isLogged ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                  <Check className="w-3 h-3" /> Logged
                                </span>
                              ) : item.isRealized ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                                    Due
                                  </span>
                                  {item.type === 'COUPON_INTEREST' && (
                                    <button
                                      type="button"
                                      onClick={() => handleTriggerAction('interest')}
                                      className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                                      title="Credit this coupon into your bank passbook"
                                    >
                                      + Log
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                  Projected
                                </span>
                              )}
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
        </div>
      )}

      {/* Asset Valuation Over Time Line Graph with Interactive Timeline Zoom */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Asset Valuation Over Time</span>
            </h3>
            <span className="text-xs text-slate-400">
              Interactive historical trajectory based on chronological trades and price evolution
            </span>
          </div>

          {/* Timeline Buttons: 1W, 1M, 6M, 1Y, ALL */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {(['1W', '1M', '6M', '1Y', 'ALL'] as TimelineButton[]).map((btn) => (
              <button
                key={btn}
                onClick={() => setSelectedTimeline(btn)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedTimeline === btn
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {btn === '1W'
                  ? 'Week'
                  : btn === '1M'
                  ? 'Month'
                  : btn === '6M'
                  ? '6 Months'
                  : btn === '1Y'
                  ? 'Year'
                  : 'All Time'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                tickFormatter={(val) => `₹${val}`}
              />
              <Tooltip
                cursor={false}
                formatter={(val: any, name: any) => [
                  formatINR(Number(val)),
                  name === 'current' ? 'Holding Valuation' : 'Cost Basis Invested',
                ]}
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '11px',
                }}
              />
              <Line
                type="monotone"
                dataKey="current"
                name="current"
                stroke="#059669"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="value"
                stroke="#94a3b8"
                strokeDasharray="4 4"
                strokeWidth={1.8}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Complete Dedicated Transaction Ledger */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Chronological Transaction Ledger</span>
            </h3>
            <span className="text-xs text-slate-400">
              Total {holding.transactions?.length || 0} entries recorded
            </span>
          </div>

          {/* Interactive Sorting Controls */}
          {holding.transactions && holding.transactions.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-semibold mr-1 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span>Sort:</span>
              </span>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setTxSortBy('date-desc')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    txSortBy === 'date-desc'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Newest first (Latest date at top)"
                >
                  <ArrowDown className="w-3 h-3" />
                  <span>Newest</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTxSortBy('date-asc')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    txSortBy === 'date-asc'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Oldest first (Earliest trade at top)"
                >
                  <ArrowUp className="w-3 h-3" />
                  <span>Oldest</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTxSortBy(txSortBy === 'amount-desc' ? 'amount-asc' : 'amount-desc')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    txSortBy === 'amount-desc' || txSortBy === 'amount-asc'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Sort by Total Amount"
                >
                  <span>Amount {txSortBy === 'amount-desc' ? '↓' : txSortBy === 'amount-asc' ? '↑' : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTxSortBy(txSortBy === 'qty-desc' ? 'qty-asc' : 'qty-desc')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    txSortBy === 'qty-desc' || txSortBy === 'qty-asc'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Sort by Share Quantity"
                >
                  <span>Qty {txSortBy === 'qty-desc' ? '↓' : txSortBy === 'qty-asc' ? '↑' : ''}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {(!holding.transactions || holding.transactions.length === 0) ? (
          <div className="py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-semibold">No transactions recorded yet in this holding's ledger.</p>
            <p className="text-[11px] mt-0.5">
              {holding.assetType === 'mutual_fund'
                ? 'Use the operation buttons above to log investments (buy), redemptions (sell), or dividend payouts.'
                : 'Use the operation buttons above to log Buy, Sell, Split, Bonus, or Dividend executions.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedTransactions.map((t) => {
              const isBuy = t.type === 'buy';
              const isSell = t.type === 'sell';
              const isDiv = t.type === 'dividend';
              const isSplit = t.type === 'split';
              const isBonus = t.type === 'bonus';
              const isDemerger = t.type === 'demerger';

              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedLedgerTx(t);
                    setConfirmDeleteLedgerTx(false);
                  }}
                  className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                  title="Tap to view, edit or delete entry"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isBuy
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : isSell
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : isDiv
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : isSplit
                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : isBonus
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                      }`}
                    >
                      {isBuy && <ArrowDownLeft className="w-4 h-4" />}
                      {isSell && <ArrowUpRight className="w-4 h-4" />}
                      {isDiv && <Coins className="w-4 h-4" />}
                      {isSplit && <Scissors className="w-4 h-4" />}
                      {isBonus && <Gift className="w-4 h-4" />}
                      {isDemerger && <Layers className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white capitalize text-xs sm:text-sm truncate">
                          {isSplit
                            ? `Stock Split ${t.splitRatio ? `(${t.splitRatio})` : ''}`
                            : isBonus
                            ? `Bonus Issue ${t.bonusRatio ? `(${t.bonusRatio})` : ''}`
                            : isDemerger
                            ? `Demerger Spinoff ${t.demergerRatio ? `(${t.demergerRatio})` : ''}`
                            : isDiv
                            ? 'Dividend Payout'
                            : `${t.type} ${t.quantity} ${isStock ? 'shares' : 'units'}`}
                        </span>
                        {!isDiv && !isSplit && !isBonus && !isDemerger && (
                          <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono shrink-0">
                            @ ₹{t.price}
                          </span>
                        )}
                        {(isSplit || isBonus) && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                            {isSplit
                              ? t.newQuantity
                                ? `${t.oldQuantity || 'Old'} → ${t.newQuantity} sh`
                                : `+${t.quantity} sh`
                              : `+${t.quantity} free sh`}
                          </span>
                        )}
                        {isDemerger && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 shrink-0">
                            {t.demergedEntities && t.demergedEntities.length > 0
                              ? `→ ${t.demergedEntities.map((e) => `${e.symbol} (+${e.sharesAllotted} sh)`).join(', ')} (${t.costAllocationPercentage || t.demergedEntities.reduce((sum, e) => sum + e.costAllocationPercentage, 0)}% cost)`
                              : t.demergedSymbol
                              ? `→ ${t.demergedSymbol} (+${t.quantity} sh) (${t.costAllocationPercentage || 20}% cost)`
                              : `+${t.quantity} sh`}
                          </span>
                        )}
                        {isSell && perTxProfitMap.has(t.id) && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums shrink-0 ${
                              (perTxProfitMap.get(t.id) || 0) >= 0
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            Booked: {(perTxProfitMap.get(t.id) || 0) >= 0 ? '+' : ''}
                            {formatINR(perTxProfitMap.get(t.id))}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 truncate">
                        <span className="shrink-0">{formatDate(t.date)}</span>
                        {t.notes && (
                          <>
                            <span className="shrink-0 opacity-60">·</span>
                            <span className="truncate max-w-[180px] sm:max-w-xs italic">{t.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
                    <div className="text-right">
                      {isSplit || isBonus || isDemerger ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                            ₹0.00
                          </span>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {isSplit ? 'Sub-division' : isBonus ? 'Free Issue' : 'Cost Apportioned'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-bold tabular-nums text-xs sm:text-sm whitespace-nowrap ${
                              isBuy
                                ? 'text-slate-900 dark:text-white'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isBuy ? '-' : '+'}{formatINR(t.totalAmount)}
                          </span>
                          {isSell && (
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              Sale Proceeds
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}

      {/* Edit Transaction Modal - Fullscreen */}
      {editingTx && createPortal(
        <div className="fixed inset-0 z-[250] bg-white dark:bg-slate-900 flex flex-col h-full w-full overflow-hidden isolate animate-in slide-in-from-bottom duration-200 overscroll-contain">
          <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
                    Edit {editingTx.type} Entry
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTx} className="p-4 sm:p-8 space-y-5 overflow-y-auto flex-1 max-w-2xl mx-auto w-full pb-24 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Execution Date
                </label>
                <input
                  type="date"
                  required
                  max={toInputDate(new Date())}
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* DIVIDEND / INTEREST / COUPON: Only ask for payout amount */}
              {editingTx.type === 'dividend' || editingTx.type === 'interest' || editingTx.type === 'coupon' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Payout Amount Received (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold tabular-nums outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {editingTx.type === 'split' ? 'New Quantity (Shares)' : 'Units / Quantity'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      min="0.0001"
                      value={editQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditQty(val);
                        if (editingTx.type === 'buy' || editingTx.type === 'sell') {
                          const p = parseFloat(editPrice) || 0;
                          const q = parseFloat(val) || 0;
                          setEditAmount((q * p).toFixed(2));
                        }
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold tabular-nums outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {editingTx.type !== 'split' && editingTx.type !== 'bonus' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Price per Unit (₹)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={editPrice}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditPrice(val);
                            const q = parseFloat(editQty) || 0;
                            const p = parseFloat(val) || 0;
                            setEditAmount((q * p).toFixed(2));
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold tabular-nums outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Total Amount (₹)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold tabular-nums outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {(editingTx.type === 'split' || editingTx.type === 'bonus') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Ratio (e.g. 1:2 or 1:1)
                      </label>
                      <input
                        type="text"
                        value={editRatio}
                        onChange={(e) => setEditRatio(e.target.value)}
                        placeholder="1:2"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* Earlier Version Details: Transfer / Accounting Info & Notes */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Transfer / Account Type
                      </label>
                      <select
                        value={editAccountingType}
                        onChange={(e) => setEditAccountingType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold outline-hidden focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="demat_transfer">Demat / Stock Transfer</option>
                        <option value="cash_account">Cash / Bank Account</option>
                        <option value="corporate_action">Corporate Action</option>
                        <option value="manual_ledger">Manual Ledger Only</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Linked Reference
                      </label>
                      <div className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-500 text-xs font-mono truncate">
                        {editingTx.linkedTransactionId ? `ID: ${editingTx.linkedTransactionId.substring(0, 10)}...` : 'Direct Ledger'}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Transaction Notes & Remarks
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Order ID, broker reference, SIP advice..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Selected Ledger Entry Detail Modal (allows Edit or Delete after clicking) */}
      {selectedLedgerTx && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150 isolate overscroll-contain"
          onClick={() => setSelectedLedgerTx(null)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedLedgerTx.type === 'buy'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : selectedLedgerTx.type === 'sell'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : selectedLedgerTx.type === 'dividend'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : selectedLedgerTx.type === 'demerger'
                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                      : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {selectedLedgerTx.type === 'demerger' ? (
                    <Layers className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
                    {selectedLedgerTx.type === 'demerger' ? 'Demerger Spinoff' : `${selectedLedgerTx.type} Execution`}
                  </h3>
                  <span className="text-xs text-slate-400">{formatDate(selectedLedgerTx.date)}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLedgerTx(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Asset:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {holding.name} ({holding.symbol})
                </span>
              </div>
              {selectedLedgerTx.demergedEntities && selectedLedgerTx.demergedEntities.length > 0 ? (
                <div className="space-y-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300 block">
                    Demerged Spinoff Entities ({selectedLedgerTx.demergedEntities.length}):
                  </span>
                  {selectedLedgerTx.demergedEntities.map((ent, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{ent.symbol}</span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">{ent.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+{ent.sharesAllotted} sh</span>
                        <span className="text-[10px] text-slate-400 block">{ent.costAllocationPercentage}% cost</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedLedgerTx.demergedSymbol ? (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Spinoff Entity:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">
                    {selectedLedgerTx.demergedName || selectedLedgerTx.demergedSymbol} ({selectedLedgerTx.demergedSymbol})
                  </span>
                </div>
              ) : null}
              {selectedLedgerTx.demergerRatio && !selectedLedgerTx.demergedEntities && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Demerger Ratio:</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {selectedLedgerTx.demergerRatio}
                  </span>
                </div>
              )}
              {selectedLedgerTx.costAllocationPercentage !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Cost Apportionment (Sec 49(2C)):</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {selectedLedgerTx.costAllocationPercentage}% to spinoff ({Math.max(0, 100 - selectedLedgerTx.costAllocationPercentage)}% retained)
                  </span>
                </div>
              )}
              {selectedLedgerTx.quantity > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">{selectedLedgerTx.type === 'demerger' ? 'Spinoff Shares Allotted:' : 'Units / Shares:'}</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {selectedLedgerTx.quantity}
                  </span>
                </div>
              )}
              {selectedLedgerTx.price > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">{selectedLedgerTx.type === 'demerger' ? 'Parent Adjusted Buy Cost:' : 'Price per unit:'}</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    ₹{selectedLedgerTx.price}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 font-medium">Cash Impact:</span>
                <span
                  className={`text-sm font-extrabold tabular-nums ${
                    selectedLedgerTx.type === 'buy'
                      ? 'text-slate-900 dark:text-white'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {selectedLedgerTx.type === 'demerger' || selectedLedgerTx.type === 'split' || selectedLedgerTx.type === 'bonus'
                    ? '₹0.00 (Corporate Action)'
                    : formatINR(selectedLedgerTx.totalAmount)}
                </span>
              </div>
              {selectedLedgerTx.type === 'sell' && perTxProfitMap.has(selectedLedgerTx.id) && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Booked Realized Gain:</span>
                  <span
                    className={`font-bold tabular-nums ${
                      (perTxProfitMap.get(selectedLedgerTx.id) || 0) >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {(perTxProfitMap.get(selectedLedgerTx.id) || 0) >= 0 ? '+' : ''}
                    {formatINR(perTxProfitMap.get(selectedLedgerTx.id))}
                  </span>
                </div>
              )}
              {selectedLedgerTx.notes && (
                <div className="flex justify-between items-start pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Notes:</span>
                  <span className="text-slate-700 dark:text-slate-300 text-right max-w-[65%]">
                    {selectedLedgerTx.notes}
                  </span>
                </div>
              )}
            </div>

            {confirmDeleteLedgerTx && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium">
                Note: Deleting this trade will also delete the linked passbook expense and recalculate account balances.
              </p>
            )}

            {/* Actions: Edit or Delete */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => {
                  const tx = selectedLedgerTx;
                  setSelectedLedgerTx(null);
                  openEditTxModal(tx);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Entry</span>
              </button>

              {confirmDeleteLedgerTx ? (
                <button
                  onClick={() => {
                    deleteHoldingTransaction(holding.id, selectedLedgerTx.id);
                    setSelectedLedgerTx(null);
                    setConfirmDeleteLedgerTx(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer animate-in fade-in"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </button>
              ) : (
                <button
                  onClick={() => setConfirmDeleteLedgerTx(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-semibold text-xs sm:text-sm transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Entry</span>
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* AMFI Scheme Linking Modal */}
      {isLinkingSchemeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Link AMFI Scheme Code
                  </h3>
                  <p className="text-xs text-slate-400">
                    Connect "{holding.name}" to AMFI for 1-click closing NAV updates
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkingSchemeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Search by Scheme Name or AMFI Code
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    autoFocus
                    value={schemeSearchQ}
                    onChange={(e) => setSchemeSearchQ(e.target.value)}
                    placeholder="e.g. Parag Parikh Flexi, Mirae Large, 122639, SBI Small..."
                    className="w-full pl-9 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {isSearchingSchemes && (
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin absolute right-3 top-2.5" />
                  )}
                </div>

                {/* Plan Type & Option Filter Pills */}
                {schemeSearchResults.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] mt-2">
                    <span className="text-slate-400 font-semibold shrink-0">Filter:</span>
                    <button
                      type="button"
                      onClick={() => setDetailSchemeFilter('direct')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all shrink-0 cursor-pointer ${
                        detailSchemeFilter === 'direct'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      Direct Plans Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailSchemeFilter('all')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all shrink-0 cursor-pointer ${
                        detailSchemeFilter === 'all'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      All ({schemeSearchResults.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailSchemeFilter('growth')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all shrink-0 cursor-pointer ${
                        detailSchemeFilter === 'growth'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      Growth Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailSchemeFilter('regular')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all shrink-0 cursor-pointer ${
                        detailSchemeFilter === 'regular'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      Regular Plans
                    </button>
                  </div>
                )}
              </div>

              {/* Search Results */}
              {schemeSearchResults.length > 0 ? (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Found {filteredDetailSearchResults.length} schemes:
                  </span>
                  {filteredDetailSearchResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No funds match the "{detailSchemeFilter}" filter.
                    </div>
                  ) : (
                    filteredDetailSearchResults.map((res) => {
                      const isReg = res.planType === 'Regular' || res.schemeName.toLowerCase().includes('regular');
                      const isIdcw = res.optionType === 'IDCW' || res.schemeName.toLowerCase().includes('idcw') || res.schemeName.toLowerCase().includes('dividend');
                      return (
                        <div
                          key={res.schemeCode}
                          onClick={() => {
                            setPendingSchemeForConfirm({
                              schemeCode: res.schemeCode,
                              schemeName: res.schemeName,
                              nav: res.nav,
                              planType: res.planType,
                              optionType: res.optionType,
                            });
                          }}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-500/50 flex items-center justify-between gap-3 cursor-pointer transition-all group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                              {res.schemeName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  !isReg
                                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {!isReg ? 'DIRECT' : 'REGULAR'}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  !isIdcw
                                    ? 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300'
                                    : 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300'
                                }`}
                              >
                                {!isIdcw ? 'GROWTH' : 'IDCW'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                AMFI Code: <strong className="text-slate-600 dark:text-slate-300">{res.schemeCode}</strong>
                              </span>
                            </div>
                          </div>
                          {res.nav && (
                            <div className="text-right shrink-0">
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums block">
                                ₹{res.nav.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-400">Live NAV</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : schemeSearchQ.trim().length >= 2 && !isSearchingSchemes ? (
                <div className="py-6 text-center text-slate-400">
                  No AMFI schemes matching "{schemeSearchQ}". Try searching with fewer words.
                </div>
              ) : null}

              {/* Popular Schemes Quick Select */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Popular Scheme Quick Select (Verified Direct Plan - Growth)
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {POPULAR_MF_SCHEMES.map((p) => (
                    <div
                      key={p.code}
                      onClick={() => {
                        setPendingSchemeForConfirm({
                          schemeCode: p.code,
                          schemeName: p.name,
                          nav: p.nav,
                          planType: 'Direct',
                          optionType: 'Growth',
                        });
                      }}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-500/50 flex items-center justify-between gap-2 cursor-pointer transition-all group"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Code: {p.code}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                        ₹{p.nav.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsLinkingSchemeModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal Holding Operations Modal */}
      {internalActionType && (
        <InvestmentActionModal
          holding={holding}
          action={internalActionType}
          isOpen={Boolean(internalActionType)}
          onClose={() => setInternalActionType(null)}
        />
      )}

      {/* Internal Holding Edit Modal */}
      <HoldingModal
        isOpen={internalEditModalOpen}
        initialHolding={holding}
        onClose={() => setInternalEditModalOpen(false)}
      />

      {/* 1-Day Change Breakdown & Last Day Value Modal */}
      {isDayChangeModalOpen && holding && holdingDayPerf && (
        <DayChangeInfoModal
          isOpen={isDayChangeModalOpen}
          onClose={() => setIsDayChangeModalOpen(false)}
          portfolioDayPerf={{
            totalCurrentValue: currentVal,
            totalLastDayValue: holdingDayPerf.lastDayValue,
            totalDayChange: holdingDayPerf.dayChangeValue,
            totalDayChangePercent: holdingDayPerf.dayChangePercent,
            isDayPositive: holdingDayPerf.isDayPositive,
            previousCloseDate: holdingDayPerf.previousCloseDate,
            currentDate: holdingDayPerf.currentDate,
            holdingPerformances: [holdingDayPerf],
            gainers: holdingDayPerf.dayChangeValue > 0 ? [holdingDayPerf] : [],
            losers: holdingDayPerf.dayChangeValue < 0 ? [holdingDayPerf] : [],
            unchanged: holdingDayPerf.dayChangeValue === 0 ? [holdingDayPerf] : [],
            totalHoldingsCount: 1,
            gainersCount: holdingDayPerf.dayChangeValue > 0 ? 1 : 0,
            losersCount: holdingDayPerf.dayChangeValue < 0 ? 1 : 0,
            todayTotalBoughtCost: holdingDayPerf.todayBoughtCost,
            todayTotalSoldProceeds: holdingDayPerf.todaySoldProceeds,
          }}
          singleHolding={holding}
          onRefreshPrices={() => syncMarketPrices(true, holding.id)}
          isRefreshing={isUpdatingNavs}
        />
      )}

      {/* AMFI Scheme Selection Confirmation & Doubt Verification Modal */}
      {pendingSchemeForConfirm && (
        <AmfiFundConfirmModal
          isOpen={Boolean(pendingSchemeForConfirm)}
          onClose={() => setPendingSchemeForConfirm(null)}
          onConfirm={(scheme) => {
            updateHolding(holding.id, {
              amfiSchemeCode: scheme.schemeCode,
              amfiSchemeName: scheme.schemeName,
              currentPrice: scheme.nav && scheme.nav > 0 ? scheme.nav : holding.currentPrice,
            });
            updateSingleHoldingNav(holding.id, scheme.schemeCode);
            setIsLinkingSchemeModalOpen(false);
            setPendingSchemeForConfirm(null);
          }}
          scheme={pendingSchemeForConfirm}
          holdingContext={{
            holdingName: holding.name,
            holdingSymbol: holding.symbol,
            holdingPrice: liveCMP,
            averageBuyPrice: holding.averageBuyPrice,
          }}
          onSearchDirectGrowth={(suggestedQ) => {
            setSchemeSearchQ(suggestedQ);
            setDetailSchemeFilter('direct');
          }}
        />
      )}

      {/* Fund Verification Details Modal (Green / Blue Tick) */}
      <FundVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        holding={holding}
        onEditHolding={() => setInternalEditModalOpen(true)}
      />

      {/* Fund Confirmation Required / Not Verified Modal (Yellow Badge) */}
      <FundConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        holding={holding}
        onEditHolding={() => setInternalEditModalOpen(true)}
      />

      {/* Monthly Subscription Modal for PF and Bonds */}
      <EditSubscriptionModal
        isOpen={isEditSubOpen}
        onClose={() => setIsEditSubOpen(false)}
        holding={holding}
      />

      {/* Add Past Subscriptions Modal for Backfilling Deposits */}
      <AddPastSubscriptionsModal
        isOpen={isPastSubsOpen}
        onClose={() => setIsPastSubsOpen(false)}
        holding={holding}
      />

      {/* Add Manual Interest Modal */}
      <AddManualInterestModal
        isOpen={isManualInterestOpen}
        onClose={() => setIsManualInterestOpen(false)}
        holding={holding}
      />
    </div>
  );
};
