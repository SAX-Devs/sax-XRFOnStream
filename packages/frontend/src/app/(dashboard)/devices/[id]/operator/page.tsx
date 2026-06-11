import { OperatorScreen } from "@/components/operator/operator-screen";

export default async function OperatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OperatorScreen deviceId={id} />;
}
