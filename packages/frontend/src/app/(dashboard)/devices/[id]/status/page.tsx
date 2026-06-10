import { ScadaScreen } from "@/components/scada/scada-screen";

export default async function StatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ScadaScreen deviceId={id} />;
}
