"use client";

import { useCommands, type CommandStatus } from "@/hooks/use-commands";

/**
 * Command activity for the selected module — the technician's short-term
 * memory: what was ordered, by whom, and how it ended (with the equipment's
 * real error text). Live via the same command_audit Realtime feed the rest of
 * the app uses.
 */

const STATUS_STYLE: Record<CommandStatus, { label: string; cls: string }> = {
  sent: { label: "enviado", cls: "text-slate-400" },
  delivered: { label: "entregado", cls: "text-cyan-300" },
  ack: { label: "recibido", cls: "text-cyan-300" },
  executing: { label: "ejecutando", cls: "text-amber-300" },
  completed: { label: "✓", cls: "text-emerald-300" },
  error: { label: "✕ error", cls: "text-red-300" },
  rejected: { label: "✕ rechazado", cls: "text-red-300" },
  expired: { label: "expirado", cls: "text-slate-500" },
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

export function ModuleActivity({
  deviceId,
  module,
}: {
  deviceId: string;
  module: string;
}) {
  const { commands, loading } = useCommands(deviceId);
  const rows = commands.filter((c) => c.module === module).slice(0, 10);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          Actividad del módulo
        </h2>
        <span className="font-mono text-[10px] text-slate-500">{rows.length}</span>
      </div>

      {loading ? (
        <div className="py-6 text-center text-[12px] text-slate-500">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="py-6 text-center text-[12px] text-slate-500">
          Sin órdenes registradas para este módulo
        </div>
      ) : (
        <div className="px-1.5 py-1.5">
          {rows.map((c) => {
            const s = STATUS_STYLE[c.status] ?? STATUS_STYLE.sent;
            return (
              <div key={c.id} className="rounded-md px-2 py-1 hover:bg-white/[0.03]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-mono text-[11px] text-slate-200">
                    {c.command}
                  </span>
                  <span className={`shrink-0 text-[10px] font-semibold ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[9.5px] text-slate-600">
                    {c.issued_by_email}
                  </span>
                  <span className="shrink-0 font-mono text-[9.5px] text-slate-600 tabular-nums">
                    {formatTime(c.sent_at)}
                  </span>
                </div>
                {c.error_message && (
                  <div className="mt-0.5 truncate text-[9.5px] text-red-400/90" title={c.error_message}>
                    {c.error_message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
