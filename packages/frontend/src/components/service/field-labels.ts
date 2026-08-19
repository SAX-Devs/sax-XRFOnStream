/**
 * Spanish labels for the raw telemetry fields and the service actions.
 *
 * The Service screen faces technicians, so raw field/command names stay
 * available as a secondary reference (they're how issues get discussed with
 * the equipment team) — but a readable Spanish label leads. Unknown fields
 * fall back to a "prettified" name (underscores → spaces, capitalized), so a
 * new equipment field never shows up as a raw key.
 */

/** Telemetry field (any module's *_status) → readable Spanish label. */
const FIELD_LABELS: Record<string, string> = {
  // Common metadata
  index: "Índice",
  ts: "Marca de tiempo",
  ip_address: "Dirección IP",
  remote_port: "Puerto remoto",

  // Generator
  hv_on: "Alto voltaje encendido",
  power_supply_on: "Fuente energizada",
  interlock_open: "Enclavamiento abierto",
  interlock_fault: "Falla de enclavamiento",
  overvoltage_fault: "Falla de sobrevoltaje",
  overpower_fault: "Falla de sobrepotencia",
  configuration_fault: "Falla de configuración",
  source_undervoltage_fault: "Falla de subtensión de fuente",
  tube_high_voltage_kv: "Voltaje del tubo (kV)",
  beam_current_ua: "Corriente del haz (µA)",
  filament_current_ma: "Corriente de filamento (mA)",
  filament_voltage_v: "Voltaje de filamento (V)",
  hv_board_temperature_c: "Temperatura placa HV (°C)",
  sic_temperature_c: "Temperatura SIC (°C)",
  sic_24v_monitor_v: "Monitor 24V SIC (V)",
  ramp_enabled: "Rampa habilitada",
  ramp_time_ms: "Tiempo de rampa (ms)",
  dac_a_tubevoltage_kv: "DAC A · voltaje tubo (kV)",
  dac_b_tubecurrent_ua: "DAC B · corriente tubo (µA)",
  dac_c_filamentcurrentlimit_ma: "DAC C · límite filamento (mA)",
  dac_d_filamentpreheatcurrent_ma: "DAC D · precalent. filamento (mA)",

  // Vacuum
  atmospheric_status: "Condición atmosférica",
  vacuum_sensor: "Sensor de vacío (kPa)",
  vacuum_pump_1: "Bomba de vacío 1",
  vacuum_pump_2: "Bomba de vacío 2",
  inlet_valve: "Válvula de entrada",
  outlet_valve: "Válvula de salida",
  purge_valve: "Válvula de purga",
  chamber_leak_ok: "Cámara sin fuga",
  filter: "Filtro",

  // Circulation
  operation_state: "Estado de operación",
  pump_state: "Estado de la bomba",
  flow_rate_in: "Flujo de entrada",
  flow_rate_out: "Flujo de salida",
  tank_fill_sensor: "Sensor de llenado del tanque",
  tank_percentage_level: "Nivel del tanque (%)",
  tank_level_ok: "Nivel de tanque OK",
  tank_filled: "Tanque lleno",
  pressure_ok: "Presión OK",
  brine_in_valve: "Válvula entrada salmuera",
  water_in_valve: "Válvula entrada agua",
  out_valve: "Válvula de salida",
  recirculation_in_valve: "Válvula entrada recirculación",
  recirculation_out_valve: "Válvula salida recirculación",
  bypass_valve: "Válvula de bypass",
  pump_forward: "Bomba adelante",
  pump_reverse: "Bomba reversa",
  power_status: "Alimentación",
  pick_up_switch: "Interruptor de pickup",

  // Interchanger
  current_position: "Posición actual",
  service_position: "Posición de servicio",
  rot_up: "Rotacional arriba",
  rot_down: "Rotacional abajo",
  axial_up: "Axial arriba",
  axial_down: "Axial abajo",
  chamber_lock: "Bloqueo de cámara",
  door_lock: "Bloqueo de puerta",

  // Detector
  mca_length: "Longitud MCA (canales)",
  gain: "Ganancia",
  mca_bin_width: "Ancho de bin MCA",
  gain_trim: "Ajuste de ganancia",
  temperature: "Temperatura (°C)",
  genset: "Genset",
  parset: "Parset",
  threshold: "Umbral",
  d_on: "Detector encendido",
  measuring: "Adquiriendo",

  // Temp. control
  cabinet_temperature: "Temperatura del gabinete (°C)",
  radiator_temperature_1: "Temperatura radiador 1 (°C)",
  radiator_temperature_2: "Temperatura radiador 2 (°C)",
  tube_temperature: "Temperatura del tubo (°C)",
  target_temperature: "Temperatura objetivo (°C)",
  water_pressure: "Presión de agua",
  flow_active: "Flujo activo",
  valve_open: "Válvula abierta",
  temp_tolerance: "Tolerancia de temperatura",
  control_interval: "Intervalo de control",
  integral_window: "Ventana integral",

  // Auxiliary
  bat_vol: "Voltaje de batería (V)",
  bat_dis: "Batería en descarga",
  bat_fail: "Falla de batería",
  dc_ok: "DC OK",
  tank_pressure_high: "Presión de tanque alta",
  tank_pressure_low: "Presión de tanque baja",
};

/** Underscores → spaces, first letter capitalized. */
function prettify(key: string): string {
  const s = key.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? prettify(key);
}
