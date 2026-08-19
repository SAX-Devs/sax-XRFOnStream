import {
  argIsValid,
  buildOperatorArgs,
  GENERATOR_LIMITS,
  type ArgSpec,
} from "./operator-actions";

/**
 * Service action catalog — which equipment actions the SERVICE role may fire
 * beyond the operator set, with every positional argument validated. Enforced
 * SERVER-SIDE by the command Route Handler, exactly like the operator catalog:
 * a service session can fire (operator ∪ service) actions and nothing else.
 *
 * Everything here is verified against the equipment's Generator.py and its
 * Config.ini — ranges are the equipment's own, not invented.
 */

export interface ServiceActionRule {
  /** Positional args in order (arg1, arg2, …). Empty = the action takes none. */
  args: readonly ArgSpec[];
  /**
   * Cross-argument constraint the per-arg specs can't express. Returns an
   * error string to reject, or null to accept.
   */
  crossCheck?: (args: Record<string, string>) => string | null;
}

export const SERVICE_ACTIONS: Record<
  string,
  Record<string, ServiceActionRule>
> = {
  generator: {
    // power(on_state: bool) — the generator's 24V supply relay.
    power: { args: [{ kind: "enum", values: ["true", "false"] }] },
    // set_hv_state_service(state: int) — HV on/off WITHOUT the door/chamber
    // interlock check (the service bypass). 1 = radiate, 0 = stop.
    set_hv_state_service: { args: [{ kind: "enum", values: ["0", "1"] }] },
    // reset_faults() — clears the X-ray source fault indicators. {None}.
    reset_faults: { args: [] },
    // set_filament_current_limit(mA) — bounded by MAX_FIL_CURRENT=3500.
    set_filament_current_limit: {
      args: [{ kind: "number", min: 0, max: 3500 }],
    },
    // set_filament_preheat(mA) — bounded by MAX_FIL_PREHEAT=2000.
    set_filament_preheat: { args: [{ kind: "number", min: 0, max: 2000 }] },
    // set_filament_ramp_time(enable: 0/1, ramp_time_ms: 0-10000). The
    // equipment couples them: disable requires time=0, enable requires >0.
    set_filament_ramp_time: {
      args: [
        { kind: "enum", values: ["0", "1"] },
        { kind: "number", min: 0, max: 10000 },
      ],
      crossCheck: (args) => {
        const enable = args.arg1 === "1";
        const ms = Number(args.arg2);
        if (!enable && ms !== 0) return "Con rampa deshabilitada el tiempo debe ser 0";
        if (enable && ms <= 0) return "Con rampa habilitada el tiempo debe ser mayor a 0";
        return null;
      },
    },
    // The operator's five generator actions are also available to service via
    // the operator catalog (buildServiceArgs falls through to it), with one
    // service-specific difference handled there: none — same physics, same
    // bounds (set_current stays capped at the power-safe 1000 µA; the full
    // range is only reachable through set_voltage_and_current, which clamps
    // power on the equipment).
  },
};

// Re-exported so the service UI shows the same numbers the server enforces.
export { GENERATOR_LIMITS };

/**
 * Validates a service-role command and returns the exact args to send, or
 * null when the action/argument is not allowed. Service = operator ∪ service:
 * anything the operator may do, service may do too.
 */
export function buildServiceArgs(
  module: string,
  command: string,
  args: Record<string, unknown> | undefined
): Record<string, string> | null {
  const rule = SERVICE_ACTIONS[module]?.[command];
  if (!rule) return buildOperatorArgs(module, command, args);

  const supplied = args ?? {};
  const out: Record<string, string> = {};

  for (let i = 0; i < rule.args.length; i++) {
    const name = `arg${i + 1}`;
    const value = argIsValid(rule.args[i], supplied[name]);
    if (value === null) return null;
    out[name] = value;
  }

  // A {None} task errors on the equipment if it receives any argument at all,
  // and extra args must never ride along.
  const allowed = new Set(Object.keys(out));
  for (const [name, value] of Object.entries(supplied)) {
    if (value === undefined || value === null || String(value) === "") continue;
    if (!allowed.has(name)) return null;
  }

  if (rule.crossCheck && rule.crossCheck(out) !== null) return null;

  return out;
}
