'use client';

import type { ProductVariant, VariantType } from '@/lib/types';
import { Check } from '@/components/primitives/Icons';

/**
 * The detail page's variant picker. Geometry mirrors the admin's
 * VariantIndicator (20px swatch circles with a check when chosen, chips
 * for size/material) but speaks the storefront's language: paper/ink/kraft
 * only, hairline borders, mono micro labels, vermilion focus outline from
 * the global :focus-visible rule.
 *
 * Per-axis radio: one colour, one size, one material. Clicking the chosen
 * option clears that axis. Nothing is preselected — with no selection the
 * product page behaves exactly as it did before variants existed.
 */

export type VariantSelection = Partial<Record<VariantType, string>>;

/** Fixed axis order — key, label and price fallback all read from this. */
export const AXIS_ORDER: VariantType[] = ['colour', 'size', 'material'];

const AXIS_LABEL: Record<VariantType, string> = {
  colour: 'Colour',
  size: 'Size',
  material: 'Material',
};

/** Contrast class for the check inside a swatch of unknown lightness. */
function checkTone(hex: string | undefined): 'text-ink' | 'text-paper' {
  const raw = (hex ?? '#d9c7a7').replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return 'text-ink';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const lightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lightness > 0.6 ? 'text-ink' : 'text-paper';
}

export function VariantPicker({
  variants,
  selection,
  onToggle,
}: {
  /** Active variants only — catalog.ts already dropped inactive ones. */
  variants: ProductVariant[];
  selection: VariantSelection;
  onToggle: (variant: ProductVariant) => void;
}) {
  if (variants.length === 0) return null;

  return (
    <div className="mt-7 space-y-5">
      {AXIS_ORDER.map((axis) => {
        const options = variants.filter((v) => v.type === axis);
        if (options.length === 0) return null;
        const selectedId = selection[axis];

        return (
          <div key={axis}>
            <p id={`variant-axis-${axis}`} className="mono-label-xs text-ink-55">
              {AXIS_LABEL[axis]}
            </p>
            <ul
              role="group"
              aria-labelledby={`variant-axis-${axis}`}
              className="mt-2.5 flex flex-wrap gap-2"
            >
              {options.map((v) => {
                const isOn = selectedId === v.id;
                const label =
                  v.stock !== undefined
                    ? `${v.value} · ${v.stock} in stock`
                    : v.value;

                if (v.type === 'colour') {
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => onToggle(v)}
                        aria-pressed={isOn}
                        title={label}
                        className="group flex w-16 flex-col items-center gap-1.5"
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border transition-shadow ${
                            isOn
                              ? 'border-ink-24 shadow-[0_0_0_2px_var(--paper),0_0_0_4px_var(--ink)]'
                              : 'border-ink-24 group-hover:shadow-[0_0_0_1px_var(--ink-40)]'
                          }`}
                          style={{ backgroundColor: v.hex ?? '#d9c7a7' }}
                        >
                          {isOn && (
                            <Check size={12} className={checkTone(v.hex)} />
                          )}
                        </span>
                        <span
                          className={`max-w-full truncate font-mono text-[9px] uppercase tracking-[0.08em] transition-colors ${
                            isOn ? 'text-ink' : 'text-ink-55 group-hover:text-ink'
                          }`}
                        >
                          {v.value}
                        </span>
                      </button>
                    </li>
                  );
                }

                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(v)}
                      aria-pressed={isOn}
                      title={label}
                      className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
                        isOn
                          ? 'border-ink bg-ink text-paper'
                          : 'border-ink-12 text-ink-55 hover:border-ink-40 hover:text-ink'
                      }`}
                    >
                      {v.value}
                      {v.stock !== undefined && (
                        <span
                          className={`ml-1.5 text-[9px] ${
                            isOn ? 'text-paper-60' : 'text-ink-40'
                          }`}
                        >
                          · {v.stock}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
