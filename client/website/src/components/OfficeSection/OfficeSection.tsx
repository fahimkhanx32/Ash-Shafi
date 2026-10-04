'use client';

import React from 'react';
import {
  FaHospital,
  FaStethoscope,
  FaMapMarkerAlt,
  FaCheckCircle,
} from 'react-icons/fa';
import { useI18n } from '@/lib/i18nContext';

export const OfficeSection: React.FC = () => {
  const { t } = useI18n();

  return (
    <section
      id="office"
      className="relative isolate min-h-screen w-full overflow-hidden bg-[#081117]"
      style={{
        backgroundImage: `
          linear-gradient(
            90deg,
            rgba(5, 12, 18, 0.96) 0%,
            rgba(5, 12, 18, 0.88) 35%,
            rgba(5, 12, 18, 0.48) 65%,
            rgba(5, 12, 18, 0.72) 100%
          ),
          url("https://res.cloudinary.com/fhsrf5ps/image/upload/v1787428069/bg_for_jobplace.webp")
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* BACKGROUND GLOWS */}
      <div className="pointer-events-none absolute -right-40 top-1/2 h-[450px] w-[450px] -translate-y-1/2 rounded-full bg-[#119b91]/10 blur-[120px]" />
      <div className="pointer-events-none absolute -left-40 bottom-0 h-[300px] w-[300px] rounded-full bg-[#0b6670]/10 blur-[100px]" />

      {/* MAIN CONTAINER */}
      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-5 py-12 sm:px-8 lg:px-10 lg:py-0">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8 xl:gap-12">
          {/* LEFT SIDE */}
          <div className="max-w-xl">
            {/* Eyebrow */}
            <div className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-[#159c92]/25 bg-[#0c2027]/70 px-4 py-2 backdrop-blur-md">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#159c92]/10 text-[#29b9ad]">
                <FaHospital className="text-xs" />
              </span>
              <span className="text-sm font-medium tracking-wide text-[#55c8bf]">
                {t.office.eyebrow}
              </span>
            </div>

            {/* Heading */}
            <h2 className="text-2xl font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl lg:text-[40px]">
              {t.office.heading}{' '}
              <span className="text-[#20aaa0]">{t.office.highlight}</span>
            </h2>

            {/* Description */}
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-slate-300/80 sm:text-[16px]">
              {t.office.description}
            </p>

            {/* SPECIALTY CARDS */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {/* Gynecology */}
              <div className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3.5 backdrop-blur-md transition-all duration-300 hover:border-[#159c92]/30 hover:bg-[#159c92]/[0.06]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#159c92]/20 bg-[#159c92]/10 text-[#29b9ad]">
                  <FaStethoscope />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Gynecology</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Specialized women&apos;s care</p>
                </div>
              </div>

              {/* Obstetrics */}
              <div className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3.5 backdrop-blur-md transition-all duration-300 hover:border-[#159c92]/30 hover:bg-[#159c92]/[0.06]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#159c92]/20 bg-[#159c92]/10 text-[#29b9ad]">
                  <FaHospital />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Obstetrics</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Pregnancy & maternity care</p>
                </div>
              </div>
            </div>

            {/* HOSPITAL INFORMATION */}
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4 backdrop-blur-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#159c92]/10 text-[#29b9ad]">
                <FaMapMarkerAlt />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#40bdb4]">
                  {t.office.locationTitle}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-white">
                  {t.office.hospitalName}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t.office.hospitalLocation}
                </p>
              </div>
            </div>

            {/* FEATURES */}
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <FaCheckCircle className="shrink-0 text-[#20aaa0]" />
                Patient-centered consultation
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <FaCheckCircle className="shrink-0 text-[#20aaa0]" />
                Evidence-based medical care
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <FaCheckCircle className="shrink-0 text-[#20aaa0]" />
                Women&apos;s health services
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <FaCheckCircle className="shrink-0 text-[#20aaa0]" />
                Personalized care & guidance
              </div>
            </div>
          </div>

          {/* RIGHT SIDE — DOCTOR */}
          <div className="relative flex h-[520px] items-end justify-center lg:h-[600px] lg:justify-end">
            {/* Ambient circles */}
            <div className="absolute bottom-[3%] right-[5%] h-[360px] w-[360px] rounded-full border border-white/[0.06] bg-[#1c4650]/10 shadow-[0_0_100px_rgba(25,139,143,0.10)] sm:h-[430px] sm:w-[430px] lg:h-[500px] lg:w-[500px]" />
            <div className="absolute bottom-[7%] right-[12%] h-[290px] w-[290px] rounded-full border border-[#36aaa7]/10 bg-[#173a43]/10 sm:h-[360px] sm:w-[360px] lg:h-[410px] lg:w-[410px]" />
            <div className="absolute bottom-[8%] right-[10%] h-[330px] w-[300px] rounded-full bg-[#159c92]/10 blur-[70px]" />

            {/* DOCTOR IMAGE */}
            <div className="relative z-10 mt-auto w-full max-w-[450px] translate-y-[2%] sm:max-w-[480px] lg:max-w-[500px]">
              <img
                src="https://res.cloudinary.com/fhsrf5ps/image/upload/v1786857858/ash-shafi/website/media/bb716376-f52e-4442-89ae-e075d1d2d46b.webp.webp"
                alt="Ash-Shāfī - Gynecology and Obstetrics Specialist"
                className="mx-auto h-auto w-full object-contain drop-shadow-[0_25px_50px_rgba(0,0,0,0.45)]"
              />
            </div>

            {/* PROFILE CARD */}
            <div className="absolute bottom-[3%] right-0 z-20 w-[250px] rounded-3xl border border-white/[0.12] bg-[#0b171d]/85 p-4 shadow-[0_20px_55px_rgba(0,0,0,0.40)] backdrop-blur-xl sm:w-[275px] sm:p-5 lg:right-[-5px]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#31b5ac]/20 bg-[#159c92] text-white shadow-[0_8px_20px_rgba(21,156,146,0.20)]">
                  <FaStethoscope className="text-base" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Ash-Shāfī</h3>
                  <p className="mt-0.5 text-xs font-medium text-[#29b9ad]">
                    Gynecology & Obstetrics
                  </p>
                </div>
              </div>

              <div className="my-4 h-px bg-gradient-to-r from-white/[0.12] via-white/[0.08] to-transparent" />

              <div className="flex items-start gap-2.5">
                <FaHospital className="mt-0.5 shrink-0 text-sm text-[#29b9ad]" />
                <div>
                  <p className="text-xs font-semibold text-white">City Hospital</p>
                  <p className="mt-0.5 text-[11px] leading-5 text-slate-400">
                    Mohammadpur, Dhaka
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-300/75">
                Dedicated to providing trusted, compassionate care for women through every stage of life.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OfficeSection;
