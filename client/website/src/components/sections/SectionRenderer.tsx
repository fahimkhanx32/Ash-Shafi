'use client';

import React from 'react';
import { HomepageSection, SectionBlock } from '@/types/cms';
import Banner from '@/components/Banner/Banner';
import { Services } from '@/components/Services/Services';
import { StatsSection } from '@/components/Stats/Stats';
import { OfficeSection } from '@/components/OfficeSection/OfficeSection';
import { WomenHealth } from '@/components/WomenHealth/WomenHealth';
import { Support } from '@/components/Support/Support';
import { VideoSection } from '@/components/VideoSection/VideoSection';
import { Testimonials } from '@/components/Testimonials/Testimonials';
import { AboutSection } from '@/components/AboutSection/AboutSection';
import { CertificatesSection } from '@/components/Certificates/CertificatesSection';
import { ContactForm } from '@/components/forms/ContactForm';
import { AppointmentForm } from '@/components/forms/AppointmentForm';
import { DynamicFormRenderer } from '@/components/forms/DynamicFormRenderer';

/* ---------------------------------------------------------------
   BLOCK RENDERERS
--------------------------------------------------------------- */

function HeadingBlock({ block }: { block: SectionBlock }) {
  const level = block.level || 2;
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <Tag className="mb-4 font-serif text-3xl font-medium text-[#f4f1e9] sm:text-4xl">
      {block.content || block.body}
    </Tag>
  );
}

function ParagraphBlock({ block }: { block: SectionBlock }) {
  return (
    <p className="mb-4 text-[15px] leading-7 text-[#aab9bd]">{block.content || block.body}</p>
  );
}

function ImageBlock({ block }: { block: SectionBlock }) {
  const src = block.src || block.imageUrl;
  if (!src) return null;
  return (
    <figure className="my-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={block.alt || block.imageAlt || ''}
        className="w-full rounded-xl object-cover"
        style={block.height ? { maxHeight: block.height } : undefined}
      />
      {block.caption && (
        <figcaption className="mt-2 text-center text-xs text-[#718387]">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}

function CTABlock({ block }: { block: SectionBlock }) {
  // The real backend (`page.model.js`/`homepage-section.model.js`)
  // only ever sends a single CTA per block (`ctaLabel`/`ctaHref`) —
  // `primary`/`secondary` were a speculative two-button design that
  // the API never actually populates. Both are supported here so
  // this keeps working if that ever changes, but real content today
  // always comes through as `ctaLabel`/`ctaHref`.
  const primaryLabel = block.primary || block.ctaLabel;
  const primaryHref = block.primaryHref || block.ctaHref;
  return (
    <div className="my-8 flex flex-wrap gap-4">
      {primaryLabel && (
        <a
          href={primaryHref || '#'}
          className="inline-flex items-center gap-2 rounded-md bg-[#159b89] px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#20aaa0]"
        >
          {primaryLabel}
        </a>
      )}
      {block.secondary && (
        <a
          href={block.secondaryHref || '#'}
          className="inline-flex items-center rounded-md border border-[#20aaa0]/70 px-7 py-3.5 text-sm font-semibold text-[#f4f1e9] transition-all hover:bg-[#20aaa0]/10"
        >
          {block.secondary}
        </a>
      )}
    </div>
  );
}

function QuoteBlock({ block }: { block: SectionBlock }) {
  return (
    <blockquote className="my-8 border-l-2 border-[#20aaa0] pl-6">
      <p className="font-serif text-xl italic leading-relaxed text-[#f4f1e9]">
        "{block.content || block.body}"
      </p>
      {block.author && (
        <footer className="mt-3 text-sm text-[#718387]">— {block.author}</footer>
      )}
    </blockquote>
  );
}

export function BlockRenderer({ block }: { block: SectionBlock }) {
  switch (block.type) {
    case 'HEADING':
      return <HeadingBlock block={block} />;
    case 'PARAGRAPH':
      return <ParagraphBlock block={block} />;
    case 'IMAGE':
      return <ImageBlock block={block} />;
    case 'CTA':
      return <CTABlock block={block} />;
    case 'QUOTE':
      return <QuoteBlock block={block} />;
    default:
      return null;
  }
}

/* ---------------------------------------------------------------
   CUSTOM SECTION WRAPPER
--------------------------------------------------------------- */
function CustomSection({ section }: { section: HomepageSection }) {
  return (
    <section className="relative w-full bg-[#06151a] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {section.blocks && section.blocks.length > 0 ? (
          section.blocks.map((block, idx) => (
            <BlockRenderer key={idx} block={block} />
          ))
        ) : (
          section.content && (
            <p className="text-[15px] leading-7 text-[#aab9bd]">{section.content}</p>
          )
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------
   MAIN SECTION RENDERER
--------------------------------------------------------------- */
interface SectionRendererProps {
  section: HomepageSection;
  heroBannerData?: any;
  servicesData?: any[];
  statsData?: any[];
  aboutData?: any;
  certificatesData?: any[];
}

export const SectionRenderer: React.FC<SectionRendererProps> = ({
  section,
  heroBannerData,
  servicesData,
  statsData,
  aboutData,
  certificatesData,
}) => {
  switch (section.type) {
    case 'HERO':
      return <Banner bannerData={heroBannerData} />;

    case 'SERVICES':
      return <Services servicesData={servicesData} />;

    case 'STATS':
      return <StatsSection statsData={statsData} />;

    case 'CERTIFICATES':
      return <CertificatesSection certificatesData={certificatesData} />;

    case 'OFFICE':
      return <OfficeSection />;

    case 'WOMEN_HEALTH':
      return <WomenHealth />;

    case 'SUPPORT':
      return <Support />;

    case 'VIDEO':
      return <VideoSection />;

    case 'TESTIMONIALS':
      return <Testimonials />;

    case 'ABOUT':
      return <AboutSection aboutData={aboutData} />;

    case 'CONTACT':
      return (
        <section className="w-full bg-[#06151a] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <ContactForm
              title={section.title || 'Get in Touch'}
              subtitle={section.subtitle || 'We respond within 24 hours.'}
            />
          </div>
        </section>
      );

    case 'APPOINTMENT':
      return (
        <section className="w-full bg-[#06151a] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <AppointmentForm
              title={section.title || 'Book an Appointment'}
              subtitle={section.subtitle || 'Our team will confirm your appointment.'}
            />
          </div>
        </section>
      );

    case 'DYNAMIC_FORM':
      return (
        <section className="w-full bg-[#06151a] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <DynamicFormRenderer
              fields={section.formFields || []}
              title={section.title}
              subtitle={section.subtitle}
              submitLabel={section.submitLabel}
            />
          </div>
        </section>
      );

    case 'CUSTOM':
    default:
      return <CustomSection section={section} />;
  }
};

export default SectionRenderer;
