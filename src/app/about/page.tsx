import type { Metadata } from 'next';
import { getContentSnapshot } from '@/lib/content';
import { getProducts } from '@/lib/catalog';
import { naira } from '@/lib/format';
import { whatsappLink } from '@/lib/whatsapp';
import { Container } from '@/components/primitives/Container';
import { Section } from '@/components/primitives/Section';
import { Button } from '@/components/primitives/Button';
import { Marquee } from '@/components/primitives/Marquee';
import { AboutHero } from '@/components/sections/AboutHero';
import {
  AboutClosingActions,
  AboutFacts,
  AboutNumbers,
  AboutStations,
} from '@/components/sections/AboutDetails';
import { WhyPaper } from '@/components/sections/WhyPaper';
import { ArrowRight } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { SectionOrderHost } from '@/components/edit/SectionOrderHost';
import type { SiteContent } from '@/lib/site-content';

export async function generateMetadata(): Promise<Metadata> {
  const { aboutPage, site } = await getContentSnapshot();
  return {
    title: 'About',
    description: aboutPage.metaDescription,
    alternates: { canonical: '/about' },
    openGraph: {
      title: `About — ${site.name}`,
      description: aboutPage.metaDescription,
      url: `${site.url}/about`,
      type: 'website',
    },
  };
}

/** Every value computed from the snapshot, none typed into the page. */
function buildNumbers(content: SiteContent, productCount: number) {
  const turnaround = content.hero.stats.find((stat) =>
    stat.label.includes('turnaround'),
  );
  return [
    { label: 'Studio founded', value: String(content.site.foundedYear) },
    { label: 'Products in the shop', value: String(productCount) },
    { label: 'Free Lagos delivery over', value: naira(content.site.freeDeliveryOver) },
    ...(turnaround
      ? [{ label: 'Lagos turnaround', value: turnaround.value }]
      : []),
  ];
}

/**
 * The studio page. In edit mode the six bands are hosted for selection/
 * reorder/hide (admin keys: hero, sheet, numbers, why — shared with Home —
 * facts, closing). List-driven blocks live in AboutDetails (client) so
 * `set-list` can reach them.
 */
export default async function AboutPage() {
  const [content, products] = await Promise.all([getContentSnapshot(), getProducts()]);
  const { aboutPage, site } = content;
  const numbers = buildNumbers(content, products.length);

  const studioQuestion = `Hello Cra7ty Hub, I would like to ask the studio a question.`;

  const slots = {
    hero: (
      <>
        <AboutHero />
        <Marquee listKey="about.hero.marquee.words" />
      </>
    ),
    sheet: (
      <Section
        id="sheet"
        index={aboutPage.sheet.index}
        title={aboutPage.sheet.title}
        lede={aboutPage.sheet.lede}
        containerWidth="wide"
        contentKeys={{
          index: 'about.sheet.index',
          title: 'about.sheet.title',
          lede: 'about.sheet.lede',
        }}
      >
        <AboutStations />
      </Section>
    ),
    numbers: (
      /* numbers strip on kraft: all four computed from data */
      <section aria-labelledby="numbers-title" className="bg-kraft py-section-y text-ink">
        <Container width="wide">
          <div className="flex items-baseline justify-between gap-6 border-b border-ink-24 pb-4">
            <p className="mono-label-xs text-ink-55">
              <Editable k="about.numbers.index">{aboutPage.numbersIndex}</Editable>
            </p>
            <h2 id="numbers-title" className="mono-label text-ink-55">
              <Editable k="about.numbers.title">{aboutPage.numbersTitle}</Editable>
            </h2>
          </div>
          <AboutNumbers values={numbers.map((number) => number.value)} />
        </Container>
      </section>
    ),
    why: <WhyPaper />,
    facts: (
      <Section
        id="facts"
        index={aboutPage.facts.index}
        title={aboutPage.facts.title}
        lede={aboutPage.facts.lede}
        containerWidth="wide"
        contentKeys={{
          index: 'about.facts.index',
          title: 'about.facts.title',
          lede: 'about.facts.lede',
        }}
      >
        <Container width="wide">
          <div className="grid grid-cols-12 gap-x-6 gap-y-10">
            <div className="col-span-12 md:col-span-7">
              <AboutFacts />
            </div>

            <div className="col-span-12 md:col-span-4 md:col-start-9">
              <div className="dogear border border-ink-24 bg-paper p-7">
                <p className="mono-label-xs text-vermilion">
                  <Editable k="about.facts.card-label">
                    {aboutPage.facts.card.label}
                  </Editable>
                </p>
                <h3 className="mt-4 font-display text-3xl leading-tight">
                  <Editable k="about.facts.card-title">
                    {aboutPage.facts.card.title}
                  </Editable>
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-ink-70">
                  <Editable k="about.facts.card-body">
                    {aboutPage.facts.card.body}
                  </Editable>
                </p>
                <Button className="mt-6 w-full" href={whatsappLink(studioQuestion, site.whatsappNumber)}>
                  <Editable k="about.facts.card-cta">
                    {aboutPage.facts.card.cta}
                  </Editable>
                  <ArrowRight size={14} />
                </Button>
                <p className="mono-label-xs mt-4 text-ink-40">
                  <Editable k="about.facts.card-caption">
                    {site.whatsappDisplay} · Replies same day
                  </Editable>
                </p>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    ),
    /* the door: moss band, two ways onward */
    closing: (
      <Section
        id="closing"
        title={aboutPage.closing.title}
        tone="moss"
        containerWidth="default"
        contentKeys={{ title: 'about.closing.title' }}
      >
        <Container width="default">
          <AboutClosingActions />
        </Container>
      </Section>
    ),
  };

  const order = ['hero', 'sheet', 'numbers', 'why', 'facts', 'closing'] as const;

  return (
    <SectionOrderHost
      slots={slots}
      order={order}
      published={content.pageSections.about}
    />
  );
}
