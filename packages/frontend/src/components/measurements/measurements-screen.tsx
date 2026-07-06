"use client";

import { useEffect, useState } from "react";
import { SpectrumChart } from "./spectrum-chart";
import { MeasurementsList } from "./measurements-list";
import { ConcentrationTable } from "./concentration-table";
import {
  useMeasurementsList,
  useSpectrum,
  localDayString,
} from "@/hooks/use-measurements";

export function MeasurementsScreen({ deviceId }: { deviceId: string }) {
  const today = localDayString(new Date());
  const yesterday = localDayString(new Date(Date.now() - 86_400_000));
  const [day, setDay] = useState(today);

  const { measurements, concentrationsById, loading } = useMeasurementsList(
    deviceId,
    day
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { spectrum, loading: spectrumLoading, inStorageOnly } =
    useSpectrum(selectedId);

  // Default the selection to the most recent measurement of the loaded day.
  useEffect(() => {
    if (measurements.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!measurements.some((m) => m.id === selectedId)) {
      setSelectedId(measurements[0].id);
    }
  }, [measurements, selectedId]);

  const selected = measurements.find((m) => m.id === selectedId) ?? null;
  const concentrations = selectedId
    ? (concentrationsById[selectedId] ?? {})
    : {};

  return (
    <div className="space-y-3">
      {/* Date filter */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-2.5 backdrop-blur-md">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Fecha:
        </span>
        <div className="flex gap-1">
          <DayChip label="Hoy" active={day === today} onClick={() => setDay(today)} />
          <DayChip
            label="Ayer"
            active={day === yesterday}
            onClick={() => setDay(yesterday)}
          />
        </div>
        <input
          type="date"
          value={day}
          max={today}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-slate-300 outline-none [color-scheme:dark] hover:border-white/20"
        />
        <span className="ml-auto font-mono text-[10px] text-slate-500">
          {loading ? "cargando…" : `${measurements.length} mediciones`}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-black/60 py-16 text-sm text-slate-500 backdrop-blur-md">
          Cargando mediciones…
        </div>
      ) : measurements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/60 py-16 text-center backdrop-blur-md">
          <span className="text-3xl text-slate-700">○</span>
          <p className="mt-2 text-sm text-slate-500">
            No hay mediciones el {day}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-3 items-start">
          {/* Left: Measurements list */}
          <MeasurementsList
            measurements={measurements}
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

            {spectrumLoading ? (
              <div className="rounded-2xl border border-white/10 bg-black/60 px-5 py-10 text-center text-sm text-slate-500 backdrop-blur-md">
                Cargando espectro…
              </div>
            ) : spectrum.length > 0 ? (
              <SpectrumChart data={spectrum} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/60 px-5 py-10 text-center text-sm text-slate-500 backdrop-blur-md">
                {inStorageOnly
                  ? "Espectro almacenado en Storage (carga diferida — pendiente)"
                  : "Sin datos de espectro para esta medición"}
              </div>
            )}

            {Object.keys(concentrations).length > 0 ? (
              <ConcentrationTable elements={concentrations} unit="g/L" />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-4 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Concentraciones Cuantificadas
                  </h2>
                  <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Próximamente
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DayChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "bg-amber-500/20 text-amber-200"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
