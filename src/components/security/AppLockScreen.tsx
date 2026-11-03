import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { authenticateDeviceBiometrics } from '../../services/biometricAuthService';
import {
  ShieldCheck,
  Lock,
  Unlock,
  Fingerprint,
  Delete,
  Sparkles,
  AlertCircle,
  KeyRound,
  RotateCcw,
} from 'lucide-react';

export const AppLockScreen: React.FC = () => {
  const { unlockApp, showToast, resetToZeroData } = useApp();
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifyingBio, setIsVerifyingBio] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg(null);

      if (nextPin.length === 4) {
        // Auto-check PIN when 4th digit entered
        setTimeout(() => {
          const success = unlockApp(nextPin);
          if (!success) {
            setErrorMsg('Incorrect PIN. Please try again.');
            setPin('');
          }
        }, 120);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleBiometricAuth = async () => {
    setIsVerifyingBio(true);
    setErrorMsg(null);

    try {
      const result = await authenticateDeviceBiometrics();
      if (result.success) {
        unlockApp();
      } else {
        setErrorMsg(result.error || 'Biometric verification failed. Please enter your PIN.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Biometric verification failed. Please enter your PIN.');
    } finally {
      setIsVerifyingBio(false);
    }
  };

  // Keyboard numeric listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Enter' && pin.length === 4) {
        const success = unlockApp(pin);
        if (!success) {
          setErrorMsg('Incorrect PIN.');
          setPin('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col items-center justify-center p-4 pt-safe pb-safe select-none">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/25 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center space-y-6">
        {/* App Logo & Vault Icon */}
        <div className="relative">
          <img
            src="/assets/aistudio/1000127183_6a8d46a3.png"
            alt="FinSync"
            className="w-16 h-16 rounded-2xl object-cover shadow-2xl shadow-emerald-600/30 ring-2 ring-emerald-500/20 animate-in zoom-in-95 duration-200"
          />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-slate-950 flex items-center justify-center text-emerald-400">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Title & Status */}
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            FinSync Vault
          </h1>
          <p className="text-xs text-emerald-400 font-semibold tracking-wide">
            Log • Split • Track • Analyse • Grow
          </p>
          <p className="text-[11px] text-slate-400">
            Hardware-backed offline encryption active
          </p>
        </div>

        {/* PIN Dots Display */}
        <div className="py-2">
          <div className="flex items-center justify-center gap-4">
            {[0, 1, 2, 3].map((index) => {
              const filled = index < pin.length;
              return (
                <div
                  key={index}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                    filled
                      ? 'bg-emerald-400 scale-125 shadow-lg shadow-emerald-400/50'
                      : 'border-2 border-slate-700 bg-slate-900'
                  }`}
                />
              );
            })}
          </div>

          {errorMsg ? (
            <p className="text-xs text-rose-400 font-semibold mt-3 animate-shake flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMsg}</span>
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 mt-3 font-mono">
              Enter your 4-digit PIN or use Biometrics
            </p>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3.5 w-full max-w-[260px] pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800/80 active:scale-95 text-xl font-bold text-slate-100 flex items-center justify-center transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {digit}
            </button>
          ))}

          {/* Biometrics Button */}
          <button
            type="button"
            onClick={handleBiometricAuth}
            disabled={isVerifyingBio}
            className="h-14 rounded-2xl bg-slate-900/40 hover:bg-emerald-950/40 border border-slate-800 active:scale-95 text-emerald-400 flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs focus:outline-none"
            title="Biometric Fingerprint / Face ID Unlock"
          >
            <Fingerprint className={`w-6 h-6 ${isVerifyingBio ? 'animate-pulse text-emerald-300' : ''}`} />
            <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5 text-emerald-400/80">Touch ID</span>
          </button>

          {/* Zero (0) */}
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800/80 active:scale-95 text-xl font-bold text-slate-100 flex items-center justify-center transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            0
          </button>

          {/* Backspace */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={pin.length === 0}
            className="h-14 rounded-2xl bg-slate-900/40 hover:bg-slate-800 border border-slate-800 active:scale-95 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer shadow-xs focus:outline-none"
            title="Delete"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Security & Recovery Status */}
        <div className="pt-3 flex flex-col items-center gap-1.5 text-center">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400/90">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Device Vault • Protected</span>
          </div>

          <span className="text-[10px] text-slate-500">
            Use your 4-digit PIN or Touch ID sensor to unlock
          </span>
        </div>
      </div>
    </div>
  );
};
