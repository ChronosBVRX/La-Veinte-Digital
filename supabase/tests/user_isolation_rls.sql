-- ==============================================================================
-- Test Funcional de Aislamiento de Datos y RLS entre Usuarios (PostgreSQL Live)
-- ==============================================================================
-- Se ejecuta en CI contra la instancia Supabase/PostgreSQL efímera.
-- Demuestra de manera concluyente:
-- 1. Un usuario anónimo NO puede leer ni alterar datos protegidos.
-- 2. El Usuario B NO puede leer los datos personales del Usuario A.
-- 3. El Usuario B NO puede modificar ni borrar datos del Usuario A.
-- 4. El Usuario B NO puede insertar registros asignándoselos al Usuario A.
-- 5. El Usuario A SÍ puede leer y gestionar sus propios registros legítimos.
-- ==============================================================================

-- 1. SETUP INICIAL COMO POSTGRES (BYPASS RLS TEMPORAL PARA FIXTURES)
reset role;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-0000000000aa', 'authenticated', 'authenticated', 'usera@laveinte.local', '', now(), '{"provider":"email"}', '{"email":"usera@laveinte.local"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000bb', 'authenticated', 'authenticated', 'userb@laveinte.local', '', now(), '{"provider":"email"}', '{"email":"userb@laveinte.local"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, full_name, matricula, categoria, role)
values
  ('00000000-0000-0000-0000-0000000000aa', 'Trabajador A', 'MAT-A-12345', 'ENFERMERA GENERAL', 'user'),
  ('00000000-0000-0000-0000-0000000000bb', 'Trabajador B', 'MAT-B-67890', 'MEDICO NO FAMILIAR', 'user')
on conflict (id) do update set full_name = excluded.full_name;

-- Insertar datos privados del Usuario A
insert into public.payroll_contexts (user_id, matricula, categoria, base_salary, confidence)
values ('00000000-0000-0000-0000-0000000000aa', 'MAT-A-12345', 'ENFERMERA GENERAL', 12500.50, 0.95)
on conflict (user_id) do update set base_salary = excluded.base_salary;

insert into public.worker_commitments (id, user_id, title, type, start_at, end_at, status)
values ('aa000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'Guardia de A', 'guardia_festiva', now(), now() + interval '8 hours', 'active')
on conflict (id) do update set title = excluded.title;

insert into public.push_devices (user_id, fcm_token, platform)
values ('00000000-0000-0000-0000-0000000000aa', 'token-device-a-super-secret', 'android')
on conflict (fcm_token) do nothing;

insert into public.ai_chat_history (id, user_id, role, content)
values ('aa000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'user', 'Consulta confidencial de A')
on conflict (id) do nothing;

insert into public.worker_preferences (user_id, theme, notifications_enabled)
values ('00000000-0000-0000-0000-0000000000aa', 'dark', true)
on conflict (user_id) do update set theme = excluded.theme;

insert into public.worker_active_context (user_id, employee_number, selection_mode)
values ('00000000-0000-0000-0000-0000000000aa', 'MAT-A-12345', 'AUTO_LATEST')
on conflict (user_id) do update set employee_number = excluded.employee_number;


-- ==============================================================================
-- 2. VERIFICACIÓN DE ROL ANÓNIMO (anon)
-- ==============================================================================
set role anon;
set request.jwt.claim.sub = '';
set request.jwt.claims = '{"role": "anon"}';

do $$
declare cnt int;
begin
  -- Anon no ve perfiles
  select count(*) into cnt from public.profiles;
  if cnt <> 0 then raise exception 'anon pudo leer profiles (cnt=%)', cnt; end if;

  -- Anon no ve payroll_contexts
  select count(*) into cnt from public.payroll_contexts;
  if cnt <> 0 then raise exception 'anon pudo leer payroll_contexts (cnt=%)', cnt; end if;

  -- Anon no ve worker_commitments
  select count(*) into cnt from public.worker_commitments;
  if cnt <> 0 then raise exception 'anon pudo leer worker_commitments (cnt=%)', cnt; end if;

  -- Anon no ve push_devices
  select count(*) into cnt from public.push_devices;
  if cnt <> 0 then raise exception 'anon pudo leer push_devices (cnt=%)', cnt; end if;

  -- Anon no ve ai_chat_history
  select count(*) into cnt from public.ai_chat_history;
  if cnt <> 0 then raise exception 'anon pudo leer ai_chat_history (cnt=%)', cnt; end if;

  -- Anon no ve worker_preferences
  select count(*) into cnt from public.worker_preferences;
  if cnt <> 0 then raise exception 'anon pudo leer worker_preferences (cnt=%)', cnt; end if;

  -- Anon no ve worker_active_context
  select count(*) into cnt from public.worker_active_context;
  if cnt <> 0 then raise exception 'anon pudo leer worker_active_context (cnt=%)', cnt; end if;
end $$;


-- ==============================================================================
-- 3. VERIFICACIÓN DE AISLAMIENTO: USUARIO B INTENTA ACCEDER A DATOS DE USUARIO A
-- ==============================================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000bb';
set request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000bb", "role": "authenticated"}';

do $$
declare
  cnt int;
  row_affected int;
  err_msg text := '';
begin
  -- A) LECTURA CRUZADA (SELECT)
  -- Usuario B solo debe ver SU propio perfil, nunca el de A
  select count(*) into cnt from public.profiles where id = '00000000-0000-0000-0000-0000000000aa';
  if cnt <> 0 then raise exception 'Usuario B pudo leer el perfil de Usuario A'; end if;

  -- Usuario B no ve el contexto de nómina de A
  select count(*) into cnt from public.payroll_contexts where user_id = '00000000-0000-0000-0000-0000000000aa';
  if cnt <> 0 then raise exception 'Usuario B pudo leer payroll_context de Usuario A'; end if;

  -- Usuario B no ve los compromisos de agenda de A
  select count(*) into cnt from public.worker_commitments where user_id = '00000000-0000-0000-0000-0000000000aa';
  if cnt <> 0 then raise exception 'Usuario B pudo leer worker_commitments de Usuario A'; end if;

  -- Usuario B no ve los dispositivos push de A
  select count(*) into cnt from public.push_devices where user_id = '00000000-0000-0000-0000-0000000000aa';
  if cnt <> 0 then raise exception 'Usuario B pudo leer push_devices de Usuario A'; end if;

  -- Usuario B no ve el historial de IA de A
  select count(*) into cnt from public.ai_chat_history where user_id = '00000000-0000-0000-0000-0000000000aa';
  if cnt <> 0 then raise exception 'Usuario B pudo leer ai_chat_history de Usuario A'; end if;

  -- Usuario B no ve preferencias de A
  select count(*) into cnt from public.worker_preferences where user_id = '00000000-0000-0000-0000-0000000000aa';
  if cnt <> 0 then raise exception 'Usuario B pudo leer worker_preferences de Usuario A'; end if;

  -- Usuario B no ve worker_active_context de A
  select count(*) into cnt from public.worker_active_context where user_id = '00000000-0000-0000-0000-0000000000aa';
  if cnt <> 0 then raise exception 'Usuario B pudo leer worker_active_context de Usuario A'; end if;

  -- B) MODIFICACIÓN CRUZADA (UPDATE)
  -- Intento de modificar el perfil de A
  update public.profiles set full_name = 'Hackeado por B' where id = '00000000-0000-0000-0000-0000000000aa';
  get diagnostics row_affected = row_count;
  if row_affected <> 0 then raise exception 'Usuario B pudo actualizar el perfil de A'; end if;

  -- Intento de modificar el salario de A
  update public.payroll_contexts set base_salary = 999999 where user_id = '00000000-0000-0000-0000-0000000000aa';
  get diagnostics row_affected = row_count;
  if row_affected <> 0 then raise exception 'Usuario B pudo actualizar payroll_contexts de A'; end if;

  -- Intento de modificar compromisos de A
  update public.worker_commitments set title = 'Compromiso alterado' where user_id = '00000000-0000-0000-0000-0000000000aa';
  get diagnostics row_affected = row_count;
  if row_affected <> 0 then raise exception 'Usuario B pudo actualizar worker_commitments de A'; end if;

  -- C) ELIMINACIÓN CRUZADA (DELETE)
  delete from public.payroll_contexts where user_id = '00000000-0000-0000-0000-0000000000aa';
  get diagnostics row_affected = row_count;
  if row_affected <> 0 then raise exception 'Usuario B pudo borrar payroll_contexts de A'; end if;

  delete from public.worker_commitments where user_id = '00000000-0000-0000-0000-0000000000aa';
  get diagnostics row_affected = row_count;
  if row_affected <> 0 then raise exception 'Usuario B pudo borrar worker_commitments de A'; end if;

  -- D) INSERCIÓN CRUZADA (INSERT CON IDENTIDAD AJENA)
  -- Intento de insertar un compromiso a nombre de A
  begin
    insert into public.worker_commitments (user_id, title, type, start_at, end_at, status)
    values ('00000000-0000-0000-0000-0000000000aa', 'Infiltrado', 'overtime', now(), now() + interval '1 hour', 'active');
    raise exception 'Usuario B pudo insertar un compromiso asignado a Usuario A';
  exception
    when raise_exception then
      raise;
    when others then
      -- Esperado: la RLS rechaza el WITH CHECK (auth.uid() = user_id)
      null;
  end;

  -- Intento de registrar dispositivo a nombre de A
  begin
    insert into public.push_devices (user_id, fcm_token, platform)
    values ('00000000-0000-0000-0000-0000000000aa', 'token-infiltrado-de-b', 'android');
    raise exception 'Usuario B pudo insertar dispositivo asignado a Usuario A';
  exception
    when raise_exception then
      raise;
    when others then
      null;
  end;
end $$;


-- ==============================================================================
-- 4. VERIFICACIÓN DE ACCESO LEGÍTIMO: USUARIO A PUEDE GESTIONAR SUS PROPIOS DATOS
-- ==============================================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa';
set request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated"}';

do $$
declare
  cnt int;
  row_affected int;
begin
  -- Usuario A lee su propio perfil
  select count(*) into cnt from public.profiles where id = '00000000-0000-0000-0000-0000000000aa';
  if cnt <> 1 then raise exception 'Usuario A no puede leer su propio perfil'; end if;

  -- Usuario A lee su propio payroll_context
  select count(*) into cnt from public.payroll_contexts where user_id = '00000000-0000-0000-0000-0000000000aa';
  if cnt <> 1 then raise exception 'Usuario A no puede leer su propio payroll_context'; end if;

  -- Usuario A lee sus compromisos
  select count(*) into cnt from public.worker_commitments where user_id = '00000000-0000-0000-0000-0000000000aa';
  if cnt <> 1 then raise exception 'Usuario A no puede leer sus compromisos'; end if;

  -- Usuario A puede actualizar su compromiso
  update public.worker_commitments set title = 'Guardia de A (Confirmada)'
  where id = 'aa000000-0000-0000-0000-000000000001';
  get diagnostics row_affected = row_count;
  if row_affected <> 1 then raise exception 'Usuario A no pudo actualizar su compromiso'; end if;
end $$;

-- 5. LIMPIEZA
reset role;
delete from public.worker_commitments where user_id in ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000bb');
delete from public.payroll_contexts where user_id in ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000bb');
delete from public.push_devices where user_id in ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000bb');
delete from public.ai_chat_history where user_id in ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000bb');
delete from public.worker_preferences where user_id in ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000bb');
delete from public.worker_active_context where user_id in ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000bb');
delete from public.profiles where id in ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000bb');
delete from auth.users where id in ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000bb');
