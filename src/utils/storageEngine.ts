/**
 * High-Performance IndexedDB Storage Engine with LocalStorage Fallback
 * Designed to handle enterprise-scale datasets (up to 500,000+ transactions / 100MB+)
 * without running into localStorage 5MB quota limits or freezing the UI.
 */

const DB_NAME = 'finsync_db_v1';
const DB_VERSION = 1;
const STORE_NAME = 'keyval_store';

let idbInstance: IDBDatabase | null = null;
let idbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or retrieve the IndexedDB instance
 */
function getDB(): Promise<IDBDatabase> {
  if (idbInstance) {
    return Promise.resolve(idbInstance);
  }
  if (idbPromise) {
    return idbPromise;
  }

  idbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event: Event) => {
      idbInstance = (event.target as IDBOpenDBRequest).result;
      idbInstance.onclose = () => {
        idbInstance = null;
        idbPromise = null;
      };
      resolve(idbInstance);
    };

    request.onerror = (event: Event) => {
      idbPromise = null;
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return idbPromise;
}

/**
 * Retrieve item from IndexedDB
 */
export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve(req.result !== undefined ? req.result : null);
      };
      req.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Set item in IndexedDB
 */
export async function idbSet<T>(key: string, value: T): Promise<boolean> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);

      req.onsuccess = () => {
        resolve(true);
      };
      req.onerror = () => {
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Delete item from IndexedDB
 */
export async function idbDelete(key: string): Promise<boolean> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);

      req.onsuccess = () => {
        resolve(true);
      };
      req.onerror = () => {
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Clear all data from store
 */
export async function idbClear(): Promise<boolean> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => {
        resolve(true);
      };
      req.onerror = () => {
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Asynchronously load application state:
 * 1. Checks IndexedDB first (supports 100MB+ for 500,000 transactions)
 * 2. If empty in IndexedDB, checks localStorage for legacy data and migrates it
 * 3. Falls back to defaultValue if neither exists
 */
import { migrateSnapshotToLatest } from '../services/schemaMigration';

export async function loadPersistedState<T>(storageKey: string, defaultValue: T): Promise<T> {
  try {
    // 1. Try IndexedDB
    const fromIdb = await idbGet<T>(storageKey);
    if (fromIdb !== null && fromIdb !== undefined) {
      return migrateSnapshotToLatest(fromIdb as any) as T;
    }

    // 2. Check legacy IndexedDB key if migrating to finsync_store_v1
    if (storageKey === 'finsync_store_v1') {
      const fromLegacyIdb = await idbGet<T>('expense_manager_store_v1');
      if (fromLegacyIdb !== null && fromLegacyIdb !== undefined) {
        const migrated = migrateSnapshotToLatest(fromLegacyIdb as any) as T;
        idbSet('finsync_store_v1', migrated).catch(() => {});
        return migrated;
      }
    }

    // 3. Check localStorage for current or legacy keys
    if (typeof window !== 'undefined' && window.localStorage) {
      const legacyRaw =
        window.localStorage.getItem(storageKey) ||
        (storageKey === 'finsync_store_v1'
          ? window.localStorage.getItem('expense_manager_store_v1') ||
            window.localStorage.getItem('expense_manager_v2')
          : null);
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw) as T;
          const migrated = migrateSnapshotToLatest(parsed as any) as T;
          // Asynchronously migrate to IndexedDB and current localStorage key
          idbSet(storageKey, migrated).catch(() => {});
          window.localStorage.setItem(storageKey, JSON.stringify(migrated));
          return migrated;
        } catch {
          // parse failed
        }
      }
    }
  } catch {
    // Return default on error
  }

  return defaultValue;
}

/**
 * Debounced persistence helper to prevent thread-blocking JSON serialization
 * on high-frequency state updates while ensuring no data loss.
 */
export class DebouncedStorageWriter<T> {
  private key: string;
  private pendingData: T | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isSaving: boolean = false;
  private delayMs: number;

  constructor(key: string, delayMs: number = 500) {
    this.key = key;
    this.delayMs = delayMs;

    if (typeof window !== 'undefined') {
      // Immediate flush on Android pagehide, visibility change, and beforeunload
      window.addEventListener('pagehide', () => {
        this.flushImmediate();
      });
      window.addEventListener('beforeunload', () => {
        this.flushImmediate();
      });
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushImmediate();
        }
      });
    }
  }

  public scheduleSave(data: T): void {
    this.pendingData = data;

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.flush();
    }, this.delayMs);
  }

  public async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.pendingData === null || this.isSaving) return;

    const dataToSave = this.pendingData;
    this.isSaving = true;

    try {
      const saved = await idbSet(this.key, dataToSave);
      if (!saved) {
        // Fallback to localStorage if under quota
        try {
          const serialized = JSON.stringify(dataToSave);
          window.localStorage.setItem(this.key, serialized);
        } catch {
          // LocalStorage quota might be exceeded, but IDB is our main driver
        }
      }
    } catch {
      // Silent error handling
    } finally {
      this.isSaving = false;
      // If new data arrived while saving, schedule another save
      if (this.pendingData !== dataToSave && this.pendingData !== null) {
        this.scheduleSave(this.pendingData);
      }
    }
  }

  public flushImmediate(): void {
    if (this.pendingData === null) return;
    try {
      // Direct sync write attempt to localStorage as emergency backup if payload fits
      const serialized = JSON.stringify(this.pendingData);
      if (serialized.length < 4 * 1024 * 1024) {
        window.localStorage.setItem(this.key, serialized);
      }
    } catch {
      // Ignore quota error on emergency backup
    }
    // Also trigger IDB save
    idbSet(this.key, this.pendingData).catch(() => {});
  }
}
