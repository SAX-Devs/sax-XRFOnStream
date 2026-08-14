import type {
  ModuleName,
  GeneratorData,
  VacuumData,
  CirculationData,
  InterchangerData,
  DetectorData,
  TempControlData,
  AuxiliaryData,
} from "@/types/telemetry";

/**
 * Per-module presentation config for the Service screen: what the module
 * navigator shows collapsed (summary + health) and what the workspace header
 * highlights (KPIs + active faults). Everything derives from the module's own
 * *_status telemetry — same fields the raw panel lists, curated.
 */

export interface ModuleKpi {
  label: string;
  value: string;
  unit?: string;
  tone?: "ok" | "info" | "warn";
}

export interface ModuleFacts {
  /** One-line live summary for the navigator. */
  summary: string;
  /** Header readouts for the workspace. */
  kpis: ModuleKpi[];
  /** Active fault/abnormal conditions, human-readable. */
  faults: string[];
}

function num(v: unknown, decimals = 1): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(decimals) : "—";
}

function joinParts(...parts: (string | null | undefined)[]): string {
  return parts.filter((p): p is string => !!p).join(" · ") || "sin datos";
}

function generatorFacts(d: GeneratorData | null): ModuleFacts {
  if (!d) return { summary: "sin datos", kpis: [], faults: [] };
  const kv = Number(d.tube_high_voltage_kv) || 0;
  const ua = Number(d.beam_current_ua) || 0;
  const faults = [
    d.overpower_fault && "sobrepotencia",
    d.overvoltage_fault && "sobrevoltaje",
    d.interlock_fault && "falla de enclavamiento",
    d.source_undervoltage_fault && "subtensión de fuente",
    d.configuration_fault && "falla de configuración",
  ].filter((f): f is string => typeof f === "string");
  return {
    summary: joinParts(
      d.hv_on ? "HV ON" : "HV OFF",
      `${num(kv, 0)} kV`,
      `${num(ua, 0)} µA`
    ),
    kpis: [
      {
        label: "HV",
        value: d.hv_on ? "RADIANDO" : "APAGADO",
        tone: d.hv_on ? "warn" : undefined,
      },
      { label: "Voltaje", value: num(kv), unit: "kV" },
      { label: "Corriente", value: num(ua, 0), unit: "µA" },
      { label: "Potencia", value: num((kv * ua) / 1000), unit: "W" },
      { label: "Filamento", value: num(d.filament_current_ma, 0), unit: "mA" },
      { label: "Temp. HV", value: num(d.hv_board_temperature_c), unit: "°C" },
    ],
    faults,
  };
}

function vacuumFacts(d: VacuumData | null): ModuleFacts {
  if (!d) return { summary: "sin datos", kpis: [], faults: [] };
  const pumps = d.vacuum_pump_1 || d.vacuum_pump_2;
  const faults = [
    d.atmospheric_status === "Undefined" &&
      "condición indefinida — una transición no alcanzó su presión objetivo",
    !d.chamber_leak_ok && "sensor de fuga en cámara ACTIVO",
  ].filter((f): f is string => typeof f === "string");
  return {
    summary: joinParts(
      d.atmospheric_status,
      `${num(d.vacuum_sensor)} kPa`,
      `bombas ${pumps ? "ON" : "OFF"}`
    ),
    kpis: [
      {
        label: "Condición",
        value: d.atmospheric_status ?? "—",
        tone: d.atmospheric_status === "Vacuum" ? "ok" : d.atmospheric_status === "Undefined" ? "warn" : "info",
      },
      { label: "Presión", value: num(d.vacuum_sensor), unit: "kPa" },
      { label: "Bomba 1", value: d.vacuum_pump_1 ? "ON" : "OFF" },
      { label: "Bomba 2", value: d.vacuum_pump_2 ? "ON" : "OFF" },
      { label: "Filtro", value: d.filter ?? "—" },
    ],
    faults,
  };
}

function circulationFacts(d: CirculationData | null): ModuleFacts {
  if (!d) return { summary: "sin datos", kpis: [], faults: [] };
  const faults = [
    !d.pressure_ok && "presión de entrada fuera de rango",
  ].filter((f): f is string => typeof f === "string");
  return {
    summary: joinParts(
      d.operation_state,
      `bomba ${d.pump_state ?? "—"}`,
      `tanque ${num(d.tank_percentage_level, 0)} %`
    ),
    kpis: [
      { label: "Modo", value: d.operation_state ?? "—", tone: "info" },
      { label: "Bomba", value: d.pump_state ?? "—" },
      { label: "Tanque", value: num(d.tank_percentage_level, 0), unit: "%" },
      { label: "Flujo in", value: num(d.flow_rate_in, 0) },
      { label: "Flujo out", value: num(d.flow_rate_out, 0) },
    ],
    faults,
  };
}

function interchangerFacts(d: InterchangerData | null): ModuleFacts {
  if (!d) return { summary: "sin datos", kpis: [], faults: [] };
  const axial = d.axial_up && !d.axial_down ? "UP" : d.axial_down && !d.axial_up ? "DOWN" : d.axial_up && d.axial_down ? "⚠" : "…";
  const rot = d.rot_up && !d.rot_down ? "UP" : d.rot_down && !d.rot_up ? "DOWN" : d.rot_up && d.rot_down ? "⚠" : "…";
  const faults = [
    d.axial_up && d.axial_down && "sensores axiales en conflicto (ambos activos)",
    d.rot_up && d.rot_down && "sensores rotacionales en conflicto (ambos activos)",
  ].filter((f): f is string => typeof f === "string");
  return {
    summary: joinParts(d.current_position, `axial ${axial}`, `rot ${rot}`),
    kpis: [
      { label: "Posición", value: d.current_position ?? "—", tone: "info" },
      { label: "Axial", value: axial },
      { label: "Rotacional", value: rot },
      { label: "Cámara", value: d.chamber_lock ? "BLOQUEADA" : "ABIERTA", tone: d.chamber_lock ? "ok" : "warn" },
      { label: "Puerta", value: d.door_lock ? "CERRADA" : "ABIERTA", tone: d.door_lock ? "ok" : "warn" },
    ],
    faults,
  };
}

function detectorFacts(d: DetectorData | null): ModuleFacts {
  if (!d) return { summary: "sin datos", kpis: [], faults: [] };
  return {
    summary: joinParts(
      d.measuring ? "midiendo" : "en espera",
      `${num(d.temperature)} °C`,
      `genset ${d.genset ?? "—"}`
    ),
    kpis: [
      {
        label: "Adquisición",
        value: d.measuring ? "MIDIENDO" : "EN ESPERA",
        tone: d.measuring ? "ok" : undefined,
      },
      { label: "Temperatura", value: num(d.temperature), unit: "°C" },
      { label: "Ganancia", value: num(d.gain, 3) },
      { label: "Genset/Parset", value: `${d.genset ?? "—"}/${d.parset ?? "—"}` },
      { label: "MCA", value: num(d.mca_length, 0), unit: "canales" },
    ],
    faults: [],
  };
}

function tempControlFacts(d: TempControlData | null): ModuleFacts {
  if (!d) return { summary: "sin datos", kpis: [], faults: [] };
  return {
    summary: joinParts(
      `gabinete ${num(d.cabinet_temperature)} °C`,
      `objetivo ${num(d.target_temperature)} °C`,
      d.valve_open ? "válvula abierta" : "válvula cerrada"
    ),
    kpis: [
      { label: "Gabinete", value: num(d.cabinet_temperature), unit: "°C" },
      { label: "Objetivo", value: num(d.target_temperature), unit: "°C", tone: "info" },
      { label: "Tubo", value: num(d.tube_temperature), unit: "°C" },
      { label: "Radiadores", value: `${num(d.radiator_temperature_1, 0)}/${num(d.radiator_temperature_2, 0)}`, unit: "°C" },
      { label: "Válvula", value: d.valve_open ? "ABIERTA" : "CERRADA" },
      { label: "Flujo", value: d.flow_active ? "ACTIVO" : "SIN FLUJO", tone: d.flow_active ? "ok" : "warn" },
    ],
    faults: [],
  };
}

function auxiliaryFacts(d: AuxiliaryData | null): ModuleFacts {
  if (!d) return { summary: "sin datos", kpis: [], faults: [] };
  const faults = [
    d.bat_fail && "falla de batería",
    !d.dc_ok && "alimentación DC fuera de rango",
    d.tank_pressure_low && "presión de tanque de aire BAJA",
    d.tank_pressure_high && "presión de tanque de aire ALTA",
  ].filter((f): f is string => typeof f === "string");
  return {
    summary: joinParts(
      `batería ${num(d.bat_vol)} V`,
      d.dc_ok ? "DC OK" : "DC FALLA"
    ),
    kpis: [
      { label: "Batería", value: num(d.bat_vol), unit: "V" },
      { label: "Descarga", value: d.bat_dis ? "SÍ" : "NO" },
      { label: "DC", value: d.dc_ok ? "OK" : "FALLA", tone: d.dc_ok ? "ok" : "warn" },
      {
        label: "Tanque aire",
        value: d.tank_pressure_low ? "BAJA" : d.tank_pressure_high ? "ALTA" : "OK",
        tone: d.tank_pressure_low || d.tank_pressure_high ? "warn" : "ok",
      },
    ],
    faults,
  };
}

export interface ServiceModuleDef {
  key: ModuleName;
  title: string;
}

export const SERVICE_MODULES: ServiceModuleDef[] = [
  { key: "generator", title: "Generador" },
  { key: "vacuum", title: "Vacío" },
  { key: "circulation", title: "Circulación" },
  { key: "interchanger", title: "Interchanger" },
  { key: "detector", title: "Detector" },
  { key: "temp_control", title: "Temp. Control" },
  { key: "auxiliary", title: "Auxiliar" },
];

/** Builds the navigator/workspace facts for a module from its telemetry. */
export function moduleFacts(key: ModuleName, data: unknown): ModuleFacts {
  switch (key) {
    case "generator":
      return generatorFacts(data as GeneratorData | null);
    case "vacuum":
      return vacuumFacts(data as VacuumData | null);
    case "circulation":
      return circulationFacts(data as CirculationData | null);
    case "interchanger":
      return interchangerFacts(data as InterchangerData | null);
    case "detector":
      return detectorFacts(data as DetectorData | null);
    case "temp_control":
      return tempControlFacts(data as TempControlData | null);
    case "auxiliary":
      return auxiliaryFacts(data as AuxiliaryData | null);
  }
}
