import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, rpc, serviceConfigured } from '@/lib/server/supabase-server';
import { verifyTransaction } from '@/lib/server/paystack';

/**
 * POST /api/checkout/verify — backup confirmation path (public, rate-limited).
 *
 * Called by the success page after Paystack redirects the buyer back.
 * It does NOT trust anything in the redirect URL except the reference:
 * it asks Paystack directly (GET /transaction/verify/:reference with the
 * secret key) and passes the VERIFIED amount into confirm_paid_order —
 * the same RPC the webhook uses, so both paths converge on one idempotent,
 * amount-checked confirmation. The webhook stays the primary path; this
 * one covers a webhook that hasn't landed yet (or never lands).
 *
 * The reference is the only client input here, and it's shape-checked:
 * create_checkout_order generated it server-side as chr_<32 hex>, so a
 * malformed value can't probe anything.
 */

export const dynamic = 'force-dynamic';

const RATE = { limit: 20, windowSeconds: 60 };
const REFERENCE_PATTERN = /^chr_[0-9a-f]{32}$/;

export async function POST(request: NextRequest) {
  if (!serviceConfigured()) {
    return NextResponse.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
  }

  if (!(await rateLimit('verify', RATE.limit, RATE.windowSeconds, request))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests — try again shortly.' },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as { reference?: unknown } | null;
  const reference =
    body && typeof body.reference === 'string' ? body.reference : '';
  if (!REFERENCE_PATTERN.test(reference)) {
    return NextResponse.json({ error: 'invalid_reference' }, { status: 400 });
  }

  const verified = await verifyTransaction(reference);

  if (verified === null) {
    // Paystack unreachable or doesn't know the reference. Transient vs.
    // permanent is indistinguishable here — the client may retry, which
    // is safe (confirm_paid_order is idempotent).
    return NextResponse.json(
      {
        error: 'paystack_unavailable',
        message: 'Could not verify the payment yet — try again shortly.',
      },
      { status: 502 },
    );
  }

  if (verified.status !== 'success') {
    // Real answer from Paystack, not a success: leave the order pending
    // (the buyer can retry payment; nothing is confirmed on failure).
    return NextResponse.json({
      paid: false,
      paymentStatus: verified.status,
    });
  }

  try {
    const result = await rpc<{
      ok: boolean;
      alreadyProcessed: boolean;
      orderNumber: string;
      paymentStatus: string;
      status: string;
      needsReview: boolean;
      reviewReason: string | null;
    }>('confirm_paid_order', {
      p_reference: reference,
      // The VERIFIED kobo amount — compared against the server total
      // inside the RPC; a mismatch flags needs_review, never fulfils.
      p_amount_kobo: verified.amount,
      p_source: 'verify',
    });

    return NextResponse.json({
      paid: true,
      alreadyProcessed: result.alreadyProcessed,
      orderNumber: result.orderNumber,
      paymentStatus: result.paymentStatus,
      status: result.status,
      needsReview: result.needsReview,
      reviewReason: result.reviewReason,
    });
  } catch (error) {
    const message = (error as Error).message ?? '';
    if (message.startsWith('order_not_found')) {
      return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
    }
    console.error('[checkout] confirm_paid_order failed (verify path)');
    return NextResponse.json(
      { error: 'confirm_failed', message: 'Could not confirm the payment — try again.' },
      { status: 500 },
    );
  }
}
