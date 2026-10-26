/**
 * Shared types for the whole site. Everything a component renders about a
 * product, a category or an order line comes through one of these.
 */

/** Every 3D model is generated procedurally, so each product names its model. */
export type ModelKey =
  | 'crane'
  | 'plate'
  | 'spoon'
  | 'box'
  | 'flower'
  | 'cup'
  | 'sheet';

export type CategoryId =
  | 'origami'
  | 'table'
  | 'party'
  | 'gift'
  | 'bulk'
  | 'paper';

/** Which axis a product variant belongs to — same three as the admin. */
export type VariantType = 'colour' | 'size' | 'material';

/**
 * One variant option, as the admin's Products manager stores it in
 * products.variants (jsonb). Mirrors the admin's ProductVariant exactly —
 * stock and priceOverride are optional there, so they stay optional here.
 * The storefront only ever receives `active` variants (catalog.ts filters).
 */
export interface ProductVariant {
  /** Stable id, unique within the product. */
  id: string;
  type: VariantType;
  /** Display value: colour name, size name, material name. */
  value: string;
  /** For colour variants: the hex behind the swatch. */
  hex?: string;
  /** Per-variant stock; falls back to product stock when undefined. */
  stock?: number;
  /** Per-variant price override in whole naira. */
  priceOverride?: number;
}

export interface Product {
  /** stable id, used in order lines */
  id: string;
  /** url segment for /products/[slug] */
  slug: string;
  name: string;
  category: CategoryId;
  /** naira, whole units */
  price: number;
  /** one specific sentence, no marketing filler */
  description: string;
  /** optional short flag, mono type */
  badge?: string;
  /** which procedural model represents it in 3D */
  model: ModelKey;
  /** pack contents, shown on the detail page */
  packCount?: string;
  /** physical size, shown where relevant */
  size?: string;
  /** photographs picked in the admin's media library (Storage URLs); none by default */
  images?: string[];
  /** longer editorial notes for the detail route */
  detail: string[];
  /** secondary facts shown in the detail spec table */
  specs: { label: string; value: string }[];
  /** Active variants for the detail-page picker; absent = no variants (static /data copy). */
  variants?: ProductVariant[];
  /** Whole units in stock — fallback when no selected variant defines its own. */
  stock?: number;
}

export interface Category {
  id: CategoryId;
  /** two-digit editorial number */
  index: string;
  name: string;
  blurb: string;
  model: ModelKey;
  /** how many products sit under this row */
  count: number;
}

export interface OrderLine {
  productId: string;
  slug: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** The product's photos at add time (upload order). Optional because
   *  lines stored before the photo stage lack it — the drawer then shows
   *  the "No photo yet" placeholder rather than art. */
  images?: string[];
  /** Variant ids of this line, axis-ordered (colour, size, material).
   *  Absent = the base product. Lines differ only by variant are separate
   *  lines, keyed `productId::variantKey`. Lines stored before the variant
   *  stage lack it — they behave as base lines. */
  variantKey?: string;
  /** Human label of the selection ("Kraft / A4"), shown in the drawer and
   *  appended to the WhatsApp line. */
  variantLabel?: string;
}

export interface BulkTier {
  /** inclusive minimum quantity of units */
  from: number;
  /** inclusive maximum, null means "and above" */
  to: number | null;
  discount: string;
  note: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  city: string;
  /** flagged so the placeholder nature is visible in the data layer */
  placeholder: boolean;
}

/**
 * A studio note on /blog. Bodies are plain paragraphs on purpose: no
 * markdown renderer, no dependency, and the backend seam stays a flat array.
 */
export interface BlogPost {
  /** url segment for /blog/[slug] */
  slug: string;
  /** single-string title, used for metadata and the lead band */
  title: string;
  /** split lines for the masked headline on the post route */
  titleLines: readonly string[];
  /** one-sentence summary, shown under the title on the post route */
  standfirst: string;
  /** shorter form shown in the kraft lead band on /blog */
  excerpt: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** reading time in minutes, set by hand in the data file */
  minutes: number;
  /** mono category chip, e.g. 'Materials' */
  category: string;
  /** which procedural model illustrates the lead band */
  model: ModelKey;
  /** paragraphs, in order */
  body: string[];
  /** real product ids for the related strip; empty means none */
  relatedProductIds: string[];
  /** flagged so placeholder posts are never mistaken for published ones */
  placeholder: boolean;
}

/** Sort modes on the shop page. 'featured' is the order in /data/products.ts. */
export type ShopSort = 'featured' | 'price-asc' | 'price-desc';