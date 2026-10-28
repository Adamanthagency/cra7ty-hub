import { NextResponse, type NextRequest } from 'next/server';
import { serviceConfigured, rest } from '@/lib/server/supabase-server';
import {
  addWaitlistEntry,
  eventsRateLimit,
  notifyStudioOfWaitlist,
} from '@/lib/server/events';

/**
 * POST /api/events/waitlist — request a spot on a FULL event (public,
 * rate-limited). No payment is collected here; this form only exists
 * where the register path refuses with event_full.
 *
 * ENFORCEMENT (server-side, not just the UI hiding the form): the
 * event must exist, be published, be capped, and actually be full —
 * otherwise this endpoint would let someone bypass a working payment
 * path for an event that still has seats.
 *
 * RESPONSES are deliberately uniform on success: the same { ok: true }
 * whether this was a new entry or a repeat (the unique (event_id,
 * email) row makes repeats a no-op) — an attacker probing emails gets
 * the same answer either way. The studio is emailed on every NEW
 * request; the row shows in the admin Waitlist tab regardless.
 *
 * Rate limit: 5/min per IP.
 */

export const dynamic = 'force-dynamic';

const MAX_STRING = 200;

interface WaitlistBody {
  eventId?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
}

function bounded(value: unknown, max = MAX_STRING): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export async function POST(request: NextRequest) {
  if (!serviceConfigured()) {
    return NextResponse.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
  }

  if (!(await eventsRateLimit('waitlist', request))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests — try again shortly.' },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as WaitlistBody | null;
  const eventId = bounded(body?.eventId, 80);
  const name = bounded(body?.name, 120);
  const email = bounded(body?.email, 200);
  const phone = bounded(body?.phone, 40);
  if (!body || !eventId || !name || !email || !phone || !email.includes('@')) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  /* ---- is this event genuinely full? (bypass guard) ---------------- */
  const event = await rest<{ status: string; capacity: number | null; starts_at: string }[]>(
    'GET',
    'events',
    `id=eq.${encodeURIComponent(eventId)}&select=status,capacity,starts_at&limit=1`,
  );
  const row = event.data?.[0];
  if (event.error || !row) {
    return NextResponse.json({ error: 'event_not_found', message: 'That event does not exist.' }, { status: 404 });
  }
  if (row.status !== 'published' || new Date(row.starts_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: 'event_closed', message: 'Registration for that event has closed.' },
      { status: 409 },
    );
  }

  let full = false;
  if (row.capacity !== null) {
    const seats = await rest<{ id: string }[]>(
      'GET',
      'event_registrations',
      `event_id=eq.${encodeURIComponent(eventId)}` +
        `&payment_status=eq.paid&needs_review=eq.false&select=id`,
    );
    const taken = Array.isArray(seats.data) ? seats.data.length : 0;
    full = taken >= row.capacity;
  }
  if (!full) {
    // Seats are available — the register path is open. Answer in the
    // same vocabulary the register route uses so the form can say so.
    return NextResponse.json(
      {
        error: 'not_full',
        message: 'Seats are still available — register normally instead.',
        registerAvailable: true,
      },
      { status: 409 },
    );
  }

  /* ---- write the entry, then notify the studio -------------------- */
  const eventNameResult = await rest<{ name: string }[]>(
    'GET',
    'events',
    `id=eq.${encodeURIComponent(eventId)}&select=name&limit=1`,
  );
  const eventName = eventNameResult.data?.[0]?.name ?? 'an event';

  const result = await addWaitlistEntry(eventId, { name, email, phone });
  if (!result.ok) {
    if (result.reason === 'invalid') {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Please fill in your name, email and phone.' },
        { status: 400 },
      );
    }
    if (result.reason === 'unknown_event') {
      return NextResponse.json({ error: 'event_not_found' }, { status: 404 });
    }
    console.error('[events] waitlist storage failure');
    return NextResponse.json(
      { error: 'waitlist_failed', message: 'Could not save your request — try again shortly.' },
      { status: 502 },
    );
  }

  if (!result.duplicate) {
    // Best-effort: the row already exists either way, and it shows in
    // the admin Waitlist tab regardless of what Resend does.
    await notifyStudioOfWaitlist(eventName, { name, email, phone });
  }

  // Deliberately uniform — no echo of whether the email was already on
  // the list, and no order/seat detail (nothing was purchased here).
  return NextResponse.json({ ok: true });
}
