import React, { useState } from 'react';
import { Debt, Transaction } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatINR, formatDate } from '../../utils/formatters';
import { openDirectMessageApp } from '../../utils/smsHelper';
import {
  X,
  Share2,
  Copy,
  Check,
  MessageCircle,
  MessageSquare,
  Phone,
  Edit2,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';

interface CustomTransactionShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: Debt;
  transaction?: Transaction | null;
  summaryBalance?: number;
}

export const CustomTransactionShareModal: React.FC<CustomTransactionShareModalProps> = ({
  isOpen,
  onClose,
  debt,
  transaction,
  summaryBalance,
}) => {
  const { updateDebt, userProfile, showToast } = useApp();

  const [copied, setCopied] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(debt?.phone || '');

  if (!isOpen || !debt) return null;

  const currentBalance = summaryBalance !== undefined ? summaryBalance : debt.currentBalance;
  const isOwed = currentBalance > 0.01;
  const isOweThem = currentBalance < -0.01;
  const statusFlag = isOwed ? '🔴' : isOweThem ? '🟢' : '⚪';
  const senderName = userProfile?.name?.trim() || 'Me';

  const cleanPhone = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  };

  // Build formatted message directly addressed to the recipient
  let messageText = '';
  if (transaction) {
    const isPaid = transaction.type === 'expense' || transaction.debtActionType === 'lent';
    const directionLabel = isPaid ? `Received from ${senderName}` : `Paid to ${senderName}`;
    const actionLabel = isPaid ? 'Money Lent / Given' : 'Repayment / Return';

    messageText = [
      `Hi ${debt.personName},`,
      ``,
      `🤝 *FinSync Debt Record Update*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `💰 *Amount:* ₹${formatINR(transaction.amount)} (${directionLabel})`,
      `📌 *Type:* ${actionLabel}`,
      `📅 *Date:* ${formatDate(transaction.date)}`,
      transaction.note ? `📝 *Note:* ${transaction.note}` : '',
      `━━━━━━━━━━━━━━━━━━━━━`,
      `${statusFlag} *Current Net Balance:* ${
        isOwed
          ? `You owe ₹${formatINR(currentBalance)} to ${senderName}`
          : isOweThem
          ? `${senderName} owes you ₹${formatINR(Math.abs(currentBalance))}`
          : 'Fully Settled (₹0.00)'
      }`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `⚡ Recorded via FinSync · Log Split Track Analyse Grow`,
    ]
      .filter(Boolean)
      .join('\n');
  } else {
    // General reminder addressed directly to recipient
    messageText = [
      `Hi ${debt.personName},`,
      ``,
      `🤝 *FinSync Balance Reminder*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `${statusFlag} *Outstanding Balance:* ${
        isOwed
          ? `You owe ₹${formatINR(currentBalance)} to ${senderName}`
          : isOweThem
          ? `${senderName} owes you ₹${formatINR(Math.abs(currentBalance))}`
          : 'All Clear (₹0.00)'
      }`,
      debt.dueDate ? `📅 *Due Date:* ${formatDate(debt.dueDate)}` : '',
      debt.notes ? `📝 *Notes:* ${debt.notes}` : '',
      `━━━━━━━━━━━━━━━━━━━━━`,
      `Please review and settle via UPI or Cash at your earliest convenience.`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `⚡ Managed via FinSync · Log Split Track Analyse Grow`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const encodedText = encodeURIComponent(messageText);

  // Trigger Native WhatsApp intent
  const triggerWhatsApp = () => {
    const rawDigits = cleanPhone(debt.phone);
    const deepLink = rawDigits
      ? `whatsapp://send?phone=${rawDigits}&text=${encodedText}`
      : `whatsapp://send?text=${encodedText}`;

    try {
      window.location.href = deepLink;
      setTimeout(() => {
        const webFallback = rawDigits
          ? `https://api.whatsapp.com/send?phone=${rawDigits}&text=${encodedText}`
          : `https://api.whatsapp.com/send?text=${encodedText}`;
        window.open(webFallback, '_blank', 'noopener,noreferrer');
      }, 700);
    } catch {
      window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank', 'noopener,noreferrer');
    }
  };

  // Trigger Native Direct SMS / Messages App intent
  const triggerSMS = () => {
    if (!debt.phone) {
      showToast('Opening Messages app... (Tip: Add a phone number to pre-select recipient)', 'info');
    }
    openDirectMessageApp(debt.phone, messageText);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      showToast('Message copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const handleSavePhone = () => {
    const trimmed = phoneInput.trim();
    updateDebt(debt.id, { phone: trimmed });
    showToast('Phone number updated', 'success');
    setIsEditingPhone(false);
  };

  return (
    <div className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                Share with {debt.personName}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Direct WhatsApp and SMS native intent dispatch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Contact Details & Inline Phone Editing */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Recipient Contact
              </span>
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {debt.personName}
              </div>

              {isEditingPhone ? (
                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="+91 98765 43210"
                    autoFocus
                    className="px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-emerald-500 rounded-lg outline-none w-36 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSavePhone}
                    className="p-1 rounded-md bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-500 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneInput(debt.phone || '');
                      setIsEditingPhone(false);
                    }}
                    className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {debt.phone || 'No phone number saved'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneInput(debt.phone || '');
                      setIsEditingPhone(true);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{debt.phone ? 'Edit' : 'Add Phone'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Net Balance
              </span>
              <span
                className={`text-xs font-black tabular-nums block mt-0.5 ${
                  isOwed
                    ? 'text-rose-600 dark:text-rose-400'
                    : isOweThem
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500'
                }`}
              >
                ₹{formatINR(Math.abs(currentBalance))}
              </span>
            </div>
          </div>

          {/* Formatted Message Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                Formatted Reminder
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap select-all max-h-48 overflow-y-auto">
              {messageText}
            </pre>
          </div>

          {/* Action Buttons: Native WhatsApp & Native SMS */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={triggerWhatsApp}
              className="py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>Send WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={triggerSMS}
              className="py-2.5 px-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 fill-white" />
              <span>Send Message</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
