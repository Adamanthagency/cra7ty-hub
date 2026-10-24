import type { ModelKey } from '@/lib/types';

/**
 * Flat, illustrated fallbacks. These are not placeholders: they are the same
 * folded-paper drawings the site uses wherever 3D is not appropriate, so a
 * device without WebGL still gets an art-directed image rather than a gap.
 */

const ink = 'var(--ink)';
const paper = 'var(--paper)';
const kraft = 'var(--kraft)';
const vermilion = 'var(--vermilion)';
const moss = 'var(--moss)';

type ArtProps = {
  className?: string;
  /** decorative by default; pass a label to expose it to screen readers */
  label?: string;
  title?: string;
};

function Frame({
  viewBox,
  className,
  label,
  title,
  children,
}: ArtProps & { viewBox: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <g fill="none" strokeLinejoin="miter">{children}</g>
    </svg>
  );
}

/* ------------------------------------------------------------- the crane -- */

export function CraneArt({ className, label, title }: ArtProps) {
  return (
    <Frame viewBox="0 0 420 330" className={className} label={label} title={title}>
      {/* contact shadow, kept as a flat ellipse rather than a blur */}
      <ellipse cx="210" cy="272" rx="118" ry="15" fill={ink} fillOpacity="0.07" />

      {/* far wing */}
      <path d="M204 152 L54 44 L150 178 Z" fill={kraft} stroke={ink} strokeOpacity="0.22" />
      {/* far wing tip */}
      <path d="M204 152 L54 44 L112 118 Z" fill={vermilion} fillOpacity="0.92" />

      {/* tail spike */}
      <path d="M148 170 L40 92 L58 82 L160 158 Z" fill={kraft} stroke={ink} strokeOpacity="0.22" />
      <path d="M40 92 L58 82 L66 96 L52 106 Z" fill={vermilion} />

      {/* body, two flaps meeting at a spine */}
      <path d="M204 118 L272 170 L198 232 L138 176 Z" fill={paper} stroke={ink} strokeOpacity="0.3" />
      <path d="M204 118 L272 170 L198 232 Z" fill={paper} stroke="none" />
      <path d="M204 118 L272 170 L198 232 Z" fill={ink} fillOpacity="0.045" stroke="none" />
      <path d="M204 118 L198 232" stroke={ink} strokeOpacity="0.28" strokeWidth="1" />

      {/* neck and beak */}
      <path d="M254 152 L348 76 L360 86 L266 166 Z" fill={paper} stroke={ink} strokeOpacity="0.3" />
      <path d="M348 76 L380 58 L360 86 Z" fill={vermilion} />

      {/* near wing, over the body */}
      <path d="M206 150 L370 60 L258 182 Z" fill={paper} stroke={ink} strokeOpacity="0.26" />
      <path d="M206 150 L370 60 L296 128 Z" fill={vermilion} fillOpacity="0.92" />
      <path d="M206 150 L370 60" stroke={ink} strokeOpacity="0.16" strokeWidth="1" />
    </Frame>
  );
}

/* -------------------------------------------------------------- the plate -- */

export function PlateArt({ className, label, title }: ArtProps) {
  return (
    <Frame viewBox="0 0 240 240" className={className} label={label} title={title}>
      <ellipse cx="120" cy="130" rx="106" ry="88" fill={kraft} fillOpacity="0.35" stroke="none" />
      <ellipse cx="120" cy="122" rx="106" ry="88" fill={paper} stroke={ink} strokeOpacity="0.26" />
      {/* the pressed rim, folding back on itself */}
      <ellipse cx="120" cy="122" rx="92" ry="75" stroke={ink} strokeOpacity="0.3" strokeWidth="2" />
      <ellipse cx="120" cy="126" rx="88" ry="71" stroke={ink} strokeOpacity="0.16" />
      <ellipse cx="120" cy="119" rx="70" ry="57" fill={kraft} fillOpacity="0.22" stroke={ink} strokeOpacity="0.2" />
      {/* radial crease highlights so it does not read as a flat ring */}
      {[200, 250, 300, 340, 380].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={120 + Math.cos(rad) * 70}
            y1={119 + Math.sin(rad) * 57}
            x2={120 + Math.cos(rad) * 88}
            y2={126 + Math.sin(rad) * 71}
            stroke={ink}
            strokeOpacity="0.13"
          />
        );
      })}
    </Frame>
  );
}

/* -------------------------------------------------------------- the spoon -- */

export function SpoonArt({ className, label, title }: ArtProps) {
  return (
    <Frame viewBox="0 0 160 320" className={className} label={label} title={title}>
      {/* handle */}
      <path
        d="M64 292 L96 292 L92 118 L68 118 Z"
        fill={kraft}
        fillOpacity="0.5"
        stroke={ink}
        strokeOpacity="0.26"
      />
      <path d="M80 118 L92 118 L92 292 L80 292 Z" fill={ink} fillOpacity="0.07" stroke="none" />
      {/* pressed bowl */}
      <ellipse cx="80" cy="76" rx="56" ry="66" fill={paper} stroke={ink} strokeOpacity="0.3" />
      <ellipse cx="80" cy="72" rx="46" ry="55" fill={kraft} fillOpacity="0.3" stroke={ink} strokeOpacity="0.2" />
      <path d="M80 17 L80 129" stroke={ink} strokeOpacity="0.14" />
    </Frame>
  );
}

/* ---------------------------------------------------------------- the box -- */

export function BoxArt({ className, label, title }: ArtProps) {
  return (
    <Frame viewBox="0 0 280 240" className={className} label={label} title={title}>
      {/* left and right faces */}
      <path d="M60 100 L140 66 L140 194 L60 228 Z" fill={kraft} fillOpacity="0.55" stroke={ink} strokeOpacity="0.26" />
      <path d="M140 66 L220 100 L220 228 L140 194 Z" fill={paper} stroke={ink} strokeOpacity="0.26" />
      {/* blintz lid flaps meeting at the centre */}
      <path d="M60 100 L140 66 L140 122 Z" fill={paper} stroke={ink} strokeOpacity="0.3" />
      <path d="M140 66 L220 100 L140 122 Z" fill={kraft} fillOpacity="0.4" stroke={ink} strokeOpacity="0.3" />
      <path d="M140 66 L140 122" stroke={vermilion} strokeWidth="2" />
      {/* corner folds */}
      <path d="M60 100 L60 228" stroke={ink} strokeOpacity="0.16" />
      <path d="M220 100 L220 228" stroke={ink} strokeOpacity="0.16" />
      <path d="M140 122 L140 194" stroke={ink} strokeOpacity="0.12" />
    </Frame>
  );
}

/* -------------------------------------------------------------- the flower -- */

export function FlowerArt({ className, label, title }: ArtProps) {
  return (
    <Frame viewBox="0 0 260 260" className={className} label={label} title={title}>
      {[
        { r: 96, n: 8, fill: kraft, o: 0.5 },
        { r: 66, n: 7, fill: paper, o: 1 },
        { r: 40, n: 6, fill: vermilion, o: 0.92 },
      ].map((ring, ringIndex) =>
        Array.from({ length: ring.n }).map((_, i) => {
          const a = (i / ring.n) * Math.PI * 2 + ringIndex * 0.4;
          const x = 130 + Math.cos(a) * ring.r * 0.5;
          const y = 130 + Math.sin(a) * ring.r * 0.5;
          const rot = (a * 180) / Math.PI + 90;
          return (
            <ellipse
              key={`${ringIndex}-${i}`}
              cx={x}
              cy={y}
              rx={ring.r * 0.34}
              ry={ring.r * 0.62}
              transform={`rotate(${rot} ${x} ${y})`}
              fill={ring.fill}
              fillOpacity={ring.o}
              stroke={ink}
              strokeOpacity="0.2"
            />
          );
        }),
      )}
      <circle cx="130" cy="130" r="20" fill={moss} fillOpacity="0.85" stroke={ink} strokeOpacity="0.3" />
    </Frame>
  );
}

/* ---------------------------------------------------------------- the cup -- */

export function CupArt({ className, label, title }: ArtProps) {
  return (
    <Frame viewBox="0 0 200 260" className={className} label={label} title={title}>
      <path d="M52 62 L60 226 L140 226 L148 62 Z" fill={paper} stroke={ink} strokeOpacity="0.28" />
      <path d="M100 62 L148 62 L140 226 L100 226 Z" fill={kraft} fillOpacity="0.3" stroke="none" />
      {/* rolled rim */}
      <ellipse cx="100" cy="62" rx="48" ry="14" fill={kraft} fillOpacity="0.5" stroke={ink} strokeOpacity="0.3" />
      <ellipse cx="100" cy="62" rx="38" ry="9" fill={paper} stroke={ink} strokeOpacity="0.25" />
      <path d="M60 226 L140 226" stroke={vermilion} strokeWidth="3" />
    </Frame>
  );
}

/* -------------------------------------------------------------- the sheet -- */

export function SheetArt({ className, label, title }: ArtProps) {
  return (
    <Frame viewBox="0 0 260 220" className={className} label={label} title={title}>
      {[
        { y: 176, dx: 8, fill: kraft, o: 0.55, r: -2 },
        { y: 156, dx: -4, fill: paper, o: 1, r: 1.5 },
        { y: 136, dx: 6, fill: vermilion, o: 0.9, r: -1 },
        { y: 116, dx: -2, fill: paper, o: 1, r: 2 },
        { y: 96, dx: 4, fill: kraft, o: 0.7, r: -1.5 },
      ].map((s, i) => (
        <rect
          key={i}
          x={34 + s.dx}
          y={s.y}
          width={186}
          height={26}
          transform={`rotate(${s.r} ${130 + s.dx} ${s.y + 13})`}
          fill={s.fill}
          fillOpacity={s.o}
          stroke={ink}
          strokeOpacity="0.24"
        />
      ))}
      <path d="M34 122 L220 122" stroke={ink} strokeOpacity="0.1" />
    </Frame>
  );
}

const registry: Record<ModelKey, (p: ArtProps) => JSX.Element> = {
  crane: CraneArt,
  plate: PlateArt,
  spoon: SpoonArt,
  box: BoxArt,
  flower: FlowerArt,
  cup: CupArt,
  sheet: SheetArt,
};

/** Renders the flat illustration for any product model. */
export function ModelArt({ model, ...props }: ArtProps & { model: ModelKey }) {
  const Component = registry[model] ?? PlateArt;
  return <Component {...props} />;
}