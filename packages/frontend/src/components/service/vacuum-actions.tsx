"use client";

import { useState } from "react";
import { ActionRow, SubmitButton, type FirePayload, type RiskTier } from "./action-row";
import type { VacuumData } from "@/types/telemetry";
import type { InflightAction } from "@/hooks/use-action-runner";
import { TERMINAL_STAGES } from "@/hooks/use-action-runner";

/**
 * Vacuum service actions — the module's service subset (SAX-defined):
 * individual valve and pump control, below the operator-level condition
 * setter (set_atmospheric_condition) and emergency_purge.
 *
 *   open_valve / close_valve(valve_name: str) — the three real valves
 *       (INLET_VALVE, OUTLET_VALVE, PURGE_VALVE, from Vacuum.py).
 *   pump_switch(pump_1: bool, pump_2: bool) — the two vacuum pumps, set
 *       together in a single call.
 *
 * These bypass the coordinated set_atmospheric_condition, so a technician can
 * leave an inconsistent valve/pump combination — hence the caution tier and
 * the live per-element state shown right on each control.
 */

const TIMEOUTS: Record<string, number> = {
  open_valve: 15_000,
  close_valve: 15_000,
  pump_switch: 20_000,
};

const VALVES: { value: string; label: string; field: keyof VacuumData }[] = [
  { value: "INLET_VALVE", label: "Entrada", field: "inlet_valve" },
  { value: "OUTLET_VALVE", label: "Salida", field: "outlet_valve" },
  { value: "PURGE_VALVE", label: "Purga", field: "purge_valve" },
];

interface VacuumActionsProps {
  data: VacuumData | null;
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

export function VacuumServiceActions({
  data,
  action,
  disabled,
  onRun,
  onDismiss,
}: VacuumActionsProps) {
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
      <Group title="Válvulas">
        <ActionRow
          {...rowProps("open_valve", "Abrir válvula", "caution")}
          description="Abre una válvula individual, fuera del modo coordinado"
          requirement="Manipular válvulas sueltas puede dejar una combinación incoherente; para operación normal usa la condición atmosférica"
        >
          {({ request, blocked }) => (
            <ValvePicker
              data={data}
              wantOpen
              blocked={blocked}
              onPick={(valve, label) =>
                request({ args: { arg1: valve }, label: `Abrir válvula: ${label}` })
              }
            />
          )}
        </ActionRow>

        <ActionRow
          {...rowProps("close_valve", "Cerrar válvula", "caution")}
          description="Cierra una válvula individual, fuera del modo coordinado"
          requirement="Manipular válvulas sueltas puede dejar una combinación incoherente; para operación normal usa la condición atmosférica"
        >
          {({ request, blocked }) => (
            <ValvePicker
              data={data}
              wantOpen={false}
              blocked={blocked}
              onPick={(valve, label) =>
                request({ args: { arg1: valve }, label: `Cerrar válvula: ${label}` })
              }
            />
          )}
        </ActionRow>
      </Group>

      <Group title="Bombas de vacío">
        <ActionRow
          {...rowProps("pump_switch", "Bombas de vacío", "caution")}
          description="Enciende o apaga cada una de las dos bombas de vacío"
          requirement="Se envían las dos en una sola orden; ajusta el estado deseado de cada bomba y aplica"
        >
          {({ request, blocked }) => (
            <PumpForm data={data} blocked={blocked} onSubmit={request} />
          )}
        </ActionRow>
      </Group>
    </div>
  );
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

/** Pick a valve to open/close; the one already in the target state is marked. */
function ValvePicker({
  data,
  wantOpen,
  blocked,
  onPick,
}: {
  data: VacuumData | null;
  wantOpen: boolean;
  blocked: boolean;
  onPick: (valve: string, label: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {VALVES.map((v) => {
        const isOpen = !!data?.[v.field];
        const alreadyThere = wantOpen ? isOpen : !isOpen;
        return (
          <button
            key={v.value}
            disabled={blocked || alreadyThere}
            onClick={() => onPick(v.value, v.label)}
            className={`rounded-lg border px-2 py-2 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
              alreadyThere
                ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                : "border-white/10 bg-white/[0.04] hover:border-cyan-400/50 hover:bg-cyan-500/10"
            }`}
          >
            <span className="block text-[11.5px] font-semibold text-slate-200">
              {v.label}
            </span>
            <span
              className={`mt-0.5 block text-[9px] font-medium ${
                isOpen ? "text-cyan-300" : "text-slate-500"
              }`}
            >
              {isOpen ? "abierta" : "cerrada"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Both pumps, toggled to the desired state and sent together. */
function PumpForm({
  data,
  blocked,
  onSubmit,
}: {
  data: VacuumData | null;
  blocked: boolean;
  onSubmit: (p: FirePayload) => void;
}) {
  const [p1, setP1] = useState<boolean | null>(null);
  const [p2, setP2] = useState<boolean | null>(null);

  // Default the toggles to the live state the first time we have data.
  const cur1 = data?.vacuum_pump_1 ?? false;
  const cur2 = data?.vacuum_pump_2 ?? false;
  const want1 = p1 ?? cur1;
  const want2 = p2 ?? cur2;
  const changed = want1 !== cur1 || want2 !== cur2;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <PumpToggle label="Bomba 1" live={cur1} want={want1} onChange={setP1} disabled={blocked} />
        <PumpToggle label="Bomba 2" live={cur2} want={want2} onChange={setP2} disabled={blocked} />
      </div>
      <div className="flex justify-end">
        <SubmitButton
          label="Aplicar bombas"
          disabled={blocked || !changed}
          onClick={() =>
            onSubmit({
              args: { arg1: want1 ? "true" : "false", arg2: want2 ? "true" : "false" },
              label: `Bombas → 1:${want1 ? "ON" : "OFF"} · 2:${want2 ? "ON" : "OFF"}`,
            })
          }
        />
      </div>
    </div>
  );
}

function PumpToggle({
  label,
  live,
  want,
  onChange,
  disabled,
}: {
  label: string;
  live: boolean;
  want: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] p-2">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold text-slate-300">{label}</span>
        <span className={`text-[9px] ${live ? "text-cyan-300" : "text-slate-500"}`}>
          actual: {live ? "ON" : "OFF"}
        </span>
      </div>
      <div className="flex gap-1 rounded-md border border-white/10 bg-black/30 p-0.5">
        {[
          { on: true, label: "ON" },
          { on: false, label: "OFF" },
        ].map((o) => (
          <button
            key={o.label}
            disabled={disabled}
            onClick={() => onChange(o.on)}
            className={`flex-1 rounded px-2 py-1 text-[10.5px] font-semibold transition-colors disabled:opacity-40 ${
              want === o.on
                ? o.on
                  ? "bg-cyan-500/25 text-cyan-100"
                  : "bg-slate-500/25 text-slate-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
