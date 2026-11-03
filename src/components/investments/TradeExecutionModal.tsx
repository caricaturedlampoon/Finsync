import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { formatINR, toInputDate } from '../../utils/formatters';
import { calculateStockDeliveryCharges, calculateMutualFundCharges } from '../../utils/statutoryCharges';
import { useRegisterOverlay } from '../../navigation/NavigationContext';
import { OFFLINE_STOCK_DIRECTORY } from '../../data/offlineStockDirectory';
import { POPULAR_MF_SCHEMES } from '../../utils/amfiSipEngine';
import {
  X,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  TrendingUp,
  TrendingDown,
  Coins,
  ShieldCheck,
  Info,
  DollarSign,
  Briefcase,
  Layers,
  Sparkles,
  Landmark,
  ArrowRight,
  Receipt,
  Percent,
  ArrowRightLeft,
} from 'lucide-react';

interface TradeExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAssetType?: 'stock' | 'mutual_fund';
  initialHoldingId?: string;
  initialAction?: 'buy' | 'sell';
}

export const TradeExecutionModal: React.FC<TradeExecutionModalProps> = ({
  isOpen,
  onClose,
  initialAssetType = 'stock',
  initialHoldingId,
  initialAction,
}) => {
  const { holdings, accounts, recordInvestmentAction, addHolding, showToast } = useApp();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Trade Primary Mode: 'buy' vs 'sell'
  const [actionType, setActionType] = useState<'buy' | 'sell'>(initialAction || 'buy');

  // Asset Class: 'stock' vs 'mutual_fund'
  const [assetClass, setAssetClass] = useState<'stock' | 'mutual_fund'>(initialAssetType);
  const [selectedHoldingId, setSelectedHoldingId] = useState<string>('custom');

  // Stock Trade State
  const [stockSymbol, setStockSymbol] = useState<string>('RELIANCE');
  const [stockName, setStockName] = useState<string>('Reliance Industries Ltd');
  const [stockQuantity, setStockQuantity] = useState<string>('10');
  const [stockPrice, setStockPrice] = useState<string>('2895');
  const [brokeragePerOrder, setBrokeragePerOrder] = useState<string>('20');
  const [isBSE, setIsBSE] = useState<boolean>(false);
  const [chargesMode, setChargesMode] = useState<'with_charges' | 'without_charges'>('with_charges');

  // Mutual Fund State (Buy: SIP/Lumpsum, Sell: Redeem)
  const [mfOrderType, setMfOrderType] = useState<'SIP' | 'LUMPSUM'>('SIP');
  const [mfSchemeCode, setMfSchemeCode] = useState<string>('122639');
  const [mfSchemeName, setMfSchemeName] = useState<string>('Parag Parikh Flexi Cap Direct Growth');
  const [mfGrossAmount, setMfGrossAmount] = useState<string>('5000');
  const [mfNav, setMfNav] = useState<string>('90.88');
  const [mfRedeemUnits, setMfRedeemUnits] = useState<string>('10');
  const [mfExitLoadPct, setMfExitLoadPct] = useState<string>('0');

  // Common Controls
  const [accountId, setAccountId] = useState<string>(''); // Funding Bank Account / Receiving Bank Account
  const [dematAccountId, setDematAccountId] = useState<string>(''); // Custom Demat Account
  const [categorizeProfitAsIncome, setCategorizeProfitAsIncome] = useState<boolean>(true);
  const [categorizeLossAsExpense, setCategorizeLossAsExpense] = useState<boolean>(true);
  const [date, setDate] = useState<string>(toInputDate(new Date()));
  const [logChargesAsExpense, setLogChargesAsExpense] = useState<boolean>(true);
  const [isFeeBreakdownExpanded, setIsFeeBreakdownExpanded] = useState<boolean>(false);

  // Available stocks and MFs in current portfolio
  const existingStocks = useMemo(
    () => holdings.filter((h) => h.assetType === 'stock' || h.assetType === 'bond' || h.assetType === 'sgb'),
    [holdings]
  );
  const existingMFs = useMemo(() => holdings.filter((h) => h.assetType === 'mutual_fund'), [holdings]);

  // Current selected holding details
  const currentHolding = useMemo(() => {
    if (selectedHoldingId === 'custom') return null;
    return holdings.find((h) => h.id === selectedHoldingId) || null;
  }, [holdings, selectedHoldingId]);

  // Auto scroll modal container to top when opened
  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  // Sync inputs when selecting an existing holding
  const handleSelectHolding = (holdingId: string) => {
    setSelectedHoldingId(holdingId);
    if (holdingId === 'custom') return;

    const h = holdings.find((item) => item.id === holdingId);
    if (!h) return;

    if (h.dematAccountId) {
      setDematAccountId(h.dematAccountId);
    }

    if (h.assetType === 'mutual_fund') {
      setAssetClass('mutual_fund');
      setMfSchemeCode(h.amfiSchemeCode || '');
      setMfSchemeName(h.name);
      setMfNav(h.currentPrice.toString());
      if (h.quantity > 0) {
        setMfRedeemUnits(h.quantity.toFixed(4));
        setMfGrossAmount(Math.round(h.quantity * h.currentPrice).toString());
      }
    } else {
      setAssetClass('stock');
      setStockSymbol(h.symbol);
      setStockName(h.name);
      setStockPrice(h.currentPrice.toString());
      if (h.quantity > 0) {
        setStockQuantity(Math.max(1, Math.round(h.quantity)).toString());
      }
    }
  };

  // Set default account and selected holding on open
  useEffect(() => {
    if (isOpen) {
      if (initialAction) {
        setActionType(initialAction);
      }

      if (initialHoldingId) {
        handleSelectHolding(initialHoldingId);
        const h = holdings.find((item) => item.id === initialHoldingId);
        if (h) {
          setAssetClass(h.assetType === 'mutual_fund' ? 'mutual_fund' : 'stock');
          if (h.dematAccountId) {
            setDematAccountId(h.dematAccountId);
          }
        }
      } else {
        setAssetClass(initialAssetType);
        setSelectedHoldingId('custom');
      }

      setDate(toInputDate(new Date()));
      setLogChargesAsExpense(true);
      setCategorizeProfitAsIncome(true);
      setCategorizeLossAsExpense(true);
      setIsFeeBreakdownExpanded(false);

      if (accounts.length > 0) {
        const bank = accounts.find((a) => a.type === 'bank' || a.type === 'cash') || accounts[0];
        setAccountId(bank.id);

        const demat = accounts.find((a) => a.type === 'demat') || accounts[0];
        setDematAccountId((initialHoldingId ? holdings.find(h => h.id === initialHoldingId)?.dematAccountId : undefined) || demat.id);
      }
    }
  }, [isOpen, initialAssetType, initialHoldingId, initialAction, accounts, holdings]);

  // Real-Time Calculations: Stocks
  const parsedStockQty = parseFloat(stockQuantity) || 0;
  const parsedStockPrice = parseFloat(stockPrice) || 0;
  const parsedBrokerage = parseFloat(brokeragePerOrder) || 0;
  const isWithoutCharges = chargesMode === 'without_charges';

  const stockCharges = useMemo(() => {
    if (assetClass !== 'stock') return null;
    const tradeValue = Number((parsedStockQty * parsedStockPrice).toFixed(2));
    if (isWithoutCharges) {
      return {
        tradeValue,
        brokerage: 0,
        stt: 0,
        stampDuty: 0,
        exchangeFee: 0,
        sebiFee: 0,
        gst: 0,
        dpCharges: 0,
        totalCharges: 0,
        netCashImpact: tradeValue,
        breakEvenPrice: parsedStockPrice,
      };
    }
    return calculateStockDeliveryCharges({
      type: actionType,
      quantity: parsedStockQty,
      price: parsedStockPrice,
      brokeragePerOrder: parsedBrokerage,
      isBSE: isBSE,
    });
  }, [assetClass, actionType, parsedStockQty, parsedStockPrice, parsedBrokerage, isBSE, isWithoutCharges]);

  // Stock Realized P&L when selling an existing position
  const stockRealizedPnL = useMemo(() => {
    if (actionType !== 'sell' || !currentHolding || parsedStockQty <= 0) return null;
    const avgCost = currentHolding.averageBuyPrice || parsedStockPrice;
    const grossCostBasis = parsedStockQty * avgCost;
    const grossProceeds = parsedStockQty * parsedStockPrice;
    const charges = stockCharges?.totalCharges || 0;
    const netProceeds = grossProceeds - charges;
    const pnl = netProceeds - grossCostBasis;
    const pnlPct = grossCostBasis > 0 ? (pnl / grossCostBasis) * 100 : 0;
    return {
      grossCostBasis,
      grossProceeds,
      charges,
      pnl,
      pnlPct,
      isProfit: pnl >= 0,
    };
  }, [actionType, currentHolding, parsedStockQty, parsedStockPrice, stockCharges]);

  // Real-Time Calculations: Mutual Funds (Buy: SIP/Lumpsum)
  const parsedMfGross = parseFloat(mfGrossAmount) || 0;
  const parsedMfNav = parseFloat(mfNav) || 0;

  const mfBuyCharges = useMemo(() => {
    if (assetClass !== 'mutual_fund' || actionType !== 'buy') return null;
    if (isWithoutCharges) {
      return {
        grossAmount: parsedMfGross,
        stampDuty: 0,
        customFees: 0,
        netInvestedAmount: parsedMfGross,
        nav: parsedMfNav > 0 ? parsedMfNav : 10,
        unitsAllotted: parsedMfNav > 0 ? Number((parsedMfGross / parsedMfNav).toFixed(4)) : 0,
        totalCharges: 0,
      };
    }
    return calculateMutualFundCharges(parsedMfGross, parsedMfNav);
  }, [assetClass, actionType, parsedMfGross, parsedMfNav, isWithoutCharges]);

  // Real-Time Calculations: Mutual Funds (Sell: Redemption)
  const parsedMfUnits = parseFloat(mfRedeemUnits) || 0;
  const parsedMfExitLoad = isWithoutCharges ? 0 : parseFloat(mfExitLoadPct) || 0;

  const mfSellBreakdown = useMemo(() => {
    if (assetClass !== 'mutual_fund' || actionType !== 'sell') return null;
    const grossVal = Number((parsedMfUnits * parsedMfNav).toFixed(2));
    const exitLoadAmt = isWithoutCharges ? 0 : Number((grossVal * (parsedMfExitLoad / 100)).toFixed(2));
    const netCredit = Math.max(0, Number((grossVal - exitLoadAmt).toFixed(2)));

    let realizedGain: number | null = null;
    let gainPct: number | null = null;
    if (currentHolding && currentHolding.averageBuyPrice > 0) {
      const costBasis = parsedMfUnits * currentHolding.averageBuyPrice;
      realizedGain = netCredit - costBasis;
      gainPct = costBasis > 0 ? (realizedGain / costBasis) * 100 : 0;
    }

    return {
      grossVal,
      exitLoadAmt,
      netCredit,
      realizedGain,
      gainPct,
      isProfit: (realizedGain || 0) >= 0,
    };
  }, [assetClass, actionType, parsedMfUnits, parsedMfNav, parsedMfExitLoad, currentHolding, isWithoutCharges]);

  useRegisterOverlay(
    isOpen,
    'trade_execution_modal',
    `${actionType === 'buy' ? 'Buy' : 'Sell'} ${assetClass === 'stock' ? 'Stock' : 'Mutual Fund'}`,
    onClose
  );

  useEffect(() => {
    // If statement: whenever Buy Execution appears, freeze background screen
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    } else {
      // When dialog closes, scrolling continues
      document.body.style.overflow = '';
    }

    // Cleanup when component unmounts
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Percentage Quick Setters for Selling
  const handleStockPercentFill = (pct: number) => {
    if (!currentHolding || currentHolding.quantity <= 0) return;
    const qty = Math.max(1, Math.floor((currentHolding.quantity * pct) / 100));
    setStockQuantity(qty.toString());
  };

  const handleMfPercentFill = (pct: number) => {
    if (!currentHolding || currentHolding.quantity <= 0) return;
    const units = Number(((currentHolding.quantity * pct) / 100).toFixed(4));
    setMfRedeemUnits(units.toString());
  };

  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      showToast('Please select a payment/receiving account', 'error');
      return;
    }

    const selectedAccount = accounts.find((a) => a.id === accountId);

    if (assetClass === 'stock') {
      if (!stockSymbol.trim()) {
        showToast('Please enter a valid stock ticker symbol', 'error');
        return;
      }
      if (parsedStockQty <= 0 || parsedStockPrice <= 0) {
        showToast('Quantity and Price must be positive', 'error');
        return;
      }

      if (actionType === 'sell' && currentHolding && parsedStockQty > currentHolding.quantity) {
        showToast(`Cannot sell ${parsedStockQty} shares; you only own ${currentHolding.quantity}`, 'error');
        return;
      }

      // Check if holding exists in portfolio
      let targetHolding = holdings.find(
        (h) => h.assetType === 'stock' && h.symbol.toUpperCase() === stockSymbol.trim().toUpperCase()
      );

      let holdingId = targetHolding?.id;

      if (!targetHolding) {
        const newHoldingId = `inv_stock_${Date.now()}`;
        const targetDemat = dematAccountId || accounts.find((a) => a.type === 'demat')?.id || accountId;
        addHolding({
          symbol: stockSymbol.trim().toUpperCase(),
          name: stockName.trim() || stockSymbol.trim().toUpperCase(),
          assetType: 'stock',
          dematAccountId: targetDemat,
          quantity: 0,
          averageBuyPrice: parsedStockPrice,
          currentPrice: parsedStockPrice,
          lastPriceUpdate: date,
        });
        holdingId = newHoldingId;
      }

      const totalFee = isWithoutCharges ? 0 : (stockCharges?.totalCharges || 0);
      const feeNote = `Brokerage & Taxes: ${actionType.toUpperCase()} ${parsedStockQty}x ${stockSymbol.trim().toUpperCase()}`;

      recordInvestmentAction({
        holdingId: holdingId!,
        action: actionType,
        quantity: parsedStockQty,
        price: parsedStockPrice,
        accountId: accountId,
        targetDematAccountId: dematAccountId,
        asTransfer: true,
        date: date,
        note: `Stock ${actionType === 'buy' ? 'Buy' : 'Sell'} Trade${isWithoutCharges ? ' (Without Charges)' : ''}`,
        chargesAmount: totalFee,
        logChargesAsExpense: !isWithoutCharges && logChargesAsExpense && totalFee > 0,
        chargesNote: feeNote,
        categorizeProfitAsIncome: actionType === 'sell' ? categorizeProfitAsIncome : undefined,
        categorizeLossAsExpense: actionType === 'sell' ? categorizeLossAsExpense : undefined,
      });

      showToast(
        `Successfully executed ${actionType.toUpperCase()} order for ${parsedStockQty} shares of ${stockSymbol.toUpperCase()}! ${
          actionType === 'buy'
            ? `Debited ₹${formatINR(stockCharges?.netCashImpact || 0)} from ${selectedAccount?.name}`
            : `Credited ₹${formatINR(stockCharges?.netCashImpact || 0)} to ${selectedAccount?.name}`
        }${isWithoutCharges ? ' (Without Charges)' : ''}`,
        'success'
      );
      onClose();
    } else {
      // Mutual Fund Execution
      if (actionType === 'buy') {
        if (!mfSchemeName.trim()) {
          showToast('Please enter mutual fund scheme name', 'error');
          return;
        }
        if (parsedMfGross <= 0 || parsedMfNav <= 0) {
          showToast('Gross amount and NAV must be positive', 'error');
          return;
        }

        let targetHolding = holdings.find(
          (h) =>
            h.assetType === 'mutual_fund' &&
            ((mfSchemeCode && h.amfiSchemeCode === mfSchemeCode) ||
              h.symbol.toLowerCase() === mfSchemeName.toLowerCase())
        );

        let holdingId = targetHolding?.id;

        if (!targetHolding) {
          const targetDemat = dematAccountId || accounts.find((a) => a.type === 'demat')?.id || accountId;
          const generatedSymbol = mfSchemeCode || mfSchemeName.substring(0, 8).toUpperCase();
          addHolding({
            symbol: generatedSymbol,
            name: mfSchemeName.trim(),
            assetType: 'mutual_fund',
            amfiSchemeCode: mfSchemeCode || undefined,
            amfiSchemeName: mfSchemeName.trim(),
            dematAccountId: targetDemat,
            quantity: 0,
            averageBuyPrice: parsedMfNav,
            currentPrice: parsedMfNav,
            lastPriceUpdate: date,
          });
          holdingId = `inv_mf_${Date.now()}`;
        }

        const totalDuty = isWithoutCharges ? 0 : (mfBuyCharges?.totalCharges || 0);
        const feeNote = `SIP/Lumpsum Stamp Duty (0.005%): ${mfSchemeName.trim()}`;

        recordInvestmentAction({
          holdingId: holdingId!,
          action: 'buy',
          quantity: mfBuyCharges?.unitsAllotted || parsedMfGross / parsedMfNav,
          price: parsedMfNav,
          accountId: accountId,
          targetDematAccountId: dematAccountId,
          asTransfer: true,
          date: date,
          note: `${mfOrderType} Installment${isWithoutCharges ? ' (Without Charges)' : ''}`,
          chargesAmount: totalDuty,
          logChargesAsExpense: !isWithoutCharges && logChargesAsExpense && totalDuty > 0,
          chargesNote: feeNote,
        });

        showToast(
          `Successfully confirmed ${mfOrderType} of ₹${formatINR(parsedMfGross)} with ${mfBuyCharges?.unitsAllotted} units allotted!${isWithoutCharges ? ' (Without Charges)' : ''}`,
          'success'
        );
        onClose();
      } else {
        // Mutual Fund Redemption (Sell)
        if (!currentHolding) {
          showToast('Please select a mutual fund holding to redeem', 'error');
          return;
        }
        if (parsedMfUnits <= 0 || parsedMfNav <= 0) {
          showToast('Redemption units and NAV must be positive', 'error');
          return;
        }
        if (parsedMfUnits > currentHolding.quantity) {
          showToast(`Cannot redeem ${parsedMfUnits} units; you only own ${currentHolding.quantity.toFixed(4)}`, 'error');
          return;
        }

        const exitLoadDeduction = isWithoutCharges ? 0 : (mfSellBreakdown?.exitLoadAmt || 0);
        const feeNote = exitLoadDeduction > 0 ? `Redemption Exit Load (${mfExitLoadPct}%): ${currentHolding.name}` : undefined;

        recordInvestmentAction({
          holdingId: currentHolding.id,
          action: 'sell',
          quantity: parsedMfUnits,
          price: parsedMfNav,
          accountId: accountId,
          targetDematAccountId: dematAccountId || currentHolding.dematAccountId,
          asTransfer: true,
          date: date,
          note: `Mutual Fund Redemption (${parsedMfUnits.toFixed(4)} units)${isWithoutCharges ? ' (Without Charges)' : ''}`,
          chargesAmount: exitLoadDeduction,
          logChargesAsExpense: !isWithoutCharges && logChargesAsExpense && exitLoadDeduction > 0,
          chargesNote: feeNote,
          categorizeProfitAsIncome: categorizeProfitAsIncome,
          categorizeLossAsExpense: categorizeLossAsExpense,
        });

        showToast(
          `Successfully redeemed ${parsedMfUnits.toFixed(4)} units of ${currentHolding.name}! Credited ₹${formatINR(
            mfSellBreakdown?.netCredit || 0
          )} to ${selectedAccount?.name}${isWithoutCharges ? ' (Without Charges)' : ''}`,
          'success'
        );
        onClose();
      }
    }
  };

  return createPortal(
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '48rem',
          maxHeight: '85vh',
        }}
        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden isolate animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
      {/* ========================================================= */}
      {/* FULL-SCREEN TOP APP BAR                                   */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 pt-safe flex items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/20 shrink-0">
            <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                Trade & Investment Desk
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hidden xs:inline-flex items-center gap-1">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
                Double-Entry Bank Integrated
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Execute buy and sell orders with live Indian statutory taxes (STT, GST, Stamp Duty) & passbook syncing
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* ========================================================= */}
      {/* SCROLLABLE MAIN TRADING DESK BODY                         */}
      {/* ========================================================= */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-8 py-6 pb-safe pb-28">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* PRIMARY ORDER TYPE SWITCHER: BUY VS SELL */}
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-200/70 dark:bg-slate-800/80 rounded-2xl border border-slate-300/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setActionType('buy')}
              className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                actionType === 'buy'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
              <span>BUY (Purchase / Invest)</span>
            </button>

            <button
              type="button"
              onClick={() => setActionType('sell')}
              className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                actionType === 'sell'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingDown className="w-4 h-4 stroke-[2.5]" />
              <span>SELL (Redeem / Exit Position)</span>
            </button>
          </div>

          {/* ASSET CLASS SELECTOR */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => {
                setAssetClass('stock');
                setSelectedHoldingId('custom');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                assetClass === 'stock'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Equities / Stocks</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 font-mono">
                {existingStocks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAssetClass('mutual_fund');
                setSelectedHoldingId('custom');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                assetClass === 'mutual_fund'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Mutual Funds</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 font-mono">
                {existingMFs.length}
              </span>
            </button>
          </div>

          {/* CHARGES MODE SWITCHER: INTEGRATED TRADE WITH OR WITHOUT CHARGES */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Statutory Charges & Brokerage Mode
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Choose whether to include Indian regulatory taxes (STT, Stamp Duty, GST, DP fee) or execute a clean trade without charges
              </span>
            </div>

            <div className="inline-flex p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => setChargesMode('with_charges')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  chargesMode === 'with_charges'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>With Charges & Taxes</span>
              </button>

              <button
                type="button"
                onClick={() => setChargesMode('without_charges')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  chargesMode === 'without_charges'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Without Charges (Clean)</span>
              </button>
            </div>
          </div>

          {/* TWO COLUMN TRADING WORKSPACE */}
          <form onSubmit={handleExecute} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ========================================================= */}
            {/* LEFT COLUMN: ORDER PARAMETERS & ASSET FORM                */}
            {/* ========================================================= */}
            <div className="lg:col-span-7 space-y-5">
              {/* Asset Holding Picker */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    {actionType === 'buy' ? 'Select Asset to Buy or Add New' : 'Select Asset from Portfolio to Sell'}
                  </label>
                  {selectedHoldingId !== 'custom' && (
                    <button
                      type="button"
                      onClick={() => setSelectedHoldingId('custom')}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      + Enter Custom Asset
                    </button>
                  )}
                </div>

                <select
                  value={selectedHoldingId}
                  onChange={(e) => handleSelectHolding(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 shadow-2xs"
                >
                  <option value="custom">-- Enter New Asset / Custom Ticker --</option>
                  {assetClass === 'stock'
                    ? existingStocks.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.symbol} - {s.name} ({s.quantity} shares @ ₹{s.currentPrice})
                        </option>
                      ))
                    : existingMFs.map((mf) => (
                        <option key={mf.id} value={mf.id}>
                          {mf.name} ({mf.quantity.toFixed(3)} units @ ₹{mf.currentPrice})
                        </option>
                      ))}
                </select>

                {/* Selected Asset Portfolio Snapshot Card */}
                {currentHolding && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Holding Qty</span>
                      <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {assetClass === 'stock' ? `${currentHolding.quantity} Shares` : `${currentHolding.quantity.toFixed(3)} Units`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Avg Cost</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        {formatINR(currentHolding.averageBuyPrice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Current Price / NAV</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        {formatINR(currentHolding.currentPrice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Current Value</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatINR(currentHolding.quantity * currentHolding.currentPrice)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* STOCK SPECIFIC FORM */}
              {assetClass === 'stock' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Equity Order Specifications</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        NSE / BSE Ticker Symbol
                      </label>
                      <input
                        type="text"
                        required
                        value={stockSymbol}
                        onChange={(e) => setStockSymbol(e.target.value.toUpperCase())}
                        placeholder="e.g. RELIANCE, INFY, HDFCBANK"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={stockName}
                        onChange={(e) => setStockName(e.target.value)}
                        placeholder="e.g. Reliance Industries Ltd"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {selectedHoldingId === 'custom' && (
                    <div>
                      <span className="text-[10px] font-semibold text-blue-900 dark:text-blue-300 block mb-1">
                        Quick pick popular Indian stocks & ETFs (100% Offline):
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                        {OFFLINE_STOCK_DIRECTORY.slice(0, 8).map((st) => (
                          <button
                            key={st.symbol}
                            type="button"
                            onClick={() => {
                              setStockSymbol(st.symbol);
                              setStockName(st.name);
                              setStockPrice(st.referencePrice.toString());
                            }}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                              stockSymbol === st.symbol
                                ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                            }`}
                          >
                            {st.symbol} (₹{st.referencePrice.toLocaleString('en-IN')})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stock Order Specifications - Clearly Labeled Fields */}
                  <div className="space-y-4 pt-1">
                    {/* Field 1: Quantity */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          1. Quantity ({actionType === 'buy' ? 'Number of Shares to Buy' : 'Number of Shares to Sell'})
                        </label>
                        {actionType === 'sell' && currentHolding && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-medium">Quick Fill:</span>
                            {[25, 50, 75, 100].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => handleStockPercentFill(pct)}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md cursor-pointer transition-all ${
                                  pct === 100
                                    ? 'bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {pct === 100 ? '100% (All)' : `${pct}%`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        required
                        value={stockQuantity}
                        onChange={(e) => setStockQuantity(e.target.value)}
                        placeholder="Enter number of shares"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold tabular-nums outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {actionType === 'sell' && currentHolding && (
                        <span className="text-[10px] text-slate-400 block">
                          Available in portfolio: <strong>{currentHolding.quantity} shares</strong>
                        </span>
                      )}
                    </div>

                    {/* Field 2: Price per Share */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          2. Price per Share (₹)
                        </label>
                        {currentHolding && currentHolding.currentPrice > 0 && (
                          <button
                            type="button"
                            onClick={() => setStockPrice(currentHolding.currentPrice.toString())}
                            className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>Use Current Market Price (CMP: ₹{currentHolding.currentPrice})</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        step="0.05"
                        min="0.05"
                        required
                        value={stockPrice}
                        onChange={(e) => setStockPrice(e.target.value)}
                        placeholder="Trade execution price per share in ₹"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold tabular-nums outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-[10px] text-slate-400 block">
                        Actual fill or execution price per share at which your trade was placed.
                      </span>
                    </div>

                    {/* Field 3: Brokerage Charges */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          3. Brokerage Commission (₹)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setBrokeragePerOrder('0')}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 cursor-pointer"
                          >
                            ₹0 (Free Delivery)
                          </button>
                          <button
                            type="button"
                            onClick={() => setBrokeragePerOrder('20')}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 cursor-pointer"
                          >
                            ₹20 (Discount Broker)
                          </button>
                        </div>
                      </div>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={brokeragePerOrder}
                        onChange={(e) => setBrokeragePerOrder(e.target.value)}
                        placeholder="Brokerage fee per order in ₹"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold tabular-nums outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-[10px] text-slate-400 block">
                        Broker's commission per order. Discount brokers (Zerodha, Groww, AngelOne) charge flat ₹20 or ₹0 on equity delivery.
                      </span>
                    </div>

                    {/* Field 4: Exchange Selector (NSE vs BSE) */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        4. Primary Stock Exchange:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                          !isBSE
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          <input
                            type="radio"
                            checked={!isBSE}
                            onChange={() => setIsBSE(false)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-semibold">NSE (0.00297% turnover fee)</span>
                        </label>

                        <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                          isBSE
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          <input
                            type="radio"
                            checked={isBSE}
                            onChange={() => setIsBSE(true)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-semibold">BSE (0.00375% turnover fee)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MUTUAL FUND SPECIFIC FORM */}
              {assetClass === 'mutual_fund' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Mutual Fund Order Specifications</span>
                  </h3>

                  {actionType === 'buy' && (
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setMfOrderType('SIP')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          mfOrderType === 'SIP'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Monthly SIP Installment
                      </button>
                      <button
                        type="button"
                        onClick={() => setMfOrderType('LUMPSUM')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          mfOrderType === 'LUMPSUM'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        One-Time Lumpsum
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Scheme Name
                      </label>
                      <input
                        type="text"
                        required
                        value={mfSchemeName}
                        onChange={(e) => setMfSchemeName(e.target.value)}
                        placeholder="e.g. Parag Parikh Flexi Cap Direct Growth"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        AMFI Code
                      </label>
                      <input
                        type="text"
                        value={mfSchemeCode}
                        onChange={(e) => setMfSchemeCode(e.target.value)}
                        placeholder="e.g. 122639"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {selectedHoldingId === 'custom' && (
                    <div>
                      <span className="text-[10px] font-semibold text-emerald-900 dark:text-emerald-300 block mb-1">
                        Quick pick verified popular funds (100% Offline):
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                        {POPULAR_MF_SCHEMES.slice(0, 8).map((mf) => (
                          <button
                            key={mf.code}
                            type="button"
                            onClick={() => {
                              setMfSchemeName(mf.name);
                              setMfSchemeCode(mf.code);
                              setMfNav(mf.nav.toFixed(2));
                            }}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                              mfSchemeCode === mf.code
                                ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                            }`}
                          >
                            {mf.name.split('-')[0].trim()} (NAV ₹{mf.nav.toFixed(2)})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {actionType === 'buy' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Gross Investment Amount (₹)
                        </label>
                        <input
                          type="number"
                          step="100"
                          min="100"
                          required
                          value={mfGrossAmount}
                          onChange={(e) => setMfGrossAmount(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold tabular-nums outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Applicable NAV (₹)
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          required
                          value={mfNav}
                          onChange={(e) => setMfNav(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold tabular-nums outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Redemption Units (Quantity)
                        </label>
                        {currentHolding && currentHolding.quantity > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-medium">Quick Fill:</span>
                            <button
                              type="button"
                              onClick={() => handleMfPercentFill(25)}
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              25%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMfPercentFill(50)}
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              50%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMfPercentFill(75)}
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              75%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMfPercentFill(100)}
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer"
                            >
                              100% (All)
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            required
                            value={mfRedeemUnits}
                            onChange={(e) => setMfRedeemUnits(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold tabular-nums outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          {currentHolding && (
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                              Held: {currentHolding.quantity.toFixed(4)} units
                            </span>
                          )}
                        </div>

                        <div>
                          <input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            required
                            value={mfNav}
                            onChange={(e) => setMfNav(e.target.value)}
                            placeholder="Redemption NAV"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold tabular-nums outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <span className="text-[10px] text-slate-400 mt-0.5 block">Latest Scheme NAV (₹)</span>
                        </div>

                        <div>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={mfExitLoadPct}
                            onChange={(e) => setMfExitLoadPct(e.target.value)}
                            placeholder="Exit Load %"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold tabular-nums outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <span className="text-[10px] text-slate-400 mt-0.5 block">Exit Load % (Usually 0% or 1%)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SETTLEMENT BANK, DEMAT & DATE */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Settlement Accounts & Double-Entry Integration</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Bank Account */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {actionType === 'buy' ? 'Funding Bank Account (Debit)' : 'Settlement Bank Account (Credit)'}
                    </label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold outline-none cursor-pointer focus:ring-2 focus:ring-purple-500"
                    >
                      {accounts
                        .filter((a) => a.type !== 'demat')
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({formatINR(a.balance)}) - {a.type.toUpperCase()}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Target / Source Demat Account */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {actionType === 'buy' ? 'Target Demat Account (Credit)' : 'Source Demat Account (Debit)'}
                    </label>
                    <select
                      value={dematAccountId}
                      onChange={(e) => setDematAccountId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold outline-none cursor-pointer focus:ring-2 focus:ring-purple-500"
                    >
                      {accounts
                        .filter((a) => a.type === 'demat')
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({formatINR(a.balance)})
                          </option>
                        ))}
                      {accounts.filter((a) => a.type === 'demat').length === 0 && (
                        <option value="">No Demat Account Found</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Transfer summary pill */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-xs">
                  <ArrowRightLeft className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-purple-900 dark:text-purple-200">
                      {actionType === 'buy' ? (
                        <>Transfer: <span className="underline">{accounts.find((a) => a.id === accountId)?.name || 'Bank'}</span> ➔ <span className="underline">{accounts.find((a) => a.id === dematAccountId)?.name || 'Demat'}</span></>
                      ) : (
                        <>Transfer: <span className="underline">{accounts.find((a) => a.id === dematAccountId)?.name || 'Demat'}</span> ➔ <span className="underline">{accounts.find((a) => a.id === accountId)?.name || 'Bank'}</span></>
                      )}
                    </span>
                    <p className="text-[10px] text-purple-600/90 dark:text-purple-300">
                      Direct transfer logged to passbook. Demat account balance automatically tracks active investment market value.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Execution Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Sell Action: Profit as Income or Loss as Expense Categorization Toggles */}
                {actionType === 'sell' && (
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700/80">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                      <div className="pr-2">
                        <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                          Categorize Booked Profit as Income
                        </span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block">
                          Posts realized net gain to Capital Gains category in passbook & analytics
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
                          Posts realized capital loss to Investment Loss expense category in analytics
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

                {/* Dual-write toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Log Taxes & Brokerage as Passbook Expense
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Automatically posts STT, GST, and turnover fees to your expense analytics
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={logChargesAsExpense}
                    onChange={(e) => setLogChargesAsExpense(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* RIGHT COLUMN: REAL-TIME CONTRACT NOTE & STATUTORY CHARGES */}
            {/* ========================================================= */}
            <div className="lg:col-span-5 space-y-5">
              {/* LIVE CONTRACT NOTE CARD */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Live Contract Note
                      </h4>
                      <span className="text-[10px] text-slate-400">SEBI & Indian Stamp Act Standards</span>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg ${
                      actionType === 'buy'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {actionType} {assetClass === 'stock' ? 'Delivery' : assetClass.toUpperCase()}
                  </span>
                </div>

                {/* Stock Contract Note Details */}
                {assetClass === 'stock' && stockCharges && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Gross Trade Value:</span>
                      <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                        ₹{formatINR(stockCharges.tradeValue)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Total Statutory Taxes & Brokerage:</span>
                      <span className="font-extrabold tabular-nums text-amber-600 dark:text-amber-400">
                        ₹{formatINR(stockCharges.totalCharges)}
                      </span>
                    </div>

                    {/* Stock Realized P&L Pill when selling */}
                    {actionType === 'sell' && stockRealizedPnL && (
                      <div
                        className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                          stockRealizedPnL.isProfit
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                        }`}
                      >
                        <div>
                          <span className="text-[10px] font-bold uppercase block opacity-80">
                            Realized Capital Gain / P&L
                          </span>
                          <span className="font-extrabold tabular-nums text-sm">
                            {stockRealizedPnL.isProfit ? '+' : ''}₹{formatINR(stockRealizedPnL.pnl)} (
                            {stockRealizedPnL.pnlPct.toFixed(2)}%)
                          </span>
                        </div>
                        {stockRealizedPnL.isProfit ? (
                          <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>
                    )}

                    {/* Collapsible itemized fee breakdown */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                      <button
                        type="button"
                        onClick={() => setIsFeeBreakdownExpanded(!isFeeBreakdownExpanded)}
                        className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        <span>Statutory Taxes Breakdown</span>
                        {isFeeBreakdownExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isFeeBreakdownExpanded && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800/80 text-[11px] text-slate-500">
                          <div className="flex justify-between py-1">
                            <span>Brokerage Fee:</span>
                            <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                              ₹{stockCharges.brokerage.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span>STT (0.1% Buy & Sell):</span>
                            <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                              ₹{stockCharges.stt.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span>Stamp Duty (0.015% on Buy):</span>
                            <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                              ₹{stockCharges.stampDuty.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span>Exchange Turnover Fee ({isBSE ? 'BSE' : 'NSE'}):</span>
                            <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                              ₹{stockCharges.exchangeFee.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span>SEBI Turnover Charge:</span>
                            <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                              ₹{stockCharges.sebiFee.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span>GST (18% on fees):</span>
                            <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                              ₹{stockCharges.gst.toFixed(2)}
                            </span>
                          </div>
                          {actionType === 'sell' && (
                            <div className="flex justify-between py-1">
                              <span>CDSL Depository (DP) Charges:</span>
                              <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                                ₹{stockCharges.dpCharges.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Break-even selling price indicator on Buy */}
                    {actionType === 'buy' && stockCharges.breakEvenPrice && (
                      <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 text-blue-900 dark:text-blue-200 text-xs">
                        <span className="font-bold flex items-center gap-1.5">
                          <span>🎯 Break-Even Selling Price:</span>
                          <span className="font-extrabold tabular-nums">
                            ₹{formatINR(stockCharges.breakEvenPrice)} / share
                          </span>
                        </span>
                        <p className="text-[10px] text-blue-700 dark:text-blue-300 mt-0.5">
                          Recovers all buy taxes + sell brokerage, STT & DP charges with zero net loss.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Mutual Fund Contract Note Details (Buy) */}
                {assetClass === 'mutual_fund' && actionType === 'buy' && mfBuyCharges && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Gross Investment Amount:</span>
                      <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                        ₹{formatINR(mfBuyCharges.grossAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Govt. Stamp Duty (0.005%):</span>
                      <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
                        -₹{mfBuyCharges.stampDuty.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Net Invested Amount:</span>
                      <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                        ₹{formatINR(mfBuyCharges.netInvestedAmount)}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">
                          Estimated Units Allotted
                        </span>
                        <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-200 tabular-nums">
                          {mfBuyCharges.unitsAllotted.toFixed(4)} Units
                        </span>
                      </div>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                        @ ₹{parsedMfNav} NAV
                      </span>
                    </div>
                  </div>
                )}

                {/* Mutual Fund Contract Note Details (Sell: Redemption) */}
                {assetClass === 'mutual_fund' && actionType === 'sell' && mfSellBreakdown && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Gross Redemption Value:</span>
                      <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                        ₹{formatINR(mfSellBreakdown.grossVal)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Exit Load ({mfExitLoadPct}%):</span>
                      <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
                        {mfSellBreakdown.exitLoadAmt > 0 ? `-₹${formatINR(mfSellBreakdown.exitLoadAmt)}` : '₹0.00 (Nil)'}
                      </span>
                    </div>

                    {/* Capital Gain Pill */}
                    {mfSellBreakdown.realizedGain !== null && (
                      <div
                        className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                          mfSellBreakdown.isProfit
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                        }`}
                      >
                        <div>
                          <span className="text-[10px] font-bold uppercase block opacity-80">
                            Estimated Capital Gain
                          </span>
                          <span className="font-extrabold tabular-nums text-sm">
                            {mfSellBreakdown.isProfit ? '+' : ''}₹{formatINR(mfSellBreakdown.realizedGain)} (
                            {(mfSellBreakdown.gainPct || 0).toFixed(2)}%)
                          </span>
                        </div>
                        {mfSellBreakdown.isProfit ? (
                          <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* FINAL CASH IMPACT BANNER */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                      {actionType === 'buy' ? 'Total Cash Outflow (Debited):' : 'Net Cash Inflow (Credited):'}
                    </span>
                    <span
                      className={`text-lg font-black tabular-nums ${
                        actionType === 'buy'
                          ? 'text-slate-900 dark:text-white'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      ₹
                      {formatINR(
                        assetClass === 'stock'
                          ? stockCharges?.netCashImpact || 0
                          : actionType === 'buy'
                          ? mfBuyCharges?.grossAmount || 0
                          : mfSellBreakdown?.netCredit || 0
                      )}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {actionType === 'buy' ? 'Debited from ' : 'Deposited directly to '}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {accounts.find((a) => a.id === accountId)?.name || 'Linked Account'}
                    </strong>
                    .
                  </p>
                </div>

                {/* PRIMARY SUBMIT ACTION BUTTON */}
                <button
                  type="submit"
                  className={`w-full py-4 px-6 rounded-2xl font-black text-sm text-white shadow-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    actionType === 'buy'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30 ring-2 ring-rose-500/20'
                  }`}
                >
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  <span>
                    {actionType === 'buy'
                      ? `Confirm & Execute BUY Order`
                      : `Confirm & Execute SELL Order`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>,
  document.body
  );
};
