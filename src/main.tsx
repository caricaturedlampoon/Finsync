import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { initNotificationEngine } from './services/offlineNotificationEngine';
import { keyboardManager } from './services/keyboardManager';

// Initialize native Android notification channels and alarm triggers
initNotificationEngine().catch(() => {});

// Initialize keyboard event manager to maximize phone viewing area when typing
keyboardManager.init();

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({ immediate: true });
  } catch {
    // Ignore in dev/unsupported environments
  }
}

if (typeof window !== 'undefined') {
  // Network connectivity status logging
  window.addEventListener('online', () => {
    console.log('[FinSync:Network]: Device connected to network. Online features active.');
  });
  window.addEventListener('offline', () => {
    console.log('[FinSync:Network]: Device offline. Operating in 100% offline local mode.');
  });
}

createRoot(document.getElementById('root')!).render(<App />);

