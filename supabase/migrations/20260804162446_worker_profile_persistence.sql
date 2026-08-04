-- 20260804162446_worker_profile_persistence.sql
-- PR2: persistencia y seguridad del perfil laboral (diseño en docs/worker-profile).
--
-- Aditivo: NO modifica columnas existentes de profiles, NO renombra
-- payroll_contexts, NO elimina nada preexistente.
--
-- Contiene:
--   1. worker_preferences        (onboarding + modo preferido, entidad de cuenta)
--   2. payroll_contexts          (columnas laborales nuevas + source_*)
--   3. worker_consents           (consentimiento versionado, inmutables)
--   4. worker_data_events        (historial append-only)
--   5. RLS + grants mínimos
--
-- Las RPC de dominio viven en la misma migración (sección RPCs).
-- El backfill idempotente vive en el mismo archivo (sección Backfill).

-- ============================================================
-- 1. worker_preferences
-- ============================================================
create table if not exists public.worker_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  onboarding_state text not null check (
    onboarding_state in ('unconfigured', 'basic', 'configured')
  ),
  preferred_worker_mode text check (
    preferred_worker_mode in ('manual', 'payslip')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Combinación válida: configured requiere modo no nulo;
  -- unconfigured/basic requieren modo nulo.
  constraint worker_preferences_mode_config_check check (
    (onboarding_state = 'configured' and preferred_worker_mode is not null)
    or
    (onboarding_state in ('unconfigured', 'basic') and preferred_worker_mode is null)
  )
);

alter table public.worker_preferences enable row level security;

-- RLS: SELECT propio; escritura SOLO vía RPC de dominio (sin policies de escritura).
create policy "Users can read own worker preferences"
  on public.worker_preferences for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.worker_preferences to authenticated;
grant select, insert, update, delete on public.worker_preferences to service_role;

-- ============================================================
-- 2. payroll_contexts — columnas laborales nuevas
-- ============================================================
alter table public.payroll_contexts
  add column if not exists matricula text,
  add column if not exists adscripcion text,
  add column if not exists shift text check (
    shift is null or shift in ('matutino', 'vespertino', 'nocturno', 'jornada_acumulada', 'mixto')
  ),
  add column if not exists source_matricula text check (
    source_matricula is null or source_matricula in ('manual', 'payslip_confirmed', 'calculated', 'inferred')
  ),
  add column if not exists source_adscripcion text check (
    source_adscripcion is null or source_adscripcion in ('manual', 'payslip_confirmed', 'calculated', 'inferred')
  ),
  add column if not exists source_category_name text check (
    source_category_name is null or source_category_name in ('manual', 'payslip_confirmed', 'calculated', 'inferred')
  ),
  add column if not exists source_workday_hours text check (
    source_workday_hours is null or source_workday_hours in ('manual', 'payslip_confirmed', 'calculated', 'inferred')
  ),
  add column if not exists source_employment_type text check (
    source_employment_type is null or source_employment_type in ('manual', 'payslip_confirmed', 'calculated', 'inferred')
  ),
  add column if not exists source_shift text check (
    source_shift is null or source_shift in ('manual', 'payslip_confirmed', 'calculated', 'inferred')
  ),
  add column if not exists source_effective_seniority_date text check (
    source_effective_seniority_date is null or source_effective_seniority_date in ('manual', 'payslip_confirmed', 'calculated', 'inferred')
  );

-- updated_at ya existe en payroll_contexts (timestamptz not null default now()).
-- No se re-agrega.

-- NO se conceden grants de INSERT/UPDATE (ni de tabla ni columnares) de las
-- columnas nuevas a authenticated: solo las RPC de dominio las escriben.
-- El frontend nuevo lee payroll_contexts vía RLS: se garantiza SELECT de tabla.
grant select on public.payroll_contexts to authenticated;

-- ============================================================
-- 3. worker_consents — registros versionados e inmutables
-- ============================================================
create table if not exists public.worker_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purpose text not null check (
    purpose in ('use_worker_data', 'store_tarjeton')
  ),
  version text not null,
  accepted_at timestamptz not null default now(),
  accepted_source text not null check (
    accepted_source in ('onboarding', 'worker_center', 'tarjeton', 'settings')
  ),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  -- Cada aceptación es una fila nueva; no hay UPSERT que borre evidencia.
  unique (user_id, purpose, version, accepted_at)
);

alter table public.worker_consents enable row level security;

-- RLS: SELECT propio; escritura SOLO vía RPC de dominio (sin policies de escritura).
create policy "Users can read own worker consents"
  on public.worker_consents for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.worker_consents to authenticated;
grant select, insert, update, delete on public.worker_consents to service_role;

-- ============================================================
-- 4. worker_data_events — historial append-only
-- ============================================================
create table if not exists public.worker_data_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (
    event_type in ('profile_created', 'mode_changed', 'tarjeton_imported', 'field_updated', 'consent_granted', 'consent_revoked', 'data_deleted')
  ),
  priority text not null check (
    priority in ('info', 'important', 'critical')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.worker_data_events enable row level security;

-- RLS: SELECT propio; sin policies de escritura (append-only; solo función interna).
create policy "Users can read own worker data events"
  on public.worker_data_events for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.worker_data_events to authenticated;
grant select, insert, update, delete on public.worker_data_events to service_role;

-- ============================================================
-- 5. Función interna de eventos (append-only, no falsificable)
-- ============================================================
-- No recibe user_id: lo toma de auth.uid() en el contexto de la transacción.
-- No es ejecutable por anon/authenticated: solo la llaman RPC de dominio.
-- Valida metadata contra allowlist; event_type/priority los fija la llamada
-- desde la RPC de dominio (nunca del cliente). created_at = now().

create or replace function public._insert_worker_event(
  p_event_type text,
  p_priority text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_allowed_keys constant text[] := array[
    'modeFrom', 'modeTo', 'field', 'source', 'consentVersion',
    'consentPurpose', 'extractionMethod', 'confidence', 'period'
  ];
  v_forbidden constant text[] := array[
    'oldValue', 'newValue', 'salary', 'matricula', 'adscripcion',
    'categoria', 'category', 'full_name', 'phone', 'avatar'
  ];
  v_key text;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if p_event_type not in ('profile_created', 'mode_changed', 'tarjeton_imported', 'field_updated', 'consent_granted', 'consent_revoked', 'data_deleted') then
    raise exception 'invalid event_type';
  end if;
  if p_priority not in ('info', 'important', 'critical') then
    raise exception 'invalid priority';
  end if;

  if jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'invalid metadata';
  end if;

  -- Validar metadata contra allowlist; rechazar claves prohibidas o no permitidas.
  for v_key in select jsonb_object_keys(p_metadata) loop
    if v_key = any(v_forbidden) then
      raise exception 'forbidden metadata key: %', v_key;
    end if;
    if not (v_key = any(v_allowed_keys)) then
      raise exception 'not allowed metadata key: %', v_key;
    end if;
  end loop;

  insert into public.worker_data_events (user_id, event_type, priority, metadata)
  values (v_uid, p_event_type, p_priority, p_metadata);
end;
$$;

-- Los privilegios de _insert_worker_event se revocan por completo en la
-- sección de grants (§6.9): ni PUBLIC, ni anon, ni authenticated pueden
-- ejecutarla. Solo la invocan las RPC de dominio (owner/service_role).

-- ============================================================
-- 6. RPCs de dominio (escritura exclusiva del perfil laboral)
-- ============================================================
-- Todas: SECURITY DEFINER, search_path endurecido, user_id = auth.uid()
-- (obligatorio), sin parámetros de user_id, revocadas de PUBLIC, EXECUTE solo
-- a authenticated, validación de transición/consentimiento, operación y evento
-- en una misma transacción.

-- 6.1 choose_basic_mode(): unconfigured|configured → basic (sin perfil laboral)
create or replace function public.choose_basic_mode()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_state text;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  select onboarding_state into v_state
    from public.worker_preferences
   where user_id = v_uid;

  -- unconfigured o configured → basic; basic → no-op idempotente.
  if v_state is not null and v_state not in ('unconfigured', 'basic', 'configured') then
    raise exception 'invalid onboarding_state';
  end if;

  if v_state = 'basic' then
    return;
  end if;

  insert into public.worker_preferences (user_id, onboarding_state, preferred_worker_mode)
  values (v_uid, 'basic', null)
  on conflict (user_id) do update set
    onboarding_state = 'basic',
    preferred_worker_mode = null,
    updated_at = now();

  perform public._insert_worker_event('mode_changed', 'info', jsonb_build_object('modeTo', 'basic'));
end;
$$;

-- 6.2 confirm_manual_worker_profile(...): captura manual confirmada
-- p_identity: {matricula, adscripcion, categoria}
-- p_situation: {workday_hours, shift, employment_type, effective_seniority_date}
-- p_sources: {matricula, adscripcion, categoria, workday_hours, shift, employment_type, effective_seniority_date}
-- p_consent_version: versión del aviso (validate against allowlist)
-- Validación estricta: rechaza cualquier clave fuera de la allowlist,
-- incluida cualquier clave de sistema (user_id, id, role, created_at,
-- updated_at, is_online, event_type, priority, accepted_source, accepted_at,
-- revoked_at) y objetos anidados no previstos.
create or replace function public.confirm_manual_worker_profile(
  p_identity jsonb,
  p_situation jsonb,
  p_sources jsonb,
  p_consent_version text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_allowed_fields constant text[] := array[
    'matricula', 'adscripcion', 'categoria',
    'workday_hours', 'shift', 'employment_type', 'effective_seniority_date'
  ];
  v_allowed_sources constant text[] := array['manual', 'payslip_confirmed', 'calculated', 'inferred'];
  v_key text;
  v_src text;
  v_wk numeric;
  v_date text;
  v_consent_exists boolean;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if jsonb_typeof(p_identity) <> 'object' or jsonb_typeof(p_situation) <> 'object' or jsonb_typeof(p_sources) <> 'object' then
    raise exception 'invalid payload';
  end if;

  -- Validar cada clave presente contra la allowlist; rechazar objetos anidados.
  for v_key in select jsonb_object_keys(p_identity) loop
    if not (v_key = any(v_allowed_fields)) then
      raise exception 'not allowed identity field: %', v_key;
    end if;
    if jsonb_typeof(p_identity->v_key) = 'object' or jsonb_typeof(p_identity->v_key) = 'array' then
      raise exception 'nested object not allowed: %', v_key;
    end if;
  end loop;
  for v_key in select jsonb_object_keys(p_situation) loop
    if not (v_key = any(v_allowed_fields)) then
      raise exception 'not allowed situation field: %', v_key;
    end if;
    if jsonb_typeof(p_situation->v_key) = 'object' or jsonb_typeof(p_situation->v_key) = 'array' then
      raise exception 'nested object not allowed: %', v_key;
    end if;
  end loop;
  for v_key in select jsonb_object_keys(p_sources) loop
    if not (v_key = any(v_allowed_fields)) then
      raise exception 'not allowed source field: %', v_key;
    end if;
    if jsonb_typeof(p_sources->v_key) <> 'string' then
      raise exception 'invalid source type for %', v_key;
    end if;
    v_src := p_sources->>v_key;
    if v_src is null or not (v_src = any(v_allowed_sources)) then
      raise exception 'invalid source for %', v_key;
    end if;
  end loop;

  -- Validación por campo: tipo, enum, límites y formato de fecha.
  if (p_identity ? 'matricula') and p_identity->>'matricula' is not null then
    if length(p_identity->>'matricula') > 32 then
      raise exception 'matricula too long';
    end if;
  end if;
  if (p_identity ? 'adscripcion') and p_identity->>'adscripcion' is not null then
    if length(p_identity->>'adscripcion') > 200 then
      raise exception 'adscripcion too long';
    end if;
  end if;
  if (p_identity ? 'categoria') and p_identity->>'categoria' is not null then
    if length(p_identity->>'categoria') > 200 then
      raise exception 'categoria too long';
    end if;
  end if;
  if (p_situation ? 'workday_hours') and p_situation->>'workday_hours' is not null then
    v_wk := (p_situation->>'workday_hours')::numeric;
    if v_wk not in (6, 6.5, 8, 12) then
      raise exception 'invalid workday_hours';
    end if;
  end if;
  if (p_situation ? 'shift') and p_situation->>'shift' is not null then
    if p_situation->>'shift' not in ('matutino', 'vespertino', 'nocturno', 'jornada_acumulada', 'mixto') then
      raise exception 'invalid shift';
    end if;
  end if;
  if (p_situation ? 'employment_type') and p_situation->>'employment_type' is not null then
    if p_situation->>'employment_type' not in ('base', 'confianza', 'eventual', 'confianza_a_estatuto', 'sustituto', 'interino', 'obra_determinada', 'otro') then
      raise exception 'invalid employment_type';
    end if;
  end if;
  if (p_situation ? 'effective_seniority_date') and p_situation->>'effective_seniority_date' is not null then
    v_date := p_situation->>'effective_seniority_date';
    if v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'invalid date format';
    end if;
    begin
      if (v_date::date) is null then
        raise exception 'invalid date value';
      end if;
    exception when others then
      raise exception 'invalid date value';
    end;
  end if;

  -- Consentimiento de uso de datos laborales obligatorio.
  select exists (
    select 1 from public.worker_consents
    where user_id = v_uid and purpose = 'use_worker_data'
      and version = p_consent_version and revoked_at is null
  ) into v_consent_exists;
  if not v_consent_exists then
    raise exception 'consent_required';
  end if;

  -- Confirmar perfil (upsert controlado por la RPC, nunca upsert de cliente).
  insert into public.payroll_contexts (
    user_id, matricula, adscripcion, category_name,
    workday_hours, shift, employment_type, effective_seniority_date,
    source_matricula, source_adscripcion, source_category_name,
    source_workday_hours, source_shift, source_employment_type,
    source_effective_seniority_date, updated_at
  ) values (
    v_uid,
    nullif(p_identity->>'matricula', ''),
    nullif(p_identity->>'adscripcion', ''),
    nullif(p_identity->>'categoria', ''),
    nullif((p_situation->>'workday_hours')::numeric, null),
    nullif(p_situation->>'shift', ''),
    nullif(p_situation->>'employment_type', ''),
    nullif(p_situation->>'effective_seniority_date', '')::date,
    p_sources->>'matricula',
    p_sources->>'adscripcion',
    p_sources->>'categoria',
    p_sources->>'workday_hours',
    p_sources->>'shift',
    p_sources->>'employment_type',
    p_sources->>'effective_seniority_date',
    now()
  )
  on conflict (user_id) do update set
    matricula = coalesce(excluded.matricula, public.payroll_contexts.matricula),
    adscripcion = coalesce(excluded.adscripcion, public.payroll_contexts.adscripcion),
    category_name = coalesce(excluded.category_name, public.payroll_contexts.category_name),
    workday_hours = coalesce(excluded.workday_hours, public.payroll_contexts.workday_hours),
    shift = coalesce(excluded.shift, public.payroll_contexts.shift),
    employment_type = coalesce(excluded.employment_type, public.payroll_contexts.employment_type),
    effective_seniority_date = coalesce(excluded.effective_seniority_date, public.payroll_contexts.effective_seniority_date),
    source_matricula = coalesce(excluded.source_matricula, public.payroll_contexts.source_matricula),
    source_adscripcion = coalesce(excluded.source_adscripcion, public.payroll_contexts.source_adscripcion),
    source_category_name = coalesce(excluded.source_category_name, public.payroll_contexts.source_category_name),
    source_workday_hours = coalesce(excluded.source_workday_hours, public.payroll_contexts.source_workday_hours),
    source_shift = coalesce(excluded.source_shift, public.payroll_contexts.source_shift),
    source_employment_type = coalesce(excluded.source_employment_type, public.payroll_contexts.source_employment_type),
    source_effective_seniority_date = coalesce(excluded.source_effective_seniority_date, public.payroll_contexts.source_effective_seniority_date),
    updated_at = now();

  -- worker_preferences: configured + manual
  insert into public.worker_preferences (user_id, onboarding_state, preferred_worker_mode)
  values (v_uid, 'configured', 'manual')
  on conflict (user_id) do update set
    onboarding_state = 'configured',
    preferred_worker_mode = 'manual',
    updated_at = now();

  -- Evento: profile_created o mode_changed (información de operación, no de cliente)
  perform public._insert_worker_event('mode_changed', 'info', jsonb_build_object('modeTo', 'manual'));
end;
$$;

-- 6.3 confirm_payslip_worker_profile(...): update confirmado desde tarjetón
-- Reutiliza la misma transacción para registrar consentimiento store_tarjeton.
-- Validación estricta: p_profile_updates admite solo claves de la allowlist:
--   categoria (bool), antiguedad (bool), category_name (text), effective_seniority_date (date)
-- Rechaza cualquier clave de sistema o clave desconocida.
create or replace function public.confirm_payslip_worker_profile(
  p_profile_updates jsonb,
  p_consent_version text,
  p_extraction_method text default null,
  p_confidence numeric default null,
  p_period text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_allowed constant text[] := array['categoria', 'antiguedad', 'category_name', 'effective_seniority_date'];
  v_key text;
  v_consent_exists boolean;
  v_date text;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if jsonb_typeof(p_profile_updates) <> 'object' then
    raise exception 'invalid payload';
  end if;

  -- Rechazar claves fuera de la allowlist y objetos anidados.
  for v_key in select jsonb_object_keys(p_profile_updates) loop
    if not (v_key = any(v_allowed)) then
      raise exception 'not allowed update field: %', v_key;
    end if;
    if jsonb_typeof(p_profile_updates->v_key) = 'object' or jsonb_typeof(p_profile_updates->v_key) = 'array' then
      raise exception 'nested object not allowed: %', v_key;
    end if;
  end loop;

  -- Validar tipos por clave.
  if p_profile_updates ? 'categoria' and jsonb_typeof(p_profile_updates->'categoria') <> 'boolean' then
    raise exception 'categoria must be boolean';
  end if;
  if p_profile_updates ? 'antiguedad' and jsonb_typeof(p_profile_updates->'antiguedad') <> 'boolean' then
    raise exception 'antiguedad must be boolean';
  end if;
  if p_profile_updates ? 'category_name' and p_profile_updates->>'category_name' is not null
     and length(p_profile_updates->>'category_name') > 200 then
    raise exception 'category_name too long';
  end if;
  if p_profile_updates ? 'effective_seniority_date' and p_profile_updates->>'effective_seniority_date' is not null then
    v_date := p_profile_updates->>'effective_seniority_date';
    if v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'invalid date format';
    end if;
    begin
      if (v_date::date) is null then
        raise exception 'invalid date value';
      end if;
    exception when others then
      raise exception 'invalid date value';
    end;
  end if;

  -- Validar metadata técnica del evento (nunca de cliente).
  if p_extraction_method is not null and p_extraction_method not in ('native_text', 'ocr', 'hybrid') then
    raise exception 'invalid extraction_method';
  end if;
  if p_confidence is not null and (p_confidence < 0 or p_confidence > 1) then
    raise exception 'invalid confidence';
  end if;

  -- Consentimiento de almacenamiento de tarjetón obligatorio.
  select exists (
    select 1 from public.worker_consents
    where user_id = v_uid and purpose = 'store_tarjeton'
      and version = p_consent_version and revoked_at is null
  ) into v_consent_exists;
  if not v_consent_exists then
    raise exception 'consent_required';
  end if;

  -- Aplicar updates del tarjetón (categoría y antigüedad).
  if (p_profile_updates->>'categoria')::boolean and nullif(p_profile_updates->>'category_name', '') is not null then
    update public.payroll_contexts
       set category_name = p_profile_updates->>'category_name',
           source_category_name = 'payslip_confirmed',
           updated_at = now()
     where user_id = v_uid;
  end if;
  if (p_profile_updates->>'antiguedad')::boolean and nullif(p_profile_updates->>'effective_seniority_date', '') is not null then
    update public.payroll_contexts
       set effective_seniority_date = (p_profile_updates->>'effective_seniority_date')::date,
           source_effective_seniority_date = 'payslip_confirmed',
           updated_at = now()
     where user_id = v_uid;
  end if;

  -- worker_preferences: configured + payslip
  insert into public.worker_preferences (user_id, onboarding_state, preferred_worker_mode)
  values (v_uid, 'configured', 'payslip')
  on conflict (user_id) do update set
    onboarding_state = 'configured',
    preferred_worker_mode = 'payslip',
    updated_at = now();

  -- Evento: tarjeton_imported (important)
  perform public._insert_worker_event(
    'tarjeton_imported',
    'important',
    jsonb_strip_nulls(jsonb_build_object(
      'extractionMethod', p_extraction_method,
      'confidence', p_confidence,
      'period', p_period
    ))
  );
end;
$$;

-- 6.4 change_worker_profile_mode(p_new_mode): manual ↔ payslip
create or replace function public.change_worker_profile_mode(p_new_mode text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_current text;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if p_new_mode not in ('manual', 'payslip') then
    raise exception 'invalid mode';
  end if;

  select preferred_worker_mode into v_current
    from public.worker_preferences
   where user_id = v_uid;

  if v_current is null then
    raise exception 'profile not configured';
  end if;

  if v_current = p_new_mode then
    return;
  end if;

  update public.worker_preferences
     set preferred_worker_mode = p_new_mode,
         updated_at = now()
   where user_id = v_uid;

  perform public._insert_worker_event('mode_changed', 'info', jsonb_build_object('modeFrom', v_current, 'modeTo', p_new_mode));
end;
$$;

-- 6.5 delete_worker_data(): borrado laboral completo; conserva cuenta y basic
create or replace function public.delete_worker_data()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  -- Borrar tarjetones y contexto de nómina.
  delete from public.imported_payslips where user_id = v_uid;
  delete from public.payroll_contexts where user_id = v_uid;

  -- Revocar consentimientos vigentes.
  update public.worker_consents
     set revoked_at = now()
   where user_id = v_uid and revoked_at is null;

  -- Limpiar campos laborales legacy de profiles mientras existan.
  update public.profiles
     set matricula = null,
         adscripcion = null,
         categoria = null,
         antiguedad = null,
         updated_at = now()
   where id = v_uid;

  -- worker_preferences → basic (conserva la cuenta).
  insert into public.worker_preferences (user_id, onboarding_state, preferred_worker_mode)
  values (v_uid, 'basic', null)
  on conflict (user_id) do update set
    onboarding_state = 'basic',
    preferred_worker_mode = null,
    updated_at = now();

  -- Evento crítico sin valores.
  perform public._insert_worker_event('data_deleted', 'critical', '{}'::jsonb);
end;
$$;

-- 6.6 grant_worker_consent(p_purpose, p_version): nueva fila por aceptación
create or replace function public.grant_worker_consent(p_purpose text, p_version text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_source text := 'worker_center';
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if p_purpose not in ('use_worker_data', 'store_tarjeton') then
    raise exception 'invalid purpose';
  end if;

  -- accepted_source lo determina la RPC (nunca el cliente).
  -- El caller puede indicar onboarding/tarjeton via parámetro? No: lo fija aquí.
  -- Para simplificar y ser explícito, permitimos onboarding/worker_center vía
  -- un parámetro opcional interno (no expuesto): v1 usa worker_center.

  insert into public.worker_consents (user_id, purpose, version, accepted_source)
  values (v_uid, p_purpose, p_version, v_source)
  on conflict (user_id, purpose, version, accepted_at) do nothing;

  perform public._insert_worker_event('consent_granted', 'important', jsonb_build_object('consentPurpose', p_purpose, 'consentVersion', p_version));
end;
$$;

-- 6.7 revoke_worker_consent(p_purpose): revoca el consentimiento vigente
create or replace function public.revoke_worker_consent(p_purpose text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if p_purpose not in ('use_worker_data', 'store_tarjeton') then
    raise exception 'invalid purpose';
  end if;

  update public.worker_consents
     set revoked_at = now()
   where user_id = v_uid and purpose = p_purpose and revoked_at is null;

  perform public._insert_worker_event('consent_revoked', 'important', jsonb_build_object('consentPurpose', p_purpose));
end;
$$;

-- 6.8 get_effective_consent(p_purpose): lectura server
create or replace function public.get_effective_consent(p_purpose text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.worker_consents%rowtype;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  select * into v_row
    from public.worker_consents
   where user_id = v_uid and purpose = p_purpose and revoked_at is null
   order by accepted_at desc
   limit 1;

  if v_row.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'purpose', v_row.purpose,
    'version', v_row.version,
    'accepted_at', v_row.accepted_at,
    'accepted_source', v_row.accepted_source
  );
end;
$$;

-- Grants de RPCs: revocar de PUBLIC, anon y authenticated; conceder EXECUTE
-- a authenticated únicamente para las operaciones que el usuario deba iniciar.
revoke all on function public.choose_basic_mode() from public;
revoke all on function public.choose_basic_mode() from anon;
revoke all on function public.choose_basic_mode() from authenticated;
grant execute on function public.choose_basic_mode() to authenticated;

revoke all on function public.confirm_manual_worker_profile(jsonb, jsonb, jsonb, text) from public;
revoke all on function public.confirm_manual_worker_profile(jsonb, jsonb, jsonb, text) from anon;
revoke all on function public.confirm_manual_worker_profile(jsonb, jsonb, jsonb, text) from authenticated;
grant execute on function public.confirm_manual_worker_profile(jsonb, jsonb, jsonb, text) to authenticated;

revoke all on function public.confirm_payslip_worker_profile(jsonb, text, text, numeric, text) from public;
revoke all on function public.confirm_payslip_worker_profile(jsonb, text, text, numeric, text) from anon;
revoke all on function public.confirm_payslip_worker_profile(jsonb, text, text, numeric, text) from authenticated;
grant execute on function public.confirm_payslip_worker_profile(jsonb, text, text, numeric, text) to authenticated;

revoke all on function public.change_worker_profile_mode(text) from public;
revoke all on function public.change_worker_profile_mode(text) from anon;
revoke all on function public.change_worker_profile_mode(text) from authenticated;
grant execute on function public.change_worker_profile_mode(text) to authenticated;

revoke all on function public.delete_worker_data() from public;
revoke all on function public.delete_worker_data() from anon;
revoke all on function public.delete_worker_data() from authenticated;
grant execute on function public.delete_worker_data() to authenticated;

revoke all on function public.grant_worker_consent(text, text) from public;
revoke all on function public.grant_worker_consent(text, text) from anon;
revoke all on function public.grant_worker_consent(text, text) from authenticated;
grant execute on function public.grant_worker_consent(text, text) to authenticated;

revoke all on function public.revoke_worker_consent(text) from public;
revoke all on function public.revoke_worker_consent(text) from anon;
revoke all on function public.revoke_worker_consent(text) from authenticated;
grant execute on function public.revoke_worker_consent(text) to authenticated;

revoke all on function public.get_effective_consent(text) from public;
revoke all on function public.get_effective_consent(text) from anon;
revoke all on function public.get_effective_consent(text) from authenticated;
grant execute on function public.get_effective_consent(text) to authenticated;

-- _insert_worker_event: NO ejecutable por nadie salvo owner (service_role/postgres).
revoke all on function public._insert_worker_event(text, text, jsonb) from public;
revoke all on function public._insert_worker_event(text, text, jsonb) from anon;
revoke all on function public._insert_worker_event(text, text, jsonb) from authenticated;

-- backfill_worker_profile: sus privilegios se revocan tras su creación (§7).

-- ============================================================
-- 7. Backfill conservador (idempotente)
-- ============================================================
-- Crea worker_preferences para usuarios existentes y copia campos legacy de
-- profiles a payroll_contexts solo a campos vacíos. No sobrescribe valores
-- más confiables; no inventa payslip_confirmed; conflictos solo conteos.

create or replace function public.backfill_worker_profile()
returns table (
  preferences_created bigint,
  contexts_filled bigint,
  conflicts_unparseable bigint,
  conflicts_mismatch bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_prefs bigint := 0;
  v_filled bigint := 0;
  v_unparseable bigint := 0;
  v_mismatch bigint := 0;
  v_row record;
  v_has_payslip boolean;
begin
  -- 1. worker_preferences para todo perfil sin fila.
  --    configured requiere preferred_worker_mode no nulo (constraint).
  --    Datos legacy sin contexto → 'configured'/'manual' (evidencia manual).
  --    Sin evidencia → 'unconfigured'/NULL.
  insert into public.worker_preferences (user_id, onboarding_state, preferred_worker_mode)
  select p.id,
         case when exists (select 1 from public.payroll_contexts pc where pc.user_id = p.id)
              or p.categoria is not null or p.antiguedad is not null or p.matricula is not null or p.adscripcion is not null
              then 'configured' else 'unconfigured' end,
         case when exists (select 1 from public.payroll_contexts pc where pc.user_id = p.id)
              or p.categoria is not null or p.antiguedad is not null or p.matricula is not null or p.adscripcion is not null
              then 'manual' else null end
    from public.profiles p
   where not exists (select 1 from public.worker_preferences wp where wp.user_id = p.id);
  get diagnostics v_prefs = row_count;

  -- 2. Copiar legacy de profiles a payroll_contexts (solo campos vacíos).
  for v_row in
    select p.id,
           p.matricula, p.adscripcion, p.categoria, p.antiguedad,
           pc.user_id as has_context
      from public.profiles p
      left join public.payroll_contexts pc on pc.user_id = p.id
  loop
    -- Insertar contexto si no existe (base vacía).
    if v_row.has_context is null then
      insert into public.payroll_contexts (user_id, updated_at)
      values (v_row.id, now())
      on conflict (user_id) do nothing;
      v_filled := v_filled + 1;
    end if;

    -- matricula/adscripcion/categoria solo a campos vacíos.
    update public.payroll_contexts
       set matricula = coalesce(matricula, nullif(v_row.matricula, '')),
           adscripcion = coalesce(adscripcion, nullif(v_row.adscripcion, '')),
           category_name = coalesce(category_name, nullif(v_row.categoria, '')),
           source_matricula = case when matricula is null and nullif(v_row.matricula, '') is not null then 'manual' else source_matricula end,
           source_adscripcion = case when adscripcion is null and nullif(v_row.adscripcion, '') is not null then 'manual' else source_adscripcion end,
           source_category_name = case when category_name is null and nullif(v_row.categoria, '') is not null then 'manual' else source_category_name end,
           updated_at = now()
     where user_id = v_row.id;

    -- Antigüedad textual: no se fabrica fecha; solo conteo de no convertibles.
    if nullif(v_row.antiguedad, '') is not null
       and (v_row.antiguedad !~ '[0-9]' or v_row.antiguedad ~* 'a[ñn]os') then
      v_unparseable := v_unparseable + 1;
    end if;

    -- Conflicto documentado (sin valores): legacy categoría vs contexto distinto.
    if v_row.has_context is not null and nullif(v_row.categoria, '') is not null then
      perform 1 from public.payroll_contexts pc
       where pc.user_id = v_row.id
         and pc.category_name is not null
         and pc.category_name <> v_row.categoria;
      if found then
        v_mismatch := v_mismatch + 1;
      end if;
    end if;
  end loop;

  return query select v_prefs, v_filled, v_unparseable, v_mismatch;
end;
$$;

-- backfill_worker_profile: revocar de PUBLIC, anon y authenticated.
-- Solo se invoca como admin/service_role (1x).
revoke all on function public.backfill_worker_profile() from public;
revoke all on function public.backfill_worker_profile() from anon;
revoke all on function public.backfill_worker_profile() from authenticated;

-- ============================================================
-- 8. Compatibilidad employment_type (deuda documentada)
-- ============================================================
-- El CHECK de payroll_contexts.employment_type NO se modifica en esta
-- migración. La base sigue aceptando los valores legacy actuales
-- (base, confianza, eventual, confianza_a_estatuto). El dominio puede
-- reconocer valores canónicos (sustituto, interino, obra_determinada, otro)
-- pero NINGÚN valor legacy se reescribe automáticamente; eventual y
-- confianza_a_estatuto permanecen sin equivalencia canónica y requieren
-- confirmación manual. Esta deuda se resuelve en un PR posterior.
