import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { TopNav } from "@/components/layout/top-nav";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenant } from "@/services/tenants";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  // sax_admin is a global account (sees every tenant), so it has no single
  // tenant to display in the nav. Only resolve a tenant name for scoped users.
  const tenant =
    user.role !== "sax_admin" && user.tenantId
      ? await getTenant(user.tenantId)
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a12]">
      <TopNav
        email={user.email}
        userRole={user.role}
        tenantName={tenant?.name ?? null}
      />

      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-[1480px]">{children}</div>
      </main>
    </div>
  );
}
