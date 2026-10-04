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
  FaCheck,
} from 'react-icons/fa';

export const About: React.FC = () => {
  return (
    <main className="w-full overflow-hidden bg-[#030b0e] text-[#f4f1e9]">
      {/* =========================================================
          HERO
      ========================================================= */}
      <section className="relative min-h-[80vh] w-full overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage:
              "url('https://res.cloudinary.com/fhsrf5ps/image/upload/v1786857858/ash-shafi/website/media/bb716376-f52e-4442-89ae-e075d1d2d46b.webp.webp')",
          }}
        />

        {/* Dark cinematic overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#030b0e] via-[#030b0e]/85 to-[#030b0e]/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#030b0e] via-transparent to-[#030b0e]/30" />

        {/* Teal atmosphere */}
        <div className="pointer-events-none absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-[#20aaa0]/[0.045] blur-[130px]" />

        {/* Content */}
        <div className="relative z-10 mx-auto flex min-h-[80vh] w-full max-w-[1450px] items-center px-5 py-24 sm:px-8 lg:px-14 xl:px-20">
          <div className="max-w-[720px]">
            {/* Eyebrow */}
            <div className="mb-6 flex items-center gap-4">
              <span className="h-px w-10 bg-[#20aaa0]" />
              <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-[#20aaa0] sm:text-[11px]">
                About Ash-Shāfī
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-serif text-[42px] font-medium leading-[1.08] tracking-[-0.025em] sm:text-[54px] lg:text-[68px] xl:text-[76px]">
              Medicine with
              <br />
              <span className="text-[#20aaa0]">purpose.</span>
              <br />
              Care with meaning.
            </h1>

            {/* Description */}
            <p className="mt-7 max-w-[620px] text-[14px] font-light leading-7 text-[#d5ddde]/80 sm:text-[16px] sm:leading-8">
              Ash-Shāfī is a medical practitioner focused on women&apos;s health, gynecology and obstetrics, with clinical experience developed through medical education, hospital practice and continued professional training.
            </p>

            {/* CTA */}
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/appointment"
                className="group inline-flex items-center gap-3 rounded-lg bg-[#20aaa0] px-6 py-3.5 text-[12px] font-medium tracking-wide text-[#031012] transition-all duration-300 hover:bg-[#39bdb4] hover:shadow-[0_0_30px_rgba(32,170,160,0.18)]"
              >
                <span>Book an Appointment</span>
                <FaArrowRight className="text-[10px] transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              <a
                href="#credentials"
                className="inline-flex items-center rounded-lg border border-white/15 bg-white/[0.03] px-6 py-3.5 text-[12px] font-medium tracking-wide text-[#e8eeee] backdrop-blur-sm transition-all duration-300 hover:border-[#20aaa0]/50 hover:bg-[#20aaa0]/[0.06]"
              >
                Explore Credentials
              </a>
            </div>
          </div>
        </div>

        {/* Bottom decorative line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#20aaa0]/30 to-transparent" />
      </section>

      {/* =========================================================
          INTRODUCTION
      ========================================================= */}
      <section className="relative w-full bg-[#050f12] px-5 py-20 sm:px-8 lg:px-14 lg:py-28">
        <div className="mx-auto grid max-w-[1250px] grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-[#20aaa0]" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#20aaa0]">
                The Doctor
              </span>
            </div>
            <h2 className="mt-5 max-w-[420px] font-serif text-[34px] leading-[1.15] text-[#f4f1e9] sm:text-[42px]">
              A medical journey built on learning.
            </h2>
          </div>

          <div className="max-w-[700px]">
            <p className="text-[15px] font-light leading-8 text-[#b9c5c7]">
              Ash-Shāfī&apos;s journey into medicine began with a strong academic foundation and continued through medical education, clinical exposure and hands-on hospital experience.
            </p>
            <p className="mt-6 text-[15px] font-light leading-8 text-[#b9c5c7]">
              Her clinical interests center around gynecology and obstetrics, with particular attention to pregnancy care, reproductive health and the changing healthcare needs of women throughout different stages of life.
            </p>
            <p className="mt-6 text-[15px] font-light leading-8 text-[#b9c5c7]">
              Alongside clinical practice, she continues to expand her knowledge through professional medical training and educational programs, reflecting a commitment to continuous learning in modern medicine.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================
          EDUCATION
      ========================================================= */}
      <section className="relative w-full bg-[#030b0e] px-5 py-20 sm:px-8 lg:px-14 lg:py-28">
        <div className="mx-auto max-w-[1250px]">
          <div className="mb-12">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-[#20aaa0]" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#20aaa0]">
                Academic Foundation
              </span>
            </div>
            <h2 className="mt-5 font-serif text-[34px] sm:text-[44px]">
              Education & Qualifications
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Secondary Education */}
            <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#20aaa0]/30 hover:bg-[#20aaa0]/[0.035]">
              <div className="flex items-start gap-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#20aaa0]/25 bg-[#20aaa0]/[0.06] text-[#20aaa0]">
                  <FaGraduationCap className="text-xl" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#20aaa0]">
                    Secondary Education
                  </p>
                  <h3 className="mt-2 font-serif text-[23px] text-[#f4f1e9]">HSC</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#9fadaf]">
                    Scholars School and College
                  </p>
                </div>
              </div>
            </div>

            {/* Medical Degree */}
            <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#20aaa0]/30 hover:bg-[#20aaa0]/[0.035]">
              <div className="flex items-start gap-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#20aaa0]/25 bg-[#20aaa0]/[0.06] text-[#20aaa0]">
                  <FaStethoscope className="text-xl" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#20aaa0]">
                    Medical Degree
                  </p>
                  <h3 className="mt-2 font-serif text-[23px] text-[#f4f1e9]">MBBS</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#9fadaf]">
                    Medical education completed in China
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          CLINICAL PRACTICE
      ========================================================= */}
      <section className="relative w-full overflow-hidden bg-[#061317] px-5 py-20 sm:px-8 lg:px-14 lg:py-28">
        <div className="pointer-events-none absolute right-[-150px] top-1/2 h-[450px] w-[450px] -translate-y-1/2 rounded-full bg-[#20aaa0]/[0.035] blur-[120px]" />

        <div className="relative mx-auto max-w-[1250px]">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-20">
            <div className="relative">
              <div className="absolute -inset-3 rounded-[24px] border border-[#20aaa0]/10" />
              <div className="relative aspect-[4/5] overflow-hidden rounded-[20px]">
                <img
                  src="https://res.cloudinary.com/fhsrf5ps/image/upload/v1786857858/ash-shafi/website/media/bb716376-f52e-4442-89ae-e075d1d2d46b.webp.webp"
                  alt="Ash-Shāfī"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030b0e]/60 via-transparent to-[#030b0e]/10" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-[#20aaa0]" />
                <span className="text-[10px] uppercase tracking-[0.3em] text-[#20aaa0]">
                  Clinical Practice
                </span>
              </div>

              <h2 className="mt-5 font-serif text-[36px] leading-[1.12] sm:text-[46px]">
                Experience where <span className="text-[#20aaa0]">medicine meets practice.</span>
              </h2>

              <p className="mt-6 text-[14px] font-light leading-7 text-[#aebcbe] sm:text-[15px] sm:leading-8">
                Ash-Shāfī has clinical experience in gynecology and obstetrics, including hospital-based exposure to gynecological and obstetric procedures.
              </p>

              <p className="mt-5 text-[14px] font-light leading-7 text-[#aebcbe] sm:text-[15px] sm:leading-8">
                Her experience includes assisting with operations and supporting clinical teams in the hospital setting, providing valuable exposure to the practical aspects of obstetric and gynecological care.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  'Gynecology & Obstetrics',
                  'Hospital-based clinical practice',
                  'Gynecological & obstetric procedures',
                  'Clinical team collaboration',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#20aaa0]/30 bg-[#20aaa0]/[0.06] text-[#20aaa0]">
                      <FaCheck className="text-[8px]" />
                    </span>
                    <span className="text-[13px] text-[#bdc8ca]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          REGISTRATION / PROFESSIONAL STATUS
      ========================================================= */}
      <section id="credentials" className="w-full bg-[#030b0e] px-5 py-20 sm:px-8 lg:px-14 lg:py-24">
        <div className="mx-auto max-w-[1250px]">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* BMDC */}
            <div className="rounded-2xl border border-[#20aaa0]/20 bg-[#20aaa0]/[0.035] p-7">
              <FaCertificate className="text-2xl text-[#20aaa0]" />
              <p className="mt-5 text-[10px] uppercase tracking-[0.25em] text-[#20aaa0]">
                Professional Registration
              </p>
              <h3 className="mt-2 font-serif text-[22px]">BM&DC Registered</h3>
              <p className="mt-3 text-[12px] leading-6 text-[#9fadaf]">
                Registered medical practitioner in Bangladesh.
              </p>
            </div>

            {/* Clinical */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-7">
              <FaHospital className="text-2xl text-[#20aaa0]" />
              <p className="mt-5 text-[10px] uppercase tracking-[0.25em] text-[#20aaa0]">
                Clinical Experience
              </p>
              <h3 className="mt-2 font-serif text-[22px]">Gynecology & Obstetrics</h3>
              <p className="mt-3 text-[12px] leading-6 text-[#9fadaf]">
                Hospital-based clinical experience and procedural exposure.
              </p>
            </div>

            {/* Philosophy */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-7">
              <FaHeart className="text-2xl text-[#20aaa0]" />
              <p className="mt-5 text-[10px] uppercase tracking-[0.25em] text-[#20aaa0]">
                Professional Philosophy
              </p>
              <h3 className="mt-2 font-serif text-[22px]">Continuous Learning</h3>
              <p className="mt-3 text-[12px] leading-6 text-[#9fadaf]">
                Committed to ongoing medical education and professional development.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          PERSONAL PHILOSOPHY
      ========================================================= */}
      <section className="relative w-full overflow-hidden bg-[#030b0e] px-5 py-24 sm:px-8 lg:px-14 lg:py-32">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[450px] w-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#20aaa0]/[0.025] blur-[120px]" />
        <div className="relative mx-auto max-w-[900px] text-center">
          <span className="font-serif text-[65px] leading-none text-[#20aaa0]/30">“</span>
          <h2 className="mt-[-10px] font-serif text-[32px] leading-[1.25] text-[#f4f1e9] sm:text-[42px] lg:text-[48px]">
            Medicine is not only about treating illness. It is about understanding the person behind it.
          </h2>
          <div className="mx-auto mt-8 h-px w-12 bg-[#20aaa0]" />
          <p className="mt-5 text-[11px] uppercase tracking-[0.3em] text-[#20aaa0]">
            Ash-Shāfī
          </p>
        </div>
      </section>

      {/* =========================================================
          CTA
      ========================================================= */}
      <section className="relative w-full overflow-hidden bg-[#061317] px-5 py-20 sm:px-8 lg:px-14 lg:py-24">
        <div className="relative mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-8 rounded-[24px] border border-[#20aaa0]/15 bg-[#20aaa0]/[0.035] px-7 py-10 text-center sm:px-12 lg:flex-row lg:text-left">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#20aaa0]">
              Begin Your Care Journey
            </p>
            <h2 className="mt-3 font-serif text-[30px] text-[#f4f1e9] sm:text-[38px]">
              Your health deserves thoughtful care.
            </h2>
          </div>

          <Link
            href="/appointment"
            className="group inline-flex shrink-0 items-center gap-3 rounded-lg bg-[#20aaa0] px-7 py-3.5 text-[12px] font-medium text-[#031012] transition-all duration-300 hover:bg-[#39bdb4] hover:shadow-[0_0_30px_rgba(32,170,160,0.18)]"
          >
            <span>Book an Appointment</span>
            <FaArrowRight className="text-[10px] transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </main>
  );
};

export default About;
