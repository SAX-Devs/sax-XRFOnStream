import { createServiceClient } from "@/lib/supabase/server";
import type { UserListItem, InviteUserPayload } from "@/types/users";
import type { UserRole } from "@/types/auth";

/**
 * NOTE on tenant_id / role storage:
 *
 * For the demo we keep tenant_id and role in `user_metadata` (set via the
 * `data` field of inviteUserByEmail). This works out-of-the-box with the
 * Supabase invite-flow email and is consistent across getCurrentUser and
 * getTenantUsers.
 *
 * Limitation: user_metadata is editable by the user themselves via
 * `auth.updateUser({ data })`, so a malicious user could change their own
 * role / tenant. For PRODUCTION we should move these fields to a dedicated
 * `user_profiles` table protected by RLS (only service_role can write
 * tenant_id / role). Tracked as a follow-up.
 *
 * Avoid using `app_metadata` here — setting it via updateUserById right
 * after inviteUserByEmail invalidates the invite token, which breaks the
 * accept-invite flow ("session expired" on password set).
 */

export async function getTenantUsers(
  tenantId: string
): Promise<UserListItem[]> {
  const supabase = await createServiceClient();

  const {
    data: { users },
    error,
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (error) throw error;

  return (users ?? [])
    .filter((user) => user.user_metadata?.tenant_id === tenantId)
    .map((user) => ({
      id: user.id,
      email: user.email ?? "",
      role: (user.user_metadata?.role as UserRole) ?? "viewer",
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
    }));
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
    data: {
      tenant_id: payload.tenant_id,
      role: payload.role,
    },
    redirectTo,
  });

  if (error) {
    if (error.message?.includes("already been registered")) {
      throw new Error("Este email ya tiene una cuenta registrada");
    }
    throw error;
  }

  if (!user) throw new Error("No se pudo crear la invitacion");

  return { id: user.id, email: user.email ?? payload.email };
}
