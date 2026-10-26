'use client';

import { useSiteContent } from '@/components/site-content-provider';
import { Container } from '@/components/primitives/Container';
import { Section } from '@/components/primitives/Section';
import { Reveal } from '@/components/primitives/Reveal';
import { Editable } from '@/components/edit/Editable';
import { useEditList } from '@/lib/edit/use-edit';

/**
 * Three quotes at display size, set ragged and offset on purpose. They are
 * marked as placeholders in /data/site.ts and flagged here too, so nobody
 * mistakes invented words for a real customer's.
 *
 * Edit mode: a `set-list` on `home.testimonials.items` replaces the rows
 * live; index keys keep the Reveal elements mounted (typing never replays
 * the reveal).
 */
export function Testimonials() {
  const { sections, testimonials } = useSiteContent();
  const override = useEditList('home.testimonials.items');
  const items = override
    ? override.map((item) => ({
        quote: String(item.fields.quote ?? ''),
        name: String(item.fields.name ?? ''),
        city: String(item.fields.city ?? ''),
        placeholder: Boolean(item.fields.placeholder),
      }))
    : testimonials;

  return (
    <Section
      id="about"
      index={sections.testimonials.index}
      title={[...sections.testimonials.title]}
      lede={sections.testimonials.lede}
      containerWidth="wide"
      contentKeys={{
        index: 'home.testimonials.index',
        lede: 'home.testimonials.lede',
      }}
    >
      <Container width="wide">
        <ul className="grid grid-cols-12 gap-x-6 gap-y-12">
          {items.map((item, i) => (
            <Reveal
              as="li"
              key={i}
              delay={i * 0.07}
              className={
                i === 0
                  ? 'col-span-12 md:col-span-6'
                  : i === 1
                    ? 'col-span-12 md:col-span-5 md:col-start-8 md:mt-20'
                    : 'col-span-12 md:col-span-6 md:col-start-2 md:-mt-10'
              }
            >
              <figure>
                <blockquote>
                  <p
                    className={`font-display italic leading-[1.12] tracking-[-0.015em] ${
                      i === 1
                        ? 'text-display-sm md:text-display-md'
                        : 'text-display-sm'
                    }`}
                  >
                    <span aria-hidden="true" className="text-vermilion">
                      &ldquo;
                    </span>
                    <Editable k={`home.testimonials.items.${i}.quote`}>
                      {item.quote}
                    </Editable>
                    <span aria-hidden="true" className="text-vermilion">
                      &rdquo;
                    </span>
                  </p>
                </blockquote>
                <figcaption className="mt-6 flex items-baseline gap-3 border-t border-ink-12 pt-4">
                  <span className="text-sm font-medium">
                    <Editable k={`home.testimonials.items.${i}.name`}>
                      {item.name}
                    </Editable>
                  </span>
                  <span className="mono-label-xs text-ink-40">
                    <Editable k={`home.testimonials.items.${i}.city`}>
                      {item.city}
                    </Editable>
                  </span>
                  {item.placeholder && (
                    <span className="mono-label-xs ml-auto border border-ink-24 px-2 py-1 text-ink-40">
                      <Editable k="home.testimonials.placeholder-chip">
                        Placeholder
                      </Editable>
                    </span>
                  )}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
