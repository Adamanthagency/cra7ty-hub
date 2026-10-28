/**
 * Event ticket delivery (Tier 6) — the ONE place the ticket email is
 * produced, shared by every confirmation path (webhook, verify, the
 * free-event shortcut), exactly like order-confirmation.ts.
 *
 * Both confirmation paths only call `deliverEventTicket` when the RPC
 * reports alreadyProcessed === false, and the RPC is idempotent — so a
 * buyer who hits webhook AND redirect can never be mailed twice. That
 * single-processing guarantee lives in one line instead of a dedupe
 * table.
 *
 * FAILURE POSTURE: never throws, never blocks the caller's response —
 * a webhook answers 2xx even if Resend is down, and a success page
 * must not turn a paid registration into an error because email
 * failed. The ticket is on the page either way.
 *
 * FORMAT: a plain HTML block (visual door check — staff read the name
 * and reference by eye; no QR, no PDF, per the approved plan). The
 * text alternative carries the same five facts for mail clients that
 * strip HTML.
 */

import { loadTicket, type TicketView } from '@/lib/server/events';
import { escapeHtml, sendEmail } from '@/lib/server/order-email';

/** Whole naira → the storefront's formatting. */
const naira = (amount: number): string => `₦${amount.toLocaleString('en-NG')}`;

/** Date + time as the door reads it: "Sat 14 Feb 2026 · 10:00 AM". */
const when = (iso: string): string =>
  new Date(iso).toLocaleString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export interface TicketDeliveryResult {
  sent: boolean;
  reason?: 'not_configured' | 'provider_error' | 'network_error' | 'no_ticket' | 'no_recipient';
}

/**
 * Build the ticket email for a CONFIRMED registration. The subject
 * leads with the registration number so it is findable in a mailbox
 * the week of the event.
 */
export async function deliverEventTicket(
  reference: string,
  attendeeEmail: string,
): Promise<TicketDeliveryResult> {
  const ticket = await loadTicket(reference);
  if (!ticket) return { sent: false, reason: 'no_ticket' };
  if (!attendeeEmail.includes('@')) return { sent: false, reason: 'no_recipient' };

  const result = await sendEmail({
    to: { email: attendeeEmail, name: ticket.attendeeName },
    subject: `Your ticket — ${ticket.eventName} (${ticket.registrationNumber})`,
    text: [
      'Your spot is confirmed. Show this ticket at the door — the name and reference are enough.',
      '',
      `Attendee:  ${ticket.attendeeName}`,
      `Event:     ${ticket.eventName}`,
      `When:      ${when(ticket.eventDate)}`,
      `Where:     ${ticket.eventLocation}`,
      `Reference: ${ticket.reference}  (${ticket.registrationNumber})`,
      ticket.pricePaid > 0 ? `Paid:      ${naira(ticket.pricePaid)}` : 'Free entry',
      '',
      'Cra7ty Hub — Lagos.',
    ].join('\n'),
    html: renderTicketEmail(ticket),
  });

  if (!result.ok) {
    // Log the outcome, never the recipient body or any key.
    console.error('[events] ticket email not sent:', result.reason);
    return { sent: false, reason: result.reason };
  }
  return { sent: true };
}

/** The ticket itself as an email-safe HTML block (inline styles — no
 *  CSS is loaded by mail clients). Shared fields: attendee, event,
 *  when, where, reference. */
export function renderTicketEmail(ticket: TicketView): string {
  const row = (label: string, value: string) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e6e2da;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#7a756c;vertical-align:top;width:110px;">${label}</td>
        <td style="padding:10px 0;border-bottom:1px solid #e6e2da;font-size:15px;color:#1c1a17;">${escapeHtml(value)}</td>
      </tr>`;

  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f1ec;font-family:Georgia,'Times New Roman',serif;color:#1c1a17;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e2da;">
      <div style="padding:24px 28px 0;">
        <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7a756c;">Cra7ty Hub</p>
        <p style="margin:6px 0 0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#c2410c;">Admit one</p>
        <p style="margin:18px 0 2px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#7a756c;">Attendee</p>
        <p style="margin:0;font-size:26px;line-height:1.15;color:#1c1a17;">${escapeHtml(ticket.attendeeName)}</p>
      </div>
      <div style="padding:8px 28px 24px;">
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
${row('Event', ticket.eventName)}
${row('When', when(ticket.eventDate))}
${row('Where', ticket.eventLocation)}
${row('Reference', `${ticket.reference}  ·  ${ticket.registrationNumber}`)}
${row('Entry', ticket.pricePaid > 0 ? naira(ticket.pricePaid) + ' — paid' : 'Free')}
        </table>
        <p style="margin:18px 0 0;font-size:13px;color:#7a756c;">
          Show this ticket at the door — the name and reference are enough. A copy of this email is your ticket.
        </p>
        <p style="margin:14px 0 0;font-size:13px;color:#7a756c;">Cra7ty Hub — Lagos.</p>
      </div>
    </div>
  </body>
</html>`.trim();
}
