"use client";

export type StatusLevel = "ok" | "warning" | "error";

interface StatusRowProps {
  label: string;
  status: StatusLevel;
  value?: string;
}

function StatusRow({ label, status, value }: StatusRowProps) {
  const dotClass = {
    ok: "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]",
    warning: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
    error: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]",
  }[status];

  const textClass = {
    ok: "text-emerald-400",
    warning: "text-amber-400",
    error: "text-red-400",
  }[status];

  const valueLabel =
    value ?? { ok: "OK", warning: "WARN", error: "ERROR" }[status];

  return (
    <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotClass}`}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${dotClass}`}
          />
        </span>
        <span className="text-[11px] font-medium text-slate-300">{label}</span>
      </div>
      <span className={`font-mono text-[11px] font-semibold ${textClass}`}>
        {valueLabel}
      </span>
    </div>
  );
}

interface StatusPanelProps {
  internet?: StatusLevel;
  database?: StatusLevel;
  equipment?: StatusLevel;
  equipmentLabel?: string;
}

export function StatusPanel({
  internet = "ok",
  database = "ok",
  equipment = "ok",
  equipmentLabel = "Midiendo",
}: StatusPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
      <div className="border-b border-white/10 px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Sistema
        </h2>
      </div>
      <div>
        <StatusRow label="Internet" status={internet} />
        <StatusRow label="DB" status={database} />
        <StatusRow label="Equipo" status={equipment} value={equipmentLabel} />
      </div>
    </div>
  );
}
