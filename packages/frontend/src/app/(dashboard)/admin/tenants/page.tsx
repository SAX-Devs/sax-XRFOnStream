import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getTenants } from "@/services/tenants";
import { ROUTES } from "@/constants/routes";
import { TenantsTable } from "@/components/admin/tenants-table";
import { CreateTenantButton } from "./create-tenant-button";

export default async function TenantsPage() {
  const user = await requireRole("tenant_admin");

  // tenant_admin only sees their own tenant
  if (user.role === "tenant_admin") {
    redirect(ROUTES.ADMIN_TENANT_DETAIL(user.tenantId));
  }

  const tenants = await getTenants();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Tenants</h1>
          <p className="mt-1 text-sm text-gray-500">
            Clientes registrados en la plataforma
          </p>
        </div>

        <CreateTenantButton />
      </div>

      {tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-16">
          <p className="text-lg font-medium text-gray-400">
            No hay tenants registrados
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Crea el primer tenant para comenzar
          </p>
        </div>
      ) : (
        <TenantsTable tenants={tenants} />
      )}
    </div>
  );
}
