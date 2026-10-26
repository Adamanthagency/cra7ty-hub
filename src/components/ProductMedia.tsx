'use client';

import { useState } from 'react';
import { SafeImg } from '@/components/primitives/SafeImg';
import { NoPhoto } from '@/components/primitives/NoPhoto';

interface ProductMediaProps {
  /**
   * The product's photo URLs, in upload order — images[0] IS the main
   * image (mapProduct keeps DB order and drops non-http entries).
   */
  images: string[];
  /** Product name: alt/label text and the placeholder's caption. */
  name: string;
  className?: string;
}

/**
 * One product card's image, shared by the shelf, the home featured grid,
 * both related strips and the order drawer: the first uploaded photo,
 * full-bleed. Never 3D art — no photo, or a URL that dies after
 * SafeImg's retries, shows the honest "No photo yet" panel instead.
 *
 * alt is empty on purpose: every call site pairs the image with the
 * product's name as adjacent text, so a screen reader would otherwise
 * read the name twice.
 */
export function ProductMedia({ images, name, className = '' }: ProductMediaProps) {
  const [deadSrc, setDeadSrc] = useState<string | null>(null);
  const src = images[0];

  if (!src || deadSrc === src) {
    return <NoPhoto label={name} className={className} />;
  }
  return (
    <SafeImg
      key={src}
      src={src}
      alt=""
      onDead={() => setDeadSrc(src)}
      className={className}
    />
  );
}
