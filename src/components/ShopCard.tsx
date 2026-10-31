import Link from 'next/link';
import { DogEarCard } from '@/components/primitives/DogEarCard';
import { ProductMedia } from '@/components/ProductMedia';
import { AddToOrderButton } from '@/components/AddToOrderButton';
import { naira, pad } from '@/lib/format';
import type { Product } from '@/lib/types';

/**
 * One product on a shelf. Shared by the shop's ShopShelf and the courses
 * listing so both surfaces render the exact same card — the first uploaded
 * photo full-bleed, a crease down the art, name/price, and the one action
 * (add to order). Extracted from ShopShelf so /courses reuses it instead of
 * duplicating the markup.
 */
export function ShopCard({ product, index }: { product: Product; index: number }) {
  return (
    <DogEarCard index={pad(index + 1)} className="h-full">
      <div className="relative aspect-[4/3.4] overflow-hidden bg-kraft-30 px-8 py-10">
        {product.badge && (
          <span className="mono-label-xs absolute left-5 top-5 z-10 border border-ink-24 px-2 py-1 text-ink-70">
            {product.badge}
          </span>
        )}
        {/* the first uploaded photo, full-bleed; no photo (or a URL
            that dies) → the honest placeholder — never 3D art */}
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
