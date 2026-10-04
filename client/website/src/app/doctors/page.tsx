import type { Metadata } from 'next';
import { DoctorsSection } from '@/components/Doctors/DoctorsSection';
import { fetchDoctors } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Our Doctors',
  description:
    "Meet the doctors and specialists at Ash-Shāfī providing compassionate women's healthcare in Dhaka.",
};

export const revalidate = 60;

export default async function DoctorsPage() {
  const doctors = await fetchDoctors();

  return (
    <>
      {/* PAGE HERO */}
      <section className="relative w-full overflow-hidden bg-[#030b0e] px-5 pb-10 pt-20 sm:px-8 lg:px-14">
        <div className="absolute left-1/2 top-0 h-64 w-[700px] -translate-x-1/2 rounded-full bg-[#20aaa0]/[0.04] blur-[100px]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-[#20aaa0]/60" />
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-[#20aaa0]">
              Meet Our Team
            </span>
            <span className="h-px w-8 bg-[#20aaa0]/60" />
          </div>
          <h1 className="font-serif text-4xl font-medium text-[#f4f1e9] sm:text-5xl lg:text-6xl">
            Our Doctors
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-[#aab9bd]">
            Experienced, compassionate specialists dedicated to your care at every stage of life.
          </p>
        </div>
      </section>

      <DoctorsSection doctorsData={doctors} />
    </>
  );
}
