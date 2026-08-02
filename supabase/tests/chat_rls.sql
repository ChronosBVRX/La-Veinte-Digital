-- Test funcional de RLS del chat con dos usuarios (se ejecuta contra la
-- base local en CI después de `supabase db reset`).
-- Usa el truco de cambiar el rol a `authenticated` y fijar los claims JWT
-- para simular sesiones reales. Cualquier fallo lanza excepción y rompe CI.

-- ============================================================
-- Setup (como postgres, sin RLS)
-- ============================================================
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'u1@test.local', '', now(), '{}', '{"email":"u1@test.local"}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'u2@test.local', '', now(), '{}', '{"email":"u2@test.local"}', now(), now())
on conflict (id) do nothing;

-- u1 crea una sala pública y una privada
insert into public.chat_rooms (id, name, is_private, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Sala publica', false, '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'Sala privada', true, '00000000-0000-0000-0000-000000000001');

-- u1 deja un mensaje en la sala privada (para comprobar que u2 no lo ve)
insert into public.chat_messages (room_id, user_id, content) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'mensaje secreto');

-- ============================================================
-- Como u2 (usuario normal, sin invitación)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
set request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

do $$
declare cnt int; err_msg text := '';
begin
  select count(*) into cnt from public.chat_rooms
  where id = '10000000-0000-0000-0000-000000000002';
  if cnt <> 0 then
    raise exception 'u2 ve la sala privada sin ser participante';
  end if;

  select count(*) into cnt from public.chat_rooms
  where id = '10000000-0000-0000-0000-000000000001';
  if cnt <> 1 then
    raise exception 'u2 no ve la sala publica';
  end if;

  select count(*) into cnt from public.chat_messages
  where room_id = '10000000-0000-0000-0000-000000000002';
  if cnt <> 0 then
    raise exception 'u2 lee mensajes de la sala privada sin participar';
  end if;

  begin
    insert into public.chat_participants (room_id, user_id)
    values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');
  exception when others then
    err_msg := sqlerrm;
  end;
  if err_msg = '' or err_msg not ilike '%row-level security%' then
    raise exception 'u2 pudo unirse a la sala privada sin invitacion (msg: %)', err_msg;
  end if;

  begin
    insert into public.chat_messages (room_id, user_id, content)
    values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'intruso');
  exception when others then
    err_msg := sqlerrm;
  end;
  if err_msg = '' or err_msg not ilike '%row-level security%' then
    raise exception 'u2 pudo mandar mensaje a la sala privada sin participar (msg: %)', err_msg;
  end if;

  -- Sí puede unirse a una sala pública y escribir en ella
  insert into public.chat_participants (room_id, user_id)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

  insert into public.chat_messages (room_id, user_id, content)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'hola');
end $$;

-- ============================================================
-- Como u1 (creador): invita a u2 a la sala privada
-- ============================================================
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
set request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

do $$
begin
  insert into public.chat_room_invitations (room_id, user_id)
  values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');
end $$;

-- ============================================================
-- De vuelta como u2: ya con invitación
-- ============================================================
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
set request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

do $$
declare cnt int;
begin
  insert into public.chat_participants (room_id, user_id)
  values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');

  select count(*) into cnt from public.chat_rooms
  where id = '10000000-0000-0000-0000-000000000002';
  if cnt <> 1 then
    raise exception 'u2 sigue sin ver la sala privada tras unirse';
  end if;

  select count(*) into cnt from public.chat_messages
  where room_id = '10000000-0000-0000-0000-000000000002';
  if cnt <> 1 then
    raise exception 'u2 no lee los mensajes de la sala privada tras unirse';
  end if;

  insert into public.chat_messages (room_id, user_id, content)
  values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'ya participo');

  -- u2 no es creador ni admin: no puede invitar a nadie más
  begin
    insert into public.chat_room_invitations (room_id, user_id)
    values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');
    raise exception 'u2 pudo invitar a otro usuario sin ser creador';
  exception
    when raise_exception then
      raise;
    when others then
      null;
  end;
end $$;

-- ============================================================
-- u2 promovido a admin: puede ver la sala privada sin participar
-- ============================================================
reset role;

update public.profiles set role = 'admin'
where id = '00000000-0000-0000-0000-000000000002';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
set request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

do $$
declare cnt int;
begin
  select count(*) into cnt from public.chat_rooms
  where id = '10000000-0000-0000-0000-000000000002';
  if cnt <> 1 then
    raise exception 'el admin no ve la sala privada';
  end if;
end $$;

reset role;
