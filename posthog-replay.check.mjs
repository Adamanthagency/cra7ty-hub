/**
 * Offline checks for the session-replay integration.
 *
 * Run with:  node posthog-replay.check.mjs
 *
 * The real controller (`src/lib/replay-controller.mjs`) is imported directly —
 * no copies, no transpiling, no loader — and driven with stubbed SDK, router
 * and consent. No network, no real token: the only token in here is synthetic
 * and is injected straight into the config object.
 */

import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Environment starts empty: no NEXT_PUBLIC_ / POSTHOG_* values leak into a check.
for (const key of Object.keys(process.env)) {
  if (key.startsWith('NEXT_PUBLIC_') || key.startsWith('POSTHOG_')) delete process.env[key];
}

const {
  BLOCKED_PATH_SEGMENTS,
  SAFE_JOURNEY_PATHS,
  buildReplayOptions,
  createReplayController,
  isSafeJourneyPath,
  isSensitivePath,
  redactCapturedRequest,
  sanitizeReplayUrl,
} = await import('./src/lib/replay-controller.mjs');

const ROOT = dirname(fileURLToPath(import.meta.url));
const TOKEN = 'synthetic-project-token';
const HOST = 'https://eu.i.posthog.com';
const SITE = 'https://cra7tyhub.ng';

const readRepo = (file) => readFile(join(ROOT, file), 'utf8');
const exists = async (file) => {
  try {
    await stat(join(ROOT, file));
    return true;
  } catch {
    return false;
  }
};
const count = (sdk, name) => sdk.calls.filter((call) => call === name).length;

/** A stand-in for posthog-js that records every call it receives. */
function makeSdk({ failInit = false, failOptIn = false, loaded = false } = {}) {
  const sdk = {
    __loaded: loaded,
    calls: [],
    inits: [],
    startArgs: [],
    options: null,
    init(token, options) {
      sdk.calls.push('init');
      if (failInit) throw new Error('sdk unavailable');
      sdk.inits.push({ token, options });
      sdk.options = options;
      sdk.__loaded = true;
      return sdk;
    },
    opt_in_capturing() {
      sdk.calls.push('opt_in');
      if (failOptIn) throw new Error('opt-in unavailable');
    },
    opt_out_capturing() {
      sdk.calls.push('opt_out');
    },
    startSessionRecording(...args) {
      sdk.calls.push('start');
      sdk.startArgs.push(args);
    },
    stopSessionRecording() {
      sdk.calls.push('stop');
    },
  };
  return sdk;
}

/** A router stub: one current path, plus subscribe/unsubscribe bookkeeping. */
function makeRouter(initial = '/shop') {
  const router = {
    path: initial,
    listeners: new Set(),
    subs: 0,
    unsubs: 0,
    getPath: () => router.path,
    subscribe(callback) {
      router.subs += 1;
      router.listeners.add(callback);
      return () => {
        router.unsubs += 1;
        router.listeners.delete(callback);
      };
    },
    go(next) {
      router.path = next;
      for (const callback of [...router.listeners]) callback();
    },
  };
  return router;
}

/** A consent stub: the same three states the real source can report. */
function makeConsent(initial = 'unknown') {
  const consent = {
    value: initial,
    listeners: new Set(),
    get: () => consent.value,
    subscribe(callback) {
      consent.listeners.add(callback);
      return () => consent.listeners.delete(callback);
    },
    set(next) {
      consent.value = next;
      for (const callback of [...consent.listeners]) callback();
    },
  };
  return consent;
}

function wire({ consent = 'unknown', path = '/shop', sdk = makeSdk(), config } = {}) {
  const router = makeRouter(path);
  const store = makeConsent(consent);
  const controller = createReplayController({
    sdk,
    router,
    consent: store,
    config: config ?? { token: TOKEN, host: HOST },
  });
  return { sdk, router, consent: store, controller };
}

test('a missing token or host never initialises the SDK', () => {
  const configs = [
    { token: '', host: HOST },
    { token: TOKEN, host: '' },
    { token: '   ', host: '   ' },
  ];
  for (const config of configs) {
    const { sdk, consent, controller } = wire({ consent: 'granted', config });
    const detach = controller.mount();
    assert.equal(sdk.inits.length, 0, 'no init without a token and a host');
    assert.equal(count(sdk, 'opt_in'), 0);
    assert.equal(count(sdk, 'start'), 0);
    assert.equal(controller.status().enabled, false);
    detach();
    // A grant after mounting still records nothing.
    consent.set('granted');
    assert.equal(count(sdk, 'start'), 0);
  }
});

test('unknown and denied consent never record', () => {
  const { sdk, consent, controller } = wire({ consent: 'unknown' });
  controller.mount();
  assert.equal(sdk.inits.length, 1, 'the client exists so consent can turn it on');
  assert.equal(sdk.inits[0].options.opt_out_capturing_by_default, true);
  assert.equal(count(sdk, 'start'), 0);
  assert.equal(count(sdk, 'opt_in'), 0);

  consent.set('denied');
  assert.equal(count(sdk, 'start'), 0);
  assert.equal(controller.status().recording, false);
});

test('a safe grant starts recording once, plainly', () => {
  const { sdk, router, consent, controller } = wire({ consent: 'unknown' });
  controller.mount();
  consent.set('granted');

  assert.equal(count(sdk, 'opt_in'), 1);
  assert.equal(count(sdk, 'start'), 1);
  assert.deepEqual(sdk.startArgs[0], [], 'no boolean and no override object');

  // More consent events and more safe navigations do not start a second one.
  consent.set('granted');
  router.go('/blog');
  router.go('/products/origami-crane-single');
  router.go('/');
  assert.equal(count(sdk, 'start'), 1);
  assert.equal(count(sdk, 'opt_in'), 1);
});

test('remounts add no duplicate init, start or listeners', () => {
  const { sdk, router, consent, controller } = wire({ consent: 'granted' });
  const detach = controller.mount();
  assert.equal(router.listeners.size, 1);
  assert.equal(consent.listeners.size, 1);

  // StrictMode style double mount, without an unmount in between.
  controller.mount();
  assert.equal(router.listeners.size, 1);
  assert.equal(consent.listeners.size, 1);

  detach();
  assert.equal(router.listeners.size, 0);
  assert.equal(consent.listeners.size, 0);
  assert.equal(router.unsubs, router.subs);

  const again = controller.mount();
  assert.equal(sdk.inits.length, 1, 'the client is initialised once per tab');
  assert.equal(count(sdk, 'start'), 1, 'already recording, so no second start');
  assert.equal(router.listeners.size, 1);
  assert.equal(consent.listeners.size, 1);
  again();
});

test('sensitive routes, exit and revocation stop the recording', () => {
  const { sdk, router, controller } = wire({ consent: 'granted' });
  controller.mount();
  assert.equal(controller.status().recording, true);

  router.go('/checkout');
  assert.equal(controller.status().recording, false);
  assert.equal(count(sdk, 'stop'), 1);

  router.go('/shop');
  assert.equal(controller.status().recording, true, 'the safe journey resumes');

  router.go('/account/7f3c2b1a-1111-4222-8333-444455556666');
  assert.equal(controller.status().recording, false);

  router.go('/shop');
  controller.exit();
  assert.equal(controller.status().recording, false);
  assert.equal(controller.status().lastStop, 'exit');
});

test('withdrawal opts out, and a denied visitor who returns stays stopped', () => {
  const { sdk, router, consent, controller } = wire({ consent: 'granted' });
  controller.mount();
  assert.equal(count(sdk, 'opt_out'), 0, 'consented analytics is never opted out globally');

  consent.set('denied');
  assert.equal(count(sdk, 'opt_out'), 1);
  assert.equal(count(sdk, 'stop'), 1);
  assert.equal(controller.status().recording, false);

  // Back on a safe page, and remounting the whole thing, keeps it off.
  router.go('/shop');
  assert.equal(count(sdk, 'start'), 1);
  controller.mount()();
  controller.mount();
  router.go('/blog');
  assert.equal(count(sdk, 'start'), 1);
  assert.equal(controller.status().recording, false);
});

test('SDK failures keep the app and the consent surface working', () => {
  const failingInit = makeSdk({ failInit: true });
  const broken = wire({ consent: 'granted', sdk: failingInit });
  assert.doesNotThrow(() => broken.controller.mount());
  assert.equal(broken.controller.status().initialized, false);
  assert.doesNotThrow(() => broken.consent.set('denied'));
  assert.doesNotThrow(() => broken.consent.set('granted'));
  assert.equal(count(failingInit, 'start'), 0);

  const failingOptIn = makeSdk({ failOptIn: true });
  const halfBroken = wire({ consent: 'granted', sdk: failingOptIn });
  assert.doesNotThrow(() => halfBroken.controller.mount());
  assert.equal(halfBroken.controller.status().recording, false);
  assert.doesNotThrow(() => halfBroken.controller.mount()());
});

test('a new client starts opted out with every optional channel off', () => {
  const { sdk, controller } = wire({ consent: 'granted' });
  controller.mount();
  const options = sdk.inits[0].options;

  assert.equal(options.api_host, HOST);
  assert.equal(options.opt_out_capturing_by_default, true);
  assert.equal(options.disable_session_recording, true);
  for (const channel of [
    'autocapture',
    'capture_pageview',
    'capture_pageleave',
    'capture_dead_clicks',
    'rageclick',
    'capture_exceptions',
    'capture_heatmaps',
    'enable_recording_console_log',
    'capture_performance',
  ]) {
    assert.equal(options[channel], false, `${channel} must be off locally`);
  }

  const replay = options.session_recording;
  assert.equal(replay.maskAllInputs, true);
  assert.equal(replay.maskTextSelector, '*');
  assert.equal(replay.recordBody, false);
  assert.equal(replay.recordHeaders, false);
  assert.deepEqual(replay.captureCanvas, { recordCanvas: false });
  assert.equal(replay.captureJsonLd, false);
  assert.equal(replay.recordCanvas, undefined, 'canvasCapture is the tuning field, not the switch');
  assert.match(replay.blockSelector, /\.ph-no-capture/);
  assert.match(replay.blockSelector, /\[data-ph-sensitive\]/);
  assert.equal(typeof replay.maskCapturedNetworkRequestFn, 'function');
});

test('an already-loaded client keeps its settings without a second init', () => {
  const sdk = makeSdk({ loaded: true });
  const { controller } = wire({ consent: 'granted', sdk });
  controller.mount();
  assert.equal(sdk.inits.length, 0);
  assert.equal(sdk.options, null);
  assert.equal(count(sdk, 'opt_in'), 1, 'consent still governs the existing client');
  assert.equal(count(sdk, 'start'), 1);
});

test('the URL hook strips query and fragment and drops unsafe URLs', () => {
  const hook = buildReplayOptions({ host: HOST }).session_recording.maskCapturedNetworkRequestFn;

  const redacted = hook({
    name: `${SITE}/shop?email=someone%40example.com&token=abc123#access_token=zzz`,
    method: 'GET',
    statusCode: 200,
  });
  assert.equal(redacted.name, `${SITE}/shop`);
  assert.equal(redacted.method, 'GET', 'unrelated request fields survive');
  assert.equal(redacted.statusCode, 200);

  assert.equal(hook({ url: `${SITE}/products/origami-crane-single?utm_source=news#top` }).name, `${SITE}/products/origami-crane-single`);

  for (const blocked of [
    `${SITE}/account/42`,
    `${SITE}/checkout?step=2`,
    `${SITE}/orders/9f8e7d6c-1111-4222-8333-444455556666`,
    `${SITE}/login`,
    `${SITE}/billing`,
    `/payment?token=abc`,
    `${SITE}/account/someone@example.com`,
  ]) {
    assert.equal(hook({ name: blocked }), null, `${blocked} must be dropped`);
  }

  for (const malformed of [
    'not a url',
    '',
    '   ',
    'javascript:alert(1)',
    'data:text/html,<svg/>',
    'https://',
    '//evil.example/shop',
    null,
    42,
    {},
    [],
  ]) {
    const request = malformed && typeof malformed === 'object' ? malformed : { name: malformed };
    assert.equal(hook(request), null, `${String(malformed)} must be dropped`);
  }

  assert.equal(sanitizeReplayUrl('/shop?category=origami#top'), '/shop');
  assert.equal(sanitizeReplayUrl('/'), '/');
  assert.equal(sanitizeReplayUrl('https://cra7tyhub.ng/blog/how-a-crane-is-folded?ref=x#y'), 'https://cra7tyhub.ng/blog/how-a-crane-is-folded');
  assert.equal(redactCapturedRequest({ name: `${SITE}/shop#x` }).name, `${SITE}/shop`);
  assert.equal(redactCapturedRequest({ name: `${SITE}/checkout` }), null);
});

test('the safe journey and the blocked routes are the ones this site has', () => {
  assert.deepEqual(SAFE_JOURNEY_PATHS, ['/', '/shop', '/about', '/blog', '/products']);
  for (const path of ['/', '/shop', '/shop?category=party', '/about', '/blog', '/blog/how-a-crane-is-folded', '/products/party-pack-20-guests']) {
    assert.equal(isSafeJourneyPath(path), true, `${path} is a safe journey path`);
  }
  for (const path of ['/checkout', '/account', '/account/123', '/login', '/payment', '/orders']) {
    assert.equal(isSafeJourneyPath(path), false, `${path} is not`);
  }
  assert.equal(isSensitivePath('/blog/how-the-bulk-tiers-work'), false);
  assert.ok(BLOCKED_PATH_SEGMENTS.includes('checkout'));
});

test('the real app entry mounts this controller', async () => {
  const layout = await readRepo('src/app/layout.tsx');
  assert.match(layout, /<ReplayAnalytics\s*\/>/, 'the root layout renders the mount');
  assert.match(layout, /from '@\/components\/ReplayAnalytics'/);

  const mount = await readRepo('src/components/ReplayAnalytics.tsx');
  assert.match(mount, /'use client'/);
  assert.match(mount, /from '@\/lib\/replay'/);
  assert.match(mount, /replayController\.mount\(\)/);

  const wiring = await readRepo('src/lib/replay.ts');
  assert.match(wiring, /from 'posthog-js'/, 'the app imports the real SDK');
  assert.match(wiring, /from '@\/lib\/replay-controller\.mjs'/, 'and injects it into the tested controller');
  assert.match(wiring, /consent: replayConsentSource/);
  assert.match(wiring, /NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN/);
  assert.match(wiring, /NEXT_PUBLIC_POSTHOG_HOST/);

  const controller = await readRepo('src/lib/replay-controller.mjs');
  assert.doesNotMatch(controller, /\bfetch\s*\(|XMLHttpRequest|import\('posthog-js'\)/, 'no network and no SDK import in the controller');
  assert.doesNotMatch(controller, /startSessionRecording\s*\(\s*(true|\{)/, 'start is never forced past ingestion controls');
  assert.match(controller, /startSessionRecording\(\)/);
});

test('the manifest, the lock and the resolution pin posthog-js 1.438.13', async () => {
  const pkg = JSON.parse(await readRepo('package.json'));
  assert.equal(pkg.dependencies['posthog-js'], '1.438.13');

  const lock = JSON.parse(await readRepo('package-lock.json'));
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.packages[''].dependencies['posthog-js'], '1.438.13', 'the importer itself declares it');
  const entry = lock.packages['node_modules/posthog-js'];
  assert.equal(entry.version, '1.438.13');
  assert.match(entry.resolved, /posthog-js-1\.438\.13\.tgz$/);

  const installed = JSON.parse(await readRepo('node_modules/posthog-js/package.json'));
  assert.equal(installed.version, '1.438.13');

  const locks = (await readdir(ROOT)).filter((file) =>
    /^(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/.test(file),
  );
  assert.deepEqual(locks, ['package-lock.json'], 'one npm lock at the root, and no yarn/pnpm/bun lock');
  assert.equal(await exists('yarn.lock'), false);
  assert.equal(await exists('pnpm-lock.yaml'), false);
  assert.equal(await exists('bun.lockb'), false);
});

test('no live PostHog credential literal and no empty-token surprise', async () => {
  const files = [
    'src/lib/replay-controller.mjs',
    'src/lib/replay.ts',
    'src/lib/replay-consent.ts',
    'src/components/ReplayAnalytics.tsx',
    'src/components/ReplayConsent.tsx',
    'src/app/layout.tsx',
    'src/components/OrderDrawer.tsx',
    '.env.example',
    'posthog-replay.check.mjs',
    'POSTHOG_REPLAY.md',
  ];
  for (const file of files) {
    const contents = await readRepo(file);
    assert.doesNotMatch(contents, /ph[cx]_[A-Za-z0-9]{8,}/, `${file} must not carry a project or personal key`);
  }

  const example = await readRepo('.env.example');
  assert.match(example, /^NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=\s*$/m, 'the example token stays empty');
  assert.match(example, /^NEXT_PUBLIC_POSTHOG_HOST=\s*$/m, 'the example host stays empty');
});
