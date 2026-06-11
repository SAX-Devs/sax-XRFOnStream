"use client";

import { useEffect, useState } from "react";
import { SpectrumChart } from "./spectrum-chart";
import { MeasurementsList } from "./measurements-list";
import { ConcentrationTable } from "./concentration-table";
import { useMeasurements } from "@/hooks/use-measurements";

export function MeasurementsScreen({ deviceId }: { deviceId: string }) {
  const { measurements, detailById, loading } = useMeasurements(deviceId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default the selection to the most recent measurement once data arrives,
  // and recover if the current selection falls out of the list.
  useEffect(() => {
    if (measurements.length === 0) return;
    const stillThere = measurements.some((m) => m.id === selectedId);
    if (!stillThere) setSelectedId(measurements[0].id);
  }, [measurements, selectedId]);

  const selected = measurements.find((m) => m.id === selectedId) ?? null;
  const detail = selectedId ? detailById[selectedId] : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-black/60 py-16 text-sm text-slate-500 backdrop-blur-md">
        Cargando mediciones…
      </div>
    );
  }

  if (measurements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/60 py-16 text-center backdrop-blur-md">
        <span className="text-3xl text-slate-700">○</span>
        <p className="mt-2 text-sm text-slate-500">
          No hay mediciones para este equipo
        </p>
      </div>
    );
  }

  return (
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

        {detail && detail.spectrum.length > 0 ? (
          <SpectrumChart data={detail.spectrum} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/60 px-5 py-10 text-center text-sm text-slate-500 backdrop-blur-md">
            {detail?.inStorageOnly
              ? "Espectro almacenado en Storage (carga diferida — pendiente)"
              : "Sin datos de espectro para esta medición"}
          </div>
        )}

        <ConcentrationTable elements={detail?.concentrations ?? {}} unit="g/L" />
      </div>
    </div>
  );
}
