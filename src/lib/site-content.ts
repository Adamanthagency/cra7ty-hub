import type { ShopSort } from '@/lib/types';
import {
  aboutPage as staticAboutPage,
  blogPage as staticBlogPage,
  footer as staticFooter,
  hero as staticHero,
  marqueeWords as staticMarqueeWords,
  navLinks as staticNavLinks,
  processSteps as staticProcessSteps,
  sections as staticSections,
  shopPage as staticShopPage,
  site as staticSite,
  testimonials as staticTestimonials,
  whyPoints as staticWhyPoints,
} from '@/data/site';
import { bulkTiers as staticBulkTiers, faqs as staticFaqs } from '@/data/products';

/**
 * The serializable content snapshot the whole storefront renders from.
 *
 * Stage 3 of the backend wiring: src/lib/content.ts builds one of these
 * from Supabase (content_values, content_list_items, site_settings,
 * page_sections) with the /data files as the per-key fallback; the root
 * layout hands it to SiteContentProvider, and components read it through
 * useSiteContent() instead of importing /data directly.
 *
 * This module is PURE (no fetch, no env) so BOTH sides can import it:
 * the server mapper uses `staticSiteContent` as its fallback base, and the
 * client provider uses it as the default context value — a render outside
 * the provider behaves exactly like the pre-Stage-3 site.
 *
 * Shapes mirror the static exports in /data exactly, so swapping a static
 * import for the snapshot is a mechanical change. Functions never cross
 * the boundary: `shopPage.searchStatus` is a local formatter in
 * ShopShelf, not part of the snapshot.
 */

export interface SiteContent {
  site: {
    name: string;
    tagline: string;
    description: string;
    url: string;
    locale: string;
    whatsappNumber: string;
    whatsappDisplay: string;
    email: string;
    instagram: string;
    instagramUrl: string;
    city: string;
    studio: string;
    foundedYear: number;
    freeDeliveryOver: number;
  };
  navLinks: { label: string; href: string }[];
  /** words under the hero */
  marqueeWords: string[];
  /** the mid-page strip on Home (page.tsx passed these as literals before Stage 3) */
  marqueeHome: string[];
  hero: {
    eyebrow: string;
    headline: string[];
    emphasisWord: string;
    subline: string;
    primaryCta: { label: string; href: string };
    secondaryCta: { label: string; href: string };
    stats: { value: string; label: string }[];
  };
  sections: Record<
    'categories' | 'shop' | 'process' | 'bulk' | 'why' | 'testimonials' | 'faq',
    { index: string; title: string[]; lede: string }
  >;
  shopPage: {
    index: string;
    title: string[];
    lede: string;
    metaDescription: string;
    railLabel: string;
    allTab: string;
    sortLabel: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchButton: string;
    searchClear: string;
    noResults: string;
    noResultsCta: string;
    sortOptions: { id: ShopSort; label: string }[];
    emptyBulk: string;
    emptyBulkCta: string;
  };
  blogPage: {
    index: string;
    title: string[];
    lede: string;
    metaDescription: string;
    readLink: string;
    moreLabel: string;
    relatedLabel: string;
    allNotesLabel: string;
    closing: { line: string; ctaLabel: string; caption: string };
  };
  aboutPage: {
    hero: {
      eyebrow: string;
      headline: string[];
      emphasisWord: string;
      subline: string;
      artCaption: string;
      artNote: string;
    };
    sheet: {
      index: string;
      title: string[];
      lede: string;
      stations: { index: string; title: string; body: string }[];
    };
    numbersIndex: string;
    numbersTitle: string;
    facts: {
      index: string;
      title: string[];
      lede: string;
      card: { label: string; title: string; body: string; cta: string };
    };
    closing: {
      title: string[];
      primary: { label: string; href: string };
      secondaryLabel: string;
    };
    metaDescription: string;
  };
  /** fixed admin lists behind the About numbers strip and facts rows */
  aboutNumbersLabels: string[];
  aboutFactRowLabels: string[];
  processSteps: { index: string; title: string; body: string }[];
  whyPoints: { index: string; title: string; body: string }[];
  testimonials: { quote: string; name: string; city: string; placeholder: boolean }[];
  footer: {
    smallPrint: string;
    columns: { heading: string; links: { label: string; href: string }[] }[];
  };
  faqs: { q: string; a: string }[];
  bulkTiers: { from: number; to: number | null; discount: string; note: string }[];
  /** published section order/visibility per admin page key (home, shop, blog, about, product) */
  pageSections: Record<string, { order: string[]; hidden: string[] }>;
  /**
   * The raw scalar fields, {total}-interpolated. Editable uses this as the
   * base value for every content key on every visit; the JSX children in
   * the components stay as the final fallback.
   */
  values: Record<string, string>;
}

/** Resolve the one globally-known token. {shown} stays for render sites. */
export function interpolateTotal(value: string, total: number | undefined): string {
  return total === undefined ? value : value.split('{total}').join(String(total));
}

/** The pre-Stage-3 site, assembled into the snapshot shape. */
export const staticSiteContent: SiteContent = {
  site: { ...staticSite },
  navLinks: staticNavLinks.map((link) => ({ label: link.label, href: link.href })),
  marqueeWords: [...staticMarqueeWords],
  marqueeHome: ['One studio', 'Eleven products', 'No payment gateway', 'Counted by hand'],
  hero: {
    eyebrow: staticHero.eyebrow,
    headline: [...staticHero.headline],
    emphasisWord: staticHero.emphasisWord,
    subline: staticHero.subline,
    primaryCta: { ...staticHero.primaryCta },
    secondaryCta: { ...staticHero.secondaryCta },
    stats: staticHero.stats.map((stat) => ({ ...stat })),
  },
  sections: {
    categories: {
      index: staticSections.categories.index,
      title: [...staticSections.categories.title],
      lede: staticSections.categories.lede,
    },
    shop: {
      index: staticSections.shop.index,
      title: [...staticSections.shop.title],
      lede: staticSections.shop.lede,
    },
    process: {
      index: staticSections.process.index,
      title: [...staticSections.process.title],
      lede: staticSections.process.lede,
    },
    bulk: {
      index: staticSections.bulk.index,
      title: [...staticSections.bulk.title],
      lede: staticSections.bulk.lede,
    },
    why: {
      index: staticSections.why.index,
      title: [...staticSections.why.title],
      lede: staticSections.why.lede,
    },
    testimonials: {
      index: staticSections.testimonials.index,
      title: [...staticSections.testimonials.title],
      lede: staticSections.testimonials.lede,
    },
    faq: {
      index: staticSections.faq.index,
      title: [...staticSections.faq.title],
      lede: staticSections.faq.lede,
    },
  },
  shopPage: {
    index: staticShopPage.index,
    title: [...staticShopPage.title],
    lede: staticShopPage.lede,
    metaDescription: staticShopPage.metaDescription,
    railLabel: staticShopPage.railLabel,
    allTab: staticShopPage.allTab,
    sortLabel: staticShopPage.sortLabel,
    searchLabel: staticShopPage.searchLabel,
    searchPlaceholder: staticShopPage.searchPlaceholder,
    searchButton: staticShopPage.searchButton,
    searchClear: staticShopPage.searchClear,
    noResults: staticShopPage.noResults,
    noResultsCta: staticShopPage.noResultsCta,
    sortOptions: staticShopPage.sortOptions.map((option) => ({
      id: option.id,
      label: option.label,
    })),
    emptyBulk: staticShopPage.emptyBulk,
    emptyBulkCta: staticShopPage.emptyBulkCta,
  },
  blogPage: {
    index: staticBlogPage.index,
    title: [...staticBlogPage.title],
    lede: staticBlogPage.lede,
    metaDescription: staticBlogPage.metaDescription,
    readLink: staticBlogPage.readLink,
    moreLabel: staticBlogPage.moreLabel,
    relatedLabel: staticBlogPage.relatedLabel,
    allNotesLabel: staticBlogPage.allNotesLabel,
    closing: { ...staticBlogPage.closing },
  },
  aboutPage: {
    hero: {
      eyebrow: staticAboutPage.hero.eyebrow,
      headline: [...staticAboutPage.hero.headline],
      emphasisWord: staticAboutPage.hero.emphasisWord,
      subline: staticAboutPage.hero.subline,
      artCaption: staticAboutPage.hero.artCaption,
      artNote: staticAboutPage.hero.artNote,
    },
    sheet: {
      index: staticAboutPage.sheet.index,
      title: [...staticAboutPage.sheet.title],
      lede: staticAboutPage.sheet.lede,
      stations: staticAboutPage.sheet.stations.map((station) => ({ ...station })),
    },
    numbersIndex: staticAboutPage.numbersIndex,
    numbersTitle: staticAboutPage.numbersTitle,
    facts: {
      index: staticAboutPage.facts.index,
      title: [...staticAboutPage.facts.title],
      lede: staticAboutPage.facts.lede,
      card: { ...staticAboutPage.facts.card },
    },
    closing: {
      title: [...staticAboutPage.closing.title],
      primary: { ...staticAboutPage.closing.primary },
      secondaryLabel: staticAboutPage.closing.secondaryLabel,
    },
    metaDescription: staticAboutPage.metaDescription,
  },
  aboutNumbersLabels: [
    'Studio founded',
    'Products in the shop',
    'Free Lagos delivery over',
    'Lagos turnaround',
  ],
  aboutFactRowLabels: ['Studio', 'City', 'WhatsApp', 'Email', 'Instagram'],
  processSteps: staticProcessSteps.map((step) => ({ ...step })),
  whyPoints: staticWhyPoints.map((point) => ({ ...point })),
  testimonials: staticTestimonials.map((item) => ({ ...item })),
  footer: {
    smallPrint: staticFooter.smallPrint,
    columns: staticFooter.columns.map((column) => ({
      heading: column.heading,
      links: column.links.map((link) => ({ ...link })),
    })),
  },
  faqs: staticFaqs.map((item) => ({ ...item })),
  bulkTiers: staticBulkTiers.map((tier) => ({ ...tier })),
  pageSections: {},
  values: {},
};
