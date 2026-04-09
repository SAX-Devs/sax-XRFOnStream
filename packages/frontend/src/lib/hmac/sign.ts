import { createHmac } from "crypto";

/**
 * Signs a command payload with HMAC-SHA256.
 * Used by the Route Handler to sign commands before publishing to MQTT.
 * The Edge Gateway verifies this signature before executing the command.
 */
export function signCommand(
  payload: Record<string, unknown>,
  hmacSecret: Buffer
): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHmac("sha256", hmacSecret).update(canonical).digest("hex");
}
