'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FaHome, FaRedo } from 'react-icons/fa';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Page Error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#030b0e] px-5 text-center">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-900/[0.04] blur-[120px]" />

      <div className="relative max-w-lg">
        <div className="font-serif text-[100px] font-medium leading-none text-red-900/20 sm:text-[140px]">
          :(
        </div>

        <h1 className="mt-2 font-serif text-3xl font-medium text-[#f4f1e9] sm:text-4xl">
          Something Went Wrong
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[14px] leading-7 text-[#aab9bd]">
          We encountered an unexpected error. Please try again or navigate back to the home page.
        </p>

        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mx-auto mt-4 max-w-sm rounded-lg border border-red-500/20 bg-red-950/30 p-4 text-left">
            <p className="font-mono text-xs text-red-300">{error.message}</p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg border border-[#20aaa0]/50 px-6 py-3 text-sm font-medium text-[#20aaa0] transition hover:bg-[#20aaa0]/10"
          >
            <FaRedo className="text-xs" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[#20aaa0] px-6 py-3 text-sm font-medium text-[#030b0e] transition hover:bg-[#38b9b0]"
          >
            <FaHome className="text-xs" />
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
