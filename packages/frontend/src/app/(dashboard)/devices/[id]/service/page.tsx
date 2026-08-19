import { ServiceScreen } from "@/components/service/service-screen";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

export default async function ServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("service");
  const { id } = await params;
  const supabase = await createClient();
  const { data: device } = await supabase
    .from("devices")
    .select("provisioned_at")
    .eq("id", id)
    .maybeSingle();

  return (
    <ServiceScreen deviceId={id} provisioned={device?.provisioned_at != null} />
  );
}
