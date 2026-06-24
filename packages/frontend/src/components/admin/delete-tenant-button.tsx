"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { deleteTenantAction } from "@/app/(dashboard)/admin/actions";

interface DeleteTenantButtonProps {
  tenantId: string;
  tenantName: string;
  deviceCount: number;
  userCount: number;
}

export function DeleteTenantButton({
  tenantId,
  tenantName,
  deviceCount,
  userCount,
}: DeleteTenantButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasDevices = deviceCount > 0;
  const nameMatches = confirm.trim() === tenantName;
  const canDelete = !hasDevices && nameMatches && !isPending;

  function handleClose() {
    setOpen(false);
    setConfirm("");
    setError(null);
  }

  function handleDelete() {
    setError(null);
    const formData = new FormData();
    formData.set("tenant_id", tenantId);
    formData.set("confirm_name", confirm);

    startTransition(async () => {
      const result = await deleteTenantAction(formData);
      if (result.success) {
        handleClose();
        router.refresh();
      } else {
        setError(result.error ?? "Error desconocido");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Eliminar ${tenantName}`}
        title="Eliminar tenant"
        className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
      >
        <TrashIcon />
      </button>

      <Modal open={open} onClose={handleClose} title="Eliminar Tenant">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Esta accion es{" "}
            <span className="font-semibold text-red-400">permanente</span> y no se
            puede deshacer.
          </p>

          {hasDevices ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs text-amber-300">
              No puedes eliminar{" "}
              <span className="font-semibold">{tenantName}</span> porque todavia
              tiene{" "}
              <span className="font-semibold">
                {deviceCount} {deviceCount === 1 ? "equipo" : "equipos"}
              </span>{" "}
              asociado{deviceCount === 1 ? "" : "s"}. Elimina o reasigna los
              equipos antes de borrar el tenant.
            </div>
          ) : (
            <>
              {userCount > 0 && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-gray-400">
                  Se desvincularan{" "}
                  <span className="font-semibold text-gray-300">
                    {userCount} {userCount === 1 ? "usuario" : "usuarios"}
                  </span>
                  : sus cuentas seguiran existiendo pero perderan el acceso a este
                  tenant.
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Escribe{" "}
                  <span className="font-semibold text-gray-200">
                    {tenantName}
                  </span>{" "}
                  para confirmar
                </label>
                <input
                  type="text"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  placeholder={tenantName}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
                />
              </div>
            </>
          )}

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:text-white"
            >
              Cancelar
            </button>
            {!hasDevices && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPending ? "Eliminando..." : "Eliminar Tenant"}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

function TrashIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
