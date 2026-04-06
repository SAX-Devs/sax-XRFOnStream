ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_spectra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_equipment_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_concentrations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
    SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
    SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- TENANTS
CREATE POLICY "tenant_select" ON public.tenants FOR SELECT USING (
    id = public.get_user_tenant_id()
    OR public.get_user_role() = 'sax_admin'
);

-- DEVICES
CREATE POLICY "device_select" ON public.devices FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR public.get_user_role() = 'sax_admin'
);

-- TELEMETRY
CREATE POLICY "telemetry_select" ON public.device_telemetry FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR public.get_user_role() = 'sax_admin'
);
CREATE POLICY "telemetry_insert" ON public.device_telemetry FOR INSERT
    WITH CHECK (true);

-- SPECTRA
CREATE POLICY "spectra_select" ON public.device_spectra FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR public.get_user_role() = 'sax_admin'
);

-- COMMAND_AUDIT
CREATE POLICY "cmd_audit_select" ON public.command_audit FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR public.get_user_role() = 'sax_admin'
);
CREATE POLICY "cmd_audit_insert" ON public.command_audit FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR public.get_user_role() = 'sax_admin'
);

-- ALERTS
CREATE POLICY "alerts_select" ON public.alerts FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR public.get_user_role() = 'sax_admin'
);
CREATE POLICY "alerts_update" ON public.alerts FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id()
    OR public.get_user_role() = 'sax_admin'
);

-- EQUIPMENT STATE
CREATE POLICY "equip_state_select" ON public.device_equipment_state FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR public.get_user_role() = 'sax_admin'
);

-- CONCENTRATIONS
CREATE POLICY "concentrations_select" ON public.device_concentrations FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR public.get_user_role() = 'sax_admin'
);
