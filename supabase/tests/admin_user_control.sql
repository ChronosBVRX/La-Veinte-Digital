-- Admin user control center SQL tests.
-- Runs against the local database after `supabase db reset` (CI job `supabase-db`).
-- Requires migration 20260919040000_admin_user_control_center.sql already applied.
-- Any failure raises an exception and breaks CI.
--
-- Synthetic users use profile_security.sql conventions (UUID ...c0xx / ...c1xx).

-- ============================================================
-- Setup: limpiar residuos y crear usuarios sintéticos
-- ============================================================
delete from public.admin_audit_log
 where entity_type = 'user'
   and entity_id in (
     '00000000-0000-0000-0000-00000000c001',
     '00000000-0000-0000-0000-00000000c002',
     '00000000-0000-0000-0000-00000000c101',
     '00000000-0000-0000-0000-00000000c102',
     '00000000-0000-0000-0000-00000000c103'
   );

-- Tabla de prueba que simula una referencia FK NO ACTION (p. ej. representación
-- sindical): la purga física debe bloquearse y no borrar nada. Se elimina al
-- final del archivo.
drop table if exists public.admin_purge_fk_probe;
create table public.admin_purge_fk_probe (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id)
);

delete from public.imported_payslips
 where user_id in (
   '00000000-0000-0000-0000-00000000c101',
   '00000000-0000-0000-0000-00000000c102',
   '00000000-0000-0000-0000-00000000c103'
 );

delete from public.transfer_sessions
 where owner_id in (
   '00000000-0000-0000-0000-00000000c101',
   '00000000-0000-0000-0000-00000000c102',
   '00000000-0000-0000-0000-00000000c103'
 );

delete from public.api_usage_log
 where user_id in (
   '00000000-0000-0000-0000-00000000c101',
   '00000000-0000-0000-0000-00000000c102',
   '00000000-0000-0000-0000-00000000c103'
 );

delete from auth.refresh_tokens
 where user_id in (
   '00000000-0000-0000-0000-00000000c001',
   '00000000-0000-0000-0000-00000000c002',
   '00000000-0000-0000-0000-00000000c101',
   '00000000-0000-0000-0000-00000000c102',
   '00000000-0000-0000-0000-00000000c103'
 );

delete from auth.sessions
 where user_id in (
   '00000000-0000-0000-0000-00000000c001',
   '00000000-0000-0000-0000-00000000c002',
   '00000000-0000-0000-0000-00000000c101',
   '00000000-0000-0000-0000-00000000c102',
   '00000000-0000-0000-0000-00000000c103'
 );

delete from public.profiles
 where id in (
   '00000000-0000-0000-0000-00000000c001',
   '00000000-0000-0000-0000-00000000c002',
   '00000000-0000-0000-0000-00000000c101',
   '00000000-0000-0000-0000-00000000c102',
   '00000000-0000-0000-0000-00000000c103'
 );

delete from auth.users
 where id in (
   '00000000-0000-0000-0000-00000000c001',
   '00000000-0000-0000-0000-00000000c002',
   '00000000-0000-0000-0000-00000000c101',
   '00000000-0000-0000-0000-00000000c102',
   '00000000-0000-0000-0000-00000000c103'
 );

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-00000000c001', 'authenticated', 'authenticated', 'admin-a@test.local', '', now(), '{}', '{"full_name":"Admin A"}', now(), now()),
  ('00000000-0000-0000-0000-00000000c002', 'authenticated', 'authenticated', 'admin-b@test.local', '', now(), '{}', '{"full_name":"Admin B"}', now(), now()),
  ('00000000-0000-0000-0000-00000000c101', 'authenticated', 'authenticated', 'user-one@test.local', '', now(), '{"providers":["email"]}', '{"full_name":"User One"}', now(), now()),
  ('00000000-0000-0000-0000-00000000c102', 'authenticated', 'authenticated', 'user-two@test.local', '', null, '{"providers":["email"]}', '{"full_name":"User Two"}', now(), now()),
  ('00000000-0000-0000-0000-00000000c103', 'authenticated', 'authenticated', 'user-three@test.local', '', now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, full_name, matricula, role)
values
  ('00000000-0000-0000-0000-00000000c001', 'Admin A', 'ADM001', 'admin'),
  ('00000000-0000-0000-0000-00000000c002', 'Admin B', 'ADM002', 'admin'),
  ('00000000-0000-0000-0000-00000000c101', 'User One', 'USR001', 'user'),
  ('00000000-0000-0000-0000-00000000c102', 'User Two', null, 'user'),
  ('00000000-0000-0000-0000-00000000c103', null, null, 'user')
on conflict (id) do update
  set full_name = excluded.full_name,
      matricula = excluded.matricula,
      role = excluded.role;

insert into public.admin_purge_fk_probe (user_id)
values ('00000000-0000-0000-0000-00000000c102');

-- Datos operativos sintéticos (para métricas y actividad; sin contenido privado)
insert into public.imported_payslips (user_id, source_hash, period_raw, extraction_method)
values ('00000000-0000-0000-0000-00000000c101', 'hash-synth-1', '2026-08', 'native_text');

-- api_usage_log.route solo admite 'consulta' | 'simulador' (constraint 005).
insert into public.api_usage_log (user_id, route, usage_date, count)
values ('00000000-0000-0000-0000-00000000c101', 'consulta', current_date, 3);

-- transfer_sessions exige token, owner_token y expires_at (migración transfer).
insert into public.transfer_sessions (owner_id, token, owner_token, expires_at)
values (
  '00000000-0000-0000-0000-00000000c101',
  'synth-token-admin-test',
  'synth-owner-token-admin-test',
  now() + interval '10 minutes'
);
insert into public.transfer_files (session_id, name, content_type, size_bytes, data)
select id, 'synth-admin-test.pdf', 'application/pdf', 1024, 'c3ludGg='
from public.transfer_sessions where owner_id = '00000000-0000-0000-0000-00000000c101' limit 1;

-- ============================================================
-- Test 1: un usuario normal NO puede listar usuarios (forbidden)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c101';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c101","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    perform * from public.admin_list_users();
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 1 FAILED: non-admin listed users';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 2: un usuario normal NO puede cambiar roles (permiso denegado)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c101';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c101","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    perform public.admin_apply_user_role(
      '00000000-0000-0000-0000-00000000c101',
      '00000000-0000-0000-0000-00000000c101',
      'admin',
      'intento no autorizado',
      'req-synth-1'
    );
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 2 FAILED: authenticated executed admin_apply_user_role';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 3: el admin SÍ puede listar, buscar y filtrar
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}';

do $$
declare v_rows integer;
begin
  select count(*) into v_rows
    from public.admin_list_users(null, null, null, null, null, 'created_at', 'desc', 50, 0)
   where user_id in (
     '00000000-0000-0000-0000-00000000c001',
     '00000000-0000-0000-0000-00000000c002',
     '00000000-0000-0000-0000-00000000c101',
     '00000000-0000-0000-0000-00000000c102',
     '00000000-0000-0000-0000-00000000c103'
   );
  if v_rows <> 5 then
    raise exception 'Test 3 FAILED: admin listing returned % synthetic rows (expected 5)', v_rows;
  end if;

  select count(*) into v_rows
    from public.admin_list_users('user-one@test.local', null, null, null, null, 'created_at', 'desc', 50, 0);
  if v_rows <> 1 then
    raise exception 'Test 3 FAILED: email search returned % rows (expected 1)', v_rows;
  end if;

  select count(*) into v_rows
    from public.admin_list_users('USR001', null, null, null, null, 'created_at', 'desc', 50, 0);
  if v_rows <> 1 then
    raise exception 'Test 3 FAILED: matricula search returned % rows (expected 1)', v_rows;
  end if;

  select count(*) into v_rows
    from public.admin_list_users(null, 'trashed', null, null, null, 'created_at', 'desc', 50, 0)
   where user_id = '00000000-0000-0000-0000-00000000c101';
  if v_rows <> 0 then
    raise exception 'Test 3 FAILED: status filter leaked a non-trashed user';
  end if;

  select count(*) into v_rows
    from public.admin_list_users(null, null, 'admin', null, null, 'created_at', 'desc', 50, 0)
   where user_id in ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000c002');
  if v_rows <> 2 then
    raise exception 'Test 3 FAILED: role filter returned % admin rows (expected 2)', v_rows;
  end if;
end
$$;

-- ============================================================
-- Test 4: el admin limitado (no platform admin) NO puede leer métricas
--         ni bitácora (union_rep / union_admin no otorgan privilegio global)
-- ============================================================
reset role;

do $$
declare v_denied boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c101';
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c101","role":"authenticated"}';
  begin
    perform public.admin_user_metrics();
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 4 FAILED: non-admin read metrics';
  end if;

  v_denied := false;
  begin
    perform * from public.admin_list_audit_log();
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 4 FAILED: non-admin read the admin audit log';
  end if;
end
$$;

-- ============================================================
-- Test 5: último admin no puede degradarse (last_admin)
-- ============================================================
-- Contexto service_role real: sin claims de usuario (auth.uid() = NULL), tal
-- como llega la service key a PostgREST. El trigger guard_profile_protected_fields
-- solo permite cambiar profiles.role en ese contexto.
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claims', '{}', false);
set role service_role;

do $$
declare v_denied boolean := false;
begin
  -- Con dos admins, degradar a B es válido.
  perform public.admin_apply_user_role(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c002',
    'user',
    'reduccion de privilegios',
    'req-synth-2'
  );

  -- Ahora A es el único admin: degradarse a sí mismo debe fallar.
  begin
    perform public.admin_apply_user_role(
      '00000000-0000-0000-0000-00000000c001',
      '00000000-0000-0000-0000-00000000c001',
      'user',
      'intento de autodegradacion',
      'req-synth-3'
    );
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 5 FAILED: last admin was demoted';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 6: suspensión, reactivación y auditoría
-- ============================================================
set role service_role;

do $$
declare
  v_status text;
  v_audit integer;
begin
  -- El admin no puede suspenderse a sí mismo.
  begin
    perform public.admin_suspend_user(
      '00000000-0000-0000-0000-00000000c001',
      '00000000-0000-0000-0000-00000000c001',
      'indefinite',
      null,
      'intento propio',
      'req-synth-4'
    );
    raise exception 'Test 6 FAILED: admin suspended self';
  exception when others then
    if sqlerrm <> 'self_target_forbidden' then
      raise;
    end if;
  end;

  perform public.admin_suspend_user(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c101',
    'temporary',
    now() + interval '7 days',
    'suspension temporal de prueba',
    'req-synth-5'
  );

  select public.admin_effective_status(status, suspension_kind, suspension_ends_at)
    into v_status
    from public.user_admin_status
   where user_id = '00000000-0000-0000-0000-00000000c101';
  if v_status <> 'suspended' then
    raise exception 'Test 6 FAILED: user not suspended (got %)', v_status;
  end if;

  perform public.admin_reactivate_user(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c101',
    'reactivacion de prueba',
    'req-synth-6'
  );

  select public.admin_effective_status(status, suspension_kind, suspension_ends_at)
    into v_status
    from public.user_admin_status
   where user_id = '00000000-0000-0000-0000-00000000c101';
  if v_status <> 'active' then
    raise exception 'Test 6 FAILED: user not reactivated (got %)', v_status;
  end if;

  select count(*) into v_audit
    from public.admin_audit_log
   where entity_type = 'user'
     and entity_id = '00000000-0000-0000-0000-00000000c101'
     and action = 'user.suspend';
  if v_audit <> 1 then
    raise exception 'Test 6 FAILED: suspend audit rows = % (expected 1)', v_audit;
  end if;

  select count(*) into v_audit
    from public.admin_audit_log
   where entity_type = 'user'
     and entity_id = '00000000-0000-0000-0000-00000000c101'
     and action = 'user.reactivate';
  if v_audit <> 1 then
    raise exception 'Test 6 FAILED: reactivate audit rows = % (expected 1)', v_audit;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 7: suspensión temporal vencida equivale a activo
-- ============================================================
set role service_role;

do $$
declare v_status text;
begin
  perform public.admin_suspend_user(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c101',
    'temporary',
    now() + interval '1 hour',
    'suspension corta',
    'req-synth-7'
  );

  update public.user_admin_status
     set suspension_ends_at = now() - interval '1 minute'
   where user_id = '00000000-0000-0000-0000-00000000c101';

  select public.admin_effective_status(status, suspension_kind, suspension_ends_at)
    into v_status
    from public.user_admin_status
   where user_id = '00000000-0000-0000-0000-00000000c101';
  if v_status <> 'active' then
    raise exception 'Test 7 FAILED: expired temporary suspension not normalized (got %)', v_status;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 8: papelera, restauración y retención de 30 días
-- ============================================================
set role service_role;

do $$
declare
  v_status text;
  v_purge timestamptz;
  v_audit integer;
begin
  perform public.admin_trash_user(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c101',
    'envio a papelera de prueba',
    'req-synth-8'
  );

  select status, purge_after into v_status, v_purge
    from public.user_admin_status
   where user_id = '00000000-0000-0000-0000-00000000c101';

  if v_status <> 'trashed' then
    raise exception 'Test 8 FAILED: user not trashed (got %)', v_status;
  end if;
  if v_purge < now() + interval '29 days' then
    raise exception 'Test 8 FAILED: purge_after too early (%)', v_purge;
  end if;

  perform public.admin_restore_user(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c101',
    'restauracion de prueba',
    'req-synth-9'
  );

  select status, purge_after into v_status, v_purge
    from public.user_admin_status
   where user_id = '00000000-0000-0000-0000-00000000c101';
  if v_status <> 'active' or v_purge is not null then
    raise exception 'Test 8 FAILED: restore incomplete (status=%, purge=%)', v_status, v_purge;
  end if;

  select count(*) into v_audit
    from public.admin_audit_log
   where entity_type = 'user'
     and entity_id = '00000000-0000-0000-0000-00000000c101'
     and action in ('user.trash', 'user.restore');
  if v_audit <> 2 then
    raise exception 'Test 8 FAILED: trash/restore audit rows = % (expected 2)', v_audit;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 9: cierre de sesiones (revocación de refresh tokens y sesiones)
-- ============================================================
-- auth.refresh_tokens.token es único; auth.sessions.id no tiene default.
insert into auth.refresh_tokens (token, user_id)
values ('synth-admin-rt-1', '00000000-0000-0000-0000-00000000c101');
insert into auth.refresh_tokens (token, user_id)
values ('synth-admin-rt-2', '00000000-0000-0000-0000-00000000c101');
insert into auth.sessions (id, user_id)
values (gen_random_uuid(), '00000000-0000-0000-0000-00000000c101');

set role service_role;

do $$
declare v_revoked integer;
begin
  select (public.admin_revoke_user_sessions(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c101',
    'cierre total de sesiones',
    'req-synth-10'
  ) ->> 'revoked')::integer into v_revoked;

  if v_revoked < 3 then
    raise exception 'Test 9 FAILED: revoked % rows (expected >= 3)', v_revoked;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 10: purga bloqueada por referencias FK y por correo
-- ============================================================
do $$
declare v_denied boolean := false;
begin
  perform public.admin_trash_user(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c102',
    'papelera con referencias sindicales',
    'req-synth-11'
  );

  set local role service_role;

  -- Correo incorrecto
  begin
    perform public.admin_purge_user(
      '00000000-0000-0000-0000-00000000c001',
      '00000000-0000-0000-0000-00000000c102',
      'correo-equivocado@test.local',
      'purga con correo incorrecto',
      'req-synth-12'
    );
  exception when others then
    if sqlerrm <> 'email_mismatch' then
      raise;
    end if;
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 10 FAILED: purge accepted a wrong email';
  end if;

  -- Correo correcto pero con FK sindical NO ACTION -> bloqueada y sin borrados
  v_denied := false;
  begin
    perform public.admin_purge_user(
      '00000000-0000-0000-0000-00000000c001',
      '00000000-0000-0000-0000-00000000c102',
      'user-two@test.local',
      'purga bloqueada por referencias',
      'req-synth-13'
    );
  exception when others then
    if sqlerrm <> 'blocked_references' then
      raise;
    end if;
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 10 FAILED: purge was not blocked by FK references';
  end if;

  reset role;

  if not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000c102') then
    raise exception 'Test 10 FAILED: blocked purge deleted the user';
  end if;
  if not exists (select 1 from public.admin_purge_fk_probe where user_id = '00000000-0000-0000-0000-00000000c102') then
    raise exception 'Test 10 FAILED: blocked purge deleted FK-referenced rows';
  end if;
end
$$;

-- ============================================================
-- Test 11: purga definitiva válida (sin referencias) + auditoría
-- ============================================================
do $$
declare v_ok boolean := false;
begin
  perform public.admin_trash_user(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c103',
    'papelera sin referencias',
    'req-synth-14'
  );

  set local role service_role;
  perform public.admin_purge_user(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c103',
    'user-three@test.local',
    'purga definitiva valida',
    'req-synth-15'
  );
  reset role;

  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000c103') then
    raise exception 'Test 11 FAILED: auth user still exists after purge';
  end if;
  if exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000c103') then
    raise exception 'Test 11 FAILED: profile still exists after purge';
  end if;

  select exists (
    select 1 from public.admin_audit_log
     where entity_type = 'user'
       and entity_id = '00000000-0000-0000-0000-00000000c103'
       and action = 'user.purge'
  ) into v_ok;
  if not v_ok then
    raise exception 'Test 11 FAILED: purge audit row missing';
  end if;
end
$$;

-- ============================================================
-- Test 12: ficha y actividad del usuario (sin contenido privado)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}';

do $$
declare
  v_detail jsonb;
  v_activity jsonb;
  v_serialized text;
begin
  select public.admin_user_detail('00000000-0000-0000-0000-00000000c101') into v_detail;
  if v_detail is null then
    raise exception 'Test 12 FAILED: admin_user_detail returned null';
  end if;
  if v_detail #>> '{diagnostics,authentication}' <> 'OK' then
    raise exception 'Test 12 FAILED: authentication diagnostic = %', v_detail #>> '{diagnostics,authentication}';
  end if;
  if v_detail #>> '{diagnostics,payslip}' <> 'DISPONIBLE' then
    raise exception 'Test 12 FAILED: payslip diagnostic = %', v_detail #>> '{diagnostics,payslip}';
  end if;
  if (v_detail #>> '{counts,payslips}')::integer <> 1 then
    raise exception 'Test 12 FAILED: payslip count = %', v_detail #>> '{counts,payslips}';
  end if;
  if v_detail #>> '{user,role}' <> 'user' then
    raise exception 'Test 12 FAILED: role = %', v_detail #>> '{user,role}';
  end if;

  v_serialized := v_detail::text;
  if v_serialized ilike '%source_hash%'
     or v_serialized ilike '%fiscal_folio%'
     or v_serialized ilike '%employee_data%'
     or v_serialized ilike '%encrypted_password%'
     or v_serialized ilike '%refresh_token%' then
    raise exception 'Test 12 FAILED: detail leaks private payslip/auth fields';
  end if;

  select public.admin_user_activity('00000000-0000-0000-0000-00000000c101', 50) into v_activity;
  if jsonb_typeof(v_activity) <> 'array' then
    raise exception 'Test 12 FAILED: activity is not an array';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_activity) ev
     where ev ->> 'kind' = 'payslip_import'
  ) then
    raise exception 'Test 12 FAILED: payslip_import activity missing';
  end if;
end
$$;

-- ============================================================
-- Test 13: RLS — cada usuario solo lee su propio estado
-- ============================================================
do $$
declare v_rows integer;
begin
  -- Admin u otro usuario: no puede leer el estado de otra cuenta.
  select count(*) into v_rows
    from public.user_admin_status
   where user_id = '00000000-0000-0000-0000-00000000c101';
  if v_rows <> 0 then
    raise exception 'Test 13 FAILED: user read another account state (rows=%)', v_rows;
  end if;
end
$$;

reset role;

-- El titular sí puede leer su propio estado (necesario para el aviso humano).
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c101';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c101","role":"authenticated"}';

do $$
declare v_rows integer;
begin
  select count(*) into v_rows
    from public.user_admin_status
   where user_id = '00000000-0000-0000-0000-00000000c101';
  if v_rows <> 1 then
    raise exception 'Test 13 FAILED: user cannot read own state (rows=%)', v_rows;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 14: métricas agregadas reales para admin
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}';

do $$
declare v_metrics jsonb;
begin
  select public.admin_user_metrics() into v_metrics;
  if (v_metrics ->> 'totalUsers')::integer < 4 then
    raise exception 'Test 14 FAILED: totalUsers = %', v_metrics ->> 'totalUsers';
  end if;
  if (v_metrics ->> 'usersWithPayslip')::integer < 1 then
    raise exception 'Test 14 FAILED: usersWithPayslip = %', v_metrics ->> 'usersWithPayslip';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 15: bitácora paginada para admin con datos no sensibles
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}';

do $$
declare v_rows integer;
begin
  select count(*) into v_rows
    from public.admin_list_audit_log(null, '00000000-0000-0000-0000-00000000c101', null, null, null, 50, 0)
   where action = 'user.suspend';
  if v_rows < 1 then
    raise exception 'Test 15 FAILED: suspend audit listing = % (expected >= 1)', v_rows;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 16: roles de plataforma y roles sindicales son independientes
--          (user ↔ admin no altera union_members; union_admin no es admin)
-- ============================================================
delete from public.union_delegations where code = 'SYNTH-ADMIN-TEST';
insert into public.union_delegations (id, code, name)
values ('00000000-0000-0000-0000-00000000d001', 'SYNTH-ADMIN-TEST', 'Delegación sintética admin');

insert into public.union_members (user_id, delegation_id, role, active)
values
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000d001', 'union_admin', true),
  ('00000000-0000-0000-0000-00000000c102', '00000000-0000-0000-0000-00000000d001', 'union_rep', true);

reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claims', '{}', false);
set role service_role;

do $$
declare
  v_member_role text;
  v_member_active boolean;
  v_role text;
begin
  -- Ascender a admin de plataforma a quien es union_admin.
  perform public.admin_apply_user_role(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c101',
    'admin',
    'promocion de plataforma conservando rol sindical',
    'req-synth-16'
  );

  select role into v_role from public.profiles where id = '00000000-0000-0000-0000-00000000c101';
  if v_role <> 'admin' then
    raise exception 'Test 16 FAILED: platform role not promoted (got %)', v_role;
  end if;

  select role, active into v_member_role, v_member_active
    from public.union_members
   where user_id = '00000000-0000-0000-0000-00000000c101'
     and delegation_id = '00000000-0000-0000-0000-00000000d001';
  if v_member_role <> 'union_admin' or v_member_active is not true then
    raise exception 'Test 16 FAILED: union membership altered on promotion (role=%, active=%)',
      v_member_role, v_member_active;
  end if;

  -- Degradar de vuelta a usuario de plataforma.
  perform public.admin_apply_user_role(
    '00000000-0000-0000-0000-00000000c001',
    '00000000-0000-0000-0000-00000000c101',
    'user',
    'degradacion de plataforma conservando rol sindical',
    'req-synth-17'
  );

  select role into v_role from public.profiles where id = '00000000-0000-0000-0000-00000000c101';
  if v_role <> 'user' then
    raise exception 'Test 16 FAILED: platform role not demoted (got %)', v_role;
  end if;

  select role, active into v_member_role, v_member_active
    from public.union_members
   where user_id = '00000000-0000-0000-0000-00000000c101'
     and delegation_id = '00000000-0000-0000-0000-00000000d001';
  if v_member_role <> 'union_admin' or v_member_active is not true then
    raise exception 'Test 16 FAILED: union membership altered on demotion (role=%, active=%)',
      v_member_role, v_member_active;
  end if;

  -- union_rep sigue siendo 'user' de plataforma: el rol sindical no escala.
  select role into v_role from public.profiles where id = '00000000-0000-0000-0000-00000000c102';
  if v_role <> 'user' then
    raise exception 'Test 16 FAILED: union_rep obtained platform role %', v_role;
  end if;
end
$$;

reset role;

-- ============================================================
-- Cleanup
-- ============================================================
drop table if exists public.admin_purge_fk_probe;

delete from public.union_members
 where delegation_id = '00000000-0000-0000-0000-00000000d001';
delete from public.union_delegations
 where code = 'SYNTH-ADMIN-TEST';

delete from public.admin_audit_log
 where entity_type = 'user'
   and entity_id in (
     '00000000-0000-0000-0000-00000000c001',
     '00000000-0000-0000-0000-00000000c002',
     '00000000-0000-0000-0000-00000000c101',
     '00000000-0000-0000-0000-00000000c102'
   );

delete from auth.users
 where id in (
   '00000000-0000-0000-0000-00000000c001',
   '00000000-0000-0000-0000-00000000c002',
   '00000000-0000-0000-0000-00000000c101',
   '00000000-0000-0000-0000-00000000c102'
 );

reset role;
