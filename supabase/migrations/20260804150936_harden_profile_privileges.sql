-- Harden profile privileges: restrict DML to personal columns, prevent
-- role escalation via trigger, revoke limited_profiles access.
-- Forward-only migration (no rollback section).

BEGIN;

-- Ensure default role is 'user' for new profiles
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';

-- Trigger that blocks role escalation and cross-user modifications
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

-- Revoke execute from client roles (trigger runs as owner)
REVOKE ALL ON FUNCTION public.guard_profile_protected_fields() FROM PUBLIC, anon, authenticated;

-- Attach trigger
DROP TRIGGER IF EXISTS guard_profile_protected_fields ON public.profiles;
CREATE TRIGGER guard_profile_protected_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_protected_fields();

-- Revoke broad DML, then grant only personal columns
REVOKE INSERT, UPDATE ON TABLE public.profiles FROM anon, authenticated;

GRANT INSERT (
  id, full_name, matricula, adscripcion, categoria, antiguedad, phone, avatar_url
) ON TABLE public.profiles TO authenticated;

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

-- Revoke all DML on limited_profiles (social view no longer needed by app)
REVOKE ALL PRIVILEGES ON TABLE public.limited_profiles FROM anon, authenticated;

COMMIT;
