"use client";

import { useMemo, useState } from "react";
import { useAlerts, type AlertRecord, type AlertSeverity } from "@/hooks/use-alerts";

type FilterState = "all" | "active" | "acknowledged";

const SEVERITY_CONFIG: Record<
  AlertSeverity,
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

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** The alert detail column is JSONB — render a message field, a plain string, or fall back to compact JSON. */
function renderDetail(detail: unknown): string | null {
  if (detail == null) return null;
  if (typeof detail === "string") return detail;
  if (typeof detail === "object") {
    const obj = detail as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    return JSON.stringify(detail);
  }
  return String(detail);
}

export function AlertsScreen({ deviceId }: { deviceId: string }) {
  const { alerts, loading, acknowledge } = useAlerts(deviceId);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">(
    "all"
  );
  const [stateFilter, setStateFilter] = useState<FilterState>("all");

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      const acknowledged = a.ack_at !== null;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (stateFilter === "active" && acknowledged) return false;
      if (stateFilter === "acknowledged" && !acknowledged) return false;
      return true;
    });
  }, [alerts, severityFilter, stateFilter]);

  const counts = useMemo(() => {
    return {
      total: alerts.length,
      active: alerts.filter((a) => a.ack_at === null).length,
      critical: alerts.filter(
        (a) =>
          a.ack_at === null &&
          (a.severity === "critical" || a.severity === "emergency")
      ).length,
    };
  }, [alerts]);

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
          onChange={(v) => setSeverityFilter(v as AlertSeverity | "all")}
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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-sm text-slate-500">Cargando alertas…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-3xl text-slate-700">○</span>
            <p className="mt-2 text-sm text-slate-500">
              {alerts.length === 0
                ? "No hay alertas para este equipo"
                : "No hay alertas con estos filtros"}
            </p>
          </div>
        ) : (
          <ul>
            {filtered.map((alert) => (
              <AlertRow key={alert.id} alert={alert} onAck={acknowledge} />
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

function AlertRow({
  alert,
  onAck,
}: {
  alert: AlertRecord;
  onAck: (id: number) => void;
}) {
  const cfg = SEVERITY_CONFIG[alert.severity];
  const acknowledged = alert.ack_at !== null;
  const detail = renderDetail(alert.detail);
  return (
    <li
      className={`group border-b border-white/5 px-4 py-3 transition-colors last:border-b-0 ${acknowledged ? "" : "hover:bg-white/[0.03]"}`}
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
              {formatTs(alert.device_ts)}
            </span>
          </div>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-100">
            {alert.title}
          </h3>
          {detail && (
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
              {detail}
            </p>
          )}
          {acknowledged && (
            <div className="mt-1.5 text-[10px] text-slate-500">
              ✓ Reconocida el{" "}
              <span className="font-mono text-slate-400">
                {formatTs(alert.ack_at as string)}
              </span>
            </div>
          )}
        </div>

        {/* Acknowledge button */}
        {!acknowledged && (
          <button
            onClick={() => onAck(alert.id)}
            className="flex-shrink-0 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-amber-400/40 hover:bg-amber-500/15 hover:text-amber-200"
          >
            Reconocer
          </button>
        )}
      </div>
    </li>
  );
}
