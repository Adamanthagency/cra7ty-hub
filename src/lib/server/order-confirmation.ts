/**
 * Order confirmation delivery (Tier 5) — the ONE place a confirmation
 * email is produced, shared by both confirmation paths.
 *
 * WHY A SHARED MODULE: confirm_paid_order is called from the Paystack
 * webhook AND from the success page's verify route. If each path built
 * its own email, a buyer who hits both (webhook lands, page also
 * verifies) could receive two messages. Both paths call
 * `deliverOrderConfirmation` only when the RPC reports
 * `alreadyProcessed === false` — and the RPC is idempotent, so exactly
 * one of the two ever sees that flag. That is the single-processing
 * guarantee, in one line, rather than a dedupe table.
 *
 * FAILURE POSTURE: never throws, never blocks the caller's response.
 * A webhook must answer 2xx even if Resend is down (Paystack retries on
 * non-2xx, and retrying a confirmation we already applied is harmless
 * but pointless); the buyer's success page must not turn a paid order
 * into an error because email failed. Both callers therefore `await`
 * this and ignore the result, and we log loudly.
 */

import { rest } from '@/lib/server/supabase-server';
import {
  buildDownloadViews,
  loadGrants,
  markEmailSent,
  type DownloadView,
} from '@/lib/server/downloads';
import { escapeHtml, sendEmail } from '@/lib/server/order-email';

interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  subtotal: number;
  discount: number;
  total: number;
  created_at: string;
}

interface ItemRow {
  product_name: string;
  variant_label: string | null;
  quantity: number;
  line_total: number;
}

/** Whole naira → the same formatting the storefront uses. */
const naira = (amount: number): string => `₦${amount.toLocaleString('en-NG')}`;

const when = (iso: string): string =>
  new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Load the order + its line items. Returns null when the order is not
 * there — the caller has already been told the confirmation succeeded,
 * so a read failure here only costs the email, never the confirmation.
 */
async function loadOrder(orderId: string): Promise<{
  order: OrderRow;
  items: ItemRow[];
} | null> {
  const orderRead = await rest<OrderRow[]>(
    'GET',
    'orders',
    `id=eq.${encodeURIComponent(orderId)}` +
      '&select=id,order_number,customer_name,customer_email,subtotal,discount,total,created_at&limit=1',
  );
  if (orderRead.error || !orderRead.data || orderRead.data.length === 0) {
    console.error('[email] could not load order for confirmation:', orderRead.error ?? 'not found');
    return null;
  }

  const itemsRead = await rest<ItemRow[]>(
    'GET',
    'order_items',
    `order_id=eq.${encodeURIComponent(orderId)}` +
      '&select=product_name,variant_label,quantity,line_total&order=position.asc',
  );

  return { order: orderRead.data[0], items: itemsRead.data ?? [] };
}

/**
 * Render the confirmation message. Pure — the same function feeds the
 * email and (via buildDownloadViews) whatever links it must carry.
 */
function renderEmail(
  order: OrderRow,
  items: ItemRow[],
  downloads: DownloadView[],
  siteUrl: string,
): { subject: string; text: string; html: string } {
  const subject = `Your Cra7ty Hub order ${order.order_number} is confirmed`;

  const itemLines = items.map(
    (item) =>
      `${item.product_name}${item.variant_label ? ` (${item.variant_label})` : ''} ×${item.quantity} — ${naira(item.line_total)}`,
  );

  const trackerUrl = `${siteUrl}/tracker`;
  const expires = downloads.find((d) => d.state === 'valid')?.expiresAt;

  // ---- plain text ----------------------------------------------------
  const textLines = [
    `Hello ${order.customer_name},`,
    '',
    `Your payment for order ${order.order_number} has been received and the order is confirmed.`,
    '',
    'Items:',
    ...itemLines.map((line) => `  • ${line}`),
    '',
    `Total paid: ${naira(order.total)}`,
    `Placed: ${when(order.created_at)}`,
    '',
  ];

  if (downloads.length > 0) {
    textLines.push('Your downloads:', '');
    for (const download of downloads) {
      if (download.state === 'valid' && download.url) {
        textLines.push(`  ${download.name} — ${download.url}`);
      } else {
        textLines.push(`  ${download.name} — available from your order page`);
      }
    }
    textLines.push('');
    if (expires) {
      textLines.push(
        `Download links expire ${when(expires)}. You can get a fresh link any time from ${trackerUrl}.`,
        '',
      );
    } else {
      textLines.push(`Get a fresh link any time from ${trackerUrl}.`, '');
    }
  }

  textLines.push(
    `Check this order any time: ${trackerUrl}`,
    '',
    'Cra7ty Hub — handfolded origami and paper goods, Lagos.',
  );

  // ---- html ----------------------------------------------------------
  const rowsHtml = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e6e2da;color:#1c1a17;">
            ${escapeHtml(item.product_name)}${
              item.variant_label ? ` <span style="color:#7a756c;">(${escapeHtml(item.variant_label)})</span>` : ''
            } <span style="color:#7a756c;">×${item.quantity}</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #e6e2da;text-align:right;color:#1c1a17;">
            ${naira(item.line_total)}
          </td>
        </tr>`,
    )
    .join('');

  const downloadsHtml =
    downloads.length === 0
      ? ''
      : `
      <div style="margin-top:24px;padding:16px;border:1px solid #e6e2da;background:#faf8f4;">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#7a756c;">Your downloads</p>
        ${downloads
          .map((download) => {
            if (download.state === 'valid' && download.url) {
              return `<p style="margin:0 0 10px;">
                <strong style="color:#1c1a17;">${escapeHtml(download.name)}</strong><br/>
                <a href="${escapeHtml(download.url)}" style="color:#c2410c;">Download ${escapeHtml(download.filename)}</a>
              </p>`;
            }
            return `<p style="margin:0 0 10px;color:#7a756c;">${escapeHtml(download.name)} — get it from your order page.</p>`;
          })
          .join('')}
        ${
          expires
            ? `<p style="margin:12px 0 0;font-size:13px;color:#7a756c;">Links expire ${escapeHtml(when(expires))}. Need a fresh one? Use the My Order page and we will send it again.</p>`
            : ''
        }
      </div>`;

  const html = `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f1ec;font-family:Georgia,'Times New Roman',serif;color:#1c1a17;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e2da;padding:28px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#7a756c;">Cra7ty Hub</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;font-weight:normal;">Payment received for ${escapeHtml(order.order_number)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a453e;">
        Hello ${escapeHtml(order.customer_name)}, your order is confirmed and with the studio.
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:15px;">
        ${rowsHtml}
        <tr>
          <td style="padding:12px 0 0;font-size:15px;color:#1c1a17;"><strong>Total paid</strong></td>
          <td style="padding:12px 0 0;text-align:right;font-size:15px;color:#1c1a17;"><strong>${naira(order.total)}</strong></td>
        </tr>
      </table>

      ${downloadsHtml}

      <p style="margin:24px 0 0;font-size:14px;color:#4a453e;">
        Check this order any time:
        <a href="${escapeHtml(trackerUrl)}" style="color:#c2410c;">${escapeHtml(trackerUrl)}</a>
      </p>
      <p style="margin:20px 0 0;font-size:13px;color:#7a756c;">
        Cra7ty Hub — handfolded origami and paper goods, Lagos.
      </p>
    </div>
  </body>
</html>`.trim();

  return { subject, text: textLines.join('\n'), html };
}

export interface DeliveryResult {
  sent: boolean;
  reason?: string;
  downloadCount: number;
}

/**
 * Send the confirmation email for a freshly-confirmed order.
 *
 * Safe to call more than once (it is only ever called on
 * `alreadyProcessed === false`), best-effort by design, and never
 * throws. Returns what happened so tests and logs can assert on it.
 */
export async function deliverOrderConfirmation(
  orderId: string,
): Promise<DeliveryResult> {
  try {
    const loaded = await loadOrder(orderId);
    if (!loaded) return { sent: false, reason: 'order_unreadable', downloadCount: 0 };

    const { order, items } = loaded;

    // Digital links ride the same email. They are minted here rather
    // than stored, so what the buyer gets is always a live URL.
    const grants = await loadGrants(orderId);
    const downloads = grants.length > 0 ? await buildDownloadViews(grants) : [];

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.VERCEL_URL?.replace(/^/, 'https://') ??
      'https://cra7tyhub.com';

    const { subject, text, html } = renderEmail(order, items, downloads, siteUrl);

    const result = await sendEmail({
      to: { name: order.customer_name, email: order.customer_email },
      subject,
      text,
      html,
    });

    if (!result.ok) {
      // The order is confirmed regardless — this is a delivery failure,
      // not a confirmation failure. The buyer can still use the My Order
      // page, which is exactly why that page exists.
      return { sent: false, reason: result.reason, downloadCount: downloads.length };
    }

    // Record the send against every grant that actually carried a live
    // link, so the My Order page can tell "emailed" from "never sent".
    for (const view of downloads) {
      if (view.state !== 'valid') continue;
      const grant = grants.find((g) => g.productId === view.productId);
      if (grant) await markEmailSent(grant.id);
    }

    return { sent: true, downloadCount: downloads.length };
  } catch (error) {
    // Belt and braces: nothing in here should throw, but a webhook must
    // never be the thing that fails because email did.
    console.error('[email] confirmation delivery failed unexpectedly:', (error as Error)?.message);
    return { sent: false, reason: 'unexpected', downloadCount: 0 };
  }
}
