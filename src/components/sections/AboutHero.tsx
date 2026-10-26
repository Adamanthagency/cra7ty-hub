'use client';

import { useState } from 'react';
import { useSiteContent } from '@/components/site-content-provider';
import { Container } from '@/components/primitives/Container';
import { MaskedLines } from '@/components/primitives/Reveal';
import { CraneArt } from '@/components/three/fallbacks';
import { SafeImg } from '@/components/primitives/SafeImg';
import { Editable } from '@/components/edit/Editable';
import { useEditField, useSectionVariant } from '@/lib/edit/use-edit';

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

/**
 * The studio's page opens the way the home page opens — same grid, same
 * masked headline — but the art is the drawn crane, so this page never
 * mounts a canvas.
 *
 * Edit mode mirrors Hero: the headline lines are `managed` Editables whose
 * parent re-splits them on the CURRENT emphasis word, so typing never
 * replays the mask.
 */
export function AboutHero() {
  const { aboutPage } = useSiteContent();

  const line0 = text(
    useEditField('about.hero.headline.0'),
    aboutPage.hero.headline[0],
  );
  const line1 = text(
    useEditField('about.hero.headline.1'),
    aboutPage.hero.headline[1],
  );
  const emphasis = text(
    useEditField('about.hero.emphasis-word'),
    aboutPage.hero.emphasisWord,
  );

  const lines = [line0, line1];

  // Admin-chosen About hero photo (about.hero.art-image): empty = the drawn
  // crane; a dead URL after SafeImg's retries falls back to the art.
  const artOverride = useEditField('about.hero.art-image');
  const artImage = String(artOverride ?? aboutPage.hero.artImage ?? '');
  const [deadArt, setDeadArt] = useState<string | null>(null);
  const showPhoto = artImage !== '' && deadArt !== artImage;

  // Layout variant: 'split' (shipped 7/5) or 'stacked' (headline full
  // width, art below). Else-path = today's markup.
  const variant = useSectionVariant('about', 'hero', 'split');
  const stacked = variant === 'stacked';

  return (
    <section aria-labelledby="about-hero-title" className="relative">
      <Container className="pb-12 pt-8 md:pb-16 md:pt-14">
        <div className="grid grid-cols-12 items-end gap-x-6 gap-y-10">
          <div className={stacked ? 'col-span-12' : 'col-span-12 lg:col-span-7'}>
            <p className="mono-label-xs text-ink-55">
              <Editable k="about.hero.eyebrow">{aboutPage.hero.eyebrow}</Editable>
            </p>

            <h1
              id="about-hero-title"
              className="mt-6 font-display text-display-xl font-normal text-ink"
            >
              <MaskedLines
                lines={lines}
                delay={0.15}
                lineClassName="[line-height:0.88]"
                render={(line, i) => (
                  <Editable k={`about.hero.headline.${i}`} managed>
                    {lineWithEmphasis(line, emphasis)}
                  </Editable>
                )}
              />
            </h1>

            <p className="mt-8 max-w-column text-base leading-relaxed text-ink-70 md:text-lg">
              <Editable k="about.hero.subline">{aboutPage.hero.subline}</Editable>
            </p>
          </div>

          <div className={stacked ? 'col-span-12' : 'col-span-12 lg:col-span-5'}>
            <div className="relative">
              <div
                className={
                  stacked
                    ? 'relative h-[17rem] sm:h-[21rem] lg:h-[26rem]'
                    : 'relative h-[17rem] sm:h-[21rem] lg:h-[30rem]'
                }
              >
                {showPhoto ? (
                  <SafeImg
                    src={artImage}
                    alt=""
                    onDead={() => setDeadArt(artImage)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <CraneArt
                    className="h-full w-full"
                    label="A folded paper origami crane"
                  />
                )}
              </div>
              <p className="mono-label-xs mt-1 flex items-center justify-between gap-3 border-t border-ink-12 pt-3 text-ink-40">
                {/* spans stay OUTSIDE the Editables: they are the flex
                    children here, and Editable renders a bare text node on
                    a normal visit */}
                <span>
                  <Editable k="about.hero.art-caption">
                    {aboutPage.hero.artCaption}
                  </Editable>
                </span>
                <span>
                  <Editable k="about.hero.art-note">
                    {aboutPage.hero.artNote}
                  </Editable>
                </span>
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
