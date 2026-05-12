"use client";

import { useMemo, useState } from "react";
import { SpectrumChart } from "./spectrum-chart";
import { MeasurementsList, type Measurement } from "./measurements-list";
import { ConcentrationTable } from "./concentration-table";

// === Sample data (demo) ===

const SAMPLE_MEASUREMENTS: Measurement[] = [
  {
    id: "m-008",
    measurementId: "RUN-2026-04-28-008",
    timestamp: "2026-04-28 15:42:18",
    durationSec: 12.4,
    triggers: 48235,
    livetimeSec: 11.92,
  },
  {
    id: "m-007",
    measurementId: "RUN-2026-04-28-007",
    timestamp: "2026-04-28 15:30:05",
    durationSec: 12.5,
    triggers: 47890,
    livetimeSec: 11.95,
  },
  {
    id: "m-006",
    measurementId: "RUN-2026-04-28-006",
    timestamp: "2026-04-28 15:17:40",
    durationSec: 11.9,
    triggers: 46210,
    livetimeSec: 11.42,
  },
  {
    id: "m-005",
    measurementId: "RUN-2026-04-28-005",
    timestamp: "2026-04-28 15:05:13",
    durationSec: 12.6,
    triggers: 49180,
    livetimeSec: 12.05,
  },
  {
    id: "m-004",
    measurementId: "RUN-2026-04-28-004",
    timestamp: "2026-04-28 14:52:46",
    durationSec: 12.3,
    triggers: 47655,
    livetimeSec: 11.88,
  },
  {
    id: "m-003",
    measurementId: "RUN-2026-04-28-003",
    timestamp: "2026-04-28 14:40:12",
    durationSec: 12.4,
    triggers: 48020,
    livetimeSec: 11.93,
  },
  {
    id: "m-002",
    measurementId: "RUN-2026-04-28-002",
    timestamp: "2026-04-28 14:27:50",
    durationSec: 12.7,
    triggers: 49670,
    livetimeSec: 12.18,
  },
  {
    id: "m-001",
    measurementId: "RUN-2026-04-28-001",
    timestamp: "2026-04-28 14:15:24",
    durationSec: 12.5,
    triggers: 48400,
    livetimeSec: 12.0,
  },
];

const SAMPLE_CONCENTRATIONS: Record<string, Record<string, number>> = {
  "m-008": { Fe: 12.45, Cu: 3.21, Zn: 0.82, Pb: 0.156, Ca: 8.23, Si: 4.12, S: 2.07 },
  "m-007": { Fe: 12.38, Cu: 3.18, Zn: 0.79, Pb: 0.152, Ca: 8.18, Si: 4.08, S: 2.05 },
  "m-006": { Fe: 12.51, Cu: 3.24, Zn: 0.84, Pb: 0.161, Ca: 8.28, Si: 4.15, S: 2.09 },
  "m-005": { Fe: 12.42, Cu: 3.19, Zn: 0.81, Pb: 0.154, Ca: 8.21, Si: 4.10, S: 2.06 },
  "m-004": { Fe: 12.55, Cu: 3.27, Zn: 0.85, Pb: 0.162, Ca: 8.31, Si: 4.18, S: 2.11 },
  "m-003": { Fe: 12.39, Cu: 3.16, Zn: 0.78, Pb: 0.149, Ca: 8.15, Si: 4.05, S: 2.03 },
  "m-002": { Fe: 12.48, Cu: 3.22, Zn: 0.83, Pb: 0.158, Ca: 8.25, Si: 4.13, S: 2.08 },
  "m-001": { Fe: 12.44, Cu: 3.20, Zn: 0.80, Pb: 0.155, Ca: 8.22, Si: 4.11, S: 2.07 },
};

export function MeasurementsScreen() {
  const [selectedId, setSelectedId] = useState(SAMPLE_MEASUREMENTS[0].id);

  const selected = useMemo(
    () => SAMPLE_MEASUREMENTS.find((m) => m.id === selectedId),
    [selectedId]
  );

  const concentrations = SAMPLE_CONCENTRATIONS[selectedId] ?? {};

  return (
    <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-3 items-start">
      {/* Left: Measurements list */}
      <MeasurementsList
        measurements={SAMPLE_MEASUREMENTS}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* Right: Spectrum chart on top, concentration table below */}
      <div className="flex flex-col gap-3">
        {selected && (
          <div className="rounded-2xl border border-white/10 bg-black/60 px-5 py-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-mono text-sm font-bold text-amber-300">
                  {selected.measurementId}
                </h1>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {selected.timestamp}
                </p>
              </div>
              <div className="flex items-center gap-5 text-[11px]">
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">
                    Duración
                  </div>
                  <div className="font-mono font-semibold text-slate-200 tabular-nums">
                    {selected.durationSec.toFixed(1)}{" "}
                    <span className="text-slate-500 text-[10px]">s</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">
                    Livetime
                  </div>
                  <div className="font-mono font-semibold text-slate-200 tabular-nums">
                    {selected.livetimeSec.toFixed(2)}{" "}
                    <span className="text-slate-500 text-[10px]">s</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">
                    Triggers
                  </div>
                  <div className="font-mono font-semibold text-slate-200 tabular-nums">
                    {selected.triggers.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <SpectrumChart />

        <ConcentrationTable elements={concentrations} unit="g/L" />
      </div>
    </div>
  );
}
