/**
 * Automatic Backup Vault & Scheduler
 * Manages local IndexedDB encrypted snapshots and automated Google Drive sync.
 * Supports Daily and Weekly schedules.
 */

import { encryptBackupData } from '../utils/cryptoBackup';
import { getGoogleAccessToken, uploadEncryptedBackupToDrive } from './googleDriveService';
import { fileService } from './fileService';

export interface LocalAutoSnapshot {
  id: string;
  timestamp: number;
  dateFormatted: string;
  fileName: string;
  encryptedContent: string;
  sizeBytes: number;
  target: 'local' | 'google_drive' | 'both';
  googleDriveFileId?: string;
}

const DB_NAME = 'FinSync_AutoBackups';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const MAX_LOCAL_SNAPSHOTS = 14; // Keep 2 weeks of daily snapshots

function openSnapshotDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save an encrypted snapshot to the local IndexedDB vault and prune older ones.
 */
export async function saveLocalSnapshot(snapshot: LocalAutoSnapshot): Promise<void> {
  const db = await openSnapshotDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(snapshot);

    tx.oncomplete = async () => {
      // Prune snapshots beyond MAX_LOCAL_SNAPSHOTS
      try {
        await pruneOldSnapshots(MAX_LOCAL_SNAPSHOTS);
      } catch (e) {
        console.warn('Snapshot pruning error:', e);
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve all local encrypted snapshots from the vault ordered newest first.
 */
export async function listLocalSnapshots(): Promise<LocalAutoSnapshot[]> {
  const db = await openSnapshotDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const req = index.openCursor(null, 'prev');
    const list: LocalAutoSnapshot[] = [];

    req.onsuccess = (e: any) => {
      const cursor = e.target.result;
      if (cursor) {
        list.push(cursor.value);
        cursor.continue();
      } else {
        resolve(list);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a local snapshot by ID.
 */
export async function deleteLocalSnapshot(id: string): Promise<void> {
  const db = await openSnapshotDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Prune snapshots to keep only the newest N items.
 */
async function pruneOldSnapshots(keepCount: number): Promise<void> {
  const all = await listLocalSnapshots();
  if (all.length > keepCount) {
    const toDelete = all.slice(keepCount);
    const db = await openSnapshotDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    toDelete.forEach((snap) => store.delete(snap.id));
  }
}

/**
 * Download or share a local snapshot as a .finsync.enc (or legacy .expmgr.enc) file to user device via Native Share or Download.
 */
export async function downloadSnapshotFile(snapshot: LocalAutoSnapshot): Promise<void> {
  await fileService.exportAndShare({
    filename: snapshot.fileName,
    content: snapshot.encryptedContent,
    mimeType: 'application/octet-stream',
    title: 'FinSync Auto-Backup',
    dialogTitle: 'Share / Save Backup',
  });
}

/**
 * Runs scheduled automatic backup if configured and threshold has passed.
 */
export async function checkAndExecuteAutoBackup(
  currentAppState: any,
  settings: {
    autoBackupSchedule?: 'off' | 'daily' | 'weekly';
    autoBackupTarget?: 'local' | 'google_drive' | 'both';
    autoBackupPassword?: string;
    lastAutoBackupTimestamp?: number;
  },
  onBackupSuccess?: (msg: string, isDrive: boolean) => void
): Promise<boolean> {
  const schedule = settings.autoBackupSchedule || 'daily';
  if (schedule === 'off') return false;

  const now = Date.now();
  const lastTime = settings.lastAutoBackupTimestamp || 0;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const intervalMs = schedule === 'weekly' ? 7 * oneDayMs : oneDayMs;

  if (now - lastTime < intervalMs) {
    return false; // Interval has not passed
  }

  try {
    const target = settings.autoBackupTarget || 'both';
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `FinSync_Auto_${dateStr}.finsync.enc`;

    // 1. Encrypt with passwordless app lock & key vault
    const encryptedContent = await encryptBackupData(currentAppState);

    // 2. Upload to Google Drive if connected and requested
    let driveFileId: string | undefined;
    const token = getGoogleAccessToken();
    let driveSucceeded = false;

    if ((target === 'google_drive' || target === 'both') && token) {
      try {
        const driveRes = await uploadEncryptedBackupToDrive(fileName, encryptedContent, token);
        driveFileId = driveRes.id;
        driveSucceeded = true;
      } catch (driveErr) {
        console.warn('Auto backup to Google Drive failed:', driveErr);
      }
    }

    // 3. Save to local IndexedDB vault if local or both
    if (target === 'local' || target === 'both' || !driveSucceeded) {
      const snapshot: LocalAutoSnapshot = {
        id: `snap_${Date.now()}`,
        timestamp: now,
        dateFormatted: new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        fileName,
        encryptedContent,
        sizeBytes: new Blob([encryptedContent]).size,
        target,
        googleDriveFileId: driveFileId,
      };

      await saveLocalSnapshot(snapshot);
    }

    if (onBackupSuccess) {
      const destText = driveSucceeded
        ? target === 'both'
          ? 'Local Vault & Google Drive'
          : 'Google Drive'
        : 'Local Vault';
      onBackupSuccess(`Automatic encrypted backup saved to ${destText}`, driveSucceeded);
    }

    return true;
  } catch (err) {
    console.error('Error during scheduled auto-backup:', err);
    return false;
  }
}
