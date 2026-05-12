import type { EquipmentStateEnum } from "@/types/database";

const STATE_CONFIG: Record<
  EquipmentStateEnum,
  { label: string; dot: string; text: string; bg: string }
> = {
  idle: {
    label: "Inactivo",
    dot: "bg-gray-400",
    text: "text-gray-300",
    bg: "bg-gray-500/10 border-gray-500/20",
  },
  measuring: {
    label: "Midiendo",
    dot: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]",
    text: "text-blue-300",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  initializing: {
    label: "Inicializando",
    dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]",
    text: "text-amber-300",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  standby: {
    label: "Standby",
    dot: "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]",
    text: "text-cyan-300",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
  error: {
    label: "Error",
    dot: "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]",
    text: "text-red-300",
    bg: "bg-red-500/10 border-red-500/20",
  },
  offline: {
    label: "Offline",
    dot: "bg-gray-600",
    text: "text-gray-500",
    bg: "bg-gray-500/5 border-gray-500/10",
  },
  unknown: {
    label: "Desconocido",
    dot: "bg-gray-600",
    text: "text-gray-500",
    bg: "bg-gray-500/5 border-gray-500/10",
  },
};

interface DeviceStatusBadgeProps {
  state: EquipmentStateEnum;
}

export function DeviceStatusBadge({ state }: DeviceStatusBadgeProps) {
  const config = STATE_CONFIG[state];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
