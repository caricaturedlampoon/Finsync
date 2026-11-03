import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * Standard browser request headers to bypass anti-bot and 403 Forbidden / 401 Unauthorized blocks
 * (e.g., on Yahoo Finance and financial market feeds).
 */
export const YAHOO_FINANCE_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

export const AMFI_HTTPS_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  responseType?: 'json' | 'text';
}

export interface HttpResponseResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  text?: string;
  error?: string;
}

/**
 * Unified network request executor:
 * - On Native Android (Capacitor/Android Studio), executes via native Java/OkHttp via CapacitorHttp.
 *   This completely bypasses WebView CORS restrictions and allows setting arbitrary headers
 *   including 'User-Agent' without browser security exceptions.
 * - On Web browser / dev server, gracefully executes via standard fetch with timeout and proxy fallbacks.
 */
export async function executeHttpGet<T = any>(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpResponseResult<T>> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const mergedHeaders: Record<string, string> = {
    ...options.headers,
  };

  // 1. Native Android / Capacitor execution
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.get({
        url,
        headers: mergedHeaders,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
        responseType: options.responseType ?? 'json',
      });

      const ok = res.status >= 200 && res.status < 300;
      let parsedData: T | null = null;
      let rawText: string | undefined = undefined;

      if (typeof res.data === 'string') {
        rawText = res.data;
        if (options.responseType === 'text') {
          parsedData = res.data as unknown as T;
        } else {
          try {
            parsedData = JSON.parse(res.data) as T;
          } catch {
            parsedData = null;
          }
        }
      } else if (res.data !== undefined && res.data !== null) {
        parsedData = res.data as T;
      }

      return {
        ok,
        status: res.status,
        data: parsedData,
        text: rawText,
      };
    } catch (nativeErr: any) {
      console.warn(`[CapacitorHttp] Native request failed for ${url}:`, nativeErr?.message || nativeErr);
      // Fall through to web fetch fallback just in case
    }
  }

  // 2. Web / Browser fallback execution
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Filter out forbidden headers in standard browser fetch to avoid browser warnings
    const browserHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(mergedHeaders)) {
      const lower = k.toLowerCase();
      // Browsers disallow setting user-agent and host directly in fetch
      if (lower !== 'user-agent' && lower !== 'host') {
        browserHeaders[k] = v;
      }
    }

    const res = await fetch(url, {
      signal: controller.signal,
      headers: browserHeaders,
    });
    clearTimeout(timer);

    const ok = res.ok;
    let parsedData: T | null = null;
    let rawText: string | undefined = undefined;

    if (options.responseType === 'text') {
      rawText = await res.text();
      parsedData = rawText as unknown as T;
    } else {
      const text = await res.text();
      rawText = text;
      try {
        parsedData = JSON.parse(text) as T;
      } catch {
        parsedData = null;
      }
    }

    return {
      ok,
      status: res.status,
      data: parsedData,
      text: rawText,
    };
  } catch (webErr: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: webErr?.message || 'Network request failed',
    };
  }
}
