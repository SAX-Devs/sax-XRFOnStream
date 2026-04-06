CREATE TYPE public.device_status_enum AS ENUM (
    'pending_activation', 'active', 'offline', 'maintenance', 'decommissioned'
);

CREATE TABLE public.devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    serial          TEXT NOT NULL UNIQUE,
    label           TEXT,
    status          public.device_status_enum NOT NULL DEFAULT 'pending_activation',
    firmware_version TEXT,
    last_seen_at    TIMESTAMPTZ,
    mqtt_client_id  TEXT UNIQUE,
    provisioned_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_devices_tenant ON public.devices(tenant_id);
CREATE INDEX idx_devices_serial ON public.devices(serial);
