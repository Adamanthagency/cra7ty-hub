'use client';

import { useState } from 'react';
import { useOrder } from '@/lib/order-store';
import { naira } from '@/lib/format';
import { Editable } from '@/components/edit/Editable';
import { ArrowRight } from '@/components/primitives/Icons';

/**
 * The drawer's second step (Paystack drawer variant only): delivery
 * details, then hand-off to Paystack.
 *
 * SECURITY: this form never sends a price. It posts product ids, variant
 * keys, quantities, the customer block and the applied coupon code to
 * POST /api/checkout — the server prices everything and returns the
 * authorization URL. The buyer is then sent to Paystack's hosted page;
 * the card never touches this site.
 *
 * The order itself is NOT cleared here: if the buyer abandons Paystack,
 * the cart survives. /checkout/success clears it once payment is
 * confirmed by the server.
 */
export function OrderCheckout({
  coupon,
  payableTotal,
  onBack,
}: {
  /** Applied promo code, if any (re-validated server-side on submit). */
  coupon: string | null;
  /** Display total after the advisory discount — the server recomputes. */
  payableTotal: number;
  onBack: () => void;
}) {
  const { lines } = useOrder();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.trim() !== '' &&
    email.trim().includes('@') &&
    phone.trim() !== '' &&
    address.trim() !== '';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            ...(line.variantKey ? { variantKey: line.variantKey } : {}),
            ...(line.variantLabel ? { variantLabel: line.variantLabel } : {}),
          })),
          customer: {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            address: address.trim(),
          },
          ...(coupon ? { coupon } : {}),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { authorizationUrl?: string; message?: string }
        | null;

      if (response.ok && data?.authorizationUrl) {
        // Full navigation to Paystack's hosted checkout — the order was
        // created and priced server-side; the reference rides in the URL.
        window.location.assign(data.authorizationUrl);
        return;
      }

      setError(
        data?.message ??
          'Could not start checkout — check your details and try again.',
      );
      setSubmitting(false);
    } catch {
      setError('Network problem — check your connection and try again.');
      setSubmitting(false);
    }
  }

  const field =
    'w-full border border-ink-12 bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink';

  return (
    <form
      onSubmit={submit}
      className="ph-no-capture flex-1 overflow-y-auto px-6 py-5"
      noValidate
    >
      <button
        type="button"
        onClick={onBack}
        className="mono-label-xs text-ink-55 underline decoration-ink-24 underline-offset-4 transition-colors hover:text-ink"
      >
        ← <Editable k="global.order-drawer.details-back">Back to order</Editable>
      </button>

      <p className="mt-4 text-sm text-ink-70">
        <Editable k="global.order-drawer.details-intro">
          Where should the studio send this order? Delivery is arranged on
          WhatsApp after payment — nothing is charged for delivery here.
        </Editable>
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mono-label-xs text-ink-55">
            <Editable k="global.order-drawer.details-name">Name</Editable>
          </span>
          <input
            className={`${field} mt-1.5`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={120}
          />
        </label>
        <label className="block">
          <span className="mono-label-xs text-ink-55">
            <Editable k="global.order-drawer.details-email">Email</Editable>
          </span>
          <input
            className={`${field} mt-1.5`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            maxLength={200}
          />
        </label>
        <label className="block">
          <span className="mono-label-xs text-ink-55">
            <Editable k="global.order-drawer.details-phone">Phone</Editable>
          </span>
          <input
            className={`${field} mt-1.5`}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            maxLength={40}
          />
        </label>
        <label className="block">
          <span className="mono-label-xs text-ink-55">
            <Editable k="global.order-drawer.details-address">
              Delivery address
            </Editable>
          </span>
          <textarea
            className={`${field} mt-1.5 min-h-[4.5rem] resize-y`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="street-address"
            maxLength={500}
          />
        </label>
      </div>

      {error && (
        <p className="mono-label-xs mt-4 text-vermilion" role="alert">
          {error}
        </p>
      )}

      <p className="mono-label-xs mt-6 text-ink-40">
        <Editable k="global.order-drawer.paystack-note">
          You will pay securely with Paystack. Your card details never touch
          this site.
        </Editable>
      </p>

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="btn btn-primary mt-4 w-full disabled:opacity-50"
      >
        <span>
          {submitting ? (
            <Editable k="global.order-drawer.pay-opening">
              Opening Paystack…
            </Editable>
          ) : (
            <>
              <Editable k="global.order-drawer.pay-now-label">Pay now</Editable>
              {' — '}
              {naira(payableTotal)}
              <ArrowRight size={14} />
            </>
          )}
        </span>
      </button>
    </form>
  );
}
