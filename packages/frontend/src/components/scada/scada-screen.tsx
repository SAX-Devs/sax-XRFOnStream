"use client";

import { useEffect, useState } from "react";
import { ProcessDiagram } from "./process-diagram";
import { DiagramHeader } from "./diagram-header";
import { ParamsPanel } from "./params-panel";
import { MessagesPanel } from "./messages-panel";
import { StatusPanel, type StatusLevel } from "./status-panel";
import { SpectrumButton } from "./control-bar";
import { useScadaTelemetry } from "@/hooks/use-scada-telemetry";
import { useScadaEvents } from "@/hooks/use-scada-events";
import { alertsHealth } from "@/types/equipment-state";

interface ScadaScreenProps {
  deviceId: string;
  userLabel?: string;
  userRole?: string;
}

/**
 * Equipment operational state → system-panel row (status colour + label).
 * "error" only means "idle with an active alarm": while the equipment measures,
 * the state stays "measuring" and the alarm shows in its own "Alarmas" row.
 */
const EQUIPMENT_ROW: Record<string, { status: StatusLevel; label: string }> = {
  measuring: { status: "ok", label: "Midiendo" },
  standby: { status: "ok", label: "Standby" },
  idle: { status: "ok", label: "Reposo" },
  initializing: { status: "ok", label: "Inicializando" },
  error: { status: "error", label: "ERROR" },
  offline: { status: "error", label: "Desconectado" },
  unknown: { status: "warning", label: "Desconocido" },
};

export function ScadaScreen({ deviceId, userLabel, userRole }: ScadaScreenProps) {
  // P&ID tags are clutter for the operator view; only show them in the Service screen.
  const showTags = userRole === "service";

  // Live telemetry → diagram visual state + parameters panel.
  const { diagram, params, meta } = useScadaTelemetry(deviceId);

  // Live event log: every discrete transition observed while the page is open.
  const events = useScadaEvents(
    diagram,
    params,
    meta.equipmentState,
    meta.alerts,
    meta.loading
  );

  // Re-render every 15s so the data-freshness indicator ages truthfully even
  // when no new data arrives.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  // "Internet" = equipment ↔ cloud link, judged by data freshness.
  const ageMs = meta.lastUpdated
    ? Date.now() - meta.lastUpdated.getTime()
    : null;
  const internet: StatusLevel =
    ageMs === null
      ? meta.loading
        ? "warning"
        : "error"
      : ageMs < 60_000
        ? "ok"
        : ageMs < 300_000
          ? "warning"
          : "error";

  // "DB" = dashboard ↔ Supabase (did the last polls succeed?).
  const database: StatusLevel = meta.dbOk ? "ok" : "error";

  // "Equipo" = real operational state.
  const equipment =
    EQUIPMENT_ROW[meta.equipmentState ?? "unknown"] ?? EQUIPMENT_ROW.unknown;

  // "Alarmas" = active Sentinel validations, shown even while measuring.
  const alarms = alertsHealth(meta.alerts);

  return (
    <div className="space-y-3">
      <DiagramHeader userLabel={userLabel} userRole={userRole} />

      <div className="grid grid-cols-[180px_minmax(0,1fr)_340px] gap-3 items-start">
        {/* Left column — Spectrum, Status, Messages */}
        <div className="flex flex-col gap-3">
          <SpectrumButton />
          <StatusPanel
            internet={internet}
            database={database}
            equipment={equipment.status}
            equipmentLabel={equipment.label}
            alarms={alarms.level}
            alarmsLabel={alarms.label}
            alarmsTitle={alarms.title}
          />
          <MessagesPanel messages={events} />
        </div>

        {/* Center — process diagram */}
        <ProcessDiagram state={diagram} showTags={showTags} />

        {/* Right column — parameters */}
        <ParamsPanel params={params} />
      </div>
    </div>
  );
}
