"use client";

import { useState } from "react";
import { ActionRow, NumField, SubmitButton, type FirePayload, type RiskTier } from "./action-row";
import { GENERATOR_LIMITS } from "@/constants/service-actions";
import type { GeneratorData, InterchangerData } from "@/types/telemetry";
import type { InflightAction } from "@/hooks/use-action-runner";
import { TERMINAL_STAGES } from "@/hooks/use-action-runner";

/**
 * Generator service actions — the module's full service subset (SAX-defined):
 * the operator five (set_hv_state, standby, set_voltage, set_current,
 * set_voltage_and_current) plus the six service-only ones (power,
 * set_hv_state_service, reset_faults and the three filament setters).
 *
 * Grouping mirrors how a technician thinks about the source:
 *   Alimentación y seguridad → Punto de operación → Filamento
 *
 * Every range shown/enforced comes from the equipment's own code and
 * Config.ini (MAX_VOLTAGE=50, MAX_CURRENT=2000, MAX_POWER=50,
 * MAX_FIL_CURRENT=3500, MAX_FIL_PREHEAT=2000, ramp 0-10000 ms).
 */

const TIMEOUTS: Record<string, number> = {
  power: 20_000,
  set_hv_state: 20_000,
  set_hv_state_service: 20_000,
  standby: 45_000,
  reset_faults: 15_000,
  set_voltage: 25_000,
  set_current: 25_000,
  set_voltage_and_current: 45_000,
  set_filament_current_limit: 20_000,
  set_filament_preheat: 20_000,
  set_filament_ramp_time: 20_000,
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

interface GeneratorActionsProps {
  data: GeneratorData | null;
  /** Door/chamber locks arrive in the interchanger's telemetry. */
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
}

export function GeneratorServiceActions({
  data,
  interlocks,
  action,
  disabled,
  onRun,
  onDismiss,
}: GeneratorActionsProps) {
  const hvOn = data?.hv_on ?? false;
  const kv = num(data?.tube_high_voltage_kv);
  const ua = num(data?.beam_current_ua);

  const doorLocked = interlocks?.door_lock ?? false;
  const chamberLocked = interlocks?.chamber_lock ?? false;
  const interlockOpen = data?.interlock_open ?? false;
  const canRadiate = doorLocked && chamberLocked && !interlockOpen;
  const interlockReason = !doorLocked
    ? "la puerta de mantenimiento no está cerrada"
    : !chamberLocked
      ? "la cámara no está bloqueada"
      : interlockOpen
        ? "el enclavamiento del generador está abierto"
        : null;

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
      <Group title="Alimentación y seguridad">
        <ActionRow
          {...rowProps("set_hv_state", "Alto voltaje", "caution")}
          description="Enciende/apaga el alto voltaje (con verificación de enclavamientos)"
          requirement="Encender exige puerta y cámara cerradas; apagar siempre se permite"
          warning={!hvOn && !canRadiate ? `No va a poder encender: ${interlockReason}.` : null}
        >
          {({ request, blocked }) => (
            <TwoOptions
              blocked={blocked}
              a={{ label: "Encender HV", hint: "el tubo emite radiación", current: hvOn }}
              b={{ label: "Apagar HV", hint: "corta la emisión", current: !hvOn }}
              onPick={(on) =>
                request({ args: { arg1: on ? "1" : "0" }, label: on ? "Encendiendo HV" : "Apagando HV" })
              }
            />
          )}
        </ActionRow>

        <ActionRow
          {...rowProps("set_hv_state_service", "Alto voltaje (bypass)", "critical")}
          description="HV on/off SIN verificar enclavamientos — bypass de servicio"
          requirement="Salta la verificación de puerta y cámara: el tubo puede emitir con el equipo abierto. Solo para mantenimiento con el área controlada."
        >
          {({ request, blocked }) => (
            <TwoOptions
              blocked={blocked}
              danger
              a={{ label: "Encender (bypass)", hint: "emite SIN verificar cierres", current: hvOn }}
              b={{ label: "Apagar (bypass)", hint: "corta la emisión", current: !hvOn }}
              onPick={(on) =>
                request({
                  args: { arg1: on ? "1" : "0" },
                  label: on ? "HV ON sin enclavamientos" : "HV OFF (bypass)",
                })
              }
            />
          )}
        </ActionRow>

        <ActionRow
          {...rowProps("standby", "Reposo", "caution")}
          description="Lleva el tubo a 20 kV / 100 µA y enciende el HV"
          requirement="Requiere enclavamientos cerrados (los verifica el equipo)"
          warning={!canRadiate ? `El equipo lo rechazará: ${interlockReason}.` : null}
        >
          {({ request, blocked }) => (
            <SubmitButton
              label="Pasar a reposo (20 kV · 100 µA)"
              disabled={blocked}
              onClick={() => request({ args: {}, label: "Pasando a reposo" })}
            />
          )}
        </ActionRow>

        <ActionRow
          {...rowProps("reset_faults", "Resetear fallas", "normal")}
          description="Limpia los indicadores de falla de la fuente"
        >
          {({ request, blocked }) => (
            <SubmitButton
              label="Resetear fallas"
              disabled={blocked}
              onClick={() => request({ args: {}, label: "Reseteando fallas" })}
            />
          )}
        </ActionRow>

        <ActionRow
          {...rowProps("power", "Alimentación de la fuente", "critical")}
          description="Relé de 24V de la fuente — corta o repone la alimentación del generador"
          requirement="Apagar con HV activo corta la emisión de golpe, sin secuencia"
        >
          {({ request, blocked }) => (
            <TwoOptions
              blocked={blocked}
              danger
              a={{ label: "Alimentar (ON)", hint: "energiza la fuente", current: data?.power_supply_on ?? false }}
              b={{ label: "Cortar (OFF)", hint: "des-energiza la fuente", current: data ? !data.power_supply_on : false }}
              onPick={(on) =>
                request({
                  args: { arg1: on ? "true" : "false" },
                  label: on ? "Energizando la fuente" : "Cortando alimentación de la fuente",
                })
              }
            />
          )}
        </ActionRow>
      </Group>

      <Group title="Punto de operación">
        <ActionRow
          {...rowProps("set_voltage_and_current", "Punto de operación", "caution")}
          description="Mueve voltaje y corriente con transición segura de potencia"
          requirement="El equipo baja la corriente, programa el voltaje y luego la corriente final; limita el par a 50 W por sí mismo"
        >
          {({ request, blocked }) => (
            <DualPointForm current={{ kv, ua }} blocked={blocked} onSubmit={request} />
          )}
        </ActionRow>

        <ActionRow
          {...rowProps("set_voltage", "Voltaje del tubo", "caution")}
          description="Solo el voltaje del tubo"
          requirement={`Actual: ${kv.toFixed(1)} kV · para cambios grandes usa set_voltage_and_current`}
        >
          {({ request, blocked }) => (
            <SingleNumberForm
              label="kV"
              min={0}
              max={GENERATOR_LIMITS.maxVoltageKv}
              step={0.1}
              initial={kv.toFixed(1)}
              blocked={blocked}
              makePayload={(v) => ({ args: { arg1: v }, label: `Voltaje → ${v} kV` })}
              onSubmit={request}
            />
          )}
        </ActionRow>

        <ActionRow
          {...rowProps("set_current", "Corriente del haz", "caution")}
          description="Solo la corriente del haz"
          requirement={`Actual: ${ua.toFixed(0)} µA · tope ${GENERATOR_LIMITS.maxCurrentUaSingle} µA: este ajuste no limita potencia, y esa es la corriente segura a cualquier voltaje`}
        >
          {({ request, blocked }) => (
            <SingleNumberForm
              label="µA"
              min={0}
              max={GENERATOR_LIMITS.maxCurrentUaSingle}
              step={1}
              initial={ua.toFixed(0)}
              blocked={blocked}
              makePayload={(v) => ({ args: { arg1: v }, label: `Corriente → ${v} µA` })}
              onSubmit={request}
            />
          )}
        </ActionRow>
      </Group>

      <Group title="Filamento">
        <ActionRow
          {...rowProps("set_filament_current_limit", "Límite de corriente del filamento", "caution")}
          description="Límite de corriente del filamento (DAC C)"
          requirement={`Actual: ${num(data?.dac_c_filamentcurrentlimit_ma).toFixed(0)} mA · máx del equipo 3500 mA`}
        >
          {({ request, blocked }) => (
            <SingleNumberForm
              label="mA"
              min={0}
              max={3500}
              step={1}
              initial={num(data?.dac_c_filamentcurrentlimit_ma).toFixed(0)}
              blocked={blocked}
              makePayload={(v) => ({ args: { arg1: v }, label: `Límite filamento → ${v} mA` })}
              onSubmit={request}
            />
          )}
        </ActionRow>

        <ActionRow
          {...rowProps("set_filament_preheat", "Precalentamiento del filamento", "caution")}
          description="Corriente de precalentamiento del filamento (DAC D)"
          requirement={`Actual: ${num(data?.dac_d_filamentpreheatcurrent_ma).toFixed(0)} mA · máx del equipo 2000 mA`}
        >
          {({ request, blocked }) => (
            <SingleNumberForm
              label="mA"
              min={0}
              max={2000}
              step={1}
              initial={num(data?.dac_d_filamentpreheatcurrent_ma).toFixed(0)}
              blocked={blocked}
              makePayload={(v) => ({ args: { arg1: v }, label: `Precalentamiento → ${v} mA` })}
              onSubmit={request}
            />
          )}
        </ActionRow>

        <ActionRow
          {...rowProps("set_filament_ramp_time", "Rampa del filamento", "caution")}
          description="Habilita/deshabilita la rampa del filamento y su tiempo"
          requirement="Con rampa ON el filamento sube desde cero al encender el HV (1–10000 ms); con rampa OFF el tiempo debe ser 0"
        >
          {({ request, blocked }) => (
            <RampForm
              initialEnabled={data?.ramp_enabled ?? false}
              initialMs={num(data?.ramp_time_ms) || 3000}
              blocked={blocked}
              onSubmit={request}
            />
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

/** Two mutually exclusive states (ON/OFF style), current one marked. */
function TwoOptions({
  a,
  b,
  blocked,
  danger = false,
  onPick,
}: {
  a: { label: string; hint: string; current: boolean };
  b: { label: string; hint: string; current: boolean };
  blocked: boolean;
  danger?: boolean;
  onPick: (first: boolean) => void;
}) {
  const base = danger
    ? "border-red-500/40 bg-red-500/10 hover:border-red-400/70 hover:bg-red-500/20"
    : "border-white/10 bg-white/[0.04] hover:border-cyan-400/50 hover:bg-cyan-500/10";
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { ...a, first: true },
        { ...b, first: false },
      ].map((opt) => (
        <button
          key={opt.label}
          disabled={blocked || opt.current}
          onClick={() => onPick(opt.first)}
          className={`rounded-lg border px-3 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none ${
            opt.current
              ? "cursor-default border-emerald-500/25 bg-emerald-500/[0.06]"
              : base
          }`}
        >
          <span
            className={`block text-[11.5px] font-semibold ${
              opt.current ? "text-emerald-300/90" : "text-slate-200"
            }`}
          >
            {opt.label}
          </span>
          <span className="mt-0.5 block text-[9px] leading-snug text-slate-500">
            {opt.current ? "estado actual" : opt.hint}
          </span>
        </button>
      ))}
    </div>
  );
}

function SingleNumberForm({
  label,
  min,
  max,
  step,
  initial,
  blocked,
  makePayload,
  onSubmit,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  initial: string;
  blocked: boolean;
  makePayload: (v: string) => FirePayload;
  onSubmit: (p: FirePayload) => void;
}) {
  const [value, setValue] = useState(initial);
  const n = Number(value);
  const valid = Number.isFinite(n) && n >= min && n <= max;
  return (
    <div className="flex items-end gap-2">
      <NumField label={label} value={value} onChange={setValue} min={min} max={max} step={step} disabled={blocked} />
      <SubmitButton label="Aplicar" disabled={blocked || !valid} onClick={() => onSubmit(makePayload(value))} />
    </div>
  );
}

/** Voltage + current pair with live power feedback against MAX_POWER. */
function DualPointForm({
  current,
  blocked,
  onSubmit,
}: {
  current: { kv: number; ua: number };
  blocked: boolean;
  onSubmit: (p: FirePayload) => void;
}) {
  const [kv, setKv] = useState(current.kv.toFixed(1));
  const [ua, setUa] = useState(current.ua.toFixed(0));
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
  const over = watts > GENERATOR_LIMITS.maxPowerW;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <NumField label="kV" value={kv} onChange={setKv} min={0} max={GENERATOR_LIMITS.maxVoltageKv} step={0.1} disabled={blocked} />
        <NumField label="µA" value={ua} onChange={setUa} min={0} max={GENERATOR_LIMITS.maxCurrentUa} step={1} disabled={blocked} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] ${over ? "text-amber-300" : "text-slate-500"}`}>
          Potencia: <span className="font-mono tabular-nums">{watts.toFixed(1)} W</span>
          {over && ` — supera ${GENERATOR_LIMITS.maxPowerW} W, el equipo bajará la corriente`}
        </span>
        <SubmitButton
          label="Aplicar punto"
          disabled={blocked || !valid}
          onClick={() =>
            onSubmit({ args: { arg1: kv, arg2: ua }, label: `Punto → ${kv} kV · ${ua} µA` })
          }
        />
      </div>
    </div>
  );
}

/** Ramp enable/disable with the equipment's coupled time constraint. */
function RampForm({
  initialEnabled,
  initialMs,
  blocked,
  onSubmit,
}: {
  initialEnabled: boolean;
  initialMs: number;
  blocked: boolean;
  onSubmit: (p: FirePayload) => void;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [ms, setMs] = useState(String(initialMs));
  const msN = Number(ms);
  // Coupled rule from the equipment: disable → time must be 0; enable → 1-10000.
  const valid = enabled
    ? Number.isFinite(msN) && msN > 0 && msN <= 10000
    : true;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex shrink-0 gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {[
            { on: true, label: "Rampa ON" },
            { on: false, label: "Rampa OFF" },
          ].map((o) => (
            <button
              key={o.label}
              disabled={blocked}
              onClick={() => setEnabled(o.on)}
              className={`rounded-md px-2.5 py-1 text-[10.5px] font-semibold transition-colors disabled:opacity-40 ${
                enabled === o.on
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {enabled ? (
          <NumField label="ms" value={ms} onChange={setMs} min={1} max={10000} step={100} disabled={blocked} />
        ) : (
          <span className="pb-2 text-[10px] text-slate-500">
            tiempo fijado a 0 (exigencia del equipo)
          </span>
        )}
        <SubmitButton
          label="Aplicar"
          disabled={blocked || !valid}
          onClick={() =>
            onSubmit({
              args: { arg1: enabled ? "1" : "0", arg2: enabled ? ms : "0" },
              label: enabled ? `Rampa ON · ${ms} ms` : "Rampa OFF",
            })
          }
        />
      </div>
    </div>
  );
}
