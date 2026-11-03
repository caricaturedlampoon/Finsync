import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Category, CategoryType } from '../../types';
import { IconRenderer, AVAILABLE_ICONS } from '../common/IconRenderer';
import {
  X,
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Check,
  Tags,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  Search,
  Pipette,
  Sparkles,
} from 'lucide-react';

export const CATEGORY_PALETTE_GROUPS: { name: string; colors: string[] }[] = [
  {
    name: 'Emerald & Mint',
    colors: ['#059669', '#10b981', '#34d399', '#22c55e', '#16a34a', '#84cc16'],
  },
  {
    name: 'Teal & Cyan',
    colors: ['#0d9488', '#14b8a6', '#2dd4bf', '#0891b2', '#06b6d4', '#38bdf8'],
  },
  {
    name: 'Blue & Sky',
    colors: ['#0284c7', '#2563eb', '#3b82f6', '#60a5fa', '#1d4ed8', '#1e40af'],
  },
  {
    name: 'Indigo & Purple',
    colors: ['#4f46e5', '#6366f1', '#818cf8', '#7c3aed', '#8b5cf6', '#a855f7'],
  },
  {
    name: 'Pink & Rose',
    colors: ['#c026d3', '#d946ef', '#db2777', '#ec4899', '#f43f5e', '#e11d48'],
  },
  {
    name: 'Red & Coral',
    colors: ['#dc2626', '#ef4444', '#f87171', '#ea580c', '#f97316', '#fb923c'],
  },
  {
    name: 'Amber & Gold',
    colors: ['#d97706', '#f59e0b', '#fbbf24', '#ca8a04', '#eab308', '#facc15'],
  },
  {
    name: 'Slate & Charcoal',
    colors: ['#334155', '#475569', '#64748b', '#94a3b8', '#52525b', '#3f3f46'],
  },
];

export const ALL_CATEGORY_COLORS = CATEGORY_PALETTE_GROUPS.flatMap((g) => g.colors);

export const CategoriesModal: React.FC = () => {
  const {
    isCategoriesModalOpen,
    setIsCategoriesModalOpen,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  } = useApp();

  const [activeTab, setActiveTab] = useState<CategoryType>('expense');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('expense');
  const [icon, setIcon] = useState('Tag');
  const [color, setColor] = useState(ALL_CATEGORY_COLORS[0]);
  const [iconSearch, setIconSearch] = useState('');
  const [customHex, setCustomHex] = useState('');

  // Search filtered icons
  const filteredIcons = useMemo(() => {
    if (!iconSearch.trim()) return AVAILABLE_ICONS;
    const query = iconSearch.toLowerCase();
    return AVAILABLE_ICONS.filter((name) => name.toLowerCase().includes(query));
  }, [iconSearch]);

  // Current tab categories sorted by configured order
  const currentTabCategories = useMemo(() => {
    const list = categories.filter((c) => c.type === activeTab);
    return [...list].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  }, [categories, activeTab]);

  if (!isCategoriesModalOpen) return null;

  const handleClose = () => {
    setIsCategoriesModalOpen(false);
    setIsFormOpen(false);
    setIsReordering(false);
    setEditingCategory(null);
  };

  const handleOpenForm = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat);
      setName(cat.name);
      setType(cat.type);
      setIcon(cat.icon);
      setColor(cat.color);
      setCustomHex(cat.color);
    } else {
      setEditingCategory(null);
      setName('');
      setType(activeTab);
      setIcon('Tag');
      setColor(ALL_CATEGORY_COLORS[0]);
      setCustomHex(ALL_CATEGORY_COLORS[0]);
    }
    setIconSearch('');
    setIsFormOpen(true);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentTabCategories.length) return;

    const reorderedTabItems = [...currentTabCategories];
    const [movedItem] = reorderedTabItems.splice(index, 1);
    reorderedTabItems.splice(targetIndex, 0, movedItem);

    // Merge with other tab's categories
    const otherCategories = categories.filter((c) => c.type !== activeTab);
    const fullReordered = [...reorderedTabItems, ...otherCategories];
    reorderCategories(fullReordered.map((c) => c.id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const chosenColor = customHex.startsWith('#') && customHex.length >= 4 ? customHex : color;

    if (editingCategory) {
      updateCategory(editingCategory.id, {
        name: name.trim(),
        type,
        icon,
        color: chosenColor,
      });
    } else {
      addCategory({
        name: name.trim(),
        type,
        icon,
        color: chosenColor,
        order: currentTabCategories.length,
      });
    }

    setIsFormOpen(false);
    setEditingCategory(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-white dark:bg-slate-900 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-150">
        <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 pt-safe border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Tags className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Manage Categories
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Customize icons, color palettes, and quick-entry display order
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Type Toggle & Toolbar Actions */}
          <div className="px-4 sm:px-8 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-850">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => setActiveTab('expense')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'expense'
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Expense Categories ({categories.filter((c) => c.type === 'expense').length})
              </button>
              <button
                onClick={() => setActiveTab('income')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'income'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Income Categories ({categories.filter((c) => c.type === 'income').length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsReordering(!isReordering)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer border ${
                  isReordering
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
                title="Reorder how categories appear when logging expenses"
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>{isReordering ? 'Done Reordering' : 'Reorder Layout'}</span>
              </button>

              <button
                onClick={() => handleOpenForm()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Category</span>
              </button>
            </div>
          </div>

          {/* Reorder explanation banner when active */}
          {isReordering && (
            <div className="px-4 sm:px-8 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>
                  <strong>Custom Ordering:</strong> Use the up and down arrows to arrange categories. The first 5 categories will appear directly in your quick-log tiles when adding an entry!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsReordering(false)}
                className="text-xs font-bold underline hover:opacity-80 shrink-0 ml-3"
              >
                Done
              </button>
            </div>
          )}

          {/* Categories List */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-2 flex-1 pb-safe pb-24">
            {currentTabCategories.map((cat, index) => {
              const isFirst = index === 0;
              const isLast = index === currentTabCategories.length - 1;
              const isTop5 = index < 5;

              return (
                <div
                  key={cat.id}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isReordering
                      ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-900/60 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Indicator */}
                    <div
                      className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                        isTop5
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                      title={isTop5 ? 'Shown in Quick Log grid' : `Position #${index + 1}`}
                    >
                      #{index + 1}
                    </div>

                    {/* Category Icon */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: cat.color }}
                    >
                      <IconRenderer name={cat.icon} className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {cat.name}
                        </span>
                        {isTop5 && (
                          <span className="hidden sm:inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Quick Tile
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {cat.type} {cat.isDefault ? '· Default' : '· Custom'}
                      </span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Reorder Up / Down buttons */}
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMove(index, 'up')}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        isFirst
                          ? 'opacity-30 border-slate-200 dark:border-slate-800 cursor-not-allowed text-slate-400'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:scale-105 active:scale-95'
                      }`}
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMove(index, 'down')}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        isLast
                          ? 'opacity-30 border-slate-200 dark:border-slate-800 cursor-not-allowed text-slate-400'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:scale-105 active:scale-95'
                      }`}
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

                    <button
                      onClick={() => handleOpenForm(cat)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                      title="Edit category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCategoryToDelete(cat)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add / Edit Category Dialog with Expanded Palettes & Searchable Icons */}
      {isFormOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: customHex || color }}
                >
                  <IconRenderer name={icon} className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {editingCategory ? 'Edit Category' : 'Create Category'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Pick an icon, color palette, and label</p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs sm:text-sm overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Groceries, Gym, OTT, Freelance"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Classification Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      type === 'expense'
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      type === 'income'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              {/* Searchable Icon Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Category Icon ({AVAILABLE_ICONS.length} available)
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Selected: {icon}</span>
                </div>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder="Search icons (e.g. food, car, gym, heart, pet)..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 max-h-36 overflow-y-auto">
                  {filteredIcons.map((iName) => {
                    const isSelected = icon === iName;
                    return (
                      <button
                        key={iName}
                        type="button"
                        onClick={() => setIcon(iName)}
                        title={iName}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <IconRenderer name={iName} className="w-4 h-4" />
                      </button>
                    );
                  })}
                  {filteredIcons.length === 0 && (
                    <div className="col-span-6 py-4 text-center text-xs text-slate-400">
                      No icons matching "{iconSearch}"
                    </div>
                  )}
                </div>
              </div>

              {/* Color Selector with Expanded Palettes & Custom Hex Picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Color Palette & Custom Tint
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full inline-block border border-black/10 dark:border-white/10"
                      style={{ backgroundColor: customHex || color }}
                    />
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                      {customHex || color}
                    </span>
                  </div>
                </div>

                {/* Grouped Swatches */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2 max-h-36 overflow-y-auto">
                  {CATEGORY_PALETTE_GROUPS.map((group) => (
                    <div key={group.name} className="flex items-center gap-2">
                      <span className="text-[9px] font-medium text-slate-400 w-20 shrink-0 truncate">
                        {group.name}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {group.colors.map((c) => {
                          const isSelected = (customHex || color).toLowerCase() === c.toLowerCase();
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setColor(c);
                                setCustomHex(c);
                              }}
                              className={`w-5 h-5 rounded-full transition-transform cursor-pointer relative ${
                                isSelected
                                  ? 'scale-125 ring-2 ring-emerald-500 ring-offset-1 z-10'
                                  : 'hover:scale-110 opacity-90 hover:opacity-100'
                              }`}
                              style={{ backgroundColor: c }}
                              title={c}
                            >
                              {isSelected && (
                                <Check className="w-2.5 h-2.5 text-white absolute inset-0 m-auto stroke-[3]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Color Input */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-150 dark:border-slate-800">
                  <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50">
                    <Pipette className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Custom Hex Picker</span>
                    <input
                      type="color"
                      value={customHex.startsWith('#') && customHex.length === 7 ? customHex : '#10b981'}
                      onChange={(e) => {
                        setCustomHex(e.target.value);
                        setColor(e.target.value);
                      }}
                      className="sr-only"
                    />
                  </label>
                  <input
                    type="text"
                    placeholder="#10b981"
                    value={customHex}
                    onChange={(e) => {
                      setCustomHex(e.target.value);
                      if (e.target.value.startsWith('#') && e.target.value.length === 7) {
                        setColor(e.target.value);
                      }
                    }}
                    className="w-24 px-2 py-1 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 uppercase"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmatory Delete Dialog */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Category?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to delete <strong className="font-semibold text-slate-800 dark:text-slate-200">"{categoryToDelete.name}"</strong>? Existing transactions linked to this category will preserve their records.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCategory(categoryToDelete.id);
                  setCategoryToDelete(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
