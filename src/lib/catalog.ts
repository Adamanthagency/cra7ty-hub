import { cache } from 'react';
import type { BlogPost, Category, CategoryId, ModelKey, Product } from '@/lib/types';
import {
  categories as staticCategories,
  products as staticProducts,
} from '@/data/products';
import { posts as staticPosts } from '@/data/posts';

/**
 * The database seam. Every page reads the catalog through these getters
 * instead of importing the static arrays directly.
 *
 * Each getter asks PostgREST for an explicit column list (never `*`), and
 * falls back to the frozen copies in /data when the project has no env vars,
 * when the API answers non-2xx, or when the network fails — so a database
 * hiccup or a build on a secretless CI still ships the whole site rather
 * than an empty shelf. Category counts are always computed from the products
 * that actually exist, never stored.
 *
 * Reads use the anon key: RLS on the new project allows public SELECT of
 * active products and all categories/posts, and nothing else.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Data re-fetched at most every 5 minutes on ISR pages. */
const REVALIDATE_SECONDS = 300;
/** A hung request must not hang a build. */
const FETCH_TIMEOUT_MS = 8000;

const PRODUCT_COLUMNS =
  'id,slug,name,category_id,price,description,badge,model,pack_count,size,detail,specs,featured,is_active,position';
const CATEGORY_COLUMNS = 'id,index,name,blurb,model,position';
const POST_COLUMNS =
  'slug,title,title_lines,standfirst,excerpt,post_date,minutes,category,model,body,related_product_ids,placeholder';

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  category_id: string;
  price: number;
  description: string;
  badge: string | null;
  model: string;
  pack_count: string | null;
  size: string | null;
  detail: string[];
  specs: { label: string; value: string }[];
  featured: boolean;
  is_active: boolean;
  position: number;
}

interface CategoryRow {
  id: string;
  index: string;
  name: string;
  blurb: string;
  model: string;
  position: number;
}

interface PostRow {
  slug: string;
  title: string;
  title_lines: string[];
  standfirst: string;
  excerpt: string;
  post_date: string;
  minutes: number;
  category: string;
  model: string;
  body: string[];
  related_product_ids: string[];
  placeholder: boolean;
}

/** null means "no usable database" — callers fall back to the static copy. */
async function selectRows<T>(table: string, columns: string, order: string): Promise<T[] | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${columns}&order=${order}`;
  try {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`[catalog] ${table} query failed (${response.status}); using /data fallback`);
      return null;
    }
    return (await response.json()) as T[];
  } catch (error) {
    console.warn(`[catalog] ${table} fetch error; using /data fallback`, error);
    return null;
  }
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category_id as CategoryId,
    price: row.price,
    description: row.description,
    badge: row.badge ?? undefined,
    model: row.model as ModelKey,
    packCount: row.pack_count ?? undefined,
    size: row.size ?? undefined,
    detail: row.detail,
    specs: row.specs,
  };
}

function mapPost(row: PostRow): BlogPost {
  return {
    slug: row.slug,
    title: row.title,
    titleLines: row.title_lines,
    standfirst: row.standfirst,
    excerpt: row.excerpt,
    date: row.post_date,
    minutes: row.minutes,
    category: row.category,
    model: row.model as ModelKey,
    body: row.body,
    relatedProductIds: row.related_product_ids,
    placeholder: row.placeholder,
  };
}

/** All active products, shelf order. */
export const getProducts = cache(async (): Promise<Product[]> => {
  const rows = await selectRows<ProductRow>('products', PRODUCT_COLUMNS, 'position.asc');
  if (!rows) return staticProducts;
  return rows.filter((row) => row.is_active).map(mapProduct);
});

/** Categories in editorial order; every count computed from live products. */
export const getCategories = cache(async (): Promise<Category[]> => {
  const rows = await selectRows<CategoryRow>('categories', CATEGORY_COLUMNS, 'position.asc');
  if (!rows) return staticCategories;
  const products = await getProducts();
  return rows.map((row) => ({
    id: row.id as CategoryId,
    index: row.index,
    name: row.name,
    blurb: row.blurb,
    model: row.model as ModelKey,
    count: products.filter((product) => product.category === (row.id as CategoryId)).length,
  }));
});

/** The six picks on the home page, in shelf order. */
export const getFeaturedProducts = cache(async (): Promise<Product[]> => {
  const products = await getProducts();

  // featured is its own column, not part of the app-facing Product type,
  // so read the flag in a narrow id+flag query and resolve against the list.
  const rows = await selectRows<{ id: string; featured: boolean }>('products', 'id,featured', 'position.asc');
  if (!rows) {
    // no database: the frozen six that shipped with the static site
    return featuredStaticIds
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is Product => Boolean(product));
  }

  const featuredIds = new Set(rows.filter((row) => row.featured).map((row) => row.id));
  return products.filter((product) => featuredIds.has(product.id));
});

/** The frozen featured list, used only on the no-database fallback path. */
const featuredStaticIds = [
  'crane-string-20',
  'party-pack-20',
  'flower-bouquet-12',
  'gift-box-set-5',
  'plates-9in-25',
  'origami-paper-100',
];

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

/** Newest first — the order the folio and its lead band use. */
export const getPosts = cache(async (): Promise<BlogPost[]> => {
  const rows = await selectRows<PostRow>('blog_posts', POST_COLUMNS, 'post_date.desc');
  if (!rows) return [...staticPosts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows.map(mapPost);
});

export const getPostBySlug = cache(async (slug: string): Promise<BlogPost | null> => {
  const posts = await getPosts();
  return posts.find((post) => post.slug === slug) ?? null;
});
