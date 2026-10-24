/**
 * Session-replay controller.
 *
 * Everything that decides *whether* a visit is recorded lives here, in plain
 * ESM with the SDK, the router and the consent source injected. That keeps the
 * arbitration (consent + route + one-time init) out of React and out of the
 * SDK, and lets `posthog-replay.check.mjs` drive the real code with stubs.
 *
 * Rules this file enforces, in order:
 *   1. No project token or no host  -> nothing is initialised at all.
 *   2. Initialise once per tab. A client that is already loaded keeps its own
 *      settings; we never init a second one.
 *   3. A new client starts opted out with replay disabled, so an unknown or
 *      denied visitor never records.
 *   4. Recording only starts on an explicit grant, only on a safe journey
 *      path, and only once until it is stopped again.
 *   5. Leaving the safe journey, denial or withdrawal stops the recording;
 *      denial also opts the visitor out.
 *
 * Masking, and URL redaction, are configured in `buildReplayOptions()` below.
 */

/** Routes that are fine to watch: the shop journey, nothing personal. */
export const SAFE_JOURNEY_PATHS = ['/', '/shop', '/about', '/blog', '/products'];

/**
 * Route segments that are never recorded. This site has no auth or payment
 * pages today — they are listed so a future one cannot start recording by
 * accident, and the /shop?category=… shelf stays a safe path.
 */
export const BLOCKED_PATH_SEGMENTS = [
  'account',
  'accounts',
  'admin',
  'auth',
  'basket',
  'billing',
  'cart',
  'checkout',
  'invoice',
  'login',
  'logout',
  'order',
  'orders',
  'password',
  'pay',
  'payment',
  'payments',
  'receipt',
  'reset',
  'signin',
  'sign-in',
  'signout',
  'signup',
  'sign-up',
  'verify',
  'wallet',
];

/**
 * DOM subtrees that never enter a snapshot. `ph-no-capture` is PostHog's own
 * block class; the rest are the project's markers plus the obvious credential
 * inputs.
 */
export const SENSITIVE_DOM_SELECTOR = [
  '[data-ph-sensitive]',
  '.ph-no-capture',
  'input[type="password"]',
  'input[type="email"]',
  'input[type="tel"]',
  '[autocomplete="cc-number"]',
  '[autocomplete="cc-csc"]',
  '[autocomplete="current-password"]',
  '[autocomplete="new-password"]',
  '[autocomplete="one-time-code"]',
].join(', ');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX = /^[0-9a-f]{16,}$/i;
const OPAQUE_TOKEN = /^[A-Za-z0-9]{24,}$/;

/** `/shop/?category=origami#top` -> `/shop`. */
export function normalizePathname(pathname) {
  if (typeof pathname !== 'string') return '/';
  const stripped = pathname.trim().split('#')[0].split('?')[0].trim();
  if (!stripped) return '/';
  const withSlash = stripped.startsWith('/') ? stripped : `/${stripped}`;
  const trimmed = withSlash.replace(/\/+$/, '');
  return trimmed || '/';
}

/** A path identifier we refuse to send: an email, a uuid, a hex or opaque id. */
function hasSensitivePathIdentifier(pathname) {
  for (const raw of pathname.split('/')) {
    const segment = raw.trim();
    if (!segment) continue;
    if (segment.includes('@')) return true;
    if (UUID.test(segment) || LONG_HEX.test(segment)) return true;
    if (OPAQUE_TOKEN.test(segment) && /[0-9]/.test(segment) && /[A-Za-z]/.test(segment)) return true;
  }
  return false;
}

/** True for auth / order / payment routes and for private-looking path ids. */
export function isSensitivePath(pathname, blockedPathSegments = BLOCKED_PATH_SEGMENTS) {
  const normalized = normalizePathname(pathname).toLowerCase();
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => blockedPathSegments.includes(segment))) return true;
  return hasSensitivePathIdentifier(normalized);
}

/** A path is on the journey when it is not sensitive and matches a safe prefix. */
export function isSafeJourneyPath(pathname, safePaths = SAFE_JOURNEY_PATHS) {
  const normalized = normalizePathname(pathname);
  if (isSensitivePath(normalized)) return false;
  return safePaths.some(
    (base) =>
      base === normalized || (base !== '/' && normalized.toLowerCase().startsWith(`${base.toLowerCase()}/`)),
  );
}

/**
 * The one URL sanitiser used for replay page URLs and captured requests:
 * drop the query *and* the fragment, drop anything unparseable or non-http,
 * and drop a path that names an auth/order route or carries an identifier.
 * Returns the safe absolute URL (or path for same-origin relative URLs), or
 * `null` when the whole entry must be dropped.
 */
export function sanitizeReplayUrl(raw, options = {}) {
  const blockedPathSegments = options.blockedPathSegments ?? BLOCKED_PATH_SEGMENTS;
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  // Protocol-relative and other schemes (`javascript:`, `data:`, `file:`…) are
  // never replay evidence, and a bare relative path has no origin to keep.
  if (value.startsWith('//')) return null;

  if (value.startsWith('/')) {
    // Same-origin path: keep the path, lose the query and the fragment.
    const pathname = normalizePathname(value);
    if (isSensitivePath(pathname, blockedPathSegments)) return null;
    return pathname;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.hostname) return null;
  const pathname = normalizePathname(url.pathname || '/');
  if (isSensitivePath(pathname, blockedPathSegments)) return null;
  return `${url.origin}${pathname}`;
}

/**
 * `session_recording.maskCapturedNetworkRequestFn`. It also sees the replay's
 * own page URLs, so this is where a `?email=…` query or an `#access_token=…`
 * fragment is stripped before a snapshot exists. Returning `null` drops the
 * entry entirely.
 */
export function redactCapturedRequest(request, options = {}) {
  if (!request || typeof request !== 'object') return null;
  const raw =
    typeof request.name === 'string'
      ? request.name
      : typeof request.url === 'string'
        ? request.url
        : null;
  const safe = sanitizeReplayUrl(raw, options);
  if (!safe) return null;
  return { ...request, name: safe };
}

/**
 * The full SDK config for a new client. Every optional capture channel is off
 * locally: autocapture, pageviews, dead clicks, rageclicks, exceptions,
 * heatmaps, console logs, performance and JSON-LD. Replay masks all input and
 * all text, records no bodies and no headers, and never records a canvas.
 */
export function buildReplayOptions(options = {}) {
  const {
    host,
    blockedPathSegments = BLOCKED_PATH_SEGMENTS,
    sensitiveSelector = SENSITIVE_DOM_SELECTOR,
  } = options;

  return {
    api_host: host,
    // New client starts quiet; consent is the only thing that turns it on.
    opt_out_capturing_by_default: true,
    disable_session_recording: true,
    person_profiles: 'identified_only',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    rageclick: false,
    capture_exceptions: false,
    capture_heatmaps: false,
    enable_recording_console_log: false,
    capture_performance: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '*',
      blockSelector: sensitiveSelector,
      recordBody: false,
      recordHeaders: false,
      captureCanvas: { recordCanvas: false },
      captureJsonLd: false,
      maskCapturedNetworkRequestFn: (request) => redactCapturedRequest(request, { blockedPathSegments }),
    },
  };
}

const noop = () => {};

function quietly(fn) {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

/**
 * @param {object} deps
 * @param {object} deps.sdk      posthog-js (or a stub with the same methods)
 * @param {object} deps.router   { getPath(): string, subscribe(cb): () => void }
 * @param {object} deps.consent  { get(): 'granted'|'denied'|'unknown', subscribe(cb): () => void }
 * @param {object} deps.config   { token, host, safePaths?, blockedPathSegments? }
 */
export function createReplayController({ sdk, router, consent, config = {} } = {}) {
  const token = typeof config.token === 'string' ? config.token.trim() : '';
  const host = typeof config.host === 'string' ? config.host.trim() : '';
  const safePaths = config.safePaths ?? SAFE_JOURNEY_PATHS;
  const blockedPathSegments = config.blockedPathSegments ?? BLOCKED_PATH_SEGMENTS;
  const enabled = Boolean(token && host);

  const state = {
    initialized: false,
    recording: false,
    detach: null,
    lastStop: null,
  };

  function readConsent() {
    const value = quietly(() => consent?.get?.());
    return value === 'granted' || value === 'denied' ? value : 'unknown';
  }

  function currentPath() {
    const value = quietly(() => router?.getPath?.());
    return typeof value === 'string' && value ? value : '/';
  }

  function init() {
    if (!enabled || state.initialized) return;
    // Somebody already created the browser singleton: keep its settings.
    if (sdk && sdk.__loaded === true) {
      state.initialized = true;
      return;
    }
    const ok = quietly(() => {
      sdk.init(token, buildReplayOptions({ host, blockedPathSegments }));
      return true;
    });
    state.initialized = ok === true;
  }

  function start() {
    if (!state.initialized || state.recording) return;
    if (!isSafeJourneyPath(currentPath(), safePaths)) return;
    const ok = quietly(() => {
      sdk.opt_in_capturing();
      // Plain start: no boolean, no override object. Project enablement,
      // sampling, triggers, minimum duration and authorised domains still apply.
      sdk.startSessionRecording();
      return true;
    });
    state.recording = ok === true;
  }

  function stop(reason) {
    state.lastStop = reason;
    if (!state.recording) return;
    state.recording = false;
    quietly(() => sdk.stopSessionRecording());
  }

  function optOut(reason) {
    stop(reason);
    quietly(() => sdk.opt_out_capturing());
  }

  /** Re-read consent and route, then move to the state they describe. */
  function apply(reason) {
    if (!enabled || !state.initialized) return;
    const choice = readConsent();
    if (choice === 'denied') {
      optOut(reason);
      return;
    }
    if (choice !== 'granted') {
      // Unknown is not consent.
      stop(reason);
      return;
    }
    if (!isSafeJourneyPath(currentPath(), safePaths)) {
      stop(reason);
      return;
    }
    start();
  }

  /**
   * Attach to consent and to the router. Calling it again (a React remount, a
   * StrictMode double effect) re-uses the existing listeners and does not
   * re-init or re-start anything.
   */
  function mount() {
    if (!enabled) return noop;
    init();
    if (state.detach) return state.detach;

    const offConsent = quietly(() => consent?.subscribe?.(() => apply('consent'))) ?? noop;
    const offRouter = quietly(() => router?.subscribe?.(() => apply('route'))) ?? noop;

    state.detach = () => {
      quietly(offConsent);
      quietly(offRouter);
      state.detach = null;
    };

    apply('mount');
    return state.detach;
  }

  return {
    mount,
    /** Stop recording without touching consent (a deliberate journey exit). */
    exit: (reason = 'exit') => stop(reason),
    /** Withdraw: stop recording and opt the visitor out. */
    revoke: (reason = 'revoked') => optOut(reason),
    status: () => ({
      enabled,
      initialized: state.initialized,
      recording: state.recording,
      lastStop: state.lastStop,
    }),
  };
}
