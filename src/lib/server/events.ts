/**
 * Server-side event helpers (Tier 6) — the RPC wrappers every event
 * route shares, plus the waitlist's two writes and the studio notify.
 *
 * Mirrors the Tier 4 shape: routes never touch tables directly for the
 * payment axis — create/confirm go through the service-role RPCs so the
 * pricing, idempotency and atomic capacity checks live in ONE place
 * (the database), the same place Tier 4's stock checks live.
 *
 * Server-only: never imported by client components, never NEXT_PUBLIC_.
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { rateLimit, rest, rpc } from '@/lib/server/supabase-server';
import { escapeHtml, sendEmail } from '@/lib/server/order-email';

/* ------------------------------------------------------------------ */
/* cache busting — the moment a seat changes hands                    */
/* ------------------------------------------------------------------ */

/**
 * The workshops listing and detail pages are ISR (60s) over an RPC
 * fetch that is itself cached 300s under the 'db:events' tag — so a
 * just-FULL event would otherwise keep rendering the PAY form for
 * minutes after the last seat was paid for (and its error tells the
 * buyer to "use the waitlist form below" that the stale render never
 * included). Every confirmation path calls this after a fresh
 * confirm so the flip to "Full — waitlist open" happens in seconds.
 */
export function revalidateEventPages(): void {
  try {
    revalidateTag('db:events'); // the get_published_events fetch cache
    revalidatePath('/workshops'); // the listing page (ISR 60s)
    revalidatePath('/workshops/[slug]'); // every event detail page
  } catch (error) {
    // A failed revalidation must never fail the payment confirmation
    // it accompanies — the pages catch up on their own within 60s.
    console.error('[events] revalidate failed:', (error as Error).message);
  }
}

/* ------------------------------------------------------------------ */
/* create — server-priced pending registration                         */
/* ------------------------------------------------------------------ */

export interface AttendeeInput {
  name: string;
  email: string;
  phone: string;
}

export interface CreateRegistrationResult {
  ok: boolean;
  registrationId: string;
  registrationNumber: string;
  reference: string;
  priceNaira: number;
  eventName: string;
  eventFree: boolean;
}

/**
 * Calls create_event_registration. The attendee object carries NO
 * price — the RPC prices from the events row. Throws with the raised
 * reason ('event_full' | 'event_closed' | …) so the route can map it.
 */
export function createEventRegistration(
  eventId: string,
  attendee: AttendeeInput,
): Promise<CreateRegistrationResult> {
  return rpc<CreateRegistrationResult>('create_event_registration', {
    p_event_id: eventId,
    p_attendee: {
      name: attendee.name,
      email: attendee.email,
      phone: attendee.phone,
    },
  });
}

/* ------------------------------------------------------------------ */
/* confirm — the webhook/verify/free heart                             */
/* ------------------------------------------------------------------ */

export interface ConfirmRegistrationResult {
  ok: boolean;
  alreadyProcessed: boolean;
  registrationId: string;
  registrationNumber: string;
  reference?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  eventName?: string;
  eventDate?: string;
  eventLocation?: string;
  needsReview: boolean;
  reviewReason: string | null;
}

/**
 * Calls confirm_event_registration with the VERIFIED amount (kobo) —
 * 0 with source 'free' for the ₦0 path, which takes the identical
 * route through idempotency and the capacity lock.
 */
export function confirmEventRegistration(
  reference: string,
  amountKobo: number,
  source: 'webhook' | 'verify' | 'free',
): Promise<ConfirmRegistrationResult> {
  return rpc<ConfirmRegistrationResult>('confirm_event_registration', {
    p_reference: reference,
    p_amount_kobo: amountKobo,
    p_source: source,
  });
}

/* ------------------------------------------------------------------ */
/* ticket read — the registration row IS the ticket                    */
/* ------------------------------------------------------------------ */

export interface TicketView {
  registrationNumber: string;
  reference: string;
  attendeeName: string;
  eventName: string;
  /** ISO timestamptz of the snapshot, formatted by the consumer. */
  eventDate: string;
  eventLocation: string;
  pricePaid: number;
}

interface RegistrationRow {
  registration_number: string;
  reference: string;
  attendee_name: string;
  event_name: string;
  event_date: string;
  event_location: string;
  price_paid: number;
}

const REGISTRATION_COLUMNS =
  'registration_number,reference,attendee_name,event_name,event_date,event_location,price_paid';

function toTicket(row: RegistrationRow): TicketView {
  return {
    registrationNumber: row.registration_number,
    reference: row.reference,
    attendeeName: row.attendee_name,
    eventName: row.event_name,
    eventDate: row.event_date,
    eventLocation: row.event_location,
    pricePaid: row.price_paid,
  };
}

/**
 * Load a PAID registration as its ticket. Null when the reference is
 * unknown, not confirmed yet, or the read fails — callers treat null as
 * "nothing to show", never as an error (the confirmation already
 * happened by the time anyone asks for a ticket).
 *
 * needs_review rows are EXCLUDED on purpose: a capacity_shortfall or
 * amount_mismatch payment is exactly the list the admin resolves by
 * hand, and a door ticket for a seat that was never committed is a
 * fight at the entrance. The verify route surfaces those as "under
 * review" instead of a ticket.
 */
export async function loadTicket(reference: string): Promise<TicketView | null> {
  const { status, data, error } = await rest<RegistrationRow[]>(
    'GET',
    'event_registrations',
    `reference=eq.${encodeURIComponent(reference)}` +
      `&payment_status=eq.paid&needs_review=eq.false` +
      `&select=${REGISTRATION_COLUMNS}&limit=1`,
  );
  if (error || status !== 200 || !data || data.length === 0) {
    if (error) console.error('[events] ticket read failed:', error);
    return null;
  }
  return toTicket(data[0]);
}

/** Same read for the admin/needs-review question: is this paid? */
export async function registrationExists(reference: string): Promise<boolean> {
  const { status, data, error } = await rest<{ id: string }[]>(
    'GET',
    'event_registrations',
    `reference=eq.${encodeURIComponent(reference)}&select=id&limit=1`,
  );
  return !error && status === 200 && Array.isArray(data) && data.length > 0;
}

/* ------------------------------------------------------------------ */
/* waitlist — no payment, no reference, no ticket                      */
/* ------------------------------------------------------------------ */

export interface WaitlistInput {
  name: string;
  email: string;
  phone: string;
}

export type WaitlistResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; reason: 'invalid' | 'unknown_event' | 'storage' };

/**
 * Add a person to an event's waitlist. The unique (event_id, email)
 * constraint makes a repeat submit a NO-OP success rather than an
 * error — the form must never tell a hopeful visitor they failed when
 * they are in fact on the list.
 */
export async function addWaitlistEntry(
  eventId: string,
  entry: WaitlistInput,
): Promise<WaitlistResult> {
  const name = entry.name.trim();
  const email = entry.email.trim().toLowerCase();
  const phone = entry.phone.trim();
  if (!name || !email || !phone || !email.includes('@') || name.length > 120) {
    return { ok: false, reason: 'invalid' };
  }

  const { status, error } = await rest(
    'POST',
    'event_waitlist',
    '',
    { event_id: eventId, name, email, phone },
  );
  if (status === 409) return { ok: true, duplicate: true }; // already listed
  if (error || status >= 300) {
    // 23505 is Postgres unique_violation — PostgREST reports it as 409,
    // but some proxies flatten it; treat either shape as "listed".
    if (error && error.includes('23505')) return { ok: true, duplicate: true };
    console.error('[events] waitlist insert failed:', status, error);
    return { ok: false, reason: 'storage' };
  }
  return { ok: true, duplicate: false };
}

/** The studio's inbox, from site settings (admin-editable), with the
 *  project address as the fallback — one read, cached per call. */
async function studioInbox(): Promise<string> {
  const { status, data } = await rest<{ value: unknown }[]>(
    'GET',
    'site_settings',
    'key=eq.email&select=value&limit=1',
  );
  if (status === 200 && data && data.length > 0) {
    const raw = data[0].value;
    const email = typeof raw === 'string' ? raw : String((raw as { v?: string })?.v ?? '');
    if (email.includes('@')) return email;
  }
  return 'orders@cra7tyhub.ng';
}

/**
 * Tell the studio a waitlist request arrived. Never throws and never
 * blocks the visitor's submit: the row is already written, and a
 * missing email only costs the notification (it also shows in the
 * admin event's Waitlist tab either way).
 */
export async function notifyStudioOfWaitlist(
  eventName: string,
  entry: WaitlistInput,
): Promise<void> {
  const to = await studioInbox();
  const result = await sendEmail({
    to: { email: to },
    subject: `Waitlist request — ${eventName}`,
    text:
      `A spot was requested for "${eventName}".\n\n` +
      `${entry.name}\n${entry.email}\n${entry.phone}\n\n` +
      `They are on the waitlist in the admin (Events → the event → Waitlist tab).\n`,
    html: `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f1ec;font-family:Georgia,'Times New Roman',serif;color:#1c1a17;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e2da;padding:28px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#7a756c;">Cra7ty Hub — waitlist</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;font-weight:normal;">A spot was requested</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a453e;">
        <strong>${escapeHtml(eventName)}</strong>
      </p>
      <p style="margin:0 0 6px;font-size:15px;line-height:1.6;">${escapeHtml(entry.name)}</p>
      <p style="margin:0 0 6px;font-size:15px;line-height:1.6;"><a href="mailto:${escapeHtml(entry.email)}" style="color:#c2410c;">${escapeHtml(entry.email)}</a></p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${escapeHtml(entry.phone)}</p>
      <p style="margin:0;font-size:13px;color:#7a756c;">On the waitlist in Events → the event → Waitlist tab.</p>
    </div>
  </body>
</html>`.trim(),
  });
  if (!result.ok) {
    console.error('[events] waitlist studio notification not sent:', result.reason);
  }
}

/* ------------------------------------------------------------------ */
/* rate limits — same check_rate_limit RPC the checkout uses           */
/* ------------------------------------------------------------------ */

export const EVENT_RATES = {
  register: { limit: 10, windowSeconds: 60 },
  waitlist: { limit: 5, windowSeconds: 60 },
  verify: { limit: 20, windowSeconds: 60 },
} as const;

export function eventsRateLimit(scope: keyof typeof EVENT_RATES, request: Request) {
  const { limit, windowSeconds } = EVENT_RATES[scope];
  return rateLimit(`events-${scope}`, limit, windowSeconds, request);
}
