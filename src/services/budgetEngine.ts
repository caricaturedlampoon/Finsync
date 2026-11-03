/**
 * FinSync Monthly Budget Engine
 * Provides budget state persistence, progress calculation with strict Green/Orange/Red color-coding,
 * and automated offline background alerts when user goes off track.
 */

import {
  MonthlyBudget,
  MonthlyBudgetOverview,
  CategoryBudgetProgress,
  BudgetHealthColor,
  Transaction,
  Category,
} from '../types';
import { dispatchLocalNotification } from './offlineNotificationEngine';
import { formatINR } from '../utils/formatters';

const STORAGE_KEY = 'finsync_monthly_budgets_v1';
const ALERTS_CACHE_KEY = 'finsync_budget_alerts_sent_v1';

/**
 * Return current month key in 'YYYY-MM' format
 */
export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get human-friendly label for monthKey (e.g. "October 2026")
 */
export function formatMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Calculate previous month key (e.g. 2026-10 -> 2026-09)
 */
export function getPreviousMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1; // 0-indexed
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Calculate next month key (e.g. 2026-10 -> 2026-11)
 */
export function getNextMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + 1; // 1-13
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Retrieve all stored budgets from localStorage
 */
export function getStoredBudgets(): Record<string, MonthlyBudget> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse stored budgets', e);
    return {};
  }
}

/**
 * Retrieve budget config for a specific month
 */
export function getBudgetForMonth(monthKey: string): MonthlyBudget {
  const all = getStoredBudgets();
  if (all[monthKey]) {
    return all[monthKey];
  }

  // Fallback default empty configuration
  return {
    monthKey,
    totalSpendCap: 0,
    categoryBudgets: {},
    selectedCategoryIds: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Save budget for a specific month
 */
export function saveMonthlyBudget(budget: MonthlyBudget): void {
  if (typeof window === 'undefined') return;
  try {
    const all = getStoredBudgets();
    all[budget.monthKey] = {
      ...budget,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save monthly budget', e);
  }
}

/**
 * Copy budget setup from previous month into current month
 */
export function copyBudgetFromPreviousMonth(currentMonthKey: string): MonthlyBudget | null {
  const prevKey = getPreviousMonthKey(currentMonthKey);
  const all = getStoredBudgets();
  const prevBudget = all[prevKey];
  if (!prevBudget) return null;

  const copied: MonthlyBudget = {
    monthKey: currentMonthKey,
    totalSpendCap: prevBudget.totalSpendCap,
    categoryBudgets: { ...prevBudget.categoryBudgets },
    selectedCategoryIds: [...prevBudget.selectedCategoryIds],
    updatedAt: new Date().toISOString(),
  };

  saveMonthlyBudget(copied);
  return copied;
}

/**
 * Determine health color based on spending ratio:
 * - Green: in budget (< 75%)
 * - Orange: nearing budget (75% to 99.9%)
 * - Red: at or over budget (>= 100%)
 */
export function determineBudgetHealth(spent: number, limit: number): BudgetHealthColor {
  if (limit <= 0) {
    return spent > 0 ? 'red' : 'green';
  }
  const ratio = spent / limit;
  if (ratio >= 1.0) return 'red';
  if (ratio >= 0.75) return 'orange';
  return 'green';
}

/**
 * Calculate full Monthly Budget overview for a given month
 */
export function computeMonthlyBudgetOverview(
  monthKey: string,
  transactions: Transaction[],
  categories: Category[]
): MonthlyBudgetOverview {
  const budget = getBudgetForMonth(monthKey);
  const categoriesMap = new Map<string, Category>(categories.map((c) => [c.id, c]));

  // 1. Filter expense transactions for this month
  const monthExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.date && t.date.startsWith(monthKey)
  );

  // Total month spending
  const totalSpent = monthExpenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalSpendCap = budget.totalSpendCap || 0;
  const totalLeft = Math.max(0, totalSpendCap - totalSpent);
  const totalPercentUsed = totalSpendCap > 0 ? (totalSpent / totalSpendCap) * 100 : totalSpent > 0 ? 100 : 0;
  const overallHealth = determineBudgetHealth(totalSpent, totalSpendCap);

  // 2. Compute category-specific progress ONLY for selected categories
  const categoryProgress: CategoryBudgetProgress[] = [];

  for (const catId of budget.selectedCategoryIds || []) {
    const cat = categoriesMap.get(catId) || {
      id: catId,
      name: 'Other',
      type: 'expense',
      icon: 'Tag',
      color: '#64748b',
    };

    const spent = monthExpenses
      .filter((t) => t.categoryId === catId)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const limit = budget.categoryBudgets[catId] || 0;
    const left = limit - spent;
    const percentUsed = limit > 0 ? (spent / limit) * 100 : spent > 0 ? 100 : 0;
    const health = determineBudgetHealth(spent, limit);

    categoryProgress.push({
      categoryId: catId,
      categoryName: cat.name,
      categoryIcon: cat.icon || 'Tag',
      categoryColor: cat.color || '#3b82f6',
      limit,
      spent,
      left,
      percentUsed,
      health,
    });
  }

  // Sort: Over-budget categories first, then nearing budget, then descending by spent
  categoryProgress.sort((a, b) => {
    if (a.health === 'red' && b.health !== 'red') return -1;
    if (b.health === 'red' && a.health !== 'red') return 1;
    if (a.health === 'orange' && b.health !== 'orange') return -1;
    if (b.health === 'orange' && a.health !== 'orange') return 1;
    return b.spent - a.spent;
  });

  return {
    monthKey,
    totalSpendCap,
    totalSpent,
    totalLeft,
    totalPercentUsed,
    overallHealth,
    categoryProgress,
  };
}

/**
 * Retrieve sent alerts cache to prevent spamming notifications
 */
function getAlertsCache(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ALERTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setAlertInCache(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = getAlertsCache();
    cache[key] = true;
    localStorage.setItem(ALERTS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore error
  }
}

/**
 * Check and dispatch offline notifications when user goes off track:
 * - Dispatches when overall monthly spending reaches 80% (warning) or 100% (exceeded).
 * - Dispatches when any chosen category reaches 80% (warning) or 100% (exceeded).
 */
export async function checkAndDispatchBudgetAlerts(
  transactions: Transaction[],
  categories: Category[],
  options?: { forceImmediateAlert?: boolean; monthKey?: string }
): Promise<{ dispatchedAlertsCount: number }> {
  const currentMonthKey = options?.monthKey || getCurrentMonthKey();
  const overview = computeMonthlyBudgetOverview(currentMonthKey, transactions, categories);
  const cache = getAlertsCache();
  let dispatchedAlertsCount = 0;

  // 1. Overall monthly cap alert
  if (overview.totalSpendCap > 0) {
    const capKey100 = `${currentMonthKey}_total_100`;
    const capKey80 = `${currentMonthKey}_total_80`;

    if (overview.totalSpent >= overview.totalSpendCap && (!cache[capKey100] || options?.forceImmediateAlert)) {
      await dispatchLocalNotification({
        title: '🚨 Monthly Budget Exceeded!',
        message: `You've spent ${formatINR(overview.totalSpent)} this month, exceeding your ${formatINR(
          overview.totalSpendCap
        )} budget cap by ${formatINR(overview.totalSpent - overview.totalSpendCap)}.`,
        type: 'budget_alert',
        actionType: 'view_budget',
      });
      setAlertInCache(capKey100);
      dispatchedAlertsCount++;
    } else if (
      overview.totalSpent >= 0.8 * overview.totalSpendCap &&
      (!cache[capKey80] || options?.forceImmediateAlert)
    ) {
      const remaining = overview.totalSpendCap - overview.totalSpent;
      await dispatchLocalNotification({
        title: '⚠️ Monthly Budget Alert (80% Reached)',
        message: `You've spent ${formatINR(overview.totalSpent)} (${overview.totalPercentUsed.toFixed(
          0
        )}% of cap). Only ${formatINR(remaining)} remaining for ${formatMonthKey(currentMonthKey)}.`,
        type: 'budget_alert',
        actionType: 'view_budget',
      });
      setAlertInCache(capKey80);
      dispatchedAlertsCount++;
    }
  }

  // 2. Individual chosen categories alerts
  for (const catProg of overview.categoryProgress) {
    if (catProg.limit <= 0) continue;

    const catKey100 = `${currentMonthKey}_${catProg.categoryId}_100`;
    const catKey80 = `${currentMonthKey}_${catProg.categoryId}_80`;

    if (catProg.spent >= catProg.limit && (!cache[catKey100] || options?.forceImmediateAlert)) {
      const overAmount = catProg.spent - catProg.limit;
      await dispatchLocalNotification({
        title: `🚨 ${catProg.categoryName} Budget Exceeded!`,
        message: `Spent ${formatINR(catProg.spent)} vs limit of ${formatINR(catProg.limit)} (${formatINR(
          overAmount
        )} over limit).`,
        type: 'budget_alert',
        actionType: 'view_budget',
      });
      setAlertInCache(catKey100);
      dispatchedAlertsCount++;
    } else if (catProg.spent >= 0.8 * catProg.limit && (!cache[catKey80] || options?.forceImmediateAlert)) {
      await dispatchLocalNotification({
        title: `⚠️ ${catProg.categoryName} Nearing Limit`,
        message: `You've spent ${formatINR(catProg.spent)} of your ${formatINR(catProg.limit)} budget (${catProg.percentUsed.toFixed(
          0
        )}% used). ${formatINR(catProg.left)} left.`,
        type: 'budget_alert',
        actionType: 'view_budget',
      });
      setAlertInCache(catKey80);
      dispatchedAlertsCount++;
    }
  }

  return { dispatchedAlertsCount };
}
