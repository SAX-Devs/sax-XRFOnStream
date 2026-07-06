"use client";

import { useEffect, useRef, useState } from "react";
import type { ScadaDiagramState } from "@/components/scada/process-diagram";
import type { ScadaParams } from "@/components/scada/params-panel";
import type { EquipmentStateEnum } from "@/types/database";

export interface ScadaEvent {
  id: number;
  timestamp: string;
  severity: "info" | "warning" | "critical";
  text: string;
}

const MAX_EVENTS = 50;

const STATE_LABEL: Record<string, string> = {
  idle: "Reposo",
  measuring: "Midiendo",
  initializing: "Inicializando",
  standby: "Standby",
  error: "ERROR",
  offline: "Desconectado",
  unknown: "Desconocido",
};

interface Snapshot {
  equipState: string | null;
  pumpState: string;
  brineValve: boolean;
  waterValve: boolean;
  inletValve: boolean;
  outletValve: boolean;
  retroValveOut: boolean;
  retroValveIn: boolean;
  generatorHvOn: boolean;
  chamberLocked: boolean;
  maintenanceDoorClosed: boolean;
  chamberLeakOk: boolean;
  pressureOk: boolean;
  tankLevelOk: boolean;
  detectorMeasuring: boolean;
  flowing: boolean;
  operationMode: string;
  atmosphericStatus: string;
  interchangerPosition: string;
}

type Change = { severity: ScadaEvent["severity"]; text: string };

function valveChange(name: string, open: boolean): Change {
  return { severity: "info", text: `Válvula ${name} ${open ? "abierta" : "cerrada"}` };
}

/** Diff two snapshots into human-readable event messages (Spanish). */
function diff(prev: Snapshot, curr: Snapshot): Change[] {
  const out: Change[] = [];

  if (curr.equipState !== prev.equipState && curr.equipState) {
    out.push({
      severity:
        curr.equipState === "error"
          ? "critical"
          : curr.equipState === "offline"
            ? "warning"
            : "info",
      text: `Estado del equipo → ${STATE_LABEL[curr.equipState] ?? curr.equipState}`,
    });
  }
  if (curr.pumpState !== prev.pumpState)
    out.push({ severity: "info", text: `Bomba peristáltica → ${curr.pumpState}` });

  if (curr.brineValve !== prev.brineValve) out.push(valveChange("Brine", curr.brineValve));
  if (curr.waterValve !== prev.waterValve) out.push(valveChange("Water", curr.waterValve));
  if (curr.inletValve !== prev.inletValve)
    out.push(valveChange("Inlet (bypass)", curr.inletValve));
  if (curr.outletValve !== prev.outletValve) out.push(valveChange("Outlet", curr.outletValve));
  if (curr.retroValveOut !== prev.retroValveOut)
    out.push(valveChange("Retro salida", curr.retroValveOut));
  if (curr.retroValveIn !== prev.retroValveIn)
    out.push(valveChange("Retro entrada", curr.retroValveIn));

  if (curr.generatorHvOn !== prev.generatorHvOn)
    out.push({
      severity: "info",
      text: curr.generatorHvOn ? "Generador HV encendido" : "Generador HV apagado",
    });
  if (curr.chamberLocked !== prev.chamberLocked)
    out.push(
      curr.chamberLocked
        ? { severity: "info", text: "Cámara de análisis bloqueada" }
        : { severity: "warning", text: "Cámara de análisis DESBLOQUEADA" }
    );
  if (curr.maintenanceDoorClosed !== prev.maintenanceDoorClosed)
    out.push(
      curr.maintenanceDoorClosed
        ? { severity: "info", text: "Puerta de mantenimiento cerrada" }
        : { severity: "critical", text: "Puerta de mantenimiento ABIERTA" }
    );
  if (curr.chamberLeakOk !== prev.chamberLeakOk)
    out.push(
      curr.chamberLeakOk
        ? { severity: "info", text: "Sensor de fuga: seco" }
        : { severity: "critical", text: "¡FUGA detectada en cámara interna!" }
    );
  if (curr.pressureOk !== prev.pressureOk)
    out.push(
      curr.pressureOk
        ? { severity: "info", text: "Presión normalizada" }
        : { severity: "warning", text: "Presión fuera de rango" }
    );
  if (curr.tankLevelOk !== prev.tankLevelOk)
    out.push(
      curr.tankLevelOk
        ? { severity: "info", text: "Nivel de tanque OK" }
        : { severity: "warning", text: "Nivel de tanque bajo" }
    );
  if (curr.detectorMeasuring !== prev.detectorMeasuring)
    out.push({
      severity: "info",
      text: curr.detectorMeasuring
        ? "Detector: adquisición iniciada"
        : "Detector: adquisición finalizada",
    });
  if (curr.flowing !== prev.flowing)
    out.push({
      severity: "info",
      text: curr.flowing ? "Flujo de proceso detectado" : "Flujo de proceso detenido",
    });
  if (curr.operationMode !== prev.operationMode)
    out.push({ severity: "info", text: `Modo de operación → ${curr.operationMode}` });
  if (curr.atmosphericStatus !== prev.atmosphericStatus)
    out.push({ severity: "info", text: `Atmósfera → ${curr.atmosphericStatus}` });
  if (curr.interchangerPosition !== prev.interchangerPosition)
    out.push({
      severity: "info",
      text: `Intercambiador → ${curr.interchangerPosition}`,
    });

  return out;
}

/**
 * Client-side live event log for the Status screen: watches the composed SCADA
 * state and records every discrete transition it observes while the page is
 * open (equipment state, valves, interlocks, pump, detector, flow...).
 * Ephemeral by design — it starts from the first data received and is lost on
 * reload. Numeric fluctuations (flows, temperatures) are deliberately not
 * logged; only discrete state changes.
 */
export function useScadaEvents(
  diagram: ScadaDiagramState,
  params: ScadaParams,
  equipState: EquipmentStateEnum | null,
  loading: boolean
): ScadaEvent[] {
  const [events, setEvents] = useState<ScadaEvent[]>([]);
  const prevRef = useRef<Snapshot | null>(null);
  const idRef = useRef(1);

  useEffect(() => {
    if (loading) return;

    const snap: Snapshot = {
      equipState,
      pumpState: diagram.pumpState,
      brineValve: diagram.brineValve,
      waterValve: diagram.waterValve,
      inletValve: diagram.inletValve,
      outletValve: diagram.outletValve,
      retroValveOut: diagram.retroValveOut,
      retroValveIn: diagram.retroValveIn,
      generatorHvOn: diagram.generatorHvOn,
      chamberLocked: diagram.chamberLocked,
      maintenanceDoorClosed: diagram.maintenanceDoorClosed,
      chamberLeakOk: diagram.chamberLeakOk,
      pressureOk: diagram.pressureOk,
      tankLevelOk: diagram.tankLevelOk,
      detectorMeasuring: diagram.detectorMeasuring,
      flowing: diagram.pumpState !== "STOP" || diagram.flowRate > 0.1,
      operationMode: params.operationMode,
      atmosphericStatus: params.atmosphericStatus,
      interchangerPosition: params.interchangerPosition,
    };

    if (prevRef.current === null) {
      // First real data = baseline; only transitions AFTER this are logged.
      prevRef.current = snap;
      return;
    }

    const changes = diff(prevRef.current, snap);
    prevRef.current = snap;

    if (changes.length > 0) {
      const timestamp = new Date().toLocaleTimeString("es-CL", { hour12: false });
      setEvents((prev) =>
        [
          ...prev,
          ...changes.map((c) => ({ id: idRef.current++, timestamp, ...c })),
        ].slice(-MAX_EVENTS)
      );
    }
  });

  return events;
}
