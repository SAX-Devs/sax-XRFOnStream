"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTenantAction } from "@/app/(dashboard)/admin/actions";

interface CreateTenantFormProps {
  onClose: () => void;
}

export function CreateTenantForm({ onClose }: CreateTenantFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("slug", slug);

    startTransition(async () => {
      const result = await createTenantAction(formData);
      if (result.success) {
        onClose();
        router.refresh();
      } else {
        setError(result.error ?? "Error desconocido");
      }
    });
  }

  return (
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
          placeholder="Minera Los Pelambres"
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
          placeholder="minera-los-pelambres"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
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
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-red-500 disabled:opacity-50"
        >
          {isPending ? "Creando..." : "Crear Tenant"}
        </button>
      </div>
    </form>
  );
}
