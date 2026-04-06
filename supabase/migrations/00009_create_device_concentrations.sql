CREATE TABLE public.device_concentrations (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id   UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    measurement_id TEXT,
    elements    JSONB NOT NULL,
    device_ts   TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_concentrations_device_ts
    ON public.device_concentrations(device_id, device_ts DESC);
CREATE INDEX idx_concentrations_tenant
    ON public.device_concentrations(tenant_id);
