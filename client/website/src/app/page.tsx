import type { Metadata } from 'next';
import { Banner } from '@/components/Banner/Banner';
import { SectionRenderer } from '@/components/sections/SectionRenderer';
import {
  fetchHeroBanner,
  fetchServices,
  fetchStats,
  fetchHomepageSections,
  fetchAboutContent,
  fetchCertificates,
} from '@/lib/api';

export const metadata: Metadata = {
  title: 'Ash-Shāfī | Gynecology & Obstetrics Specialist',
  description:
    "Compassionate women's healthcare in Dhaka. Book an appointment with Ash-Shāfī, a BM&DC registered gynecologist and obstetrician.",
};

export const revalidate = 60; // ISR: revalidate every 60s

export default async function HomePage() {
  // Parallel server-side data fetches
  const [heroBanner, services, stats, sections, about, certificates] = await Promise.all([
    fetchHeroBanner(),
    fetchServices(),
    fetchStats(),
    fetchHomepageSections(),
    fetchAboutContent(),
    fetchCertificates(),
  ]);

  // FET-16 completion pass — all ten built-in sections (Hero,
  // Services, Certificates, Stats, About, Women's Health, Office,
  // Support, Video, Testimonials) plus any admin-created CUSTOM ones
  // are rendered here via `SectionRenderer` in whatever order/
  // visibility the dashboard's Website Management → Homepage Sections
  // tab has set (`isActive`, `order`) — previously this was a fixed
  // JSX sequence that never called `fetchHomepageSections()` at all,
  // so reordering or hiding a section from the dashboard had no
  // effect on the live site, and Certificates/About never appeared on
  // the homepage at all despite both having full CMS content.
  //
  // WomenHealth/Office/Support/Video/Testimonials used to be a fixed
  // block after this loop because the backend's `SECTION_TYPES` enum
  // didn't cover them yet, even though `SectionRenderer` already had
  // real cases for all five. Now that the enum and the seeded
  // registry rows include them (`dynamic-site.service.js`'s
  // `BUILT_IN_SECTION_SEEDS`), they render through this same
  // registry-driven loop like everything else — genuinely
  // hideable/reorderable from the dashboard for the first time.
  const activeSections = (sections || [])
    .filter((s) => s.isActive)
    .sort((a, b) => a.order - b.order);

  const fallbackOrder = [
    'HERO',
    'SERVICES',
    'CERTIFICATES',
    'STATS',
    'ABOUT',
    'WOMEN_HEALTH',
    'OFFICE',
    'SUPPORT',
    'VIDEO',
    'TESTIMONIALS',
  ];
  const orderedSections =
    activeSections.length > 0
      ? activeSections
      : fallbackOrder.map((type, idx) => ({ _id: type, key: type.toLowerCase(), type, order: idx, isActive: true }) as any);

  return (
    <>
      {orderedSections.map((section) =>
        section.type === 'HERO' ? (
          <Banner key={section._id} bannerData={heroBanner} />
        ) : (
          <SectionRenderer
            key={section._id}
            section={section}
            heroBannerData={heroBanner}
            servicesData={services}
            statsData={stats}
            aboutData={about}
            certificatesData={certificates}
          />
        ),
      )}
    </>
  );
}
