"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DeviceCard } from "./device-card";
import type { DeviceWithState } from "@/types/devices";

const SELECT =
  "*, device_equipment_state(state, detail, device_ts), tenants(name)";

/**
 * Live device grid: server-rendered initial data, then kept fresh without
 * reloading — Realtime events (equipment state changes, device row updates)
 * trigger an immediate refetch, a 60s poll acts as fallback, and a 30s tick
 * re-renders so the online indicator (computed from last_seen_at vs now)
 * stays truthful even without new events.
 */
export function DevicesGrid({
  initialDevices,
}: {
  initialDevices: DeviceWithState[];
}) {
  const channelId = useId();
  const [devices, setDevices] = useState(initialDevices);
  const [, setTick] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function refetch() {
      const { data } = await supabase
        .from("devices")
        .select(SELECT)
        .order("created_at", { ascending: true });
      if (active && data) {
        setDevices(data as unknown as DeviceWithState[]);
      }
    }

    const channel = supabase
      .channel(`devices-grid:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_equipment_state" },
        refetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devices" },
        refetch
      )
      .subscribe();

    const poll = setInterval(refetch, 60_000);
    const tick = setInterval(() => setTick((t) => t + 1), 30_000);

    return () => {
      active = false;
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [channelId]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {devices.map((device) => (
        <DeviceCard key={device.id} device={device} />
      ))}
    </div>
  );
}
