'use client';

import type { ReactNode } from 'react';
import { EditableClient } from './EditableClient';
import { useIsEditMode } from '@/lib/edit/use-is-edit-mode';
import { interpolateTokens, type TokenValues } from '@/lib/edit/keys';
import { useContentField } from '@/components/site-content-provider';

/**
 * `Editable` wraps one editable text node.
 *
 * Client component (it must be: the edit gate flips AFTER mount, and a
 * server component never re-executes in the browser — the EditableClient
 * swap could never happen otherwise). On a normal visit `useIsEditMode()`
 * stays false, so this renders a bare fragment: no wrapper element, no
 * data attributes, no edit markup in the served HTML, and the hydration
 * cost is one no-op component per node. EditableClient — and the rest of
 * the edit chunk beyond this gate — is only reached once the browser
 * confirms we are framed by the admin with `?cra7ty-edit=1`.
 *
 * `k` is the admin content key, e.g. `home.hero.eyebrow`.
 *
 * THE BASE VALUE (Stage 3): the snapshot's value for `k` — Supabase on a
 * normal visit, /data when the database is unavailable — renders INSTEAD
 * of the children whenever it exists. The children stay as the final
 * fallback (key never seeded, or a token this node cannot resolve), so a
 * key nobody wires up still renders its original copy. With the Stage-2
 * seed the two are the same string, which is why the served HTML is
 * byte-identical to the static site.
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
 *
 * `className`: extra classes for the edit-mode wrapper only (e.g. `block`
 * when the content is a block of layout rather than a run of text), so the
 * hover underline and selection outline frame the whole region. Dropped
 * with the rest of the edit markup on a normal visit.
 */
export function Editable({
  k,
  tokens,
  managed,
  className,
  children,
}: {
  k: string;
  tokens?: TokenValues;
  managed?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const editing = useIsEditMode();
  const db = useContentField(k);

  let base: ReactNode = children;
  // `managed` parents already render THIS key's snapshot value themselves
  // (they re-split headline lines around the <em>), so the base override
  // would flatten their structure — children stay authoritative there.
  if (!managed && db !== undefined) {
    const resolved = tokens ? interpolateTokens(db, tokens) : db;
    // A leftover "{" means an unresolvable token — the JSX children are
    // fully resolved, so prefer them over half-substituted copy.
    if (!resolved.includes('{')) base = resolved;
  }

  if (!editing) return <>{base}</>;

  return (
    <EditableClient k={k} tokens={tokens} managed={managed} className={className}>
      {base}
    </EditableClient>
  );
}
