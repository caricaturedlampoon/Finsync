import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Download,
  Upload,
  Cloud,
  HardDrive,
  RefreshCw,
  Check,
  X,
  Trash2,
  Clock,
  Layers,
  CheckCircle2,
  Copy,
  Mail,
  ArrowLeft,
  FileCheck,
} from 'lucide-react';
import {
  listLocalSnapshots,
  deleteLocalSnapshot,
  downloadSnapshotFile,
  LocalAutoSnapshot,
} from '../../services/autoBackupEngine';
import { DriveBackupFile } from '../../services/googleDriveService';
import { inspectBackupContent, getAppLockKeycode } from '../../utils/cryptoBackup';
import { BinView } from './BinView';

export const EncryptedBackupModal: React.FC = () => {
  const {
    isBackupModalOpen,
    setIsBackupModalOpen,
    exportEncryptedBackup,
    restoreEncryptedBackup,
    googleUser,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logoutAccount,
    isGoogleDriveConnected,
    connectGoogleDrive,
    disconnectGoogleDrive,
    backupToGoogleDrive,
    restoreFromGoogleDrive,
    listGoogleDriveBackups,
    deleteGoogleDriveBackup,
    settings,
    updateSettings,
    bin,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'file' | 'drive' | 'auto' | 'bin'>('file');

  // Account Authentication Form State
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Export State
  const [isExporting, setIsExporting] = useState(false);

  // Restore State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [fallbackPasswordRequired, setFallbackPasswordRequired] = useState(false);
  const [fallbackPassword, setFallbackPassword] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState<{
    status: 'idle' | 'analyzing' | 'ready_auto' | 'requires_password' | 'invalid';
    message?: string;
    accountEmail?: string;
    metadata?: any;
  }>({ status: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Drive State
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [isLoadingDriveList, setIsLoadingDriveList] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [restoringDriveId, setRestoringDriveId] = useState<string | null>(null);

  // Automated Backup Configuration State
  const [autoSchedule, setAutoSchedule] = useState<'off' | 'daily' | 'weekly'>(
    settings.autoBackupSchedule || 'daily'
  );
  const [autoTarget, setAutoTarget] = useState<'local' | 'google_drive' | 'both'>(
    settings.autoBackupTarget || 'both'
  );
  const [localSnapshots, setLocalSnapshots] = useState<LocalAutoSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);

  // Load drive backups whenever drive tab is opened or connected
  useEffect(() => {
    if (isBackupModalOpen && isGoogleDriveConnected && activeTab === 'drive') {
      fetchDriveBackupsList();
    }
  }, [isBackupModalOpen, isGoogleDriveConnected, activeTab]);

  // Load local snapshots when auto tab is selected
  useEffect(() => {
    if (isBackupModalOpen && activeTab === 'auto') {
      fetchLocalSnapshots();
    }
  }, [isBackupModalOpen, activeTab]);

  // If user signs in or out while a file is selected, re-inspect to evaluate account auto-decrypt
  useEffect(() => {
    if (restoreFile) {
      reinspectFile(restoreFile);
    }
  }, [googleUser]);

  const fetchDriveBackupsList = async () => {
    setIsLoadingDriveList(true);
    try {
      const list = await listGoogleDriveBackups();
      setDriveBackups(list);
    } catch (err: any) {
      console.warn('Failed to load drive backups:', err);
    } finally {
      setIsLoadingDriveList(false);
    }
  };

  const fetchLocalSnapshots = async () => {
    setIsLoadingSnapshots(true);
    try {
      const list = await listLocalSnapshots();
      setLocalSnapshots(list);
    } catch (err) {
      console.warn('Failed to list local snapshots:', err);
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  // Inspect selected backup file against current credentials
  const reinspectFile = async (file: File, userOverride?: any) => {
    setFileAnalysis({ status: 'analyzing' });
    try {
      const text = await file.text();
      const targetUser = userOverride !== undefined ? userOverride : googleUser;
      const inspection = await inspectBackupContent(text, { user: targetUser });

      if (!inspection.isEncrypted) {
        setFileAnalysis({
          status: 'ready_auto',
          message: 'Standard backup file ready to restore.',
          metadata: inspection.metadata,
        });
        setFallbackPasswordRequired(false);
      } else if (inspection.canAutoDecrypt) {
        setFileAnalysis({
          status: 'ready_auto',
          message: inspection.accountEmail
            ? `Verified & unlocked for ${inspection.accountEmail}`
            : 'Encrypted backup verified & auto-unlocked',
          metadata: inspection.metadata,
          accountEmail: inspection.accountEmail,
        });
        setFallbackPasswordRequired(false);
      } else {
        const emailMsg = inspection.accountEmail
          ? `Protected under ${inspection.accountEmail}. Sign in above or enter PIN/Key below.`
          : 'Enter your PIN (default: 1234) or 16-character Device Key below.';
        setFileAnalysis({
          status: 'requires_password',
          message: emailMsg,
          metadata: inspection.metadata,
          accountEmail: inspection.accountEmail,
        });
        setFallbackPasswordRequired(true);
      }
    } catch {
      setFileAnalysis({ status: 'idle' });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setFallbackPasswordRequired(false);
      setFallbackPassword('');
      await reinspectFile(file);
    }
  };

  // Handle Google Login
  const handleGoogleSignIn = async () => {
    const user = await loginWithGoogle();
    if (user && restoreFile) {
      await reinspectFile(restoreFile, user);
    }
  };

  // Handle Email / Password Login or Sign Up
  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      showToast('Please enter both email and password', 'error');
      return;
    }
    if (authPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    setIsSubmittingAuth(true);
    try {
      if (authMode === 'signup') {
        const u = await registerWithEmail(authEmail.trim(), authPassword, authName.trim() || undefined);
        if (u) {
          setShowEmailForm(false);
          setAuthPassword('');
          if (restoreFile) reinspectFile(restoreFile, u);
        }
      } else {
        const u = await loginWithEmail(authEmail.trim(), authPassword);
        if (u) {
          setShowEmailForm(false);
          setAuthPassword('');
          if (restoreFile) reinspectFile(restoreFile, u);
        }
      }
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // 1-Click Encrypted Export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportEncryptedBackup();
    } finally {
      setIsExporting(false);
    }
  };

  // Restore
  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) {
      showToast('Please select a backup file (.finsync.enc) to restore.', 'error');
      return;
    }

    setIsRestoring(true);
    try {
      const res = await restoreEncryptedBackup(restoreFile, fallbackPassword || undefined);
      if (res.success) {
        setRestoreFile(null);
        setFallbackPasswordRequired(false);
        setFallbackPassword('');
        setFileAnalysis({ status: 'idle' });
        setIsBackupModalOpen(false);
      } else if (res.requiresPassword) {
        setFallbackPasswordRequired(true);
        setFileAnalysis({
          status: 'requires_password',
          message: res.message || 'Decryption key needed. Enter PIN (1234), password, or Device Key.',
        });
        showToast(res.message || 'Decryption required: please enter PIN, password, or Device Key.', 'info');
      } else {
        showToast(res.message || 'Failed to restore backup.', 'error');
      }
    } catch (err: any) {
      console.warn('[Restore]', err);
      setFallbackPasswordRequired(true);
      showToast(err?.message || 'Decryption required.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCopyCurrentKey = () => {
    try {
      const key = getAppLockKeycode();
      navigator.clipboard.writeText(key);
      setCopiedKey(true);
      showToast(`Copied Device Key: ${key}`, 'info');
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      showToast('Could not copy to clipboard', 'error');
    }
  };

  // Google Drive Handlers
  const handleUploadToDrive = async () => {
    setIsUploadingToDrive(true);
    try {
      await backupToGoogleDrive();
      await fetchDriveBackupsList();
    } catch (err: any) {
      showToast(err.message || 'Failed to upload backup to Google Drive', 'error');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleRestoreFromDrive = async (file: DriveBackupFile) => {
    setRestoringDriveId(file.id);
    try {
      const ok = await restoreFromGoogleDrive(file.id);
      if (ok) {
        setIsBackupModalOpen(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to restore backup from Google Drive', 'error');
    } finally {
      setRestoringDriveId(null);
    }
  };

  const handleDeleteDriveFile = async (fileId: string) => {
    if (!window.confirm('Delete this encrypted backup from Google Drive?')) {
      return;
    }
    await deleteGoogleDriveBackup(fileId);
    await fetchDriveBackupsList();
  };

  const handleSaveAutoSettings = () => {
    updateSettings({
      autoBackupSchedule: autoSchedule,
      autoBackupTarget: autoTarget,
    });
    showToast('Automated backup schedule updated successfully!', 'success');
  };

  const handleRestoreSnapshot = async (snap: LocalAutoSnapshot) => {
    setRestoringSnapshotId(snap.id);
    try {
      const res = await restoreEncryptedBackup(snap.encryptedContent);
      if (res.success) {
        setIsBackupModalOpen(false);
      } else {
        showToast(res.message || 'Failed to restore snapshot', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to restore snapshot', 'error');
    } finally {
      setRestoringSnapshotId(null);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    await deleteLocalSnapshot(id);
    await fetchLocalSnapshots();
    showToast('Snapshot removed from local device vault', 'info');
  };

  if (!isBackupModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950 flex flex-col h-[100dvh] w-full overflow-hidden animate-in fade-in duration-200">
      {/* 1. Header (Sticky Top Bar) */}
      <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shadow-2xs z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setIsBackupModalOpen(false)}
            className="p-2 -ml-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Back / Close"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                Backup & Restore
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 shrink-0">
                AES-256
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              Encrypted files, Google Drive cloud sync & auto-snapshots
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {googleUser && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="max-w-[140px] truncate font-medium">{googleUser.email}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsBackupModalOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Navigation Tabs (Sticky Top Bar) */}
      <div className="shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'file'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>File Backup</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('drive')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'drive'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Google Drive</span>
              {isGoogleDriveConnected && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 ml-0.5 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('auto')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'auto'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Auto Snapshots</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                {settings.autoBackupSchedule || 'daily'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bin')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'bin'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Recycle Bin</span>
              {bin.length > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === 'bin'
                    ? 'bg-white/20 text-white'
                    : 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                }`}>
                  {bin.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Full-Screen Vertical Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-safe min-h-0 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-6 space-y-5">
          {/* Streamlined Account Bar */}
          {googleUser ? (
            <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                  {googleUser.photoURL ? (
                    <img src={googleUser.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (googleUser.email || googleUser.displayName || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {googleUser.displayName || googleUser.email}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Sync Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Backups auto-unlock across devices signed in to this account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={logoutAccount}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shrink-0"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      Optional: Cross-Device Account Sync
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Sign in to auto-decrypt backups on another phone or browser.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEmailForm(!showEmailForm)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    <Mail className="w-3.5 h-3.5 inline mr-1" />
                    <span>Email</span>
                  </button>
                </div>
              </div>

              {showEmailForm && (
                <form onSubmit={handleEmailAuthSubmit} className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {authMode === 'signin' ? 'Sign in with Email' : 'Create an account'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                      className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                    >
                      {authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {authMode === 'signup' && (
                      <input
                        type="text"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="Your Name (optional)"
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="Email address"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="password"
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Password (min 6 chars)"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingAuth}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {isSubmittingAuth && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{authMode === 'signin' ? 'Sign In' : 'Sign Up'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 1: FILE BACKUP */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              {/* Export Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        Export Backup File
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Saves an encrypted copy of all accounts, transactions, investments, and settings.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex items-center justify-center gap-2 py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer text-xs w-full sm:w-auto"
                  >
                    {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    <span>{isExporting ? 'Generating...' : 'Download Encrypted Backup (.finsync.enc)'}</span>
                  </button>
                </div>
              </div>

              {/* Restore Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      Restore from Backup File
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Select a <code>.finsync.enc</code>, <code>.expmgr.enc</code>, or <code>.json</code> file to restore data.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleRestore} className="space-y-3 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".finsync.enc,.enc,.expmgr.enc,.bk,.json,.txt,application/json,application/octet-stream,*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors truncate"
                    >
                      <FileCheck className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="truncate">
                        {restoreFile ? restoreFile.name : 'Choose Backup File (.finsync.enc)...'}
                      </span>
                    </button>

                    {restoreFile && (
                      <span className="text-xs text-slate-400 font-mono shrink-0 text-center">
                        {(restoreFile.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>

                  {/* Status Indicator */}
                  {restoreFile && fileAnalysis.status === 'analyzing' && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying file encryption...</span>
                    </div>
                  )}

                  {restoreFile && fileAnalysis.status === 'ready_auto' && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{fileAnalysis.message || 'File verified & ready to restore.'}</span>
                    </div>
                  )}

                  {fallbackPasswordRequired && (
                    <div className="space-y-2.5 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          Enter PIN, Password, or Device Key:
                        </label>
                      </div>

                      <input
                        type="text"
                        value={fallbackPassword}
                        onChange={(e) => setFallbackPassword(e.target.value)}
                        placeholder="e.g. 1234 or XXXX-XXXX-XXXX-XXXX"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />

                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setFallbackPassword('1234')}
                          className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 cursor-pointer"
                        >
                          Default PIN (1234)
                        </button>
                        {settings.appLockPin && settings.appLockPin !== '1234' && (
                          <button
                            type="button"
                            onClick={() => setFallbackPassword(settings.appLockPin || '')}
                            className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 cursor-pointer"
                          >
                            App Lock PIN ({settings.appLockPin})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleCopyCurrentKey}
                          className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedKey ? 'Copied!' : 'Copy Device Key'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isRestoring || !restoreFile}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm shadow-blue-600/20 active:scale-95 transition-all cursor-pointer text-xs"
                  >
                    {isRestoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                    <span>{isRestoring ? 'Restoring...' : 'Restore Records'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE DRIVE */}
          {activeTab === 'drive' && (
            <div className="space-y-4">
              {/* Drive Connection Status */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        Google Drive Cloud
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isGoogleDriveConnected
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {isGoogleDriveConnected ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {isGoogleDriveConnected && googleUser
                        ? googleUser.email
                        : 'Sync encrypted backups directly to your personal Google Drive'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {isGoogleDriveConnected ? (
                    <button
                      type="button"
                      onClick={disconnectGoogleDrive}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl transition-colors cursor-pointer"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={connectGoogleDrive}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Connect Drive</span>
                    </button>
                  )}
                </div>
              </div>

              {isGoogleDriveConnected && (
                <>
                  {/* Action card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        One-Click Backup to Drive
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Encrypts and uploads current records to your Drive.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleUploadToDrive}
                      disabled={isUploadingToDrive}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer text-xs shrink-0 flex items-center gap-1.5"
                    >
                      {isUploadingToDrive ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                      <span>{isUploadingToDrive ? 'Syncing...' : 'Backup Now'}</span>
                    </button>
                  </div>

                  {/* List of Drive Backups */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-500" />
                        <span>Backups on Drive ({driveBackups.length})</span>
                      </h4>
                      <button
                        type="button"
                        onClick={fetchDriveBackupsList}
                        disabled={isLoadingDriveList}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Refresh list"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDriveList ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    {isLoadingDriveList ? (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-500" />
                        Loading backups...
                      </div>
                    ) : driveBackups.length === 0 ? (
                      <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
                        No backups found on Google Drive yet. Tap "Backup Now" above.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {driveBackups.map((file) => (
                          <div
                            key={file.id}
                            className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block truncate font-mono">
                                {file.name}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span>
                                  {new Date(file.createdTime).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {file.size && <span>• {(Number(file.size) / 1024).toFixed(1)} KB</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRestoreFromDrive(file)}
                                disabled={restoringDriveId === file.id}
                                className="px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                              >
                                {restoringDriveId === file.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Unlock className="w-3 h-3" />
                                )}
                                <span>Restore</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDriveFile(file.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: AUTO SNAPSHOTS */}
          {activeTab === 'auto' && (
            <div className="space-y-4">
              {/* Settings Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      Automatic Scheduled Snapshots
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Snapshots are automatically encrypted and saved to your device and cloud.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Frequency:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'daily', label: 'Daily (24h)' },
                        { id: 'weekly', label: 'Weekly (7d)' },
                        { id: 'off', label: 'Off' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setAutoSchedule(opt.id as any)}
                          className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs ${
                            autoSchedule === opt.id
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Destination:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'both', label: 'Local & Drive', icon: Layers },
                        { id: 'local', label: 'Local Vault', icon: HardDrive },
                        { id: 'google_drive', label: 'Google Drive', icon: Cloud },
                      ].map((dest) => {
                        const Icon = dest.icon;
                        return (
                          <button
                            key={dest.id}
                            type="button"
                            onClick={() => setAutoTarget(dest.id as any)}
                            className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs flex items-center justify-center gap-1.5 ${
                              autoTarget === dest.id
                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{dest.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAutoSettings}
                    className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 mt-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Schedule Preferences</span>
                  </button>
                </div>
              </div>

              {/* Automated Daily Snapshots Manager Block */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Automated Daily Snapshots Manager ({localSnapshots.length})</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      AES-256 encrypted local point-in-time state backups with one-click restoration
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchLocalSnapshots}
                    disabled={isLoadingSnapshots}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Refresh snapshots"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSnapshots ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {localSnapshots.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs space-y-1">
                    <Clock className="w-6 h-6 mx-auto opacity-40 text-purple-500 mb-1" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">No automated snapshots created yet</p>
                    <p className="text-[11px] text-slate-400">Daily snapshots run automatically based on your schedule preferences above.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {localSnapshots.map((snap) => {
                      const relTime = (() => {
                        const diffSec = Math.max(0, Math.floor((Date.now() - snap.timestamp) / 1000));
                        if (diffSec < 60) return 'Just now';
                        const diffMin = Math.floor(diffSec / 60);
                        if (diffMin < 60) return `${diffMin}m ago`;
                        const diffHr = Math.floor(diffMin / 60);
                        if (diffHr < 24) return `${diffHr}h ago`;
                        const diffDay = Math.floor(diffHr / 24);
                        if (diffDay < 30) return `${diffDay}d ago`;
                        const diffMo = Math.floor(diffDay / 30);
                        return `${diffMo}mo ago`;
                      })();

                      const preciseSize = snap.sizeBytes >= 1024 * 1024
                        ? `${(snap.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
                        : `${(snap.sizeBytes / 1024).toFixed(1)} KB`;

                      const isCloud = Boolean(snap.googleDriveFileId || snap.target === 'google_drive');
                      const isBoth = snap.target === 'both';
                      const sourceLabel = isBoth
                        ? 'Auto Cloud & Local'
                        : isCloud
                        ? 'Auto Cloud'
                        : snap.fileName.includes('Auto')
                        ? 'Auto Local'
                        : 'Manual Local';

                      const exactTimestamp = new Date(snap.timestamp).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });

                      return (
                        <div
                          key={snap.id}
                          className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-purple-300 dark:hover:border-purple-800 transition-colors"
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                                {snap.fileName}
                              </span>
                              {/* Relative time badge */}
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 shrink-0">
                                {relTime}
                              </span>
                              {/* Source Indicator */}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                                  isCloud || isBoth
                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {isCloud || isBoth ? <Cloud className="w-2.5 h-2.5" /> : <HardDrive className="w-2.5 h-2.5" />}
                                <span>{sourceLabel}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{exactTimestamp}</span>
                              </span>
                              <span>•</span>
                              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                {preciseSize}
                              </span>
                            </div>
                          </div>

                          {/* 1-Click Action Button Group: Restore & Download */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => downloadSnapshotFile(snap)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                              title="Download backup file"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                              <span>Download</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRestoreSnapshot(snap)}
                              disabled={restoringSnapshotId === snap.id}
                              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shadow-purple-600/20 active:scale-95"
                              title="1-Click Restore Snapshot"
                            >
                              {restoringSnapshotId === snap.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                              <span>{restoringSnapshotId === snap.id ? 'Restoring...' : 'Restore'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSnapshot(snap.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                              title="Delete snapshot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: RECYCLE BIN (30-Day Recovery) */}
          {activeTab === 'bin' && (
            <div className="py-1 animate-in fade-in duration-150">
              <BinView isEmbedded />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
