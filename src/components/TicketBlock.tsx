import { eventWhen } from '@/lib/event-format';
import { naira } from '@/lib/format';

/**
 * The ticket (Tier 6) — the React twin of the email's HTML block in
 * event-ticket.ts: same five facts, same visual language, printed for
 * the success page to show after confirmation.
 *
 * Deliberately NOT a QR or a PDF: door check is a person reading a
 * name and a reference (approved plan), so the name is the largest
 * text on the card and the reference sits where a staff member's eye
 * lands second. Plain component on purpose — no server-only imports —
 * so the client success page can render it directly from the verify
 * response.
 */

export interface TicketData {
  registrationNumber: string;
  reference: string;
  attendeeName: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  pricePaid: number;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-ink-12 py-2.5 last:border-b-0">
      <span className="mono-label-xs w-[6.5rem] shrink-0 text-ink-40">{label}</span>
      <span className="text-sm text-ink md:text-base">{value}</span>
    </div>
  );
}

export function TicketBlock({ ticket }: { ticket: TicketData }) {
  return (
    <div className="border border-ink-24 bg-paper">
      <div className="border-b border-ink-12 px-6 pt-6 pb-4 md:px-8">
        <p className="mono-label-xs text-ink-55">Cra7ty Hub</p>
        <p className="mono-label-xs mt-1 text-vermilion">Admit one</p>
        <p className="mono-label-xs mt-5 text-ink-40">Attendee</p>
        <p className="font-display mt-0.5 text-2xl leading-tight text-ink md:text-3xl">
          {ticket.attendeeName}
        </p>
      </div>
      <div className="px-6 py-4 md:px-8">
        <Row label="Event" value={ticket.eventName} />
        <Row label="When" value={eventWhen(ticket.eventDate)} />
        <Row label="Where" value={ticket.eventLocation} />
        <Row label="Reference" value={`${ticket.reference} · ${ticket.registrationNumber}`} />
        <Row
          label="Entry"
          value={ticket.pricePaid > 0 ? `${naira(ticket.pricePaid)} — paid` : 'Free'}
        />
      </div>
      <div className="border-t border-ink-12 px-6 py-4 md:px-8">
        <p className="text-xs leading-relaxed text-ink-55 md:text-sm">
          Show this ticket at the door — the name and reference are enough. This page and
          the email are both your ticket.
        </p>
      </div>
    </div>
  );
}
