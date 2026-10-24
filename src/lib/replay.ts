'use client';

import posthog from 'posthog-js';
import { createReplayController } from '@/lib/replay-controller.mjs';
import { replayConsentSource } from '@/lib/replay-consent';
import { onUrlChange } from '@/lib/url-watch';

/**
 * The one browser client for this tab, wired to the studio's consent switch.
 *
 * `posthog-js` is imported here and injected into the controller, so the
 * controller stays plain ESM and the SDK is only ever created once. The token
 * and host are public values from `.env.local`; both empty means replay is off.
 */
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? '';
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '';

export const replayController = createReplayController({
  sdk: posthog,
  router: {
    getPath: () => (typeof window === 'undefined' ? '/' : window.location.pathname),
    // `/shop?category=origami` and the nav buttons change the URL without a
    // popstate event; onUrlChange already listens for those.
    subscribe: (onChange: () => void) => onUrlChange(onChange),
  },
  consent: replayConsentSource,
  config: { token, host },
});

export const replayConfigured = Boolean(token.trim() && host.trim());
