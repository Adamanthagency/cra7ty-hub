'use client';

import { useState } from 'react';
import Link from 'next/link';
import { naira } from '@/lib/format';
import { Container } from '@/components/primitives/Container';
import { Section } from '@/components/primitives/Section';
import { ProductViewer } from '@/components/three/ProductViewer';
import { ModelArt } from '@/components/three/fallbacks';
import { AddToOrderButton } from '@/components/AddToOrderButton';
import { ArrowRight } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import type { Category, Product } from '@/lib/types';

/**
 * An editorial index rather than a card grid. Hovering or focusing a row
 * swaps the 3D model in the sticky column; clicking opens the products that
 * sit under it. On a phone the same preview appears inside the open row,
 * because there is no hover to hang it on.
 */
export function Categories({
  index,
  title,
  lede,
  categories,
  products,
}: {
  index: string;
  title: readonly string[];
  lede: string;
  categories: Category[];
  products: Product[];
}) {
  const [activeId, setActiveId] = useState<Category['id']>('origami');
  const [openId, setOpenId] = useState<Category['id'] | null>(null);

  const active = categories.find((c) => c.id === activeId) ?? categories[0];

  return (
    <Section
      id="categories"
      index={index}
      title={title}
      lede={lede}
      containerWidth="wide"
      contentKeys={{
        index: 'home.categories.index',
        lede: 'home.categories.lede',
      }}
    >
      <Container width="wide">
        <div className="grid grid-cols-12 gap-x-6 gap-y-8">
          <ul className="col-span-12 border-t border-ink-12 lg:col-span-7">
            {categories.map((category) => {
              const items = products.filter(
                (product) => product.category === category.id,
              );
              const isOpen = openId === category.id;
              const isActive = activeId === category.id;
              const panelId = `category-panel-${category.id}`;

              return (
                <li key={category.id} className="border-b border-ink-12">
                  <button
                    type="button"
                    onMouseEnter={() => setActiveId(category.id)}
                    onFocus={() => setActiveId(category.id)}
                    onClick={() => setOpenId(isOpen ? null : category.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="group flex w-full items-start gap-4 py-6 text-left md:gap-8 md:py-8"
                  >
                    <span
                      className={`mono-label-xs mt-2 shrink-0 tabular-nums transition-colors duration-300 ${
                        isActive ? 'text-vermilion' : 'text-ink-40'
                      }`}
                    >
                      {category.index}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-3">
                        <span
                          className={`font-display text-display-sm leading-[1.05] transition-[transform,color] duration-500 ease-paper ${
                            isActive
                              ? '-translate-y-[2px] text-ink'
                              : 'text-ink-70 group-hover:text-ink'
                          }`}
                        >
                          {category.name}
                        </span>
                        {isActive && (
                          <span
                            className="mb-[0.35em] inline-block h-[5px] w-[5px] shrink-0 rotate-45 bg-vermilion"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className="mt-3 block max-w-prose text-sm text-ink-70">
                        {category.blurb}
                      </span>
                    </span>

                    <span className="mono-label-xs mt-2 shrink-0 tabular-nums text-ink-40">
                      {category.count > 0 ? (
                        String(category.count).padStart(2, '0')
                      ) : (
                        <Editable k="home.categories.bulk-count-label">
                          Bulk
                        </Editable>
                      )}
                    </span>
                  </button>

                  <div
                    id={panelId}
                    hidden={!isOpen}
                    className="pb-8 pl-8 md:pl-16"
                  >
                    {/* inline preview for pointer-less screens */}
                    <div className="mb-6 h-40 w-full max-w-[16rem] lg:hidden">
                      <ModelArt model={category.model} className="h-full w-full" />
                    </div>

                    {items.length > 0 ? (
                      <ul className="divide-y divide-ink-06 border-t border-ink-06">
                        {items.map((product) => (
                          <li
                            key={product.id}
                            className="flex flex-wrap items-center justify-between gap-3 py-3"
                          >
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/products/${product.slug}`}
                                className="link-draw text-sm font-medium"
                              >
                                {product.name}
                              </Link>
                              <p className="mono-label-xs mt-1 text-ink-40">
                                {product.packCount} — {naira(product.price)}
                              </p>
                            </div>
                            <AddToOrderButton product={product} className="shrink-0" />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="border-t border-ink-06 pt-4">
                        <p className="max-w-prose text-sm text-ink-70">
                          <Editable k="home.categories.empty-body">
                            Nothing is priced in the shop for this one, because
                            the number depends on your guest count. Tell us the
                            count and we will quote it the same day.
                          </Editable>
                        </p>
                        <Link
                          href="#bulk"
                          className="mono-label-xs mt-4 inline-flex items-center gap-2 text-vermilion"
                        >
                          <Editable k="home.categories.empty-cta">
                            See bulk pricing
                          </Editable>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="col-span-12 lg:col-span-4 lg:col-start-9">
            <div className="lg:sticky lg:top-32">
              <ProductViewer
                model={active.model}
                className="aspect-square w-full"
                label={`${active.name} model`}
              />
              <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-ink-12 pt-3">
                <p className="mono-label text-ink">{active.name}</p>
                <p className="mono-label-xs text-ink-40">{active.index}</p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}