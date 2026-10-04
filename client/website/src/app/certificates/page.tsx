import type { Metadata } from 'next';
import { CertificatesSection } from '@/components/Certificates/CertificatesSection';
import { fetchCertificates } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Certifications',
  description:
    "Certifications, accreditations, and compliance credentials behind Ash-Shāfī's women's healthcare practice in Dhaka.",
};

export const revalidate = 60;

export default async function CertificatesPage() {
  const certificates = await fetchCertificates();

  return (
    <>
      {/* PAGE HERO — mirrors app/doctors/page.tsx's header treatment */}
      <section className="relative w-full overflow-hidden bg-[#030b0e] px-5 pb-10 pt-20 sm:px-8 lg:px-14">
        <div className="absolute left-1/2 top-0 h-64 w-[700px] -translate-x-1/2 rounded-full bg-[#20aaa0]/[0.04] blur-[100px]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-[#20aaa0]/60" />
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-[#20aaa0]">
              Certified Care &amp; Compliance
            </span>
            <span className="h-px w-8 bg-[#20aaa0]/60" />
          </div>
          <h1 className="font-serif text-4xl font-medium text-[#f4f1e9] sm:text-5xl lg:text-6xl">
            Certifications
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-[#aab9bd]">
            Accreditations, registrations, and compliance standards behind our care.
          </p>
        </div>
      </section>

      {/*
        CertificatesSection already renders `null` when the admin hasn't
        added any certificates yet (see its own doc comment), so unlike
        DoctorsSection there is no separate empty-state to add here —
        that would just duplicate a decision the component already makes.
      */}
      <CertificatesSection certificatesData={certificates} />
    </>
  );
}
