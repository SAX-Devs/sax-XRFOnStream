"use client";

import { useEffect, useState } from "react";
import { ProcessDiagram } from "@/components/scada/process-diagram";
import { InterchangerOptions } from "./interchanger-options";
import { CommandHistory } from "./command-history";
import { useScadaTelemetry } from "@/hooks/use-scada-telemetry";
import { useTelemetry } from "@/hooks/use-telemetry";
import { useActionRunner } from "@/hooks/use-action-runner";

/**
 * Operator screen — the live SCADA diagram plus the "Opciones" panel.
 *
 * Interaction model (per SAX's design):
 *  - The diagram shows the equipment exactly like the Status screen, but
 *    action-capable modules render a clickable hotspot; clicking one focuses
 *    its action cards in the right-hand panel.
 *  - Each card shows the element's CURRENT state (live telemetry), its
 *    selectable options, and — once fired — a stepper tracking the order
 *    through the real pipeline (sent → received → executing → done), so the
 *    operator never double-fires or stacks conflicting orders.
 *  - While an action is in flight its whole module stays locked.
 *
 * Rollout is module by module; today: INTERCHANGER (cam_interchange,
 * usage_axial, usage_rot).
 */
export function OperatorScreen({
  deviceId,
  provisioned,
}: {
  deviceId: string;
  provisioned: boolean;
}) {
  const { diagram, meta } = useScadaTelemetry(deviceId);
  const interchanger = useTelemetry(deviceId, "interchanger");
  const { actions, run, dismiss } = useActionRunner(deviceId);

  // Bumped when the diagram's interchanger hotspot is clicked → the module's
  // cards scroll into view and flash.
  const [focusSignal, setFocusSignal] = useState(0);

  // Re-render every 15s so the freshness banner ages truthfully even when no
  // new telemetry arrives (same pattern as the Status screen).
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  // Data freshness: with a stale link, orders may never reach the equipment.
  const ageMs = meta.lastUpdated ? Date.now() - meta.lastUpdated.getTime() : null;
  const dataStale = !meta.loading && (ageMs === null || ageMs > 300_000);

  return (
    <div className="space-y-3">
      {!provisioned && (
        <Banner tone="warn">
          <span className="font-semibold">Equipo no provisionado.</span> Las
          órdenes están deshabilitadas hasta completar la provisión del equipo.
        </Banner>
      )}
      {dataStale && (
        <Banner tone="error">
          <span className="font-semibold">Sin datos recientes del equipo.</span>{" "}
          La conexión parece caída — las órdenes podrían no ejecutarse ni
          reportar su progreso.
        </Banner>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-3">
        {/* Center — live process diagram with actionable hotspots */}
        <ProcessDiagram
          state={diagram}
          actionableModules={["interchanger"]}
          onModuleClick={() => setFocusSignal((n) => n + 1)}
        />

        {/* Right — Opciones panel */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                  Opciones
                </h2>
              </div>
              <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-300 ring-1 ring-cyan-500/25">
                Interchanger
              </span>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
              Acciones disponibles del módulo con su estado actual. También
              puedes hacer clic en el elemento marcado del diagrama.
            </p>
          </div>

          <InterchangerOptions
            data={interchanger.data}
            action={actions["interchanger"] ?? null}
            disabled={!provisioned}
            onRun={(command, args, label, timeoutMs) =>
              run("interchanger", command, args, label, timeoutMs)
            }
            onDismiss={() => dismiss("interchanger")}
            focusSignal={focusSignal}
          />
        </div>
      </div>

      {/* Audit trail — every order, live */}
      <CommandHistory deviceId={deviceId} />
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "warn" | "error";
  children: React.ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : "border-red-500/30 bg-red-500/10 text-red-200";
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm backdrop-blur-md ${cls}`}
    >
      <span>{children}</span>
    </div>
  );
}
