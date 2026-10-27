/**
 * Digital delivery: the grant ledger, signed download URLs and the
 * validity states the UI renders (Tier 5).
 *
 * WHAT IS STORED vs WHAT IS SIGNED:
 *   order_downloads holds the FILE REFERENCE (bucket-relative path) and
 *   when the current URL was minted. It never holds a URL — signed URLs
 *   expire, and a stored one would be a permanent credential sitting in
 *   a table. Every read mints a fresh URL from the path.
 *
 * WHY THE GRANT SNAPSHOT ITS PATH: replacing a product's file must not
 * rewrite what an earlier buyer was sold (and must not break their
 * link). Because the path is copied onto the grant at confirmation
 * time, a later upload to a NEW path leaves old grants pointing at the
 * object they were sold. Deleting the object is the one case that does
 * break them — surfaced as `missing`, never as a dead link.
 *
 * EXPIRY: LINK_TTL_SECONDS = 72 h. Long enough that a Friday-night
 * purchase still works on Monday (48 h is not), short enough that a
 * leaked link ages out quickly — and irrelevant to real security,
 * because any holder can mint a fresh one through the rate-limited
 * resend path in a single click.
 */

import { rest } from '@/lib/server/supabase-server';

export const DIGITAL_BUCKET = 'digital-files';

/** Signed download links live for 72 hours. */
export const LINK_TTL_SECONDS = 72 * 60 * 60;

/** Server-side ceiling on one digital file (the bucket cannot hold it). */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

/** One state per grant — exactly what the UI branches on. */
export type DownloadState = 'valid' | 'expired' | 'missing';

export interface DownloadGrant {
  id: string;
  productId: string;
  productName: string;
  storagePath: string;
  filename: string;
  issuedAt: string;
  linkExpiresAt: string | null;
  emailSentAt: string | null;
  resendCount: number;
}

export interface DownloadView {
  productId: string;
  name: string;
  filename: string;
  state: DownloadState;
  /** Present only when state === 'valid'. */
  url?: string;
  /** ISO expiry of the URL just minted (state 'valid'), or of the lapsed one. */
  expiresAt: string;
}

interface GrantRow {
  id: string;
  product_id: string;
  product_name: string;
  storage_path: string;
  filename: string;
  issued_at: string;
  link_expires_at: string | null;
  email_sent_at: string | null;
  resend_count: number;
}

const GRANT_COLUMNS =
  'id,product_id,product_name,storage_path,filename,issued_at,link_expires_at,email_sent_at,resend_count';

function toGrant(row: GrantRow): DownloadGrant {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    storagePath: row.storage_path,
    filename: row.filename,
    issuedAt: row.issued_at,
    linkExpiresAt: row.link_expires_at,
    emailSentAt: row.email_sent_at,
    resendCount: row.resend_count,
  };
}

/** Every grant on an order, oldest first. Service-role only (deny-all RLS). */
export async function loadGrants(orderId: string): Promise<DownloadGrant[]> {
  const { data, error } = await rest<GrantRow[]>(
    'GET',
    'order_downloads',
    `order_id=eq.${encodeURIComponent(orderId)}` +
      `&select=${GRANT_COLUMNS}&order=issued_at.asc`,
  );
  if (error || !data) {
    // A grant read failure must not take the lookup page down — the
    // order status is still valid information. Surfaced as no digital
    // block rather than as an error the customer cannot act on.
    console.error('[downloads] could not read grants:', error ?? 'empty response');
    return [];
  }
  return data.map(toGrant);
}

/**
 * Mint a signed URL for one object. Returns the raw response, which is
 * either `{ signedURL }` (a PATH, not absolute — see below) or `{ error }`.
 *
 * The Storage sign endpoint returns `/object/sign/<bucket>/<path>?token=…`
 * relative to the project origin; we make it absolute against the
 * SUPABASE origin so the browser does not have to know where Storage
 * lives relative to the storefront.
 */
async function signPath(
  storagePath: string,
  ttlSeconds: number,
): Promise<{ url: string } | { error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: 'SUPABASE_NOT_CONFIGURED' };

  const encoded = storagePath
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  const response = await fetch(
    `${url}/storage/v1/object/sign/${DIGITAL_BUCKET}/${encoded}`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: ttlSeconds }),
      cache: 'no-store',
    },
  );

  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // keep raw
    }
    return { error: message || `HTTP ${response.status}` };
  }

  try {
    const parsed = JSON.parse(text) as { signedURL?: string };
    if (!parsed.signedURL) return { error: 'no signedURL in response' };
    const signed = parsed.signedURL.startsWith('http')
      ? parsed.signedURL
      : `${url}/storage/v1${parsed.signedURL}`;
    return { url: signed };
  } catch {
    return { error: 'unparseable sign response' };
  }
}

/**
 * Does the object still exist? Used to tell "expired" (the file is
 * there, the link lapsed) from "missing" (the file itself is gone) —
 * the two need different copy and different actions.
 */
async function objectExists(storagePath: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const encoded = storagePath
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  const response = await fetch(
    `${url}/storage/v1/object/${DIGITAL_BUCKET}/${encoded}`,
    {
      method: 'HEAD',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    },
  );
  return response.ok;
}

/**
 * Turn stored grants into what a page or an email can show.
 *
 * THE RECORDED WINDOW DECIDES THE STATE — this is the whole point of
 * `link_expires_at`, and minting unconditionally would break it:
 * if every read just minted a fresh URL, `expired` could never render,
 * the Resend button would be unreachable dead code, and we would be
 * silently renewing a link we had already told the buyer had expired.
 *
 *   window lapsed  → `expired` (no mint; the buyer re-issues on purpose)
 *   window open    → mint now → `valid`
 *   never issued   → mint now, record the window → `valid`
 *   object gone    → `missing` (never a dead link, never an error)
 *
 * The window is recorded ONCE, at first issue, so the page and the
 * emailed link agree on when they die. A resend re-records it.
 *
 * `now` is injectable so tests can prove the expired branch without
 * waiting three days or backdating rows by hand.
 */
export async function buildDownloadViews(
  grants: DownloadGrant[],
  now: Date = new Date(),
): Promise<DownloadView[]> {
  const views: DownloadView[] = [];

  for (const grant of grants) {
    const issuedAt = grant.linkExpiresAt === null ? null : new Date(grant.linkExpiresAt);
    const lapsed = issuedAt !== null && issuedAt.getTime() <= now.getTime();

    if (lapsed) {
      views.push({
        productId: grant.productId,
        name: grant.productName,
        filename: grant.filename,
        state: 'expired',
        expiresAt: grant.linkExpiresAt as string,
      });
      continue;
    }

    const signed = await signPath(grant.storagePath, LINK_TTL_SECONDS);

    if ('url' in signed) {
      // First issue records the window; later reads reuse it so the page
      // never claims a later expiry than the link the buyer already has.
      const expiresAt =
        issuedAt?.toISOString() ??
        (await markLinkIssued(grant.id, now)) ??
        new Date(now.getTime() + LINK_TTL_SECONDS * 1000).toISOString();

      views.push({
        productId: grant.productId,
        name: grant.productName,
        filename: grant.filename,
        state: 'valid',
        // `download=<name>` makes Storage answer with
        // `Content-Disposition: attachment; filename=…` (verified against
        // the live API), so a PDF saves as its real filename instead of
        // opening in a tab. Without it the browser decides.
        url: `${signed.url}${signed.url.includes('?') ? '&' : '?'}download=${encodeURIComponent(grant.filename)}`,
        expiresAt,
      });
      continue;
    }

    // Signing failed. Distinguish the two reasons that need different
    // copy: the object is gone (missing) vs a transient failure, which
    // must NOT be mislabelled as expired when the window is still open.
    const exists = await objectExists(grant.storagePath);
    if (!exists) {
      views.push({
        productId: grant.productId,
        name: grant.productName,
        filename: grant.filename,
        state: 'missing',
        expiresAt: grant.linkExpiresAt ?? now.toISOString(),
      });
      continue;
    }

    console.error('[downloads] sign failed for a live grant:', signed.error);
  }

  return views;
}

/**
 * Record that a URL was minted, so the My Order page can show an
 * expired state later without holding the URL itself.
 *
 * Returns the new expiry, or null when the write failed (the link the
 * caller already holds still works — the bookkeeping is best-effort and
 * must never break delivery).
 */
export async function markLinkIssued(grantId: string, now: Date = new Date()): Promise<string | null> {
  const expiresAt = new Date(now.getTime() + LINK_TTL_SECONDS * 1000).toISOString();
  const { error } = await rest(
    'PATCH',
    'order_downloads',
    `id=eq.${encodeURIComponent(grantId)}`,
    { link_expires_at: expiresAt },
  );
  if (error) {
    console.error('[downloads] could not record link issue time:', error);
    return null;
  }
  return expiresAt;
}

/** Record that a resend email actually went out (audit + rate evidence). */
export async function markEmailSent(grantId: string): Promise<void> {
  const { error } = await rest(
    'PATCH',
    'order_downloads',
    `id=eq.${encodeURIComponent(grantId)}`,
    { email_sent_at: new Date().toISOString() },
  );
  if (error) console.error('[downloads] could not record email send:', error);
}

/**
 * Bump the resend counter and refresh the expiry window — called after
 * a resend request has been authenticated, whether or not the mail
 * provider accepted the message, so hammering the endpoint shows up.
 */
export async function recordResend(grantId: string, now: Date = new Date()): Promise<string | null> {
  const expiresAt = new Date(now.getTime() + LINK_TTL_SECONDS * 1000).toISOString();

  // Read the current counter first, then write it back incremented. The
  // REST helper has no `resend_count = resend_count + 1` form, so this is
  // two round trips — acceptable because the endpoint is rate-limited
  // anyway, and it keeps the counter honest rather than resetting it.
  const read = await rest<{ resend_count: number }[]>(
    'GET',
    'order_downloads',
    `id=eq.${encodeURIComponent(grantId)}&select=resend_count&limit=1`,
  );
  if (read.error || !read.data || read.data.length === 0) {
    console.error('[downloads] could not read resend state:', read.error ?? 'no row');
    return null;
  }

  const next = (read.data[0].resend_count ?? 0) + 1;
  const { error } = await rest(
    'PATCH',
    'order_downloads',
    `id=eq.${encodeURIComponent(grantId)}`,
    { resend_count: next, link_expires_at: expiresAt },
  );
  if (error) {
    console.error('[downloads] could not refresh resend state:', error);
    return null;
  }
  return expiresAt;
}

/** Exposed for the admin sign route and tests: is this path well-formed? */
export function isSafeStoragePath(path: string): boolean {
  if (!path || path.length > 300) return false;
  if (path.startsWith('/') || path.includes('..')) return false;
  return path
    .split('/')
    .every((segment) => segment.length > 0 && !/[\0\\]/.test(segment));
}
