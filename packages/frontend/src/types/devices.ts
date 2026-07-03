import type { Database, EquipmentStateEnum } from "./database";

export type Device = Database["public"]["Tables"]["devices"]["Row"];

export type DeviceWithState = Device & {
  device_equipment_state: {
    state: EquipmentStateEnum;
    detail: Record<string, unknown> | null;
    device_ts: string;
  } | null;
  tenants: { name: string } | null;
};

export function isDeviceOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  // The ingestion service bumps last_seen_at at most once per minute (60s
  // cache) and telemetry is change-only, so a healthy device can easily go
  // minutes between bumps. 5 min matches the design docs' online window.
  return diff < 5 * 60_000;
}
