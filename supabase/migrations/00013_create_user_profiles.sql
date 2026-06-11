-- Move role/tenant_id to a protected user_profiles table.
--
-- Previously role/tenant_id lived in auth user_metadata, which the user can edit
-- themselves (auth.updateUser) — a privilege-escalation hole. user_profiles is
-- now the single source of truth: only service_role may write it, users may read
-- only their own row, and the RLS helper functions read from it (so role/tenant
-- can no longer be spoofed). No Auth Hook needed — the helpers read the table
-- directly via auth.uid().
--
-- Idempotent: an earlier effort created the table (dormant) on 2026-05-12, so
-- every statement tolerates pre-existing objects. The backfill reconciles each
-- profile from the historical source of truth (app_metadata/user_metadata),
-- fixing rows that were defaulted to 'viewer'.

CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id  UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    role       TEXT NOT NULL DEFAULT 'viewer'
        CHECK (role IN ('viewer', 'operator', 'service', 'tenant_admin', 'sax_admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant
    ON public.user_profiles(tenant_id);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users may read ONLY their own profile. No insert/update/delete policies, so
-- only service_role (which bypasses RLS) can write — this closes the hole.
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own" ON public.user_profiles
    FOR SELECT USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS helpers now read from the protected table instead of the JWT.
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM public.user_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM public.user_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- Safety net: every new auth user gets a default 'viewer' profile. inviteUser
-- upserts the real role/tenant via service_role immediately afterwards.
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, role)
    VALUES (NEW.id, 'viewer')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_auth_user_created ON auth.users;
CREATE TRIGGER trg_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Backfill / reconcile from the historical source of truth. DO UPDATE (not DO
-- NOTHING) so rows previously defaulted to 'viewer' get the correct role/tenant.
INSERT INTO public.user_profiles (user_id, tenant_id, role)
SELECT
    u.id,
    COALESCE(
        NULLIF(u.raw_app_meta_data ->> 'tenant_id', '')::uuid,
        NULLIF(u.raw_user_meta_data ->> 'tenant_id', '')::uuid
    ),
    COALESCE(
        u.raw_app_meta_data ->> 'role',
        u.raw_user_meta_data ->> 'role',
        'viewer'
    )
FROM auth.users u
ON CONFLICT (user_id) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    role = EXCLUDED.role,
    updated_at = now()
WHERE public.user_profiles.role IS DISTINCT FROM EXCLUDED.role
   OR public.user_profiles.tenant_id IS DISTINCT FROM EXCLUDED.tenant_id;
