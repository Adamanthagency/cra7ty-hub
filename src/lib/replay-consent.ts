/**
 * Replay consent, kept in one place.
 *
 * A visitor is `unknown` until they press a button. Only an affirmative
 * `granted` starts replay; `denied` is honoured for the whole tab and across
 * reloads. Nothing here defaults to granted — an unreadable or empty store is
 * simply `unknown`, which the controller treats as "do not record".
 */

export type ReplayConsent = 'unknown' | 'granted' | 'denied';

const STORAGE_KEY = 'cra7ty:replay-consent';
const EVENT = 'cra7ty:replay-consent';

/** Used when localStorage is unavailable; still only set by an explicit choice. */
let memoryDecision: ReplayConsent = 'unknown';

function isDecision(value: unknown): value is Exclude<ReplayConsent, 'unknown'> {
  return value === 'granted' || value === 'denied';
}

export function readReplayConsent(): ReplayConsent {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isDecision(stored)) return stored;
  } catch {
    // Storage blocked: fall back to this tab's explicit choice, never to consent.
  }
  return memoryDecision;
}

export function writeReplayConsent(decision: Exclude<ReplayConsent, 'unknown'>): void {
  memoryDecision = decision;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, decision);
  } catch {
    // Keep the in-memory decision and the listeners below working anyway.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function clearReplayConsent(): void {
  memoryDecision = 'unknown';
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Fires for this tab (custom event) and for other tabs (storage event). */
export function subscribeReplayConsent(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

/** The shape the replay controller expects, so it never reads storage itself. */
export const replayConsentSource = {
  get: readReplayConsent,
  subscribe: subscribeReplayConsent,
};
