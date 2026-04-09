import type { Database } from "./database";

export type TelemetryRow =
  Database["public"]["Tables"]["device_telemetry"]["Row"];

export type ModuleName =
  | "generator"
  | "vacuum"
  | "circulation"
  | "interchanger"
  | "detector"
  | "temp_control"
  | "auxiliary";

export interface GeneratorData {
  hv_on: boolean;
  power_supply_on: boolean;
  tube_high_voltage_kv: number;
  beam_current_ua: number;
  sic_temperature_c: number;
  hv_board_temperature_c: number;
  interlock_open: boolean;
  interlock_fault: boolean;
  overvoltage_fault: boolean;
  configuration_fault: boolean;
  overpower_fault: boolean;
  ramp_enabled: boolean;
  ramp_time_ms: number;
}

export interface VacuumData {
  vacuum_sensor: number;
  atmospheric_status: string;
  outlet_valve: boolean;
  vacuum_pump_1: boolean;
  vacuum_pump_2: boolean;
  purge_valve: boolean;
  inlet_valve: boolean;
  chamber_liquid_sensor: boolean;
}

export interface CirculationData {
  operation_state: string;
  pump_state: string;
  flow_rate_in: number;
  flow_rate_out: number;
  high_pressure_sensor: boolean;
  brine_in_valve: boolean;
  water_in_valve: boolean;
  out_valve: boolean;
  recirculation_in_valve: boolean;
  recirculation_out_valve: boolean;
}

export interface InterchangerData {
  current_position: string;
  service_position: number;
  rot_up: boolean;
  rot_down: boolean;
  axial_up: boolean;
  axial_down: boolean;
  chamber_lock: boolean;
  door_lock: boolean;
}

export interface DetectorData {
  mca_length: number;
  gain: number;
  temperature: number;
  d_on: boolean;
  threshold: number;
}

export interface TempControlData {
  cabinet_temperature: number;
  radiator_temperature_1: number;
  radiator_temperature_2: number;
  tube_temperature: number;
  target_temperature: number;
  water_pressure: number;
  flow_active: boolean;
  valve_open: boolean;
}

export interface AuxiliaryData {
  bat_vol: number;
  bat_dis: boolean;
  bat_fail: boolean;
  dc_ok: boolean;
  tank_pressure_high: boolean;
  tank_pressure_low: boolean;
}

export type ModuleDataMap = {
  generator: GeneratorData;
  vacuum: VacuumData;
  circulation: CirculationData;
  interchanger: InterchangerData;
  detector: DetectorData;
  temp_control: TempControlData;
  auxiliary: AuxiliaryData;
};
