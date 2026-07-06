"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Measurement } from "@/components/measurements/measurements-list";

export interface SpectrumPoint {
  channel: number;
  counts: number;
}

/** Local YYYY-MM-DD for a Date (the user's timezone defines the "day"). */
export function localDayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

/** Read the first numeric value among candidate keys (tolerant to naming and
 * to numbers arriving as strings — the equipment publishes Decimals as text). */
function runField(run: Record<string, unknown> | null, ...keys: string[]): number {
  if (!run) return 0;
  for (const k of keys) {
    const raw = run[k];
    if (raw === undefined || raw === null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** Normalize spectra_data into chart points ({spectrum:[...]}, {channels,intensities} or flat array). */
function toSpectrum(data: unknown): SpectrumPoint[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((c, i) => ({ channel: i, counts: Number(c) || 0 }));
  }
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.spectrum)) {
      return (o.spectrum as unknown[]).map((c, i) => ({
        channel: i,
        counts: Number(c) || 0,
      }));
    }
    if (Array.isArray(o.channels) && Array.isArray(o.intensities)) {
      const ch = o.channels as unknown[];
      const inten = o.intensities as unknown[];
      return ch.map((c, i) => ({
        channel: Number(c) || i,
        counts: Number(inten[i]) || 0,
      }));
    }
  }
  return [];
}

interface SpectraMetaRow {
  id: number;
  measurement_id: string | null;
  run_data: Record<string, unknown> | null;
  device_ts: string;
}

interface ConcRow {
  measurement_id: string | null;
  elements: Record<string, unknown> | null;
}

/**
 * Metadata-only list of a device's measurements for ONE local day, plus their
 * quantified concentrations. The heavy spectrum arrays are deliberately NOT
 * fetched here (a day is ~150 acquisitions of 8192 channels — several MB);
 * useSpectrum() loads the selected one on demand. Today's list auto-refreshes
 * every 60s (a new acquisition lands every few minutes).
 */
export function useMeasurementsList(deviceId: string, day: string) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [concentrationsById, setConcentrationsById] = useState<
    Record<string, Record<string, number>>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    setLoading(true);

    const start = new Date(`${day}T00:00:00`);
    const end = new Date(start.getTime() + 24 * 3600 * 1000);

    async function fetchDay() {
      const [spectraRes, concRes] = await Promise.all([
        supabase
          .from("device_spectra")
          .select("id, measurement_id, run_data, device_ts")
          .eq("device_id", deviceId)
          .gte("device_ts", start.toISOString())
          .lt("device_ts", end.toISOString())
          .order("device_ts", { ascending: false })
          .limit(400),
        supabase
          .from("device_concentrations")
          .select("measurement_id, elements")
          .eq("device_id", deviceId)
          .gte("device_ts", start.toISOString())
          .lt("device_ts", end.toISOString())
          .limit(400),
      ]);

      if (!active) return;

      const spectra = (spectraRes.data ?? []) as SpectraMetaRow[];
      const conc = (concRes.data ?? []) as ConcRow[];

      const concByMeasurement: Record<string, Record<string, number>> = {};
      for (const c of conc) {
        if (c.measurement_id && !concByMeasurement[c.measurement_id]) {
          const coerced: Record<string, number> = {};
          for (const [el, val] of Object.entries(c.elements ?? {})) {
            const n = Number(val);
            if (Number.isFinite(n)) coerced[el] = n;
          }
          concByMeasurement[c.measurement_id] = coerced;
        }
      }

      const list: Measurement[] = [];
      const byId: Record<string, Record<string, number>> = {};
      for (const row of spectra) {
        const key = String(row.id);
        list.push({
          id: key,
          measurementId: row.measurement_id ?? key,
          timestamp: formatTs(row.device_ts),
          durationSec: runField(row.run_data, "runtime", "real_time_s"),
          livetimeSec: runField(row.run_data, "livetime", "live_time_s"),
          triggers: runField(row.run_data, "triggers", "events_in_run"),
        });
        byId[key] = row.measurement_id
          ? (concByMeasurement[row.measurement_id] ?? {})
          : {};
      }

      setMeasurements(list);
      setConcentrationsById(byId);
      setLoading(false);
    }

    fetchDay();

    const isToday = day === localDayString(new Date());
    const poll = isToday ? setInterval(fetchDay, 60_000) : undefined;

    return () => {
      active = false;
      if (poll) clearInterval(poll);
    };
  }, [deviceId, day]);

  return { measurements, concentrationsById, loading };
}

interface SpectrumState {
  spectrum: SpectrumPoint[];
  loading: boolean;
  /** Spectrum lives in Storage and wasn't loaded inline (deferred loader pending). */
  inStorageOnly: boolean;
}

/** Loads the full spectrum for ONE measurement on demand, with an in-memory cache. */
export function useSpectrum(spectraRowId: string | null): SpectrumState {
  const [state, setState] = useState<SpectrumState>({
    spectrum: [],
    loading: false,
    inStorageOnly: false,
  });
  const cacheRef = useRef<
    Map<string, { spectrum: SpectrumPoint[]; inStorageOnly: boolean }>
  >(new Map());

  useEffect(() => {
    if (!spectraRowId) {
      setState({ spectrum: [], loading: false, inStorageOnly: false });
      return;
    }

    const cached = cacheRef.current.get(spectraRowId);
    if (cached) {
      setState({ ...cached, loading: false });
      return;
    }

    const supabase = createClient();
    let active = true;
    setState({ spectrum: [], loading: true, inStorageOnly: false });

    (async () => {
      const { data } = await supabase
        .from("device_spectra")
        .select("spectra_data, storage_path")
        .eq("id", Number(spectraRowId))
        .maybeSingle();

      if (!active) return;
      const spectrum = toSpectrum(data?.spectra_data);
      const result = {
        spectrum,
        inStorageOnly: spectrum.length === 0 && Boolean(data?.storage_path),
      };
      cacheRef.current.set(spectraRowId, result);
      setState({ ...result, loading: false });
    })();

    return () => {
      active = false;
    };
  }, [spectraRowId]);

  return state;
}
