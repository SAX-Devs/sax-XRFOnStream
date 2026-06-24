import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import type { Tenant, TenantWithCounts } from "@/types/tenants";
import type { Device } from "@/types/devices";

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

  // Get user counts per tenant from user_profiles (the source of truth for
  // tenant membership since migration 00013).
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("tenant_id");

  const userCountMap = new Map<string, number>();
  for (const profile of profiles ?? []) {
    const tid = profile.tenant_id;
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
 * Updates an existing tenant's name and slug. The slug is only a display/unique
 * key here (routes and provisioning key off the UUID id), so it's safe to change
 * as long as it stays unique — the DB enforces that and we surface 23505.
 */
export async function updateTenant(
  id: string,
  input: { name: string; slug: string }
): Promise<Tenant> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("tenants")
    .update({ name: input.name, slug: input.slug })
    .eq("id", id)
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
 * Permanently deletes a tenant.
 *
 * The devices FK is ON DELETE RESTRICT (migration 00002), so Postgres refuses to
 * delete a tenant that still owns equipment — we surface that as a friendly error.
 * user_profiles is ON DELETE SET NULL, so member accounts survive but lose their
 * tenant association. Telemetry/alerts/etc. cascade off the devices, not here.
 */
export async function deleteTenant(id: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase.from("tenants").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "No se puede eliminar: el tenant todavia tiene equipos asociados. Elimina o reasigna los equipos primero."
      );
    }
    throw error;
  }
}

/**
 * Permanently deletes a device.
 *
 * Every child table (telemetry, spectra, command_audit, alerts, device_secrets,
 * equipment_state, concentrations) is ON DELETE CASCADE on device_id, so this also
 * wipes all of the device's history — hence the typed confirmation in the UI.
 */
export async function deleteDevice(id: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase.from("devices").delete().eq("id", id);

  if (error) throw error;
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
 * Creates a new device under a tenant and provisions its secret.
 *
 * Provisioning generates the device's HMAC secret + MQTT credentials and stores
 * them in private.device_secrets via the upsert_device_secret RPC (00014), which
 * also stamps devices.provisioned_at. This makes the device immediately able to
 * receive signed commands; the same credentials are later read by the provision
 * package that's installed on the physical equipment. Initial status stays
 * pending_activation until the equipment actually connects.
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

  const device = data as Device;

  // Provision: generate + store the HMAC secret and MQTT credentials.
  const hmacSecretHex = randomBytes(32).toString("hex");
  const mqttUsername = input.serial.toLowerCase();
  const mqttPassword = randomBytes(18).toString("base64url");

  // Cast around the RPC: it isn't in the generated Database types (same as
  // get_device_hmac_secret in the command Route Handler).
  const { error: provisionError } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: Error | null }>
  )("upsert_device_secret", {
    p_device_id: device.id,
    p_hmac_secret_hex: hmacSecretHex,
    p_mqtt_username: mqttUsername,
    p_mqtt_password: mqttPassword,
  });

  if (provisionError) throw provisionError;

  return device;
}
