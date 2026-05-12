import type { Database } from "./database";

export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
export type TenantInsert = Database["public"]["Tables"]["tenants"]["Insert"];

export interface TenantWithCounts extends Tenant {
  device_count: number;
  user_count: number;
}
