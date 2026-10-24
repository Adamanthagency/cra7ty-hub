type IconProps = {
  className?: string;
  /** hairline stroke width; 1 keeps the line-icon language consistent */
  size?: number;
};

const base = 'shrink-0';

function line(props: IconProps & { d: React.ReactNode; viewBox?: string }) {
  const { className = '', size = 16, viewBox = '0 0 16 16', d } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={`${base} ${className}`.trim()}
    >
      {d}
    </svg>
  );
}

/** Arrow, used on buttons and links. */
export function ArrowRight({ className, size }: IconProps) {
  return line({
    className,
    size,
    d: (
      <>
        <path d="M1.5 8h12" />
        <path d="M9 3.5 13.5 8 9 12.5" />
      </>
    ),
  });
}

export function ArrowDown({ className, size }: IconProps) {
  return line({
    className,
    size,
    d: (
      <>
        <path d="M8 1.5v12" />
        <path d="M3.5 9 8 13.5 12.5 9" />
      </>
    ),
  });
}

export function Plus({ className, size }: IconProps) {
  return line({ className, size, d: <path d="M8 2v12M2 8h12" /> });
}

export function Minus({ className, size }: IconProps) {
  return line({ className, size, d: <path d="M2 8h12" /> });
}

export function Close({ className, size }: IconProps) {
  return line({
    className,
    size,
    d: (
      <>
        <path d="M2 2l12 12" />
        <path d="M14 2L2 14" />
      </>
    ),
  });
}

/** A folded-crane glyph, used as the wordmark mark and the fallback art. */
export function CraneMark({ className, size = 22 }: IconProps) {
  return line({
    className,
    size,
    d: (
      <>
        <path d="M1 10.5 8 4l7 6.5" />
        <path d="M8 4v11" />
        <path d="M8 15l-4.5-6.5" />
        <path d="M8 15l4.5-6.5" />
      </>
    ),
  });
}

export function Check({ className, size }: IconProps) {
  return line({ className, size, d: <path d="M2 8.5 6 12.5 14 3.5" /> });
}

/** Magnifier for the shop's search bar. */
export function Search({ className, size }: IconProps) {
  return line({
    className,
    size,
    d: (
      <>
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5 14.5 14.5" />
      </>
    ),
  });
}