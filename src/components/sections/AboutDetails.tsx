'use client';

import { useSiteContent } from '@/components/site-content-provider';
import { whatsappLink } from '@/lib/whatsapp';
import { Container } from '@/components/primitives/Container';
import { Button } from '@/components/primitives/Button';
import { Reveal } from '@/components/primitives/Reveal';
import { ArrowRight } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { useEditField, useEditList } from '@/lib/edit/use-edit';

/**
 * The list-driven pieces of the About page, extracted as client components
 * because `set-list` overrides arrive through the edit store (the page
 * itself stays a server component so it keeps its metadata export). Each
 * block renders its seed copy unchanged when no override has arrived — on
 * a normal visit that is always.
 */

const text = (value: string | number | null, fallback: string) =>
  value === null ? fallback : String(value);

/** Default labels, matching the admin's fixed `about.numbers.facts` list. */
const NUMBER_LABELS = [
  'Studio founded',
  'Products in the shop',
  'Free Lagos delivery over',
  'Lagos turnaround',
];

/** Default row labels, matching the admin's fixed `about.facts.rows` list. */
const FACT_ROW_LABELS = ['Studio', 'City', 'WhatsApp', 'Email', 'Instagram'];

/** The signature: one crease, four numbered stations. */
export function AboutStations() {
  const { aboutPage } = useSiteContent();
  const override = useEditList('about.sheet.stations');
  const stations = override
    ? override.map((item) => ({
        index: String(item.fields.index ?? ''),
        title: String(item.fields.title ?? ''),
        body: String(item.fields.body ?? ''),
      }))
    : aboutPage.sheet.stations;

  return (
    <Container width="wide">
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-4 w-px bg-ink-12 md:left-1/2"
        />
        <ol>
          {stations.map((station, i) => (
            <Reveal
              as="li"
              key={i}
              className="relative grid grid-cols-12 pb-14 last:pb-0 md:pb-20"
            >
              {/* the station marker, sitting on the crease */}
              <span
                aria-hidden="true"
                className="absolute left-4 top-2 block h-[7px] w-[7px] -translate-x-1/2 rotate-45 bg-vermilion md:left-1/2"
              />
              <div
                className={`col-span-12 pl-10 md:pl-0 md:col-span-5 ${
                  i % 2 === 0 ? 'md:col-start-1' : 'md:col-start-8'
                }`}
              >
                <p className="mono-label-xs text-vermilion">
                  <Editable k={`about.sheet.stations.items.${i}.index`}>
                    {station.index}
                  </Editable>
                </p>
                <h3 className="mt-4 font-display text-display-sm leading-tight">
                  <Editable k={`about.sheet.stations.items.${i}.title`}>
                    {station.title}
                  </Editable>
                </h3>
                <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-70 md:text-base">
                  <Editable k={`about.sheet.stations.items.${i}.body`}>
                    {station.body}
                  </Editable>
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </Container>
  );
}

/**
 * The numbers strip. Values are computed on the server from the data files
 * and passed in; only the labels come from the admin's fixed list.
 */
export function AboutNumbers({ values }: { values: readonly string[] }) {
  const { aboutNumbersLabels } = useSiteContent();
  const override = useEditList('about.numbers.facts');
  const labels = override
    ? override.map((item) => String(item.fields.label ?? ''))
    : aboutNumbersLabels;

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {values.map((value, i) => (
        <div
          key={i}
          className="flex flex-col-reverse gap-1.5 border-b border-ink-24 py-6 sm:pr-6 lg:border-b-0"
        >
          <dt className="mono-label-xs text-ink-55">
            <Editable k={`about.numbers.facts.items.${i}.label`}>
              {labels[i] ?? NUMBER_LABELS[i]}
            </Editable>
          </dt>
          <dd className="font-display text-4xl leading-none tabular-nums">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Facts and contact rows: labels from the admin's fixed list, values live. */
export function AboutFacts() {
  const { aboutFactRowLabels, site } = useSiteContent();
  const override = useEditList('about.facts.rows');
  const labels = override
    ? override.map((item) => String(item.fields.label ?? ''))
    : aboutFactRowLabels;

  const label = (i: number) => (
    <Editable k={`about.facts.rows.items.${i}.label`}>
      {labels[i] ?? FACT_ROW_LABELS[i]}
    </Editable>
  );

  return (
    <dl className="border-t border-ink-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-ink-12 py-3.5">
        <dt className="mono-label-xs text-ink-55">{label(0)}</dt>
        <dd className="mono-label-xs text-right">{site.studio}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-b border-ink-12 py-3.5">
        <dt className="mono-label-xs text-ink-55">{label(1)}</dt>
        <dd className="mono-label-xs text-right">{site.city}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-b border-ink-12 py-3.5">
        <dt className="mono-label-xs text-ink-55">{label(2)}</dt>
        <dd className="mono-label-xs text-right tabular-nums">
          {site.whatsappDisplay}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-b border-ink-12 py-3.5">
        <dt className="mono-label-xs text-ink-55">{label(3)}</dt>
        <dd className="mono-label-xs text-right">
          <a href={`mailto:${site.email}`} className="link-draw break-words">
            {site.email}
          </a>
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-b border-ink-12 py-3.5">
        <dt className="mono-label-xs text-ink-55">{label(4)}</dt>
        <dd className="mono-label-xs text-right">
          <a
            href={site.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link-draw"
          >
            @{site.instagram}
          </a>
        </dd>
      </div>
    </dl>
  );
}

/**
 * The two closing buttons. The primary href is an attribute, which
 * `Editable` cannot wrap, so it is subscribed here — the same pattern as
 * Hero's CTA hrefs.
 */
export function AboutClosingActions() {
  const { aboutPage, site } = useSiteContent();

  const primaryHref = text(
    useEditField('about.closing.primary-href'),
    aboutPage.closing.primary.href,
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button href={primaryHref}>
        <Editable k="about.closing.primary-label">
          {aboutPage.closing.primary.label}
        </Editable>
        <ArrowRight size={14} />
      </Button>
      <Button
        href={whatsappLink(
          'Hello Cra7ty Hub, I would like to ask the studio a question.',
          site.whatsappNumber,
        )}
        variant="ink"
      >
        <Editable k="about.closing.secondary-label">
          {aboutPage.closing.secondaryLabel}
        </Editable>
      </Button>
    </div>
  );
}
