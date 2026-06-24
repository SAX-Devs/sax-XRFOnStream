import { ServiceScreen } from "@/components/service/service-screen";
import { requireRole } from "@/lib/auth/session";

export default async function ServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("service");
  const { id } = await params;
  return <ServiceScreen deviceId={id} />;
}
