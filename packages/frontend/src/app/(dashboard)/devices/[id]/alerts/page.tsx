import { AlertsScreen } from "@/components/alerts/alerts-screen";

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AlertsScreen deviceId={id} />;
}
