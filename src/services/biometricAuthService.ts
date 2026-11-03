import { Capacitor, registerPlugin } from '@capacitor/core';

interface FinSyncBiometricPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  authenticate(options?: { title?: string; subtitle?: string }): Promise<{ success: boolean }>;
}

const FinSyncBiometric = registerPlugin<FinSyncBiometricPlugin>('FinSyncBiometric');

export interface BiometricStatus {
  supported: boolean;
  enrolled: boolean;
  enrolledAt?: string | null;
}

const CREDENTIAL_STORAGE_KEY = 'finsync_bio_credential_id';
const ENROLLED_AT_STORAGE_KEY = 'finsync_bio_enrolled_at';

/**
 * Check if the current device/browser supports hardware platform biometrics
 */
export async function isPlatformBiometricsAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // On native Android / Capacitor platform, query the native FinSyncBiometric plugin
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await FinSyncBiometric.isAvailable();
      return Boolean(res?.available);
    } catch (e) {
      console.warn('[Biometrics:Native] isAvailable error:', e);
      return false;
    }
  }

  // Pure Web / PWA fallback via WebAuthn platform authenticator
  if (!window.PublicKeyCredential) return false;
  if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) {
    console.warn('[Biometrics:WebAuthn] Error checking platform authenticator:', e);
    return false;
  }
}

/**
 * Check enrollment status of biometrics in FinSync
 */
export function getBiometricStatus(): BiometricStatus {
  if (typeof window === 'undefined') {
    return { supported: false, enrolled: false };
  }
  if (Capacitor.isNativePlatform()) {
    return {
      supported: true,
      enrolled: true,
      enrolledAt: localStorage.getItem(ENROLLED_AT_STORAGE_KEY) || new Date().toISOString(),
    };
  }
  const hasKey = Boolean(localStorage.getItem(CREDENTIAL_STORAGE_KEY));
  const enrolledAt = localStorage.getItem(ENROLLED_AT_STORAGE_KEY);
  const supported = Boolean(window.PublicKeyCredential);
  return {
    supported,
    enrolled: hasKey,
    enrolledAt,
  };
}

/**
 * Convert an ArrayBuffer / Uint8Array to a Base64 string for safe storage
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a Base64 string back to ArrayBuffer (BufferSource)
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

/**
 * Enroll this device's biometric sensor (fingerprint, face, or hardware key).
 * Triggers the native Android / OS Biometric enrollment prompt.
 */
export async function enrollDeviceBiometrics(
  userName = 'FinSync Vault'
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return {
      success: false,
      error: 'Biometric authentication is not supported on this device/browser.',
    };
  }

  const isAvailable = await isPlatformBiometricsAvailable();
  if (!isAvailable) {
    return {
      success: false,
      error: 'No hardware biometric sensor detected or enabled on this device.',
    };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'FinSync Vault',
        id: window.location.hostname || undefined,
      },
      user: {
        id: userId,
        name: 'vault_owner',
        displayName: userName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;

    if (!credential || !credential.rawId) {
      return {
        success: false,
        error: 'Biometric registration was incomplete or returned no credential.',
      };
    }

    const base64Id = bufferToBase64(credential.rawId);
    localStorage.setItem(CREDENTIAL_STORAGE_KEY, base64Id);
    localStorage.setItem(ENROLLED_AT_STORAGE_KEY, new Date().toISOString());

    return { success: true };
  } catch (err: any) {
    console.warn('[Biometrics] Enrollment exception:', err);
    if (err.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'Biometric registration was cancelled or timed out. Please try again.',
      };
    }
    return {
      success: false,
      error: err.message || 'Failed to register biometric credentials.',
    };
  }
}

/**
 * Authenticate using registered platform biometrics (fingerprint / face).
 * Strictly requires hardware verification success. Never returns true on cancel or error.
 */
export async function authenticateDeviceBiometrics(): Promise<{
  success: boolean;
  error?: string;
}> {
  // On native Android / Capacitor platforms, invoke the native FinSyncBiometric plugin directly
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await FinSyncBiometric.authenticate({
        title: 'FinSync Biometric Vault',
        subtitle: 'Authenticate using Fingerprint, Face, or Device PIN to continue',
      });
      if (res && res.success) {
        return { success: true };
      }
      return {
        success: false,
        error: 'Biometric verification was not completed.',
      };
    } catch (err: any) {
      console.warn('[Biometrics:Native] Authentication exception:', err);
      return {
        success: false,
        error: err?.message || 'Biometric verification failed. Please enter your PIN.',
      };
    }
  }

  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return {
      success: false,
      error: 'Biometric authentication is not supported in this environment.',
    };
  }

  const isAvailable = await isPlatformBiometricsAvailable();
  if (!isAvailable) {
    return {
      success: false,
      error: 'No biometric hardware sensor detected on this device. Please use your PIN.',
    };
  }

  const savedCredBase64 = localStorage.getItem(CREDENTIAL_STORAGE_KEY);

  // If not yet enrolled on this device, run enrollment now:
  if (!savedCredBase64) {
    const enrollResult = await enrollDeviceBiometrics();
    return enrollResult;
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credIdBuffer = base64ToArrayBuffer(savedCredBase64);

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [
        {
          type: 'public-key',
          id: credIdBuffer,
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null;

    if (assertion && assertion.id) {
      return { success: true };
    }

    return {
      success: false,
      error: 'Biometric verification failed. Please enter your PIN.',
    };
  } catch (err: any) {
    console.warn('[Biometrics] Authentication error:', err);
    if (err.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'Biometric verification was cancelled. Please enter your PIN.',
      };
    }
    // If the device fingerprint changed or credential was revoked:
    if (err.name === 'InvalidStateError' || err.message?.includes('not allowed')) {
      localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
      return {
        success: false,
        error: 'Biometrics need to be re-registered. Please unlock using your PIN.',
      };
    }
    return {
      success: false,
      error: err.message || 'Biometric authentication failed. Please use your PIN.',
    };
  }
}

/**
 * Clear stored biometric enrollment from localStorage
 */
export function clearDeviceBiometrics(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
  localStorage.removeItem(ENROLLED_AT_STORAGE_KEY);
}
