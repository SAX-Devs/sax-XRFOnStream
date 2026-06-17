-- Device provisioning: store a device's HMAC secret + MQTT credentials.
--
-- private.device_secrets is not exposed to PostgREST (private schema), so writes
-- go through this SECURITY DEFINER RPC, callable only by service_role — mirroring
-- get_device_hmac_secret (00012) for reads. Also stamps devices.provisioned_at so
-- the dashboard can show provisioning status (the secret table stays private).

CREATE OR REPLACE FUNCTION public.upsert_device_secret(
    p_device_id      UUID,
    p_hmac_secret_hex TEXT,
    p_mqtt_username  TEXT,
    p_mqtt_password  TEXT
)
RETURNS VOID AS $$
    INSERT INTO private.device_secrets (device_id, hmac_secret, mqtt_username, mqtt_password)
    VALUES (
        p_device_id,
        decode(p_hmac_secret_hex, 'hex'),
        p_mqtt_username,
        p_mqtt_password
    )
    ON CONFLICT (device_id) DO UPDATE
    SET hmac_secret   = EXCLUDED.hmac_secret,
        mqtt_username = EXCLUDED.mqtt_username,
        mqtt_password = EXCLUDED.mqtt_password;

    UPDATE public.devices SET provisioned_at = now() WHERE id = p_device_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.upsert_device_secret(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_device_secret(UUID, TEXT, TEXT, TEXT) TO service_role;

-- Backfill: mark already-seeded devices (e.g. the demo device) as provisioned,
-- so the status indicator is accurate from the start.
UPDATE public.devices d
SET provisioned_at = COALESCE(d.provisioned_at, now())
WHERE EXISTS (
    SELECT 1 FROM private.device_secrets s WHERE s.device_id = d.id
);
