"use client";

import { useCallback, useEffect, useRef, useState, useId } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Lifecycle of an operator action, mapped 1:1 to the real pipeline:
 *
 *   sending  → POST in flight to the Route Handler
 *   sent     → audit row created, command published over MQTT
 *   ack      → the gateway validated it and INSERTED it into the equipment's
 *              command table (the CommandDaemon will pick it up)
 *   completed/error → the equipment's *_action table reached a terminal
 *              status and the result travelled back (command_audit, Realtime)
 *   cancelled → the operator asked to stop it and the equipment complied
 *   rejected → the gateway's validator refused it (whitelist/sentinel/rate)
 *   timeout  → no terminal status within the action's expected window; the
 *              UI stops blocking but keeps listening for a late result
 */
export type ActionStage =
  | "sending"
  | "sent"
  | "ack"
  | "completed"
  | "error"
  | "cancelled"
  | "rejected"
  | "timeout";

export const TERMINAL_STAGES: ActionStage[] = [
  "completed",
  "error",
  "cancelled",
  "rejected",
];

/**
 * Marker the gateway puts in error_message when a task ended because it was
 * cancelled. The cloud audit vocabulary has no 'cancelled' status, so this is
 * how a cancellation is told apart from a real failure.
 */
const CANCELLED_MARKER = "Task cancelled";

export interface InflightAction {
  commandId: string | null;
  module: string;
  command: string;
  /** Human label, e.g. "Brazo → Recal". */
  label: string;
  stage: ActionStage;
  error: string | null;
  startedAt: number;
  /** Visual timeout for this action (ms). */
  timeoutMs: number;
  /** A cancel order was sent for this action and we're awaiting its effect. */
  cancelRequested: boolean;
}

interface AuditRowPatch {
  id: string;
  status: string;
  error_message: string | null;
}

/** command_audit status → stage (audit rows use the same vocabulary). */
function stageFromStatus(status: string, errorMessage: string | null): ActionStage | null {
  switch (status) {
    case "ack":
    case "executing":
      return "ack";
    case "completed":
      return "completed";
    case "error":
      return errorMessage === CANCELLED_MARKER ? "cancelled" : "error";
    case "rejected":
      return "rejected";
    case "expired":
      return "error";
    default:
      return null; // sent/delivered — no forward progress to report
  }
}

/**
 * Fires operator actions and tracks their live progress, one slot per module
 * (a module is "busy" while its action hasn't reached a terminal state — the
 * UI uses this to lock the module's other actions and prevent double-fires).
 *
 * Progress arrives via Realtime UPDATEs on command_audit (publication 00016)
 * with a 3s poll as fallback while any action is unresolved.
 */
export function useActionRunner(deviceId: string) {
  const channelId = useId();
  const [actions, setActions] = useState<Record<string, InflightAction>>({});
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const applyPatch = useCallback((patch: AuditRowPatch) => {
    const current = actionsRef.current;
    const moduleKey = Object.keys(current).find(
      (m) => current[m]?.commandId === patch.id
    );
    if (!moduleKey) return;
    const stage = stageFromStatus(patch.status, patch.error_message);
    if (!stage) return;

    setActions((prev) => {
      const entry = prev[moduleKey];
      if (!entry || entry.commandId !== patch.id) return prev;
      // Never move backwards (a late 'ack' must not undo 'completed').
      if (TERMINAL_STAGES.includes(entry.stage)) return prev;
      return {
        ...prev,
        [moduleKey]: {
          ...entry,
          stage,
          // A cancellation isn't a failure — don't surface the raw marker.
          error: stage === "cancelled" ? null : patch.error_message ?? entry.error,
        },
      };
    });
  }, []);

  // Realtime: watch every command_audit UPDATE for this device and route the
  // ones matching an in-flight action.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`action-runner:${deviceId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "command_audit",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          const row = payload.new as Partial<AuditRowPatch>;
          if (row?.id && typeof row.status === "string") {
            applyPatch({
              id: row.id,
              status: row.status,
              error_message: row.error_message ?? null,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId, channelId, applyPatch]);

  // Poll fallback + visual timeout, active only while something is unresolved.
  useEffect(() => {
    const unresolved = Object.values(actions).filter(
      (a) => a.commandId && !TERMINAL_STAGES.includes(a.stage) && a.stage !== "timeout"
    );
    const timedOutCandidates = Object.values(actions).filter(
      (a) => !TERMINAL_STAGES.includes(a.stage) && a.stage !== "timeout"
    );
    if (unresolved.length === 0 && timedOutCandidates.length === 0) return;

    const supabase = createClient();
    const tick = async () => {
      // Visual timeout: unblock the UI when the window is exceeded.
      setActions((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [m, a] of Object.entries(prev)) {
          if (
            !TERMINAL_STAGES.includes(a.stage) &&
            a.stage !== "timeout" &&
            Date.now() - a.startedAt > a.timeoutMs
          ) {
            next[m] = { ...a, stage: "timeout" };
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      for (const a of unresolved) {
        if (!a.commandId) continue;
        const { data } = await supabase
          .from("command_audit")
          .select("id, status, error_message")
          .eq("id", a.commandId)
          .maybeSingle();
        if (data) applyPatch(data as AuditRowPatch);
      }
    };

    const interval = setInterval(tick, 3_000);
    return () => clearInterval(interval);
  }, [actions, applyPatch]);

  // Completed actions clear themselves after a short victory lap; failures
  // stay visible until dismissed.
  useEffect(() => {
    const done = Object.entries(actions).filter(
      ([, a]) => a.stage === "completed"
    );
    if (done.length === 0) return;
    const timer = setTimeout(() => {
      setActions((prev) => {
        const next = { ...prev };
        for (const [m, a] of Object.entries(prev)) {
          if (a.stage === "completed") delete next[m];
        }
        return next;
      });
    }, 6_000);
    return () => clearTimeout(timer);
  }, [actions]);

  const run = useCallback(
    async (
      module: string,
      command: string,
      args: Record<string, string>,
      label: string,
      timeoutMs: number
    ): Promise<{ ok: boolean; error?: string }> => {
      // Hard guard against double-fires: one action per module at a time.
      const existing = actionsRef.current[module];
      if (
        existing &&
        !TERMINAL_STAGES.includes(existing.stage) &&
        existing.stage !== "timeout"
      ) {
        return { ok: false, error: "El módulo ya tiene una acción en curso" };
      }

      setActions((prev) => ({
        ...prev,
        [module]: {
          commandId: null,
          module,
          command,
          label,
          stage: "sending",
          error: null,
          startedAt: Date.now(),
          timeoutMs,
          cancelRequested: false,
        },
      }));

      try {
        const res = await fetch(`/api/devices/${deviceId}/commands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module, command, args }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.command_id) {
          const msg = body.error ?? `Error ${res.status} al enviar el comando`;
          setActions((prev) => ({
            ...prev,
            [module]: {
              ...prev[module],
              stage: "error",
              error: msg,
            },
          }));
          return { ok: false, error: msg };
        }
        setActions((prev) => ({
          ...prev,
          [module]: {
            ...prev[module],
            commandId: body.command_id as string,
            stage: "sent",
          },
        }));
        return { ok: true };
      } catch {
        const msg = "No se pudo contactar al servidor";
        setActions((prev) => ({
          ...prev,
          [module]: { ...prev[module], stage: "error", error: msg },
        }));
        return { ok: false, error: msg };
      }
    },
    [deviceId]
  );

  /**
   * Asks the equipment to stop the action in flight on this module.
   *
   * The cancel order deliberately does NOT take the module's action slot: it
   * has no *_action row of its own (the CommandDaemon intercepts it), so it
   * would never get a result. Its effect arrives as the target task's own
   * result, carrying the cancellation marker.
   */
  const requestCancel = useCallback(
    async (module: string): Promise<{ ok: boolean; error?: string }> => {
      const current = actionsRef.current[module];
      if (!current || TERMINAL_STAGES.includes(current.stage)) {
        return { ok: false, error: "No hay una acción en curso" };
      }

      setActions((prev) =>
        prev[module] ? { ...prev, [module]: { ...prev[module], cancelRequested: true } } : prev
      );

      try {
        const res = await fetch(`/api/devices/${deviceId}/commands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            module,
            command: "cancel",
            args: { arg1: current.command },
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = body.error ?? `Error ${res.status} al cancelar`;
          setActions((prev) =>
            prev[module]
              ? { ...prev, [module]: { ...prev[module], cancelRequested: false } }
              : prev
          );
          return { ok: false, error: msg };
        }
        return { ok: true };
      } catch {
        setActions((prev) =>
          prev[module]
            ? { ...prev, [module]: { ...prev[module], cancelRequested: false } }
            : prev
        );
        return { ok: false, error: "No se pudo contactar al servidor" };
      }
    },
    [deviceId]
  );

  const dismiss = useCallback((module: string) => {
    setActions((prev) => {
      const next = { ...prev };
      delete next[module];
      return next;
    });
  }, []);

  /** True while the module must stay locked (action neither terminal nor timed out). */
  const isModuleBusy = useCallback((module: string) => {
    const a = actionsRef.current[module];
    return !!a && !TERMINAL_STAGES.includes(a.stage) && a.stage !== "timeout";
  }, []);

  return { actions, run, requestCancel, dismiss, isModuleBusy };
}
