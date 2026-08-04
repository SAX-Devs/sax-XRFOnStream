"use client";

import type { InflightAction } from "@/hooks/use-action-runner";

/**
 * Collapsible module section for the "Opciones" panel.
 *
 * The panel holds one section per equipment module and keeps only one open at
 * a time, so the vertical footprint stays roughly constant as modules are
 * added (interchanger, circulation, … ). Clicking a module's hotspot in the
 * diagram opens its section.
 *
 * A collapsed section never hides work in progress: if one of its actions is
 * in flight, the header carries a pulsing chip with the action's label, and a
 * failed action leaves a red chip until it's dismissed inside the section.
 */

interface ModuleSectionProps {
  /** Module display name, e.g. "Interchanger". */
  title: string;
  /** One-line live summary shown collapsed, e.g. "Chamber · axial UP". */
  summary: string;
  open: boolean;
  onToggle: () => void;
  /** Action currently occupying this module, if any. */
  action: InflightAction | null;
  children: React.ReactNode;
}

export function ModuleSection({
  title,
  summary,
  open,
  onToggle,
  action,
  children,
}: ModuleSectionProps) {
  const failed =
    action &&
    (action.stage === "error" ||
      action.stage === "rejected" ||
      action.stage === "timeout");
  const running = action && !failed && action.stage !== "completed";
  const succeeded = action?.stage === "completed";

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-black/60 backdrop-blur-md transition-colors duration-300 ${
        running
          ? "border-amber-500/40"
          : failed
            ? "border-red-500/40"
            : "border-white/10"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            running
              ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
              : failed
                ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]"
                : "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]"
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold uppercase tracking-wider text-slate-200">
            {title}
          </div>
          {!open && (
            <div className="mt-0.5 truncate text-[10px] text-slate-500">
              {summary}
            </div>
          )}
        </div>

        {/* Work-in-progress badge — visible even while collapsed */}
        {running && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
            </span>
            {action!.label}
          </span>
        )}
        {failed && (
          <span className="shrink-0 rounded-md bg-red-500/15 px-2 py-1 text-[10px] font-semibold text-red-300 ring-1 ring-red-500/30">
            ✕ {action!.stage === "timeout" ? "sin respuesta" : "falló"}
          </span>
        )}
        {succeeded && (
          <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
            ✓ listo
          </span>
        )}

        <svg
          className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/5 p-3 pt-3">{children}</div>
      )}
    </div>
  );
}

/** Helper for section summaries: joins non-empty parts with a separator. */
export function summaryOf(...parts: (string | null | undefined)[]): string {
  return parts.filter((p): p is string => !!p).join(" · ") || "—";
}
