"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { hasMinimumRole } from "@/constants/roles";
import type { UserRole } from "@/types/auth";

interface Tab {
  href: string;
  label: string;
  minRole: UserRole;
}

function getTabs(deviceId: string, role: UserRole): Tab[] {
  const tabs: Tab[] = [
    { href: ROUTES.DEVICE_STATUS(deviceId), label: "Status", minRole: "viewer" },
    { href: ROUTES.DEVICE_MEASUREMENTS(deviceId), label: "Mediciones", minRole: "viewer" },
    { href: ROUTES.DEVICE_OPERATOR(deviceId), label: "Operario", minRole: "operator" },
    { href: ROUTES.DEVICE_SERVICE(deviceId), label: "Servicio", minRole: "service" },
    { href: ROUTES.DEVICE_ALERTS(deviceId), label: "Alertas", minRole: "viewer" },
  ];
  return tabs.filter((tab) => hasMinimumRole(role, tab.minRole));
}

interface DeviceTabsProps {
  deviceId: string;
  role: UserRole;
}

export function DeviceTabs({ deviceId, role }: DeviceTabsProps) {
  const pathname = usePathname();
  const tabs = getTabs(deviceId, role);

  return (
    <nav className="flex gap-1 border-b border-white/8 px-6">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              isActive
                ? "border-red-500 text-white"
                : "border-transparent text-gray-500 hover:border-white/20 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
