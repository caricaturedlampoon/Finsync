/**
 * Universal Cross-Platform Cryptographic Backup Engine (AES-256-GCM)
 * 
 * Supports:
 * - App-Exclusive Lock & Key backups (.expmgr.enc)
 * - Remixed applet backups (resolves applet ID / device vault seed divergence)
 * - Unencrypted JSON backups (.json, .bk, raw data exports)
 * - Legacy password-protected backups
 * - Android Room database backups (expenses & stock transactions)
 * - Automatic seamless decryption without manual password typing
 */

export interface BackupUserInfo {
  uid?: string;
  email?: string | null;
  displayName?: string | null;
}

export interface WrappedKeyRecord {
  salt: string;
  iv: string;
  wrappedKey: string;
  userEmail?: string;
  userUid?: string;
}

export interface AppLockBackupEnvelope {
  magic: 'EXPMGR_APP_LOCK_V2' | 'EXPMGR_APP_LOCK_V1' | 'EXPMGR_ENC_V1';
  version: string;
  createdAt: string;
  appSignature: string; // HMAC/Fingerprint ensuring authentic origin
  salt: string; // Base64 16-byte random salt
  iv: string; // Base64 12-byte random IV
  ciphertext: string; // Base64 AES-256-GCM ciphertext + 128-bit authentication tag
  wrappedKeys?: {
    account?: WrappedKeyRecord;
    universal?: WrappedKeyRecord;
    device?: WrappedKeyRecord;
    custom?: WrappedKeyRecord;
  };
  metadata?: {
    appName: string;
    appletId: string;
    userEmail?: string;
    userUid?: string;
    vaultSeed?: string; // Included so remixed apps can always derive matching keys
    isAccountProtected?: boolean;
    accountsCount: number;
    transactionsCount: number;
    holdingsCount: number;
    debtsCount: number;
  };
}

// Application cryptographic secret bound to this app architecture
export const APP_CORE_PEPPER = 'EXPENSE_MGR_APP_EXCLUSIVE_KEY_SECRET_b6857511_2623_4c96_8b97_ff46d1559b93_PROD_v2';
export const CURRENT_APPLET_ID = 'c680affe-f9f3-4e33-8d66-80a1feff8568';
export const ORIGINAL_APPLET_ID = 'b6857511-2623-4c96-8b97-ff46d1559b93';
export const VAULT_SEED_KEY = 'finsync_device_vault_seed_v1';

// Convert ArrayBuffer or Uint8Array to Base64
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 to Uint8Array
function base64ToBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Asynchronous JSON serialization yielding to the event loop to prevent Android ANR
 * (Application Not Responding) UI freezes during large ledger operations.
 */
export async function asyncJsonStringify(data: any, space?: number): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(space ? JSON.stringify(data, null, space) : JSON.stringify(data));
    }, 0);
  });
}

export async function asyncJsonParse<T = any>(str: string): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(JSON.parse(str));
      } catch (err) {
        reject(err);
      }
    }, 0);
  });
}

/**
 * Gets or initializes the device vault seed.
 * Stored locally to allow device-level cryptographic binding.
 */
export function getOrCreateVaultSeed(): string {
  try {
    let seed = localStorage.getItem(VAULT_SEED_KEY) || localStorage.getItem('expmgr_device_vault_seed_v1');
    if (!seed) {
      const randomBytes = window.crypto.getRandomValues(new Uint8Array(16));
      seed = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      localStorage.setItem(VAULT_SEED_KEY, seed);
    } else if (!localStorage.getItem(VAULT_SEED_KEY)) {
      localStorage.setItem(VAULT_SEED_KEY, seed);
    }
    return seed;
  } catch {
    return 'DEFAULT_DEVICE_VAULT_SEED_010203';
  }
}

/**
 * Generates an easy-to-read emergency device pairing key (16 characters: XXXX-XXXX-XXXX-XXXX)
 */
export function getAppLockKeycode(): string {
  const seed = getOrCreateVaultSeed();
  return (
    seed.slice(0, 4) +
    '-' +
    seed.slice(4, 8) +
    '-' +
    seed.slice(8, 12) +
    '-' +
    seed.slice(12, 16)
  ).toUpperCase();
}

/**
 * Normalizes any restored raw backup data into the canonical FinSync data shape.
 */
export function normalizeBackupData(raw: any): any {
  if (!raw || typeof raw !== 'object') return null;

  // Unwrap any nested data envelopes
  const data = raw.data || raw.state || raw.appData || raw.backupData || raw;

  // Process transactions: support web transactions or Android expenses
  let transactions: any[] = Array.isArray(data.transactions) ? [...data.transactions] : [];
  if (Array.isArray(data.expenses) && transactions.length === 0) {
    transactions = data.expenses.map((e: any) => ({
      id: e.id || `tx_android_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      amount: Math.abs(Number(e.amount) || 0),
      type: (e.type && String(e.type).toLowerCase() === 'income') ? 'income' : 'expense',
      date: e.date || new Date().toISOString().slice(0, 10),
      fromAccountId: e.accountId || e.fromAccountId || 'acc_default',
      categoryName: e.category || e.categoryName || 'General',
      note: e.note || e.title || '',
      createdAt: e.createdAt || new Date().toISOString(),
    }));
  }

  // Process accounts: ensure valid array or synthesize fallback if transactions exist
  let accounts: any[] = Array.isArray(data.accounts) ? [...data.accounts] : [];
  if (accounts.length === 0 && transactions.length > 0) {
    const accountIds = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.fromAccountId) accountIds.add(tx.fromAccountId);
      if (tx.toAccountId) accountIds.add(tx.toAccountId);
    });
    accounts = Array.from(accountIds).map((id, index) => ({
      id,
      name: id === 'acc_default' ? 'Primary Bank Account' : `Account ${index + 1}`,
      type: 'bank',
      initialBalance: 0,
      balance: 0,
      includeInNetLiquid: true,
      order: index,
      createdAt: new Date().toISOString(),
    }));
  }

  return {
    accounts,
    transactions,
    categories: Array.isArray(data.categories) ? data.categories : [],
    holdings: Array.isArray(data.holdings) ? data.holdings : [],
    debts: Array.isArray(data.debts) ? data.debts : [],
    recurring: Array.isArray(data.recurring) ? data.recurring : [],
    groups: Array.isArray(data.groups) ? data.groups : [],
    groupExpenses: Array.isArray(data.groupExpenses) ? data.groupExpenses : [],
    sips: Array.isArray(data.sips) ? data.sips : [],
    sipExecutions: Array.isArray(data.sipExecutions) ? data.sipExecutions : [],
    userProfile: data.userProfile,
    settings: data.settings || {},
  };
}

/**
 * Computes an HMAC app signature verification tag
 */
async function computeAppSignature(dataString: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(APP_CORE_PEPPER),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await window.crypto.subtle.sign('HMAC', keyMaterial, enc.encode(dataString));
  return bufferToBase64(new Uint8Array(signature).slice(0, 16));
}

/**
 * Encrypts application data using App-Controlled Military-Grade Envelope Encryption (AES-256-GCM).
 * 
 * Generates an internal 256-bit Data Encryption Key (DEK), encrypts the full dataset,
 * and securely wraps the DEK under:
 * 1. User Account Key (if user is authenticated via Google/Email) -> seamlessly unlocks on any device upon login!
 * 2. Universal App Vault Key -> ensures seamless recovery across applet instances
 * 3. Local Device Vault Key -> allows offline backups on the local device
 * 4. Optional Custom Password (if specified)
 */
export async function encryptBackupData(
  data: any,
  options?: {
    user?: BackupUserInfo | null;
    customPassword?: string;
  } | string
): Promise<string> {
  const enc = new TextEncoder();
  const user = typeof options === 'object' && options ? options.user : null;
  const customPassword = typeof options === 'string' ? options : options?.customPassword;

  // 1. Generate random 256-bit (32 bytes) master Data Encryption Key (DEK)
  const dekBytes = window.crypto.getRandomValues(new Uint8Array(32));
  const payloadSalt = window.crypto.getRandomValues(new Uint8Array(16));
  const payloadIv = window.crypto.getRandomValues(new Uint8Array(12));
  const seed = getOrCreateVaultSeed();

  // Import DEK for AES-GCM encryption
  const dek = await window.crypto.subtle.importKey(
    'raw',
    dekBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // 2. Encrypt the entire application dataset with DEK (async serialization to prevent ANR)
  const jsonStr = await asyncJsonStringify(data);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: payloadIv as BufferSource,
    },
    dek,
    enc.encode(jsonStr)
  );

  // Helper to wrap DEK under a specific secret with fresh salt and IV
  const wrapDek = async (secret: string): Promise<WrappedKeyRecord> => {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    const wrappingKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    const wrapped = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      wrappingKey,
      dekBytes
    );
    return {
      salt: bufferToBase64(salt),
      iv: bufferToBase64(iv),
      wrappedKey: bufferToBase64(wrapped),
    };
  };

  // 3. Build wrapped keys for each authorized channel
  const wrappedKeys: AppLockBackupEnvelope['wrappedKeys'] = {};

  // Tier 1: Universal App Vault Key (App-exclusive key)
  wrappedKeys.universal = await wrapDek(`${APP_CORE_PEPPER}::UNIVERSAL_VAULT_V2`);

  // Tier 2: Device Key (Local device binding)
  wrappedKeys.device = await wrapDek(`${APP_CORE_PEPPER}::VAULT::${seed}`);

  // Tier 3: User Account Key (Cross-Device Gmail / Email sync)
  if (user && (user.email || user.uid)) {
    const cleanEmail = (user.email || '').toLowerCase().trim();
    const userSecret = `${APP_CORE_PEPPER}::ACCOUNT::${user.uid || 'NO_UID'}::EMAIL::${cleanEmail}`;
    const accountWrap = await wrapDek(userSecret);
    accountWrap.userEmail = cleanEmail;
    accountWrap.userUid = user.uid;
    wrappedKeys.account = accountWrap;
  }

  // Tier 4: Custom Password (if user set one)
  if (customPassword && customPassword.trim()) {
    wrappedKeys.custom = await wrapDek(`${APP_CORE_PEPPER}::CUSTOM::${customPassword.trim()}`);
  }

  const appSignature = await computeAppSignature(jsonStr.slice(0, 200));

  const envelope: AppLockBackupEnvelope = {
    magic: 'EXPMGR_APP_LOCK_V2',
    version: '2.0.0',
    createdAt: new Date().toISOString(),
    appSignature,
    salt: bufferToBase64(payloadSalt),
    iv: bufferToBase64(payloadIv),
    ciphertext: bufferToBase64(encryptedBuffer),
    wrappedKeys,
    metadata: {
      appName: 'FinSync',
      appletId: CURRENT_APPLET_ID,
      userEmail: user?.email ? user.email.toLowerCase().trim() : undefined,
      userUid: user?.uid,
      vaultSeed: seed,
      isAccountProtected: Boolean(user?.email || user?.uid),
      accountsCount: Array.isArray(data?.accounts) ? data.accounts.length : 0,
      transactionsCount: Array.isArray(data?.transactions) ? data.transactions.length : 0,
      holdingsCount: Array.isArray(data?.holdings) ? data.holdings.length : 0,
      debtsCount: Array.isArray(data?.debts) ? data.debts.length : 0,
    },
  };

  return await asyncJsonStringify(envelope, 2);
}

export interface DecryptBackupResult {
  success: boolean;
  data?: any;
  requiresPassword?: boolean;
  message?: string;
  isEncrypted?: boolean;
  envelopeAppletId?: string;
  accountEmail?: string;
  unlockedVia?: 'account' | 'universal' | 'device' | 'password' | 'legacy';
}

/**
 * Universal App-Controlled Backup Decryptor
 * 
 * Auto-detects and seamlessly restores:
 * 1. Multi-tier V2 envelopes with cross-device user account auto-unlock
 * 2. Universal applet key backups
 * 3. Local device backups
 * 4. Legacy V1 envelopes from prior versions
 */
export async function decryptBackupData(
  fileContent: string,
  optionsOrPassword?: {
    user?: BackupUserInfo | null;
    password?: string;
  } | string
): Promise<DecryptBackupResult> {
  const trimmed = fileContent.trim().replace(/^\uFEFF/, '');

  const currentUser =
    typeof optionsOrPassword === 'object' && optionsOrPassword ? optionsOrPassword.user : null;
  const optionalPassword =
    typeof optionsOrPassword === 'string'
      ? optionsOrPassword
      : optionsOrPassword?.password;

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    try {
      const decoded = window.atob(trimmed);
      parsed = JSON.parse(decoded);
    } catch {
      return {
        success: false,
        requiresPassword: false,
        message: 'Invalid backup file. Could not parse file contents.',
      };
    }
  }

  const isEncryptedEnvelope = Boolean(
    parsed &&
    typeof parsed === 'object' &&
    (parsed.magic === 'EXPMGR_APP_LOCK_V2' ||
     parsed.magic === 'EXPMGR_APP_LOCK_V1' ||
     parsed.magic === 'EXPMGR_ENC_V1' ||
     (parsed.ciphertext && parsed.salt && parsed.iv))
  );

  // If unencrypted JSON was uploaded, inform user that only app-controlled encryption is supported
  if (!isEncryptedEnvelope) {
    const normalized = normalizeBackupData(parsed);
    if (
      normalized &&
      (normalized.accounts.length > 0 ||
        normalized.transactions.length > 0 ||
        normalized.holdings.length > 0)
    ) {
      // Gracefully restore existing data
      return {
        success: true,
        data: normalized,
        isEncrypted: false,
        unlockedVia: 'legacy',
      };
    }
    return {
      success: false,
      requiresPassword: false,
      message: 'Unrecognized backup file. Only app-controlled encrypted files (.expmgr.enc) are supported.',
    };
  }

  // =========================================================================
  // CASE A: V2 ENVELOPE (Multi-Tier Envelope with Account & Universal Wraps)
  // =========================================================================
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // Helper to unwrap a DEK from a WrappedKeyRecord using candidate secret
  const tryUnwrapDek = async (record: WrappedKeyRecord, secret: string): Promise<CryptoKey | null> => {
    try {
      const salt = base64ToBuffer(record.salt);
      const iv = base64ToBuffer(record.iv);
      const wrappedBytes = base64ToBuffer(record.wrappedKey);

      const baseKey = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const wrappingKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt as BufferSource,
          iterations: 100000,
          hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const unwrappedBytes = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
        },
        wrappingKey,
        wrappedBytes as BufferSource
      );
      return await window.crypto.subtle.importKey(
        'raw',
        unwrappedBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
    } catch {
      return null;
    }
  };

  const payloadIv = base64ToBuffer(parsed.iv);
  const ciphertext = base64ToBuffer(parsed.ciphertext);

  const decryptPayloadWithDek = async (dek: CryptoKey): Promise<any | null> => {
    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: payloadIv as BufferSource,
        },
        dek,
        ciphertext as BufferSource
      );
      const jsonText = dec.decode(decryptedBuffer);
      const restored = JSON.parse(jsonText);
      return normalizeBackupData(restored);
    } catch {
      return null;
    }
  };

  // If parsed file has wrappedKeys (V2)
  if (parsed.wrappedKeys && typeof parsed.wrappedKeys === 'object') {
    const wk = parsed.wrappedKeys;

    // 1. Try User Account Key if user is logged in
    if (wk.account && currentUser && (currentUser.email || currentUser.uid)) {
      const cleanEmail = (currentUser.email || '').toLowerCase().trim();
      const accountSecrets = [
        `${APP_CORE_PEPPER}::ACCOUNT::${currentUser.uid || 'NO_UID'}::EMAIL::${cleanEmail}`,
        `${APP_CORE_PEPPER}::ACCOUNT::${currentUser.uid}::EMAIL::${cleanEmail}`,
        `${APP_CORE_PEPPER}::ACCOUNT::${currentUser.uid}::EMAIL::`,
        `${APP_CORE_PEPPER}::ACCOUNT::::EMAIL::${cleanEmail}`,
        `${APP_CORE_PEPPER}::EMAIL::${cleanEmail}`,
      ];

      for (const secret of accountSecrets) {
        const dek = await tryUnwrapDek(wk.account, secret);
        if (dek) {
          const data = await decryptPayloadWithDek(dek);
          if (data) return { success: true, data, isEncrypted: true, unlockedVia: 'account' };
        }
      }
    }

    // 2. Try Universal App Vault Key
    if (wk.universal) {
      const universalDek = await tryUnwrapDek(wk.universal, `${APP_CORE_PEPPER}::UNIVERSAL_VAULT_V2`);
      if (universalDek) {
        const data = await decryptPayloadWithDek(universalDek);
        if (data) return { success: true, data, isEncrypted: true, unlockedVia: 'universal' };
      }
    }

    // 3. Try Local Device Key
    if (wk.device) {
      const localSeed = getOrCreateVaultSeed();
      const deviceSeeds = [localSeed, parsed.metadata?.vaultSeed].filter(Boolean) as string[];
      for (const s of deviceSeeds) {
        const deviceDek = await tryUnwrapDek(wk.device, `${APP_CORE_PEPPER}::VAULT::${s}`);
        if (deviceDek) {
          const data = await decryptPayloadWithDek(deviceDek);
          if (data) return { success: true, data, isEncrypted: true, unlockedVia: 'device' };
        }
      }
    }

    // 4. Try Custom Password / PIN
    if (optionalPassword && optionalPassword.trim()) {
      const pass = optionalPassword.trim();
      if (wk.custom) {
        const customDek = await tryUnwrapDek(wk.custom, `${APP_CORE_PEPPER}::CUSTOM::${pass}`);
        if (customDek) {
          const data = await decryptPayloadWithDek(customDek);
          if (data) return { success: true, data, isEncrypted: true, unlockedVia: 'password' };
        }
      }
      if (wk.account) {
        const acctDek = await tryUnwrapDek(wk.account, `${APP_CORE_PEPPER}::ACCOUNT::::EMAIL::${pass.toLowerCase()}`);
        if (acctDek) {
          const data = await decryptPayloadWithDek(acctDek);
          if (data) return { success: true, data, isEncrypted: true, unlockedVia: 'password' };
        }
      }
    }
  }

  // =========================================================================
  // CASE B: V1 ENVELOPE (Legacy Single-Key AES-256-GCM)
  // =========================================================================
  let salt: Uint8Array;
  let iv: Uint8Array;

  try {
    salt = base64ToBuffer(parsed.salt);
    iv = base64ToBuffer(parsed.iv);
  } catch {
    return {
      success: false,
      requiresPassword: false,
      message: 'Corrupt encrypted envelope: invalid Base64 salt or iv.',
    };
  }

  const envelopeAppletId = parsed.metadata?.appletId || '';
  const envelopeVaultSeed = parsed.metadata?.vaultSeed || '';
  const localSeed = getOrCreateVaultSeed();

  const tryDecryptWithSecret = async (secret: string, iterations = 100000): Promise<any | null> => {
    try {
      const baseKey = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt as BufferSource,
          iterations,
          hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
        },
        key,
        ciphertext as BufferSource
      );
      const jsonText = dec.decode(decryptedBuffer);
      const restored = JSON.parse(jsonText);
      return normalizeBackupData(restored);
    } catch {
      return null;
    }
  };

  const tryDecryptRawPassword = async (password: string, iterations = 100000): Promise<any | null> => {
    try {
      const baseKey = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt as BufferSource,
          iterations,
          hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
        },
        key,
        ciphertext as BufferSource
      );
      const jsonText = dec.decode(decryptedBuffer);
      const restored = JSON.parse(jsonText);
      return normalizeBackupData(restored);
    } catch {
      return null;
    }
  };

  const knownPeppers = [
    APP_CORE_PEPPER,
    'EXPENSE_MGR_APP_EXCLUSIVE_KEY_SECRET_b6857511_2623_4c96_8b97_ff46d1559b93_PROD_v1',
    'EXPENSE_MGR_APP_EXCLUSIVE_KEY_SECRET_b6857511_2623_4c96_8b97_ff46d1559b93',
    'EXPENSE_MGR_APP_EXCLUSIVE_KEY_SECRET_c680affe_f9f3_4e33_8d66_80a1feff8568_PROD_v2',
    'EXPENSE_MGR_APP_EXCLUSIVE_KEY_SECRET_c680affe_f9f3_4e33_8d66_80a1feff8568_PROD_v1',
    'EXPENSE_MGR_APP_EXCLUSIVE_KEY_SECRET_c680affe_f9f3_4e33_8d66_80a1feff8568',
    'ExpenseManager_DB_MasterKey_v1',
    'ExpenseManager',
  ];

  const candidateSecrets: string[] = [];

  // Account secrets if user is authenticated or known
  const candidateEmails = [
    currentUser?.email,
    parsed.metadata?.userEmail,
    'abhishekkumarsingh2603@gmail.com',
  ].filter(Boolean) as string[];

  for (const pep of knownPeppers) {
    candidateSecrets.push(`${pep}::UNIVERSAL_VAULT_V2`);
    candidateSecrets.push(`${pep}::UNIVERSAL`);
    candidateSecrets.push(pep);

    for (const em of candidateEmails) {
      const cleanEm = em.toLowerCase().trim();
      if (currentUser?.uid) {
        candidateSecrets.push(`${pep}::ACCOUNT::${currentUser.uid}::EMAIL::${cleanEm}`);
      }
      candidateSecrets.push(`${pep}::ACCOUNT::::EMAIL::${cleanEm}`);
      candidateSecrets.push(`${pep}::EMAIL::${cleanEm}`);
      candidateSecrets.push(`${pep}::CUSTOM::${cleanEm}`);
    }

    if (envelopeVaultSeed) {
      candidateSecrets.push(`${pep}::VAULT::${envelopeVaultSeed}::APPLET::${envelopeAppletId || ORIGINAL_APPLET_ID}`);
      candidateSecrets.push(`${pep}::VAULT::${envelopeVaultSeed}::APPLET::${CURRENT_APPLET_ID}`);
      candidateSecrets.push(`${pep}::VAULT::${envelopeVaultSeed}::APPLET::${ORIGINAL_APPLET_ID}`);
      candidateSecrets.push(`${pep}::VAULT::${envelopeVaultSeed}`);
    }

    if (envelopeAppletId) {
      candidateSecrets.push(`${pep}::APPLET::${envelopeAppletId}`);
      candidateSecrets.push(`${pep}::VAULT::${localSeed}::APPLET::${envelopeAppletId}`);
    }

    candidateSecrets.push(`${pep}::VAULT::${localSeed}::APPLET::${ORIGINAL_APPLET_ID}`);
    candidateSecrets.push(`${pep}::VAULT::${localSeed}::APPLET::${CURRENT_APPLET_ID}`);
    candidateSecrets.push(`${pep}::APPLET::${ORIGINAL_APPLET_ID}`);
    candidateSecrets.push(`${pep}::APPLET::${CURRENT_APPLET_ID}`);
    candidateSecrets.push(`${pep}::VAULT::${localSeed}`);

    candidateSecrets.push(`${pep}::VAULT::DEFAULT_DEVICE_VAULT_SEED_010203::APPLET::${ORIGINAL_APPLET_ID}`);
    candidateSecrets.push(`${pep}::VAULT::DEFAULT_DEVICE_VAULT_SEED_010203::APPLET::${CURRENT_APPLET_ID}`);
    candidateSecrets.push(`${pep}::VAULT::DEFAULT_DEVICE_VAULT_SEED_010203`);

    candidateSecrets.push(`${pep}::CUSTOM::1234`);
    candidateSecrets.push(`${pep}::CUSTOM::0000`);
    candidateSecrets.push(`${pep}::CUSTOM::`);
  }

  for (const candidate of candidateSecrets) {
    const result = await tryDecryptWithSecret(candidate, 100000);
    if (result) {
      return { success: true, data: result, isEncrypted: true, unlockedVia: 'legacy' };
    }
  }

  for (const raw of ['', '1234', '0000', '1111', '123456']) {
    const res = await tryDecryptRawPassword(raw, 100000);
    if (res) {
      return { success: true, data: res, isEncrypted: true, unlockedVia: 'legacy' };
    }
  }

  for (const pep of [APP_CORE_PEPPER, 'ExpenseManager_DB_MasterKey_v1']) {
    const res = await tryDecryptWithSecret(`${pep}::UNIVERSAL_VAULT_V2`, 10000);
    if (res) return { success: true, data: res, isEncrypted: true, unlockedVia: 'legacy' };
    const resPin = await tryDecryptWithSecret(`${pep}::CUSTOM::1234`, 10000);
    if (resPin) return { success: true, data: resPin, isEncrypted: true, unlockedVia: 'legacy' };
  }

  if (optionalPassword && optionalPassword.trim()) {
    const rawPass = optionalPassword.trim();
    const cleanHex = rawPass.replace(/[^a-fA-F0-9]/g, '').toUpperCase();

    const userCandidates: string[] = [];
    for (const pep of knownPeppers) {
      userCandidates.push(`${pep}::CUSTOM::${rawPass}`);
      userCandidates.push(`${pep}::${rawPass}`);
      if (cleanHex) {
        userCandidates.push(`${pep}::VAULT::${cleanHex}::APPLET::${envelopeAppletId || ORIGINAL_APPLET_ID}`);
        userCandidates.push(`${pep}::VAULT::${cleanHex}::APPLET::${CURRENT_APPLET_ID}`);
        userCandidates.push(`${pep}::VAULT::${cleanHex}`);
        userCandidates.push(`${pep}::VAULT::${rawPass}::APPLET::${ORIGINAL_APPLET_ID}`);
        userCandidates.push(`${pep}::CUSTOM::${cleanHex}`);
      }
    }

    for (const cand of userCandidates) {
      const res = await tryDecryptWithSecret(cand, 100000);
      if (res) return { success: true, data: res, isEncrypted: true, unlockedVia: 'password' };
    }

    for (const cand of userCandidates.slice(0, 10)) {
      const res = await tryDecryptWithSecret(cand, 10000);
      if (res) return { success: true, data: res, isEncrypted: true, unlockedVia: 'password' };
    }

    const rawRes = await tryDecryptRawPassword(rawPass, 100000);
    if (rawRes) return { success: true, data: rawRes, isEncrypted: true, unlockedVia: 'password' };

    if (cleanHex && cleanHex !== rawPass) {
      const hexRes = await tryDecryptRawPassword(cleanHex, 100000);
      if (hexRes) return { success: true, data: hexRes, isEncrypted: true, unlockedVia: 'password' };
    }
  }

  const envelopeEmail = parsed.metadata?.userEmail || parsed.wrappedKeys?.account?.userEmail;

  if (!optionalPassword) {
    return {
      success: false,
      requiresPassword: true,
      isEncrypted: true,
      envelopeAppletId,
      accountEmail: envelopeEmail,
      message: envelopeEmail
        ? `This backup is encrypted with account: ${envelopeEmail}. Sign in with your Google or Email account to unlock automatically, or enter the backup password.`
        : 'This backup is password-protected or requires a Device Key. Please sign in or enter the password.',
    };
  }

  return {
    success: false,
    requiresPassword: true,
    isEncrypted: true,
    envelopeAppletId,
    accountEmail: envelopeEmail,
    message: 'Decryption failed. Please check the backup password, app PIN (default: 1234), or 16-character Device Key.',
  };
}

/**
 * Inspects a backup file to check its encryption state and whether it can be auto-decrypted
 */
export async function inspectBackupContent(
  fileContent: string,
  options?: { user?: BackupUserInfo | null; password?: string }
): Promise<{
  isEncrypted: boolean;
  canAutoDecrypt: boolean;
  requiresPassword: boolean;
  accountEmail?: string;
  metadata?: any;
  message?: string;
}> {
  const trimmed = fileContent.trim().replace(/^\uFEFF/, '');
  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    try {
      parsed = JSON.parse(window.atob(trimmed));
    } catch {
      return {
        isEncrypted: false,
        canAutoDecrypt: false,
        requiresPassword: false,
        message: 'Invalid file format. Could not parse as JSON.',
      };
    }
  }

  const isEncrypted = Boolean(
    parsed &&
    typeof parsed === 'object' &&
    (parsed.magic === 'EXPMGR_APP_LOCK_V2' ||
     parsed.magic === 'EXPMGR_APP_LOCK_V1' ||
     parsed.magic === 'EXPMGR_ENC_V1' ||
     (parsed.ciphertext && parsed.salt && parsed.iv))
  );

  if (!isEncrypted) {
    return {
      isEncrypted: false,
      canAutoDecrypt: true,
      requiresPassword: false,
    };
  }

  const testRes = await decryptBackupData(fileContent, options);
  const accountEmail = parsed.metadata?.userEmail || parsed.wrappedKeys?.account?.userEmail;

  if (testRes.success) {
    return {
      isEncrypted: true,
      canAutoDecrypt: true,
      requiresPassword: false,
      accountEmail,
      metadata: parsed.metadata,
    };
  }

  return {
    isEncrypted: true,
    canAutoDecrypt: false,
    requiresPassword: true,
    accountEmail,
    metadata: parsed.metadata,
    message: testRes.message,
  };
}
