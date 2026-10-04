'use client';

import React from 'react';
import Image from "next/image";
import { Baby, ClipboardCheck, Heart, MessageCircle, Leaf, UsersRound } from "lucide-react";

export const WomenHealth = () => {
  return (
    <section className="relative h-screen min-h-screen w-full overflow-hidden bg-[#061419]">

      {/* Background Glow */}
      <div className="pointer-events-none absolute -left-40 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[#159c92]/10 blur-[140px]" />

      <div className="pointer-events-none absolute right-0 top-0 h-[450px] w-[450px] rounded-full bg-[#0c6c72]/10 blur-[130px]" />

      {/* Main Layout */}
      <div className="relative grid h-full w-full lg:grid-cols-2">

        {/* ================= LEFT IMAGE ================= */}

        <div className="relative h-[40vh] min-h-[300px] overflow-hidden lg:h-full lg:min-h-0">

          <Image
            src="https://res.cloudinary.com/fhsrf5ps/image/upload/v1787432159/counselling_illustration.webp"
            alt="Doctor counselling a patient"
            fill
            className="object-cover object-center"
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
          />

          {/* Right Gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#061419]" />

          {/* Mobile Bottom Gradient */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#061419]/80 to-transparent lg:hidden" />

          {/* Teal Overlay */}
          <div className="pointer-events-none absolute inset-0 bg-[#159c92]/[0.035] mix-blend-screen" />

          {/* Decorative Leaf */}
          <div className="absolute bottom-8 left-8 hidden opacity-30 lg:block">
            <Leaf className="h-20 w-20 rotate-[-25deg] text-[#159c92]" strokeWidth={1} />
          </div>
        </div>

        {/* ================= RIGHT CONTENT ================= */}

        <div className="relative h-[60vh] overflow-y-auto lg:h-full lg:overflow-hidden">

          {/* Decorative Leaves */}
          <div className="pointer-events-none absolute right-5 top-5 opacity-[0.10]">
            <Leaf className="h-28 w-28 rotate-[-20deg] text-[#20aaa0]" strokeWidth={1} />
          </div>

          <div className="pointer-events-none absolute bottom-6 right-8 opacity-[0.06]">
            <Leaf className="h-20 w-20 rotate-[25deg] text-[#20aaa0]" strokeWidth={1} />
          </div>

          {/* Content Wrapper */}
          <div className="flex h-full w-full items-center px-6 py-8 sm:px-10 lg:px-12 xl:px-16">

            <div className="relative mx-auto w-full max-w-[720px]">

              {/* ================= HEADING ================= */}

              <div className="mb-3">

                <div className="mb-2 flex items-center gap-3">
                  <span className="h-px w-10 bg-[#159c92]/60" />
                  <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#29b9ad]">
                    Compassionate Care
                  </span>
                </div>

                <h2 className="font-serif text-4xl font-medium leading-tight tracking-[-0.025em] text-[#f2f6f4] sm:text-5xl">
                  Women&apos;s{" "}
                  <span className="text-[#20aaa0]"> Health </span>
                </h2>

                {/* Divider */}
                <div className="mt-1 flex items-center gap-3">
                  <span className="h-px w-16 bg-[#159c92]/50" />
                  <Leaf className="h-4 w-4 text-[#20aaa0]" strokeWidth={1.5} />
                  <span className="h-px w-16 bg-[#159c92]/30" />
                </div>

                {/* Description */}
                <p className="mt-2 max-w-[650px] text-[15px] leading-6 text-slate-300/75 sm:text-[16px] sm:leading-7">
                  Our mission is to support your health and wellbeing through every stage of life, with compassionate care you can trust.
                </p>
              </div>

              {/* ================= SERVICES ================= */}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                {/* Pregnancy Care */}
                <div className="group relative flex min-h-[85px] items-center gap-4 rounded-xl border border-[#159c92]/20 bg-[#081c22]/70 px-4 py-2 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#159c92]/50 hover:bg-[#0b252b] hover:shadow-[0_15px_40px_rgba(21,156,146,0.10)]">

                  <div className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full bg-[#159c92]/30 transition-all duration-300 group-hover:bg-[#20aaa0]" />

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#159c92]/30 bg-[#159c92]/[0.08] text-[#29b9ad] transition-all duration-300 group-hover:border-[#20aaa0]/60 group-hover:bg-[#159c92]/15 group-hover:text-[#42c9bf]">
                    <Baby className="h-5 w-5" strokeWidth={1.6} />
                  </div>

                  <div>
                    <h3 className="font-serif text-[17px] font-medium leading-tight text-[#f1f5f4]">
                      Pregnancy Care
                    </h3>

                    <p className="mt-1 max-w-[240px] text-[12px] leading-5 text-slate-400">
                      Personalised support throughout pregnancy.
                    </p>
                  </div>
                </div>

                {/* Consultation */}
                <div className="group relative flex min-h-[85px] items-center gap-4 rounded-xl border border-[#159c92]/20 bg-[#081c22]/70 px-4 py-2 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#159c92]/50 hover:bg-[#0b252b] hover:shadow-[0_15px_40px_rgba(21,156,146,0.10)]">

                  <div className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full bg-[#159c92]/30 transition-all duration-300 group-hover:bg-[#20aaa0]" />

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#159c92]/30 bg-[#159c92]/[0.08] text-[#29b9ad] transition-all duration-300 group-hover:border-[#20aaa0]/60 group-hover:bg-[#159c92]/15 group-hover:text-[#42c9bf]">
                    <MessageCircle className="h-5 w-5" strokeWidth={1.6} />
                  </div>

                  <div>
                    <h3 className="font-serif text-[17px] font-medium leading-tight text-[#f1f5f4]">
                      Consultation
                    </h3>

                    <p className="mt-1 max-w-[240px] text-[12px] leading-5 text-slate-400">
                      Dedicated time to listen and discuss options.
                    </p>
                  </div>
                </div>

                {/* Assessment */}
                <div className="group relative flex min-h-[85px] items-center gap-4 rounded-xl border border-[#159c92]/20 bg-[#081c22]/70 px-4 py-2 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#159c92]/50 hover:bg-[#0b252b] hover:shadow-[0_15px_40px_rgba(21,156,146,0.10)]">

                  <div className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full bg-[#159c92]/30 transition-all duration-300 group-hover:bg-[#20aaa0]" />

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#159c92]/30 bg-[#159c92]/[0.08] text-[#29b9ad] transition-all duration-300 group-hover:border-[#20aaa0]/60 group-hover:bg-[#159c92]/15 group-hover:text-[#42c9bf]">
                    <ClipboardCheck className="h-5 w-5" strokeWidth={1.6} />
                  </div>

                  <div>
                    <h3 className="font-serif text-[17px] font-medium leading-tight text-[#f1f5f4]">
                      Assessment
                    </h3>

                    <p className="mt-1 max-w-[240px] text-[12px] leading-5 text-slate-400">
                      Understand your concerns and priorities.
                    </p>
                  </div>
                </div>

                {/* Wellbeing */}
                <div className="group relative flex min-h-[85px] items-center gap-4 rounded-xl border border-[#159c92]/20 bg-[#081c22]/70 px-4 py-2 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#159c92]/50 hover:bg-[#0b252b] hover:shadow-[0_15px_40px_rgba(21,156,146,0.10)]">

                  <div className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full bg-[#159c92]/30 transition-all duration-300 group-hover:bg-[#20aaa0]" />

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#159c92]/30 bg-[#159c92]/[0.08] text-[#29b9ad] transition-all duration-300 group-hover:border-[#20aaa0]/60 group-hover:bg-[#159c92]/15 group-hover:text-[#42c9bf]">
                    <Leaf className="h-5 w-5" strokeWidth={1.6} />
                  </div>

                  <div>
                    <h3 className="font-serif text-[17px] font-medium leading-tight text-[#f1f5f4]">
                      Wellbeing
                    </h3>

                    <p className="mt-1 max-w-[240px] text-[12px] leading-5 text-slate-400">
                      Support for your emotional and physical wellbeing.
                    </p>
                  </div>
                </div>

                {/* Care Planning */}
                <div className="group relative flex min-h-[85px] items-center gap-4 rounded-xl border border-[#159c92]/20 bg-[#081c22]/70 px-4 py-2 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#159c92]/50 hover:bg-[#0b252b] hover:shadow-[0_15px_40px_rgba(21,156,146,0.10)]">

                  <div className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full bg-[#159c92]/30 transition-all duration-300 group-hover:bg-[#20aaa0]" />

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#159c92]/30 bg-[#159c92]/[0.08] text-[#29b9ad] transition-all duration-300 group-hover:border-[#20aaa0]/60 group-hover:bg-[#159c92]/15 group-hover:text-[#42c9bf]">
                    <Heart className="h-5 w-5" strokeWidth={1.6} />
                  </div>

                  <div>
                    <h3 className="font-serif text-[17px] font-medium leading-tight text-[#f1f5f4]">
                      Care Planning
                    </h3>

                    <p className="mt-1 max-w-[240px] text-[12px] leading-5 text-slate-400">
                      A tailored plan with clear next steps.
                    </p>
                  </div>
                </div>

                {/* Ongoing Support */}
                <div className="group relative flex min-h-[85px] items-center gap-4 rounded-xl border border-[#159c92]/20 bg-[#081c22]/70 px-4 py-2 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#159c92]/50 hover:bg-[#0b252b] hover:shadow-[0_15px_40px_rgba(21,156,146,0.10)]">

                  <div className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full bg-[#159c92]/30 transition-all duration-300 group-hover:bg-[#20aaa0]" />

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#159c92]/30 bg-[#159c92]/[0.08] text-[#29b9ad] transition-all duration-300 group-hover:border-[#20aaa0]/60 group-hover:bg-[#159c92]/15 group-hover:text-[#42c9bf]">
                    <UsersRound className="h-5 w-5" strokeWidth={1.6} />
                  </div>

                  <div>
                    <h3 className="font-serif text-[17px] font-medium leading-tight text-[#f1f5f4]">
                      Ongoing Support
                    </h3>

                    <p className="mt-1 max-w-[240px] text-[12px] leading-5 text-slate-400">
                      Continued guidance when and how you need it.
                    </p>
                  </div>
                </div>

              </div>

              {/* Bottom Detail */}
              <div className="mt-6 flex items-center gap-3">

                <div className="h-px flex-1 bg-gradient-to-r from-[#159c92]/40 to-transparent" />

                <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  Care • Confidence • Wellbeing
                </span>

                <div className="h-px flex-1 bg-gradient-to-l from-[#159c92]/40 to-transparent" />

              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WomenHealth;
