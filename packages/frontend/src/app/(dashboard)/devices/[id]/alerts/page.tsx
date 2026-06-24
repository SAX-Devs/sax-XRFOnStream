import { AlertsScreen } from "@/components/alerts/alerts-screen";
import { requireRole } from "@/lib/auth/session";

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("viewer");
  const { id } = await params;
  return <AlertsScreen deviceId={id} />;
}
