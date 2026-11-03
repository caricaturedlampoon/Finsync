/**
 * Capacitor Mobile Lifecycle, Splash Screen & Status Bar Controller
 * Seamlessly integrates with native Android Capacitor APIs with graceful Web / PWA fallbacks.
 */

import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

class CapacitorLifecycleController {
  private isInitialized = false;
  private onAppPauseCallback?: () => void;
  private onHardwareBackCallback?: () => void;

  public setOnAppPause(callback: () => void) {
    this.onAppPauseCallback = callback;
  }

  public setOnHardwareBack(callback: () => void) {
    this.onHardwareBackCallback = callback;
  }

  public init(params: {
    onAppPause?: () => void;
    onHardwareBack?: () => void;
  }) {
    if (this.isInitialized || typeof window === 'undefined') {
      if (params.onAppPause) this.onAppPauseCallback = params.onAppPause;
      if (params.onHardwareBack) this.onHardwareBackCallback = params.onHardwareBack;
      return;
    }
    this.isInitialized = true;
    this.onAppPauseCallback = params.onAppPause;
    this.onHardwareBackCallback = params.onHardwareBack;

    try {
      // 1. Listen for Android App State Changes (App minimized, screen locked, phone call)
      App.addListener('appStateChange', (state) => {
        console.log(`[FinSync:Capacitor]: App state changed -> isActive: ${state.isActive}`);
        if (!state.isActive) {
          // Immediately flush state to prevent data loss on Android task termination
          if (this.onAppPauseCallback) {
            this.onAppPauseCallback();
          }
        }
      });

      // 2. Intercept Native Android Hardware Back Button via Capacitor App Plugin
      App.addListener('backButton', () => {
        console.log('[FinSync:Capacitor]: Hardware back button event received from native container');
        if (this.onHardwareBackCallback) {
          this.onHardwareBackCallback();
        }
      });
    } catch (err) {
      console.log('[FinSync:Capacitor]: Running in Web/PWA mode', err);
    }

    // Set 3s fallback timeout for splash screen hiding in case of slow hydration
    setTimeout(() => {
      this.hideSplashScreen();
    }, 3000);
  }

  /**
   * Programmatically hides the native Android splash screen once database hydration is complete.
   */
  public async hideSplashScreen(): Promise<void> {
    try {
      await SplashScreen.hide({
        fadeOutDuration: 300,
      });
      console.log('[FinSync:Capacitor]: Splash screen dismissed smoothly.');
    } catch {
      // Running in browser, no-op
    }
  }

  /**
   * Updates status bar icon brightness & background color to match active theme.
   */
  public async setStatusBarTheme(isDark: boolean): Promise<void> {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      await StatusBar.show().catch(() => {});
      if (isDark) {
        // Dark theme: Light icons on dark slate background
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#090d16' });
      } else {
        // Light theme: Dark icons on light paper background
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#f8fafc' });
      }
      console.log(`[FinSync:Capacitor]: Fullscreen enabled for ${isDark ? 'Dark' : 'Light'} theme.`);
    } catch {

      // Running in browser, update document theme-color meta tag instead
      if (typeof document !== 'undefined') {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
          meta.setAttribute('content', isDark ? '#090d16' : '#f8fafc');
        }
      }
    }
  }

  /**
   * Minimizes or exits the native application
   */
  public async exitApp(): Promise<void> {
    try {
      await App.exitApp();
    } catch {
      // In browser, cannot programmatically close tab
    }
  }
}

export const capacitorLifecycle = new CapacitorLifecycleController();
