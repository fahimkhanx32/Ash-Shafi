'use client';

import React from 'react';
import Link from 'next/link';
import {
  FaGraduationCap,
  FaStethoscope,
  FaHospital,
  FaCertificate,
  FaHeart,
  FaArrowRight,
} from 'react-icons/fa';
import { CMSAboutContent, CMSAboutHighlight } from '@/types/cms';

interface AboutSectionProps {
  aboutData?: CMSAboutContent | null;
}

const DEFAULT_ICONS = [FaGraduationCap, FaStethoscope, FaHospital, FaCertificate, FaHeart];

const getIconComponent = (iconKey?: string, index: number = 0) => {
  const iconMap: Record<string, any> = {
    graduation: FaGraduationCap,
    stethoscope: FaStethoscope,
    hospital: FaHospital,
    certificate: FaCertificate,
    heart: FaHeart,
  };
  if (iconKey && iconMap[iconKey.toLowerCase()]) {
    return iconMap[iconKey.toLowerCase()];
  }
  return DEFAULT_ICONS[index % DEFAULT_ICONS.length];
};

const DEFAULT_HEADING = 'A Practice Built On Trust & Compassionate Care';
const DEFAULT_BODY =
  "Ash-Shāfī brings together clinical expertise and genuine care to support women through every stage of life — from routine gynecological health to pregnancy and beyond.";
const DEFAULT_HIGHLIGHTS: CMSAboutHighlight[] = [
  { title: 'BM&DC Registered', description: 'Fully licensed and credentialed medical practice.' },
  { title: 'Patient-First Approach', description: 'Every visit is unhurried, private, and respectful.' },
  { title: 'Modern Facilities', description: 'Clean, safe, and comfortable clinical environment.' },
];

/**
 * FET-16 completion pass — the homepage "About the clinic" section,
 * driven by the CMS `AboutContent` singleton (`fetchAboutContent()`)
 * rather than the large standalone `/about` page's `About` component,
 * which is a full separate page (its own hero, static bio copy) and
 * was never meant to be dropped into the middle of the homepage.
 * `HomepageSection`'s `ABOUT` type (`SectionRenderer.tsx`) renders
 * this instead — small, homepage-section-sized, and reads the actual
 * heading/body/highlights an admin edits from the dashboard's Website
 * Management → About tab. Falls back to sensible default copy if
 * nothing has been configured yet, same pattern `Stats.tsx`/
 * `Services.tsx` already use for their own CMS-backed content.
 */
export const AboutSection: React.FC<AboutSectionProps> = ({ aboutData }) => {
  const heading = aboutData?.heading || DEFAULT_HEADING;
  const body = aboutData?.body || DEFAULT_BODY;
  const highlights = aboutData?.highlights?.length ? aboutData.highlights : DEFAULT_HIGHLIGHTS;
  const ctaLabel = aboutData?.ctaLabel || 'Learn More About Us';
  const ctaHref = aboutData?.ctaHref || '/about';

  return (
    <section className="relative w-full overflow-hidden bg-[#06151a] px-5 py-20 sm:px-8 lg:px-14">
      <div className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-[#20aaa0]/[0.05] blur-[110px]" />
      <div className="relative mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <div>
            <div className="mb-5 flex items-center gap-4">
              <span className="h-px w-10 bg-[#20aaa0]" />
              <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-[#20aaa0]">About Us</span>
            </div>
            <h2 className="font-serif text-3xl font-medium leading-tight text-[#f4f1e9] sm:text-4xl">
              {heading}
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#aab9bd]">{body}</p>
            <Link
              href={ctaHref}
              className="mt-8 inline-flex items-center gap-2 rounded-md bg-[#159b89] px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#20aaa0]"
            >
              {ctaLabel} <FaArrowRight className="text-xs" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {highlights.map((h, index) => {
              const Icon = getIconComponent(h.icon, index);
              return (
                <div
                  key={h.title + index}
                  className="rounded-xl border border-[#20aaa0]/[0.12] bg-[#0a1e24] p-5 transition-colors hover:border-[#20aaa0]/30"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#20aaa0]/10 text-lg text-[#20aaa0]">
                    <Icon />
                  </div>
                  <p className="text-sm font-semibold text-[#f4f1e9]">{h.title}</p>
                  <p className="mt-1.5 text-[13px] leading-6 text-[#aab9bd]">{h.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
