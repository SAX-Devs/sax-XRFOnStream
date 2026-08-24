"use client";

import { ActionRow, SubmitButton, type FirePayload, type RiskTier } from "./action-row";
import type { InterchangerData } from "@/types/telemetry";
import type { InflightAction } from "@/hooks/use-action-runner";
import { TERMINAL_STAGES } from "@/hooks/use-action-runner";

/**
 * Interchanger service actions — the module's service subset (SAX-defined):
 * the RAW piston movers, below the operator-level sensor-verified usage_ and
 * cam_interchange actions.
 *
 * Verified against Interchanger.py:
 *   service_axial(target: bool)  — axial piston UP/DOWN, NO sensor check.
 *   service_rot(target: bool)    — rotational piston UP/DOWN, NO sensor check.
 *   service_change_position(0-3) — the four axial/rot combinations directly.
 *   rele_test()                  — {None}, relay cycle test.
 *
 * The service_* movers skip the sensor verification the operator usage_* have,
 * so they can drive a piston into a position the sensors don't confirm — hence
 * the caution tier and the "sin verificación" wording.
 */

const TIMEOUTS: Record<string, number> = {
  service_axial: 20_000,
  service_rot: 40_000,
  service_change_position: 60_000,
  rele_test: 30_000,
};

// service_change_position mapping (from the equipment docstring):
// 0: axial DOWN / rot DOWN · 1: axial DOWN / rot UP ·
// 2: axial UP  / rot DOWN · 3: axial UP  / rot UP
const POSITIONS: { value: string; label: string; hint: string }[] = [
  { value: "0", label: "0 · ↓↓", hint: "axial ABAJO · rot ABAJO" },
  { value: "1", label: "1 · ↓↑", hint: "axial ABAJO · rot ARRIBA" },
  { value: "2", label: "2 · ↑↓", hint: "axial ARRIBA · rot ABAJO" },
  { value: "3", label: "3 · ↑↑", hint: "axial ARRIBA · rot ARRIBA" },
];

function piston(up?: boolean, down?: boolean): string {
  if (up && !down) return "UP";
  if (down && !up) return "DOWN";
  if (up && down) return "⚠ ambos";
  return "en tránsito";
}

interface InterchangerActionsProps {
  data: InterchangerData | null;
  action: InflightAction | null;
  disabled: boolean;
  onRun: (
    command: string,
    args: Record<string, string>,
    label: string,
    timeoutMs: number
  ) => void;
  onDismiss: () => void;
}

export function InterchangerServiceActions({
  data,
  action,
  disabled,
  onRun,
  onDismiss,
}: InterchangerActionsProps) {
  const axial = piston(data?.axial_up, data?.axial_down);
  const rot = piston(data?.rot_up, data?.rot_down);

  const busy =
    !!action && !TERMINAL_STAGES.includes(action.stage) && action.stage !== "timeout";

  const rowProps = (command: string, title: string, tier: RiskTier) => ({
    title,
    command,
    tier,
    inflight: action?.command === command ? action : null,
    lockedBy: busy && action?.command !== command ? action!.label : null,
    disabled,
    onDismiss,
    onFire: (p: FirePayload) =>
      onRun(command, p.args, p.label, TIMEOUTS[command]),
  });

  return (
    <div className="space-y-4">
      <Group title="Pistones (modo servicio, sin verificación de sensores)">
        <ActionRow
          {...rowProps("service_axial", "Pistón axial", "caution")}
          description={`Mueve el pistón axial sin verificar sensores · actual: ${axial}`}
          requirement="Modo servicio: no verifica los sensores, así que puede dejar el pistón en una posición que los sensores no confirman"
        >
          {({ request, blocked }) => (
            <UpDown
              blocked={blocked}
              current={axial}
              onPick={(up) =>
                request({ args: { arg1: up ? "true" : "false" }, label: `Axial → ${up ? "UP" : "DOWN"}` })
              }
            />
          )}
        </ActionRow>

        <ActionRow
          {...rowProps("service_rot", "Pistón rotacional", "caution")}
          description={`Mueve el pistón rotacional sin verificar sensores · actual: ${rot}`}
          requirement="Modo servicio: no verifica los sensores, así que puede dejar el pistón en una posición que los sensores no confirman"
        >
          {({ request, blocked }) => (
            <UpDown
              blocked={blocked}
              current={rot}
              onPick={(up) =>
                request({ args: { arg1: up ? "true" : "false" }, label: `Rotacional → ${up ? "UP" : "DOWN"}` })
              }
            />
          )}
        </ActionRow>

        <ActionRow
          {...rowProps("service_change_position", "Posición combinada", "caution")}
          description="Fija las dos posiciones axial/rotacional en un solo paso (0–3)"
          requirement="Lleva ambos pistones a una de las cuatro combinaciones; en modo servicio, sin verificación de sensores"
        >
          {({ request, blocked }) => {
            const cur = currentComboValue(data);
            return (
              <div className="grid grid-cols-2 gap-2">
                {POSITIONS.map((p) => {
                  const current = cur === p.value;
                  return (
                    <button
                      key={p.value}
                      disabled={blocked || current}
                      onClick={() =>
                        request({ args: { arg1: p.value }, label: `Posición → ${p.label}` })
                      }
                      className={`rounded-lg border px-3 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                        current
                          ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                          : "border-white/10 bg-white/[0.04] hover:border-cyan-400/50 hover:bg-cyan-500/10"
                      }`}
                    >
                      <span className="block font-mono text-[12px] font-semibold text-slate-200">
                        {p.label}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-slate-500">
                        {current ? "posición actual" : p.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          }}
        </ActionRow>
      </Group>

      <Group title="Diagnóstico">
        <ActionRow
          {...rowProps("rele_test", "Prueba de relés", "normal")}
          description="Ciclo de prueba de los relés del módulo"
        >
          {({ request, blocked }) => (
            <SubmitButton
              label="Ejecutar prueba de relés"
              disabled={blocked}
              onClick={() => request({ args: {}, label: "Prueba de relés" })}
            />
          )}
        </ActionRow>
      </Group>
    </div>
  );
}

/** Which combined position (0-3) the live sensors currently indicate, if clear. */
function currentComboValue(data: InterchangerData | null): string | null {
  if (!data) return null;
  const axUp = data.axial_up && !data.axial_down;
  const axDown = data.axial_down && !data.axial_up;
  const rotUp = data.rot_up && !data.rot_down;
  const rotDown = data.rot_down && !data.rot_up;
  if (axDown && rotDown) return "0";
  if (axDown && rotUp) return "1";
  if (axUp && rotDown) return "2";
  if (axUp && rotUp) return "3";
  return null; // in transit or sensors unclear
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function UpDown({
  current,
  blocked,
  onPick,
}: {
  current: string;
  blocked: boolean;
  onPick: (up: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { up: true, label: "Subir (UP)", at: current === "UP" },
        { up: false, label: "Bajar (DOWN)", at: current === "DOWN" },
      ].map((o) => (
        <button
          key={o.label}
          disabled={blocked || o.at}
          onClick={() => onPick(o.up)}
          className={`rounded-lg border px-3 py-2 text-center text-[11.5px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            o.at
              ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300/90"
              : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-400/50 hover:bg-cyan-500/10"
          }`}
        >
          {o.label}
          {o.at && <span className="mt-0.5 block text-[9px] text-slate-500">actual</span>}
        </button>
      ))}
    </div>
  );
}
