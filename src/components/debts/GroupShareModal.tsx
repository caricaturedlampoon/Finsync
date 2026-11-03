import React, { useState } from 'react';
import { ExpenseGroup, GroupExpense } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatINR } from '../../utils/formatters';
import { openDirectMessageApp } from '../../utils/smsHelper';
import {
  getMemberDisplayName,
  getMemberPhone,
  calculateGroupBalances,
  SimplifiedDebtTransfer,
  simplifyDebts,
} from '../../utils/groupExpenseEngine';
import {
  X,
  Share2,
  Copy,
  Check,
  MessageCircle,
  MessageSquare,
  Phone,
  Edit2,
  Send,
  Users,
  Receipt,
  Sparkles,
} from 'lucide-react';

interface GroupShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ExpenseGroup;
  expense?: GroupExpense | null;
  settlement?: SimplifiedDebtTransfer | null;
}

export const GroupShareModal: React.FC<GroupShareModalProps> = ({
  isOpen,
  onClose,
  group,
  expense,
  settlement,
}) => {
  const { debts, updateDebt, userProfile, showToast } = useApp();

  const [copied, setCopied] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingPhoneValue, setEditingPhoneValue] = useState('');

  if (!isOpen || !group) return null;

  const userProfileName = userProfile?.name || 'You';

  // Compute Balances & Settlements if needed
  const { totalSpent, memberBalances, pairwiseDebts } = calculateGroupBalances(
    group,
    [expense].filter(Boolean) as GroupExpense[],
    debts,
    userProfileName
  );

  const cleanPhone = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  };

  // Build formatted message text based on mode
  let messageText = '';
  let modalTitle = 'Share Group Details';

  if (expense) {
    modalTitle = `Share Expense: ${expense.title}`;
    const payerName = getMemberDisplayName(expense.paidBy, debts, userProfileName);
    messageText = [
      `✈️ *${group.name}*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `📌 *Expense:* ${expense.title}`,
      `💰 *Total Amount:* ₹${formatINR(expense.totalAmount)}`,
      `💳 *Paid by:* ${payerName}`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `*Split Breakdown:*`,
      ...expense.splits.map((s) => {
        const name = getMemberDisplayName(s.memberId, debts, userProfileName);
        return `▫️ ${name}: ₹${formatINR(s.amount)}`;
      }),
      expense.note ? `\n📝 *Note:* ${expense.note}` : '',
      `━━━━━━━━━━━━━━━━━━━━━`,
      `⚡ Managed via FinSync · Log Split Track Analyse Grow`,
    ]
      .filter(Boolean)
      .join('\n');
  } else if (settlement) {
    modalTitle = `Settle Up Reminder`;
    messageText = [
      `🤝 *${group.name} - Settle Up*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `💰 *Amount:* ₹${formatINR(settlement.amount)}`,
      `👤 *From:* ${settlement.fromName}`,
      `🎯 *To:* ${settlement.toName}`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `🔴 Please settle this pending balance via UPI or Cash.`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `⚡ Recorded via FinSync · Log Split Track Analyse Grow`,
    ].join('\n');
  } else {
    modalTitle = `${group.name} - Balances Summary`;
    const transfers = simplifyDebts(memberBalances);
    messageText = [
      `🌴 *${group.name} - Split Summary*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `💰 *Total Spend:* ₹${formatINR(totalSpent)}`,
      `👥 *Members:* ${group.memberIds.length} people`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `*Net Balances:*`,
      ...memberBalances.map((m) => {
        const flag = m.net > 0.01 ? '🟢' : m.net < -0.01 ? '🔴' : '⚪';
        const netStr =
          m.net > 0.01
            ? `+₹${formatINR(m.net)} (gets back)`
            : m.net < -0.01
            ? `-₹${formatINR(Math.abs(m.net))} (owes)`
            : `₹0.00 (settled)`;
        return `${flag} *${m.memberName}*: ${netStr}`;
      }),
      `━━━━━━━━━━━━━━━━━━━━━`,
      transfers.length > 0 ? `*Recommended Settlements:*` : '🟢 All balances are settled up!',
      ...transfers.map((t) => `▫️ *${t.fromName}* ➔ *${t.toName}*: ₹${formatINR(t.amount)}`),
      `━━━━━━━━━━━━━━━━━━━━━`,
      `⚡ Managed via FinSync · Log Split Track Analyse Grow`,
    ].join('\n');
  }

  const encodedText = encodeURIComponent(messageText);

  // Generate personalized direct-addressed message for an individual recipient member
  const getMemberPersonalizedMessage = (memberId: string): string => {
    const memberName = getMemberDisplayName(memberId, debts, userProfileName);

    if (expense) {
      const split = expense.splits.find((s) => s.memberId === memberId);
      const memberShare = split?.amount || 0;
      const isPayer = expense.paidBy === memberId;
      const payerName = getMemberDisplayName(expense.paidBy, debts, userProfileName);

      if (isPayer) {
        return [
          `Hi ${memberName},`,
          ``,
          `✈️ *${group.name}*`,
          `━━━━━━━━━━━━━━━━━━━━━`,
          `📌 *Expense:* ${expense.title}`,
          `💰 *Total Paid by You:* ₹${formatINR(expense.totalAmount)}`,
          `▫️ *Your Personal Share:* ₹${formatINR(memberShare)}`,
          expense.note ? `📝 *Note:* ${expense.note}` : '',
          `━━━━━━━━━━━━━━━━━━━━━`,
          `⚡ Managed via FinSync · Log Split Track Analyse Grow`,
        ]
          .filter(Boolean)
          .join('\n');
      }

      return [
        `Hi ${memberName},`,
        ``,
        `✈️ *${group.name}*`,
        `━━━━━━━━━━━━━━━━━━━━━`,
        `📌 *Expense:* ${expense.title}`,
        `💰 *Your Share:* ₹${formatINR(memberShare)}`,
        `💳 *Paid by:* ${payerName} (Total bill: ₹${formatINR(expense.totalAmount)})`,
        expense.note ? `📝 *Note:* ${expense.note}` : '',
        `━━━━━━━━━━━━━━━━━━━━━`,
        `🔴 Please settle your share of ₹${formatINR(memberShare)} with ${payerName} via UPI or Cash.`,
        `━━━━━━━━━━━━━━━━━━━━━`,
        `⚡ Managed via FinSync · Log Split Track Analyse Grow`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (settlement) {
      if (memberId === settlement.fromId) {
        return [
          `Hi ${memberName},`,
          ``,
          `🤝 *${group.name} - Settle Up*`,
          `━━━━━━━━━━━━━━━━━━━━━`,
          `🔴 *You owe ₹${formatINR(settlement.amount)} to ${settlement.toName}*`,
          `━━━━━━━━━━━━━━━━━━━━━`,
          `Please settle this pending amount via UPI or Cash at your earliest convenience.`,
          `━━━━━━━━━━━━━━━━━━━━━`,
          `⚡ Recorded via FinSync · Log Split Track Analyse Grow`,
        ].join('\n');
      }

      if (memberId === settlement.toId) {
        return [
          `Hi ${memberName},`,
          ``,
          `🤝 *${group.name} - Settle Up*`,
          `━━━━━━━━━━━━━━━━━━━━━`,
          `🟢 *${settlement.fromName} owes you ₹${formatINR(settlement.amount)}*`,
          `━━━━━━━━━━━━━━━━━━━━━`,
          `Pending collection for ${group.name}.`,
          `━━━━━━━━━━━━━━━━━━━━━`,
          `⚡ Recorded via FinSync · Log Split Track Analyse Grow`,
        ].join('\n');
      }
    }

    // Default: Balances summary addressed directly to recipient
    const m = memberBalances.find((b) => b.memberId === memberId);
    const transfers = simplifyDebts(memberBalances);
    const outgoing = transfers.filter((t) => t.fromId === memberId);
    const incoming = transfers.filter((t) => t.toId === memberId);

    if (m && m.net < -0.01) {
      return [
        `Hi ${memberName},`,
        ``,
        `🌴 *${group.name} - Split Summary*`,
        `━━━━━━━━━━━━━━━━━━━━━`,
        `🔴 *You owe a total of ₹${formatINR(Math.abs(m.net))}* in ${group.name}.`,
        ``,
        `*Your Pending Settlements:*`,
        ...outgoing.map((t) => `▫️ You owe ₹${formatINR(t.amount)} to ${t.toName}`),
        `━━━━━━━━━━━━━━━━━━━━━`,
        `Please settle your dues via UPI or Cash at your earliest convenience.`,
        `━━━━━━━━━━━━━━━━━━━━━`,
        `⚡ Managed via FinSync · Log Split Track Analyse Grow`,
      ].join('\n');
    }

    if (m && m.net > 0.01) {
      return [
        `Hi ${memberName},`,
        ``,
        `🌴 *${group.name} - Split Summary*`,
        `━━━━━━━━━━━━━━━━━━━━━`,
        `🟢 *You get back ₹${formatINR(m.net)}* in total from ${group.name}.`,
        ``,
        `*Incoming Settlements:*`,
        ...incoming.map((t) => `▫️ ${t.fromName} owes you ₹${formatINR(t.amount)}`),
        `━━━━━━━━━━━━━━━━━━━━━`,
        `⚡ Managed via FinSync · Log Split Track Analyse Grow`,
      ].join('\n');
    }

    return [
      `Hi ${memberName},`,
      ``,
      `🌴 *${group.name} - Split Summary*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `⚪ *All settled up!* You have no pending balance in ${group.name}.`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `⚡ Managed via FinSync · Log Split Track Analyse Grow`,
    ].join('\n');
  };

  // Trigger Native WhatsApp intent
  const triggerWhatsApp = (phone?: string, memberId?: string) => {
    const rawDigits = cleanPhone(phone);
    const targetText = memberId ? getMemberPersonalizedMessage(memberId) : messageText;
    const encText = encodeURIComponent(targetText);

    let deepLink = '';
    if (rawDigits) {
      deepLink = `whatsapp://send?phone=${rawDigits}&text=${encText}`;
    } else {
      deepLink = `whatsapp://send?text=${encText}`;
    }

    try {
      window.location.href = deepLink;
      setTimeout(() => {
        // Fallback if app is not installed or desktop web
        const webFallback = rawDigits
          ? `https://api.whatsapp.com/send?phone=${rawDigits}&text=${encText}`
          : `https://api.whatsapp.com/send?text=${encText}`;
        window.open(webFallback, '_blank', 'noopener,noreferrer');
      }, 700);
    } catch {
      window.open(`https://api.whatsapp.com/send?text=${encText}`, '_blank', 'noopener,noreferrer');
    }
  };

  // Trigger Native Direct Messages App intent
  const triggerSMS = (phone?: string, memberId?: string) => {
    const targetText = memberId ? getMemberPersonalizedMessage(memberId) : messageText;
    if (!phone) {
      showToast('Opening Messages app... (Select contact in your SMS app)', 'info');
    }
    openDirectMessageApp(phone, targetText);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      showToast('Formatted message copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  // Save phone number edit inline
  const handleSavePhone = (memberId: string) => {
    if (memberId === 'user_me') {
      showToast('Your phone number is managed in Settings', 'info');
      setEditingMemberId(null);
      return;
    }

    const trimmed = editingPhoneValue.trim();
    updateDebt(memberId, { phone: trimmed });
    showToast('Phone number updated successfully', 'success');
    setEditingMemberId(null);
  };

  const relevantMemberIds = expense
    ? expense.splits.map((s) => s.memberId)
    : settlement
    ? [settlement.fromId, settlement.toId]
    : group.memberIds;

  return (
    <div className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                {modalTitle}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Direct WhatsApp & SMS native intents with member phone management
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
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Formatted Message Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                Formatted Share Message
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap select-all max-h-40 overflow-y-auto">
              {messageText}
            </pre>
          </div>

          {/* Broadcast / Group Share Intent */}
          <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 truncate">
                Share to Entire Group
              </div>
              <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 truncate">
                Direct WhatsApp or Messages app without system chooser
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => triggerWhatsApp()}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => triggerSMS()}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 fill-white" />
                <span>Message</span>
              </button>
            </div>
          </div>

          {/* Member Direct Share with Inline Phone Editing */}
          <div className="space-y-2.5">
            <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] block">
              Send to Individual Members
            </span>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              {relevantMemberIds.map((memberId) => {
                const name = getMemberDisplayName(memberId, debts, userProfileName);
                const phone = memberId === 'user_me' ? userProfile?.email : getMemberPhone(memberId, debts);
                const isEditing = editingMemberId === memberId;

                return (
                  <div
                    key={memberId}
                    className="p-3 bg-white dark:bg-slate-900 flex flex-col gap-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                          <span>{name}</span>
                          {memberId === 'user_me' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                              You
                            </span>
                          )}
                        </div>

                        {/* Inline Phone Display & Editing */}
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <input
                              type="tel"
                              value={editingPhoneValue}
                              onChange={(e) => setEditingPhoneValue(e.target.value)}
                              placeholder="+91 98765 43210"
                              autoFocus
                              className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-emerald-500 rounded-lg outline-none w-36 text-slate-900 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePhone(memberId)}
                              className="p-1 rounded-md bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-500 transition-colors cursor-pointer"
                              title="Save phone number"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMemberId(null)}
                              className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] hover:bg-slate-300 transition-colors cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {phone ? (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                {phone}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                No phone saved
                              </span>
                            )}
                            {memberId !== 'user_me' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMemberId(memberId);
                                  setEditingPhoneValue(phone || '');
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>{phone ? 'Edit' : 'Add Phone'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Direct Intent Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => triggerWhatsApp(phone, memberId)}
                          className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200/80 dark:border-emerald-800/80 transition-all cursor-pointer"
                          title={`Send WhatsApp message to ${name}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerSMS(phone, memberId)}
                          className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200/80 dark:border-blue-800/80 transition-all cursor-pointer"
                          title={`Send Message to ${name}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
