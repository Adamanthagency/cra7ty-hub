import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentSnapshot } from '@/lib/content';
import { Container } from '@/components/primitives/Container';
import { PageHeader } from '@/components/primitives/PageHeader';

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getContentSnapshot();
  const description =
    'Courses from the Cra7ty Hub studio — downloadable paper-craft files and live classes. Coming soon.';
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
 * Reserved nav slot for the Courses feature (downloadable files or a
 * live-class link — still being scoped). The feature is built
 * separately; until then this shell answers the link instead of 404ing.
 */
export default async function CoursesPage() {
  await getContentSnapshot();

  return (
    <>
      <PageHeader
        id="courses"
        index="01"
        title={['Courses,', 'coming soon']}
        lede="Downloadable paper-craft files and live classes from the people who fold for a living. Nothing is on sale here yet."
      />

      <Container width="wide" className="pb-20">
        <div className="border border-ink-24 bg-paper px-6 py-14 text-center md:px-10">
          <p className="mono-label-xs text-vermilion">Coming soon</p>
          <p className="font-display mx-auto mt-3 max-w-[28rem] text-display-sm leading-tight text-ink">
            Not open yet.
          </p>
          <p className="mx-auto mt-4 max-w-prose text-sm leading-relaxed text-ink-70 md:text-base">
            Courses will hold step-by-step guides you can download, plus links
            to live sessions run from the Okota studio. The programme is still
            being scoped, so there is nothing to buy on this page for now.
          </p>
          <p className="mt-7">
            <Link href="/blog" className="link-draw mono-label-xs inline-flex items-center gap-2">
              Read the notes instead
              <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </Container>
    </>
  );
}
