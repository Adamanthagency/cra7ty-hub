'use client';

import { useEffect, useState } from 'react';

/**
 * The cheap client gate for in-context editing.
 *
 * Returns `true` only when this page is framed by the admin AND carries
 * `?cra7ty-edit=1`. Both checks are deliberately cheap and both are false on
 * a normal visit, so the bridge (and any edit chunk) is never fetched for a
 * normal visitor. `NEXT_PUBLIC_ADMIN_ORIGIN` being set changes nothing here:
 * the env var only seeds the origin allowlist the bridge checks on `init`.
 *
 * Returns `false` during SSR so the server-rendered tree is untouched.
 */
export function useIsEditMode(): boolean {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    // Cheap checks first, short-circuiting before any import.
    const framed = window.parent !== window;
    const flagged =
      new URLSearchParams(window.location.search).get('cra7ty-edit') === '1';
    setEditing(framed && flagged);
  }, []);

  return editing;
}
