import type { Database, EquipmentStateEnum } from "./database";

export type Device = Database["public"]["Tables"]["devices"]["Row"];

export type DeviceWithState = Device & {
  device_equipment_state: {
    state: EquipmentStateEnum;
    detail: Record<string, unknown> | null;
    device_ts: string;
  } | null;
};

export function isDeviceOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  return diff < 30_000; // 30 seconds
}
