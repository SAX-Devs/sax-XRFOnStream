import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { DeviceTabs } from "@/components/layout/device-tabs";

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

  const { data: device } = await supabase
    .from("devices")
    .select()
    .eq("id", id)
    .single();

  if (!device) {
    notFound();
  }

  return (
    <div className="-mx-6 -mt-6 flex flex-col">
      <div className="border-b border-white/8 px-6 pt-5 pb-0">
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
