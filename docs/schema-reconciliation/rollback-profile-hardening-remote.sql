-- rollback-profile-hardening-remote.sql
-- Rollback profile hardening on remote Supabase.
-- Use only if the hardening migration caused issues.
--
-- This script reverses:
-- - guard_profile_protected_fields trigger and function
-- - REVOKE/GRANT changes on profiles
-- - RLS policy changes
-- - limited_profiles REVOKE
-- - role DEFAULT change
--
-- This script does NOT:
-- - Restore dropped data
-- - Re-create dropped tables
-- - Modify payroll data

BEGIN;

-- 1. Drop trigger
DROP TRIGGER IF EXISTS guard_profile_protected_fields ON public.profiles;

-- 2. Drop function
DROP FUNCTION IF EXISTS public.guard_profile_protected_fields();

-- 3. Restore table-level grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;

-- 4. Restore limited_profiles grants
GRANT SELECT ON TABLE public.limited_profiles TO anon;
GRANT SELECT ON TABLE public.limited_profiles TO authenticated;

-- 5. Restore original RLS policies
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 6. Remove role DEFAULT (set to null)
ALTER TABLE public.profiles
  ALTER COLUMN role DROP DEFAULT;

-- Verify rollback
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_profile_protected_fields'
    AND tgrelid = 'public.profiles'::regclass
  ) THEN
    RAISE EXCEPTION 'rollback failed: trigger still exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'profiles'
    AND grantee = 'anon' AND privilege_type = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'rollback failed: anon lost SELECT';
  END IF;

  RAISE NOTICE 'Profile hardening rolled back successfully.';
END
$$;

COMMIT;
