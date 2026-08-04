-- Profile security tests with hotfix applied.
-- Runs against local database after supabase db reset.
-- Any failure raises an exception and breaks CI.

-- ============================================================
-- Setup: create synthetic users (as postgres, before hotfix)
-- ============================================================
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-00000000b001', 'authenticated', 'authenticated', 'profile-one@test.local', '', now(), '{}', '{"full_name":"Email User"}', now(), now()),
  ('00000000-0000-0000-0000-00000000b002', 'authenticated', 'authenticated', 'profile-two@test.local', '', now(), '{}', '{"name":"OAuth User","avatar_url":"https://example.invalid/avatar.png"}', now(), now()),
  ('00000000-0000-0000-0000-00000000b003', 'authenticated', 'authenticated', 'profile-insert@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000b004', 'authenticated', 'authenticated', 'profile-ensure@test.local', '', now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- ============================================================
-- Ensure base DML grants exist (pre-existing gap in migrations)
-- The local migration chain never granted DML to authenticated
-- on profiles. This block establishes the pre-hotfix baseline
-- so the hotfix's REVOKE + column-grant can be tested.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

-- ============================================================
-- Apply hotfix (section 2 of EMERGENCY_PROFILE_SECURITY.sql)
-- ============================================================
BEGIN;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';

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

REVOKE ALL ON FUNCTION public.guard_profile_protected_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_profile_protected_fields ON public.profiles;
CREATE TRIGGER guard_profile_protected_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_protected_fields();

REVOKE INSERT, UPDATE ON TABLE public.profiles FROM anon, authenticated;

GRANT INSERT (
  id, full_name, matricula, adscripcion, categoria, antiguedad, phone, avatar_url
) ON TABLE public.profiles TO authenticated;

GRANT UPDATE (
  full_name, matricula, adscripcion, categoria, antiguedad, phone, avatar_url
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

REVOKE ALL PRIVILEGES ON TABLE public.limited_profiles FROM anon, authenticated;

COMMIT;

-- ============================================================
-- Test 1: user can create profile normally (via trigger)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '00000000-0000-0000-0000-00000000b001'
      and full_name = 'Email User'
      and role = 'user'
  ) then
    raise exception 'Test 1 FAILED: email profile trigger failed';
  end if;
end
$$;

-- ============================================================
-- Test 2: user can update allowed fields
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated"}';

do $$
declare v_rows integer;
begin
  update public.profiles
     set full_name = 'Updated Name', matricula = 'SYNTH001', adscripcion = 'Adsc',
         categoria = 'A', antiguedad = '1', phone = '555', avatar_url = 'https://x.invalid/a.png'
   where id = '00000000-0000-0000-0000-00000000b001';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Test 2 FAILED: own profile update failed (rows=%)', v_rows;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 3: user cannot insert role = admin
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b003';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b003","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    insert into public.profiles (id, full_name, role)
    values ('00000000-0000-0000-0000-00000000b003', 'Escalation', 'admin');
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 3 FAILED: admin role insert was allowed';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 4: user cannot update own role
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    update public.profiles set role = 'admin'
    where id = '00000000-0000-0000-0000-00000000b001';
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 4 FAILED: role update was allowed';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 5: user cannot modify another user's profile
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated"}';

do $$
declare v_rows integer;
begin
  update public.profiles set full_name = 'Forbidden'
  where id = '00000000-0000-0000-0000-00000000b002';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'Test 5 FAILED: other profile update was allowed (rows=%)', v_rows;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 6: anon cannot read limited_profiles
-- ============================================================
set role anon;

do $$
declare v_denied boolean := false;
begin
  begin
    perform count(*) from public.limited_profiles;
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 6 FAILED: anon can read limited_profiles';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 7: authenticated cannot INSERT/UPDATE/DELETE limited_profiles
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    insert into public.limited_profiles (id, full_name)
    values ('00000000-0000-0000-0000-00000000b001', 'Forbidden');
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 7 FAILED: limited_profiles INSERT was allowed';
  end if;

  v_denied := false;
  begin
    update public.limited_profiles set full_name = 'Hacked'
    where id = '00000000-0000-0000-0000-00000000b001';
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 7 FAILED: limited_profiles UPDATE was allowed';
  end if;

  v_denied := false;
  begin
    delete from public.limited_profiles
    where id = '00000000-0000-0000-0000-00000000b001';
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 7 FAILED: limited_profiles DELETE was allowed';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 8: ensure_profile_exists still works
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b004';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b004","role":"authenticated"}';

select public.ensure_profile_exists();

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '00000000-0000-0000-0000-00000000b004'
      and role = 'user'
  ) then
    raise exception 'Test 8 FAILED: ensure_profile_exists did not create profile';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 9: ProfileForm upsert works (ON CONFLICT DO UPDATE)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b004';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b004","role":"authenticated"}';

insert into public.profiles (id, full_name, matricula)
values ('00000000-0000-0000-0000-00000000b004', 'Profile Form', 'SYNTH004')
on conflict (id) do update set
  full_name = excluded.full_name,
  matricula = excluded.matricula;

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '00000000-0000-0000-0000-00000000b004'
      and full_name = 'Profile Form'
      and matricula = 'SYNTH004'
      and role = 'user'
  ) then
    raise exception 'Test 9 FAILED: ProfileForm upsert failed';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 10: admin policies still work (via postgres superuser)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can insert own profile'
  ) then
    raise exception 'Test 10 FAILED: insert policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    raise exception 'Test 10 FAILED: update policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vacation_rule_versions'
      and policyname = 'Admins can manage rules'
  ) then
    raise exception 'Test 10 FAILED: vacation admin policy missing';
  end if;
end
$$;

-- ============================================================
-- Cleanup (reset role)
-- ============================================================
reset role;
