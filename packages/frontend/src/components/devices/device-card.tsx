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
      className="group block rounded-xl border border-white/8 bg-white/[0.03] p-5 transition-all hover:border-white/15 hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          {device.tenants?.name && (
            <p className="mb-1 truncate text-[11px] font-medium uppercase tracking-wider text-gray-600">
              {device.tenants.name}
            </p>
          )}
          <h3 className="truncate text-base font-semibold text-gray-100 group-hover:text-white">
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
          <span className="text-xs text-gray-600">
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
          online
            ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
            : "bg-gray-600"
        }`}
      />
      <span className={`text-xs ${online ? "text-emerald-400" : "text-gray-600"}`}>
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
