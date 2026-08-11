"use client";

import { useState } from "react";
import { ActionCard, type ActionOption, type StateTone } from "./action-card";
import { GENERATOR_LIMITS } from "@/constants/operator-actions";
import type { GeneratorData, InterchangerData } from "@/types/telemetry";
import type { InflightAction } from "@/hooks/use-action-runner";
import { TERMINAL_STAGES } from "@/hooks/use-action-runner";

/**
 * "Opciones" cards for the GENERATOR module — the X-ray tube. This is the
 * highest-stakes module on the screen, so every card states the equipment's
 * own preconditions and limits rather than implying the UI enforces them.
 *
 * Operator subset chosen by SAX:
 *   set_hv_state            — 1 = radiate, 0 = stop. The equipment REFUSES to
 *       turn HV on unless the door and chamber locks are engaged; turning it
 *       off is always allowed.
 *   standby                 — 20 kV / 100 µA with HV on (STAND_BY_HV /
 *       STAND_BY_CURRENT). Also requires the interlocks.
 *   set_voltage_and_current — the POWER-SAFE way to move the operating point:
 *       the equipment lowers the current first, programs the voltage, then the
 *       final current, and clamps the pair to MAX_POWER by itself.
 *   set_voltage / set_current — single-parameter setters, for small
 *       adjustments. Neither has a power guard of its own.
 *
 * Voltage and current are continuous parameters, so they are entered as
 * numbers bounded by the equipment's real limits — not as invented presets.
 * The two quick picks are the only operating points evidenced in SAX's own
 * code (the standby config and the tube-init sequence).
 */

const TIMEOUTS = {
  set_hv_state: 20_000,
  standby: 45_000,
  set_voltage_and_current: 45_000,
  set_voltage: 25_000,
  set_current: 25_000,
};

/** Operating points found in the equipment's own code, not invented here. */
const QUICK_POINTS = [
  { kv: 20, ua: 100, label: "Reposo", source: "STAND_BY_HV / STAND_BY_CURRENT" },
  { kv: 20, ua: 150, label: "Inicialización", source: "detector_tube_init" },
];

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

interface GeneratorOptionsProps {
  data: GeneratorData | null;
  /** Door and chamber locks live in the interchanger's telemetry. */
  interlocks: InterchangerData | null;
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

export function GeneratorOptions({
  data,
  interlocks,
  action,
  disabled,
  onRun,
  onDismiss,
  focusSignal,
}: GeneratorOptionsProps) {
  const hvOn = data?.hv_on ?? false;
  const kv = num(data?.tube_high_voltage_kv);
  const ua = num(data?.beam_current_ua);
  const watts = (kv * ua) / 1000;

  // The equipment checks these three before allowing HV on or standby.
  const doorLocked = interlocks?.door_lock ?? false;
  const chamberLocked = interlocks?.chamber_lock ?? false;
  const interlockOpen = data?.interlock_open ?? false;
  const canRadiate = doorLocked && chamberLocked && !interlockOpen;
  const interlockReason = !doorLocked
    ? "La puerta de mantenimiento no está cerrada"
    : !chamberLocked
      ? "La cámara no está bloqueada"
      : interlockOpen
        ? "El enclavamiento del generador está abierto"
        : null;

  const faults = [
    data?.overpower_fault && "sobrepotencia",
    data?.overvoltage_fault && "sobrevoltaje",
    data?.interlock_fault && "enclavamiento",
    data?.source_undervoltage_fault && "subtensión de fuente",
    data?.configuration_fault && "configuración",
  ].filter((f): f is string => typeof f === "string");

  const busy =
    !!action && !TERMINAL_STAGES.includes(action.stage) && action.stage !== "timeout";

  const cardProps = (command: string) => ({
    inflight: action?.command === command ? action : null,
    lockedBy: busy && action?.command !== command ? action!.label : null,
    onDismiss,
    focusSignal,
    disabled,
  });

  const hvOptions: ActionOption[] = [
    {
      value: "1",
      label: "Encender HV",
      hint: "El tubo comienza a emitir radiación",
      isCurrent: hvOn,
      disabledReason:
        !hvOn && !canRadiate ? (interlockReason ?? undefined) : undefined,
    },
    {
      value: "0",
      label: "Apagar HV",
      hint: "Corta la emisión — siempre permitido",
      isCurrent: !hvOn,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Live operating point — the number that matters most in this module */}
      <div className="flex items-stretch gap-2">
        <Readout label="Voltaje" value={kv.toFixed(1)} unit="kV" />
        <Readout label="Corriente" value={ua.toFixed(0)} unit="µA" />
        <Readout
          label="Potencia"
          value={watts.toFixed(1)}
          unit={`W / ${GENERATOR_LIMITS.maxPowerW}`}
          warn={watts > GENERATOR_LIMITS.maxPowerW * 0.9}
        />
      </div>

      {faults.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] leading-snug text-red-200">
          <span className="font-semibold">
            Falla{faults.length > 1 ? "s" : ""} activa
            {faults.length > 1 ? "s" : ""}:
          </span>{" "}
          {faults.join(", ")}. Revisa el equipo antes de operar el tubo.
        </div>
      )}

      <ActionCard
        title="Alto voltaje (rayos X)"
        command="set_hv_state"
        stateLabel={hvOn ? "RADIANDO" : "APAGADO"}
        stateTone={hvOn ? "warn" : "unknown"}
        statePulse={hvOn}
        requirement="Encender requiere puerta y cámara cerradas; apagar siempre se permite"
        warning={
          !hvOn && !canRadiate
            ? `No se puede encender: ${interlockReason?.toLowerCase()}.`
            : null
        }
        options={hvOptions}
        currentHint="estado actual"
        tone="danger"
        onRun={(opt) =>
          onRun(
            "set_hv_state",
            { arg1: opt.value },
            opt.value === "1" ? "Encendiendo HV" : "Apagando HV",
            TIMEOUTS.set_hv_state
          )
        }
        {...cardProps("set_hv_state")}
      />

      <ActionCard
        title="Reposo"
        command="standby"
        stateLabel={hvOn ? `${kv.toFixed(0)} kV · ${ua.toFixed(0)} µA` : "APAGADO"}
        stateTone={hvOn ? "info" : "unknown"}
        statePulse={busy && action?.command === "standby"}
        requirement="Lleva el tubo a 20 kV / 100 µA y enciende el HV si estaba apagado"
        warning={
          !canRadiate
            ? `El equipo rechazará el reposo: ${interlockReason?.toLowerCase()}.`
            : null
        }
        options={[
          {
            value: "",
            label: "Pasar a reposo",
            hint: "20 kV · 100 µA · HV encendido",
          },
        ]}
        optionColumns={1}
        onRun={() => onRun("standby", {}, "Pasando a reposo", TIMEOUTS.standby)}
        {...cardProps("standby")}
      />

      <ActionCard
        title="Punto de operación"
        command="set_voltage_and_current"
        stateLabel={`${kv.toFixed(1)} kV · ${ua.toFixed(0)} µA`}
        stateTone="info"
        statePulse={busy && action?.command === "set_voltage_and_current"}
        requirement="Forma segura de mover el punto: el equipo baja la corriente, programa el voltaje y luego la corriente final, limitando la potencia por sí mismo"
        options={[]}
        renderInput={(submit, blocked) => (
          <OperatingPointInput
            currentKv={kv}
            currentUa={ua}
            disabled={blocked}
            onSubmit={submit}
          />
        )}
        onRun={(opt) =>
          onRun(
            "set_voltage_and_current",
            { arg1: opt.value, ...opt.extraArgs },
            opt.label,
            TIMEOUTS.set_voltage_and_current
          )
        }
        {...cardProps("set_voltage_and_current")}
      />

      <ActionCard
        title="Solo voltaje"
        command="set_voltage"
        stateLabel={`${kv.toFixed(1)} kV`}
        stateTone="info"
        statePulse={busy && action?.command === "set_voltage"}
        requirement={`Entre 0 y ${GENERATOR_LIMITS.maxVoltageKv} kV`}
        warning="Para cambios grandes usa Punto de operación: cambiar un parámetro solo puede pasar por un estado intermedio que el generador rechaza."
        options={[]}
        renderInput={(submit, blocked) => (
          <SingleValueInput
            unit="kV"
            initial={kv}
            min={0}
            max={GENERATOR_LIMITS.maxVoltageKv}
            step={0.1}
            disabled={blocked}
            makeLabel={(v) => `Voltaje → ${v} kV`}
            onSubmit={submit}
          />
        )}
        onRun={(opt) =>
          onRun(
            "set_voltage",
            { arg1: opt.value },
            opt.label,
            TIMEOUTS.set_voltage
          )
        }
        {...cardProps("set_voltage")}
      />

      <ActionCard
        title="Solo corriente"
        command="set_current"
        stateLabel={`${ua.toFixed(0)} µA`}
        stateTone="info"
        statePulse={busy && action?.command === "set_current"}
        requirement={`Entre 0 y ${GENERATOR_LIMITS.maxCurrentUaSingle} µA`}
        warning={`Este ajuste no limita la potencia por sí mismo, por eso el tope es ${GENERATOR_LIMITS.maxCurrentUaSingle} µA: es la corriente que respeta los ${GENERATOR_LIMITS.maxPowerW} W incluso a ${GENERATOR_LIMITS.maxVoltageKv} kV.`}
        options={[]}
        renderInput={(submit, blocked) => (
          <SingleValueInput
            unit="µA"
            initial={ua}
            min={0}
            max={GENERATOR_LIMITS.maxCurrentUaSingle}
            step={1}
            disabled={blocked}
            makeLabel={(v) => `Corriente → ${v} µA`}
            onSubmit={submit}
          />
        )}
        onRun={(opt) =>
          onRun(
            "set_current",
            { arg1: opt.value },
            opt.label,
            TIMEOUTS.set_current
          )
        }
        {...cardProps("set_current")}
      />
    </div>
  );
}

function Readout({
  label,
  value,
  unit,
  warn = false,
}: {
  label: string;
  value: string;
  unit: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-xl border px-3 py-2 ${
        warn
          ? "border-amber-500/30 bg-amber-500/[0.07]"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[15px] font-bold leading-none text-slate-100 tabular-nums">
        {value}
        <span className="ml-1 text-[9px] font-medium text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

/** Two-parameter entry with the live power the pair would demand. */
function OperatingPointInput({
  currentKv,
  currentUa,
  disabled,
  onSubmit,
}: {
  currentKv: number;
  currentUa: number;
  disabled: boolean;
  onSubmit: (option: ActionOption) => void;
}) {
  const [kv, setKv] = useState(currentKv.toFixed(1));
  const [ua, setUa] = useState(currentUa.toFixed(0));

  const kvN = Number(kv);
  const uaN = Number(ua);
  const valid =
    Number.isFinite(kvN) &&
    Number.isFinite(uaN) &&
    kvN >= 0 &&
    kvN <= GENERATOR_LIMITS.maxVoltageKv &&
    uaN >= 0 &&
    uaN <= GENERATOR_LIMITS.maxCurrentUa;
  const watts = valid ? (kvN * uaN) / 1000 : 0;
  const overPower = watts > GENERATOR_LIMITS.maxPowerW;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Field label="kV" value={kv} onChange={setKv} max={GENERATOR_LIMITS.maxVoltageKv} step={0.1} disabled={disabled} />
        <Field label="µA" value={ua} onChange={setUa} max={GENERATOR_LIMITS.maxCurrentUa} step={1} disabled={disabled} />
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className={overPower ? "text-amber-300" : "text-slate-500"}>
          Potencia: <span className="font-mono tabular-nums">{watts.toFixed(1)} W</span>
          {overPower &&
            ` — supera ${GENERATOR_LIMITS.maxPowerW} W, el equipo bajará la corriente`}
        </span>
      </div>

      <div className="flex gap-2">
        {QUICK_POINTS.map((p) => (
          <button
            key={p.label}
            disabled={disabled}
            onClick={() => {
              setKv(String(p.kv));
              setUa(String(p.ua));
            }}
            title={`Valor tomado de ${p.source}`}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-slate-300 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {p.label} · {p.kv}/{p.ua}
          </button>
        ))}
      </div>

      <button
        disabled={disabled || !valid}
        onClick={() =>
          onSubmit({
            value: kv,
            label: `Punto → ${kv} kV · ${ua} µA`,
            extraArgs: { arg2: ua },
          })
        }
        className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[12px] font-semibold text-cyan-100 transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Aplicar punto de operación
      </button>
    </div>
  );
}

function SingleValueInput({
  unit,
  initial,
  min,
  max,
  step,
  disabled,
  makeLabel,
  onSubmit,
}: {
  unit: string;
  initial: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  makeLabel: (value: string) => string;
  onSubmit: (option: ActionOption) => void;
}) {
  const [value, setValue] = useState(
    step < 1 ? initial.toFixed(1) : initial.toFixed(0)
  );
  const n = Number(value);
  const valid = Number.isFinite(n) && n >= min && n <= max;

  return (
    <div className="flex gap-2">
      <Field label={unit} value={value} onChange={setValue} max={max} step={step} disabled={disabled} />
      <button
        disabled={disabled || !valid}
        onClick={() => onSubmit({ value, label: makeLabel(value) })}
        className="shrink-0 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 text-[12px] font-semibold text-cyan-100 transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Aplicar
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  max,
  step,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  step: number;
  disabled: boolean;
}) {
  const n = Number(value);
  const invalid = value !== "" && (!Number.isFinite(n) || n < 0 || n > max);
  return (
    <label className="flex-1">
      <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        {label} · máx {max}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border bg-white/5 px-2.5 py-1.5 font-mono text-[13px] text-slate-100 outline-none tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          invalid
            ? "border-red-500/50 focus:border-red-400"
            : "border-white/10 focus:border-cyan-400/60"
        }`}
      />
    </label>
  );
}
