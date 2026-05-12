"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface SpectrumPoint {
  channel: number;
  counts: number;
}

interface ElementPeak {
  element: string;
  channel: number;
  energyKeV: number;
}

// Characteristic X-ray emission energies (Kα lines) for common process elements.
// Channel ≈ energy_keV * 100 (typical MCA calibration for our XRF setup).
const ELEMENT_PEAKS: (ElementPeak & { amplitude: number })[] = [
  { element: "Si", channel: 174, energyKeV: 1.74, amplitude: 1500 },
  { element: "S", channel: 230, energyKeV: 2.31, amplitude: 1200 },
  { element: "Ca", channel: 369, energyKeV: 3.69, amplitude: 2800 },
  { element: "Fe", channel: 640, energyKeV: 6.4, amplitude: 4500 },
  { element: "Cu", channel: 805, energyKeV: 8.05, amplitude: 3200 },
  { element: "Zn", channel: 864, energyKeV: 8.64, amplitude: 2100 },
  { element: "Pb", channel: 1055, energyKeV: 10.55, amplitude: 1800 },
];

/**
 * Generates a realistic-looking XRF spectrum with bremsstrahlung continuum
 * + Gaussian peaks at characteristic element energies + small Poisson-like noise.
 * Used as the default sample data for the demo.
 */
function generateSampleSpectrum(): SpectrumPoint[] {
  const data: SpectrumPoint[] = [];
  const sigma = 9;

  for (let ch = 0; ch < 1400; ch += 3) {
    // Bremsstrahlung continuum (decreasing exponential)
    let counts = 80 + 220 * Math.exp(-ch / 720);

    // Add Gaussian peaks for each element
    for (const peak of ELEMENT_PEAKS) {
      counts +=
        peak.amplitude *
        Math.exp(-Math.pow(ch - peak.channel, 2) / (2 * sigma * sigma));
    }

    // Sprinkle a touch of stochastic noise
    counts += (Math.random() - 0.5) * 60;
    data.push({ channel: ch, counts: Math.max(0, Math.round(counts)) });
  }

  return data;
}

interface SpectrumChartProps {
  data?: SpectrumPoint[];
  height?: number;
  showPeakLabels?: boolean;
}

export function SpectrumChart({
  data,
  height = 320,
  showPeakLabels = true,
}: SpectrumChartProps) {
  const spectrumData = data ?? generateSampleSpectrum();

  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            Espectro XRF
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Cuentas vs canal MCA (energía en keV)
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <span>
            <span className="font-mono text-slate-300">
              {spectrumData.length}
            </span>{" "}
            canales
          </span>
          <span>
            <span className="font-mono text-slate-300">
              {ELEMENT_PEAKS.length}
            </span>{" "}
            picos identificados
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={spectrumData}
          margin={{ top: 24, right: 16, left: 8, bottom: 28 }}
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
            label={{
              value: "Cuentas",
              fill: "#64748b",
              fontSize: 11,
              angle: -90,
              position: "insideLeft",
              offset: 16,
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

          {showPeakLabels &&
            ELEMENT_PEAKS.map((peak) => (
              <ReferenceLine
                key={peak.element}
                x={peak.channel}
                stroke="#475569"
                strokeDasharray="2 3"
                strokeOpacity={0.5}
                label={{
                  value: peak.element,
                  position: "top",
                  fill: "#fbbf24",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
            ))}

          <Area
            type="monotone"
            dataKey="counts"
            stroke="#fbbf24"
            strokeWidth={1.5}
            fill="url(#spectrumGradient)"
            isAnimationActive={true}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
