import type { OrderLine } from '@/lib/types';
import { naira } from '@/lib/format';
import { site } from '@/data/site';

/**
 * The whole site funnels orders through WhatsApp, so this builds the message
 * a buyer sends us: every line, the quantity, the line total and the order
 * total. Nothing is charged on the site.
 *
 * The link builders take an optional `number` so callers holding the content
 * snapshot pass the LIVE number from the Settings manager; the /data value
 * stays the default for anything that renders before the snapshot exists.
 */
export function buildOrderMessage(lines: OrderLine[]): string {
  const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0);
  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  const header = `Hello Cra7ty Hub, I would like to place an order:`;
  const body = lines
    .map((line, i) => {
      const lineTotal = line.quantity * line.unitPrice;
      // variant selections ride the line: "Name (Kraft / Standard) — …"
      const name = line.variantLabel
        ? `${line.name} (${line.variantLabel})`
        : line.name;
      return `${i + 1}. ${name} — ${line.quantity} × ${naira(line.unitPrice)} = ${naira(lineTotal)}`;
    })
    .join('\n');

  const footer = [
    '',
    `Order total: ${naira(total)}`,
    `Units: ${totalUnits} across ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`,
    '',
    'My delivery city and street:',
    'Preferred date:',
  ].join('\n');

  return `${header}\n\n${body}\n${footer}`;
}

/** wa.me deep link with the message pre-filled. */
export function whatsappOrderLink(
  lines: OrderLine[],
  number: string = site.whatsappNumber,
): string {
  const text = encodeURIComponent(buildOrderMessage(lines));
  return `https://wa.me/${number}?text=${text}`;
}

/** A wa.me link with no order attached, for general enquiries. */
export function whatsappLink(
  message: string,
  number: string = site.whatsappNumber,
): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
