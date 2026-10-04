'use client';

import React from 'react';
import { FaCertificate } from 'react-icons/fa';
import { CMSCertificate } from '@/types/cms';

interface CertificatesSectionProps {
  certificatesData?: CMSCertificate[] | null;
}

/**
 * FET-16 completion pass — homepage "Certified Care & Compliance"
 * grid, driven by the CMS `Certificate` collection
 * (`fetchCertificates()`). This is one of the five built-in
 * `HomepageSection` types (`CERTIFICATES`, seeded at `order: 2` —
 * `dynamic-site.service.js`'s `BUILT_IN_SECTION_SEEDS`) that had a
 * full CRUD admin tab (`CertificatesTab.jsx`) but no public-facing
 * renderer at all — `SectionRenderer.tsx` had no `CERTIFICATES` case,
 * so it silently fell through to the generic `CUSTOM` block renderer,
 * which has nothing to render for a built-in section (no `blocks`).
 * Renders nothing if the admin hasn't added any certificates yet,
 * rather than showing placeholder logos that aren't real.
 */
export const CertificatesSection: React.FC<CertificatesSectionProps> = ({ certificatesData }) => {
  const certificates = (certificatesData || []).filter((c) => c.isActive !== false);
  if (certificates.length === 0) return null;

  return (
    <section className="relative w-full bg-[#030b0e] px-5 py-16 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center gap-4">
          <span className="h-px w-10 bg-[#20aaa0]" />
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-[#20aaa0]">
            Certified Care &amp; Compliance
          </span>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {certificates.map((cert) => (
            <div
              key={cert._id}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#20aaa0]/[0.10] bg-[#06151a] p-5 text-center transition-colors hover:border-[#20aaa0]/30"
            >
              {cert.image?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cert.image.url} alt={cert.name} className="h-12 w-auto max-w-full object-contain" />
              ) : (
                <FaCertificate className="text-3xl text-[#20aaa0]" />
              )}
              <p className="text-xs font-medium leading-tight text-[#aab9bd]">{cert.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CertificatesSection;
