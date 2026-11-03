import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  PiggyBank,
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Copy,
  BellRing,
  HelpCircle,
  Sliders,
  DollarSign,
  TrendingDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatINR } from '../../utils/formatters';
import { IconRenderer } from '../common/IconRenderer';
import {
  getCurrentMonthKey,
  formatMonthKey,
  getPreviousMonthKey,
  getNextMonthKey,
  getBudgetForMonth,
  saveMonthlyBudget,
  computeMonthlyBudgetOverview,
  copyBudgetFromPreviousMonth,
  checkAndDispatchBudgetAlerts,
} from '../../services/budgetEngine';
import { MonthlyBudget, CategoryBudgetProgress } from '../../types';

interface MonthlyBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MonthlyBudgetModal: React.FC<MonthlyBudgetModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { transactions, categories, showToast } = useApp();

  const [currentMonthKey, setCurrentMonthKey] = useState<string>(() => getCurrentMonthKey());
  const [budgetConfig, setBudgetConfig] = useState<MonthlyBudget>(() =>
    getBudgetForMonth(currentMonthKey)
  );

  // Modals inside budget view
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isEditingTotalCap, setIsEditingTotalCap] = useState(false);
  const [totalCapInput, setTotalCapInput] = useState('');
  const [editingCategory, setEditingCategory] = useState<CategoryBudgetProgress | null>(null);
  const [categoryCapInput, setCategoryCapInput] = useState('');
  const [isCheckingAlerts, setIsCheckingAlerts] = useState(false);

  // Sync state whenever month changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const config = getBudgetForMonth(currentMonthKey);
      setBudgetConfig(config);
    }
  }, [isOpen, currentMonthKey]);

  // Compute overview
  const overview = useMemo(() => {
    return computeMonthlyBudgetOverview(currentMonthKey, transactions, categories);
  }, [currentMonthKey, transactions, categories, budgetConfig]);

  if (!isOpen) return null;

  const isCurrentMonth = currentMonthKey === getCurrentMonthKey();

  // Handlers for month navigation
  const handlePrevMonth = () => {
    setCurrentMonthKey((prev) => getPreviousMonthKey(prev));
  };

  const handleNextMonth = () => {
    setCurrentMonthKey((prev) => getNextMonthKey(prev));
  };

  const handleResetToCurrentMonth = () => {
    setCurrentMonthKey(getCurrentMonthKey());
  };

  // Save Total Month Cap
  const handleSaveTotalCap = () => {
    const num = Math.max(0, parseFloat(totalCapInput.replace(/[^0-9.]/g, '')) || 0);
    const updated: MonthlyBudget = {
      ...budgetConfig,
      totalSpendCap: num,
    };
    saveMonthlyBudget(updated);
    setBudgetConfig(updated);
    setIsEditingTotalCap(false);
    showToast(`Monthly budget set to ${formatINR(num)}`, 'success');
  };

  // Open Edit Total Cap
  const handleOpenEditTotalCap = () => {
    setTotalCapInput(budgetConfig.totalSpendCap > 0 ? String(budgetConfig.totalSpendCap) : '');
    setIsEditingTotalCap(true);
  };

  // Save Category Limit
  const handleSaveCategoryLimit = () => {
    if (!editingCategory) return;
    const num = Math.max(0, parseFloat(categoryCapInput.replace(/[^0-9.]/g, '')) || 0);
    const updatedBudgets = {
      ...budgetConfig.categoryBudgets,
      [editingCategory.categoryId]: num,
    };
    const updated: MonthlyBudget = {
      ...budgetConfig,
      categoryBudgets: updatedBudgets,
    };
    saveMonthlyBudget(updated);
    setBudgetConfig(updated);
    setEditingCategory(null);
    showToast(`${editingCategory.categoryName} limit set to ${formatINR(num)}`, 'success');
  };

  // Toggle Category selection in Category Picker
  const handleToggleCategory = (catId: string) => {
    const currentSelected = new Set(budgetConfig.selectedCategoryIds || []);
    if (currentSelected.has(catId)) {
      currentSelected.delete(catId);
    } else {
      currentSelected.add(catId);
      // Give a default limit if none exists
      if (!budgetConfig.categoryBudgets[catId]) {
        budgetConfig.categoryBudgets[catId] = 5000;
      }
    }
    const updated: MonthlyBudget = {
      ...budgetConfig,
      selectedCategoryIds: Array.from(currentSelected),
    };
    saveMonthlyBudget(updated);
    setBudgetConfig(updated);
  };

  // Remove Category from budgeting
  const handleRemoveCategory = (catId: string, catName: string) => {
    const updatedSelected = (budgetConfig.selectedCategoryIds || []).filter((id) => id !== catId);
    const updated: MonthlyBudget = {
      ...budgetConfig,
      selectedCategoryIds: updatedSelected,
    };
    saveMonthlyBudget(updated);
    setBudgetConfig(updated);
    showToast(`Removed "${catName}" from monthly budget`, 'info');
  };

  // Copy from previous month
  const handleCopyPreviousMonth = () => {
    const copied = copyBudgetFromPreviousMonth(currentMonthKey);
    if (copied) {
      setBudgetConfig(copied);
      showToast(
        `Copied ${copied.selectedCategoryIds.length} categories & ${formatINR(
          copied.totalSpendCap
        )} cap from previous month!`,
        'success'
      );
    } else {
      showToast('No budget setup found in previous month to copy.', 'error');
    }
  };

  // Check & dispatch offline alerts
  const handleCheckAlerts = async () => {
    setIsCheckingAlerts(true);
    try {
      const res = await checkAndDispatchBudgetAlerts(transactions, categories, {
        forceImmediateAlert: true,
        monthKey: currentMonthKey,
      });
      if (res.dispatchedAlertsCount > 0) {
        showToast(`Dispatched ${res.dispatchedAlertsCount} budget warning alerts! Check notification bar.`, 'success');
      } else {
        showToast('All your spending is within budget limits. Great financial health! 👍', 'info');
      }
    } catch {
      showToast('Checked budget status.', 'info');
    } finally {
      setIsCheckingAlerts(false);
    }
  };

  // Color helper according to strict requirements:
  // Green (<75%), Orange (75%-99%), Red (>=100%)
  const getHealthBadge = (health: 'green' | 'orange' | 'red', percentUsed: number) => {
    if (health === 'red') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-3.5 h-3.5" />
          {percentUsed.toFixed(0)}% Over Budget
        </span>
      );
    }
    if (health === 'orange') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-3.5 h-3.5" />
          {percentUsed.toFixed(0)}% Nearing Budget
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {percentUsed.toFixed(0)}% In Budget
      </span>
    );
  };

  // Expense categories available to pick
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
      {/* Top App Bar */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 pt-safe pb-3 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0 active:scale-95"
            title="Back to Tools"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-2xs">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Monthly Budget
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                Live Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Track monthly caps, category spend limits & automatic alerts
            </p>
          </div>
        </div>

        {/* Month Navigator Header Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleCheckAlerts}
            disabled={isCheckingAlerts}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition cursor-pointer active:scale-95"
            title="Check Budget Alerts Now"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-500" />
            Check Alerts
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5 max-w-4xl w-full mx-auto pb-safe">
        {/* Month Selector Bar */}
        <div className="bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95"
            title="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {formatMonthKey(currentMonthKey)}
            </span>
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={handleResetToCurrentMonth}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
              >
                Jump to Current
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95"
            title="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Overall Month Spending Cap Card */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-2xs ${
            overview.overallHealth === 'red'
              ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
              : overview.overallHealth === 'orange'
              ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Monthly Spending
                </span>
                {getHealthBadge(overview.overallHealth, overview.totalPercentUsed)}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {formatINR(overview.totalSpent)}
                </span>
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  of{' '}
                  {overview.totalSpendCap > 0 ? (
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {formatINR(overview.totalSpendCap)}
                    </span>
                  ) : (
                    <span className="italic text-slate-400">No cap set</span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleOpenEditTotalCap}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer active:scale-95"
              >
                <Edit2 className="w-3.5 h-3.5" />
                {overview.totalSpendCap > 0 ? 'Edit Month Cap' : 'Set Month Cap'}
              </button>
            </div>
          </div>

          {/* Horizontal Status Bar for Overall Monthly Spending */}
          <div className="space-y-1.5">
            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overview.overallHealth === 'red'
                    ? 'bg-rose-500'
                    : overview.overallHealth === 'orange'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min(100, overview.totalPercentUsed)}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                {overview.totalPercentUsed.toFixed(1)}% used
              </span>
              <span
                className={`font-semibold ${
                  overview.overallHealth === 'red'
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : overview.overallHealth === 'orange'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {overview.totalSpendCap > 0
                  ? overview.totalSpent > overview.totalSpendCap
                    ? `${formatINR(overview.totalSpent - overview.totalSpendCap)} over budget`
                    : `${formatINR(overview.totalLeft)} left to spend`
                  : 'Set a total cap to track remaining balance'}
              </span>
            </div>
          </div>
        </div>

        {/* Budgeted Categories Header & Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Budgeted Categories</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {overview.categoryProgress.length} chosen
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only categories explicitly chosen for budgeting appear here
            </p>
          </div>

          <div className="flex items-center gap-2">
            {overview.categoryProgress.length === 0 && (
              <button
                type="button"
                onClick={handleCopyPreviousMonth}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                title="Copy categories & caps from previous month"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                Copy Previous
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCategoryPickerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer active:scale-95"
            >
              <Sliders className="w-3.5 h-3.5" />
              Select Categories
            </button>
          </div>
        </div>

        {/* Selected Categories List or Empty State */}
        {overview.categoryProgress.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                No Categories Selected for Budgeting
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                FinSync only tracks the specific categories you want to budget for. Pick food,
                shopping, utilities, or entertainment to get started.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCategoryPickerOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer active:scale-95"
              >
                Choose Categories to Budget
              </button>
              <button
                type="button"
                onClick={handleCopyPreviousMonth}
                className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                Copy from Last Month
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {overview.categoryProgress.map((item) => (
              <div
                key={item.categoryId}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all shadow-2xs bg-white dark:bg-slate-900 ${
                  item.health === 'red'
                    ? 'border-rose-300 dark:border-rose-900/60'
                    : item.health === 'orange'
                    ? 'border-amber-300 dark:border-amber-900/60'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs"
                      style={{
                        backgroundColor: `${item.categoryColor}15`,
                        borderColor: `${item.categoryColor}30`,
                        color: item.categoryColor,
                      }}
                    >
                      <IconRenderer name={item.categoryIcon} className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.categoryName}
                        </h4>
                        {getHealthBadge(item.health, item.percentUsed)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>Spent: {formatINR(item.spent)}</span>
                        <span>•</span>
                        <span>
                          Limit:{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(item);
                              setCategoryCapInput(item.limit > 0 ? String(item.limit) : '');
                            }}
                            className="font-medium text-slate-700 dark:text-slate-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            {formatINR(item.limit)}
                            <Edit2 className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side remaining label & quick actions */}
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-extrabold tracking-tight ${
                        item.health === 'red'
                          ? 'text-rose-600 dark:text-rose-400'
                          : item.health === 'orange'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {item.left < 0
                        ? `${formatINR(Math.abs(item.left))} over`
                        : `${formatINR(item.left)} left`}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(item);
                          setCategoryCapInput(item.limit > 0 ? String(item.limit) : '');
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Edit Limit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(item.categoryId, item.categoryName)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                        title="Remove from budget"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Horizontal Status Bar with Strict Color Coding */}
                <div className="space-y-1">
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.health === 'red'
                          ? 'bg-rose-500'
                          : item.health === 'orange'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(100, item.percentUsed)}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{item.percentUsed.toFixed(0)}% of limit</span>
                    <span>
                      {item.health === 'red'
                        ? 'Exceeded'
                        : item.health === 'orange'
                        ? 'Nearing Limit'
                        : 'On Track'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Offline Notifications Explanation Note */}
        <div className="bg-slate-100/80 dark:bg-slate-900/50 rounded-2xl p-3.5 border border-slate-200/60 dark:border-slate-800/80 flex items-start gap-2.5">
          <BellRing className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <span className="font-semibold text-slate-900 dark:text-white">
              Automated Device Notifications:{' '}
            </span>
            FinSync automatically tracks your spending. When total or category spend reaches{' '}
            <span className="font-semibold text-amber-600 dark:text-amber-400">80% (warning)</span> or{' '}
            <span className="font-semibold text-rose-600 dark:text-rose-400">100% (exceeded)</span>, an
            alert is posted directly to your Android notification tray even when the app is in the
            background.
          </div>
        </div>
      </div>

      {/* MODAL 1: Select Categories to Budget */}
      {isCategoryPickerOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Select Categories to Budget
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Only selected categories will appear in your budget
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryPickerOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {expenseCategories.map((cat) => {
                const isSelected = (budgetConfig.selectedCategoryIds || []).includes(cat.id);
                const spent = transactions
                  .filter((t) => t.type === 'expense' && t.categoryId === cat.id && t.date.startsWith(currentMonthKey))
                  .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleToggleCategory(cat.id)}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: `${cat.color}15`,
                          borderColor: `${cat.color}30`,
                          color: cat.color,
                        }}
                      >
                        <IconRenderer name={cat.icon} className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {cat.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Spent this month: {formatINR(spent)}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition border ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryPickerOpen(false)}
                className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer"
              >
                Done Selecting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Total Monthly Cap */}
      {isEditingTotalCap && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Monthly Spending Cap
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set total spending limit for {formatMonthKey(currentMonthKey)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                value={totalCapInput}
                onChange={(e) => setTotalCapInput(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                autoFocus
              />
            </div>

            {/* Quick quick presets */}
            <div className="flex flex-wrap gap-1.5">
              {[25000, 50000, 75000, 100000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTotalCapInput(String(preset))}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  +{formatINR(preset)}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingTotalCap(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTotalCap}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer"
              >
                Save Cap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Category Limit */}
      {editingCategory && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                style={{
                  backgroundColor: `${editingCategory.categoryColor}15`,
                  borderColor: `${editingCategory.categoryColor}30`,
                  color: editingCategory.categoryColor,
                }}
              >
                <IconRenderer name={editingCategory.categoryIcon} className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingCategory.categoryName} Limit
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Spent so far: {formatINR(editingCategory.spent)}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category Spending Cap (₹)
              </label>
              <input
                type="number"
                value={categoryCapInput}
                onChange={(e) => setCategoryCapInput(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                autoFocus
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[2000, 5000, 10000, 20000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCategoryCapInput(String(preset))}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  {formatINR(preset)}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCategoryLimit}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer"
              >
                Update Limit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
