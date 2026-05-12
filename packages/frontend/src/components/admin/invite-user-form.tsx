"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteUserAction } from "@/app/(dashboard)/admin/actions";
import { INVITE_ROLES } from "@/constants/roles";
import { RoleSelector } from "./role-selector";

interface InviteUserFormProps {
  tenantId: string;
  onClose: () => void;
}

export function InviteUserForm({ tenantId, onClose }: InviteUserFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(INVITE_ROLES[0]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("role", role);
    formData.set("tenant_id", tenantId);

    startTransition(async () => {
      const result = await inviteUserAction(formData);
      if (result.success) {
        setSuccess(`Invitacion enviada a ${email}`);
        setEmail("");
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
          Email *
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          placeholder="usuario@empresa.cl"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-400">
          Rol *
        </label>
        <RoleSelector value={role} onChange={setRole} />
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {success}
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
          {isPending ? "Invitando..." : "Enviar Invitacion"}
        </button>
      </div>
    </form>
  );
}
