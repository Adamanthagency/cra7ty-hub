/**
 * Shared edit-state: key registries, admin-applied overrides, subscriptions
 * and the outbound sender slot.
 *
 * Imported STATICALLY by edit-mode components, so it stays inert on a normal
 * visit: plain maps, no listeners, no network, no side effects at module
 * load. The protocol half (origin validation, message listener, ready loop,
 * click blocking) lives in `@/lib/edit-bridge`, imported only through
 * EditBridgeGate's cheap gate; when it starts, it registers the sender here
 * so these outbound helpers have somewhere to post.
 *
 * Values in this store are plain text (strings/finite numbers) or plain
 * data structures — never HTML. Callers render them as React text only.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** One list row, as the admin's ListEditor stores it. */
export interface EditListItem {
  id: string;
  fields: Record<string, string | number | boolean>;
}

/** Section order/visibility/variant state for one page. */
export interface SectionsState {
  page: string;
  order: string[];
  hidden: string[];
  variants: Record<string, string>;
}

/** Who currently owns the edit outline in the frame. */
export interface Selection {
  /** `highlight` key from the admin (content key or section key), or null. */
  highlight: string | null;
  /** Last thing the client clicked in the frame, before the admin answered. */
  local: { scope: 'field' | 'section'; key: string } | null;
}

export type Unsub = () => void;

export type FieldListener = (value: string | number | null) => void;
export type ListListener = (items: EditListItem[] | null) => void;
export type SectionsListener = (sections: SectionsState | null) => void;
type SelectionListener = () => void;

/* ------------------------------------------------------------------ */
/* Key validation (shared by register + bridge validation)             */
/* ------------------------------------------------------------------ */

const MAX_KEY_LENGTH = 160;
const KEY_PATTERN = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;

export function isEditKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_KEY_LENGTH &&
    KEY_PATTERN.test(value)
  );
}

/* ------------------------------------------------------------------ */
/* Registries (components register on mount, unregister on unmount)    */
/* ------------------------------------------------------------------ */

const fieldCounts = new Map<string, number>();
const listCounts = new Map<string, number>();
const sectionCounts = new Map<string, number>();

function register(counts: Map<string, number>, key: string): Unsub {
  if (!isEditKey(key)) {
    // A key the admin's validator would reject on select-field — fail loud
    // in development so wiring mistakes surface immediately.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[cra7ty] invalid edit key ignored:', key);
    }
    return () => {};
  }
  counts.set(key, (counts.get(key) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = (counts.get(key) ?? 0) - 1;
    if (next > 0) counts.set(key, next);
    else counts.delete(key);
  };
}

export const registerField = (key: string): Unsub => register(fieldCounts, key);
export const registerList = (key: string): Unsub => register(listCounts, key);
export const registerSection = (key: string): Unsub =>
  register(sectionCounts, key);

export const isFieldRegistered = (key: string): boolean => fieldCounts.has(key);
export const isListRegistered = (key: string): boolean => listCounts.has(key);

/* ------------------------------------------------------------------ */
/* Admin-applied overrides (written by the bridge, read by components) */
/* ------------------------------------------------------------------ */

const fieldValues = new Map<string, string | number>();
const listValues = new Map<string, EditListItem[]>();
let sectionsState: SectionsState | null = null;
let selection: Selection = { highlight: null, local: null };

const fieldSubs = new Map<string, Set<FieldListener>>();
const listSubs = new Map<string, Set<ListListener>>();
const sectionSubs = new Set<SectionsListener>();
const selectionSubs = new Set<SelectionListener>();

/* --- reads ---------------------------------------------------------- */

export function getFieldOverride(key: string): string | number | null {
  const value = fieldValues.get(key);
  return value === undefined ? null : value;
}

export function getListOverride(key: string): EditListItem[] | null {
  return listValues.get(key) ?? null;
}

export function getSectionsState(): SectionsState | null {
  return sectionsState;
}

export function getSelection(): Selection {
  return selection;
}

export const EMPTY_SELECTION: Selection = { highlight: null, local: null };

/* --- subscriptions -------------------------------------------------- */

export function subscribeField(key: string, cb: FieldListener): Unsub {
  let set = fieldSubs.get(key);
  if (!set) {
    set = new Set();
    fieldSubs.set(key, set);
  }
  set.add(cb);
  return () => {
    set?.delete(cb);
  };
}

export function subscribeList(key: string, cb: ListListener): Unsub {
  let set = listSubs.get(key);
  if (!set) {
    set = new Set();
    listSubs.set(key, set);
  }
  set.add(cb);
  return () => {
    set?.delete(cb);
  };
}

export function subscribeSections(cb: SectionsListener): Unsub {
  sectionSubs.add(cb);
  return () => {
    sectionSubs.delete(cb);
  };
}

export function subscribeSelection(cb: SelectionListener): Unsub {
  selectionSubs.add(cb);
  return () => {
    selectionSubs.delete(cb);
  };
}

/* --- notifies ------------------------------------------------------- */

function notifyField(key: string): void {
  const subs = fieldSubs.get(key);
  if (!subs) return;
  const value = fieldValues.get(key) ?? null;
  for (const cb of subs) cb(value);
}

function notifyList(key: string): void {
  const subs = listSubs.get(key);
  if (!subs) return;
  const value = listValues.get(key) ?? null;
  for (const cb of subs) cb(value);
}

function notifySections(): void {
  for (const cb of sectionSubs) cb(sectionsState);
}

function notifySelection(): void {
  for (const cb of selectionSubs) cb();
}

/* --- mutators (the bridge calls these after validation) ------------- */

export function setFieldOverride(key: string, value: string | number): void {
  fieldValues.set(key, value);
  notifyField(key);
}

export function setListOverride(key: string, items: EditListItem[]): void {
  listValues.set(key, items);
  notifyList(key);
}

/** `init`: replace the full model, then wake every subscribed key. */
export function applyFullOverrides(
  values: Record<string, string | number>,
  lists: Record<string, EditListItem[]>,
): void {
  fieldValues.clear();
  for (const [key, value] of Object.entries(values)) fieldValues.set(key, value);
  listValues.clear();
  for (const [key, items] of Object.entries(lists)) listValues.set(key, items);
  for (const key of fieldSubs.keys()) notifyField(key);
  for (const key of listSubs.keys()) notifyList(key);
}

export function setSectionsState(next: SectionsState): void {
  sectionsState = next;
  notifySections();
}

/**
 * `highlight {key}` / `clear`: the admin now owns the outline, so the
 * frame-side local selection drops. A click in the frame sets `local`
 * without touching `highlight` (the admin does not echo select-field).
 */
export function applyHighlight(key: string | null): void {
  selection = { highlight: key, local: null };
  notifySelection();
}

export function setLocalSelection(scope: 'field' | 'section', key: string): void {
  selection = { highlight: selection.highlight, local: { scope, key } };
  notifySelection();
}

/* ------------------------------------------------------------------ */
/* Outbound: the bridge registers a sender; these build the payloads   */
/* ------------------------------------------------------------------ */

type OutboundType = 'ready' | 'select-field' | 'select-section';

let sender: ((type: OutboundType, payload: unknown) => boolean) | null = null;

export function setOutboundSender(
  fn: ((type: OutboundType, payload: unknown) => boolean) | null,
): void {
  sender = fn;
}

function sendToAdmin(type: OutboundType, payload: unknown): boolean {
  return sender ? sender(type, payload) : false;
}

/** Route → admin page key ('/' → home, '/products/x' → product, …). */
export function pageKeyFromPath(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean)[0] || '';
  if (!segment) return 'home';
  if (segment === 'products') return 'product';
  return KEY_PATTERN.test(segment) ? segment : 'home';
}

export function currentPageKey(): string {
  if (typeof window === 'undefined') return 'home';
  return pageKeyFromPath(window.location.pathname);
}

export function sendReady(): void {
  const keys = [...fieldCounts.keys(), ...listCounts.keys()].sort();
  const sections = [...sectionCounts.keys()].sort();
  sendToAdmin('ready', { page: currentPageKey(), keys, sections });
}

/** Click-to-select: viewport-relative rect of the clicked node. */
export function sendSelectField(key: string, element: Element): boolean {
  if (!isEditKey(key)) return false;
  const rect = element.getBoundingClientRect();
  return sendToAdmin('select-field', {
    key,
    rect: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
  });
}

export function sendSelectSection(sectionKey: string): boolean {
  if (!isEditKey(sectionKey)) return false;
  return sendToAdmin('select-section', {
    page: currentPageKey(),
    sectionKey,
  });
}
