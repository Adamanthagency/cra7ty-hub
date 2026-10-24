import type { ReactNode } from 'react';
import { Container } from './Container';
import { Editable } from '@/components/edit/Editable';

/**
 * A section with an optional editorial number and a header block that is
 * asymmetric by design: the heading sits in a narrow column, the lede in a
 * second one, offset. `tone` flips the ground to kraft for the event band.
 */
export function Section({
  id,
  index,
  eyebrow,
  title,
  lede,
  tone = 'paper',
  bleed = false,
  children,
  className = '',
  containerWidth = 'default',
  contentKeys,
}: {
  id?: string;
  index?: string;
  eyebrow?: string;
  /** split lines; each becomes its own masked reveal line */
  title?: readonly string[];
  lede?: string;
  tone?: 'paper' | 'kraft' | 'moss';
  /** skip the container so a section can run full-bleed */
  bleed?: boolean;
  children: ReactNode;
  className?: string;
  containerWidth?: 'wide' | 'default' | 'narrow';
  /**
   * admin content keys for the header copy; absent = not editable.
   * `title` is a BASE key — line i is edited as `${title}.${i}`.
   */
  contentKeys?: { index?: string; title?: string; lede?: string };
}) {
  const ground =
    tone === 'kraft' ? 'bg-kraft text-ink' : tone === 'moss' ? 'bg-moss text-paper' : 'bg-paper text-ink';

  const hasHeader = Boolean(index || eyebrow || title || lede);

  return (
    <section
      id={id}
      aria-labelledby={title && id ? `${id}-title` : undefined}
      className={`${ground} relative ${bleed ? '' : 'py-section-y'} ${className}`.trim()}
    >
      {hasHeader && (
        <Container width={containerWidth} className={tone === 'paper' ? 'pb-10 md:pb-16' : 'pb-8 md:pb-12'}>
          <div className="grid grid-cols-12 gap-x-6 gap-y-6">
            {index && (
              <div className="col-span-12 md:col-span-2">
                <p className="mono-label-xs text-ink-55">
                  {contentKeys?.index ? (
                    <Editable k={contentKeys.index}>{index}</Editable>
                  ) : (
                    index
                  )}
                </p>
              </div>
            )}
            {title && (
              <div
                className={
                  index
                    ? 'col-span-12 md:col-span-7 lg:col-span-6'
                    : 'col-span-12 md:col-span-8'
                }
              >
                <h2
                  id={id ? `${id}-title` : undefined}
                  className="text-display-md font-display leading-[0.94] tracking-[-0.02em]"
                >
                  {contentKeys?.title ? (
                    title.map((line, i) => (
                      <span key={i} className="block">
                        <Editable k={`${contentKeys.title}.${i}`}>
                          {line}
                        </Editable>
                      </span>
                    ))
                  ) : (
                    title.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))
                  )}
                </h2>
              </div>
            )}
            {lede && (
              <div
                className={
                  index
                    ? 'col-span-12 md:col-span-3 lg:col-start-10 lg:col-span-3 md:self-end'
                    : 'col-span-12 md:col-span-4 md:self-end'
                }
              >
                <p className="mono-label text-ink-70">
                  {contentKeys?.lede ? (
                    <Editable k={contentKeys.lede}>{lede}</Editable>
                  ) : (
                    lede
                  )}
                </p>
              </div>
            )}
            {eyebrow && (
              <div className="col-span-12 md:col-span-3 md:col-start-10 md:self-end">
                <p className="mono-label-xs text-ink-55">{eyebrow}</p>
              </div>
            )}
          </div>
        </Container>
      )}
      {children}
    </section>
  );
}