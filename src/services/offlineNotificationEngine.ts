/**
 * Offline Local Notification Engine for FinSync
 * Supports native Android system notifications via @capacitor/local-notifications
 * with background schedule support (runs even when the app is not in use or screen is off),
 * plus Web/PWA Notification API fallback and persistent reminder logs.
 */

import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import {
  AppNotification,
  NotificationSettings,
  Transaction,
  InvestmentHolding,
  RecurringTransaction,
  SipSchedule,
  Debt,
  Category,
  Loan,
} from '../types';
import { formatINR, formatDate } from '../utils/formatters';

const SETTINGS_STORAGE_KEY = 'finsync_notification_settings_v1';
const HISTORY_STORAGE_KEY = 'finsync_notification_history_v1';
export const NOTIFICATION_CHANNEL_ID = 'finsync_reminders_v2';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyExpenseReminder: {
    enabled: true,
    time: '20:00', // 8:00 PM
  },
  portfolioDailyUpdate: {
    enabled: true,
    time: '08:00', // 8:00 AM
  },
  portfolioWeeklySummary: {
    enabled: true,
    time: '19:00', // 7:00 PM on Sunday
    dayOfWeek: 0, // Sunday
  },
  portfolioSignificantChange: {
    enabled: true,
    thresholdPercent: 2.5, // 2.5% daily swing
  },
  categorySpendAlerts: {
    enabled: true,
    thresholdPercent: 80, // 80% of typical limit
    customLimits: {},
  },
  recurringSipReminders: {
    enabled: true,
    advanceHours: 24, // 24 hours prior
  },
  pendingDebtAlerts: {
    enabled: true,
    daysThreshold: 7, // 7 days pending
  },
};

let hasInitializedChannel = false;

/**
 * Generate a deterministic positive 32-bit integer ID for Android notifications from a string key
 */
export function hashStringToInteger(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 2147483640 + 1;
}

/**
 * Initialize high-importance Android notification channels and tap action listeners
 */
export async function initNotificationEngine(): Promise<void> {
  if (hasInitializedChannel) return;
  try {
    if (Capacitor.isNativePlatform()) {
      // Primary High-Priority Channel for Alarms, Bills, SIPs, Reminders & Reports
      await LocalNotifications.createChannel({
        id: NOTIFICATION_CHANNEL_ID,
        name: 'FinSync Reminders & Alarms',
        description: 'Time-sensitive payment reminders, report downloads, loan EMIs, SIP debits, and scheduled daily check-ins',
        importance: 5, // High / Heads-up display
        visibility: 1, // Public on lockscreen
        vibration: true,
        lights: true,
        lightColor: '#059669',
      });
      console.log('[FinSync Notifications]: Native Android high-priority channel created');

      // Listen for notification clicks: when user taps on a "Download Successful" notification, view the report!
      LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
        console.log('[FinSync Notifications]: Notification action received', action);
        const extra = action.notification?.extra;
        if (extra && (extra.actionType === 'view_report' || extra.fileUri || extra.uri || extra.blobUrl)) {
          const fileUri = extra.fileUri || extra.uri;
          const filename = extra.filename || 'Financial Report';
          const mimeType = extra.mimeType || (filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : undefined);
          const blobUrl = extra.blobUrl;
          try {
            const { fileService } = await import('./fileService');
            await fileService.openOrViewFile(fileUri, filename, mimeType, blobUrl);
          } catch (err: any) {
            console.warn('[FinSync Notifications]: Error viewing report from notification click', err);
          }
        }
      });
    }
    hasInitializedChannel = true;
  } catch (err) {
    console.warn('[FinSync Notifications]: Channel initialization notice', err);
  }
}

/**
 * Retrieve saved notification preferences
 */
export function getStoredNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

/**
 * Save notification preferences
 */
export function saveNotificationSettings(settings: NotificationSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    // Asynchronously update native background schedules
    scheduleBackgroundOfflineAlarms(settings).catch(() => {});
  } catch (e) {
    console.error('Failed to save notification settings', e);
  }
}

/**
 * Retrieve stored in-app notification history
 */
export function getStoredNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Persist notification history
 */
export function saveStoredNotifications(list: AppNotification[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = (list || []).slice(0, 100);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save notification history', e);
  }
}

/**
 * Request system notification permission safely across Android Native and Web
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    // 1. Android Native via Capacitor LocalNotifications
    if (Capacitor.isNativePlatform()) {
      await initNotificationEngine();
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    }

    // 2. Browser / Web fallback
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (e) {
    console.warn('[FinSync Notifications]: Permission request handled safely', e);
  }
  return false;
}

/**
 * Check current notification permission state
 */
export async function checkNotificationPermissionState(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    if (Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') return 'granted';
      if (status.display === 'denied') return 'denied';
      return 'prompt';
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission as 'granted' | 'denied' | 'prompt';
    }
  } catch {
    // Default safe fallback
  }
  return 'prompt';
}

/**
 * Send an offline local notification:
 * 1. On Android: uses @capacitor/local-notifications to pop on phone lockscreen/status bar.
 * 2. On Web: uses Web Notification API if permitted.
 * 3. Persists into local tray log.
 * (Note: Does NOT spawn in-app toasts, keeping toasts minimal and necessary).
 */
export async function dispatchLocalNotification(params: {
  title: string;
  message: string;
  type: AppNotification['type'];
  actionType?: AppNotification['actionType'];
  extra?: Record<string, any>;
}): Promise<AppNotification> {
  const { title, message, type, actionType, extra } = params;

  // 1. Native Capacitor Android Notification
  if (Capacitor.isNativePlatform()) {
    try {
      await initNotificationEngine();
      const notifId = Math.floor(Math.random() * 2147483640) + 1;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body: message,
            channelId: NOTIFICATION_CHANNEL_ID,
            schedule: { at: new Date(Date.now() + 250), allowWhileIdle: true },
            extra: { type, actionType, ...(extra || {}) },
          },
        ],
      });
    } catch (nativeErr) {
      console.warn('[FinSync Notifications]: Native notification dispatch issue', nativeErr);
    }
  } else if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    // 2. Web Notification fallback
    try {
      const notif = new Notification(title, {
        body: message,
        icon: '/assets/aistudio/1000127183_6a8d46a3.png',
        badge: '/assets/aistudio/1000127183_6a8d46a3.png',
        tag: `finsync_${type}_${Date.now()}`,
      });
      if (extra?.blobUrl) {
        notif.onclick = () => {
          window.focus();
          window.open(extra.blobUrl, '_blank');
        };
      }
    } catch (webErr) {
      // In sandboxed environments or Chrome mobile webview, this may silently fail
    }
  }

  // 3. Add to persistent notification history
  const newNotif: AppNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    message,
    type,
    timestamp: new Date().toISOString(),
    read: false,
    actionType,
    extra,
  };

  try {
    const currentList = getStoredNotifications();
    const updatedList = [newNotif, ...currentList];
    saveStoredNotifications(updatedList);
  } catch {}

  // 4. Dispatch DOM event for notification log updates (UI history only)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('finsync_notification_history_updated', { detail: newNotif }));
    } catch {}
  }

  return newNotif;
}

/**
 * Schedule native background notifications that trigger even when the app is NOT in use or screen is off.
 * Registers repeating alarms on Android for:
 * - Daily Expense Log Check-in (8:00 PM or custom)
 * - Daily Portfolio Morning Brief (8:00 AM or custom)
 * - Sunday Portfolio Wrap (7:00 PM or custom)
 */
export async function scheduleBackgroundOfflineAlarms(settings: NotificationSettings): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await initNotificationEngine();

    // Cancel existing scheduled background alarms (IDs 1001-1005)
    try {
      const pending = await LocalNotifications.getPending();
      const existingIds = pending.notifications
        .filter((n) => n.id >= 1001 && n.id <= 1005)
        .map((n) => ({ id: n.id }));
      if (existingIds.length > 0) {
        await LocalNotifications.cancel({ notifications: existingIds });
      }
    } catch (cancelErr) {
      console.warn('Failed to cancel existing alarms', cancelErr);
    }

    const notificationsToSchedule: any[] = [];
    const now = new Date();

    // 1. Daily Expense Reminder (ID: 1001)
    if (settings.dailyExpenseReminder.enabled) {
      const [hours, mins] = (settings.dailyExpenseReminder.time || '20:00').split(':').map(Number);
      const targetDate = new Date();
      targetDate.setHours(hours, mins || 0, 0, 0);
      if (targetDate <= now) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      notificationsToSchedule.push({
        id: 1001,
        title: 'Daily Expense Check-in 📝',
        body: "Have you recorded your transactions today? Tap to log today's spends.",
        channelId: NOTIFICATION_CHANNEL_ID,
        schedule: {
          at: targetDate,
          repeats: true,
          every: 'day',
          allowWhileIdle: true,
        },
        extra: { type: 'daily_expense', actionType: 'add_expense' },
      });
    }

    // 2. Portfolio Daily Brief (ID: 1002)
    if (settings.portfolioDailyUpdate.enabled) {
      const [hours, mins] = (settings.portfolioDailyUpdate.time || '08:00').split(':').map(Number);
      const targetDate = new Date();
      targetDate.setHours(hours, mins || 0, 0, 0);
      if (targetDate <= now) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      notificationsToSchedule.push({
        id: 1002,
        title: 'FinSync Portfolio Morning Brief 📈',
        body: 'Check your morning wealth valuation and top market movers in FinSync.',
        channelId: NOTIFICATION_CHANNEL_ID,
        schedule: {
          at: targetDate,
          repeats: true,
          every: 'day',
          allowWhileIdle: true,
        },
        extra: { type: 'portfolio_daily', actionType: 'view_portfolio' },
      });
    }

    // 3. Weekly Portfolio Summary (ID: 1003)
    if (settings.portfolioWeeklySummary.enabled) {
      const [hours, mins] = (settings.portfolioWeeklySummary.time || '19:00').split(':').map(Number);
      const targetDate = new Date();
      targetDate.setHours(hours, mins || 0, 0, 0);
      const currentDay = targetDate.getDay();
      const targetDay = settings.portfolioWeeklySummary.dayOfWeek ?? 0;
      let daysToAdd = (targetDay - currentDay + 7) % 7;
      if (daysToAdd === 0 && targetDate <= now) {
        daysToAdd = 7;
      }
      targetDate.setDate(targetDate.getDate() + daysToAdd);

      notificationsToSchedule.push({
        id: 1003,
        title: 'FinSync Weekly Portfolio Wrap 📊',
        body: 'Review your total net worth and weekly portfolio performance.',
        channelId: NOTIFICATION_CHANNEL_ID,
        schedule: {
          at: targetDate,
          repeats: true,
          every: 'week',
          allowWhileIdle: true,
        },
        extra: { type: 'portfolio_weekly', actionType: 'view_portfolio' },
      });
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
      console.log(`[FinSync Notifications]: Armed ${notificationsToSchedule.length} native background alarms`);
    }
  } catch (err) {
    console.warn('[FinSync Notifications]: Error scheduling background alarms', err);
  }
}

/**
 * Synchronize all scheduled native system alarms for:
 * - Recurring bills & subscriptions
 * - SIP installments
 * - Loan monthly EMIs
 * - Debt settlement reminders
 *
 * This writes directly to the Android AlarmManager via LocalNotifications.
 * When scheduled with `allowWhileIdle: true`, Android triggers alarms even when
 * screen is off or app is in the background.
 */
export async function syncAllNativeScheduledReminders(params: {
  recurring?: RecurringTransaction[];
  sips?: SipSchedule[];
  loans?: Loan[];
  debts?: Debt[];
  settings?: NotificationSettings;
}): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;

  try {
    await initNotificationEngine();
    const settings = params.settings || getStoredNotificationSettings();

    // Cancel all previously scheduled dynamic item alarms (ID range >= 20000)
    try {
      const pending = await LocalNotifications.getPending();
      const dynamicToCancel = pending.notifications
        .filter((n) => n.id >= 20000)
        .map((n) => ({ id: n.id }));
      if (dynamicToCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: dynamicToCancel });
      }
    } catch (e) {
      console.warn('[FinSync Notifications]: Error clearing pending alarms', e);
    }

    const notificationsToArm: any[] = [];
    const now = new Date();

    // 1. Arm Recurring Transactions (Bills, Subscriptions, Utilities)
    if (settings.recurringSipReminders?.enabled && params.recurring) {
      params.recurring.forEach((rec) => {
        if (!rec.isActive || !rec.nextExecutionDate) return;

        // Schedule reminder 24 hours prior or on morning of payment at 9:00 AM
        const [year, month, day] = rec.nextExecutionDate.split('-').map(Number);
        const triggerDate = new Date(year, month - 1, day, 9, 0, 0);

        // Advance 24h prior if configured
        if (settings.recurringSipReminders.advanceHours === 24) {
          triggerDate.setDate(triggerDate.getDate() - 1);
        }

        if (triggerDate > now) {
          const notifId = 20000 + (hashStringToInteger(`rec_${rec.id}`) % 100000);
          notificationsToArm.push({
            id: notifId,
            title: `Upcoming Payment: ${rec.name} ⏰`,
            body: `Scheduled ${rec.type.toUpperCase()} of ₹${formatINR(
              rec.amount
            )} is due on ${formatDate(rec.nextExecutionDate)}. Ensure sufficient account balance.`,
            channelId: NOTIFICATION_CHANNEL_ID,
            schedule: {
              at: triggerDate,
              allowWhileIdle: true,
            },
            extra: { type: 'recurring_sip', actionType: 'view_recurring', id: rec.id },
          });
        }
      });
    }

    // 2. Arm Active SIP Schedules (Mutual Funds & AMFI)
    if (settings.recurringSipReminders?.enabled && params.sips) {
      params.sips.forEach((sip) => {
        if (sip.status !== 'ACTIVE' || !sip.sipDate) return;

        // Calculate next debit date for this month or next month
        const targetDate = new Date(now.getFullYear(), now.getMonth(), sip.sipDate, 9, 0, 0);
        // If 24h advance reminder:
        targetDate.setDate(targetDate.getDate() - 1);

        if (targetDate <= now) {
          // Advance to next month
          targetDate.setMonth(targetDate.getMonth() + 1);
        }

        if (targetDate > now) {
          const notifId = 30000 + (hashStringToInteger(`sip_${sip.id}`) % 100000);
          notificationsToArm.push({
            id: notifId,
            title: `Upcoming SIP: ${sip.schemeName} 📈`,
            body: `SIP debit of ₹${formatINR(
              sip.installmentAmount
            )} is scheduled for debit on day ${sip.sipDate}. Ensure sufficient balance.`,
            channelId: NOTIFICATION_CHANNEL_ID,
            schedule: {
              at: targetDate,
              allowWhileIdle: true,
            },
            extra: { type: 'recurring_sip', actionType: 'view_recurring', id: sip.id },
          });
        }
      });
    }

    // 3. Arm Loan EMIs
    if (params.loans) {
      params.loans.forEach((loan) => {
        if (loan.isActive === false || !loan.paymentDay) return;

        // Calculate next EMI date 1 day prior at 10:00 AM
        const emiReminderDate = new Date(now.getFullYear(), now.getMonth(), loan.paymentDay, 10, 0, 0);
        emiReminderDate.setDate(emiReminderDate.getDate() - 1);

        if (emiReminderDate <= now) {
          emiReminderDate.setMonth(emiReminderDate.getMonth() + 1);
        }

        if (emiReminderDate > now) {
          const notifId = 40000 + (hashStringToInteger(`loan_${loan.id}`) % 100000);
          notificationsToArm.push({
            id: notifId,
            title: `Loan EMI Reminder: ${loan.name} 🏦`,
            body: `Monthly EMI of ₹${formatINR(
              loan.emiAmount
            )} is due tomorrow (${loan.paymentDay}th). Please maintain required balance.`,
            channelId: NOTIFICATION_CHANNEL_ID,
            schedule: {
              at: emiReminderDate,
              allowWhileIdle: true,
            },
            extra: { type: 'recurring_sip', actionType: 'view_loans', id: loan.id },
          });
        }
      });
    }

    // 4. Arm Debt Follow-ups
    if (settings.pendingDebtAlerts?.enabled && params.debts) {
      const daysThreshold = settings.pendingDebtAlerts.daysThreshold || 7;
      params.debts.forEach((debt) => {
        const balance = Math.abs(debt.currentBalance || debt.principalAmount || 0);
        if (balance <= 0) return;

        // If debt has explicit dueDate
        if (debt.dueDate) {
          const [y, m, d] = debt.dueDate.split('-').map(Number);
          const dueTrigger = new Date(y, m - 1, d, 10, 30, 0);
          dueTrigger.setDate(dueTrigger.getDate() - 1); // 1 day before due date

          if (dueTrigger > now) {
            const notifId = 50000 + (hashStringToInteger(`debt_due_${debt.id}`) % 100000);
            const label = debt.type === 'lent' ? 'owes you' : 'you owe';
            notificationsToArm.push({
              id: notifId,
              title: `Debt Due Reminder: ${debt.personName} 🤝`,
              body: `${debt.personName} ${label} ₹${formatINR(balance)}. Due on ${formatDate(debt.dueDate)}.`,
              channelId: NOTIFICATION_CHANNEL_ID,
              schedule: {
                at: dueTrigger,
                allowWhileIdle: true,
              },
              extra: { type: 'pending_debt', actionType: 'view_debts', id: debt.id },
            });
          }
        }
      });
    }

    if (notificationsToArm.length > 0) {
      // Schedule in chunks of 50 to avoid IPC limits
      for (let i = 0; i < notificationsToArm.length; i += 50) {
        const chunk = notificationsToArm.slice(i, i + 50);
        await LocalNotifications.schedule({ notifications: chunk });
      }
      console.log(`[FinSync Notifications]: Synchronized ${notificationsToArm.length} system alarms to Android OS`);
    }

    return notificationsToArm.length;
  } catch (err) {
    console.error('[FinSync Notifications]: Failed to synchronize native scheduled alarms', err);
    return 0;
  }
}

/**
 * Main evaluation routine: checks offline reminder rules
 * against user data and configured triggers.
 */
export function evaluateOfflineReminders(data: {
  transactions: Transaction[];
  holdings: InvestmentHolding[];
  recurring: RecurringTransaction[];
  sips?: SipSchedule[];
  debts: Debt[];
  categories: Category[];
}): { triggeredCount: number } {
  const settings = getStoredNotificationSettings();
  let triggeredCount = 0;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  // 1. Daily Expense Reminder
  if (settings.dailyExpenseReminder.enabled) {
    const [targetH, targetM] = (settings.dailyExpenseReminder.time || '20:00').split(':').map(Number);
    const targetTimeMinutes = targetH * 60 + (targetM || 0);

    if (currentTimeMinutes >= targetTimeMinutes && settings.dailyExpenseReminder.lastSentDate !== todayStr) {
      const hasExpenseToday = (data.transactions || []).some(
        (t) => t.date === todayStr && t.type === 'expense'
      );

      if (!hasExpenseToday) {
        dispatchLocalNotification({
          title: 'Daily Expense Check-in 📝',
          message: "You haven't logged any transactions today. Take a quick moment to record your daily spends!",
          type: 'daily_expense',
          actionType: 'add_expense',
        });
        settings.dailyExpenseReminder.lastSentDate = todayStr;
        saveNotificationSettings(settings);
        triggeredCount++;
      }
    }
  }

  // 2. Portfolio Performance Updates
  if (settings.portfolioDailyUpdate.enabled && (data.holdings || []).length > 0) {
    const [portH, portM] = (settings.portfolioDailyUpdate.time || '08:00').split(':').map(Number);
    const portTimeMinutes = portH * 60 + (portM || 0);

    if (currentTimeMinutes >= portTimeMinutes && settings.portfolioDailyUpdate.lastSentDate !== todayStr) {
      let totalCurrentValuation = 0;
      let totalDayGainAmount = 0;

      data.holdings.forEach((h) => {
        const qty = h.quantity || 0;
        const cmp = h.currentPrice || h.averageBuyPrice;
        const prevClose = h.previousClosePrice || h.averageBuyPrice;
        const val = qty * cmp;
        totalCurrentValuation += val;
        totalDayGainAmount += qty * (cmp - prevClose);
      });

      const dayChangePercent =
        totalCurrentValuation > 0
          ? (totalDayGainAmount / (totalCurrentValuation - totalDayGainAmount)) * 100
          : 0;

      const sign = totalDayGainAmount >= 0 ? '+' : '';
      dispatchLocalNotification({
        title: 'Portfolio Morning Brief 📈',
        message: `1-Day Change: ${sign}₹${formatINR(totalDayGainAmount)} (${sign}${dayChangePercent.toFixed(
          2
        )}%). Total Portfolio Value: ₹${formatINR(totalCurrentValuation)}.`,
        type: 'portfolio_daily',
        actionType: 'view_portfolio',
      });

      settings.portfolioDailyUpdate.lastSentDate = todayStr;
      saveNotificationSettings(settings);
      triggeredCount++;
    }
  }

  // 3. Weekly Portfolio Summary (Sunday evenings)
  if (settings.portfolioWeeklySummary.enabled && (data.holdings || []).length > 0) {
    const dayOfWeek = now.getDay();
    const [weekH, weekM] = (settings.portfolioWeeklySummary.time || '19:00').split(':').map(Number);
    const weekTimeMinutes = weekH * 60 + (weekM || 0);

    if (
      dayOfWeek === (settings.portfolioWeeklySummary.dayOfWeek ?? 0) &&
      currentTimeMinutes >= weekTimeMinutes &&
      settings.portfolioWeeklySummary.lastSentDate !== todayStr
    ) {
      let totalInvested = 0;
      let totalCurrent = 0;
      data.holdings.forEach((h) => {
        const qty = h.quantity || 0;
        totalInvested += qty * h.averageBuyPrice;
        totalCurrent += qty * (h.currentPrice || h.averageBuyPrice);
      });
      const totalGain = totalCurrent - totalInvested;
      const gainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
      const sign = totalGain >= 0 ? '+' : '';

      dispatchLocalNotification({
        title: 'Weekly Portfolio Wrap 📊',
        message: `Invested: ₹${formatINR(totalInvested)} · Current: ₹${formatINR(
          totalCurrent
        )} · Overall Return: ${sign}${gainPercent.toFixed(2)}%.`,
        type: 'portfolio_weekly',
        actionType: 'view_portfolio',
      });

      settings.portfolioWeeklySummary.lastSentDate = todayStr;
      saveNotificationSettings(settings);
      triggeredCount++;
    }
  }

  return { triggeredCount };
}

/**
 * Trigger immediate test notifications for validation
 */
export function triggerTestNotification(type: AppNotification['type']): void {
  try {
    switch (type) {
      case 'daily_expense':
        dispatchLocalNotification({
          title: 'Daily Expense Check-in 📝',
          message: 'This is a test daily expense reminder. Keep your daily budgets on track!',
          type: 'daily_expense',
          actionType: 'add_expense',
        });
        break;
      case 'portfolio_daily':
        dispatchLocalNotification({
          title: 'Portfolio Morning Brief 📈',
          message: '1-Day Change: +₹2,450 (+1.25%). Total Portfolio Value: ₹3,12,000.',
          type: 'portfolio_daily',
          actionType: 'view_portfolio',
        });
        break;
      case 'portfolio_weekly':
        dispatchLocalNotification({
          title: 'Weekly Portfolio Wrap 📊',
          message: 'Invested: ₹2,50,000 · Current: ₹3,12,000 · Overall Return: +24.8%.',
          type: 'portfolio_weekly',
          actionType: 'view_portfolio',
        });
        break;
      case 'portfolio_change':
        dispatchLocalNotification({
          title: 'Market Alert: HDFCBANK surged +3.8% ⚡',
          message: 'HDFC Bank is trading at ₹1,780 (+3.8% vs previous close).',
          type: 'portfolio_change',
          actionType: 'view_portfolio',
        });
        break;
      case 'category_spend':
        dispatchLocalNotification({
          title: 'High Spending Alert: Food & Dining ⚠️',
          message: 'You have spent ₹12,800 in Food & Dining this month (85% of monthly threshold).',
          type: 'category_spend',
          actionType: 'view_analytics',
        });
        break;
      case 'recurring_sip':
        dispatchLocalNotification({
          title: 'Upcoming SIP: Parag Parikh Flexi Cap ⏰',
          message: 'SIP installment of ₹5,000 is due for debit tomorrow. Ensure sufficient balance.',
          type: 'recurring_sip',
          actionType: 'view_recurring',
        });
        break;
      case 'pending_debt':
        dispatchLocalNotification({
          title: 'Pending Settlement Reminder 🤝',
          message: 'Rahul owes you ₹3,500 for trip expenses. Long pending (14 days).',
          type: 'pending_debt',
          actionType: 'view_debts',
        });
        break;
      case 'budget_alert':
        dispatchLocalNotification({
          title: '⚠️ Budget Alert: Food & Dining at 85%',
          message: 'You have spent ₹8,500 of your ₹10,000 monthly limit (₹1,500 remaining).',
          type: 'budget_alert',
          actionType: 'view_budget',
        });
        break;
    }
  } catch (err) {
    console.error('[FinSync Notifications]: Error in triggerTestNotification', err);
  }
}
