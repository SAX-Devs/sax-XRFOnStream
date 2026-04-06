CREATE TYPE public.equipment_state_enum AS ENUM (
    'unknown', 'idle', 'measuring', 'initializing', 'standby', 'error', 'offline'
);

CREATE TABLE public.device_equipment_state (
    device_id       UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    state           public.equipment_state_enum NOT NULL DEFAULT 'unknown',
    detail          JSONB,
    device_ts       TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equip_state_tenant ON public.device_equipment_state(tenant_id);
