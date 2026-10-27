import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, rest, rpc, serviceConfigured } from '@/lib/server/supabase-server';

/**
 * POST /api/orders/lookup — the public customer-facing status lookup
 * behind /tracker (approved plan, no customer accounts exist).
 *
 * AUTHENTICATION: a match requires the order number AND one of the
 * checkout identity fields (email or phone — both are NOT NULL on
 * orders; checkout gates Pay now on both being present). Reference
 * alone is never enough: CH-##### is sequential and guessable, so the
 * dual requirement is the actual defence and the rate limits are the
 * backstop.
 *
 * NO LEAKAGE: every failure — unknown reference, wrong email, wrong
 * phone, right reference with the wrong identity — returns the SAME
 * 404 body from one constant. Nothing says which field was wrong (or
 * that the reference exists at all). The response never carries the
 * chr_ reference, customer contact, delivery address, notes, coupon or
 * review flags — only status, line items and amounts.
 *
 * RATE LIMITS (fixed 60s windows via check_rate_limit, both fail-open
 * like checkout: a dead limiter must not take the page down):
 *   * 10/min per IP      — `lookup:<ip>`        (the house number)
 *   * 30/min per ref     — `lookup_ref:<ref>`   (global across IPs;
 *     stops hot-spotting one reference from a botnet while leaving the
 *     legitimate owner plenty of headroom; worst-case lockout 60s)
 *
 * POST deliberately: identity stays out of URLs, so it never lands in
 * CDN or access logs. This route logs no request bodies.
 */

export const dynamic = 'force-dynamic';

const IP_RATE = { limit: 10, windowSeconds: 60 };
const REF_RATE = { limit: 30, windowSeconds: 60 };

const ORDER_NUMBER = /^CH-\d{3,6}$/;
const MAX_EMAIL = 320;
const MAX_PHONE = 60;

/** One constant for every miss — byte-identical across failure paths. */
const NOT_FOUND = { error: 'not_found' };

interface LookupRow {
  id: string;
  order_number: string;
  payment_status: string;
  status: string;
  customer_email: string;
  customer_phone: string;
  subtotal: number;
  discount: number;
  total: number;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  product_name: string;
  variant_label: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

/** Trim + casefold: emails compare case-insensitively. */
const normEmail = (value: string): string => value.trim().toLowerCase();

/**
 * Digit-string with 234↔0 equivalence, so `0915 734 1181`,
 * `09157341181` and `+2349157341181` all canonicalize the same way.
 */
const normPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.length > 11 && digits.startsWith('234')
    ? `0${digits.slice(3)}`
    : digits;
};

/**
 * Status precedence (plan): refunded > cancelled > failed > awaiting >
 * the paid fulfillment axis. The fulfillment words come from the
 * admin's tracker.statuses labels on the page; the API returns keys.
 */
function statusKeyFor(row: Pick<LookupRow, 'payment_status' | 'status'>): string {
  if (row.payment_status === 'refunded') return 'refunded';
  if (row.status === 'cancelled') return 'cancelled';
  if (row.payment_status === 'failed') return 'failed';
  if (row.payment_status === 'pending') return 'awaiting';
  return row.status; // pending | confirmed | in_transit | delivered
}

export async function POST(request: NextRequest) {
  if (!serviceConfigured()) {
    return NextResponse.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
  }

  // IP bucket first, before parsing: garbage consumes quota too.
  if (!(await rateLimit('lookup', IP_RATE.limit, IP_RATE.windowSeconds, request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as {
    orderNumber?: unknown;
    email?: unknown;
    phone?: unknown;
  } | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const orderNumber =
    typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  // Structural validation only — says nothing about whether anything exists.
  if (
    !ORDER_NUMBER.test(orderNumber) ||
    (!email && !phone) ||
    email.length > MAX_EMAIL ||
    phone.length > MAX_PHONE
  ) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Reference bucket: one counter for every IP probing this reference.
  try {
    const allowed = await rpc<boolean>('check_rate_limit', {
      p_bucket: `lookup_ref:${orderNumber}`,
      p_limit: REF_RATE.limit,
      p_window_seconds: REF_RATE.windowSeconds,
    });
    if (allowed !== true) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
  } catch {
    // Same fail-open posture as the IP limiter, same visibility in logs.
    console.error('[lookup] reference rate limiter unavailable — allowing request');
  }

  // Single read by number only happens server-side; the response still
  // requires the identity match below.
  const { data, error } = await rest<LookupRow[]>(
    'GET',
    'orders',
    `order_number=eq.${encodeURIComponent(orderNumber)}` +
      '&select=id,order_number,payment_status,status,customer_email,customer_phone,' +
      'subtotal,discount,total,created_at,updated_at&limit=1',
  );
  if (error || !data || data.length === 0) {
    // Infra failure and "no such order" share the miss body — a broken
    // database must not become an oracle either.
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }
  const row = data[0];

  const emailMatch =
    email !== '' && normEmail(email) === normEmail(row.customer_email);
  const phoneMatch =
    phone !== '' && normPhone(phone) === normPhone(row.customer_phone);
  if (!emailMatch && !phoneMatch) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const items = await rest<ItemRow[]>(
    'GET',
    'order_items',
    `order_id=eq.${encodeURIComponent(row.id)}` +
      '&select=product_name,variant_label,quantity,unit_price,line_total' +
      '&order=position.asc',
  );

  return NextResponse.json(
    {
      orderNumber: row.order_number,
      statusKey: statusKeyFor(row),
      placedAt: row.created_at,
      updatedAt: row.updated_at,
      items: (items.data ?? []).map((item) => ({
        name: item.product_name,
        variant: item.variant_label,
        quantity: item.quantity,
        lineTotal: item.line_total,
      })),
      subtotal: row.subtotal,
      discount: row.discount,
      total: row.total,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        // Identity never ends up in a shared cache even if a proxy tries.
        'CDN-Cache-Control': 'no-store',
      },
    },
  );
}
