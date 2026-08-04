-- apply-profile-hardening-remote.sql
-- Apply profile hardening to remote Supabase.
-- DO NOT EXECUTE without explicit authorization and confirmed backup.
--
-- This script:
-- - Sets role DEFAULT to 'user'
-- - Creates guard trigger
-- - Revokes broad DML, grants column-level only
-- - Tightens RLS policies
-- - Revokes limited_profiles access
--
-- This script does NOT:
-- - Drop any tables
-- - Drop chat or forum objects
-- - Modify payroll data
-- - Change imported_payslips
-- - Alter formulas

BEGIN;

-- ============================================================
-- PRECONDITION CHECKS
-- Abort automatically if preconditions fail.
-- ============================================================

-- 1. Backup confirmation (manual check — this block just documents it)
-- Before running this script, confirm:
--   - Supabase dashboard backup exists, OR
--   - pg_dump was performed, OR
--   - PITR is enabled

-- 2. Verify we're connected to the right database
DO $$
BEGIN
  IF current_database() != 'postgres' THEN
    RAISE EXCEPTION 'precondition failed: wrong database (%)', current_database();
  END IF;
END
$$;

-- 3. Verify profiles table exists and has expected columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name = 'role'
  ) THEN
    RAISE EXCEPTION 'precondition failed: profiles.role column missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'precondition failed: profiles.id column missing';
  END IF;
END
$$;

-- 4. Verify current grants match inventory (anon has full DML)
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'profiles'
  AND grantee = 'anon' AND privilege_type = 'SELECT';

  IF v_count = 0 THEN
    RAISE WARNING 'precondition warning: anon does not have SELECT on profiles (may already be hardened)';
  END IF;
END
$$;

-- 5. Verify no unexpected functions depend on limited_profiles
-- (This is a documentation check — the actual dependency search
-- should be done in code before running this script.)

-- 6. Verify confirm_imported_payslip exists and has expected signature
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'confirm_imported_payslip'
    AND prosecdef = true
  ) THEN
    RAISE EXCEPTION 'precondition failed: confirm_imported_payslip not found or not SECURITY DEFINER';
  END IF;
END
$$;

-- ============================================================
-- APPLY HARDENING
-- ============================================================

-- Set role default
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';

-- Create guard function
CREATE OR REPLACE FUNCTION public.guard_profile_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
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

-- Revoke execute from client roles
REVOKE ALL ON FUNCTION public.guard_profile_protected_fields()
  FROM PUBLIC, anon, authenticated;

-- Attach trigger
DROP TRIGGER IF EXISTS guard_profile_protected_fields ON public.profiles;
CREATE TRIGGER guard_profile_protected_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_protected_fields();

-- Revoke broad DML
REVOKE INSERT, UPDATE ON TABLE public.profiles FROM anon, authenticated;

-- Grant SELECT on table
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- Grant column-level INSERT
GRANT INSERT (
  id, full_name, matricula, adscripcion, categoria, antiguedad, phone, avatar_url
) ON TABLE public.profiles TO authenticated;

-- Grant column-level UPDATE
GRANT UPDATE (
  full_name, matricula, adscripcion, categoria, antiguedad, phone, avatar_url
) ON TABLE public.profiles TO authenticated;

-- Tighten RLS policies
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

-- Revoke limited_profiles
REVOKE ALL PRIVILEGES ON TABLE public.limited_profiles FROM anon, authenticated;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Verify trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_profile_protected_fields'
    AND tgrelid = 'public.profiles'::regclass
  ) THEN
    RAISE EXCEPTION 'verification failed: trigger not created';
  END IF;
END
$$;

-- Verify role default
DO $$
DECLARE v_default text;
BEGIN
  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name = 'role';

  IF v_default NOT LIKE '%user%' THEN
    RAISE EXCEPTION 'verification failed: role default is not user (got %)', v_default;
  END IF;
END
$$;

-- Verify authenticated has SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'profiles'
    AND grantee = 'authenticated' AND privilege_type = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'verification failed: authenticated lost SELECT';
  END IF;
END
$$;

-- Verify anon lost DML
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'profiles'
    AND grantee = 'anon' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'verification failed: anon still has DML';
  END IF;
END
$$;

-- Verify limited_profiles revoked
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'limited_profiles'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'verification failed: limited_profiles still has grants';
  END IF;
END
$$;

RAISE NOTICE 'Profile hardening applied and verified successfully.';

COMMIT;
