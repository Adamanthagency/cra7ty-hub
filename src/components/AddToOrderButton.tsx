'use client';

import { useOrder } from '@/lib/order-store';
import { Button } from '@/components/primitives/Button';
import { Check, Plus } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import type { Product } from '@/lib/types';

/**
 * The one action on the whole site: put a product in the order. It confirms
 * in place for a moment rather than navigating away, so a reader can keep
 * browsing and still know the crane went in.
 */
export function AddToOrderButton({
  product,
  label = 'Add to order',
  variant = 'primary',
  quantity = 1,
  className = '',
  editableLabel = false,
  variantKey,
  variantLabel,
  unitPrice,
}: {
  product: Product;
  label?: string;
  variant?: 'primary' | 'secondary' | 'ink';
  quantity?: number;
  className?: string;
  /** product-page Buy column only: make the two labels admin-editable */
  editableLabel?: boolean;
  /** Selected variants of this add (detail page only): ids joined, and the
   *  human label shown in the drawer / WhatsApp line. Absent = base line. */
  variantKey?: string;
  variantLabel?: string;
  /** Effective unit price after variant priceOverride — defaults to the
   *  product's own price (shelf, featured and category cards). */
  unitPrice?: number;
}) {
  const { add, lastAddedId } = useOrder();
  const lineId = variantKey ? `${product.id}::${variantKey}` : product.id;
  const added = lastAddedId === lineId;

  return (
    <Button
      variant={added ? 'ink' : variant}
      onClick={() => add(product, quantity, { variantKey, variantLabel, unitPrice })}
      className={className}
      ariaLabel={`${added ? 'Added' : 'Add'} ${product.name} to your order`}
    >
      {added ? (
        <>
          {editableLabel ? (
            <Editable k="product.buy.added-label">Added</Editable>
          ) : (
            'Added'
          )}
          <Check size={14} />
        </>
      ) : (
        <>
          {editableLabel ? (
            <Editable k="product.buy.add-label">{label}</Editable>
          ) : (
            label
          )}
          <Plus size={13} />
        </>
      )}
    </Button>
  );
}