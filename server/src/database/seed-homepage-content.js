import env from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { NavbarItem } from '../modules/cms/models/navbar-item.model.js';
import { HeroBanner } from '../modules/cms/models/hero-banner.model.js';
import { Page } from '../modules/cms/models/page.model.js';
import { ensureBuiltInSectionsSeeded } from '../modules/cms/services/dynamic-site.service.js';

/**
 * FET-16 — one-time content seed for the public website's dynamic
 * navbar, hero/banner, homepage section layout, and marketing pages
 * (FAQ, Blog, Patient Resources), so the site has sensible real
 * content on first launch instead of an empty dashboard and 404ing
 * nav links. Idempotent: safe to re-run any time, every step is
 * "only insert if missing" and never overwrites content an admin has
 * since edited through the dashboard.
 *
 * Run against your real database with your real .env in place:
 *
 *   cd server
 *   node src/database/seed-homepage-content.js
 *
 * Does NOT seed certificates, doctors, or upload any banner
 * image/video — those need real data/files (accreditation logos, an
 * actual clinic photo/video, real staff/doctor accounts) that only
 * you have; add them from Website Management → Certificates / Hero
 * Banner in the dashboard, and from Staff Administration for
 * doctors, after this runs.
 */

const DEFAULT_NAVBAR_ITEMS = [
  { label: 'Home', href: '/', order: 0 },
  { label: 'About', href: '/about', order: 1 },
  { label: 'Services', href: '/services', order: 2 },
  { label: 'Doctors', href: '/doctors', order: 3 },
  { label: 'Certificates', href: '/certificates', order: 4 },
  { label: 'Contact', href: '/contact', order: 5 },
];

const seedNavbarItems = async () => {
  const existingCount = await NavbarItem.countDocuments();
  if (existingCount > 0) {
    console.log(`Navbar already has ${existingCount} item(s) — skipping default navbar seed.`);
    return;
  }

  await NavbarItem.insertMany(DEFAULT_NAVBAR_ITEMS.map((item) => ({ ...item, isActive: true })));
  console.log(`Seeded ${DEFAULT_NAVBAR_ITEMS.length} default navbar items.`);
};

// Unlike `seedNavbarItems` above (all-or-nothing, only for a totally
// empty navbar), this adds one link at a time by href — safe to run
// against a navbar an admin has already customized, since it never
// touches an existing item and only appends ones that are missing.
const ensureNavbarItem = async ({ label, href }) => {
  const existing = await NavbarItem.findOne({ href });
  if (existing) return;
  const highestOrder = await NavbarItem.findOne().sort({ order: -1 }).select('order');
  await NavbarItem.create({
    label,
    href,
    order: (highestOrder?.order ?? -1) + 1,
    isActive: true,
  });
  console.log(`Added "${label}" (${href}) to the navbar.`);
};

const seedHeroBanner = async () => {
  const existing = await HeroBanner.findById('homepage-hero');
  if (existing) {
    console.log('Hero banner document already exists — skipping default hero seed.');
    return;
  }

  await HeroBanner.create({
    _id: 'homepage-hero',
    eyebrow: "Women's Health Clinic",
    heading: 'Exceptional Care For Every Stage of',
    headingAccent: 'Womanhood',
    description:
      'Expert gynecological care in a safe, supportive and compassionate environment.',
    ctaPrimaryLabel: 'Book Appointment',
    ctaPrimaryHref: '/portal/register',
    ctaSecondaryLabel: 'Our Services',
    ctaSecondaryHref: '/services',
    overlayOpacity: 30,
  });
  console.log('Seeded default hero banner content (no background image/video yet — upload one from the dashboard).');
};

const seedHomepageSections = async () => {
  await ensureBuiltInSectionsSeeded();
  console.log(
    'Ensured built-in homepage sections (hero, services, certificates, stats, about, ' +
      "women's health, office, support, video, testimonials) exist.",
  );
};

// Content for the three marketing pages that had a nav-reachable slug
// (Blog) or an obvious admin-facing gap (FAQ, Patient Resources) but
// no `Page` document behind them yet — the `[...slug]` route already
// renders any published Page, this was purely a missing-content gap.
// Doctors is NOT seeded here: it's a live listing off
// `/staff/public/doctors` (see `app/doctors/page.tsx`), not CMS block
// content, so there is nothing to seed for it.
const ensurePage = async (data) => {
  const existing = await Page.findOne({ slug: data.slug });
  if (existing) {
    console.log(`Page "${data.slug}" already exists — skipping.`);
    return;
  }
  await Page.create({ ...data, publishedAt: data.status === 'PUBLISHED' ? new Date() : null });
  console.log(`Seeded "${data.slug}" page.`);
};

const heading = (body) => ({ type: 'HEADING', body });
const paragraph = (body) => ({ type: 'PARAGRAPH', body });

const seedMarketingPages = async () => {
  await ensurePage({
    title: 'Frequently Asked Questions',
    slug: 'faq',
    pageType: 'FAQ',
    status: 'PUBLISHED',
    excerpt: 'Answers to common questions about appointments, consultations and our clinic.',
    blocks: [
      heading('Frequently Asked Questions'),
      heading('How do I book an appointment?'),
      paragraph(
        'Use the "Book Appointment" button on our homepage or visit the Appointment page to request a time slot online. Our team will confirm your booking.',
      ),
      heading('What should I bring to my first visit?'),
      paragraph(
        'Please bring a valid photo ID, any previous medical records or prescriptions relevant to your visit, and a list of current medications if applicable.',
      ),
      heading('Can I reschedule or cancel an appointment?'),
      paragraph(
        'Yes — contact us as early as possible using the details on our Contact page so we can offer the slot to another patient and find you a new time.',
      ),
      heading('Do you offer consultations for specific concerns?'),
      paragraph(
        'Yes, our services range from routine gynecological care to pregnancy support and specialized consultations — see the Services page for the full list, or contact us if you are not sure which is right for you.',
      ),
    ],
    showInNav: true,
    navOrder: 20,
  });

  await ensurePage({
    title: 'Blog',
    slug: 'blog',
    pageType: 'BLOG',
    status: 'PUBLISHED',
    excerpt: "Articles and updates on women's health from the Ash-Shāfī team.",
    blocks: [
      heading('Blog'),
      paragraph(
        "We're building out a library of articles on women's health — from pregnancy and prenatal care to menstrual health, fertility and preventive screening. Check back soon for our first posts.",
      ),
      paragraph(
        'In the meantime, if you have a specific question, our Services and FAQ pages cover common topics, or you can reach out directly via the Contact page.',
      ),
    ],
    showInNav: true,
    navOrder: 21,
  });

  await ensurePage({
    title: 'Patient Resources',
    slug: 'patient-resources',
    pageType: 'CUSTOM',
    status: 'PUBLISHED',
    excerpt: 'Practical information to help you prepare for your visit.',
    blocks: [
      heading('Patient Resources'),
      paragraph(
        'This page collects practical information to help you prepare for your visit and get the most out of your care with us.',
      ),
      heading('Before Your Appointment'),
      paragraph(
        'Arrive a few minutes early for registration, bring a valid photo ID and any relevant previous medical records, and note down any symptoms or questions you want to discuss.',
      ),
      heading('Appointments & Cancellations'),
      paragraph(
        'Appointments can be booked from the Appointment page. If you need to reschedule or cancel, please let us know as early as possible — see the Contact page for the quickest way to reach us.',
      ),
      heading('Have More Questions?'),
      paragraph('Visit our FAQ page, or get in touch directly and our team will be happy to help.'),
    ],
    showInNav: true,
    navOrder: 22,
  });
};

const run = async () => {
  try {
    await connectDatabase();

    await seedNavbarItems();
    await seedHeroBanner();
    await seedHomepageSections();
    await seedMarketingPages();
    await ensureNavbarItem({ label: 'FAQ', href: '/faq' });
    await ensureNavbarItem({ label: 'Blog', href: '/blog' });
    await ensureNavbarItem({ label: 'Patient Resources', href: '/patient-resources' });

    console.log('');
    console.log('Homepage content seeding completed successfully.');
    console.log('');
  } catch (error) {
    console.error('Homepage content seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
};

run();
