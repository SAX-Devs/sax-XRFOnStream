"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { createClient } from "@/lib/supabase/client";

export type CommandStatus =
  | "sent"
  | "delivered"
  | "ack"
  | "executing"
  | "completed"
  | "error"
  | "rejected"
  | "expired";

export interface CommandRow {
  id: string;
  module: string;
  command: string;
  status: CommandStatus;
  issued_by_email: string;
  error_message: string | null;
  sent_at: string;
}

const SELECT =
  "id, module, command, status, issued_by_email, error_message, sent_at";

const PENDING: CommandStatus[] = ["sent", "delivered", "ack", "executing"];

export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * Loads a device's command history (command_audit) with live updates and
 * exposes sendCommand(), which POSTs to the command Route Handler. The handler
 * verifies role, signs the command (HMAC), publishes it over MQTT and inserts
 * the audit row; we refetch afterwards so the new row shows even if Realtime
 * isn't enabled for command_audit.
 */
export function useCommands(deviceId: string) {
  const channelId = useId();
  const [commands, setCommands] = useState<CommandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchCommands = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("command_audit")
      .select(SELECT)
      .eq("device_id", deviceId)
      .order("sent_at", { ascending: false })
      .limit(50);
    if (data) setCommands(data as CommandRow[]);
  }, [deviceId]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    (async () => {
      await fetchCommands();
      if (active) setLoading(false);
    })();

    const channel = supabase
      .channel(`commands:${deviceId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "command_audit",
          filter: `device_id=eq.${deviceId}`,
        },
        () => {
          fetchCommands();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [deviceId, channelId, fetchCommands]);

  const sendCommand = useCallback(
    async (
      module: string,
      command: string,
      args?: Record<string, unknown>
    ): Promise<SendResult> => {
      setSending(true);
      try {
        const res = await fetch(`/api/devices/${deviceId}/commands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module, command, args }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            ok: false,
            error: body.error ?? `Error ${res.status} al enviar el comando`,
          };
        }
        await fetchCommands();
        return { ok: true };
      } catch {
        return { ok: false, error: "No se pudo contactar al servidor" };
      } finally {
        setSending(false);
      }
    },
    [deviceId, fetchCommands]
  );

  const pendingCount = commands.filter((c) =>
    PENDING.includes(c.status)
  ).length;

  return { commands, loading, sending, sendCommand, pendingCount };
}
