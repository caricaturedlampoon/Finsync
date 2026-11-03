import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ExpenseGroup, Debt } from '../../types';
import {
  X,
  Plus,
  Users,
  Check,
  UserPlus,
  User,
  Sparkles,
} from 'lucide-react';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (newGroupId: string) => void;
}

const PRESET_COLORS = [
  '#059669', // emerald
  '#2563eb', // blue
  '#7c3aed', // violet
  '#db2777', // pink
  '#ea580c', // orange
  '#0891b2', // cyan
];

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onGroupCreated,
}) => {
  const { debts, addDebtContact, addGroup, showToast } = useApp();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarColor, setAvatarColor] = useState(PRESET_COLORS[0]);

  // Selected member IDs (user_me is always selected)
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  // Quick add contact drawer
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickContactName, setQuickContactName] = useState('');
  const [quickContactPhone, setQuickContactPhone] = useState('');

  if (!isOpen) return null;

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleQuickAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickContactName.trim()) return;

    const newDebtId = addDebtContact({
      personName: quickContactName.trim(),
      notes: quickContactPhone.trim() ? `Phone: ${quickContactPhone.trim()}` : undefined,
    });

    setSelectedContactIds((prev) => new Set(prev).add(newDebtId));
    setQuickContactName('');
    setQuickContactPhone('');
    setIsQuickAddOpen(false);
    showToast(`Added and selected "${quickContactName.trim()}"`, 'success');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter a group name', 'error');
      return;
    }

    const memberIds = ['user_me', ...Array.from(selectedContactIds)];

    const newGroupId = addGroup({
      name: name.trim(),
      description: description.trim() || undefined,
      memberIds,
      avatarColor,
    });

    setName('');
    setDescription('');
    setSelectedContactIds(new Set());
    onClose();
    onGroupCreated(newGroupId);
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: avatarColor }}
            >
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Create Expense Group</h2>
              <p className="text-xs text-slate-500">Track trips, shared flat, or event expenses</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Goa Trip 2026, Flat 402, Birthday Party"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Vacation expenses, beach shacks & watersports"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Theme Color Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Group Color Theme
            </label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setAvatarColor(col)}
                  className={`w-7 h-7 rounded-xl transition-transform cursor-pointer flex items-center justify-center ${
                    avatarColor === col ? 'ring-2 ring-offset-2 ring-emerald-500 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: col }}
                >
                  {avatarColor === col && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Member Selection from Contacts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Select Group Members ({selectedContactIds.size + 1})
              </label>
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Quick Add Contact</span>
              </button>
            </div>

            {/* Quick Add Contact Form */}
            {isQuickAddOpen && (
              <div className="p-3 mb-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">New Contact</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={quickContactName}
                    onChange={(e) => setQuickContactName(e.target.value)}
                    placeholder="Contact Name"
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                  />
                  <input
                    type="tel"
                    value={quickContactPhone}
                    onChange={(e) => setQuickContactPhone(e.target.value)}
                    placeholder="Phone (for WhatsApp)"
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsQuickAddOpen(false)}
                    className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickAddContact}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl"
                  >
                    Save Contact
                  </button>
                </div>
              </div>
            )}

            {/* Always-included user chip */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/20">
                <Check className="w-3.5 h-3.5" />
                <span>You (Me)</span>
              </span>

              {debts.map((contact) => {
                const isSelected = selectedContactIds.has(contact.id);
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => toggleContact(contact.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    <span>{contact.personName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Create Group</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
