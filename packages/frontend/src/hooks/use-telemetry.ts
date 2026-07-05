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
    let active = true;

    async function fetchLatest() {
      const { data } = await supabase
        .from("device_telemetry")
        .select("data, received_at")
        .eq("device_id", deviceId)
        .eq("module", module)
        .order("device_ts", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
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

    // SCADA-style polling: device_telemetry is deliberately NOT in the Realtime
    // publication (its ~2s insert rate would burn through message quotas), so
    // live values come from a bounded 3s poll — one tiny latest-row query per
    // module, matching the gateway's own 2s publish cadence.
    const poll = setInterval(fetchLatest, 3_000);

    return () => {
      active = false;
      clearInterval(poll);
    };
  }, [deviceId, module]);

  return state;
}
