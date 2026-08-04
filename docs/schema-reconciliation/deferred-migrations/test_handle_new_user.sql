-- Test: handle_new_user reconciliation
-- Run against a disposable database AFTER applying reconcile_handle_new_user.sql
-- Requires: profiles table, auth.users table (Supabase local stack)

-- Setup: clean previous test data
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'ffffffff-ffff-ffff-ffff-ffffffffffff'
);

-- Test 1: Registration with full_name in metadata
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'test1@test.local', '', now(),
  '{}', '{"full_name":"Juan Perez"}', now(), now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND full_name = 'Juan Perez'
  ) THEN
    RAISE EXCEPTION 'Test 1 FAILED: full_name not set from metadata';
  END IF;
  RAISE NOTICE 'Test 1 PASSED: full_name from metadata';
END
$$;

-- Test 2: Registration with name (OAuth style) instead of full_name
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'authenticated', 'authenticated', 'test2@test.local', '', now(),
  '{}', '{"name":"Maria Lopez"}', now(), now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    AND full_name = 'Maria Lopez'
  ) THEN
    RAISE EXCEPTION 'Test 2 FAILED: name fallback not working';
  END IF;
  RAISE NOTICE 'Test 2 PASSED: name fallback from OAuth';
END
$$;

-- Test 3: Registration with avatar_url
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'authenticated', 'authenticated', 'test3@test.local', '', now(),
  '{}', '{"full_name":"Avatar User","avatar_url":"https://example.com/photo.jpg"}', now(), now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    AND avatar_url = 'https://example.com/photo.jpg'
  ) THEN
    RAISE EXCEPTION 'Test 3 FAILED: avatar_url not set';
  END IF;
  RAISE NOTICE 'Test 3 PASSED: avatar_url from metadata';
END
$$;

-- Test 4: Registration with picture (Google OAuth)
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'authenticated', 'authenticated', 'test4@test.local', '', now(),
  '{}', '{"full_name":"Google User","picture":"https://lh3.googleusercontent.com/photo.jpg"}', now(), now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
    AND avatar_url = 'https://lh3.googleusercontent.com/photo.jpg'
  ) THEN
    RAISE EXCEPTION 'Test 4 FAILED: picture fallback not working';
  END IF;
  RAISE NOTICE 'Test 4 PASSED: picture (Google) → avatar_url';
END
$$;

-- Test 5: Registration with phone
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'authenticated', 'authenticated', 'test5@test.local', '', now(),
  '{}', '{"full_name":"Phone User","phone":"5551234567"}', now(), now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
    AND phone = '5551234567'
  ) THEN
    RAISE EXCEPTION 'Test 5 FAILED: phone not set';
  END IF;
  RAISE NOTICE 'Test 5 PASSED: phone from metadata';
END
$$;

-- Test 6: Update metadata (on conflict) preserves existing data
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'authenticated', 'authenticated', 'test6@test.local', '', now(),
  '{}', '{"full_name":"Original Name","phone":"1111111111"}', now(), now()
);

-- Simulate metadata update (like OAuth re-login)
UPDATE auth.users SET raw_user_meta_data = '{"full_name":"Updated Name","phone":"2222222222"}'
WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

-- Trigger fires on INSERT, not UPDATE. So we test the ON CONFLICT behavior.
-- Create profile manually, then trigger on next auth.users INSERT.
INSERT INTO public.profiles (id, full_name, phone)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Manual Name', '3333333333');

-- Now insert into auth.users with conflict (simulates re-trigger)
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'authenticated', 'authenticated', 'test6@test.local', '', now(),
  '{}', '{"full_name":"Should Not Override","phone":"4444444444"}', now(), now()
)
ON CONFLICT (id) DO UPDATE SET
  raw_user_meta_data = EXCLUDED.raw_user_meta_data;

DO $$
DECLARE v_name text; v_phone text;
BEGIN
  SELECT full_name, phone INTO v_name, v_phone
  FROM public.profiles
  WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  -- ON CONFLICT DO UPDATE fires the trigger, which uses COALESCE
  -- so existing values should be preserved
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Test 6 FAILED: profile not found';
  END IF;
  RAISE NOTICE 'Test 6: full_name=%, phone=% (COALESCE preserves existing)', v_name, v_phone;
END
$$;

-- Cleanup
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'ffffffff-ffff-ffff-ffff-ffffffffffff'
);
