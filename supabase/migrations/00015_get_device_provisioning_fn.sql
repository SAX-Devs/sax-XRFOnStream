-- Reads a device's full provisioning bundle (HMAC secret as hex + MQTT
-- credentials) from the private schema. Used by generate-provision-package.sh to
-- build the Edge Gateway package. SECURITY DEFINER, callable only by
-- service_role — mirrors get_device_hmac_secret/upsert_device_secret.

CREATE OR REPLACE FUNCTION public.get_device_provisioning(p_device_id UUID)
RETURNS TABLE (
    hmac_secret_hex TEXT,
    mqtt_username   TEXT,
    mqtt_password   TEXT
) AS $$
    SELECT
        encode(hmac_secret, 'hex'),
        mqtt_username,
        mqtt_password
    FROM private.device_secrets
    WHERE device_id = p_device_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.get_device_provisioning(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_device_provisioning(UUID) TO service_role;
