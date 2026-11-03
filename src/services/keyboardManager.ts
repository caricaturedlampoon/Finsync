import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

type KeyboardListener = (isOpen: boolean, keyboardHeight: number) => void;

class KeyboardManager {
  private isKeyboardOpen: boolean = false;
  private currentKeyboardHeight: number = 0;
  private listeners: Set<KeyboardListener> = new Set();
  private isInitialized: boolean = false;

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 1. Capacitor Native Keyboard Plugin listeners (if running on Android/iOS native)
    if (Capacitor.isNativePlatform()) {
      try {
        Keyboard.addListener('keyboardWillShow', (info) => {
          this.setKeyboardState(true, info.keyboardHeight || 0);
        });

        Keyboard.addListener('keyboardDidShow', (info) => {
          this.setKeyboardState(true, info.keyboardHeight || 0);
          this.scrollActiveElementIntoView();
        });

        Keyboard.addListener('keyboardWillHide', () => {
          this.setKeyboardState(false, 0);
        });

        Keyboard.addListener('keyboardDidHide', () => {
          this.setKeyboardState(false, 0);
        });
      } catch (err) {
        console.warn('[KeyboardManager]: Capacitor Keyboard listeners not available, using fallback', err);
      }
    }

    // 2. Visual Viewport API fallback (standard on Android Chrome WebViews and PWAs)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const viewport = window.visualViewport;
        if (!viewport) return;
        const heightDiff = window.innerHeight - viewport.height;
        // Software keyboard usually takes at least 150px
        const isOpen = heightDiff > 140;
        this.setKeyboardState(isOpen, isOpen ? heightDiff : 0);
        if (isOpen) {
          this.scrollActiveElementIntoView();
        }
      });
    }

    // 3. Input focus / blur listeners to catch rapid transitions
    window.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox')
      ) {
        const type = (target as HTMLInputElement).type;
        if (type !== 'checkbox' && type !== 'radio' && type !== 'button' && type !== 'submit') {
          this.setKeyboardState(true, this.currentKeyboardHeight || 280);
          setTimeout(() => {
            this.scrollActiveElementIntoView();
          }, 120);
        }
      }
    });

    window.addEventListener('focusout', () => {
      setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        const isStillInput =
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.isContentEditable ||
            active.getAttribute('role') === 'textbox');
        if (!isStillInput) {
          this.setKeyboardState(false, 0);
        }
      }, 100);
    });
  }

  private setKeyboardState(isOpen: boolean, height: number) {
    if (this.isKeyboardOpen === isOpen && this.currentKeyboardHeight === height) return;
    this.isKeyboardOpen = isOpen;
    this.currentKeyboardHeight = height;

    const root = document.documentElement;
    const body = document.body;

    if (isOpen) {
      root.classList.add('keyboard-open');
      body.classList.add('keyboard-open');
      root.style.setProperty('--keyboard-height', `${height}px`);
    } else {
      root.classList.remove('keyboard-open');
      body.classList.remove('keyboard-open');
      root.style.setProperty('--keyboard-height', '0px');
    }

    this.listeners.forEach((listener) => listener(isOpen, height));
  }

  public scrollActiveElementIntoView() {
    try {
      const active = document.activeElement as HTMLElement | null;
      if (active && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
    } catch {
      // Ignore if element cannot be scrolled
    }
  }

  public subscribe(listener: KeyboardListener): () => void {
    this.listeners.add(listener);
    // Emit current state immediately
    listener(this.isKeyboardOpen, this.currentKeyboardHeight);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public get isOpen(): boolean {
    return this.isKeyboardOpen;
  }

  public get keyboardHeight(): number {
    return this.currentKeyboardHeight;
  }
}

export const keyboardManager = new KeyboardManager();
