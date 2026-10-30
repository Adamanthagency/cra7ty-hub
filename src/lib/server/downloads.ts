/**
 * Digital delivery: the grant ledger, the ONE-TIME download state and
 * what the pages and the confirmation email render (Tiers 5, 7 and 8).
 *
 * WHAT IS STORED vs WHAT IS SIGNED:
 *   order_downloads holds the FILE REFERENCE (bucket-relative path) and
 *   the one-time download state. It never holds a URL — a stored one
 *   would be a permanent credential sitting in a table. Every read
 *   mints a fresh URL from the path... except that since Tier 8 the
 *   browser is never handed a storage URL at all: links point at
 *   /api/orders/download/<grantId>, which streams the bytes through
 *   this server so completion can be observed (see that route).
 *
 * WHY THE GRANT SNAPSHOT ITS PATH: replacing a product's file must not
 * rewrite what an earlier buyer was sold (and must not break their
 * link). Because the path is copied onto the grant at confirmation
 * time, a later upload to a NEW path leaves old grants pointing at the
 * object they were sold. Deleting the object is the one case that does
 * break them — surfaced as `missing`, never as a dead link.
 *
 * SINGLE-USE (Tier 8 — the client's confirmed rule):
 *   downloaded_at is written ONCE, by the download route, only after
 *   the whole file finished streaming with no client abort. From then
 *   the grant answers `downloaded` forever: no resend, no expiry, no
 *   admin reopen. Each GRANT locks independently, and a grant is one
 *   FILE — so a ten-file product has ten independent one-time locks.
 *
 *   The lock is written only on observed success and every failure
 *   path releases the claim instead, so the design's error direction is
 *   "a buyer who never received the file keeps access" — the case the
 *   client cares about. The residual risk runs the other way: we can
 *   see that every byte left this server, not that it reached the
 *   buyer's disk.
 */

import { rest } from '@/lib/server/supabase-server';

export const DIGITAL_BUCKET = 'digital-files';

/** Server-side ceiling on one digital file (the bucket cannot hold it). */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

/**
 * How long a transfer claim stays live. A request that dies mid-stream
 * (function killed, socket reset) cannot clean up after itself, so the
 * lease has to age out on its own — otherwise one crash would lock a
 * file that was never downloaded, which is precisely the failure this
 * feature must not create.
 */
export const TRANSFER_LEASE_MS = 10 * 60 * 1000;

/**
 * Lifetime of the server-side signed URL that is fetched ONCE and
 * streamed to the buyer. It never reaches a browser, so its only job is
 * to outlive the transfer of one file.
 */
export const UPSTREAM_TTL_SECONDS = 300;

/**
 * One state per grant — exactly what the UI branches on. The old
 * `valid | expired` axis is gone with the 72-hour window: a link that
 * has not been used still works, and one that has is gone for good.
 */
export type DownloadState = 'available' | 'downloaded' | 'missing';

export interface DownloadGrant {
  id: string;
  productId: string;
  productName: string;
  storagePath: string;
  filename: string;
  issuedAt: string;
  /** Null until the file has actually been downloaded — the lock. */
  downloadedAt: string | null;
  emailSentAt: string | null;
}

export interface DownloadView {
  /**
   * The GRANT ROW id — unique per file, not per product. One digital
   * product can ship up to 10 files (Tier 7), so productId is no
   * longer a key: this is what a list renders on and what the email
   * bookkeeping matches back to the right grant.
   */
  id: string;
  productId: string;
  name: string;
  filename: string;
  state: DownloadState;
  /**
   * Present only when state === 'available'. A path, not absolute:
   * pages render it as-is, the confirmation email prefixes siteUrl.
   */
  url?: string;
  /** Present only when state === 'downloaded'. */
  downloadedAt?: string;
}

interface GrantRow {
  id: string;
  product_id: string;
  product_name: string;
  storage_path: string;
  filename: string;
  issued_at: string;
  downloaded_at: string | null;
  email_sent_at: string | null;
}

/** link_expires_at and resend_count are RETIRED (Tier 8): not read. */
const GRANT_COLUMNS =
  'id,product_id,product_name,storage_path,filename,issued_at,downloaded_at,email_sent_at';

function toGrant(row: GrantRow): DownloadGrant {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    storagePath: row.storage_path,
    filename: row.filename,
    issuedAt: row.issued_at,
    downloadedAt: row.downloaded_at,
    emailSentAt: row.email_sent_at,
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

/** One grant by id — the download route's first step. */
export async function loadGrant(grantId: string): Promise<DownloadGrant | null> {
  const { data, error } = await rest<GrantRow[]>(
    'GET',
    'order_downloads',
    `id=eq.${encodeURIComponent(grantId)}&select=${GRANT_COLUMNS}&limit=1`,
  );
  if (error || !data) {
    console.error('[downloads] could not read grant:', error ?? 'empty response');
    return null;
  }
  return data.length === 1 ? toGrant(data[0]) : null;
}

/**
 * The one link shape the whole app uses: our own route, so the bytes
 * (and therefore the completion signal) pass through this server.
 * The grant id is a random uuid — unguessable, exactly as capable as
 * the bearer signed URL it replaces, and single-use besides.
 */
export function downloadPath(grantId: string): string {
  return `/api/orders/download/${encodeURIComponent(grantId)}`;
}

/**
 * Mint a signed URL for one object — SERVER-TO-SERVER ONLY. It is the
 * upstream the download route streams from, never something a browser
 * receives (if it did, the transfer would bypass this server and
 * completion could not be observed).
 *
 * The Storage sign endpoint returns `/object/sign/<bucket>/<path>?token=…`
 * relative to the project origin; we make it absolute against the
 * SUPABASE origin.
 */
export async function signPath(
  storagePath: string,
  ttlSeconds: number = UPSTREAM_TTL_SECONDS,
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
 * Does the object still exist? Told apart from "downloaded" because
 * the two need different copy and different actions: one is a file the
 * studio removed, the other is a file this buyer already used.
 */
export async function objectExists(storagePath: string): Promise<boolean> {
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
 *   downloaded_at set → `downloaded` (locked for good, no mint)
 *   object gone      → `missing`   (never a dead link, never an error)
 *   otherwise        → `available` (url = the one-time download route)
 *
 * There is no expiry branch any more: a link that has not been used
 * keeps working, because expiry plus no-resend would mean a Friday
 * buyer could be locked out on Monday without ever having downloaded
 * anything. Expiry is what the lock replaced, not a second gate.
 */
export async function buildDownloadViews(
  grants: DownloadGrant[],
): Promise<DownloadView[]> {
  const views: DownloadView[] = [];

  for (const grant of grants) {
    if (grant.downloadedAt !== null) {
      views.push({
        id: grant.id,
        productId: grant.productId,
        name: grant.productName,
        filename: grant.filename,
        state: 'downloaded',
        downloadedAt: grant.downloadedAt,
      });
      continue;
    }

    const exists = await objectExists(grant.storagePath);
    if (!exists) {
      views.push({
        id: grant.id,
        productId: grant.productId,
        name: grant.productName,
        filename: grant.filename,
        state: 'missing',
      });
      continue;
    }

    views.push({
      id: grant.id,
      productId: grant.productId,
      name: grant.productName,
      filename: grant.filename,
      state: 'available',
      url: downloadPath(grant.id),
    });
  }

  return views;
}

/* ------------------------------------------------------------------ */
/* The one-time claim: take → (stream) → complete | release            */
/* ------------------------------------------------------------------ */

export type ClaimResult = 'claimed' | 'downloaded' | 'busy' | 'not_found' | 'error';

/**
 * Atomically take the right to stream this file once.
 *
 * One conditional UPDATE does the whole job — `downloaded_at IS NULL`
 * AND the lease is free (never claimed, or stale by more than the
 * lease) — so two simultaneous requests can never both win: exactly one
 * row comes back. PostgREST has no `OR` across a top-level filter, so
 * the lease condition is one grouped `or=(…)` clause ANDed in.
 *
 * 'error' is deliberately NOT the same as 'claimed': when the database
 * cannot answer, we refuse to serve rather than risk handing out a file
 * twice. That fails safe for the lock and is retryable for the buyer.
 */
export async function claimGrant(
  grantId: string,
  now: Date = new Date(),
): Promise<ClaimResult> {
  const staleBefore = new Date(now.getTime() - TRANSFER_LEASE_MS).toISOString();
  const filter =
    `id=eq.${encodeURIComponent(grantId)}` +
    '&downloaded_at=is.null' +
    `&or=(transfer_started_at.is.null,transfer_started_at.lt.${encodeURIComponent(staleBefore)})`;

  const { data, error } = await rest<{ id: string }[]>(
    'PATCH',
    'order_downloads',
    filter,
    { transfer_started_at: now.toISOString() },
  );
  if (error) {
    console.error('[downloads] could not claim grant:', error);
    return 'error';
  }
  if (Array.isArray(data) && data.length === 1) return 'claimed';

  // Zero rows: find out which of the two conditions blocked us, so the
  // route can answer "already downloaded" instead of "busy".
  const read = await rest<{ downloaded_at: string | null }[]>(
    'GET',
    'order_downloads',
    `id=eq.${encodeURIComponent(grantId)}&select=downloaded_at&limit=1`,
  );
  if (read.error) {
    console.error('[downloads] could not read claim state:', read.error);
    return 'error';
  }
  if (!read.data || read.data.length === 0) return 'not_found';
  return read.data[0].downloaded_at ? 'downloaded' : 'busy';
}

/**
 * Give the claim back WITHOUT locking — the transfer did not finish, so
 * the buyer keeps their file. Conditional on `downloaded_at IS NULL`
 * so it can never undo a completed download if it races one.
 */
export async function releaseClaim(grantId: string): Promise<void> {
  const { error } = await rest(
    'PATCH',
    'order_downloads',
    `id=eq.${encodeURIComponent(grantId)}&downloaded_at=is.null`,
    { transfer_started_at: null },
  );
  if (error) console.error('[downloads] could not release transfer claim:', error);
}

/**
 * The lock: write downloaded_at for good. Returns whether this call
 * flipped the row (it will not if another writer got there first).
 *
 * A failed write leaves the file available — the bytes already went
 * out, so failing open is the only side that cannot cost a buyer their
 * purchase. It is logged loudly.
 */
export async function completeTransfer(
  grantId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { data, error } = await rest<{ id: string }[]>(
    'PATCH',
    'order_downloads',
    `id=eq.${encodeURIComponent(grantId)}&downloaded_at=is.null`,
    { downloaded_at: now.toISOString(), transfer_started_at: null },
  );
  if (error) {
    console.error('[downloads] could not record completed download:', error);
    return false;
  }
  return Array.isArray(data) && data.length === 1;
}

/** Record that a confirmation email actually went out (audit). */
export async function markEmailSent(grantId: string): Promise<void> {
  const { error } = await rest(
    'PATCH',
    'order_downloads',
    `id=eq.${encodeURIComponent(grantId)}`,
    { email_sent_at: new Date().toISOString() },
  );
  if (error) console.error('[downloads] could not record email send:', error);
}

/** Exposed for the admin sign route and tests: is this path well-formed? */
export function isSafeStoragePath(path: string): boolean {
  if (!path || path.length > 300) return false;
  if (path.startsWith('/') || path.includes('..')) return false;
  return path
    .split('/')
    .every((segment) => segment.length > 0 && !/[\0\\]/.test(segment));
}
