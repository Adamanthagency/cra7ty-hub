'use client';

import { useId, useState } from 'react';
import { useSiteContent } from '@/components/site-content-provider';
import { whatsappLink } from '@/lib/whatsapp';
import { Container } from '@/components/primitives/Container';
import { Section } from '@/components/primitives/Section';
import { Button } from '@/components/primitives/Button';
import { Plus, Close, ArrowRight } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { useEditList, useSectionVariant } from '@/lib/edit/use-edit';

/**
 * A disclosure accordion on the native pattern: a real button carrying
 * aria-expanded and aria-controls, and the panel as a labelled region. Arrow
 * keys move between headers, which is what people expect from a list of
 * questions.
 */
export function Faq() {
  const { faqs, sections, site } = useSiteContent();
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  // Layout variant: 'split' (shipped — questions 7 cols, card beside) or
  // 'stacked' (questions full width, card below). Else-path = today's markup.
  const variant = useSectionVariant('home', 'faq', 'split');
  const stacked = variant === 'stacked';

  // Edit mode: set-list on home.faq.items replaces the rows live.
  const override = useEditList('home.faq.items');
  const items = override
    ? override.map((item) => ({
        q: String(item.fields.question ?? ''),
        a: String(item.fields.answer ?? ''),
      }))
    : faqs;

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = items.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = i === last ? 0 : i + 1;
    if (event.key === 'ArrowUp') next = i === 0 ? last : i - 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    const target = document.getElementById(`${baseId}-q-${next}`);
    target?.focus();
  };

  return (
    <Section
      id="faq"
      index={sections.faq.index}
      title={[...sections.faq.title]}
      lede={sections.faq.lede}
      containerWidth="wide"
      contentKeys={{ index: 'home.faq.index', lede: 'home.faq.lede' }}
    >
      <Container width="wide">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10">
          <div
            className={
              stacked
                ? 'col-span-12'
                : 'col-span-12 md:col-span-7 md:col-start-1'
            }
          >
            <div className="border-t border-ink-12">
              {items.map((item, i) => {
                const open = openIndex === i;
                const buttonId = `${baseId}-q-${i}`;
                const panelId = `${baseId}-a-${i}`;
                return (
                  <div key={i} className="border-b border-ink-12">
                    <h3>
                      <button
                        id={buttonId}
                        type="button"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onKeyDown={(event) => onKeyDown(event, i)}
                        onClick={() => setOpenIndex(open ? null : i)}
                        className="group flex w-full items-start justify-between gap-6 py-5 text-left md:py-6"
                      >
                        <span className="flex items-baseline gap-4">
                          <span className="mono-label-xs mt-2 shrink-0 tabular-nums text-ink-40">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span
                            className={`font-display text-xl leading-snug transition-colors duration-300 md:text-2xl ${
                              open ? 'text-ink' : 'text-ink-70 group-hover:text-ink'
                            }`}
                          >
                            <Editable k={`home.faq.items.${i}.question`}>
                              {item.q}
                            </Editable>
                          </span>
                        </span>
                        <span
                          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center border border-ink-12 transition-colors duration-300 group-hover:border-ink"
                          aria-hidden="true"
                        >
                          {open ? <Close size={12} /> : <Plus size={12} />}
                        </span>
                      </button>
                    </h3>

                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      hidden={!open}
                      className="pb-6 pl-10 md:pb-7 md:pl-14"
                    >
                      <p className="max-w-prose text-sm leading-relaxed text-ink-70 md:text-base">
                        <Editable k={`home.faq.items.${i}.answer`}>
                          {item.a}
                        </Editable>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={
              stacked
                ? 'col-span-12 md:col-span-8 md:col-start-3'
                : 'col-span-12 md:col-span-4 md:col-start-9'
            }
          >
            <div className="dogear border border-ink-24 bg-paper p-7">
              <p className="mono-label-xs text-vermilion">
                <Editable k="home.faq.card-eyebrow">Still stuck</Editable>
              </p>
              <h3 className="mt-4 font-display text-3xl leading-tight">
                <Editable k="home.faq.card-title">
                  Ask a person who folds the paper.
                </Editable>
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-ink-70">
                <Editable k="home.faq.card-body">
                  Messages go to the studio in Okota, not to a queue. Send a
                  photo of your event colours and we will tell you what we can
                  actually make, and what it costs.
                </Editable>
              </p>
              <Button
                className="mt-6 w-full"
                href={whatsappLink(
                  `Hello Cra7ty Hub, I have a question about an order from ${site.name}.`,
                  site.whatsappNumber,
                )}
              >
                <Editable k="home.faq.card-cta">Message the studio</Editable>
                <ArrowRight size={14} />
              </Button>
              <p className="mono-label-xs mt-4 text-ink-40">
                <Editable k="home.faq.card-caption">
                  {site.whatsappDisplay} · Replies same day
                </Editable>
              </p>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}