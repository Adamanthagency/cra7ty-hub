import type { ReactNode } from 'react';

/**
 * A card with a clipped top-right corner. The flap grows on hover or focus so
 * the notch reads as a peel rather than a shape, and the card body lifts on a
 * soft paper shadow only when something inside it is interactive.
 */
export function DogEarCard({
  children,
  size = 'md',
  index,
  className = '',
  bodyClassName = '',
}: {
  children: ReactNode;
  size?: 'sm' | 'md';
  /** mono number printed under the flap */
  index?: string;
  className?: string;
  bodyClassName?: string;
}) {
  const clip = size === 'sm' ? 'dogear dogear--sm' : 'dogear';
  const flapSize = size === 'sm' ? 'h-3 w-3' : 'h-5 w-5';

  return (
    <article className={`${clip} paper-lift group relative ${className}`.trim()}>
      <span className={`dogear__flap ${flapSize}`} aria-hidden="true" />
      {index && (
        <span className="mono-label-xs absolute right-6 top-5 text-ink-40" aria-hidden="true">
          {index}
        </span>
      )}
      <div className={`relative ${bodyClassName}`.trim()}>{children}</div>
    </article>
  );
}