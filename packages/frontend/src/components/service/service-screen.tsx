"use client";

import { useEffect, useState } from "react";
import { ModuleNav } from "./module-nav";
import { ModuleWorkspace } from "./module-workspace";
import { RawTelemetry } from "./raw-telemetry";
import { ModuleActivity } from "./module-activity";
import { moduleFacts, SERVICE_MODULES, type ModuleFacts } from "./service-modules";
import { GeneratorServiceActions } from "./generator-actions";
import { VacuumServiceActions } from "./vacuum-actions";
import { CirculationServiceActions } from "./circulation-actions";
import { InterchangerServiceActions } from "./interchanger-actions";
import { useTelemetry } from "@/hooks/use-telemetry";
import { useEquipmentState } from "@/hooks/use-equipment-state";
import { useActionRunner } from "@/hooks/use-action-runner";
import type { StatusLevel } from "@/components/scada/status-panel";
import type {
  GeneratorData,
  InterchangerData,
  VacuumData,
  CirculationData,
  ModuleName,
} from "@/types/telemetry";

/**
 * Service screen — the technician's workspace. Deliberately NOT a variation
 * of the Status screen: no SCADA diagram, no curated operator cards.
 *
 * Layout (option A, approved):
 *   [ module navigator | selected module workspace | raw telemetry + activity ]
 *
 * The navigator plays the "index" role (health LED + live summary per module);
 * the workspace shows curated KPIs, active faults and — as SAX defines each
 * module's service subset — the action rows; the right column is the evidence:
 * every raw field of the module (flashing on change) and the module's command
 * activity, so cause and effect stay side by side.
 */

/** Equipment operational state → health row (same map the Status screen uses). */
const EQUIPMENT_ROW: Record<string, { status: StatusLevel; label: string }> = {
  measuring: { status: "ok", label: "Midiendo" },
  standby: { status: "ok", label: "Standby" },
  idle: { status: "ok", label: "Reposo" },
  initializing: { status: "ok", label: "Inicializando" },
  error: { status: "error", label: "ERROR" },
  offline: { status: "error", label: "Desconectado" },
  unknown: { status: "warning", label: "Desconocido" },
};

export function ServiceScreen({
  deviceId,
  provisioned,
}: {
  deviceId: string;
  provisioned: boolean;
}) {
  const generator = useTelemetry(deviceId, "generator");
  const vacuum = useTelemetry(deviceId, "vacuum");
  const circulation = useTelemetry(deviceId, "circulation");
  const interchanger = useTelemetry(deviceId, "interchanger");
  const detector = useTelemetry(deviceId, "detector");
  const tempControl = useTelemetry(deviceId, "temp_control");
  const auxiliary = useTelemetry(deviceId, "auxiliary");
  const equip = useEquipmentState(deviceId);
  const { actions, run, dismiss } = useActionRunner(deviceId);

  const [selected, setSelected] = useState<ModuleName>("generator");

  // Freshness/health ages truthfully even when no new data arrives.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const telemetry: Record<
    ModuleName,
    { data: unknown; lastUpdated: Date | null; errored: boolean }
  > = {
    generator,
    vacuum,
    circulation,
    interchanger,
    detector,
    temp_control: tempControl,
    auxiliary,
  };

  const facts = {} as Record<ModuleName, ModuleFacts>;
  const hasData = {} as Record<ModuleName, boolean>;
  for (const m of SERVICE_MODULES) {
    facts[m.key] = moduleFacts(m.key, telemetry[m.key].data ?? null);
    hasData[m.key] = telemetry[m.key].data != null;
  }

  // System health, same semantics as the Status screen.
  const newest = Math.max(
    0,
    ...SERVICE_MODULES.map((m) => telemetry[m.key].lastUpdated?.getTime() ?? 0)
  );
  const ageMs = newest > 0 ? Date.now() - newest : null;
  const internet: StatusLevel =
    ageMs === null ? "warning" : ageMs < 60_000 ? "ok" : ageMs < 300_000 ? "warning" : "error";
  const database: StatusLevel = SERVICE_MODULES.some(
    (m) => telemetry[m.key].errored
  )
    ? "error"
    : "ok";
  const equipment =
    EQUIPMENT_ROW[equip.state ?? "unknown"] ?? EQUIPMENT_ROW.unknown;

  const current = SERVICE_MODULES.find((m) => m.key === selected)!;

  return (
    <div className="grid grid-cols-[210px_minmax(0,1fr)_330px] items-start gap-3">
      {/* Left — module navigator + system health */}
      <ModuleNav
        facts={facts}
        hasData={hasData}
        selected={selected}
        onSelect={setSelected}
        health={{
          internet,
          database,
          equipment: equipment.status,
          equipmentLabel: equipment.label,
        }}
      />

      {/* Center — selected module workspace */}
      <ModuleWorkspace
        title={current.title}
        facts={facts[selected]}
        hasData={hasData[selected]}
      >
        {selected === "generator" && (
          <GeneratorServiceActions
            data={generator.data as GeneratorData | null}
            interlocks={interchanger.data as InterchangerData | null}
            action={actions["generator"] ?? null}
            disabled={!provisioned}
            onRun={(command, args, label, timeoutMs) =>
              run("generator", command, args, label, timeoutMs)
            }
            onDismiss={() => dismiss("generator")}
          />
        )}
        {selected === "vacuum" && (
          <VacuumServiceActions
            data={vacuum.data as VacuumData | null}
            action={actions["vacuum"] ?? null}
            disabled={!provisioned}
            onRun={(command, args, label, timeoutMs) =>
              run("vacuum", command, args, label, timeoutMs)
            }
            onDismiss={() => dismiss("vacuum")}
          />
        )}
        {selected === "circulation" && (
          <CirculationServiceActions
            data={circulation.data as CirculationData | null}
            action={actions["circulation"] ?? null}
            disabled={!provisioned}
            onRun={(command, args, label, timeoutMs) =>
              run("circulation", command, args, label, timeoutMs)
            }
            onDismiss={() => dismiss("circulation")}
          />
        )}
        {selected === "interchanger" && (
          <InterchangerServiceActions
            data={interchanger.data as InterchangerData | null}
            action={actions["interchanger"] ?? null}
            disabled={!provisioned}
            onRun={(command, args, label, timeoutMs) =>
              run("interchanger", command, args, label, timeoutMs)
            }
            onDismiss={() => dismiss("interchanger")}
          />
        )}
      </ModuleWorkspace>

      {/* Right — evidence: raw telemetry + module activity */}
      <div className="flex flex-col gap-3">
        <RawTelemetry
          moduleTitle={current.title}
          data={(telemetry[selected].data as Record<string, unknown>) ?? null}
          lastUpdated={telemetry[selected].lastUpdated}
        />
        <ModuleActivity deviceId={deviceId} module={selected} />
      </div>
    </div>
  );
}
