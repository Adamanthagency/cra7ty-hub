'use client';

import { bulkTiers } from '@/data/products';
import { site, sections } from '@/data/site';
import { naira } from '@/lib/format';
import { whatsappLink } from '@/lib/whatsapp';
import { Container } from '@/components/primitives/Container';
import { Button } from '@/components/primitives/Button';
import { FoldDivider, CreaseField } from '@/components/primitives/FoldDivider';
import { ArrowRight } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { useEditList } from '@/lib/edit/use-edit';

const events = [
  { label: 'Weddings', note: 'Tableware and favour tags' },
  { label: 'Naming ceremonies', note: 'Party packs, 30 to 300' },
  { label: 'School events', note: 'Paper packs and bulk plates' },
  { label: 'Small businesses', note: 'Monthly wrap and box orders' },
];

const brief =
  'Hello Cra7ty Hub, I am planning an event and need a bulk quote. Here is what I have:';

/**
 * The one full-bleed kraft band. Tiered pricing is set in mono, because it
 * is a table of numbers and pretending otherwise would be dishonest.
 */
export function BulkBand() {
  // Edit mode: set-list on the event and tier lists replaces the rows live.
  const eventsOverride = useEditList('home.bulk.events');
  const eventRows = eventsOverride
    ? eventsOverride.map((item) => ({
        label: String(item.fields.label ?? ''),
        note: String(item.fields.note ?? ''),
      }))
    : events;

  interface Tier {
    from: number;
    to: number | null;
    discount: string;
    note: string;
  }
  const tiersOverride = useEditList('home.bulk.tiers');
  const tiers: Tier[] = tiersOverride
    ? tiersOverride.map((item) => {
        const from = Number(item.fields.from);
        const rawTo = item.fields.to;
        const to = Number(rawTo);
        return {
          from: Number.isFinite(from) ? from : 0,
          to:
            rawTo === undefined || rawTo === '' || !Number.isFinite(to)
              ? null
              : to,
          discount: String(item.fields.discount ?? ''),
          note: String(item.fields.note ?? ''),
        };
      })
    : bulkTiers;

  return (
    <section id="bulk" aria-labelledby="bulk-title" className="relative bg-kraft">
      <CreaseField className="opacity-70" />

      <Container width="wide" className="relative py-section-y">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10">
          <div className="col-span-12 lg:col-span-2">
            <p className="mono-label-xs">
              <Editable k="home.bulk.index">{sections.bulk.index}</Editable>
            </p>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <h2
              id="bulk-title"
              className="font-display text-display-lg leading-[0.92] tracking-[-0.025em]"
            >
              {sections.bulk.title.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <p className="mt-7 max-w-prose text-base leading-relaxed text-ink-70">
              <Editable k="home.bulk.lede">{sections.bulk.lede}</Editable>
            </p>

            <dl className="mt-9 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-ink-24 pt-6">
              <div>
                <dt className="mono-label-xs text-ink-55">
                  <Editable k="home.bulk.turnaround-label">Turnaround</Editable>
                </dt>
                <dd className="mt-2 font-display text-2xl leading-none">
                  <Editable k="home.bulk.turnaround-value">3–7 days</Editable>
                </dd>
              </div>
              <div>
                <dt className="mono-label-xs text-ink-55">
                  <Editable k="home.bulk.free-delivery-label">
                    Free Lagos delivery
                  </Editable>
                </dt>
                <dd className="mt-2 font-display text-2xl leading-none">
                  {naira(site.freeDeliveryOver)}
                </dd>
              </div>
            </dl>

            <Button
              className="mt-9"
              href={whatsappLink(brief)}
            >
              <Editable k="home.bulk.cta-label">Send us the guest count</Editable>
              <ArrowRight size={14} />
            </Button>
          </div>

          <div className="col-span-12 lg:col-span-3 lg:col-start-10">
            <h3 className="mono-label-xs text-ink-55">
              <Editable k="home.bulk.events-heading">
                What people order
              </Editable>
            </h3>
            <ul className="mt-5 divide-y divide-ink-24 border-t border-ink-24">
              {eventRows.map((event, i) => (
                <li key={i} className="py-4">
                  <p className="text-sm font-medium">
                    <Editable k={`home.bulk.events.${i}.label`}>
                      {event.label}
                    </Editable>
                  </p>
                  <p className="mono-label-xs mt-1.5 text-ink-55">
                    <Editable k={`home.bulk.events.${i}.note`}>
                      {event.note}
                    </Editable>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* the tier table, full width and set in mono */}
        <div className="mt-14 lg:mt-20">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-ink-24 pb-4">
            <h3 className="mono-label">
              <Editable k="home.bulk.tiers-heading">Volume pricing</Editable>
            </h3>
            <p className="mono-label-xs text-ink-55">
              <Editable k="home.bulk.tiers-note">
                Applied to the order total · from {bulkTiers[0].from} units
              </Editable>
            </p>
          </div>

          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Discounts by order size, from 50 units upward
            </caption>
            <thead>
              <tr className="border-b border-ink-24">
                <th scope="col" className="mono-label-xs py-4 pr-4 font-medium text-ink-55">
                  <Editable k="home.bulk.table-units">Units</Editable>
                </th>
                <th scope="col" className="mono-label-xs py-4 pr-4 font-medium text-ink-55">
                  <Editable k="home.bulk.table-off">Off</Editable>
                </th>
                <th
                  scope="col"
                  className="mono-label-xs hidden py-4 pr-4 font-medium text-ink-55 sm:table-cell"
                >
                  <Editable k="home.bulk.table-notes">Notes</Editable>
                </th>
                <th scope="col" className="mono-label-xs py-4 text-right font-medium text-ink-55">
                  <Editable k="home.bulk.table-example">
                    Example at {naira(700)}
                  </Editable>
                </th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier, i) => {
                // priced off the party pack, which is what most bulk orders are
                const example = tier.from * 700;
                return (
                  <tr
                    key={i}
                    className="border-b border-ink-12 transition-colors duration-300 hover:bg-paper-60"
                  >
                    <th scope="row" className="mono-label py-5 pr-4 font-medium tabular-nums">
                      <Editable k={`home.bulk.tiers.${i}.from`}>
                        {tier.from}
                      </Editable>
                      <span className="text-ink-40">
                        {' '}
                        {tier.to ? `— ${tier.to}` : ' and up'}
                      </span>
                    </th>
                    <td className="mono-label py-5 pr-4 text-vermilion">
                      <Editable k={`home.bulk.tiers.${i}.discount`}>
                        {tier.discount}
                      </Editable>
                    </td>
                    <td className="mono-label-xs hidden py-5 pr-4 text-ink-55 sm:table-cell">
                      <Editable k={`home.bulk.tiers.${i}.note`}>
                        {tier.note}
                      </Editable>
                    </td>
                    <td className="mono-label py-5 text-right tabular-nums">
                      {naira(example)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="mono-label-xs mt-4 max-w-prose text-ink-55">
            <Editable k="home.bulk.footnote">
              Example column prices {naira(700)} per guest, which is roughly a
              party pack plus a plate of food. Your number will differ; we quote
              it from your list, not from ours.
            </Editable>
          </p>
        </div>
      </Container>

      <FoldDivider
        label={
          <Editable k="home.bulk.divider-label">
            Fold here before you order
          </Editable>
        }
      />
    </section>
  );
}