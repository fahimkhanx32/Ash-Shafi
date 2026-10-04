'use client';

import React from 'react';
import { FaUserMd, FaBriefcaseMedical, FaGraduationCap } from 'react-icons/fa';
import { PublicDoctor } from '@/types/cms';

interface DoctorsSectionProps {
  doctorsData?: PublicDoctor[] | null;
}

/**
 * Public "Doctors" listing (master prompt §39/§40, navbar item added
 * in `seed-homepage-content.js`). This didn't exist at all before —
 * unlike Certificates/About, there was no bespoke component and no
 * `/doctors` route, only a nav link pointing at a URL the catch-all
 * `[...slug]` route had no CMS `Page` for, so it 404'd. Backed by the
 * real `GET /staff/public/doctors` endpoint (`fetchDoctors()`), which
 * already existed server-side with narrowed public fields — this was
 * a missing frontend page, not a missing API.
 */
export const DoctorsSection: React.FC<DoctorsSectionProps> = ({ doctorsData }) => {
  const doctors = doctorsData || [];

  if (doctors.length === 0) {
    return (
      <section className="relative w-full bg-[#06151a] px-5 py-16 sm:px-8 lg:px-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[15px] leading-7 text-[#aab9bd]">
            Our doctor roster is being updated — please check back soon, or contact us directly to
            book an appointment.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full bg-[#06151a] px-5 py-16 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="group flex flex-col rounded-xl border border-[#1b5558]/40 bg-[#081b20] p-6 shadow-[0_5px_20px_rgba(0,0,0,0.25)] transition-all duration-300 hover:-translate-y-1 hover:border-[#20aaa0]/60 hover:bg-[#0a2429]"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#20aaa0]/30 bg-[#159c92]/[0.08] text-[#29b9ad]">
                <FaUserMd className="text-2xl" />
              </div>

              <h3 className="font-serif text-xl font-medium leading-tight text-[#f4f1e9]">
                {doctor.name}
              </h3>

              {doctor.specialization && (
                <p className="mt-1 text-[13px] font-medium uppercase tracking-[0.1em] text-[#20aaa0]">
                  {doctor.specialization}
                </p>
              )}

              {doctor.bio && (
                <p className="mt-3 text-[14px] leading-6 text-[#aab9bd]">{doctor.bio}</p>
              )}

              <div className="mt-4 flex flex-col gap-2 border-t border-[#1b5558]/30 pt-4 text-[13px] text-[#8fa3a7]">
                {doctor.qualifications && doctor.qualifications.length > 0 && (
                  <div className="flex items-start gap-2">
                    <FaGraduationCap className="mt-0.5 shrink-0 text-[#20aaa0]" />
                    <span>{doctor.qualifications.join(', ')}</span>
                  </div>
                )}
                {doctor.yearsOfExperience > 0 && (
                  <div className="flex items-center gap-2">
                    <FaBriefcaseMedical className="shrink-0 text-[#20aaa0]" />
                    <span>{doctor.yearsOfExperience}+ years of experience</span>
                  </div>
                )}
                {doctor.department && <span className="text-[#6f8286]">{doctor.department}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DoctorsSection;
