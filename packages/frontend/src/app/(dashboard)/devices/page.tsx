import { getDevices } from "@/services/devices";
import { DeviceCard } from "@/components/devices/device-card";

export default async function DevicesPage() {
  const devices = await getDevices();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dispositivos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Equipos XrfOnStream registrados en tu organizacion
        </p>
      </div>

      {devices.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-16">
      <p className="text-lg font-medium text-gray-400">
        No hay dispositivos registrados
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Contacta a SAX para agregar un equipo a tu cuenta
      </p>
    </div>
  );
}
