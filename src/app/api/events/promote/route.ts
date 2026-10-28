import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { escapeHtml, sendEmail } from '@/lib/server/order-email';

/**
 * POST /api/events/promote — "a spot opened" email for a waitlisted
 * person (Tier 6). Called by the ADMIN's waitlist Notify action, never
 * by a browser.
 *
 * WHY IT LIVES HERE: the Resend key is the storefront's server env (the
 * same one order confirmations and tickets use) — the admin has no
 * Resend key by design, so the admin asks this route to send, exactly
 * the same shape as /api/revalidate asking for a refresh.
 *
 * AUTH: `Authorization: Bearer $REVALIDATE_SECRET` — timing-safe, the
 * identical pattern and value the revalidate route uses, so there is
 * one shared secret between the two apps, not two.
 *
 * DELIBERATE CONTENT DECISION: the email links to the event page, not
 * to a held seat — nothing is reserved for a waitlisted person (the
 * approved plan: promotion is first-to-register-on-release). The copy
 * says exactly that so nobody queues outside expecting a reserved row.
 */

export const dynamic = 'force-dynamic';

/** Constant-time comparison; a length mismatch is simply "no match". */
function secretMatches(provided: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !provided) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface PromoteBody {
  email?: unknown;
  eventName?: unknown;
  eventUrl?: unknown;
}

function bounded(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'REVALIDATE_SECRET is not set on this server.' },
      { status: 503 },
    );
  }
  if (!secretMatches(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Missing or invalid token.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as PromoteBody | null;
  const email = bounded(body?.email, 200);
  const eventName = bounded(body?.eventName, 200);
  const eventUrl = bounded(body?.eventUrl, 300);
  if (!email || !email.includes('@') || !eventName || !eventUrl || !eventUrl.startsWith('/workshops/')) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const absolute = `${origin}${eventUrl}`;

  const result = await sendEmail({
    to: { email },
    subject: `A spot opened — ${eventName}`,
    text: [
      `A spot has opened for "${eventName}".`,
      '',
      `Register here: ${absolute}`,
      '',
      'Spots are first-come: nothing is held, so the sooner you register the better. ' +
        'This link takes you to the event page where you can pay and get your ticket.',
      '',
      'Cra7ty Hub — Lagos.',
    ].join('\n'),
    html: `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f1ec;font-family:Georgia,'Times New Roman',serif;color:#1c1a17;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e2da;padding:28px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#7a756c;">Cra7ty Hub</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;font-weight:normal;">A spot opened</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a453e;">
        A place has become available for <strong>${escapeHtml(eventName)}</strong>.
      </p>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(absolute)}" style="color:#c2410c;">Register for the event</a>
      </p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4a453e;">
        Spots are first-come — nothing is held, so the sooner you register the better.
        The link takes you to the event page where you can pay and get your ticket.
      </p>
      <p style="margin:20px 0 0;font-size:13px;color:#7a756c;">Cra7ty Hub — Lagos.</p>
    </div>
  </body>
</html>`.trim(),
  });

  if (!result.ok) {
    // The admin's Notify action flips the row to 'notified' only on a
    // 2xx here, so a failure means the row stays 'waiting' and the
    // button stays pressable. Log the reason, never the address.
    console.error('[events-promote] email not sent:', result.reason, result.detail);
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
