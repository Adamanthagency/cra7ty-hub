'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Scroll reveals stay deliberately small: 24px of travel and an opacity fade.
 * Anything more starts competing with the folding.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'section' | 'article' | 'tr';
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];

  if (reduced) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Component>
  );
}
const lineVariants: Variants = {
  hidden: { y: '110%' },
  shown: (i: number) => ({
    y: '0%',
    transition: { duration: 0.95, delay: 0.07 * i, ease: [0.22, 1, 0.36, 1] },
  }),
};

/**
 * Page-load headline reveal: each line sits in its own overflow-hidden mask and
 * slides up out of it. Not a fade — the mask is what makes it read as print.
 */
export function MaskedLines({
  lines,
  className = '',
  lineClassName = '',
  play = true,
  delay = 0,
  render,
}: {
  lines: readonly string[];
  className?: string;
  lineClassName?: string;
  /** set false to hold the text hidden until it is scrolled to */
  play?: boolean;
  delay?: number;
  /** lets a line carry emphasis, e.g. one word set in italic */
  render?: (line: string, index: number) => ReactNode;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <span className={className}>
        {lines.map((line, i) => (
          // index keys: editing a line updates the text in place — the
          // node (and any mask animation state) is never remounted
          <span key={i} className={`reveal-line ${lineClassName}`.trim()}>
            <span className="block">{render ? render(line, i) : line}</span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <motion.span
      className={className}
      initial="hidden"
      animate={play ? 'shown' : 'hidden'}
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: 0.09, delayChildren: delay } },
      }}
    >
      {lines.map((line, i) => (
        // index keys — see above: re-splitting on the emphasis word or a
        // set-field must not replay the mask slide
        <span key={i} className={`reveal-line ${lineClassName}`.trim()}>
          <motion.span className="block" custom={i} variants={lineVariants}>
            {render ? render(line, i) : line}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}