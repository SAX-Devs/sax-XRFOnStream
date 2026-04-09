import type { EquipmentStateEnum } from "@/types/database";

const STATE_CONFIG: Record<
  EquipmentStateEnum,
  { label: string; className: string }
> = {
  idle: { label: "Inactivo", className: "bg-gray-100 text-gray-700" },
  measuring: { label: "Midiendo", className: "bg-blue-100 text-blue-700" },
  initializing: {
    label: "Inicializando",
    className: "bg-yellow-100 text-yellow-700",
  },
  standby: { label: "Standby", className: "bg-cyan-100 text-cyan-700" },
  error: { label: "Error", className: "bg-red-100 text-red-700" },
  offline: { label: "Offline", className: "bg-gray-100 text-gray-500" },
  unknown: { label: "Desconocido", className: "bg-gray-100 text-gray-400" },
};

interface DeviceStatusBadgeProps {
  state: EquipmentStateEnum;
}

export function DeviceStatusBadge({ state }: DeviceStatusBadgeProps) {
  const config = STATE_CONFIG[state];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
