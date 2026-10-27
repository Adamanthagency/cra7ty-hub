import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, rest, rpc, serviceConfigured } from '@/lib/server/supabase-server';
import {
  buildDownloadViews,
  LINK_TTL_SECONDS,
  loadGrants,
  recordResend,
  type DownloadView,
} from '@/lib/server/downloads';
import { identityMatches, orderEmailAddress } from '@/lib/server/order-identity';
import { escapeHtml, sendEmail } from '@/lib/server/order-email';

/**
 * POST /api/orders/resend-download — re-issue the digital download
 * links for an order (Tier 5).
 *
 * WHY A SEPARATE ENDPOINT (not a flag on /api/orders/lookup):
 *   * lookup SHOWS links to whoever proves identity — no email needed,
 *     so phone-only proof is fine and the response is `no-store`;
 *   * resend SENDS email, which is a different, more abusable action
 *     and deserves its own, stricter budget. Sharing one route would
 *     mean one rate limit covering both, so a scraper burning lookup
 *     quota would also be burning the buyer's ability to recover a
 *     lost link — and vice versa.
 *   The IDENTITY PROOF is identical and shared (order-identity.ts), so
 *   there is no second auth path to get wrong.
 *
 * RATE LIMITS (both via the same check_rate_limit RPC as lookup; both
 * fail open like checkout, so a dead limiter never blocks a legitimate
 * buyer from recovering their files):
 *   * 3/min per IP     — `resend:<ip>`        (the house number)
 *   * 6/hour per ref   — `resend_ref:<ref>`   (global across IPs;
 *     this is the one that actually caps abuse: 6 recovery emails per
 *     order per hour, then a 60-second window rolls)
 *   Checked BEFORE parsing so garbage consumes quota too, and before
 *   any database read.
 *
 * NO OPEN RELAY: the mail always goes to `orders.customer_email` —
 * never to an address the caller supplies. A caller who proves they
 * own the order can only trigger a message to the address already on
 * it, which is where the original confirmation went anyway.
 *
 * NO LEAKAGE: every miss — unknown reference, wrong identity, bad
 * shape — returns one byte-identical 404 body, exactly like lookup.
 * A successful resend answers `{ ok: true }` with NO order details, so
 * the response cannot be used as an oracle either.
 */

export const dynamic = 'force-dynamic';

const IP_RATE = { limit: 3, windowSeconds: 60 };
const REF_RATE = { limit: 6, windowSeconds: 3600 };

const ORDER_NUMBER = /^CH-\d{3,6}$/;
const MAX_EMAIL = 320;
const MAX_PHONE = 60;

/** One constant for every miss — byte-identical across failure paths. */
const NOT_FOUND = { error: 'not_found' };

export async function POST(request: NextRequest) {
  if (!serviceConfigured()) {
    return NextResponse.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
  }

  // IP bucket first, before parsing: garbage consumes quota too.
  if (!(await rateLimit('resend', IP_RATE.limit, IP_RATE.windowSeconds, request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as {
    orderNumber?: unknown;
    email?: unknown;
    phone?: unknown;
  } | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const orderNumber =
    typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  // Structural validation only — says nothing about whether anything
  // exists, and answers differently from a miss (400 vs 404) purely
  // because a malformed request is not a probe.
  if (
    !ORDER_NUMBER.test(orderNumber) ||
    (!email && !phone) ||
    email.length > MAX_EMAIL ||
    phone.length > MAX_PHONE
  ) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Reference bucket: one counter for every IP working this reference.
  try {
    const allowed = await rpc<boolean>('check_rate_limit', {
      p_bucket: `resend_ref:${orderNumber}`,
      p_limit: REF_RATE.limit,
      p_window_seconds: REF_RATE.windowSeconds,
    });
    if (allowed !== true) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
  } catch {
    // Same fail-open posture as lookup, same visibility in logs.
    console.error('[resend] reference rate limiter unavailable — allowing request');
  }

  // Read the order by number only — server-side; the identity check
  // below still gates everything that follows.
  const { data, error } = await rest<{ id: string; customer_email: string; customer_phone: string; customer_name: string; order_number: string }[]>(
    'GET',
    'orders',
    `order_number=eq.${encodeURIComponent(orderNumber)}` +
      '&select=id,order_number,customer_email,customer_phone,customer_name&limit=1',
  );
  if (error || !data || data.length === 0) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }
  const order = data[0];

  if (!identityMatches({ email, phone }, order)) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  // Identity proven. Only now is anything read or written.
  const grants = await loadGrants(order.id);
  if (grants.length === 0) {
    // A physical-only order: same 404 as a miss. Telling the caller
    // "verified but nothing to resend" would confirm the reference
    // exists to someone who just proved identity — harmless, but the
    // uniform miss keeps the endpoint's surface minimal and the copy
    // simpler for the UI (which only offers this button when it has
    // already seen downloads).
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const views = await buildDownloadViews(grants);
  // Type predicate, not just a boolean filter: `.filter(v => v.url)`
  // would still leave `url` as `string | undefined` downstream.
  const usable = views.filter(
    (view): view is DownloadView & { url: string } =>
      view.state === 'valid' && typeof view.url === 'string',
  );

  if (usable.length === 0) {
    // Everything is missing (files deleted) — nothing to send. The UI
    // shows the "message the studio" path for this state instead.
    return NextResponse.json({ error: 'no_downloads' }, { status: 410 });
  }

  // ---- compose and send ------------------------------------------------
  const trackerUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cra7tyhub.com'}/tracker`;

  // Derived from the TTL the links are actually minted with, so the
  // copy can never promise a different window than the URL honours.
  const ttlHours = Math.round(LINK_TTL_SECONDS / 3600);
  const ttlLabel = `${ttlHours} hours`;

  const subject = `Your download links for order ${order.order_number}`;

  const textLines = [
    `Hello ${order.customer_name},`,
    '',
    `Here are fresh download links for your order. Each one is good for ${ttlLabel}.`,
    '',
    ...usable.map((view) => `${view.name} — ${view.url}`),
    '',
    `You can also get these any time from ${trackerUrl}.`,
    '',
    'Cra7ty Hub',
  ];

  const html = `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f1ec;font-family:Georgia,'Times New Roman',serif;color:#1c1a17;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e2da;padding:28px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#7a756c;">Cra7ty Hub</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;font-weight:normal;">Fresh download links</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a453e;">
        Here are new links for order ${escapeHtml(order.order_number)}. Each one is good for ${escapeHtml(ttlLabel)}.
      </p>
      ${usable
        .map(
          (view) => `
      <p style="margin:0 0 14px;">
        <strong style="color:#1c1a17;">${escapeHtml(view.name)}</strong><br/>
        <a href="${escapeHtml(view.url)}" style="color:#c2410c;">Download ${escapeHtml(view.filename)}</a>
      </p>`,
        )
        .join('')}
      <p style="margin:24px 0 0;font-size:14px;color:#4a453e;">
        Or open your order page: <a href="${escapeHtml(trackerUrl)}" style="color:#c2410c;">${escapeHtml(trackerUrl)}</a>
      </p>
      <p style="margin:20px 0 0;font-size:13px;color:#7a756c;">Cra7ty Hub — Lagos.</p>
    </div>
  </body>
</html>`.trim();

  // Destination is the ORDER's address, never anything the caller sent.
  const result = await sendEmail({
    to: { name: order.customer_name, email: orderEmailAddress(order) },
    subject,
    text: textLines.join('\n'),
    html,
  });

  if (!result.ok) {
    // The buyer proved identity and asked for their files — a mail
    // failure is a real failure for them, so say so (retryable) rather
    // than pretending. No order details leak in the message.
    console.error('[resend] download email failed:', result.reason);
    return NextResponse.json(
      { error: 'send_failed', message: 'Could not send the email — try again shortly.' },
      { status: 502 },
    );
  }

  // Bookkeeping AFTER the send: a counter that ticks when nothing was
  // actually delivered would lock a real buyer out of their own files.
  // recordResend both bumps the counter and re-records the window, which
  // is what flips the next lookup from `expired` back to `valid`.
  for (const view of usable) {
    const grant = grants.find((g) => g.productId === view.productId);
    if (grant) await recordResend(grant.id);
  }

  // Deliberately empty: no order number echo, no item list, no link.
  // The caller already knows what they asked for; the mail holds the
  // payload.
  return NextResponse.json(
    { ok: true },
    {
      headers: {
        'Cache-Control': 'no-store',
        'CDN-Cache-Control': 'no-store',
      },
    },
  );
}
