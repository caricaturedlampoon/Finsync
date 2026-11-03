import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Camera, Trash2, User, Check, Sparkles, Upload } from 'lucide-react';

export const ProfileModal: React.FC = () => {
  const { isProfileModalOpen, setIsProfileModalOpen, userProfile, updateUserProfile, showToast } =
    useApp();

  const [name, setName] = useState(userProfile.name || '');
  const [tagline, setTagline] = useState(userProfile.tagline || '');
  const [avatarPreview, setAvatarPreview] = useState<string>(userProfile.avatarUrl || '');
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isProfileModalOpen) {
      setName(userProfile.name || '');
      setTagline(userProfile.tagline || '');
      setAvatarPreview(userProfile.avatarUrl || '');
    }
  }, [isProfileModalOpen, userProfile]);

  if (!isProfileModalOpen) return null;

  const handleClose = () => {
    setIsProfileModalOpen(false);
  };

  /**
   * Compress and resize uploaded image using an offscreen canvas.
   * Keeps the image crisp at 256x256 while ensuring lightweight storage in localStorage.
   */
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file (PNG, JPG, WebP)', 'error');
      return;
    }

    setIsProcessingImage(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const targetSize = 256;
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          setAvatarPreview(e.target?.result as string);
          setIsProcessingImage(false);
          return;
        }

        // Calculate center crop square
        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setAvatarPreview(compressedDataUrl);
        setIsProcessingImage(false);
        showToast('Profile photo ready to save!', 'info');
      };

      img.onerror = () => {
        setIsProcessingImage(false);
        showToast('Unable to process the selected photo', 'error');
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      setIsProcessingImage(false);
      showToast('Error reading selected image', 'error');
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
      // Reset input so the same file can be re-selected if desired
      e.target.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setAvatarPreview('');
    showToast('Photo removed. Using initials badge', 'info');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('Please enter your name', 'error');
      return;
    }

    updateUserProfile({
      name: trimmedName,
      tagline: tagline.trim(),
      avatarUrl: avatarPreview,
    });

    handleClose();
  };

  const getInitials = (text: string) => {
    const parts = text.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return 'U';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Edit Profile</h2>
              <p className="text-xs text-slate-400">Personalize your name & profile avatar</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Avatar Preview & Direct Device Upload */}
          <div className="flex flex-col items-center text-center">
            <div className="relative group">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={name || 'Profile Avatar'}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-emerald-500/30 shadow-md transition-all group-hover:ring-emerald-500"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center shadow-md ring-4 ring-emerald-500/20">
                  {getInitials(name || 'User')}
                </div>
              )}

              {/* Upload trigger button overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg ring-3 ring-white dark:ring-slate-900 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                title="Upload picture from device"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Photo Action Buttons */}
            <div className="flex items-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isProcessingImage ? 'Processing...' : 'Upload from Device'}</span>
              </button>

              {avatarPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Select any photo directly from your phone gallery or computer.
            </p>
          </div>

          {/* User Full Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Your Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rohan Sharma"
              className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Tagline / Subtitle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Account Label / Tagline (Optional)
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Personal Finances, Family Vault"
              className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400">
              Displayed as a subtle subtext next to your profile picture in the header.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
