"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDeviceAction } from "@/app/(dashboard)/admin/actions";

interface CreateDeviceFormProps {
  tenantId: string;
  onClose: () => void;
}

export function CreateDeviceForm({ tenantId, onClose }: CreateDeviceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [serial, setSerial] = useState("");
  const [label, setLabel] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("serial", serial);
    formData.set("label", label);
    formData.set("tenant_id", tenantId);

    startTransition(async () => {
      const result = await createDeviceAction(formData);
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
          Serial *
        </label>
        <input
          type="text"
          value={serial}
          onChange={(e) => setSerial(e.target.value.toUpperCase())}
          required
          autoFocus
          placeholder="XRF-002"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-400">
          Nombre (opcional)
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Equipo Planta Norte"
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
          {isPending ? "Agregando..." : "Agregar Dispositivo"}
        </button>
      </div>
    </form>
  );
}
