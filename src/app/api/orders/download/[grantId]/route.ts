import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, serviceConfigured } from '@/lib/server/supabase-server';
import {
  claimGrant,
  completeTransfer,
  loadGrant,
  objectExists,
  releaseClaim,
  signPath,
  TRANSFER_LEASE_MS,
} from '@/lib/server/downloads';

/**
 * GET /api/orders/download/[grantId] — the ONE way a buyer ever
 * receives a digital file (Tier 8).
 *
 * WHY THIS ROUTE EXISTS AT ALL (the whole design rests on it):
 * buyers used to be sent straight to a Supabase signed URL, so the
 * bytes went Supabase → browser and this server never saw the transfer.
 * The only signals it could ever observe were "link minted" and "link
 * clicked" — and the client's rule is that neither one may lock a file.
 * To know that a download REALLY finished, the file has to pass through
 * here. So the browser talks to us, we fetch from Supabase with a
 * short-lived server-side signed URL (never sent to a browser), and we
 * stream it out.
 *
 * WHEN THE LOCK IS WRITTEN — `downloaded_at` is set only when BOTH:
 *   1. upstream Supabase reached EOF, i.e. every byte of the object was
 *      read, and
 *   2. every one of those bytes was handed to the response writer
 *      without the request being aborted (this signal's `cancel`, or
 *      `request.signal` firing, means the client went away first).
 * Anything else — client cancels, network drops, upstream fails, the
 * function dies — releases the claim and the file stays available for
 * a retry. That is the direction the client asked for: a buyer who
 * never received the file is never locked out.
 *
 * WHAT "COMPLETED" CANNOT MEAN: we see every byte leave this server,
 * not every byte land on the customer's disk — TCP has no
 * application-level receipt, and no design that streams over HTTP can
 * do better. The gap only closes for a client that disconnects in the
 * few-hundred-KB window after the last byte was accepted by our socket,
 * which means it already had essentially the whole file. The opposite
 * choice (lock on click/first byte) would break the client's first
 * requirement outright, so this is the honest trade.
 *
 * CAPABILITY: the grant id is a random uuid — as unguessable as the
 * bearer signed URL it replaces, and single-use besides. No identity
 * check here: reaching this URL means you already proved identity on
 * the order page (or hold the emailed link), exactly as before.
 */

export const dynamic = 'force-dynamic';

/** Stream a file from Supabase and relay it; a big one needs headroom
 *  beyond the platform default, and a function killed at the limit
 *  releases the claim rather than locking anything. */
export const maxDuration = 60;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `Content-Disposition` with both forms: a quoted ASCII fallback and
 * RFC 5987 for real filenames (₦, spaces, non-Latin). Quotes, CR and
 * LF are stripped from the ASCII form — header injection through a
 * filename is the only thing standing between this line and a
 * response-splitting bug.
 */
function contentDisposition(filename: string): string {
  const clean = filename.replace(/[\r\n"\\]/g, '').trim() || 'download';
  const ascii = clean.replace(/[^\x20-\x7e]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

/** A branded, readable end state — the browser follows this link
 *  directly, so a bare JSON error would be what a buyer actually sees. */
function page(status: number, title: string, body: string): NextResponse {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — Cra7ty Hub</title></head>
<body style="margin:0;padding:48px 20px;background:#f4f1ec;font-family:Georgia,'Times New Roman',serif;color:#1c1a17;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e2da;padding:32px;">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#7a756c;">Cra7ty Hub</p>
<h1 style="margin:12px 0 12px;font-size:24px;line-height:1.25;font-weight:normal;">${title}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a453e;">${body}</p>
<p style="margin:0"><a href="/tracker" style="color:#c2410c;">Back to your order</a></p>
</div></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { grantId: string } },
) {
  if (!serviceConfigured()) {
    return page(503, 'Not available yet', 'Digital downloads are not configured on this server right now — please try again shortly.');
  }

  const grantId = params.grantId ?? '';
  if (!UUID.test(grantId)) {
    return page(404, 'Not found', 'That download link is not valid. Open your order page to find your files.');
  }

  // Costs quota but never burns a download: a scraper hammering a link
  // cannot spend the buyer's one attempt this way.
  if (!(await rateLimit('download', 20, 60, request))) {
    return page(429, 'Too many requests', 'Please wait a moment and try the download again.');
  }

  const grant = await loadGrant(grantId);
  if (!grant) {
    return page(404, 'Not found', 'That download link is not valid. Open your order page to find your files.');
  }

  // ---- claim: the atomic gate ---------------------------------------
  const claim = await claimGrant(grantId);
  if (claim === 'downloaded') {
    return page(
      410,
      'Already downloaded',
      `“${escapeHtml(grant.filename)}” has already been downloaded, and each file can only be downloaded once. To get it again, buy it again — or message the studio on your order page and we will help.`,
    );
  }
  if (claim === 'busy') {
    return page(
      409,
      'Download in progress',
      'This file is already being downloaded. Wait for that to finish, then try again.',
    );
  }
  if (claim === 'not_found') {
    return page(404, 'Not found', 'That download link is not valid. Open your order page to find your files.');
  }
  if (claim === 'error') {
    return page(503, 'Could not start the download', 'We could not reach the database just now — nothing has been spent, please try again.');
  }

  // ---- fetch upstream (server-to-server, short-lived token) ---------
  const signed = await signPath(grant.storagePath);
  if ('error' in signed) {
    // Distinguish "the studio deleted the file" from "storage blinked":
    // only the first may be shown as gone, and neither locks anything.
    const exists = await objectExists(grant.storagePath);
    await releaseClaim(grantId);
    if (!exists) {
      return page(
        410,
        'File no longer available',
        'This file is no longer available — message the studio from your order page and we will sort it out.',
      );
    }
    console.error('[download] could not sign upstream URL:', signed.error);
    return page(502, 'Could not start the download', 'The file could not be fetched just now — nothing has been used, please try again.');
  }

  let upstream: Response;
  try {
    upstream = await fetch(signed.url, {
      cache: 'no-store',
      // Same horizon as the claim lease: a hung upstream cannot pin the
      // claim past the point where another request may take it.
      signal: AbortSignal.timeout(TRANSFER_LEASE_MS),
    });
  } catch (error) {
    console.error('[download] upstream fetch failed:', (error as Error).message);
    await releaseClaim(grantId);
    return page(502, 'Could not start the download', 'The file could not be fetched just now — nothing has been used, please try again.');
  }

  if (!upstream.ok || !upstream.body) {
    console.error(`[download] upstream answered HTTP ${upstream.status}`);
    await releaseClaim(grantId);
    return page(502, 'Could not start the download', 'The file could not be fetched just now — nothing has been used, please try again.');
  }

  // ---- stream it out, and only then take the lock -------------------
  const reader = upstream.body.getReader();
  let aborted = false;

  const onClientGone = () => {
    // The buyer's connection dropped BEFORE we finished. Never a lock.
    if (aborted) return;
    aborted = true;
    void releaseClaim(grantId);
    void reader.cancel().catch(() => {});
  };
  request.signal.addEventListener('abort', onClientGone, { once: true });

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          // Every upstream byte has been read AND handed to a writer
          // that kept accepting them. This is the completion signal —
          // and the only place downloaded_at is ever written.
          if (aborted || request.signal.aborted) {
            await releaseClaim(grantId);
          } else {
            await completeTransfer(grantId);
          }
          controller.close();
          return;
        }
        controller.enqueue(value ?? new Uint8Array(0));
      } catch (error) {
        // Upstream error or a writer that stopped taking bytes: the
        // buyer keeps the file and may retry.
        console.error('[download] stream interrupted:', (error as Error).message);
        await releaseClaim(grantId);
        controller.error(error);
      }
    },
    async cancel() {
      // Next cancels this when the response socket closes early —
      // the same conclusion as an aborted request signal.
      aborted = true;
      await releaseClaim(grantId);
      await reader.cancel().catch(() => {});
    },
  });

  const headers = new Headers({
    'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    'Content-Disposition': contentDisposition(grant.filename),
    'Cache-Control': 'no-store',
    'Pragma': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  const length = upstream.headers.get('content-length');
  if (length) headers.set('Content-Length', length);

  return new NextResponse(body, { status: 200, headers });
}

/** Minimal escape — the filename comes from an admin-typed value and is
 *  interpolated into an HTML error page. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
