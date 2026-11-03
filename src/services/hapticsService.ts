/**
 * Native Haptic Feedback Service
 * Uses @capacitor/haptics with seamless navigator.vibrate fallback for Web/PWA
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

class HapticsService {
  private isAvailable: boolean | null = null;

  private async checkAvailability(): Promise<boolean> {
    if (this.isAvailable !== null) return this.isAvailable;
    try {
      // Test if Capacitor Haptics is running natively
      await Haptics.selectionStart();
      await Haptics.selectionEnd();
      this.isAvailable = true;
    } catch {
      this.isAvailable = false;
    }
    return this.isAvailable;
  }

  /**
   * Light impact for standard button presses, chip selections, and tabs
   */
  public async impactLight(): Promise<void> {
    try {
      const native = await this.checkAvailability();
      if (native) {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {
      // Non-critical, ignore
    }
  }

  /**
   * Medium impact for transaction saving, payments, or trade executions
   */
  public async impactMedium(): Promise<void> {
    try {
      const native = await this.checkAvailability();
      if (native) {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }
    } catch {
      // Non-critical, ignore
    }
  }

  /**
   * Success notification vibration (e.g. backup restored, transaction recorded)
   */
  public async notificationSuccess(): Promise<void> {
    try {
      const native = await this.checkAvailability();
      if (native) {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([15, 50, 20]);
      }
    } catch {
      // Non-critical, ignore
    }
  }

  /**
   * Warning notification vibration (e.g. deletion confirmation, credit limit warning)
   */
  public async notificationWarning(): Promise<void> {
    try {
      const native = await this.checkAvailability();
      if (native) {
        await Haptics.notification({ type: NotificationType.Warning });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 40, 30]);
      }
    } catch {
      // Non-critical, ignore
    }
  }
}

export const hapticsService = new HapticsService();
