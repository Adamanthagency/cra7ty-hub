import { cache } from 'react';
import type {
  BlogPost,
  Category,
  CategoryId,
  ModelKey,
  Product,
  ProductVariant,
  VariantType,
} from '@/lib/types';
import {
  categories as staticCategories,
  products as staticProducts,
} from '@/data/products';
import { posts as staticPosts } from '@/data/posts';

/**
 * The database seam. Every page reads the catalog through these getters
 * instead of importing the static arrays directly.
 *
 * Reads use the anon key with an explicit column list (never `*`), against
 * the schema in supabase/migrations/20261022180000_init_backend.sql.
 *
 * THE CARRIED FALLBACK RULE (set early in the project, applied identically
 * here and in src/lib/content.ts via selectRows):
 *   - no env vars            → static /data fallback (secretless CI still builds)
 *   - table missing (404)    → fallback, warned ("never seeded")
 *   - empty table            → fallback, warned ("never seeded")
 *   - local dev can't reach  → fallback, warned
 *   - anything else          → retry with backoff, then THROW: a production
 *                              build fails loudly, an ISR revalidation keeps
 *                              serving the previous page. A 4xx that isn't
 *                              404 is schema drift and will not heal — it
 *                              breaks out of the retry loop immediately.
 *
 * Category counts are always computed from the products that actually
 * exist, never stored (the categories.count column is ignored on purpose:
 * a stored count drifts the moment a product is added).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * The safety-net interval: data re-fetched at most every 5 minutes on
 * ISR pages. On-demand revalidation (POST /api/revalidate, called by
 * the admin after each publish) purges the `db:<table>` tags below so
 * changes land in seconds; this timer only matters when that call fails.
 */
const REVALIDATE_SECONDS = 300;
/** A hung request must not hang a build. */
const FETCH_TIMEOUT_MS = 8000;
/** Retries after the first attempt. */
const RETRIES = 2;
const IS_DEV = process.env.NODE_ENV === 'development';

const PRODUCT_COLUMNS =
  'id,slug,name,category,price,description,badge,model,pack_count,size,detail,specs,position,status,images,variants,stock';
const CATEGORY_COLUMNS = 'id,index_label,name,blurb,model,position';
const POST_COLUMNS =
  'id,slug,title,title_lines,standfirst,excerpt,date,minutes,category,model,body,related_product_ids,placeholder,status';

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  description: string;
  badge: string | null;
  model: string;
  pack_count: string | null;
  size: string | null;
  images: string[] | null;
  detail: string[];
  specs: { label: string; value: string }[];
  position: number;
  /** 'active' | 'inactive' — the admin's status control, filtered here. */
  status: string;
  /** products.variants jsonb — as the admin wrote it; validated below. */
  variants: unknown;
  /** Whole units; not null in the schema, but defend anyway. */
  stock: number | null;
}

interface CategoryRow {
  id: string;
  index_label: string;
  name: string;
  blurb: string;
  model: string;
  position: number;
}

interface PostRow {
  id: string;
  slug: string;
  title: string;
  title_lines: string[];
  standfirst: string;
  excerpt: string;
  date: string;
  minutes: number;
  category: string;
  model: string;
  body: string[];
  related_product_ids: string[];
  placeholder: boolean;
  /** 'published' | 'draft' — the admin's status control, filtered here. */
  status: string;
}

/**
 * null means "no usable database" — callers fall back to the static copy.
 * Shared with src/lib/content.ts so both seams follow one rule.
 */
export async function selectRows<T>(
  table: string,
  columns: string,
  order: string,
): Promise<T[] | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${columns}&order=${order}`;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
    }
    try {
      const response = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        next: {
          revalidate: REVALIDATE_SECONDS,
          // `db:${table}` is what the admin purges per publish type —
          // the allowlist in src/app/api/revalidate/route.ts must list
          // every table this seam can be called with.
          tags: ['db', `db:${table}`],
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (response.ok) {
        const rows = (await response.json()) as T[];
        if (rows.length === 0) {
          console.warn(`[catalog] ${table} is empty — never seeded; using /data fallback`);
          return null;
        }
        return rows;
      }

      if (response.status === 404) {
        console.warn(`[catalog] ${table} not found — never seeded; using /data fallback`);
        return null;
      }

      lastError = new Error(`HTTP ${response.status}`);
      // 4xx other than 404 is schema drift; retrying cannot fix it.
      if (response.status >= 400 && response.status < 500) break;
      if (attempt < RETRIES) {
        console.warn(`[catalog] ${table} query failed (${response.status}); retrying`);
      }
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) {
        console.warn(`[catalog] ${table} fetch error; retrying`, error);
      }
    }
  }

  if (IS_DEV) {
    console.warn(`[catalog] ${table} unreachable in dev; using /data fallback`, lastError);
    return null;
  }
  throw new Error(
    `[catalog] ${table} unreachable after ${RETRIES + 1} attempts — failing loudly`,
    { cause: lastError },
  );
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category as CategoryId,
    price: row.price,
    description: row.description,
    badge: row.badge ?? undefined,
    model: row.model as ModelKey,
    packCount: row.pack_count ?? undefined,
    size: row.size ?? undefined,
    // Upload order is preserved exactly: images[0] IS the product's main
    // photo (the shelf/featured/related/drawer cards all read index 0).
    // Non-http entries (legacy `/…` paths, old placeholder slots) are
    // dropped here so the render code only ever sees real photo URLs.
    images: (row.images ?? []).filter((src) => /^https?:\/\//.test(src)),
    detail: row.detail,
    specs: row.specs,
    // Variants arrive as jsonb from the admin's editor. Keep only entries
    // with a usable id/type/value (active ones only — the admin's own
    // inactive toggle decides), preserving stored order. Anything else is
    // dropped rather than rendered as broken UI.
    variants: mapVariants(row.variants),
    ...(row.stock != null ? { stock: row.stock } : {}),
  };
}

const VARIANT_TYPES: readonly string[] = ['colour', 'size', 'material'];

function mapVariants(raw: unknown): ProductVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: ProductVariant[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const v = entry as Record<string, unknown>;
    if (typeof v.id !== 'string' || typeof v.value !== 'string') continue;
    if (typeof v.type !== 'string' || !VARIANT_TYPES.includes(v.type)) continue;
    if (v.active === false) continue; // absent active = active (legacy rows)
    out.push({
      id: v.id,
      type: v.type as VariantType,
      value: v.value,
      ...(typeof v.hex === 'string' ? { hex: v.hex } : {}),
      ...(typeof v.stock === 'number' ? { stock: v.stock } : {}),
      ...(typeof v.priceOverride === 'number'
        ? { priceOverride: v.priceOverride }
        : {}),
    });
  }
  return out;
}

function mapPost(row: PostRow): BlogPost {
  return {
    slug: row.slug,
    title: row.title,
    titleLines: row.title_lines,
    standfirst: row.standfirst,
    excerpt: row.excerpt,
    date: row.date,
    minutes: row.minutes,
    category: row.category,
    model: row.model as ModelKey,
    body: row.body,
    relatedProductIds: row.related_product_ids,
    placeholder: row.placeholder,
  };
}

/**
 * All products, shelf order, active rows only. The admin sets `status`;
 * an inactive product stays in the table (and in the admin) but stops
 * rendering everywhere on the site. When nothing is active the shop is
 * honestly empty — that is not the "never seeded" case, so the static
 * fallback does NOT kick in.
 */
export const getProducts = cache(async (): Promise<Product[]> => {
  const rows = await selectRows<ProductRow>('products', PRODUCT_COLUMNS, 'position.asc');
  if (!rows) return staticProducts;
  return rows.filter((row) => row.status === 'active').map(mapProduct);
});

/** Categories in editorial order; every count computed from live products. */
export const getCategories = cache(async (): Promise<Category[]> => {
  const rows = await selectRows<CategoryRow>('categories', CATEGORY_COLUMNS, 'position.asc');
  if (!rows) return staticCategories;
  const products = await getProducts();
  return rows.map((row) => ({
    id: row.id as CategoryId,
    index: row.index_label,
    name: row.name,
    blurb: row.blurb,
    model: row.model as ModelKey,
    count: products.filter((product) => product.category === (row.id as CategoryId)).length,
  }));
});

/** The frozen featured list — there is no merchandising flag in the schema yet. */
const featuredStaticIds = [
  'crane-string-20',
  'party-pack-20',
  'flower-bouquet-12',
  'gift-box-set-5',
  'plates-9in-25',
  'origami-paper-100',
];

/** The six picks on the home page, in the order the staggered grid was designed around. */
export const getFeaturedProducts = cache(async (): Promise<Product[]> => {
  const products = await getProducts();
  return featuredStaticIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));
});

export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  const products = await getProducts();
  return products.find((product) => product.slug === slug) ?? null;
});

export const getProductById = cache(async (id: string): Promise<Product | null> => {
  const products = await getProducts();
  return products.find((product) => product.id === id) ?? null;
});

export const getProductsByCategory = cache(
  async (category: CategoryId): Promise<Product[]> => {
    const products = await getProducts();
    return products.filter((product) => product.category === category);
  },
);

/**
 * Newest first — the order the folio and its lead band use. Published
 * rows only: a draft sits in the table (and the admin) without ever
 * reaching the site.
 */
export const getPosts = cache(async (): Promise<BlogPost[]> => {
  const rows = await selectRows<PostRow>('blog_posts', POST_COLUMNS, 'date.desc');
  if (!rows) {
    return [...staticPosts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  return rows.filter((row) => row.status === 'published').map(mapPost);
});

export const getPostBySlug = cache(async (slug: string): Promise<BlogPost | null> => {
  const posts = await getPosts();
  return posts.find((post) => post.slug === slug) ?? null;
});
