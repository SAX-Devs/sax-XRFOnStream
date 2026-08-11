"use client";

import { useEffect, useState } from "react";
import {
  ProcessDiagram,
  type ActionableModule,
} from "@/components/scada/process-diagram";
import { ModuleSection, summaryOf } from "./module-section";
import { InterchangerOptions } from "./interchanger-options";
import { CirculationOptions } from "./circulation-options";
import { VacuumOptions } from "./vacuum-options";
import { GeneratorOptions } from "./generator-options";
import { CommandHistory } from "./command-history";
import { useScadaTelemetry } from "@/hooks/use-scada-telemetry";
import { useTelemetry } from "@/hooks/use-telemetry";
import { useActionRunner } from "@/hooks/use-action-runner";

/**
 * Operator screen — the live SCADA diagram plus the "Opciones" panel.
 *
 * Interaction model (per SAX's design):
 *  - The diagram shows the equipment exactly like the Status screen, but
 *    action-capable modules render a clickable hotspot; clicking one opens
 *    that module's section in the right-hand panel.
 *  - The panel is an accordion, one module open at a time, so it scales as
 *    modules are added. Each card shows the element's CURRENT state (live
 *    telemetry), its selectable options, and — once fired — a stepper
 *    tracking the order through the real pipeline (sent → received →
 *    executing → done), so the operator never double-fires or stacks
 *    conflicting orders.
 *  - While an action is in flight its whole module stays locked, and a
 *    collapsed section still shows the in-flight badge in its header.
 *
 * Modules live today: INTERCHANGER, CIRCULATION.
 */

const MODULES: { key: ActionableModule; title: string }[] = [
  { key: "interchanger", title: "Interchanger" },
  { key: "circulation", title: "Circulación" },
  { key: "vacuum", title: "Vacío" },
  { key: "generator", title: "Generador" },
];

export function OperatorScreen({
  deviceId,
  provisioned,
}: {
  deviceId: string;
  provisioned: boolean;
}) {
  const { diagram, meta } = useScadaTelemetry(deviceId);
  const interchanger = useTelemetry(deviceId, "interchanger");
  const circulation = useTelemetry(deviceId, "circulation");
  const vacuum = useTelemetry(deviceId, "vacuum");
  const generator = useTelemetry(deviceId, "generator");
  const { actions, run, requestCancel, dismiss } = useActionRunner(deviceId);

  // Every module starts collapsed: opening the screen shows the equipment and
  // a compact index of what can be acted on, never a module chosen for the
  // operator. Expanding one is a deliberate act — from here or from the
  // diagram's hotspots.
  const [openModule, setOpenModule] = useState<ActionableModule | null>(null);
  // Bumped when a diagram hotspot is clicked → the module's cards flash.
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

  function focusModule(module: ActionableModule) {
    setOpenModule(module);
    setFocusSignal((n) => n + 1);
  }

  // The Opciones panel scrolls INSIDE itself, so its height must stop at the
  // viewport bottom. Offset = 56px top nav + 24px main padding + 24px bottom
  // breathing room, plus any banner currently pushing the row down (each is
  // ~46px tall + the 12px grid gap).
  const bannerCount = (provisioned ? 0 : 1) + (dataStale ? 1 : 0);
  const panelMaxHeight = `calc(100vh - ${104 + bannerCount * 58}px)`;

  const i = interchanger.data;
  const c = circulation.data;
  const v = vacuum.data;
  const g = generator.data;

  const summaries: Record<ActionableModule, string> = {
    interchanger: summaryOf(
      i?.current_position,
      i ? `axial ${i.axial_up ? "UP" : i.axial_down ? "DOWN" : "?"}` : null,
      i ? `rot ${i.rot_up ? "UP" : i.rot_down ? "DOWN" : "?"}` : null
    ),
    circulation: summaryOf(
      c?.operation_state,
      c ? `tanque ${Number(c.tank_percentage_level ?? 0)} %` : null,
      c?.pump_state ? `bomba ${c.pump_state}` : null
    ),
    vacuum: summaryOf(
      v?.atmospheric_status,
      v ? `${Number(v.vacuum_sensor ?? 0).toFixed(1)} kPa` : null,
      v ? `bombas ${v.vacuum_pump_1 || v.vacuum_pump_2 ? "ON" : "OFF"}` : null
    ),
    generator: summaryOf(
      g ? (g.hv_on ? "HV ON" : "HV OFF") : null,
      g ? `${Number(g.tube_high_voltage_kv ?? 0).toFixed(0)} kV` : null,
      g ? `${Number(g.beam_current_ua ?? 0).toFixed(0)} µA` : null
    ),
  };

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

      <div className="grid grid-cols-[minmax(0,1fr)_440px] items-start gap-3">
        {/* Center — live process diagram with actionable hotspots */}
        <ProcessDiagram
          state={diagram}
          actionableModules={MODULES.map((m) => m.key)}
          onModuleClick={focusModule}
        />

        {/* Right — Opciones panel (accordion, one module open at a time).
            The panel is its OWN scroll container, capped at the viewport
            bottom: the wheel over the cards moves only the cards, so the
            diagram never leaves the screen while an action runs (that's where
            the order's real effect shows up). `overscroll-contain` stops the
            scroll from chaining to the page once the panel hits its end. */}
        <div
          style={{ maxHeight: panelMaxHeight }}
          className="space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(148,163,184,0.3)_transparent] [scrollbar-width:thin]"
        >
          <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                Opciones
              </h2>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
              Acciones disponibles por módulo con su estado actual. También
              puedes hacer clic en los elementos marcados del diagrama.
            </p>
          </div>

          {MODULES.map((m) => (
            <ModuleSection
              key={m.key}
              title={m.title}
              summary={summaries[m.key]}
              open={openModule === m.key}
              onToggle={() =>
                setOpenModule((prev) => (prev === m.key ? null : m.key))
              }
              action={actions[m.key] ?? null}
            >
              {m.key === "interchanger" && (
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
              )}
              {m.key === "circulation" && (
                <CirculationOptions
                  data={circulation.data}
                  action={actions["circulation"] ?? null}
                  disabled={!provisioned}
                  onRun={(command, args, label, timeoutMs) =>
                    run("circulation", command, args, label, timeoutMs)
                  }
                  onCancel={() => requestCancel("circulation")}
                  onDismiss={() => dismiss("circulation")}
                  focusSignal={focusSignal}
                />
              )}
              {m.key === "vacuum" && (
                <VacuumOptions
                  data={vacuum.data}
                  action={actions["vacuum"] ?? null}
                  disabled={!provisioned}
                  onRun={(command, args, label, timeoutMs) =>
                    run("vacuum", command, args, label, timeoutMs)
                  }
                  onDismiss={() => dismiss("vacuum")}
                  focusSignal={focusSignal}
                />
              )}
              {m.key === "generator" && (
                <GeneratorOptions
                  data={generator.data}
                  interlocks={interchanger.data}
                  action={actions["generator"] ?? null}
                  disabled={!provisioned}
                  onRun={(command, args, label, timeoutMs) =>
                    run("generator", command, args, label, timeoutMs)
                  }
                  onDismiss={() => dismiss("generator")}
                  focusSignal={focusSignal}
                />
              )}
            </ModuleSection>
          ))}
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
