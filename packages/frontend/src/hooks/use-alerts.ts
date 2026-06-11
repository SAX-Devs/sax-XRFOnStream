"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { createClient } from "@/lib/supabase/client";

export type AlertSeverity = "info" | "warning" | "critical" | "emergency";

export interface AlertRecord {
  id: number;
  severity: AlertSeverity;
  source: string;
  title: string;
  detail: unknown;
  ack_by: string | null;
  ack_at: string | null;
  device_ts: string;
}

const SELECT = "id, severity, source, title, detail, ack_by, ack_at, device_ts";

/**
 * Loads a device's alerts with live updates and exposes an acknowledge action.
 * Realtime keeps the list fresh: INSERT prepends new alerts, UPDATE refreshes a
 * row when it gets acknowledged (by this user or another). The acknowledge call
 * writes ack_by/ack_at directly — RLS policy `alerts_update` permits it for the
 * tenant's users.
 */
export function useAlerts(deviceId: string) {
  const channelId = useId();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function fetchAlerts() {
      const { data } = await supabase
        .from("alerts")
        .select(SELECT)
        .eq("device_id", deviceId)
        .order("device_ts", { ascending: false })
        .limit(200);

      if (!active) return;
      if (data) setAlerts(data as AlertRecord[]);
      setLoading(false);
    }

    fetchAlerts();

    const channel = supabase
      .channel(`alerts:${deviceId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) =>
          setAlerts((prev) => [payload.new as AlertRecord, ...prev])
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "alerts",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          const row = payload.new as AlertRecord;
          setAlerts((prev) => prev.map((a) => (a.id === row.id ? row : a)));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [deviceId, channelId]);

  const acknowledge = useCallback(async (id: number) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const ackAt = new Date().toISOString();
    // Optimistic update; the Realtime UPDATE will reconcile with the server row.
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, ack_by: user.id, ack_at: ackAt } : a
      )
    );

    await supabase
      .from("alerts")
      .update({ ack_by: user.id, ack_at: ackAt })
      .eq("id", id);
  }, []);

  return { alerts, loading, acknowledge };
}
