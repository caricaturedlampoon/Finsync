import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { BinItem, BinItemType } from '../../types';
import { formatINR } from '../../utils/formatters';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Clock,
  Search,
  Receipt,
  Landmark,
  TrendingUp,
  Coins,
  CalendarClock,
  Users,
  Tags,
  X,
} from 'lucide-react';

interface BinViewProps {
  onClose?: () => void;
  isEmbedded?: boolean;
}

export const BinView: React.FC<BinViewProps> = ({ onClose, isEmbedded = false }) => {
  const {
    bin,
    restoreFromBin,
    deletePermanentlyFromBin,
    emptyBin,
    restoreAllFromBin,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<BinItemType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'expiring' | 'amount'>('newest');

  // Confirmation dialogs
  const [confirmPermanentDeleteId, setConfirmPermanentDeleteId] = useState<string | null>(null);
  const [showEmptyBinConfirm, setShowEmptyBinConfirm] = useState(false);
  const [showRestoreAllConfirm, setShowRestoreAllConfirm] = useState(false);

  // Calculate days remaining helper
  const getDaysRemaining = (expiresAt: string) => {
    const now = Date.now();
    const expiryTime = new Date(expiresAt).getTime();
    const diffMs = expiryTime - now;
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  // Concise relative time helper
  const formatRelativeTime = (dateStr: string) => {
    try {
      const now = Date.now();
      const d = new Date(dateStr).getTime();
      const diffHours = Math.floor((now - d) / (1000 * 60 * 60));
      if (diffHours < 1) return 'Deleted just now';
      if (diffHours < 24) return `Deleted ${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Deleted yesterday';
      return `Deleted ${diffDays}d ago`;
    } catch {
      return 'Deleted';
    }
  };

  // Type metadata and icon styling
  const getItemTypeConfig = (type: BinItemType) => {
    switch (type) {
      case 'transaction':
        return {
          label: 'Transaction',
          icon: Receipt,
          colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
      case 'trade_action':
        return {
          label: 'Trade',
          icon: TrendingUp,
          colorClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
        };
      case 'account':
        return {
          label: 'Account',
          icon: Landmark,
          colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        };
      case 'holding':
        return {
          label: 'Holding',
          icon: TrendingUp,
          colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        };
      case 'debt':
      case 'debt_record':
        return {
          label: 'Debt',
          icon: Coins,
          colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        };
      case 'recurring':
        return {
          label: 'Recurring',
          icon: CalendarClock,
          colorClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
        };
      case 'sip':
        return {
          label: 'SIP',
          icon: CalendarClock,
          colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
        };
      case 'group':
      case 'group_expense':
        return {
          label: 'Split',
          icon: Users,
          colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
        };
      case 'category':
        return {
          label: 'Category',
          icon: Tags,
          colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        };
      default:
        return {
          label: 'Item',
          icon: Trash2,
          colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
        };
    }
  };

  // Grouped active counts (only for types that actually exist)
  const availableTypesWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    bin.forEach((item) => {
      const t = item.itemType === 'debt_record' ? 'debt' : item.itemType;
      map.set(t, (map.get(t) || 0) + 1);
    });
    return map;
  }, [bin]);

  // Total monetary value in bin
  const totalValueInBin = useMemo(() => {
    return bin.reduce((acc, item) => acc + (item.amount || 0), 0);
  }, [bin]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let result = [...bin];

    if (selectedType !== 'all') {
      result = result.filter((item) => {
        if (selectedType === 'debt') {
          return item.itemType === 'debt' || item.itemType === 'debt_record';
        }
        return item.itemType === selectedType;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((item) => {
        return (
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          (item.amount !== undefined && String(item.amount).includes(q))
        );
      });
    }

    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime();
      }
      if (sortBy === 'expiring') {
        return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      }
      if (sortBy === 'amount') {
        return (b.amount || 0) - (a.amount || 0);
      }
      return 0;
    });

    return result;
  }, [bin, selectedType, searchQuery, sortBy]);

  return (
    <div className="space-y-4">
      {/* Crisp Summary Strip (Only when bin has items) */}
      {bin.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:px-4 sm:py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {bin.length} {bin.length === 1 ? 'item' : 'items'}
                </span>
                {totalValueInBin > 0 && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatINR(totalValueInBin)} recoverable
                    </span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                Items auto-purge 30 days after deletion
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setShowRestoreAllConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs active:scale-95 transition-all cursor-pointer"
              title="Restore all items"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Restore All</span>
            </button>

            <button
              type="button"
              onClick={() => setShowEmptyBinConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 text-xs font-bold active:scale-95 transition-all cursor-pointer"
              title="Empty entire bin"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Empty Bin</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Clean Filter Controls */}
      {bin.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deleted items..."
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                <option value="newest">Recently Deleted</option>
                <option value="expiring">Expiring Soonest</option>
                <option value="amount">Amount (High to Low)</option>
                <option value="oldest">Oldest Deleted</option>
              </select>
            </div>
          </div>

          {/* Compact Type Filters (Only types that actually have items) */}
          {availableTypesWithCounts.size > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedType('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  selectedType === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200/80 dark:border-slate-800'
                }`}
              >
                All ({bin.length})
              </button>

              {Array.from(availableTypesWithCounts.entries()).map(([type, count]) => {
                const config = getItemTypeConfig(type as BinItemType);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      selectedType === type
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    {config.label} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Item List or Crisp Empty State */}
      {filteredItems.length === 0 ? (
        <div className="py-16 px-4 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3 border border-slate-200/60 dark:border-slate-700/60">
            <Trash2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            {bin.length === 0 ? 'Recycle Bin is empty' : 'No matching items'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {bin.length === 0
              ? 'Items deleted anywhere in the app are kept here for 30 days before being permanently removed.'
              : 'Try clearing your search query or changing the filter.'}
          </p>
          {bin.length > 0 && searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedType('all');
              }}
              className="mt-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const config = getItemTypeConfig(item.itemType);
            const TypeIcon = config.icon;
            const daysLeft = getDaysRemaining(item.expiresAt);

            return (
              <div
                key={item.id}
                className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 shadow-2xs group"
              >
                {/* Left: Icon & Title/Subtitle */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${config.colorClass}`}
                  >
                    <TypeIcon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </h4>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                        {config.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {item.subtitle && (
                        <>
                          <span className="truncate">{item.subtitle}</span>
                          <span>•</span>
                        </>
                      )}
                      <span className="shrink-0">{formatRelativeTime(item.deletedAt)}</span>
                      <span>•</span>
                      {daysLeft <= 3 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold shrink-0">
                          {daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 shrink-0">
                          {daysLeft}d left
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80">
                  {item.amount !== undefined && item.amount !== 0 ? (
                    <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                      {formatINR(item.amount)}
                    </span>
                  ) : (
                    <div className="sm:hidden" />
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmPermanentDeleteId(item.id)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Permanently delete item"
                      aria-label="Delete forever"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => restoreFromBin(item.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title="Restore item"
                    >
                      <RotateCcw className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal: Delete Permanently Single Item */}
      {confirmPermanentDeleteId && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Delete Item Permanently?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This item will be permanently erased and cannot be recovered.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmPermanentDeleteId(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePermanentlyFromBin(confirmPermanentDeleteId);
                  setConfirmPermanentDeleteId(null);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-2xs active:scale-95 cursor-pointer"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Empty Bin */}
      {showEmptyBinConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
              <Trash2 className="w-5 h-5 stroke-[2.2]" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Empty Recycle Bin?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Permanently erase all {bin.length} items? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowEmptyBinConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
              >
                Keep Items
              </button>
              <button
                type="button"
                onClick={() => {
                  emptyBin();
                  setShowEmptyBinConfirm(false);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-2xs active:scale-95 cursor-pointer"
              >
                Permanently Empty
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Restore All */}
      {showRestoreAllConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <RotateCcw className="w-5 h-5 stroke-[2.2]" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Restore All Items?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Restore all {filteredItems.length} items back to their accounts, holdings, and ledgers?
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRestoreAllConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  restoreAllFromBin(selectedType !== 'all' ? selectedType : undefined);
                  setShowRestoreAllConfirm(false);
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs active:scale-95 cursor-pointer"
              >
                Restore All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
