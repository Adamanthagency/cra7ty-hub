'use client';

import { useState } from 'react';
import { useSiteContent } from '@/components/site-content-provider';
import { Container } from '@/components/primitives/Container';
import { Button } from '@/components/primitives/Button';
import { Marquee } from '@/components/primitives/Marquee';
import { MaskedLines } from '@/components/primitives/Reveal';
import { CraneHero } from '@/components/three/CraneHero';
import { HeroSlideshow } from '@/components/HeroSlideshow';
import { SafeImg } from '@/components/primitives/SafeImg';
import { ArrowRight } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { interpolateTokens } from '@/lib/edit/keys';
import { useEditField, useEditList, useSectionVariant } from '@/lib/edit/use-edit';

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
  const { hero, site } = useSiteContent();

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

  // Admin-chosen hero photo (content key home.hero.art-image): empty = the
  // procedural crane art. Edit mode reads the live set-field override. A URL
  // that dies after SafeImg's retries falls back to the art too, so a bad
  // upload never leaves a hole where the art was.
  const artOverride = useEditField('home.hero.art-image');
  const artImage = String(artOverride ?? hero.artImage ?? '');
  const [deadArt, setDeadArt] = useState<string | null>(null);
  const showPhoto = artImage !== '' && deadArt !== artImage;

  // Admin-managed hero slideshow (content list `home.hero.slideshow`,
  // max 10): the admin's images in the admin's own order, uploaded and
  // sequenced from the Hero section editor. Priority is slideshow →
  // single art-image → procedural crane, so an empty list keeps the art
  // exactly as it is today. A URL that dies after SafeImg's retries drops
  // out of the rotation; if every slide dies the hero falls back the same
  // way it falls back from a dead single photo.
  const slideshowOverride = useEditList('home.hero.slideshow');
  const [deadSlides, setDeadSlides] = useState<string[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = (
    slideshowOverride
      ? slideshowOverride.map((item) => ({
          src: String(item.fields.image ?? '').trim(),
          caption: String(item.fields.caption ?? '').trim(),
        }))
      : hero.slideshow
  )
    .filter((slide) => slide.src !== '' && !deadSlides.includes(slide.src))
    .slice(0, 10);
  const showSlideshow = slides.length > 0;
  const dropSlide = (src: string) =>
    setDeadSlides((current) =>
      current.includes(src) ? current : [...current, src],
    );

  // Layout variant (admin chips → page_sections.variant): 'split' is the
  // shipped 7/5 grid; 'stacked' sets the headline full-width with the art
  // below it. The else-path is today's markup, untouched.
  const variant = useSectionVariant('home', 'hero', 'split');
  const stacked = variant === 'stacked';

  const lines = [line0, line1];

  return (
    <section id="top" aria-labelledby="hero-title" className="relative">
      <Container className="pb-12 pt-8 md:pb-16 md:pt-14">
        <div className="grid grid-cols-12 items-end gap-x-6 gap-y-10">
          <div className={stacked ? 'col-span-12' : 'col-span-12 lg:col-span-7'}>
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

          <div className={stacked ? 'col-span-12' : 'col-span-12 lg:col-span-5'}>
            <div className="relative">
              {/* The whole art region is ONE admin key: the hero slideshow
                  list. Clicking it in the visual editor opens the same
                  ListEditor the workbench shows — including when the list
                  is empty and the procedural crane is what's on screen
                  (that is exactly when the admin needs to add slides).
                  `block` keeps the edit-mode hover/outline around the whole
                  box instead of a degenerate inline line. */}
              <Editable k="home.hero.slideshow" managed className="block">
                <div
                  className={
                    stacked
                      ? 'relative h-[17rem] sm:h-[21rem] lg:h-[26rem]'
                      : 'relative h-[17rem] sm:h-[21rem] lg:h-[30rem]'
                  }
                >
                  {showSlideshow ? (
                    <HeroSlideshow
                      slides={slides}
                      onDead={dropSlide}
                      onIndexChange={setSlideIndex}
                    />
                  ) : showPhoto ? (
                    <SafeImg
                      src={artImage}
                      alt=""
                      onDead={() => setDeadArt(artImage)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <CraneHero className="h-full w-full" />
                  )}
                </div>
              </Editable>
              <p className="mono-label-xs mt-1 flex items-center justify-between gap-3 border-t border-ink-12 pt-3 text-ink-40">
                {showSlideshow ? (
                  <>
                    <span className="tabular-nums">
                      {String(slideIndex + 1).padStart(2, '0')} /{' '}
                      {String(slides.length).padStart(2, '0')}
                    </span>
                    <span className="truncate text-right">
                      {slides[slideIndex]?.caption ?? ''}
                    </span>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
