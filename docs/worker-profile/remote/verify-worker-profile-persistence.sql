-- verify-worker-profile-persistence.sql
-- Verificación post-aplicación (read-only). No modifica datos.
-- Ejecutar después de apply-worker-profile-persistence.sql

begin transaction read only;

-- 1. Tablas nuevas existen
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='worker_preferences') then
    raise exception 'verify failed: worker_preferences table missing';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='worker_consents') then
    raise exception 'verify failed: worker_consents table missing';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='worker_data_events') then
    raise exception 'verify failed: worker_data_events table missing';
  end if;
end
$$;

-- 2. Columnas nuevas en payroll_contexts
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payroll_contexts' and column_name='matricula') then
    raise exception 'verify failed: payroll_contexts.matricula';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payroll_contexts' and column_name='source_matricula') then
    raise exception 'verify failed: payroll_contexts.source_matricula';
  end if;
end
$$;

-- 3. RLS habilitada en tablas nuevas
do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='worker_preferences' and c.relrowsecurity=true) then
    raise exception 'verify failed: RLS not enabled on worker_preferences';
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='worker_consents' and c.relrowsecurity=true) then
    raise exception 'verify failed: RLS not enabled on worker_consents';
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='worker_data_events' and c.relrowsecurity=true) then
    raise exception 'verify failed: RLS not enabled on worker_data_events';
  end if;
end
$$;

-- 4. Policies existen en tablas nuevas
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='worker_preferences' and policyname='Users can read own worker preferences') then
    raise exception 'verify failed: worker_preferences policy';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='worker_consents' and policyname='Users can read own worker consents') then
    raise exception 'verify failed: worker_consents policy';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='worker_data_events' and policyname='Users can read own worker data events') then
    raise exception 'verify failed: worker_data_events policy';
  end if;
end
$$;

-- 5. Grants mínimos: authenticated solo SELECT en tablas nuevas
do $$
begin
  if exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='worker_preferences' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')) then
    raise exception 'verify failed: authenticated has DML on worker_preferences';
  end if;
  if exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='worker_consents' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')) then
    raise exception 'verify failed: authenticated has DML on worker_consents';
  end if;
  if exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='worker_data_events' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')) then
    raise exception 'verify failed: authenticated has DML on worker_data_events';
  end if;
end
$$;

-- 6. Grants: authenticated tiene SELECT en payroll_contexts
do $$
begin
  if not exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='payroll_contexts' and grantee='authenticated' and privilege_type='SELECT') then
    raise exception 'verify failed: authenticated missing SELECT on payroll_contexts';
  end if;
end
$$;

-- 7. RPCs públicas existen y son ejecutables por authenticated
do $$
declare v_exec boolean;
begin
  select coalesce(has_function_privilege('authenticated', 'public.choose_basic_mode()', 'EXECUTE'), false) into v_exec;
  if not v_exec then raise exception 'verify failed: choose_basic_mode not executable by authenticated'; end if;
  select coalesce(has_function_privilege('authenticated', 'public.delete_worker_data()', 'EXECUTE'), false) into v_exec;
  if not v_exec then raise exception 'verify failed: delete_worker_data not executable by authenticated'; end if;
  select coalesce(has_function_privilege('authenticated', 'public.grant_worker_consent(text, text)', 'EXECUTE'), false) into v_exec;
  if not v_exec then raise exception 'verify failed: grant_worker_consent not executable by authenticated'; end if;
  select coalesce(has_function_privilege('authenticated', 'public.get_effective_consent(text)', 'EXECUTE'), false) into v_exec;
  if not v_exec then raise exception 'verify failed: get_effective_consent not executable by authenticated'; end if;
end
$$;

-- 8. Función interna NO ejecutable por authenticated
do $$
declare v_exec boolean;
begin
  select coalesce(has_function_privilege('authenticated', 'public._insert_worker_event(text, text, jsonb)', 'EXECUTE'), false) into v_exec;
  if v_exec then raise exception 'verify failed: _insert_worker_event executable by authenticated'; end if;
end
$$;

-- 9. anon no ejecuta ninguna RPC de dominio
do $$
declare v_exec boolean;
begin
  select coalesce(has_function_privilege('anon', 'public.choose_basic_mode()', 'EXECUTE'), false) into v_exec;
  if v_exec then raise exception 'verify failed: anon can execute choose_basic_mode'; end if;
  select coalesce(has_function_privilege('anon', 'public.delete_worker_data()', 'EXECUTE'), false) into v_exec;
  if v_exec then raise exception 'verify failed: anon can execute delete_worker_data'; end if;
end
$$;

-- 10. backfill produjo worker_preferences para los usuarios existentes
do $$
declare v_prefs integer; v_profiles integer;
begin
  select count(*) into v_profiles from public.profiles;
  select count(*) into v_prefs from public.worker_preferences;
  if v_prefs < v_profiles then
    raise warning 'verify warning: % profiles but only % worker_preferences (backfill pending?)', v_profiles, v_prefs;
  end if;
end
$$;

rollback;
