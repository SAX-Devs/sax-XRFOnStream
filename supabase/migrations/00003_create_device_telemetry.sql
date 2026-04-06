CREATE TABLE public.device_telemetry (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id   UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    module      TEXT NOT NULL,
    data        JSONB NOT NULL,
    device_ts   TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telemetry_device_module_ts
    ON public.device_telemetry(device_id, module, device_ts DESC);
CREATE INDEX idx_telemetry_tenant
    ON public.device_telemetry(tenant_id);
