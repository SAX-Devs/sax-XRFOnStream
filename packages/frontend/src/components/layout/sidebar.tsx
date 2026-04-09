"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/constants/routes";

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: ROUTES.DEVICES, label: "Dispositivos" },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: ROUTES.ADMIN_TENANTS, label: "Tenants" },
];

interface SidebarProps {
  userRole: string;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "sax_admin" || userRole === "tenant_admin";

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <Link href={ROUTES.DEVICES} className="text-lg font-semibold text-gray-900">
          SAX XrfOnStream
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <SectionLabel>Principal</SectionLabel>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          >
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <SectionLabel>Administración</SectionLabel>
            {ADMIN_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                active={pathname.startsWith(item.href)}
              >
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 mt-4 px-3 text-xs font-medium uppercase tracking-wider text-gray-400">
      {children}
    </p>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-gray-100 text-gray-900"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      {children}
    </Link>
  );
}
