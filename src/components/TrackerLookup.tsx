'use client';

import { useId, useState } from 'react';
import { Editable } from '@/components/edit/Editable';
import { useContentField, useSiteContent } from '@/components/site-content-provider';
import { Button } from '@/components/primitives/Button';
import { naira } from '@/lib/format';
import { whatsappLink } from '@/lib/whatsapp';

/**
 * The /tracker lookup form and its result view (customer-facing order
 * status — no accounts exist, so the order number + email-or-phone at
 * checkout is the authentication, per the approved plan).
 *
 * The form only ever sends { orderNumber, email | phone } — the field
 * containing '@' goes as email, anything else as phone. Responses carry
 * statusKey/items/amounts; labels come from the snapshot: the five
 * fulfillment words from the admin's tracker.statuses list
 * (trackerStatusLabels), the payment-only outcomes from their own
 * Editable keys. The customer's identity is never echoed back.
 *
 * States: idle → loading → result | not-found | rate-limited | error.
 * The miss copy (seeded in the admin) deliberately does not say which
 * field was wrong — the server's 404 doesn't either.
 */

interface LookupResult {
  orderNumber: string;
  statusKey: string;
  placedAt: string;
  updatedAt: string;
  items: { name: string; variant: string | null; quantity: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  total: number;
}

type Phase = 'idle' | 'loading' | 'result' | 'not-found' | 'rate-limited' | 'error';

/** statusKey → index in the admin's tracker.statuses list. */
const LIST_INDEX: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  in_transit: 2,
  delivered: 3,
  cancelled: 4,
};

const when = (iso: string): string =>
  new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function TrackerLookup() {
  const uid = useId();
  const { site, trackerStatusLabels } = useSiteContent();
  const refPlaceholder =
    useContentField('tracker.search.order-ref-placeholder') ?? 'CH-1042';
  const idPlaceholder =
    useContentField('tracker.search.identity-placeholder') ??
    'you@example.com or 080…';

  const [orderNumber, setOrderNumber] = useState('');
  const [identity, setIdentity] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<LookupResult | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ref = orderNumber.trim();
    const who = identity.trim();
    if (!ref || !who || phase === 'loading') return;

    setPhase('loading');
    try {
      const response = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          who.includes('@')
            ? { orderNumber: ref, email: who }
            : { orderNumber: ref, phone: who },
        ),
      });
      if (response.status === 200) {
        const data = (await response.json()) as LookupResult;
        setResult(data);
        setPhase('result');
      } else if (response.status === 404) {
        setPhase('not-found');
      } else if (response.status === 429) {
        setPhase('rate-limited');
      } else {
        setPhase('error');
      }
    } catch {
      // Network failure — never a leak, just the retryable copy.
      setPhase('error');
    }
  };

  const reset = () => {
    setResult(null);
    setPhase('idle');
  };

  const field =
    'w-full border border-ink-24 bg-paper px-4 py-3 text-sm text-ink ' +
    'placeholder:text-ink-40 focus:border-ink focus:outline-none';

  /* ------------------------------- result ------------------------------- */

  if (phase === 'result' && result) {
    const listIndex = LIST_INDEX[result.statusKey];
    const listLabel =
      listIndex === undefined ? null : trackerStatusLabels[listIndex] ?? null;
    const careAboutMoney =
      result.statusKey === 'failed' || result.statusKey === 'awaiting';

    return (
      <div role="status" aria-live="polite" className="space-y-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-b border-ink-24 pb-5">
          <div className="flex flex-wrap items-baseline gap-4">
            <p className="mono-label-xs text-ink-55">
              Order {result.orderNumber}
            </p>
            <span className="inline-flex items-center rounded-card border border-ink-24 bg-kraft px-3 py-1">
              {listLabel !== null ? (
                <span className="mono-label-xs text-ink">{listLabel}</span>
              ) : result.statusKey === 'refunded' ? (
                <span className="mono-label-xs text-vermilion">
                  <Editable k="tracker.statuses.refunded-label">Refunded</Editable>
                </span>
              ) : result.statusKey === 'failed' ? (
                <span className="mono-label-xs text-vermilion">
                  <Editable k="tracker.statuses.failed-label">Payment failed</Editable>
                </span>
              ) : (
                <span className="mono-label-xs text-ink">
                  <Editable k="tracker.statuses.awaiting-label">
                    Awaiting payment
                  </Editable>
                </span>
              )}
            </span>
          </div>
          <p className="mono-label-xs text-ink-55">
            Last updated {when(result.updatedAt)}
          </p>
        </div>

        {careAboutMoney && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-70">
              {result.statusKey === 'failed' ? (
                <Editable k="tracker.statuses.failed-note">
                  Your payment did not go through — you have not been charged.
                </Editable>
              ) : (
                <Editable k="tracker.statuses.awaiting-note">
                  This order is confirmed once payment completes.
                </Editable>
              )}
            </p>
            <Button
              variant="secondary"
              href={whatsappLink(
                `Hello Cra7ty Hub, I have a question about order ${result.orderNumber}.`,
                site.whatsappNumber,
              )}
            >
              <Editable k="tracker.statuses.help-label">
                Message the studio
              </Editable>
            </Button>
          </div>
        )}

        <div>
          <p className="mono-label-xs mb-3 text-ink-55">Items</p>
          <ul>
            {result.items.map((item, index) => (
              <li
                key={`${item.name}-${index}`}
                className="flex items-baseline justify-between gap-4 border-b border-ink-24 py-3"
              >
                <span className="text-sm text-ink">
                  {item.name}
                  {item.variant ? (
                    <span className="text-ink-55"> ({item.variant})</span>
                  ) : null}
                  <span className="mono-label-xs ml-2 text-ink-55">
                    ×{item.quantity}
                  </span>
                </span>
                <span className="mono-label-xs shrink-0 text-ink">
                  {naira(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-1.5">
            <div className="flex justify-between">
              <dt className="mono-label-xs text-ink-55">Subtotal</dt>
              <dd className="mono-label-xs text-ink">{naira(result.subtotal)}</dd>
            </div>
            {result.discount > 0 && (
              <div className="flex justify-between">
                <dt className="mono-label-xs text-ink-55">Discount</dt>
                <dd className="mono-label-xs text-ink">
                  −{naira(result.discount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-ink-24 pt-2">
              <dt className="mono-label text-ink">Order total</dt>
              <dd className="mono-label text-ink">{naira(result.total)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="mono-label-xs text-ink-40">Placed {when(result.placedAt)}</p>
          <Button variant="secondary" onClick={reset}>
            <Editable k="tracker.search.again-label">Track another order</Editable>
          </Button>
        </div>
      </div>
    );
  }

  /* -------------------------------- form -------------------------------- */

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="md:col-span-5">
          <label
            htmlFor={`${uid}-ref`}
            className="mono-label-xs mb-2 block text-ink-55"
          >
            <Editable k="tracker.search.order-ref-label">
              Order reference
            </Editable>
          </label>
          <input
            id={`${uid}-ref`}
            name="orderNumber"
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            placeholder={refPlaceholder}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={field}
          />
        </div>

        <div className="md:col-span-5">
          <label
            htmlFor={`${uid}-who`}
            className="mono-label-xs mb-2 block text-ink-55"
          >
            <Editable k="tracker.search.identity-label">
              Email or phone
            </Editable>
          </label>
          <input
            id={`${uid}-who`}
            name="identity"
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            placeholder={idPlaceholder}
            autoComplete="off"
            className={field}
          />
        </div>

        <div className="flex items-end md:col-span-2">
          <Button type="submit" className="w-full" ariaLabel="Track order">
            {phase === 'loading' ? (
              <Editable k="tracker.search.checking-label">Checking…</Editable>
            ) : (
              <Editable k="tracker.search.button-label">Track order</Editable>
            )}
          </Button>
        </div>
      </div>

      {phase === 'not-found' && (
        <p role="alert" className="mono-label-xs text-vermilion">
          <Editable k="tracker.search.not-found">
            No order found with that reference. Check the number, or message
            the studio on WhatsApp.
          </Editable>
        </p>
      )}
      {phase === 'rate-limited' && (
        <p role="alert" className="mono-label-xs text-vermilion">
          <Editable k="tracker.search.rate-limited">
            Too many attempts — wait a minute and try again.
          </Editable>
        </p>
      )}
      {phase === 'error' && (
        <p role="alert" className="mono-label-xs text-vermilion">
          <Editable k="tracker.search.error">
            Something went wrong — please try again.
          </Editable>
        </p>
      )}
    </form>
  );
}
