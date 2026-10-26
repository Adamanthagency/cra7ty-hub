'use client';

import { useSiteContent } from '@/components/site-content-provider';
import { Container } from '@/components/primitives/Container';
import { Section } from '@/components/primitives/Section';
import { FoldSequence } from '@/components/three/FoldSequence';
import { Reveal } from '@/components/primitives/Reveal';
import { Editable } from '@/components/edit/Editable';
import { useEditList } from '@/lib/edit/use-edit';

/**
 * The written steps sit in a narrow sticky column beside the folding sheet,
 * which takes the full height of the section so the scrub has room to run.
 *
 * Edit mode: a `set-list` on `home.process.steps` replaces the step rows
 * live; index keys keep the Reveal elements mounted (typing never replays
 * the reveal).
 */
export function Process() {
  const { processSteps, sections } = useSiteContent();
  const override = useEditList('home.process.steps');
  const steps = override
    ? override.map((item) => ({
        index: String(item.fields.index ?? ''),
        title: String(item.fields.title ?? ''),
        body: String(item.fields.body ?? ''),
      }))
    : processSteps;

  return (
    <Section
      id="process"
      index={sections.process.index}
      title={[...sections.process.title]}
      lede={sections.process.lede}
      containerWidth="wide"
      className="pb-0"
      contentKeys={{
        index: 'home.process.index',
        lede: 'home.process.lede',
      }}
    >
      <Container width="wide">
        <div className="grid grid-cols-12 items-start gap-x-6">
          <ol className="col-span-12 lg:col-span-4 lg:sticky lg:top-32">
            {steps.map((step, i) => (
              <Reveal as="li" key={i} delay={i * 0.08}>
                <div className="border-t border-ink-12 py-7 first:border-t-0 first:pt-0 lg:py-8 lg:first:pt-2">
                  <p className="mono-label-xs text-vermilion">
                    <Editable k={`home.process.steps.${i}.index`}>
                      {step.index}
                    </Editable>
                  </p>
                  <h3 className="mt-4 font-display text-display-sm leading-tight">
                    <Editable k={`home.process.steps.${i}.title`}>
                      {step.title}
                    </Editable>
                  </h3>
                  <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-70">
                    <Editable k={`home.process.steps.${i}.body`}>
                      {step.body}
                    </Editable>
                  </p>
                </div>
              </Reveal>
            ))}

            <li className="border-t border-ink-12 pt-7 lg:pt-8">
              <p className="mono-label-xs text-ink-40">
                <Editable k="home.process.footnote">
                  Lagos 24 hrs · Nationwide 2–5 working days
                </Editable>
              </p>
            </li>
          </ol>

          <div className="col-span-12 mt-4 lg:col-span-7 lg:col-start-6 lg:mt-0">
            {/* the tall scroll runway that ScrollTrigger scrubs against */}
            <FoldSequence className="h-[220vh]" />
          </div>
        </div>
      </Container>
    </Section>
  );
}
