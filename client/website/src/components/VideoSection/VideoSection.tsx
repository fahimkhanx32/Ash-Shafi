'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
  FaPlay,
  FaPause,
  FaVolumeMute,
  FaVolumeUp,
  FaArrowRight,
} from 'react-icons/fa';

export const VideoSection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  return (
    <section
      id="video"
      className="relative w-full overflow-hidden bg-[#030b0e] px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
    >
      {/* BACKGROUND ATMOSPHERE */}
      <div className="pointer-events-none absolute -left-40 top-1/2 h-[450px] w-[450px] -translate-y-1/2 rounded-full bg-[#20aaa0]/[0.035] blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-[#20aaa0]/[0.025] blur-[130px]" />

      <div className="relative z-10 mx-auto w-full max-w-[1450px]">
        {/* SECTION HEADER */}
        <div className="mb-10 text-center sm:mb-12 lg:mb-14">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-[#20aaa0]/60 sm:w-12" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-[#20aaa0] sm:text-[11px]">
              A Closer Look at Your Care
            </span>
            <span className="h-px w-8 bg-[#20aaa0]/60 sm:w-12" />
          </div>

          <h2 className="mx-auto max-w-[850px] font-serif text-[30px] font-medium leading-[1.12] tracking-[-0.02em] text-[#f4f1e9] sm:text-[38px] md:text-[44px] lg:text-[50px]">
            Care That Puts You <span className="text-[#20aaa0]">First.</span>
          </h2>

          <p className="mx-auto mt-4 max-w-[680px] font-sans text-[13px] font-light leading-6 text-[#aab9bd] sm:text-[14px] sm:leading-7 md:text-[15px]">
            Discover our approach to compassionate women&apos;s healthcare, where clinical expertise meets personalized attention at every stage of your journey.
          </p>
        </div>

        {/* VIDEO + CONTENT */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:gap-14 xl:gap-20">
          {/* VIDEO */}
          <div className="relative">
            {/* Decorative outer frame */}
            <div className="pointer-events-none absolute -inset-2 rounded-[20px] border border-[#20aaa0]/10 sm:-inset-3 sm:rounded-[24px]" />

            {/* Corner decoration */}
            <div className="pointer-events-none absolute -left-2 -top-2 z-20 h-12 w-12 rounded-tl-[20px] border-l border-t border-[#20aaa0]/60 sm:-left-3 sm:-top-3 sm:h-16 sm:w-16 sm:rounded-tl-[24px]" />
            <div className="pointer-events-none absolute -bottom-2 -right-2 z-20 h-12 w-12 rounded-br-[20px] border-b border-r border-[#20aaa0]/60 sm:-bottom-3 sm:-right-3 sm:h-16 sm:w-16 sm:rounded-br-[24px]" />

            {/* Video wrapper */}
            <div className="group relative aspect-video w-full overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#061216] shadow-[0_25px_80px_rgba(0,0,0,0.45)] sm:rounded-[20px]">
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-cover"
                poster="https://res.cloudinary.com/fhsrf5ps/image/upload/v1787545755/pragnant_woman.webp"
                preload="metadata"
                playsInline
                muted={isMuted}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              >
                <source
                  src="https://res.cloudinary.com/fhsrf5ps/video/upload/v1787425666/unborn_baby_in_womb.mp4"
                  type="video/mp4"
                />
                Your browser does not support the video element.
              </video>

              {/* CINEMATIC OVERLAY */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-black/10" />
              <div className="pointer-events-none absolute bottom-[-25%] left-1/2 h-[45%] w-[60%] -translate-x-1/2 rounded-full bg-[#20aaa0]/10 blur-[70px]" />

              {/* CENTER PLAY BUTTON */}
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
                className={`absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#20aaa0]/70 bg-[#06191b]/75 text-white shadow-[0_0_35px_rgba(32,170,160,0.20)] backdrop-blur-md transition-all duration-300 sm:h-20 sm:w-20 ${
                  isPlaying
                    ? 'scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100'
                    : 'scale-100 opacity-100 hover:scale-105 hover:border-[#20aaa0] hover:bg-[#20aaa0]/20'
                }`}
              >
                {isPlaying ? (
                  <FaPause className="text-sm sm:text-base" />
                ) : (
                  <FaPlay className="ml-1 text-sm sm:text-base" />
                )}
              </button>

              {/* VIDEO BOTTOM BAR */}
              <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-4 pb-4 sm:px-6 sm:pb-5">
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-[0.28em] text-[#20aaa0] sm:text-[10px]">
                    Our Approach
                  </p>
                  <p className="mt-1 font-serif text-[15px] text-[#f4f1e9] sm:text-[17px]">
                    Compassionate Care
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md transition-all duration-300 hover:border-[#20aaa0]/60 hover:text-[#20aaa0] sm:h-10 sm:w-10"
                >
                  {isMuted ? <FaVolumeMute className="text-xs" /> : <FaVolumeUp className="text-xs" />}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT */}
          <div className="lg:pl-2 xl:pl-4">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-[#20aaa0]" />
              <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#20aaa0]">
                Compassionate Healthcare
              </span>
            </div>

            <h3 className="mt-5 font-serif text-[28px] font-medium leading-[1.15] text-[#f4f1e9] sm:text-[34px] lg:text-[38px] xl:text-[42px]">
              Expertise You Can <span className="text-[#20aaa0]">Trust.</span>
            </h3>

            <p className="mt-5 font-sans text-[13px] font-light leading-6 text-[#aab9bd] sm:text-[14px] sm:leading-7">
              Your health deserves more than treatment. It deserves understanding, attention, and care designed around you. Our approach combines medical expertise with a warm, patient-centered experience.
            </p>

            {/* FEATURE LIST */}
            <div className="mt-7 space-y-4">
              {[
                'Listen first, Understand deeply',
                'Clarity when decisions feel uncertain',
                'Thoughtful care beyond the consultation',
                'A trusted presence when it matters most',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#20aaa0]/40 bg-[#20aaa0]/[0.08]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#20aaa0]" />
                  </span>
                  <span className="text-[12px] font-light text-[#b8c4c6] sm:text-[13px]">
                    {item}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link
              href="/services"
              className="group mt-8 inline-flex items-center gap-3 rounded-lg border border-[#20aaa0]/40 bg-[#20aaa0]/[0.08] px-5 py-3 text-[12px] font-medium tracking-wide text-[#dff7f4] transition-all duration-300 hover:border-[#20aaa0] hover:bg-[#20aaa0]/15 hover:shadow-[0_0_25px_rgba(32,170,160,0.10)] sm:px-6 sm:py-3.5"
            >
              <span>Explore Our Services</span>
              <FaArrowRight className="text-[10px] transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* BOTTOM DECORATIVE DIVIDER */}
        <div className="mt-14 flex items-center sm:mt-16 lg:mt-20">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#20aaa0]/20 to-[#20aaa0]/40" />
          <div className="mx-5 flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-[#20aaa0]/40" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#20aaa0]/70" />
            <span className="h-1 w-1 rounded-full bg-[#20aaa0]/40" />
          </div>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#20aaa0]/20 to-[#20aaa0]/40" />
        </div>
      </div>
    </section>
  );
};

export default VideoSection;
