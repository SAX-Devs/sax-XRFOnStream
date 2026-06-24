"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/constants/routes";
import { ROLE_LABELS } from "@/constants/roles";
import type { UserRole } from "@/types/auth";

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: ROUTES.DEVICES, label: "Dispositivos" },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: ROUTES.ADMIN_TENANTS, label: "Admin" },
];

interface TopNavProps {
  email: string;
  userRole: UserRole;
  tenantName: string | null;
}

export function TopNav({ email, userRole, tenantName }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const isAdmin = userRole === "sax_admin" || userRole === "tenant_admin";

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push(ROUTES.LOGIN);
    router.refresh();
  }

  const allItems = [...NAV_ITEMS, ...(isAdmin ? ADMIN_ITEMS : [])];

  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center border-b border-white/8 bg-[#111118]/80 px-6 backdrop-blur-xl">
      {/* Logo */}
      <Link href={ROUTES.DEVICES} className="flex-shrink-0">
        <Image
          src="/sax-blanco.webp"
          alt="SAX"
          width={80}
          height={32}
          priority
          className="h-7 w-auto"
        />
      </Link>

      {/* Tenant (empresa) */}
      {tenantName && (
        <div className="mr-8 ml-4 flex items-center gap-3 border-l border-white/10 pl-4">
          <span className="text-sm font-semibold text-gray-200">
            {tenantName}
          </span>
        </div>
      )}
      {!tenantName && <div className="mr-8" />}

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {allItems.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-xs font-semibold text-white">
            {email.charAt(0).toUpperCase()}
          </div>
          <span className="hidden text-gray-300 sm:block">{email}</span>
          <ChevronDownIcon />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-[#1a1a24] p-1 shadow-2xl">
            <div className="border-b border-white/8 px-3 py-2.5">
              <p className="text-sm font-medium text-white">{email}</p>
              <p className="text-xs text-gray-500">{ROLE_LABELS[userRole]}</p>
            </div>
            <div className="pt-1">
              <button
                onClick={handleLogout}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                Cerrar sesion
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className="h-4 w-4 text-gray-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
