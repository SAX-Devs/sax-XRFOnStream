"use client";

import { useEffect, useState } from "react";
import { ActionCard, type ActionOption, type StateTone } from "./action-card";
import type { CirculationData } from "@/types/telemetry";
import type { InflightAction } from "@/hooks/use-action-runner";
import { TERMINAL_STAGES } from "@/hooks/use-action-runner";

/**
 * "Opciones" cards for the CIRCULATION module — the operator subset chosen by
 * SAX:
 *
 *   set_operation_mode   — reconfigures pump + the five valves as a whole
 *                          (7 modes, verified against Circulation.py).
 *   tank_percentage_fill — fills the recirculation tank by a RELATIVE amount
 *                          (up to 10 min; drives the mode to Sample_taking
 *                          while filling and leaves it in Brine when done).
 *   empty_tank           — drains the tank via Purge until the level reads 0
 *                          (up to ~10 min; leaves the circulation Closed).
 *
 * Both tank actions are minutes-long, so their cards show the live tank level
 * while running instead of an opaque spinner.
 */

/** Equipment-side timeouts: TANK_FILL_TIMEOUT=600s, EMPTY_TANK_TIME=590s. */
export const CIRCULATION_TIMEOUTS: Record<string, number> = {
  set_operation_mode: 45_000,
  tank_percentage_fill: 660_000,
  empty_tank: 660_000,
};

/**
 * The 7 settable modes, with what each one actually does to the hardware
 * (read from Circulation.set_operation_mode — pump state + valve pattern).
 */
const MODES: { value: string; label: string; hint: string }[] = [
  { value: "Brine", label: "Salmuera", hint: "Entrada salmuera + salida abiertas, bomba detenida" },
  { value: "Water", label: "Agua", hint: "Entrada agua + salida abiertas, bomba detenida" },
  { value: "Recirculation", label: "Recirculación", hint: "Lazo cerrado con el tanque, bomba adelante" },
  { value: "Purge", label: "Purga", hint: "Tanque → salida, bomba adelante" },
  { value: "Sample_taking", label: "Toma de muestra", hint: "Salmuera al tanque, salida cerrada" },
  { value: "Pump_Cleaning", label: "Limpieza bomba", hint: "Agua a través de la bomba, bomba adelante" },
  { value: "Closed", label: "Cerrado", hint: "Todas las válvulas cerradas, bomba detenida" },
];

/** Relative fill presets; 100 means "fill until the full sensor trips". */
const FILL_PRESETS = [
  { value: "10", label: "+10 %", hint: "Agregar 10 % al nivel actual" },
  { value: "25", label: "+25 %", hint: "Agregar 25 % al nivel actual" },
  { value: "50", label: "+50 %", hint: "Agregar 50 % al nivel actual" },
  { value: "100", label: "Hasta llenar", hint: "Llenar hasta que el sensor detecte tanque lleno" },
];

function modeTone(state: string | null): StateTone {
  if (!state) return "unknown";
  if (state === "Brine") return "ok";
  if (state === "Closed") return "unknown";
  if (MODES.some((m) => m.value === state)) return "info";
  // Reported states that aren't settable modes (e.g. an alarm condition).
  return "warn";
}

function modeLabel(state: string | null): string {
  if (!state) return "—";
  return MODES.find((m) => m.value === state)?.label ?? state;
}

interface CirculationOptionsProps {
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
  focusSignal: number;
}

export function CirculationOptions({
  data,
  action,
  disabled,
  onRun,
  onDismiss,
  focusSignal,
}: CirculationOptionsProps) {
  const mode = data?.operation_state ?? null;
  const level = Number(data?.tank_percentage_level ?? 0);
  const headroom = Math.max(0, 100 - level);

  const busy =
    !!action && !TERMINAL_STAGES.includes(action.stage) && action.stage !== "timeout";

  const cardProps = (command: string) => ({
    inflight: action?.command === command ? action : null,
    lockedBy: busy && action?.command !== command ? action!.label : null,
    onDismiss,
    focusSignal,
    disabled,
  });

  // --- set_operation_mode -------------------------------------------------
  const modeOptions: ActionOption[] = MODES.map((m) => ({
    value: m.value,
    label: m.label,
    hint: m.hint,
    isCurrent: mode === m.value,
  }));

  // --- tank_percentage_fill ----------------------------------------------
  // The equipment refuses (silently, as a no-op) when the requested relative
  // amount exceeds the free capacity — so presets past the headroom are
  // disabled here and the reason is stated up front.
  const fillOptions: ActionOption[] = FILL_PRESETS.map((p) => {
    const amount = Number(p.value);
    const exceedsCapacity = amount !== 100 && amount > headroom;
    return {
      value: p.value,
      label: p.label,
      hint: p.hint,
      disabledReason: exceedsCapacity
        ? `Sin capacidad (libre: ${headroom} %)`
        : undefined,
    };
  });
  const tankFull = headroom <= 0;

  // --- empty_tank ---------------------------------------------------------
  const emptyOptions: ActionOption[] = [
    {
      value: "",
      label: "Vaciar tanque",
      hint: "Purga hasta que el nivel llegue a 0 %",
    },
  ];

  return (
    <div className="space-y-3">
      <ActionCard
        title="Modo de operación"
        command="set_operation_mode"
        stateLabel={modeLabel(mode)}
        stateTone={modeTone(mode)}
        statePulse={busy && action?.command === "set_operation_mode"}
        requirement="Reconfigura la bomba y las cinco válvulas en conjunto"
        warning={
          mode && !MODES.some((m) => m.value === mode)
            ? `El equipo reporta "${mode}", que no es un modo configurable — puede ser una condición de alarma.`
            : null
        }
        options={modeOptions}
        currentHint="modo actual"
        onRun={(opt) =>
          onRun(
            "set_operation_mode",
            { arg1: opt.value },
            `Modo → ${opt.label}`,
            CIRCULATION_TIMEOUTS.set_operation_mode
          )
        }
        {...cardProps("set_operation_mode")}
      />

      <ActionCard
        title="Llenar tanque"
        command="tank_percentage_fill"
        stateLabel={`${level} %`}
        stateTone={data?.tank_filled ? "ok" : "info"}
        statePulse={busy && action?.command === "tank_percentage_fill"}
        requirement={`Cantidad RELATIVA a agregar sobre el nivel actual · capacidad libre: ${headroom} %`}
        warning={
          tankFull
            ? "El tanque está lleno — no hay capacidad para agregar más."
            : null
        }
        options={fillOptions}
        longRunNote="Puede tardar hasta 10 min. Durante el llenado el equipo pasa a Toma de muestra y al terminar queda en Salmuera."
        progress={<TankProgress level={level} direction="up" action={action} />}
        onRun={(opt) =>
          onRun(
            "tank_percentage_fill",
            { arg1: opt.value },
            opt.value === "100" ? "Llenando hasta lleno" : `Llenando +${opt.value} %`,
            CIRCULATION_TIMEOUTS.tank_percentage_fill
          )
        }
        {...cardProps("tank_percentage_fill")}
      />

      <ActionCard
        title="Vaciar tanque"
        command="empty_tank"
        stateLabel={`${level} %`}
        stateTone={level > 0 ? "info" : "unknown"}
        statePulse={busy && action?.command === "empty_tank"}
        requirement="Purga el tanque monitoreando el sensor de nivel"
        warning={
          level <= 0
            ? "El tanque ya está vacío — la acción solo cerrará la circulación."
            : null
        }
        options={emptyOptions}
        optionColumns={1}
        longRunNote="Puede tardar hasta 10 min y no se puede cancelar. Al terminar la circulación queda en Cerrado."
        progress={<TankProgress level={level} direction="down" action={action} />}
        onRun={() =>
          onRun(
            "empty_tank",
            {},
            "Vaciando tanque",
            CIRCULATION_TIMEOUTS.empty_tank
          )
        }
        {...cardProps("empty_tank")}
      />
    </div>
  );
}

/**
 * Live tank level while a fill/empty runs: the operator sees the equipment
 * actually working (level from telemetry, refreshed every 3s) plus elapsed
 * time against the equipment's own ~10 min ceiling.
 */
function TankProgress({
  level,
  direction,
  action,
}: {
  level: number;
  direction: "up" | "down";
  action: InflightAction | null;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!action) return;
    const update = () =>
      setElapsed(Math.floor((Date.now() - action.startedAt) / 1000));
    update();
    const t = setInterval(update, 1_000);
    return () => clearInterval(t);
  }, [action]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const barColor = direction === "up" ? "bg-cyan-400" : "bg-amber-400";

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          Nivel del tanque
        </span>
        <span className="font-mono text-[11px] font-bold text-slate-200 tabular-nums">
          {level} %
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${Math.min(100, Math.max(0, level))}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-500">
        <span>
          transcurrido{" "}
          <span className="font-mono tabular-nums text-slate-400">
            {mins}:{String(secs).padStart(2, "0")}
          </span>
        </span>
        <span>límite del equipo ~10:00</span>
      </div>
    </div>
  );
}
