import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { navigationManager, NavigationScreen } from './navigationManager';
import { useApp } from '../context/AppContext';
import { ActiveTab } from '../types';

interface NavigationContextType {
  canGoBack: boolean;
  goBack: () => void;
  pushTab: (tab: ActiveTab) => void;
  pushScreen: (screen: NavigationScreen) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast, setActiveTab, activeTab, isExtendedToolsOpen, setIsExtendedToolsOpen } = useApp();
  const [, setTick] = useState(0);

  // Connect toast and screen change handlers
  useEffect(() => {
    navigationManager.setExitToastHandler((msg) => {
      showToast(msg, 'info');
    });

    navigationManager.setScreenChangeHandler((screen) => {
      if (screen === 'tools') {
        setIsExtendedToolsOpen(true);
      } else {
        setIsExtendedToolsOpen(false);
        setActiveTab(screen);
      }
    });

    const unsubscribe = navigationManager.subscribe(() => {
      setTick((t) => t + 1);
    });

    return () => {
      unsubscribe();
    };
  }, [showToast, setActiveTab, setIsExtendedToolsOpen]);

  // Sync external activeTab changes into navigationManager (when tools is not open)
  useEffect(() => {
    if (!isExtendedToolsOpen) {
      navigationManager.pushScreen(activeTab);
    }
  }, [activeTab, isExtendedToolsOpen]);

  // Sync isExtendedToolsOpen opening into navigationManager
  useEffect(() => {
    if (isExtendedToolsOpen) {
      navigationManager.pushScreen('tools');
    }
  }, [isExtendedToolsOpen]);

  const goBack = useCallback(() => {
    navigationManager.goBack();
  }, []);

  const pushTab = useCallback((tab: ActiveTab) => {
    navigationManager.pushTab(tab);
  }, []);

  const pushScreen = useCallback((screen: NavigationScreen) => {
    navigationManager.pushScreen(screen);
  }, []);

  const canGoBack = navigationManager.canGoBack();

  const value = useMemo(
    () => ({
      canGoBack,
      goBack,
      pushTab,
      pushScreen,
    }),
    [canGoBack, goBack, pushTab, pushScreen]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

/**
 * Hook to automatically register any Tier 1 overlay (modal, sheet, dropdown, or date picker)
 */
export function useRegisterOverlay(isOpen: boolean, id: string, title: string, onDismiss: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const cleanup = navigationManager.registerOverlay(id, title, onDismiss);
    return cleanup;
  }, [isOpen, id, title, onDismiss]);
}

/**
 * Hook to automatically register a modal with the dynamic stack while it is open.
 */
export function useRegisterModal(isOpen: boolean, id: string, title: string, onDismiss: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const cleanup = navigationManager.registerModal(id, title, onDismiss);
    return cleanup;
  }, [isOpen, id, title, onDismiss]);
}

/**
 * Hook to automatically register a Tier 2 nested sub-screen (e.g. Account passbook or Holding detail)
 */
export function useRegisterSubscreen(
  isActive: boolean,
  id: string,
  title: string,
  onDismiss: () => void,
  options?: {
    containerSelector?: string;
    parentScreenKey?: string;
    anchorSelector?: string;
  }
) {
  useEffect(() => {
    if (!isActive) return;
    const cleanup = navigationManager.registerSubscreen(id, title, onDismiss, options);
    return cleanup;
  }, [isActive, id, title, onDismiss, options?.containerSelector, options?.parentScreenKey, options?.anchorSelector]);
}
