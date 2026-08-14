"use client";

import { StatusPanel, type StatusLevel } from "@/components/scada/status-panel";
import type { ModuleName } from "@/types/telemetry";
import { SERVICE_MODULES, type ModuleFacts } from "./service-modules";

/**
 * Left rail of the Service screen: the module navigator. Each module shows a
 * health LED (red = active fault, cyan = healthy, slate = no data) and a
 * one-line live summary — the "index" role the SCADA diagram plays on the
 * operator screen, at a fraction of the space.
 */

interface ModuleNavProps {
  facts: Record<ModuleName, ModuleFacts>;
  hasData: Record<ModuleName, boolean>;
  selected: ModuleName;
  onSelect: (m: ModuleName) => void;
  /** System health rows (same semantics as the Status screen panel). */
  health: {
    internet: StatusLevel;
    database: StatusLevel;
    equipment: StatusLevel;
    equipmentLabel: string;
  };
}

export function ModuleNav({
  facts,
  hasData,
  selected,
  onSelect,
  health,
}: ModuleNavProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
        <div className="border-b border-white/10 px-3.5 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Módulos
          </h2>
        </div>
        <div className="p-1.5">
          {SERVICE_MODULES.map((m) => {
            const f = facts[m.key];
            const active = selected === m.key;
            const led = !hasData[m.key]
              ? "bg-slate-600"
              : f.faults.length > 0
                ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]"
                : "bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.6)]";
            return (
              <button
                key={m.key}
                onClick={() => onSelect(m.key)}
                className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                  active
                    ? "bg-cyan-500/10 ring-1 ring-cyan-500/30"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                <span className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${led}`} />
                <span className="min-w-0">
                  <span
                    className={`block text-[12px] font-semibold tracking-wide ${
                      active ? "text-cyan-100" : "text-slate-200"
                    }`}
                  >
                    {m.title}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">
                    {f.summary}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <StatusPanel
        internet={health.internet}
        database={health.database}
        equipment={health.equipment}
        equipmentLabel={health.equipmentLabel}
      />
    </div>
  );
}
