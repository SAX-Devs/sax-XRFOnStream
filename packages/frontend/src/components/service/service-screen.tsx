"use client";

import { ScadaScreen } from "@/components/scada/scada-screen";
import { useTelemetry } from "@/hooks/use-telemetry";

/** Format a numeric telemetry field, falling back to em-dash while loading/absent. */
function n(v: number | undefined, digits = 1, unit = ""): string {
  if (typeof v !== "number") return "—";
  const s = v.toFixed(digits);
  return unit ? `${s} ${unit}` : s;
}

/** Format a boolean fault/flag as an OK/fault word. */
function flag(v: boolean | undefined, ok: string, bad: string): string {
  if (typeof v !== "boolean") return "—";
  return v ? bad : ok;
}

export function ServiceScreen({ deviceId }: { deviceId: string }) {
  // Service-only diagnostics read the raw module telemetry directly.
  const gen = useTelemetry(deviceId, "generator").data;
  const det = useTelemetry(deviceId, "detector").data;
  const aux = useTelemetry(deviceId, "auxiliary").data;

  return (
    <div className="space-y-3">
      {/* Service mode banner */}
      <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/5 px-4 py-2.5 backdrop-blur-md">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 ring-1 ring-amber-500/40">
          <svg
            className="h-4 w-4 text-amber-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-200">
            Modo Servicio
          </h2>
          <p className="text-[11px] text-amber-200/70">
            Acceso completo a controles del equipo. Cambios afectan operación en
            tiempo real — proceder con precaución.
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-amber-300/60">
          rol: service
        </span>
      </div>

      {/* Service-mode SCADA (reuses the same diagram with full controls) */}
      <ScadaScreen deviceId={deviceId} userLabel="Técnico" userRole="service" />

      {/* Auxiliary diagnostic panel (only visible in service mode) */}
      <div className="grid grid-cols-3 gap-3">
        <DiagnosticCard
          title="Generador Rx"
          rows={[
            ["HV ramp time", n(gen?.ramp_time_ms, 0, "ms")],
            ["Filament I", n(gen?.filament_current_ma, 0, "mA")],
            ["SiC temp", n(gen?.sic_temperature_c, 1, "°C")],
            ["Interlock", flag(gen?.interlock_open, "OK", "ABIERTO")],
            ["Overvoltage", flag(gen?.overvoltage_fault, "OK", "FALLA")],
          ]}
        />
        <DiagnosticCard
          title="Detector"
          rows={[
            ["MCA length", n(det?.mca_length, 0)],
            ["Gain", n(det?.gain, 2)],
            ["Bin width", n(det?.mca_bin_width, 2)],
            ["Gain trim", n(det?.gain_trim, 2)],
            ["Temp", n(det?.temperature, 1, "°C")],
          ]}
        />
        <DiagnosticCard
          title="Auxiliar"
          rows={[
            ["Bat voltage", n(aux?.bat_vol, 1, "V")],
            ["Bat fail", flag(aux?.bat_fail, "no", "SÍ")],
            ["DC OK", flag(aux?.dc_ok, "FALLA", "OK")],
            ["Tank pressure (high)", flag(aux?.tank_pressure_high, "OK", "ALTA")],
            ["Tank pressure (low)", flag(aux?.tank_pressure_low, "OK", "BAJA")],
          ]}
        />
      </div>
    </div>
  );
}

function DiagnosticCard({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
      <h3 className="mb-2 border-b border-white/5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
        {title}
      </h3>
      <dl className="space-y-1">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between text-[11px]"
          >
            <dt className="text-slate-400">{label}</dt>
            <dd className="font-mono font-semibold text-slate-200 tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
