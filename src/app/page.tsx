import { Hero } from '@/components/sections/Hero';
import { Categories } from '@/components/sections/Categories';
import { FeaturedProducts } from '@/components/sections/FeaturedProducts';
import { Process } from '@/components/sections/Process';
import { BulkBand } from '@/components/sections/BulkBand';
import { WhyPaper } from '@/components/sections/WhyPaper';
import { Testimonials } from '@/components/sections/Testimonials';
import { Faq } from '@/components/sections/Faq';
import { Marquee } from '@/components/primitives/Marquee';
import { getContentSnapshot } from '@/lib/content';
import { getCategories, getFeaturedProducts, getProducts } from '@/lib/catalog';
import { SectionOrderHost } from '@/components/edit/SectionOrderHost';

export default async function HomePage() {
  const [content, categories, products, featured] = await Promise.all([
    getContentSnapshot(),
    getCategories(),
    getProducts(),
    getFeaturedProducts(),
  ]);
  const { sections } = content;

  const slots = {
    hero: <Hero total={products.length} />,
    categories: (
      <Categories
        index={sections.categories.index}
        title={sections.categories.title}
        lede={sections.categories.lede}
        categories={categories}
        products={products}
      />
    ),
    featured: (
      <FeaturedProducts
        index={sections.shop.index}
        title={sections.shop.title}
        lede={sections.shop.lede}
        featured={featured}
        total={products.length}
      />
    ),
    marquee: (
      <Marquee
        words={content.marqueeHome}
        listKey="home.marquee.words"
        total={products.length}
      />
    ),
    process: <Process />,
    bulk: <BulkBand />,
    why: <WhyPaper />,
    testimonials: <Testimonials />,
    faq: <Faq />,
  };

  const order = [
    'hero',
    'categories',
    'featured',
    'marquee',
    'process',
    'bulk',
    'why',
    'testimonials',
    'faq',
  ];

  return (
    <SectionOrderHost
      slots={slots}
      order={order}
      published={content.pageSections.home}
    />
  );
}
