"use client";

import { useState } from "react";

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

interface StopButtonProps {
  onStop?: () => void;
}

export function StopButton({ onStop }: StopButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  function handleClick() {
    setShowConfirm(true);
  }

  function handleConfirm() {
    setShowConfirm(false);
    onStop?.();
  }

  return (
    <>
      <button
        onClick={handleClick}
        aria-label="Parada de emergencia"
        className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl border border-red-500/40 bg-gradient-to-b from-red-600 to-red-700 px-4 py-3 text-sm font-bold uppercase tracking-[0.25em] text-white shadow-md shadow-red-900/30 transition-all hover:border-red-400/70 hover:from-red-500 hover:to-red-600 hover:shadow-[0_0_18px_rgba(239,68,68,0.35)] active:scale-[0.98]"
      >
        <span className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/10 to-transparent" />
        <span className="relative inline-flex h-3 w-3 items-center justify-center rounded-sm bg-white/95 shadow-inner" />
        <span className="relative">Stop</span>
      </button>

      {showConfirm && (
        <StopConfirmDialog
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}

interface StopConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function StopConfirmDialog({ onConfirm, onCancel }: StopConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-[#1e293b] to-[#0f172a] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2 1 21h22L12 2zm0 6 7.5 13h-15L12 8zm-1 4v3h2v-3h-2zm0 4v2h2v-2h-2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">
            Parada de emergencia
          </h2>
        </div>

        <p className="text-sm leading-relaxed text-slate-300">
          Se detendrán de inmediato todos los módulos del equipo: bomba
          peristáltica, generador Rx, sistema de vacío y todas las válvulas
          activas.
        </p>

        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Si hay una medición en curso, se cancelará y se perderán los datos
          no guardados.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
          >
            Confirmar parada
          </button>
        </div>
      </div>
    </div>
  );
}
