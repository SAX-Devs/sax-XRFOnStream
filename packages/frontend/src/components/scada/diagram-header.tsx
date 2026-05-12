"use client";

import { useState, useEffect } from "react";

interface DiagramHeaderProps {
  userLabel?: string;
  userRole?: string;
}

export function DiagramHeader({
  userLabel = "Usuario",
  userRole = "operator",
}: DiagramHeaderProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const dateStr = now.toLocaleDateString("es-CL");
  const timeStr = now.toLocaleTimeString("es-CL");

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl border border-white/10 bg-black/60 px-5 py-3 backdrop-blur-md">
      {/* Left: Date / Time */}
      <div className="flex min-w-0 items-center gap-2 font-mono text-sm">
        <svg
          className="h-4 w-4 flex-shrink-0 text-slate-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span suppressHydrationWarning className="truncate text-slate-300">
          {dateStr}
        </span>
        <span className="text-slate-500">·</span>
        <span
          suppressHydrationWarning
          className="truncate font-semibold text-white tabular-nums"
        >
          {timeStr}
        </span>
      </div>

      {/* Center: Title */}
      <h1 className="select-none whitespace-nowrap text-base font-bold uppercase tracking-[0.3em] text-white/95">
        XRF<span className="mx-2 text-red-500">·</span>On Stream
      </h1>

      {/* Right: User badge */}
      <div className="flex justify-end">
        <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 1 1 -8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0 -7 7h14a7 7 0 0 0 -7 -7z"
              />
            </svg>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-medium text-slate-200">
              {userLabel}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              {userRole}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
