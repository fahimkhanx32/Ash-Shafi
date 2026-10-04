import Link from 'next/link';
import { FaHome, FaArrowRight } from 'react-icons/fa';

export default function NotFound() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#030b0e] px-5 text-center">
      {/* GLOW */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#20aaa0]/[0.04] blur-[120px]" />

      <div className="relative max-w-lg">
        {/* 404 LARGE */}
        <div className="font-serif text-[120px] font-medium leading-none text-[#20aaa0]/20 sm:text-[160px]">
          404
        </div>

        {/* MESSAGE */}
        <h1 className="mt-2 font-serif text-3xl font-medium text-[#f4f1e9] sm:text-4xl">
          Page Not Found
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[14px] leading-7 text-[#aab9bd]">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          Let&apos;s get you back to where you need to be.
        </p>

        {/* CTA BUTTONS */}
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[#20aaa0] px-6 py-3 text-sm font-medium text-[#030b0e] transition hover:bg-[#38b9b0]"
          >
            <FaHome className="text-xs" />
            Back to Home
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-[#f4f1e9] transition hover:border-[#20aaa0]/40"
          >
            Contact Us
            <FaArrowRight className="text-xs" />
          </Link>
        </div>
      </div>
    </main>
  );
}
