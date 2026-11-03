import React from 'react';

/**
 * Reusable animated skeleton loaders for lists, passbooks, and dashboard cards
 */

export const SkeletonRow: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-2.5 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-3.5 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-2.5 w-1/2 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
            </div>
          </div>
          <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded-md shrink-0" />
        </div>
      ))}
    </div>
  );
};

export const SkeletonCardGrid: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-3.5 w-12 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonPassbook: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-pulse bg-white dark:bg-slate-900">
      <div className="p-3 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
        <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-3.5 flex items-center justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="h-3.5 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-2.5 w-1/4 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
          </div>
          <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>
      ))}
    </div>
  );
};
