'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { EditableSection } from './EditableSection';
import { useIsEditMode } from '@/lib/edit/use-is-edit-mode';
import { useEditSections } from '@/lib/edit/use-edit';

/**
 * Holds the order of a page's top-level sections and re-renders them in that
 * order. In edit mode each child is wrapped in `EditableSection`; in the
 * default (published) path the children are rendered as-is in the order given
 * by the caller, so the served HTML is identical to not hosting at all.
 *
 * `slots` maps a stable section id to its rendered node. The initial order is
 * the array the caller passes, which must match the published DOM order.
 *
 * Edit mode (Stage 2):
 * - the host self-gates on `useIsEditMode()` (callers stay server code);
 * - `set-sections` from the admin is authoritative: its order is applied —
 *   unknown ids ignored, slot ids it omitted kept at the end — and its
 *   `hidden` list dims those sections (CSS class, mono "Hidden" tag).
 *   Reordering happens only from the admin side panel — no in-frame
 *   controls — so order changes here always arrive via `set-sections`;
 * - when (and only when) the ORDER changes, every slot is remounted via a
 *   versioned Fragment key, replaying the existing fold-in (Reveal) once.
 *   Hidden-only changes update the class in place; typing never touches
 *   this state, so Reveal/MaskedLines never replay from edits.
 */
export function SectionOrderHost({
  slots,
  order,
  editing = false,
}: {
  slots: Record<string, ReactNode>;
  order: readonly string[];
  editing?: boolean;
}) {
  const editMode = useIsEditMode();
  const active = editing || editMode;
  const sections = useEditSections();

  const [orderState, setOrderState] = useState(() => ({
    ids: [...order],
    version: 0,
  }));
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());

  // Apply the admin's set-sections (page match already checked in the bridge).
  useEffect(() => {
    if (!active || !sections) return;

    const known = sections.order.filter((id) => id in slots);
    const omitted = Object.keys(slots).filter((id) => !known.includes(id));
    const merged = [...known, ...omitted];

    setOrderState((prev) => {
      const same =
        prev.ids.length === merged.length &&
        prev.ids.every((id, i) => id === merged[i]);
      return same ? prev : { ids: merged, version: prev.version + 1 };
    });
    setHidden(new Set(sections.hidden));
  }, [active, sections, slots]);

  return (
    <>
      {orderState.ids.map((id) => {
        const node = slots[id];
        if (!active) return <Fragment key={id}>{node}</Fragment>;
        return (
          <Fragment key={`${id}#${orderState.version}`}>
            <EditableSection id={id} hidden={hidden.has(id)}>
              {node}
            </EditableSection>
          </Fragment>
        );
      })}
    </>
  );
}
