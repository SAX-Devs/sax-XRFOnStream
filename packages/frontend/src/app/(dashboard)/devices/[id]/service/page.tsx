import { ServiceScreen } from "@/components/service/service-screen";

export default async function ServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ServiceScreen deviceId={id} />;
}
