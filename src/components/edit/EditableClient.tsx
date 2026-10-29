'use client';

import { useEffect, type ReactNode } from 'react';
import { interpolateTokens, type TokenValues } from '@/lib/edit/keys';
import {
  registerField,
  sendSelectField,
  setLocalSelection,
} from '@/lib/edit/edit-state';
import { useEditField, useEditSelection } from '@/lib/edit/use-edit';

/**
 * The edit-mode client node, reached only after the cheap gate confirmed we
 * are framed by the admin with `?cra7ty-edit=1`. It marks the node with a
 * content-key data attribute, registers the key with the edit store, and
 * broadcasts click-to-select to the admin (with the node's viewport rect).
 *
 * When the admin sends a value for this key (`init`/`set-field`), the
 * override replaces the children as a plain React TEXT node — React escapes
 * it, so `<script>alert(1)</script>` renders as visible text and can never
 * execute. Token-bearing fields (given `tokens`) interpolate {shown} and
 * {total} locally; unknown {…} tokens render as-is.
 *
 * `managed` parents apply the override themselves (see Editable); this node
 * then keeps rendering their children untouched.
 */
export function EditableClient({
  k,
  tokens,
  managed,
  className,
  children,
}: {
  k: string;
  tokens?: TokenValues;
  managed?: boolean;
  /** layout classes for the wrapper (block-sized regions) — edit mode only */
  className?: string;
  children: ReactNode;
}) {
  const override = useEditField(k);
  const { highlight, local } = useEditSelection();

  // Register so `ready.keys` and the set-field gate know this key exists.
  useEffect(() => registerField(k), [k]);

  // Admin highlight wins; otherwise the last click in this frame shows
  // until the admin answers with a highlight or a clear.
  const selected =
    highlight === k || (local?.scope === 'field' && local.key === k);

  let content: ReactNode = children;
  if (!managed && override !== null) {
    const raw = typeof override === 'number' ? String(override) : override;
    content = tokens ? interpolateTokens(raw, tokens) : raw;
  }

  return (
    <span
      data-cra7ty-key={k}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setLocalSelection('field', k);
        sendSelectField(k, event.currentTarget);
      }}
      className={
        selected
          ? `cra7ty-editable cra7ty-editable--selected${className ? ` ${className}` : ''}`
          : `cra7ty-editable${className ? ` ${className}` : ''}`
      }
    >
      {content}
    </span>
  );
}
