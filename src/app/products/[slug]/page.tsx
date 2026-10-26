import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getProductBySlug,
  getProducts,
  getProductsByCategory,
} from '@/lib/catalog';
import { getContentSnapshot } from '@/lib/content';
import { naira } from '@/lib/format';
import { Container } from '@/components/primitives/Container';
import { Button } from '@/components/primitives/Button';
import { DogEarCard } from '@/components/primitives/DogEarCard';
import { ProductGallery } from '@/components/ProductGallery';
import { ProductMedia } from '@/components/ProductMedia';
import { ProductPurchase } from '@/components/ProductPurchase';
import { FoldDivider } from '@/components/primitives/FoldDivider';
import { ArrowRight } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { SectionOrderHost } from '@/components/edit/SectionOrderHost';

type Params = { params: { slug: string } };

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [product, { site }] = await Promise.all([
    getProductBySlug(params.slug),
    getContentSnapshot(),
  ]);
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
export default async function ProductPage({ params }: Params) {
  const [product, content] = await Promise.all([
    getProductBySlug(params.slug),
    getContentSnapshot(),
  ]);
  if (!product) notFound();

  const related = (await getProductsByCategory(product.category))
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
                <span className="mono-label-xs absolute left-6 top-6 z-10 border border-ink-24 px-2 py-1 text-ink-70">
                  {product.badge}
                </span>
              )}
              <ProductGallery name={product.name} images={product.images ?? []} />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 lg:col-start-9">
            <h1 className="font-display text-display-md leading-[0.95]">
              {product.name}
            </h1>

            {/* price row → description → variant picker → stock → add: one
                client state (selection) drives price, stock and the line
                that lands in the order. With no variants the picker and
                stock line never mount — markup matches the old server
                render exactly. */}
            <ProductPurchase product={product}>
              <p className="mt-6 text-base leading-relaxed text-ink-70">
                {product.description}
              </p>
            </ProductPurchase>

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
      ) : null,
  };

  const order = ['breadcrumb', 'buy', 'detail', 'specification', 'related'] as const;

  return (
    <SectionOrderHost
      slots={slots}
      order={order}
      published={content.pageSections.product}
    />
  );
}
