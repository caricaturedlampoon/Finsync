/**
 * FinSync 3-Tier Hardware Back-Button & Dynamic Navigation Stack Manager
 * With Centralized Non-Destructive Scroll Position Preservation & Restoration Engine.
 * 
 * Strict 3-Tier Priority Sequence:
 * TIER 1: If any dropdown, date picker, bottom sheet, or modal is open, dismiss it first.
 * TIER 2: If the user is on a nested sub-screen (passbook, holding detail, group details, category drilldown, settings section), pop the sub-screen.
 * TIER 2 (Breadcrumbs): If on a non-root tab, pop the tab history back to the previous screen from which the user navigated.
 * TIER 3: If on the root view (home), implement the standard Android 2-second timeout pattern:
 *         - First press displays a non-blocking toast: "Press back again to exit FinSync"
 *         - Second press minimizes/exits the application.
 */

import { ActiveTab } from '../types';
import { capacitorLifecycle } from '../services/capacitorLifecycle';

export type NavigationScreen = ActiveTab | 'tools';

export interface OverlayEntry {
  id: string;
  name: string;
  dismiss: () => void;
  timestamp: number;
}

export interface SubscreenEntry {
  id: string;
  name: string;
  pop: () => void;
  scrollX: number;
  scrollY: number;
  containerSelector?: string;
  containerScrollTop?: number;
  parentScreenKey?: string;
  anchorSelector?: string;
  popped?: boolean;
  timestamp: number;
}

export interface ScreenHistoryEntry {
  screen: NavigationScreen;
  scrollX: number;
  scrollY: number;
}

export interface ScrollPosition {
  scrollX: number;
  scrollY: number;
  containers?: Record<string, number>;
  anchorSelector?: string;
}

class NavigationStackManager {
  // Tier 1: Overlays, dropdowns, pickers, bottom sheets, and modals
  private tier1Overlays: OverlayEntry[] = [];

  // Tier 2: Nested sub-screens
  private tier2Subscreens: SubscreenEntry[] = [];

  // Tier 2 (Breadcrumbs): Main tabs and screens history (including 'tools')
  private screenHistory: ScreenHistoryEntry[] = [
    { screen: 'home', scrollX: 0, scrollY: 0 },
  ];

  // Active Screen Tracking & Tab Scroll Memory
  private currentActiveScreen: NavigationScreen = 'home';
  private tabScrollPositions: Map<string, ScrollPosition> = new Map();
  private isRestoringScroll: boolean = false;
  private isTransitioning: boolean = false;

  private lastBackPressTime: number = 0;
  private onExitToast?: (message: string) => void;
  private onScreenChangeRequest?: (screen: NavigationScreen) => void;
  private listeners: Set<() => void> = new Set();
  private isPoppingScreen: boolean = false;
  private isHandlingPopState: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Initialize base window history state
      try {
        if (!window.history.state || !window.history.state._finsyncRoot) {
          window.history.replaceState({ _finsyncRoot: true }, '');
        }
      } catch (e) {
        // Fallback for sandboxed frames
      }

      window.addEventListener('popstate', this.handlePopState);

      // Passive scroll listener: continuously updates active screen scroll position
      window.addEventListener(
        'scroll',
        () => {
          if (this.isRestoringScroll || this.isTransitioning) return;
          const top =
            window.scrollY ||
            document.documentElement.scrollTop ||
            document.body.scrollTop ||
            0;
          const left =
            window.scrollX ||
            document.documentElement.scrollLeft ||
            document.body.scrollLeft ||
            0;

          const existing = this.tabScrollPositions.get(this.currentActiveScreen);

          // Prevent false reset to 0 when document shrinks/collapses during layout changes
          if (top === 0 && existing && existing.scrollY > 10) {
            const docHeight = Math.max(
              document.documentElement.scrollHeight,
              document.body.scrollHeight
            );
            if (docHeight <= window.innerHeight + 100) {
              return; // Container is currently collapsed/hidden, do not wipe saved scroll
            }
          }

          this.tabScrollPositions.set(this.currentActiveScreen, {
            scrollX: left,
            scrollY: top,
            containers: existing?.containers,
            anchorSelector: existing?.anchorSelector,
          });
        },
        { passive: true }
      );

      // Initialize Capacitor native lifecycle and hardware back button
      capacitorLifecycle.init({
        onHardwareBack: () => this.handleHardwareBack(),
      });
    }
  }

  public setExitToastHandler(handler: (msg: string) => void) {
    this.onExitToast = handler;
  }

  public setScreenChangeHandler(handler: (screen: NavigationScreen) => void) {
    this.onScreenChangeRequest = handler;
  }

  public setTabChangeHandler(handler: (tab: ActiveTab) => void) {
    this.onScreenChangeRequest = (screen) => {
      if (screen !== 'tools') {
        handler(screen);
      }
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  /**
   * Synchronize browser history with the current navigation stack capability.
   * Ensures that a browser back button / swipe back gesture will trigger popstate,
   * without creating orphaned zombie states.
   */
  private syncHistoryState() {
    if (typeof window === 'undefined') return;
    try {
      if (this.canGoBack()) {
        if (!window.history.state || !window.history.state._canGoBack) {
          window.history.pushState({ _canGoBack: true }, '');
        }
      } else {
        if (window.history.state && window.history.state._canGoBack) {
          window.history.replaceState({ _finsyncRoot: true }, '');
        }
      }
    } catch (e) {
      // Ignore sandboxed iframe errors
    }
  }

  // =========================================================================
  // SCROLL POSITION MANAGEMENT ENGINE
  // =========================================================================

  public setCurrentScreen(screen: NavigationScreen) {
    this.currentActiveScreen = screen;
  }

  public getCurrentActiveScreen(): NavigationScreen {
    return this.currentActiveScreen;
  }

  public startTransition(targetScreen?: NavigationScreen) {
    this.isTransitioning = true;
    if (this.currentActiveScreen) {
      this.saveTabScroll(this.currentActiveScreen);
    }
    if (targetScreen) {
      this.currentActiveScreen = targetScreen;
    }
  }

  public endTransition() {
    // Release transition lock on next animation frame
    requestAnimationFrame(() => {
      this.isTransitioning = false;
    });
  }

  /**
   * Captures and stores current scroll positions (window and optional container)
   */
  public saveTabScroll(tab: NavigationScreen, containerSelector?: string, anchorSelector?: string) {
    if (typeof window === 'undefined') return;
    const scrollY =
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
    const scrollX =
      window.scrollX ||
      document.documentElement.scrollLeft ||
      document.body.scrollLeft ||
      0;

    const existing = this.tabScrollPositions.get(tab);
    const containers = existing?.containers ? { ...existing.containers } : {};

    if (containerSelector) {
      const el = document.querySelector(containerSelector);
      if (el) {
        containers[containerSelector] = el.scrollTop;
      }
    }

    // Never overwrite an existing positive scroll with 0 if window is currently collapsed
    const finalScrollY = (scrollY === 0 && existing && existing.scrollY > 0)
      ? existing.scrollY
      : scrollY;

    this.tabScrollPositions.set(tab, {
      scrollX,
      scrollY: finalScrollY,
      containers,
      anchorSelector: anchorSelector || existing?.anchorSelector,
    });
  }

  public restoreTabScroll(tab: NavigationScreen, containerSelector?: string) {
    if (typeof window === 'undefined') return;
    const saved = this.tabScrollPositions.get(tab);
    const targetY = saved ? saved.scrollY : 0;
    const targetX = saved ? saved.scrollX : 0;
    const containerTop = containerSelector && saved?.containers ? saved.containers[containerSelector] : undefined;

    this.restoreScroll(targetY, targetX, containerSelector, containerTop, saved?.anchorSelector);
  }

  public restoreScroll(
    targetY: number,
    targetX: number = 0,
    containerSelector?: string,
    containerScrollTop?: number,
    anchorSelector?: string,
    onComplete?: () => void
  ) {
    if (typeof window === 'undefined') {
      if (onComplete) onComplete();
      return;
    }

    this.isRestoringScroll = true;

    const applyScroll = () => {
      window.scrollTo({
        top: targetY,
        left: targetX,
        behavior: 'instant' as ScrollBehavior,
      });
      document.documentElement.scrollTop = targetY;
      document.body.scrollTop = targetY;

      if (containerSelector && containerScrollTop !== undefined) {
        const el = document.querySelector(containerSelector);
        if (el) {
          el.scrollTop = containerScrollTop;
        }
      }

      if (anchorSelector) {
        const anchor = document.querySelector(anchorSelector);
        if (anchor) {
          const rect = anchor.getBoundingClientRect();
          if (rect.bottom < 0 || rect.top > window.innerHeight) {
            anchor.scrollIntoView({ block: 'nearest', behavior: 'instant' });
          }
        }
      }
    };

    applyScroll();

    requestAnimationFrame(() => {
      applyScroll();
      requestAnimationFrame(() => {
        const currentY =
          window.scrollY ||
          document.documentElement.scrollTop ||
          document.body.scrollTop ||
          0;
        if (Math.abs(currentY - targetY) > 4) {
          applyScroll();
        }
        this.isRestoringScroll = false;
        if (onComplete) {
          onComplete();
        }
      });
    });
  }

  // =========================================================================
  // TIER 1: OVERLAYS, DROPDOWNS, PICKERS, BOTTOM SHEETS & MODALS
  // =========================================================================
  public registerOverlay(id: string, name: string, dismiss: () => void): () => void {
    const entry: OverlayEntry = {
      id,
      name,
      dismiss,
      timestamp: Date.now(),
    };

    this.tier1Overlays.push(entry);

    this.syncHistoryState();
    this.notify();

    return () => {
      const idx = this.tier1Overlays.findIndex((o) => o.id === id);
      if (idx !== -1) {
        this.tier1Overlays.splice(idx, 1);
        if (this.tier1Overlays.length === 0 && this.tier2Subscreens.length === 0) {
          if (typeof document !== 'undefined') {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.body.style.position = '';
          }
        }
        this.syncHistoryState();
        this.notify();
      }
    };
  }

  // Backward compatibility alias for modals
  public registerModal(id: string, name: string, dismiss: () => void): () => void {
    return this.registerOverlay(`modal_${id}`, name, dismiss);
  }

  // =========================================================================
  // TIER 2: NESTED SUB-SCREENS (Passbook, Holding Detail, Group Details, etc.)
  // =========================================================================
  public registerSubscreen(
    id: string,
    name: string,
    pop: () => void,
    options?: {
      containerSelector?: string;
      parentScreenKey?: string;
      anchorSelector?: string;
    }
  ): () => void {
    const parentKey = options?.parentScreenKey || this.currentActiveScreen;

    // Check if subscreen is already registered
    const existingIdx = this.tier2Subscreens.findIndex((s) => s.id === id);
    if (existingIdx !== -1) {
      this.tier2Subscreens[existingIdx].pop = pop;
      if (options?.anchorSelector) {
        this.tier2Subscreens[existingIdx].anchorSelector = options.anchorSelector;
      }
      return () => {
        this.cleanupSubscreen(id);
      };
    }

    // Capture current scroll positions before entering sub-screen
    const currentWinY =
      typeof window !== 'undefined'
        ? window.scrollY ||
          document.documentElement.scrollTop ||
          document.body.scrollTop ||
          0
        : 0;
    const currentWinX =
      typeof window !== 'undefined'
        ? window.scrollX ||
          document.documentElement.scrollLeft ||
          document.body.scrollLeft ||
          0
        : 0;

    // Fall back to stored tab scroll if window scroll was already collapsed
    const storedTabScroll = this.tabScrollPositions.get(parentKey);
    const scrollY = currentWinY > 0 ? currentWinY : storedTabScroll?.scrollY || 0;
    const scrollX = currentWinX > 0 ? currentWinX : storedTabScroll?.scrollX || 0;

    let containerScrollTop: number | undefined;
    const activeSelector = options?.containerSelector;
    if (activeSelector && typeof document !== 'undefined') {
      const el = document.querySelector(activeSelector);
      if (el) {
        containerScrollTop = el.scrollTop;
      }
    }

    const entry: SubscreenEntry = {
      id,
      name,
      pop,
      scrollX,
      scrollY,
      containerSelector: activeSelector,
      containerScrollTop,
      parentScreenKey: parentKey,
      anchorSelector: options?.anchorSelector,
      popped: false,
      timestamp: Date.now(),
    };

    this.tier2Subscreens.push(entry);

    // Forward Navigation Rule: New subscreen always leads to the top of the scroll (0, 0)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    }

    this.syncHistoryState();
    this.notify();

    return () => {
      this.cleanupSubscreen(id);
    };
  }

  private cleanupSubscreen(id: string) {
    const idx = this.tier2Subscreens.findIndex((s) => s.id === id);
    if (idx !== -1) {
      const entry = this.tier2Subscreens.splice(idx, 1)[0];
      if (this.tier1Overlays.length === 0 && this.tier2Subscreens.length === 0) {
        if (typeof document !== 'undefined') {
          document.body.style.overflow = '';
          document.body.style.touchAction = '';
          document.body.style.position = '';
        }
      }
      // If the subscreen was closed from within the UI (not via handleHardwareBack),
      // seamlessly restore the parent screen's scroll position!
      if (!entry.popped) {
        entry.popped = true;
        this.restoreScroll(
          entry.scrollY,
          entry.scrollX,
          entry.containerSelector,
          entry.containerScrollTop,
          entry.anchorSelector
        );
      }
      this.syncHistoryState();
      this.notify();
    }
  }

  // =========================================================================
  // TIER 2: SCREEN / TAB NAVIGATION BREADCRUMBS (INCLUDING TOOLS AS A SCREEN)
  // =========================================================================
  public pushScreen(screen: NavigationScreen): void {
    if (this.isPoppingScreen) {
      return;
    }

    const current = this.screenHistory[this.screenHistory.length - 1];
    if (current && current.screen === screen) {
      return;
    }

    // Save scroll position of previous screen
    if (current && typeof window !== 'undefined') {
      this.saveTabScroll(current.screen);
      const saved = this.tabScrollPositions.get(current.screen);
      if (saved) {
        current.scrollX = saved.scrollX;
        current.scrollY = saved.scrollY;
      }
    }

    this.currentActiveScreen = screen;

    // If user explicitly navigated to home, reset the history stack to root
    if (screen === 'home') {
      this.screenHistory = [{ screen: 'home', scrollX: 0, scrollY: 0 }];
      this.syncHistoryState();
      this.notify();
      return;
    }

    this.screenHistory.push({ screen, scrollX: 0, scrollY: 0 });

    // Forward Navigation Rule: New screen/tab always leads to top of scroll (0, 0)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }

    this.syncHistoryState();
    this.notify();
  }

  public pushTab(tab: ActiveTab): void {
    this.pushScreen(tab);
  }

  public getCurrentScreen(): NavigationScreen {
    return this.screenHistory[this.screenHistory.length - 1]?.screen || 'home';
  }

  public getScreenHistory(): NavigationScreen[] {
    return this.screenHistory.map((s) => s.screen);
  }

  // =========================================================================
  // SMART 3-TIER HARDWARE & GESTURE BACK-BUTTON DISPATCHER
  // =========================================================================
  public handleHardwareBack(): boolean {
    // -----------------------------------------------------------------------
    // TIER 1 PRIORITY: Dismiss any open dropdown, date picker, bottom sheet, or modal
    // -----------------------------------------------------------------------
    if (this.tier1Overlays.length > 0) {
      const overlay = this.tier1Overlays.pop()!;
      try {
        overlay.dismiss();
      } catch (e) {
        console.error('[Nav-Tier1]: Error dismissing overlay', e);
      }
      this.syncHistoryState();
      this.notify();
      return true;
    }

    // -----------------------------------------------------------------------
    // TIER 2 PRIORITY: Pop nested sub-screen & restore previous scroll position
    // -----------------------------------------------------------------------
    if (this.tier2Subscreens.length > 0) {
      const subscreen = this.tier2Subscreens.pop()!;
      subscreen.popped = true;
      try {
        subscreen.pop();
      } catch (e) {
        console.error('[Nav-Tier2]: Error popping subscreen', e);
      }

      // Accurately restore previous list scroll position immediately
      this.restoreScroll(
        subscreen.scrollY,
        subscreen.scrollX,
        subscreen.containerSelector,
        subscreen.containerScrollTop,
        subscreen.anchorSelector
      );

      this.syncHistoryState();
      this.notify();
      return true;
    }

    // -----------------------------------------------------------------------
    // TIER 2 (Breadcrumbs): Pop screen history back to previous screen
    // -----------------------------------------------------------------------
    if (this.screenHistory.length > 1) {
      this.screenHistory.pop();
      const prev = this.screenHistory[this.screenHistory.length - 1];

      this.isPoppingScreen = true;
      this.currentActiveScreen = prev.screen;
      if (this.onScreenChangeRequest) {
        this.onScreenChangeRequest(prev.screen);
      }

      requestAnimationFrame(() => {
        this.restoreTabScroll(prev.screen);
        this.isPoppingScreen = false;
      });

      this.syncHistoryState();
      this.notify();
      return true;
    }

    // -----------------------------------------------------------------------
    // TIER 3 PRIORITY: Root view 2-second exit confirmation pattern
    // -----------------------------------------------------------------------
    const now = Date.now();
    const elapsed = now - this.lastBackPressTime;

    if (elapsed < 2000) {
      capacitorLifecycle.exitApp();
      return false;
    } else {
      this.lastBackPressTime = now;
      if (this.onExitToast) {
        this.onExitToast('Press back again to exit FinSync');
      }
      return true;
    }
  }

  /**
   * UI Back Button action (invoked by header arrow buttons and custom onBack triggers)
   */
  public goBack(): void {
    this.handleHardwareBack();
  }

  public canGoBack(): boolean {
    return (
      this.tier1Overlays.length > 0 ||
      this.tier2Subscreens.length > 0 ||
      this.screenHistory.length > 1
    );
  }

  public getActiveSubscreensCount(): number {
    return this.tier2Subscreens.length;
  }

  public getActiveOverlaysCount(): number {
    return this.tier1Overlays.length;
  }

  private handlePopState = (event: PopStateEvent) => {
    if (this.isHandlingPopState) return;
    this.isHandlingPopState = true;
    try {
      this.handleHardwareBack();
      // If there are still items to pop, ensure the state can catch the next browser back press
      if (this.canGoBack() && typeof window !== 'undefined') {
        window.history.pushState({ _canGoBack: true }, '');
      }
    } finally {
      this.isHandlingPopState = false;
    }
  };
}

export const navigationManager = new NavigationStackManager();
