"use client";

import { useState } from "react";

type EquipmentState =
  | "idle"
  | "measuring"
  | "initializing"
  | "standby"
  | "error"
  | "offline"
  | "unknown";

type CommandStatus =
  | "sent"
  | "delivered"
  | "ack"
  | "executing"
  | "completed"
  | "error"
  | "rejected";

interface CommandRecord {
  id: string;
  timestamp: string;
  module: string;
  command: string;
  status: CommandStatus;
  issuedBy: string;
  errorMessage?: string;
}

const SAMPLE_COMMANDS: CommandRecord[] = [
  {
    id: "cmd-105",
    timestamp: "15:42:30",
    module: "system",
    command: "start_measurement",
    status: "completed",
    issuedBy: "operario@sax.cl",
  },
  {
    id: "cmd-104",
    timestamp: "15:30:15",
    module: "system",
    command: "start_measurement",
    status: "completed",
    issuedBy: "operario@sax.cl",
  },
  {
    id: "cmd-103",
    timestamp: "15:18:42",
    module: "vacuum",
    command: "set_condition",
    status: "completed",
    issuedBy: "operario@sax.cl",
  },
  {
    id: "cmd-102",
    timestamp: "15:17:50",
    module: "interchanger",
    command: "go_to_chamber",
    status: "completed",
    issuedBy: "operario@sax.cl",
  },
  {
    id: "cmd-101",
    timestamp: "15:05:18",
    module: "system",
    command: "start_measurement",
    status: "completed",
    issuedBy: "operario@sax.cl",
  },
  {
    id: "cmd-100",
    timestamp: "14:00:12",
    module: "interchanger",
    command: "go_to_recal",
    status: "completed",
    issuedBy: "system",
  },
  {
    id: "cmd-099",
    timestamp: "13:58:05",
    module: "circulation",
    command: "set_pump_state",
    status: "error",
    issuedBy: "operario@sax.cl",
    errorMessage: "Pump interlock active",
  },
];

const STATE_CONFIG: Record<
  EquipmentState,
  { label: string; color: string; bg: string; ring: string; pulse: boolean }
> = {
  idle: {
    label: "En reposo",
    color: "text-slate-300",
    bg: "bg-slate-500/15",
    ring: "ring-slate-500/40",
    pulse: false,
  },
  measuring: {
    label: "Midiendo",
    color: "text-blue-300",
    bg: "bg-blue-500/15",
    ring: "ring-blue-500/40",
    pulse: true,
  },
  initializing: {
    label: "Inicializando",
    color: "text-amber-300",
    bg: "bg-amber-500/15",
    ring: "ring-amber-500/40",
    pulse: true,
  },
  standby: {
    label: "Standby",
    color: "text-cyan-300",
    bg: "bg-cyan-500/15",
    ring: "ring-cyan-500/40",
    pulse: false,
  },
  error: {
    label: "Error",
    color: "text-red-300",
    bg: "bg-red-500/15",
    ring: "ring-red-500/40",
    pulse: true,
  },
  offline: {
    label: "Desconectado",
    color: "text-slate-500",
    bg: "bg-slate-700/20",
    ring: "ring-slate-700/40",
    pulse: false,
  },
  unknown: {
    label: "Desconocido",
    color: "text-slate-400",
    bg: "bg-slate-600/15",
    ring: "ring-slate-600/40",
    pulse: false,
  },
};

const COMMAND_STATUS_CONFIG: Record<
  CommandStatus,
  { label: string; color: string; bg: string }
> = {
  sent: { label: "Enviado", color: "text-slate-400", bg: "bg-slate-500/15" },
  delivered: {
    label: "Entregado",
    color: "text-cyan-300",
    bg: "bg-cyan-500/15",
  },
  ack: { label: "ACK", color: "text-cyan-300", bg: "bg-cyan-500/15" },
  executing: {
    label: "Ejecutando",
    color: "text-amber-300",
    bg: "bg-amber-500/15",
  },
  completed: {
    label: "Completado",
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
  },
  error: { label: "Error", color: "text-red-300", bg: "bg-red-500/15" },
  rejected: { label: "Rechazado", color: "text-red-300", bg: "bg-red-500/15" },
};

export function OperatorScreen() {
  const [currentState] = useState<EquipmentState>("measuring");
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const stateConfig = STATE_CONFIG[currentState];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-3 items-start">
        {/* Left: Equipment state + actions */}
        <div className="space-y-3">
          {/* Equipment state badge — large */}
          <div className="rounded-2xl border border-white/10 bg-black/60 p-5 backdrop-blur-md">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Estado del equipo
            </div>
            <div
              className={`mt-3 inline-flex items-center gap-3 rounded-xl px-5 py-3 ring-1 ${stateConfig.bg} ${stateConfig.ring}`}
            >
              <span className="relative flex h-3 w-3">
                {stateConfig.pulse && (
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${stateConfig.color.replace("text-", "bg-")}`}
                  />
                )}
                <span
                  className={`relative inline-flex h-3 w-3 rounded-full ${stateConfig.color.replace("text-", "bg-")}`}
                />
              </span>
              <span
                className={`text-2xl font-bold tracking-wide ${stateConfig.color}`}
              >
                {stateConfig.label.toUpperCase()}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Equipo realizando medición XRF activa. Tiempo restante estimado:{" "}
              <span className="font-mono text-slate-200">~6 s</span>
            </p>
          </div>

          {/* Operator actions */}
          <div className="rounded-2xl border border-white/10 bg-black/60 p-5 backdrop-blur-md">
            <div className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Acciones de operación
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowStartConfirm(true)}
                disabled={currentState === "measuring"}
                className="group relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-600/30 to-emerald-700/30 px-4 py-6 transition-all hover:border-emerald-400/70 hover:from-emerald-500/40 hover:to-emerald-600/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
              >
                <svg
                  className="h-8 w-8 text-emerald-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span className="text-sm font-bold uppercase tracking-wider text-emerald-100">
                  Iniciar Medición
                </span>
                <span className="text-[10px] text-emerald-300/70">
                  start_measurement
                </span>
              </button>

              <button className="group relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-red-500/50 bg-gradient-to-b from-red-600 to-red-800 px-4 py-6 shadow-md shadow-red-900/30 transition-all hover:border-red-400 hover:from-red-500 hover:to-red-700 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                <svg
                  className="h-8 w-8 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                <span className="text-sm font-bold uppercase tracking-widest text-white">
                  Parada Emergencia
                </span>
                <span className="text-[10px] text-red-200/70">
                  emergency_stop
                </span>
              </button>
            </div>

            {/* Secondary actions */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <SecondaryActionButton label="Inicializar" command="initialize" />
              <SecondaryActionButton label="Pausar" command="pause" />
              <SecondaryActionButton label="Recalibrar" command="recalibrate" />
            </div>
          </div>
        </div>

        {/* Right: Quick stats */}
        <div className="space-y-3">
          <StatCard
            label="Mediciones hoy"
            value="48"
            sub="3 en última hora"
          />
          <StatCard label="Uptime equipo" value="23.5h" sub="desde 21:30 ayer" />
          <StatCard
            label="Última calibración"
            value="14:00"
            sub="próxima en 2.3h"
          />
          <StatCard
            label="Comandos pendientes"
            value="0"
            sub="cola limpia"
            okState
          />
        </div>
      </div>

      {/* Command history */}
      <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Historial de Comandos
          </h2>
          <span className="font-mono text-[10px] text-slate-500">
            últimos {SAMPLE_COMMANDS.length}
          </span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2 text-left font-semibold">Hora</th>
              <th className="px-4 py-2 text-left font-semibold">Módulo</th>
              <th className="px-4 py-2 text-left font-semibold">Comando</th>
              <th className="px-4 py-2 text-left font-semibold">Usuario</th>
              <th className="px-4 py-2 text-left font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_COMMANDS.map((cmd) => {
              const cfg = COMMAND_STATUS_CONFIG[cmd.status];
              return (
                <tr
                  key={cmd.id}
                  className="border-b border-white/5 transition-colors last:border-b-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-400 tabular-nums">
                    {cmd.timestamp}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-300">
                    {cmd.module}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-200">
                    {cmd.command}
                  </td>
                  <td className="px-4 py-2 text-[11px] text-slate-400">
                    {cmd.issuedBy}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}
                    >
                      {cfg.label}
                    </span>
                    {cmd.errorMessage && (
                      <span className="ml-2 text-[10px] text-red-400">
                        {cmd.errorMessage}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showStartConfirm && (
        <ConfirmStartDialog
          onConfirm={() => setShowStartConfirm(false)}
          onCancel={() => setShowStartConfirm(false)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  okState,
}: {
  label: string;
  value: string;
  sub?: string;
  okState?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-md">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-2xl font-bold tabular-nums ${okState ? "text-emerald-300" : "text-slate-100"}`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>
      )}
    </div>
  );
}

function SecondaryActionButton({
  label,
  command,
}: {
  label: string;
  command: string;
}) {
  return (
    <button className="group flex flex-col items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition-colors hover:border-white/20 hover:bg-white/10">
      <span className="text-xs font-medium text-slate-200">{label}</span>
      <span className="font-mono text-[9px] text-slate-500">{command}</span>
    </button>
  );
}

function ConfirmStartDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-[#1e293b] to-[#0f172a] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
            <svg
              className="h-5 w-5 text-emerald-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">Iniciar medición</h2>
        </div>
        <p className="text-sm leading-relaxed text-slate-300">
          Se enviará el comando <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-300">start_measurement</code>{" "}
          al equipo. Asegúrate de que el sistema esté en posición de Chamber y
          el vacío en condición Vacuum I.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Iniciar
          </button>
        </div>
      </div>
    </div>
  );
}
