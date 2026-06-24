"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  createTenant,
  updateTenant,
  createDevice,
  deleteTenant,
  deleteDevice,
  getTenant,
} from "@/services/tenants";
import { getDevice } from "@/services/devices";
import { inviteUser } from "@/services/users";
import { ROUTES } from "@/constants/routes";
import type { UserRole } from "@/types/auth";

interface ActionResult {
  success: boolean;
  error?: string;
}

function cleanSlug(slug: string): string {
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createTenantAction(
  formData: FormData
): Promise<ActionResult> {
  await requireRole("sax_admin");

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;

  if (!name?.trim() || !slug?.trim()) {
    return { success: false, error: "Nombre y slug son obligatorios" };
  }

  const slugClean = cleanSlug(slug);

  if (!slugClean) {
    return { success: false, error: "El slug no es valido" };
  }

  try {
    await createTenant({ name: name.trim(), slug: slugClean });
    revalidatePath(ROUTES.ADMIN_TENANTS);
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al crear el tenant";
    return { success: false, error: message };
  }
}

export async function updateTenantAction(
  formData: FormData
): Promise<ActionResult> {
  await requireRole("sax_admin");

  const tenantId = formData.get("tenant_id") as string;
  const name = ((formData.get("name") as string) ?? "").trim();
  const slug = ((formData.get("slug") as string) ?? "").trim();

  if (!tenantId) {
    return { success: false, error: "Tenant no especificado" };
  }
  if (!name || !slug) {
    return { success: false, error: "Nombre y slug son obligatorios" };
  }

  const slugClean = cleanSlug(slug);
  if (!slugClean) {
    return { success: false, error: "El slug no es valido" };
  }

  try {
    await updateTenant(tenantId, { name, slug: slugClean });
    revalidatePath(ROUTES.ADMIN_TENANTS);
    revalidatePath(ROUTES.ADMIN_TENANT_DETAIL(tenantId));
    revalidatePath(ROUTES.DEVICES);
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al actualizar el tenant";
    return { success: false, error: message };
  }
}

export async function deleteTenantAction(
  formData: FormData
): Promise<ActionResult> {
  await requireRole("sax_admin");

  const tenantId = formData.get("tenant_id") as string;
  const confirmName = ((formData.get("confirm_name") as string) ?? "").trim();

  if (!tenantId) {
    return { success: false, error: "Tenant no especificado" };
  }

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return { success: false, error: "El tenant no existe" };
  }

  // Server-side guard: the typed name must match exactly, so a stale UI or a
  // direct call can't delete the wrong tenant.
  if (confirmName !== tenant.name) {
    return { success: false, error: "El nombre no coincide con el del tenant" };
  }

  try {
    await deleteTenant(tenantId);
    revalidatePath(ROUTES.ADMIN_TENANTS);
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al eliminar el tenant";
    return { success: false, error: message };
  }
}

export async function createDeviceAction(
  formData: FormData
): Promise<ActionResult> {
  await requireRole("tenant_admin");

  const serial = formData.get("serial") as string;
  const label = formData.get("label") as string;
  const tenantId = formData.get("tenant_id") as string;

  if (!serial?.trim()) {
    return { success: false, error: "El serial es obligatorio" };
  }

  if (!tenantId) {
    return { success: false, error: "Tenant no especificado" };
  }

  try {
    await createDevice({
      serial: serial.trim().toUpperCase(),
      label: label?.trim() || undefined,
      tenant_id: tenantId,
    });
    revalidatePath(ROUTES.ADMIN_TENANT_DETAIL(tenantId));
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al crear el dispositivo";
    return { success: false, error: message };
  }
}

export async function deleteDeviceAction(
  formData: FormData
): Promise<ActionResult> {
  await requireRole("tenant_admin");

  const deviceId = formData.get("device_id") as string;
  const confirmSerial = ((formData.get("confirm_serial") as string) ?? "")
    .trim()
    .toUpperCase();

  if (!deviceId) {
    return { success: false, error: "Equipo no especificado" };
  }

  // getDevice runs under the caller's session, so RLS keeps a tenant_admin from
  // touching another tenant's equipment (it would come back null here).
  const device = await getDevice(deviceId);
  if (!device) {
    return { success: false, error: "El equipo no existe" };
  }

  if (confirmSerial !== device.serial.toUpperCase()) {
    return { success: false, error: "El serial no coincide con el del equipo" };
  }

  try {
    await deleteDevice(deviceId);
    revalidatePath(ROUTES.ADMIN_TENANT_DETAIL(device.tenant_id));
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al eliminar el equipo";
    return { success: false, error: message };
  }
}

export async function inviteUserAction(
  formData: FormData
): Promise<ActionResult> {
  await requireRole("tenant_admin");

  const email = formData.get("email") as string;
  const role = formData.get("role") as UserRole;
  const tenantId = formData.get("tenant_id") as string;

  if (!email?.trim()) {
    return { success: false, error: "El email es obligatorio" };
  }

  if (!role || !tenantId) {
    return { success: false, error: "Rol y tenant son obligatorios" };
  }

  try {
    await inviteUser({
      email: email.trim().toLowerCase(),
      role,
      tenant_id: tenantId,
    });
    revalidatePath(ROUTES.ADMIN_TENANT_DETAIL(tenantId));
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al invitar al usuario";
    return { success: false, error: message };
  }
}
