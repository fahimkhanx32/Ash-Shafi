export default function Loading() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#030b0e]">
      {/* Pulsing brand logo */}
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full border border-[#20aaa0]/30" />
        <div className="absolute inset-2 animate-ping rounded-full border border-[#20aaa0]/20 animation-delay-150" />
        <div className="flex h-full w-full items-center justify-center rounded-full border border-[#20aaa0]/60 bg-[#20aaa0]/[0.07]">
          <span className="font-serif text-xl font-medium text-[#20aaa0]">N</span>
        </div>
      </div>
      <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.3em] text-[#718387]">
        Loading...
      </p>
    </div>
  );
}
