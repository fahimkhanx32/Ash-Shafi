'use client';

import React from 'react';
import Link from 'next/link';
import { FaPersonPregnant, FaPersonBreastfeeding } from 'react-icons/fa6';
import { GiHeavyThornyTriskelion } from 'react-icons/gi';
import { PiFlowerLotusLight } from 'react-icons/pi';
import { CalendarDays, ArrowRight } from 'lucide-react';

export const Support: React.FC = () => {
  return (
    <section
      id="support"
      className="relative min-h-screen w-full overflow-hidden bg-black bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage:
          "url('https://res.cloudinary.com/fhsrf5ps/image/upload/v1787545755/pragnant_woman.webp')",
      }}
    >
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen w-full items-center justify-end px-6 py-16 sm:px-10 lg:px-16">
        {/* SUPPORT CONTENT */}
        <div className="w-full max-w-2xl text-left">
          {/* HEADING */}
          <div className="max-w-[850px]">
            <h2 className="font-serif text-[22px] font-medium leading-[1.08] tracking-[-0.02em] text-[#f4f1e9] sm:text-[30px] lg:text-[40px] xl:text-[42px]">
              Your Journey. Our Support.
              <br />
              <span className="text-[#20aaa0]">Together Every Step of the Way.</span>
            </h2>

            {/* DESCRIPTION + BUTTON */}
            <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-7">
              <p className="max-w-[570px] flex-1 font-sans text-[14px] font-light leading-6 text-[#e7e8e4]/80 sm:text-[15px] sm:leading-7 xl:text-[16px]">
                Whether you&apos;re planning your pregnancy, expecting, or focusing on your wellness, we&apos;re here to guide and support you with expert care.
              </p>

              {/* Consultation Button */}
              <Link
                href="/appointment"
                className="group inline-flex shrink-0 items-center justify-center gap-3 rounded-[10px] border border-[#72d5cd]/60 bg-[#087d79]/60 px-5 py-3 text-[13px] font-medium tracking-wide text-white backdrop-blur-sm transition-all duration-300 hover:border-[#20aaa0] hover:bg-[#0b918b]/70 hover:shadow-[0_0_30px_rgba(32,170,160,0.18)] sm:px-6 sm:py-3.5"
              >
                <CalendarDays size={18} strokeWidth={1.5} />
                <span className="whitespace-nowrap">Schedule a Consultation</span>
                <ArrowRight
                  size={16}
                  strokeWidth={1.5}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            </div>
          </div>

          {/* DECORATIVE DIVIDER */}
          <div className="mt-3 flex w-full items-center">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#20aaa0]/20 to-[#20aaa0]/60"></div>
            <div className="mx-4 flex h-7 w-10 shrink-0 items-center justify-center">
              <svg viewBox="0 0 50 35" className="h-7 w-9 text-[#20aaa0]" fill="none">
                <path d="M25 31C25 22 25 14 19 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M22 18C16 17 11 14 10 9C16 9 20 12 22 18Z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M25 14C30 13 34 9 35 4C29 4 26 8 25 14Z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M25 23C31 22 36 18 38 13C32 13 27 17 25 23Z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#20aaa0]/20 to-[#20aaa0]/60"></div>
          </div>

          {/* SERVICES 4 PILLARS */}
          <div className="mt-3 grid w-fit grid-cols-2 gap-4 sm:grid-cols-4">

            {/* PRECONCEPTION */}
            <div className="group flex h-[145px] flex-col items-center justify-start">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full">
                <div className="absolute inset-0 rounded-full border border-transparent border-t-[#20aaa0]/50 transition-all duration-500 group-hover:border-[#20aaa0]/80 group-hover:shadow-[0_0_18px_rgba(32,170,160,0.18)]"></div>
                <FaPersonPregnant className="text-3xl text-[#f4f1e9] transition-all duration-300 group-hover:text-[#20aaa0]" />
              </div>
              <h4 className="mt-2 text-center font-serif text-[15px] leading-5 text-[#f4f1e9] transition-colors duration-300 group-hover:text-[#20aaa0]">
                Preconception
                <br />
                Counseling
              </h4>
              <div className="mt-1 h-px w-14 bg-[#20aaa0]/50 transition-all duration-300 group-hover:w-[72px] group-hover:bg-[#20aaa0]"></div>
            </div>

            {/* HIGH RISK */}
            <div className="group flex h-[145px] flex-col items-center justify-start pl-3 border-l border-white/15">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full">
                <div className="absolute inset-0 rounded-full border border-transparent border-t-[#20aaa0]/50 transition-all duration-500 group-hover:border-[#20aaa0]/80 group-hover:shadow-[0_0_18px_rgba(32,170,160,0.18)]"></div>

                <GiHeavyThornyTriskelion className="text-3xl text-[#f4f1e9] transition-all duration-300 group-hover:text-[#20aaa0]" />
              </div>

              <h4 className="mt-2 text-center font-serif text-[15px] leading-5 text-[#f4f1e9] transition-colors duration-300 group-hover:text-[#20aaa0]">
                High-Risk
                <br />
                Pregnancy Care
              </h4>

              <div className="mt-1 h-px w-14 bg-[#20aaa0]/50 transition-all duration-300 group-hover:w-[72px] group-hover:bg-[#20aaa0]"></div>
            </div>


            {/* NUTRITION */}
            <div className="group flex h-[145px] flex-col items-center justify-start border-l border-white/15">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full">
                <div className="absolute inset-0 rounded-full border border-transparent border-t-[#20aaa0]/50 transition-all duration-500 group-hover:border-[#20aaa0]/80 group-hover:shadow-[0_0_18px_rgba(32,170,160,0.18)]"></div>
                <PiFlowerLotusLight className="text-4xl text-[#f4f1e9] transition-all duration-300 group-hover:text-[#20aaa0]" />
              </div>
              <h4 className="mt-2 text-center font-serif text-[15px] leading-5 text-[#f4f1e9] transition-colors duration-300 group-hover:text-[#20aaa0]">
                Nutrition &
                <br />
                Wellness
              </h4>
              <div className="mt-1 h-px w-14 bg-[#20aaa0]/50 transition-all duration-300 group-hover:w-[72px] group-hover:bg-[#20aaa0]"></div>
            </div>

            {/* LACTATION */}
            <div className="group flex h-[145px] flex-col items-center justify-start border-l border-white/15">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full">
                <div className="absolute inset-0 rounded-full border border-transparent border-t-[#20aaa0]/50 transition-all duration-500 group-hover:border-[#20aaa0]/80 group-hover:shadow-[0_0_18px_rgba(32,170,160,0.18)]"></div>
                <FaPersonBreastfeeding className="text-3xl text-[#f4f1e9] transition-all duration-300 group-hover:text-[#20aaa0]" />
              </div>
              <h4 className="mt-2 text-center font-serif text-[15px] leading-5 text-[#f4f1e9] transition-colors duration-300 group-hover:text-[#20aaa0]">
                Lactation
                <br />
                Support
              </h4>
              <div className="mt-1 h-px w-14 bg-[#20aaa0]/50 transition-all duration-300 group-hover:w-[72px] group-hover:bg-[#20aaa0]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM DECORATIVE WAVE */}
      <div className="pointer-events-none absolute bottom-[-20px] left-0 w-full overflow-hidden">
        <div className="relative h-32 w-full">
          <div className="absolute bottom-0 left-[-5%] h-20 w-[65%] rotate-[8deg] rounded-[50%] border-t border-white/20"></div>
          <div className="absolute bottom-[-5px] left-[15%] h-20 w-[65%] rotate-[-5deg] rounded-[50%] border-t border-white/15"></div>
          <div className="absolute bottom-[-15px] right-[-5%] h-24 w-[60%] rotate-[-10deg] rounded-[50%] border-t border-white/20"></div>
        </div>
      </div>
    </section>
  );
};

export default Support;
