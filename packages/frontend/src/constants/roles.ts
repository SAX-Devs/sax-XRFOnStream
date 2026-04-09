import type { UserRole } from "@/types/auth";

export const ROLE_LABELS: Record<UserRole, string> = {
  viewer: "Visualizador",
  operator: "Operario",
  service: "Servicio Técnico",
  tenant_admin: "Administrador",
  sax_admin: "Admin SAX",
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 0,
  operator: 1,
  service: 2,
  tenant_admin: 3,
  sax_admin: 4,
};

export function hasMinimumRole(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
