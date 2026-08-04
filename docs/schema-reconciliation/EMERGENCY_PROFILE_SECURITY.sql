-- DOCUMENTED HOTFIX ONLY. NOT EXECUTED ON LOCAL OR REMOTE DATABASES.
-- Review, test on a disposable local reset, back up, and approve before use.
-- This file is intentionally outside supabase/migrations.

-- ============================================================================
-- 1. PRE-FLIGHT (READ ONLY)
-- ============================================================================

BEGIN TRANSACTION READ ONLY;

SELECT role, count(*) AS profile_count
FROM public.profiles
GROUP BY role
ORDER BY role;

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'limited_profiles')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

SELECT table_name, view_definition, is_updatable, is_insertable_into
FROM information_schema.views
WHERE table_schema = 'public' AND table_name = 'limited_profiles';

COMMIT;

-- Stop if `profiles.role` contains a value outside user/admin, if expected
-- policies are missing, or if the view definition differs from the inventory.

-- ============================================================================
-- 2. APPLY HOTFIX
-- ============================================================================

BEGIN;

LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';

CREATE OR REPLACE FUNCTION public.guard_profile_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Auth/service trigger operations without an end-user JWT remain possible.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'profiles.id must match auth.uid()';
    END IF;
    IF NEW.role IS DISTINCT FROM 'user' THEN
      RAISE EXCEPTION 'profiles.role must use the user default';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profiles.id is immutable';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'profiles.role is immutable';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'profiles.created_at is immutable';
  END IF;

  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_protected_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_profile_protected_fields ON public.profiles;
CREATE TRIGGER guard_profile_protected_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_protected_fields();

-- Remove table-wide client write privileges, then grant only personal columns.
REVOKE INSERT, UPDATE ON TABLE public.profiles FROM anon, authenticated;

GRANT INSERT (
  id,
  full_name,
  matricula,
  adscripcion,
  categoria,
  antiguedad,
  phone,
  avatar_url
) ON TABLE public.profiles TO authenticated;

GRANT UPDATE (
  full_name,
  matricula,
  adscripcion,
  categoria,
  antiguedad,
  phone,
  avatar_url
) ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'user');

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- The social view is no longer needed by the application. Keep the object until
-- the later data-removal migration, but make it read/write inaccessible now.
REVOKE ALL PRIVILEGES ON TABLE public.limited_profiles FROM anon, authenticated;

COMMIT;

-- ============================================================================
-- 3. POST-APPLY VERIFICATION (READ ONLY)
-- ============================================================================

BEGIN TRANSACTION READ ONLY;

SELECT
  has_table_privilege('authenticated', 'public.profiles', 'INSERT') AS broad_insert,
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') AS broad_update,
  has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') AS can_update_name,
  has_column_privilege('authenticated', 'public.profiles', 'matricula', 'UPDATE') AS can_update_matricula,
  has_column_privilege('authenticated', 'public.profiles', 'role', 'INSERT') AS can_insert_role,
  has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') AS can_update_role,
  has_table_privilege('authenticated', 'public.limited_profiles', 'SELECT') AS can_read_limited,
  has_table_privilege('authenticated', 'public.limited_profiles', 'INSERT') AS can_insert_limited,
  has_table_privilege('authenticated', 'public.limited_profiles', 'UPDATE') AS can_update_limited,
  has_table_privilege('anon', 'public.limited_profiles', 'SELECT') AS anon_can_read_limited;

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

SELECT trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND event_object_table = 'profiles'
ORDER BY trigger_name, event_manipulation;

COMMIT;

-- Expected booleans: broad_insert=false, broad_update=false,
-- can_update_name=true, can_update_matricula=true, role privileges=false,
-- and every limited_profiles privilege shown above=false.

-- ============================================================================
-- 4. DISPOSABLE LOCAL TESTS (DO NOT RUN AGAINST PRODUCTION)
-- ============================================================================
-- Run only after a local `supabase db reset`. The complete section is wrapped
-- in a transaction and rolls back every synthetic identity and row.

/*
BEGIN;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-00000000b001', 'authenticated', 'authenticated', 'profile-one@test.local', '', now(), '{}', '{"full_name":"Email User"}', now(), now()),
  ('00000000-0000-0000-0000-00000000b002', 'authenticated', 'authenticated', 'profile-two@test.local', '', now(), '{}', '{"name":"OAuth User","avatar_url":"https://example.invalid/avatar.png"}', now(), now()),
  ('00000000-0000-0000-0000-00000000b003', 'authenticated', 'authenticated', 'profile-insert@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000b004', 'authenticated', 'authenticated', 'profile-ensure@test.local', '', now(), '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '00000000-0000-0000-0000-00000000b001'
      AND full_name = 'Email User'
      AND role = 'user'
  ) THEN
    RAISE EXCEPTION 'email profile trigger failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '00000000-0000-0000-0000-00000000b002'
      AND full_name = 'OAuth User'
      AND avatar_url = 'https://example.invalid/avatar.png'
      AND role = 'user'
  ) THEN
    RAISE EXCEPTION 'OAuth profile trigger failed';
  END IF;
END
$$;

DELETE FROM public.profiles
WHERE id IN (
  '00000000-0000-0000-0000-00000000b003',
  '00000000-0000-0000-0000-00000000b004'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b001';
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated"}';

DO $$
DECLARE
  v_rows integer;
  v_denied boolean;
BEGIN
  UPDATE public.profiles
     SET full_name = 'Updated Name', matricula = 'SYNTH001'
   WHERE id = '00000000-0000-0000-0000-00000000b001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'own name/matricula update failed';
  END IF;

  v_denied := false;
  BEGIN
    UPDATE public.profiles SET role = 'admin'
    WHERE id = '00000000-0000-0000-0000-00000000b001';
  EXCEPTION WHEN OTHERS THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'role update was allowed';
  END IF;

  UPDATE public.profiles SET full_name = 'Forbidden'
  WHERE id = '00000000-0000-0000-0000-00000000b002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'other profile update was allowed';
  END IF;

  v_denied := false;
  BEGIN
    INSERT INTO public.limited_profiles (id, full_name)
    VALUES ('00000000-0000-0000-0000-00000000b001', 'Forbidden');
  EXCEPTION WHEN OTHERS THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'limited_profiles write was allowed';
  END IF;
END
$$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b003';
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b003","role":"authenticated"}';

DO $$
DECLARE v_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES ('00000000-0000-0000-0000-00000000b003', 'Escalation', 'admin');
  EXCEPTION WHEN OTHERS THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'admin role insert was allowed';
  END IF;
END
$$;

RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM count(*) FROM public.limited_profiles;
  EXCEPTION WHEN OTHERS THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'anon read limited_profiles';
  END IF;
END
$$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b004';
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b004","role":"authenticated"}';

SELECT public.ensure_profile_exists();

INSERT INTO public.profiles (id, full_name, matricula)
VALUES ('00000000-0000-0000-0000-00000000b004', 'Profile Form', 'SYNTH004')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  matricula = EXCLUDED.matricula;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '00000000-0000-0000-0000-00000000b004'
      AND full_name = 'Profile Form'
      AND matricula = 'SYNTH004'
      AND role = 'user'
  ) THEN
    RAISE EXCEPTION 'ensure_profile_exists/ProfileForm upsert failed';
  END IF;
END
$$;

RESET ROLE;
ROLLBACK;
*/

-- ============================================================================
-- 5. ROLLBACK PROCEDURE (RESTORES THE CURRENT UNSAFE STATE)
-- ============================================================================
-- Use only after an approved incident decision. This rollback reopens the
-- original privilege-escalation path and is included solely for recoverability.

/*
BEGIN;

DROP TRIGGER IF EXISTS guard_profile_protected_fields ON public.profiles;
DROP FUNCTION IF EXISTS public.guard_profile_protected_fields();

REVOKE INSERT (
  id, full_name, matricula, adscripcion, categoria, antiguedad, phone, avatar_url
) ON TABLE public.profiles FROM authenticated;
REVOKE UPDATE (
  full_name, matricula, adscripcion, categoria, antiguedad, phone, avatar_url
) ON TABLE public.profiles FROM authenticated;

GRANT INSERT, UPDATE ON TABLE public.profiles TO anon, authenticated;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

GRANT SELECT ON TABLE public.limited_profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.limited_profiles TO anon, authenticated;

COMMIT;
*/
