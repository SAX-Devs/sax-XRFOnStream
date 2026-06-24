"use client";

import { useState } from "react";
import { ROLE_LABELS } from "@/constants/roles";
import { Modal } from "@/components/ui/modal";
import { CreateDeviceForm } from "@/components/admin/create-device-form";
import { InviteUserForm } from "@/components/admin/invite-user-form";
import { DeleteDeviceButton } from "@/components/admin/delete-device-button";
import type { Device } from "@/types/devices";
import type { UserListItem } from "@/types/users";
import type { DeviceStatusEnum } from "@/types/database";

interface TenantDetailActionsProps {
  tenantId: string;
  devices: Device[];
  users: UserListItem[];
}

const STATUS_STYLES: Record<DeviceStatusEnum, { label: string; className: string }> = {
  active: { label: "Activo", className: "text-emerald-400" },
  pending_activation: { label: "Pendiente", className: "text-amber-400" },
  offline: { label: "Offline", className: "text-gray-500" },
  maintenance: { label: "Mantenimiento", className: "text-blue-400" },
  decommissioned: { label: "Descomisionado", className: "text-gray-600" },
};

export function TenantDetailActions({
  tenantId,
  devices,
  users,
}: TenantDetailActionsProps) {
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  return (
    <>
      <div className="space-y-8">
        {/* Devices Section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Dispositivos
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({devices.length})
              </span>
            </h2>
            <button
              onClick={() => setShowDeviceModal(true)}
              className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-300 transition-all hover:bg-white/10 hover:text-white"
            >
              + Agregar Dispositivo
            </button>
          </div>

          {devices.length === 0 ? (
            <EmptySection text="No hay dispositivos registrados" />
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/8">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8 bg-white/[0.02]">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Serial
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Nombre
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Estado
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Ultimo contacto
                    </th>
                    <th className="w-12 px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {devices.map((device) => {
                    const status = STATUS_STYLES[device.status] ?? STATUS_STYLES.offline;
                    return (
                      <tr
                        key={device.id}
                        className="transition-colors hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-4 font-mono text-sm text-gray-200">
                          {device.serial}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-400">
                          {device.label ?? "—"}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-sm font-medium ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-sm text-gray-600">
                          {device.last_seen_at
                            ? formatDate(device.last_seen_at)
                            : "Nunca"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <DeleteDeviceButton
                            deviceId={device.id}
                            serial={device.serial}
                            label={device.label}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Users Section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Usuarios
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({users.length})
              </span>
            </h2>
            <button
              onClick={() => setShowUserModal(true)}
              className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-300 transition-all hover:bg-white/10 hover:text-white"
            >
              + Invitar Usuario
            </button>
          </div>

          {users.length === 0 ? (
            <EmptySection text="No hay usuarios registrados" />
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/8">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8 bg-white/[0.02]">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Email
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Rol
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Ultimo acceso
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-4 text-sm text-gray-200">
                        {u.email}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-gray-400">
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-600">
                        {u.last_sign_in_at
                          ? formatDate(u.last_sign_in_at)
                          : "Nunca"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      <Modal
        open={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        title="Agregar Dispositivo"
      >
        <CreateDeviceForm
          tenantId={tenantId}
          onClose={() => setShowDeviceModal(false)}
        />
      </Modal>

      <Modal
        open={showUserModal}
        onClose={() => setShowUserModal(false)}
        title="Invitar Usuario"
      >
        <InviteUserForm
          tenantId={tenantId}
          onClose={() => setShowUserModal(false)}
        />
      </Modal>
    </>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 py-10">
      <p className="text-sm text-gray-600">{text}</p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
