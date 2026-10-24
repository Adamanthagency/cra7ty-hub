import type { Metadata } from 'next';
import { Suspense } from 'react';
import { shopPage, site } from '@/data/site';
import { PageHeader } from '@/components/primitives/PageHeader';
import { Container } from '@/components/primitives/Container';
import { ShopShelf } from '@/components/sections/ShopShelf';
import { BulkBand } from '@/components/sections/BulkBand';
import { getCategories, getProducts } from '@/lib/catalog';
import { SectionOrderHost } from '@/components/edit/SectionOrderHost';

export const metadata: Metadata = {
  title: 'Shop',
  description: shopPage.metaDescription,
  alternates: { canonical: '/shop' },
  openGraph: {
    title: `${shopPage.title.join(' ')} — ${site.name}`,
    description: shopPage.metaDescription,
    url: `${site.url}/shop`,
    type: 'website',
  },
};

/**
 * The whole shelf. The header and the bulk band are server-rendered; the
 * filtering grid is one small client island, wrapped in Suspense so the
 * route stays safely static. In edit mode the three sections are hosted
 * for selection/reorder/hide (admin keys: header, shelf, bulk — bulk is
 * shared with Home).
 */
export default async function ShopPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  const slots = {
    header: (
      <PageHeader
        id="shop"
        index={shopPage.index}
        title={shopPage.title}
        lede={shopPage.lede}
        contentKeys={{
          index: 'shop.header.index',
          title: 'shop.header.title',
          lede: 'shop.header.lede',
        }}
        ledeTokens={{ total: products.length }}
      />
    ),
    shelf: (
      <Container width="wide" className="pb-section-y">
        <Suspense fallback={null}>
          <ShopShelf products={products} categories={categories} />
        </Suspense>
      </Container>
    ),
    bulk: <BulkBand />,
  };

  const order = ['header', 'shelf', 'bulk'] as const;

  return <SectionOrderHost slots={slots} order={order} />;
}
