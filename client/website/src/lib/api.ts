import {
  NavbarItem,
  HomepageSection,
  CMSPage,
  CMSService,
  CMSStat,
  CMSAboutContent,
  CMSCertificate,
  PublicDoctor,
  HeroBanner,
  ContactInquiryPayload,
} from '@/types/cms';

export const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    if (envUrl) {
      try {
        const parsed = new URL(envUrl);
        if (
          (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
          hostname !== 'localhost' &&
          hostname !== '127.0.0.1'
        ) {
          parsed.hostname = hostname;
          return parsed.toString().replace(/\/$/, '');
        }
        return envUrl;
      } catch {
        return envUrl;
      }
    }
    const protocol = window.location.protocol || 'http:';
    return `${protocol}//${hostname}:5000/api/v1`;
  }
  return envUrl || 'http://localhost:5000/api/v1';
};

// Generic Fetcher with safety fallback
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  try {
    const url = `${getApiBaseUrl()}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      next: { revalidate: 60 }, // ISR caching with 60s revalidation
    });

    if (!res.ok) {
      console.warn(`API request to ${endpoint} returned status ${res.status}`);
      return null;
    }

    const json = await res.json();
    return json.data !== undefined ? json.data : json;
  } catch (error) {
    console.warn(`API request to ${endpoint} failed:`, error);
    return null;
  }
}

// -------------------------------------------------------------
// 1. Navigation Tree API
// -------------------------------------------------------------

export const DEFAULT_NAVBAR_TREE: NavbarItem[] = [
  {
    _id: 'nav-expertise',
    label: 'Expertise',
    href: '/#expertise',
    order: 0,
    isActive: true,
    children: [
      {
        _id: 'nav-exp-1',
        label: 'Clinical Expertise',
        href: '/#expertise',
        order: 0,
        isActive: true,
      },
      {
        _id: 'nav-exp-2',
        label: 'Pregnancy Care',
        href: '/#women-health',
        order: 1,
        isActive: true,
      },
      {
        _id: 'nav-exp-3',
        label: "Women's Health",
        href: '/#women-health',
        order: 2,
        isActive: true,
      },
      {
        _id: 'nav-exp-4',
        label: 'High-Risk Obstetrics',
        href: '/#support',
        order: 3,
        isActive: true,
      },
    ],
  },
  {
    _id: 'nav-specialties',
    label: 'Specialties',
    href: '/#specialties',
    order: 1,
    isActive: true,
    children: [
      {
        _id: 'nav-spec-1',
        label: 'Gynecology',
        href: '/services#gynecology',
        order: 0,
        isActive: true,
      },
      {
        _id: 'nav-spec-2',
        label: 'Obstetrics',
        href: '/services#obstetrics',
        order: 1,
        isActive: true,
      },
      {
        _id: 'nav-spec-3',
        label: 'Reproductive Health',
        href: '/services#reproductive',
        order: 2,
        isActive: true,
      },
      {
        _id: 'nav-spec-4',
        label: 'Menopause Care',
        href: '/services#menopause',
        order: 3,
        isActive: true,
      },
    ],
  },
  {
    _id: 'nav-services',
    label: 'Services',
    href: '/services',
    order: 2,
    isActive: true,
    children: [
      {
        _id: 'nav-serv-1',
        label: 'Gynecological Care',
        href: '/services#gynecological-care',
        order: 0,
        isActive: true,
      },
      {
        _id: 'nav-serv-2',
        label: 'Pregnancy & Prenatal Care',
        href: '/services#prenatal-care',
        order: 1,
        isActive: true,
      },
      {
        _id: 'nav-serv-3',
        label: 'Menstrual Health & PCOS',
        href: '/services#menstrual-health',
        order: 2,
        isActive: true,
      },
      {
        _id: 'nav-serv-4',
        label: 'Fertility Consultation',
        href: '/services#fertility',
        order: 3,
        isActive: true,
      },
      {
        _id: 'nav-serv-5',
        label: 'Preventive Screenings',
        href: '/services#preventive-care',
        order: 4,
        isActive: true,
      },
    ],
  },
  {
    _id: 'nav-resources',
    label: 'Resources',
    href: '/resources',
    order: 3,
    isActive: true,
    children: [
      {
        _id: 'nav-res-1',
        label: 'Pregnancy Guide',
        href: '/resources/pregnancy-guide',
        order: 0,
        isActive: true,
        children: [
          {
            _id: 'nav-res-1-1',
            label: 'First Trimester',
            href: '/resources/first-trimester',
            order: 0,
            isActive: true,
          },
          {
            _id: 'nav-res-1-2',
            label: 'Second Trimester',
            href: '/resources/second-trimester',
            order: 1,
            isActive: true,
          },
          {
            _id: 'nav-res-1-3',
            label: 'Third Trimester',
            href: '/resources/third-trimester',
            order: 2,
            isActive: true,
          },
        ],
      },
      {
        _id: 'nav-res-2',
        label: "Women's Wellness Articles",
        href: '/resources/womens-wellness',
        order: 1,
        isActive: true,
      },
      {
        _id: 'nav-res-3',
        label: 'Frequently Asked Questions',
        href: '/resources/faqs',
        order: 2,
        isActive: true,
      },
      {
        _id: 'nav-res-4',
        label: 'Medical Glossary',
        href: '/resources/glossary',
        order: 3,
        isActive: true,
      },
    ],
  },
  {
    _id: 'nav-more',
    label: 'More',
    href: '/#more',
    order: 4,
    isActive: true,
    children: [
      {
        _id: 'nav-more-1',
        label: 'About Ash-Shāfī',
        href: '/about',
        order: 0,
        isActive: true,
      },
      {
        _id: 'nav-more-2',
        label: 'Professional Practice / Clinic',
        href: '/#office',
        order: 1,
        isActive: true,
      },
      {
        _id: 'nav-more-3',
        label: 'Patient Testimonials',
        href: '/#testimonials',
        order: 2,
        isActive: true,
      },
      {
        _id: 'nav-more-4',
        label: 'Contact Us',
        href: '/contact',
        order: 3,
        isActive: true,
      },
      {
        _id: 'nav-more-5',
        label: 'Book Appointment',
        href: '/appointment',
        order: 4,
        isActive: true,
      },
    ],
  },
];

export async function fetchNavbarTree(): Promise<NavbarItem[]> {
  const items = await fetchAPI<NavbarItem[]>('/cms/navbar');
  if (!items || items.length === 0) {
    return DEFAULT_NAVBAR_TREE;
  }

  // Build recursive tree from flat parentId items
  const itemMap = new Map<string, NavbarItem>();
  items.forEach((item) => {
    itemMap.set(String(item._id), { ...item, children: [] });
  });

  const roots: NavbarItem[] = [];
  items.forEach((item) => {
    const node = itemMap.get(String(item._id))!;
    if (item.parentId && itemMap.has(String(item.parentId))) {
      const parent = itemMap.get(String(item.parentId))!;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
      parent.children.sort((a, b) => (a.order || 0) - (b.order || 0));
    } else {
      roots.push(node);
    }
  });

  roots.sort((a, b) => (a.order || 0) - (b.order || 0));

  // If backend only returns a few custom items or lacks top 5 hierarchy, fallback seamlessly
  if (roots.length === 0) {
    return DEFAULT_NAVBAR_TREE;
  }

  return roots;
}

// -------------------------------------------------------------
// 2. Sections & Content API
// -------------------------------------------------------------

export async function fetchHomepageSections(): Promise<HomepageSection[] | null> {
  return await fetchAPI<HomepageSection[]>('/cms/sections');
}

export async function fetchHeroBanner(): Promise<HeroBanner | null> {
  return await fetchAPI<HeroBanner>('/cms/hero-banner');
}

export async function fetchServices(): Promise<CMSService[] | null> {
  return await fetchAPI<CMSService[]>('/cms/services');
}

export async function fetchStats(): Promise<CMSStat[] | null> {
  return await fetchAPI<CMSStat[]>('/cms/stats');
}

export async function fetchAboutContent(): Promise<CMSAboutContent | null> {
  return await fetchAPI<CMSAboutContent>('/cms/about');
}

export async function fetchCertificates(): Promise<CMSCertificate[] | null> {
  return await fetchAPI<CMSCertificate[]>('/cms/certificates');
}

export async function fetchDoctors(): Promise<PublicDoctor[] | null> {
  // Narrowed public fields only (name/specialization/qualifications/
  // yearsOfExperience/bio/department) — `listPublicDoctorsController`
  // (`/staff/public/doctors`) never returns anything beyond that
  // regardless of what's queried. `limit` defaults to 50 server-side,
  // which is plenty for a single clinic's doctor roster.
  return await fetchAPI<PublicDoctor[]>('/staff/public/doctors');
}

// -------------------------------------------------------------
// 3. Dynamic Pages API
// -------------------------------------------------------------

export async function fetchPageBySlug(slug: string): Promise<CMSPage | null> {
  return await fetchAPI<CMSPage>(`/cms/pages/public/${encodeURIComponent(slug)}`);
}

export async function fetchPublishedPages(): Promise<CMSPage[] | null> {
  const res = await fetchAPI<{ pages: CMSPage[]; total: number } | CMSPage[]>('/cms/pages/public');
  if (!res) return null;
  if (Array.isArray(res)) return res;
  return res.pages || null;
}

// -------------------------------------------------------------
// 4. Form Submissions
// -------------------------------------------------------------

export async function submitContactInquiry(
  payload: ContactInquiryPayload
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/cms/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        message: data.message || 'Failed to submit inquiry. Please try again.',
      };
    }

    return {
      success: true,
      message: data.message || 'Thank you! Your message has been received.',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Network error. Please check your connection and try again.',
    };
  }
}
