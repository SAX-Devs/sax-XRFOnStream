"use client";

interface SpectrumButtonProps {
  onClick?: () => void;
}

export function SpectrumButton({ onClick }: SpectrumButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/15 to-cyan-600/10 px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] text-cyan-300 backdrop-blur-md transition-all hover:border-cyan-400/60 hover:from-cyan-500/25 hover:to-cyan-600/20 hover:text-cyan-200 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <span>Spectrum</span>
    </button>
  );
}
