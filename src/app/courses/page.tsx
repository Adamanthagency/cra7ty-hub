import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentSnapshot } from '@/lib/content';
import { PageHeader } from '@/components/primitives/PageHeader';
import { Container } from '@/components/primitives/Container';
import { ShopCard } from '@/components/ShopCard';
import { getProductsByCategory } from '@/lib/catalog';

/**
 * The category id the admin assigns to a course in the product editor.
 * A course is not its own product type — it is a normal DIGITAL product
 * filed under this category, so the whole existing pipeline (Paystack
 * checkout, confirm_paid_order, per-file download grants, single-use
 * links) delivers it with no changes. Filtering here is by category
 * only, exactly like /shop filters by its tabs.
 */
const COURSES_CATEGORY = 'courses';

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getContentSnapshot();
  const description =
    'Downloadable paper-craft courses from the Cra7ty Hub studio — step-by-step guides you can fold along with at your own pace.';
  return {
    title: 'Courses',
    description,
    alternates: { canonical: '/courses' },
    openGraph: {
      title: `Courses — ${site.name}`,
      description,
      url: `${site.url}/courses`,
      type: 'website',
    },
  };
}

/**
 * The Courses shelf. Every active product the studio has filed under the
 * "courses" category, bought and delivered exactly like any other digital
 * product. The header is server-rendered; the grid reuses the same card
 * as /shop so both surfaces stay identical. An honest empty state shows
 * when no courses are published yet — not the old "coming soon" shell,
 * which 404ed this route in production.
 */
export default async function CoursesPage() {
  const courses = await getProductsByCategory(COURSES_CATEGORY);

  return (
    <>
      <PageHeader
        id="courses"
        index="01"
        title={['Fold it', 'yourself']}
        lede="Step-by-step paper-craft courses from the people who fold for a living. Buy one, download it, and go at your own pace."
      />

      <Container width="wide" className="pb-20">
        {courses.length === 0 ? (
          <div className="border border-ink-24 bg-paper px-6 py-14 text-center md:px-10">
            <p className="mono-label-xs text-vermilion">Nothing here yet</p>
            <p className="font-display mx-auto mt-3 max-w-[28rem] text-display-sm leading-tight text-ink">
              The first courses are being folded.
            </p>
            <p className="mx-auto mt-4 max-w-prose text-sm leading-relaxed text-ink-70 md:text-base">
              Downloadable guides will land here as they are written. In the
              meantime the studio&apos;s full catalogue of origami, packaging and
              party pieces is open in the shop.
            </p>
            <p className="mt-7">
              <Link
                href="/shop"
                className="link-draw mono-label-xs inline-flex items-center gap-2"
              >
                Browse the shop
                <span aria-hidden="true">→</span>
              </Link>
            </p>
          </div>
        ) : (
          <ul className="grid animate-fold-in grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((product, i) => (
              <li key={product.id} className="h-full">
                <ShopCard product={product} index={i} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
