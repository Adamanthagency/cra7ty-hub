import { revalidatePath, revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * On-demand revalidation (instant-publish stage).
 *
 * The admin is a separate deployment; after a successful write it calls
 * this handler server-to-server, and the storefront purges the matching
 * cache entries immediately instead of waiting out the 300s fetch timer
 * (which stays in place as the safety net for a failed call).
 *
 * AUTH: `Authorization: Bearer $REVALIDATE_SECRET` — server-only env
 * var, the same value the admin sends. Compared timing-safe; the secret
 * is never logged and never appears in a URL (a query param would leak
 * into request logs). Wrong/missing token → 401, unconfigured server →
 * 503 naming the variable, malformed body → 400.
 *
 * BODY: { paths?: string[], tags?: string[] }
 *   paths  must start with '/', are bounded in count and length, and are
 *          passed to revalidatePath (regenerates that route on next hit)
 *   tags   must be one of the db:<table> tags selectRows() emits (see
 *          src/lib/catalog.ts) — an allowlist, so this endpoint can only
 *          purge tags that actually exist, never arbitrary ones.
 */

export const dynamic = 'force-dynamic';

/**
 * Mirrors the tags the fetch caches actually carry — the only
 * purgeable names. 'db:events' joins the list from Tier 6: the
 * admin's event save sends it, and an unlisted tag made this endpoint
 * answer 400 ("Unknown tag") on every event publish even though the
 * shared secret matched.
 */
const KNOWN_TAGS = new Set([
  'db',
  'db:content_values',
  'db:content_list_items',
  'db:site_settings',
  'db:page_sections',
  'db:categories',
  'db:products',
  'db:blog_posts',
  'db:events',
]);

const MAX_ITEMS = 16;
const MAX_PATH_LENGTH = 300;

/** Constant-time comparison; a length mismatch is simply "no match". */
function secretMatches(provided: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !provided) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface RevalidateBody {
  paths?: unknown;
  tags?: unknown;
}

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        error:
          'REVALIDATE_SECRET is not set on this server — set it (and the same value on the admin) to enable instant publish.',
      },
      { status: 503 },
    );
  }

  if (!secretMatches(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Missing or invalid token.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as RevalidateBody | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const paths = Array.isArray(body.paths) ? body.paths : [];
  const tags = Array.isArray(body.tags) ? body.tags : [];
  if (paths.length === 0 && tags.length === 0) {
    return NextResponse.json(
      { error: 'Nothing to revalidate — provide at least one path or tag.' },
      { status: 400 },
    );
  }
  if (paths.length > MAX_ITEMS || tags.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `At most ${MAX_ITEMS} paths and ${MAX_ITEMS} tags per call.` },
      { status: 400 },
    );
  }
  for (const path of paths) {
    if (
      typeof path !== 'string' ||
      !path.startsWith('/') ||
      path.length > MAX_PATH_LENGTH ||
      path.includes('..')
    ) {
      return NextResponse.json(
        { error: 'Paths must be site-absolute ("/…") and cannot contain "..".' },
        { status: 400 },
      );
    }
  }
  for (const tag of tags) {
    if (typeof tag !== 'string' || !KNOWN_TAGS.has(tag)) {
      return NextResponse.json(
        { error: `Unknown tag — allowed: ${[...KNOWN_TAGS].join(', ')}.` },
        { status: 400 },
      );
    }
  }

  try {
    // Lazy by design: entries are purged now; routes regenerate on their
    // next request rather than upfront.
    for (const tag of tags) revalidateTag(tag);
    for (const path of paths) revalidatePath(path);
  } catch (error) {
    return NextResponse.json(
      { error: `Revalidation failed: ${(error as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    revalidated: true,
    paths,
    tags,
    now: new Date().toISOString(),
  });
}
