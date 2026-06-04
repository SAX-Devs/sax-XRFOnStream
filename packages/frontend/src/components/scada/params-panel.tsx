"use client";

type ParamStatus = "normal" | "warning" | "critical";

interface ParamCardProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: ParamStatus;
}

function ParamCard({ label, value, unit, status = "normal" }: ParamCardProps) {
  const accentBorder = {
    normal: "border-l-emerald-500/60",
    warning: "border-l-amber-500/60",
    critical: "border-l-red-500/60",
  }[status];

  return (
    <div
      className={`group rounded-lg border border-white/5 ${accentBorder} border-l-2 bg-white/[0.03] px-3 py-2 backdrop-blur-sm transition-colors hover:bg-white/[0.06]`}
    >
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-mono text-base font-semibold text-slate-100 tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-[11px] font-medium text-slate-500">{unit}</span>
        )}
      </div>
    </div>
  );
}

interface ParamsPanelProps {
  params?: {
    operationMode: string;
    pumpState: string;
    flowIn: number;
    flowOut: number;
    cabinetTemp: number;
    tubeTemp: number;
    density: number;
    interchangerPosition: string;
    chamberLock: string;
    maintenanceDoor: string;
    chamberLead: string;
  };
}

const DEFAULT_PARAMS = {
  operationMode: "Brine",
  pumpState: "FORWARD",
  flowIn: 12.5,
  flowOut: 12.4,
  cabinetTemp: 24.3,
  tubeTemp: 45.1,
  density: 1.21,
  interchangerPosition: "NORMAL",
  chamberLock: "LOCKED",
  maintenanceDoor: "CLOSED",
  chamberLead: "OK",
};

export function ParamsPanel({ params = DEFAULT_PARAMS }: ParamsPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2 px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Parámetros
        </h2>
        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
      </div>

      <div className="space-y-1.5">
        <ParamCard label="Operation Mode" value={params.operationMode} />
        <ParamCard label="Pump State" value={params.pumpState} />
        <ParamCard
          label="Flow In"
          value={params.flowIn.toFixed(1)}
          unit="L/m"
        />
        <ParamCard
          label="Flow Out"
          value={params.flowOut.toFixed(1)}
          unit="L/m"
        />
        <ParamCard
          label="Cabinet T"
          value={params.cabinetTemp.toFixed(1)}
          unit="°C"
        />
        <ParamCard
          label="Tube T"
          value={params.tubeTemp.toFixed(1)}
          unit="°C"
          status={params.tubeTemp > 50 ? "warning" : "normal"}
        />
        <ParamCard
          label="Density"
          value={params.density.toFixed(2)}
          unit="Kg/L"
        />
        <ParamCard
          label="Interchanger"
          value={params.interchangerPosition}
          status={
            params.interchangerPosition === "RECALIBRATION" ? "warning" : "normal"
          }
        />
        <ParamCard
          label="Chamber Lock"
          value={params.chamberLock}
          status={params.chamberLock === "UNLOCKED" ? "critical" : "normal"}
        />
        <ParamCard
          label="Maintenance"
          value={params.maintenanceDoor}
          status={params.maintenanceDoor === "OPEN" ? "critical" : "normal"}
        />
        <ParamCard
          label="Chamber Lead"
          value={params.chamberLead}
          status={params.chamberLead === "LEAK" ? "critical" : "normal"}
        />
      </div>
    </div>
  );
}
