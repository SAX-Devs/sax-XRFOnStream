"use client";

import { useEffect, useRef, useState } from "react";
import { ActionStepper } from "./action-stepper";
import type { InflightAction } from "@/hooks/use-action-runner";

export interface ActionOption {
  /** arg1 value sent to the equipment, verbatim. */
  value: string;
  label: string;
  hint?: string;
  /** The equipment already reports this state — shown as current, not firable. */
  isCurrent?: boolean;
  /**
   * Disables the option for a reason other than "already there" (e.g. no tank
   * capacity left). The reason replaces the hint so the operator sees WHY.
   */
  disabledReason?: string;
  /** Positional args beyond arg1, for actions that take more than one. */
  extraArgs?: Record<string, string>;
}

export type StateTone = "ok" | "info" | "moving" | "warn" | "unknown";

const TONE_CLASS: Record<StateTone, string> = {
  ok: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  info: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
  moving: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  warn: "bg-red-500/15 text-red-300 ring-red-500/30",
  unknown: "bg-slate-600/15 text-slate-400 ring-slate-600/30",
};

interface ActionCardProps {
  title: string;
  command: string;
  /** Live state chip fed by real telemetry. */
  stateLabel: string;
  stateTone: StateTone;
  statePulse?: boolean;
  requirement?: string;
  /** Soft precondition warning (equipment still verifies on its side). */
  warning?: string | null;
  options: ActionOption[];
  /**
   * Replaces the option grid with a custom control — for parameters that are
   * genuinely continuous (tube kV / µA) and would be misrepresented by a
   * handful of invented presets. Receives a submit callback that routes
   * through the same inline-confirm flow as the buttons.
   */
  renderInput?: (
    submit: (option: ActionOption) => void,
    disabled: boolean
  ) => React.ReactNode;
  /** Option grid columns — use 1 for single-action cards. Default 2. */
  optionColumns?: 1 | 2;
  /** Hint shown on the option the equipment already reports. */
  currentHint?: string;
  /**
   * "danger" marks a safety/emergency action so it reads as drastic before
   * it's fired — the inline confirm still guards it either way.
   */
  tone?: "normal" | "danger";
  /** Shown next to the options for actions that take minutes to run. */
  longRunNote?: string;
  /**
   * Live progress for long-running actions (e.g. the tank level rising),
   * rendered under the stepper while the action is still executing.
   */
  progress?: React.ReactNode;
  /** In-flight action on THIS card's command (drives the stepper). */
  inflight: InflightAction | null;
  /** Label of another action keeping the module busy, if any. */
  lockedBy: string | null;
  disabled?: boolean;
  /**
   * The equipment can actually interrupt this action mid-run (its function
   * declares cancel_event). Only then is a Cancel button honest.
   */
  cancellable?: boolean;
  onCancel?: () => void;
  onRun: (option: ActionOption) => void;
  onDismiss: () => void;
  /** Bumped when the diagram element is clicked — flashes the card. */
  focusSignal?: number;
}

export function ActionCard({
  title,
  command,
  stateLabel,
  stateTone,
  statePulse = false,
  requirement,
  warning,
  options,
  renderInput,
  optionColumns = 2,
  currentHint = "estado actual",
  tone = "normal",
  longRunNote,
  progress,
  inflight,
  lockedBy,
  disabled = false,
  cancellable = false,
  onCancel,
  onRun,
  onDismiss,
  focusSignal = 0,
}: ActionCardProps) {
  const [pendingOption, setPendingOption] = useState<ActionOption | null>(null);
  const [flash, setFlash] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Inline confirm auto-reverts if the operator walks away.
  useEffect(() => {
    if (!pendingOption) return;
    const t = setTimeout(() => setPendingOption(null), 6_000);
    return () => clearTimeout(t);
  }, [pendingOption]);

  // Diagram click → scroll into view + flash ring.
  useEffect(() => {
    if (focusSignal === 0) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1_600);
    return () => clearTimeout(t);
  }, [focusSignal]);

  const failed =
    inflight &&
    (inflight.stage === "error" ||
      inflight.stage === "rejected" ||
      inflight.stage === "timeout");
  const cancelled = inflight?.stage === "cancelled";
  const running =
    inflight && !failed && !cancelled && inflight.stage !== "completed";
  // Cancelling only makes sense once the equipment has the order in hand.
  const canCancel =
    cancellable &&
    !!onCancel &&
    running &&
    inflight.stage !== "sending" &&
    !inflight.cancelRequested;
  const interactionBlocked = disabled || !!running || !!lockedBy;

  return (
    <div
      ref={cardRef}
      className={`rounded-2xl border bg-black/60 p-4 backdrop-blur-md transition-all duration-500 ${
        flash
          ? "border-cyan-400/70 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
          : tone === "danger"
            ? "border-red-500/30"
            : "border-white/10"
      }`}
    >
      {/* Header: title + live state chip */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold tracking-wide text-slate-200">
            {title}
          </h3>
          <p className="mt-0.5 font-mono text-[10px] text-slate-500">{command}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ${TONE_CLASS[stateTone]}`}
        >
          {statePulse && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
          )}
          {stateLabel}
        </span>
      </div>

      {requirement && (
        <p className="mt-2 text-[10px] leading-snug text-slate-500">
          <span className="mr-1 text-slate-400">⚙</span>
          {requirement}
        </p>
      )}

      {warning && !inflight && (
        <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[10px] leading-snug text-amber-200/90">
          ⚠ {warning}
        </div>
      )}

      {/* Body: stepper when in flight, options otherwise */}
      {inflight ? (
        <div className="mt-3 space-y-2.5">
          <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 pb-2 pt-3">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-300">
                {inflight.label}
              </span>
              {inflight.stage === "completed" && (
                <span className="text-[10px] font-semibold text-emerald-300">
                  ✓ listo
                </span>
              )}
              {canCancel && (
                <button
                  onClick={onCancel}
                  className="shrink-0 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200"
                >
                  Cancelar
                </button>
              )}
              {inflight.cancelRequested && running && (
                <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                  cancelando…
                </span>
              )}
            </div>
            <ActionStepper stage={inflight.stage} />
            {/* Live progress for minutes-long actions — the operator watches
                the equipment actually working, not just a spinner. */}
            {progress && running && (
              <div className="mt-3 border-t border-white/5 pt-2.5">{progress}</div>
            )}
          </div>

          {cancelled && (
            <ResultNote tone="neutral" onDismiss={onDismiss}>
              Acción cancelada. El equipo detuvo la operación — revisa el
              estado actual antes de reintentar.
            </ResultNote>
          )}
          {inflight.stage === "timeout" && (
            <ResultNote tone="warn" onDismiss={onDismiss}>
              El equipo no reportó resultado en el tiempo esperado. Verifica el
              estado actual en el diagrama antes de reintentar.
            </ResultNote>
          )}
          {inflight.stage === "rejected" && (
            <ResultNote tone="error" onDismiss={onDismiss}>
              Orden rechazada{inflight.error ? `: ${inflight.error}` : "."}
            </ResultNote>
          )}
          {inflight.stage === "error" && (
            <ResultNote tone="error" onDismiss={onDismiss}>
              La acción terminó con error
              {inflight.error ? `: ${inflight.error}` : "."}
            </ResultNote>
          )}
        </div>
      ) : (
        <div className="mt-3">
          {pendingOption ? (
            <div className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
              <span className="flex-1 text-[11px] font-medium text-cyan-100">
                ¿Confirmar {pendingOption.label}?
              </span>
              <button
                onClick={() => {
                  onRun(pendingOption);
                  setPendingOption(null);
                }}
                className="rounded-md bg-cyan-500/90 px-3 py-1 text-[11px] font-bold text-black transition-colors hover:bg-cyan-400"
              >
                Confirmar
              </button>
              <button
                onClick={() => setPendingOption(null)}
                className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
          ) : renderInput ? (
            renderInput(setPendingOption, interactionBlocked)
          ) : (
            <div
              className={`grid gap-2 ${
                optionColumns === 1 ? "grid-cols-1" : "grid-cols-2"
              }`}
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  disabled={
                    interactionBlocked || opt.isCurrent || !!opt.disabledReason
                  }
                  onClick={() => setPendingOption(opt)}
                  className={`group rounded-xl border px-3 py-2 text-left transition-all ${
                    opt.isCurrent
                      ? "cursor-default border-emerald-500/25 bg-emerald-500/[0.06]"
                      : tone === "danger"
                        ? "border-red-500/40 bg-red-500/10 hover:border-red-400/70 hover:bg-red-500/20 hover:shadow-[0_0_14px_rgba(239,68,68,0.18)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
                        : "border-white/10 bg-white/[0.04] hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:shadow-[0_0_14px_rgba(34,211,238,0.12)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-white/[0.04] disabled:hover:shadow-none"
                  }`}
                >
                  <span
                    className={`block text-[12px] font-semibold ${
                      opt.isCurrent ? "text-emerald-300/90" : "text-slate-200"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[9px] leading-snug text-slate-500">
                    {opt.disabledReason ??
                      (opt.isCurrent ? currentHint : opt.hint)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {longRunNote && !pendingOption && (
            <p className="mt-2 text-[10px] leading-snug text-slate-500">
              <span className="mr-1 text-slate-400">⏱</span>
              {longRunNote}
            </p>
          )}

          {lockedBy && (
            <p className="mt-2 text-[10px] text-amber-300/80">
              ⏳ Módulo ocupado: {lockedBy}…
            </p>
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
  tone: "warn" | "error" | "neutral";
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : tone === "neutral"
        ? "border-white/15 bg-white/[0.06] text-slate-300"
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
