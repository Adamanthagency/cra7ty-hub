# Session replay (PostHog)

One masked, consent-controlled browser journey: the shop, the product routes,
the blog and the studio page. Nothing is recorded until a visitor presses
**Allow**, and leaving those routes stops the recording again.

## Where the pieces live

| What | Where |
| --- | --- |
| Mount point | `src/app/layout.tsx` renders `<ReplayAnalytics />` and `<ReplayConsent />` |
| Client mount | `src/components/ReplayAnalytics.tsx` — calls `replayController.mount()` once, in an effect |
| Real wiring | `src/lib/replay.ts` — imports the single `posthog-js` client and injects it, the router and the consent source into the controller |
| Controller | `src/lib/replay-controller.mjs` — consent/route arbitration, privacy options, URL redaction. Plain ESM, so Node can import it directly |
| Consent source | `src/lib/replay-consent.ts` — `cra7ty:replay-consent` in localStorage, only ever `granted` or `denied` |
| Consent UI | `src/components/ReplayConsent.tsx` — the corner card: Allow / No thanks / Turn off |
| Offline checks | `posthog-replay.check.mjs` — `npm run check:replay` |
| Public env example | `.env.example` — both entries deliberately empty |

Next.js 14.2 (App Router) is older than 15.3, so there is no
`instrumentation-client.ts`. The client bootstrap is the mounted component in
the root layout, which is the documented pattern for this version.

## Package manager, lock and resolution

- **packageManager:** npm. `package.json` has no `packageManager` field; the
  toolchain on this machine is npm 11.13.0 on Node v24.16.0.
- **Locks before the change:** `package-lock.json` only, `lockfileVersion` 3.
  No `yarn.lock`, `pnpm-lock.yaml` or `bun.lock`, so the repository was
  eligible and the existing npm lock was kept.
- **SDK-importing package:** the root workspace `cra7ty-hub`. This is a single
  package, not a monorepo, so the importer is the root — `posthog-js` is
  declared in the root `package.json` and resolves from the root
  `node_modules/posthog-js`.
- **Install (one plain command, no folder flag because the importer is the root):**

  ```bash
  npm install posthog-js@1.438.13
  ```

  Result: `posthog-js` 1.438.13 in `package.json`, the updated
  `package-lock.json` (`node_modules/posthog-js` → 1.438.13), and
  `node_modules/posthog-js/package.json` reporting the same version.

## Baseline, before any edit

- `npm run typecheck` — pass (exit 0).
- `npm run lint` — pass, no warnings or errors.
- `npm run build` — not run before the change; run afterwards, result in the checks section below.
- There was no test script and no test file: `posthog-replay.check.mjs` is new.

## The journey, and what is never recorded

**Safe journey paths** (`SAFE_JOURNEY_PATHS`): `/`, `/shop`, `/about`,
`/blog`, `/products/<slug>`. The `/shop?category=…` shelf buttons and the nav
links count as `/shop`; query strings are not part of the decision.

**Blocked route segments** (`BLOCKED_PATH_SEGMENTS`): `account`, `accounts`,
`admin`, `auth`, `basket`, `billing`, `cart`, `checkout`, `invoice`, `login`,
`logout`, `order`, `orders`, `password`, `pay`, `payment`, `payments`,
`receipt`, `reset`, `signin`, `sign-in`, `signout`, `signup`, `sign-up`,
`verify`, `wallet`. This site has no auth or payment pages yet — the list is
there so a future one cannot start recording by accident.

**Private path identifiers** are refused too: a segment containing `@`, a
UUID, 16+ hex characters, or a 24+ character alphanumeric blob.

**Sensitive DOM** (`SENSITIVE_DOM_SELECTOR`): `.ph-no-capture`,
`[data-ph-sensitive]`, and password/email/tel inputs plus
card/one-time-code autocomplete fields are blocked from snapshots. In this
project the WhatsApp order handoff link in
`src/components/OrderDrawer.tsx` is marked
`data-ph-sensitive="order-handoff"` with `ph-no-capture`, because its `href`
carries the whole order message.

## Privacy configuration (forced locally, not left to remote defaults)

From `buildReplayOptions()` in `src/lib/replay-controller.mjs`:

| Option | Value |
| --- | --- |
| `api_host` | the configured US or EU host; no fallback |
| `opt_out_capturing_by_default` | `true` — a new client starts opted out |
| `disable_session_recording` | `true` — and replay is only started by consent |
| `autocapture`, `capture_pageview`, `capture_pageleave` | `false` |
| `capture_dead_clicks`, `rageclick`, `capture_exceptions` | `false` |
| `capture_heatmaps`, `enable_recording_console_log`, `capture_performance` | `false` |
| `person_profiles` | `identified_only` |
| `session_recording.maskAllInputs` | `true` |
| `session_recording.maskTextSelector` | `'*'` — all text masked |
| `session_recording.blockSelector` | the sensitive selector list above |
| `session_recording.recordBody` / `recordHeaders` | `false` |
| `session_recording.captureCanvas` | `{ recordCanvas: false }` |
| `session_recording.captureJsonLd` | `false` |
| `session_recording.maskCapturedNetworkRequestFn` | `redactCapturedRequest` |

`maskCapturedNetworkRequestFn` is also what the replay sees for its own page
URLs: `sanitizeReplayUrl()` drops the query **and** the fragment, drops
unparseable or non-`http(s)` URLs, drops protocol-relative URLs, and drops any
URL whose path is a blocked route or carries a private identifier. A dropped
URL returns `null`, so the entry never reaches a snapshot. `before_send` is not
used for this.

DOM masking does not cover canvas, attributes or JSON-LD, which is why those
channels are switched off explicitly above rather than inherited from the
project's remote settings.

## Consent rules

- **Unknown** (no choice yet) — the client is initialised opted out, but
  nothing is started.
- **Granted** — `opt_in_capturing()`, then a plain `startSessionRecording()`
  with no boolean and no override object. Project enablement, sampling,
  triggers, minimum duration and authorised domains still apply.
- **Denied / withdrawn** — `stopSessionRecording()` and
  `opt_out_capturing()`; a visitor who denies stays stopped on later safe
  navigations and remounts.
- **Leaving the journey** — a sensitive route or an explicit exit stops the
  recording without touching analytics consent.
- The controller is mounted once; remounting reuses the same listeners and
  never initialises or starts a second time. SDK failures are contained: a
  broken client never breaks the page or the consent card.
- `localStorage` is read only for an explicit `granted`/`denied`; an empty,
  missing or unreadable store is `unknown`, which never records.

## Checks (after the change, on this working copy)

- `npm run check:replay` — 14 tests, 14 pass, exit 0.
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0, no warnings or errors.
- `npm run build` — exit 0. `Compiled successfully`, 24 static pages. The
  client bundle proves the wiring resolved: the layout chunk carries the
  consent mount and the SDK is emitted as its own chunk.
- Smoke test of the production build (`next start -p 3100`, env empty):
  `/shop` and `/about` both return 200; with no token and no host the
  controller is a no-op and the consent card stays hidden.
- Browser playback against a real project is **not** verified here — it needs
  your token (see below).

## Check it offline

```bash
npm run check:replay      # node posthog-replay.check.mjs
```

The script imports `src/lib/replay-controller.mjs` directly and drives it with
stubbed SDK/router/consent, with no network and no real token. It covers: no
init without a token and host; unknown/denied never recording; a single start
on a safe grant; remounts not duplicating init/start/listeners; exit, sensitive
routes and withdrawal stopping (withdrawal also opting out); denied re-entry
staying off; SDK failures being contained; every privacy channel; the real URL
hook with secrets, malformed URLs and blocked paths; the entry-to-controller
import chain; and the manifest/lock/resolution pinning `posthog-js` 1.438.13.

## Private setup (yours to do, not in this repository)

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` to your **public project token**
   (not a personal or secret API key).
3. Set `NEXT_PUBLIC_POSTHOG_HOST` to exactly one region:
   `https://us.i.posthog.com` (US) or `https://eu.i.posthog.com` (EU). There is
   no fallback; if either value is empty, replay does nothing.
4. In your PostHog project, check session replay: recording enabled, sampling,
   triggers, minimum duration, and the authorised domains (`localhost:3000` for
   local checking, plus your production domain).
5. Restart the dev server — `NEXT_PUBLIC_*` values are inlined at build/start
   time, so a running server will not pick them up.

## Verify a masked recording

1. `npm run dev`, open `http://localhost:3000`.
2. Press **Allow** on the session replay card (bottom left).
3. Walk the journey: home → `/shop` (search, sort, a category) → a product
   page → `/blog` → a post → `/about`.
4. Open the order drawer and add a product, then press **Turn off**; the
   recording should end. Press **Allow** again and the next recording starts.
5. In PostHog → Session replay, open the newest recording and confirm: text and
   inputs are masked, URLs show no query strings or fragments, the WhatsApp
   handoff link is absent from the snapshot, and a recording that ended at
   "Turn off" has no frames after it.

If playback is missing, or shows anything unmasked or a sensitive URL, treat
the setup as unconfirmed and say what you saw — without pasting tokens.
