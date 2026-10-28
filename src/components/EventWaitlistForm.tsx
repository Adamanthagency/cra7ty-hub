'use client';

import { useState } from 'react';
import { Button } from '@/components/primitives/Button';

/**
 * Waitlist form (Tier 6) — shown INSTEAD of payment when a capped
 * event is full. No money is taken here; it posts to
 * /api/events/waitlist (rate-limited, deduped by event+email).
 *
 * The response is deliberately uniform: the same success message
 * whether or not this email was already on the list (anti-enumeration
 * — the endpoint answers the same way either way, and so does this
 * copy).
 */

interface Props {
  eventId: string;
}

export function EventWaitlistForm({ eventId }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);

    if (!name.trim() || !email.trim() || !phone.trim() || !email.includes('@')) {
      setError('Fill in your name, email and phone so the studio can reach you.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/events/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, name, email, phone }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; registerAvailable?: boolean }
        | null;

      if (response.ok && body?.ok) {
        setDone(true);
        setBusy(false);
        return;
      }
      if (body?.registerAvailable) {
        setError('Seats opened up — close this and register normally instead.');
      } else {
        setError(body?.message ?? 'Could not save your request — try again shortly.');
      }
      setBusy(false);
    } catch {
      setError('Network problem — try again.');
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div>
        <p className="mono-label-xs text-vermilion">Request received</p>
        <p className="font-display mt-2 text-display-sm leading-tight text-ink">
          You are on the list.
        </p>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-70">
          If a spot frees up the studio will contact you at the email you gave. Keep an eye
          on your inbox — a released spot goes to the first person who completes
          registration.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <p className="mono-label-xs text-vermilion">Full — waitlist open</p>
      <p className="font-display mt-2 text-display-sm leading-tight text-ink">
        Request a spot
      </p>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-70">
        No payment is taken now. Leave your details and the studio will write to you if a
        seat is released before the date.
      </p>

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
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 border-l-2 border-vermilion pl-3 text-sm text-ink-70">
          {error}
        </p>
      )}

      <div className="mt-6">
        <Button type="submit" variant="secondary" className="w-full md:w-auto">
          {busy ? 'Sending…' : 'Request a spot'}
        </Button>
      </div>
    </form>
  );
}
