export type UserRole =
  | "viewer"
  | "operator"
  | "service"
  | "tenant_admin"
  | "sax_admin";

export interface UserProfile {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
}
