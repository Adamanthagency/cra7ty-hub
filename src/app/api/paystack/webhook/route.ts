import { NextResponse, type NextRequest } from 'next/server';
import { rest, rpc, serviceConfigured } from '@/lib/server/supabase-server';
import { isValidWebhookSignature, paystackSecret } from '@/lib/server/paystack';
import { deliverOrderConfirmation } from '@/lib/server/order-confirmation';
import { confirmEventRegistration } from '@/lib/server/events';
import { deliverEventTicket } from '@/lib/server/event-ticket';

/**
 * POST /api/paystack/webhook — the PRIMARY payment confirmation path.
 *
 * Flow (approved Tier 4 plan):
 *   1. Signature gate: HMAC-SHA512 of the RAW body with the secret key,
 *      timing-safe compared against x-paystack-signature. The raw body
 *      matters — re-serializing parsed JSON would change byte order and
 *      break every signature.
 *   2. charge.success → confirm_paid_order(reference, verified_amount,
 *      'webhook') — the same RPC verify-on-redirect uses. Idempotent:
 *      Paystack retries deliveries, and webhook + redirect can both
 *      land; the second arrival is a no-op (already_processed).
 *   3. The amount inside the signed payload is the VERIFIED amount (the
 *      signature makes the payload trustworthy); confirm_paid_order
 *      compares it against the server-computed total — a mismatch marks
 *      needs_review('amount_mismatch') and touches no stock.
 *   4. charge.failed → the order's payment_status moves pending→failed.
 *      Fulfillment status is untouched (it's the admin's axis).
 *   5. Every acknowledged response is 2xx: Paystack retries on non-2xx,
 *      and unknown references / unhandled events must not retry forever.
 *      A genuine infrastructure failure (RPC down) answers 500 so
 *      Paystack DOES retry — idempotency makes the retry safe.
 *   6. TIER 5: a freshly-confirmed order also triggers the confirmation
 *      email (with digital download links when there are any), sent
 *      only when this delivery was the one that confirmed. Email
 *      failure never changes the response code.
 *   7. TIER 6: references dispatch by prefix — chr_ follows the order
 *      path above, evr_ follows the identical event path
 *      (confirm_event_registration + the ticket email, same
 *      already-confirmed guard). One signature gate serves both.
 *      charge.failed moves a pending event registration to failed the
 *      same way it does a pending order.
 *
 * No rate limit here: the signature IS the authentication, and every
 * request costs a constant-time comparison plus (for known events) one
 * idempotent RPC call.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!serviceConfigured()) {
    return NextResponse.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
  }
  if (!paystackSecret()) {
    return NextResponse.json(
      { error: 'PAYSTACK_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  // RAW body first: the signature covers the exact bytes Paystack sent.
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  if (!isValidWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: {
    event?: string;
    data?: { reference?: string; amount?: number };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Signature was valid, so this is Paystack sending something odd —
    // acknowledge rather than trigger retries on an unparseable body.
    return NextResponse.json({ ignored: 'unparseable' });
  }

  const event = payload.event;
  const reference =
    typeof payload.data?.reference === 'string' ? payload.data.reference : '';

  if (event === 'charge.success' && reference) {
    const amountKobo =
      typeof payload.data?.amount === 'number' ? payload.data.amount : 0;

    /* TIER 6 — event registrations: the same confirm + email shape the
     * order path uses, on its own idempotent RPC. */
    if (reference.startsWith('evr_')) {
      try {
        const result = await confirmEventRegistration(reference, amountKobo, 'webhook');
        if (!result.alreadyProcessed && !result.needsReview && result.attendeeEmail) {
          const delivery = await deliverEventTicket(reference, result.attendeeEmail);
          if (!delivery.sent) {
            console.error('[webhook] ticket email not sent:', delivery.reason);
          }
        }
        return NextResponse.json({
          received: true,
          alreadyProcessed: result.alreadyProcessed,
          needsReview: result.needsReview,
          reviewReason: result.reviewReason,
        });
      } catch (error) {
        const message = (error as Error).message ?? '';
        if (message.startsWith('registration_not_found')) {
          // Not ours (or an ancient reference): acknowledge so Paystack
          // doesn't retry a delivery we'll never be able to apply.
          return NextResponse.json({ ignored: 'unknown_reference' });
        }
        // Infrastructure failure — 500 so Paystack retries; the RPC is
        // idempotent, so a later retry never double-confirms.
        console.error('[webhook] confirm_event_registration failed');
        return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
      }
    }

    try {
      const result = await rpc<{
        alreadyProcessed: boolean;
        orderId: string;
        orderNumber: string;
        paymentStatus: string;
        status: string;
        needsReview: boolean;
        reviewReason: string | null;
      }>('confirm_paid_order', {
        p_reference: reference,
        p_amount_kobo: amountKobo,
        p_source: 'webhook',
      });

      // TIER 5: the confirmation email. Only the path that actually
      // performed the confirmation sends it (alreadyProcessed=false),
      // so webhook + success-page verify can never both mail the same
      // buyer. A failure is logged and deliberately NOT turned into a
      // 500: Paystack retries non-2xx, and retrying a confirmation we
      // already applied would only re-enter the idempotent path.
      if (!result.alreadyProcessed && !result.needsReview) {
        const delivery = await deliverOrderConfirmation(result.orderId);
        if (!delivery.sent) {
          console.error('[webhook] confirmation email not sent:', delivery.reason);
        }
      }

      return NextResponse.json({
        received: true,
        alreadyProcessed: result.alreadyProcessed,
        needsReview: result.needsReview,
        reviewReason: result.reviewReason,
      });
    } catch (error) {
      const message = (error as Error).message ?? '';
      if (message.startsWith('order_not_found')) {
        // Not ours (or an ancient reference): acknowledge so Paystack
        // doesn't retry a delivery we'll never be able to apply.
        return NextResponse.json({ ignored: 'unknown_reference' });
      }
      // Infrastructure failure — 500 so Paystack retries; the RPC is
      // idempotent, so a later successful retry never double-fulfils.
      console.error('[webhook] confirm_paid_order failed');
      return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
    }
  }

  if (event === 'charge.failed' && reference) {
    // Pending → failed only: a failed attempt must never overwrite an
    // already-confirmed payment (a later retry can still succeed).
    // TIER 6: the same rule on event registrations, dispatched by
    // reference prefix.
    if (reference.startsWith('evr_')) {
      await rest(
        'PATCH',
        'event_registrations',
        `reference=eq.${encodeURIComponent(reference)}&payment_status=eq.pending`,
        { payment_status: 'failed', updated_at: new Date().toISOString() },
      );
      return NextResponse.json({ received: true });
    }
    await rest(
      'PATCH',
      'orders',
      `reference=eq.${encodeURIComponent(reference)}&payment_status=eq.pending`,
      { payment_status: 'failed' },
    );
    return NextResponse.json({ received: true });
  }

  // Everything else (authorization.pending, transfer events, …) is
  // acknowledged without action.
  return NextResponse.json({ ignored: true });
}
