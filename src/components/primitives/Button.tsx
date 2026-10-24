import Link from 'next/link';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ink';

const styles: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ink: 'btn-ink',
};

/**
 * The one button on the site. Rectangular with a clipped corner, a mono
 * uppercase label and a fill that slides up on hover while the label swaps
 * contrast. Renders as <a> for external/WhatsApp targets and <Link> for
 * in-page anchors.
 */
export function Button({
  children,
  href,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
  ariaLabel,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  className?: string;
  type?: 'button' | 'submit';
  ariaLabel?: string;
}) {
  const cls = `btn ${styles[variant]} ${className}`.trim();

  const inner = <span>{children}</span>;

  if (href) {
    const external = href.startsWith('http') || href.startsWith('wa.me');
    if (external) {
      return (
        <a
          href={href}
          className={cls}
          aria-label={ariaLabel}
          target="_blank"
          rel="noopener noreferrer"
        >
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={cls} aria-label={ariaLabel}>
      {inner}
    </button>
  );
}