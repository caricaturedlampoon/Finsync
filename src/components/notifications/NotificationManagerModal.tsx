import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  NotificationSettings,
  AppNotification,
} from '../../types';
import {
  getStoredNotificationSettings,
  saveNotificationSettings,
  getStoredNotifications,
  saveStoredNotifications,
  requestNotificationPermission,
  checkNotificationPermissionState,
  triggerTestNotification,
  syncAllNativeScheduledReminders,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../../services/offlineNotificationEngine';
import { fileService } from '../../services/fileService';
import {
  Bell,
  X,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Users,
  Settings,
  Play,
  Trash2,
  Check,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface NotificationManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationManagerModal: React.FC<NotificationManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    openTransactionModal,
    setActiveTab,
    setIsDebtsModalOpen,
    setIsRecurringModalOpen,
    recurring,
    loans,
    debts,
    showToast,
    clearModalOpenedFromTools,
    setIsExtendedToolsOpen,
    openBudgetModal,
    openCalendarModal,
  } = useApp();

  const [activeTab, setActiveTabLocal] = useState<'settings' | 'history'>('settings');
  const [settings, setSettingsLocal] = useState<NotificationSettings>(getStoredNotificationSettings);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permissionState, setPermissionState] = useState<string>('default');

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  useEffect(() => {
    if (isOpen) {
      setSettingsLocal(getStoredNotificationSettings());
      setNotifications(getStoredNotifications());
      checkNotificationPermissionState().then((state) => {
        setPermissionState(state);
      }).catch(() => {});
    }
  }, [isOpen]);

  // Listen for real-time notification events to update in-app notification history
  useEffect(() => {
    const handleNew = () => {
      try {
        setNotifications(getStoredNotifications());
      } catch {}
    };
    window.addEventListener('finsync_notification_history_updated', handleNew);
    window.addEventListener('finsync_new_notification', handleNew);
    return () => {
      window.removeEventListener('finsync_notification_history_updated', handleNew);
      window.removeEventListener('finsync_new_notification', handleNew);
    };
  }, []);

  if (!isOpen) return null;

  const handleUpdateSettings = (newSettings: NotificationSettings) => {
    try {
      setSettingsLocal(newSettings);
      saveNotificationSettings(newSettings);
      syncAllNativeScheduledReminders({
        recurring,
        loans,
        debts,
        settings: newSettings,
      }).catch(() => {});
      showToast('Notification settings saved', 'success');
    } catch {
      showToast('Error saving settings', 'error');
    }
  };

  const handleRequestPermission = async () => {
    try {
      const granted = await requestNotificationPermission();
      const state = await checkNotificationPermissionState();
      setPermissionState(state);
      if (granted) {
        showToast('System notifications enabled successfully!', 'success');
      } else {
        showToast('In-app alerts remain 100% active and running!', 'info');
      }
    } catch {
      showToast('In-app alerts remain 100% active and running!', 'info');
    }
  };

  const handleMarkAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    saveStoredNotifications(updated);
    showToast('All notifications marked as read', 'info');
  };

  const handleClearHistory = () => {
    setNotifications([]);
    saveStoredNotifications([]);
    showToast('Notification log cleared', 'info');
  };

  const handleActionClick = (item: AppNotification) => {
    clearModalOpenedFromTools();
    setIsExtendedToolsOpen(false);
    onClose();
    if (item.actionType === 'view_report' || item.type === 'report_downloaded') {
      const extra = item.extra;
      fileService.openOrViewFile(extra?.fileUri, extra?.filename, extra?.mimeType, extra?.blobUrl);
      return;
    }
    const actionType = item.actionType;
    if (actionType === 'add_expense') {
      openTransactionModal('expense');
    } else if (actionType === 'view_portfolio') {
      setActiveTab('investments');
    } else if (actionType === 'view_debts') {
      setIsDebtsModalOpen(true);
    } else if (actionType === 'view_recurring') {
      setIsRecurringModalOpen(true);
    } else if (actionType === 'view_analytics') {
      setActiveTab('analytics');
    } else if (actionType === 'view_budget' || item.type === 'budget_alert') {
      openBudgetModal();
    } else if (actionType === 'view_calendar') {
      openCalendarModal();
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
      {/* Top App Bar with safe area padding */}
      <header className="px-4 sm:px-6 pt-safe pb-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Local Notification Engine
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                100% Offline
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scheduled reminders, portfolio alerts & spending triggers without cloud servers
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close Notifications"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 shrink-0 bg-white dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setActiveTabLocal('settings')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Reminder Settings & Toggles</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTabLocal('history')}
          className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Alert Tray & Log</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white leading-none">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Body Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-5">
          {activeTab === 'settings' ? (
            <>
              {/* Notification Status & Permission Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          In-App Offline Alerts: 100% Active & Operational
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          Always Ready
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        {isInIframe
                          ? 'Running in sandboxed preview iframe. In-app alerts, sounds, and history logs work continuously. OS status bar popups require a standalone tab.'
                          : permissionState === 'denied'
                          ? 'Browser OS push is currently blocked in site settings. In-app alerts, floating toasts, and notification logs work 100% reliably.'
                          : 'In-app reminders, spending threshold warnings, and daily portfolio briefs are armed and active.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        triggerTestNotification('daily_expense');
                        showToast('Test notification dispatched! Check your screen toast and history log.', 'success');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Test Alert</span>
                    </button>

                    {permissionState !== 'granted' && (
                      <button
                        type="button"
                        onClick={handleRequestPermission}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        <span>{isInIframe ? 'Enable OS Alerts' : 'Allow Push'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {permissionState === 'denied' && !isInIframe && (
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                    <span className="text-[11px]">
                      To unblock OS push notifications: Click the padlock or settings icon beside the URL in your browser address bar → Change <strong>Notifications</strong> from Block to <strong>Allow</strong> → Refresh.
                    </span>
                  </div>
                )}

                {isInIframe && (
                  <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px]">
                      Tip: For native OS system tray push outside the preview frame, open in a standalone tab or install as PWA.
                    </span>
                    <a
                      href={typeof window !== 'undefined' ? window.location.href : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Open Standalone Tab ↗</span>
                    </a>
                  </div>
                )}
              </div>

              {/* 1. Daily Expense Reminder */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Clock className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        1. Daily Expense Reminder
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Prompt to log transactions if no spends recorded today
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.dailyExpenseReminder.enabled}
                      onChange={(e) =>
                        handleUpdateSettings({
                          ...settings,
                          dailyExpenseReminder: {
                            ...settings.dailyExpenseReminder,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {settings.dailyExpenseReminder.enabled && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span>Reminder Time:</span>
                      <input
                        type="time"
                        value={settings.dailyExpenseReminder.time}
                        onChange={(e) =>
                          handleUpdateSettings({
                            ...settings,
                            dailyExpenseReminder: {
                              ...settings.dailyExpenseReminder,
                              time: e.target.value,
                            },
                          })
                        }
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerTestNotification('daily_expense')}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Test Alert</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Portfolio Performance Updates */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        2. Portfolio Performance Updates
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Daily 1-day change, Sunday wrap & stock volatility alerts
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.portfolioDailyUpdate.enabled}
                      onChange={(e) =>
                        handleUpdateSettings({
                          ...settings,
                          portfolioDailyUpdate: {
                            ...settings.portfolioDailyUpdate,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span>Daily Morning Brief Time:</span>
                      <input
                        type="time"
                        value={settings.portfolioDailyUpdate.time}
                        onChange={(e) =>
                          handleUpdateSettings({
                            ...settings,
                            portfolioDailyUpdate: {
                              ...settings.portfolioDailyUpdate,
                              time: e.target.value,
                            },
                          })
                        }
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerTestNotification('portfolio_daily')}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Test Daily Brief</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span>Sunday Weekly Summary:</span>
                      <input
                        type="time"
                        value={settings.portfolioWeeklySummary.time}
                        onChange={(e) =>
                          handleUpdateSettings({
                            ...settings,
                            portfolioWeeklySummary: {
                              ...settings.portfolioWeeklySummary,
                              time: e.target.value,
                            },
                          })
                        }
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerTestNotification('portfolio_weekly')}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Test Weekly Wrap</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span>Stock / MF Swing Alert Threshold:</span>
                      <span className="font-bold">{settings.portfolioSignificantChange.thresholdPercent}%</span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={settings.portfolioSignificantChange.thresholdPercent}
                        onChange={(e) =>
                          handleUpdateSettings({
                            ...settings,
                            portfolioSignificantChange: {
                              ...settings.portfolioSignificantChange,
                              thresholdPercent: Number(e.target.value),
                            },
                          })
                        }
                        className="w-24 accent-emerald-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerTestNotification('portfolio_change')}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Test Swing Alert</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Category Spend Alerts */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        3. Category Spend Alerts
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Warn when spending crosses budget thresholds
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.categorySpendAlerts.enabled}
                      onChange={(e) =>
                        handleUpdateSettings({
                          ...settings,
                          categorySpendAlerts: {
                            ...settings.categorySpendAlerts,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 flex-wrap text-xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span>Alert at limit threshold:</span>
                    <span className="font-bold">{settings.categorySpendAlerts.thresholdPercent}%</span>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      step="5"
                      value={settings.categorySpendAlerts.thresholdPercent}
                      onChange={(e) =>
                        handleUpdateSettings({
                          ...settings,
                          categorySpendAlerts: {
                            ...settings.categorySpendAlerts,
                            thresholdPercent: Number(e.target.value),
                          },
                        })
                      }
                      className="w-24 accent-emerald-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerTestNotification('category_spend')}
                    className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Test Spend Alert</span>
                  </button>
                </div>
              </div>

              {/* 4. Recurring & SIP Reminders */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Calendar className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        4. Recurring & SIP Reminders
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Advance reminder 24 hours prior to upcoming debits & SIPs
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.recurringSipReminders.enabled}
                      onChange={(e) =>
                        handleUpdateSettings({
                          ...settings,
                          recurringSipReminders: {
                            ...settings.recurringSipReminders,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 flex-wrap text-xs">
                  <span className="text-slate-600 dark:text-slate-300">
                    Triggers 24 hours prior to scheduled debit cycle
                  </span>
                  <button
                    type="button"
                    onClick={() => triggerTestNotification('recurring_sip')}
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-500 flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Test SIP Reminder</span>
                  </button>
                </div>
              </div>

              {/* 5. Pending Debt / Group Settle Alerts */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                      <Users className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        5. Pending Debt / Settle Alerts
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Reminders for debts pending more than 7 days
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.pendingDebtAlerts.enabled}
                      onChange={(e) =>
                        handleUpdateSettings({
                          ...settings,
                          pendingDebtAlerts: {
                            ...settings.pendingDebtAlerts,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 flex-wrap text-xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span>Pending threshold:</span>
                    <span className="font-bold">{settings.pendingDebtAlerts.daysThreshold} days</span>
                    <input
                      type="range"
                      min="3"
                      max="30"
                      step="1"
                      value={settings.pendingDebtAlerts.daysThreshold}
                      onChange={(e) =>
                        handleUpdateSettings({
                          ...settings,
                          pendingDebtAlerts: {
                            ...settings.pendingDebtAlerts,
                            daysThreshold: Number(e.target.value),
                          },
                        })
                      }
                      className="w-24 accent-emerald-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerTestNotification('pending_debt')}
                    className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-500 flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Test Debt Alert</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* History & Alert Tray */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 pb-1">
                <span className="text-xs font-bold text-slate-500">
                  {notifications.length} Total Alerts in Device Memory
                </span>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Mark All Read
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <button
                        type="button"
                        onClick={handleClearHistory}
                        className="text-xs font-semibold text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear Log</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                  <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    No Notifications Triggered Yet
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Scheduled offline reminders will appear here when your daily check-in, portfolio brief, or bill dates arrive.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        item.read
                          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                          : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {item.title}
                            </span>
                            {!item.read && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                            {item.message}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1.5 block">
                            {new Date(item.timestamp).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>

                        {item.actionType && (
                          <button
                            type="button"
                            onClick={() => handleActionClick(item)}
                            className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>{item.actionType === 'view_report' ? 'View' : 'Open'}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Full Screen Footer with safe area */}
      <footer className="px-4 sm:px-6 pt-3 pb-safe border-t border-slate-200/80 dark:border-slate-800 flex justify-end shrink-0 bg-white dark:bg-slate-900">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors active:scale-95 shadow-sm"
        >
          Done
        </button>
      </footer>
    </div>
  );
};
