"use client";

import { useEffect, useState } from "react";
import { ActionStepper } from "@/components/operator/action-stepper";
import { HoldButton } from "./hold-button";
import type { InflightAction } from "@/hooks/use-action-runner";

/**
 * One service action as a compact expandable row.
 *
 * Collapsed: technical name (the technician's language — no translation),
 * short description, risk tier badge. Expanded: the argument form (render
 * prop), tier-appropriate confirmation, and the live stepper once fired:
 *
 *   - normal   → inline confirm (two clicks)
 *   - caution  → inline confirm + the physical-effect warning stays visible
 *   - critical → hold-to-confirm (1.5s) — deliberate by construction
 */

export type RiskTier = "normal" | "caution" | "critical";

const TIER_BADGE: Record<RiskTier, { label: string; cls: string }> = {
  normal: { label: "normal", cls: "bg-white/5 text-slate-500 ring-white/10" },
  caution: {
    label: "precaución",
    cls: "bg-amber-500/10 text-amber-300/90 ring-amber-500/25",
  },
  critical: {
    label: "crítica",
    cls: "bg-red-500/10 text-red-300 ring-red-500/30",
  },
};

export interface FirePayload {
  args: Record<string, string>;
  label: string;
}

interface ActionRowProps {
  /** Readable Spanish name, shown up front. */
  title: string;
  /** Raw equipment task name, kept as a secondary technical reference. */
  command: string;
  description: string;
  tier: RiskTier;
  /** Standing precondition/effect note, always visible when expanded. */
  requirement?: string;
  /** Live warning (e.g. interlocks not met); shown amber when present. */
  warning?: string | null;
  /** In-flight action on THIS command (drives the stepper). */
  inflight: InflightAction | null;
  /** Label of another action keeping the module busy, if any. */
  lockedBy: string | null;
  disabled?: boolean;
  onFire: (payload: FirePayload) => void;
  onDismiss: () => void;
  /**
   * Argument form. `request` stages the payload for confirmation (or fires
   * directly through the hold button on critical rows); `blocked` mirrors the
   * row's interactivity.
   */
  children: (api: {
    request: (payload: FirePayload) => void;
    blocked: boolean;
  }) => React.ReactNode;
}

export function ActionRow({
  title,
  command,
  description,
  tier,
  requirement,
  warning,
  inflight,
  lockedBy,
  disabled = false,
  onFire,
  onDismiss,
  children,
}: ActionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<FirePayload | null>(null);

  // Staged confirmation auto-reverts if the technician walks away.
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(null), 8_000);
    return () => clearTimeout(t);
  }, [pending]);

  const failed =
    inflight &&
    (inflight.stage === "error" ||
      inflight.stage === "rejected" ||
      inflight.stage === "timeout");
  const running =
    inflight &&
    !failed &&
    inflight.stage !== "completed" &&
    inflight.stage !== "cancelled";
  const blocked = disabled || !!running || !!lockedBy;
  const badge = TIER_BADGE[tier];

  return (
    <div
      className={`rounded-xl border transition-colors ${
        running
          ? "border-amber-500/30 bg-amber-500/[0.04]"
          : failed
            ? "border-red-500/30 bg-black/40"
            : "border-white/8 bg-black/40 hover:border-white/15"
      }`}
    >
      {/* Row header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-slate-100">
              {title}
            </span>
            <code className="truncate font-mono text-[9px] text-slate-600">
              {command}
            </code>
            <span
              className={`shrink-0 rounded px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wider ring-1 ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[10.5px] text-slate-500">
            {description}
          </div>
        </div>

        {running && (
          <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-amber-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
            </span>
            en curso
          </span>
        )}
        {inflight?.stage === "completed" && (
          <span className="shrink-0 text-[10px] font-semibold text-emerald-300">
            ✓ listo
          </span>
        )}
        {failed && (
          <span className="shrink-0 text-[10px] font-semibold text-red-300">
            ✕ {inflight!.stage === "timeout" ? "sin respuesta" : "falló"}
          </span>
        )}

        <svg
          className={`h-3 w-3 shrink-0 text-slate-600 transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-white/5 px-3 pb-3 pt-2.5">
          {requirement && (
            <p className="mb-2 text-[10px] leading-snug text-slate-500">
              <span className="mr-1 text-slate-400">⚙</span>
              {requirement}
            </p>
          )}
          {warning && !inflight && (
            <div className="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[10px] leading-snug text-amber-200/90">
              ⚠ {warning}
            </div>
          )}

          {inflight ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 pb-2 pt-2.5">
                <div className="mb-2 text-[11px] font-medium text-slate-300">
                  {inflight.label}
                </div>
                <ActionStepper stage={inflight.stage} />
              </div>
              {inflight.stage === "timeout" && (
                <ResultNote tone="warn" onDismiss={onDismiss}>
                  El equipo no reportó resultado en el tiempo esperado —
                  verifica la telemetría cruda antes de reintentar.
                </ResultNote>
              )}
              {inflight.stage === "rejected" && (
                <ResultNote tone="error" onDismiss={onDismiss}>
                  Orden rechazada{inflight.error ? `: ${inflight.error}` : "."}
                </ResultNote>
              )}
              {inflight.stage === "error" && (
                <ResultNote tone="error" onDismiss={onDismiss}>
                  Terminó con error
                  {inflight.error ? `: ${inflight.error}` : "."}
                </ResultNote>
              )}
            </div>
          ) : pending ? (
            tier === "critical" ? (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-red-200">
                  {pending.label}
                </p>
                <HoldButton
                  label="Mantener para ejecutar"
                  onConfirm={() => {
                    onFire(pending);
                    setPending(null);
                  }}
                />
                <button
                  onClick={() => setPending(null)}
                  className="w-full rounded-lg border border-white/10 py-1.5 text-[11px] text-slate-400 transition-colors hover:bg-white/5"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                <span className="flex-1 text-[11px] font-medium text-cyan-100">
                  ¿Confirmar {pending.label}?
                </span>
                <button
                  onClick={() => {
                    onFire(pending);
                    setPending(null);
                  }}
                  className="rounded-md bg-cyan-500/90 px-3 py-1 text-[11px] font-bold text-black transition-colors hover:bg-cyan-400"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setPending(null)}
                  className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
            )
          ) : (
            <>
              {children({ request: setPending, blocked })}
              {lockedBy && (
                <p className="mt-2 text-[10px] text-amber-300/80">
                  ⏳ Módulo ocupado: {lockedBy}…
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultNote({
  tone,
  children,
  onDismiss,
}: {
  tone: "warn" | "error";
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : "border-red-500/30 bg-red-500/10 text-red-200";
  return (
    <div
      className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-[11px] leading-snug ${cls}`}
    >
      <span>{children}</span>
      <button
        onClick={onDismiss}
        className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

/** Shared numeric field for service forms. */
export function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
}) {
  const n = Number(value);
  const invalid = value !== "" && (!Number.isFinite(n) || n < min || n > max);
  return (
    <label className="min-w-0 flex-1">
      <span className="mb-1 block truncate text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        {label} · {min}–{max}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border bg-white/5 px-2.5 py-1.5 font-mono text-[13px] text-slate-100 outline-none tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          invalid
            ? "border-red-500/50 focus:border-red-400"
            : "border-white/10 focus:border-cyan-400/60"
        }`}
      />
    </label>
  );
}

/** Shared submit button for service forms (non-critical styling). */
export function SubmitButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1.5 text-[11.5px] font-semibold text-cyan-100 transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}
