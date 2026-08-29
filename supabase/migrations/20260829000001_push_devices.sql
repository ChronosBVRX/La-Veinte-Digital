-- ═══════════════════════════════════════════════════════════════════
-- push_devices — Registro de dispositivos para notificaciones FCM
--
-- Reglas de diseño:
-- - Un token FCM por fila (único). Un usuario puede tener varios dispositivos.
-- - El token se asocia al user_id SOLO cuando hay sesión (el cliente registra
--   desde el web con sesión vía POST /api/push/register).
-- - RLS: cada usuario SOLO ve/edita sus propios dispositivos.
-- - El envío masivo se hace con service_role / SECURITY DEFINER desde el
--   backend, nunca con privilegios de authenticated.
-- - Al cerrar sesión, el web des-asocia el token (no se elimina el token FCM,
--   que pertenece al dispositivo).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null default 'android',
  app_version text,
  device_model text,
  android_version text,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_devices_user_idx on public.push_devices(user_id);
create index if not exists push_devices_token_idx on public.push_devices(fcm_token);

-- RLS
alter table public.push_devices enable row level security;

drop policy if exists "push_devices_select_own" on public.push_devices;
create policy "push_devices_select_own"
  on public.push_devices for select
  using (auth.uid() = user_id);

drop policy if exists "push_devices_insert_own" on public.push_devices;
create policy "push_devices_insert_own"
  on public.push_devices for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_devices_update_own" on public.push_devices;
create policy "push_devices_update_own"
  on public.push_devices for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_devices_delete_own" on public.push_devices;
create policy "push_devices_delete_own"
  on public.push_devices for delete
  using (auth.uid() = user_id);

-- Función idempotente de registro (upsert por fcm_token del usuario actual).
-- Solo el usuario autenticado puede registrar SU token.
create or replace function public.register_push_device(
  p_token text,
  p_platform text default 'android',
  p_app_version text default null,
  p_device_model text default null,
  p_android_version text default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_token is null or length(p_token) < 20 then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  insert into public.push_devices as d
    (user_id, fcm_token, platform, app_version, device_model, android_version, notifications_enabled, last_seen_at)
  values
    (v_uid, p_token, coalesce(p_platform, 'android'), p_app_version, p_device_model, p_android_version, true, now())
  on conflict (fcm_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        app_version = excluded.app_version,
        device_model = excluded.device_model,
        android_version = excluded.android_version,
        notifications_enabled = true,
        last_seen_at = now(),
        updated_at = now();
end;
$$;

-- Des-asocia el token del usuario actual al cerrar sesión.
create or replace function public.unregister_push_device(p_token text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.push_devices where fcm_token = p_token and user_id = v_uid;
end;
$$;
