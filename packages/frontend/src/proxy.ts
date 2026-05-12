import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { PUBLIC_ROUTES, ROUTES } from "@/constants/routes";
import { ADMIN_ROLES } from "@/constants/roles";
import type { UserRole } from "@/types/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always refresh the Supabase session (keeps the token alive)
  const { supabaseResponse, user } = await updateSession(request);

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Not authenticated → redirect to login (unless already on a public route)
  if (!user && !isPublicRoute) {
    const loginUrl = new URL(ROUTES.LOGIN, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user on login page → redirect to devices
  if (user && pathname === ROUTES.LOGIN) {
    return NextResponse.redirect(new URL(ROUTES.DEVICES, request.url));
  }

  // Admin routes require admin role (sax_admin or tenant_admin)
  if (user && pathname.startsWith("/admin")) {
    const role = (user.app_metadata?.role as UserRole) ?? "viewer";
    if (!ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL(ROUTES.DEVICES, request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image  (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
