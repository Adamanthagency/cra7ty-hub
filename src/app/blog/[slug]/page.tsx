import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug, getPosts, getProductById } from '@/lib/catalog';
import { getContentSnapshot } from '@/lib/content';
import { Body } from '@/lib/body-render';
import { formatPostDate } from '@/data/posts';
import { naira, pad } from '@/lib/format';
import { Container } from '@/components/primitives/Container';
import { DogEarCard } from '@/components/primitives/DogEarCard';
import { FoldDivider } from '@/components/primitives/FoldDivider';
import { MaskedLines } from '@/components/primitives/Reveal';
import { ProductMedia } from '@/components/ProductMedia';
import { ArrowRight } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import type { Product } from '@/lib/types';

type Params = { params: { slug: string } };

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [post, { site }] = await Promise.all([
    getPostBySlug(params.slug),
    getContentSnapshot(),
  ]);
  if (!post) return { title: 'Not found' };
  return {
    title: post.title,
    description: post.standfirst,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: `${post.title} — ${site.name}`,
      description: post.standfirst,
      url: `${site.url}/blog/${post.slug}`,
      type: 'article',
    },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const [post, content, posts] = await Promise.all([
    getPostBySlug(params.slug),
    getContentSnapshot(),
    getPosts(),
  ]);
  if (!post) notFound();
  const { blogPage } = content;

  const related = (
    await Promise.all(post.relatedProductIds.map((id) => getProductById(id)))
  ).filter((product): product is Product => Boolean(product));
  const more = posts.filter((item) => item.slug !== post.slug).slice(0, 2);

  return (
    <>
      <Container width="wide" className="pb-8 pt-6 md:pt-10">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="mono-label-xs text-ink-55 hover:text-ink">
                <Editable k="blog.post.breadcrumb-home">Home</Editable>
              </Link>
            </li>
            <li aria-hidden="true" className="mono-label-xs text-ink-24">
              /
            </li>
            <li>
              <Link href="/blog" className="mono-label-xs text-ink-55 hover:text-ink">
                {blogPage.title.join(' ')}
              </Link>
            </li>
            <li aria-hidden="true" className="mono-label-xs text-ink-24">
              /
            </li>
            <li className="mono-label-xs text-ink">{post.category}</li>
          </ol>
        </nav>
      </Container>

      <Container width="narrow" className="pb-14">
        <p className="mono-label-xs text-ink-55">{post.category}</p>

        <h1 className="mt-5 font-display text-display-md leading-[0.96] tracking-[-0.02em]">
          <MaskedLines lines={post.titleLines} lineClassName="[line-height:0.98]" />
        </h1>

        <p className="mt-6 text-base leading-relaxed text-ink-70 md:text-lg">
          {post.standfirst}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3 border-y border-ink-12 py-4">
          <span className="mono-label-xs text-ink-55 tabular-nums">
            {formatPostDate(post.date)}
          </span>
          <span aria-hidden="true" className="text-ink-24">
            ·
          </span>
          <span className="mono-label-xs text-ink-40 tabular-nums">
            {pad(post.minutes)}{' '}
            <Editable k="blog.post.min-read-suffix">min read</Editable>
          </span>
          {post.placeholder && (
            <span className="mono-label-xs ml-auto border border-ink-24 px-2 py-1 text-ink-40">
              <Editable k="blog.post.placeholder-chip">
                Placeholder
              </Editable>
            </span>
          )}
        </div>

        <Body blocks={post.body} />
      </Container>

      <FoldDivider />

      {related.length > 0 && (
        <Container width="wide" className="pb-4">
          <h2 className="mono-label text-ink-55">
            <Editable k="blog.post.related-label">
              {blogPage.relatedLabel}
            </Editable>
          </h2>
          <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={item.id}>
                <DogEarCard size="sm">
                  <Link href={`/products/${item.slug}`} className="block">
                    <div className="relative h-44 bg-kraft-30">
                      <ProductMedia
                        images={item.images ?? []}
                        name={item.name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex items-baseline justify-between gap-3 p-4">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="mono-label-xs tabular-nums">
                        {naira(item.price)}
                      </span>
                    </div>
                  </Link>
                </DogEarCard>
              </li>
            ))}
          </ul>
        </Container>
      )}

      <Container width="wide" className="pb-section-y pt-14 md:pt-20">
        <div className="flex items-baseline justify-between gap-6 border-b border-ink-12 pb-4">
          <h2 className="font-display text-display-sm">{blogPage.moreLabel}</h2>
          <Link href="/blog" className="mono-label-xs inline-flex items-center gap-2">
            <Editable k="blog.post.all-notes-label">
              {blogPage.allNotesLabel}
            </Editable>
            <ArrowRight size={13} />
          </Link>
        </div>

        <ul className="mt-2">
          {more.map((item, i) => (
            <li key={item.slug} className="border-b border-ink-12">
              <Link href={`/blog/${item.slug}`} className="group block">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-5 transition-transform duration-500 ease-paper group-hover:-translate-y-1">
                  <div className="flex items-baseline gap-4">
                    <span className="mono-label-xs tabular-nums text-ink-40">
                      {pad(i + 1)}
                    </span>
                    <span className="font-display text-xl leading-snug md:text-2xl">
                      <span className="link-draw group-hover:after:origin-left group-hover:after:scale-x-100">
                        {item.title}
                      </span>
                    </span>
                  </div>
                  <span className="mono-label-xs text-ink-40">
                    {formatPostDate(item.date)} · {item.category}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
