import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getTenant, getTenantDevices } from "@/services/tenants";
import { getTenantUsers } from "@/services/users";
import { ROUTES } from "@/constants/routes";
import { TenantDetailActions } from "./tenant-detail-actions";
import { EditTenantButton } from "@/components/admin/edit-tenant-button";

interface TenantDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantDetailPage({
  params,
}: TenantDetailPageProps) {
  const { id } = await params;
  const user = await requireRole("tenant_admin");

  // tenant_admin can only see their own tenant
  if (user.role === "tenant_admin" && user.tenantId !== id) {
    redirect(ROUTES.DEVICES);
  }

  const tenant = await getTenant(id);
  if (!tenant) notFound();

  const [devices, users] = await Promise.all([
    getTenantDevices(id),
    getTenantUsers(id),
  ]);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        {user.role === "sax_admin" && (
          <Link
            href={ROUTES.ADMIN_TENANTS}
            className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-300"
          >
            <ArrowLeftIcon />
            Volver a Tenants
          </Link>
        )}
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-white">{tenant.name}</h1>
          {user.role === "sax_admin" && (
            <EditTenantButton
              tenantId={tenant.id}
              currentName={tenant.name}
              currentSlug={tenant.slug}
            />
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
          <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-xs">
            {tenant.slug}
          </span>
          <span>·</span>
          <span>
            Creado{" "}
            {new Date(tenant.created_at).toLocaleDateString("es-CL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Devices + Users sections with action buttons */}
      <TenantDetailActions
        tenantId={id}
        devices={devices}
        users={users}
      />
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
      />
    </svg>
  );
}
