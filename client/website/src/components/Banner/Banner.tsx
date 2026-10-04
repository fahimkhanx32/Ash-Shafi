'use client';

import React from 'react';
import Link from 'next/link';
import { FaAward, FaAtom, FaHeart, FaArrowRight } from 'react-icons/fa';
import { HeroBanner } from '@/types/cms';
import { useI18n } from '@/lib/i18nContext';

interface BannerProps {
  bannerData?: HeroBanner | null;
}

export const Banner: React.FC<BannerProps> = ({ bannerData }) => {
  const { t } = useI18n();

  const videoUrl =
    bannerData?.videoUrl ||
    'https://res.cloudinary.com/fhsrf5ps/video/upload/v1787559049/baby_in_womb.mp4';

  return (
    <section className="relative w-full min-h-[560px] overflow-hidden bg-[#030b0e]">
      {/* Background Video */}
      <video
        className="absolute inset-0 w-full h-full object-fill pointer-events-none"
        autoPlay
        muted
        loop
        playsInline
        controls={false}
        disablePictureInPicture
        draggable="false"
      >
        <source src={videoUrl} type="video/mp4" />
      </video>

      {/* Dark / Teal Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#02090c]/[0.96] via-[#06161a]/[0.78] to-[#06191d]/[0.25]" />

      {/* Decorative left glow */}
      <div className="absolute -left-32 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-[#20aaa0]/[0.08] blur-3xl" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-[560px] w-full max-w-7xl items-center px-6 sm:px-10 lg:px-16">
        <div className="max-w-[590px] py-16 text-white">
          {/* Small heading */}
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-[#20aaa0]">
            {bannerData?.subtitle || t.banner.eyebrow}
          </p>

          {/* Main heading */}
          <h1 className="font-serif text-4xl font-medium leading-[1.12] text-[#f4f1e9] sm:text-5xl lg:text-[58px]">
            {bannerData?.title ? (
              bannerData.title
            ) : (
              <>
                {t.banner.heading1}
                <br />
                {t.banner.heading2}
                <br />
                <span className="font-serif italic text-[#20aaa0]">
                  {t.banner.heading3}
                </span>
              </>
            )}
          </h1>

          {/* Description */}
          <p className="mt-6 max-w-[500px] text-base leading-7 text-[#d5e0e0]/80 sm:text-lg">
            {bannerData?.description || t.banner.description}
          </p>

          {/* Buttons */}
          <div className="mt-7 flex flex-wrap gap-4">
            <Link
              href={bannerData?.primaryCtaHref || '/services'}
              className="group flex items-center gap-3 rounded-md bg-[#168f89] px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:bg-[#20aaa0] hover:shadow-xl"
            >
              <span>{bannerData?.primaryCtaLabel || t.banner.exploreServices}</span>
              <FaArrowRight className="text-xs transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            <a
              href="#video"
              className="rounded-md border border-[#20aaa0]/70 bg-transparent px-7 py-3.5 text-sm font-semibold text-[#f4f1e9] transition-all duration-300 hover:bg-[#20aaa0]/10"
            >
              {bannerData?.secondaryCtaLabel || t.banner.watchVideo}
            </a>
          </div>

          {/* Features */}
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-[#d5e0e0]/85">
            <div className="flex items-center gap-2.5">
              <FaAward className="text-lg text-[#20aaa0]" />
              <span>{t.banner.expertDoctors}</span>
            </div>

            <div className="flex items-center gap-2.5">
              <FaAtom className="text-lg text-[#20aaa0]" />
              <span>{t.banner.advancedTech}</span>
            </div>

            <div className="flex items-center gap-2.5">
              <FaHeart className="text-lg text-[#20aaa0]" />
              <span>{t.banner.personalizedCare}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Banner;
