'use client';

import { useEffect, useState } from 'react';
import { SafeImg } from '@/components/primitives/SafeImg';

export interface HeroSlide {
  src: string;
  caption: string;
}

interface HeroSlideshowProps {
  slides: HeroSlide[];
  /** SafeImg failed every retry for this URL — the owner drops it from the
   *  rotation so a dead media object never leaves an empty box on screen */
  onDead: (src: string) => void;
  /** mirrors the visible slide so the caption row below can print 01 / 05 */
  onIndexChange: (index: number) => void;
}

const INTERVAL_MS = 5000;

/**
 * The homepage hero's right column: the admin's own images, in the admin's
 * own order (content list `home.hero.slideshow`, max 10). Crossfades on a
 * timer, pauses while the pointer or keyboard focus is inside, and never
 * auto-advances under prefers-reduced-motion — the dots still work, so the
 * visitor drives it themselves. One slide simply sits still.
 *
 * Captions are optional and do double duty: they are the alt text, and the
 * hero's caption row prints the active one.
 */
export function HeroSlideshow({ slides, onDead, onIndexChange }: HeroSlideshowProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Read once after mount: this is client-only state, so hydration never
  // sees a mismatch.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  // The list can shrink underneath us when a URL dies — never point past it.
  useEffect(() => {
    if (index >= slides.length && slides.length > 0) setIndex(0);
  }, [slides.length, index]);

  // The timer, and the one place the caption row learns the active slide.
  useEffect(() => {
    onIndexChange(index);
    if (slides.length < 2 || paused || reduced) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [index, slides.length, paused, reduced, onIndexChange]);

  if (slides.length === 0) return null;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-kraft-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {slides.map((slide, i) => (
        <div
          key={slide.src}
          aria-hidden={i === index ? undefined : true}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <SafeImg
            src={slide.src}
            alt={slide.caption}
            onDead={() => onDead(slide.src)}
            className="h-full w-full object-cover"
          />
        </div>
      ))}

      {slides.length > 1 && (
        <div className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-card bg-paper/85 p-1">
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show slide ${i + 1}${slide.caption ? ` — ${slide.caption}` : ''}`}
              aria-current={i === index ? 'true' : undefined}
              className="p-1.5"
            >
              <span
                className={`block h-1.5 w-1.5 rounded-full transition-colors ${
                  i === index ? 'bg-vermilion' : 'bg-ink/25'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
