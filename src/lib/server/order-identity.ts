/**
 * The one implementation of "is this person who they say they are?"
 * for customer-facing order endpoints (Tier 4 lookup, Tier 5 resend).
 *
 * Extracted so /api/orders/lookup and /api/orders/resend-download can
 * never drift: both compare the SAME normalised values against the SAME
 * column, and both return the SAME miss. Two copies of this logic would
 * eventually disagree about what counts as a match — which is precisely
 * the leak the dual-field rule exists to close.
 *
 * No customer accounts exist: the order number alone is never enough
 * (CH-##### is sequential and guessable), so a match needs the reference
 * PLUS at least one of the checkout identity fields. Both fields are
 * NOT NULL on orders (create_checkout_order hard-requires them), so
 * either one alone is sufficient proof.
 */

/** Trim + casefold: emails compare case-insensitively. */
export function normEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Digit-string with 234↔0 equivalence, so `0915 734 1181`,
 * `09157341181` and `+2349157341181` all canonicalize the same way.
 */
export function normPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length > 11 && digits.startsWith('234')
    ? `0${digits.slice(3)}`
    : digits;
}

export interface IdentityProof {
  /** Already-trimmed raw input from the request body. */
  email: string;
  phone: string;
}

export interface OrderContact {
  customer_email: string;
  customer_phone: string;
}

/**
 * True when EITHER supplied field matches the order's stored contact.
 * An empty field never matches (so `{}` proves nothing), and a value the
 * caller didn't supply is simply not considered — no "wrong field"
 * signal is ever produced for the caller to learn from.
 */
export function identityMatches(proof: IdentityProof, order: OrderContact): boolean {
  const emailMatch =
    proof.email !== '' && normEmail(proof.email) === normEmail(order.customer_email);
  const phoneMatch =
    proof.phone !== '' && normPhone(proof.phone) === normPhone(order.customer_phone);
  return emailMatch || phoneMatch;
}

/**
 * The address the studio actually holds for the order. Resend and any
 * other server-side delivery must use THIS, never a client-supplied
 * string — otherwise the endpoint becomes a mail relay keyed by a
 * guessable order number.
 */
export function orderEmailAddress(order: OrderContact): string {
  return order.customer_email;
}
