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

/**
 * Module payload shapes — these mirror the equipment's *_status tables exactly
 * (field names and types taken from the live equipment output). The Edge Gateway
 * publishes these column names verbatim into device_telemetry.data, so the
 * frontend consumes them as-is. Decimal columns arrive as JSON numbers.
 *
 * Source of truth: live equipment status dump (confirmed with SAX). Keep these
 * in sync with the Edge Gateway publishers (integration point INT-2).
 */

export interface GeneratorData {
  hv_on: boolean;
  power_supply_on: boolean;
  interlock_open: boolean;
  interlock_fault: boolean;
  overvoltage_fault: boolean;
  configuration_fault: boolean;
  overpower_fault: boolean;
  source_undervoltage_fault: boolean;
  sic_temperature_c: number;
  sic_24v_monitor: number;
  tube_high_voltage_kv: number;
  beam_current_ua: number;
  filament_current_ma: number;
  filament_voltage: number;
  hv_board_temperature_c: number;
  dac_a_tubevoltage_kv: number;
  dac_b_tubecurrent_ua: number;
  dac_c_filamentcurrentlimit_ma: number;
  dac_d_filamentpreheatcurrent_ma: number;
  ip_address: string;
  remote_port: number;
  ramp_enabled: boolean;
  ramp_time_ms: number;
}

export interface VacuumData {
  outlet_valve: boolean;
  vacuum_pump_1: boolean;
  vacuum_pump_2: boolean;
  purge_valve: boolean;
  inlet_valve: boolean;
  vacuum_sensor: number;
  atmospheric_status: string;
  filter: string;
  chamber_leak_ok: boolean;
}

export interface CirculationData {
  operation_state: string;
  pump_state: string;
  flow_rate_in: number;
  flow_rate_out: number;
  pressure_ok: boolean;
  brine_in_valve: boolean;
  water_in_valve: boolean;
  out_valve: boolean;
  recirculation_in_valve: boolean;
  recirculation_out_valve: boolean;
  pump_forward: boolean;
  pump_reverse: boolean;
  power_state: boolean;
  tank_fill_sensor: boolean;
  tank_level_ok: boolean;
  tank_filled: boolean;
  tank_percentage_level: number;
  bypass_valve: boolean;
  pick_up_switch: boolean;
}

export interface InterchangerData {
  service_position: number;
  rot_up: boolean;
  rot_down: boolean;
  axial_up: boolean;
  axial_down: boolean;
  current_position: string;
  chamber_lock: boolean;
  door_lock: boolean;
}

export interface DetectorData {
  mca_length: number;
  gain: number;
  mca_bin_width: number;
  gain_trim: number;
  temperature: number;
  genset: number;
  parset: number;
  threshold: number;
  d_on: boolean;
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
  temp_tolerance: number;
  control_interval: number;
  integral_window: number;
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
