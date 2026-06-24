import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { DeviceTabs } from "@/components/layout/device-tabs";
import type { Device } from "@/types/devices";

type DeviceWithTenant = Device & { tenants: { name: string } | null };

interface DeviceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function DeviceLayout({
  children,
  params,
}: DeviceLayoutProps) {
  const { id } = await params;
  const user = await requireAuth();
  const supabase = await createClient();

  const { data } = await supabase
    .from("devices")
    .select("*, tenants(name)")
    .eq("id", id)
    .single();

  const device = data as unknown as DeviceWithTenant | null;

  if (!device) {
    notFound();
  }

  // Tenant-scoped users already see their company in the top nav, so showing it
  // again here would be redundant. Only sax_admin (global, no tenant in the nav)
  // needs the company surfaced on the device header.
  const tenantName =
    user.role === "sax_admin" ? device.tenants?.name ?? null : null;

  return (
    <div className="-mx-6 -mt-6 flex flex-col">
      <div className="border-b border-white/8 px-6 pt-5 pb-0">
        {tenantName && (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-600">
            {tenantName}
          </p>
        )}
        <h1 className="mb-1 text-xl font-semibold text-white">
          {device.label ?? device.serial}
        </h1>
        <p className="mb-4 text-sm text-gray-500">
          Serial: {device.serial}
        </p>
      </div>

      <DeviceTabs deviceId={id} role={user.role} />

      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
