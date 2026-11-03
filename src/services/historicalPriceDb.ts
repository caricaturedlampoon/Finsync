/**
 * IndexedDB Database Layer for Storing & Querying Historical Prices & NAVs
 * Offline-first, fast local cache for Stocks (Yahoo Finance) and Mutual Funds (AMFI/mfapi.in).
 * Features transparent in-memory and localStorage fallback if IndexedDB is blocked,
 * throws 'Internal error', or is restricted in sandboxed iframe environments.
 */

export interface HistoricalPriceRecord {
  id: string; // `${assetKey}#${date}`
  assetKey: string; // e.g. "RELIANCE.NS" or "122639"
  date: string; // "YYYY-MM-DD"
  price: number;
  updatedAt: string;
}

export interface AssetPriceMeta {
  assetKey: string;
  assetType: 'stock' | 'mutual_fund' | 'sgb';
  name?: string;
  latestDate: string; // "YYYY-MM-DD"
  latestPrice: number;
  previousCloseDate?: string; // Date of last business working day
  previousClosePrice?: number; // Closing price/NAV of last business working day
  earliestDate: string;
  totalPoints: number;
  lastSyncTime: number; // Unix timestamp ms
  status: 'idle' | 'updating' | 'cached' | 'error';
  statusMessage?: string;
}

const DB_NAME = 'finsync_prices_db_v1';
const DB_VERSION = 1;
const STORE_PRICES = 'historical_prices';
const STORE_META = 'asset_metadata';
const LOCAL_STORAGE_META_KEY = 'finsync_price_meta_v1';

// In-Memory fallback caches
const memoryPrices = new Map<string, Map<string, number>>(); // assetKey -> (date -> price)
const memoryMeta = new Map<string, AssetPriceMeta>();

// Load initial meta from localStorage if available
function loadMetaFromLocalStorage(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_META_KEY) || localStorage.getItem('expense_manager_price_meta_v1');
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, AssetPriceMeta>;
        if (parsed && typeof parsed === 'object') {
          Object.values(parsed).forEach((m) => {
            if (m && m.assetKey) {
              memoryMeta.set(m.assetKey, m);
            }
          });
        }
      }
    }
  } catch {
    // Silently continue with in-memory map
  }
}

function saveMetaToLocalStorage(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const obj: Record<string, AssetPriceMeta> = {};
      memoryMeta.forEach((v, k) => {
        obj[k] = v;
      });
      localStorage.setItem(LOCAL_STORAGE_META_KEY, JSON.stringify(obj));
    }
  } catch {
    // Silently continue
  }
}

// Pre-hydrate in-memory metadata
loadMetaFromLocalStorage();

let isIndexedDbFailed = false;
let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Open or initialize the IndexedDB connection with schema migration.
 * Seamlessly resolves to null if IndexedDB is unavailable or encounters internal errors,
 * letting the service fall back transparently to in-memory/localStorage cache.
 */
export function openPriceDB(): Promise<IDBDatabase | null> {
  if (isIndexedDbFailed) {
    return Promise.resolve(null);
  }
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        isIndexedDbFailed = true;
        resolve(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        try {
          const db = (event.target as IDBOpenDBRequest).result;

          // 1. Historical Prices Store
          if (!db.objectStoreNames.contains(STORE_PRICES)) {
            const priceStore = db.createObjectStore(STORE_PRICES, { keyPath: 'id' });
            priceStore.createIndex('assetKey', 'assetKey', { unique: false });
            priceStore.createIndex('date', 'date', { unique: false });
            try {
              priceStore.createIndex('assetKey_date', ['assetKey', 'date'], { unique: true });
            } catch {
              // ignore compound index failure on legacy engines
            }
          }

          // 2. Asset Metadata Store
          if (!db.objectStoreNames.contains(STORE_META)) {
            db.createObjectStore(STORE_META, { keyPath: 'assetKey' });
          }
        } catch (upgradeErr) {
          console.warn('[HistoricalPriceDb] Upgrade failed:', upgradeErr);
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        dbInstance.onversionchange = () => {
          try {
            dbInstance?.close();
          } catch {
            // ignore
          }
          dbInstance = null;
          dbPromise = null;
        };
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        isIndexedDbFailed = true;
        dbInstance = null;
        dbPromise = null;
        const err = (event.target as IDBOpenDBRequest).error;
        // Log friendly warning instead of hard console.error to avoid runtime error traps
        console.warn(
          '[HistoricalPriceDb] IndexedDB unavailable or internal error; switching to resilient in-memory/localStorage cache:',
          err?.message || err
        );
        resolve(null);
      };

      request.onblocked = () => {
        isIndexedDbFailed = true;
        console.warn('[HistoricalPriceDb] IndexedDB open blocked; using in-memory fallback.');
        resolve(null);
      };
    } catch (err) {
      isIndexedDbFailed = true;
      dbPromise = null;
      console.warn('[HistoricalPriceDb] IndexedDB open exception; using in-memory fallback:', err);
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Save or upsert historical price records into IndexedDB/in-memory cache and update asset metadata
 */
export async function saveAssetPrices(
  assetKey: string,
  assetType: 'stock' | 'mutual_fund' | 'sgb',
  prices: Array<{ date: string; price: number }>,
  name?: string
): Promise<AssetPriceMeta | null> {
  if (!assetKey || prices.length === 0) return null;

  // Deduplicate and sort by date ascending
  const sorted = [...prices]
    .filter((p) => p.date && typeof p.price === 'number' && !isNaN(p.price) && p.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) return null;

  const earliestDate = sorted[0].date;
  const latestEntry = sorted[sorted.length - 1];
  const previousEntry = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;

  const meta: AssetPriceMeta = {
    assetKey,
    assetType,
    name,
    latestDate: latestEntry.date,
    latestPrice: latestEntry.price,
    previousCloseDate: previousEntry?.date,
    previousClosePrice: previousEntry?.price,
    earliestDate,
    totalPoints: sorted.length,
    lastSyncTime: Date.now(),
    status: 'cached',
  };

  // 1. Always update memory and localStorage cache first (immediate, synchronous)
  let assetPricesMap = memoryPrices.get(assetKey);
  if (!assetPricesMap) {
    assetPricesMap = new Map<string, number>();
    memoryPrices.set(assetKey, assetPricesMap);
  }
  for (const item of sorted) {
    assetPricesMap.set(item.date, item.price);
  }
  memoryMeta.set(assetKey, meta);
  saveMetaToLocalStorage();

  // 2. Persist to IndexedDB if available without throwing on transaction errors
  try {
    const db = await openPriceDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const nowIso = new Date().toISOString();
          const tx = db.transaction([STORE_PRICES, STORE_META], 'readwrite');
          const priceStore = tx.objectStore(STORE_PRICES);
          const metaStore = tx.objectStore(STORE_META);

          for (const item of sorted) {
            const record: HistoricalPriceRecord = {
              id: `${assetKey}#${item.date}`,
              assetKey,
              date: item.date,
              price: item.price,
              updatedAt: nowIso,
            };
            priceStore.put(record);
          }

          metaStore.put(meta);

          tx.oncomplete = () => resolve();
          tx.onerror = (e) => {
            console.warn(`[HistoricalPriceDb] Transaction write warning for ${assetKey}:`, (e.target as any)?.error);
            resolve();
          };
          tx.onabort = () => resolve();
        } catch (txErr) {
          console.warn(`[HistoricalPriceDb] Exception during IndexedDB transaction for ${assetKey}:`, txErr);
          resolve();
        }
      });
    }
  } catch (err) {
    console.warn('[HistoricalPriceDb] Non-fatal error persisting to IndexedDB:', err);
  }

  return meta;
}

/**
 * Update the metadata status of an asset (e.g. when updating or encountering error)
 */
export async function updateAssetStatus(
  assetKey: string,
  status: AssetPriceMeta['status'],
  statusMessage?: string
): Promise<void> {
  try {
    const existing = memoryMeta.get(assetKey);
    if (existing) {
      existing.status = status;
      if (statusMessage !== undefined) {
        existing.statusMessage = statusMessage;
      }
      memoryMeta.set(assetKey, existing);
      saveMetaToLocalStorage();
    }

    const db = await openPriceDB();
    if (db) {
      const tx = db.transaction([STORE_META], 'readwrite');
      const store = tx.objectStore(STORE_META);
      const getReq = store.get(assetKey);

      getReq.onsuccess = () => {
        const dbExisting = getReq.result as AssetPriceMeta | undefined;
        if (dbExisting) {
          dbExisting.status = status;
          if (statusMessage !== undefined) {
            dbExisting.statusMessage = statusMessage;
          }
          store.put(dbExisting);
        }
      };
    }
  } catch {
    // Silent fail in offline mode
  }
}

/**
 * Get metadata for a specific asset
 */
export async function getAssetMeta(assetKey: string): Promise<AssetPriceMeta | null> {
  if (!assetKey) return null;

  // Check memory cache first
  if (memoryMeta.has(assetKey)) {
    return memoryMeta.get(assetKey) || null;
  }

  try {
    const db = await openPriceDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_META], 'readonly');
        const store = tx.objectStore(STORE_META);
        const req = store.get(assetKey);

        req.onsuccess = () => {
          const res = (req.result as AssetPriceMeta) || null;
          if (res) memoryMeta.set(assetKey, res);
          resolve(res);
        };
        req.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/**
 * Get all asset metadata records in a Map
 */
export async function getAllAssetMeta(): Promise<Map<string, AssetPriceMeta>> {
  const result = new Map<string, AssetPriceMeta>(memoryMeta);
  try {
    const db = await openPriceDB();
    if (!db) {
      return result;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_META], 'readonly');
        const store = tx.objectStore(STORE_META);
        const req = store.getAll();

        req.onsuccess = () => {
          const list = (req.result as AssetPriceMeta[]) || [];
          list.forEach((m) => {
            result.set(m.assetKey, m);
            memoryMeta.set(m.assetKey, m);
          });
          resolve(result);
        };
        req.onerror = () => {
          resolve(result);
        };
      } catch {
        resolve(result);
      }
    });
  } catch {
    return result;
  }
}

/**
 * Get historical daily prices for an asset, ordered by date ascending
 */
export async function getHistoricalPrices(
  assetKey: string,
  options?: { startDate?: string; endDate?: string; limit?: number }
): Promise<Array<{ date: string; price: number }>> {
  if (!assetKey) return [];

  const getFromMemory = (): Array<{ date: string; price: number }> => {
    const pricesMap = memoryPrices.get(assetKey);
    if (!pricesMap || pricesMap.size === 0) return [];
    let records: Array<{ date: string; price: number }> = [];
    pricesMap.forEach((price, date) => {
      records.push({ date, price });
    });
    records.sort((a, b) => a.date.localeCompare(b.date));
    if (options?.startDate) {
      records = records.filter((r) => r.date >= options.startDate!);
    }
    if (options?.endDate) {
      records = records.filter((r) => r.date <= options.endDate!);
    }
    if (options?.limit && options.limit > 0 && records.length > options.limit) {
      records = records.slice(records.length - options.limit);
    }
    return records;
  };

  try {
    const db = await openPriceDB();
    if (!db) {
      return getFromMemory();
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_PRICES], 'readonly');
        const store = tx.objectStore(STORE_PRICES);
        const index = store.index('assetKey');
        const req = index.getAll(assetKey);

        req.onsuccess = () => {
          let records = (req.result as HistoricalPriceRecord[]) || [];
          if (records.length === 0) {
            resolve(getFromMemory());
            return;
          }
          records.sort((a, b) => a.date.localeCompare(b.date));

          if (options?.startDate) {
            records = records.filter((r) => r.date >= options.startDate!);
          }
          if (options?.endDate) {
            records = records.filter((r) => r.date <= options.endDate!);
          }
          if (options?.limit && options.limit > 0 && records.length > options.limit) {
            records = records.slice(records.length - options.limit);
          }

          resolve(records.map((r) => ({ date: r.date, price: r.price })));
        };

        req.onerror = () => {
          resolve(getFromMemory());
        };
      } catch {
        resolve(getFromMemory());
      }
    });
  } catch {
    return getFromMemory();
  }
}

/**
 * Prune historical data and metadata for unselected, deleted, or zero-quantity assets.
 * "DO NOT fetch or store historical data for unselected or deleted assets."
 */
export async function pruneUnheldAssets(activeKeys: Set<string>): Promise<number> {
  try {
    // 1. Prune from memory & localStorage
    const keysToDelete: string[] = [];
    memoryMeta.forEach((_, key) => {
      if (!activeKeys.has(key)) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      memoryMeta.delete(key);
      memoryPrices.delete(key);
    }
    if (keysToDelete.length > 0) {
      saveMetaToLocalStorage();
    }

    const db = await openPriceDB();
    if (!db) {
      return keysToDelete.length;
    }

    const metaList = await new Promise<AssetPriceMeta[]>((resolve) => {
      try {
        const tx = db.transaction([STORE_META], 'readonly');
        const store = tx.objectStore(STORE_META);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });

    const dbKeysToDelete = metaList
      .map((m) => m.assetKey)
      .filter((k) => !activeKeys.has(k));

    if (dbKeysToDelete.length === 0) return keysToDelete.length;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_PRICES, STORE_META], 'readwrite');
        const priceStore = tx.objectStore(STORE_PRICES);
        const metaStore = tx.objectStore(STORE_META);
        const index = priceStore.index('assetKey');

        for (const key of dbKeysToDelete) {
          metaStore.delete(key);
          const req = index.openCursor(IDBKeyRange.only(key));
          req.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            }
          };
        }

        tx.oncomplete = () => {
          resolve(Math.max(keysToDelete.length, dbKeysToDelete.length));
        };
        tx.onerror = () => {
          resolve(keysToDelete.length);
        };
      } catch {
        resolve(keysToDelete.length);
      }
    });
  } catch {
    return 0;
  }
}

/**
 * Clear all prices and metadata from database
 */
export async function clearAllPrices(): Promise<void> {
  memoryPrices.clear();
  memoryMeta.clear();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_META_KEY);
    }
  } catch {
    // ignore
  }

  try {
    const db = await openPriceDB();
    if (db) {
      const tx = db.transaction([STORE_PRICES, STORE_META], 'readwrite');
      tx.objectStore(STORE_PRICES).clear();
      tx.objectStore(STORE_META).clear();
    }
  } catch (e) {
    console.warn('[HistoricalPriceDb] Non-fatal notice clearing price DB:', e);
  }
}
