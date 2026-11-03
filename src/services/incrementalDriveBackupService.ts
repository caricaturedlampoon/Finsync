/**
 * Incremental Cloud Backup and Restore Service (Google Drive appDataFolder Scope)
 *
 * Target Location: Google Drive App Data Folder ('appDataFolder' scope)
 * Architecture:
 * 1. Local Delta Tracking & Lightweight Snapshot Packaging (snapshot_<timestamp>.json)
 * 2. Baseline Master Backup + Incremental Delta Uploads
 * 3. Consolidation (Compaction) after N snapshots into Main Baseline file
 * 4. Ordered Replay/Reconstruction Restore Engine
 * 5. Token Expiry & Mid-Upload Fault Tolerance
 */

// ============================================================================
// 1. TYPES & CONTRACTS
// ============================================================================

export type EntityName = 'accounts' | 'transactions' | 'holdings' | 'categories' | 'debts' | 'recurring' | 'budgets';
export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface DeltaOperation {
  id: string; // Unique UUID for idempotency
  entity: EntityName;
  type: OperationType;
  entityId: string;
  payload?: any; // Entity data for CREATE/UPDATE
  timestamp: number;
}

export interface DeltaSnapshot {
  snapshotId: string;
  sessionId: string; // Links snapshot to active baseline master
  timestamp: number;
  operationsCount: number;
  operations: DeltaOperation[];
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
  appProperties?: Record<string, string>;
}

export interface BaselineMasterBackup {
  sessionId: string;
  version: string;
  timestamp: number;
  lastConsolidatedAt: number;
  appState: Record<string, any>;
}

export class GoogleDriveAuthExpiredError extends Error {
  constructor(message = 'Google Drive authentication token expired. Please re-authenticate.') {
    super(message);
    this.name = 'GoogleDriveAuthExpiredError';
  }
}

export class GoogleDriveSyncError extends Error {
  constructor(message: string, public readonly cause?: any) {
    super(message);
    this.name = 'GoogleDriveSyncError';
  }
}

// ============================================================================
// 2. LOCAL TRANSACTION LOG & DELTA TRACKER
// ============================================================================

const CONSOLIDATION_THRESHOLD = 5; // Consolidate after 5 snapshots
const DRIVE_APP_DATA_FOLDER = 'appDataFolder';
const BASELINE_FILE_NAME = 'finsync_baseline_master.json';

class LocalDeltaTrackerService {
  private memoryOperationsLog: DeltaOperation[] = [];
  private activeSessionId: string = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  public getSessionId(): string {
    return this.activeSessionId;
  }

  public setSessionId(id: string): void {
    this.activeSessionId = id;
  }

  /**
   * Appends a local state mutation to the in-memory delta log
   */
  public logOperation(entity: EntityName, type: OperationType, entityId: string, payload?: any): void {
    const op: DeltaOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      entity,
      type,
      entityId,
      payload: type === 'DELETE' ? undefined : payload,
      timestamp: Date.now(),
    };
    this.memoryOperationsLog.push(op);
  }

  /**
   * Packages accumulated un-backed-up operations into a Delta Snapshot
   */
  public createSnapshot(): DeltaSnapshot | null {
    if (this.memoryOperationsLog.length === 0) {
      return null;
    }

    const timestamp = Date.now();
    const snapshot: DeltaSnapshot = {
      snapshotId: `snapshot_${timestamp}`,
      sessionId: this.activeSessionId,
      timestamp,
      operationsCount: this.memoryOperationsLog.length,
      operations: [...this.memoryOperationsLog],
    };

    return snapshot;
  }

  /**
   * Clears local operations log up to the specified snapshot timestamp after successful sync
   */
  public clearOperationsUpTo(snapshotTimestamp: number): void {
    this.memoryOperationsLog = this.memoryOperationsLog.filter(
      (op) => op.timestamp > snapshotTimestamp
    );
  }

  public getPendingOperationsCount(): number {
    return this.memoryOperationsLog.length;
  }

  public resetTracker(): void {
    this.memoryOperationsLog = [];
  }
}

export const deltaTracker = new LocalDeltaTrackerService();

// ============================================================================
// 3. GOOGLE DRIVE API LOW-LEVEL ADAPTER
// ============================================================================

class GoogleDriveApiAdapter {
  private readonly baseUrl = 'https://www.googleapis.com/drive/v3';
  private readonly uploadUrl = 'https://www.googleapis.com/upload/drive/v3';

  /**
   * Validates Google Access Token before attempting any Drive operation
   */
  public async verifyToken(accessToken: string): Promise<boolean> {
    if (!accessToken || accessToken.trim() === '') {
      throw new GoogleDriveAuthExpiredError('No access token provided.');
    }

    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
      if (response.status === 401 || !response.ok) {
        throw new GoogleDriveAuthExpiredError();
      }
      return true;
    } catch (err) {
      if (err instanceof GoogleDriveAuthExpiredError) throw err;
      throw new GoogleDriveAuthExpiredError('Token verification failed due to network or authorization error.');
    }
  }

  /**
   * Searches appDataFolder for files matching name or prefix
   */
  public async listFiles(accessToken: string, query?: string): Promise<DriveFileMetadata[]> {
    await this.verifyToken(accessToken);

    let q = `'${DRIVE_APP_DATA_FOLDER}' in parents and trashed = false`;
    if (query) {
      q += ` and ${query}`;
    }

    const url = `${this.baseUrl}/files?spaces=${DRIVE_APP_DATA_FOLDER}&q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,createdTime,modifiedTime,appProperties)&orderBy=createdTime asc`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.status === 401) throw new GoogleDriveAuthExpiredError();
    if (!res.ok) throw new GoogleDriveSyncError(`Drive listFiles failed with status ${res.status}`);

    const data = await res.json();
    return data.files || [];
  }

  /**
   * Uploads or updates a JSON file in appDataFolder with transactional metadata
   */
  public async uploadJsonFile(
    accessToken: string,
    fileName: string,
    content: object,
    existingFileId?: string,
    appProperties?: Record<string, string>
  ): Promise<DriveFileMetadata> {
    await this.verifyToken(accessToken);

    const jsonString = JSON.stringify(content, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: existingFileId ? undefined : [DRIVE_APP_DATA_FOLDER],
      appProperties,
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', blob);

    let url = `${this.uploadUrl}/files?uploadType=multipart&spaces=${DRIVE_APP_DATA_FOLDER}`;
    let method = 'POST';

    if (existingFileId) {
      url = `${this.uploadUrl}/files/${existingFileId}?uploadType=multipart`;
      method = 'PATCH';
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (res.status === 401) throw new GoogleDriveAuthExpiredError();
    if (!res.ok) {
      throw new GoogleDriveSyncError(`Failed to upload ${fileName}. Server returned status ${res.status}`);
    }

    return await res.json();
  }

  /**
   * Downloads JSON file content by Drive file ID
   */
  public async downloadJsonFile<T = any>(accessToken: string, fileId: string): Promise<T> {
    await this.verifyToken(accessToken);

    const url = `${this.baseUrl}/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.status === 401) throw new GoogleDriveAuthExpiredError();
    if (!res.ok) throw new GoogleDriveSyncError(`Failed to download Drive file ID ${fileId}`);

    return await res.json();
  }

  /**
   * Permanently deletes a file from Drive appDataFolder
   */
  public async deleteFile(accessToken: string, fileId: string): Promise<void> {
    await this.verifyToken(accessToken);

    const url = `${this.baseUrl}/files/${fileId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.status === 401) throw new GoogleDriveAuthExpiredError();
    if (!res.ok && res.status !== 404) {
      throw new GoogleDriveSyncError(`Failed to delete Drive file ${fileId}`);
    }
  }
}

const driveApi = new GoogleDriveApiAdapter();

// ============================================================================
// 4. INCREMENTAL BACKUP & CONSOLIDATION SERVICE
// ============================================================================

export class IncrementalDriveBackupService {
  /**
   * Performs an atomic incremental cloud sync:
   * 1. Checks baseline master file existences on Google Drive.
   * 2. If missing, creates and uploads new Baseline Master Backup.
   * 3. Uploads lightweight Delta Snapshot file.
   * 4. Triggers consolidation/compaction if snapshot count reaches threshold (5 snapshots).
   */
  public async syncToCloud(
    accessToken: string,
    currentAppState: Record<string, any>
  ): Promise<{ status: 'BASELINE_CREATED' | 'INCREMENTAL_SYNCED' | 'CONSOLIDATED'; snapshotCount: number }> {
    try {
      // Step 1: Verify auth token and query Drive appDataFolder
      await driveApi.verifyToken(accessToken);
      const files = await driveApi.listFiles(accessToken);

      const baselineFile = files.find((f) => f.name === BASELINE_FILE_NAME);
      const snapshotFiles = files.filter((f) => f.name.startsWith('snapshot_') && f.name.endsWith('.json'));

      // Case A: No Baseline exists -> Create and upload main Baseline Master Backup
      if (!baselineFile) {
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        deltaTracker.setSessionId(newSessionId);

        const baselineContent: BaselineMasterBackup = {
          sessionId: newSessionId,
          version: '1.0.0',
          timestamp: Date.now(),
          lastConsolidatedAt: Date.now(),
          appState: currentAppState,
        };

        await driveApi.uploadJsonFile(accessToken, BASELINE_FILE_NAME, baselineContent, undefined, {
          sessionId: newSessionId,
        });

        deltaTracker.resetTracker();
        return { status: 'BASELINE_CREATED', snapshotCount: 0 };
      }

      // Case B: Baseline exists -> Package local Delta Snapshot
      const snapshot = deltaTracker.createSnapshot();
      if (!snapshot) {
        // No local operations recorded -> check if consolidation is needed
        if (snapshotFiles.length >= CONSOLIDATION_THRESHOLD) {
          await this.consolidateSnapshots(accessToken, baselineFile.id, snapshotFiles, currentAppState);
          return { status: 'CONSOLIDATED', snapshotCount: 0 };
        }
        return { status: 'INCREMENTAL_SYNCED', snapshotCount: snapshotFiles.length };
      }

      // Mid-Upload Fault Tolerance: Upload snapshot transactionally
      const snapshotFileName = `${snapshot.snapshotId}.json`;
      await driveApi.uploadJsonFile(accessToken, snapshotFileName, snapshot, undefined, {
        sessionId: deltaTracker.getSessionId(),
        operationsCount: snapshot.operationsCount.toString(),
      });

      // Clear local memory log up to synced timestamp upon verified upload
      deltaTracker.clearOperationsUpTo(snapshot.timestamp);

      const updatedSnapshotFiles = await driveApi.listFiles(accessToken, "name contains 'snapshot_'");

      // Case C: Check if snapshot count reached compaction threshold (>= 5 snapshots)
      if (updatedSnapshotFiles.length >= CONSOLIDATION_THRESHOLD) {
        await this.consolidateSnapshots(accessToken, baselineFile.id, updatedSnapshotFiles, currentAppState);
        return { status: 'CONSOLIDATED', snapshotCount: 0 };
      }

      return { status: 'INCREMENTAL_SYNCED', snapshotCount: updatedSnapshotFiles.length };
    } catch (err) {
      if (err instanceof GoogleDriveAuthExpiredError) {
        throw err;
      }
      throw new GoogleDriveSyncError('Cloud backup failed mid-transaction.', err);
    }
  }

  /**
   * CONSOLIDATION / COMPACTION STRATEGY:
   * Merges all incremental snapshots into the Main Baseline Master file, patches state,
   * uploads updated consolidated baseline, and deletes old snapshot files.
   */
  private async consolidateSnapshots(
    accessToken: string,
    baselineFileId: string,
    snapshotFiles: DriveFileMetadata[],
    currentAppState: Record<string, any>
  ): Promise<void> {
    // 1. Download baseline master
    const baseline = await driveApi.downloadJsonFile<BaselineMasterBackup>(accessToken, baselineFileId);

    // 2. Fetch and order snapshots chronologically
    const snapshots: DeltaSnapshot[] = [];
    for (const sf of snapshotFiles) {
      try {
        const snap = await driveApi.downloadJsonFile<DeltaSnapshot>(accessToken, sf.id);
        snapshots.push(snap);
      } catch (e) {
        console.warn(`Skipping corrupted snapshot file ${sf.id}`, e);
      }
    }

    snapshots.sort((a, b) => a.timestamp - b.timestamp);

    // 3. Sequentially apply/replay all snapshot deltas over baseline app state
    let consolidatedState = { ...baseline.appState };
    for (const snap of snapshots) {
      consolidatedState = this.replaySnapshot(consolidatedState, snap);
    }

    // Prefer active currentAppState if provided to catch any un-logged state synchronization
    const finalMasterState = currentAppState && Object.keys(currentAppState).length > 0
      ? currentAppState
      : consolidatedState;

    // 4. Update Main Baseline Master File on Drive
    const updatedBaseline: BaselineMasterBackup = {
      sessionId: baseline.sessionId || deltaTracker.getSessionId(),
      version: '1.0.0',
      timestamp: Date.now(),
      lastConsolidatedAt: Date.now(),
      appState: finalMasterState,
    };

    await driveApi.uploadJsonFile(accessToken, BASELINE_FILE_NAME, updatedBaseline, baselineFileId);

    // 5. Delete old consolidated snapshot files from Drive appDataFolder
    for (const sf of snapshotFiles) {
      try {
        await driveApi.deleteFile(accessToken, sf.id);
      } catch (delErr) {
        console.warn(`Failed to cleanup snapshot ${sf.id}`, delErr);
      }
    }
  }

  // ============================================================================
  // 5. RECONSTRUCTION / RESTORE LOGIC
  // ============================================================================

  /**
   * Restores and reconstructs up-to-date app state from Google Drive:
   * 1. Downloads Main Baseline Master file.
   * 2. Fetches all subsequent incremental snapshot files ordered by timestamp.
   * 3. Sequentially applies/replays snapshot deltas over the baseline state.
   */
  public async restoreAppFromCloud(accessToken: string): Promise<Record<string, any>> {
    await driveApi.verifyToken(accessToken);

    const files = await driveApi.listFiles(accessToken);
    const baselineFile = files.find((f) => f.name === BASELINE_FILE_NAME);

    if (!baselineFile) {
      throw new GoogleDriveSyncError('No cloud backup found in Google Drive appDataFolder.');
    }

    // Step 1: Download Main Baseline
    const baseline = await driveApi.downloadJsonFile<BaselineMasterBackup>(accessToken, baselineFile.id);
    let reconstructedState = { ...(baseline.appState || {}) };

    // Step 2: Download & order all incremental snapshot files
    const snapshotFiles = files
      .filter((f) => f.name.startsWith('snapshot_') && f.name.endsWith('.json'))
      .sort((a, b) => new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime());

    const snapshots: DeltaSnapshot[] = [];
    for (const sf of snapshotFiles) {
      try {
        const snap = await driveApi.downloadJsonFile<DeltaSnapshot>(accessToken, sf.id);
        if (snap && snap.operations) {
          snapshots.push(snap);
        }
      } catch (err) {
        console.warn(`Failed to parse snapshot ${sf.name}, skipping during restore.`, err);
      }
    }

    snapshots.sort((a, b) => a.timestamp - b.timestamp);

    // Step 3: Replay deltas sequentially
    for (const snap of snapshots) {
      reconstructedState = this.replaySnapshot(reconstructedState, snap);
    }

    // Reset local delta tracker & update active session
    deltaTracker.setSessionId(baseline.sessionId || `session_${Date.now()}`);
    deltaTracker.resetTracker();

    return reconstructedState;
  }

  /**
   * Replays a single Delta Snapshot's operations over an app state
   */
  private replaySnapshot(baseState: Record<string, any>, snapshot: DeltaSnapshot): Record<string, any> {
    const nextState = { ...baseState };

    for (const op of snapshot.operations) {
      const entityKey = op.entity;
      const list: any[] = Array.isArray(nextState[entityKey]) ? [...nextState[entityKey]] : [];

      if (op.type === 'CREATE') {
        const idx = list.findIndex((item) => item.id === op.entityId);
        if (idx !== -1) {
          list[idx] = op.payload; // Idempotent update
        } else if (op.payload) {
          list.push(op.payload);
        }
      } else if (op.type === 'UPDATE') {
        const idx = list.findIndex((item) => item.id === op.entityId);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...op.payload };
        } else if (op.payload) {
          list.push(op.payload);
        }
      } else if (op.type === 'DELETE') {
        nextState[entityKey] = list.filter((item) => item.id !== op.entityId);
        continue;
      }

      nextState[entityKey] = list;
    }

    return nextState;
  }
}

export const incrementalDriveBackupService = new IncrementalDriveBackupService();
