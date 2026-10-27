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

/* ------------------------------------------------------------------ *
 * Tier 4 — Paystack checkout
 * ------------------------------------------------------------------ */

/** The order drawer's mode, chosen per-section in the content system.
 *  'whatsapp' keeps the original flow only; 'paystack+whatsapp' shows the
 *  card-payment button with the WhatsApp option kept alongside. */
export type DrawerVariant = 'whatsapp' | 'paystack+whatsapp';

/** What the buyer types into the details step. Sent to the checkout API as
 * -is — the API takes NO price field of any kind. */
export interface CheckoutCustomer {
  name: string;
  email: string;
  phone: string;
  city: string;
  street: string;
  date: string;
  notes: string;
}

/** POST /api/checkout body — ids, quantities and variant keys only. */
export interface CheckoutPayload {
  items: { productId: string; variantIds: string[]; quantity: number }[];
  couponCode?: string;
  customer: CheckoutCustomer;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'fulfilled'
  | 'failed'
  | 'refunded';

/** The checkout API's success body: what the drawer needs to hand Paystack
 *  and where to send the buyer back. */
export interface CheckoutOrderSummary {
  orderId: string;
  orderNumber: string;
  reference: string;
  authorizationUrl: string;
  subtotal: number;
  discount: number;
  total: number;
}

/* ------------------------------------------------------------------ *
 * Admin — real orders (mock remains the offline fallback)
 * ------------------------------------------------------------------ */

/** What a storefront checkout API response returns — the admin's shape is a
 *  superset of it. */
export interface OrderSummary {
  orderId: string;
  orderNumber: string;
  reference: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
  customerName: string;
  customerEmail: string;
  paymentMethod: 'paystack' | 'whatsapp';
  manualReview: boolean;
  createdAt: string;
  /** ISO timestamp, or null when the order has not reached paid yet. */
  paidAt: string | null;
}

export interface OrderItemDto {
  productId: string;
  productName: string;
  variantSummary: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stockBefore: number | null;
  stockAfter: number | null;
}

export interface OrderDto extends OrderSummary {
  items: OrderItemDto[];
  notes: string | null;
}

/** Badge meta for every status. `tone` is the badge colour; `caveat` is the
 *  second-line reason the status carries (manual review, etc.) — absent
 *  when the status is clean. */
export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: string; caveat?: string }
> = {
  pending: { label: 'Pending', tone: 'text-amber-600 bg-amber-50 border-amber-200' },
  paid: { label: 'Paid', tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  fulfilled: { label: 'Fulfilled', tone: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
  failed: { label: 'Failed', tone: 'text-red-600 bg-red-50 border-red-200' },
  refunded: { label: 'Refunded', tone: 'text-red-700 bg-red-50 border-red-300' },
};

/** A manual-review flag rides alongside the status: the order still carries
 *  its status, but nothing auto-proceeds and the reason is displayed. */
export const MANUAL_REVIEW_TONE =
  'text-amber-700 bg-amber-50 border-amber-300';