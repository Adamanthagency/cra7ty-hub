/**
 * Transactional email over Resend's HTTP API (Tier 5).
 *
 * WHY NO SDK: Resend's send endpoint is a single POST with a JSON body.
 * The whole project speaks raw `fetch` to Supabase and Paystack for the
 * same reason — one less dependency to keep current, and nothing here
 * needs anything more than `fetch`.
 *
 * CONFIGURATION (all server-only, never NEXT_PUBLIC_, never logged):
 *   RESEND_API_KEY  — required. Set in Vercel; the sender below refuses
 *                     to run without it.
 *   RESEND_FROM     — the verified sender address. Kept as an env var
 *                     rather than a constant so a corrected domain can
 *                     be fixed in Vercel without a redeploy.
 *   ORDER_EMAIL_REPLY_TO — optional reply-to; defaults to the studio
 *                     address from site content when unset.
 *
 * NEVER THROWS: a mail failure must not fail a webhook (Paystack would
 * retry forever) nor a buyer's success page. Every path returns a
 * result object and logs the outcome without any key material.
 */

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface SendEmailInput {
  to: EmailAddress;
  subject: string;
  /** Plain-text alternative — the fallback when HTML is not rendered. */
  text: string;
  html: string;
  replyTo?: EmailAddress;
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'not_configured' | 'provider_error' | 'network_error'; detail: string };

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * The sender. Resend only accepts an address at a VERIFIED domain, so
 * this must match whatever the dashboard confirms — hence the env var.
 * The fallback below is deliberately a subdomain-shaped address, which
 * is what this project verifies (same pattern as its auth sender).
 */
export function defaultSender(): string {
  return process.env.RESEND_FROM ?? 'orders@orders.cra7tyhub.com';
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Escape text before it goes inside HTML — order names are admin input. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { escapeHtml };

/**
 * Send one message. Resolves rather than throws so callers can decide
 * what a failure costs them (a webhook: nothing; a resend button: an
 * error state the customer can retry).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY is not set — message not sent');
    return { ok: false, reason: 'not_configured', detail: 'RESEND_API_KEY missing' };
  }

  const body = {
    from: defaultSender(),
    to: [input.to.email],
    subject: input.subject,
    text: input.text,
    html: input.html,
    ...(input.replyTo ? { reply_to: input.replyTo.email } : {}),
  };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      // Never cache a send; a retry must be a real retry.
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    const text = await response.text();
    if (!response.ok) {
      // Log status + provider message only — never the key, never the
      // full body (it contains the recipient address and link).
      let detail = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) detail += `: ${parsed.message}`;
      } catch {
        // provider sent non-JSON; the status alone is enough to debug
      }
      console.error('[email] Resend rejected the message —', detail);
      return { ok: false, reason: 'provider_error', detail };
    }

    let id = '';
    try {
      const parsed = JSON.parse(text) as { id?: string };
      id = parsed.id ?? '';
    } catch {
      // an id is nice-to-have, not required
    }
    return { ok: true, id };
  } catch (error) {
    const detail = (error as Error)?.message ?? 'network failure';
    console.error('[email] could not reach Resend —', detail);
    return { ok: false, reason: 'network_error', detail };
  }
}
