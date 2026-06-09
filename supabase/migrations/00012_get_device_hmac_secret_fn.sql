-- Returns the HMAC secret for a device from the private schema.
-- SECURITY DEFINER so the command Route Handler (service_role) can read
-- private.device_secrets without that table being exposed to anon/authenticated.
-- search_path is pinned empty to prevent search_path injection; every object
-- is referenced with an explicit schema.
CREATE OR REPLACE FUNCTION public.get_device_hmac_secret(p_device_id UUID)
RETURNS BYTEA AS $$
    SELECT hmac_secret
    FROM private.device_secrets
    WHERE device_id = p_device_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- Lock down: CREATE FUNCTION grants EXECUTE to PUBLIC by default (which includes
-- anon and authenticated). Remove that and grant only to service_role, the role
-- used server-side by the command Route Handler.
REVOKE EXECUTE ON FUNCTION public.get_device_hmac_secret(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_device_hmac_secret(UUID) TO service_role;
