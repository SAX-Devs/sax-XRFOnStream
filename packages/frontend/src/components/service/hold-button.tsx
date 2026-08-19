"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hold-to-confirm button for CRITICAL service actions (power cuts, interlock
 * bypass): press and hold for the full duration to fire. Impossible to
 * trigger by a stray click, faster than a modal, and the filling bar makes
 * the deliberateness visible. Releasing early cancels.
 */

const HOLD_MS = 1500;

export function HoldButton({
  label,
  disabled = false,
  onConfirm,
}: {
  label: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const holding = useRef(false);
  const raf = useRef<number>(0);
  const startedAt = useRef(0);
  const fired = useRef(false);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const tick = () => {
    if (!holding.current) return;
    const p = Math.min(1, (Date.now() - startedAt.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      if (!fired.current) {
        fired.current = true;
        holding.current = false;
        setProgress(0);
        onConfirm();
      }
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (disabled) return;
    fired.current = false;
    holding.current = true;
    startedAt.current = Date.now();
    raf.current = requestAnimationFrame(tick);
  };

  const cancel = () => {
    holding.current = false;
    cancelAnimationFrame(raf.current);
    setProgress(0);
  };

  return (
    <button
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full touch-none select-none overflow-hidden rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2.5 text-[12px] font-bold uppercase tracking-wider text-red-200 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {/* Fill bar while holding */}
      <span
        className="absolute inset-y-0 left-0 bg-red-500/40"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative">
        {progress > 0 ? "Mantén presionado…" : label}
      </span>
    </button>
  );
}
