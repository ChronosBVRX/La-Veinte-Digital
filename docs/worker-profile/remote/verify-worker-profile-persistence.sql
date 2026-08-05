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
  select coalesce(has_function_privilege('authenticated', 'public.confirm_manual_worker_profile(jsonb, jsonb, jsonb, text)', 'EXECUTE'), false) into v_exec;
  if not v_exec then raise exception 'verify failed: confirm_manual_worker_profile'; end if;
  select coalesce(has_function_privilege('authenticated', 'public.confirm_payslip_worker_profile(jsonb, text, text, numeric, text)', 'EXECUTE'), false) into v_exec;
  if not v_exec then raise exception 'verify failed: confirm_payslip_worker_profile'; end if;
  select coalesce(has_function_privilege('authenticated', 'public.change_worker_profile_mode(text)', 'EXECUTE'), false) into v_exec;
  if not v_exec then raise exception 'verify failed: change_worker_profile_mode'; end if;
  select coalesce(has_function_privilege('authenticated', 'public.delete_worker_data()', 'EXECUTE'), false) into v_exec;
  if not v_exec then raise exception 'verify failed: delete_worker_data'; end if;
  select coalesce(has_function_privilege('authenticated', 'public.grant_worker_consent(text, text)', 'EXECUTE'), false) into v_exec;
  if not v_exec then raise exception 'verify failed: grant_worker_consent'; end if;
  select coalesce(has_function_privilege('authenticated', 'public.revoke_worker_consent(text)', 'EXECUTE'), false) into v_exec;
  if not v_exec then raise exception 'verify failed: revoke_worker_consent'; end if;
  select coalesce(has_function_privilege('authenticated', 'public.get_effective_consent(text)', 'EXECUTE'), false) into v_exec;
  if not v_exec then raise exception 'verify failed: get_effective_consent'; end if;
end
$$;

-- 7b. Verificar firmas (patrón de tipos)
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='confirm_manual_worker_profile' and pg_get_function_identity_arguments(p.oid) ~ 'jsonb.*jsonb.*jsonb.*text') then
    raise exception 'verify failed: confirm_manual_worker_profile signature';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='confirm_payslip_worker_profile' and pg_get_function_identity_arguments(p.oid) ~ 'jsonb.*text.*text.*numeric.*text') then
    raise exception 'verify failed: confirm_payslip_worker_profile signature';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='_insert_worker_event' and pg_get_function_identity_arguments(p.oid) ~ 'text.*text.*jsonb') then
    raise exception 'verify failed: _insert_worker_event signature';
  end if;
end
$$;

-- 7c. SECURITY DEFINER en todas las RPCs
do $$
declare v_missing text;
begin
  select string_agg(p.proname, ', ') into v_missing
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname in ('choose_basic_mode','confirm_manual_worker_profile','confirm_payslip_worker_profile','change_worker_profile_mode','delete_worker_data','grant_worker_consent','revoke_worker_consent','get_effective_consent','_insert_worker_event','backfill_worker_profile')
     and p.prosecdef is distinct from true;
  if v_missing is not null then
    raise exception 'verify failed: functions not SECURITY DEFINER: %', v_missing;
  end if;
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
