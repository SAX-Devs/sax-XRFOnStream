import type { UserRole } from "./auth";

export interface UserListItem {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface InviteUserPayload {
  email: string;
  role: UserRole;
  tenant_id: string;
}

export interface CreateDevicePayload {
  serial: string;
  label?: string;
  tenant_id: string;
}
