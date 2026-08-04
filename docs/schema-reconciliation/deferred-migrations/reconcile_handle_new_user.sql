-- reconcile_handle_new_user: unified version with phone + avatar_url.
-- Deferred migration — do NOT apply to supabase/migrations/ yet.
-- Compare remote and local definitions before promoting.

BEGIN;

-- Replace handle_new_user with the more complete version (includes phone, avatar_url)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, phone, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'email'
    ),
    new.raw_user_meta_data->>'phone',
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (id) do update set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();
  return new;
end;
$function$;

-- Verify
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc WHERE proname = 'handle_new_user' AND prosecdef = true;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'handle_new_user: function not found';
  END IF;

  IF v_def NOT LIKE '%phone%' THEN
    RAISE EXCEPTION 'handle_new_user: missing phone support';
  END IF;

  IF v_def NOT LIKE '%avatar_url%' THEN
    RAISE EXCEPTION 'handle_new_user: missing avatar_url support';
  END IF;

  IF v_def NOT LIKE '%SECURITY DEFINER%' THEN
    RAISE EXCEPTION 'handle_new_user: not SECURITY DEFINER';
  END IF;

  IF v_def NOT LIKE '%search_path%' THEN
    RAISE EXCEPTION 'handle_new_user: missing fixed search_path';
  END IF;

  RAISE NOTICE 'handle_new_user: reconciled successfully';
END
$$;

COMMIT;
