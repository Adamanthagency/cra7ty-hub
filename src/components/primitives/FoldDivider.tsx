import type { ReactNode } from 'react';

/**
 * A divider that looks like a folded paper edge: a hairline rule interrupted
 * by a skewed plate with a vermilion square sitting on the crease.
 */
export function FoldDivider({ label }: { label?: ReactNode }) {
  return (
    <div className="relative w-full py-12" aria-hidden="true">
      <div className="mx-auto h-px w-full bg-ink-12" />
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <div className="h-7 w-12 -skew-x-[22deg] border border-ink-12 bg-paper" />
        <span className="absolute block h-[5px] w-[5px] rotate-45 bg-vermilion" />
      </div>
      {label && (
        <p className="mono-label-xs absolute inset-x-0 top-1/2 -translate-y-[calc(100%+16px)] text-center text-ink-40">
          {label}
        </p>
      )}
    </div>
  );
}

/**
 * Diagonal crease lines behind a block. Purely decorative, kept out of the
 * accessibility tree, and never layered over text.
 */
export function CreaseField({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`.trim()}
    >
      <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 400" fill="none">
        {[60, 150, 240, 330].map((y) => (
          <line
            key={y}
            x1="-60"
            y1={y}
            x2="460"
            y2={y + 130}
            stroke="var(--ink)"
            strokeOpacity="0.07"
            strokeWidth="1"
          />
        ))}
      </svg>
    </div>
  );
}