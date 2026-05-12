"use client";

import { useState } from "react";

interface PowerButtonProps {
  powerOn: boolean;
  isMeasuring?: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function PowerButton({
  powerOn,
  isMeasuring = false,
  onToggle,
  disabled = false,
}: PowerButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  function handleClick() {
    if (disabled) return;
    setShowConfirm(true);
  }

  function handleConfirm() {
    setShowConfirm(false);
    onToggle();
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 backdrop-blur-md">
        <button
          onClick={handleClick}
          disabled={disabled}
          aria-label={powerOn ? "Apagar equipo" : "Encender equipo"}
          className={`group relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 ${
            powerOn
              ? "bg-emerald-500/15 ring-2 ring-emerald-400/70 shadow-lg shadow-emerald-500/30 hover:scale-105 hover:bg-emerald-500/25 hover:ring-emerald-300"
              : "bg-slate-800/80 ring-2 ring-slate-700 hover:scale-105 hover:bg-slate-700/80 hover:ring-slate-500"
          } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-6 w-6 transition-colors ${powerOn ? "text-emerald-400" : "text-slate-400"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18.36 6.64a9 9 0 1 1 -12.73 0" />
            <line x1="12" y1="2" x2="12" y2="12" />
          </svg>

          {powerOn && (
            <span className="pointer-events-none absolute inset-0 animate-ping rounded-full ring-2 ring-emerald-400/50" />
          )}
        </button>

        <div className="flex flex-col">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            Equipo
          </span>
          <span
            className={`text-sm font-semibold ${
              powerOn ? "text-emerald-400" : "text-slate-500"
            }`}
          >
            {powerOn ? "Encendido" : "Apagado"}
          </span>
        </div>
      </div>

      {showConfirm && (
        <ConfirmDialog
          powerOn={powerOn}
          isMeasuring={isMeasuring}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}

interface ConfirmDialogProps {
  powerOn: boolean;
  isMeasuring: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  powerOn,
  isMeasuring,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const action = powerOn ? "Apagar" : "Encender";
  const showMeasuringWarning = powerOn && isMeasuring;

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
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              powerOn ? "bg-red-500/20" : "bg-emerald-500/20"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-5 w-5 ${
                powerOn ? "text-red-400" : "text-emerald-400"
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18.36 6.64a9 9 0 1 1 -12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">
            {action} equipo XRF
          </h2>
        </div>

        <p className="text-sm leading-relaxed text-slate-300">
          {powerOn
            ? "Se apagarán todos los módulos del equipo: generador Rx, detector, sistema de vacío y controladores. La secuencia tarda aproximadamente 30 segundos."
            : "Se iniciará la secuencia de encendido. Los módulos arrancarán en orden hasta que el equipo esté listo para operar."}
        </p>

        {showMeasuringWarning && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 flex-shrink-0 text-amber-400"
              fill="currentColor"
            >
              <path d="M12 2 1 21h22L12 2zm0 6 7.5 13h-15L12 8zm-1 4v3h2v-3h-2zm0 4v2h2v-2h-2z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-300">
                Hay una medición en curso
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
                Apagar ahora cancelará la medición y se perderán los datos no guardados.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
              powerOn
                ? "bg-red-600 hover:bg-red-500"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}
