-- Enable Realtime broadcasting for low-frequency tables.
--
-- The supabase_realtime publication was empty, so postgres_changes
-- subscriptions in the frontend never received anything — every "live" screen
-- only refreshed on page load.
--
-- device_telemetry is deliberately EXCLUDED: it inserts every ~2s per device;
-- broadcasting it would send tens of millions of Realtime messages per month
-- for a single open dashboard and blow through quotas. The frontend polls the
-- latest telemetry row every 3s instead (SCADA-style), matching the gateway's
-- own 2s publish cadence. device_spectra/device_concentrations are also
-- excluded (fetched on demand by the Measurements screen).

ALTER PUBLICATION supabase_realtime ADD TABLE public.device_equipment_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.command_audit;
