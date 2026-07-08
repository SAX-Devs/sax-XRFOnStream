"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SpectrumPoint {
  channel: number;
  counts: number;
}

interface SpectrumChartProps {
  data: SpectrumPoint[];
  height?: number;
}

/**
 * XRF spectrum chart (counts vs MCA channel).
 *
 * Element peak labels were removed on purpose: the previous markers were
 * demo-era decorations with an invented channel→energy calibration that pile
 * up unreadably on real 8192-channel spectra AND point at wrong positions.
 * They return when SAX provides the real MCA calibration (channel→keV) and the
 * lines of interest (the equipment's line_lib holds the real energies).
 *
 * Rendering: real spectra have 8192 channels; the chart max-pools them down to
 * ~2048 points (keeping each bucket's peak, so peak heights are preserved).
 */
export function SpectrumChart({ data, height = 320 }: SpectrumChartProps) {
  const channels = data.length;

  const plotData = useMemo(() => {
    if (data.length <= 2048) return data;
    const bucket = Math.ceil(data.length / 2048);
    const out: SpectrumPoint[] = [];
    for (let i = 0; i < data.length; i += bucket) {
      let best = data[i];
      const end = Math.min(i + bucket, data.length);
      for (let j = i + 1; j < end; j++) {
        if (data[j].counts > best.counts) best = data[j];
      }
      out.push(best);
    }
    return out;
  }, [data]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            Espectro XRF
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Cuentas vs canal MCA
          </p>
        </div>
        <div className="text-[11px] text-slate-500">
          <span className="font-mono text-slate-300">
            {channels.toLocaleString()}
          </span>{" "}
          canales
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={plotData}
          margin={{ top: 12, right: 16, left: 8, bottom: 28 }}
        >
          <defs>
            <linearGradient id="spectrumGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.75} />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#7c2d12" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke="#1e293b"
            strokeOpacity={0.6}
            strokeDasharray="2 3"
          />

          <XAxis
            dataKey="channel"
            stroke="#334155"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={{ stroke: "#475569" }}
            axisLine={{ stroke: "#334155" }}
            label={{
              value: "Canal MCA",
              fill: "#64748b",
              fontSize: 11,
              position: "insideBottom",
              offset: -10,
            }}
          />
          <YAxis
            stroke="#334155"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={{ stroke: "#475569" }}
            axisLine={{ stroke: "#334155" }}
            width={58}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v)
            }
            label={{
              value: "Cuentas",
              fill: "#64748b",
              fontSize: 11,
              angle: -90,
              position: "insideLeft",
              offset: -2,
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
            itemStyle={{ color: "#fbbf24" }}
            formatter={(value) => [
              typeof value === "number" ? value.toLocaleString() : String(value),
              "cuentas",
            ]}
            labelFormatter={(label) => `Canal ${label}`}
          />

          <Area
            type="monotone"
            dataKey="counts"
            stroke="#fbbf24"
            strokeWidth={1.5}
            fill="url(#spectrumGradient)"
            isAnimationActive={true}
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
