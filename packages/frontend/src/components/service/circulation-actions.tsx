"use client";

import { useState } from "react";
import { ActionRow, SubmitButton, type FirePayload, type RiskTier } from "./action-row";
import type { CirculationData } from "@/types/telemetry";
import type { InflightAction } from "@/hooks/use-action-runner";
import { TERMINAL_STAGES } from "@/hooks/use-action-runner";

/**
 * Circulation service actions — the module's service subset (SAX-defined):
 * direct pump/valve/led/power control, below the operator-level
 * set_operation_mode, tank_percentage_fill and empty_tank.
 *
 * Verified against Circulation.py:
 *   set_pump_state(rotation_direction: str) — FORWARD | REVERSE | STOP.
 *   set_valve_state(valve_name: str, state: bool) — the six real valves.
 *   led_status(status: bool) — the pickup LED.
 *   emergency_stop() — {None}; sets the pump to REVERSE (not STOP) and closes
 *       every valve.
 *   power(OnOff: bool) — the module's 24V supply.
 *
 * The valve/pump setters bypass the coordinated operation mode, so they're
 * caution-tier and show live per-element state; power and emergency_stop are
 * critical (hold-to-confirm).
 */

const TIMEOUTS: Record<string, number> = {
  set_pump_state: 20_000,
  set_valve_state: 15_000,
  led_status: 15_000,
  emergency_stop: 20_000,
  power: 20_000,
};

const PUMP_STATES: { value: string; label: string; hint: string }[] = [
  { value: "FORWARD", label: "Adelante", hint: "rotación directa" },
  { value: "REVERSE", label: "Reversa", hint: "rotación inversa" },
  { value: "STOP", label: "Detener", hint: "bomba parada" },
];

const VALVES: { value: string; label: string; field: keyof CirculationData }[] = [
  { value: "BRINE_IN_VALVE", label: "Entrada salmuera", field: "brine_in_valve" },
  { value: "WATER_IN_VALVE", label: "Entrada agua", field: "water_in_valve" },
  { value: "OUT_VALVE", label: "Salida", field: "out_valve" },
  { value: "RECIRCULATION_IN_VALVE", label: "Entrada recirc.", field: "recirculation_in_valve" },
  { value: "RECIRCULATION_OUT_VALVE", label: "Salida recirc.", field: "recirculation_out_valve" },
  { value: "BYPASS_VALVE", label: "Bypass", field: "bypass_valve" },
];

interface CirculationActionsProps {
  data: CirculationData | null;
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

export function CirculationServiceActions({
  data,
  action,
  disabled,
  onRun,
  onDismiss,
}: CirculationActionsProps) {
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
      <Group title="Bomba y válvulas">
        <ActionRow
          {...rowProps("set_pump_state", "Estado de la bomba", "caution")}
          description="Fija la dirección de la bomba, fuera del modo coordinado"
          requirement="Manipular la bomba suelta puede dejar una combinación incoherente; para operación normal usa el modo de operación"
        >
          {({ request, blocked }) => {
            const cur = data?.pump_state ?? null;
            return (
              <div className="grid grid-cols-3 gap-2">
                {PUMP_STATES.map((s) => {
                  const current = cur === s.value;
                  return (
                    <button
                      key={s.value}
                      disabled={blocked || current}
                      onClick={() =>
                        request({ args: { arg1: s.value }, label: `Bomba → ${s.label}` })
                      }
                      className={`rounded-lg border px-2 py-2 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                        current
                          ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                          : "border-white/10 bg-white/[0.04] hover:border-cyan-400/50 hover:bg-cyan-500/10"
                      }`}
                    >
                      <span className="block text-[11.5px] font-semibold text-slate-200">
                        {s.label}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-slate-500">
                        {current ? "estado actual" : s.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          }}
        </ActionRow>

        <ActionRow
          {...rowProps("set_valve_state", "Estado de válvula", "caution")}
          description="Abre o cierra una de las seis válvulas individualmente"
          requirement="Cada orden fija UNA válvula; manipularlas sueltas puede dejar una combinación incoherente"
        >
          {({ request, blocked }) => (
            <ValveGrid data={data} blocked={blocked} onPick={request} />
          )}
        </ActionRow>
      </Group>

      <Group title="Indicadores">
        <ActionRow
          {...rowProps("led_status", "LED del pickup", "normal")}
          description="Enciende o apaga el LED del pickup"
        >
          {({ request, blocked }) => (
            <div className="grid grid-cols-2 gap-2">
              <SubmitButton
                label="Encender LED"
                disabled={blocked}
                onClick={() => request({ args: { arg1: "true" }, label: "LED encendido" })}
              />
              <SubmitButton
                label="Apagar LED"
                disabled={blocked}
                onClick={() => request({ args: { arg1: "false" }, label: "LED apagado" })}
              />
            </div>
          )}
        </ActionRow>
      </Group>

      <Group title="Alimentación y seguridad">
        <ActionRow
          {...rowProps("emergency_stop", "Parada de emergencia", "critical")}
          description="Detiene la circulación de golpe: bomba en reversa y todas las válvulas cerradas"
          requirement="No es una parada suave: pone la bomba en REVERSA y cierra todas las válvulas de inmediato"
        >
          {({ request, blocked }) => (
            <SubmitButton
              label="Parada de emergencia"
              disabled={blocked}
              onClick={() => request({ args: {}, label: "Parada de emergencia" })}
            />
          )}
        </ActionRow>

        <ActionRow
          {...rowProps("power", "Alimentación del módulo", "critical")}
          description="Relé de alimentación del módulo de circulación"
          requirement="Cortar la alimentación detiene todo el módulo de golpe"
        >
          {({ request, blocked }) => {
            const on = data?.power_status ?? false;
            return (
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={blocked || on}
                  onClick={() => request({ args: { arg1: "true" }, label: "Energizando circulación" })}
                  className={`rounded-lg border px-3 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                    on
                      ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                      : "border-red-500/40 bg-red-500/10 hover:border-red-400/70 hover:bg-red-500/20"
                  }`}
                >
                  <span className="block text-[11.5px] font-semibold text-slate-200">Alimentar</span>
                  <span className="mt-0.5 block text-[9px] text-slate-500">
                    {on ? "estado actual" : "energiza el módulo"}
                  </span>
                </button>
                <button
                  disabled={blocked || !on}
                  onClick={() => request({ args: { arg1: "false" }, label: "Cortando alimentación de circulación" })}
                  className={`rounded-lg border px-3 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                    !on
                      ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                      : "border-red-500/40 bg-red-500/10 hover:border-red-400/70 hover:bg-red-500/20"
                  }`}
                >
                  <span className="block text-[11.5px] font-semibold text-slate-200">Cortar</span>
                  <span className="mt-0.5 block text-[9px] text-slate-500">
                    {!on ? "estado actual" : "des-energiza el módulo"}
                  </span>
                </button>
              </div>
            );
          }}
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

/** Six valves, each toggled open/closed to its target and sent individually. */
function ValveGrid({
  data,
  blocked,
  onPick,
}: {
  data: CirculationData | null;
  blocked: boolean;
  onPick: (p: FirePayload) => void;
}) {
  return (
    <div className="space-y-1.5">
      {VALVES.map((v) => {
        const isOpen = !!data?.[v.field];
        return (
          <div
            key={v.value}
            className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
          >
            <span className="flex-1 text-[11px] text-slate-200">{v.label}</span>
            <span className={`text-[9px] font-medium ${isOpen ? "text-cyan-300" : "text-slate-500"}`}>
              {isOpen ? "abierta" : "cerrada"}
            </span>
            <div className="flex gap-1">
              <MiniBtn
                label="Abrir"
                disabled={blocked || isOpen}
                onClick={() => onPick({ args: { arg1: v.value, arg2: "true" }, label: `Abrir ${v.label}` })}
              />
              <MiniBtn
                label="Cerrar"
                disabled={blocked || !isOpen}
                onClick={() => onPick({ args: { arg1: v.value, arg2: "false" }, label: `Cerrar ${v.label}` })}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-slate-300 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {label}
    </button>
  );
}
