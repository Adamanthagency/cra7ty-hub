import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentSnapshot } from '@/lib/content';
import { Container } from '@/components/primitives/Container';
import { PageHeader } from '@/components/primitives/PageHeader';

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getContentSnapshot();
  const description =
    'Events from the Cra7ty Hub studio — free announcements and showcases with an optional free registration. Coming soon.';
  return {
    title: 'Events',
    description,
    alternates: { canonical: '/events' },
    openGraph: {
      title: `Events — ${site.name}`,
      description,
      url: `${site.url}/events`,
      type: 'website',
    },
  };
}

/**
 * Reserved nav slot for the Events feature (a free announcement/showcase
 * page with optional no-cost RSVP — no payment, no capacity logic). The
 * feature is scoped separately; until it ships this shell answers the
 * link instead of 404ing.
 *
 * Workshops stays where it is: /workshops is still the Tier 6 system
 * (paid registration, capacity, tickets) and nothing here touches it.
 */
export default async function EventsPage() {
  await getContentSnapshot();

  return (
    <>
      <PageHeader
        id="events"
        index="01"
        title={['Events,', 'coming soon']}
        lede="Free announcements and showcases from the studio, with a simple way to say you are coming. Nothing is charged here."
      />

      <Container width="wide" className="pb-20">
        <div className="border border-ink-24 bg-paper px-6 py-14 text-center md:px-10">
          <p className="mono-label-xs text-vermilion">Coming soon</p>
          <p className="font-display mx-auto mt-3 max-w-[28rem] text-display-sm leading-tight text-ink">
            This page is being folded.
          </p>
          <p className="mx-auto mt-4 max-w-prose text-sm leading-relaxed text-ink-70 md:text-base">
            Events will list the studio&apos;s open days, showcases and
            announcements — free to attend, with an optional registration so we
            know how many chairs to fold out. Paid, ticketed sessions are
            already running under Workshops.
          </p>
          <p className="mt-7">
            <Link href="/workshops" className="link-draw mono-label-xs inline-flex items-center gap-2">
              See the workshops calendar
              <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </Container>
    </>
  );
}
