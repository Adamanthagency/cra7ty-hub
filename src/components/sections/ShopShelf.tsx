'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSiteContent } from '@/components/site-content-provider';
import { pad } from '@/lib/format';
import { onUrlChange } from '@/lib/url-watch';
import { ShopCard } from '@/components/ShopCard';
import { Reveal } from '@/components/primitives/Reveal';
import { ArrowRight, Search, Close } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { useEditField, useEditList } from '@/lib/edit/use-edit';
import type { Category, CategoryId, Product, ShopSort } from '@/lib/types';

/**
 * The stockroom shelf. A top toolbar holds the search bar and the sort
 * control; the rail below keeps the category tabs. Filtering happens in
 * place: no reload, no layout jump beyond the grid itself.
 *
 * Both the category and the search query live in the URL query so a link
 * lands pre-filtered and the back button walks the tabs. The URL is read
 * through `onUrlChange` (not just on mount + popstate) because Next.js
 * changes the URL during client-side Link navigations without firing
 * popstate — the nav's Origami / Party Packs buttons land on
 * /shop?category=… while the shelf is already mounted, and the shelf has
 * to follow them instead of drifting until a hard refresh.
 *
 * Reading window.location (rather than useSearchParams) keeps the
 * prerendered HTML whole — crawlers get all eleven products on first
 * paint instead of a client-only grid.
 */

/** The URL is the source of truth: pull both filters out of it. */
function urlState(categories: Category[]): { category: CategoryId | null; q: string } {
  const params = new URLSearchParams(window.location.search);
  const value = params.get('category');
  return {
    category: categories.some((category) => category.id === value)
      ? (value as CategoryId)
      : null,
    q: (params.get('q') ?? '').trim(),
  };
}

/** Admin list-row ids for the fixed sort list → the shelf's own ids. */
const SORT_ID_BY_ROW: Record<string, ShopSort> = {
  'sort-featured': 'featured',
  'sort-asc': 'price-asc',
  'sort-desc': 'price-desc',
};

const text = (value: string | number | null, fallback: string) =>
  value === null ? fallback : String(value);

/**
 * The search status line. Not an admin content key (the static site.ts
 * carried it as a function, which cannot cross the snapshot boundary),
 * so it stays a local formatter with the same template.
 */
const searchStatus = (count: number, query: string) =>
  `${count} ${count === 1 ? 'result' : 'results'} for “${query}”`;

/** Search covers the whole shelf: name, description, pack count, badge. */
function matchesQuery(product: Product, query: string): boolean {
  if (!query) return true;
  const haystack = [
    product.name,
    product.description,
    product.packCount ?? '',
    product.badge ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function ShopShelf({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const { shopPage } = useSiteContent();
  const [activeId, setActiveId] = useState<CategoryId | null>(null);
  const [sort, setSort] = useState<ShopSort>('featured');
  /** the applied search (what the URL holds); draft is the input text */
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');

  // Admin overrides. `placeholder` and `search-clear` are ATTRIBUTES
  // (input placeholder, aria-label) so they go through useEditField —
  // which also registers them for the bridge's set-field gate; the rest
  // are visible text and wrap in Editable.
  const searchPlaceholder = text(
    useEditField('shop.shelf.search-placeholder'),
    shopPage.searchPlaceholder,
  );
  const searchClear = text(
    useEditField('shop.shelf.search-clear'),
    shopPage.searchClear,
  );
  const sortOverride = useEditList('shop.shelf.sort-options');
  const sortOptions = sortOverride
    ? sortOverride
        .map((item) => ({
          id: SORT_ID_BY_ROW[String(item.id)] ?? 'featured',
          label: String(item.fields.label ?? ''),
        }))
        .filter(
          (option, i, all) =>
            all.findIndex((other) => other.id === option.id) === i,
        )
    : shopPage.sortOptions;

  /**
   * One sync for every URL change: the initial hydration read, the nav's
   * /shop?category=… Link presses while this component is already
   * mounted, and browser back/forward. Replaces the old mount-once +
   * popstate pair that let the tabs drift out of sync with the URL.
   */
  useEffect(() => {
    const sync = () => {
      const { category, q } = urlState(categories);
      setActiveId(category);
      setQuery(q);
      setDraft(q);
    };
    sync();
    return onUrlChange(sync);
  }, [categories]);

  /** Tab press: browse mode — the query clears, history keeps the walk. */
  const select = (id: CategoryId | null) => {
    setActiveId(id);
    setQuery('');
    setDraft('');
    const url = id
      ? `${window.location.pathname}?category=${id}`
      : window.location.pathname;
    window.history.pushState(null, '', url);
  };

  /**
   * Submitting the search: everywhere-scope, so it lands on the All tab.
   * replaceState keeps the query shareable without stacking a history
   * entry per search.
   */
  const applySearch = (raw: string) => {
    const q = raw.trim();
    setActiveId(null);
    setQuery(q);
    setDraft(q);
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    window.history.replaceState(null, '', `${window.location.pathname}${qs}`);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    applySearch(draft);
  };

  const tabs = useMemo(
    () => [
      { id: null as CategoryId | null, label: shopPage.allTab, count: products.length },
      ...categories.map((category) => ({
        id: category.id as CategoryId | null,
        label: category.name,
        count: products.filter((product) => product.category === category.id).length,
      })),
    ],
    [products, categories, shopPage],
  );

  const visible = useMemo(() => {
    const list = products.filter(
      (product) =>
        (activeId ? product.category === activeId : true) &&
        matchesQuery(product, query),
    );
    if (sort === 'price-asc') return list.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') return list.sort((a, b) => b.price - a.price);
    return list;
  }, [activeId, sort, query, products]);

  return (
    <div className="grid grid-cols-12 gap-x-6 gap-y-8">
      {/* the toolbar: search bar left, sort right, ruled off above the shelf */}
      <div className="col-span-12 flex flex-wrap items-end justify-between gap-x-6 gap-y-5 border-b border-ink-12 pb-6">
        <form role="search" onSubmit={onSubmit} className="w-full max-w-lg">
          <label
            htmlFor="shop-search"
            className="mono-label-xs text-ink-55"
          >
            <Editable k="shop.shelf.search-label">
              {shopPage.searchLabel}
            </Editable>
          </label>
          <div className="mt-3 flex items-stretch border border-ink-24 bg-paper transition-colors focus-within:border-ink">
            <input
              id="shop-search"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-ink placeholder:text-ink-40 focus:outline-none"
            />
            {(draft || query) && (
              <button
                type="button"
                onClick={() => applySearch('')}
                aria-label={searchClear}
                className="flex items-center border-l border-ink-24 px-3 text-ink-40 transition-colors hover:text-ink"
              >
                <Close size={12} />
              </button>
            )}
            <button
              type="submit"
              className="mono-label-xs flex shrink-0 items-center gap-2 border-l border-ink-24 px-5 text-ink transition-colors hover:bg-ink-06"
            >
              <Search size={13} />
              <Editable k="shop.shelf.search-button">
                {shopPage.searchButton}
              </Editable>
            </button>
          </div>
        </form>

        <div>
          <p className="mono-label-xs text-ink-55" id="shop-sort-label">
            <Editable k="shop.shelf.sort-label">
              {shopPage.sortLabel}
            </Editable>
          </p>
          <ul
            className="mt-3 flex flex-wrap gap-x-5 gap-y-2"
            role="group"
            aria-labelledby="shop-sort-label"
          >
            {sortOptions.map((option) => {
              const isActive = sort === option.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSort(option.id)}
                    className={`link-draw mono-label-xs transition-colors duration-300 ${
                      isActive ? 'text-ink' : 'text-ink-40 hover:text-ink-70'
                    }`}
                    data-active={isActive ? 'true' : undefined}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* the shelf index: a scrolling row of tabs, a sticky rail from lg */}
      <div className="col-span-12 lg:col-span-3">
        <div className="lg:sticky lg:top-[var(--nav-h)]">
          <h2 className="mono-label-xs text-ink-55">
            <Editable k="shop.shelf.rail-label">
              {shopPage.railLabel}
            </Editable>
          </h2>

          <ul className="hide-scrollbar mt-4 flex gap-6 overflow-x-auto border-t border-ink-12 pt-4 lg:block lg:overflow-visible lg:border-t-0 lg:pt-0">
            {tabs.map((tab) => {
              // a search lives on the All tab, so All lights up while any
              // query is applied; a real category tab only lights when no
              // search is running
              const isActive = query ? tab.id === null : activeId === tab.id;
              return (
                <li key={tab.label} className="shrink-0 lg:w-full lg:shrink">
                  <button
                    type="button"
                    onClick={() => select(tab.id)}
                    aria-pressed={isActive}
                    className="group flex w-full items-baseline justify-between gap-3 whitespace-nowrap py-1 text-left lg:border-b lg:border-ink-12 lg:py-3"
                  >
                    <span
                      className={`link-draw mono-label-xs transition-colors duration-300 ${
                        isActive ? 'text-ink' : 'text-ink-70 group-hover:text-ink'
                      }`}
                      data-active={isActive ? 'true' : undefined}
                    >
                      {tab.id === null ? (
                        <Editable k="shop.shelf.all-tab">
                          {tab.label}
                        </Editable>
                      ) : (
                        tab.label
                      )}
                    </span>
                    <span
                      className={`mono-label-xs tabular-nums ${
                        isActive ? 'text-vermilion' : 'text-ink-40'
                      }`}
                    >
                      {pad(tab.count)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-9">
        {query && (
          <p role="status" className="mono-label-xs mb-5 text-ink-40">
            {searchStatus(visible.length, query)}
          </p>
        )}

        {visible.length === 0 ? (
          query ? (
            /* search with no matches: its own state, not the bulk one */
            <Reveal className="border-t border-ink-12 pt-8">
              <p className="max-w-prose text-sm leading-relaxed text-ink-70">
                <Editable k="shop.shelf.no-results">
                  {shopPage.noResults}
                </Editable>
              </p>
              <button
                type="button"
                onClick={() => applySearch('')}
                className="mono-label-xs mt-4 inline-flex items-center gap-2 text-vermilion"
              >
                <Editable k="shop.shelf.no-results-cta">
                  {shopPage.noResultsCta}
                </Editable>
                <ArrowRight size={13} />
              </button>
            </Reveal>
          ) : (
            <Reveal className="border-t border-ink-12 pt-8">
              <p className="max-w-prose text-sm leading-relaxed text-ink-70">
                <Editable k="shop.shelf.empty-bulk">
                  {shopPage.emptyBulk}
                </Editable>
              </p>
              <Link
                href="/#bulk"
                className="mono-label-xs mt-4 inline-flex items-center gap-2 text-vermilion"
              >
                <Editable k="shop.shelf.empty-bulk-cta">
                  {shopPage.emptyBulkCta}
                </Editable>
                <ArrowRight size={13} />
              </Link>
            </Reveal>
          )
        ) : (
          <ul
            key={`${activeId ?? 'all'}:${sort}:${query}`}
            className="grid animate-fold-in grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
          >
            {visible.map((product, i) => (
              <li key={product.id} className="h-full">
                <ShopCard product={product} index={i} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
