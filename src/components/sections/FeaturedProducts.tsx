'use client';

import Link from 'next/link';
import { naira } from '@/lib/format';
import { Container } from '@/components/primitives/Container';
import { Section } from '@/components/primitives/Section';
import { DogEarCard } from '@/components/primitives/DogEarCard';
import { ProductMedia } from '@/components/ProductMedia';
import { AddToOrderButton } from '@/components/AddToOrderButton';
import { ArrowRight } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { useSectionVariant } from '@/lib/edit/use-edit';
import type { Product } from '@/lib/types';

/** Deliberately uneven spans and offsets: a grid of six would read as a grid.
 *  The 'grid' variant deliberately IS that even grid — the admin's choice. */
const layout: { span: string; art: string }[] = [
  { span: 'lg:col-span-5', art: 'aspect-[4/3.4]' },
  { span: 'lg:col-span-4 lg:col-start-7 lg:mt-16', art: 'aspect-square' },
  { span: 'lg:col-span-3 lg:col-start-11 lg:mt-4', art: 'aspect-[3/4]' },
  { span: 'lg:col-span-3 lg:mt-10', art: 'aspect-[3/4]' },
  { span: 'lg:col-span-5 lg:col-start-4 lg:mt-2', art: 'aspect-[4/3.2]' },
  { span: 'lg:col-span-3 lg:col-start-10 lg:mt-20', art: 'aspect-square' },
];

/** 'grid' variant: three even columns from lg up, uniform square art. */
const GRID_CELL = 'lg:col-span-4';
const GRID_ART = 'aspect-square';

function ProductCard({
  product,
  index,
  art = layout[index % layout.length].art,
}: {
  product: Product;
  index: number;
  art?: string;
}) {
  return (
    <DogEarCard index={String(index + 1).padStart(2, '0')} className="h-full">
      <div className={`relative overflow-hidden bg-kraft-30 px-8 py-10 ${art}`}>
        {product.badge && (
          <span className="mono-label-xs absolute left-5 top-5 z-10 border border-ink-24 px-2 py-1 text-ink-70">
            {product.badge}
          </span>
        )}
        {/* the first uploaded photo, full-bleed; no photo → the honest
            placeholder — never 3D art */}
        <ProductMedia
          images={product.images ?? []}
          name={product.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* a crease down the art, so the card reads as folded stock */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px -skew-x-[18deg] bg-ink-06"
        />
      </div>

      <div className="flex flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-2xl leading-tight">
            <Link href={`/products/${product.slug}`} className="link-draw">
              {product.name}
            </Link>
          </h3>
          <p className="mono-label shrink-0 tabular-nums">{naira(product.price)}</p>
        </div>

        <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-70">
          {product.description}
        </p>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-ink-06 pt-4">
          <p className="mono-label-xs text-ink-40">{product.packCount}</p>
          <AddToOrderButton product={product} />
        </div>
      </div>
    </DogEarCard>
  );
}

export function FeaturedProducts({
  index,
  title,
  lede,
  featured,
  total,
}: {
  index: string;
  title: readonly string[];
  lede: string;
  featured: Product[];
  total: number;
}) {
  // Layout variant: 'staggered' (shipped, the six uneven positions) or
  // 'grid' (uniform three-across). Else-path = today's markup.
  const variant = useSectionVariant('home', 'featured', 'staggered');
  const even = variant === 'grid';

  return (
    <Section
      id="shop"
      index={index}
      title={title}
      lede={lede}
      containerWidth="wide"
      contentKeys={{ index: 'home.featured.index', lede: 'home.featured.lede' }}
    >
      {/* One markup for both breakpoints: a single column on a phone, the
          staggered twelve-column arrangement from large up. Rendering the
          cards twice would duplicate them for crawlers. */}
      <Container width="wide">
        <ul className="grid grid-cols-12 gap-x-6 gap-y-6">
          {featured.map((product, i) => (
            <li
              key={product.id}
              className={`col-span-12 ${even ? GRID_CELL : layout[i % layout.length].span}`}
            >
              <ProductCard
                product={product}
                index={i}
                art={even ? GRID_ART : undefined}
              />
            </li>
          ))}
        </ul>
      </Container>

      <Container width="wide" className="mt-10 lg:mt-16">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-12 pt-6">
          <p className="max-w-prose text-sm text-ink-70">
            <Editable
              k="home.featured.count-note"
              tokens={{ shown: featured.length, total }}
            >
              That is {featured.length} of {total}. The rest — a 7-inch plate,
              an 8oz cup, paper spoons, the gift-wrap pack — sit in the index
              above.
            </Editable>
          </p>
          <a href="/shop" className="mono-label-xs inline-flex items-center gap-2">
            <Editable k="home.featured.all-link" tokens={{ total }}>
              See all {total} in the shop
            </Editable>
            <ArrowRight size={13} />
          </a>
        </div>
      </Container>
    </Section>
  );
}