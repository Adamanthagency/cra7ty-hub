import { cache } from 'react';

/**
 * The events listing seam (Tier 6). Storefront pages read workshops and
 * exhibitions through these getters; the DB is the only source — there
 * is no static seed (an events system with fake seed events would show
 * customers conferences that don't exist).
 *
 * Reads go through the anon-callable RPC `get_published_events` (see
 * 20261030000000_events.sql): the tables themselves are deny-all RLS,
 * and the RPC returns ONLY published, upcoming events, with the seat
 * math (spots_remaining / sold_out) computed under the same rules the
 * confirmation path commits seats by. The location it returns is the
 * resolved one — event override, else the studio address from site
 * settings, else the Victory Estate default — so the page never has to
 * know about the fallback chain.
 *
 * Failure posture (same ladder as catalog.ts, minus the seed fallback —
 * there is nothing to fall back TO):
 *   - no env vars            → [] (secretless CI still builds)
 *   - local dev can't reach  → [] , warned
 *   - anything else          → retry with backoff, then THROW: a
 *     production build fails loudly, an ISR revalidation keeps serving
 *     the previous page. A 4xx that isn't 404 is schema drift.
 * An EMPTY upcoming list is not a failure — it is a studio with no
 * events on the calendar, and the page says exactly that.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const REVALIDATE_SECONDS = 300;
const FETCH_TIMEOUT_MS = 8000;
const RETRIES = 2;
const IS_DEV = process.env.NODE_ENV === 'development';

export interface EventItem {
  id: string;
  slug: string;
  name: string;
  kind: 'workshop' | 'exhibition';
  description: string;
  startsAt: string;
  endsAt: string | null;
  location: string;
  price: number;
  capacity: number | null;
  imageUrl: string | null;
  /** null = unlimited seats. */
  spotsRemaining: number | null;
  soldOut: boolean;
}

interface RawEvent {
  id: string;
  slug: string;
  name: string;
  kind: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  price: number;
  capacity: number | null;
  image_url: string | null;
  spots_remaining: number | null;
  sold_out: boolean;
}

function toItem(row: RawEvent): EventItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind === 'exhibition' ? 'exhibition' : 'workshop',
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    price: row.price,
    capacity: row.capacity,
    imageUrl: row.image_url,
    spotsRemaining: row.spots_remaining,
    soldOut: row.sold_out,
  };
}

function configured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

async function fetchEvents(slug: string | null): Promise<EventItem[]> {
  if (!configured()) return [];

  const attempt = async (): Promise<EventItem[]> => {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_published_events`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_slug: slug }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        next: { revalidate: REVALIDATE_SECONDS, tags: ['db:events'] },
      },
    );

    // 404 = the RPC doesn't exist (migration not applied yet): an empty
    // calendar is the honest answer, not a broken shop.
    if (response.status === 404) {
      console.warn('[events] get_published_events RPC missing — returning []');
      return [];
    }
    if (!response.ok) {
      // Schema drift (4xx that isn't 404) breaks out immediately; a 5xx
      // is infrastructure and gets the retry.
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`events RPC → HTTP ${response.status}`);
      }
      throw new Error(`events RPC → HTTP ${response.status}`);
    }

    const rows = (await response.json()) as RawEvent[];
    return Array.isArray(rows) ? rows.map(toItem) : [];
  };

  let lastError: Error | null = null;
  for (let i = 0; i <= RETRIES; i += 1) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error as Error;
      const clientError =
        lastError.message.includes('HTTP 4') &&
        !lastError.message.includes('HTTP 404');
      if (clientError || i === RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
    }
  }

  if (IS_DEV) {
    console.warn('[events] could not reach Supabase — returning []', lastError?.message);
    return [];
  }
  // Production: fail loudly (an ISR revalidation keeps the old page).
  throw lastError ?? new Error('events fetch failed');
}

/** Every published, upcoming event, soonest first. */
export const getUpcomingEvents = cache(() => fetchEvents(null));

/** One published, upcoming event by slug — or null (404 for the page). */
export const getUpcomingEventBySlug = cache(async (slug: string) => {
  const rows = await fetchEvents(slug);
  return rows[0] ?? null;
});
