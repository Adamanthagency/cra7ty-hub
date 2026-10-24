'use client';

import type { ReactNode } from 'react';
import { EditableClient } from './EditableClient';
import { useIsEditMode } from '@/lib/edit/use-is-edit-mode';
import type { TokenValues } from '@/lib/edit/keys';

/**
 * `Editable` wraps one editable text node.
 *
 * Client component (it must be: the edit gate flips AFTER mount, and a
 * server component never re-executes in the browser — the EditableClient
 * swap could never happen otherwise). On a normal visit `useIsEditMode()`
 * stays false, so this renders `children` as a bare fragment: no wrapper
 * element, no data attributes, no edit markup in the served HTML, and the
 * hydration cost is one no-op component per node. EditableClient — and the
 * rest of the edit chunk beyond this gate — is only reached once the
 * browser confirms we are framed by the admin with `?cra7ty-edit=1`.
 *
 * `k` is the admin content key, e.g. `home.hero.eyebrow`.
 *
 * `tokens`: token values this node can interpolate ({shown}/{total}) —
 * passing `tokens` marks the field as token-bearing; the raw string with
 * its tokens arrives from the admin and is interpolated here (the admin
 * never resolves tokens).
 *
 * `managed`: the PARENT already applies this key's override before
 * rendering (headline lines, which must re-split on the emphasis word
 * without replaying MaskedLines). Editable then only registers the key,
 * handles click-to-select and the admin highlight.
 */
export function Editable({
  k,
  tokens,
  managed,
  children,
}: {
  k: string;
  tokens?: TokenValues;
  managed?: boolean;
  children: ReactNode;
}) {
  const editing = useIsEditMode();

  if (!editing) return <>{children}</>;

  return (
    <EditableClient k={k} tokens={tokens} managed={managed}>
      {children}
    </EditableClient>
  );
}
