/**
 * Indian Markets Statutory Taxes and Regulatory Charges Engine
 *
 * Covers:
 * 1. Mutual Funds (SIPs & Lumpsum):
 *    - Stamp Duty (0.005% deducted before unit allotment)
 *    - Net invested amount and accurate unit allocation
 * 2. Equity Delivery (Stocks):
 *    - Brokerage
 *    - STT (Securities Transaction Tax: 0.1% Buy & Sell)
 *    - Stamp Duty (0.015% on Buy)
 *    - Exchange Turnover Charges (NSE: 0.00297%, BSE: 0.00375%)
 *    - SEBI Turnover Charges (0.0001% = ₹10/crore)
 *    - GST (18% on Brokerage + Exchange Fees + SEBI Fees)
 *    - Depository Participant (DP) Charges (CDSL ₹15.93 flat on Sell)
 *    - Exact Break-Even Price Calculator
 */

export interface StockChargesBreakdown {
  tradeValue: number;
  brokerage: number;
  stt: number;
  stampDuty: number;
  exchangeFee: number;
  sebiFee: number;
  gst: number;
  dpCharges: number;
  totalCharges: number;
  netCashImpact: number; // Buy: tradeValue + charges (outflow), Sell: tradeValue - charges (inflow)
  breakEvenPrice?: number;
}

export interface MutualFundChargesBreakdown {
  grossAmount: number;
  stampDuty: number;
  customFees: number;
  netInvestedAmount: number;
  nav: number;
  unitsAllotted: number;
  totalCharges: number;
}

/**
 * Calculates Mutual Fund Stamp Duty (0.005%) and units allotted.
 */
export function calculateMutualFundCharges(
  grossAmount: number,
  nav: number,
  customFees: number = 0
): MutualFundChargesBreakdown {
  const safeGross = Math.max(0, Number(grossAmount) || 0);
  const safeNav = Number(nav) > 0 ? Number(nav) : 10;
  const safeCustomFees = Math.max(0, Number(customFees) || 0);

  if (safeGross <= 0) {
    return {
      grossAmount: 0,
      stampDuty: 0,
      customFees: 0,
      netInvestedAmount: 0,
      nav: safeNav,
      unitsAllotted: 0,
      totalCharges: 0,
    };
  }

  // Stamp Duty is 0.005% of gross investment amount in India
  const stampDuty = Number((safeGross * 0.00005).toFixed(2));
  const totalCharges = Number((stampDuty + safeCustomFees).toFixed(2));
  const netInvestedAmount = Math.max(0, Number((safeGross - totalCharges).toFixed(2)));
  const unitsAllotted = Number((netInvestedAmount / safeNav).toFixed(4));

  return {
    grossAmount: safeGross,
    stampDuty,
    customFees: safeCustomFees,
    netInvestedAmount,
    nav: safeNav,
    unitsAllotted,
    totalCharges,
  };
}

/**
 * Calculates statutory taxes & charges for Stock Delivery trades in Indian Markets.
 * Supports both object params and positional arguments for maximum compatibility.
 */
export function calculateStockDeliveryCharges(
  paramsOrQuantity:
    | {
        type: 'buy' | 'sell';
        quantity: number;
        price: number;
        brokeragePerOrder?: number;
        isBSE?: boolean;
      }
    | number
    | 'buy'
    | 'sell',
  priceOrQuantity?: number,
  typeOrPrice?: 'buy' | 'sell' | number,
  brokeragePerOrder?: number,
  isBSE?: boolean
): StockChargesBreakdown {
  let type: 'buy' | 'sell' = 'buy';
  let quantity = 0;
  let price = 0;
  let brokerage = 0;
  let bse = false;

  if (typeof paramsOrQuantity === 'object' && paramsOrQuantity !== null) {
    type = paramsOrQuantity.type === 'sell' ? 'sell' : 'buy';
    quantity = Math.max(0, Number(paramsOrQuantity.quantity) || 0);
    price = Math.max(0, Number(paramsOrQuantity.price) || 0);
    brokerage = Math.max(0, Number(paramsOrQuantity.brokeragePerOrder) || 0);
    bse = Boolean(paramsOrQuantity.isBSE);
  } else if (typeof paramsOrQuantity === 'number') {
    quantity = Math.max(0, paramsOrQuantity || 0);
    price = Math.max(0, Number(priceOrQuantity) || 0);
    type = typeOrPrice === 'sell' ? 'sell' : 'buy';
    brokerage = Math.max(0, Number(brokeragePerOrder) || 0);
    bse = Boolean(isBSE);
  } else if (paramsOrQuantity === 'buy' || paramsOrQuantity === 'sell') {
    type = paramsOrQuantity;
    quantity = Math.max(0, Number(priceOrQuantity) || 0);
    price = Math.max(0, Number(typeOrPrice) || 0);
    brokerage = Math.max(0, Number(brokeragePerOrder) || 0);
    bse = Boolean(isBSE);
  }

  const tradeValue = Number((quantity * price).toFixed(2));

  if (quantity <= 0 || price <= 0) {
    return {
      tradeValue: 0,
      brokerage: 0,
      stt: 0,
      stampDuty: 0,
      exchangeFee: 0,
      sebiFee: 0,
      gst: 0,
      dpCharges: 0,
      totalCharges: 0,
      netCashImpact: 0,
      breakEvenPrice: 0,
    };
  }

  // 1. STT (Securities Transaction Tax): 0.1% on delivery buy and sell (rounded to nearest rupee by SEBI rule)
  const stt = Math.round(tradeValue * 0.001);

  // 2. Stamp Duty: 0.015% on Buy only
  const stampDuty = type === 'buy' ? Number((tradeValue * 0.00015).toFixed(2)) : 0;

  // 3. Exchange Turnover Charge: NSE 0.00297%, BSE 0.00375%
  const exchRate = bse ? 0.0000375 : 0.0000297;
  const exchangeFee = Number((tradeValue * exchRate).toFixed(2));

  // 4. SEBI Turnover Fee: ₹10 per crore = 0.0001%
  const sebiFee = Number((tradeValue * 0.000001).toFixed(2));

  // 5. GST: 18% on (Brokerage + Exchange Fee + SEBI Fee)
  const gstBase = brokerage + exchangeFee + sebiFee;
  const gst = Number((gstBase * 0.18).toFixed(2));

  // 6. DP Charges: ₹15.93 (₹13.50 + 18% GST) flat per scrip per day on Sell
  const dpCharges = type === 'sell' ? 15.93 : 0;

  const totalCharges = Number(
    (brokerage + stt + stampDuty + exchangeFee + sebiFee + gst + dpCharges).toFixed(2)
  );

  const netCashImpact =
    type === 'buy'
      ? Number((tradeValue + totalCharges).toFixed(2))
      : Number((tradeValue - totalCharges).toFixed(2));

  // Calculate Break-Even Selling Price per share for a Buy order
  let breakEvenPrice: number | undefined = undefined;
  if (type === 'buy' && quantity > 0) {
    const buyTotalOutflow = tradeValue + totalCharges;
    const sellFixedFees = brokerage * 1.18 + 15.93; // Sell brokerage + GST + DP charge
    const variableSellFeeRate = 0.001 + 1.18 * (exchRate + 0.000001); // STT + 1.18*(Exch + SEBI)

    const numerator = buyTotalOutflow + sellFixedFees;
    const denominator = quantity * (1 - variableSellFeeRate);

    if (denominator > 0) {
      breakEvenPrice = Number((numerator / denominator).toFixed(2));
    }
  }

  return {
    tradeValue,
    brokerage,
    stt,
    stampDuty,
    exchangeFee,
    sebiFee,
    gst,
    dpCharges,
    totalCharges,
    netCashImpact,
    breakEvenPrice,
  };
}
