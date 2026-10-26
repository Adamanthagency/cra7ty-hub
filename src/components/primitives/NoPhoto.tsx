interface NoPhotoProps {
  /** The product's name — goes into the accessibility label. */
  label?: string;
  className?: string;
}

/**
 * The honest placeholder for a product with no photo (mandatory-photos
 * stage). It deliberately does NOT look like product art: a plain kraft
 * panel with a picture glyph and a mono caption, so a data gap reads as
 * a data gap and can never be mistaken for a photograph of the product.
 *
 * Used on every product-representing surface (shelf cards, home
 * featured, related strips, the order drawer, the product gallery) —
 * the 3D model art is decorative-only now and never stands in for a
 * product image.
 */
export function NoPhoto({ label, className = '' }: NoPhotoProps) {
  return (
    <div
      role="img"
      aria-label={label ? `No photo yet for ${label}` : 'No photo yet'}
      className={`flex flex-col items-center justify-center gap-2 bg-kraft-12 ${className}`}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-ink-40"
      >
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="M21 16l-5-5-4 4-2-2-5 5" />
      </svg>
      <span className="mono-label-xs text-ink-40">No photo yet</span>
    </div>
  );
}
