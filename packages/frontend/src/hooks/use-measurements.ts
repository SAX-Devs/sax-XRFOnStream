"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Measurement } from "@/components/measurements/measurements-list";

export interface SpectrumPoint {
  channel: number;
  counts: number;
}

export interface MeasurementDetail {
  spectrum: SpectrumPoint[];
  concentrations: Record<string, number>;
  /** True when the spectrum lives in Storage and wasn't loaded inline. */
  inStorageOnly: boolean;
}

interface SpectraRow {
  id: number;
  measurement_id: string | null;
  spectra_data: unknown;
  run_data: Record<string, unknown> | null;
  storage_path: string | null;
  device_ts: string;
}

interface ConcRow {
  measurement_id: string | null;
  elements: Record<string, number>;
}

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

/** Read the first numeric value among candidate keys (tolerant to schema naming). */
function runField(run: Record<string, unknown> | null, ...keys: string[]): number {
  if (!run) return 0;
  for (const k of keys) {
    if (typeof run[k] === "number") return run[k] as number;
  }
  return 0;
}

/**
 * Normalize spectra_data into chart points. Tolerates the shapes we may receive:
 * { channels, intensities } (parallel arrays), { spectrum: number[] }, or a flat
 * number[]. Returns [] when the spectrum is null (e.g. offloaded to Storage).
 */
function toSpectrum(data: unknown): SpectrumPoint[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((c, i) => ({ channel: i, counts: Number(c) || 0 }));
  }
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.channels) && Array.isArray(o.intensities)) {
      const ch = o.channels as unknown[];
      const inten = o.intensities as unknown[];
      return ch.map((c, i) => ({
        channel: Number(c) || i,
        counts: Number(inten[i]) || 0,
      }));
    }
    if (Array.isArray(o.spectrum)) {
      return (o.spectrum as unknown[]).map((c, i) => ({
        channel: i,
        counts: Number(c) || 0,
      }));
    }
  }
  return [];
}

/**
 * Loads a device's measurements (device_spectra) plus their quantified elements
 * (device_concentrations), matched by measurement_id. Field names in run_data
 * are read with fallbacks since the equipment spectra payload hasn't been
 * confirmed against a real sample yet (INT-2 follow-up).
 */
export function useMeasurements(deviceId: string) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [detailById, setDetailById] = useState<Record<string, MeasurementDetail>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function fetchAll() {
      const [spectraRes, concRes] = await Promise.all([
        supabase
          .from("device_spectra")
          .select("id, measurement_id, spectra_data, run_data, storage_path, device_ts")
          .eq("device_id", deviceId)
          .order("device_ts", { ascending: false })
          .limit(50),
        supabase
          .from("device_concentrations")
          .select("measurement_id, elements")
          .eq("device_id", deviceId)
          .order("device_ts", { ascending: false })
          .limit(50),
      ]);

      if (!active) return;

      const spectra = (spectraRes.data ?? []) as SpectraRow[];
      const conc = (concRes.data ?? []) as ConcRow[];

      const concByMeasurement: Record<string, Record<string, number>> = {};
      for (const c of conc) {
        if (c.measurement_id && !concByMeasurement[c.measurement_id]) {
          concByMeasurement[c.measurement_id] = c.elements ?? {};
        }
      }

      const list: Measurement[] = [];
      const details: Record<string, MeasurementDetail> = {};

      for (const row of spectra) {
        const key = String(row.id);
        const measurementId =
          row.measurement_id ??
          (typeof row.run_data?.sample_id === "string"
            ? (row.run_data.sample_id as string)
            : key);

        list.push({
          id: key,
          measurementId,
          timestamp: formatTs(row.device_ts),
          durationSec: runField(row.run_data, "real_time_s", "runtime", "live_time_s"),
          livetimeSec: runField(row.run_data, "live_time_s", "livetime"),
          triggers: runField(row.run_data, "triggers", "events_in_run"),
        });

        const spectrum = toSpectrum(row.spectra_data);
        details[key] = {
          spectrum,
          concentrations: row.measurement_id
            ? concByMeasurement[row.measurement_id] ?? {}
            : {},
          inStorageOnly: spectrum.length === 0 && Boolean(row.storage_path),
        };
      }

      setMeasurements(list);
      setDetailById(details);
      setLoading(false);
    }

    fetchAll();
    return () => {
      active = false;
    };
  }, [deviceId]);

  return { measurements, detailById, loading };
}
