'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useOrder } from '@/lib/order-store';
import { useSiteContent } from '@/components/site-content-provider';
import { whatsappLink } from '@/lib/whatsapp';
import { Editable } from '@/components/edit/Editable';
import { Check } from '@/components/primitives/Icons';
import { DownloadBlock, type DownloadItem } from '@/components/DownloadBlock';

/**
 * Where Paystack sends the buyer back to (the callback_url set in
 * POST /api/checkout). Everything on the query string is UNTRUSTED — the
 * reference is the only thing read, and it is shape-checked here and
 * verified server-side before this page claims anything: the server asks
 * Paystack directly (GET /transaction/verify) and confirms the order
 * through the same confirm_paid_order RPC the webhook uses.
 *
 * So this page never says "paid" because a URL parameter said so — only
 * because the server verified it with Paystack. The webhook remains the
 * primary confirmation path; this is the buyer-facing backup that also
 * covers "the webhook hasn't landed yet".
 *
 * The order is cleared from the cart only AFTER the server confirms
 * payment — an abandoned or failed payment keeps the buyer's cart intact.
 */

const REFERENCE_PATTERN = /^chr_[0-9a-f]{32}$/;

type State =
  | 'verifying'
  | 'paid'
  | 'flagged' // paid, but flagged for studio review (amount/stock race)
  | 'unpaid' // Paystack says not-successful (failed/abandoned)
  | 'unavailable' // could not reach verification — retry offered
  | 'invalid'; // no/malformed reference, or unknown order

function SuccessClient() {
  const params = useSearchParams();
  const reference = params.get('ref') ?? '';
  const { clear } = useOrder();
  const { site } = useSiteContent();

  const [state, setState] = useState<State>('verifying');
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  // Digital downloads, minted by the verify call. Kept separate from
  // orderNumber because a paid order with no files is the common case.
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const cleared = useRef(false);

  const verify = useCallback(async () => {
    setState('verifying');
    try {
      const response = await fetch('/api/checkout/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      const data = (await response.json().catch(() => null)) as {
        paid?: boolean;
        alreadyProcessed?: boolean;
        orderNumber?: string;
        needsReview?: boolean;
        downloads?: DownloadItem[];
        error?: string;
      } | null;

      if (response.status === 404 || response.status === 400) {
        setState('invalid');
        return;
      }
      if (response.status === 502 || !data) {
        setState('unavailable');
        return;
      }
      if (data.paid) {
        setOrderNumber(data.orderNumber ?? null);
        setDownloads(data.downloads ?? []);
        if (!cleared.current) {
          cleared.current = true;
          clear(); // the bought items leave the cart — confirmed only now
        }
        setState(data.needsReview ? 'flagged' : 'paid');
        return;
      }
      setState('unpaid');
    } catch {
      setState('unavailable');
    }
  }, [reference, clear]);

  useEffect(() => {
    if (!REFERENCE_PATTERN.test(reference)) {
      setState('invalid');
      return;
    }
    void verify();
  }, [reference, verify]);

  const panel = 'mx-auto w-full max-w-prose border border-ink-12 px-6 py-8 sm:px-8';

  return (
    <section className="px-4 py-16 sm:py-24" aria-live="polite">
      <div className={panel}>
        {state === 'verifying' && (
          <>
            <p className="mono-label-xs text-ink-55">
              <Editable k="global.order-drawer.verify-eyebrow">
                Payment
              </Editable>
            </p>
            <h1 className="mt-3 font-display text-4xl leading-none">
              <Editable k="global.order-drawer.verify-headline">
                Checking your payment…
              </Editable>
            </h1>
            <p className="mt-4 text-sm text-ink-70">
              <Editable k="global.order-drawer.verify-body">
                One moment — we are confirming this with Paystack.
              </Editable>
            </p>
          </>
        )}

        {(state === 'paid' || state === 'flagged') && (
          <>
            <span className="inline-flex h-10 w-10 items-center justify-center border border-ink">
              <Check size={16} />
            </span>
            <h1 className="mt-5 font-display text-4xl leading-none">
              <Editable k="global.order-drawer.payment-success-headline">
                Payment received.
              </Editable>
            </h1>
            {orderNumber && (
              <p className="mono-label mt-4 text-ink-55">
                <Editable k="global.order-drawer.order-number-label">
                  Order
                </Editable>{' '}
                <span className="tabular-nums">{orderNumber}</span>
              </p>
            )}
            <p className="mt-4 text-sm text-ink-70">
              <Editable k="global.order-drawer.payment-success">
                Payment received. The order is with the studio — you will get a
                WhatsApp confirmation.
              </Editable>
            </p>
            {state === 'flagged' && (
              <p className="mono-label-xs mt-3 text-ink-55">
                <Editable k="global.order-drawer.payment-flagged">
                  The studio will double-check this order before dispatch and
                  confirm on WhatsApp.
                </Editable>
              </p>
            )}

            {/* Tier 5: instant access. The same one-time links the
                confirmation email carries — the success page is the fast
                path, the email the backup for when this tab is gone.
                (No identity to replay here: with resend gone, the only
                credential is the link itself.) */}
            {downloads.length > 0 && orderNumber && (
              <div className="mt-7 border-t border-ink-24 pt-6">
                <DownloadBlock
                  downloads={downloads}
                  orderNumber={orderNumber}
                />
              </div>
            )}
          </>
        )}

        {state === 'unpaid' && (
          <>
            <h1 className="font-display text-4xl leading-none">
              <Editable k="global.order-drawer.payment-failed-headline">
                Payment not completed.
              </Editable>
            </h1>
            <p className="mt-4 text-sm text-ink-70">
              <Editable k="global.order-drawer.payment-failed">
                Payment failed — nothing was charged. Try again, or send the
                order on WhatsApp instead.
              </Editable>
            </p>
          </>
        )}

        {state === 'unavailable' && (
          <>
            <h1 className="font-display text-4xl leading-none">
              <Editable k="global.order-drawer.verify-unavailable-headline">
                Could not verify yet.
              </Editable>
            </h1>
            <p className="mt-4 text-sm text-ink-70">
              <Editable k="global.order-drawer.verify-unavailable-body">
                We could not reach the payment provider just now. If you were
                charged, this page will confirm it on retry — nothing is lost.
              </Editable>
            </p>
          </>
        )}

        {state === 'invalid' && (
          <>
            <h1 className="font-display text-4xl leading-none">
              <Editable k="global.order-drawer.verify-invalid-headline">
                Nothing to verify.
              </Editable>
            </h1>
            <p className="mt-4 text-sm text-ink-70">
              <Editable k="global.order-drawer.verify-invalid-body">
                This link does not carry a valid payment reference.
              </Editable>
            </p>
          </>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {(state === 'unavailable' || state === 'verifying') && (
            <button
              type="button"
              onClick={() => void verify()}
              disabled={state === 'verifying'}
              className="btn btn-primary disabled:opacity-50"
            >
              <span>
                <Editable k="global.order-drawer.verify-retry">
                  Check again
                </Editable>
              </span>
            </button>
          )}
          {state !== 'verifying' && (
            <Link href="/" className="btn btn-secondary">
              <span>
                <Editable k="global.order-drawer.back-home-label">
                  Back to the shop
                </Editable>
              </span>
            </Link>
          )}
          {/* Payment landed → the customer's natural next question is
              "where is it?" — hand them the tracker with the order number
              they just saw on this page. */}
          {(state === 'paid' || state === 'flagged') && (
            <Link href="/tracker" className="btn btn-secondary">
              <span>
                <Editable k="global.order-drawer.track-order-label">
                  My Order
                </Editable>
              </span>
            </Link>
          )}
          {(state === 'unpaid' || state === 'invalid') && (
            <a
              href={whatsappLink(
                'Hello Cra7ty Hub, I have a question about my order payment.',
                site.whatsappNumber,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <span>
                <Editable k="global.order-drawer.ask-label">
                  Ask a question
                </Editable>
              </span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <section className="px-4 py-24">
          <p className="mono-label-xs text-ink-55">Checking payment…</p>
        </section>
      }
    >
      <SuccessClient />
    </Suspense>
  );
}
