import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    <div className="-m-6 flex flex-col">
      <div className="border-b border-gray-200 bg-white px-6 pt-4 pb-0">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">
          {device.label ?? device.serial}
        </h1>
        <p className="mb-3 text-sm text-gray-500">
          Serial: {device.serial}
        </p>
      </div>

      <DeviceTabs deviceId={id} />

      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
