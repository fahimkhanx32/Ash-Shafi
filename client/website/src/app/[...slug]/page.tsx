import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlockRenderer } from '@/components/sections/SectionRenderer';
import { fetchPageBySlug } from '@/lib/api';

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export const revalidate = 60;

// Generate metadata from backend page data
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const slugStr = slug.join('/');
  const page = await fetchPageBySlug(slugStr);

  if (!page) {
    return { title: 'Page Not Found' };
  }

  const seoTitle = page.seoTitle || page.seo?.title || page.title;
  const seoDesc = page.seoDescription || page.seo?.description;
  const ogImg = page.ogImage || page.seo?.ogImage || page.featuredImage?.url;

  return {
    title: seoTitle,
    description: seoDesc,
    openGraph: {
      title: seoTitle,
      description: seoDesc,
      images: ogImg ? [ogImg] : [],
    },
  };
}

export default async function CmsPage({ params }: PageProps) {
  const { slug } = await params;
  const slugStr = slug.join('/');
  const page = await fetchPageBySlug(slugStr);

  if (!page) {
    notFound();
  }

  return (
    <main className="min-h-screen w-full bg-[#030b0e]">
      {/* Page header — real content-block schema (`page.model.js`)
          has no HERO/subtitle/breadcrumb concept, only a
          title/excerpt/featuredImage on the page itself plus a flat
          `blocks` array for the body, so this always renders when the
          page has a title (there's no per-page way to suppress it). */}
      {page.title && (
        <section className="relative overflow-hidden bg-[#030b0e] px-5 pb-12 pt-20 sm:px-8 lg:px-14">
          <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-[600px] -translate-x-1/2 rounded-full bg-[#20aaa0]/[0.04] blur-[100px]" />
          <div className="relative mx-auto max-w-4xl">
            <h1 className="font-serif text-4xl font-medium text-[#f4f1e9] sm:text-5xl">
              {page.title}
            </h1>
            {page.excerpt && (
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#aab9bd]">
                {page.excerpt}
              </p>
            )}
          </div>
        </section>
      )}

      {/* CONTENT BLOCKS — the real body of the page, authored from the
          dashboard's Website Management → Pages tab. */}
      {page.blocks && page.blocks.length > 0 && (
        <section className="px-5 py-4 pb-20 sm:px-8 lg:px-14">
          <div className="mx-auto max-w-4xl">
            {page.blocks.map((block, idx) => (
              <BlockRenderer key={idx} block={block} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
