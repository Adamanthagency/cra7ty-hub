'use client';

import { useEffect, useRef, useState } from 'react';

interface SafeImgProps {
  src: string;
  alt: string;
  className?: string;
  /** Fires once when every retry has failed — the URL is dead, not slow. */
  onDead?: () => void;
}

/**
 * A photograph that survives transient network failures: a plain
 * onError-hide would blank a working photo for the rest of the page
 * view, so a failed load retries up to MAX_RETRIES times on a short
 * backoff, with a cache-busting query so a cached failure can't stick.
 * Only a URL that fails every attempt stays hidden — and `onDead` tells
 * the caller so it can swap in an honest placeholder instead of leaving
 * whatever was underneath visible.
 */
const MAX_RETRIES = 2;

export function SafeImg({ src, alt, className, onDead }: SafeImgProps) {
  const [attempt, setAttempt] = useState(0);
  const [dead, setDead] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // A pending retry must not fire after unmount.
  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );

  if (dead) return null;

  // Supabase Storage ignores query parameters on public object URLs, so
  // a retry re-requests the same bytes without reusing a cached failure.
  const url = attempt === 0 ? src : `${src}?retry=${attempt}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- cross-origin Supabase Storage URL; next/image would need a remotePatterns entry for this origin
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => {
        if (attempt >= MAX_RETRIES) {
          setDead(true);
          onDead?.();
          return;
        }
        timer.current = window.setTimeout(
          () => setAttempt((current) => current + 1),
          400 * (attempt + 1),
        );
      }}
    />
  );
}
