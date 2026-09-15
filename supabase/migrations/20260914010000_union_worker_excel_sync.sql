-- ============================================================
-- Migración: Sincronización continua de trabajadores desde Excel SIAP
-- ============================================================

-- 1. Extensión de union_workers con campos fuente SIAP
alter table public.union_workers
  add column if not exists contract_type_code text not null default '',
  add column if not exists plaza_code text not null default '',
  add column if not exists responsibility_area_code text not null default '',
  add column if not exists occupation_start_date date,
  add column if not exists occupation_limit_date date,
  add column if not exists occupation_limit_is_sentinel boolean not null default false,
  add column if not exists occupation_mark_code text not null default '',
  add column if not exists plaza_type_code text not null default '',
  add column if not exists shift_code text not null default '',
  add column if not exists associated_concepts_mask text not null default '',
  add column if not exists associated_concepts jsonb not null default '[]'::jsonb,
  add column if not exists position_code text not null default '',
  add column if not exists position_description text not null default '',
  add column if not exists department_code text not null default '',
  add column if not exists department_description text not null default '',
  add column if not exists schedule_code text not null default '',
  add column if not exists schedule_description text not null default '',
  add column if not exists seniority_raw text not null default '',
  add column if not exists seniority_years integer,
  add column if not exists seniority_fortnights integer,
  add column if not exists seniority_days integer,
  add column if not exists rfc text not null default '',
  add column if not exists curp text not null default '',
  add column if not exists nss text not null default '',
  add column if not exists employment_start_date date,
  add column if not exists reemployment_date date,
  add column if not exists source_status_code text not null default '',
  add column if not exists termination_code text not null default '',
  add column if not exists termination_date date,
  add column if not exists micro_group_code text not null default '',
  add column if not exists siap_full_name text not null default '',
  add column if not exists last_import_batch_id uuid,
  add column if not exists source_created_by_batch_id uuid,
  add column if not exists source_last_seen_at timestamptz,
  add column if not exists source_missing_since timestamptz,
  add column if not exists source_rolled_back_at timestamptz,
  add column if not exists source_import_state text not null default 'active';

create index if not exists union_workers_rfc_idx on public.union_workers (delegation_id, rfc);
create index if not exists union_workers_curp_idx on public.union_workers (delegation_id, curp);
create index if not exists union_workers_nss_idx on public.union_workers (delegation_id, nss);
create index if not exists union_workers_plaza_idx on public.union_workers (delegation_id, plaza_code);
create index if not exists union_workers_import_state_idx on public.union_workers (delegation_id, source_import_state);

-- 2. Tabla de lotes de importación
create table if not exists public.union_worker_import_batches (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  imported_by uuid not null references auth.users (id),
  file_name text not null,
  file_size_bytes integer not null,
  file_sha256 text not null,
  format_version text not null default 'SIAP_2026',
  total_rows integer not null default 0,
  new_workers_count integer not null default 0,
  updated_workers_count integer not null default 0,
  unchanged_workers_count integer not null default 0,
  warnings_count integer not null default 0,
  invalid_rows_count integer not null default 0,
  conflicts_count integer not null default 0,
  missing_in_file_count integer not null default 0,
  status text not null default 'preview' check (status in ('preview', 'confirmed', 'rolled_back', 'failed')),
  applied_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id),
  rolled_back_at timestamptz,
  rolled_back_by uuid references auth.users (id),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists union_worker_import_batches_del_idx on public.union_worker_import_batches (delegation_id, created_at desc);
create index if not exists union_worker_import_batches_hash_idx on public.union_worker_import_batches (delegation_id, file_sha256);

-- Foreign key constraint for source_created_by_batch_id
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'union_workers_created_batch_fkey'
  ) then
    alter table public.union_workers
      add constraint union_workers_created_batch_fkey
      foreign key (source_created_by_batch_id)
      references public.union_worker_import_batches (id)
      on delete set null;
  end if;
end $$;

-- 3. Tabla de filas de staging de importación
create table if not exists public.union_worker_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.union_worker_import_batches (id) on delete cascade,
  row_number integer not null,
  matricula text not null,
  full_name text not null,
  raw_data jsonb not null default '{}'::jsonb,
  parsed_data jsonb not null default '{}'::jsonb,
  row_status text not null check (row_status in ('new', 'updated', 'unchanged', 'warning', 'invalid', 'conflict')),
  action_taken text not null default 'pending' check (action_taken in ('pending', 'applied', 'skipped', 'conflict_hold')),
  issues jsonb not null default '[]'::jsonb,
  diff jsonb not null default '{}'::jsonb,
  target_worker_id uuid references public.union_workers (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists union_worker_import_rows_batch_idx on public.union_worker_import_rows (batch_id, row_number);
create index if not exists union_worker_import_rows_status_idx on public.union_worker_import_rows (batch_id, row_status);

-- 4. Tabla de historial de cambios auditados
create table if not exists public.union_worker_change_history (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  batch_id uuid references public.union_worker_import_batches (id) on delete set null,
  worker_id uuid not null references public.union_workers (id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  changed_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists union_worker_change_history_worker_idx on public.union_worker_change_history (worker_id, created_at desc);
create index if not exists union_worker_change_history_batch_idx on public.union_worker_change_history (batch_id);
create index if not exists union_worker_change_history_del_idx on public.union_worker_change_history (delegation_id, created_at desc);

-- 5. Habilitación de RLS y Políticas de Seguridad
alter table public.union_worker_import_batches enable row level security;
alter table public.union_worker_import_rows enable row level security;
alter table public.union_worker_change_history enable row level security;

-- Batches: solo union_admin de la delegación
drop policy if exists "union_import_batches_admin_all" on public.union_worker_import_batches;
create policy "union_import_batches_admin_all"
  on public.union_worker_import_batches for all to authenticated
  using (public.union_is_admin(delegation_id))
  with check (public.union_is_admin(delegation_id));

-- Rows: acceso mediante batch perteneciente a la delegación del union_admin
drop policy if exists "union_import_rows_admin_all" on public.union_worker_import_rows;
create policy "union_import_rows_admin_all"
  on public.union_worker_import_rows for all to authenticated
  using (exists (
    select 1 from public.union_worker_import_batches b
    where b.id = batch_id and public.union_is_admin(b.delegation_id)
  ))
  with check (exists (
    select 1 from public.union_worker_import_batches b
    where b.id = batch_id and public.union_is_admin(b.delegation_id)
  ));

-- Historial: solo union_admin de la delegación
drop policy if exists "union_change_history_admin_all" on public.union_worker_change_history;
create policy "union_change_history_admin_all"
  on public.union_worker_change_history for all to authenticated
  using (public.union_is_admin(delegation_id))
  with check (public.union_is_admin(delegation_id));

-- 6. Función Atómica de Confirmación en PostgreSQL
create or replace function public.union_confirm_worker_import(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch record;
  v_row record;
  v_existing record;
  v_worker_id uuid;
  v_applied_count integer := 0;
  v_unchanged_count integer := 0;
  v_missing_count integer := 0;
  v_history_count integer := 0;
  v_c jsonb;
  v_now timestamptz := clock_timestamp();
begin
  -- 1. Obtener y bloquear el lote
  select * into v_batch
  from public.union_worker_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'BATCH_NOT_FOUND: Lote % no encontrado.', p_batch_id;
  end if;

  -- 2. Validar que el usuario sea union_admin activo de la delegación
  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: No tienes permisos de administrador sindical en esta delegación.';
  end if;

  -- 3. Validar estado del lote
  if v_batch.status <> 'preview' then
    raise exception 'INVALID_BATCH_STATUS: El lote se encuentra en estado "%" y no puede ser confirmado.', v_batch.status;
  end if;

  -- 4. Iterar sobre las filas de staging
  for v_row in
    select *
    from public.union_worker_import_rows
    where batch_id = p_batch_id
      and row_status in ('new', 'updated', 'unchanged', 'warning')
      and action_taken = 'pending'
    order by row_number asc
  loop
    -- Buscar trabajador existente en la delegación por matrícula
    select * into v_existing
    from public.union_workers
    where delegation_id = v_batch.delegation_id
      and employee_number = v_row.matricula;

    if not found then
      -- INSERTAR NUEVO TRABAJADOR
      insert into public.union_workers (
        delegation_id,
        employee_number,
        siap_full_name,
        first_name,
        paternal_surname,
        maternal_surname,
        category,
        assignment,
        turn,
        schedule,
        rest_days,
        active,
        notes,
        contract_type_code,
        plaza_code,
        responsibility_area_code,
        occupation_start_date,
        occupation_limit_date,
        occupation_limit_is_sentinel,
        occupation_mark_code,
        plaza_type_code,
        shift_code,
        associated_concepts_mask,
        associated_concepts,
        position_code,
        position_description,
        department_code,
        department_description,
        schedule_code,
        schedule_description,
        seniority_raw,
        seniority_years,
        seniority_fortnights,
        seniority_days,
        rfc,
        curp,
        nss,
        employment_start_date,
        reemployment_date,
        source_status_code,
        termination_code,
        termination_date,
        micro_group_code,
        last_import_batch_id,
        source_created_by_batch_id,
        source_last_seen_at,
        source_missing_since,
        source_rolled_back_at,
        source_import_state,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) values (
        v_batch.delegation_id,
        v_row.matricula,
        coalesce(v_row.parsed_data->>'siap_full_name', v_row.full_name),
        '',
        '',
        '',
        coalesce(v_row.parsed_data->>'position_description', ''),
        coalesce(v_row.parsed_data->>'department_description', ''),
        coalesce(v_row.parsed_data->>'turn', ''),
        coalesce(v_row.parsed_data->>'schedule_description', ''),
        '',
        true,
        '',
        coalesce(v_row.parsed_data->>'contract_type_code', ''),
        coalesce(v_row.parsed_data->>'plaza_code', ''),
        coalesce(v_row.parsed_data->>'responsibility_area_code', ''),
        (v_row.parsed_data->>'occupation_start_date')::date,
        (v_row.parsed_data->>'occupation_limit_date')::date,
        coalesce((v_row.parsed_data->>'occupation_limit_is_sentinel')::boolean, false),
        coalesce(v_row.parsed_data->>'occupation_mark_code', ''),
        coalesce(v_row.parsed_data->>'plaza_type_code', ''),
        coalesce(v_row.parsed_data->>'shift_code', ''),
        coalesce(v_row.parsed_data->>'associated_concepts_mask', '00000'),
        coalesce(v_row.parsed_data->'associated_concepts', '[]'::jsonb),
        coalesce(v_row.parsed_data->>'position_code', ''),
        coalesce(v_row.parsed_data->>'position_description', ''),
        coalesce(v_row.parsed_data->>'department_code', ''),
        coalesce(v_row.parsed_data->>'department_description', ''),
        coalesce(v_row.parsed_data->>'schedule_code', ''),
        coalesce(v_row.parsed_data->>'schedule_description', ''),
        coalesce(v_row.parsed_data->>'seniority_raw', ''),
        (v_row.parsed_data->>'seniority_years')::integer,
        (v_row.parsed_data->>'seniority_fortnights')::integer,
        (v_row.parsed_data->>'seniority_days')::integer,
        coalesce(v_row.parsed_data->>'rfc', ''),
        coalesce(v_row.parsed_data->>'curp', ''),
        coalesce(v_row.parsed_data->>'nss', ''),
        (v_row.parsed_data->>'employment_start_date')::date,
        (v_row.parsed_data->>'reemployment_date')::date,
        coalesce(v_row.parsed_data->>'source_status_code', ''),
        coalesce(v_row.parsed_data->>'termination_code', ''),
        (v_row.parsed_data->>'termination_date')::date,
        coalesce(v_row.parsed_data->>'micro_group_code', ''),
        p_batch_id,
        p_batch_id,
        v_now,
        null,
        null,
        'active',
        auth.uid(),
        auth.uid(),
        v_now,
        v_now
      ) returning id into v_worker_id;

      update public.union_worker_import_rows
      set action_taken = 'applied', target_worker_id = v_worker_id
      where id = v_row.id;

      v_applied_count := v_applied_count + 1;
    else
      -- TRABAJADOR EXISTENTE
      v_worker_id := v_existing.id;

      -- Si hay cambios en diff, registrar historial
      if v_row.diff ? 'changes' and jsonb_array_length(v_row.diff->'changes') > 0 then
        for v_c in select * from jsonb_array_elements(v_row.diff->'changes')
        loop
          insert into public.union_worker_change_history (
            delegation_id,
            batch_id,
            worker_id,
            field_name,
            old_value,
            new_value,
            changed_by,
            created_at
          ) values (
            v_batch.delegation_id,
            p_batch_id,
            v_worker_id,
            v_c->>'field',
            v_c->>'oldValue',
            v_c->>'newValue',
            auth.uid(),
            v_now
          );
          v_history_count := v_history_count + 1;
        end loop;

        -- Actualizar campos SIAP gestionados, preservando campos manuales (phone, notes, active, structured names)
        update public.union_workers
        set
          siap_full_name = coalesce(v_row.parsed_data->>'siap_full_name', siap_full_name),
          source_import_state = 'active',
          category = coalesce(v_row.parsed_data->>'position_description', category),
          assignment = coalesce(v_row.parsed_data->>'department_description', assignment),
          turn = coalesce(v_row.parsed_data->>'turn', turn),
          schedule = coalesce(v_row.parsed_data->>'schedule_description', schedule),
          contract_type_code = coalesce(v_row.parsed_data->>'contract_type_code', contract_type_code),
          plaza_code = coalesce(v_row.parsed_data->>'plaza_code', plaza_code),
          responsibility_area_code = coalesce(v_row.parsed_data->>'responsibility_area_code', responsibility_area_code),
          occupation_start_date = coalesce((v_row.parsed_data->>'occupation_start_date')::date, occupation_start_date),
          occupation_limit_date = (v_row.parsed_data->>'occupation_limit_date')::date,
          occupation_limit_is_sentinel = coalesce((v_row.parsed_data->>'occupation_limit_is_sentinel')::boolean, false),
          occupation_mark_code = coalesce(v_row.parsed_data->>'occupation_mark_code', occupation_mark_code),
          plaza_type_code = coalesce(v_row.parsed_data->>'plaza_type_code', plaza_type_code),
          shift_code = coalesce(v_row.parsed_data->>'shift_code', shift_code),
          associated_concepts_mask = coalesce(v_row.parsed_data->>'associated_concepts_mask', associated_concepts_mask),
          associated_concepts = coalesce(v_row.parsed_data->'associated_concepts', associated_concepts),
          position_code = coalesce(v_row.parsed_data->>'position_code', position_code),
          position_description = coalesce(v_row.parsed_data->>'position_description', position_description),
          department_code = coalesce(v_row.parsed_data->>'department_code', department_code),
          department_description = coalesce(v_row.parsed_data->>'department_description', department_description),
          schedule_code = coalesce(v_row.parsed_data->>'schedule_code', schedule_code),
          schedule_description = coalesce(v_row.parsed_data->>'schedule_description', schedule_description),
          seniority_raw = coalesce(v_row.parsed_data->>'seniority_raw', seniority_raw),
          seniority_years = (v_row.parsed_data->>'seniority_years')::integer,
          seniority_fortnights = (v_row.parsed_data->>'seniority_fortnights')::integer,
          seniority_days = (v_row.parsed_data->>'seniority_days')::integer,
          rfc = coalesce(v_row.parsed_data->>'rfc', rfc),
          curp = coalesce(v_row.parsed_data->>'curp', curp),
          nss = coalesce(v_row.parsed_data->>'nss', nss),
          employment_start_date = coalesce((v_row.parsed_data->>'employment_start_date')::date, employment_start_date),
          reemployment_date = (v_row.parsed_data->>'reemployment_date')::date,
          source_status_code = coalesce(v_row.parsed_data->>'source_status_code', source_status_code),
          termination_code = coalesce(v_row.parsed_data->>'termination_code', termination_code),
          termination_date = (v_row.parsed_data->>'termination_date')::date,
          micro_group_code = coalesce(v_row.parsed_data->>'micro_group_code', micro_group_code),
          last_import_batch_id = p_batch_id,
          source_last_seen_at = v_now,
          source_missing_since = null,
          source_rolled_back_at = null,
          updated_by = auth.uid(),
          updated_at = v_now
        where id = v_worker_id;

        v_applied_count := v_applied_count + 1;
      else
        -- Sin cambios sustantivos: solo refrescar last_seen
        update public.union_workers
        set
          last_import_batch_id = p_batch_id,
          source_last_seen_at = v_now,
          source_missing_since = null,
          updated_by = auth.uid(),
          updated_at = v_now
        where id = v_worker_id;

        v_unchanged_count := v_unchanged_count + 1;
      end if;

      update public.union_worker_import_rows
      set action_taken = 'applied', target_worker_id = v_worker_id
      where id = v_row.id;
    end if;
  end loop;

  -- 5. Marcar trabajadores ausentes (presentes en BD pero no vistos en este lote)
  update public.union_workers
  set source_missing_since = v_now, updated_at = v_now
  where delegation_id = v_batch.delegation_id
    and active = true
    and source_missing_since is null
    and employee_number not in (
      select matricula from public.union_worker_import_rows
      where batch_id = p_batch_id and matricula is not null and matricula <> ''
    );
  get diagnostics v_missing_count = row_count;

  -- 6. Actualizar estado del lote
  update public.union_worker_import_batches
  set
    status = 'confirmed',
    applied_at = v_now,
    confirmed_at = v_now,
    confirmed_by = auth.uid(),
    updated_at = v_now
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'confirmed',
    'applied_count', v_applied_count,
    'unchanged_count', v_unchanged_count,
    'missing_marked_count', v_missing_count,
    'history_records_created', v_history_count
  );
end;
$$;

-- 7. Función No Destructiva de Rollback en PostgreSQL
create or replace function public.union_rollback_worker_import(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch record;
  v_history record;
  v_deactivated_count integer := 0;
  v_restored_fields_count integer := 0;
  v_now timestamptz := clock_timestamp();
  v_conflict_emp text;
begin
  -- 1. Obtener y bloquear el lote
  select * into v_batch
  from public.union_worker_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'BATCH_NOT_FOUND: Lote % no encontrado.', p_batch_id;
  end if;

  -- 2. Validar que el usuario sea union_admin activo de la delegación
  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: No tienes permisos de administrador sindical en esta delegación.';
  end if;

  -- 3. Validar que el lote esté confirmado
  if v_batch.status <> 'confirmed' then
    raise exception 'INVALID_BATCH_STATUS_FOR_ROLLBACK: Solo se pueden revertir lotes confirmados. Estado actual: "%".', v_batch.status;
  end if;

  -- 4. Verificar si hubo modificaciones posteriores en trabajadores afectados por este lote
  -- Caso A: Trabajadores creados por este lote pero modificados posteriormente por otro lote
  select w.employee_number into v_conflict_emp
  from public.union_workers w
  where w.delegation_id = v_batch.delegation_id
    and w.source_created_by_batch_id = p_batch_id
    and w.last_import_batch_id <> p_batch_id
  limit 1;

  if v_conflict_emp is null then
    -- Caso B: Trabajadores actualizados por este lote con historial posterior
    select w.employee_number into v_conflict_emp
    from public.union_worker_change_history h
    join public.union_workers w on w.id = h.worker_id
    where h.batch_id = p_batch_id
      and (
        w.last_import_batch_id <> p_batch_id
        or exists (
          select 1 from public.union_worker_change_history h_newer
          where h_newer.worker_id = h.worker_id
            and h_newer.created_at > h.created_at
        )
      )
    limit 1;
  end if;

  if v_conflict_emp is not null then
    raise exception 'ROLLBACK_CONFLICT_NEWER_CHANGES: El trabajador con matrícula % ha sido modificado posteriormente.', v_conflict_emp;
  end if;

  -- 5. REVERSIÓN NO DESTRUCTIVA: Trabajadores creados exclusivamente por este lote
  -- NUNCA DELETE FROM union_workers. NUNCA modificar active, notes, phone ni nombres manuales.
  -- Se marcan con source_rolled_back_at = v_now y source_import_state = 'rolled_back'
  update public.union_workers
  set
    source_rolled_back_at = v_now,
    source_import_state = 'rolled_back',
    updated_by = auth.uid(),
    updated_at = v_now
  where delegation_id = v_batch.delegation_id
    and source_created_by_batch_id = p_batch_id;
  get diagnostics v_deactivated_count = row_count;

  -- 6. Restaurar campos en trabajadores actualizados por este lote
  for v_history in
    select h.worker_id, h.field_name, h.old_value
    from public.union_worker_change_history h
    where h.batch_id = p_batch_id
    order by h.created_at desc
  loop
    -- Restaurar campo individual dinámicamente si es un campo válido
    if v_history.field_name in (
      'position_description', 'department_description', 'turn', 'schedule_description',
      'plaza_code', 'contract_type_code', 'associated_concepts_mask', 'seniority_raw',
      'responsibility_area_code', 'occupation_start_date', 'occupation_limit_date',
      'occupation_mark_code', 'plaza_type_code', 'shift_code', 'position_code',
      'department_code', 'schedule_code', 'rfc', 'curp', 'nss', 'employment_start_date',
      'reemployment_date', 'source_status_code', 'termination_code', 'termination_date',
      'micro_group_code', 'siap_full_name', 'category', 'assignment', 'schedule'
    ) then
      execute format(
        'update public.union_workers set %I = $1, updated_by = $2, updated_at = $3 where id = $4',
        v_history.field_name
      ) using v_history.old_value, auth.uid(), v_now, v_history.worker_id;

      if v_history.field_name = 'position_description' then
        update public.union_workers set category = coalesce(v_history.old_value, '') where id = v_history.worker_id;
      elsif v_history.field_name = 'department_description' then
        update public.union_workers set assignment = coalesce(v_history.old_value, '') where id = v_history.worker_id;
      elsif v_history.field_name = 'schedule_description' then
        update public.union_workers set schedule = coalesce(v_history.old_value, '') where id = v_history.worker_id;
      end if;

      v_restored_fields_count := v_restored_fields_count + 1;
    end if;
  end loop;

  -- 7. Limpiar marcas de ausentes que fueron puestas por este lote
  if v_batch.applied_at is not null then
    update public.union_workers
    set source_missing_since = null, updated_at = v_now
    where delegation_id = v_batch.delegation_id
      and source_missing_since >= v_batch.applied_at;
  end if;

  -- 8. Actualizar lote a 'rolled_back'
  update public.union_worker_import_batches
  set
    status = 'rolled_back',
    rolled_back_at = v_now,
    rolled_back_by = auth.uid(),
    updated_at = v_now
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'rolled_back',
    'restored_fields_count', v_restored_fields_count,
    'deactivated_workers_count', v_deactivated_count
  );
end;
$$;

-- Permisos de ejecución y acceso a tablas para roles de Supabase
grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant all on all routines in schema public to authenticated, service_role;


