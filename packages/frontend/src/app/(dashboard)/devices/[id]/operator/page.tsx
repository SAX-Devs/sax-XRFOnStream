import { OperatorScreen } from "@/components/operator/operator-screen";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

export default async function OperatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("operator");
  const { id } = await params;
  const supabase = await createClient();
  const { data: device } = await supabase
    .from("devices")
    .select("provisioned_at")
    .eq("id", id)
    .maybeSingle();

  return (
    <OperatorScreen deviceId={id} provisioned={device?.provisioned_at != null} />
  );
}
