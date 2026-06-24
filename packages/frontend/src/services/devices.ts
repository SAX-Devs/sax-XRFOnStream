import { createClient } from "@/lib/supabase/server";
import type { DeviceWithState } from "@/types/devices";

export async function getDevices(): Promise<DeviceWithState[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("devices")
    .select("*, device_equipment_state(state, detail, device_ts), tenants(name)")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as unknown as DeviceWithState[];
}

export async function getDevice(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("devices")
    .select("*, device_equipment_state(state, detail, device_ts)")
    .eq("id", id)
    .single();

  if (error) return null;

  return data as unknown as DeviceWithState;
}
