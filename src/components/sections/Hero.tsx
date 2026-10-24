'use client';

import { hero } from '@/data/site';
import { site } from '@/data/site';
import { Container } from '@/components/primitives/Container';
import { Button } from '@/components/primitives/Button';
import { Marquee } from '@/components/primitives/Marquee';
import { MaskedLines } from '@/components/primitives/Reveal';
import { CraneHero } from '@/components/three/CraneHero';
import { ArrowRight } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { interpolateTokens } from '@/lib/edit/keys';
import { useEditField, useEditList } from '@/lib/edit/use-edit';

/** Puts the one emphasised word of a headline line into Instrument Serif italic. */
function lineWithEmphasis(line: string, word: string) {
  if (!line.includes(word)) return line;
  const [before, after] = line.split(word);
  return (
    <>
      {before}
      <em className="italic">{word}</em>
      {after}
    </>
  );
}

const text = (value: string | number | null, fallback: string) =>
  value === null ? fallback : String(value);

export function Hero({ total }: { total?: number }) {
  // Structure-level overrides live HERE, not inside Editable:
  // - the headline re-splits on the CURRENT emphasis word on every
  //   set-field (the per-line Editables are `managed` so their children —
  //   including the <em> — stay parent-rendered and typing never replays
  //   MaskedLines);
  // - CTA hrefs are attributes, which Editable cannot wrap.
  const line0 = text(useEditField('home.hero.headline.0'), hero.headline[0]);
  const line1 = text(useEditField('home.hero.headline.1'), hero.headline[1]);
  const emphasis = text(
    useEditField('home.hero.emphasis-word'),
    hero.emphasisWord,
  );
  const primaryHref = text(
    useEditField('home.hero.primary-cta.href'),
    hero.primaryCta.href,
  );
  const secondaryHref = text(
    useEditField('home.hero.secondary-cta.href'),
    hero.secondaryCta.href,
  );

  const statsOverride = useEditList('home.hero.stats');
  const stats = statsOverride
    ? statsOverride.map((item) => ({
        value: interpolateTokens(String(item.fields.value ?? ''), { total }),
        label: String(item.fields.label ?? ''),
      }))
    : hero.stats;

  const lines = [line0, line1];

  return (
    <section id="top" aria-labelledby="hero-title" className="relative">
      <Container className="pb-12 pt-8 md:pb-16 md:pt-14">
        <div className="grid grid-cols-12 items-end gap-x-6 gap-y-10">
          <div className="col-span-12 lg:col-span-7">
            <p className="mono-label-xs text-ink-55">
              <Editable k="home.hero.eyebrow">{hero.eyebrow}</Editable>
            </p>

            <h1
              id="hero-title"
              className="mt-6 font-display text-display-xl font-normal text-ink"
            >
              <MaskedLines
                lines={lines}
                delay={0.15}
                lineClassName="[line-height:0.88]"
                render={(line, i) => (
                  <Editable k={`home.hero.headline.${i}`} managed>
                    {lineWithEmphasis(line, emphasis)}
                  </Editable>
                )}
              />
            </h1>

            <p className="mt-8 max-w-column text-base leading-relaxed text-ink-70 md:text-lg">
              <Editable k="home.hero.subline">{hero.subline}</Editable>
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button href={primaryHref}>
                <Editable k="home.hero.primary-cta.label">
                  {hero.primaryCta.label}
                </Editable>
                <ArrowRight size={14} />
              </Button>
              <Button href={secondaryHref} variant="secondary">
                <Editable k="home.hero.secondary-cta.label">
                  {hero.secondaryCta.label}
                </Editable>
              </Button>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5">
            <div className="relative">
              <div className="relative h-[17rem] sm:h-[21rem] lg:h-[30rem]">
                <CraneHero className="h-full w-full" />
              </div>
              <p className="mono-label-xs mt-1 flex items-center justify-between gap-3 border-t border-ink-12 pt-3 text-ink-40">
                <span>
                  <Editable k="home.hero.art-caption-left">
                    Hover, then scroll
                  </Editable>
                </span>
                <span>
                  <Editable k="home.hero.art-caption-right">
                    Procedural · no files
                  </Editable>
                </span>
              </p>
            </div>
          </div>
        </div>

        <dl className="mt-12 grid grid-cols-1 border-t border-ink-12 sm:grid-cols-3 md:mt-16">
          {stats.map((stat, i) => (
            <div
              key={i}
              className={`flex flex-col-reverse gap-1.5 py-5 ${
                i > 0
                  ? 'border-t border-ink-12 sm:border-l sm:border-t-0 sm:pl-6'
                  : ''
              }`}
            >
              <dt className="mono-label-xs text-ink-55">
                <Editable k={`home.hero.stats.${i}.label`}>{stat.label}</Editable>
              </dt>
              <dd className="font-display text-4xl leading-none tabular-nums">
                <Editable k={`home.hero.stats.${i}.value`}>{stat.value}</Editable>
              </dd>
            </div>
          ))}
        </dl>
      </Container>

      <Marquee listKey="home.hero.marquee.words" total={total} />

      <p className="sr-only">
        {site.name}, {site.tagline} Based in {site.city}.
      </p>
    </section>
  );
}
