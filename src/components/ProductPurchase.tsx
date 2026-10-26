'use client';

import { useMemo, useState } from 'react';
import type { Product, VariantType } from '@/lib/types';
import { naira } from '@/lib/format';
import { Editable } from '@/components/edit/Editable';
import { AddToOrderButton } from '@/components/AddToOrderButton';
import {
  AXIS_ORDER,
  VariantPicker,
  type VariantSelection,
} from '@/components/VariantPicker';

/**
 * The buy column's live half: price row, description (children), variant
 * picker, stock line and the Add-to-order button — one client component so
 * a single selection state drives all of them.
 *
 * With no variants (or none active) the picker and stock line never mount
 * and this renders byte-for-byte the markup the server used to render
 * inline: same price row, same description, same button block.
 *
 * Price rule: base price, overridden by the MOST RECENTLY selected variant
 * that defines priceOverride (last-wins — the price visibly follows the
 * last click); clearing selections walks back down the stack.
 * Stock rule: min over selected variants that define stock; if none does,
 * the product's own stock. Shown only while a selection exists, so an
 * unselected page looks exactly as it did before variants shipped.
 */
export function ProductPurchase({
  product,
  children,
}: {
  product: Product;
  /** The server-rendered description paragraph (keeps copy server-side). */
  children?: React.ReactNode;
}) {
  const variants = useMemo(
    () => product.variants ?? [],
    [product.variants],
  );
  const [selection, setSelection] = useState<VariantSelection>({});
  /** Axes in click order — the price fallback stack. */
  const [history, setHistory] = useState<VariantType[]>([]);

  const selectedVariants = useMemo(
    () =>
      AXIS_ORDER.flatMap((axis) => {
        const id = selection[axis];
        if (!id) return [];
        const v = variants.find((c) => c.id === id);
        return v ? [v] : [];
      }),
    [selection, variants],
  );

  const effectivePrice = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const axis = history[i];
      const id = selection[axis];
      const v = id ? variants.find((c) => c.id === id) : undefined;
      if (v?.priceOverride !== undefined) return v.priceOverride;
    }
    return product.price;
  }, [history, selection, variants, product.price]);

  const effectiveStock = useMemo(() => {
    if (selectedVariants.length === 0) return undefined;
    const defined = selectedVariants
      .map((v) => v.stock)
      .filter((s): s is number => typeof s === 'number');
    if (defined.length > 0) return Math.min(...defined);
    return product.stock;
  }, [selectedVariants, product.stock]);

  const variantKey =
    selectedVariants.length > 0
      ? selectedVariants.map((v) => v.id).join('+')
      : undefined;
  const variantLabel =
    selectedVariants.length > 0
      ? selectedVariants.map((v) => v.value).join(' / ')
      : undefined;

  const onToggle = (variant: (typeof variants)[number]) => {
    const wasOn = selection[variant.type] === variant.id;
    setSelection((prev) => {
      const next: VariantSelection = { ...prev };
      if (wasOn) delete next[variant.type];
      else next[variant.type] = variant.id;
      return next;
    });
    // re-clicking the chosen option clears the axis (drop from the stack);
    // picking a new one moves its axis to the top (last-wins)
    setHistory((prev) => {
      const without = prev.filter((t) => t !== variant.type);
      return wasOn ? without : [...without, variant.type];
    });
  };

  return (
    <>
      <div className="mt-5 flex items-baseline gap-3 border-y border-ink-12 py-4">
        <span className="mono-label text-2xl tabular-nums">
          {naira(effectivePrice)}
        </span>
        <span className="mono-label-xs text-ink-40">{product.packCount}</span>
      </div>

      {children}

      {variants.length > 0 && (
        <VariantPicker
          variants={variants}
          selection={selection}
          onToggle={onToggle}
        />
      )}

      {effectiveStock !== undefined && (
        <p className="mono-label-xs mt-4 text-ink-55">
          {effectiveStock > 0
            ? `${effectiveStock} in stock`
            : 'Out of stock'}
        </p>
      )}

      <div className="mt-7">
        <AddToOrderButton
          product={product}
          className="w-full"
          label="Add to order"
          editableLabel
          variantKey={variantKey}
          variantLabel={variantLabel}
          unitPrice={effectivePrice}
        />
        <p className="mono-label-xs mt-3 text-ink-40">
          <Editable k="product.buy.whatsapp-note">
            Nothing is charged here. The order arrives on WhatsApp for
            confirmation.
          </Editable>
        </p>
      </div>
    </>
  );
}
