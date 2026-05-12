"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/constants/routes";

interface Tab {
  href: string;
  label: string;
}

function getTabs(deviceId: string): Tab[] {
  return [
    { href: ROUTES.DEVICE_STATUS(deviceId), label: "Status" },
    { href: ROUTES.DEVICE_MEASUREMENTS(deviceId), label: "Mediciones" },
    { href: ROUTES.DEVICE_OPERATOR(deviceId), label: "Operario" },
    { href: ROUTES.DEVICE_SERVICE(deviceId), label: "Servicio" },
    { href: ROUTES.DEVICE_ALERTS(deviceId), label: "Alertas" },
  ];
}

interface DeviceTabsProps {
  deviceId: string;
}

export function DeviceTabs({ deviceId }: DeviceTabsProps) {
  const pathname = usePathname();
  const tabs = getTabs(deviceId);

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
