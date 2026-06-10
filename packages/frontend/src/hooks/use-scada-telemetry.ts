"use client";

import { useTelemetry } from "./use-telemetry";
import { useEquipmentState } from "./use-equipment-state";
import type { ScadaDiagramState } from "@/components/scada/process-diagram";
import type { ScadaParams } from "@/components/scada/params-panel";
import type { EquipmentStateEnum } from "@/types/database";

interface ScadaTelemetry {
  diagram: ScadaDiagramState;
  params: ScadaParams;
  meta: {
    loading: boolean;
    lastUpdated: Date | null;
    equipmentState: EquipmentStateEnum | null;
  };
}

/** Normalize the equipment's pump_state string to the diagram's union. */
function normPumpState(s: string | undefined): "FORWARD" | "REVERSE" | "STOP" {
  const u = (s ?? "").toUpperCase();
  if (u === "FORWARD" || u === "REVERSE" || u === "STOP") return u;
  return "STOP";
}

/**
 * Map the equipment's interchanger position to the arm's physical pose.
 * Confirmed values (SAX): "Chamber" = arm parked OUTSIDE the chamber (normal
 * measurement) → NORMAL; "Recal" = arm swung IN with the recal sample at the
 * window → RECAL. The parameters panel still shows the raw position string.
 */
function armMode(position: string | undefined): "NORMAL" | "RECAL" {
  return (position ?? "").toLowerCase() === "recal" ? "RECAL" : "NORMAL";
}

/**
 * Composes the seven module telemetry streams + equipment state into the two
 * shapes the SCADA screen renders: the diagram visual state and the parameters
 * panel. All mapping/polarity/normalization decisions live here so the visual
 * components stay dumb. Field names follow the live equipment schema
 * (see types/telemetry.ts).
 */
export function useScadaTelemetry(deviceId: string): ScadaTelemetry {
  const circ = useTelemetry(deviceId, "circulation");
  const vac = useTelemetry(deviceId, "vacuum");
  const inter = useTelemetry(deviceId, "interchanger");
  const det = useTelemetry(deviceId, "detector");
  const gen = useTelemetry(deviceId, "generator");
  const temp = useTelemetry(deviceId, "temp_control");
  const aux = useTelemetry(deviceId, "auxiliary");
  const equip = useEquipmentState(deviceId);

  const c = circ.data;
  const v = vac.data;
  const i = inter.data;
  const d = det.data;
  const g = gen.data;
  const tp = temp.data;
  const a = aux.data;

  const diagram: ScadaDiagramState = {
    // Circulation (liquid path) valves + pump + flows
    waterValve: c?.water_in_valve ?? false,
    brineValve: c?.brine_in_valve ?? false,
    retroValveOut: c?.recirculation_out_valve ?? false,
    retroValveIn: c?.recirculation_in_valve ?? false,
    // The diagram's "Inlet Valve" is functionally the pump bypass.
    inletValve: c?.bypass_valve ?? false,
    // The diagram's "Outlet Valve" sits on the chamber drain.
    outletValve: c?.out_valve ?? false,
    pumpState: normPumpState(c?.pump_state),
    flowRate: c?.flow_rate_in ?? 0,
    flowRateOut: c?.flow_rate_out ?? 0,
    pressureOk: c?.pressure_ok ?? true,
    tankLevelOk: c?.tank_level_ok ?? true,
    tankPercentLevel: c?.tank_percentage_level ?? 0,
    // Interchanger / chamber interlocks
    interchangerMode: armMode(i?.current_position),
    chamberLocked: i?.chamber_lock ?? false,
    maintenanceDoorClosed: i?.door_lock ?? false,
    // Detector + generator
    detectorMeasuring: d?.d_on ?? false,
    generatorHvOn: g?.hv_on ?? false,
    // Vacuum chamber leak (true = dry/OK on the equipment)
    chamberLeakOk: v?.chamber_leak_ok ?? true,
  };

  const params: ScadaParams = {
    operationMode: c?.operation_state ?? "—",
    pumpState: c?.pump_state ?? "—",
    flowIn: c?.flow_rate_in ?? 0,
    flowOut: c?.flow_rate_out ?? 0,
    atmosphericStatus: v?.atmospheric_status ?? "—",
    vacuumSensor: v?.vacuum_sensor ?? 0,
    cabinetTemp: tp?.cabinet_temperature ?? 0,
    tubeTemp: tp?.tube_temperature ?? 0,
    tubeHighVoltage: g?.tube_high_voltage_kv ?? 0,
    beamCurrent: g?.beam_current_ua ?? 0,
    // Raw equipment value, shown as-is (e.g. "Chamber").
    interchangerPosition: i?.current_position ?? "—",
    chamberLock: i?.chamber_lock ? "LOCKED" : "UNLOCKED",
    maintenanceDoor: i?.door_lock ? "CLOSED" : "OPEN",
    chamberLeak: v?.chamber_leak_ok ? "OK" : "LEAK",
    dcOk: a?.dc_ok ?? false,
    tankPressureHigh: a?.tank_pressure_high ?? false,
    tankPressureLow: a?.tank_pressure_low ?? false,
  };

  const updates = [
    circ.lastUpdated,
    vac.lastUpdated,
    inter.lastUpdated,
    det.lastUpdated,
    gen.lastUpdated,
    temp.lastUpdated,
    aux.lastUpdated,
    equip.lastUpdated,
  ].filter((x): x is Date => x !== null);

  const lastUpdated = updates.length
    ? new Date(Math.max(...updates.map((x) => x.getTime())))
    : null;

  const hasAnyData = Boolean(c || v || i || d || g || tp || a);

  return {
    diagram,
    params,
    meta: {
      loading: !hasAnyData,
      lastUpdated,
      equipmentState: equip.state,
    },
  };
}
