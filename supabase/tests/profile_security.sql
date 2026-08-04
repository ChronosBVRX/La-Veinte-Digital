-- Profile security tests.
-- Runs against local database after supabase db reset.
-- The migration 20260804150936_harden_profile_privileges.sql must have
-- already applied; no grants or schema changes are applied by this file.
-- Any failure raises an exception and breaks CI.

-- ============================================================
-- Setup: create synthetic users (as postgres, bypasses RLS)
-- ============================================================
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-00000000b001', 'authenticated', 'authenticated', 'profile-one@test.local', '', now(), '{}', '{"full_name":"Email User"}', now(), now()),
  ('00000000-0000-0000-0000-00000000b002', 'authenticated', 'authenticated', 'profile-two@test.local', '', now(), '{}', '{"name":"OAuth User","avatar_url":"https://example.invalid/avatar.png"}', now(), now()),
  ('00000000-0000-0000-0000-00000000b003', 'authenticated', 'authenticated', 'profile-insert@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000b004', 'authenticated', 'authenticated', 'profile-ensure@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000b005', 'authenticated', 'authenticated', 'profile-id@test.local', '', now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- ============================================================
-- Test 1: handle_new_user trigger creates profile with role='user'
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
-- Test 2: authenticated user can read own profile
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated"}';

do $$
declare v_rows integer;
begin
  select count(*) into v_rows from public.profiles
  where id = '00000000-0000-0000-0000-00000000b001';
  if v_rows <> 1 then
    raise exception 'Test 2 FAILED: own profile select failed (rows=%)', v_rows;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 3: authenticated user can update allowed fields
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
    raise exception 'Test 3 FAILED: own profile update failed (rows=%)', v_rows;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 4: user cannot insert role = admin (trigger blocks)
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
    raise exception 'Test 4 FAILED: admin role insert was allowed';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 5: user cannot update own role (trigger blocks)
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
    raise exception 'Test 5 FAILED: role update was allowed';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 6: user cannot update id (trigger blocks - immutable)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b005';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b005","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    update public.profiles set id = '00000000-0000-0000-0000-00000000ffff'
    where id = '00000000-0000-0000-0000-00000000b005';
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 6 FAILED: id update was allowed';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 7: user cannot update created_at (trigger blocks)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000b001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    update public.profiles set created_at = now()
    where id = '00000000-0000-0000-0000-00000000b001';
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 7 FAILED: created_at update was allowed';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 8: user cannot modify another user's profile (RLS blocks)
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
    raise exception 'Test 8 FAILED: other profile update was allowed (rows=%)', v_rows;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 9: anon cannot read limited_profiles
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
    raise exception 'Test 9 FAILED: anon can read limited_profiles';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 10: authenticated cannot INSERT/UPDATE/DELETE limited_profiles
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
    raise exception 'Test 10 FAILED: limited_profiles INSERT was allowed';
  end if;

  v_denied := false;
  begin
    update public.limited_profiles set full_name = 'Hacked'
    where id = '00000000-0000-0000-0000-00000000b001';
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 10 FAILED: limited_profiles UPDATE was allowed';
  end if;

  v_denied := false;
  begin
    delete from public.limited_profiles
    where id = '00000000-0000-0000-0000-00000000b001';
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 10 FAILED: limited_profiles DELETE was allowed';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 11: ensure_profile_exists still works (SECURITY DEFINER)
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
    raise exception 'Test 11 FAILED: ensure_profile_exists did not create profile';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 12: ProfileForm upsert works (ON CONFLICT DO UPDATE)
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
    raise exception 'Test 12 FAILED: ProfileForm upsert failed';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 13: required RLS policies exist
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can insert own profile'
  ) then
    raise exception 'Test 13 FAILED: insert policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    raise exception 'Test 13 FAILED: update policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vacation_rule_versions'
      and policyname = 'Admins can manage rules'
  ) then
    raise exception 'Test 13 FAILED: vacation admin policy missing';
  end if;
end
$$;

-- ============================================================
-- Test 14: guard trigger exists on profiles
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'guard_profile_protected_fields'
      and tgrelid = 'public.profiles'::regclass
  ) then
    raise exception 'Test 14 FAILED: guard trigger missing';
  end if;
end
$$;

-- ============================================================
-- Test 15: role default is 'user'
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
      and column_default like '%user%'
  ) then
    raise exception 'Test 15 FAILED: role default is not user';
  end if;
end
$$;

-- ============================================================
-- Cleanup
-- ============================================================
reset role;
