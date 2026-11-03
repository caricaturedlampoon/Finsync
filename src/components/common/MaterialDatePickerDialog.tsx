import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Edit3, Calendar as CalendarIcon, X } from 'lucide-react';
import { useRegisterOverlay } from '../../navigation/NavigationContext';

interface MaterialDatePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: Date, formattedString: string) => void;
  initialDate?: Date;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAY_NAMES_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const formatToM3Date = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

export const MaterialDatePickerDialog: React.FC<MaterialDatePickerDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialDate,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => initialDate || new Date());
  const [viewYear, setViewYear] = useState<number>(() => (initialDate || new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => (initialDate || new Date()).getMonth());
  const [isYearPicker, setIsYearPicker] = useState<boolean>(false);
  const [manualInputMode, setManualInputMode] = useState<boolean>(false);
  const [manualDateText, setManualDateText] = useState<string>('');

  useRegisterOverlay(isOpen, 'material_date_picker', 'Date Picker Dialog', onClose);

  // Sync state if initialDate changes or opens
  React.useEffect(() => {
    if (isOpen) {
      const base = initialDate || new Date();
      setSelectedDate(base);
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
      setIsYearPicker(false);
      setManualInputMode(false);
      setManualDateText(formatToM3Date(base));
    }
  }, [isOpen, initialDate]);

  // Calendar math
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay();
  }, [viewYear, viewMonth]);

  const prevMonthDays = useMemo(() => {
    return new Date(viewYear, viewMonth, 0).getDate();
  }, [viewYear, viewMonth]);

  if (!isOpen) return null;

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDaySelect = (day: number) => {
    const newDate = new Date(viewYear, viewMonth, day);
    setSelectedDate(newDate);
    setManualDateText(formatToM3Date(newDate));
  };

  const handleYearSelect = (year: number) => {
    setViewYear(year);
    setIsYearPicker(false);
  };

  const handleConfirm = () => {
    if (manualInputMode) {
      const parsed = new Date(manualDateText);
      if (!isNaN(parsed.getTime())) {
        onSelect(parsed, formatToM3Date(parsed));
        onClose();
        return;
      }
    }
    onSelect(selectedDate, formatToM3Date(selectedDate));
    onClose();
  };

  // Header display string e.g. "Sun, 25 Oct 2026"
  const headerPreview = selectedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Generate 12 years for year selector
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150 isolate overscroll-contain"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Title & Date Preview */}
        <div className="p-5 pb-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            <span>SELECT DATE</span>
            <button
              type="button"
              onClick={() => setManualInputMode(!manualInputMode)}
              className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
              title={manualInputMode ? 'Switch to Calendar' : 'Manual text input'}
            >
              {manualInputMode ? <CalendarIcon className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white flex items-center justify-between">
            <span>{headerPreview}</span>
          </div>
        </div>

        {/* Content: Manual text mode OR Calendar grid */}
        {manualInputMode ? (
          <div className="p-6 space-y-3">
            <label className="text-xs font-semibold text-slate-400">Date (e.g. 25 Oct 2026 or YYYY-MM-DD)</label>
            <input
              type="text"
              value={manualDateText}
              onChange={(e) => setManualDateText(e.target.value)}
              placeholder="e.g. 25 Oct 2026"
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              autoFocus
            />
            <p className="text-[11px] text-slate-500">
              Format: Day Month Year (e.g. 25 Oct 2026)
            </p>
          </div>
        ) : (
          <div className="p-4 flex-1 flex flex-col">
            {/* Month/Year Navigation */}
            <div className="flex items-center justify-between px-1 mb-2">
              <button
                type="button"
                onClick={() => setIsYearPicker(!isYearPicker)}
                className="text-sm font-bold text-slate-200 hover:text-amber-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <span>{MONTH_NAMES[viewMonth]} {viewYear}</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isYearPicker ? 'rotate-90' : ''}`} />
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Year Picker Grid */}
            {isYearPicker ? (
              <div className="grid grid-cols-3 gap-2 py-3 max-h-[220px] overflow-y-auto">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => handleYearSelect(y)}
                    className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      y === viewYear
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                {/* Days of Week Header */}
                <div className="grid grid-cols-7 text-center mb-1">
                  {DAY_NAMES_SHORT.map((dayName, idx) => (
                    <div key={idx} className="text-[11px] font-semibold text-slate-500 py-1">
                      {dayName}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-y-1 text-center">
                  {/* Previous month trailing days */}
                  {Array.from({ length: firstDayOfWeek }).map((_, idx) => {
                    const prevDayNum = prevMonthDays - firstDayOfWeek + idx + 1;
                    return (
                      <div
                        key={`prev-${idx}`}
                        className="w-8 h-8 mx-auto flex items-center justify-center text-xs text-slate-600 select-none"
                      >
                        {prevDayNum}
                      </div>
                    );
                  })}

                  {/* Current month days */}
                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const isSelected =
                      selectedDate.getDate() === dayNum &&
                      selectedDate.getMonth() === viewMonth &&
                      selectedDate.getFullYear() === viewYear;
                    const isToday =
                      new Date().getDate() === dayNum &&
                      new Date().getMonth() === viewMonth &&
                      new Date().getFullYear() === viewYear;

                    return (
                      <button
                        key={dayNum}
                        type="button"
                        onClick={() => handleDaySelect(dayNum)}
                        className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-semibold transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-amber-500 text-white font-bold shadow-md shadow-amber-500/20'
                            : isToday
                            ? 'border border-amber-500 text-amber-400 hover:bg-slate-800'
                            : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Actions: CANCEL and OK */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors uppercase cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-md shadow-amber-500/20 transition-all uppercase cursor-pointer active:scale-95"
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
