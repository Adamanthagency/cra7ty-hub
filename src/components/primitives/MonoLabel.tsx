import type { ReactNode } from 'react';

/** The recurring mono type detail: numbering, prices, eyebrows. */
export function MonoLabel({
  children,
  as: Tag = 'span',
  size = 'sm',
  className = '',
}: {
  children: ReactNode;
  as?: 'span' | 'p' | 'div' | 'h3' | 'dt';
  size?: 'xs' | 'sm';
  className?: string;
}) {
  const sizeCls = size === 'xs' ? 'mono-label-xs' : 'mono-label';
  return <Tag className={`${sizeCls} ${className}`.trim()}>{children}</Tag>;
}

/** A price, set in mono so it reads as a spec rather than a headline. */
export function Price({ value, className = '' }: { value: string; className?: string }) {
  return <span className={`mono-label tabular-nums ${className}`.trim()}>{value}</span>;
}