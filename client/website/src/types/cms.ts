export interface NavbarItem {
  _id: string;
  label: string;
  href: string;
  order: number;
  isActive: boolean;
  openInNewTab?: boolean;
  parentId?: string | null;
  children?: NavbarItem[];
}

export type SectionType =
  | 'HERO'
  | 'SERVICES'
  | 'CERTIFICATES'
  | 'STATS'
  | 'ABOUT'
  | 'CUSTOM'
  | 'OFFICE'
  | 'WOMEN_HEALTH'
  | 'SUPPORT'
  | 'VIDEO'
  | 'TESTIMONIALS'
  | 'CONTACT'
  | 'APPOINTMENT'
  | 'DYNAMIC_FORM';

export type BlockType = 'HEADING' | 'PARAGRAPH' | 'IMAGE' | 'CTA' | 'QUOTE';

export interface SectionBlock {
  _id?: string;
  type: BlockType;
  // HEADING / PARAGRAPH / QUOTE
  content?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  author?: string;
  // IMAGE
  src?: string;
  alt?: string;
  caption?: string;
  height?: number | string;
  // CTA
  primary?: string;
  primaryHref?: string;
  secondary?: string;
  secondaryHref?: string;
  // Legacy fields
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  ctaLabel?: string;
  ctaHref?: string;
  order?: number;
}

export interface FormFieldSchema {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'date' | 'time';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
}

export interface HomepageSection {
  _id: string;
  key: string;
  type: SectionType;
  title?: string;
  subtitle?: string;
  content?: string;
  order: number;
  isActive: boolean;
  blocks?: SectionBlock[];
  formFields?: FormFieldSchema[];
  submitLabel?: string;
  backgroundMedia?: {
    url?: string;
    resourceType?: string;
  };
  isDeletable?: boolean;
}

export interface CMSPage {
  _id: string;
  title: string;
  slug: string;
  pageType: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  subtitle?: string;
  breadcrumb?: string;
  content?: string;
  excerpt?: string;
  blocks?: SectionBlock[];
  sections?: HomepageSection[];
  // Flat SEO fields (for convenience)
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  featuredImage?: {
    url?: string;
    altText?: string;
  };
  // Legacy nested SEO
  seo?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  showInNav?: boolean;
  navOrder?: number;
  publishedAt?: string;
}

export interface CMSService {
  _id: string;
  title: string;
  slug: string;
  description: string;
  icon?: string;
  order: number;
  isActive: boolean;
}

export interface CMSStat {
  _id: string;
  label: string;
  value: string;
  icon?: string;
  order: number;
  isActive: boolean;
}

export interface CMSAboutHighlight {
  _id?: string;
  title: string;
  description: string;
  icon?: string;
}

export interface CMSAboutContent {
  _id: string;
  heading: string;
  body: string;
  highlights: CMSAboutHighlight[];
  ctaLabel?: string;
  ctaHref?: string;
}

// Matches `server/src/modules/cms/models/certificate.model.js` exactly
// (name/image.url/order/isActive) — not title/issuer/issueDate/flat
// imageUrl, which the real API never sends.
export interface CMSCertificate {
  _id: string;
  name: string;
  image?: {
    url?: string;
    cloudinaryPublicId?: string;
  };
  order: number;
  isActive: boolean;
}

// Narrowed public shape returned by `GET /staff/public/doctors`
// (`listPublicDoctors` in `staff.service.js`) — never the full staff
// profile, regardless of what the caller sends.
export interface PublicDoctor {
  id: string;
  name: string;
  specialization: string;
  qualifications: string[];
  yearsOfExperience: number;
  bio: string;
  department: string;
}

export interface HeroBanner {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  videoUrl?: string;
  posterUrl?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  badges?: Array<{ label: string; icon?: string }>;
}

export interface ContactInquiryPayload {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  website?: string;
}

export interface AppointmentBookingPayload {
  name: string;
  email: string;
  phone: string;
  service?: string;
  date: string;
  time: string;
  reason?: string;
}
