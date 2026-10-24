'use client';

import { whyPoints, sections } from '@/data/site';
import { Container } from '@/components/primitives/Container';
import { Section } from '@/components/primitives/Section';
import { Reveal } from '@/components/primitives/Reveal';
import { Editable } from '@/components/edit/Editable';
import { useEditList } from '@/lib/edit/use-edit';

/**
 * A numbered list, not three icon cards. The numbers are set large and the
 * rule between points does the work a card border would otherwise do.
 *
 * Edit mode: a `set-list` on `home.why.points` replaces the points live;
 * index keys keep the Reveal elements mounted (typing never replays the
 * reveal).
 */
export function WhyPaper() {
  const override = useEditList('home.why.points');
  const points = override
    ? override.map((item) => ({
        index: String(item.fields.index ?? ''),
        title: String(item.fields.title ?? ''),
        body: String(item.fields.body ?? ''),
      }))
    : whyPoints;

  return (
    <Section
      id="why"
      index={sections.why.index}
      title={[...sections.why.title]}
      lede={sections.why.lede}
      containerWidth="wide"
      contentKeys={{
        index: 'home.why.index',
        lede: 'home.why.lede',
      }}
    >
      <Container width="wide">
        <ol className="border-t border-ink-12">
          {points.map((point, i) => (
            <Reveal as="li" key={i} delay={i * 0.06}>
              <div className="grid grid-cols-12 gap-x-6 gap-y-3 border-b border-ink-12 py-8 md:py-12">
                <p className="col-span-2 md:col-span-1 font-display text-4xl leading-none text-vermilion md:text-5xl">
                  <Editable k={`home.why.points.${i}.index`}>
                    {point.index}
                  </Editable>
                </p>
                <h3 className="col-span-10 font-display text-display-sm leading-tight md:col-span-5 md:col-start-3">
                  <Editable k={`home.why.points.${i}.title`}>
                    {point.title}
                  </Editable>
                </h3>
                <p className="col-span-12 max-w-prose text-sm leading-relaxed text-ink-70 md:col-span-6 md:col-start-8 md:self-center md:text-base">
                  <Editable k={`home.why.points.${i}.body`}>
                    {point.body}
                  </Editable>
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
