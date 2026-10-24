'use client';

import { useEffect } from 'react';
import { replayController } from '@/lib/replay';

/**
 * Mounts the replay controller once, from the root layout, in the browser only.
 *
 * The controller owns everything else: it initialises the single PostHog
 * client, listens to consent and URL changes, and tears its own listeners down
 * on unmount, so a remount adds nothing a second time. It renders no markup.
 */
export function ReplayAnalytics() {
  useEffect(() => {
    const detach = replayController.mount();
    return () => {
      detach?.();
    };
  }, []);
  return null;
}
