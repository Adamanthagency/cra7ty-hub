/**
 * Server-only Supabase access for the checkout API routes.
 *
 * The storefront's public reads (catalog.ts, content.ts) use the anon
 * key. Orders/order_items/coupon_codes are deny-all RLS (Tier 4
 * migration), so the checkout paths use the SERVICE ROLE key — same
 * posture the admin already runs with. Server-only scope: never
 * NEXT_PUBLIC_, never returned in a response, never logged.
 *
 * Raw PostgREST fetch, no SDK — matching the whole project.
 */

const SUPABASE_URL = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;

function serviceHeaders(): Record<string, string> | null {
  const url = SUPABASE_URL();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

/** Null = env not configured on this server (routes answer 503 naming it). */
export function serviceConfigured(): boolean {
  return serviceHeaders() !== null;
}

const RPC_TIMEOUT_MS = 10_000;

/**
 * Call a service-role RPC. Returns the parsed JSON body, or throws with
 * the PostgREST error message (RPCs raise 'reason:detail' strings the
 * routes map to user-facing errors).
 */
export async function rpc<T = unknown>(
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const url = SUPABASE_URL();
  const headers = serviceHeaders();
  if (!url || !headers) throw new Error('SUPABASE_SERVER_MISSING');

  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });

  const text = await response.text();
  if (!response.ok) {
    // PostgREST error envelope: {message, code, …} — message carries the
    // RPC's raised reason (e.g. 'coupon_expired').
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // keep raw text
    }
    const error = new Error(message) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  return (text ? JSON.parse(text) : null) as T;
}

/** Generic REST call against the service role (admin read/write helpers). */
export async function rest<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  table: string,
  query: string,
  body?: unknown,
): Promise<{ status: number; data: T | null; error: string | null }> {
  const url = SUPABASE_URL();
  const headers = serviceHeaders();
  if (!url || !headers) return { status: 503, data: null, error: 'env' };

  const response = await fetch(
    `${url}/rest/v1/${table}${query ? `?${query}` : ''}`,
    {
      method,
      headers: { ...headers, Prefer: 'return=representation' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    },
  );

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      (data as { message?: string } | null)?.message ?? `HTTP ${response.status}`;
    return { status: response.status, data: null, error: message };
  }

  return { status: response.status, data: data as T, error: null };
}

/**
 * IP-keyed fixed-window rate limit via the check_rate_limit RPC (one
 * global counter across all Vercel instances — in-memory maps don't
 * survive serverless). Returns true when the request may proceed.
 *
 * Vercel puts the caller IP in x-forwarded-for (first hop). Behind any
 * other proxy the first entry is still the best available key; an
 * absent header degrades to a shared 'unknown' bucket rather than
 * bypassing the limit.
 */
export async function rateLimit(
  scope: string,
  limit: number,
  windowSeconds: number,
  request: Request,
): Promise<boolean> {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  try {
    const allowed = await rpc<boolean>('check_rate_limit', {
      p_bucket: `${scope}:${ip}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    return allowed === true;
  } catch {
    // Limiter infrastructure failing must not take checkout down —
    // fail open (a flooded endpoint is preferable to a dead shop), but
    // the failure is visible in server logs.
    console.error('[checkout] rate limiter unavailable — allowing request');
    return true;
  }
}

/** First-matching env var, for 503 messages that name what's missing. */
export const missingServerEnv = (...names: string[]): string[] =>
  names.filter((name) => !process.env[name]);
