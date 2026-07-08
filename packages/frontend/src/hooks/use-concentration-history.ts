"use client";

import { useState, useEffect, useId } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ConcentrationPoint {
  /** Epoch millis of the measurement. */
  t: number;
  /** g/L per element, e.g. { I: 0.578 }. */
  values: Record<string, number>;
}

interface ConcRow {
  elements: Record<string, unknown> | null;
  device_ts: string;
}

function toPoint(row: ConcRow): ConcentrationPoint | null {
  const t = new Date(row.device_ts).getTime();
  if (!Number.isFinite(t)) return null;
  const values: Record<string, number> = {};
  for (const [el, val] of Object.entries(row.elements ?? {})) {
    const n = Number(val);
    if (Number.isFinite(n)) values[el] = n;
  }
  return Object.keys(values).length > 0 ? { t, values } : null;
}

/** Max-resolution points to hand to the chart; beyond this we bucket-average. */
const MAX_POINTS = 1200;

function downsample(points: ConcentrationPoint[]): ConcentrationPoint[] {
  if (points.length <= MAX_POINTS) return points;
  const bucket = Math.ceil(points.length / MAX_POINTS);
  const out: ConcentrationPoint[] = [];
  for (let i = 0; i < points.length; i += bucket) {
    const slice = points.slice(i, i + bucket);
    const sums: Record<string, { total: number; n: number }> = {};
    for (const p of slice) {
      for (const [el, v] of Object.entries(p.values)) {
        (sums[el] ??= { total: 0, n: 0 }).total += v;
        sums[el].n += 1;
      }
    }
    const values: Record<string, number> = {};
    for (const [el, s] of Object.entries(sums)) values[el] = s.total / s.n;
    out.push({ t: slice[Math.floor(slice.length / 2)].t, values });
  }
  return out;
}

/**
 * Concentration analyses for a device over a rolling time window (hours),
 * oldest → newest. Live: Realtime INSERTs append instantly (publication 00018)
 * and a 60s poll acts as fallback. Volume is small (~150 analyses/day); ranges
 * beyond MAX_POINTS are bucket-averaged for the chart.
 */
export function useConcentrationHistory(deviceId: string, hours: number) {
  const channelId = useId();
  const [points, setPoints] = useState<ConcentrationPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    setLoading(true);

    async function fetchRange() {
      const since = new Date(Date.now() - hours * 3600_000).toISOString();
      const { data } = await supabase
        .from("device_concentrations")
        .select("elements, device_ts")
        .eq("device_id", deviceId)
        .gte("device_ts", since)
        .order("device_ts", { ascending: true })
        .limit(6000);

      if (!active) return;
      const pts = ((data ?? []) as ConcRow[])
        .map(toPoint)
        .filter((p): p is ConcentrationPoint => p !== null);
      setPoints(downsample(pts));
      setLoading(false);
    }

    fetchRange();

    const channel = supabase
      .channel(`conc-history:${deviceId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "device_concentrations",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          const p = toPoint(payload.new as ConcRow);
          if (p) setPoints((prev) => [...prev, p].sort((a, b) => a.t - b.t));
        }
      )
      .subscribe();

    const poll = setInterval(fetchRange, 60_000);

    return () => {
      active = false;
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [deviceId, hours, channelId]);

  return { points, loading };
}
