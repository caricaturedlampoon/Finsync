/**
 * Curated Offline Indian Stock & ETF Directory
 * Enables 100% offline symbol autocomplete, name matching, and reference pricing
 * without requiring an active internet connection.
 */

export interface OfflineStockItem {
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  category: 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'ETF' | 'Index ETF' | 'Gold ETF' | 'Debt ETF';
  sector: string;
  referencePrice: number;
}

export const OFFLINE_STOCK_DIRECTORY: OfflineStockItem[] = [
  // --- NIFTY 50 & Prominent Large Caps ---
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Oil & Gas / Conglomerate', referencePrice: 1285.50 },
  { symbol: 'TCS', name: 'Tata Consultancy Services Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'IT Services', referencePrice: 4230.00 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Banking & Financial', referencePrice: 1740.25 },
  { symbol: 'INFY', name: 'Infosys Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'IT Services', referencePrice: 1910.75 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Banking & Financial', referencePrice: 1290.00 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Telecom', referencePrice: 1715.40 },
  { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', category: 'Large Cap', sector: 'PSU Bank', referencePrice: 835.60 },
  { symbol: 'ITC', name: 'ITC Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'FMCG / Cigarettes', referencePrice: 485.30 },
  { symbol: 'LICI', name: 'Life Insurance Corporation of India', exchange: 'NSE', category: 'Large Cap', sector: 'Insurance', referencePrice: 945.80 },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'FMCG', referencePrice: 2420.50 },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Construction & Engineering', referencePrice: 3580.00 },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'NBFC', referencePrice: 7120.00 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Automobile', referencePrice: 11950.00 },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Pharmaceuticals', referencePrice: 1845.00 },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Banking', referencePrice: 1160.00 },
  { symbol: 'TITAN', name: 'Titan Company Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Consumer Goods / Jewellery', referencePrice: 3410.00 },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Cement', referencePrice: 11250.00 },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Paints / Chemicals', referencePrice: 2470.00 },
  { symbol: 'WIPRO', name: 'Wipro Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'IT Services', referencePrice: 560.40 },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Metals & Mining', referencePrice: 154.20 },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Power / Utilities', referencePrice: 320.10 },
  { symbol: 'NTPC', name: 'NTPC Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Power Generation', referencePrice: 395.40 },
  { symbol: 'M&M', name: 'Mahindra & Mahindra Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Automobile', referencePrice: 2980.00 },
  { symbol: 'COALINDIA', name: 'Coal India Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Mining', referencePrice: 460.75 },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Financial Services', referencePrice: 1820.00 },
  { symbol: 'TRENT', name: 'Trent Ltd. (Tata)', exchange: 'NSE', category: 'Large Cap', sector: 'Retail', referencePrice: 7250.00 },
  { symbol: 'BEL', name: 'Bharat Electronics Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Aerospace & Defence', referencePrice: 295.60 },
  { symbol: 'HAL', name: 'Hindustan Aeronautics Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Aerospace & Defence', referencePrice: 4420.00 },
  { symbol: 'ZOMATO', name: 'Zomato Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Internet / Consumer Tech', referencePrice: 265.40 },
  { symbol: 'JIOFIN', name: 'Jio Financial Services Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Financial Services', referencePrice: 315.80 },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Diversified', referencePrice: 2840.00 },
  { symbol: 'ADANIPORTS', name: 'Adani Ports and SEZ Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Infrastructure / Ports', referencePrice: 1320.00 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Automobile', referencePrice: 885.00 },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Banking', referencePrice: 1780.00 },
  { symbol: 'TECHM', name: 'Tech Mahindra Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'IT Services', referencePrice: 1690.00 },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'IT Services', referencePrice: 1825.00 },
  { symbol: 'ONGC', name: 'Oil and Natural Gas Corporation Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Oil & Gas', referencePrice: 265.00 },
  { symbol: 'NESTLEIND', name: 'Nestle India Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'FMCG', referencePrice: 2280.00 },
  { symbol: 'GRASIM', name: 'Grasim Industries Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Cement & Chemicals', referencePrice: 2650.00 },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Metals & Mining', referencePrice: 960.00 },
  { symbol: 'CIPLA', name: 'Cipla Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Pharmaceuticals', referencePrice: 1530.00 },
  { symbol: 'DRREDDY', name: "Dr. Reddy's Laboratories Ltd.", exchange: 'NSE', category: 'Large Cap', sector: 'Pharmaceuticals', referencePrice: 6540.00 },
  { symbol: 'EICHERMOT', name: 'Eicher Motors Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Automobile', referencePrice: 4780.00 },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals Enterprise Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Healthcare', referencePrice: 6920.00 },
  { symbol: 'DIVISLAB', name: "Divi's Laboratories Ltd.", exchange: 'NSE', category: 'Large Cap', sector: 'Pharmaceuticals', referencePrice: 5890.00 },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Automobile', referencePrice: 5120.00 },
  { symbol: 'BRITANNIA', name: 'Britannia Industries Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'FMCG', referencePrice: 5240.00 },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'Banking', referencePrice: 1110.00 },
  { symbol: 'SHRIRAMFIN', name: 'Shriram Finance Ltd.', exchange: 'NSE', category: 'Large Cap', sector: 'NBFC', referencePrice: 3260.00 },

  // --- Popular Midcaps & High Growth Stocks ---
  { symbol: 'POLYCAB', name: 'Polycab India Ltd.', exchange: 'NSE', category: 'Mid Cap', sector: 'Cables & Electricals', referencePrice: 6720.00 },
  { symbol: 'PERSISTENT', name: 'Persistent Systems Ltd.', exchange: 'NSE', category: 'Mid Cap', sector: 'IT Services', referencePrice: 5640.00 },
  { symbol: 'COFORGE', name: 'Coforge Ltd.', exchange: 'NSE', category: 'Mid Cap', sector: 'IT Services', referencePrice: 7920.00 },
  { symbol: 'DIXON', name: 'Dixon Technologies (India) Ltd.', exchange: 'NSE', category: 'Mid Cap', sector: 'Electronics Manufacturing', referencePrice: 14650.00 },
  { symbol: 'KPITTECH', name: 'KPIT Technologies Ltd.', exchange: 'NSE', category: 'Mid Cap', sector: 'Auto Tech / Software', referencePrice: 1680.00 },
  { symbol: 'TATAELXSI', name: 'Tata Elxsi Ltd.', exchange: 'NSE', category: 'Mid Cap', sector: 'Design & Technology', referencePrice: 7120.00 },
  { symbol: 'SUZLON', name: 'Suzlon Energy Ltd.', exchange: 'NSE', category: 'Mid Cap', sector: 'Renewable Energy', referencePrice: 68.50 },
  { symbol: 'IREDA', name: 'Indian Renewable Energy Dev Agency', exchange: 'NSE', category: 'Mid Cap', sector: 'Green Energy Finance', referencePrice: 215.00 },
  { symbol: 'CDSL', name: 'Central Depository Services (India) Ltd.', exchange: 'NSE', category: 'Mid Cap', sector: 'Market Infrastructure', referencePrice: 1540.00 },
  { symbol: 'BSE', name: 'BSE Limited', exchange: 'NSE', category: 'Mid Cap', sector: 'Stock Exchange', referencePrice: 4780.00 },

  // --- Popular Indian ETFs ---
  { symbol: 'NIFTYBEES', name: 'Nippon India Nifty 50 ETF', exchange: 'NSE', category: 'Index ETF', sector: 'Index Fund (Nifty 50)', referencePrice: 268.40 },
  { symbol: 'BANKBEES', name: 'Nippon India Bank ETF', exchange: 'NSE', category: 'Index ETF', sector: 'Sector ETF (Bank Nifty)', referencePrice: 535.80 },
  { symbol: 'GOLDBEES', name: 'Nippon India ETF Gold BeES', exchange: 'NSE', category: 'Gold ETF', sector: 'Commodities (Gold)', referencePrice: 72.85 },
  { symbol: 'SILVERBEES', name: 'Nippon India ETF Silver BeES', exchange: 'NSE', category: 'ETF', sector: 'Commodities (Silver)', referencePrice: 94.60 },
  { symbol: 'JUNIORBEES', name: 'Nippon India ETF Nifty Next 50 Junior BeES', exchange: 'NSE', category: 'Index ETF', sector: 'Index ETF (Next 50)', referencePrice: 742.00 },
  { symbol: 'MON100', name: 'Motilal Oswal Nasdaq 100 ETF', exchange: 'NSE', category: 'ETF', sector: 'Global Equity (Nasdaq)', referencePrice: 172.50 },
  { symbol: 'ITBEES', name: 'Nippon India ETF Nifty IT', exchange: 'NSE', category: 'Index ETF', sector: 'Sector ETF (IT)', referencePrice: 42.80 },
  { symbol: 'AUTOBEES', name: 'Nippon India ETF Nifty Auto', exchange: 'NSE', category: 'Index ETF', sector: 'Sector ETF (Auto)', referencePrice: 265.40 },
  { symbol: 'CPSEETF', name: 'CPSE ETF (PSU Basket)', exchange: 'NSE', category: 'Index ETF', sector: 'PSU Equity', referencePrice: 92.15 },
  { symbol: 'LIQUIDBEES', name: 'Nippon India ETF Liquid BeES (Debt / Overnight)', exchange: 'NSE', category: 'Debt ETF', sector: 'Cash Equivalent / Overnight', referencePrice: 1000.00 },
];

/**
 * Fast offline fuzzy search for Indian stocks and ETFs
 */
export function searchOfflineStocks(query: string, maxResults: number = 8): OfflineStockItem[] {
  const cleanQ = (query || '').trim().toLowerCase();
  if (!cleanQ) return [];

  const startsWithSym: OfflineStockItem[] = [];
  const containsSym: OfflineStockItem[] = [];
  const nameMatches: OfflineStockItem[] = [];

  for (const item of OFFLINE_STOCK_DIRECTORY) {
    const symLower = item.symbol.toLowerCase();
    const nameLower = item.name.toLowerCase();

    if (symLower === cleanQ) {
      return [item];
    } else if (symLower.startsWith(cleanQ)) {
      startsWithSym.push(item);
    } else if (symLower.includes(cleanQ)) {
      containsSym.push(item);
    } else if (nameLower.includes(cleanQ)) {
      nameMatches.push(item);
    }
  }

  const combined = [...startsWithSym, ...containsSym, ...nameMatches];
  return combined.slice(0, maxResults);
}
