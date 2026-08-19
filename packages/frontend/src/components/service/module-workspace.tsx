"use client";

import type { ModuleFacts } from "./service-modules";

/**
 * Center column of the Service screen: the selected module's workspace.
 * Header: curated live KPIs + active fault strip. Body: the module's service
 * actions, grouped by function — populated module by module; until a module's
 * action set is defined it shows a neutral placeholder.
 */

interface ModuleWorkspaceProps {
  title: string;
  facts: ModuleFacts;
  hasData: boolean;
  /** Action area content; null renders the placeholder. */
  children?: React.ReactNode;
}

const KPI_TONE: Record<NonNullable<ModuleFacts["kpis"][number]["tone"]>, string> = {
  ok: "text-emerald-300",
  info: "text-cyan-300",
  warn: "text-amber-300",
};

export function ModuleWorkspace({
  title,
  facts,
  hasData,
  children,
}: ModuleWorkspaceProps) {
  return (
    // Height-bounded flex column: the KPI header stays fixed while only the
    // action area below scrolls, on its own — the offset covers the 56px top
    // nav plus the page's top/bottom padding. overscroll-contain keeps the
    // wheel from chaining to the page once the actions hit their end.
    <div
      className="flex flex-col gap-3"
      style={{ maxHeight: "calc(100vh - 104px)" }}
    >
      {/* Header — live KPIs (fixed) */}
      <div className="shrink-0 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold uppercase tracking-wider text-slate-100">
            {title}
          </h1>
          {!hasData && (
            <span className="rounded-md bg-slate-600/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              sin telemetría
            </span>
          )}
        </div>

        {facts.kpis.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {facts.kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5"
              >
                <div className="text-[8.5px] font-semibold uppercase tracking-wider text-slate-500">
                  {k.label}
                </div>
                <div
                  className={`font-mono text-[13px] font-bold leading-tight tabular-nums ${
                    k.tone ? KPI_TONE[k.tone] : "text-slate-100"
                  }`}
                >
                  {k.value}
                  {k.unit && (
                    <span className="ml-1 text-[9px] font-medium text-slate-500">
                      {k.unit}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {facts.faults.length > 0 && (
          <div className="mt-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] leading-snug text-red-200">
            <span className="font-semibold">
              Condición{facts.faults.length > 1 ? "es" : ""} activa
              {facts.faults.length > 1 ? "s" : ""}:
            </span>{" "}
            {facts.faults.join(" · ")}
          </div>
        )}
      </div>

      {/* Action area — the only part that scrolls, independently of the page */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(148,163,184,0.3)_transparent] [scrollbar-width:thin]">
        {children ?? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/40 py-14 text-center backdrop-blur-md">
            <span className="text-2xl text-slate-700">⚙</span>
            <p className="mt-2 max-w-[300px] text-[12px] leading-relaxed text-slate-500">
              Las acciones de servicio de este módulo se habilitarán en una
              próxima actualización.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
