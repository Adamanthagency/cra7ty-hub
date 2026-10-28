import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentSnapshot } from '@/lib/content';
import { getUpcomingEvents } from '@/lib/events';
import { eventDay, eventTime } from '@/lib/event-format';
import { naira } from '@/lib/format';
import { Container } from '@/components/primitives/Container';
import { PageHeader } from '@/components/primitives/PageHeader';
import { SafeImg } from '@/components/primitives/SafeImg';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getContentSnapshot();
  const description =
    'Paid workshops and exhibitions from the Cra7ty Hub studio — fold with the people who fold for a living. Register and pay on the page; your ticket arrives by email.';
  return {
    title: 'Workshops',
    description,
    alternates: { canonical: '/workshops' },
    openGraph: {
      title: `Workshops — ${site.name}`,
      description,
      url: `${site.url}/workshops`,
      type: 'website',
    },
  };
}

/**
 * The events discovery page (Tier 6): every published, upcoming
 * workshop and exhibition, soonest first, straight from
 * get_upcoming_events (the anon RPC — the tables are deny-all). Seat
 * numbers are computed by the same counting rule the confirmation path
 * commits seats by, so "3 spots left" never disagrees with the payment
 * path by more than an in-flight checkout.
 *
 * Sold-out events stay LISTED (they are marketing for the next date)
 * but swap their card footer to the waitlist wording — the detail page
 * swaps the payment form for the request form at that point.
 */
export default async function WorkshopsPage() {
  const events = await getUpcomingEvents();

  return (
    <>
      <PageHeader
        id="workshops"
        index="01"
        title={['Workshops &', 'exhibitions']}
        lede={
          events.length > 0
            ? `${events.length} upcoming ${events.length === 1 ? 'date' : 'dates'}. Register and pay here; the ticket arrives by email.`
            : 'Fold with the people who fold for a living.'
        }
      />

      <Container width="wide" className="pb-20">
        {events.length === 0 ? (
          <div className="border border-ink-24 bg-paper px-6 py-14 text-center md:px-10">
            <p className="mono-label-xs text-vermilion">Nothing on the calendar</p>
            <p className="font-display mx-auto mt-3 max-w-[26rem] text-display-sm leading-tight text-ink">
              No dates are announced yet.
            </p>
            <p className="mx-auto mt-4 max-w-prose text-sm leading-relaxed text-ink-70 md:text-base">
              Workshops are folded into the calendar a few weeks at a time. The studio
              announces each one on WhatsApp and here — or{' '}
              <Link href="/#bulk" className="link-draw text-ink underline underline-offset-4">
                send a message
              </Link>{' '}
              to ask when the next one lands.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/workshops/${event.slug}`}
                  className="group flex h-full flex-col border border-ink-24 bg-paper transition-colors hover:border-ink"
                >
                  {event.imageUrl ? (
                    <SafeImg
                      src={event.imageUrl}
                      alt={event.name}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-kraft">
                      <span className="mono-label text-ink-40">
                        {event.kind === 'exhibition' ? 'Exhibition' : 'Workshop'}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="mono-label-xs text-ink-55">
                        {event.kind === 'exhibition' ? 'Exhibition' : 'Workshop'}
                      </p>
                      <p className="mono-label-xs text-ink-55">
                        {eventDay(event.startsAt)} · {eventTime(event.startsAt)}
                      </p>
                    </div>

                    <h2 className="font-display mt-3 text-display-sm leading-tight text-ink group-hover:text-vermilion">
                      {event.name}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-70">
                      {event.description}
                    </p>
                    <p className="mono-label-xs mt-3 text-ink-40">{event.location}</p>

                    <div className="mt-auto flex items-baseline justify-between gap-4 border-t border-ink-12 pt-4 mt-6 md:mt-auto">
                      <p className="font-display text-xl text-ink">
                        {event.price === 0 ? 'Free' : naira(event.price)}
                      </p>
                      {event.soldOut ? (
                        <p className="mono-label-xs text-vermilion">Full — waitlist open</p>
                      ) : event.spotsRemaining !== null ? (
                        <p className="mono-label-xs text-ink-55">
                          {event.spotsRemaining} {event.spotsRemaining === 1 ? 'spot' : 'spots'} left
                        </p>
                      ) : (
                        <p className="mono-label-xs text-ink-55">Unlimited seats</p>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
