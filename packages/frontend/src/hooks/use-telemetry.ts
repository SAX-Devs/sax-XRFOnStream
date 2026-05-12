"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ModuleDataMap, ModuleName } from "@/types/telemetry";

interface TelemetryState<T> {
  data: T | null;
  loading: boolean;
  lastUpdated: Date | null;
}

export function useTelemetry<M extends ModuleName>(
  deviceId: string,
  module: M
): TelemetryState<ModuleDataMap[M]> {
  const [state, setState] = useState<TelemetryState<ModuleDataMap[M]>>({
    data: null,
    loading: true,
    lastUpdated: null,
  });

  useEffect(() => {
    const supabase = createClient();

    async function fetchLatest() {
      const { data } = await supabase
        .from("device_telemetry")
        .select("data, received_at")
        .eq("device_id", deviceId)
        .eq("module", module)
        .order("device_ts", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setState({
          data: data.data as unknown as ModuleDataMap[M],
          loading: false,
          lastUpdated: new Date(data.received_at),
        });
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }

    fetchLatest();

    // Realtime: filter by device_id only; module check happens in callback
    // because Supabase Realtime postgres_changes doesn't support compound filters
    const channel = supabase
      .channel(`telemetry:${deviceId}:${module}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "device_telemetry",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          const row = payload.new as {
            module: string;
            data: Record<string, unknown>;
            received_at: string;
          };
          if (row.module === module) {
            setState({
              data: row.data as unknown as ModuleDataMap[M],
              loading: false,
              lastUpdated: new Date(row.received_at),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId, module]);

  return state;
}
