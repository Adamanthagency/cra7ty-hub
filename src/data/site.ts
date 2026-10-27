import { products } from '@/data/products';
import type { ShopSort } from '@/lib/types';

/**
 * Site-wide configuration and copy.
 *
 * THE WHATSAPP NUMBER LIVES HERE — change `whatsappNumber` to the real one,
 * in international format with no +, spaces or dashes: 2348012345678.
 */
export const site = {
  name: 'Cra7ty Hub',
  tagline: 'Handfolded origami and paper goods, Lagos.',
  /** <meta> description, also used on the product routes as a fallback */
  description:
    'Handfolded origami cranes, pressed paper plates, party packs and gift wrap, folded in Lagos and delivered across Nigeria. Order on WhatsApp, no payment gateway.',
  url: 'https://cra7tyhub.ng',
  locale: 'en_NG',
  whatsappNumber: '234XXXXXXXXXX', // <-- edit this
  whatsappDisplay: '+234 XXXX XXX XXXX',
  email: 'orders@cra7tyhub.ng',
  instagram: 'cra7tyhub',
  instagramUrl: 'https://instagram.com/cra7tyhub',
  city: 'Lagos, Nigeria',
  studio: 'No. 14, Glover Road, Surulere, Lagos',
  foundedYear: 2019,
  freeDeliveryOver: 50000,
} as const;

/**
 * Sticky nav. Real routes, with `/#…` values for the anchors that still live
 * on the home page, so the links work from every page.
 */
export const navLinks = [
  { label: 'Shop', href: '/shop' },
  { label: 'Origami', href: '/shop?category=origami' },
  { label: 'Party Packs', href: '/shop?category=party' },
  { label: 'Bulk Orders', href: '/#bulk' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
  { label: 'Track your order', href: '/tracker' },
] as const;

/** Words for the mono marquee strip under the hero. */
export const marqueeWords = [
  'Handfolded in Lagos',
  'Counted into packs',
  'Delivery across Nigeria',
  'Bagasse and recycled kraft',
  'No payment gateway',
  'Free Lagos delivery over ₦50,000',
];

/** Hero copy. Short, concrete, a little dry. */
export const hero = {
  eyebrow: 'Paper studio / Lagos / Est. 2019',
  /** Each string is one masked line that slides up on load. */
  headline: ['Folded by hand,', 'shipped from Lagos.'],
  /** rendered in italic inside the second line by the component */
  emphasisWord: 'shipped',
  subline:
    'Origami cranes, pressed paper plates, party packs and gift wrap. Counted, stacked and wrapped to order — then sent to you on WhatsApp.',
  primaryCta: { label: 'Shop paper goods', href: '#shop' },
  secondaryCta: { label: 'Custom origami orders', href: '#bulk' },
  stats: [
    { value: '11', label: 'products in the shop' },
    { value: '₦1,500', label: 'for one crane, folded by hand' },
    { value: '24 hrs', label: 'Lagos turnaround on party packs' },
  ],
};

/** Section headers, kept together so the editorial numbering is consistent. */
export const sections = {
  categories: {
    index: '01',
    title: ['What we', 'actually make'],
    lede: 'Six shelves, one studio, two presses. Open a row to see what is under it.',
  },
  shop: {
    index: '02',
    title: ['The shop'],
    lede: 'Everything below ships flat. Prices include the folding.',
  },
  process: {
    index: '03',
    title: ['How an order', 'gets folded'],
    lede: 'Scroll. The sheet folds the way the work does.',
  },
  bulk: {
    index: '04',
    title: ['Bulk and', 'events'],
    lede: 'For weddings, naming ceremonies, school events and small businesses buying monthly.',
  },
  why: {
    index: '05',
    title: ['Why paper'],
    lede: 'Three reasons, none of them about the planet in a general way.',
  },
  testimonials: {
    index: '06',
    title: ['Said about us'],
    lede: 'Three placeholders until these are real. Swap them in /data/site.ts.',
  },
  faq: {
    index: '07',
    title: ['Questions people', 'actually ask'],
    lede: 'If yours is not here, message the studio on WhatsApp.',
  },
} as const;

/** The stockroom page (/shop). The count is pulled from the products. */
export const shopPage = {
  index: '01',
  title: ['The', 'stockroom'],
  lede: `${products.length} products. Every one ships flat.`,
  metaDescription: `All ${products.length} products from the Cra7ty Hub studio: handfolded origami, pressed bagasse tableware, party packs, gift wrap and loose origami paper, shipped flat from Lagos.`,
  railLabel: 'The shelf index',
  allTab: 'All',
  sortLabel: 'Sort by',
  searchLabel: 'Search the shelf',
  searchPlaceholder: 'Crane, plates, gift…',
  searchButton: 'Search',
  searchClear: 'Clear',
  /** announced politely under the search bar after a search */
  searchStatus: (count: number, query: string) =>
    `${count} ${count === 1 ? 'result' : 'results'} for “${query}”`,
  noResults:
    'Nothing on the shelf matches that search. Try another word, or see everything at once.',
  noResultsCta: 'Show all products',
  sortOptions: [
    { id: 'featured', label: 'Featured' },
    { id: 'price-asc', label: 'Price, low to high' },
    { id: 'price-desc', label: 'Price, high to low' },
  ] satisfies readonly { id: ShopSort; label: string }[],
  emptyBulk:
    'Nothing sits on this shelf with a price, because the number depends on your guest count. Tell us the count and we will quote it the same day.',
  emptyBulkCta: 'See bulk pricing',
} as const;

/** The folio (/blog). Posts live in /data/posts.ts. */
export const blogPage = {
  index: '01',
  title: ['The', 'folio'],
  lede: 'Notes from the stockroom: counting, pressing, folding, pricing and shipping, written down between orders. Placeholders until the studio writes its own — swap them in /data/posts.ts.',
  metaDescription:
    'Notes from the Cra7ty Hub studio in Lagos: how a two-hundred guest order is counted, why bagasse plates hold hot food, how a crane is folded, how bulk pricing works and why everything ships flat.',
  readLink: 'Read the note',
  moreLabel: 'More notes',
  relatedLabel: 'Products in this note',
  allNotesLabel: 'All notes',
  closing: {
    line: 'A question about any of this goes to the studio, not to a queue.',
    ctaLabel: 'Message the studio',
    caption: 'Replies same day',
  },
} as const;

/**
 * The studio page (/about). Every fact below is lifted from `site`,
 * `processSteps`, `whyPoints` or the product data, so nothing here can
 * contradict the home page.
 */
export const aboutPage = {
  hero: {
    eyebrow: 'The studio / Surulere / Est. 2019',
    headline: ['Paper, folded', 'in Surulere'],
    emphasisWord: 'Surulere',
    subline:
      'One room, two presses and a table of counting paper. Everything on this site is folded, pressed, counted and banded by the people who answer your messages.',
    artCaption: 'One crane, folded in the studio',
    artNote: 'Drawn, not photographed',
  },
  sheet: {
    index: '01',
    title: ['The studio', 'sheet'],
    lede: 'One crease, four folds: the room, the start, the orders, the bulk.',
    stations: [
      {
        index: '01',
        title: 'The room on Glover Road',
        body: 'Everything sold here leaves from one address: No. 14, Glover Road, Surulere, Lagos. Six shelves, two presses and a cutting table — the folding, the pressing and the counting happen in the same room, at the same table, usually on the same day.',
      },
      {
        index: '02',
        title: 'Folding since 2019',
        body: 'The studio has folded paper for money since 2019. Cranes, boxes, plates and party packs have gone out of the same Surulere room since then — what changed is the number of shelves, not the method.',
      },
      {
        index: '03',
        title: 'An order starts as a message',
        body: 'There is no payment gateway anywhere on this site. An order starts on WhatsApp, gets confirmed the same day with a number and a photograph of the finished pack, and is paid by bank transfer, at the studio, or by POS. Nothing is folded and nothing ships until the transfer clears.',
      },
      {
        index: '04',
        title: 'Bulk is booked, not rushed',
        body: 'Bulk runs start earlier rather than fold faster: three to five working days for a two-hundred guest order. Volume pricing starts at fifty units — five per cent off, ten from a hundred, fifteen from two hundred and fifty — and applies to the whole order, so mixing lines still counts. From five hundred units the rate is quoted, on a named account with a fifty per cent deposit.',
      },
    ],
  },
  numbersIndex: '02',
  numbersTitle: 'In numbers',
  facts: {
    index: '06',
    title: ['The facts,', 'and the door'],
    lede: 'The same address, number and handle printed on the packaging.',
    card: {
      label: 'Ask the studio',
      title: 'A person who folds the paper answers.',
      body: 'Messages go to the studio in Surulere, not to a queue. Send a guest count, a colour or a photograph and you will hear back the same day.',
      cta: 'Message the studio',
    },
  },
  closing: {
    title: ['The paper is', 'on the table'],
    primary: { label: 'Shop paper goods', href: '/shop' },
    secondaryLabel: 'Message the studio',
  },
  metaDescription:
    'The Cra7ty Hub studio: one room on Glover Road in Surulere, Lagos, folding paper since 2019. How the orders work, how bulk works, and how to reach the people who fold it.',
} as const;

/** Three written steps beside the scroll-fold sequence. */
export const processSteps = [
  {
    index: '01',
    title: 'You send the brief',
    body: 'A WhatsApp message with a guest count, a colour and a date. We reply the same day with a number and a photograph of the finished pack, so there is nothing to imagine.',
  },
  {
    index: '02',
    title: 'We fold it in Surulere',
    body: 'Three to five working days for a two-hundred guest order. Every crease is made by hand, which is exactly why bulk means we start earlier rather than fold faster.',
  },
  {
    index: '03',
    title: 'It ships flat or arrives ready',
    body: 'Lagos is same day before 2pm, or collect from the studio. Elsewhere, two to five working days by parcel or bus terminal, still flat, still countable.',
  },
];

/** Numbered list. Not icon cards. */
export const whyPoints = [
  {
    index: '01',
    title: 'It composts in weeks, not centuries',
    body: 'Plates and napkins are pressed from sugarcane bagasse and recycled kraft. After an event they go into a home compost and are gone before the next birthday. Nothing on the table outlives the memory of the table.',
  },
  {
    index: '02',
    title: 'The fold is the finish',
    body: 'No glue, no staples, no printed logo. A gift box holds a gift because two flaps meet under their own tension, so it opens the same way the third time it did.',
  },
  {
    index: '03',
    title: 'It packs into a rider bag',
    body: 'Flat is a feature. A fortnight of tableware for a hundred people rides in a courier carton the size of a shoebox, which is a fifth of what the same count in rigid plastic would need.',
  },
];

/**
 * Placeholder testimonials. Flagged so they are never mistaken for real
 * quotes. Replace `quote`, `name` and `city` and set placeholder to false.
 */
export const testimonials = [
  {
    quote: 'My daughter cried when the two-hundred crane string came in. Real folds, real paper. I ordered another one for her birthday.',
    name: 'Mrs. Adaeze N.',
    city: 'Lekki, Lagos',
    placeholder: true,
  },
  {
    quote: 'We fed a hundred and twenty at a naming ceremony. The plates held hot food and the pack cost less than the caterer\'s disposables.',
    name: 'Hauwa B.',
    city: 'Kaduna',
    placeholder: true,
  },
  {
    quote: 'I run a small bakery. The boxes arrive flat, I fold one in ten seconds, and my packaging bill dropped by nearly half.',
    name: 'Tolu A.',
    city: 'Ibadan',
    placeholder: true,
  },
];

export const footer = {
  smallPrint:
    'Cra7ty Hub is a Lagos paper studio. Prices in naira, inclusive of folding. Nothing is charged from this website — orders are confirmed on WhatsApp.',
  columns: [
    {
      heading: 'Shop',
      links: [
        { label: 'All products', href: '/shop' },
        { label: 'Origami', href: '/shop?category=origami' },
        { label: 'Paper table', href: '/shop?category=table' },
        { label: 'Gift and wrap', href: '/shop?category=gift' },
      ],
    },
    {
      heading: 'Orders',
      links: [
        { label: 'Party packs', href: '/shop?category=party' },
        { label: 'Bulk pricing', href: '/#bulk' },
        { label: 'Delivery', href: '/#faq' },
        { label: 'FAQ', href: '/#faq' },
        { label: 'Track your order', href: '/tracker' },
      ],
    },
    {
      heading: 'Studio',
      links: [
        { label: 'About the folds', href: '/#process' },
        { label: 'Why paper', href: '/#why' },
        { label: 'Custom work', href: '/#bulk' },
        { label: 'Blog', href: '/blog' },
        { label: 'Contact', href: '/#footer-contact' },
      ],
    },
  ],
} as const;