/**
 * Form Draft Auto-Saving Hook
 * Automatically caches active form inputs to persistent storage on every keystroke
 * so unsaved user entries survive unexpected background process kills or task terminations.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export function useFormDraft<T extends Record<string, any>>(
  draftKey: string,
  initialValues: T,
  debounceMs: number = 200
): [T, (updates: Partial<T> | ((prev: T) => T)) => void, () => void] {
  const storageKey = `finsync_draft_${draftKey}`;

  // 1. Initialize state from stored draft if available, else initialValues
  const [formData, setFormData] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValues;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log(`[FormDraft]: Restored draft for "${draftKey}"`);
        return { ...initialValues, ...parsed };
      }
    } catch (e) {
      console.warn(`[FormDraft]: Failed to load draft for "${draftKey}"`, e);
    }
    return initialValues;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2. Debounced save to storage
  const saveToStorage = useCallback(
    (data: T) => {
      if (typeof window === 'undefined') return;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(data));
        } catch {
          // Ignore quota error on drafts
        }
      }, debounceMs);
    },
    [storageKey, debounceMs]
  );

  // 3. Mutator function
  const updateFormData = useCallback(
    (updates: Partial<T> | ((prev: T) => T)) => {
      setFormData((prev) => {
        const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
        saveToStorage(next);
        return next;
      });
    },
    [saveToStorage]
  );

  // 4. Clear draft once transaction / entry is successfully submitted
  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      window.localStorage.removeItem(storageKey);
      console.log(`[FormDraft]: Cleared draft for "${draftKey}"`);
    } catch {
      // ignore
    }
  }, [storageKey, draftKey]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return [formData, updateFormData, clearDraft];
}
