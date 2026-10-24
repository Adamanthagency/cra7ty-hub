import { Container } from './Container';
import { Editable } from '@/components/edit/Editable';
import type { TokenValues } from '@/lib/edit/keys';

/**
 * The page-level header block: the same asymmetric grid as Section's header,
 * but the heading is the page's single h1 rather than a section's h2, so
 * every new page keeps exactly one h1 and an unbroken heading order below it.
 */
export function PageHeader({
  id,
  index,
  title,
  lede,
  contentKeys,
  ledeTokens,
}: {
  /** wires the page title id, e.g. "shop" -> h1 id="shop-title" */
  id: string;
  /** two-digit editorial number */
  index?: string;
  /** split lines; each renders as its own block, like Section */
  title?: readonly string[];
  lede?: string;
  /**
   * admin content keys for the header copy; absent = not editable.
   * `title` is a BASE key — line i is edited as `${title}.${i}`.
   */
  contentKeys?: { index?: string; title?: string; lede?: string };
  /** token values for the lede ({shown}/{total}) when it is token-bearing */
  ledeTokens?: TokenValues;
}) {
  return (
    <Container width="wide" className="pb-10 pt-10 md:pb-16 md:pt-14">
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
            <h1
              id={`${id}-title`}
              className="text-display-md font-display leading-[0.94] tracking-[-0.02em]"
            >
              {contentKeys?.title ? (
                title.map((line, i) => (
                  <span key={i} className="block">
                    <Editable k={`${contentKeys.title}.${i}`}>{line}</Editable>
                  </span>
                ))
              ) : (
                title.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))
              )}
            </h1>
          </div>
        )}
        {lede && (
          <div
            className={
              index
                ? 'col-span-12 md:col-span-3 lg:col-span-3 lg:col-start-10 md:self-end'
                : 'col-span-12 md:col-span-4 md:self-end'
            }
          >
            <p className="mono-label text-ink-70">
              {contentKeys?.lede ? (
                <Editable k={contentKeys.lede} tokens={ledeTokens}>
                  {lede}
                </Editable>
              ) : (
                lede
              )}
            </p>
          </div>
        )}
      </div>
    </Container>
  );
}
