'use client';

import { useState } from 'react';
import { SafeImg } from '@/components/primitives/SafeImg';
import { NoPhoto } from '@/components/primitives/NoPhoto';

interface ProductGalleryProps {
  name: string;
  /** The product's photo URLs in upload order — images[0] is the main photo. */
  images: string[];
}

/**
 * The product page's main visual — photographs only (mandatory-photos
 * stage). No 3D fallback: a product with no photo shows the honest
 * "No photo yet" panel, and a photo URL that fails after SafeImg's
 * retries swaps to the same panel instead of revealing art that could
 * be mistaken for the real product. The active photo layers full-bleed
 * with a thumbnail strip when there is more than one.
 */
export function ProductGallery({ name, images }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const [deadSrc, setDeadSrc] = useState<string | null>(null);
  const src = images[active];
  // deadSrc only suppresses the URL that actually failed; picking a
  // different thumbnail gives that URL a clean attempt (the key remounts).
  const dead = !src || deadSrc === src;

  return (
    <>
      {dead ? (
        <NoPhoto label={name} className="absolute inset-0 h-full w-full" />
      ) : (
        <SafeImg
          key={`${active}-${src}`}
          src={src}
          alt={name}
          onDead={() => setDeadSrc(src)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {images.length > 1 && (
        <ul className="absolute bottom-4 left-4 z-10 flex gap-2">
          {images.map((url, i) => (
            <li key={`${url}-${i}`}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Photo ${i + 1} of ${images.length}`}
                aria-pressed={i === active}
                className={`block h-12 w-12 overflow-hidden border bg-kraft-12 transition-colors ${
                  i === active
                    ? 'border-ink'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <SafeImg
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
