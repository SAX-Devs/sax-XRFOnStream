import { ScadaScreen } from "@/components/scada/scada-screen";
import { requireRole } from "@/lib/auth/session";

export default async function StatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("viewer");
  const { id } = await params;
  return <ScadaScreen deviceId={id} />;
}
