/**
 * The admin ⇄ storefront edit bridge — the PROTOCOL half.
 *
 * Loaded ONLY through the cheap gate in EditBridgeGate: framed by the admin
 * AND `?cra7ty-edit=1`. A normal visitor never fetches this chunk. The
 * shared store it writes into (`@/lib/edit/edit-state`) is a tiny inert
 * module that edit-mode components import statically.
 *
 * Protocol (mirrors the admin's src/lib/visual-bridge.ts — that file is the
 * contract; this is the other endpoint):
 *   storefront → admin:  ready { page, keys[], sections[] }
 *                        select-field { key, rect }
 *                        select-section { page, sectionKey }
 *   admin → storefront:  init { page, values, lists, sections }
 *                        set-field { key, value }
 *                        set-list { key, items }
 *                        set-sections { page, order[], hidden[], variants }
 *                        highlight { key } | clear {}
 *   every message:       { source: 'cra7ty', type, payload }
 *
 * Security contract (enforced here, not by callers):
 * - inbound: `event.origin` must exactly match one of the origins parsed
 *   from NEXT_PUBLIC_ADMIN_ORIGIN (comma-separated list; unset = reject
 *   all) AND `event.source` must be window.parent, on EVERY event;
 *   envelope and per-type payload schema are validated next; unknown type
 *   → return silently. Values are plain text within the caps below and
 *   are never HTML-handled (callers render text only).
 * - set-field / set-list for keys this page does not expose are ignored.
 * - outbound: posted with an exact allowed origin as targetOrigin — the
 *   last validated inbound origin, else the readable parent origin when
 *   allowlisted, else one post per allowlisted origin (each exact; the
 *   browser drops the ones that do not match). Never '*'.
 *
 * Storefront caps (the brief): values ≤ 2000 characters, lists ≤ 200
 * items. Anything over is rejected as invalid — the admin's send-side
 * validator is deliberately looser, so real content (longest field is
 * 600 chars) never trips it.
 */

import {
  applyFullOverrides,
  applyHighlight,
  currentPageKey,
  isEditKey,
  isFieldRegistered,
  isListRegistered,
  sendReady,
  setFieldOverride,
  setListOverride,
  setOutboundSender,
  setSectionsState,
  type EditListItem,
  type SectionsState,
} from './edit/edit-state';

const CRA7TY_SOURCE = 'cra7ty';

/* ------------------------------------------------------------------ */
/* Caps + validation primitives (plain text only)                      */
/* ------------------------------------------------------------------ */

const MAX_VALUE_LENGTH = 2000;
const MAX_LIST_ITEMS = 200;
const MAX_SECTIONS = 100;
const MAX_VARIANT_LENGTH = 400;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Plain text within the cap, or a finite number. Never HTML-handled. */
function isValue(value: unknown): value is string | number {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.length <= MAX_VALUE_LENGTH;
}

function isKeyArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_SECTIONS && value.every(isEditKey);
}

function isListItems(value: unknown): value is EditListItem[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_LIST_ITEMS &&
    value.every(
      (item) =>
        isRecord(item) &&
        isEditKey(item.id) &&
        isRecord(item.fields) &&
        Object.values(item.fields).every(
          (field) =>
            (typeof field === 'string' && field.length <= MAX_VALUE_LENGTH) ||
            typeof field === 'boolean' ||
            (typeof field === 'number' && Number.isFinite(field))
        )
    )
  );
}

function isSectionsPayload(value: unknown): value is SectionsState {
  if (!isRecord(value)) return false;
  if (!isEditKey(value.page)) return false;
  if (!isKeyArray(value.order)) return false;
  if (!isKeyArray(value.hidden)) return false;
  if (!isRecord(value.variants)) return false;
  return Object.entries(value.variants).every(
    ([key, variant]) =>
      isEditKey(key) &&
      typeof variant === 'string' &&
      variant.length <= MAX_VARIANT_LENGTH
  );
}

/* ------------------------------------------------------------------ */
/* Allowed admin origins                                               */
/* ------------------------------------------------------------------ */

/**
 * Exact origins (scheme + host + port, no path) allowed to talk to this
 * frame, parsed from the comma-separated env list. Wildcards and anything
 * non-http(s) are dropped; unset yields [] = reject everything.
 */
export function getAllowedAdminOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_ORIGIN;
  if (!raw) return [];
  const origins: string[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.includes('*')) continue;
    try {
      const url = new URL(trimmed);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        origins.push(url.origin);
      }
    } catch {
      // unusable entry — skip it
    }
  }
  return [...new Set(origins)];
}

const allowedOrigins = getAllowedAdminOrigins();

/** Origin of the admin that has already spoken to us. */
let matchedOrigin: string | null = null;

/* ------------------------------------------------------------------ */
/* Outbound (exact targetOrigin, never '*')                            */
/* ------------------------------------------------------------------ */

type OutboundType = 'ready' | 'select-field' | 'select-section';

function parentOriginIfAllowed(): string | null {
  try {
    const origin = window.parent.origin;
    return typeof origin === 'string' && allowedOrigins.includes(origin)
      ? origin
      : null;
  } catch {
    return null;
  }
}

function postToAdmin(type: OutboundType, payload: unknown): boolean {
  if (allowedOrigins.length === 0) return false;
  const message = { source: CRA7TY_SOURCE, type, payload };

  // Pinned to the admin origin that has already spoken to us…
  if (matchedOrigin) {
    window.parent.postMessage(message, matchedOrigin);
    return true;
  }
  // …else the readable parent origin when allowlisted…
  const guessed = parentOriginIfAllowed();
  if (guessed) {
    window.parent.postMessage(message, guessed);
    return true;
  }
  // …else one exact post per allowlisted origin (non-matching targets are
  // dropped silently by the browser).
  for (const origin of allowedOrigins) {
    window.parent.postMessage(message, origin);
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Inbound (admin → storefront)                                        */
/* ------------------------------------------------------------------ */

/** Apply `init`: full model replace for values/lists, sections if ours. */
function applyInit(payload: Record<string, unknown>): void {
  const values = payload.values as Record<string, unknown>;
  const lists = payload.lists as Record<string, unknown>;
  const sections = payload.sections as SectionsState;

  const cleanValues: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(values)) {
    cleanValues[key] = value as string | number;
  }
  const cleanLists: Record<string, EditListItem[]> = {};
  for (const [key, items] of Object.entries(lists)) {
    cleanLists[key] = items as EditListItem[];
  }
  applyFullOverrides(cleanValues, cleanLists);

  // Sections only when the admin's page matches the page we are showing —
  // a foreign page's order must never clobber this DOM. `global` is the
  // admin's pseudo-page (nav, footer, drawer, consent) and previews the
  // home route, so it applies on every page by design.
  if (sectionsOurs(sections)) {
    setSectionsState(sections);
  }
}

/** Is this sections payload for the page we are showing (or site-wide)? */
function sectionsOurs(sections: SectionsState): boolean {
  return sections.page === currentPageKey() || sections.page === 'global';
}

function onMessage(event: MessageEvent): void {
  // 1. origin — exact match against the allowlist, every event.
  if (allowedOrigins.length === 0) return;
  if (!allowedOrigins.includes(event.origin)) return;
  // 2. source — must be our parent window.
  if (event.source !== window.parent) return;

  // 3. envelope — { source, type, payload } with a known type.
  const data: unknown = event.data;
  if (!isRecord(data) || data.source !== CRA7TY_SOURCE) return;
  if (typeof data.type !== 'string') return;
  const payload: unknown = data.payload;
  if (!isRecord(payload)) return;

  // This admin origin is now the pinned target for our replies.
  matchedOrigin = event.origin;

  // 4. per-type schema; unknown type returns silently.
  switch (data.type) {
    case 'init': {
      if (!isEditKey(payload.page)) return;
      if (!isRecord(payload.values)) return;
      if (
        !Object.entries(payload.values).every(
          ([key, value]) => isEditKey(key) && isValue(value)
        )
      )
        return;
      if (!isRecord(payload.lists)) return;
      if (
        !Object.entries(payload.lists).every(
          ([key, items]) => isEditKey(key) && isListItems(items)
        )
      )
        return;
      if (!isSectionsPayload(payload.sections)) return;
      applyInit(payload);
      // A validated init means the admin answered — stop the ready loop.
      initSeen = true;
      stopReady();
      return;
    }

    case 'set-field': {
      if (!isEditKey(payload.key)) return;
      if (!isValue(payload.value)) return;
      // 5. keys this page does not expose are ignored.
      if (!isFieldRegistered(payload.key)) return;
      setFieldOverride(payload.key, payload.value);
      return;
    }

    case 'set-list': {
      if (!isEditKey(payload.key)) return;
      if (!isListItems(payload.items)) return;
      if (!isListRegistered(payload.key)) return;
      setListOverride(payload.key, payload.items);
      return;
    }

    case 'set-sections': {
      if (!isSectionsPayload(payload)) return;
      if (!sectionsOurs(payload)) return;
      setSectionsState(payload);
      return;
    }

    case 'highlight': {
      if (!isEditKey(payload.key)) return;
      applyHighlight(payload.key);
      return;
    }

    case 'clear': {
      if (Object.keys(payload).length !== 0) return;
      applyHighlight(null);
      return;
    }

    default:
      return; // unknown type — silently ignored
  }
}

/* ------------------------------------------------------------------ */
/* One capture-phase click listener: no navigation in edit mode        */
/* ------------------------------------------------------------------ */

function onClickCapture(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  // Links must not navigate and buttons must not submit/navigate. We only
  // cancel the DEFAULT: React handlers (click-to-select, accordion
  // toggles) still run on the bubble phase.
  if (target.closest('a[href], button')) event.preventDefault();
}

/* ------------------------------------------------------------------ */
/* ready → init handshake                                              */
/* ------------------------------------------------------------------ */

let readyTimer: ReturnType<typeof setInterval> | null = null;
let readyAttempts = 0;
let initSeen = false;

function stopReady(): void {
  if (readyTimer !== null) {
    clearInterval(readyTimer);
    readyTimer = null;
  }
}

/**
 * Start the bridge: register the outbound sender, attach the validated
 * message listener, block navigation, and send `ready` immediately then
 * every 500 ms for up to 10 s (20 attempts) until `init` arrives.
 * Idempotent across StrictMode/HMR double-mounts.
 */
export function startEditBridge(): void {
  const win = window as Window & { __cra7tyEditBridge?: boolean };
  if (win.__cra7tyEditBridge) return;
  win.__cra7tyEditBridge = true;

  setOutboundSender(postToAdmin);
  window.addEventListener('message', onMessage);
  document.addEventListener('click', onClickCapture, true);

  sendReady();
  readyTimer = setInterval(() => {
    if (initSeen) {
      stopReady();
      return;
    }
    readyAttempts += 1;
    if (readyAttempts >= 20) {
      stopReady();
      return;
    }
    sendReady();
  }, 500);
}
