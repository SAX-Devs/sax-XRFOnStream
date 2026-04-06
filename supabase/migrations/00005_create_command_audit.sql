CREATE TYPE public.command_status_enum AS ENUM (
    'sent', 'delivered', 'ack', 'executing', 'completed', 'error', 'rejected', 'expired'
);

CREATE TABLE public.command_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    issued_by       UUID NOT NULL,
    issued_by_email TEXT NOT NULL,
    issued_by_role  TEXT NOT NULL,
    module          TEXT NOT NULL,
    command         TEXT NOT NULL,
    args            JSONB,
    status          public.command_status_enum NOT NULL DEFAULT 'sent',
    error_message   TEXT,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    ack_at          TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_cmd_audit_device_ts
    ON public.command_audit(device_id, sent_at DESC);
CREATE INDEX idx_cmd_audit_tenant
    ON public.command_audit(tenant_id);
CREATE INDEX idx_cmd_audit_status
    ON public.command_audit(status) WHERE status NOT IN ('completed', 'error', 'expired');
