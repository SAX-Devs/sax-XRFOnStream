"use client";

import { useMemo, useState } from "react";

type Severity = "info" | "warning" | "critical" | "emergency";
type FilterState = "all" | "active" | "acknowledged";

interface Alert {
  id: number;
  severity: Severity;
  source: string;
  title: string;
  detail?: string;
  timestamp: string;
  acknowledged: boolean;
  ackBy?: string;
  ackAt?: string;
}

const SAMPLE_ALERTS: Alert[] = [
  {
    id: 14,
    severity: "warning",
    source: "temp_control",
    title: "Cabinet T elevada",
    detail: "Temperatura del gabinete: 24.3 °C. Umbral de advertencia: 24.0 °C.",
    timestamp: "2026-04-28 15:42:18",
    acknowledged: false,
  },
  {
    id: 13,
    severity: "info",
    source: "system",
    title: "Medición XRF completada",
    detail: "RUN-2026-04-28-008 finalizado. Livetime 11.92 s, 48235 triggers.",
    timestamp: "2026-04-28 15:42:30",
    acknowledged: false,
  },
  {
    id: 12,
    severity: "critical",
    source: "vacuum",
    title: "Pérdida de vacío detectada",
    detail: "Sensor de vacío reportó variación >15%. VP-001 entró en modo recuperación automática.",
    timestamp: "2026-04-28 15:18:02",
    acknowledged: true,
    ackBy: "operario@sax.cl",
    ackAt: "2026-04-28 15:21:44",
  },
  {
    id: 11,
    severity: "info",
    source: "interchanger",
    title: "Cambio a posición Recal",
    detail: "Recalibración programada cada 4 horas.",
    timestamp: "2026-04-28 14:00:08",
    acknowledged: true,
    ackBy: "system",
    ackAt: "2026-04-28 14:00:09",
  },
  {
    id: 10,
    severity: "warning",
    source: "circulation",
    title: "Flow out menor que Flow in",
    detail: "Diferencia de caudal: 0.3 L/m. Posible obstrucción parcial en la línea de retorno.",
    timestamp: "2026-04-28 13:35:12",
    acknowledged: true,
    ackBy: "service@sax.cl",
    ackAt: "2026-04-28 13:38:55",
  },
  {
    id: 9,
    severity: "emergency",
    source: "generator",
    title: "Interlock abierto",
    detail: "Puerta de generador abierta durante operación. HV apagado automáticamente.",
    timestamp: "2026-04-27 22:14:50",
    acknowledged: true,
    ackBy: "service@sax.cl",
    ackAt: "2026-04-27 22:18:02",
  },
  {
    id: 8,
    severity: "info",
    source: "system",
    title: "Inicialización del equipo",
    detail: "Secuencia de power-up completada. Todos los módulos operativos.",
    timestamp: "2026-04-27 21:30:00",
    acknowledged: true,
    ackBy: "system",
    ackAt: "2026-04-27 21:30:02",
  },
];

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; color: string; bg: string; ring: string; icon: string }
> = {
  info: {
    label: "INFO",
    color: "text-blue-300",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/30",
    icon: "ℹ",
  },
  warning: {
    label: "WARNING",
    color: "text-amber-300",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/40",
    icon: "⚠",
  },
  critical: {
    label: "CRITICAL",
    color: "text-orange-300",
    bg: "bg-orange-500/15",
    ring: "ring-orange-500/50",
    icon: "✕",
  },
  emergency: {
    label: "EMERGENCY",
    color: "text-red-300",
    bg: "bg-red-500/20",
    ring: "ring-red-500/60",
    icon: "⛔",
  },
};

export function AlertsScreen() {
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [stateFilter, setStateFilter] = useState<FilterState>("all");

  const filtered = useMemo(() => {
    return SAMPLE_ALERTS.filter((a) => {
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (stateFilter === "active" && a.acknowledged) return false;
      if (stateFilter === "acknowledged" && !a.acknowledged) return false;
      return true;
    });
  }, [severityFilter, stateFilter]);

  const counts = useMemo(() => {
    return {
      total: SAMPLE_ALERTS.length,
      active: SAMPLE_ALERTS.filter((a) => !a.acknowledged).length,
      critical: SAMPLE_ALERTS.filter(
        (a) => !a.acknowledged && (a.severity === "critical" || a.severity === "emergency")
      ).length,
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Header with summary counts */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Total"
          value={counts.total}
          color="text-slate-100"
          dot="bg-slate-400"
        />
        <SummaryCard
          label="Activas"
          value={counts.active}
          color="text-amber-300"
          dot="bg-amber-400"
        />
        <SummaryCard
          label="Críticas activas"
          value={counts.critical}
          color="text-red-300"
          dot="bg-red-500"
          pulse
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-2.5 backdrop-blur-md">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Filtrar:
        </span>
        <FilterPills
          options={[
            { value: "all", label: "Todas" },
            { value: "info", label: "Info" },
            { value: "warning", label: "Warning" },
            { value: "critical", label: "Critical" },
            { value: "emergency", label: "Emergency" },
          ]}
          value={severityFilter}
          onChange={(v) => setSeverityFilter(v as Severity | "all")}
        />
        <span className="h-5 w-px bg-white/10" />
        <FilterPills
          options={[
            { value: "all", label: "Todas" },
            { value: "active", label: "Activas" },
            { value: "acknowledged", label: "Reconocidas" },
          ]}
          value={stateFilter}
          onChange={(v) => setStateFilter(v as FilterState)}
        />
      </div>

      {/* Alerts list */}
      <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-3xl text-slate-700">○</span>
            <p className="mt-2 text-sm text-slate-500">
              No hay alertas con estos filtros
            </p>
          </div>
        ) : (
          <ul>
            {filtered.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  dot,
  pulse,
}: {
  label: string;
  value: number;
  color: string;
  dot: string;
  pulse?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dot}`}
            />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
      <div className={`mt-2 font-mono text-3xl font-bold tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}

function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active
                ? "bg-amber-500/20 text-amber-200"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const cfg = SEVERITY_CONFIG[alert.severity];
  return (
    <li
      className={`group border-b border-white/5 px-4 py-3 transition-colors last:border-b-0 ${alert.acknowledged ? "" : "hover:bg-white/[0.03]"}`}
    >
      <div className="flex items-start gap-3">
        {/* Severity badge */}
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ring-1 ${cfg.bg} ${cfg.ring}`}
        >
          <span className={`text-base ${cfg.color}`}>{cfg.icon}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}
            >
              {cfg.label}
            </span>
            <span className="text-[10px] text-slate-600">·</span>
            <span className="font-mono text-[10px] text-slate-500">
              {alert.source}
            </span>
            <span className="ml-auto font-mono text-[10px] text-slate-500">
              {alert.timestamp}
            </span>
          </div>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-100">
            {alert.title}
          </h3>
          {alert.detail && (
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
              {alert.detail}
            </p>
          )}
          {alert.acknowledged && (
            <div className="mt-1.5 text-[10px] text-slate-500">
              ✓ Reconocida por{" "}
              <span className="text-slate-400">{alert.ackBy}</span> el{" "}
              <span className="font-mono text-slate-400">{alert.ackAt}</span>
            </div>
          )}
        </div>

        {/* Acknowledge button */}
        {!alert.acknowledged && (
          <button className="flex-shrink-0 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-amber-400/40 hover:bg-amber-500/15 hover:text-amber-200">
            Reconocer
          </button>
        )}
      </div>
    </li>
  );
}
