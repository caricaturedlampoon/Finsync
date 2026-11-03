/**
 * Cross-Platform File Abstraction & Native Storage / Share Service
 * Full native Android file system support via @capacitor/filesystem and @capacitor/share,
 * with seamless Web / PWA fallback (Blob download and window saving).
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { dispatchLocalNotification } from './offlineNotificationEngine';

export interface FileOpenerPluginInterface {
  openFile(options: { filePath?: string; fileUri?: string; mimeType?: string }): Promise<{ success: boolean; opened: boolean }>;
}

export const NativeFileOpener = registerPlugin<FileOpenerPluginInterface>('FileOpener');

export interface ExportFileParams {
  filename: string;
  content: string | Blob;
  mimeType: string;
  title?: string;
  dialogTitle?: string;
}

export interface PickFileOptions {
  accept?: string;
}

class FileService {
  /**
   * Check if native or web sharing is supported on this device
   */
  public async canShare(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const shareResult = await Share.canShare();
        return Boolean(shareResult.value);
      }
    } catch {
      // Fallback check
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      return true;
    }
    return false;
  }

  /**
   * Converts a Blob or string into base64 format for Filesystem storage & native sharing
   */
  public async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:mime;base64, prefix if present
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Export content as a file:
   * 1. On Android/Capacitor: Writes directly to local Documents storage via @capacitor/filesystem,
   *    and triggers ONLY an app notification of download successful (no in-app toast, no pop-up share sheet).
   *    On clicking that notification, the user can view the file.
   * 2. On Web/Browser: Triggers standard file download and dispatches system notification.
   */
  public async exportAndShare(params: ExportFileParams): Promise<{ success: boolean; uri?: string; shared: boolean }> {
    const {
      filename,
      content,
      mimeType,
      title = 'FinSync Export',
      dialogTitle = 'Share Financial Document',
    } = params;

    const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;

    // A. NATIVE CAPACITOR (ANDROID / IOS) FLOW
    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = await this.blobToBase64(blob);

        // 1. Write file to device Documents directory for permanent local storage
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });

        console.log(`[FileService]: Saved file to Android Documents: ${writeResult.uri}`);

        // 2. Also save to Cache for safe Content Provider access when viewing
        let shareUri = writeResult.uri;
        try {
          const cacheResult = await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.Cache,
            recursive: true,
          });
          shareUri = cacheResult.uri;
        } catch (cacheErr) {
          console.warn('[FileService]: Cache write fallback', cacheErr);
        }

        // 3. Dispatch system app notification (no instant share sheet popup, no in-app toast)
        // When the user taps the notification, the file will be opened for viewing immediately with default viewer.
        try {
          await dispatchLocalNotification({
            title: 'Download Successful 📄',
            message: `${filename} has been saved. Tap to view report.`,
            type: 'report_downloaded',
            actionType: 'view_report',
            extra: {
              fileUri: shareUri,
              filename,
              mimeType,
            },
          });
        } catch (notifErr) {
          console.warn('[FileService]: Download notification dispatch error', notifErr);
        }

        return { success: true, uri: writeResult.uri, shared: false };
      } catch (nativeErr) {
        console.error('[FileService]: Native Filesystem write error, falling back to downloadBlob', nativeErr);
        this.downloadBlob(blob, filename);
        return { success: true, shared: false };
      }
    }

    // B. WEB / BROWSER / PWA FLOW
    try {
      this.downloadBlob(blob, filename);
      const blobUrl = URL.createObjectURL(blob);
      try {
        await dispatchLocalNotification({
          title: 'Download Successful 📄',
          message: `${filename} downloaded. Tap to view report.`,
          type: 'report_downloaded',
          actionType: 'view_report',
          extra: {
            blobUrl,
            filename,
            mimeType,
          },
        });
      } catch {}
    } catch (dlErr) {
      console.warn('[FileService]: downloadBlob failed', dlErr);
    }

    return { success: true, shared: false };
  }

  /**
   * Open or view a file when the user taps the download successful notification
   * Handled natively via FileOpenerPlugin with Android Intent.ACTION_VIEW and FileProvider URI mapping,
   * completely bypassing the system share sheet.
   */
  public async openOrViewFile(fileUri?: string, filename?: string, mimeType?: string, blobUrl?: string): Promise<void> {
    const effectiveMimeType = mimeType || (filename?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/pdf');

    if (Capacitor.isNativePlatform() && fileUri) {
      try {
        await NativeFileOpener.openFile({
          fileUri,
          filePath: fileUri,
          mimeType: effectiveMimeType,
        });
        return;
      } catch (nativeOpenerErr) {
        console.warn('[FileService]: Native FileOpener intent failed, fallback to share sheet:', nativeOpenerErr);
        try {
          await Share.share({
            title: filename || 'View Report',
            text: `Viewing ${filename || 'Report'}`,
            url: fileUri,
            dialogTitle: `View ${filename || 'Report'}`,
          });
        } catch (shareErr: any) {
          if (shareErr?.name !== 'AbortError' && !shareErr?.message?.includes('canceled')) {
            console.warn('[FileService]: Error opening file via fallback share sheet', shareErr);
          }
        }
        return;
      }
    }

    if (typeof window !== 'undefined') {
      if (blobUrl) {
        window.open(blobUrl, '_blank');
      } else if (fileUri) {
        window.open(fileUri, '_blank');
      }
    }
  }

  /**
   * Direct download fallback via an anchor tag with Blob URL
   */
  public downloadBlob(blob: Blob, filename: string): void {
    if (typeof window === 'undefined') return;

    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 1000);

      console.log(`[FileService]: Triggered direct file download for "${filename}"`);
    } catch (e) {
      console.error('[FileService]: downloadBlob encountered error', e);
    }
  }

  /**
   * Pick and read a file as text with user file-picker prompt
   */
  public async pickAndReadTextFile(options: PickFileOptions = {}): Promise<{ filename: string; content: string } | null> {
    if (typeof document === 'undefined') return null;

    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.accept || '*/*';
      input.style.display = 'none';

      input.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        try {
          const content = await file.text();
          resolve({ filename: file.name, content });
        } catch (err) {
          reject(err);
        } finally {
          if (document.body.contains(input)) {
            document.body.removeChild(input);
          }
        }
      };

      input.oncancel = () => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
        resolve(null);
      };

      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Non-blocking JSON stringification to prevent Android ANR
   */
  public asyncStringify(data: any, space?: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          try {
            resolve(JSON.stringify(data, null, space));
          } catch (e) {
            reject(e);
          }
        });
      } else {
        setTimeout(() => {
          try {
            resolve(JSON.stringify(data, null, space));
          } catch (e) {
            reject(e);
          }
        }, 0);
      }
    });
  }

  /**
   * Non-blocking JSON parsing to prevent UI thread freezing during backup restorations
   */
  public asyncParse<T = any>(jsonString: string): Promise<T> {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          try {
            resolve(JSON.parse(jsonString));
          } catch (e) {
            reject(e);
          }
        });
      } else {
        setTimeout(() => {
          try {
            resolve(JSON.parse(jsonString));
          } catch (e) {
            reject(e);
          }
        }, 0);
      }
    });
  }
}

export const fileService = new FileService();
