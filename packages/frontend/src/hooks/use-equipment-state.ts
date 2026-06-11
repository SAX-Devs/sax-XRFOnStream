"use client";

import { useState, useEffect, useId } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EquipmentStateEnum } from "@/types/database";

interface EquipmentState {
  state: EquipmentStateEnum | null;
  detail: Record<string, unknown> | null;
  loading: boolean;
  lastUpdated: Date | null;
}

export function useEquipmentState(deviceId: string): EquipmentState {
  const channelId = useId();
  const [equipState, setEquipState] = useState<EquipmentState>({
    state: null,
    detail: null,
    loading: true,
    lastUpdated: null,
  });

  useEffect(() => {
    const supabase = createClient();

    async function fetchState() {
      const { data } = await supabase
        .from("device_equipment_state")
        .select("state, detail, received_at")
        .eq("device_id", deviceId)
        .maybeSingle();

      if (data) {
        setEquipState({
          state: data.state,
          detail: data.detail,
          loading: false,
          lastUpdated: new Date(data.received_at),
        });
      } else {
        setEquipState((prev) => ({ ...prev, loading: false }));
      }
    }

    fetchState();

    const channel = supabase
      .channel(`equipment_state:${deviceId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_equipment_state",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          const row = payload.new as {
            state: EquipmentStateEnum;
            detail: Record<string, unknown> | null;
            received_at: string;
          };
          setEquipState({
            state: row.state,
            detail: row.detail,
            loading: false,
            lastUpdated: new Date(row.received_at),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId, channelId]);

  return equipState;
}
