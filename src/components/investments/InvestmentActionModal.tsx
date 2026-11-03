import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { InvestmentHolding } from '../../types';
import { formatINR, formatNumber, toInputDate, parseDate, getHoldingSharesAsOfDate } from '../../utils/formatters';
import { calculateStockDeliveryCharges, calculateMutualFundCharges } from '../../utils/statutoryCharges';
import { computePfSuggestedInterest } from '../../utils/bondsSgbPfEngine';
import {
  X,
  ArrowLeft,
  Check,
  ArrowRightLeft,
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Scissors,
  Gift,
  ShoppingCart,
  Banknote,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
  Layers,
  Sparkles,
  Plus,
  Minus,
  Trash2,
  Landmark,
  TrendingUp,
} from 'lucide-react';

export type InvestmentModalAction =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'split'
  | 'bonus'
  | 'demerger'
  | 'interest'
  | 'coupon'
  | 'principal_repayment';

export interface DemergedEntityFormItem {
  id: string;
  symbol: string;
  name: string;
  ratioA: string; // spinoff shares received
  ratioB: string; // per parent shares held
  costAllocPct: string; // % of parent cost allocated
  listingPrice: string; // optional CMP / listing price
}

interface InvestmentActionModalProps {
  holding: InvestmentHolding;
  action: InvestmentModalAction;
  isOpen: boolean;
  onClose: () => void;
  initialValues?: {
    price?: number;
    quantity?: number;
    date?: string;
    note?: string;
  };
}

export const InvestmentActionModal: React.FC<InvestmentActionModalProps> = ({
  holding,
  action: initialAction,
  isOpen,
  onClose,
  initialValues,
}) => {
  const { accounts, recordInvestmentAction } = useApp();

  const isBondOnly = holding.assetType === 'bond';
  const isSgb = holding.assetType === 'sgb';
  const isPf = holding.assetType === 'pf';
  const isBond = isBondOnly || isSgb;
  const isMF = holding.assetType === 'mutual_fund';
  const isStock = holding.assetType === 'stock';

  const [activeAction, setActiveAction] = useState<InvestmentModalAction>(initialAction);

  // Sync activeAction when initialAction changes
  useEffect(() => {
    setActiveAction(initialAction);
    if (holding.dematAccountId) {
      setTargetDematAccountId(holding.dematAccountId);
    }
  }, [initialAction, isOpen, holding.dematAccountId]);

  const todayStr = useMemo(() => toInputDate(new Date()), []);

  // Standard Buy/Sell/Dividend inputs
  const [quantity, setQuantity] = useState<string>('1');
  const [price, setPrice] = useState<string>(
    initialAction === 'dividend' ? '500' : holding.currentPrice.toString()
  );

  const defaultBank = useMemo(
    () => accounts.find((a) => a.type === 'bank' || a.type === 'cash') || accounts[0],
    [accounts]
  );
  const defaultDemat = useMemo(
    () =>
      accounts.find((a) => a.id === holding.dematAccountId) ||
      accounts.find((a) => a.type === 'demat') ||
      accounts[0],
    [accounts, holding.dematAccountId]
  );

  const [accountId, setAccountId] = useState<string>(
    defaultBank ? defaultBank.id : accounts.length > 0 ? accounts[0].id : ''
  );
  const [targetDematAccountId, setTargetDematAccountId] = useState<string>(
    defaultDemat ? defaultDemat.id : accounts.length > 0 ? accounts[0].id : ''
  );
  const [asTransfer, setAsTransfer] = useState<boolean>(true);
  const [categorizeProfitAsIncome, setCategorizeProfitAsIncome] = useState<boolean>(true);
  const [categorizeLossAsExpense, setCategorizeLossAsExpense] = useState<boolean>(true);
  const [date, setDate] = useState<string>(todayStr);
  const [note, setNote] = useState<string>('');

  // Statutory Charges and Expense Tracking State
  const [logChargesAsExpense, setLogChargesAsExpense] = useState<boolean>(true);
  const [brokeragePerOrder, setBrokeragePerOrder] = useState<string>('0');
  const [showFeeBreakdown, setShowFeeBreakdown] = useState<boolean>(false);

  // Stock Split Specific State
  const [splitPreset, setSplitPreset] = useState<'1:2' | '1:5' | '1:10' | 'custom'>('1:2');
  const [splitOldShares, setSplitOldShares] = useState<string>('1');
  const [splitNewShares, setSplitNewShares] = useState<string>('2');

  // Bonus Share Specific State
  const [bonusPreset, setBonusPreset] = useState<'1:1' | '1:2' | '2:1' | 'custom' | 'direct'>('1:1');
  const [bonusA, setBonusA] = useState<string>('1');
  const [bonusB, setBonusB] = useState<string>('1');
  const [bonusDirectShares, setBonusDirectShares] = useState<string>('');

  // Demerger Specific State (supports multiple demerged entities/shares from a single parent)
  const [demergerPreset, setDemergerPreset] = useState<'single' | 'tatamotors_2' | 'vedanta_5' | 'custom'>('single');
  const [demergerOutcome, setDemergerOutcome] = useState<'keep_original' | 'extinguish_original'>('keep_original');
  const [demergedEntities, setDemergedEntities] = useState<DemergedEntityFormItem[]>([
    {
      id: 'demerged_1',
      symbol: `${holding.symbol}-NEW`,
      name: `${holding.name} Demerged Spinoff`,
      ratioA: '1',
      ratioB: '1',
      costAllocPct: '20',
      listingPrice: '',
    },
  ]);

  // Bond, SGB & PF Periodic Coupon / Interest Suggestion
  const suggestedCouponInterest = useMemo(() => {
    if (isSgb) {
      const issuePrice = holding.rbiIssuePrice || holding.averageBuyPrice || 6263;
      const rate = holding.couponRate || 2.5;
      const grams = holding.quantity || 1;
      return Number(((grams * issuePrice * (rate / 100)) / 2).toFixed(2));
    }
    if (isPf) {
      return computePfSuggestedInterest(holding, date);
    }
    if (!isBondOnly) return 0;
    const rate = holding.couponRate || 0;
    const unitCost = holding.averageBuyPrice || holding.currentPrice || 1000;
    const qty = holding.quantity || 1;
    let freqDiv = 1;
    if (holding.couponFrequency === 'monthly') freqDiv = 12;
    else if (holding.couponFrequency === 'quarterly') freqDiv = 4;
    else if (holding.couponFrequency === 'semi_annually') freqDiv = 2;

    if (rate > 0 && unitCost > 0) {
      return Number(((qty * unitCost * (rate / 100)) / freqDiv).toFixed(2));
    }
    return 0;
  }, [isSgb, isPf, isBondOnly, holding.couponRate, holding.rbiIssuePrice, holding.averageBuyPrice, holding.quantity, holding.couponFrequency, holding.interestRate, date]);

  // Reset or initialize state when opening
  useEffect(() => {
    if (isOpen) {
      setDate(initialValues?.date ? toInputDate(initialValues.date) : todayStr);
      setNote(initialValues?.note || '');
      setLogChargesAsExpense(true);
      setShowFeeBreakdown(false);

      if (initialValues?.quantity !== undefined) {
        setQuantity(initialValues.quantity.toString());
      }

      if (initialValues?.price !== undefined) {
        setPrice(initialValues.price.toString());
      } else if (activeAction === 'dividend') {
        setPrice('500');
        setQuantity('1');
      } else if (activeAction === 'interest' || activeAction === 'coupon') {
        setPrice(suggestedCouponInterest > 0 ? suggestedCouponInterest.toString() : '500');
        setQuantity('1');
      } else if (activeAction === 'principal_repayment') {
        const parPrice = holding.averageBuyPrice || holding.currentPrice || 1000;
        setPrice(parPrice.toString());
        setQuantity(holding.quantity.toString());
      } else if (activeAction === 'split') {
        setSplitPreset('1:2');
        setSplitOldShares('1');
        setSplitNewShares('2');
      } else if (activeAction === 'bonus') {
        setBonusPreset('1:1');
        setBonusA('1');
        setBonusB('1');
      } else if (activeAction === 'demerger') {
        const sym = holding.symbol.toUpperCase();
        if (sym.includes('VED') || sym.includes('VEDL')) {
          setDemergerPreset('vedanta_5');
          setDemergedEntities([
            { id: 'demerged_1', symbol: 'VEDL-ALU', name: 'Vedanta Aluminium Ltd', ratioA: '1', ratioB: '1', costAllocPct: '20', listingPrice: '' },
            { id: 'demerged_2', symbol: 'VEDL-OG', name: 'Vedanta Oil & Gas Ltd', ratioA: '1', ratioB: '1', costAllocPct: '20', listingPrice: '' },
            { id: 'demerged_3', symbol: 'VEDL-PWR', name: 'Vedanta Power Ltd', ratioA: '1', ratioB: '1', costAllocPct: '15', listingPrice: '' },
            { id: 'demerged_4', symbol: 'VEDL-STL', name: 'Vedanta Steel Ltd', ratioA: '1', ratioB: '1', costAllocPct: '15', listingPrice: '' },
            { id: 'demerged_5', symbol: 'VEDL-BM', name: 'Vedanta Base Metals Ltd', ratioA: '1', ratioB: '1', costAllocPct: '10', listingPrice: '' },
          ]);
        } else if (sym.includes('REL') || sym.includes('RELIANCE')) {
          setDemergerPreset('single');
          setDemergedEntities([
            { id: 'demerged_1', symbol: 'JIOFIN', name: 'Jio Financial Services Ltd', ratioA: '1', ratioB: '1', costAllocPct: '9.96', listingPrice: '260' },
          ]);
        } else if (sym.includes('TATA') && (sym.includes('MOT') || sym.includes('MTR'))) {
          setDemergerPreset('tatamotors_2');
          setDemergedEntities([
            { id: 'demerged_1', symbol: 'TATAMTR-CV', name: 'Tata Motors Commercial Vehicles Ltd', ratioA: '1', ratioB: '1', costAllocPct: '50', listingPrice: '' },
            { id: 'demerged_2', symbol: 'TATAMTR-PV', name: 'Tata Motors Passenger Vehicles Ltd', ratioA: '1', ratioB: '1', costAllocPct: '50', listingPrice: '' },
          ]);
        } else {
          setDemergerPreset('single');
          setDemergedEntities([
            { id: 'demerged_1', symbol: `${holding.symbol}-NEW`, name: `${holding.name} Demerged Spinoff`, ratioA: '1', ratioB: '1', costAllocPct: '20', listingPrice: '' },
          ]);
        }
      } else {
        setPrice(holding.currentPrice.toString());
        setQuantity(isBond ? holding.quantity.toString() : '1');
      }
    }
  }, [isOpen, activeAction, holding?.id]);

  const isBuy = activeAction === 'buy';
  const isSell = activeAction === 'sell';
  const isDividend = activeAction === 'dividend';
  const isInterest = activeAction === 'interest' || activeAction === 'coupon';
  const isPrincipalRepayment = activeAction === 'principal_repayment';
  const isSplit = activeAction === 'split';
  const isBonus = activeAction === 'bonus';
  const isDemerger = activeAction === 'demerger';

  // Requirement 4: Take the number of shares in account as on the date of corporate action (supports old/retroactive actions)
  const eligibleShares = useMemo(() => {
    return getHoldingSharesAsOfDate(holding, date);
  }, [holding, date]);

  // Calculations for Demerger (Multiple Spinoff Shares) based on eligible shares as of date
  const parentTotalCost = eligibleShares * holding.averageBuyPrice;
  const demergedCalculations = useMemo(() => {
    return demergedEntities.map((item) => {
      const rA = Math.max(1, parseFloat(item.ratioA) || 1);
      const rB = Math.max(1, parseFloat(item.ratioB) || 1);
      const ratioMultiplier = rA / rB;
      const allottedShares = Math.floor(eligibleShares * ratioMultiplier);
      const costPct = Math.max(0, parseFloat(item.costAllocPct) || 0);
      const allocatedCost = parentTotalCost * (costPct / 100);
      const calculatedAvgBuyPrice = allottedShares > 0 ? allocatedCost / allottedShares : 0;
      const listingPriceNum = parseFloat(item.listingPrice) || calculatedAvgBuyPrice;

      return {
        ...item,
        rA,
        rB,
        allottedShares,
        costPct,
        allocatedCost,
        calculatedAvgBuyPrice,
        listingPriceNum,
      };
    });
  }, [demergedEntities, eligibleShares, parentTotalCost]);

  const totalDemergerCostPct = useMemo(() => {
    return demergedCalculations.reduce((acc, item) => acc + item.costPct, 0);
  }, [demergedCalculations]);

  const totalDemergedSharesAllotted = useMemo(() => {
    return demergedCalculations.reduce((acc, item) => acc + item.allottedShares, 0);
  }, [demergedCalculations]);

  const retainedParentCostPct = Math.max(0, 100 - totalDemergerCostPct);
  const retainedParentCost = parentTotalCost * (retainedParentCostPct / 100);
  const postDemergerParentAvgBuyPrice =
    eligibleShares > 0 ? retainedParentCost / eligibleShares : holding.averageBuyPrice;

  // Calculations for Split based on eligible shares as of date
  const oldSplitN = Math.max(1, parseFloat(splitOldShares) || 1);
  const newSplitN = Math.max(1, parseFloat(splitNewShares) || 1);
  const splitRatioMultiplier = newSplitN / oldSplitN;
  const postSplitQuantity = Math.floor(eligibleShares * splitRatioMultiplier);
  const additionalSplitShares = Math.max(0, postSplitQuantity - eligibleShares);
  const postSplitAvgPrice =
    postSplitQuantity > 0
      ? (eligibleShares * holding.averageBuyPrice) / postSplitQuantity
      : holding.averageBuyPrice;
  const theoreticalSplitCMP =
    splitRatioMultiplier > 0 ? holding.currentPrice / splitRatioMultiplier : holding.currentPrice;

  // Calculations for Bonus based on eligible shares as of date
  let bonusSharesReceived = 0;
  if (bonusPreset === 'direct') {
    bonusSharesReceived = Math.max(0, parseFloat(bonusDirectShares) || 0);
  } else {
    const bA = Math.max(1, parseFloat(bonusA) || 1);
    const bB = Math.max(1, parseFloat(bonusB) || 1);
    bonusSharesReceived = Math.floor(eligibleShares * (bA / bB));
  }
  const postBonusTotalQuantity = eligibleShares + bonusSharesReceived;
  const postBonusAvgPrice =
    postBonusTotalQuantity > 0
      ? (eligibleShares * holding.averageBuyPrice) / postBonusTotalQuantity
      : holding.averageBuyPrice;
  const theoreticalBonusCMP =
    postBonusTotalQuantity > 0
      ? (holding.currentPrice * eligibleShares) / postBonusTotalQuantity
      : holding.currentPrice;

  const parsedQty = parseFloat(quantity) || 0;
  const parsedPrice = parseFloat(price) || 0;
  const parsedBrokerage = parseFloat(brokeragePerOrder) || 0;

  const totalAmount =
    isDividend || isInterest
      ? parsedPrice
      : isSplit || isBonus
      ? 0
      : parsedQty * parsedPrice;

  // Statutory Taxes & Charges Calculation (Indian Market Regulations)
  const stockCharges = useMemo(() => {
    if (!isStock || (!isBuy && !isSell)) return null;
    return calculateStockDeliveryCharges({
      type: isBuy ? 'buy' : 'sell',
      quantity: parsedQty,
      price: parsedPrice,
      brokeragePerOrder: parsedBrokerage,
    });
  }, [isStock, isBuy, isSell, parsedQty, parsedPrice, parsedBrokerage]);

  const mfCharges = useMemo(() => {
    if (!isMF || (!isBuy && !isSell)) return null;
    if (isBuy) {
      return calculateMutualFundCharges(totalAmount, parsedPrice);
    }
    return null;
  }, [isMF, isBuy, isSell, totalAmount, parsedPrice]);

  const activeStatutoryCharges = isStock ? stockCharges?.totalCharges || 0 : mfCharges?.totalCharges || 0;

  // Handle Split preset change
  const handleSplitPresetChange = (preset: '1:2' | '1:5' | '1:10' | 'custom') => {
    setSplitPreset(preset);
    if (preset === '1:2') {
      setSplitOldShares('1');
      setSplitNewShares('2');
    } else if (preset === '1:5') {
      setSplitOldShares('1');
      setSplitNewShares('5');
    } else if (preset === '1:10') {
      setSplitOldShares('1');
      setSplitNewShares('10');
    }
  };

  // Handle Bonus preset change
  const handleBonusPresetChange = (preset: '1:1' | '1:2' | '2:1' | 'custom' | 'direct') => {
    setBonusPreset(preset);
    if (preset === '1:1') {
      setBonusA('1');
      setBonusB('1');
    } else if (preset === '1:2') {
      setBonusA('1');
      setBonusB('2');
    } else if (preset === '2:1') {
      setBonusA('2');
      setBonusB('1');
    }
  };

  // Auto balance cost allocation equally across spinoff entities
  const handleAutoBalanceCost = (targetTotal = 100) => {
    if (demergedEntities.length === 0) return;
    const perEntity = Number((targetTotal / demergedEntities.length).toFixed(2));
    setDemergedEntities((prev) =>
      prev.map((e, idx) => {
        const isLast = idx === prev.length - 1;
        const val = isLast ? Number((targetTotal - perEntity * (prev.length - 1)).toFixed(2)) : perEntity;
        return { ...e, costAllocPct: val.toString() };
      })
    );
  };

  // Handle Demerger preset change
  const handleDemergerPresetChange = (preset: 'single' | 'tatamotors_2' | 'vedanta_5' | 'custom') => {
    setDemergerPreset(preset);
    if (preset === 'single') {
      setDemergerOutcome('keep_original');
      const sym = holding.symbol.toUpperCase();
      if (sym.includes('REL')) {
        setDemergedEntities([
          { id: 'demerged_1', symbol: 'JIOFIN', name: 'Jio Financial Services Ltd', ratioA: '1', ratioB: '1', costAllocPct: '9.96', listingPrice: '260' },
        ]);
      } else {
        setDemergedEntities([
          { id: 'demerged_1', symbol: `${holding.symbol}-NEW`, name: `${holding.name} Demerged Spinoff`, ratioA: '1', ratioB: '1', costAllocPct: '20', listingPrice: '' },
        ]);
      }
    } else if (preset === 'tatamotors_2') {
      // Tata Motors 2-way split: 100% cost distributed between CV & PV, original company replaced
      setDemergerOutcome('extinguish_original');
      setDemergedEntities([
        { id: 'demerged_1', symbol: 'TATAMTR-CV', name: 'Tata Motors Commercial Vehicles Ltd', ratioA: '1', ratioB: '1', costAllocPct: '50', listingPrice: '' },
        { id: 'demerged_2', symbol: 'TATAMTR-PV', name: 'Tata Motors Passenger Vehicles Ltd', ratioA: '1', ratioB: '1', costAllocPct: '50', listingPrice: '' },
      ]);
    } else if (preset === 'vedanta_5') {
      // Vedanta 5-way demerger: All 5 new companies created (100% cost distributed at 20% each), original replaced
      setDemergerOutcome('extinguish_original');
      setDemergedEntities([
        { id: 'demerged_1', symbol: 'VEDL-ALU', name: 'Vedanta Aluminium Ltd', ratioA: '1', ratioB: '1', costAllocPct: '20', listingPrice: '' },
        { id: 'demerged_2', symbol: 'VEDL-OG', name: 'Vedanta Oil & Gas Ltd', ratioA: '1', ratioB: '1', costAllocPct: '20', listingPrice: '' },
        { id: 'demerged_3', symbol: 'VEDL-PWR', name: 'Vedanta Power Ltd', ratioA: '1', ratioB: '1', costAllocPct: '20', listingPrice: '' },
        { id: 'demerged_4', symbol: 'VEDL-STL', name: 'Vedanta Steel Ltd', ratioA: '1', ratioB: '1', costAllocPct: '20', listingPrice: '' },
        { id: 'demerged_5', symbol: 'VEDL-BM', name: 'Vedanta Base Metals Ltd', ratioA: '1', ratioB: '1', costAllocPct: '20', listingPrice: '' },
      ]);
    }
  };

  const handleSetDemergedCount = (count: number) => {
    const validCount = Math.min(10, Math.max(1, count));
    setDemergerPreset('custom');
    setDemergedEntities((prev) => {
      if (prev.length === validCount) return prev;
      if (prev.length < validCount) {
        const added: DemergedEntityFormItem[] = [];
        for (let i = prev.length; i < validCount; i++) {
          added.push({
            id: `demerged_${Date.now()}_${i}`,
            symbol: `${holding.symbol}-SPIN${i + 1}`,
            name: `${holding.name} Spinoff ${i + 1}`,
            ratioA: '1',
            ratioB: '1',
            costAllocPct: '10',
            listingPrice: '',
          });
        }
        return [...prev, ...added];
      }
      return prev.slice(0, validCount);
    });
  };

  const handleAddDemergedEntity = () => {
    if (demergedEntities.length >= 10) return;
    handleSetDemergedCount(demergedEntities.length + 1);
  };

  const handleRemoveDemergedEntity = (index: number) => {
    if (demergedEntities.length <= 1) return;
    setDemergerPreset('custom');
    setDemergedEntities((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateDemergedEntity = (index: number, updates: Partial<DemergedEntityFormItem>) => {
    setDemergerPreset('custom');
    setDemergedEntities((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent future execution dates
    const execDate = date > todayStr ? todayStr : date;

    if (isSplit) {
      if (postSplitQuantity <= 0 || splitRatioMultiplier <= 1) return;

      recordInvestmentAction({
        holdingId: holding.id,
        action: 'split',
        quantity: additionalSplitShares,
        oldQuantity: eligibleShares,
        newQuantity: postSplitQuantity,
        splitRatio: `${oldSplitN}:${newSplitN}`,
        price: Number(theoreticalSplitCMP.toFixed(2)),
        date: execDate,
        note: note.trim() || `Stock Split (${oldSplitN}:${newSplitN}) from ${eligibleShares} to ${postSplitQuantity} shares`,
      });
      onClose();
      return;
    }

    if (isBonus) {
      if (bonusSharesReceived <= 0) return;

      recordInvestmentAction({
        holdingId: holding.id,
        action: 'bonus',
        quantity: bonusSharesReceived,
        oldQuantity: eligibleShares,
        newQuantity: postBonusTotalQuantity,
        bonusRatio: bonusPreset === 'direct' ? `+${bonusSharesReceived}` : `${bonusA}:${bonusB}`,
        price: Number(theoreticalBonusCMP.toFixed(2)),
        date: execDate,
        note: note.trim() || `Bonus issue (${bonusPreset === 'direct' ? `+${bonusSharesReceived}` : `${bonusA}:${bonusB}`}) +${bonusSharesReceived} shares`,
      });
      onClose();
      return;
    }

    if (isDemerger) {
      if (totalDemergerCostPct > 100) return;

      const validEntities = demergedCalculations
        .filter((e) => e.symbol.trim().length > 0 && e.allottedShares > 0)
        .map((e) => ({
          symbol: e.symbol.trim().toUpperCase(),
          name: e.name.trim() || `${e.symbol.trim().toUpperCase()} Ltd`,
          ratioA: e.rA,
          ratioB: e.rB,
          costAllocationPercentage: e.costPct,
          listingPrice: parseFloat(e.listingPrice) || e.calculatedAvgBuyPrice,
        }));

      if (validEntities.length === 0) return;

      recordInvestmentAction({
        holdingId: holding.id,
        action: 'demerger',
        quantity: 0,
        oldQuantity: eligibleShares,
        newQuantity: eligibleShares,
        price: validEntities[0].listingPrice || 0,
        date: execDate,
        note: note.trim() || undefined,
        demergedEntities: validEntities,
        demergerOutcome,
        costAllocationPercentage: totalDemergerCostPct,
        demergerRatio: `${validEntities[0].ratioA}:${validEntities[0].ratioB}`,
        demergedSymbol: validEntities[0].symbol,
        demergedName: validEntities[0].name,
      });
      onClose();
      return;
    }

    if (isInterest) {
      if (parsedPrice <= 0) return;
      if (isPf) {
        recordInvestmentAction({
          holdingId: holding.id,
          action: 'interest',
          quantity: 1,
          price: parsedPrice,
          date: execDate,
          note: note.trim() || `Annual Sovereign Interest Credited (${holding.interestRate || 8.25}% p.a.) up to ${execDate}`,
        });
        onClose();
        return;
      }
      if (!accountId) return;
      recordInvestmentAction({
        holdingId: holding.id,
        action: 'interest',
        quantity: 1,
        price: parsedPrice,
        accountId,
        date: execDate,
        note:
          note.trim() ||
          (isSgb
            ? `SGB Semi-Annual Sovereign Interest (${holding.couponRate || 2.5}% p.a. on issue price ₹${holding.rbiIssuePrice || holding.averageBuyPrice}/g)`
            : `Coupon Interest for ${holding.symbol} (${holding.couponRate || ''}% p.a.)`),
      });
      onClose();
      return;
    }

    if (isPrincipalRepayment) {
      const repAmt = isBondOnly ? (parsedPrice > 0 ? parsedPrice : parsedQty * parsedPrice) : parsedQty * parsedPrice;
      if (repAmt <= 0 || !accountId) return;
      recordInvestmentAction({
        holdingId: holding.id,
        action: 'principal_repayment',
        quantity: isBondOnly ? 0 : parsedQty,
        price: repAmt,
        accountId,
        date: execDate,
        note:
          note.trim() ||
          (isSgb
            ? `SGB Maturity Redemption (${parsedQty}g @ ₹${parsedPrice}/g)`
            : `Principal Back for ${holding.symbol}: ₹${formatINR(repAmt)}`),
      });
      onClose();
      return;
    }

    // PF Specific Contribution / Withdrawal
    if (isPf) {
      const amt = parsedQty > 0 ? parsedQty : parsedPrice;
      if (amt <= 0 || !accountId) return;
      if (activeAction === 'buy') {
        recordInvestmentAction({
          holdingId: holding.id,
          action: 'buy',
          quantity: amt,
          price: 1,
          accountId,
          asTransfer: true,
          date: execDate,
          note: note.trim() || `Provident Fund Contribution: ${holding.name || holding.symbol}`,
        });
      } else if (activeAction === 'sell') {
        recordInvestmentAction({
          holdingId: holding.id,
          action: 'sell',
          quantity: amt,
          price: 1,
          accountId,
          asTransfer: true,
          date: execDate,
          note: note.trim() || `Provident Fund Withdrawal: ${holding.name || holding.symbol}`,
        });
      }
      onClose();
      return;
    }

    // Standard Buy, Sell, Dividend
    if (parsedPrice <= 0 || !accountId) return;
    if (!isDividend && parsedQty <= 0) return;

    // Build statutory charge descriptive note for dual-write
    let feeNote: string | undefined = undefined;
    if (isStock && stockCharges && stockCharges.totalCharges > 0) {
      feeNote = `Brokerage & Taxes: ${isBuy ? 'BUY' : 'SELL'} ${parsedQty}x ${holding.symbol}`;
    } else if (isMF && mfCharges && mfCharges.totalCharges > 0) {
      feeNote = `SIP/Lumpsum Stamp Duty (0.005%): ${holding.symbol}`;
    }

    recordInvestmentAction({
      holdingId: holding.id,
      action: activeAction,
      quantity: isDividend ? 1 : isMF && isBuy && mfCharges ? mfCharges.unitsAllotted : parsedQty,
      price: parsedPrice,
      accountId,
      targetDematAccountId,
      asTransfer: isDividend ? false : asTransfer,
      categorizeProfitAsIncome,
      categorizeLossAsExpense,
      date: execDate,
      note: note.trim() || undefined,
      chargesAmount: activeStatutoryCharges,
      logChargesAsExpense: logChargesAsExpense && activeStatutoryCharges > 0,
      chargesNote: feeNote,
    });

    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    }
    return () => {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
      }
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <>
      {/* Fixed Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99990,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          touchAction: 'none',
        }}
        onClick={onClose}
      />

      {/* Fixed Center Modal Card */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 99999,
          maxHeight: '85vh',
          width: 'calc(100% - 2rem)',
          maxWidth: '42rem',
        }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden isolate animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white/95 dark:bg-slate-900/95">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {holding.symbol}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {holding.assetType.replace('_', ' ')}
                </span>
                {isBond && holding.couponRate && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                    {holding.couponRate}% p.a.
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {holding.name} ·{' '}
                {isSgb
                  ? `${formatNumber(holding.quantity)} grams @ ${formatINR(holding.averageBuyPrice)}/g`
                  : isPf
                  ? `Corpus: ${formatINR(holding.quantity * (holding.currentPrice || 1))}`
                  : isBondOnly
                  ? `${formatNumber(holding.quantity)} units @ ${formatINR(holding.averageBuyPrice || holding.currentPrice)}/un`
                  : `Holding: ${formatNumber(holding.quantity)} ${isStock ? 'shares' : 'units'} @ ${formatINR(holding.averageBuyPrice)}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Switcher Tabs (Domain Tailored for SGB, PF, Bonds, Stocks, and MFs) */}
        <div className="px-4 sm:px-8 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
          <div
            className={`grid gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl text-xs font-semibold ${
              isPf
                ? 'grid-cols-3'
                : isSgb || isBondOnly
                ? 'grid-cols-2 sm:grid-cols-4'
                : isMF
                ? 'grid-cols-3'
                : isStock
                ? 'grid-cols-3 sm:grid-cols-6'
                : 'grid-cols-3'
            }`}
          >
            {isPf ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveAction('buy')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'buy'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Log Employee or Employer Contribution"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Contribution</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('interest')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'interest'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Credit Annual Sovereign Interest to Corpus"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Credit Interest</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('sell')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'sell'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Log PF Withdrawal or Partial Claim"
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Withdrawal</span>
                </button>
              </>
            ) : isSgb ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveAction('buy')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'buy'
                      ? 'bg-yellow-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Purchase additional SGB grams"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Add Grams</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('sell')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'sell'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Premature exit or secondary market sale"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Redeem / Exit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('interest')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'interest'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Record Semi-Annual Sovereign Interest Received (2.50% p.a.)"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Interest (2.5%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('principal_repayment')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'principal_repayment'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Final Maturity Redemption at RBI Gold Benchmark Rate"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Maturity Exit</span>
                </button>
              </>
            ) : isBondOnly ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveAction('buy')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'buy'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Buy Bond</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('sell')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'sell'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Sell / Exit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('interest')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'interest' || activeAction === 'coupon'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Record Periodic Coupon Interest Received"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Coupon Interest</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('principal_repayment')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'principal_repayment'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Record Principal Repayment / Maturity Redemption"
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>Principal Back</span>
                </button>
              </>
            ) : isMF ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveAction('buy')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'buy'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Buy</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('sell')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'sell'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Sell</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('dividend')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeAction === 'dividend'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Dividend payout credited directly to bank passbook as Income"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Dividends</span>
                </button>
              </>
            ) : isStock ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveAction('buy')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'buy'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Buy</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('sell')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'sell'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Sell</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('dividend')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeAction === 'dividend'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Dividend payout credited directly to bank passbook as Income"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Dividends</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('bonus')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeAction === 'bonus'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Bonus issue credited at zero acquisition cost"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>Bonus</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('split')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeAction === 'split'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Sub-divide existing shares (e.g. 1:2, 1:5)"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Split</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('demerger')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeAction === 'demerger'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Spinoff new entity with cost basis apportionment (e.g. Vedanta, Jio Financial)"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Demerger</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveAction('buy')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'buy'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Buy / SIP</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('sell')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'sell'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Redeem</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction('dividend')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeAction === 'dividend'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>IDCW Payout</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 text-xs sm:text-sm">
          {/* Current Holding Snapshot with Eligible Shares As Of Date */}
          <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">
                  {isSgb
                    ? 'Gold Weight'
                    : isPf
                    ? 'Total Corpus Balance'
                    : isBondOnly
                    ? 'Units Held'
                    : isSplit || isBonus || isDemerger
                    ? 'Eligible Shares'
                    : 'Holding Quantity'}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                  {isSgb
                    ? `${formatNumber(holding.quantity)} g`
                    : isPf
                    ? formatINR(holding.quantity * (holding.currentPrice || 1))
                    : isBondOnly
                    ? `${formatNumber(holding.quantity)} un`
                    : `${formatNumber(isSplit || isBonus || isDemerger ? eligibleShares : holding.quantity)} ${isStock ? 'sh' : 'un'}`}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">
                  {isSgb
                    ? 'RBI Issue Price'
                    : isPf
                    ? 'PF Scheme'
                    : isBondOnly
                    ? 'Purchase Price'
                    : 'Avg Buy Cost'}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                  {isSgb
                    ? `${formatINR(holding.averageBuyPrice)}/g`
                    : isPf
                    ? (holding.pfType || 'EPF')
                    : isBondOnly
                    ? formatINR(holding.averageBuyPrice)
                    : formatINR(holding.averageBuyPrice)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">
                  {isSgb
                    ? 'Reference Gold Price'
                    : isPf
                    ? 'Interest Rate'
                    : isBond
                    ? 'Current Price / CMP'
                    : isMF
                    ? 'NAV'
                    : 'CMP'}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {isSgb
                    ? `${formatINR(holding.currentPrice)}/g`
                    : isPf
                    ? `${holding.interestRate || holding.couponRate || 8.25}% p.a.`
                    : formatINR(holding.currentPrice)}
                </span>
              </div>
            </div>

            {/* If retroactive date has different share count than today, show informative banner */}
            {(isSplit || isBonus || isDemerger) && eligibleShares !== holding.quantity && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center justify-between">
                <span>Shares in account on {date}: <strong className="font-bold">{eligibleShares}</strong></span>
                <span className="text-[10px] text-slate-400">(Current total: {holding.quantity})</span>
              </div>
            )}
          </div>

          {/* INTEREST MODE (SGB, PF, BOND) */}
          {isInterest && (
            <div className="space-y-4">
              {isSgb ? (
                <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between font-bold text-amber-800 dark:text-amber-300">
                    <span>Sovereign Gold Bond Interest (2.50% p.a.)</span>
                    <span>Semi-Annual Payout</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Calculated on original RBI issue price ({formatINR(holding.averageBuyPrice)}/g) for {holding.quantity} grams. Paid directly into your registered bank account.
                  </p>
                </div>
              ) : isPf ? (
                <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                    <span>Provident Fund Annual Interest Credit</span>
                    <span>{holding.interestRate || holding.couponRate || 8.25}% p.a.</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Interest compounds directly into your PF corpus balance at the sovereign rate declared for the financial year.
                  </p>
                </div>
              ) : holding.couponRate ? (
                <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between text-xs">
                  <span className="text-amber-800 dark:text-amber-300 font-bold">Scheduled Coupon Rate</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {holding.couponRate}% p.a. ({holding.couponFrequency || 'semi_annually'})
                  </span>
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isSgb ? 'Semi-Annual SGB Interest Amount (₹)' : isPf ? 'Annual PF Interest Credited (₹)' : 'Coupon Interest Amount (₹)'}
                  </label>
                  {suggestedCouponInterest > 0 && (
                    <button
                      type="button"
                      onClick={() => setPrice(suggestedCouponInterest.toString())}
                      className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Use Calculated: ₹{suggestedCouponInterest}
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={suggestedCouponInterest > 0 ? suggestedCouponInterest.toString() : 'e.g. 3875'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-sm"
                />
              </div>

              {!isPf && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Deposit Into Bank Account
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    {accounts
                      .filter((a) => !a.isSystemDebtAccount && a.type !== 'debt')
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({formatINR(acc.balance)})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* BOND & SGB PRINCIPAL REPAYMENT / REDEMPTION MODE */}
          {isPrincipalRepayment && (
            <div className="space-y-4">
              {isSgb ? (
                <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 flex flex-col gap-1 text-xs">
                  <span className="font-bold text-indigo-800 dark:text-indigo-300">
                    Sovereign Gold Bond Final Maturity / Premature Redemption
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Redemption is settled at the simple average of the closing gold price (999 purity) published by IBJA for the preceding 3 business days. Capital gains on RBI redemption at maturity are tax-exempt for individuals.
                  </p>
                </div>
              ) : isBondOnly ? (
                <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 flex flex-col gap-1 text-xs">
                  <span className="font-bold text-indigo-800 dark:text-indigo-300">
                    Bond Principal Repayment / Principal Back
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Principal returned reduces your total invested cost and average unit price without redeeming units. Units stay in your portfolio.
                  </p>
                </div>
              ) : null}

              {isBondOnly ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Principal Returned Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-sm"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Gold Units Redeemed (Grams)
                      </label>
                      <button
                        type="button"
                        onClick={() => setQuantity(holding.quantity.toString())}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        All ({holding.quantity}g)
                      </button>
                    </div>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      max={holding.quantity}
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      RBI Gold Redemption Rate (₹/g)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder={(holding.currentPrice || 7480).toString()}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Total Capital Returned</span>
                <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {formatINR(isBondOnly ? parsedPrice : parsedQty * parsedPrice)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Receiving Bank Account
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  {accounts
                    .filter((a) => !a.isSystemDebtAccount && a.type !== 'debt')
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatINR(acc.balance)})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* STOCK SPLIT MODE */}
          {isSplit && (
            <div className="space-y-4">
              {/* Split Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Split Ratio Preset
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: '1:2', label: '1 : 2 (Double)' },
                    { id: '1:5', label: '1 : 5' },
                    { id: '1:10', label: '1 : 10' },
                    { id: 'custom', label: 'Custom' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSplitPresetChange(p.id as any)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        splitPreset === p.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Split Ratio Inputs */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Every [Old Shares]
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={splitOldShares}
                    onChange={(e) => {
                      setSplitOldShares(e.target.value);
                      setSplitPreset('custom');
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Becomes [New Shares]
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={splitNewShares}
                    onChange={(e) => {
                      setSplitNewShares(e.target.value);
                      setSplitPreset('custom');
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-sm"
                  />
                </div>
              </div>

              {/* Split Real-time Impact Preview */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/50 to-slate-50 dark:from-indigo-950/20 dark:to-slate-800/50 border border-indigo-200/60 dark:border-indigo-800/50 space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-indigo-600 dark:text-indigo-400 block">
                  Post-Split Portfolio Impact Preview
                </span>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">New Total Shares</span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {formatNumber(postSplitQuantity)} shares
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">
                      (+{additionalSplitShares} shares created)
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block">Adjusted Avg Buy Price</span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {formatINR(postSplitAvgPrice)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      (Reduced from {formatINR(holding.averageBuyPrice)})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BONUS SHARES MODE */}
          {isBonus && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Bonus Ratio Preset
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: '1:1', label: '1 : 1' },
                    { id: '1:2', label: '1 : 2' },
                    { id: '2:1', label: '2 : 1' },
                    { id: 'direct', label: 'Direct Shares' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleBonusPresetChange(p.id as any)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        bonusPreset === p.id
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {bonusPreset === 'direct' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Exact Bonus Shares Credited
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={bonusDirectShares}
                    onChange={(e) => setBonusDirectShares(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-sm"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Bonus Shares [Received]
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={bonusA}
                      onChange={(e) => {
                        setBonusA(e.target.value);
                        setBonusPreset('custom');
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Per Existing Shares [Held]
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={bonusB}
                      onChange={(e) => {
                        setBonusB(e.target.value);
                        setBonusPreset('custom');
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/50 to-slate-50 dark:from-purple-950/20 dark:to-slate-800/50 border border-purple-200/60 dark:border-purple-800/50 space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-purple-600 dark:text-purple-400 block">
                  Post-Bonus Portfolio Impact Preview
                </span>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Bonus Shares Received</span>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{bonusSharesReceived} shares
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      New Total: {formatNumber(postBonusTotalQuantity)} shares
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block">Adjusted Avg Buy Price</span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {formatINR(postBonusAvgPrice)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      (Reduced from {formatINR(holding.averageBuyPrice)})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MULTI-SHARE DEMERGER / SPINOFF MODE */}
          {isDemerger && (
            <div className="space-y-4">
              {/* Demerger Structure & Parent Status Selector */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Demerger Structure & Parent Company Status
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Choose how {holding.symbol} is handled
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDemergerOutcome('keep_original');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      demergerOutcome === 'keep_original'
                        ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-500 text-sky-950 dark:text-sky-100 ring-2 ring-sky-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs flex items-center gap-1.5">
                        <span>🏢</span> Original Company Remains
                      </span>
                      {demergerOutcome === 'keep_original' && (
                        <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-85">
                      Parent ({holding.symbol}) stays active in portfolio with reduced acquisition cost. Spinoff entities are added alongside it.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDemergerOutcome('extinguish_original');
                      handleAutoBalanceCost(100);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      demergerOutcome === 'extinguish_original'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-950 dark:text-amber-100 ring-2 ring-amber-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs flex items-center gap-1.5">
                        <span>🔄</span> All New Companies Created
                      </span>
                      {demergerOutcome === 'extinguish_original' && (
                        <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-85">
                      Full split-up / demerger: Original ({holding.symbol}) does NOT remain (extinguished/replaced by the new entities).
                    </p>
                  </button>
                </div>
              </div>

              {/* Preset Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Demerger Scheme Presets
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAutoBalanceCost(demergerOutcome === 'extinguish_original' ? 100 : 80)}
                    className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    Auto-Balance Cost ({demergerOutcome === 'extinguish_original' ? '100%' : '80%'})
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'single', label: 'Single Spinoff', sub: '1 New Stock' },
                    { id: 'tatamotors_2', label: 'Tata Motors 2-Way', sub: 'CV & PV (50% / 50%)' },
                    { id: 'vedanta_5', label: 'Vedanta 5-Way', sub: '5 Spinoff Entities' },
                    { id: 'custom', label: 'Custom Spinoff', sub: 'Manual Ratio & Cost' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleDemergerPresetChange(p.id as any)}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        demergerPreset === p.id
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block text-xs font-bold leading-tight">{p.label}</span>
                      <span className={`block text-[10px] mt-0.5 ${demergerPreset === p.id ? 'text-sky-100' : 'text-slate-400'}`}>
                        {p.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of Demerged Shares Selector */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Number of Spinoff Stocks Created
                  </span>
                  <span className="text-[10px] text-slate-400">
                    How many different company stocks are being spun off from {holding.symbol}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={demergedEntities.length <= 1}
                    onClick={() => handleRemoveDemergedEntity(demergedEntities.length - 1)}
                    className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                    {demergedEntities.length}
                  </span>
                  <button
                    type="button"
                    disabled={demergedEntities.length >= 10}
                    onClick={handleAddDemergedEntity}
                    className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Individual Spinoff Stock Cards */}
              <div className="space-y-3">
                {demergedCalculations.map((entity, idx) => (
                  <div
                    key={entity.id}
                    className="p-3.5 bg-white dark:bg-slate-900/90 rounded-2xl border border-sky-200/80 dark:border-sky-900/50 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-lg bg-sky-600 text-white font-extrabold text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-sky-800 dark:text-sky-300">
                          Spinoff Stock #{idx + 1}
                        </span>
                      </div>
                      {demergedEntities.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDemergedEntity(idx)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                          title="Remove this spinoff stock"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Stock Symbol
                        </label>
                        <input
                          type="text"
                          required
                          value={entity.symbol}
                          onChange={(e) =>
                            handleUpdateDemergedEntity(idx, { symbol: e.target.value.toUpperCase() })
                          }
                          placeholder={`e.g. ${holding.symbol}-SPIN`}
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs uppercase text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Company Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={entity.name}
                          onChange={(e) => handleUpdateDemergedEntity(idx, { name: e.target.value })}
                          placeholder="e.g. Spinoff Limited"
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Entitlement Ratio & Cost Allocation */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Ratio: Every [Parent Held]
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={entity.ratioB}
                          onChange={(e) => handleUpdateDemergedEntity(idx, { ratioB: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Entitles [Spinoff Shares]
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={entity.ratioA}
                          onChange={(e) => handleUpdateDemergedEntity(idx, { ratioA: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-xs"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Cost Allocation (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0.1"
                            max="100"
                            value={entity.costAllocPct}
                            onChange={(e) =>
                              handleUpdateDemergedEntity(idx, { costAllocPct: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 pr-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-xs"
                          />
                          <span className="absolute right-2 top-1.5 text-slate-400 font-bold text-[10px]">%</span>
                        </div>
                      </div>
                    </div>

                    {/* Live Calculated Average Price & Allotment Box */}
                    <div className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                          Shares Allotted:
                        </span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +{entity.allottedShares} shares
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                          Allocated Cost ({entity.costPct}%):
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                          {formatINR(entity.allocatedCost)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-sky-700 dark:text-sky-300 block font-semibold">
                          Calculated Avg Buy Price:
                        </span>
                        <span className="font-extrabold text-sky-700 dark:text-sky-300 tabular-nums">
                          {formatINR(entity.calculatedAvgBuyPrice)} / share
                        </span>
                        <span className="text-[9px] text-slate-400 block">
                          ({formatINR(entity.allocatedCost)} ÷ {entity.allottedShares} sh)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {demergedEntities.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddDemergedEntity}
                  className="w-full py-2 px-3 border border-dashed border-sky-300 dark:border-sky-800 hover:border-sky-500 rounded-2xl text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50/50 dark:hover:bg-sky-950/30 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Spinoff Stock</span>
                </button>
              )}

              {/* Capital Conservation Summary */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-50/60 to-slate-50 dark:from-sky-950/20 dark:to-slate-800/50 border border-sky-200/80 dark:border-sky-800/50 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    Post-Demerger Capital Apportionment
                  </span>
                  <span
                    className={`font-extrabold tabular-nums px-2 py-0.5 rounded-md text-[10px] ${
                      totalDemergerCostPct > 100
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {totalDemergerCostPct.toFixed(1)}% Spinoff Cost · {retainedParentCostPct.toFixed(1)}% Retained
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className={`p-2.5 rounded-xl border space-y-1 ${
                    demergerOutcome === 'extinguish_original'
                      ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                      : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/70 dark:border-slate-800'
                  }`}>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                      {holding.symbol} (Parent)
                    </span>
                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>Status:</span>
                      <span className={`font-bold tabular-nums ${demergerOutcome === 'extinguish_original' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {demergerOutcome === 'extinguish_original' ? 'Extinguished' : 'Retained'}
                      </span>
                    </div>
                    {demergerOutcome === 'keep_original' ? (
                      <div className="text-[11px] text-slate-500 flex justify-between">
                        <span>New Avg Price:</span>
                        <span className="font-bold tabular-nums text-slate-800 dark:text-slate-200">
                          {formatINR(postDemergerParentAvgBuyPrice)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                        Replaced by {demergedEntities.length} new stocks
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-sky-200/70 dark:border-sky-900/50 space-y-1">
                    <span className="font-bold text-sky-700 dark:text-sky-300 block truncate">
                      {demergedEntities.length} Spinoff Stocks
                    </span>
                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>Total Allotted:</span>
                      <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        +{totalDemergedSharesAllotted} sh
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>Total Cost Allocated:</span>
                      <span className="font-bold tabular-nums text-slate-800 dark:text-slate-200">
                        {totalDemergerCostPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {totalDemergerCostPct > 100 && (
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300 font-bold">
                    Warning: Total cost allocation ({totalDemergerCostPct}%) exceeds 100%. Please adjust percentages.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DIVIDEND / IDCW PAYOUT MODE */}
          {isDividend && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Total Dividend Amount Received (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 1250"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Deposit / Credit Into Bank Account
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  {accounts
                    .filter((a) => !a.isSystemDebtAccount && a.type !== 'debt')
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} {acc.isArchived ? '[Archived] ' : ''}({formatINR(acc.balance)})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* BUY / SELL STANDARD INPUTS (Available when Buy/Sell active) */}
          {(isBuy || isSell) && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={isPf ? 'sm:col-span-2' : ''}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isPf
                        ? isBuy
                          ? 'Contribution Amount (₹)'
                          : 'Withdrawal / Claim Amount (₹)'
                        : isSgb
                        ? isBuy
                          ? 'Gold Units to Purchase (Grams)'
                          : 'Gold Units to Redeem (Grams)'
                        : isBondOnly
                        ? isBuy
                          ? 'Bond Units to Buy'
                          : 'Bond Units to Sell'
                        : isMF
                        ? isBuy
                          ? 'Investment Amount (₹)'
                          : 'Units to Redeem'
                        : isBuy
                        ? 'Shares to Buy'
                        : 'Shares to Sell'}
                    </label>
                    {isSell && (
                      <button
                        type="button"
                        onClick={() => setQuantity(holding.quantity.toString())}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        All ({isPf ? formatINR(holding.quantity) : holding.quantity}{isSgb ? 'g' : ''})
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    max={!isBuy ? holding.quantity : undefined}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={
                      isPf
                        ? 'e.g. 12500'
                        : isSgb
                        ? 'e.g. 5'
                        : isSell
                        ? `Max: ${holding.quantity}`
                        : 'e.g. 10'
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-sm"
                  />
                </div>

                {!isPf && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isSgb
                        ? 'Gold Price per Gram (₹/g)'
                        : isBondOnly
                        ? 'Clean Price per Unit (₹)'
                        : isMF
                        ? isBuy
                          ? 'Purchase NAV (₹)'
                          : 'Redemption NAV (₹)'
                        : 'Execution Price (₹)'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder={isSgb ? (holding.currentPrice || 7480).toString() : 'e.g. 100'}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-bold text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Trade Gross & Net Impact Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Trade Gross Amount</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {formatINR(totalAmount, true)}
                  </span>
                </div>

                {isStock && stockCharges && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {isBuy ? 'Total Cash Outflow' : 'Net Cash Inflow'}
                    </span>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatINR(stockCharges.netCashImpact, true)}
                    </span>
                  </div>
                )}

                {isMF && mfCharges && isBuy && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-medium">Units to Allot</span>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatNumber(mfCharges.unitsAllotted)} units
                    </span>
                  </div>
                )}
              </div>

              {/* STATUTORY TAXES & CHARGES SECTION (Indian Market Regulations) */}
              {(stockCharges || mfCharges) && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Statutory Charges & Taxes
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                        ₹{activeStatutoryCharges.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFeeBreakdown(!showFeeBreakdown)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                        title="Toggle Detailed Breakdown"
                      >
                        {showFeeBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Real-time Badge */}
                  {activeStatutoryCharges > 0 && logChargesAsExpense && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                      <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>
                        ⚡ ₹{activeStatutoryCharges.toFixed(2)} will be recorded as an expense under &apos;Investment Charges & Taxes&apos;
                      </span>
                    </div>
                  )}

                  {/* Collapsible Fee Breakdown Card */}
                  {showFeeBreakdown && isStock && stockCharges && (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-[11px]">
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span>STT (Securities Transaction Tax 0.1%):</span>
                        <span className="font-semibold tabular-nums">₹{stockCharges.stt.toFixed(2)}</span>
                      </div>
                      {isBuy && (
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                          <span>Stamp Duty (0.015% on Buy):</span>
                          <span className="font-semibold tabular-nums">₹{stockCharges.stampDuty.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span>Exchange Turnover Fee (~0.00297%):</span>
                        <span className="font-semibold tabular-nums">₹{stockCharges.exchangeFee.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span>SEBI Turnover Charge (0.0001%):</span>
                        <span className="font-semibold tabular-nums">₹{stockCharges.sebiFee.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span>GST (18% on fees):</span>
                        <span className="font-semibold tabular-nums">₹{stockCharges.gst.toFixed(2)}</span>
                      </div>
                      {isSell && (
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                          <span>CDSL DP Charges:</span>
                          <span className="font-semibold tabular-nums">₹15.93</span>
                        </div>
                      )}
                      {stockCharges.breakEvenPrice !== undefined && stockCharges.breakEvenPrice > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400">
                          <span>Break-Even Sell Price:</span>
                          <span className="tabular-nums">₹{stockCharges.breakEvenPrice.toFixed(2)} / share</span>
                        </div>
                      )}
                    </div>
                  )}

                  {showFeeBreakdown && isMF && mfCharges && (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-[11px]">
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span>Stamp Duty (0.005% deducted before allotment):</span>
                        <span className="font-semibold tabular-nums">₹{mfCharges.stampDuty.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span>Net Invested in Units:</span>
                        <span className="font-semibold tabular-nums">₹{mfCharges.netInvestedAmount.toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                        XIRR Outflow Rule: Full gross investment amount (-₹{mfCharges.grossAmount.toFixed(2)}) is debited from bank.
                      </div>
                    </div>
                  )}

                  {/* Dual-Write Expense Toggle */}
                  <label className="flex items-center justify-between cursor-pointer pt-1">
                    <div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                        Log statutory charges as expense
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Automatically entries into passbook under &apos;Investment Charges & Taxes&apos;
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={logChargesAsExpense}
                      onChange={(e) => setLogChargesAsExpense(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </label>
                </div>
              )}

              {/* SETTLEMENT BANK & DEMAT ACCOUNT INTEGRATION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isBuy ? 'Funding Bank Account (Debit)' : 'Settlement Bank Account (Credit)'}
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-medium"
                  >
                    {accounts
                      .filter((a) => !a.isSystemDebtAccount && a.type !== 'debt' && a.type !== 'demat')
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({formatINR(acc.balance)}) - {acc.type.toUpperCase()}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isBuy ? 'Target Demat Account (Credit)' : 'Source Demat Account (Debit)'}
                  </label>
                  <select
                    value={targetDematAccountId}
                    onChange={(e) => setTargetDematAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-medium"
                  >
                    {accounts
                      .filter((a) => a.type === 'demat')
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({formatINR(acc.balance)})
                        </option>
                      ))}
                    {accounts.filter((a) => a.type === 'demat').length === 0 && (
                      <option value="">No Demat Account Found</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Transfer Flow Pill */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-xs">
                <ArrowRightLeft className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-purple-900 dark:text-purple-200">
                    {isBuy ? (
                      <>Transfer: <span className="underline">{accounts.find((a) => a.id === accountId)?.name || 'Bank'}</span> ➔ <span className="underline">{accounts.find((a) => a.id === targetDematAccountId)?.name || 'Demat'}</span></>
                    ) : (
                      <>Transfer: <span className="underline">{accounts.find((a) => a.id === targetDematAccountId)?.name || 'Demat'}</span> ➔ <span className="underline">{accounts.find((a) => a.id === accountId)?.name || 'Bank'}</span></>
                    )}
                  </span>
                  <p className="text-[10px] text-purple-600/90 dark:text-purple-300">
                    Bank-to-Demat transfer recorded directly to passbook. Demat account balance tracks current market values.
                  </p>
                </div>
              </div>

              {/* Sell: Profit & Loss Categorization Options */}
              {isSell && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                    <div className="pr-2">
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                        Categorize Booked Profit as Income
                      </span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block">
                        Records net realized capital gains under &apos;Capital Gains&apos; income category
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={categorizeProfitAsIncome}
                      onChange={(e) => setCategorizeProfitAsIncome(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
                    <div className="pr-2">
                      <span className="text-xs font-bold text-rose-900 dark:text-rose-200 block">
                        Categorize Booked Loss as Expense
                      </span>
                      <span className="text-[10px] text-rose-700 dark:text-rose-300 block">
                        Records net realized capital loss under &apos;Investment Loss&apos; expense category
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={categorizeLossAsExpense}
                      onChange={(e) => setCategorizeLossAsExpense(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Accounting Classification Toggle */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Record as Account Transfer
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      {asTransfer
                        ? 'Treated as asset transfer between bank and Demat (does not inflate expenses)'
                        : `Treated as direct ${isBuy ? 'Expense' : 'Income'} in monthly reports`}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={asTransfer}
                    onChange={(e) => setAsTransfer(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </label>
              </div>
            </>
          )}

          {/* Date & Note Fields (common to all actions, with strict past/present validation) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Execution / Ex-Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Note / Memo
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  isSplit
                    ? 'e.g. Stock Split 1:2'
                    : isBonus
                    ? 'e.g. Bonus 1:1 issue'
                    : isInterest
                    ? 'e.g. Q3 Semi-Annual Coupon'
                    : isPrincipalRepayment
                    ? 'e.g. Final maturity redemption'
                    : isDividend
                    ? 'e.g. Interim Dividend'
                    : 'e.g. Zerodha trade'
                }
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 text-white font-semibold rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer ${
                isBuy
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : isInterest
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : isPrincipalRepayment
                  ? 'bg-indigo-600 hover:bg-indigo-500'
                  : isDividend
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : isSplit
                  ? 'bg-indigo-600 hover:bg-indigo-500'
                  : isBonus
                  ? 'bg-purple-600 hover:bg-purple-500'
                  : isDemerger
                  ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/20'
                  : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              {isBuy
                ? 'Confirm Purchase'
                : isInterest
                ? 'Record Coupon Interest'
                : isPrincipalRepayment
                ? 'Record Principal Returned'
                : isDividend
                ? 'Record Dividend (Credit Income)'
                : isSplit
                ? `Execute Split (${postSplitQuantity} Total Shares)`
                : isBonus
                ? `Credit Bonus (+${bonusSharesReceived} Shares)`
                : isDemerger
                ? `Execute Demerger (${demergedEntities.length} Spinoff ${demergedEntities.length === 1 ? 'Stock' : 'Stocks'})`
                : 'Confirm Sale'}
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body
  );
};
