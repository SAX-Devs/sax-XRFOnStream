"use client";

import { useEffect, useState } from "react";
import { ActionCard, type ActionOption, type StateTone } from "./action-card";
import type { VacuumData } from "@/types/telemetry";
import type { InflightAction } from "@/hooks/use-action-runner";
import { TERMINAL_STAGES } from "@/hooks/use-action-runner";

/**
 * "Opciones" cards for the VACUUM module — the operator subset chosen by SAX:
 *
 *   set_atmospheric_condition — reconfigures the two pumps and the three
 *       valves as a whole (5 conditions, verified against Vacuum.py).
 *   emergency_purge — safety sequence for a suspected analysis-chamber
 *       membrane rupture: Clean → Purge → wait → Closed.
 *
 * Reaching Vacuum or Atmospheric is not instantaneous: the equipment waits for
 * a pressure target and RAISES if it isn't met, leaving the condition as
 * "Undefined". The card shows the live pressure while it works and explains
 * that state when it happens.
 */

/** Pressure thresholds from the equipment's VACUUM_CONFIG (kPa). */
const VACUUM_LOW_THRESHOLD = 2; // below this counts as vacuum reached
const ATMOSPHERIC_THRESHOLD = 86; // above this counts as atmospheric
/** Full-scale for the pressure bar — atmospheric pressure at sea level. */
const PRESSURE_FULL_SCALE = 101;

/**
 * Visual timeouts per condition. The equipment's own waits are
 * VACUUM_STABILIZATION_TIME=30s (+5s ventilation) for Vacuum and
 * VACUUM_VENTILATION_TIME=5s for Atmospheric; Purge/Clean/Closed only
 * actuate valves. Margins cover the valve delays and the round trip.
 */
const CONDITION_TIMEOUTS: Record<string, number> = {
  Vacuum: 75_000,
  Atmospheric: 30_000,
  Purge: 20_000,
  Clean: 20_000,
  Closed: 20_000,
};

/** emergency_purge ≈ valves + PURGING_TIME (10s) + valves. */
export const EMERGENCY_PURGE_TIMEOUT = 60_000;

/**
 * The 5 settable conditions, described by what each does to the hardware
 * (read from Vacuum.set_atmospheric_condition — pump state + valve pattern).
 */
const CONDITIONS: {
  value: string;
  label: string;
  hint: string;
  slow?: boolean;
}[] = [
  {
    value: "Vacuum",
    label: "Vacío",
    hint: "Bombas ON · entrada cerrada, salida abierta",
    slow: true,
  },
  {
    value: "Atmospheric",
    label: "Atmosférica",
    hint: "Bombas OFF · entrada y salida abiertas",
    slow: true,
  },
  { value: "Purge", label: "Purga", hint: "Solo la válvula de purga abierta" },
  { value: "Clean", label: "Limpieza", hint: "Salida y purga abiertas" },
  { value: "Closed", label: "Cerrado", hint: "Todo cerrado · bombas OFF" },
];

/** Telemetry sends Decimals as strings — coerce before comparing. */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function conditionTone(state: string | null): StateTone {
  if (!state) return "unknown";
  if (state === "Vacuum") return "ok";
  if (state === "Undefined") return "warn";
  if (state === "Atmospheric") return "info";
  if (state === "Closed") return "unknown";
  if (CONDITIONS.some((c) => c.value === state)) return "moving";
  return "warn";
}

function conditionLabel(state: string | null): string {
  if (!state) return "—";
  if (state === "Undefined") return "Indefinida";
  return CONDITIONS.find((c) => c.value === state)?.label ?? state;
}

interface VacuumOptionsProps {
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
  focusSignal: number;
}

export function VacuumOptions({
  data,
  action,
  disabled,
  onRun,
  onDismiss,
  focusSignal,
}: VacuumOptionsProps) {
  const condition = data?.atmospheric_status ?? null;
  const pressure = num(data?.vacuum_sensor);

  const busy =
    !!action && !TERMINAL_STAGES.includes(action.stage) && action.stage !== "timeout";

  const cardProps = (command: string) => ({
    inflight: action?.command === command ? action : null,
    lockedBy: busy && action?.command !== command ? action!.label : null,
    onDismiss,
    focusSignal,
    disabled,
  });

  const conditionOptions: ActionOption[] = CONDITIONS.map((c) => ({
    value: c.value,
    label: c.label,
    hint: c.slow ? `${c.hint} · espera presión` : c.hint,
    isCurrent: condition === c.value,
  }));

  const purgeOptions: ActionOption[] = [
    {
      value: "",
      label: "Ejecutar purga de emergencia",
      hint: "Limpieza → Purga → Cerrado",
    },
  ];

  return (
    <div className="space-y-3">
      <ActionCard
        title="Condición atmosférica"
        command="set_atmospheric_condition"
        stateLabel={conditionLabel(condition)}
        stateTone={conditionTone(condition)}
        statePulse={busy && action?.command === "set_atmospheric_condition"}
        requirement={`Reconfigura las dos bombas y las tres válvulas · presión actual ${pressure.toFixed(1)} kPa`}
        warning={
          condition === "Undefined"
            ? "El equipo quedó en condición indefinida: una transición anterior no alcanzó su presión objetivo. Vuelve a fijar una condición para salir de este estado."
            : null
        }
        options={conditionOptions}
        currentHint="condición actual"
        longRunNote="Vacío tarda hasta ~35 s y Atmosférica hasta ~5 s: el equipo espera a que la presión llegue al objetivo y falla si no lo logra. Purga, Limpieza y Cerrado solo mueven válvulas."
        progress={<PressureProgress pressure={pressure} action={action} />}
        onRun={(opt) =>
          onRun(
            "set_atmospheric_condition",
            { arg1: opt.value },
            `Condición → ${opt.label}`,
            CONDITION_TIMEOUTS[opt.value] ?? 30_000
          )
        }
        {...cardProps("set_atmospheric_condition")}
      />

      <ActionCard
        title="Purga de emergencia"
        command="emergency_purge"
        stateLabel={conditionLabel(condition)}
        stateTone={conditionTone(condition)}
        statePulse={busy && action?.command === "emergency_purge"}
        requirement="Medida de seguridad ante sospecha de ruptura de la membrana de la cámara de análisis"
        options={purgeOptions}
        optionColumns={1}
        tone="danger"
        longRunNote="Secuencia automática de ~15 s que no se puede cancelar. Al terminar el sistema queda en condición Cerrado."
        progress={<PressureProgress pressure={pressure} action={action} />}
        onRun={() =>
          onRun("emergency_purge", {}, "Purga de emergencia", EMERGENCY_PURGE_TIMEOUT)
        }
        {...cardProps("emergency_purge")}
      />
    </div>
  );
}

/**
 * Live chamber pressure while a condition change runs. Pumping down from
 * atmospheric takes ~35s, so the operator watches the real reading fall
 * instead of an opaque spinner. Threshold marks come from VACUUM_CONFIG.
 */
function PressureProgress({
  pressure,
  action,
}: {
  pressure: number;
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

  const pct = Math.min(100, Math.max(0, (pressure / PRESSURE_FULL_SCALE) * 100));
  const atVacuum = pressure <= VACUUM_LOW_THRESHOLD;
  const atAtmospheric = pressure >= ATMOSPHERIC_THRESHOLD;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          Presión de cámara
        </span>
        <span className="font-mono text-[11px] font-bold text-slate-200 tabular-nums">
          {pressure.toFixed(1)} kPa
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            atVacuum ? "bg-cyan-400" : atAtmospheric ? "bg-amber-400" : "bg-slate-400"
          }`}
          style={{ width: `${pct}%` }}
        />
        {/* Vacuum target mark (2 kPa) */}
        <span
          className="absolute top-0 h-full w-px bg-cyan-300/60"
          style={{ left: `${(VACUUM_LOW_THRESHOLD / PRESSURE_FULL_SCALE) * 100}%` }}
        />
        {/* Atmospheric target mark (86 kPa) */}
        <span
          className="absolute top-0 h-full w-px bg-amber-300/60"
          style={{ left: `${(ATMOSPHERIC_THRESHOLD / PRESSURE_FULL_SCALE) * 100}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-500">
        <span>
          transcurrido{" "}
          <span className="font-mono tabular-nums text-slate-400">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </span>
        </span>
        <span>
          {atVacuum
            ? "vacío alcanzado"
            : atAtmospheric
              ? "presión atmosférica"
              : "en transición"}
        </span>
      </div>
    </div>
  );
}
