/**
 * Next.js changes the URL during client-side navigations (Link clicks, the
 * nav's /shop?category=… buttons) without firing `popstate`, so components
 * that read `window.location` miss them and drift out of sync until a hard
 * refresh. We wrap history.pushState/replaceState once and emit a window
 * event after every change — ours, Next's, or anything else's — so a
 * subscriber sees every URL the browser lands on.
 *
 * This keeps `window.location` reading (and therefore a whole prerendered
 * shelf in the static HTML) instead of useSearchParams, which would push
 * the grid behind a client-only Suspense boundary.
 */

const EVENT = 'cra7ty:urlchange';

let patched = false;

/** Wrap the history methods exactly once per tab. We call through to
 * whatever is installed (Next patched them first), so the router still
 * sees its own calls. */
function ensurePatched() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args) => {
      original(...args);
      window.dispatchEvent(new Event(EVENT));
    };
  }
}

/** Run `cb` after every URL change: history API calls and back/forward. */
export function onUrlChange(cb: () => void): () => void {
  ensurePatched();
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener('popstate', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('popstate', handler);
  };
}
