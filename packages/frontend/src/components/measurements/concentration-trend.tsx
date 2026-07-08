"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useConcentrationHistory } from "@/hooks/use-concentration-history";

const RANGES = [
  { label: "24h", hours: 24 },
  { label: "3d", hours: 72 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
];

const ELEMENT_LABEL: Record<string, string> = { I: "Yodo (I)" };

// Fixed series order/colors, never cycled. Single series today (iodine, cyan —
// contrast vs the dark surface validated ≥3:1); future elements take the next
// slots and a legend appears automatically.
const SERIES_COLORS = ["#22d3ee", "#fbbf24", "#a78bfa", "#34d399"];

function timeAgo(t: number): string {
  const mins = Math.floor((Date.now() - t) / 60_000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function ConcentrationTrend({ deviceId }: { deviceId: string }) {
  const [hours, setHours] = useState(24);
  const { points, loading } = useConcentrationHistory(deviceId, hours);

  const elements = useMemo(() => {
    const keys = new Set<string>();
    for (const p of points) for (const k of Object.keys(p.values)) keys.add(k);
    return Array.from(keys).sort();
  }, [points]);

  const data = useMemo(
    () => points.map((p) => ({ t: p.t, ...p.values })),
    [points]
  );

  const primary = elements[0];
  const stats = useMemo(() => {
    if (!primary || points.length === 0) return null;
    const vals = points
      .map((p) => p.values[primary])
      .filter((v): v is number => Number.isFinite(v));
    if (vals.length === 0) return null;
    const last = points[points.length - 1];
    return {
      last: last.values[primary],
      lastT: last.t,
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  }, [points, primary]);

  const yDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    if (!stats) return ["auto", "auto"];
    const span = Math.max(stats.max - stats.min, 0.01);
    return [stats.min - span * 0.15, stats.max + span * 0.15];
  }, [stats]);

  const fmtTick = (t: number) => {
    const d = new Date(t);
    const time = d.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    if (hours <= 24) return time;
    const day = d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
    return `${day} ${time}`;
  };

  const title =
    elements.length <= 1
      ? `Concentración · ${ELEMENT_LABEL[primary ?? "I"] ?? primary ?? "Yodo (I)"}`
      : "Concentraciones";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-md">
      {/* Header: title + range chips + count */}
      <div className="mb-3 flex items-center gap-3 border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            {title}
          </h2>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.hours}
              onClick={() => setHours(r.hours)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                hours === r.hours
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[10px] text-slate-500">
          {loading ? "cargando…" : `${points.length} análisis`}
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">
          Cargando análisis…
        </div>
      ) : !stats ? (
        <div className="py-12 text-center text-sm text-slate-500">
          Sin análisis en este rango
        </div>
      ) : (
        <div className="flex items-stretch gap-4">
          {/* Hero: last measured concentration + range stats */}
          <div className="flex w-44 flex-shrink-0 flex-col justify-between">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Última concentración
              </div>
              <div className="mt-1 font-mono text-[26px] font-bold leading-none text-slate-100 tabular-nums">
                {stats.last.toFixed(3)}
                <span className="ml-1 text-[11px] font-medium text-slate-500">
                  g/L
                </span>
              </div>
              <div className="mt-1.5 text-[10px] text-slate-500">
                {timeAgo(stats.lastT)}
              </div>
            </div>
            <div className="mt-2 space-y-1 px-1">
              {(
                [
                  ["Promedio", stats.avg],
                  ["Mínimo", stats.min],
                  ["Máximo", stats.max],
                ] as const
              ).map(([label, v]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between text-[11px]"
                >
                  <span className="text-slate-500">{label}</span>
                  <span className="font-mono font-semibold text-slate-300 tabular-nums">
                    {v.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Trend chart */}
          <div className="min-w-0 flex-1">
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="concGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#1e293b"
                  strokeOpacity={0.6}
                  strokeDasharray="2 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={fmtTick}
                  stroke="#334155"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickLine={{ stroke: "#475569" }}
                  axisLine={{ stroke: "#334155" }}
                  minTickGap={40}
                />
                <YAxis
                  domain={yDomain}
                  stroke="#334155"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickLine={{ stroke: "#475569" }}
                  axisLine={{ stroke: "#334155" }}
                  tickFormatter={(v: number) => v.toFixed(3)}
                  width={52}
                  label={{
                    value: "g/L",
                    fill: "#64748b",
                    fontSize: 10,
                    angle: -90,
                    position: "insideLeft",
                    offset: 8,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
                  formatter={(value: number | string, name: string) => [
                    `${Number(value).toFixed(4)} g/L`,
                    ELEMENT_LABEL[name] ?? name,
                  ]}
                  labelFormatter={(t: number) =>
                    new Date(t).toLocaleString("es-CL", { hour12: false })
                  }
                />
                {elements.map((el, i) => (
                  <Area
                    key={el}
                    type="monotone"
                    dataKey={el}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2}
                    fill={i === 0 ? "url(#concGradient)" : "none"}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            {elements.length >= 2 && (
              <div className="mt-1 flex gap-4 px-2">
                {elements.map((el, i) => (
                  <span key={el} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span
                      className="h-1.5 w-3 rounded-full"
                      style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                    />
                    {ELEMENT_LABEL[el] ?? el}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
