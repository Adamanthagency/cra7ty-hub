import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, rest, serviceConfigured } from '@/lib/server/supabase-server';

/**
 * POST /api/coupons/validate — advisory coupon check (public, rate-limited).
 *
 * Lets the drawer show the discounted total before the buyer commits.
 * ADVISORY ONLY: create_checkout_order re-validates against the same row
 * at order creation, and confirm_paid_order re-checks the usage limit at
 * payment time — this endpoint never increments usage_count and its
 * answer never becomes the price of record.
 *
 * SECURITY: the discount returned is computed from the coupon_codes ROW
 * (type + value), never from anything the client sends. The client sends
 * only the code and the subtotal it's looking at — and even that subtotal
 * is merely matched against min_order_amount; the real total is the
 * server's.
 *
 * Rate limit: 10/min per IP — codes are cheap to guess (SAVE10), so
 * brute-forcing the catalogue must not be free.
 */

export const dynamic = 'force-dynamic';

const RATE = { limit: 10, windowSeconds: 60 };
const MAX_CODE_LENGTH = 40;
const MAX_SUBTOTAL = 100_000_000; // ₦100m — far above any real cart

interface CouponRow {
  code: string;
  type: 'percentage' | 'flat';
  value: number;
  usage_count: number;
  usage_limit: number | null;
  expires_at: string | null;
  min_order_amount: number | null;
}

export async function POST(request: NextRequest) {
  if (!serviceConfigured()) {
    return NextResponse.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
  }

  if (!(await rateLimit('coupons', RATE.limit, RATE.windowSeconds, request))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many attempts — try again shortly.' },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    code?: unknown;
    subtotal?: unknown;
  } | null;

  const code =
    body && typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  const subtotal =
    body && typeof body.subtotal === 'number' && Number.isInteger(body.subtotal)
      ? body.subtotal
      : -1;

  if (
    !code ||
    code.length > MAX_CODE_LENGTH ||
    !/^[A-Z0-9_-]+$/.test(code) ||
    subtotal < 0 ||
    subtotal > MAX_SUBTOTAL
  ) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { data, error } = await rest<CouponRow[]>(
    'GET',
    'coupon_codes',
    `code=eq.${encodeURIComponent(code)}&active=eq.true&select=code,type,value,usage_count,usage_limit,expires_at,min_order_amount&limit=1`,
  );

  if (error || !data) {
    console.error('[coupons] lookup failed');
    return NextResponse.json(
      { error: 'lookup_failed', message: 'Could not check the code — try again.' },
      { status: 500 },
    );
  }

  const coupon = data[0];
  if (!coupon) {
    return NextResponse.json({ valid: false, reason: 'invalid' });
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ valid: false, reason: 'expired' });
  }
  if (
    coupon.usage_limit !== null &&
    coupon.usage_count >= coupon.usage_limit
  ) {
    return NextResponse.json({ valid: false, reason: 'exhausted' });
  }
  if (coupon.min_order_amount !== null && subtotal < coupon.min_order_amount) {
    return NextResponse.json({
      valid: false,
      reason: 'min_not_met',
      minAmount: coupon.min_order_amount,
    });
  }

  // Discount from the ROW's type/value — same formula the RPC uses.
  const discount =
    coupon.type === 'percentage'
      ? Math.round((subtotal * coupon.value) / 100)
      : Math.min(coupon.value, subtotal);

  return NextResponse.json({
    valid: true,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount,
  });
}
