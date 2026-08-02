-- 010_chat_policies.sql
-- Políticas de chat corregidas, aplicables tanto a bases nuevas (después de
-- 007) como a bases existentes (reemplaza las creadas por 006/007):
--   * Las salas privadas solo se ven cuando el usuario es creador, participante
--     o admin. 007 dejaba `using (true)` para todas las salas.
--   * Unirse a una sala exige que sea pública, tener invitación, o ser
--     creador/admin. 006/007 solo comprobaban que la sala existiera.
--   * chat_messages/chat_participants quedan con políticas propias (en bases
--     nuevas 006 salía sin hacer nada porque las tablas aún no existían).
--   * limited_profiles deja de ser consultable por anon (la clave pública
--     expone nombres/avatares de todos los usuarios).
--   * Los helpers SECURITY DEFINER rompen la recursión infinita (42P17) entre
--     las políticas de chat_rooms y chat_participants: ninguna política
--     consulta la otra tabla con RLS activo.

-- ============================================================
-- 0. Tabla de invitaciones (necesaria para los helpers/políticas)
-- ============================================================
create table if not exists public.chat_room_invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz default now(),
  unique (room_id, user_id)
);

alter table public.chat_room_invitations enable row level security;

-- ============================================================
-- 0b. Helpers SECURITY DEFINER (acceden a las tablas sin RLS)
-- ============================================================
create or replace function public.is_chat_participant(v_room_id uuid, v_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_participants p
    where p.room_id = v_room_id and p.user_id = v_user_id
  )
$$;

create or replace function public.is_chat_admin(v_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = v_user_id and pr.role = 'admin'
  )
$$;

create or replace function public.is_chat_room_visible(v_room_id uuid, v_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_rooms r
    where r.id = v_room_id
      and (
        coalesce(r.is_private, false) = false
        or r.created_by = v_user_id
        or public.is_chat_participant(r.id, v_user_id)
        or public.is_chat_admin(v_user_id)
      )
  )
$$;

create or replace function public.is_chat_invited(v_room_id uuid, v_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_room_invitations i
    where i.room_id = v_room_id and i.user_id = v_user_id
  )
$$;

revoke all on function public.is_chat_participant(uuid, uuid) from public;
revoke all on function public.is_chat_admin(uuid) from public;
revoke all on function public.is_chat_room_visible(uuid, uuid) from public;
revoke all on function public.is_chat_invited(uuid, uuid) from public;
grant execute on function public.is_chat_participant(uuid, uuid) to authenticated;
grant execute on function public.is_chat_admin(uuid) to authenticated;
grant execute on function public.is_chat_room_visible(uuid, uuid) to authenticated;
grant execute on function public.is_chat_invited(uuid, uuid) to authenticated;

-- ============================================================
-- 1. chat_rooms
-- ============================================================
drop policy if exists "Chat rooms are publicly readable" on public.chat_rooms;
drop policy if exists "Authenticated users can create rooms" on public.chat_rooms;

create policy "Chat rooms are visible to participants"
  on public.chat_rooms for select
  to authenticated
  using (
    coalesce(is_private, false) = false
    or created_by = auth.uid()
    or public.is_chat_participant(id, auth.uid())
    or public.is_chat_admin(auth.uid())
  );

create policy "Authenticated users can create rooms"
  on public.chat_rooms for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Creators and admins can update rooms"
  on public.chat_rooms for update
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_chat_admin(auth.uid())
  )
  with check (
    created_by = auth.uid()
    or public.is_chat_admin(auth.uid())
  );

create policy "Creators and admins can delete rooms"
  on public.chat_rooms for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_chat_admin(auth.uid())
  );

-- ============================================================
-- 2. chat_room_invitations
-- ============================================================
create policy "Invited users and creators can see invitations"
  on public.chat_room_invitations for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and (
          r.created_by = auth.uid()
          or public.is_chat_admin(auth.uid())
        )
    )
  );

create policy "Creators and admins can invite"
  on public.chat_room_invitations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and (
          r.created_by = auth.uid()
          or public.is_chat_admin(auth.uid())
        )
    )
  );

create policy "Creators and admins can remove invitations"
  on public.chat_room_invitations for delete
  to authenticated
  using (
    exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and (
          r.created_by = auth.uid()
          or public.is_chat_admin(auth.uid())
        )
    )
  );

-- ============================================================
-- 3. chat_participants
-- ============================================================
drop policy if exists "Users can read own participants" on public.chat_participants;
drop policy if exists "Users can join rooms" on public.chat_participants;

create policy "Users can see members of visible rooms"
  on public.chat_participants for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_chat_room_visible(room_id, auth.uid())
  );

create policy "Users can join public, invited or owned rooms"
  on public.chat_participants for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.is_chat_room_visible(room_id, auth.uid())
      or public.is_chat_invited(room_id, auth.uid())
    )
  );

create policy "Creators and admins can add participants"
  on public.chat_participants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and (
          r.created_by = auth.uid()
          or public.is_chat_admin(auth.uid())
        )
    )
  );

create policy "Users can leave rooms or be removed by creators"
  on public.chat_participants for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and (
          r.created_by = auth.uid()
          or public.is_chat_admin(auth.uid())
        )
    )
  );

-- ============================================================
-- 4. chat_messages
-- ============================================================
drop policy if exists "Participants can read room messages" on public.chat_messages;
drop policy if exists "Chat messages are publicly readable" on public.chat_messages;
drop policy if exists "Authenticated users can send messages" on public.chat_messages;
drop policy if exists "Users can delete own messages" on public.chat_messages;

create policy "Participants can read room messages"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_rooms r
      where r.id = room_id and coalesce(r.is_private, false) = false
    )
    or public.is_chat_participant(room_id, auth.uid())
    or public.is_chat_admin(auth.uid())
  );

create policy "Participants can send messages"
  on public.chat_messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1 from public.chat_rooms r
        where r.id = room_id and coalesce(r.is_private, false) = false
      )
      or public.is_chat_participant(room_id, auth.uid())
      or public.is_chat_admin(auth.uid())
    )
  );

create policy "Users can delete own messages"
  on public.chat_messages for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_chat_admin(auth.uid())
  );

-- ============================================================
-- 5. limited_profiles: solo authenticated (no anon)
-- ============================================================
revoke select on public.limited_profiles from anon;
grant select on public.limited_profiles to authenticated;
