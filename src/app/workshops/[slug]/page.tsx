import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContentSnapshot } from '@/lib/content';
import { getUpcomingEventBySlug } from '@/lib/events';
import { eventWhen } from '@/lib/event-format';
import { naira } from '@/lib/format';
import { Container } from '@/components/primitives/Container';
import { SafeImg } from '@/components/primitives/SafeImg';
import { EventRegisterForm } from '@/components/EventRegisterForm';
import { EventWaitlistForm } from '@/components/EventWaitlistForm';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const [event, { site }] = await Promise.all([
    getUpcomingEventBySlug(params.slug),
    getContentSnapshot(),
  ]);
  if (!event) return { title: 'Workshops' };
  const description = `${event.name} — ${eventWhen(event.startsAt)} at ${event.location}. ${event.price === 0 ? 'Free entry — reserve a spot.' : `Entry ${naira(event.price)}, paid on Paystack.`}`;
  return {
    title: `${event.name} — Workshops`,
    description,
    alternates: { canonical: `/workshops/${event.slug}` },
    openGraph: {
      title: `${event.name} — ${site.name}`,
      description,
      url: `${site.url}/workshops/${event.slug}`,
      // Next 14's OpenGraph union has no 'event' member — 'website' is
      // the honest fallback (the event structured data would be a
      // separate schema.org script, out of scope for Tier 6).
      type: 'website',
    },
  };
}

/**
 * One event (Tier 6): the details plus either the registration form or
 * — when the event is capped and full — the waitlist request form.
 * Never both: the server decides from sold_out, and the register API
 * refuses with event_full anyway if a seat vanished mid-page-render
 * (the form then flips to the waitlist wording from that error).
 */
export default async function EventPage({ params }: { params: { slug: string } }) {
  const event = await getUpcomingEventBySlug(params.slug);
  if (!event) notFound();

  return (
    <>
      <Container width="wide" className="pb-10 pt-10 md:pb-14 md:pt-14">
        <p className="mono-label-xs text-ink-55">
          <Link href="/workshops" className="link-draw hover:text-ink">
            Workshops
          </Link>
          <span aria-hidden="true" className="mx-2 text-ink-24">
            /
          </span>
          {event.kind === 'exhibition' ? 'Exhibition' : 'Workshop'}
        </p>
      </Container>

      <Container width="wide" className="pb-20">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10">
          <div className="col-span-12 lg:col-span-7">
            <h1
              id="event-title"
              className="font-display text-display-md leading-[0.94] tracking-[-0.02em] text-ink"
            >
              {event.name}
            </h1>

            <dl className="mt-8 border-t border-ink-12">
              <div className="flex items-baseline gap-6 border-b border-ink-12 py-3">
                <dt className="mono-label-xs w-24 shrink-0 text-ink-40">When</dt>
                <dd className="text-sm text-ink md:text-base">{eventWhen(event.startsAt)}</dd>
              </div>
              <div className="flex items-baseline gap-6 border-b border-ink-12 py-3">
                <dt className="mono-label-xs w-24 shrink-0 text-ink-40">Where</dt>
                <dd className="text-sm text-ink md:text-base">{event.location}</dd>
              </div>
              <div className="flex items-baseline gap-6 border-b border-ink-12 py-3">
                <dt className="mono-label-xs w-24 shrink-0 text-ink-40">Entry</dt>
                <dd className="text-sm text-ink md:text-base">
                  {event.price === 0
                    ? 'Free — reserve a spot below'
                    : `${naira(event.price)} per person`}
                </dd>
              </div>
              <div className="flex items-baseline gap-6 border-b border-ink-12 py-3">
                <dt className="mono-label-xs w-24 shrink-0 text-ink-40">Seats</dt>
                <dd className="text-sm text-ink md:text-base">
                  {event.soldOut
                    ? 'Full'
                    : event.spotsRemaining !== null
                      ? `${event.spotsRemaining} of ${event.capacity} left`
                      : 'No cap — everyone who registers gets a seat'}
                </dd>
              </div>
            </dl>

            {event.imageUrl && (
              <SafeImg
                src={event.imageUrl}
                alt={event.name}
                className="mt-8 aspect-[4/3] w-full border border-ink-24 object-cover"
              />
            )}

            {event.description && (
              <div className="mt-8 max-w-prose space-y-4 text-sm leading-relaxed text-ink-70 md:text-base">
                {event.description.split('\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-12 lg:col-span-5">
            <div className="dogear border border-ink-24 bg-paper p-6 md:p-8 lg:sticky lg:top-24">
              {event.soldOut ? (
                <EventWaitlistForm eventId={event.id} />
              ) : (
                <EventRegisterForm
                  eventId={event.id}
                  eventName={event.name}
                  priceNaira={event.price}
                />
              )}
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}
