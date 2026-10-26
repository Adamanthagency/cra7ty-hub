'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useIsEditMode } from './use-is-edit-mode';
import { useSiteContent } from '@/components/site-content-provider';
import {
  EMPTY_SELECTION,
  getFieldOverride,
  getListOverride,
  getSectionsState,
  getSelection,
  subscribeField,
  subscribeList,
  subscribeSections,
  registerField,
  registerList,
  subscribeSelection,
  type EditListItem,
  type SectionsState,
  type Selection,
} from './edit-state';

/**
 * React bindings over the edit store (useSyncExternalStore).
 *
 * Snapshots are Map-stored references (or null), so they are stable
 * between notifications and safe for React's Object.is comparison. The
 * server snapshot is always "no override": during SSR the bridge has
 * never loaded, and hydration matches because `init` only arrives after
 * mount.
 *
 * With no key (a component that has no list to edit) the hook subscribes
 * to nothing and stays null — edit-mode markup for that component just
 * renders its static children.
 */

export function useEditField(key: string): string | number | null {
  const subscribe = useCallback(
    (onChange: () => void) => subscribeField(key, onChange),
    [key],
  );
  // Register in edit mode only (refcounted, so EditableClient's own
  // registration and duplicate mounts stay balanced). Without this, keys
  // consumed ONLY through this hook — managed headline lines, CTA hrefs,
  // attribute-backed copy — never reach `ready.keys` and the bridge's
  // set-field gate would silently drop their edits.
  const editing = useIsEditMode();
  useEffect(() => {
    if (!editing || !key) return;
    return registerField(key);
  }, [editing, key]);
  return useSyncExternalStore(
    subscribe,
    () => getFieldOverride(key),
    () => null,
  );
}

export function useEditList(key: string): EditListItem[] | null {
  const subscribe = useCallback(
    (onChange: () => void) => (key ? subscribeList(key, onChange) : () => {}),
    [key],
  );
  // Same registration rule as useEditField: nothing registered, no
  // set-list gets through the bridge's gate. Edit mode only, refcounted.
  const editing = useIsEditMode();
  useEffect(() => {
    if (!editing || !key) return;
    return registerList(key);
  }, [editing, key]);
  return useSyncExternalStore(
    subscribe,
    () => (key ? getListOverride(key) : null),
    () => null,
  );
}

export function useEditSections(): SectionsState | null {
  return useSyncExternalStore(subscribeSections, getSectionsState, () => null);
}

/**
 * The layout variant a section should render with ('split', 'stacked', …).
 * Three layers, first match wins:
 *   1. edit mode — the live `set-sections` map, so chips re-render the
 *      frame instantly, before any publish;
 *   2. the published snapshot's pageSections[page].variants, written by
 *      the admin's Publish (page_sections.variant);
 *   3. the section's default — today's markup, so a database without
 *      variants renders exactly as before.
 */
export function useSectionVariant(
  page: string,
  sectionKey: string,
  fallback: string,
): string {
  const editing = useIsEditMode();
  const sections = useEditSections();
  const { pageSections } = useSiteContent();

  if (editing && sections?.variants?.[sectionKey]) {
    return sections.variants[sectionKey];
  }
  return pageSections[page]?.variants?.[sectionKey] ?? fallback;
}

export function useEditSelection(): Selection {
  return useSyncExternalStore(subscribeSelection, getSelection, () => EMPTY_SELECTION);
}
