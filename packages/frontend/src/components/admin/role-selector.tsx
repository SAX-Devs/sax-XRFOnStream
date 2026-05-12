"use client";

import { useState, useRef, useEffect } from "react";
import { INVITE_ROLES, ROLE_LABELS } from "@/constants/roles";
import type { UserRole } from "@/types/auth";

const ROLE_INFO: Record<string, { description: string; color: string }> = {
  viewer: {
    description: "Solo puede ver datos y telemetria del equipo",
    color: "bg-gray-500",
  },
  operator: {
    description:
      "Puede inicializar modulos, lanzar mediciones y controles de emergencia",
    color: "bg-blue-500",
  },
  service: {
    description:
      "Control total de todos los modulos del equipo: voltaje, vacio, circulacion, etc.",
    color: "bg-amber-500",
  },
  tenant_admin: {
    description:
      "Gestiona usuarios y dispositivos de su empresa. Ve todos los datos de su organizacion",
    color: "bg-red-500",
  },
};

interface RoleSelectorProps {
  value: UserRole;
  onChange: (role: UserRole) => void;
}

export function RoleSelector({ value, onChange }: RoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [tooltipRole, setTooltipRole] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedInfo = ROLE_INFO[value];

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-white outline-none transition-all hover:border-white/20 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2 w-2 rounded-full ${selectedInfo?.color ?? "bg-gray-500"}`}
          />
          <span>{ROLE_LABELS[value]}</span>
        </div>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 z-10 mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a24] py-1 shadow-2xl">
          {INVITE_ROLES.map((role) => {
            const info = ROLE_INFO[role];
            const isSelected = role === value;
            return (
              <div key={role} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    onChange(role);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-white/[0.06] text-white"
                      : "text-gray-300 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-2 w-2 rounded-full ${info?.color ?? "bg-gray-500"}`}
                    />
                    <span className="font-medium">{ROLE_LABELS[role]}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <svg
                        className="h-4 w-4 text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    )}

                    {/* Info icon with tooltip */}
                    <div
                      className="relative"
                      onMouseEnter={() => setTooltipRole(role)}
                      onMouseLeave={() => setTooltipRole(null)}
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-white/10 hover:text-gray-400">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                          />
                        </svg>
                      </div>

                      {tooltipRole === role && (
                        <div className="fixed z-[100] w-56 rounded-lg border border-white/10 bg-[#0e0e18] px-3 py-2 text-xs leading-relaxed text-gray-300 shadow-xl"
                          style={{
                            top: "var(--tooltip-top, 0)",
                            left: "var(--tooltip-left, 0)",
                          }}
                          ref={(el) => {
                            if (!el) return;
                            const icon = el.previousElementSibling;
                            if (!icon) return;
                            const rect = icon.getBoundingClientRect();
                            el.style.top = `${rect.top - el.offsetHeight - 8}px`;
                            el.style.left = `${rect.right - el.offsetWidth}px`;
                          }}
                        >
                          {info?.description}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
