import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { InvestmentAssetType, InvestmentHolding, PfType, BondType, HoldingSubscription, InvestmentTransaction } from '../../types';
import { toInputDate, formatINR } from '../../utils/formatters';
import { searchAmfiSchemes, fetchSchemeLatestNav, POPULAR_MF_SCHEMES } from '../../utils/amfiSipEngine';
import { searchOfflineStocks, OFFLINE_STOCK_DIRECTORY, OfflineStockItem } from '../../data/offlineStockDirectory';
import { compressImageThumbnail } from '../../services/imageCompression';
import { AmfiFundConfirmModal, AmfiCandidateScheme } from './AmfiFundConfirmModal';
import {
  DEFAULT_SGB_GOLD_PRICE,
  DEFAULT_SGB_PRICE_DATE,
  DEFAULT_SGB_GOLD_SOURCE,
  STANDARD_SGB_COUPON_RATE,
} from '../../utils/bondsSgbPfEngine';
import {
  X,
  ArrowLeft,
  Check,
  Trash2,
  Camera,
  Search,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Coins,
  TrendingUp,
  Calendar,
  Landmark,
  ArrowRightLeft,
} from 'lucide-react';

interface HoldingModalProps {
  initialHolding?: InvestmentHolding | null;
  defaultAssetType?: InvestmentAssetType;
  isOpen: boolean;
  onClose: () => void;
}

export const HoldingModal: React.FC<HoldingModalProps> = ({
  initialHolding,
  defaultAssetType,
  isOpen,
  onClose,
}) => {
  const { addHolding, updateHolding, deleteHolding, accounts } = useApp();

  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [customDisplayName, setCustomDisplayName] = useState('');
  const [assetType, setAssetType] = useState<InvestmentAssetType>('stock');
  const [dematAccountId, setDematAccountId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [averageBuyPrice, setAverageBuyPrice] = useState('100');
  const [purchaseDate, setPurchaseDate] = useState<string>(() => toInputDate(new Date()));
  const [currentPrice, setCurrentPrice] = useState('100');
  const [previousClosePrice, setPreviousClosePrice] = useState('');
  const [notes, setNotes] = useState('');
  const [customAvatar, setCustomAvatar] = useState<string | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Transfer integration state (Debits bank account and credits Demat account)
  const [isTransfer, setIsTransfer] = useState<boolean>(true);
  const [fundingBankAccountId, setFundingBankAccountId] = useState<string>(() => {
    const defaultBank = accounts.find((a) => (a.type === 'bank' || a.type === 'cash') && !a.isArchived) || accounts[0];
    return defaultBank ? defaultBank.id : '';
  });

  // AMFI Scheme Linking
  const [amfiSchemeCode, setAmfiSchemeCode] = useState<string>('');
  const [amfiSchemeName, setAmfiSchemeName] = useState<string>('');
  const [amfiSearchQuery, setAmfiSearchQuery] = useState('');
  const [amfiSearchResults, setAmfiSearchResults] = useState<
    Array<{ schemeCode: string; schemeName: string; nav?: number; planType?: 'Direct' | 'Regular'; optionType?: 'Growth' | 'IDCW' }>
  >([]);
  const [isSearchingAmfi, setIsSearchingAmfi] = useState(false);
  const [pendingSchemeForConfirm, setPendingSchemeForConfirm] = useState<AmfiCandidateScheme | null>(null);
  const [schemeFilter, setSchemeFilter] = useState<'all' | 'direct' | 'regular' | 'growth'>('direct');
  const [isVerified, setIsVerified] = useState(false);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);

  // Bond Specific Parameters
  const [bondType, setBondType] = useState<BondType>('corporate');
  const [issuer, setIssuer] = useState<string>('');
  const [isin, setIsin] = useState<string>('');
  const [couponRate, setCouponRate] = useState<string>('');
  const [couponFrequency, setCouponFrequency] = useState<'monthly' | 'quarterly' | 'semi_annually' | 'annually' | 'at_maturity'>('semi_annually');
  const [maturityDate, setMaturityDate] = useState<string>('');
  const [faceValue, setFaceValue] = useState<string>('1000');
  const [ytm, setYtm] = useState<string>('');

  // SGB Specific Parameters
  const [trancheSeries, setTrancheSeries] = useState<string>('');
  const [rbiIssuePrice, setRbiIssuePrice] = useState<string>('6263');
  const [goldReferencePrice, setGoldReferencePrice] = useState<string>(DEFAULT_SGB_GOLD_PRICE.toString());
  const [prematureRedemptionDate, setPrematureRedemptionDate] = useState<string>('');

  const [stockSearchQuery, setStockSearchQuery] = useState('');

  // Provident Fund (PF) & Monthly Subscription Parameters
  const [pfType, setPfType] = useState<PfType>('EPF');
  const [uanOrAccountNumber, setUanOrAccountNumber] = useState('');
  const [interestRate, setInterestRate] = useState('8.25');
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [subscriptionAmount, setSubscriptionAmount] = useState('5000');
  const [subscriptionEmployerAmount, setSubscriptionEmployerAmount] = useState('5000');
  const [subscriptionDay, setSubscriptionDay] = useState('5');
  const [subscriptionAccountId, setSubscriptionAccountId] = useState('');
  const [subscriptionNotes, setSubscriptionNotes] = useState('');
  const [backfillMonths, setBackfillMonths] = useState('0');

  useEffect(() => {
    if (initialHolding) {
      setSymbol(initialHolding.symbol);
      setName(initialHolding.name);
      setCustomDisplayName(initialHolding.customDisplayName || '');
      setAssetType(initialHolding.assetType);
      setDematAccountId(initialHolding.dematAccountId);
      setQuantity(initialHolding.quantity.toString());
      setAverageBuyPrice(initialHolding.averageBuyPrice.toString());
      setPurchaseDate(
        initialHolding.purchaseDate ||
        (initialHolding.transactions && initialHolding.transactions.length > 0 ? initialHolding.transactions[0].date : '') ||
        toInputDate(new Date())
      );
      setCurrentPrice((initialHolding.currentPrice || initialHolding.averageBuyPrice).toString());
      setPreviousClosePrice(initialHolding.previousClosePrice ? initialHolding.previousClosePrice.toString() : '');
      setNotes(initialHolding.notes || '');
      setCustomAvatar(initialHolding.customAvatar);
      setAmfiSchemeCode(initialHolding.amfiSchemeCode || '');
      setAmfiSchemeName(initialHolding.amfiSchemeName || '');
      setIsVerified(Boolean(initialHolding.isVerified));
      setRequiresConfirmation(Boolean(initialHolding.requiresConfirmation));
      setBondType(initialHolding.bondType || 'corporate');
      setIssuer(initialHolding.issuer || '');
      setIsin(initialHolding.isin || '');
      setCouponRate(initialHolding.couponRate !== undefined ? initialHolding.couponRate.toString() : '');
      setCouponFrequency(initialHolding.couponFrequency || 'semi_annually');
      setMaturityDate(initialHolding.maturityDate || '');
      setFaceValue(initialHolding.faceValue !== undefined ? initialHolding.faceValue.toString() : '1000');
      setYtm(initialHolding.ytm !== undefined ? initialHolding.ytm.toString() : '');
      setTrancheSeries(initialHolding.trancheSeries || '');
      setRbiIssuePrice(initialHolding.rbiIssuePrice !== undefined ? initialHolding.rbiIssuePrice.toString() : '6263');
      setGoldReferencePrice(initialHolding.goldReferencePrice !== undefined ? initialHolding.goldReferencePrice.toString() : DEFAULT_SGB_GOLD_PRICE.toString());
      setPrematureRedemptionDate(initialHolding.prematureRedemptionDate || '');
      setPfType(initialHolding.pfType || 'EPF');
      setUanOrAccountNumber(initialHolding.uanOrAccountNumber || '');
      setInterestRate(initialHolding.interestRate !== undefined ? initialHolding.interestRate.toString() : (initialHolding.assetType === 'pf' ? '8.25' : ''));
      setSubscriptionEnabled(Boolean(initialHolding.subscription?.enabled));
      setSubscriptionAmount(initialHolding.subscription?.amount !== undefined ? initialHolding.subscription.amount.toString() : '5000');
      setSubscriptionEmployerAmount(initialHolding.subscription?.employerAmount !== undefined ? initialHolding.subscription.employerAmount.toString() : '0');
      setSubscriptionDay(initialHolding.subscription?.dayOfMonth !== undefined ? initialHolding.subscription.dayOfMonth.toString() : '5');
      setSubscriptionAccountId(initialHolding.subscription?.fromAccountId || '');
      setSubscriptionNotes(initialHolding.subscription?.notes || '');
      setBackfillMonths('0');
      setIsTransfer(false);
    } else {
      const targetType = defaultAssetType || 'stock';
      setAssetType(targetType);
      const defaultDemat = accounts.find((a) => a.type === 'demat' && !a.isArchived) || accounts.find((a) => a.type === 'demat') || accounts[0];
      setDematAccountId(defaultDemat ? defaultDemat.id : '');
      const defaultBank = accounts.find((a) => (a.type === 'bank' || a.type === 'cash') && !a.isArchived) || accounts[0];
      setFundingBankAccountId(defaultBank ? defaultBank.id : '');
      setIsTransfer(true);
      setCustomDisplayName('');
      setNotes('');
      setCustomAvatar(undefined);
      setAmfiSchemeCode('');
      setAmfiSchemeName('');
      setIsVerified(false);
      setRequiresConfirmation(false);
      setSubscriptionAccountId(accounts[0]?.id || '');
      setSubscriptionNotes('');
      setBackfillMonths('0');

      if (targetType === 'sgb') {
        setSymbol('SGB 2023-24 IV');
        setName('Sovereign Gold Bonds 2023-24 Series IV');
        setTrancheSeries('2023-24 Series IV');
        setQuantity('5'); // 5 Grams
        setAverageBuyPrice('6263'); // RBI Issue Price
        setCurrentPrice(DEFAULT_SGB_GOLD_PRICE.toString()); // Reference gold price
        setPreviousClosePrice((DEFAULT_SGB_GOLD_PRICE - 40).toString());
        setPurchaseDate(toInputDate(new Date()));
        setRbiIssuePrice('6263');
        setGoldReferencePrice(DEFAULT_SGB_GOLD_PRICE.toString());
        setCouponRate(STANDARD_SGB_COUPON_RATE.toString());
        setCouponFrequency('semi_annually');
        const now = new Date();
        const mat = new Date(now.getFullYear() + 8, now.getMonth(), now.getDate());
        const prem = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate());
        setMaturityDate(toInputDate(mat));
        setPrematureRedemptionDate(toInputDate(prem));
        setFaceValue('6263');
        setBondType('g_sec');
        setIssuer('Reserve Bank of India (RBI)');
        setIsin('');
        setYtm('');
        setPfType('EPF');
        setUanOrAccountNumber('');
        setInterestRate('2.50');
        setSubscriptionEnabled(false);
        setSubscriptionAmount('5000');
        setSubscriptionEmployerAmount('0');
        setSubscriptionDay('5');
      } else if (targetType === 'bond') {
        setSymbol('7.18% GS 2033');
        setName('7.18% Government of India Security 2033');
        setBondType('g_sec');
        setIssuer('Reserve Bank of India / Govt of India');
        setIsin('IN0020230085');
        setQuantity('100');
        setAverageBuyPrice('100');
        setCurrentPrice('100.25');
        setPreviousClosePrice('100.10');
        setPurchaseDate(toInputDate(new Date()));
        setFaceValue('100');
        setCouponRate('7.18');
        setCouponFrequency('semi_annually');
        setYtm('7.15');
        const now = new Date();
        const mat = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
        setMaturityDate(toInputDate(mat));
        setTrancheSeries('');
        setRbiIssuePrice('');
        setGoldReferencePrice('');
        setPrematureRedemptionDate('');
        setPfType('EPF');
        setUanOrAccountNumber('');
        setInterestRate('7.18');
        setSubscriptionEnabled(false);
        setSubscriptionAmount('5000');
        setSubscriptionEmployerAmount('0');
        setSubscriptionDay('5');
      } else if (targetType === 'pf') {
        setSymbol('EPF');
        setName('EPFO - Employees Provident Fund');
        setPfType('EPF');
        setQuantity('250000'); // Initial corpus balance
        setAverageBuyPrice('1');
        setCurrentPrice('1');
        setPreviousClosePrice('1');
        setPurchaseDate(toInputDate(new Date()));
        setInterestRate('8.25');
        setUanOrAccountNumber('');
        setSubscriptionEnabled(true);
        setSubscriptionAmount('15000'); // Employee share
        setSubscriptionEmployerAmount('15000'); // Employer match
        setSubscriptionDay('5');
        setBondType('corporate');
        setIssuer('');
        setIsin('');
        setCouponRate('');
        setCouponFrequency('semi_annually');
        setMaturityDate('');
        setFaceValue('');
        setYtm('');
        setTrancheSeries('');
        setRbiIssuePrice('');
        setGoldReferencePrice('');
        setPrematureRedemptionDate('');
      } else {
        setSymbol('');
        setName('');
        setQuantity('10');
        setAverageBuyPrice('1000');
        setPurchaseDate(toInputDate(new Date()));
        setCurrentPrice('1000');
        setPreviousClosePrice('');
        setCouponRate('');
        setCouponFrequency('semi_annually');
        setMaturityDate('');
        setFaceValue('1000');
        setBondType('corporate');
        setIssuer('');
        setIsin('');
        setYtm('');
        setTrancheSeries('');
        setRbiIssuePrice('');
        setGoldReferencePrice('');
        setPrematureRedemptionDate('');
        setPfType('EPF');
        setUanOrAccountNumber('');
        setInterestRate('8.25');
        setSubscriptionEnabled(false);
        setSubscriptionAmount('5000');
        setSubscriptionEmployerAmount('5000');
        setSubscriptionDay('5');
      }
    }
    setAmfiSearchQuery('');
    setAmfiSearchResults([]);
    setStockSearchQuery('');
  }, [initialHolding, isOpen, accounts]);

  const parsedTotalCost = useMemo(() => {
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(averageBuyPrice) || 0;
    return Number((q * p).toFixed(2));
  }, [quantity, averageBuyPrice]);

  // Debounced AMFI scheme search
  useEffect(() => {
    if (assetType !== 'mutual_fund') {
      setAmfiSearchResults([]);
      return;
    }

    if (!amfiSearchQuery.trim() || amfiSearchQuery.trim().length < 2) {
      setAmfiSearchResults([]);
      return;
    }

    let isMounted = true;
    setIsSearchingAmfi(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchAmfiSchemes(amfiSearchQuery);
        if (isMounted) {
          setAmfiSearchResults(results);
        }
      } catch {
        if (isMounted) setAmfiSearchResults([]);
      } finally {
        if (isMounted) setIsSearchingAmfi(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [amfiSearchQuery, assetType]);

  const filteredAmfiResults = useMemo(() => {
    if (schemeFilter === 'all') return amfiSearchResults;
    return amfiSearchResults.filter((res) => {
      const isRegular = res.planType === 'Regular' || res.schemeName.toLowerCase().includes('regular');
      const isDirect = !isRegular || res.planType === 'Direct';
      const isIdcw = res.optionType === 'IDCW' || res.schemeName.toLowerCase().includes('idcw') || res.schemeName.toLowerCase().includes('dividend');
      const isGrowth = !isIdcw || res.optionType === 'Growth';

      if (schemeFilter === 'direct') return isDirect;
      if (schemeFilter === 'regular') return isRegular;
      if (schemeFilter === 'growth') return isGrowth;
      return true;
    });
  }, [amfiSearchResults, schemeFilter]);

  // 100% Offline Stock & ETF search matches
  const offlineStockMatches = useMemo(() => {
    if (assetType !== 'stock') return [];
    const q = stockSearchQuery.trim() || symbol.trim() || name.trim();
    if (!q || q.length < 1) return [];
    return searchOfflineStocks(q, 6);
  }, [assetType, stockSearchQuery, symbol, name]);

  const handleSelectOfflineStock = (item: OfflineStockItem) => {
    setSymbol(item.symbol);
    setName(item.name);
    if (!currentPrice || currentPrice === '100' || currentPrice === '1000' || currentPrice === '0') {
      setCurrentPrice(item.referencePrice.toString());
    }
    if (!averageBuyPrice || averageBuyPrice === '100' || averageBuyPrice === '1000' || averageBuyPrice === '0') {
      setAverageBuyPrice(item.referencePrice.toString());
    }
    setStockSearchQuery('');
  };

  const handlePickScheme = (scheme: {
    schemeCode?: string;
    code?: string;
    schemeName?: string;
    name?: string;
    nav?: number;
    planType?: 'Direct' | 'Regular';
    optionType?: 'Growth' | 'IDCW';
  }) => {
    const code = scheme.schemeCode || scheme.code || '';
    const name = scheme.schemeName || scheme.name || '';
    setPendingSchemeForConfirm({
      schemeCode: code,
      schemeName: name,
      nav: scheme.nav,
      planType: scheme.planType,
      optionType: scheme.optionType,
    });
  };

  const applyConfirmedScheme = async (scheme: AmfiCandidateScheme) => {
    const code = scheme.schemeCode;
    const name = scheme.schemeName;
    setAmfiSchemeCode(code);
    setAmfiSchemeName(name);
    setSymbol(code);
    setName(name);

    // Set scheme metadata and initialize default average buy price if needed
    if (scheme.nav && scheme.nav > 0) {
      if (!initialHolding || averageBuyPrice === '100' || averageBuyPrice === '1000' || !averageBuyPrice) {
        setAverageBuyPrice(scheme.nav.toString());
      }
      setCurrentPrice(scheme.nav.toString());
    } else {
      setIsSearchingAmfi(true);
      const navRecord = await fetchSchemeLatestNav(code, true);
      setIsSearchingAmfi(false);
      if (navRecord && navRecord.nav > 0) {
        if (!initialHolding || averageBuyPrice === '100' || averageBuyPrice === '1000' || !averageBuyPrice) {
          setAverageBuyPrice(navRecord.nav.toString());
        }
        setCurrentPrice(navRecord.nav.toString());
      }
    }

    setAmfiSearchQuery('');
    setAmfiSearchResults([]);
    setPendingSchemeForConfirm(null);
    setIsVerified(true);
    setRequiresConfirmation(false);
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageThumbnail(file, { maxWidth: 100, maxHeight: 100, quality: 0.85 });
      if (compressed) {
        setCustomAvatar(compressed);
      }
    } catch (err) {
      console.warn('Failed to compress avatar thumbnail', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() || !name.trim()) return;

    const parsedQty = parseFloat(quantity) || 0;
    const parsedAvgPrice = parseFloat(averageBuyPrice) || 0;
    const parsedCurrentPrice = parseFloat(currentPrice);
    const parsedPrevPrice = parseFloat(previousClosePrice);

    const parsedCoupon = parseFloat(couponRate);
    const parsedFaceVal = parseFloat(faceValue);
    const parsedInterestRate = parseFloat(interestRate);
    const parsedSubAmt = parseFloat(subscriptionAmount) || 0;
    const parsedEmployerAmt = parseFloat(subscriptionEmployerAmount) || 0;
    const parsedSubDay = Math.min(31, Math.max(1, parseInt(subscriptionDay, 10) || 5));

    const resolvedCouponRate = !isNaN(parsedCoupon) && parsedCoupon > 0
      ? parsedCoupon
      : (!isNaN(parsedInterestRate) && parsedInterestRate > 0 ? parsedInterestRate : undefined);
    const resolvedInterestRate = !isNaN(parsedInterestRate) && parsedInterestRate > 0
      ? parsedInterestRate
      : (!isNaN(parsedCoupon) && parsedCoupon > 0 ? parsedCoupon : undefined);

    const resolvedGoldPrice = assetType === 'sgb'
      ? (!isNaN(parsedCurrentPrice) && parsedCurrentPrice > 0
          ? parsedCurrentPrice
          : (!isNaN(parseFloat(goldReferencePrice)) && parseFloat(goldReferencePrice) > 0 ? parseFloat(goldReferencePrice) : DEFAULT_SGB_GOLD_PRICE))
      : undefined;

    const resolvedCurrentPrice = assetType === 'sgb'
      ? (resolvedGoldPrice || (!isNaN(parsedCurrentPrice) && parsedCurrentPrice > 0 ? parsedCurrentPrice : parsedAvgPrice))
      : (!isNaN(parsedCurrentPrice) && parsedCurrentPrice > 0 ? parsedCurrentPrice : parsedAvgPrice);
    const resolvedPrevPrice = !isNaN(parsedPrevPrice) && parsedPrevPrice > 0 ? parsedPrevPrice : undefined;

    const subscriptionConfig: HoldingSubscription | undefined = subscriptionEnabled
      ? {
          enabled: true,
          amount: parsedSubAmt,
          employerAmount: assetType === 'pf' ? parsedEmployerAmt : undefined,
          dayOfMonth: parsedSubDay,
          fromAccountId: subscriptionAccountId || undefined,
          status: 'ACTIVE',
          notes: subscriptionNotes.trim() || undefined,
        }
      : undefined;

    if (initialHolding) {
      updateHolding(initialHolding.id, {
        symbol: symbol.toUpperCase().trim(),
        name: name.trim(),
        customDisplayName: customDisplayName.trim() || undefined,
        assetType,
        dematAccountId,
        quantity: parsedQty,
        averageBuyPrice: parsedAvgPrice,
        purchaseDate: purchaseDate || undefined,
        currentPrice: resolvedCurrentPrice,
        previousClosePrice: resolvedPrevPrice,
        amfiSchemeCode: amfiSchemeCode || undefined,
        amfiSchemeName: amfiSchemeName || undefined,
        notes: notes.trim() || undefined,
        customAvatar,
        isVerified,
        requiresConfirmation,
        couponRate: (assetType === 'bond' || assetType === 'sgb') ? resolvedCouponRate : undefined,
        couponFrequency: (assetType === 'bond' || assetType === 'sgb') ? couponFrequency : undefined,
        maturityDate: (assetType === 'bond' || assetType === 'sgb') && maturityDate ? maturityDate : undefined,
        faceValue: !isNaN(parsedFaceVal) && parsedFaceVal > 0 ? parsedFaceVal : undefined,
        bondType: assetType === 'bond' ? bondType : undefined,
        issuer: assetType === 'bond' ? (issuer.trim() || undefined) : undefined,
        isin: isin.trim() || undefined,
        ytm: assetType === 'bond' && !isNaN(parseFloat(ytm)) && parseFloat(ytm) > 0 ? parseFloat(ytm) : undefined,
        trancheSeries: assetType === 'sgb' ? (trancheSeries.trim() || undefined) : undefined,
        rbiIssuePrice: assetType === 'sgb' && !isNaN(parseFloat(rbiIssuePrice)) && parseFloat(rbiIssuePrice) > 0 ? parseFloat(rbiIssuePrice) : undefined,
        goldReferencePrice: resolvedGoldPrice,
        prematureRedemptionDate: assetType === 'sgb' && prematureRedemptionDate ? prematureRedemptionDate : undefined,
        pfType: assetType === 'pf' ? pfType : undefined,
        uanOrAccountNumber: uanOrAccountNumber.trim() || undefined,
        interestRate: resolvedInterestRate,
        openingBalance: 0,
        openingDate: assetType === 'pf' ? (purchaseDate || toInputDate(new Date())) : undefined,
        subscription: subscriptionConfig,
      });
    } else {
      // Build transactions for new asset creation
      const backfillCount = parseInt(backfillMonths, 10) || 0;
      const initialTransactions: InvestmentTransaction[] = [];

      if (backfillCount > 0 && subscriptionEnabled && parsedSubAmt > 0) {
        const monthlyTotal = parsedSubAmt + (assetType === 'pf' ? parsedEmployerAmt : 0);
        const now = new Date();
        for (let m = backfillCount; m >= 1; m--) {
          const pastDate = new Date(now.getFullYear(), now.getMonth() - m, parsedSubDay);
          const pastDateStr = toInputDate(pastDate);
          initialTransactions.push({
            id: `inv_tx_backfill_${Date.now()}_${m}`,
            holdingId: '',
            date: pastDateStr,
            type: 'buy',
            quantity: assetType === 'pf' ? monthlyTotal : (parsedAvgPrice > 0 ? Number((monthlyTotal / parsedAvgPrice).toFixed(4)) : 1),
            price: assetType === 'pf' ? 1 : parsedAvgPrice,
            totalAmount: monthlyTotal,
            employeeAmount: assetType === 'pf' ? parsedSubAmt : undefined,
            employerAmount: assetType === 'pf' ? parsedEmployerAmt : undefined,
            notes: `Backfilled monthly subscription (${pastDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})`,
            accountingType: 'corporate_action',
          });
        }
      } else if (assetType !== 'pf' && parsedQty > 0 && parsedAvgPrice > 0) {
        initialTransactions.push({
          id: `inv_tx_initial_${Date.now()}`,
          holdingId: '',
          date: purchaseDate || toInputDate(new Date()),
          type: 'buy',
          quantity: parsedQty,
          price: parsedAvgPrice,
          totalAmount: Number((parsedQty * parsedAvgPrice).toFixed(2)),
          notes: 'Initial asset acquisition',
        });
      }

      addHolding({
        symbol: symbol.toUpperCase().trim(),
        name: name.trim(),
        customDisplayName: customDisplayName.trim() || undefined,
        assetType,
        dematAccountId,
        quantity: parsedQty,
        averageBuyPrice: parsedAvgPrice,
        purchaseDate: purchaseDate || toInputDate(new Date()),
        currentPrice: resolvedCurrentPrice,
        previousClosePrice: resolvedPrevPrice,
        previousCloseDate: resolvedPrevPrice ? toInputDate(new Date(Date.now() - 86400000)) : undefined,
        lastPriceUpdate: toInputDate(new Date()),
        amfiSchemeCode: amfiSchemeCode || undefined,
        amfiSchemeName: amfiSchemeName || undefined,
        notes: notes.trim() || undefined,
        customAvatar,
        isVerified,
        requiresConfirmation,
        couponRate: (assetType === 'bond' || assetType === 'sgb') ? resolvedCouponRate : undefined,
        couponFrequency: (assetType === 'bond' || assetType === 'sgb') ? couponFrequency : undefined,
        maturityDate: (assetType === 'bond' || assetType === 'sgb') && maturityDate ? maturityDate : undefined,
        faceValue: !isNaN(parsedFaceVal) && parsedFaceVal > 0 ? parsedFaceVal : undefined,
        bondType: assetType === 'bond' ? bondType : undefined,
        issuer: assetType === 'bond' ? (issuer.trim() || undefined) : undefined,
        isin: isin.trim() || undefined,
        ytm: assetType === 'bond' && !isNaN(parseFloat(ytm)) && parseFloat(ytm) > 0 ? parseFloat(ytm) : undefined,
        trancheSeries: assetType === 'sgb' ? (trancheSeries.trim() || undefined) : undefined,
        rbiIssuePrice: assetType === 'sgb' && !isNaN(parseFloat(rbiIssuePrice)) && parseFloat(rbiIssuePrice) > 0 ? parseFloat(rbiIssuePrice) : undefined,
        goldReferencePrice: resolvedGoldPrice,
        prematureRedemptionDate: assetType === 'sgb' && prematureRedemptionDate ? prematureRedemptionDate : undefined,
        pfType: assetType === 'pf' ? pfType : undefined,
        uanOrAccountNumber: uanOrAccountNumber.trim() || undefined,
        interestRate: resolvedInterestRate,
        openingBalance: assetType === 'pf' ? parsedQty : undefined,
        openingDate: assetType === 'pf' ? (purchaseDate || toInputDate(new Date())) : undefined,
        subscription: subscriptionConfig,
        transactions: initialTransactions.length > 0 ? initialTransactions : undefined,
      }, {
        isTransfer: assetType !== 'pf' && isTransfer && parsedQty > 0 && parsedAvgPrice > 0,
        fromAccountId: fundingBankAccountId,
        toAccountId: dematAccountId,
        transferDate: purchaseDate || toInputDate(new Date()),
        notes: `Investment Transfer: ${symbol.toUpperCase().trim()} (${parsedQty} @ ₹${parsedAvgPrice})`,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (!initialHolding) return;
    deleteHolding(initialHolding.id);
    onClose();
  };

  const isMutualFund = assetType === 'mutual_fund';
  const isBond = assetType === 'bond';
  const isSgb = assetType === 'sgb';
  const isPf = assetType === 'pf';

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 isolate overscroll-contain"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {initialHolding ? 'Edit Holding' : 'Add Investment Asset'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-5 overflow-y-auto flex-1 text-xs sm:text-sm pb-24">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Asset Type
              </label>
              <select
                value={assetType}
                onChange={(e) => {
                  const newType = e.target.value as InvestmentAssetType;
                  setAssetType(newType);
                  if (newType === 'mutual_fund') {
                    if (averageBuyPrice === '1000' || averageBuyPrice === '100') setAverageBuyPrice('80');
                    if (currentPrice === '1000' || currentPrice === '100') setCurrentPrice('80');
                  } else if (newType === 'pf') {
                    if (!initialHolding) {
                      setSymbol('EPF');
                      setName("Employees' Provident Fund (EPF)");
                      setPfType('EPF');
                      setQuantity('250000');
                      setAverageBuyPrice('1');
                      setCurrentPrice('1');
                      setPreviousClosePrice('1');
                      setSubscriptionEnabled(true);
                      setSubscriptionAmount('15000');
                      setSubscriptionEmployerAmount('15000');
                      setSubscriptionDay('5');
                      setInterestRate('8.25');
                      setIsTransfer(false);
                    }
                  } else if (newType === 'bond') {
                    if (!initialHolding) {
                      setSymbol('7.18% GS 2033');
                      setName('7.18% Government of India Security 2033');
                      setBondType('g_sec');
                      setIssuer('Reserve Bank of India / Govt of India');
                      setIsin('IN0020230085');
                      setQuantity('100');
                      setAverageBuyPrice('100');
                      setCurrentPrice('100.25');
                      setPreviousClosePrice('100.10');
                      setFaceValue('100');
                      setCouponRate('7.18');
                      setInterestRate('7.18');
                      setCouponFrequency('semi_annually');
                      setYtm('7.15');
                      const now = new Date();
                      const mat = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
                      setMaturityDate(toInputDate(mat));
                    }
                  } else if (newType === 'sgb') {
                    if (!initialHolding) {
                      setSymbol('SGB 2023-24 IV');
                      setName('Sovereign Gold Bonds 2023-24 Series IV');
                      setTrancheSeries('2023-24 Series IV');
                      setQuantity('5');
                      setAverageBuyPrice('6263');
                      setCurrentPrice(DEFAULT_SGB_GOLD_PRICE.toString());
                      setGoldReferencePrice(DEFAULT_SGB_GOLD_PRICE.toString());
                      setPreviousClosePrice((DEFAULT_SGB_GOLD_PRICE - 40).toString());
                      setPurchaseDate(toInputDate(new Date()));
                      setRbiIssuePrice('6263');
                      setCouponRate(STANDARD_SGB_COUPON_RATE.toString());
                      setInterestRate(STANDARD_SGB_COUPON_RATE.toString());
                      setCouponFrequency('semi_annually');
                      const now = new Date();
                      const mat = new Date(now.getFullYear() + 8, now.getMonth(), now.getDate());
                      const prem = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate());
                      setMaturityDate(toInputDate(mat));
                      setPrematureRedemptionDate(toInputDate(prem));
                      setFaceValue('6263');
                    }
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold"
              >
                <option value="stock">Equity Stock</option>
                <option value="mutual_fund">Mutual Fund (MF)</option>
                <option value="bond">Bonds / Corporate & Govt Debt</option>
                <option value="sgb">Sovereign Gold Bond (SGB)</option>
                <option value="pf">Provident Fund (EPF / PPF / VPF)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isMutualFund
                  ? 'AMFI Scheme Code / Symbol'
                  : isBond
                  ? 'Bond Symbol / Security Code'
                  : isSgb
                  ? 'SGB Series Symbol'
                  : isPf
                  ? 'PF Scheme / Category'
                  : 'Symbol / Ticker'}
              </label>
              <input
                type="text"
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder={
                  isMutualFund
                    ? 'e.g. 122639 or PPFAS_FLEXI'
                    : isBond
                    ? 'e.g. 7.18% GS 2033 or REC28'
                    : isSgb
                    ? 'e.g. SGB 2023-24 IV'
                    : isPf
                    ? 'e.g. EPF, PPF, VPF'
                    : 'e.g. RELIANCE, TCS'
                }
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl uppercase font-semibold text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Offline Indian Stocks & ETFs Directory (100% Offline Capable) */}
          {assetType === 'stock' && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 dark:text-blue-300">
                  <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Offline Stock & ETF Quick-Finder</span>
                </div>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">
                  100% Offline Search
                </span>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  placeholder="Search 60+ offline stocks & ETFs (e.g. Reliance, TCS, NiftyBees, GoldBees, Tata, SBI)..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Live Matching Stock Results */}
              {offlineStockMatches.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {offlineStockMatches.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onClick={() => handleSelectOfflineStock(item)}
                      className="w-full p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all text-left flex items-center justify-between gap-2 cursor-pointer group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-300">
                            {item.symbol}
                          </span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {item.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 truncate mt-0.5 font-medium">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {item.sector}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums block">
                          ₹{item.referencePrice.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9px] text-slate-400">Ref CMP</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Select Chips */}
              <div>
                <span className="text-[10px] font-semibold text-blue-900 dark:text-blue-300 block mb-1">
                  Quick select popular stocks & ETFs:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {OFFLINE_STOCK_DIRECTORY.slice(0, 10).map((st) => (
                    <button
                      key={st.symbol}
                      type="button"
                      onClick={() => handleSelectOfflineStock(st)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        symbol === st.symbol
                          ? 'bg-blue-600 text-white border-blue-600 font-bold'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                      }`}
                    >
                      {st.symbol} (₹{st.referencePrice.toLocaleString('en-IN')})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AMFI Scheme Search & 1-Click Autocomplete (for Mutual Funds) */}
          {isMutualFund && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>AMFI Scheme Auto-Link (Live CMP / NAV Updates)</span>
                </div>
                {amfiSchemeCode && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Linked: AMFI {amfiSchemeCode}</span>
                  </span>
                )}
              </div>

              {/* Search box for 15,000+ AMFI schemes */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={amfiSearchQuery}
                    onChange={(e) => setAmfiSearchQuery(e.target.value)}
                    placeholder="Search 15,000+ AMFI funds (e.g. Parag Parikh, Mirae Large, 122639, SBI Small)..."
                    className="w-full pl-9 pr-9 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {isSearchingAmfi && (
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin absolute right-3 top-2.5" />
                  )}
                </div>

                {/* Plan Type & Option Filter Pills */}
                {amfiSearchResults.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-slate-400 font-semibold shrink-0">Filter:</span>
                    <button
                      type="button"
                      onClick={() => setSchemeFilter('direct')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all shrink-0 cursor-pointer ${
                        schemeFilter === 'direct'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      Direct Plans Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchemeFilter('all')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all shrink-0 cursor-pointer ${
                        schemeFilter === 'all'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      All Variants ({amfiSearchResults.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchemeFilter('growth')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all shrink-0 cursor-pointer ${
                        schemeFilter === 'growth'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      Growth Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchemeFilter('regular')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all shrink-0 cursor-pointer ${
                        schemeFilter === 'regular'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      Regular Plans
                    </button>
                  </div>
                )}
              </div>

              {/* Search results dropdown */}
              {amfiSearchResults.length > 0 && (
                <div className="max-h-52 overflow-y-auto space-y-1.5 p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-md">
                  {filteredAmfiResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No funds match the "{schemeFilter}" filter. Switch to "All Variants".
                    </div>
                  ) : (
                    filteredAmfiResults.map((res) => {
                      const isReg = res.planType === 'Regular' || res.schemeName.toLowerCase().includes('regular');
                      const isIdcw = res.optionType === 'IDCW' || res.schemeName.toLowerCase().includes('idcw') || res.schemeName.toLowerCase().includes('dividend');
                      return (
                        <button
                          key={res.schemeCode}
                          type="button"
                          onClick={() => handlePickScheme(res)}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 border border-slate-100 dark:border-slate-800/80 hover:border-emerald-300 dark:hover:border-emerald-800 flex items-center justify-between gap-2.5 text-xs transition-all cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
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
                                Code: {res.schemeCode}
                              </span>
                            </div>
                          </div>
                          {res.nav && (
                            <div className="text-right shrink-0">
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums block">
                                ₹{res.nav.toFixed(2)}
                              </span>
                              <span className="text-[9px] text-slate-400">NAV</span>
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Popular schemes chips for instant 1-tap select */}
              <div>
                <span className="text-[10px] font-semibold text-emerald-900 dark:text-emerald-300 block mb-1">
                  Quick select popular schemes (Direct Plan - Growth):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {POPULAR_MF_SCHEMES.slice(0, 8).map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => handlePickScheme(p)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        amfiSchemeCode === p.code
                          ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                      }`}
                    >
                      {p.name.split('-')[0].trim()} (₹{p.nav.toFixed(2)})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Asset Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Reliance Industries Limited or Parag Parikh Flexi Cap Direct Growth"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Custom Display Name (Optional)
            </label>
            <input
              type="text"
              value={customDisplayName}
              onChange={(e) => setCustomDisplayName(e.target.value)}
              placeholder="e.g. PPFC Flexi, Tata Motors DVR, HDFC Flexi, SBI SmallCap"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Differentiate holdings when multiple stocks or mutual funds share similar first names.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Custom Avatar / Logo (Optional)
            </label>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                {customAvatar ? (
                  <img src={customAvatar} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-slate-400">
                    {symbol ? symbol.substring(0, 2).toUpperCase() : 'LOGO'}
                  </span>
                )}
              </div>
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-2xs">
                <Camera className="w-3.5 h-3.5 text-blue-500" />
                <span>Upload from Device</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
              </label>
              {customAvatar && (
                <button
                  type="button"
                  onClick={() => setCustomAvatar(undefined)}
                  className="text-xs text-rose-500 hover:underline cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Category-Specific Quantity and Price Fields */}
          {assetType === 'pf' ? (
            <div className="p-4 bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/50 rounded-2xl space-y-2">
              <label className="block text-xs font-semibold text-cyan-900 dark:text-cyan-200 mb-1.5">
                Account Inception Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-xl tabular-nums font-semibold text-sm text-slate-800 dark:text-slate-100"
              />
              <span className="text-[10px] text-cyan-700/80 dark:text-cyan-400 block">
                PF corpus is automatically calculated by the app from your logged subscriptions, contributions, and interest credits.
              </span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {assetType === 'sgb'
                      ? 'Units in Grams (g)'
                      : assetType === 'bond'
                      ? 'Units Held'
                      : isMutualFund
                      ? 'Quantity (Units)'
                      : 'Quantity (Shares)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {assetType === 'sgb'
                      ? 'Purchase Rate (₹/g)'
                      : assetType === 'bond'
                      ? 'Purchase Price / Unit (₹)'
                      : 'Avg Buy (₹)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={averageBuyPrice}
                    onChange={(e) => setAverageBuyPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-semibold"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {assetType === 'sgb' ? 'Allotment / Buy Date' : 'Date of Purchase'}
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-semibold text-sm text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {assetType === 'sgb'
                      ? 'Reference Gold Rate (₹/g)'
                      : assetType === 'bond'
                      ? 'Current Clean Price / Unit (₹)'
                      : 'Current Market Price / NAV (₹)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={currentPrice}
                    onChange={(e) => {
                      setCurrentPrice(e.target.value);
                      if (assetType === 'sgb') {
                        setGoldReferencePrice(e.target.value);
                      }
                    }}
                    placeholder={assetType === 'sgb' ? 'IBJA 24K domestic rate (₹14,420/g)' : 'Auto-synced or enter manually'}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-semibold"
                  />
                  {assetType === 'sgb' && (
                    <span className="text-[10px] text-yellow-700 dark:text-yellow-400 mt-0.5 block">
                      Indian domestic 24K IBJA / SGB parity benchmark (₹14,420/g).
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {assetType === 'sgb'
                      ? 'Prev Day Gold Rate (₹/g)'
                      : 'Previous Day Close / NAV (₹)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={previousClosePrice}
                    onChange={(e) => setPreviousClosePrice(e.target.value)}
                    placeholder="For 1-Day change"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tabular-nums font-semibold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Last business day close for 1-Day change
                  </span>
                </div>
              </div>
            </>
          )}

          {/* DEDICATED BOND / FIXED-INCOME PARAMETERS */}
          {assetType === 'bond' && (
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                    Bond & Fixed-Income Parameters
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                  Fixed Income
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bond Category / Security Type
                  </label>
                  <select
                    value={bondType}
                    onChange={(e: any) => setBondType(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="g_sec">Government Security (G-Sec)</option>
                    <option value="t_bill">Treasury Bill (T-Bill)</option>
                    <option value="corporate">Corporate Bond / NCD</option>
                    <option value="psu">PSU / Tax-Exempt Bond</option>
                    <option value="tax_free">Tax-Free Infrastructure Bond</option>
                    <option value="zero_coupon">Zero-Coupon Bond</option>
                    <option value="other">Other Fixed-Income Security</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Issuer Name
                  </label>
                  <input
                    type="text"
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    placeholder="e.g. Reserve Bank of India, REC Ltd, NHAI"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ISIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={isin}
                    onChange={(e) => setIsin(e.target.value.toUpperCase())}
                    placeholder="e.g. IN0020230085"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-slate-900 dark:text-white font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Face Value / Par (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="e.g. 1000 or 100"
                    value={faceValue}
                    onChange={(e) => setFaceValue(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl tabular-nums font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Yield to Maturity (YTM %)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 7.15"
                    value={ytm}
                    onChange={(e) => setYtm(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl tabular-nums font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Annual Coupon Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 7.18"
                    value={couponRate}
                    onChange={(e) => {
                      setCouponRate(e.target.value);
                      setInterestRate(e.target.value);
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl tabular-nums font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Coupon Payout Frequency
                  </label>
                  <select
                    value={couponFrequency}
                    onChange={(e: any) => setCouponFrequency(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="monthly">Monthly (12x/yr)</option>
                    <option value="quarterly">Quarterly (4x/yr)</option>
                    <option value="semi_annually">Semi-Annually (2x/yr)</option>
                    <option value="annually">Annually (1x/yr)</option>
                    <option value="at_maturity">At Maturity (Cumulative)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Maturity / Redemption Date
                  </label>
                  <input
                    type="date"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* DEDICATED SOVEREIGN GOLD BONDS (SGB) PARAMETERS */}
          {assetType === 'sgb' && (
            <div className="p-4 bg-yellow-50/70 dark:bg-yellow-950/20 border border-yellow-300/80 dark:border-yellow-900/60 rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-xs font-bold text-yellow-950 dark:text-yellow-200">
                    Sovereign Gold Bonds (RBI SGB Scheme)
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border border-yellow-300/60">
                  2.50% p.a. Guaranteed
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tranche / Series Name
                  </label>
                  <input
                    type="text"
                    value={trancheSeries}
                    onChange={(e) => setTrancheSeries(e.target.value)}
                    placeholder="e.g. 2023-24 Series IV or SGB 2021-22 IX"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-yellow-300 dark:border-yellow-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    RBI Allotment Issue Price (₹/g)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={rbiIssuePrice}
                    onChange={(e) => {
                      setRbiIssuePrice(e.target.value);
                      if (!averageBuyPrice || averageBuyPrice === '6263' || averageBuyPrice === rbiIssuePrice) {
                        setAverageBuyPrice(e.target.value);
                      }
                    }}
                    placeholder="e.g. 6263"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-yellow-300 dark:border-yellow-700 rounded-xl tabular-nums font-semibold"
                  />
                  <span className="text-[10px] text-yellow-800/80 dark:text-yellow-400/80 mt-0.5 block">
                    Sovereign 2.50% interest is calculated on this initial issue price.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Annual Sovereign Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={couponRate || STANDARD_SGB_COUPON_RATE.toString()}
                    onChange={(e) => {
                      setCouponRate(e.target.value);
                      setInterestRate(e.target.value);
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-yellow-300 dark:border-yellow-700 rounded-xl tabular-nums font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Interest Schedule
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Semi-Annually (Every 6 Months)"
                    className="w-full px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-600 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    8-Year Maturity Date
                  </label>
                  <input
                    type="date"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-yellow-300 dark:border-yellow-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    5-Year Premature Exit Window Date
                  </label>
                  <input
                    type="date"
                    value={prematureRedemptionDate}
                    onChange={(e) => setPrematureRedemptionDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-yellow-300 dark:border-yellow-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gold Price Benchmark Source
                  </label>
                  <input
                    type="text"
                    disabled
                    value={DEFAULT_SGB_GOLD_SOURCE}
                    className="w-full px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-600 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-yellow-100/60 dark:bg-yellow-950/40 text-[11px] text-yellow-900 dark:text-yellow-200 leading-relaxed border border-yellow-300/40">
                SGB pure gold valuation is estimated based on the IBJA benchmark and excludes bank interest payouts to prevent double-counting.
              </div>
            </div>
          )}

          {/* Provident Fund (PF) Specific Configuration */}
          {assetType === 'pf' && (
            <div className="p-4 bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/60 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-bold text-cyan-950 dark:text-cyan-200">
                  Provident Fund (PF) Parameters
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    PF Category
                  </label>
                  <select
                    value={pfType}
                    onChange={(e: any) => {
                      const selectedPf = e.target.value as PfType;
                      setPfType(selectedPf);
                      if (!initialHolding) {
                        if (selectedPf === 'PPF') {
                          setSymbol('PPF');
                          setName('Public Provident Fund (PPF)');
                          setInterestRate('7.10');
                          setCouponRate('7.10');
                          setSubscriptionEmployerAmount('0');
                        } else if (selectedPf === 'EPF') {
                          setSymbol('EPF');
                          setName("Employees' Provident Fund (EPF)");
                          setInterestRate('8.25');
                          setCouponRate('8.25');
                          setSubscriptionEmployerAmount(subscriptionAmount || '15000');
                        } else if (selectedPf === 'VPF') {
                          setSymbol('VPF');
                          setName('Voluntary Provident Fund (VPF)');
                          setInterestRate('8.25');
                          setCouponRate('8.25');
                          setSubscriptionEmployerAmount('0');
                        } else if (selectedPf === 'GPF') {
                          setSymbol('GPF');
                          setName('General Provident Fund (GPF)');
                          setInterestRate('7.10');
                          setCouponRate('7.10');
                          setSubscriptionEmployerAmount('0');
                        }
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-xl font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="EPF">EPF (Employees' Provident Fund)</option>
                    <option value="PPF">PPF (Public Provident Fund)</option>
                    <option value="VPF">VPF (Voluntary Provident Fund)</option>
                    <option value="GPF">GPF (General Provident Fund)</option>
                    <option value="CUSTOM">Custom Provident Scheme</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sovereign Interest Rate (% p.a.)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={interestRate}
                      onChange={(e) => {
                        setInterestRate(e.target.value);
                        setCouponRate(e.target.value);
                      }}
                      placeholder="8.25"
                      className="w-full pl-3 pr-7 py-1.5 text-xs bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-xl tabular-nums font-semibold"
                    />
                    <span className="absolute right-3 top-2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  UAN or Account / Member Number (Optional)
                </label>
                <input
                  type="text"
                  value={uanOrAccountNumber}
                  onChange={(e) => setUanOrAccountNumber(e.target.value)}
                  placeholder="e.g. UAN 101489201934 or PPF A/C 382910"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-xl text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* Monthly Recurring Subscription Section (for PF & Bonds) */}
          {(assetType === 'pf' || assetType === 'bond') && (
            <div className="p-4 bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-bold text-purple-950 dark:text-purple-200">
                    Monthly Subscription & Auto-Contributions
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-800 dark:text-purple-300">
                  <input
                    type="checkbox"
                    checked={subscriptionEnabled}
                    onChange={(e) => setSubscriptionEnabled(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Enable Monthly Subscription</span>
                </label>
              </div>

              {subscriptionEnabled && (
                <div className="space-y-3 pt-1 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {assetType === 'pf' ? 'Employee Contribution (₹/mo)' : 'Monthly Subscription (₹/mo)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={subscriptionAmount}
                        onChange={(e) => setSubscriptionAmount(e.target.value)}
                        placeholder="5000"
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl tabular-nums font-semibold"
                      />
                    </div>

                    {assetType === 'pf' ? (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Employer Match (₹/mo)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={subscriptionEmployerAmount}
                          onChange={(e) => setSubscriptionEmployerAmount(e.target.value)}
                          placeholder="5000"
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl tabular-nums font-semibold"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Execution Day
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={subscriptionDay}
                          onChange={(e) => setSubscriptionDay(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl tabular-nums font-semibold"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {assetType === 'pf' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Execution Day of Month
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={subscriptionDay}
                          onChange={(e) => setSubscriptionDay(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl tabular-nums font-semibold"
                        />
                      </div>
                    )}

                    <div className={assetType === 'pf' ? '' : 'col-span-2'}>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Source Bank Account
                      </label>
                      <select
                        value={subscriptionAccountId}
                        onChange={(e) => setSubscriptionAccountId(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl text-slate-900 dark:text-white"
                      >
                        <option value="">Unlinked (Investment Ledger Only)</option>
                        {accounts
                          .filter((a) => !a.isArchived && !a.isSystemDebtAccount)
                          .map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {!initialHolding && (
                    <div className="pt-2 border-t border-purple-200/60 dark:border-purple-800/40">
                      <label className="block text-[11px] font-bold text-purple-900 dark:text-purple-300 mb-1">
                        Backfill Old Subscriptions?
                      </label>
                      <select
                        value={backfillMonths}
                        onChange={(e) => setBackfillMonths(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl text-slate-900 dark:text-white font-semibold"
                      >
                        <option value="0">No backfill (Start recurring from this month)</option>
                        <option value="3">Add past 3 monthly subscriptions</option>
                        <option value="6">Add past 6 monthly subscriptions</option>
                        <option value="12">Add past 12 monthly subscriptions (1 Year)</option>
                        <option value="24">Add past 24 monthly subscriptions (2 Years)</option>
                      </select>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        You can also add custom past subscriptions anytime from the holding details screen.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Current Market Price & historical charts are updated online automatically via Yahoo Finance & AMFI.
            </span>
          </div>

          {/* Transfer Type Feature (Bank to Demat) */}
          {!initialHolding ? (
            assetType === 'pf' ? (
              <div className="p-4 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/60 space-y-3">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-bold text-cyan-950 dark:text-cyan-200">
                    PF Account Custody & Record
                  </span>
                </div>
                <p className="text-[11px] text-cyan-800/80 dark:text-cyan-300">
                  Your PF corpus is recorded as a statutory retirement asset. Opening balance does not debit your bank accounts.
                </p>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Associated Ledger / Tracking Account (Optional)
                  </label>
                  <select
                    value={dematAccountId}
                    onChange={(e) => setDematAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-bold text-purple-950 dark:text-purple-200">
                      Settlement & Bank-to-Demat Transfer
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-800 dark:text-purple-300">
                    <input
                      type="checkbox"
                      checked={isTransfer}
                      onChange={(e) => setIsTransfer(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Record as Account Transfer</span>
                  </label>
                </div>

                {isTransfer ? (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Funding Bank Account (Debit)
                        </label>
                        <select
                          value={fundingBankAccountId}
                          onChange={(e) => setFundingBankAccountId(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl text-slate-900 dark:text-white font-medium"
                        >
                          {accounts
                            .filter((a) => !a.isArchived && !a.isSystemDebtAccount && a.type !== 'demat')
                            .map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({formatINR(acc.balance)}) - {acc.type.toUpperCase()}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Target Demat Account (Credit)
                        </label>
                        <select
                          value={dematAccountId}
                          onChange={(e) => setDematAccountId(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl text-slate-900 dark:text-white font-medium"
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

                    {/* Transfer Visual Pill */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-100/70 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700/60 text-xs">
                      <ArrowRightLeft className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-purple-900 dark:text-purple-200">
                          Transfer: <span className="underline">{accounts.find((a) => a.id === fundingBankAccountId)?.name || 'Bank'}</span> ➔ <span className="underline">{accounts.find((a) => a.id === dematAccountId)?.name || 'Demat'}</span> ({formatINR(parsedTotalCost)})
                        </span>
                        <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-0.5">
                          Transfers purchase consideration from bank to Demat in your passbook. Demat account balance automatically factors in this holding&apos;s market value.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Custody / Demat Account (Holding Record Only)
                    </label>
                    <select
                      value={dematAccountId}
                      onChange={(e) => setDematAccountId(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl text-slate-900 dark:text-white text-xs font-medium"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type.toUpperCase()})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      No money will be debited or transferred from your bank accounts.
                    </span>
                  </div>
                )}
              </div>
            )
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Custody / Demat Account
              </label>
              <select
                value={dematAccountId}
                onChange={(e) => setDematAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Long term wealth compounder"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            {initialHolding ? (
              confirmDelete ? (
                <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                  <span className="text-xs font-semibold text-rose-600">Delete asset?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs active:scale-95 transition-all shadow-xs"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Holding</span>
                </button>
              )
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-6 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{initialHolding ? 'Save Changes' : 'Add Holding'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

      {/* AMFI Scheme Selection Confirmation & Doubt Verification Modal */}
      {pendingSchemeForConfirm && (
        <AmfiFundConfirmModal
          isOpen={Boolean(pendingSchemeForConfirm)}
          onClose={() => setPendingSchemeForConfirm(null)}
          onConfirm={applyConfirmedScheme}
          scheme={pendingSchemeForConfirm}
          holdingContext={{
            holdingName: name,
            holdingSymbol: symbol,
            holdingPrice: parseFloat(currentPrice) || parseFloat(averageBuyPrice),
            averageBuyPrice: parseFloat(averageBuyPrice),
          }}
          onSearchDirectGrowth={(suggestedQ) => {
            setAmfiSearchQuery(suggestedQ);
            setSchemeFilter('direct');
          }}
        />
      )}
    </>,
    document.body
  );
};
