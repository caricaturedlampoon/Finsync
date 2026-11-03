import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Keyboard, Clock, X } from 'lucide-react';
import { useRegisterOverlay } from '../../navigation/NavigationContext';

interface MaterialTimePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (timeStr: string) => void;
  initialTime?: string; // e.g. "03:51 PM"
}

export const formatTime12h = (date: Date = new Date()): string => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const strHours = String(hours).padStart(2, '0');
  const strMinutes = String(minutes).padStart(2, '0');
  return `${strHours}:${strMinutes} ${ampm}`;
};

export const parseTime12h = (timeStr?: string): { hour: number; minute: number; ampm: 'AM' | 'PM' } => {
  if (!timeStr) {
    const now = new Date();
    let h = now.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return { hour: h, minute: now.getMinutes(), ampm };
  }

  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const ampm = (match[3]?.toUpperCase() as 'AM' | 'PM') || (hour >= 12 ? 'PM' : 'AM');
    if (hour > 12) hour = hour % 12 || 12;
    if (hour === 0) hour = 12;
    return { hour, minute: isNaN(minute) ? 0 : Math.min(59, Math.max(0, minute)), ampm };
  }

  return { hour: 12, minute: 0, ampm: 'PM' };
};

export const MaterialTimePickerDialog: React.FC<MaterialTimePickerDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialTime,
}) => {
  const [activeUnit, setActiveUnit] = useState<'hour' | 'minute'>('hour');
  const [hour, setHour] = useState<number>(3);
  const [minute, setMinute] = useState<number>(51);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('PM');
  const [isKeyboardMode, setIsKeyboardMode] = useState<boolean>(false);

  useRegisterOverlay(isOpen, 'material_time_picker', 'Time Picker Dialog', onClose);

  // Sync on open
  useEffect(() => {
    if (isOpen) {
      const parsed = parseTime12h(initialTime);
      setHour(parsed.hour);
      setMinute(parsed.minute);
      setAmpm(parsed.ampm);
      setActiveUnit('hour');
      setIsKeyboardMode(false);
    }
  }, [isOpen, initialTime]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const strHour = String(hour).padStart(2, '0');
    const strMinute = String(minute).padStart(2, '0');
    const finalFormatted = `${strHour}:${strMinute} ${ampm}`;
    onSelect(finalFormatted);
    onClose();
  };

  const handleHourClick = (h: number) => {
    setHour(h);
    // Smooth auto-advance to minute selection
    setActiveUnit('minute');
  };

  const handleMinuteClick = (m: number) => {
    setMinute(m);
  };

  // Dial geometry calculations
  const dialRadius = 88; // radius of number centers in px
  const dialCenter = 112; // center coordinates (224px diameter)

  // 12 hour positions
  const hoursList = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  // 12 minute milestone positions
  const minutesList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // Active hand angle calculation
  const handAngle = activeUnit === 'hour' ? (hour % 12) * 30 : minute * 6;

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
        {/* Header */}
        <div className="p-5 pb-3 bg-slate-900">
          <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            SELECT TIME
          </span>
        </div>

        {/* Digital Time Display Boxes + AM/PM Toggle */}
        <div className="px-5 pb-4 flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5">
            {/* Hour Display Box */}
            <button
              type="button"
              onClick={() => setActiveUnit('hour')}
              className={`w-20 h-18 rounded-2xl flex items-center justify-center text-3xl font-bold font-mono transition-all cursor-pointer ${
                activeUnit === 'hour'
                  ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500 shadow-md shadow-amber-500/10'
                  : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-750'
              }`}
            >
              {String(hour).padStart(2, '0')}
            </button>

            <span className="text-2xl font-bold text-slate-400 select-none">:</span>

            {/* Minute Display Box */}
            <button
              type="button"
              onClick={() => setActiveUnit('minute')}
              className={`w-20 h-18 rounded-2xl flex items-center justify-center text-3xl font-bold font-mono transition-all cursor-pointer ${
                activeUnit === 'minute'
                  ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500 shadow-md shadow-amber-500/10'
                  : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-750'
              }`}
            >
              {String(minute).padStart(2, '0')}
            </button>
          </div>

          {/* AM / PM Segmented Control */}
          <div className="flex flex-col rounded-2xl border border-slate-700 overflow-hidden bg-slate-800">
            <button
              type="button"
              onClick={() => setAmpm('AM')}
              className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                ampm === 'AM'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              AM
            </button>
            <div className="h-px bg-slate-700" />
            <button
              type="button"
              onClick={() => setAmpm('PM')}
              className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                ampm === 'PM'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              PM
            </button>
          </div>
        </div>

        {/* Dial Face OR Keyboard Manual Input View */}
        {isKeyboardMode ? (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Hour (1-12)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={hour}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setHour(Math.min(12, Math.max(1, val)));
                  }}
                  className="w-full py-2 bg-slate-800 border border-slate-700 rounded-xl text-center text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Minute (0-59)</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minute}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setMinute(Math.min(59, Math.max(0, val)));
                  }}
                  className="w-full py-2 bg-slate-800 border border-slate-700 rounded-xl text-center text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              Type values or switch back to the dial using the clock icon below.
            </p>
          </div>
        ) : (
          <div className="p-3 flex justify-center items-center">
            {/* Clock Face Circle */}
            <div className="relative w-56 h-56 rounded-full bg-slate-800/80 border border-slate-700 select-none shadow-inner">
              {/* Center Pivot Dot */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 z-20 shadow-xs" />

              {/* Hand Line pointing to selected angle */}
              <div
                className="absolute top-1/2 left-1/2 origin-bottom z-10 pointer-events-none transition-transform duration-200"
                style={{
                  height: `${dialRadius}px`,
                  width: '2px',
                  backgroundColor: '#f59e0b',
                  transform: `translateX(-50%) translateY(-100%) rotate(${handAngle}deg)`,
                }}
              >
                {/* Hand End Circle Knob */}
                <div className="w-8 h-8 rounded-full bg-amber-500 absolute -top-4 -left-[15px] opacity-25" />
              </div>

              {/* Clock Numbers */}
              {activeUnit === 'hour'
                ? hoursList.map((h) => {
                    const angleRad = ((h % 12) * 30 - 90) * (Math.PI / 180);
                    const x = dialCenter + dialRadius * Math.cos(angleRad);
                    const y = dialCenter + dialRadius * Math.sin(angleRad);
                    const isSelected = hour === h;

                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handleHourClick(h)}
                        className={`absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer z-20 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                            : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                        }`}
                        style={{ left: `${x}px`, top: `${y}px` }}
                      >
                        {h}
                      </button>
                    );
                  })
                : minutesList.map((m) => {
                    const angleRad = (m * 6 - 90) * (Math.PI / 180);
                    const x = dialCenter + dialRadius * Math.cos(angleRad);
                    const y = dialCenter + dialRadius * Math.sin(angleRad);
                    const isSelected = minute === m;

                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleMinuteClick(m)}
                        className={`absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer z-20 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                            : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                        }`}
                        style={{ left: `${x}px`, top: `${y}px` }}
                      >
                        {String(m).padStart(2, '0')}
                      </button>
                    );
                  })}
            </div>
          </div>
        )}

        {/* Bottom Bar: Mode Switcher + CANCEL / OK */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => setIsKeyboardMode(!isKeyboardMode)}
            className="p-2 text-slate-400 hover:text-amber-400 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title={isKeyboardMode ? 'Switch to Clock Dial' : 'Switch to Keyboard Input'}
          >
            {isKeyboardMode ? <Clock className="w-5 h-5" /> : <Keyboard className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
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
      </div>
    </div>,
    document.body
  );
};
