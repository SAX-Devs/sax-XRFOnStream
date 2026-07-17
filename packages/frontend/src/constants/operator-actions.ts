/**
 * Operator action catalog — the single source of truth for which equipment
 * actions the OPERATOR role may fire, and with which arguments.
 *
 * Used in two places:
 *  - The command Route Handler enforces it SERVER-SIDE (hidden buttons are
 *    not security): operators can only send commands listed here, with arg1
 *    restricted to the allowed values and any extra args (timeouts) forced
 *    to the fixed values below.
 *  - The Operator screen renders one action card per entry.
 *
 * Argument encoding verified against the equipment's CommandDaemon:
 * each *_action row declares `python_data_type` (e.g. {bool,int}) and the
 * daemon's DataTransformer requires EXACTLY that many args — so actions with
 * a timeout parameter must always send it. Booleans accept 'true'/'false'
 * (case-insensitive); cam_interchange takes the literal position strings
 * 'Chamber' / 'Recal' (case-sensitive).
 */

export interface OperatorActionRule {
  /** Allowed arg1 values, sent verbatim to the equipment. */
  arg1: readonly string[];
  /**
   * Fixed args appended server-side (e.g. the task timeout in seconds).
   * The equipment's type transformer errors on arg-count mismatch, so these
   * are mandatory whenever the action declares more than one parameter.
   */
  fixedArgs?: Readonly<Record<string, string>>;
}

export const OPERATOR_ACTIONS: Record<
  string,
  Record<string, OperatorActionRule>
> = {
  interchanger: {
    // cam_interchange(target_position: str) — full automated sequence
    // (axial DOWN → rotate → axial UP) run by the equipment itself.
    cam_interchange: { arg1: ["Chamber", "Recal"] },
    // usage_axial(target: bool, timeout: int=5) — small piston UP/DOWN.
    usage_axial: { arg1: ["true", "false"], fixedArgs: { arg2: "5" } },
    // usage_rot(target: bool, timeout: int=20) — large piston UP/DOWN.
    usage_rot: { arg1: ["true", "false"], fixedArgs: { arg2: "20" } },
  },
};

/**
 * Validates an operator command and returns the exact args to send
 * (client-provided extras are discarded in favor of the fixed ones),
 * or null when the action/argument is not allowed for operators.
 */
export function buildOperatorArgs(
  module: string,
  command: string,
  arg1: unknown
): Record<string, string> | null {
  const rule = OPERATOR_ACTIONS[module]?.[command];
  if (!rule) return null;
  const value = String(arg1 ?? "");
  if (!rule.arg1.includes(value)) return null;
  return { arg1: value, ...rule.fixedArgs };
}
