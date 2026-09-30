/**
 * Equipment state as published by the Edge Gateway (EquipmentStatePublisher)
 * and stored in device_equipment_state. `state` says what the equipment is
 * DOING; `detail.alerts` lists every non-OK Sentinel validation at that moment.
 * Both axes coexist on purpose: a running measurement with an active alarm is
 * "measuring" + 1 alarm, never an ERROR that hides the real activity
 * (decision 2026-09-30, after the fouled tank-pressure sensor incident).
 */

export interface EquipmentAlert {
  /** Sentinel validation_name, e.g. "auxiliary_tank_pressure_low". */
  name: string;
  /** Raw Sentinel severity: warning | alarm (legacy scale: critical | emergency). */
  severity: string;
}

const ALARM_SEVERITIES = new Set(["alarm", "critical", "emergency"]);

export function isAlarmSeverity(severity: string): boolean {
  return ALARM_SEVERITIES.has(severity.toLowerCase());
}

/** Active Sentinel validations carried in a device_equipment_state.detail JSON. */
export function equipmentAlerts(detail: unknown): EquipmentAlert[] {
  const raw = (detail as { alerts?: unknown } | null | undefined)?.alerts;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is EquipmentAlert =>
      typeof a === "object" &&
      a !== null &&
      typeof (a as EquipmentAlert).name === "string" &&
      typeof (a as EquipmentAlert).severity === "string"
  );
}

export interface AlertsHealth {
  level: "ok" | "warning" | "error";
  /** Short readout for a status row: "OK", "1 ALARMA", "2 AVISOS". */
  label: string;
  /** One validation per line, for a tooltip. Empty when healthy. */
  title: string;
  alarms: number;
  warnings: number;
}

/** Folds the alert list into one health row: alarms win over warnings. */
export function alertsHealth(alerts: EquipmentAlert[]): AlertsHealth {
  const alarms = alerts.filter((a) => isAlarmSeverity(a.severity)).length;
  const warnings = alerts.length - alarms;
  const level = alarms > 0 ? "error" : warnings > 0 ? "warning" : "ok";
  const label =
    alarms > 0
      ? `${alarms} ${alarms === 1 ? "ALARMA" : "ALARMAS"}`
      : warnings > 0
        ? `${warnings} ${warnings === 1 ? "AVISO" : "AVISOS"}`
        : "OK";
  const title = alerts.map((a) => `${a.name} · ${a.severity}`).join("\n");
  return { level, label, title, alarms, warnings };
}
