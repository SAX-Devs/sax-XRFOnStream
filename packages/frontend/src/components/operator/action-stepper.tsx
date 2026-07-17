"use client";

import type { ActionStage } from "@/hooks/use-action-runner";

/**
 * Live progress stepper for an in-flight action:
 *
 *   ● Enviado ── ● Recibido ── ◉ Ejecutando ── ○ Completado
 *
 * Every node maps to a REAL pipeline milestone (Route Handler → gateway ack →
 * equipment busy → busy→ready result), so the operator always knows exactly
 * where their order is — and never double-fires thinking nothing happened.
 */

interface StepDef {
  key: string;
  label: string;
}

const STEPS: StepDef[] = [
  { key: "sent", label: "Enviado" },
  { key: "ack", label: "Recibido" },
  { key: "exec", label: "Ejecutando" },
  { key: "done", label: "Completado" },
];

type NodeState = "done" | "active" | "pending" | "failed" | "stalled";

/** Index of the step currently in progress for a given stage. */
function progressIndex(stage: ActionStage): number {
  switch (stage) {
    case "sending":
      return 0; // Enviado in progress
    case "sent":
      return 1; // waiting gateway reception
    case "ack":
      return 2; // equipment executing
    case "completed":
      return 4; // everything done
    case "error":
    case "rejected":
    case "timeout":
      return -1; // resolved separately below
  }
}

function nodeState(index: number, stage: ActionStage): NodeState {
  if (stage === "completed") return "done";
  if (stage === "rejected") {
    // Failed at reception: the gateway refused the command.
    if (index === 0) return "done";
    if (index === 1) return "failed";
    return "pending";
  }
  if (stage === "error") {
    // Sent+received fine (unless it never left), failed executing.
    if (index <= 1) return "done";
    if (index === 2) return "failed";
    return "pending";
  }
  if (stage === "timeout") {
    if (index <= 1) return "done";
    if (index === 2) return "stalled";
    return "pending";
  }
  const p = progressIndex(stage);
  if (index < p) return "done";
  if (index === p) return "active";
  return "pending";
}

const NODE_CLASS: Record<NodeState, string> = {
  done: "border-emerald-400 bg-emerald-400/90 text-black",
  active: "border-amber-400 bg-amber-400/20 text-amber-300",
  pending: "border-slate-600 bg-transparent text-slate-600",
  failed: "border-red-400 bg-red-500/20 text-red-300",
  stalled: "border-amber-500 bg-amber-500/15 text-amber-400",
};

const LABEL_CLASS: Record<NodeState, string> = {
  done: "text-emerald-300",
  active: "text-amber-300",
  pending: "text-slate-600",
  failed: "text-red-300",
  stalled: "text-amber-400",
};

export function ActionStepper({ stage }: { stage: ActionStage }) {
  return (
    <div className="flex items-start">
      {STEPS.map((step, i) => {
        const state = nodeState(i, stage);
        const connectorDone = nodeState(i - 1, stage) === "done";
        return (
          <div key={step.key} className="flex flex-1 items-start last:flex-none">
            {i > 0 && (
              <div
                className={`mt-[9px] h-px min-w-4 flex-1 transition-colors duration-500 ${
                  connectorDone ? "bg-emerald-400/60" : "bg-slate-700"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1 px-0.5">
              <span className="relative flex h-[18px] w-[18px]">
                {state === "active" && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-30" />
                )}
                <span
                  className={`relative inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors duration-300 ${NODE_CLASS[state]}`}
                >
                  {state === "done" ? "✓" : state === "failed" ? "✕" : state === "stalled" ? "?" : ""}
                </span>
              </span>
              <span
                className={`text-[9px] font-semibold uppercase tracking-wide ${LABEL_CLASS[state]}`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
