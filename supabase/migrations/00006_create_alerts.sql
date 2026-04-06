CREATE TYPE public.alert_severity_enum AS ENUM ('info', 'warning', 'critical', 'emergency');

CREATE TABLE public.alerts (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id   UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    severity    public.alert_severity_enum NOT NULL,
    source      TEXT NOT NULL,
    title       TEXT NOT NULL,
    detail      JSONB,
    ack_by      UUID,
    ack_at      TIMESTAMPTZ,
    device_ts   TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_device_ts
    ON public.alerts(device_id, device_ts DESC);
CREATE INDEX idx_alerts_tenant_severity
    ON public.alerts(tenant_id, severity);
CREATE INDEX idx_alerts_unacked
    ON public.alerts(device_id) WHERE ack_at IS NULL;
