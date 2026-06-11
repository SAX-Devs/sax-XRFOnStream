import { createServiceClient } from "@/lib/supabase/server";
import type { UserListItem, InviteUserPayload } from "@/types/users";
import type { UserRole } from "@/types/auth";

/**
 * tenant_id / role live in the protected `user_profiles` table (migration
 * 00013): only service_role can write it and users may read only their own row,
 * so a user cannot change their own role/tenant. The auth.users AFTER INSERT
 * trigger creates a default 'viewer' profile; inviteUser upserts the real values
 * via service_role. Never store role/tenant in user_metadata (user-editable).
 */

export async function getTenantUsers(
  tenantId: string
): Promise<UserListItem[]> {
  const supabase = await createServiceClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("user_id, role, created_at")
    .eq("tenant_id", tenantId);

  if (profilesError) throw profilesError;

  const {
    data: { users },
    error,
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (error) throw error;

  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  return (profiles ?? []).map((p) => {
    const u = byId.get(p.user_id);
    return {
      id: p.user_id,
      email: u?.email ?? "",
      role: (p.role as UserRole) ?? "viewer",
      created_at: u?.created_at ?? p.created_at,
      last_sign_in_at: u?.last_sign_in_at ?? null,
    };
  });
}

export async function inviteUser(
  payload: InviteUserPayload
): Promise<{ id: string; email: string }> {
  const supabase = await createServiceClient();

  const siteUrl = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  );
  const redirectTo = `${siteUrl.origin}/accept-invite`;

  const {
    data: { user },
    error,
  } = await supabase.auth.admin.inviteUserByEmail(payload.email, {
    redirectTo,
  });

  if (error) {
    if (error.message?.includes("already been registered")) {
      throw new Error("Este email ya tiene una cuenta registrada");
    }
    throw error;
  }

  if (!user) throw new Error("No se pudo crear la invitacion");

  // Write role/tenant to the protected profile. The AFTER INSERT trigger already
  // created a default 'viewer' row; this upsert sets the real values.
  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert({
      user_id: user.id,
      tenant_id: payload.tenant_id,
      role: payload.role,
    });

  if (profileError) throw profileError;

  return { id: user.id, email: user.email ?? payload.email };
}
