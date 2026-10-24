'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useShouldMount3D } from '@/lib/use-env';
import { Editable } from '@/components/edit/Editable';
import { useEditList } from '@/lib/edit/use-edit';
import { CraneArt } from './fallbacks';
import { foldStepNames } from './fold-steps';

const FoldSequenceScene = dynamic(() => import('./FoldSequenceScene'), { ssr: false });

const padStep = (n: number) => (n < 10 ? `0${n}` : String(n));

/**
 * Scroll-driven fold. The scroll position is written into a ref so the render
 * loop can read it every frame without React re-rendering 60 times a second;
 * only the caption, which changes twelve times across the whole scroll, is
 * state.
 */
export function FoldSequence({ className = '' }: { className?: string }) {
  const { can3D, reduced } = useShouldMount3D();
  const progress = useRef(0);
  const [step, setStep] = useState(1);
  const section = useRef<HTMLDivElement>(null);

  // Edit mode: set-list on home.process.fold-steps replaces the captions.
  const stepsOverride = useEditList('home.process.fold-steps');
  const stepNames = stepsOverride
    ? stepsOverride.map((item) => String(item.fields.name ?? ''))
    : foldStepNames;
  const totalSteps = Math.max(1, stepNames.length);
  const shownStep = Math.min(step, totalSteps);

  // Scrubbing is the one place GSAP earns its keep. When motion is reduced we
  // fall back to a plain scroll listener: the caption still tracks the
  // scroll, nothing animates on its own.
  const scrub = can3D;

  useEffect(() => {
    const element = section.current;
    if (!element) return;

    let cancelled = false;
    let trigger: { kill: () => void } | null = null;

    const apply = (p: number) => {
      progress.current = p;
      const next = Math.min(totalSteps, Math.max(1, Math.floor(p * totalSteps) + 1));
      setStep((prev) => (prev === next ? prev : next));
    };

    if (scrub) {
      void (async () => {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([
          import('gsap'),
          import('gsap/ScrollTrigger'),
        ]);
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        const proxy = { value: 0 };
        const tween = gsap.to(proxy, {
          value: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: element,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.5,
            onUpdate: (self: { progress: number }) => apply(self.progress),
          },
        });
        trigger = (tween.scrollTrigger as unknown as { kill: () => void } | undefined) ?? null;
      })();
    } else {
      const onScroll = () => {
        const rect = element.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        apply(travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      };
    }

    return () => {
      cancelled = true;
      trigger?.kill();
    };
  }, [scrub, totalSteps]);

  return (
    <div ref={section} className={`relative ${className}`.trim()}>
      <div className="sticky top-0 flex h-[100svh] min-h-[520px] items-center">
        <div className="w-full">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-2xl">
            {can3D ? (
              <FoldSequenceScene progress={progress} />
            ) : (
              <CraneArt
                className="h-full w-full"
                label="A flat square of paper, folded into an origami crane"
              />
            )}
          </div>

          <div className="mx-auto mt-2 w-full max-w-2xl px-gutter">
            <div className="flex items-baseline justify-between border-t border-ink-12 pt-3">
              <p className="mono-label text-ink">
                <Editable k="home.process.fold-prefix">Fold</Editable>{' '}
                {padStep(shownStep)}{' '}
                <span className="text-ink-40">/ {totalSteps}</span>
              </p>
              <p className="mono-label-xs text-ink-55">
                <Editable k={`home.process.fold-steps.${shownStep - 1}.name`}>
                  {stepNames[shownStep - 1]}
                </Editable>
              </p>
            </div>
            <div className="mt-2 h-px w-full bg-ink-12" aria-hidden="true">
              <div
                className="h-px bg-vermilion transition-[width] duration-200 ease-paper"
                style={{ width: `${(shownStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      {!reduced && (
        <p className="mono-label-xs pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-ink-40">
          <Editable k="home.process.scroll-hint">Scroll to fold</Editable>
        </p>
      )}
    </div>
  );
}