import type { ElementType, ReactNode } from 'react';

type Width = 'wide' | 'default' | 'narrow';

const widths: Record<Width, string> = {
  wide: 'max-w-[104rem]',
  default: 'max-w-[84rem]',
  narrow: 'max-w-[46rem]',
};

/**
 * The single horizontal rhythm for the whole page. Everything sits inside a
 * Container, which is what keeps the asymmetric grid from drifting.
 */
export function Container({
  children,
  width = 'default',
  as: Tag = 'div' as ElementType,
  className = '',
}: {
  children: ReactNode;
  width?: Width;
  as?: ElementType;
  className?: string;
}) {
  return (
    <Tag
      className={`mx-auto w-full px-gutter ${widths[width]} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}