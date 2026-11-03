import React, { useState, useEffect } from 'react';
import { Account } from '../../types';
import { IconRenderer } from './IconRenderer';

interface AccountAvatarProps {
  account?: Account | null;
  customLogoUrl?: string;
  icon?: string;
  color?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: {
    container: 'w-6 h-6 rounded-lg text-[10px]',
    icon: 'w-3 h-3',
  },
  sm: {
    container: 'w-8 h-8 rounded-xl text-xs',
    icon: 'w-4 h-4',
  },
  md: {
    container: 'w-10 h-10 rounded-xl text-sm',
    icon: 'w-5 h-5',
  },
  lg: {
    container: 'w-12 h-12 rounded-2xl text-base',
    icon: 'w-6 h-6',
  },
  xl: {
    container: 'w-14 h-14 rounded-2xl text-lg',
    icon: 'w-7 h-7',
  },
};

export const AccountAvatar: React.FC<AccountAvatarProps> = ({
  account,
  customLogoUrl,
  icon,
  color,
  name,
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  const logoUrl = customLogoUrl !== undefined ? customLogoUrl : account?.customLogoUrl;
  const iconName = icon || account?.icon || 'Landmark';
  const bgColor = color || account?.color || '#2563eb';
  const accountName = name || account?.name || 'Account';

  useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  const sizeStyle = SIZE_MAP[size] || SIZE_MAP.md;

  if (logoUrl && !imgError) {
    return (
      <div
        className={`${sizeStyle.container} shrink-0 overflow-hidden shadow-xs border border-black/5 dark:border-white/10 flex items-center justify-center bg-white dark:bg-slate-800 ${className}`}
        style={{ backgroundColor: bgColor }}
        title={accountName}
      >
        <img
          src={logoUrl}
          alt={accountName}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeStyle.container} flex items-center justify-center text-white shrink-0 shadow-xs ${className}`}
      style={{ backgroundColor: bgColor }}
      title={accountName}
    >
      <IconRenderer name={iconName} className={sizeStyle.icon} />
    </div>
  );
};
