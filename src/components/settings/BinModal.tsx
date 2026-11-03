import React from 'react';
import { useApp } from '../../context/AppContext';
import { BinView } from './BinView';
import { X, ArrowLeft, Trash2 } from 'lucide-react';

export const BinModal: React.FC = () => {
  const { isBinOpen, setIsBinOpen, bin } = useApp();

  if (!isBinOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950 flex flex-col h-[100dvh] w-full overflow-hidden animate-in fade-in duration-200">
      {/* Crisp Header Top Bar */}
      <header className="shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 shadow-2xs z-20 pt-safe">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsBinOpen(false)}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 active:scale-95"
            aria-label="Back / Close"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20 shadow-2xs">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              Recycle Bin
            </h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 shrink-0">
              {bin.length} {bin.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsBinOpen(false)}
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 active:scale-95"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Main Scrollable View */}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-safe pb-16 min-h-0 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-4xl mx-auto w-full px-3.5 sm:px-6 py-4 sm:py-5">
          <BinView onClose={() => setIsBinOpen(false)} />
        </div>
      </div>
    </div>
  );
};
