-- Data retention for raw telemetry.
--
-- The dashboard only reads the LATEST row per module; spectra, alerts and
-- command audit live in their own tables with their own value. Without
-- retention, device_telemetry grew ~115 MB/day (699 MB in ~6 days) and blew
-- the Supabase Free 500 MB database quota (reached 156%).
--
-- Policy agreed 2026-07-08: keep 3 days of raw telemetry (covers "what
-- happened last night" incident forensics), purge nightly via pg_cron, then a
-- plain VACUUM so the freed space is reused and the table size plateaus.
-- If SAX upgrades to Supabase Pro and wants longer history, only the interval
-- below changes.
--
-- NOTE: deliberately NO index on received_at — the purge runs once a day and
-- can afford a scan, while an index would tax every ~2s insert.

create extension if not exists pg_cron;

-- Hourly: delete telemetry older than 3 days. Hourly (not daily) so the table
-- size stays flat (~410 MB) instead of sawtoothing up to ~4 days (~530 MB)
-- between purges and flirting with the 500 MB Free quota.
select cron.schedule(
  'telemetry-retention-purge',
  '15 * * * *',
  $$DELETE FROM public.device_telemetry WHERE received_at < now() - interval '3 days'$$
);

-- 03:45 UTC daily: reclaim the freed space for reuse (keeps size flat).
select cron.schedule(
  'telemetry-retention-vacuum',
  '45 3 * * *',
  $$VACUUM (ANALYZE) public.device_telemetry$$
);
