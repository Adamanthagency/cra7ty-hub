import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductBySlug, getProductsByCategory, products } from '@/data/products';
import { site } from '@/data/site';
import { naira } from '@/lib/format';
import { Container } from '@/components/primitives/Container';
import { Button } from '@/components/primitives/Button';
import { DogEarCard } from '@/components/primitives/DogEarCard';
import { ProductViewer } from '@/components/three/ProductViewer';
import { ModelArt } from '@/components/three/fallbacks';
import { AddToOrderButton } from '@/components/AddToOrderButton';
import { FoldDivider } from '@/components/primitives/FoldDivider';
import { ArrowRight } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { SectionOrderHost } from '@/components/edit/SectionOrderHost';

type Params = { params: { slug: string } };

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const product = getProductBySlug(params.slug);
  if (!product) return { title: 'Not found' };
  return {
    title: product.name,
    description: `${product.description} ${naira(product.price)} — ${product.packCount}. Handfolded in Lagos, delivered across Nigeria.`,
    alternates: { canonical: `/products/${params.slug}` },
    openGraph: {
      title: `${product.name} — ${site.name}`,
      description: product.description,
      url: `${site.url}/products/${params.slug}`,
      type: 'website',
    },
  };
}

/**
 * The product template. In edit mode the five bands are hosted for
 * selection/reorder/hide (admin keys: buy, detail, specification,
 * related, breadcrumb). Product names, prices, specs and body copy come
 * from the Products manager, not the content keys.
 */
export default function ProductPage({ params }: Params) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  const related = getProductsByCategory(product.category)
    .filter((p) => p.id !== product.id)
    .slice(0, 3);

  const slots = {
    breadcrumb: (
      <Container width="wide" className="pb-8 pt-6 md:pt-10">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="mono-label-xs text-ink-55 hover:text-ink">
                <Editable k="product.breadcrumb.home-label">Home</Editable>
              </Link>
            </li>
            <li aria-hidden="true" className="mono-label-xs text-ink-24">
              /
            </li>
            <li>
              <Link href="/#categories" className="mono-label-xs text-ink-55 hover:text-ink">
                {product.category}
              </Link>
            </li>
            <li aria-hidden="true" className="mono-label-xs text-ink-24">
              /
            </li>
            <li className="mono-label-xs text-ink">{product.name}</li>
          </ol>
        </nav>
      </Container>
    ),
    buy: (
      <Container width="wide">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10">
          <div className="col-span-12 lg:col-span-7">
            <div className="dogear relative aspect-[4/3] bg-kraft-30 px-10 py-12">
              {product.badge && (
                <span className="mono-label-xs absolute left-6 top-6 border border-ink-24 px-2 py-1 text-ink-70">
                  {product.badge}
                </span>
              )}
              <ProductViewer
                model={product.model}
                className="h-full w-full"
                label={`${product.name} — ${product.description}`}
              />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 lg:col-start-9">
            <h1 className="font-display text-display-md leading-[0.95]">
              {product.name}
            </h1>

            <div className="mt-5 flex items-baseline gap-3 border-y border-ink-12 py-4">
              <span className="mono-label text-2xl tabular-nums">{naira(product.price)}</span>
              <span className="mono-label-xs text-ink-40">{product.packCount}</span>
            </div>

            <p className="mt-6 text-base leading-relaxed text-ink-70">
              {product.description}
            </p>

            <div className="mt-7">
              <AddToOrderButton
                product={product}
                className="w-full"
                label="Add to order"
                editableLabel
              />
              <p className="mono-label-xs mt-3 text-ink-40">
                <Editable k="product.buy.whatsapp-note">
                  Nothing is charged here. The order arrives on WhatsApp for
                  confirmation.
                </Editable>
              </p>
            </div>

            <div className="mt-8 border-t border-ink-12 pt-5">
              <Button
                variant="secondary"
                href="/#bulk"
                className="w-full"
              >
                <Editable k="product.buy.bulk-cta">
                  Ask about bulk pricing
                </Editable>
                <ArrowRight size={13} />
              </Button>
            </div>
          </div>
        </div>
      </Container>
    ),
    detail: (
      <>
        <FoldDivider />
        <Container width="wide">
          <div className="grid grid-cols-12 gap-x-6 gap-y-10">
            <div className="col-span-12 md:col-span-7 md:col-start-1">
              <h2 className="mono-label text-ink-55">
                <Editable k="product.detail.heading">The detail</Editable>
              </h2>
              <div className="mt-6 space-y-5">
                {product.detail.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 24)}
                    className="max-w-prose text-base leading-relaxed text-ink-70"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </>
    ),
    specification: (
      <Container width="wide">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10">
          <div className="col-span-12 md:col-span-4 md:col-start-9">
            <h2 className="mono-label text-ink-55">
              <Editable k="product.specification.heading">
                Specification
              </Editable>
            </h2>
            <dl className="mt-6 border-t border-ink-12">
              {product.specs.map((spec) => (
                <div
                  key={spec.label}
                  className="flex items-baseline justify-between gap-4 border-b border-ink-12 py-3"
                >
                  <dt className="mono-label-xs text-ink-55">{spec.label}</dt>
                  <dd className="mono-label-xs text-right tabular-nums">{spec.value}</dd>
                </div>
              ))}
              {product.size && (
                <div className="flex items-baseline justify-between gap-4 border-b border-ink-12 py-3">
                  <dt className="mono-label-xs text-ink-55">
                    <Editable k="product.specification.size-label">
                      Size
                    </Editable>
                  </dt>
                  <dd className="mono-label-xs text-right tabular-nums">{product.size}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </Container>
    ),
    related:
      related.length > 0 ? (
        <Container width="wide" className="pb-section-y pt-16 md:pt-24">
          <div className="flex items-baseline justify-between gap-6 border-b border-ink-12 pb-4">
            <h2 className="font-display text-display-sm">
              <Editable k="product.related.heading">More like this</Editable>
            </h2>
            <Link
              href="/#categories"
              className="mono-label-xs inline-flex items-center gap-2"
            >
              <Editable k="product.related.all-link">
                All categories
              </Editable>
              <ArrowRight size={13} />
            </Link>
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={item.id}>
                <DogEarCard size="sm">
                  <Link href={`/products/${item.slug}`} className="block">
                    <div className="h-44 bg-kraft-30 px-8 py-6">
                      <ModelArt model={item.model} className="h-full w-full" />
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
      ) : null,
  };

  const order = ['breadcrumb', 'buy', 'detail', 'specification', 'related'] as const;

  return <SectionOrderHost slots={slots} order={order} />;
}
