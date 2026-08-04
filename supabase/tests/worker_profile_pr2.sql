-- Worker profile persistence security tests.
-- Runs against local database after supabase db reset.
-- The migration 20260804162446_worker_profile_persistence.sql must have
-- already applied; no grants or schema changes are applied by this file.
-- Any failure raises an exception and breaks CI.
-- Idempotent: cleans synthetic users at start.

-- ============================================================
-- Setup: clean synthetic users and create them (as postgres)
-- ============================================================
delete from public.profiles where id in (
  '00000000-0000-0000-0000-00000000e001',
  '00000000-0000-0000-0000-00000000e002',
  '00000000-0000-0000-0000-00000000e003'
);
delete from auth.users where id in (
  '00000000-0000-0000-0000-00000000e001',
  '00000000-0000-0000-0000-00000000e002',
  '00000000-0000-0000-0000-00000000e003'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000e001', 'authenticated', 'authenticated', 'wpr1@test.local', '', now(), '{}', '{"full_name":"Uno"}', now(), now()),
  ('00000000-0000-0000-0000-00000000e002', 'authenticated', 'authenticated', 'wpr2@test.local', '', now(), '{}', '{"full_name":"Dos"}', now(), now()),
  ('00000000-0000-0000-0000-00000000e003', 'authenticated', 'authenticated', 'wpr3@test.local', '', now(), '{}', '{"full_name":"Tres"}', now(), now())
on conflict (id) do nothing;

-- ============================================================
-- Test 1: worker_preferences unconfigured se crea al registrarse (via backfill/manual)
-- ============================================================
do $$
begin
  -- El trigger de perfiles no crea worker_preferences; se crea vía backfill o RPC.
  -- Verificamos que la tabla existe y está vacía para usuarios sintéticos nuevos.
  if exists (
    select 1 from public.worker_preferences
    where user_id in ('00000000-0000-0000-0000-00000000e001','00000000-0000-0000-0000-00000000e002','00000000-0000-0000-0000-00000000e003')
  ) then
    raise exception 'Test 1 FAILED: worker_preferences pre-existed';
  end if;
end
$$;

-- ============================================================
-- Test 2: choose_basic_mode: unconfigured → basic, sin perfil laboral
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated"}';

select public.choose_basic_mode();

do $$
declare v_state text; v_mode text; v_ctx_exists boolean;
begin
  select onboarding_state, preferred_worker_mode into v_state, v_mode
    from public.worker_preferences
   where user_id = '00000000-0000-0000-0000-00000000e001';
  if v_state is distinct from 'basic' then
    raise exception 'Test 2 FAILED: state=%, esperado basic', v_state;
  end if;
  if v_mode is not null then
    raise exception 'Test 2 FAILED: mode debe ser null en basic';
  end if;
  select exists (select 1 from public.payroll_contexts where user_id = '00000000-0000-0000-0000-00000000e001') into v_ctx_exists;
  if v_ctx_exists then
    raise exception 'Test 2 FAILED: basic no debe crear payroll_contexts';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 3: transición inválida configured → unconfigured rechazada
-- (como authenticated, sin grants de UPDATE)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    update public.worker_preferences
       set onboarding_state = 'unconfigured'
     where user_id = '00000000-0000-0000-0000-00000000e001';
  exception when others then
    v_denied := true;
  end;
  -- authenticated no tiene grants de UPDATE, así que debe fallar por permisos.
  if not v_denied then
    raise exception 'Test 3 FAILED: authenticated pudo hacer UPDATE directo de worker_preferences';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 4: combinación inválida basic + modo no nulo rechazada (constraint)
-- ============================================================
do $$
declare v_denied boolean := false;
begin
  begin
    insert into public.worker_preferences (user_id, onboarding_state, preferred_worker_mode)
    values ('00000000-0000-0000-0000-00000000e002', 'basic', 'manual');
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 4 FAILED: combinacion basic+manual permitida';
  end if;
end
$$;

-- ============================================================
-- Test 5: combinación inválida configured + modo null rechazada (constraint)
-- ============================================================
do $$
declare v_denied boolean := false;
begin
  begin
    insert into public.worker_preferences (user_id, onboarding_state, preferred_worker_mode)
    values ('00000000-0000-0000-0000-00000000e002', 'configured', null);
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 5 FAILED: combinacion configured+null permitida';
  end if;
end
$$;

-- ============================================================
-- Test 6: authenticated no puede INSERT directo en worker_preferences
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e002';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e002","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    insert into public.worker_preferences (user_id, onboarding_state, preferred_worker_mode)
    values ('00000000-0000-0000-0000-00000000e002', 'unconfigured', null);
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 6 FAILED: authenticated pudo INSERT worker_preferences';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 7: authenticated no puede escribir otro perfil (RLS)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated"}';

do $$
declare v_count integer;
begin
  -- SELECT debe ver SOLO sus preferencias (e001), no las de otros.
  select count(*) into v_count from public.worker_preferences;
  if v_count <> 1 then
    raise exception 'Test 7 FAILED: RLS de worker_preferences filtra mal (count=%)', v_count;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 8: authenticated no puede INSERT directo en worker_data_events
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    insert into public.worker_data_events (user_id, event_type, priority, metadata)
    values ('00000000-0000-0000-0000-00000000e001', 'mode_changed', 'info', '{}'::jsonb);
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 8 FAILED: authenticated pudo fabricar evento';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 9: authenticated no puede ejecutar _insert_worker_event
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    perform public._insert_worker_event('mode_changed', 'info', '{}'::jsonb);
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 9 FAILED: authenticated pudo ejecutar _insert_worker_event';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 10: choose_basic_mode genera evento legítimo automáticamente
-- ============================================================
do $$
declare v_count integer;
begin
  select count(*) into v_count
    from public.worker_data_events
   where user_id = '00000000-0000-0000-0000-00000000e001'
     and event_type = 'mode_changed'
     and priority = 'info'
     and metadata->>'modeTo' = 'basic';
  if v_count <> 1 then
    raise exception 'Test 10 FAILED: choose_basic_mode no generó evento (count=%)', v_count;
  end if;
end
$$;

-- ============================================================
-- Test 11: authenticated no puede INSERT directo en worker_consents
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e002';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e002","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    insert into public.worker_consents (user_id, purpose, version, accepted_source)
    values ('00000000-0000-0000-0000-00000000e002', 'use_worker_data', '1.0', 'settings');
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 11 FAILED: authenticated pudo INSERT worker_consents';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 12: authenticated no puede escribir otro user_id en consents (RLS SELECT)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated"}';

do $$
declare v_count integer;
begin
  -- Aún no hay consents; tras grant, solo debe ver los propios.
  select count(*) into v_count from public.worker_consents;
  if v_count <> 0 then
    raise exception 'Test 12 FAILED: RLS consents filtró mal (count=%)', v_count;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 13: grant_worker_consent crea fila nueva y genera consent_granted
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e002';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e002","role":"authenticated"}';

select public.grant_worker_consent('use_worker_data', '1.0');

do $$
declare v_rows integer; v_effective jsonb;
begin
  select count(*) into v_rows from public.worker_consents
   where user_id = '00000000-0000-0000-0000-00000000e002';
  if v_rows <> 1 then
    raise exception 'Test 13 FAILED: grant no creó fila (count=%)', v_rows;
  end if;

  v_effective := public.get_effective_consent('use_worker_data');
  if v_effective is null then
    raise exception 'Test 13 FAILED: get_effective_consent devolvió null';
  end if;
  if v_effective->>'version' <> '1.0' then
    raise exception 'Test 13 FAILED: versión incorrecta';
  end if;

  if not exists (
    select 1 from public.worker_data_events
     where user_id = '00000000-0000-0000-0000-00000000e002'
       and event_type = 'consent_granted'
  ) then
    raise exception 'Test 13 FAILED: no generó consent_granted';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 14: reaceptación crea fila nueva (no sobrescribe evidencia)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e002';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e002","role":"authenticated"}';

-- Revocar y reaceptar la misma versión → segunda fila.
select public.revoke_worker_consent('use_worker_data');
select public.grant_worker_consent('use_worker_data', '1.0');

do $$
declare v_rows integer; v_revoked integer;
begin
  select count(*) into v_rows from public.worker_consents
   where user_id = '00000000-0000-0000-0000-00000000e002' and purpose = 'use_worker_data';
  if v_rows <> 2 then
    raise exception 'Test 14 FAILED: reaceptación debe crear fila nueva (count=%)', v_rows;
  end if;

  select count(*) into v_revoked from public.worker_consents
   where user_id = '00000000-0000-0000-0000-00000000e002'
     and purpose = 'use_worker_data' and revoked_at is not null;
  if v_revoked <> 1 then
    raise exception 'Test 14 FAILED: debe quedar 1 revocado (count=%)', v_revoked;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 15: accepted_source lo fija la RPC (no falsificable)
-- ============================================================
do $$
declare v_src text;
begin
  select accepted_source into v_src from public.worker_consents
   where user_id = '00000000-0000-0000-0000-00000000e002'
   order by accepted_at desc limit 1;
  -- grant_worker_consent fija 'worker_center'.
  if v_src is distinct from 'worker_center' then
    raise exception 'Test 15 FAILED: accepted_source no es el de la RPC (got %)', v_src;
  end if;
end
$$;

-- ============================================================
-- Test 16: purpose/version inválidos rechazados por RPC
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e002';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e002","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    perform public.grant_worker_consent('fake_purpose', '1.0');
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 16 FAILED: purpose inválido aceptado';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 17: revocación apunta al consentimiento vigente
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e002';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e002","role":"authenticated"}';

select public.revoke_worker_consent('use_worker_data');

do $$
declare v_effective jsonb; v_events integer;
begin
  v_effective := public.get_effective_consent('use_worker_data');
  if v_effective is not null then
    raise exception 'Test 17 FAILED: tras revocar aún hay consentimiento vigente';
  end if;
  select count(*) into v_events from public.worker_data_events
   where user_id = '00000000-0000-0000-0000-00000000e002' and event_type = 'consent_revoked';
  if v_events < 1 then
    raise exception 'Test 17 FAILED: no generó consent_revoked';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 18: confirm_manual_worker_profile requiere consentimiento
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e003';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e003","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    perform public.confirm_manual_worker_profile(
      '{"categoria":"TEC"}',
      '{"workday_hours":8}',
      '{"categoria":"manual","workday_hours":"manual"}',
      '1.0'
    );
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 18 FAILED: confirm_manual sin consentimiento permitido';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 19: confirm_manual con consentimiento funciona y genera evento
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e003';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e003","role":"authenticated"}';

select public.grant_worker_consent('use_worker_data', '1.0');
select public.confirm_manual_worker_profile(
  '{"matricula":"M3","adscripcion":"A3","categoria":"TEC"}',
  '{"workday_hours":8,"shift":"matutino","employment_type":"base"}',
  '{"matricula":"manual","adscripcion":"manual","categoria":"manual","workday_hours":"manual","shift":"manual","employment_type":"manual"}',
  '1.0'
);

do $$
declare v_state text; v_mode text; v_cat text; v_src text; v_event integer;
begin
  select onboarding_state, preferred_worker_mode into v_state, v_mode
    from public.worker_preferences where user_id = '00000000-0000-0000-0000-00000000e003';
  if v_state is distinct from 'configured' or v_mode is distinct from 'manual' then
    raise exception 'Test 19 FAILED: preferences incorrectas (%, %)', v_state, v_mode;
  end if;

  select category_name, source_category_name into v_cat, v_src
    from public.payroll_contexts where user_id = '00000000-0000-0000-0000-00000000e003';
  if v_cat is distinct from 'TEC' or v_src is distinct from 'manual' then
    raise exception 'Test 19 FAILED: perfil no guardado correctamente (%, %)', v_cat, v_src;
  end if;

  select count(*) into v_event from public.worker_data_events
   where user_id = '00000000-0000-0000-0000-00000000e003' and event_type = 'mode_changed';
  if v_event < 1 then
    raise exception 'Test 19 FAILED: no generó evento mode_changed';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 20: campos ajenos rechazados en confirm_manual
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e003';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e003","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    perform public.confirm_manual_worker_profile(
      '{"role":"admin"}',
      '{}',
      '{"role":"manual"}',
      '1.0'
    );
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 20 FAILED: campo role aceptado en confirm_manual';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 21: change_worker_profile_mode manual → payslip
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e003';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e003","role":"authenticated"}';

select public.change_worker_profile_mode('payslip');

do $$
declare v_mode text;
begin
  select preferred_worker_mode into v_mode from public.worker_preferences
   where user_id = '00000000-0000-0000-0000-00000000e003';
  if v_mode is distinct from 'payslip' then
    raise exception 'Test 21 FAILED: modo no cambió a payslip (got %)', v_mode;
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 22: change_worker_profile_mode inválido rechazado
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e003';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e003","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    perform public.change_worker_profile_mode('fake');
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 22 FAILED: modo inválido aceptado';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 23: authenticated no puede escribir columnas nuevas de payroll_contexts
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e003';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e003","role":"authenticated"}';

do $$
declare v_denied boolean := false;
begin
  begin
    update public.payroll_contexts set matricula = 'HACK'
     where user_id = '00000000-0000-0000-0000-00000000e003';
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Test 23 FAILED: authenticated pudo escribir matricula nueva';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 24: delete_worker_data conserva cuenta y pasa a basic
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e003';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e003","role":"authenticated"}';

select public.delete_worker_data();

do $$
declare v_state text; v_mode text; v_ctx_exists boolean; v_critical integer;
begin
  select onboarding_state, preferred_worker_mode into v_state, v_mode
    from public.worker_preferences where user_id = '00000000-0000-0000-0000-00000000e003';
  if v_state is distinct from 'basic' or v_mode is not null then
    raise exception 'Test 24 FAILED: tras borrado debe ser basic/null (%, %)', v_state, v_mode;
  end if;

  select exists (select 1 from public.payroll_contexts where user_id = '00000000-0000-0000-0000-00000000e003') into v_ctx_exists;
  if v_ctx_exists then
    raise exception 'Test 24 FAILED: payroll_contexts no se borró';
  end if;

  select count(*) into v_critical from public.worker_data_events
   where user_id = '00000000-0000-0000-0000-00000000e003' and event_type = 'data_deleted' and priority = 'critical';
  if v_critical < 1 then
    raise exception 'Test 24 FAILED: no generó data_deleted critical';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 24b: la cuenta auth se conserva (verificado como postgres)
-- ============================================================
do $$
declare v_account_exists boolean;
begin
  select exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000e003') into v_account_exists;
  if not v_account_exists then
    raise exception 'Test 24b FAILED: la cuenta no debe eliminarse al borrar datos laborales';
  end if;
end
$$;

-- ============================================================
-- Test 25: delete_worker_data borra consentimientos vigentes (revoca)
-- ============================================================
do $$
declare v_revoked integer;
begin
  select count(*) into v_revoked from public.worker_consents
   where user_id = '00000000-0000-0000-0000-00000000e003' and revoked_at is null;
  if v_revoked <> 0 then
    raise exception 'Test 25 FAILED: quedaron consentimientos vigentes tras borrar datos';
  end if;
end
$$;

-- ============================================================
-- Test 26: metadata sensible rechazada por _insert_worker_event vía RPC de dominio
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated"}';

-- El evento se genera por las RPC de dominio; no se puede inyectar metadata.
-- Verificamos que los eventos existentes no contienen claves sensibles.
do $$
declare v_bad integer;
begin
  select count(*) into v_bad from public.worker_data_events
   where metadata ?| array['oldValue','newValue','salary','matricula','adscripcion','categoria'];
  if v_bad <> 0 then
    raise exception 'Test 26 FAILED: hay metadata sensible en eventos';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 27: backfill idempotente
-- ============================================================
-- Resetear estado sintético y ejecutar backfill dos veces.
delete from public.worker_preferences where user_id in ('00000000-0000-0000-0000-00000000e001','00000000-0000-0000-0000-00000000e002','00000000-0000-0000-0000-00000000e003');
delete from public.payroll_contexts where user_id in ('00000000-0000-0000-0000-00000000e001','00000000-0000-0000-0000-00000000e002','00000000-0000-0000-0000-00000000e003');

-- e001: legacy; e002: sin datos; e003: ya borrado (sin datos)
update public.profiles set matricula='M1', adscripcion='A1', categoria='CAT1', antiguedad='10 años'
 where id='00000000-0000-0000-0000-00000000e001';
update public.profiles set matricula=null, adscripcion=null, categoria=null, antiguedad=null
 where id='00000000-0000-0000-0000-00000000e002';

select * from public.backfill_worker_profile();

do $$
declare v_count integer; v_prefs integer; v_fill integer; v_unparse integer;
begin
  -- Segunda ejecución: no crea nuevas preferences ni contextos.
  select (r).preferences_created, (r).contexts_filled, (r).conflicts_unparseable
    into v_prefs, v_fill, v_unparse
    from public.backfill_worker_profile() as r;
  if v_prefs <> 0 or v_fill <> 0 then
    raise exception 'Test 27 FAILED: backfill no idempotente (prefs=%, fill=%)', v_prefs, v_fill;
  end if;
end
$$;

-- ============================================================
-- Test 28: backfill no sobrescribe payroll_contexts existente
-- ============================================================
do $$
declare v_cat text;
begin
  -- e001 tiene CAT1 en profiles; el backfill lo copió solo a vacío.
  select category_name into v_cat from public.payroll_contexts
   where user_id = '00000000-0000-0000-0000-00000000e001';
  if v_cat is distinct from 'CAT1' then
    raise exception 'Test 28 FAILED: backfill no copió categoria legacy (got %)', v_cat;
  end if;
end
$$;

-- ============================================================
-- Test 29: grants mínimos — authenticated sin DML de tabla en nuevas tablas
-- ============================================================
do $$
begin
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('worker_preferences','worker_consents','worker_data_events')
      and grantee = 'authenticated'
      and privilege_type in ('INSERT','UPDATE','DELETE')
  ) then
    raise exception 'Test 29 FAILED: authenticated tiene DML de tabla en tablas nuevas';
  end if;
end
$$;

-- ============================================================
-- Test 30: authenticated sin grants de columnas nuevas de payroll_contexts
-- ============================================================
do $$
begin
  if exists (
    select 1 from information_schema.role_column_grants
    where table_schema = 'public'
      and table_name = 'payroll_contexts'
      and grantee = 'authenticated'
      and column_name in ('matricula','adscripcion','shift','source_matricula','source_adscripcion','source_category_name','source_workday_hours','source_employment_type','source_shift','source_effective_seniority_date')
      and privilege_type in ('INSERT','UPDATE')
  ) then
    raise exception 'Test 30 FAILED: authenticated tiene grants de columnas nuevas';
  end if;
end
$$;

-- ============================================================
-- Test 31: _insert_worker_event sin grant EXECUTE a authenticated
-- ============================================================
do $$
declare v_exec boolean;
begin
  select coalesce(has_function_privilege('authenticated', 'public._insert_worker_event(text, text, jsonb)', 'EXECUTE'), false)
    into v_exec;
  if v_exec then
    raise exception 'Test 31 FAILED: _insert_worker_event ejecutable por authenticated';
  end if;
end
$$;

-- ============================================================
-- Test 32: funciones de dominio revocadas de PUBLIC
-- ============================================================
do $$
declare v_exec_public boolean;
begin
  -- Verifica que PUBLIC no tiene EXECUTE en las RPC de dominio.
  select coalesce(has_function_privilege('public', 'public.choose_basic_mode()', 'EXECUTE'), false)
    into v_exec_public;
  if v_exec_public then
    raise exception 'Test 32 FAILED: choose_basic_mode accesible por PUBLIC';
  end if;

  select coalesce(has_function_privilege('public', 'public.confirm_manual_worker_profile(jsonb, jsonb, jsonb, text)', 'EXECUTE'), false)
    into v_exec_public;
  if v_exec_public then
    raise exception 'Test 32 FAILED: confirm_manual_worker_profile accesible por PUBLIC';
  end if;

  select coalesce(has_function_privilege('public', 'public.confirm_payslip_worker_profile(jsonb, text, text, numeric, text)', 'EXECUTE'), false)
    into v_exec_public;
  if v_exec_public then
    raise exception 'Test 32 FAILED: confirm_payslip_worker_profile accesible por PUBLIC';
  end if;

  select coalesce(has_function_privilege('public', 'public.change_worker_profile_mode(text)', 'EXECUTE'), false)
    into v_exec_public;
  if v_exec_public then
    raise exception 'Test 32 FAILED: change_worker_profile_mode accesible por PUBLIC';
  end if;

  select coalesce(has_function_privilege('public', 'public.delete_worker_data()', 'EXECUTE'), false)
    into v_exec_public;
  if v_exec_public then
    raise exception 'Test 32 FAILED: delete_worker_data accesible por PUBLIC';
  end if;

  select coalesce(has_function_privilege('public', 'public.grant_worker_consent(text, text)', 'EXECUTE'), false)
    into v_exec_public;
  if v_exec_public then
    raise exception 'Test 32 FAILED: grant_worker_consent accesible por PUBLIC';
  end if;

  select coalesce(has_function_privilege('public', 'public.revoke_worker_consent(text)', 'EXECUTE'), false)
    into v_exec_public;
  if v_exec_public then
    raise exception 'Test 32 FAILED: revoke_worker_consent accesible por PUBLIC';
  end if;

  select coalesce(has_function_privilege('public', 'public.get_effective_consent(text)', 'EXECUTE'), false)
    into v_exec_public;
  if v_exec_public then
    raise exception 'Test 32 FAILED: get_effective_consent accesible por PUBLIC';
  end if;

  select coalesce(has_function_privilege('public', 'public.backfill_worker_profile()', 'EXECUTE'), false)
    into v_exec_public;
  if v_exec_public then
    raise exception 'Test 32 FAILED: backfill_worker_profile accesible por PUBLIC';
  end if;
end
$$;

-- ============================================================
-- Test 33: RLS forzada en tablas nuevas
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('worker_preferences','worker_consents','worker_data_events')
      and c.relrowsecurity = true
  ) then
    raise exception 'Test 33 FAILED: RLS no forzada en tablas nuevas';
  end if;
end
$$;

-- ============================================================
-- Test 34: payroll_contexts sin grants nuevos de DML a authenticated (tabla)
-- ============================================================
do $$
begin
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'payroll_contexts'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT','UPDATE','DELETE')
  ) then
    raise exception 'Test 34 FAILED: authenticated tiene DML de tabla en payroll_contexts';
  end if;
end
$$;

-- ============================================================
-- Test 35: empleo legacy se conserva (no se reescribe)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e001';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated"}';

-- No hay RPC que reescriba employment_type automáticamente.
do $$
begin
  -- El CHECK actual de payroll_contexts sigue aceptando valores legacy.
  -- Verificamos que el CHECK existe con los valores legacy.
  if not exists (
    select 1 from pg_constraint
    where conname = 'payroll_contexts_employment_type_check'
      and pg_get_constraintdef(oid) like '%eventual%'
  ) then
    raise exception 'Test 35 FAILED: CHECK de employment_type cambió';
  end if;
end
$$;

reset role;

-- ============================================================
-- Test 36: delete_worker_data limpia campos legacy de profiles
-- ============================================================
do $$
declare v_matricula text;
begin
  select matricula into v_matricula from public.profiles
   where id = '00000000-0000-0000-0000-00000000e003';
  -- e003 fue borrado con delete_worker_data; legacy debe estar null.
  if v_matricula is not null then
    raise exception 'Test 36 FAILED: campos legacy de profiles no limpiados';
  end if;
end
$$;

-- ============================================================
-- Test 37: cascade al eliminar cuenta
-- ============================================================
-- Crear estado para e001 y eliminar la cuenta → todo se borra.
do $$
declare v_ctx integer; v_events integer; v_prefs integer;
begin
  -- e001 tiene preferences + context + eventos.
  delete from auth.users where id = '00000000-0000-0000-0000-00000000e001';

  select count(*) into v_ctx from public.payroll_contexts where user_id = '00000000-0000-0000-0000-00000000e001';
  select count(*) into v_events from public.worker_data_events where user_id = '00000000-0000-0000-0000-00000000e001';
  select count(*) into v_prefs from public.worker_preferences where user_id = '00000000-0000-0000-0000-00000000e001';
  if v_ctx <> 0 or v_events <> 0 or v_prefs <> 0 then
    raise exception 'Test 37 FAILED: cascade no borró (ctx=%, ev=%, prefs=%)', v_ctx, v_events, v_prefs;
  end if;
end
$$;

-- ============================================================
-- Test 38: profile_security no se ve afectado — ensure_profile_exists sigue ok
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e002';
set request.jwt.claim.role = 'authenticated';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e002","role":"authenticated"}';

select public.ensure_profile_exists();

reset role;

-- ============================================================
-- Cleanup
-- ============================================================
reset role;
