/**
 * Strict FIFO (First-In, First-Out) calculation engine for shares, mutual funds, and securities.
 *
 * Principles:
 * 1. Each 'buy' transaction creates an open lot of [quantity, unit price, date].
 * 2. Each 'sell' transaction consumes shares from the earliest open buy lot(s) first.
 * 3. The average buy price of the remaining holding is strictly derived from the remaining open lots:
 *    remainingAvgPrice = sum(lot.quantity * lot.price) / sum(lot.quantity)
 * 4. Realized P&L on each sell = sellAmount - sum(depletedLotQuantity * lotOriginalBuyPrice)
 * 5. Stock splits adjust quantities and unit prices of existing open lots inversely.
 * 6. Bonus shares add zero-cost lots (tax standard in Indian Capital Gains laws).
 */

import { InvestmentHolding, InvestmentTransaction } from '../types';
import { parseDate } from './formatters';

export interface FifoLot {
  quantity: number;
  price: number;
  date: string;
}

export interface FifoResult {
  remainingQuantity: number;
  averageBuyPrice: number;
  remainingCostBasis: number;
  openLots: FifoLot[];
  totalRealizedProfit: number;
  totalRealizedCost: number;
  totalSoldAmount: number;
  perTransactionProfits: Map<string, number>;
}

export function computeHoldingFifo(
  ledger: InvestmentTransaction[],
  fallbackPrice = 0
): FifoResult {
  // Pre-sort transactions chronologically with pre-parsed timestamps
  const sorted = [...(ledger || [])].sort((a, b) => {
    const timeA = parseDate(a.date).getTime() || 0;
    const timeB = parseDate(b.date).getTime() || 0;
    return timeA - timeB;
  });

  const openLots: FifoLot[] = [];
  const perTransactionProfits = new Map<string, number>();

  let totalRealizedProfit = 0;
  let totalRealizedCost = 0;
  let totalSoldAmount = 0;

  for (const t of sorted) {
    if (t.type === 'buy') {
      const unitPrice =
        t.price > 0 ? t.price : t.quantity > 0 ? t.totalAmount / t.quantity : fallbackPrice;
      if (t.quantity > 0) {
        openLots.push({
          quantity: t.quantity,
          price: unitPrice,
          date: t.date,
        });
      }
    } else if (t.type === 'sell' || t.type === 'principal_repayment') {
      let qtyToSell = t.quantity;
      let costOfSoldLots = 0;

      // Deplete from earliest open lots (FIFO)
      while (qtyToSell > 0.000001 && openLots.length > 0) {
        const lot = openLots[0];
        if (lot.quantity <= qtyToSell) {
          costOfSoldLots += lot.quantity * lot.price;
          qtyToSell -= lot.quantity;
          openLots.shift();
        } else {
          costOfSoldLots += qtyToSell * lot.price;
          lot.quantity -= qtyToSell;
          qtyToSell = 0;
        }
      }

      // If sell/repayment quantity exceeds recorded buy lots (e.g. partial imported history), use fallback price
      if (qtyToSell > 0.000001) {
        costOfSoldLots += qtyToSell * fallbackPrice;
      }

      const realizedProfitThisSell = t.totalAmount - costOfSoldLots;
      perTransactionProfits.set(t.id, Number(realizedProfitThisSell.toFixed(2)));

      totalRealizedProfit += realizedProfitThisSell;
      totalRealizedCost += costOfSoldLots;
      totalSoldAmount += t.totalAmount;
    } else if (t.type === 'split') {
      let multiplier = 1;
      if (t.splitRatio && t.splitRatio.includes(':')) {
        const [oldR, newR] = t.splitRatio.split(':').map(Number);
        if (oldR > 0 && newR > 0) {
          multiplier = newR / oldR;
        }
      } else if (t.newQuantity && t.newQuantity > 0) {
        const currentQty = openLots.reduce((acc, l) => acc + l.quantity, 0);
        if (currentQty > 0) {
          multiplier = t.newQuantity / currentQty;
        }
      } else if (t.quantity > 0) {
        const currentQty = openLots.reduce((acc, l) => acc + l.quantity, 0);
        if (currentQty > 0) {
          multiplier = (currentQty + t.quantity) / currentQty;
        }
      }

      if (multiplier > 0 && multiplier !== 1) {
        for (const lot of openLots) {
          lot.quantity = Number((lot.quantity * multiplier).toFixed(4));
          lot.price = lot.price / multiplier;
        }
      }
    } else if (t.type === 'bonus') {
      let bonusUnits = 0;
      if (t.bonusRatio && t.bonusRatio.includes(':')) {
        const [bA, bB] = t.bonusRatio.split(':').map(Number);
        if (bA > 0 && bB > 0) {
          const currentQty = openLots.reduce((acc, l) => acc + l.quantity, 0);
          bonusUnits = Math.floor(currentQty * (bA / bB));
        }
      } else if (t.quantity > 0) {
        bonusUnits = t.quantity;
      }

      if (bonusUnits > 0) {
        // Bonus shares in Indian tax regulations enter at zero cost basis
        openLots.push({
          quantity: bonusUnits,
          price: 0,
          date: t.date,
        });
      }
    } else if (t.type === 'interest') {
      // For Provident Funds (PF) or accumulating securities where interest compounds into balance:
      // If quantity is credited, it increases the balance at zero acquisition cost, reflecting pure interest gain
      if (t.quantity > 0 && (t.price === 0 || t.price === 1)) {
        openLots.push({
          quantity: t.quantity,
          price: 0,
          date: t.date,
        });
      }
    } else if (t.type === 'demerger') {
      // Stock Demerger / Spinoff (Indian Income Tax Sec 49(2C)/49(2D))
      // Apportions original cost of acquisition between parent company and demerged entities
      if (t.demergerOutcome === 'extinguish_original') {
        openLots.length = 0;
      } else {
        let costAllocPct = t.costAllocationPercentage !== undefined ? t.costAllocationPercentage : 20;
        if (t.demergedEntities && t.demergedEntities.length > 0) {
          costAllocPct = t.demergedEntities.reduce((sum, e) => sum + (e.costAllocationPercentage || 0), 0);
        }
        costAllocPct = Math.min(100, Math.max(0, costAllocPct));
        const parentRetainedMultiplier = Math.max(0, (100 - costAllocPct) / 100);

        for (const lot of openLots) {
          lot.price = Number((lot.price * parentRetainedMultiplier).toFixed(4));
        }
        // In a corporate spinoff/demerger, the parent company's share count remains strictly unchanged.
        // Lots are NOT scaled, preserving exact historical purchase lots.
      }
    }
  }

  // Derive remaining holding quantity and remaining cost basis strictly from active open lots
  let remainingQuantity = 0;
  let remainingCostBasis = 0;

  for (const lot of openLots) {
    if (lot.quantity > 0.00001) {
      remainingQuantity += lot.quantity;
      remainingCostBasis += lot.quantity * lot.price;
    }
  }

  const averageBuyPrice =
    remainingQuantity > 0.0001
      ? Number((remainingCostBasis / remainingQuantity).toFixed(2))
      : 0;

  return {
    remainingQuantity: Number(remainingQuantity.toFixed(4)),
    averageBuyPrice,
    remainingCostBasis: Number(remainingCostBasis.toFixed(2)),
    openLots,
    totalRealizedProfit: Number(totalRealizedProfit.toFixed(2)),
    totalRealizedCost: Number(totalRealizedCost.toFixed(2)),
    totalSoldAmount: Number(totalSoldAmount.toFixed(2)),
    perTransactionProfits,
  };
}

/**
 * Determine the exact number of shares held in a holding as of a specific date.
 * Strictly filters the holding's transaction ledger for transactions on or before targetDate,
 * and executes chronological FIFO lot calculation.
 * If targetDate is prior to any transactions, returns 0.
 * If holding has no transactions, falls back to holding.quantity.
 */
export function getHoldingSharesAsOfDate(
  holding: InvestmentHolding | { transactions?: InvestmentTransaction[]; quantity: number; averageBuyPrice?: number },
  targetDate: string
): number {
  if (!holding) return 0;
  const ledger = holding.transactions || [];
  if (ledger.length === 0) {
    return holding.quantity || 0;
  }

  const targetTime = parseDate(targetDate).getTime() || 0;
  const priorTxs = ledger.filter((t) => (parseDate(t.date).getTime() || 0) <= targetTime);

  if (priorTxs.length === 0) {
    const validTimes = ledger
      .map((t) => parseDate(t.date).getTime() || 0)
      .filter((tm) => tm > 0);
    if (validTimes.length > 0) {
      const earliestTime = Math.min(...validTimes);
      if (targetTime < earliestTime) {
        return 0;
      }
    }
    return holding.quantity || 0;
  }

  const fifo = computeHoldingFifo(priorTxs, holding.averageBuyPrice || 0);
  return Math.max(0, fifo.remainingQuantity);
}

/**
 * Determine the exact share quantity and average buy price of a holding as of a specific date.
 */
export function getHoldingStateAsOfDate(
  holding: InvestmentHolding | { transactions?: InvestmentTransaction[]; quantity: number; averageBuyPrice?: number },
  targetDate: string
): { quantity: number; averageBuyPrice: number } {
  if (!holding) return { quantity: 0, averageBuyPrice: 0 };
  const ledger = holding.transactions || [];
  if (ledger.length === 0) {
    return {
      quantity: holding.quantity || 0,
      averageBuyPrice: holding.averageBuyPrice || 0,
    };
  }

  const targetTime = parseDate(targetDate).getTime() || 0;
  const priorTxs = ledger.filter((t) => (parseDate(t.date).getTime() || 0) <= targetTime);

  if (priorTxs.length === 0) {
    const validTimes = ledger
      .map((t) => parseDate(t.date).getTime() || 0)
      .filter((tm) => tm > 0);
    if (validTimes.length > 0) {
      const earliestTime = Math.min(...validTimes);
      if (targetTime < earliestTime) {
        return { quantity: 0, averageBuyPrice: 0 };
      }
    }
    return {
      quantity: holding.quantity || 0,
      averageBuyPrice: holding.averageBuyPrice || 0,
    };
  }

  const fifo = computeHoldingFifo(priorTxs, holding.averageBuyPrice || 0);
  return {
    quantity: Math.max(0, fifo.remainingQuantity),
    averageBuyPrice: fifo.averageBuyPrice || holding.averageBuyPrice || 0,
  };
}
