'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/primitives/Button';
import { EventWaitlistForm } from '@/components/EventWaitlistForm';
import { naira } from '@/lib/format';

/**
 * Registration form (Tier 6) — posts { eventId, name, email, phone }
 * to /api/events/register. NO price is ever sent or trusted here: the
 * price printed on the button is display only, and the server returns
 * the real number (or redirects us to Paystack with the server total).
 *
 * Free events answer inline with a ticket reference → straight to the
 * success page. Paid events answer with authorizationUrl → Paystack,
 * which redirects back to /workshops/success?ref=…
 */

interface Props {
  eventId: string;
  eventName: string;
  priceNaira: number;
}

interface RegisterOk {
  free: boolean;
  paid?: boolean;
  authorizationUrl?: string;
  reference?: string;
  ticket?: unknown;
  needsReview?: boolean;
  reviewReason?: string | null;
  priceNaira?: number;
}

interface RegisterFail {
  error?: string;
  message?: string;
  waitlistAvailable?: boolean;
}

export function EventRegisterForm({ eventId, eventName, priceNaira }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The server said event_full while this (possibly cached) render
  // still showed the PAY form: swap to the waitlist form right here,
  // because "use the waitlist form below" is a lie until it exists.
  const [soldOut, setSoldOut] = useState(false);

  const free = priceNaira === 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);

    if (!name.trim() || !email.trim() || !phone.trim() || !email.includes('@')) {
      setError('Fill in your name, email and phone — all three are needed for the ticket.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/events/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, name, email, phone }),
      });
      const body = (await response.json().catch(() => null)) as (RegisterOk & RegisterFail) | null;

      if (!response.ok || !body) {
        if (body?.waitlistAvailable) {
          setSoldOut(true);
        } else {
          setError(body?.message ?? 'Could not start registration — try again.');
        }
        setBusy(false);
        return;
      }

      if (body.free) {
        // ₦0 path: confirmed in that same request; the ticket is the
        // success page's job (it re-verifies the reference server-side).
        router.push(`/workshops/success?ref=${body.reference}`);
        return;
      }

      if (body.authorizationUrl) {
        // Server-priced checkout — the amount we display above is only
        // what Paystack will actually charge (the server said so).
        window.location.href = body.authorizationUrl;
        return;
      }

      setError('Could not start registration — try again.');
      setBusy(false);
    } catch {
      setError('Network problem — try again.');
      setBusy(false);
    }
  };

  // Full and the page has not caught up yet: the waitlist form takes
  // over this panel. It carries its own copy ("Full — waitlist open"),
  // so the error is rendered by IT, not repeated here.
  if (soldOut) {
    return <EventWaitlistForm eventId={eventId} />;
  }

  return (
    <form onSubmit={submit} noValidate>
      <p className="mono-label-xs text-ink-55">{eventName}</p>
      <p className="font-display mt-2 text-display-sm leading-none text-ink">
        {free ? 'Free entry' : naira(priceNaira)}
      </p>
      {!free && (
        <p className="mono-label-xs mt-2 text-ink-40">Paid on Paystack — secure checkout</p>
      )}

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="mono-label-xs text-ink-55">Full name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoComplete="name"
            className="mt-1.5 w-full border border-ink-24 bg-paper px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
            placeholder="The name on the ticket"
          />
        </label>
        <label className="block">
          <span className="mono-label-xs text-ink-55">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            autoComplete="email"
            className="mt-1.5 w-full border border-ink-24 bg-paper px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="mono-label-xs text-ink-55">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            autoComplete="tel"
            className="mt-1.5 w-full border border-ink-24 bg-paper px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
            placeholder="080…"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 border-l-2 border-vermilion pl-3 text-sm text-ink-70">
          {error}
        </p>
      )}

      <div className="mt-6">
        <Button type="submit" variant="primary" className="w-full md:w-auto">
          {busy ? 'Working…' : free ? 'Reserve my spot' : `Pay ${naira(priceNaira)}`}
        </Button>
      </div>
      <p className="mono-label-xs mt-4 text-ink-40">
        Your ticket arrives by email the moment payment confirms.
      </p>
    </form>
  );
}
