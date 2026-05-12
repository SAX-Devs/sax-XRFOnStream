import { createServiceClient } from "@/lib/supabase/server";
import type { Tenant, TenantWithCounts } from "@/types/tenants";
import type { Device } from "@/types/devices";
import type { UserRole } from "@/types/auth";

/**
 * Fetches all tenants with their device and user counts.
 * Uses service_role to bypass RLS (admin operation).
 */
export async function getTenants(): Promise<TenantWithCounts[]> {
  const supabase = await createServiceClient();

  const { data: tenants, error } = await supabase
    .from("tenants")
    .select()
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!tenants) return [];

  // Get device counts per tenant in a single query
  const { data: devices } = await supabase.from("devices").select();

  const deviceCountMap = new Map<string, number>();
  for (const device of devices ?? []) {
    const tid = device.tenant_id;
    deviceCountMap.set(tid, (deviceCountMap.get(tid) ?? 0) + 1);
  }

  // Get user counts per tenant via Admin API
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  const userCountMap = new Map<string, number>();
  for (const user of users ?? []) {
    const tid = user.app_metadata?.tenant_id as string | undefined;
    if (tid) {
      userCountMap.set(tid, (userCountMap.get(tid) ?? 0) + 1);
    }
  }

  return tenants.map((tenant) => ({
    ...tenant,
    device_count: deviceCountMap.get(tenant.id) ?? 0,
    user_count: userCountMap.get(tenant.id) ?? 0,
  })) as TenantWithCounts[];
}

/**
 * Fetches a single tenant by ID.
 */
export async function getTenant(id: string): Promise<Tenant | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("tenants")
    .select()
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Tenant;
}

/**
 * Fetches all devices belonging to a tenant.
 */
export async function getTenantDevices(tenantId: string): Promise<Device[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("devices")
    .select()
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Device[];
}

/**
 * Creates a new tenant. Returns the created tenant or throws on error.
 */
export async function createTenant(input: {
  name: string;
  slug: string;
}): Promise<Tenant> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("tenants")
    .insert({ name: input.name, slug: input.slug })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un tenant con ese slug");
    }
    throw error;
  }

  return data as Tenant;
}

/**
 * Creates a new device under a tenant.
 * Sets initial status to pending_activation.
 */
export async function createDevice(input: {
  serial: string;
  label?: string;
  tenant_id: string;
}): Promise<Device> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("devices")
    .insert({
      serial: input.serial,
      tenant_id: input.tenant_id,
      label: input.label || null,
      status: "pending_activation" as const,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un dispositivo con ese serial");
    }
    throw error;
  }

  return data as Device;
}
