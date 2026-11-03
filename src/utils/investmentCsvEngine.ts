import { InvestmentHolding, InvestmentTransaction, Transaction } from '../types';
import { formatDate, parseInvestmentTradeDate, getLatestTransactionPrice } from './formatters';
import { computeHoldingFifo } from './fifoCalculator';
import { fileService } from '../services/fileService';

export interface InvestmentCSVResult {
  success: boolean;
  importedHoldingsCount: number;
  importedTransactionsCount: number;
  errorMessage?: string;
  updatedHoldings: InvestmentHolding[];
  generatedTransactions: Transaction[];
  summaryMessage?: string;
}

export interface InvestmentCSVImportOptions {
  includeCharges?: boolean;
  linkToBankAccount?: boolean;
  bulkActionId?: string;
}

export interface InvestmentCSVExportOptions {
  includeCharges?: boolean;
}

/**
 * Split a standard CSV row handling quotes and escaped quotes
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Standard Sample template for Stocks CSV (Clean without charges)
 */
export const STOCKS_CSV_SAMPLE = `Stock Name,Symbol,ISIN,Type,Qty,Price,Value,Date
Reliance Industries Ltd,RELIANCE,INE002A01018,Buy,10,2950.00,29500.00,10/01/2026
Tata Consultancy Services,TCS,INE467B01029,Buy,5,3850.00,19250.00,12/01/2026
Infosys Limited,INFY,INE009A01021,Buy,25,1500.00,37500.00,14/01/2026
Infosys Limited,INFY,INE009A01021,Bonus,25,0.00,0.00,15/02/2026
Tata Consultancy Services,TCS,INE467B01029,Split,5,0.00,0.00,20/02/2026
Reliance Industries Ltd,RELIANCE,INE002A01018,Sell,2,3050.00,6100.00,16/03/2026`;

/**
 * Detailed Sample template for Stocks CSV (With statutory charges and brokerage)
 */
export const STOCKS_CSV_DETAILED_SAMPLE = `Stock Name,Symbol,ISIN,Type,Qty,Price,Trade Value,Charges,Net Value,Date
Reliance Industries Ltd,RELIANCE,INE002A01018,Buy,10,2950.00,29500.00,38.50,29538.50,10/01/2026
Tata Consultancy Services,TCS,INE467B01029,Buy,5,3850.00,19250.00,26.40,19276.40,12/01/2026
Infosys Limited,INFY,INE009A01021,Buy,25,1500.00,37500.00,45.80,37545.80,14/01/2026
Reliance Industries Ltd,RELIANCE,INE002A01018,Sell,2,3050.00,6100.00,42.15,6057.85,16/03/2026`;

/**
 * Standard Sample template for Mutual Funds CSV (Clean without charges)
 */
export const MUTUAL_FUNDS_CSV_SAMPLE = `Scheme Name,Transaction Type,Units,NAV,Amount,Date
Parag Parikh Flexi Cap Direct Growth,Purchase,150.50,72.40,10896.20,05/01/2026
Mirae Asset Large Cap Direct Growth,Purchase,80.00,115.20,9216.00,08/01/2026
HDFC Mid-Cap Opportunities Direct,Purchase,65.25,160.80,10492.20,10/01/2026
Parag Parikh Flexi Cap Direct Growth,Redeem,20.00,74.50,1490.00,15/02/2026`;

/**
 * Detailed Sample template for Mutual Funds CSV (With Stamp Duty & Charges)
 */
export const MUTUAL_FUNDS_CSV_DETAILED_SAMPLE = `Scheme Name,Transaction Type,Units,NAV,Gross Amount,Stamp Duty & Charges,Net Amount,Date
Parag Parikh Flexi Cap Direct Growth,Purchase,150.50,72.40,10896.20,0.54,10895.66,05/01/2026
Mirae Asset Large Cap Direct Growth,Purchase,80.00,115.20,9216.00,0.46,9215.54,08/01/2026
HDFC Mid-Cap Opportunities Direct,Purchase,65.25,160.80,10492.20,0.52,10491.68,10/01/2026
Parag Parikh Flexi Cap Direct Growth,Redeem,20.00,74.50,1490.00,0.00,1490.00,15/02/2026`;

/**
 * Import Stocks CSV
 * Handles both files with and without statutory charges.
 * If fundingAccount is provided and options.linkToBankAccount !== false, creates bank passbook transfers.
 */
export function importStocksCSV(
  csvContent: string,
  dematAccountId: string,
  currentHoldings: InvestmentHolding[],
  fundingAccount?: { id: string; name: string },
  options?: InvestmentCSVImportOptions
): InvestmentCSVResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      success: false,
      importedHoldingsCount: 0,
      importedTransactionsCount: 0,
      errorMessage: 'CSV file is empty or does not contain data rows.',
      updatedHoldings: currentHoldings,
      generatedTransactions: [],
    };
  }

  const headerCols = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_()/-]/g, ''));

  const findIdx = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const idx = headerCols.findIndex((h) => h.includes(name));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const nameIdx = findIdx(['stockname', 'name', 'company', 'scrip']);
  const symbolIdx = findIdx(['symbol', 'ticker', 'code']);
  const isinIdx = findIdx(['isin', 'isincode']);
  const typeIdx = findIdx(['type', 'action', 'buysell', 'transactiontype']);
  const qtyIdx = findIdx(['qty', 'quantity', 'shares', 'units']);
  const priceIdx = findIdx(['price', 'rate', 'shareprice', 'avgprice', 'executionprice']);
  const valueIdx = findIdx(['value', 'amount', 'totalvalue', 'totalamount', 'total', 'grossvalue', 'grossamount', 'tradevalue']);
  const chargesIdx = findIdx(['charges', 'brokerage', 'taxes', 'stt', 'fees', 'totalcharges', 'statutorycharges', 'stampduty']);
  const dateIdx = findIdx(['date', 'txdate', 'tradedate']);

  if (symbolIdx === -1 || qtyIdx === -1 || (valueIdx === -1 && priceIdx === -1) || dateIdx === -1) {
    return {
      success: false,
      importedHoldingsCount: 0,
      importedTransactionsCount: 0,
      errorMessage:
        'Missing required columns. Stocks CSV must include at least: Symbol, Type, Qty, Value (or Price), Date.',
      updatedHoldings: currentHoldings,
      generatedTransactions: [],
    };
  }

  // Deep clone holdings so we can safely update
  const holdingsMap = new Map<string, InvestmentHolding>();
  currentHoldings.forEach((h) => {
    holdingsMap.set(h.symbol.toUpperCase(), {
      ...h,
      transactions: [...(h.transactions || [])],
    });
  });

  const generatedTransactions: Transaction[] = [];
  let importedTxs = 0;
  const shouldIncludeCharges = options?.includeCharges !== false;
  const shouldLinkBank = Boolean(fundingAccount && fundingAccount.id !== 'none' && options?.linkToBankAccount !== false);

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const rawSymbol = cols[symbolIdx]?.trim().toUpperCase();
    if (!rawSymbol) continue;

    const stockName = (nameIdx !== -1 ? cols[nameIdx] : '') || rawSymbol;
    const isin = isinIdx !== -1 ? cols[isinIdx]?.trim() : undefined;
    const typeRaw = (typeIdx !== -1 ? cols[typeIdx] : 'buy').trim().toLowerCase();

    const isSplit = typeRaw.includes('split');
    const isBonus = typeRaw.includes('bonus');
    const isSell = typeRaw.includes('sell') || typeRaw.includes('redeem');
    const isDividend = typeRaw.includes('div');

    let txType: 'buy' | 'sell' | 'split' | 'bonus' | 'dividend' = 'buy';
    if (isSplit) txType = 'split';
    else if (isBonus) txType = 'bonus';
    else if (isSell) txType = 'sell';
    else if (isDividend) txType = 'dividend';

    const qty = parseFloat(cols[qtyIdx]?.replace(/[^0-9.-]/g, ''));
    if (isNaN(qty) || qty <= 0) continue;

    let price = priceIdx !== -1 ? parseFloat(cols[priceIdx]?.replace(/[^0-9.-]/g, '')) : NaN;
    let value = valueIdx !== -1 ? parseFloat(cols[valueIdx]?.replace(/[^0-9.-]/g, '')) : NaN;

    if (isNaN(value) && !isNaN(price)) {
      value = Number((qty * price).toFixed(2));
    } else if (isNaN(price) && !isNaN(value)) {
      price = qty > 0 ? Number((value / qty).toFixed(2)) : 0;
    } else if (isNaN(value) && isNaN(price)) {
      value = 0;
      price = 0;
    }

    // For Buy/Sell, value must be positive. For Split/Bonus, value can be 0.
    if ((txType === 'buy' || txType === 'sell') && value <= 0) {
      continue;
    }

    // Parse statutory charges if column is present and enabled
    let charges = 0;
    if (shouldIncludeCharges && chargesIdx !== -1 && cols[chargesIdx]) {
      charges = parseFloat(cols[chargesIdx].replace(/[^0-9.-]/g, '')) || 0;
      if (isNaN(charges) || charges < 0) charges = 0;
    }

    const dateStr = cols[dateIdx]?.trim();
    const validDate = parseInvestmentTradeDate(dateStr);

    let holding = holdingsMap.get(rawSymbol);
    if (!holding) {
      holding = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        symbol: rawSymbol,
        name: stockName || rawSymbol,
        assetType: 'stock',
        dematAccountId: dematAccountId || 'acc_zerodha',
        quantity: 0,
        averageBuyPrice: price > 0 ? price : 100,
        currentPrice: price > 0 ? price : 100,
        lastPriceUpdate: validDate,
        isin,
        notes: isin ? `ISIN: ${isin}` : undefined,
        bulkActionId: options?.bulkActionId,
        transactions: [],
      };
      holdingsMap.set(rawSymbol, holding);
    } else {
      if (isin && !holding.isin) holding.isin = isin;
      if (stockName && holding.name === holding.symbol) holding.name = stockName;
    }

    const linkedTxId = `tx_inv_transfer_${Date.now()}_${i}`;
    const isCorporate = txType === 'split' || txType === 'bonus';

    const newLedgerTx: InvestmentTransaction = {
      id: `inv_tx_${Date.now()}_${i}`,
      holdingId: holding.id,
      date: validDate,
      type: txType,
      quantity: qty,
      price: price > 0 ? price : Number((value / qty).toFixed(2)),
      totalAmount: value,
      linkedTransactionId: isCorporate || !shouldLinkBank ? undefined : linkedTxId,
      accountingType: isCorporate ? 'corporate_action' : isDividend ? 'income' : 'transfer',
      notes: isSplit
        ? `Stock Split (Additional ${qty} shares)`
        : isBonus
        ? `Bonus Issue (+${qty} free shares)`
        : `Imported via Stocks CSV (@ ₹${price.toFixed(2)}${charges > 0 ? ` with ₹${charges.toFixed(2)} charges` : ''})`,
      splitRatio: isSplit ? `${qty}:1` : undefined,
      bonusRatio: isBonus ? `${qty}:1` : undefined,
      charges: charges > 0 ? charges : undefined,
      bulkActionId: options?.bulkActionId,
    };

    holding.transactions = holding.transactions || [];
    holding.transactions.push(newLedgerTx);
    importedTxs++;

    // Generate bank transfer transaction for Buy/Sell if requested
    if (!isCorporate && !isDividend && shouldLinkBank && fundingAccount && value > 0) {
      const fromAccId = txType === 'buy' ? fundingAccount.id : dematAccountId || 'acc_zerodha';
      const fromAccName = txType === 'buy' ? fundingAccount.name : 'Demat Portfolio';
      const toAccId = txType === 'buy' ? dematAccountId || 'acc_zerodha' : fundingAccount.id;
      const toAccName = txType === 'buy' ? 'Demat Portfolio' : fundingAccount.name;

      const transferTx: Transaction = {
        id: linkedTxId,
        date: validDate,
        amount: value,
        type: 'transfer',
        fromAccountId: fromAccId,
        fromAccountName: fromAccName,
        toAccountId: toAccId,
        toAccountName: toAccName,
        note: `${txType === 'buy' ? 'Stock Purchase' : 'Stock Sale'}: ${qty} shares of ${rawSymbol} @ ₹${price.toFixed(2)}`,
        tags: ['Investment', 'Stock', rawSymbol],
        investmentId: holding.id,
        isInvestmentTransfer: true,
        bulkActionId: options?.bulkActionId,
        createdAt: new Date().toISOString(),
      };
      generatedTransactions.push(transferTx);

      // If charges exist, generate dual-write expense transaction
      if (charges > 0) {
        const feeTx: Transaction = {
          id: `tx_fee_import_${Date.now()}_${i}`,
          date: validDate,
          amount: Number(charges.toFixed(2)),
          type: 'expense',
          categoryId: 'cat_investment_taxes',
          categoryName: 'Investment Charges & Taxes',
          fromAccountId: fundingAccount.id,
          fromAccountName: fundingAccount.name,
          note: `Brokerage & Taxes: ${txType.toUpperCase()} ${qty}x ${rawSymbol}`,
          tags: ['Charges', 'Taxes', 'Investment', rawSymbol],
          investmentId: holding.id,
          bulkActionId: options?.bulkActionId,
          createdAt: new Date().toISOString(),
        };
        generatedTransactions.push(feeTx);
      }
    }

    // Apply FIFO calculation
    const fifoResult = computeHoldingFifo(holding.transactions || [], holding.averageBuyPrice);
    holding.quantity = fifoResult.remainingQuantity;
    holding.averageBuyPrice = fifoResult.averageBuyPrice;

    // Update latest CMP based on chronologically latest transaction
    const latestPriceInfo = getLatestTransactionPrice(
      holding.transactions,
      holding.currentPrice,
      holding.lastPriceUpdate
    );
    holding.currentPrice = latestPriceInfo.currentPrice;
    holding.lastPriceUpdate = latestPriceInfo.lastPriceUpdate;
  }

  if (importedTxs === 0) {
    return {
      success: false,
      importedHoldingsCount: 0,
      importedTransactionsCount: 0,
      errorMessage: 'No valid stock transactions could be parsed from the CSV.',
      updatedHoldings: currentHoldings,
      generatedTransactions: [],
    };
  }

  const updatedHoldingsList = Array.from(holdingsMap.values());

  return {
    success: true,
    importedHoldingsCount: updatedHoldingsList.length,
    importedTransactionsCount: importedTxs,
    updatedHoldings: updatedHoldingsList,
    generatedTransactions,
    summaryMessage: `Successfully imported ${importedTxs} stock transaction(s) across ${updatedHoldingsList.length} holding(s)${shouldLinkBank ? ' with bank passbook sync' : ' (portfolio only, without bank charges)'}.`,
  };
}

/**
 * Import Mutual Funds CSV
 * Handles both files with and without charges.
 */
export function importMutualFundsCSV(
  csvContent: string,
  dematAccountId: string,
  currentHoldings: InvestmentHolding[],
  fundingAccount?: { id: string; name: string },
  options?: InvestmentCSVImportOptions
): InvestmentCSVResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      success: false,
      importedHoldingsCount: 0,
      importedTransactionsCount: 0,
      errorMessage: 'CSV file is empty or does not contain data rows.',
      updatedHoldings: currentHoldings,
      generatedTransactions: [],
    };
  }

  const headerCols = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_()/-]/g, ''));

  const findIdx = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const idx = headerCols.findIndex((h) => h.includes(name));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const schemeIdx = findIdx(['schemename', 'fundname', 'scheme', 'fund', 'name']);
  const typeIdx = findIdx(['transactiontype', 'trantype', 'type', 'action', 'buysell']);
  const unitsIdx = findIdx(['units', 'qty', 'quantity']);
  const navIdx = findIdx(['nav', 'price', 'unitnav', 'rate']);
  const amountIdx = findIdx(['amount', 'value', 'totalamount', 'grossamount', 'total']);
  const chargesIdx = findIdx(['charges', 'stampduty', 'fees', 'taxes', 'totalcharges']);
  const dateIdx = findIdx(['date', 'txdate', 'navdate', 'purchasedate']);

  if (schemeIdx === -1 || unitsIdx === -1 || navIdx === -1 || dateIdx === -1) {
    return {
      success: false,
      importedHoldingsCount: 0,
      importedTransactionsCount: 0,
      errorMessage:
        'Missing required columns. Mutual Funds CSV must include: Scheme Name, Units, NAV, Date.',
      updatedHoldings: currentHoldings,
      generatedTransactions: [],
    };
  }

  const holdingsMap = new Map<string, InvestmentHolding>();
  currentHoldings.forEach((h) => {
    holdingsMap.set(h.name.toLowerCase().trim(), {
      ...h,
      transactions: [...(h.transactions || [])],
    });
  });

  const generatedTransactions: Transaction[] = [];
  let importedTxs = 0;
  const shouldIncludeCharges = options?.includeCharges !== false;
  const shouldLinkBank = Boolean(fundingAccount && fundingAccount.id !== 'none' && options?.linkToBankAccount !== false);

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const schemeName = cols[schemeIdx]?.trim();
    if (!schemeName) continue;

    const typeRaw = (typeIdx !== -1 ? cols[typeIdx] : 'purchase').trim().toLowerCase();
    const isRedeem = typeRaw.includes('redeem') || typeRaw.includes('sell');
    const txType: 'buy' | 'sell' = isRedeem ? 'sell' : 'buy';

    const units = parseFloat(cols[unitsIdx]?.replace(/[^0-9.-]/g, ''));
    const nav = parseFloat(cols[navIdx]?.replace(/[^0-9.-]/g, ''));
    let amount = amountIdx !== -1 ? parseFloat(cols[amountIdx]?.replace(/[^0-9.-]/g, '')) : NaN;

    if (isNaN(amount) || amount <= 0) {
      amount = Number((units * nav).toFixed(2));
    }

    if (isNaN(units) || units <= 0 || isNaN(nav) || nav <= 0) {
      continue;
    }

    let charges = 0;
    if (shouldIncludeCharges && chargesIdx !== -1 && cols[chargesIdx]) {
      charges = parseFloat(cols[chargesIdx].replace(/[^0-9.-]/g, '')) || 0;
      if (isNaN(charges) || charges < 0) charges = 0;
    }

    const dateStr = cols[dateIdx]?.trim();
    const validDate = parseInvestmentTradeDate(dateStr);

    const derivedSymbol =
      schemeName
        .replace(/Direct|Growth|Plan|Fund|Cap|Regular|-/gi, '')
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0]?.toUpperCase())
        .join('')
        .substring(0, 6) || 'MF';

    let holding = holdingsMap.get(schemeName.toLowerCase());
    if (!holding) {
      holding = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        symbol: `${derivedSymbol}_MF`,
        name: schemeName,
        assetType: 'mutual_fund',
        dematAccountId: dematAccountId || 'acc_zerodha',
        quantity: 0,
        averageBuyPrice: nav,
        currentPrice: nav,
        lastPriceUpdate: validDate,
        notes: 'Imported via Mutual Funds CSV',
        bulkActionId: options?.bulkActionId,
        transactions: [],
      };
      holdingsMap.set(schemeName.toLowerCase(), holding);
    }

    const linkedTxId = `tx_mf_transfer_${Date.now()}_${i}`;

    const newLedgerTx: InvestmentTransaction = {
      id: `inv_tx_${Date.now()}_${i}`,
      holdingId: holding.id,
      date: validDate,
      type: txType,
      quantity: units,
      price: nav,
      totalAmount: amount,
      linkedTransactionId: shouldLinkBank ? linkedTxId : undefined,
      accountingType: 'transfer',
      notes: `Imported via Mutual Funds CSV (NAV: ₹${nav.toFixed(2)}${charges > 0 ? ` with ₹${charges.toFixed(2)} stamp duty` : ''})`,
      charges: charges > 0 ? charges : undefined,
      bulkActionId: options?.bulkActionId,
    };

    holding.transactions = holding.transactions || [];
    holding.transactions.push(newLedgerTx);
    importedTxs++;

    // Generate bank transfer transaction if requested
    if (shouldLinkBank && fundingAccount) {
      const fromAccId = txType === 'buy' ? fundingAccount.id : dematAccountId || 'acc_zerodha';
      const fromAccName = txType === 'buy' ? fundingAccount.name : 'Mutual Funds Portfolio';
      const toAccId = txType === 'buy' ? dematAccountId || 'acc_zerodha' : fundingAccount.id;
      const toAccName = txType === 'buy' ? 'Mutual Funds Portfolio' : fundingAccount.name;

      const transferTx: Transaction = {
        id: linkedTxId,
        date: validDate,
        amount,
        type: 'transfer',
        fromAccountId: fromAccId,
        fromAccountName: fromAccName,
        toAccountId: toAccId,
        toAccountName: toAccName,
        note: `${txType === 'buy' ? 'Mutual Fund Purchase' : 'Mutual Fund Redemption'}: ${units.toFixed(4)} units of ${schemeName} @ ₹${nav.toFixed(2)}`,
        tags: ['Investment', 'Mutual Fund', holding.symbol],
        investmentId: holding.id,
        isInvestmentTransfer: true,
        bulkActionId: options?.bulkActionId,
        createdAt: new Date().toISOString(),
      };
      generatedTransactions.push(transferTx);

      if (charges > 0) {
        const feeTx: Transaction = {
          id: `tx_mf_duty_import_${Date.now()}_${i}`,
          date: validDate,
          amount: Number(charges.toFixed(2)),
          type: 'expense',
          categoryId: 'cat_investment_taxes',
          categoryName: 'Investment Charges & Taxes',
          fromAccountId: fundingAccount.id,
          fromAccountName: fundingAccount.name,
          note: `Mutual Fund Stamp Duty (0.005%): ${schemeName}`,
          tags: ['Charges', 'Stamp Duty', 'Investment', holding.symbol],
          investmentId: holding.id,
          bulkActionId: options?.bulkActionId,
          createdAt: new Date().toISOString(),
        };
        generatedTransactions.push(feeTx);
      }
    }

    const fifoResult = computeHoldingFifo(holding.transactions || [], holding.averageBuyPrice);
    holding.quantity = fifoResult.remainingQuantity;
    holding.averageBuyPrice = fifoResult.averageBuyPrice;

    const latestPriceInfo = getLatestTransactionPrice(
      holding.transactions,
      holding.currentPrice,
      holding.lastPriceUpdate
    );
    holding.currentPrice = latestPriceInfo.currentPrice;
    holding.lastPriceUpdate = latestPriceInfo.lastPriceUpdate;
  }

  if (importedTxs === 0) {
    return {
      success: false,
      importedHoldingsCount: 0,
      importedTransactionsCount: 0,
      errorMessage: 'No valid mutual fund transactions could be parsed from the CSV.',
      updatedHoldings: currentHoldings,
      generatedTransactions: [],
    };
  }

  const updatedHoldingsList = Array.from(holdingsMap.values());

  return {
    success: true,
    importedHoldingsCount: updatedHoldingsList.length,
    importedTransactionsCount: importedTxs,
    updatedHoldings: updatedHoldingsList,
    generatedTransactions,
    summaryMessage: `Successfully imported ${importedTxs} mutual fund transaction(s) across ${updatedHoldingsList.length} fund(s)${shouldLinkBank ? ' with bank passbook sync' : ' (portfolio only, without bank charges)'}.`,
  };
}

/**
 * Export Stocks CSV
 * Supports both clean format (without charges) and detailed format (with charges & taxes).
 */
export function exportStocksCSV(
  holdings: InvestmentHolding[],
  options?: InvestmentCSVExportOptions
): string {
  const includeCharges = Boolean(options?.includeCharges);
  const headers = includeCharges
    ? ['Stock Name', 'Symbol', 'ISIN', 'Type', 'Qty', 'Price', 'Trade Value', 'Charges', 'Net Value', 'Date']
    : ['Stock Name', 'Symbol', 'ISIN', 'Type', 'Qty', 'Price', 'Value', 'Date'];
  const rows: string[] = [];

  const stockHoldings = holdings.filter((h) => h.assetType === 'stock');

  stockHoldings.forEach((h) => {
    if (h.transactions && h.transactions.length > 0) {
      h.transactions.forEach((t) => {
        let actionLabel = 'Buy';
        if (t.type === 'sell') actionLabel = 'Sell';
        else if (t.type === 'split') actionLabel = 'Split';
        else if (t.type === 'bonus') actionLabel = 'Bonus';
        else if (t.type === 'dividend') actionLabel = 'Dividend';

        const chargesVal = t.charges || 0;
        const netValue = t.type === 'buy' ? t.totalAmount + chargesVal : t.totalAmount - chargesVal;

        if (includeCharges) {
          rows.push([
            `"${(h.name || h.symbol).replace(/"/g, '""')}"`,
            h.symbol,
            h.isin || '',
            actionLabel,
            t.quantity.toString(),
            t.price.toFixed(2),
            t.totalAmount.toFixed(2),
            chargesVal.toFixed(2),
            netValue.toFixed(2),
            formatDate(t.date),
          ].join(','));
        } else {
          rows.push([
            `"${(h.name || h.symbol).replace(/"/g, '""')}"`,
            h.symbol,
            h.isin || '',
            actionLabel,
            t.quantity.toString(),
            t.price.toFixed(2),
            t.totalAmount.toFixed(2),
            formatDate(t.date),
          ].join(','));
        }
      });
    } else if (h.quantity > 0) {
      const tradeVal = h.quantity * h.averageBuyPrice;
      if (includeCharges) {
        rows.push([
          `"${(h.name || h.symbol).replace(/"/g, '""')}"`,
          h.symbol,
          h.isin || '',
          'Buy',
          h.quantity.toString(),
          h.averageBuyPrice.toFixed(2),
          tradeVal.toFixed(2),
          '0.00',
          tradeVal.toFixed(2),
          formatDate(h.lastPriceUpdate || new Date()),
        ].join(','));
      } else {
        rows.push([
          `"${(h.name || h.symbol).replace(/"/g, '""')}"`,
          h.symbol,
          h.isin || '',
          'Buy',
          h.quantity.toString(),
          h.averageBuyPrice.toFixed(2),
          tradeVal.toFixed(2),
          formatDate(h.lastPriceUpdate || new Date()),
        ].join(','));
      }
    }
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export Mutual Funds CSV
 * Supports both clean format (without charges) and detailed format (with charges & taxes).
 */
export function exportMutualFundsCSV(
  holdings: InvestmentHolding[],
  options?: InvestmentCSVExportOptions
): string {
  const includeCharges = Boolean(options?.includeCharges);
  const headers = includeCharges
    ? ['Scheme Name', 'Transaction Type', 'Units', 'NAV', 'Gross Amount', 'Stamp Duty & Charges', 'Net Amount', 'Date']
    : ['Scheme Name', 'Transaction Type', 'Units', 'NAV', 'Amount', 'Date'];
  const rows: string[] = [];

  const mfHoldings = holdings.filter((h) => h.assetType === 'mutual_fund');

  mfHoldings.forEach((h) => {
    if (h.transactions && h.transactions.length > 0) {
      h.transactions.forEach((t) => {
        const actionLabel = t.type === 'buy' ? 'Purchase' : 'Redeem';
        const chargesVal = t.charges || 0;
        const netAmt = t.type === 'buy' ? t.totalAmount + chargesVal : t.totalAmount - chargesVal;

        if (includeCharges) {
          rows.push([
            `"${(h.name || h.symbol).replace(/"/g, '""')}"`,
            actionLabel,
            t.quantity.toString(),
            t.price.toFixed(2),
            t.totalAmount.toFixed(2),
            chargesVal.toFixed(2),
            netAmt.toFixed(2),
            formatDate(t.date),
          ].join(','));
        } else {
          rows.push([
            `"${(h.name || h.symbol).replace(/"/g, '""')}"`,
            actionLabel,
            t.quantity.toString(),
            t.price.toFixed(2),
            t.totalAmount.toFixed(2),
            formatDate(t.date),
          ].join(','));
        }
      });
    } else if (h.quantity > 0) {
      const gross = h.quantity * h.averageBuyPrice;
      if (includeCharges) {
        rows.push([
          `"${(h.name || h.symbol).replace(/"/g, '""')}"`,
          'Purchase',
          h.quantity.toString(),
          h.averageBuyPrice.toFixed(2),
          gross.toFixed(2),
          '0.00',
          gross.toFixed(2),
          formatDate(h.lastPriceUpdate || new Date()),
        ].join(','));
      } else {
        rows.push([
          `"${(h.name || h.symbol).replace(/"/g, '""')}"`,
          'Purchase',
          h.quantity.toString(),
          h.averageBuyPrice.toFixed(2),
          gross.toFixed(2),
          formatDate(h.lastPriceUpdate || new Date()),
        ].join(','));
      }
    }
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Save / share CSV file across Android local storage and browser
 */
export function downloadCSVFile(filename: string, content: string): void {
  fileService.exportAndShare({
    filename,
    content,
    mimeType: 'text/csv;charset=utf-8;',
    title: filename,
    dialogTitle: 'Save or Share CSV',
  });
}

/**
 * Trigger browser download for a sample CSV template
 */
export function downloadCSVTemplate(filename: string, content: string): void {
  downloadCSVFile(filename, content);
}
