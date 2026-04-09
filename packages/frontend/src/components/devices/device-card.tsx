import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { isDeviceOnline } from "@/types/devices";
import { DeviceStatusBadge } from "./device-status-badge";
import type { DeviceWithState } from "@/types/devices";

interface DeviceCardProps {
  device: DeviceWithState;
}

export function DeviceCard({ device }: DeviceCardProps) {
  const online = isDeviceOnline(device.last_seen_at);
  const equipmentState =
    device.device_equipment_state?.state ?? "unknown";

  return (
    <Link
      href={ROUTES.DEVICE_STATUS(device.id)}
      className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-900 group-hover:text-blue-600">
            {device.label ?? device.serial}
          </h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Serial: {device.serial}
          </p>
        </div>

        <OnlineIndicator online={online} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <DeviceStatusBadge state={equipmentState} />

        {device.last_seen_at && (
          <span className="text-xs text-gray-400">
            {online
              ? "Conectado"
              : `Visto ${formatTimeAgo(device.last_seen_at)}`}
          </span>
        )}
      </div>
    </Link>
  );
}

function OnlineIndicator({ online }: { online: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`h-2.5 w-2.5 rounded-full ${
          online ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-gray-300"
        }`}
      />
      <span className="text-xs text-gray-500">
        {online ? "Online" : "Offline"}
      </span>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;

  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}
