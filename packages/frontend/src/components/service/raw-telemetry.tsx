"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Raw telemetry panel — every field of the selected module's *_status row,
 * verbatim, refreshed with the 3s poll. This is the technician's evidence
 * panel: when an action executes, the affected field FLASHES as it changes,
 * so cause and effect sit side by side without leaving the screen.
 */

interface RawTelemetryProps {
  moduleTitle: string;
  data: Record<string, unknown> | null;
  lastUpdated: Date | null;
}

/** Fields that are metadata of the row, not process signals. */
const HIDDEN_FIELDS = new Set(["index", "ts"]);

function formatValue(v: unknown): { text: string; kind: "bool-on" | "bool-off" | "num" | "str" } {
  if (typeof v === "boolean") {
    return { text: v ? "true" : "false", kind: v ? "bool-on" : "bool-off" };
  }
  if (v === null || v === undefined) return { text: "—", kind: "str" };
  const n = Number(v);
  if (typeof v !== "string" || v.trim() !== "") {
    if (Number.isFinite(n) && String(v).trim() !== "") {
      // Trim runaway decimals but keep the value raw-looking.
      const text = Number.isInteger(n) ? String(n) : n.toFixed(Math.min(4, (String(v).split(".")[1] ?? "").length));
      return { text, kind: "num" };
    }
  }
  return { text: String(v), kind: "str" };
}

function ageLabel(lastUpdated: Date | null, now: number): string {
  if (!lastUpdated) return "sin datos";
  const s = Math.max(0, Math.floor((now - lastUpdated.getTime()) / 1000));
  if (s < 60) return `hace ${s}s`;
  return `hace ${Math.floor(s / 60)}min`;
}

export function RawTelemetry({ moduleTitle, data, lastUpdated }: RawTelemetryProps) {
  // Flash bookkeeping: field -> timestamp of its last observed change.
  const prevRef = useRef<Record<string, unknown>>({});
  const prevModuleRef = useRef<string>(moduleTitle);
  const [flashes, setFlashes] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    // Switching modules must not read as "everything changed".
    if (prevModuleRef.current !== moduleTitle) {
      prevModuleRef.current = moduleTitle;
      prevRef.current = data ?? {};
      setFlashes({});
      return;
    }
    if (!data) return;
    const prev = prevRef.current;
    const now = Date.now();
    const changed: Record<string, number> = {};
    for (const [k, v] of Object.entries(data)) {
      if (HIDDEN_FIELDS.has(k)) continue;
      if (k in prev && String(prev[k]) !== String(v)) changed[k] = now;
    }
    prevRef.current = data;
    if (Object.keys(changed).length > 0) {
      setFlashes((f) => ({ ...f, ...changed }));
    }
  }, [data, moduleTitle]);

  // Re-render every second so flashes fade and the freshness label ages.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const rows = data
    ? Object.entries(data)
        .filter(([k]) => !HIDDEN_FIELDS.has(k))
        .sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          Telemetría cruda
        </h2>
        <span className="font-mono text-[10px] text-slate-500">
          {ageLabel(lastUpdated, now)}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-slate-500">
          Sin telemetría de {moduleTitle}
        </div>
      ) : (
        <div className="max-h-[46vh] overflow-y-auto overscroll-contain px-1.5 py-1.5 [scrollbar-color:rgba(148,163,184,0.3)_transparent] [scrollbar-width:thin]">
          {rows.map(([key, value]) => {
            const { text, kind } = formatValue(value);
            const flashed = flashes[key] && now - flashes[key] < 2_000;
            return (
              <div
                key={key}
                className={`flex items-baseline justify-between gap-3 rounded-md px-2 py-[3px] transition-colors duration-700 ${
                  flashed ? "bg-cyan-400/15" : "bg-transparent"
                }`}
              >
                <span className="truncate font-mono text-[10.5px] text-slate-500">
                  {key}
                </span>
                <span
                  className={`shrink-0 font-mono text-[11px] tabular-nums ${
                    kind === "bool-on"
                      ? "font-semibold text-cyan-300"
                      : kind === "bool-off"
                        ? "text-slate-500"
                        : "text-slate-200"
                  }`}
                >
                  {text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
