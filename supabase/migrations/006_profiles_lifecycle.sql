-- 006_profiles_lifecycle.sql
-- Ciclo de vida completo de public.profiles + RLS estricta + consentimiento
-- de nómina. Idempotente y compatible con bases existentes.

-- ============================================================
-- 1. Tabla profiles (idempotente; en producción ya existe)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  matricula text,
  adscripcion text,
  categoria text,
  antiguedad text,
  phone text,
  avatar_url text,
  role text default 'user',
  is_online boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check'
  ) then
    alter table public.profiles add constraint profiles_role_check
      check (role in ('user', 'admin'));
  end if;
end $$;

-- ============================================================
-- 2. Trigger SECURITY DEFINER sobre auth.users (INSERT y UPDATE)
--    Crea/actualiza el perfil de forma idempotente para registro
--    por correo, Google, Facebook y usuarios existentes sin perfil.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_user_meta_data, email on auth.users
  for each row execute function public.handle_new_user();

-- RPC para usuarios existentes sin perfil (lo invoca /profile).
create or replace function public.ensure_profile_exists()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;
  insert into public.profiles (id)
  values (v_uid)
  on conflict (id) do nothing;
  return true;
end;
$$;

revoke all on function public.ensure_profile_exists() from public;
grant execute on function public.ensure_profile_exists() to authenticated;

-- ============================================================
-- 3. RLS de profiles: solo el propio usuario lee su perfil completo.
--    Para foro y chat se expone la vista limited_profiles.
-- ============================================================
alter table public.profiles enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Vista pública limitada para foro/chat: solo identidad visible.
create or replace view public.limited_profiles
with (security_invoker = on) as
  select id, full_name, avatar_url
  from public.profiles;

grant select on public.limited_profiles to authenticated;
grant select on public.limited_profiles to anon;

-- ============================================================
-- 4. Chat: solo participantes leen mensajes de salas privadas.
-- ============================================================
drop policy if exists "Chat messages are publicly readable" on public.chat_messages;
drop policy if exists "Authenticated users can send messages" on public.chat_messages;
drop policy if exists "Users can delete own messages" on public.chat_messages;

create policy "Participants can read room messages"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_rooms r
      where r.id = chat_messages.room_id
        and coalesce(r.is_private, false) = false
    )
    or exists (
      select 1 from public.chat_participants p
      where p.room_id = chat_messages.room_id
        and p.user_id = auth.uid()
    )
  );

create policy "Users can send messages to their rooms"
  on public.chat_messages for insert
  with check (
    user_id = auth.uid()
    and char_length(content) between 1 and 2000
    and (
      exists (
        select 1 from public.chat_rooms r
        where r.id = room_id
          and coalesce(r.is_private, false) = false
      )
      or exists (
        select 1 from public.chat_participants p
        where p.room_id = room_id
          and p.user_id = auth.uid()
      )
    )
  );

create policy "Users can delete own messages"
  on public.chat_messages for delete
  using (auth.uid() = user_id);

drop policy if exists "Participants are publicly readable" on public.chat_participants;
drop policy if exists "Authenticated users can join rooms" on public.chat_participants;

create policy "Users can read own participants"
  on public.chat_participants for select
  using (auth.uid() = user_id);

create policy "Users can join rooms"
  on public.chat_participants for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.chat_rooms r where r.id = room_id)
  );

-- Índices de mensajes por sala y orden cronológico.
create index if not exists chat_messages_room_created_idx
  on public.chat_messages (room_id, created_at);

-- ============================================================
-- 5. Foro: autor o admin modifican/eliminan; límites de longitud;
--    categoría validada por FK.
-- ============================================================
drop policy if exists "Admins can manage posts" on public.forum_posts;
drop policy if exists "Admins can manage comments" on public.forum_comments;

create policy "Admins can manage posts"
  on public.forum_posts for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can manage comments"
  on public.forum_comments for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.forum_posts'::regclass and conname = 'forum_posts_title_len_check'
  ) then
    alter table public.forum_posts add constraint forum_posts_title_len_check
      check (char_length(title) between 3 and 200);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.forum_posts'::regclass and conname = 'forum_posts_content_len_check'
  ) then
    alter table public.forum_posts add constraint forum_posts_content_len_check
      check (char_length(content) between 1 and 10000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.forum_comments'::regclass and conname = 'forum_comments_content_len_check'
  ) then
    alter table public.forum_comments add constraint forum_comments_content_len_check
      check (char_length(content) between 1 and 10000);
  end if;
end $$;

create index if not exists forum_posts_created_idx
  on public.forum_posts (created_at desc);

-- ============================================================
-- 6. Bitácora: actualización por propietario + restricciones.
-- ============================================================
drop policy if exists "Users can update own bitacora entries" on public.bitacora_entries;

create policy "Users can update own bitacora entries"
  on public.bitacora_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bitacora_entries'::regclass and conname = 'bitacora_entry_type_check'
  ) then
    alter table public.bitacora_entries add constraint bitacora_entry_type_check
      check (entry_type in (
        'Tiempo Extra',
        'Guardia Festiva',
        'TxT (Sustitución)',
        'Falta Injustificada',
        'Incapacidad',
        'Pases de salida/entrada',
        'Vacaciones',
        'No pagado (Reclamación en proceso)'
      )) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bitacora_entries'::regclass and conname = 'bitacora_description_len_check'
  ) then
    alter table public.bitacora_entries add constraint bitacora_description_len_check
      check (description is null or char_length(description) <= 1000);
  end if;
end $$;

create index if not exists bitacora_entries_user_date_idx
  on public.bitacora_entries (user_id, entry_date desc);

-- ============================================================
-- 7. Payroll contexts: consentimiento explícito + restricciones
--    + eliminación por el propio usuario.
-- ============================================================
alter table public.payroll_contexts
  add column if not exists consent_given boolean not null default false;
alter table public.payroll_contexts
  add column if not exists consent_given_at timestamptz;
alter table public.payroll_contexts
  add column if not exists consent_version text default '1.0';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payroll_contexts'::regclass and conname = 'payroll_contexts_hours_check'
  ) then
    alter table public.payroll_contexts add constraint payroll_contexts_hours_check
      check (workday_hours is null or workday_hours in (6, 6.5, 8, 12)) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payroll_contexts'::regclass and conname = 'payroll_contexts_employment_type_check'
  ) then
    alter table public.payroll_contexts add constraint payroll_contexts_employment_type_check
      check (employment_type is null or employment_type in ('base', 'confianza', 'eventual', 'confianza_a_estatuto')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payroll_contexts'::regclass and conname = 'payroll_contexts_conditions_array_check'
  ) then
    alter table public.payroll_contexts add constraint payroll_contexts_conditions_array_check
      check (occupational_conditions is null or jsonb_typeof(occupational_conditions) = 'array') not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payroll_contexts'::regclass and conname = 'payroll_contexts_facts_array_check'
  ) then
    alter table public.payroll_contexts add constraint payroll_contexts_facts_array_check
      check (payroll_facts is null or jsonb_typeof(payroll_facts) = 'array') not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payroll_contexts'::regclass and conname = 'payroll_contexts_recurrent_array_check'
  ) then
    alter table public.payroll_contexts add constraint payroll_contexts_recurrent_array_check
      check (recurring_concepts is null or jsonb_typeof(recurring_concepts) = 'array') not valid;
  end if;
end $$;

drop policy if exists "Users can delete own payroll context" on public.payroll_contexts;

create policy "Users can delete own payroll context"
  on public.payroll_contexts for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 8. Realtime: publicación necesaria para chat_messages.
-- ============================================================
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
