"use client";

import { ScadaScreen } from "@/components/scada/scada-screen";

export function ServiceScreen({ deviceId }: { deviceId: string }) {
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
            ["HV ramp time", "300 ms"],
            ["Filament limit", "1.8 A"],
            ["Filament preheat", "0.6 A"],
            ["Interlock", "OK"],
            ["Overvoltage", "OK"],
          ]}
        />
        <DiagnosticCard
          title="Detector"
          rows={[
            ["MCA length", "8192"],
            ["Gain", "0.98"],
            ["Bin width", "0.01 keV"],
            ["Gain trim", "0.0042"],
            ["Temp", "−25.4 °C"],
          ]}
        />
        <DiagnosticCard
          title="Auxiliar"
          rows={[
            ["Bat voltage", "26.8 V"],
            ["Bat fail", "false"],
            ["DC OK", "true"],
            ["Tank pressure (high)", "OK"],
            ["Tank pressure (low)", "OK"],
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
