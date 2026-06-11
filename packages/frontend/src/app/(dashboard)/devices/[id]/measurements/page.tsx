import { MeasurementsScreen } from "@/components/measurements/measurements-screen";

export default async function MeasurementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MeasurementsScreen deviceId={id} />;
}
