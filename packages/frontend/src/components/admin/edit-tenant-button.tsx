"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { updateTenantAction } from "@/app/(dashboard)/admin/actions";

interface EditTenantButtonProps {
  tenantId: string;
  currentName: string;
  currentSlug: string;
}

export function EditTenantButton({
  tenantId,
  currentName,
  currentSlug,
}: EditTenantButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [slug, setSlug] = useState(currentSlug);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nameTrimmed = name.trim();
  const slugTrimmed = slug.trim();
  const hasChanges =
    nameTrimmed !== currentName || slugTrimmed !== currentSlug;
  const canSave =
    nameTrimmed.length > 0 && slugTrimmed.length > 0 && hasChanges && !isPending;

  // Mirror the create form: the slug auto-derives from the name as you type.
  function handleNameChange(value: string) {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
    );
  }

  function handleOpen() {
    setName(currentName);
    setSlug(currentSlug);
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("tenant_id", tenantId);
    formData.set("name", name);
    formData.set("slug", slug);

    startTransition(async () => {
      const result = await updateTenantAction(formData);
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
        onClick={handleOpen}
        aria-label="Editar nombre del tenant"
        title="Editar nombre"
        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
      >
        <PencilIcon />
      </button>

      <Modal open={open} onClose={handleClose} title="Editar Tenant">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Nombre de la empresa
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Slug (identificador unico)
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
            />
          </div>

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
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function PencilIcon() {
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
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
      />
    </svg>
  );
}
