'use client';

import { useEffect, type ReactNode } from 'react';
import {
  registerSection,
  sendSelectSection,
  setLocalSelection,
} from '@/lib/edit/edit-state';
import { useEditSections, useEditSelection } from '@/lib/edit/use-edit';
import { useIsEditMode } from '@/lib/edit/use-is-edit-mode';

/**
 * Wraps one top-level section so it can be selected in edit mode, WITHOUT
 * adding a box to the layout.
 *
 * `display: contents` makes the wrapper generate no CSS box at all: it is
 * not a containing block, not an overflow container, and not a flex/grid
 * item — the child `<section>` is laid out exactly as if the wrapper were
 * not there. That is what keeps `/shop`'s sticky rail and the full-bleed
 * bands behaving identically in edit mode. Selection/reorder is purely a
 * DOM overlay concern and does not need a box of its own.
 *
 * It SELF-GATES on `useIsEditMode()`: on a normal visit it renders its
 * children untouched — no wrapper element, no handler, no registration —
 * so it is safe to wrap site-wide pieces (nav, footer, drawer, consent)
 * directly in the root layout.
 *
 * Clicking anywhere in the section sends `select-section` to the admin
 * (which alone owns the controls: move, hide, variants — there is no
 * in-frame toolbar by design). `hidden` (from `set-sections`) dims the
 * section and shows the mono "Hidden" tag — the dim and tag are CSS on
 * this class (see globals.css).
 */
export function EditableSection({
  id,
  hidden = false,
  children,
}: {
  id: string;
  hidden?: boolean;
  children: ReactNode;
}) {
  const editMode = useIsEditMode();
  const { highlight, local } = useEditSelection();
  const sections = useEditSections();

  // Hidden comes from the host prop, or — for site-wide pieces that live
  // outside any SectionOrderHost (nav, footer, drawer, consent) — straight
  // from the current set-sections state.
  const isHidden =
    hidden || (sections !== null && sections.hidden.includes(id));

  useEffect(() => {
    if (!editMode) return;
    return registerSection(id);
  }, [editMode, id]);

  // Admin highlight wins; otherwise the last click in this frame shows
  // until the admin answers with a highlight or a clear.
  const selected =
    highlight === id || (local?.scope === 'section' && local.key === id);

  if (!editMode) return <>{children}</>;

  const className = [
    'cra7ty-section',
    selected ? 'cra7ty-section--selected' : '',
    isHidden ? 'cra7ty-section--hidden' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      data-cra7ty-section={id}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setLocalSelection('section', id);
        sendSelectSection(id);
      }}
      className={className}
    >
      {children}
    </div>
  );
}
