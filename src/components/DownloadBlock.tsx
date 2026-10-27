'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Editable } from '@/components/edit/Editable';
import { useSiteContent } from '@/components/site-content-provider';
import { whatsappLink } from '@/lib/whatsapp';

/**
 * The digital-download block (Tier 5) — one component, two homes:
 * the checkout success page and the My Order (/tracker) result view.
 *
 * THREE STATES, and the copy for each is seeded in the admin so it is
 * editable like everything else:
 *   valid    → a Download button plus when the link expires
 *   expired  → "this link has expired" + a Resend action. The resend
 *              asks the server to mint a fresh URL AND email it to the
 *              address on the order; the button confirms success without
 *              revealing anything about the order (the response body is
 *              deliberately empty).
 *   missing  → the file itself is gone (admin deleted it). No dead link
 *              and no error — a WhatsApp path to the studio instead.
 *
 * Resend states: idle → sending → sent | rate-limited | error. The
 * buyer's identity was already proven to reach this view, so the resend
 * call re-sends those same credentials; it never asks for them again.
 */

export interface DownloadItem {
  productId: string;
  name: string;
  filename: string;
  state: 'valid' | 'expired' | 'missing';
  url?: string;
  expiresAt: string;
}

type ResendState = 'idle' | 'sending' | 'sent' | 'rate-limited' | 'error';

const when = (iso: string): string =>
  new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function DownloadBlock({
  downloads,
  orderNumber,
  identity,
}: {
  downloads: DownloadItem[];
  orderNumber: string;
  /** The already-proven identity, replayed for the resend call. */
  identity: { email?: string; phone?: string };
}) {
  const [resend, setResend] = useState<ResendState>('idle');
  const { site } = useSiteContent();

  if (downloads.length === 0) return null;

  const hasMissing = downloads.some((item) => item.state === 'missing');
  const allUsable = downloads.some((item) => item.state !== 'missing');
  // The success page arrives with only a payment reference — no email or
  // phone to prove identity with — so a resend there could never
  // authenticate. Rather than render a button that is guaranteed to
  // fail, point at the My Order page, where the buyer types their
  // identity once and the resend works.
  const canResend = Boolean(identity.email || identity.phone);

  const sendAgain = async () => {
    if (resend === 'sending') return;
    setResend('sending');
    try {
      const response = await fetch('/api/orders/resend-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          ...(identity.email ? { email: identity.email } : {}),
          ...(identity.phone ? { phone: identity.phone } : {}),
        }),
      });
      if (response.status === 200) setResend('sent');
      else if (response.status === 429) setResend('rate-limited');
      else setResend('error');
    } catch {
      setResend('error');
    }
  };

  return (
    <div className="space-y-4">
      <p className="mono-label-xs text-ink-55">
        <Editable k="tracker.downloads.title">Your downloads</Editable>
      </p>

      <ul className="space-y-3">
        {downloads.map((item) => (
          <li
            key={item.productId}
            className="border border-ink-24 bg-kraft/40 px-4 py-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-sm text-ink">{item.name}</p>
                <p className="mono-label-xs mt-1 break-all text-ink-55">
                  {item.filename}
                </p>
              </div>

              {item.state === 'valid' && item.url && (
                <a
                  href={item.url}
                  className="btn btn-primary shrink-0"
                  aria-label={`Download ${item.filename}`}
                >
                  <span>
                    <Editable k="tracker.downloads.download-label">
                      Download
                    </Editable>
                  </span>
                </a>
              )}
            </div>

            {item.state === 'valid' && (
              <p className="mono-label-xs mt-3 text-ink-40">
                <Editable k="tracker.downloads.valid-until-label">
                  Link valid until
                </Editable>{' '}
                {when(item.expiresAt)}
              </p>
            )}

            {item.state === 'expired' && (
              <p className="mono-label-xs mt-3 text-ink-55">
                <Editable k="tracker.downloads.expired-note">
                  This link has expired — ask for a fresh one below.
                </Editable>
              </p>
            )}

            {item.state === 'missing' && (
              <p className="mono-label-xs mt-3 text-vermilion">
                <Editable k="tracker.downloads.missing-note">
                  This file is no longer available — message the studio and
                  we will sort it out.
                </Editable>
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Expired links get a resend action — or, without identity to
          prove, a pointer to the page where that proof happens. A
          fully-missing order gets the studio instead (resending would
          produce nothing to send). */}
      {!canResend && downloads.some((item) => item.state === 'expired') && (
        <p className="mono-label-xs text-ink-55">
          <Editable k="tracker.downloads.expired-no-identity">
            This link has expired — open your order page to get a fresh
            one.
          </Editable>{' '}
          <Link href="/tracker" className="underline underline-offset-2 hover:text-ink">
            <Editable k="tracker.downloads.go-to-order-page">
              My Order
            </Editable>
          </Link>
        </p>
      )}
      {canResend && downloads.some((item) => item.state === 'expired') && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void sendAgain()}
            disabled={resend === 'sending' || resend === 'sent'}
            className="btn btn-secondary disabled:opacity-50"
          >
            <span>
              {resend === 'sending' ? (
                <Editable k="tracker.downloads.sending-label">Sending…</Editable>
              ) : resend === 'sent' ? (
                <Editable k="tracker.downloads.sent-label">Sent — check your email</Editable>
              ) : (
                <Editable k="tracker.downloads.resend-label">
                  Resend download link
                </Editable>
              )}
            </span>
          </button>

          {resend === 'sent' && (
            <p className="mono-label-xs text-ink-55" role="status">
              <Editable k="tracker.downloads.sent-note">
                A fresh link is on its way to the email address on your
                order.
              </Editable>
            </p>
          )}
          {resend === 'rate-limited' && (
            <p className="mono-label-xs text-vermilion" role="alert">
              <Editable k="tracker.downloads.rate-limited-note">
                Too many requests — wait a minute and try again.
              </Editable>
            </p>
          )}
          {resend === 'error' && (
            <p className="mono-label-xs text-vermilion" role="alert">
              <Editable k="tracker.downloads.error-note">
                Could not send the email — please try again.
              </Editable>
            </p>
          )}
        </div>
      )}

      {/* No usable file anywhere: WhatsApp is the only real path. */}
      {!allUsable && hasMissing && (
        <a
          href={whatsappLink(
            `Hello Cra7ty Hub, I need help with the download for order ${orderNumber}.`,
            site.whatsappNumber,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary inline-flex"
        >
          <span>
            <Editable k="tracker.statuses.help-label">
              Message the studio
            </Editable>
          </span>
        </a>
      )}
    </div>
  );
}
