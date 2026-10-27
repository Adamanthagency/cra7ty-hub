import type { Metadata } from 'next';
import { getContentSnapshot } from '@/lib/content';
import { Container } from '@/components/primitives/Container';
import { Editable } from '@/components/edit/Editable';
import { SectionOrderHost } from '@/components/edit/SectionOrderHost';
import { TrackerLookup } from '@/components/TrackerLookup';

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getContentSnapshot();
  const description =
    'Look up a Cra7ty Hub order with its number and the email or phone used at checkout.';
  return {
    title: 'Track your order',
    description,
    alternates: { canonical: '/tracker' },
    openGraph: {
      title: `Track your order — ${site.name}`,
      description,
      url: `${site.url}/tracker`,
      type: 'website',
    },
  };
}

/**
 * The customer-facing order status page (Tier 4 follow-on): a lookup
 * form, not a dashboard — no customer accounts exist, so the order
 * number plus the checkout email/phone is the authentication, handled
 * by POST /api/orders/lookup (rate-limited, generic misses).
 *
 * Three seeded sections host in edit mode: header (page title/lede),
 * search (the form card) and statuses (the legend strip). The h1 is
 * inlined rather than PageHeader-driven because the seed carries ONE
 * `tracker.header.title` key while PageHeader edits title lines as
 * `${key}.${i}` — the inline block keeps the key exactly as seeded.
 *
 * Label flow: fulfillment words come from the admin's tracker.statuses
 * list via the snapshot (content.trackerStatusLabels); payment-only
 * outcomes are Editable keys inside the result view.
 */
export default async function TrackerPage() {
  const content = await getContentSnapshot();

  const slots = {
    header: (
      <Container width="wide" className="pb-10 pt-10 md:pb-16 md:pt-14">
        <div className="grid grid-cols-12 gap-x-6 gap-y-6">
          <div className="col-span-12 md:col-span-8">
            <h1
              id="tracker-title"
              className="text-display-md font-display leading-[0.94] tracking-[-0.02em]"
            >
              <span className="block">
                <Editable k="tracker.header.title">Track your order</Editable>
              </span>
            </h1>
          </div>
          <div className="col-span-12 md:col-span-4 md:self-end">
            <p className="mono-label text-ink-70">
              <Editable k="tracker.header.lede">
                Enter your order number (shown on your confirmation screen) and
                the email or phone you used at checkout.
              </Editable>
            </p>
          </div>
        </div>
      </Container>
    ),
    search: (
      <Container width="wide" className="pb-14">
        <div className="dogear border border-ink-24 bg-paper p-6 md:p-10">
          <TrackerLookup />
        </div>
      </Container>
    ),
    statuses: (
      <Container width="wide" className="pb-20">
        <ul className="flex flex-wrap items-center gap-x-7 gap-y-3">
          {content.trackerStatusLabels.map((label) => (
            <li key={label} className="mono-label-xs text-ink-55">
              <span
                aria-hidden="true"
                className="mr-2.5 inline-block h-[3px] w-[3px] rotate-45 bg-vermilion"
              />
              {label}
            </li>
          ))}
        </ul>
      </Container>
    ),
  };

  const order = ['header', 'search', 'statuses'] as const;

  return (
    <SectionOrderHost
      slots={slots}
      order={order}
      published={content.pageSections.tracker}
    />
  );
}
