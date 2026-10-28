'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/primitives/Container';
import { Button } from '@/components/primitives/Button';
import { TicketBlock, type TicketData } from '@/components/TicketBlock';

/**
 * Event success page (Tier 6) — the twin of /checkout/success. Reads
 * ?ref=evr_… and asks POST /api/events/verify, which is where the real
 * work happens (Paystack verification or the already-confirmed fast
 * path — a webhook that beat the page here answers instantly).
 *
 * Honest states, none of them spinner-forever:
 *   verifying  — the round trip is in flight
 *   paid       — the ticket
 *   review     — confirmed but flagged (capacity_shortfall /
 *                amount_mismatch): says so instead of showing a
 *                ticket for a seat that was never committed
 *   unpaid     — Paystack says not successful (retry payment)
 *   missing    — unknown/absent reference
 *   error      — transient (502/500): Retry button
 */

type State =
  | { phase: 'verifying' }
  | { phase: 'paid'; ticket: TicketData; alreadyProcessed: boolean }
  | { phase: 'review'; reviewReason: string | null }
  | { phase: 'unpaid'; paymentStatus: string }
  | { phase: 'missing' }
  | { phase: 'error'; message: string };

function SuccessInner() {
  const params = useSearchParams();
  const reference = params.get('ref') ?? '';
  const [state, setState] = useState<State>({ phase: 'verifying' });

  const verify = useCallback(async () => {
    if (!/^evr_[0-9a-f]{32}$/.test(reference)) {
      setState({ phase: 'missing' });
      return;
    }
    setState({ phase: 'verifying' });
    try {
      const response = await fetch('/api/events/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            paid?: boolean;
            ticket?: TicketData;
            alreadyProcessed?: boolean;
            needsReview?: boolean;
            reviewReason?: string | null;
            paymentStatus?: string;
            message?: string;
            error?: string;
          }
        | null;

      if (!body) {
        setState({ phase: 'error', message: 'Something came back empty — try again.' });
        return;
      }
      if (response.ok && body.paid && body.ticket) {
        setState({
          phase: 'paid',
          ticket: body.ticket,
          alreadyProcessed: body.alreadyProcessed ?? false,
        });
        return;
      }
      if (response.ok && body.paid && body.needsReview) {
        setState({ phase: 'review', reviewReason: body.reviewReason ?? null });
        return;
      }
      if (response.ok && body.paid === false) {
        setState({ phase: 'unpaid', paymentStatus: body.paymentStatus ?? 'pending' });
        return;
      }
      if (response.status === 404) {
        setState({ phase: 'missing' });
        return;
      }
      if (response.status === 502 || response.status === 500) {
        setState({
          phase: 'error',
          message: body.message ?? 'Could not confirm the payment yet — try again.',
        });
        return;
      }
      setState({ phase: 'missing' });
    } catch {
      setState({ phase: 'error', message: 'Network problem — try again.' });
    }
  }, [reference]);

  useEffect(() => {
    verify();
  }, [verify]);

  return (
    <Container width="narrow" className="py-16 md:py-24">
      {state.phase === 'verifying' && (
        <div>
          <p className="mono-label-xs text-ink-55">Checking your payment…</p>
          <p className="font-display mt-3 text-display-sm text-ink">
            One moment — confirming your spot.
          </p>
        </div>
      )}

      {state.phase === 'paid' && (
        <div>
          <p className="mono-label-xs text-vermilion">Confirmed</p>
          <h1 className="font-display mt-3 text-display-md leading-[0.94] tracking-[-0.02em] text-ink">
            Your spot is booked.
          </h1>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-70 md:text-base">
            A copy of this ticket is in your inbox as well — bring either to the door. The
            name and reference are what the studio checks against.
          </p>
          <div className="mt-8">
            <TicketBlock ticket={state.ticket} />
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button href="/workshops" variant="secondary">
              Back to workshops
            </Button>
          </div>
        </div>
      )}

      {state.phase === 'review' && (
        <div>
          <p className="mono-label-xs text-ink-55">Payment received</p>
          <h1 className="font-display mt-3 text-display-md leading-[0.94] tracking-[-0.02em] text-ink">
            Your registration needs a quick check.
          </h1>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-70 md:text-base">
            The payment came through but something needs a person to look at it
            {state.reviewReason === 'capacity_shortfall'
              ? ' — the event filled while your payment was in flight. The studio will email you within the day, and you will not be left out of pocket.'
              : ' — the amount and the ticket price did not match. The studio will email you within the day.'}{' '}
            Nothing more to do right now.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button href="/workshops" variant="secondary">
              Back to workshops
            </Button>
          </div>
        </div>
      )}

      {state.phase === 'unpaid' && (
        <div>
          <p className="mono-label-xs text-vermilion">Not confirmed</p>
          <h1 className="font-display mt-3 text-display-md leading-[0.94] tracking-[-0.02em] text-ink">
            That payment did not go through.
          </h1>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-70 md:text-base">
            Paystack reports the payment as “{state.paymentStatus}”. Nothing was charged and
            your spot is not held — go back to the event page and try again, or message the
            studio if your bank says otherwise.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button href="/workshops" variant="primary">
              Back to workshops
            </Button>
          </div>
        </div>
      )}

      {state.phase === 'missing' && (
        <div>
          <p className="mono-label-xs text-ink-55">No ticket here</p>
          <h1 className="font-display mt-3 text-display-md leading-[0.94] tracking-[-0.02em] text-ink">
            That reference is not on the list.
          </h1>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-70 md:text-base">
            The link may be incomplete — check the full address, or open the event page and
            register again. Still stuck? Message the studio on WhatsApp.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button href="/workshops" variant="primary">
              Back to workshops
            </Button>
          </div>
        </div>
      )}

      {state.phase === 'error' && (
        <div>
          <p className="mono-label-xs text-ink-55">Could not confirm yet</p>
          <h1 className="font-display mt-3 text-display-md leading-[0.94] tracking-[-0.02em] text-ink">
            The check did not come back.
          </h1>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-70 md:text-base">
            {state.message} If you were charged, your registration still confirms the moment
            the check succeeds — retry below.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button onClick={verify} variant="primary">
              Retry
            </Button>
            <Button href="/workshops" variant="secondary">
              Back to workshops
            </Button>
          </div>
        </div>
      )}

      <p className="mt-12 text-sm text-ink-55">
        <Link href="/workshops" className="link-draw underline underline-offset-4">
          See all upcoming workshops
        </Link>
      </p>
    </Container>
  );
}

export default function EventSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessInner />
    </Suspense>
  );
}
