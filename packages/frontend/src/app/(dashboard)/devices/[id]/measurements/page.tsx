import { MeasurementsScreen } from "@/components/measurements/measurements-screen";
import { requireRole } from "@/lib/auth/session";

export default async function MeasurementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("viewer");
  const { id } = await params;
  return <MeasurementsScreen deviceId={id} />;
}
