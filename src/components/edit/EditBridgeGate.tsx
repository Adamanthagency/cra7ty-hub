'use client';

import { useEffect } from 'react';

/**
 * The bridge bootstrap, mounted once in the root layout.
 *
 * Cheap gate FIRST: only when this page is framed by the admin AND carries
 * `?cra7ty-edit=1` does it import() the bridge chunk. On a normal visit
 * both checks fail and nothing beyond this tiny component is fetched — no
 * edit chunk, no listener, no network.
 *
 * Renders null, so the server HTML is identical with or without it.
 */
export function EditBridgeGate() {
  useEffect(() => {
    if (window.parent === window) return;
    if (new URLSearchParams(window.location.search).get('cra7ty-edit') !== '1') {
      return;
    }
    // Mark edit mode on <html> so the CSS-only rules (drawer hidden,
    // native cursor restored) apply from the first frame — this is a
    // gate attribute, not a change to those components.
    document.documentElement.setAttribute('data-cra7ty-edit', '1');
    void import('@/lib/edit-bridge').then((bridge) => {
      bridge.startEditBridge();
    });
  }, []);

  return null;
}
