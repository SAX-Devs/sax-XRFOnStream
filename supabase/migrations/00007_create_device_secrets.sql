CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE private.device_secrets (
    device_id   UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
    hmac_secret BYTEA NOT NULL,
    mqtt_username TEXT NOT NULL,
    mqtt_password TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON private.device_secrets FROM anon, authenticated;
