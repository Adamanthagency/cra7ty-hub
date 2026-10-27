import { cache } from 'react';
import { selectRows, getProducts } from '@/lib/catalog';
import {
  interpolateTotal,
  staticSiteContent,
  type SiteContent,
} from '@/lib/site-content';

/**
 * The storefront content snapshot: everything the site renders from
 * Supabase, built once per request and carried to the client by
 * SiteContentProvider (see src/components/site-content-provider.tsx).
 *
 * Four tables, all read with the anon key under the Stage-1 RLS policies:
 *   content_values      scalar fields  (key → string|number)
 *   content_list_items  the 22 lists   (list_key, item_id, position, fields)
 *   site_settings       the Settings manager (siteName, tagline, whatsapp…, seo.*)
 *   page_sections       published section order/visibility per page
 *
 * THE CARRIED FALLBACK RULE lives in catalog.ts's selectRows (one seam for
 * both files): no env vars, a never-seeded table, or local dev that can't
 * reach Supabase → the /data files render exactly as before; anything else
 * retries with backoff and then throws, so a production build fails loudly
 * and an ISR revalidation keeps serving the previous page. On top of that,
 * every individual key falls back to its static value here — a key the
 * admin never seeded simply renders its /data original.
 *
 * {total} is interpolated here, server-side, with the live product count.
 * {shown} only exists inside fields whose render site supplies it through
 * Editable's `tokens` (count-note, all-link) and is left alone.
 */

interface ValueRow {
  key: string;
  value: string | number;
}

interface ListRow {
  list_key: string;
  item_id: string;
  position: number;
  fields: Record<string, unknown>;
}

interface SettingRow {
  key: string;
  value: string | number | { title?: string; description?: string };
}

interface SectionRow {
  page: string;
  key: string;
  position: number;
  visible: boolean;
  /** layout variant chosen in the admin, e.g. 'split' | 'stacked' */
  variant: string | null;
}

/** Admin list-row ids for the fixed sort list → the shelf's own ids. */
const SORT_ID_BY_ROW: Record<string, 'featured' | 'price-asc' | 'price-desc'> = {
  'sort-featured': 'featured',
  'sort-asc': 'price-asc',
  'sort-desc': 'price-desc',
};

export const getContentSnapshot = cache(async (): Promise<SiteContent> => {
  const [valueRows, listRows, settingRows, sectionRows, products] = await Promise.all([
    selectRows<ValueRow>('content_values', 'key,value', 'key.asc'),
    selectRows<ListRow>('content_list_items', 'list_key,item_id,position,fields', 'position.asc'),
    selectRows<SettingRow>('site_settings', 'key,value', 'key.asc'),
    selectRows<SectionRow>('page_sections', 'page,key,position,visible,variant', 'page.asc,position.asc'),
    getProducts(),
  ]);

  const total = products.length;
  const s = staticSiteContent;

  const values = new Map<string, string | number>();
  for (const row of valueRows ?? []) values.set(row.key, row.value);

  const settings = new Map<string, SettingRow['value']>();
  for (const row of settingRows ?? []) settings.set(row.key, row.value);

  const lists = new Map<string, { id: string; fields: Record<string, unknown> }[]>();
  for (const row of listRows ?? []) {
    const bucket = lists.get(row.list_key);
    const item = { id: row.item_id, fields: row.fields };
    if (bucket) bucket.push(item);
    else lists.set(row.list_key, [item]);
  }

  /** A scalar: DB value when seeded, the /data original otherwise. */
  const V = (key: string, fallback: string | number): string =>
    interpolateTotal(String(values.has(key) ? values.get(key) : fallback), total);
  /** A list, or null when it was never seeded. */
  const L = (key: string) => lists.get(key) ?? null;
  /** One list-item string field, {total}-interpolated. */
  const F = (item: { fields: Record<string, unknown> }, field: string): string =>
    interpolateTotal(String(item.fields[field] ?? ''), total);
  /** A setting (Settings manager), falling back to the /data original. */
  const G = (key: string, fallback: string | number): string =>
    String(settings.has(key) ? settings.get(key) : fallback);

  /**
   * Title lines keep the STATIC array's length: a section whose /data title
   * is one line stays one line (the seed only ever contains the lines that
   * exist), so a rendered <span class="block"> per line never changes.
   */
  const titleLines = (baseKey: string, fallback: readonly string[]): string[] =>
    fallback.map((line, i) => V(`${baseKey}.title.${i}`, line));

  /* ------------------------------- site ------------------------------- */

  const site = {
    ...s.site,
    name: G('siteName', s.site.name),
    tagline: G('tagline', s.site.tagline),
    whatsappNumber: G('whatsappNumber', s.site.whatsappNumber),
    whatsappDisplay: G('whatsappDisplay', s.site.whatsappDisplay),
    email: G('email', s.site.email),
    studio: G('address', s.site.studio),
    instagram: G('instagram', s.site.instagram),
    instagramUrl: `https://instagram.com/${G('instagram', s.site.instagram)}`,
    freeDeliveryOver: Number(G('freeDeliveryOver', s.site.freeDeliveryOver)),
  };

  /* ------------------------------ lists ------------------------------- */

  const navLinks = L('global.navigation.links')?.map((item) => ({
    label: F(item, 'label'),
    href: F(item, 'href'),
  })) ?? s.navLinks;

  const marqueeWords = L('home.hero.marquee.words')?.map((item) => F(item, 'word'))
    ?? s.marqueeWords;

  const marqueeHome = L('home.marquee.words')?.map((item) => F(item, 'word'))
    ?? s.marqueeHome;

  const heroStats = L('home.hero.stats')?.map((item) => ({
    value: F(item, 'value'),
    label: F(item, 'label'),
  })) ?? s.hero.stats;

  const sortOptions = L('shop.shelf.sort-options')?.map((item) => ({
    id: SORT_ID_BY_ROW[item.id] ?? ('featured' as const),
    label: F(item, 'label'),
  })) ?? s.shopPage.sortOptions;

  const stations = L('about.sheet.stations')?.map((item) => ({
    index: F(item, 'index'),
    title: F(item, 'title'),
    body: F(item, 'body'),
  })) ?? s.aboutPage.sheet.stations;

  const processSteps = L('home.process.steps')?.map((item) => ({
    index: F(item, 'index'),
    title: F(item, 'title'),
    body: F(item, 'body'),
  })) ?? s.processSteps;

  const whyPoints = L('home.why.points')?.map((item) => ({
    index: F(item, 'index'),
    title: F(item, 'title'),
    body: F(item, 'body'),
  })) ?? s.whyPoints;

  const testimonials = L('home.testimonials.items')?.map((item) => ({
    quote: F(item, 'quote'),
    name: F(item, 'name'),
    city: F(item, 'city'),
    placeholder: Boolean(item.fields.placeholder),
  })) ?? s.testimonials;

  const faqs = L('home.faq.items')?.map((item) => ({
    q: F(item, 'question'),
    a: F(item, 'answer'),
  })) ?? s.faqs;

  const bulkTiers = L('home.bulk.tiers')?.map((item) => {
    const rawTo = item.fields.to;
    const to = Number(rawTo);
    return {
      from: Number(item.fields.from) || 0,
      to:
        rawTo === undefined || rawTo === null || rawTo === '' || !Number.isFinite(to)
          ? null
          : to,
      discount: F(item, 'discount'),
      note: F(item, 'note'),
    };
  }) ?? s.bulkTiers;

  /** Footer: the three seeded columns map to the three admin lists by position. */
  const columnHeadings = L('global.footer.columns');
  const columnLists = [
    L('global.footer.shop-links'),
    L('global.footer.orders-links'),
    L('global.footer.studio-links'),
  ];
  const footerColumns = s.footer.columns.map((column, i) => ({
    heading: columnHeadings?.[i] ? F(columnHeadings[i], 'heading') : column.heading,
    links: columnLists[i]?.length
      ? columnLists[i].map((item) => ({ label: F(item, 'label'), href: F(item, 'href') }))
      : column.links,
  }));

  /* ---------------------------- sections ------------------------------ */

  const sectionBlock = (
    baseKey: string,
    fallback: (typeof s.sections)[keyof typeof s.sections],
  ) => ({
    index: V(`${baseKey}.index`, fallback.index),
    title: titleLines(baseKey, fallback.title),
    lede: V(`${baseKey}.lede`, fallback.lede),
  });

  /* -------------------------- page sections --------------------------- */

  const pageSections: SiteContent['pageSections'] = {};
  for (const row of sectionRows ?? []) {
    const entry = (pageSections[row.page] ??= { order: [], hidden: [] });
    entry.order.push(row.key);
    if (!row.visible) entry.hidden.push(row.key);
    if (row.variant) {
      (entry.variants ??= {})[row.key] = row.variant;
    }
  }

  /* ---------------------------- snapshot ------------------------------ */

  const seoDescription = (key: string, fallback: string): string => {
    const raw = settings.get(key);
    const description =
      typeof raw === 'object' && raw !== null ? raw.description : undefined;
    return interpolateTotal(String(description ?? fallback), total);
  };

  return {
    site,
    navLinks,
    marqueeWords,
    marqueeHome,
    hero: {
      eyebrow: V('home.hero.eyebrow', s.hero.eyebrow),
      headline: [
        V('home.hero.headline.0', s.hero.headline[0]),
        V('home.hero.headline.1', s.hero.headline[1]),
      ],
      emphasisWord: V('home.hero.emphasis-word', s.hero.emphasisWord),
      subline: V('home.hero.subline', s.hero.subline),
      primaryCta: {
        label: V('home.hero.primary-cta.label', s.hero.primaryCta.label),
        href: V('home.hero.primary-cta.href', s.hero.primaryCta.href),
      },
      secondaryCta: {
        label: V('home.hero.secondary-cta.label', s.hero.secondaryCta.label),
        href: V('home.hero.secondary-cta.href', s.hero.secondaryCta.href),
      },
      stats: heroStats,
      artImage: V('home.hero.art-image', ''),
    },
    sections: {
      categories: sectionBlock('home.categories', s.sections.categories),
      shop: sectionBlock('home.featured', s.sections.shop),
      process: sectionBlock('home.process', s.sections.process),
      bulk: sectionBlock('home.bulk', s.sections.bulk),
      why: sectionBlock('home.why', s.sections.why),
      testimonials: sectionBlock('home.testimonials', s.sections.testimonials),
      faq: sectionBlock('home.faq', s.sections.faq),
    },
    shopPage: {
      index: V('shop.header.index', s.shopPage.index),
      title: titleLines('shop.header', s.shopPage.title),
      lede: V('shop.header.lede', s.shopPage.lede),
      metaDescription: seoDescription('seo.shop', s.shopPage.metaDescription),
      railLabel: V('shop.shelf.rail-label', s.shopPage.railLabel),
      allTab: V('shop.shelf.all-tab', s.shopPage.allTab),
      sortLabel: V('shop.shelf.sort-label', s.shopPage.sortLabel),
      searchLabel: V('shop.shelf.search-label', s.shopPage.searchLabel),
      searchPlaceholder: V('shop.shelf.search-placeholder', s.shopPage.searchPlaceholder),
      searchButton: V('shop.shelf.search-button', s.shopPage.searchButton),
      searchClear: V('shop.shelf.search-clear', s.shopPage.searchClear),
      noResults: V('shop.shelf.no-results', s.shopPage.noResults),
      noResultsCta: V('shop.shelf.no-results-cta', s.shopPage.noResultsCta),
      sortOptions,
      emptyBulk: V('shop.shelf.empty-bulk', s.shopPage.emptyBulk),
      emptyBulkCta: V('shop.shelf.empty-bulk-cta', s.shopPage.emptyBulkCta),
    },
    blogPage: {
      index: V('blog.header.index', s.blogPage.index),
      title: titleLines('blog.header', s.blogPage.title),
      lede: V('blog.header.lede', s.blogPage.lede),
      metaDescription: seoDescription('seo.blog', s.blogPage.metaDescription),
      readLink: V('blog.lead.read-link', s.blogPage.readLink),
      moreLabel: V('blog.more.heading', s.blogPage.moreLabel),
      relatedLabel: V('blog.post.related-label', s.blogPage.relatedLabel),
      allNotesLabel: V('blog.post.all-notes-label', s.blogPage.allNotesLabel),
      closing: {
        line: V('blog.closing.line', s.blogPage.closing.line),
        ctaLabel: V('blog.closing.cta-label', s.blogPage.closing.ctaLabel),
        caption: V('blog.closing.caption', s.blogPage.closing.caption),
      },
    },
    aboutPage: {
      hero: {
        eyebrow: V('about.hero.eyebrow', s.aboutPage.hero.eyebrow),
        headline: [
          V('about.hero.headline.0', s.aboutPage.hero.headline[0]),
          V('about.hero.headline.1', s.aboutPage.hero.headline[1]),
        ],
        emphasisWord: V('about.hero.emphasis-word', s.aboutPage.hero.emphasisWord),
        subline: V('about.hero.subline', s.aboutPage.hero.subline),
        artCaption: V('about.hero.art-caption', s.aboutPage.hero.artCaption),
        artNote: V('about.hero.art-note', s.aboutPage.hero.artNote),
        artImage: V('about.hero.art-image', ''),
      },
      sheet: {
        index: V('about.sheet.index', s.aboutPage.sheet.index),
        title: titleLines('about.sheet', s.aboutPage.sheet.title),
        lede: V('about.sheet.lede', s.aboutPage.sheet.lede),
        stations,
      },
      numbersIndex: V('about.numbers.index', s.aboutPage.numbersIndex),
      numbersTitle: V('about.numbers.title', s.aboutPage.numbersTitle),
      facts: {
        index: V('about.facts.index', s.aboutPage.facts.index),
        title: titleLines('about.facts', s.aboutPage.facts.title),
        lede: V('about.facts.lede', s.aboutPage.facts.lede),
        card: {
          label: V('about.facts.card-label', s.aboutPage.facts.card.label),
          title: V('about.facts.card-title', s.aboutPage.facts.card.title),
          body: V('about.facts.card-body', s.aboutPage.facts.card.body),
          cta: V('about.facts.card-cta', s.aboutPage.facts.card.cta),
        },
      },
      closing: {
        title: titleLines('about.closing', s.aboutPage.closing.title),
        primary: {
          label: V('about.closing.primary-label', s.aboutPage.closing.primary.label),
          href: V('about.closing.primary-href', s.aboutPage.closing.primary.href),
        },
        secondaryLabel: V('about.closing.secondary-label', s.aboutPage.closing.secondaryLabel),
      },
      metaDescription: seoDescription('seo.about', s.aboutPage.metaDescription),
    },
    aboutNumbersLabels:
      L('about.numbers.facts')?.map((item) => F(item, 'label')) ?? s.aboutNumbersLabels,
    aboutFactRowLabels:
      L('about.facts.rows')?.map((item) => F(item, 'label')) ?? s.aboutFactRowLabels,
    trackerStatusLabels:
      L('tracker.statuses')?.map((item) => F(item, 'label')) ??
      s.trackerStatusLabels,
    processSteps,
    whyPoints,
    testimonials,
    footer: {
      smallPrint: V('global.footer.small-print', s.footer.smallPrint),
      columns: footerColumns,
    },
    faqs,
    bulkTiers,
    pageSections,
    /** Editable's base layer: every seeded scalar, {total}-resolved. */
    values: Object.fromEntries(
      [...values.entries()].map(([key, raw]) => [
        key,
        interpolateTotal(String(raw), total),
      ]),
    ),
  };
});
