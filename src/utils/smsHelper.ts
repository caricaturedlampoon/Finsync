/**
 * Native Direct Messaging & SMS Helper
 * 
 * Directly opens the mobile device's default SMS/Messages application (Google Messages,
 * Samsung Messages, Apple Messages) without triggering Android's system app chooser
 * or disambiguation dialog.
 * 
 * RFC 5724 compliant scheme:
 * - Android: sms:<phone>?body=<message>
 * - iOS: sms:<phone>&body=<message>
 */

/**
 * Cleans phone number string to only retain digits and optional leading '+'
 */
export function sanitizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/[^0-9]/g, '');
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Dispatches an OS intent directly to the native Messages app
 * without opening generic system app selectors.
 */
export function openDirectMessageApp(phone?: string | null, text: string = ''): boolean {
  try {
    const cleanedPhone = sanitizePhoneNumber(phone);
    const encodedBody = encodeURIComponent(text);
    const isIOS =
      typeof navigator !== 'undefined' &&
      /iPad|iPhone|iPod/.test(navigator.userAgent || '');

    let uri: string;
    if (isIOS) {
      uri = cleanedPhone
        ? `sms:${cleanedPhone}&body=${encodedBody}`
        : `sms:&body=${encodedBody}`;
    } else {
      // Standard Android RFC 5724 scheme - directly dispatched to Default SMS Provider
      uri = cleanedPhone
        ? `sms:${cleanedPhone}?body=${encodedBody}`
        : `sms:?body=${encodedBody}`;
    }

    // Trigger intent through a hidden DOM anchor tag to ensure native intent capture
    const anchor = document.createElement('a');
    anchor.href = uri;
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      if (document.body.contains(anchor)) {
        document.body.removeChild(anchor);
      }
    }, 500);

    return true;
  } catch (error) {
    console.error('Failed to open native message app', error);
    // Fallback to location assignment
    const fallbackPhone = sanitizePhoneNumber(phone);
    const fallbackBody = encodeURIComponent(text);
    window.location.href = fallbackPhone
      ? `sms:${fallbackPhone}?body=${fallbackBody}`
      : `sms:?body=${fallbackBody}`;
    return false;
  }
}
