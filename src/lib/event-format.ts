/**
 * Event date formatting (Tier 6). One place so the listing card, the
 * detail page, the ticket block and the email all read the same clock.
 */

/** "Sat 14 Feb 2026 · 10:00 AM" — the ticket/door reading. */
export function eventWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "Sat 14 Feb" — the compact listing-card reading. */
export function eventDay(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** "10:00 AM" — the time half of the listing card. */
export function eventTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
