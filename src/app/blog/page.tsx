import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts, formatPostDate } from '@/data/posts';
import { blogPage, site } from '@/data/site';
import { pad } from '@/lib/format';
import { whatsappLink } from '@/lib/whatsapp';
import { Container } from '@/components/primitives/Container';
import { Button } from '@/components/primitives/Button';
import { Reveal } from '@/components/primitives/Reveal';
import { Marquee } from '@/components/primitives/Marquee';
import { ModelArt } from '@/components/three/fallbacks';
import { ArrowRight } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { SectionOrderHost } from '@/components/edit/SectionOrderHost';

export const metadata: Metadata = {
  title: blogPage.title.join(' '),
  description: blogPage.metaDescription,
  alternates: { canonical: '/blog' },
  openGraph: {
    title: `${blogPage.title.join(' ')} — ${site.name}`,
    description: blogPage.metaDescription,
    url: `${site.url}/blog`,
    type: 'website',
  },
};

const noteQuestion = `Hello Cra7ty Hub, I read a note on ${site.name} and have a question:`;

/**
 * The folio. In edit mode the four bands are hosted for selection/reorder/
 * hide (admin keys: header, lead, more, closing — the admin's `post`
 * template section only exists on /blog/[slug] and is filtered out here).
 * Post titles, excerpts and dates belong to the Posts manager, not the
 * content keys.
 */
export default function BlogPage() {
  const all = getAllPosts();
  const [lead, ...rest] = all;

  const slots = {
    header: (
      <Container width="wide" className="pb-10 pt-10 md:pb-16 md:pt-14">
        <div className="grid grid-cols-12 gap-x-6 gap-y-6">
          <div className="col-span-12 md:col-span-2">
            <p className="mono-label-xs text-ink-55">
              <Editable k="blog.header.index">{blogPage.index}</Editable>
            </p>
          </div>
          <div className="col-span-12 md:col-span-7 lg:col-span-6">
            <h1
              id="blog-title"
              className="text-display-md font-display leading-[0.94] tracking-[-0.02em]"
            >
              {blogPage.title.map((line, i) => (
                <span key={i} className="block">
                  <Editable k={`blog.header.title.${i}`}>{line}</Editable>
                </span>
              ))}
            </h1>
          </div>
          <div className="col-span-12 md:col-span-3 lg:col-span-3 lg:col-start-10 md:self-end">
            <p className="mono-label text-ink-70">
              <Editable k="blog.header.lede">{blogPage.lede}</Editable>
            </p>
          </div>
        </div>
      </Container>
    ),
    /* the lead note, set on the kraft band: title left, art and mono meta right */
    lead: lead ? (
      <section aria-labelledby="lead-note-title" className="relative bg-kraft py-section-y text-ink">
        <Container width="wide">
          <div className="grid grid-cols-12 items-end gap-x-6 gap-y-8">
            <div className="col-span-12 lg:col-span-6">
              <h2
                id="lead-note-title"
                className="font-display text-display-md leading-[0.94] tracking-[-0.02em]"
              >
                <Link href={`/blog/${lead.slug}`} className="link-draw">
                  {lead.title}
                </Link>
              </h2>
              <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-70">
                {lead.excerpt}
              </p>
              <Link
                href={`/blog/${lead.slug}`}
                className="mono-label-xs mt-7 inline-flex items-center gap-2"
              >
                <Editable k="blog.lead.read-link">{blogPage.readLink}</Editable>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="col-span-12 sm:col-span-5 lg:col-span-3 lg:col-start-8">
              <div className="aspect-[4/3] w-full lg:aspect-square">
                <ModelArt model={lead.model} className="h-full w-full" />
              </div>
            </div>

            <div className="col-span-12 sm:col-span-7 lg:col-span-2 lg:col-start-11">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-ink-24 pt-4 sm:grid-cols-3 lg:grid-cols-1 lg:border-t-0 lg:pt-0">
                <div>
                  <dt className="mono-label-xs text-ink-55">
                    <Editable k="blog.lead.label-published">
                      Published
                    </Editable>
                  </dt>
                  <dd className="mono-label-xs mt-1.5 text-ink tabular-nums">
                    {formatPostDate(lead.date)}
                  </dd>
                </div>
                <div>
                  <dt className="mono-label-xs text-ink-55">
                    <Editable k="blog.lead.label-reading">Reading</Editable>
                  </dt>
                  <dd className="mono-label-xs mt-1.5 text-ink tabular-nums">
                    {pad(lead.minutes)}{' '}
                    <Editable k="blog.lead.min-suffix">min</Editable>
                  </dd>
                </div>
                <div>
                  <dt className="mono-label-xs text-ink-55">
                    <Editable k="blog.lead.label-filed">Filed under</Editable>
                  </dt>
                  <dd className="mt-1.5">
                    <span className="mono-label-xs border border-ink-24 px-2 py-1 text-ink-70">
                      {lead.category}
                    </span>
                  </dd>
                </div>
                {lead.placeholder && (
                  <div>
                    <dt className="sr-only">Status</dt>
                    <dd>
                      <span className="mono-label-xs border border-ink-24 px-2 py-1 text-ink-40">
                        <Editable k="blog.lead.placeholder-chip">
                          Placeholder
                        </Editable>
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </Container>
      </section>
    ) : null,
    /* the rest of the folio: ruled rows, meta above the title on mobile */
    more: (
      <Container width="wide" className="py-section-y">
        <h2 className="mono-label-xs text-ink-55">
          <Editable k="blog.more.heading">{blogPage.moreLabel}</Editable>
        </h2>
        <ul className="mt-6 border-t border-ink-12">
          {rest.map((post, i) => (
            <Reveal as="li" key={post.slug} className="border-b border-ink-12">
              <Link href={`/blog/${post.slug}`} className="group block">
                <div className="grid grid-cols-12 items-baseline gap-x-6 gap-y-3 py-6 transition-transform duration-500 ease-paper group-hover:-translate-y-1 md:py-8">
                  <div className="col-span-12 flex flex-wrap items-baseline gap-x-4 gap-y-1 md:col-span-3">
                    <span className="mono-label-xs tabular-nums text-ink-40">
                      {pad(i + 2)}
                    </span>
                    <span className="mono-label-xs text-ink-40">
                      {formatPostDate(post.date)} · {pad(post.minutes)} min
                    </span>
                  </div>
                  <div className="col-span-12 md:col-span-7">
                    <h3 className="font-display text-display-sm leading-tight">
                      <span className="link-draw group-hover:after:origin-left group-hover:after:scale-x-100">
                        {post.title}
                      </span>
                    </h3>
                    <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-70">
                      {post.standfirst}
                    </p>
                  </div>
                  <div className="col-span-12 md:col-span-2 md:text-right">
                    <span className="mono-label-xs border border-ink-24 px-2 py-1 text-ink-70">
                      {post.category}
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>
      </Container>
    ),
    closing: (
      <>
        <Marquee listKey="blog.closing.marquee.words" />

        <Container width="default" className="py-16 text-center md:py-20">
          <p className="font-display text-display-sm">
            <Editable k="blog.closing.line">{blogPage.closing.line}</Editable>
          </p>
          <div className="mt-8 flex justify-center">
            <Button href={whatsappLink(noteQuestion)}>
              <Editable k="blog.closing.cta-label">
                {blogPage.closing.ctaLabel}
              </Editable>
              <ArrowRight size={14} />
            </Button>
          </div>
          <p className="mono-label-xs mt-4 text-ink-40">
            <Editable k="blog.closing.caption">
              {blogPage.closing.caption}
            </Editable>
          </p>
        </Container>
      </>
    ),
  };

  const order = ['header', 'lead', 'more', 'closing'] as const;

  return <SectionOrderHost slots={slots} order={order} />;
}
