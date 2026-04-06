CREATE TABLE public.device_spectra (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id       UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    measurement_id  TEXT,
    spectra_data    JSONB,
    run_data        JSONB,
    storage_path    TEXT,
    device_ts       TIMESTAMPTZ NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spectra_device_ts
    ON public.device_spectra(device_id, device_ts DESC);
CREATE INDEX idx_spectra_tenant
    ON public.device_spectra(tenant_id);
