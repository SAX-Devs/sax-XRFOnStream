import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasMinimumRole } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import type { UserProfile, UserRole } from "@/types/auth";

/**
 * Returns the current user profile from the Supabase session,
 * or null if not authenticated.
 *
 * tenant_id / role come from the protected `user_profiles` table (migration
 * 00013). RLS lets the user read only their own row.
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    tenantId: profile?.tenant_id ?? "",
    role: (profile?.role as UserRole) ?? "viewer",
  };
}

/**
 * Returns the current user profile or redirects to login.
 * Use in Server Components that require authentication.
 */
export async function requireAuth(): Promise<UserProfile> {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.LOGIN);
  return user;
}

/**
 * Returns the current user profile or redirects if the user
 * does not have the minimum required role.
 * Redirects to login if not authenticated, to /devices if insufficient role.
 */
export async function requireRole(
  minimumRole: UserRole
): Promise<UserProfile> {
  const user = await requireAuth();
  if (!hasMinimumRole(user.role, minimumRole)) {
    redirect(ROUTES.DEVICES);
  }
  return user;
}
