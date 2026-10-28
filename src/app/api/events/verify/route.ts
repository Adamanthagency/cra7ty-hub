import { NextResponse, type NextRequest } from 'next/server';
import { serviceConfigured } from '@/lib/server/supabase-server';
import { verifyTransaction } from '@/lib/server/paystack';
import { confirmEventRegistration, eventsRateLimit, loadTicket, revalidateEventPages } from '@/lib/server/events';
import { deliverEventTicket } from '@/lib/server/event-ticket';

/**
 * POST /api/events/verify — the success page's confirmation path
 * (public, rate-limited), the twin of /api/checkout/verify.
 *
 * It does not trust anything in the redirect URL except the reference,
 * and the reference is shape-checked (create_event_registration
 * generated it server-side as evr_<32 hex>, so a malformed value can't
 * probe anything).
 *
 * ORDER OF OPERATIONS, because two of the three ways a registration
 * gets confirmed must not re-ask Paystack:
 *   1. Already paid? (free path confirmed inline, or the webhook beat
 *      the page) → return the ticket immediately, no Paystack call.
 *   2. Not paid → ask Paystack directly (GET /transaction/verify/…
 *      with the secret key) and pass the VERIFIED amount into
 *      confirm_event_registration — the same RPC the webhook uses, so
 *      both paths converge on one idempotent, amount-checked,
 *      capacity-atomic confirmation.
 *   3. Paystack doesn't know the reference and we have no ticket →
 *      502 (the client may retry; confirm is idempotent).
 *
 * A needs_review confirmation (amount_mismatch / capacity_shortfall)
 * answers paid=true but with needsReview set and NO ticket — the
 * ticket read excludes flagged rows on purpose (see events.ts), so the
 * page says "under review" instead of handing out a door fight.
 */

export const dynamic = 'force-dynamic';

const RATE_SCOPE = 'verify' as const;
const REFERENCE_PATTERN = /^evr_[0-9a-f]{32}$/;

export async function POST(request: NextRequest) {
  if (!serviceConfigured()) {
    return NextResponse.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
  }

  if (!(await eventsRateLimit(RATE_SCOPE, request))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests — try again shortly.' },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as { reference?: unknown } | null;
  const reference = body && typeof body.reference === 'string' ? body.reference : '';
  if (!REFERENCE_PATTERN.test(reference)) {
    return NextResponse.json({ error: 'invalid_reference' }, { status: 400 });
  }

  /* 1 — already confirmed by the free path or the webhook? */
  const existing = await loadTicket(reference);
  if (existing) {
    return NextResponse.json({
      paid: true,
      alreadyProcessed: true,
      reference,
      registrationNumber: existing.registrationNumber,
      ticket: existing,
    });
  }

  /* 2 — ask Paystack, confirm through the shared RPC. */
  const verified = await verifyTransaction(reference);
  if (verified === null) {
    return NextResponse.json(
      {
        error: 'paystack_unavailable',
        message: 'Could not verify the payment yet — try again shortly.',
      },
      { status: 502 },
    );
  }

  if (verified.status !== 'success') {
    // A real answer from Paystack, not a success: the registration
    // stays pending (the attendee can retry; nothing was confirmed).
    return NextResponse.json({ paid: false, paymentStatus: verified.status });
  }

  try {
    const result = await confirmEventRegistration(reference, verified.amount, 'verify');

    if (!result.alreadyProcessed) {
      // A fresh confirmation can take the event's last seat — flip the
      // listing/detail caches now, not in five minutes.
      revalidateEventPages();
    }

    if (!result.alreadyProcessed && !result.needsReview) {
      // The confirming path mails the ticket — webhook and verify can
      // both land, but only the one that flipped the flag sends.
      const delivery = await deliverEventTicket(reference, result.attendeeEmail ?? '');
      if (!delivery.sent) {
        console.error('[events-verify] ticket email not sent:', delivery.reason);
      }
    }

    const ticket = await loadTicket(reference);
    return NextResponse.json({
      paid: true,
      alreadyProcessed: result.alreadyProcessed,
      reference,
      registrationNumber: result.registrationNumber,
      needsReview: result.needsReview,
      reviewReason: result.reviewReason,
      ...(ticket ? { ticket } : {}),
    });
  } catch (error) {
    const message = (error as Error).message ?? '';
    if (message.startsWith('registration_not_found')) {
      // A chr_-style or foreign reference can't get this far (the
      // pattern gate), so this is a genuinely unknown evr reference.
      return NextResponse.json({ error: 'registration_not_found' }, { status: 404 });
    }
    console.error('[events-verify] confirm_event_registration failed');
    return NextResponse.json(
      { error: 'confirm_failed', message: 'Could not confirm the payment — try again.' },
      { status: 500 },
    );
  }
}
