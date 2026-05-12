"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { CreateTenantForm } from "@/components/admin/create-tenant-form";

export function CreateTenantButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-red-500"
      >
        + Crear Tenant
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo Tenant">
        <CreateTenantForm onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}
