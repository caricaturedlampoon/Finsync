import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { Account, AccountType } from '../../types';
import { IconRenderer, AVAILABLE_ICONS } from '../common/IconRenderer';
import { adjustHexColor, isColorLight } from '../../utils/formatters';
import { compressImageThumbnail } from '../../services/imageCompression';
import { X, ArrowLeft, Check, Trash2, Upload, Image as ImageIcon, Pipette } from 'lucide-react';
import { useRegisterOverlay } from '../../navigation/NavigationContext';

interface AccountModalProps {
  initialAccount?: Account | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ACCOUNT_COLORS = [
  // Banking Blues & Azures (HDFC, SBI, ICICI, Canara, BoB)
  '#1e3a8a', // Deep Navy (HDFC)
  '#1d4ed8', // Royal Blue
  '#2563eb', // Classic Blue
  '#0284c7', // Sky Blue (SBI)
  '#0369a1', // Ocean Blue
  '#075985', // Deep Azure
  '#0e7490', // Pacific Cyan
  '#0891b2', // Vibrant Cyan

  // Wealth, Emerald & Forest Greens
  '#064e3b', // Deep Pine
  '#065f46', // Emerald Forest
  '#059669', // Indian Emerald
  '#10b981', // Mint Emerald
  '#15803d', // Bank Green
  '#16a34a', // Grass Green
  '#4d7c0f', // Olive Green
  '#65a30d', // Citrus Lime
  '#0d9488', // Rich Teal
  '#0f766e', // Deep Teal

  // Sovereign Gold, Mustard & Warm Ambers
  '#854d0e', // Deep Bronze
  '#a16207', // Indian Gold
  '#ca8a04', // Sovereign Gold (SGB)
  '#d97706', // Golden Amber
  '#b45309', // Warm Ochre
  '#c2410c', // Terracotta
  '#ea580c', // Sunset Orange
  '#f97316', // Bright Tangerine

  // Crimson, Ruby & Rose (Kotak, Axis, IndusInd)
  '#991b1b', // Dark Crimson (Kotak)
  '#b91c1c', // Cardinal Red
  '#dc2626', // Crimson Red
  '#e11d48', // Ruby Rose (Axis)
  '#be123c', // Cherry Red
  '#db2777', // Hot Pink
  '#f43f5e', // Coral Rose

  // Royal Violets, Purples & Magenta
  '#581c87', // Midnight Violet
  '#6b21a8', // Imperial Purple
  '#7c3aed', // Royal Purple
  '#9333ea', // Deep Violet
  '#a21caf', // Royal Magenta
  '#c026d3', // Fuchsia
  '#4338ca', // Deep Indigo
  '#4f46e5', // Electric Indigo

  // Executive Slates, Warm Espresso & Luxury Metallics
  '#0f172a', // Midnight Obsidian
  '#1e293b', // Titanium Slate
  '#334155', // Slate Navy
  '#475569', // Pewter Gray
  '#78350f', // Warm Espresso
  '#831843', // Wine Maroon
  '#042f2e', // Deep Jade
  '#312e81', // Midnight Sapphire
];

export const AccountModal: React.FC<AccountModalProps> = ({
  initialAccount,
  isOpen,
  onClose,
}) => {
  const { addAccount, updateAccount, deleteAccount, accounts, showToast } = useApp();

  useRegisterOverlay(isOpen, 'account_edit_modal', initialAccount ? 'Edit Account' : 'New Account', onClose);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [accountNumber, setAccountNumber] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [icon, setIcon] = useState('Landmark');
  const [customLogoUrl, setCustomLogoUrl] = useState<string>('');
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);
  const [includeInNetLiquid, setIncludeInNetLiquid] = useState(true);
  const [isArchived, setIsArchived] = useState(false);
  const [notes, setNotes] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [billingCycleDay, setBillingCycleDay] = useState('');
  const [paymentDueDay, setPaymentDueDay] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConfirmDelete(false);
    if (initialAccount) {
      setName(initialAccount.name);
      setType(initialAccount.type);
      setAccountNumber(initialAccount.accountNumber || '');
      setInitialBalance(initialAccount.initialBalance.toString());
      setIcon(initialAccount.icon);
      setCustomLogoUrl(initialAccount.customLogoUrl || '');
      setColor(initialAccount.color);
      setIncludeInNetLiquid(initialAccount.includeInNetLiquid);
      setIsArchived(Boolean(initialAccount.isArchived));
      setNotes(initialAccount.notes || '');
      setCreditLimit(initialAccount.creditLimit?.toString() || '');
      setBillingCycleDay(initialAccount.billingCycleDay?.toString() || '');
      setPaymentDueDay(initialAccount.paymentDueDay?.toString() || '');
    } else {
      setName('');
      setType('bank');
      setAccountNumber('');
      setInitialBalance('0');
      setIcon('Landmark');
      setCustomLogoUrl('');
      setColor(ACCOUNT_COLORS[0]);
      setIncludeInNetLiquid(true);
      setIsArchived(false);
      setNotes('');
      setCreditLimit('');
      setBillingCycleDay('');
      setPaymentDueDay('');
    }
  }, [initialAccount, isOpen]);

  if (!isOpen) return null;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('File size too large. Please select an image under 5MB.', 'error');
        return;
      }
      try {
        const compressedThumbnail = await compressImageThumbnail(file, {
          maxWidth: 100,
          maxHeight: 100,
          quality: 0.85,
        });
        setCustomLogoUrl(compressedThumbnail);
        showToast('Logo compressed & saved successfully', 'info');
      } catch (err) {
        console.error('Failed to compress thumbnail', err);
        showToast('Unable to process logo image', 'error');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedBalance = parseFloat(initialBalance) || 0;
    const parsedLimit = parseFloat(creditLimit) || undefined;
    const parsedBilling = parseInt(billingCycleDay, 10) || undefined;
    const parsedDue = parseInt(paymentDueDay, 10) || undefined;

    if (initialAccount) {
      updateAccount(initialAccount.id, {
        name: name.trim(),
        type,
        accountNumber: accountNumber.trim() || undefined,
        initialBalance: parsedBalance,
        icon,
        customLogoUrl: customLogoUrl || undefined,
        color,
        includeInNetLiquid,
        notes: notes.trim() || undefined,
        isArchived: initialAccount.isSystemDebtAccount ? false : isArchived,
        creditLimit: type === 'credit' ? parsedLimit : undefined,
        billingCycleDay: type === 'credit' ? parsedBilling : undefined,
        paymentDueDay: type === 'credit' ? parsedDue : undefined,
      });
    } else {
      addAccount({
        name: name.trim(),
        type,
        accountNumber: accountNumber.trim() || undefined,
        initialBalance: parsedBalance,
        icon,
        customLogoUrl: customLogoUrl || undefined,
        color,
        includeInNetLiquid,
        notes: notes.trim() || undefined,
        creditLimit: type === 'credit' ? parsedLimit : undefined,
        billingCycleDay: type === 'credit' ? parsedBilling : undefined,
        paymentDueDay: type === 'credit' ? parsedDue : undefined,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (!initialAccount) return;
    if (accounts.length <= 1) {
      showToast('Cannot delete the only remaining account.', 'error');
      return;
    }
    deleteAccount(initialAccount.id);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-white dark:bg-slate-900 flex flex-col h-full w-full overflow-hidden isolate animate-in fade-in duration-150">
      <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col h-full overflow-hidden">
        {/* Fullscreen Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 pt-safe border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {initialAccount ? 'Edit Account' : 'Add Bank or Wallet Account'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-5 text-xs sm:text-sm pb-safe pb-28">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Account Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HDFC Salary A/C, ICICI Savings, Pocket Cash"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Account Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm"
              >
                <option value="bank">Bank Savings / Current</option>
                <option value="credit">Credit Card</option>
                <option value="cash">Cash Wallet</option>
                <option value="demat">Demat & Trading</option>
                <option value="wallet">Digital Wallet / Prepaid</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Account Last 4 Digits
              </label>
              <input
                type="text"
                maxLength={6}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="4921"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Initial Setup Balance (₹)
            </label>
            <input
              type="number"
              step="any"
              required
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white tabular-nums font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Opening balance when you started using this passbook (negative if credit card debt).
            </p>
          </div>

          {/* Credit Card Specific Fields */}
          {type === 'credit' && (
            <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400 block uppercase tracking-wider">
                Credit Card Settings
              </span>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Credit Limit (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="e.g. 150000"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold tabular-nums"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Billing Cycle Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={billingCycleDay}
                    onChange={(e) => setBillingCycleDay(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                  <span className="text-[10px] text-slate-400">Day of month</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Due Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={paymentDueDay}
                    onChange={(e) => setPaymentDueDay(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                  <span className="text-[10px] text-slate-400">Day of next month</span>
                </div>
              </div>
            </div>
          )}

          {/* 1. Direct Device File Upload for Custom Logo */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Account Logo / Custom Icon
            </label>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden"
                  style={{ backgroundColor: color }}
                >
                  {customLogoUrl ? (
                    <img src={customLogoUrl} alt="Custom logo" className="w-full h-full object-cover" />
                  ) : (
                    <IconRenderer name={icon} className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    {customLogoUrl ? 'Custom Device Logo Active' : 'Vector Icon Active'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {customLogoUrl ? 'Stored locally in device base64' : `Using ${icon}`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="device-logo-upload"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Logo</span>
                </button>
                {customLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setCustomLogoUrl('')}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs"
                    title="Remove custom logo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Expanded Icon Palette */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Or Choose Vector Icon
            </label>
            <div className="grid grid-cols-6 gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 max-h-32 overflow-y-auto">
              {AVAILABLE_ICONS.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => {
                    setIcon(iconName);
                    setCustomLogoUrl('');
                  }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                    !customLogoUrl && icon === iconName
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={iconName}
                >
                  <IconRenderer name={iconName} className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Color Palette & Custom Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Passbook Theme Color (Fills the Whole Card)
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-bold text-slate-500 uppercase">{color}</span>
                <label className="relative flex items-center justify-center w-6 h-6 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-600 overflow-hidden shadow-2xs hover:scale-105 transition-transform" title="Pick any custom color">
                  <input
                    type="color"
                    value={color.startsWith('#') && color.length === 7 ? color : '#059669'}
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-full h-full" style={{ backgroundColor: color }} />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 max-h-36 overflow-y-auto">
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform cursor-pointer shrink-0 ${
                    color.toLowerCase() === c.toLowerCase()
                      ? 'scale-115 ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 shadow-sm'
                      : 'opacity-85 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>

            {/* Custom HEX code input row */}
            <div className="flex items-center justify-between gap-3 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Custom Hex Code:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={color}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setColor(val.startsWith('#') ? val : `#${val}`);
                  }}
                  placeholder="#059669"
                  maxLength={9}
                  className="w-24 px-2 py-1 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Live Passbook Card Preview */}
            <div className="pt-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Passbook Card Live Preview
              </span>
              <div
                style={{
                  background: `linear-gradient(135deg, ${color} 0%, ${adjustHexColor(color, -22)} 100%)`,
                  boxShadow: `0 10px 24px -6px ${color}40`,
                }}
                className={`p-3.5 rounded-2xl transition-all duration-200 relative overflow-hidden ${
                  isColorLight(color) ? 'text-slate-900' : 'text-white'
                }`}
              >
                <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-white/15 blur-xl pointer-events-none" />
                <div className="flex items-center justify-between gap-2 relative z-10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-bold text-xs shrink-0 border border-white/25">
                      {name ? name.slice(0, 2).toUpperCase() : 'BK'}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold truncate block leading-tight">
                        {name || 'Account Name'}
                      </span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider block">
                        {type} · {accountNumber ? `•••• ${accountNumber}` : 'Passbook'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] opacity-75 uppercase tracking-wider block">Balance</span>
                    <span className="text-sm font-extrabold tabular-nums block leading-tight">
                      ₹{parseFloat(initialBalance) ? parseFloat(initialBalance).toLocaleString('en-IN') : '0.00'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Include in Net Liquid Wealth Toggle */}
          <div className="pt-2">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInNetLiquid}
                onChange={(e) => setIncludeInNetLiquid(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Include in Net Liquid Wealth
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Include this account in liquid cash & bank summary calculations.
                </span>
              </div>
            </label>

            {initialAccount && !initialAccount.isSystemDebtAccount && (
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isArchived}
                  onChange={(e) => setIsArchived(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                    Archive Account
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Hide from active lists and quick selectors. Passbook records remain intact.
                  </span>
                </div>
              </label>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Account Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Min balance ₹10,000"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs"
            />
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            {initialAccount ? (
              confirmDelete ? (
                <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                  <span className="text-xs font-semibold text-rose-600">Delete account?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs active:scale-95 transition-all shadow-xs"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (accounts.length <= 1) {
                      showToast('Cannot delete the only remaining account.', 'error');
                      return;
                    }
                    setConfirmDelete(true);
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Account</span>
                </button>
              )
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              >
                {initialAccount ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
