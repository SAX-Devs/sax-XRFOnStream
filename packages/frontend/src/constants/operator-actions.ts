/**
 * Operator action catalog — the single source of truth for which equipment
 * actions the OPERATOR role may fire, and with which arguments.
 *
 * Used in two places:
 *  - The command Route Handler enforces it SERVER-SIDE (hidden buttons are
 *    not security): operators can only send commands listed here, with every
 *    positional argument validated and any extra args (timeouts) forced to
 *    the fixed values below.
 *  - The Operator screen renders one action card per entry.
 *
 * Argument encoding verified against the equipment's CommandDaemon: each
 * *_action row declares `python_data_type` (e.g. {bool,int}) and the daemon's
 * DataTransformer requires EXACTLY that many args — so actions with extra
 * parameters must always send them, and {None} actions must send none.
 * Booleans accept 'true'/'false'; string parameters take the equipment's own
 * literals (case-sensitive).
 */

/** One positional argument's contract. */
export type ArgSpec =
  | { kind: "enum"; values: readonly string[] }
  | { kind: "number"; min: number; max: number };

export interface OperatorActionRule {
  /** Positional args in order (arg1, arg2, …). Empty = the action takes none. */
  args: readonly ArgSpec[];
  /**
   * Args appended server-side with a fixed value (e.g. a task timeout). The
   * equipment's type transformer errors on arg-count mismatch, so these are
   * mandatory whenever the action declares more parameters than the operator
   * chooses.
   */
  fixedArgs?: Readonly<Record<string, string>>;
}

/** Equipment limits read from the device's Config.ini (GENERATOR_CONFIG). */
export const GENERATOR_LIMITS = {
  maxVoltageKv: 50, // MAX_VOLTAGE
  maxCurrentUa: 2000, // MAX_CURRENT
  maxPowerW: 50, // MAX_POWER
  /**
   * Ceiling for the SINGLE-parameter current setter. set_current has no power
   * guard of its own (only set_voltage_and_current clamps power), so it is
   * bounded to the current that stays within MAX_POWER even at MAX_VOLTAGE:
   * 50 W / 50 kV = 1000 µA. Without this, setting 2000 µA while the tube sits
   * at 50 kV would ask for 100 W — double the rating.
   */
  maxCurrentUaSingle: 1000,
} as const;

export const OPERATOR_ACTIONS: Record<
  string,
  Record<string, OperatorActionRule>
> = {
  interchanger: {
    // cam_interchange(target_position: str) — full automated sequence
    // (axial DOWN → rotate → axial UP) run by the equipment itself.
    cam_interchange: {
      args: [{ kind: "enum", values: ["Chamber", "Recal"] }],
    },
    // usage_axial(target: bool, timeout: int=5) — small piston UP/DOWN.
    usage_axial: {
      args: [{ kind: "enum", values: ["true", "false"] }],
      fixedArgs: { arg2: "5" },
    },
    // usage_rot(target: bool, timeout: int=20) — large piston UP/DOWN.
    usage_rot: {
      args: [{ kind: "enum", values: ["true", "false"] }],
      fixedArgs: { arg2: "20" },
    },
  },
  circulation: {
    // set_operation_mode(mode: str) — the 7 branches of
    // Circulation.set_operation_mode; anything else is a silent no-op.
    set_operation_mode: {
      args: [
        {
          kind: "enum",
          values: [
            "Closed",
            "Brine",
            "Water",
            "Recirculation",
            "Purge",
            "Sample_taking",
            "Pump_Cleaning",
          ],
        },
      ],
    },
    // tank_percentage_fill(percentage: float) — RELATIVE amount to add.
    // Restricted to the presets the operator UI offers; 100 = fill until the
    // tank-full sensor trips.
    tank_percentage_fill: {
      args: [{ kind: "enum", values: ["10", "25", "50", "100"] }],
    },
    // empty_tank() — takes no arguments ({None}).
    empty_tank: { args: [] },
    // "cancel" is intercepted by the equipment's CommandDaemon, which signals
    // the cancel_event of the task named in arg1. Only tasks whose signature
    // declares cancel_event are really interruptible.
    cancel: { args: [{ kind: "enum", values: ["tank_percentage_fill"] }] },
  },
  vacuum: {
    // set_atmospheric_condition(status: str) — the 5 branches of
    // Vacuum.set_atmospheric_condition; anything else raises ValueError.
    set_atmospheric_condition: {
      args: [
        {
          kind: "enum",
          values: ["Atmospheric", "Vacuum", "Purge", "Clean", "Closed"],
        },
      ],
    },
    // emergency_purge() — takes no arguments ({None}).
    emergency_purge: { args: [] },
  },
  generator: {
    // set_hv_state(state: int) — 1 turns the X-ray tube ON, 0 OFF. The
    // equipment refuses to turn ON unless the door and chamber locks are
    // engaged; turning OFF is always allowed.
    set_hv_state: { args: [{ kind: "enum", values: ["0", "1"] }] },
    // standby() — 20 kV / 100 µA with HV on. Takes no arguments ({None}).
    standby: { args: [] },
    // set_voltage(voltage: float) — kV, bounded by the equipment's MAX_VOLTAGE.
    set_voltage: {
      args: [{ kind: "number", min: 0, max: GENERATOR_LIMITS.maxVoltageKv }],
    },
    // set_current(current: float) — µA. Bounded below MAX_CURRENT on purpose;
    // see GENERATOR_LIMITS.maxCurrentUaSingle.
    set_current: {
      args: [
        { kind: "number", min: 0, max: GENERATOR_LIMITS.maxCurrentUaSingle },
      ],
    },
    // set_voltage_and_current(voltage: float, current: float) — the power-safe
    // way to move the operating point: the equipment lowers the current first,
    // programs the voltage, then programs the final current, and clamps the
    // pair to MAX_POWER on its own. The full current range is safe here.
    set_voltage_and_current: {
      args: [
        { kind: "number", min: 0, max: GENERATOR_LIMITS.maxVoltageKv },
        { kind: "number", min: 0, max: GENERATOR_LIMITS.maxCurrentUa },
      ],
    },
  },
};

function argIsValid(spec: ArgSpec, raw: unknown): string | null {
  const value = String(raw ?? "");
  if (value === "") return null;
  if (spec.kind === "enum") {
    return spec.values.includes(value) ? value : null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < spec.min || n > spec.max) return null;
  return value;
}

/**
 * Validates an operator command and returns the exact args to send
 * (client-provided extras are discarded in favor of the fixed ones),
 * or null when the action or any argument is not allowed for operators.
 */
export function buildOperatorArgs(
  module: string,
  command: string,
  args: Record<string, unknown> | undefined
): Record<string, string> | null {
  const rule = OPERATOR_ACTIONS[module]?.[command];
  if (!rule) return null;

  const supplied = args ?? {};
  const out: Record<string, string> = {};

  for (let i = 0; i < rule.args.length; i++) {
    const name = `arg${i + 1}`;
    const value = argIsValid(rule.args[i], supplied[name]);
    if (value === null) return null;
    out[name] = value;
  }

  // Nothing beyond the declared args may be smuggled through: a {None} task
  // errors on the equipment if it receives any argument at all.
  const allowed = new Set([
    ...Object.keys(out),
    ...Object.keys(rule.fixedArgs ?? {}),
  ]);
  for (const [name, value] of Object.entries(supplied)) {
    if (value === undefined || value === null || String(value) === "") continue;
    if (!allowed.has(name)) return null;
  }

  return { ...out, ...rule.fixedArgs };
}
