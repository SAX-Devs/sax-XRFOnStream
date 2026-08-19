-- Retention purge must never delete a module's LAST KNOWN state.
--
-- Incident 2026-08-18: interchanger_status sat unchanged for days (arm parked
-- in Chamber, locks engaged), so the change-only gateway stopped publishing
-- it; the hourly purge eventually deleted its last cloud row, and the
-- dashboard — with no row to read — rendered the chamber/door locks as OPEN
-- while the equipment was measuring normally.
--
-- Two-sided fix: the gateway now republishes every module at least every
-- 10 minutes (keepalive), and this purge keeps the newest row per
-- (device, module) regardless of age, as defense in depth for gateway
-- downtime longer than the retention window.

select cron.unschedule('telemetry-retention-purge');

select cron.schedule(
  'telemetry-retention-purge',
  '15 * * * *',
  $$
  DELETE FROM public.device_telemetry t
  WHERE t.received_at < now() - interval '3 days'
    AND t.id NOT IN (
      SELECT max(id)
      FROM public.device_telemetry
      GROUP BY device_id, module
    )
  $$
);
