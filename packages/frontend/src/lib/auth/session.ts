import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasMinimumRole } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import type { UserProfile, UserRole } from "@/types/auth";

/**
 * Returns the current user profile from the Supabase session,
 * or null if not authenticated.
 *
 * tenant_id / role live in user_metadata (set during invite). See the
 * note in services/users.ts for why this is a deliberate trade-off.
 * app_metadata is checked first as a forward-compatibility fallback for
 * users we may have provisioned via admin API in the future.
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const tenantId =
    (user.app_metadata?.tenant_id as string | undefined) ??
    (user.user_metadata?.tenant_id as string | undefined) ??
    "";
  const role =
    (user.app_metadata?.role as UserRole | undefined) ??
    (user.user_metadata?.role as UserRole | undefined) ??
    "viewer";

  return {
    id: user.id,
    email: user.email ?? "",
    tenantId,
    role,
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
