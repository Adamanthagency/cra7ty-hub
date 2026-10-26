'use client';

import { interpolateTokens } from '@/lib/edit/keys';
import { useEditList } from '@/lib/edit/use-edit';
import { useSiteContent } from '@/components/site-content-provider';

/**
 * The mono strip under the hero. One track holds two identical halves so the
 * -50% translate loops seamlessly. The animation is disabled by CSS for
 * prefers-reduced-motion, which leaves the words readable and still.
 *
 * Default words come from the content snapshot (the admin's
 * `home.hero.marquee.words` list on a normal visit). Pass `listKey` to make
 * a specific strip editable: a `set-list` override replaces the words, with
 * {total} interpolated locally (raw tokens never render). An explicit
 * `words` prop still wins over the snapshot default.
 */
export function Marquee({
  words,
  className = '',
  listKey,
  total,
}: {
  words?: readonly string[];
  className?: string;
  listKey?: string;
  total?: number;
}) {
  const { marqueeWords } = useSiteContent();
  const override = useEditList(listKey ?? '');
  const list = override
    ? override.map((item) =>
        interpolateTokens(String(item.fields.word ?? ''), { total }),
      )
    : (words ?? marqueeWords);

  return (
    <div
      className={`hairline-t hairline-b overflow-hidden py-3 ${className}`.trim()}
      aria-hidden="true"
    >
      <div className="marquee-track animate-marquee-left">
        {[0, 1].map((half) => (
          <div key={half} className="flex shrink-0 items-center">
            {list.map((word, i) => (
              // index keys: editing a word updates in place, and two
              // identical words from an edit can never collide
              <span key={`${half}-${i}`} className="flex shrink-0 items-center">
                <span className="mono-label-xs whitespace-nowrap px-6 text-ink">
                  {word}
                </span>
                <span className="inline-block h-[3px] w-[3px] rotate-45 bg-vermilion" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
