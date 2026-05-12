import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/constants/routes";
import { TopNav } from "@/components/layout/top-nav";
import type { UserRole } from "@/types/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  const email = user.email ?? "";
  const role = (user.app_metadata?.role as UserRole) ?? "viewer";

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a12]">
      <TopNav email={email} userRole={role} />

      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
