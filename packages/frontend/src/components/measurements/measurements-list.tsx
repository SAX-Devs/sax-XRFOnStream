"use client";

export interface Measurement {
  id: string;
  timestamp: string;
  durationSec: number;
  measurementId: string;
  triggers: number;
  livetimeSec: number;
}

interface MeasurementsListProps {
  measurements: Measurement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function MeasurementsList({
  measurements,
  selectedId,
  onSelect,
}: MeasurementsListProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          Historial de Mediciones
        </h2>
        <span className="font-mono text-[10px] text-slate-500">
          {measurements.length}
        </span>
      </div>

      <ul className="max-h-[480px] overflow-y-auto">
        {measurements.map((m) => {
          const isSelected = m.id === selectedId;
          return (
            <li key={m.id}>
              <button
                onClick={() => onSelect(m.id)}
                className={`group w-full border-b border-white/5 px-3 py-2.5 text-left transition-colors ${
                  isSelected
                    ? "border-l-2 border-l-amber-500 bg-amber-500/8"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      isSelected ? "text-amber-300" : "text-slate-300"
                    }`}
                  >
                    {m.measurementId}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {m.durationSec.toFixed(1)}s
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {m.timestamp}
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500">
                  <span>
                    <span className="text-slate-300">
                      {m.triggers.toLocaleString()}
                    </span>{" "}
                    triggers
                  </span>
                  <span>
                    livetime{" "}
                    <span className="text-slate-300">
                      {m.livetimeSec.toFixed(2)}s
                    </span>
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
