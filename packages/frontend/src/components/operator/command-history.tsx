"use client";

import { useCommands, type CommandStatus, type CommandRow } from "@/hooks/use-commands";

const STATUS_CONFIG: Record<
  CommandStatus,
  { label: string; color: string; bg: string }
> = {
  sent: { label: "Enviado", color: "text-slate-400", bg: "bg-slate-500/15" },
  delivered: { label: "Entregado", color: "text-cyan-300", bg: "bg-cyan-500/15" },
  ack: { label: "Recibido", color: "text-cyan-300", bg: "bg-cyan-500/15" },
  executing: { label: "Ejecutando", color: "text-amber-300", bg: "bg-amber-500/15" },
  completed: { label: "Completado", color: "text-emerald-300", bg: "bg-emerald-500/15" },
  error: { label: "Error", color: "text-red-300", bg: "bg-red-500/15" },
  rejected: { label: "Rechazado", color: "text-red-300", bg: "bg-red-500/15" },
  expired: { label: "Expirado", color: "text-slate-500", bg: "bg-slate-600/15" },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Audit trail of every command sent to this device, live via Realtime. */
export function CommandHistory({ deviceId }: { deviceId: string }) {
  const { commands, loading } = useCommands(deviceId);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          Historial de Órdenes
        </h2>
        <span className="font-mono text-[10px] text-slate-500">
          {commands.length}
        </span>
      </div>
      {loading ? (
        <div className="py-10 text-center text-sm text-slate-500">
          Cargando historial…
        </div>
      ) : commands.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">
          Sin órdenes registradas para este equipo
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2 text-left font-semibold">Hora</th>
              <th className="px-4 py-2 text-left font-semibold">Módulo</th>
              <th className="px-4 py-2 text-left font-semibold">Orden</th>
              <th className="px-4 py-2 text-left font-semibold">Usuario</th>
              <th className="px-4 py-2 text-left font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {commands.slice(0, 12).map((cmd) => (
              <HistoryRow key={cmd.id} cmd={cmd} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function HistoryRow({ cmd }: { cmd: CommandRow }) {
  const cfg = STATUS_CONFIG[cmd.status] ?? STATUS_CONFIG.sent;
  return (
    <tr className="border-b border-white/5 transition-colors last:border-b-0 hover:bg-white/[0.03]">
      <td className="px-4 py-2 font-mono text-[11px] text-slate-400 tabular-nums">
        {formatTime(cmd.sent_at)}
      </td>
      <td className="px-4 py-2 font-mono text-[11px] text-slate-300">
        {cmd.module}
      </td>
      <td className="px-4 py-2 font-mono text-[11px] text-slate-200">
        {cmd.command}
      </td>
      <td className="px-4 py-2 text-[11px] text-slate-400">
        {cmd.issued_by_email}
      </td>
      <td className="px-4 py-2">
        <span
          className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}
        >
          {cfg.label}
        </span>
        {cmd.error_message && (
          <span className="ml-2 text-[10px] text-red-400">
            {cmd.error_message}
          </span>
        )}
      </td>
    </tr>
  );
}
