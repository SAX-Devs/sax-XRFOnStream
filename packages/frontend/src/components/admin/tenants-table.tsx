import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { DeleteTenantButton } from "./delete-tenant-button";
import type { TenantWithCounts } from "@/types/tenants";

interface TenantsTableProps {
  tenants: TenantWithCounts[];
}

export function TenantsTable({ tenants }: TenantsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/8">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/8 bg-white/[0.02]">
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Nombre
            </th>
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Slug
            </th>
            <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
              Equipos
            </th>
            <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
              Usuarios
            </th>
            <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Creado
            </th>
            <th className="w-12 px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {tenants.map((tenant) => (
            <tr
              key={tenant.id}
              className="transition-colors hover:bg-white/[0.03]"
            >
              <td className="px-5 py-4">
                <Link
                  href={ROUTES.ADMIN_TENANT_DETAIL(tenant.id)}
                  className="font-medium text-gray-200 transition-colors hover:text-white"
                >
                  {tenant.name}
                </Link>
              </td>
              <td className="px-5 py-4">
                <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-xs text-gray-500">
                  {tenant.slug}
                </span>
              </td>
              <td className="px-5 py-4 text-center">
                <span className="text-sm text-gray-300">
                  {tenant.device_count}
                </span>
              </td>
              <td className="px-5 py-4 text-center">
                <span className="text-sm text-gray-300">
                  {tenant.user_count}
                </span>
              </td>
              <td className="px-5 py-4 text-right text-sm text-gray-500">
                {formatDate(tenant.created_at)}
              </td>
              <td className="px-5 py-4 text-right">
                <DeleteTenantButton
                  tenantId={tenant.id}
                  tenantName={tenant.name}
                  deviceCount={tenant.device_count}
                  userCount={tenant.user_count}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
