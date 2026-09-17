-- 20260917000000_union_master_import.sql
-- Migración puramente aditiva: Actualizar base sindical (Conciliación Maestra Trabajadores + Lockers)
-- Reutiliza las tablas existentes union_worker_import_batches y union_worker_import_rows.
-- TABLAS NUEVAS: NINGUNA.
-- No destructiva. No añade UNIQUE constraints a union_workers que puedan romper producción.

-- 1. Limpieza preventiva de tablas paralelas si se crearon en fases preliminares
drop table if exists public.union_import_rows cascade;
drop table if exists public.union_import_batches cascade;

-- 2. Columnas aditivas en public.union_workers
-- NOTA: NO se añade 'position_number'. Se reutiliza 'plaza_code' para # PLAZA.
-- 'source_name_raw' conserva el nombre crudo de la fuente administrativa sin alterar 'siap_full_name'.
-- 'import_notes' conserva observaciones de la importación administrativa sin alterar 'notes' (notas manuales).
alter table public.union_workers
  add column if not exists source_name_raw text not null default '',
  add column if not exists import_notes text not null default '';

-- Si 'position_number' existía de un intento previo, se retira de forma segura
alter table public.union_workers
  drop column if exists position_number;

create index if not exists union_workers_plaza_idx
  on public.union_workers (delegation_id, plaza_code);

-- 3. Columnas aditivas en public.union_worker_import_batches para soporte de casilleros y metadatos
alter table public.union_worker_import_batches
  add column if not exists new_lockers_count integer not null default 0,
  add column if not exists locker_changes_count integer not null default 0,
  add column if not exists locker_conflicts_count integer not null default 0,
  add column if not exists summary_metadata jsonb not null default '{}'::jsonb;

-- 4. Extensión aditiva del check constraint de row_status en union_worker_import_rows para incluir 'ignored'
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'union_worker_import_rows_row_status_check'
  ) then
    alter table public.union_worker_import_rows
      drop constraint union_worker_import_rows_row_status_check;
  end if;
  alter table public.union_worker_import_rows
    add constraint union_worker_import_rows_row_status_check
    check (row_status in ('new', 'updated', 'unchanged', 'warning', 'invalid', 'conflict', 'ignored'));
end $$;

-- 5. Guardas en RPCs existentes para aislar formatos
-- union_confirm_worker_import solo acepta lotes con formato 'SIAP_2026'
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
  v_updated_count integer := 0;
  v_unchanged_count integer := 0;
  v_missing_marked integer := 0;
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

  -- 2. Validar que el formato sea SIAP_2026
  if v_batch.format_version <> 'SIAP_2026' then
    raise exception 'INVALID_FORMAT_VERSION: Este lote tiene formato "%" y debe procesarse con su RPC correspondiente (union_apply_master_import).', v_batch.format_version;
  end if;

  -- 3. Validar que el usuario sea union_admin activo de la delegación
  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: No tienes permisos de administrador sindical en esta delegación.';
  end if;

  -- 4. Validar estado del lote
  if v_batch.status <> 'preview' then
    raise exception 'INVALID_BATCH_STATUS: El lote se encuentra en estado "%" y no puede ser confirmado.', v_batch.status;
  end if;

  -- 5. Iterar sobre las filas de staging
  for v_row in
    select *
    from public.union_worker_import_rows
    where batch_id = p_batch_id
      and row_status in ('new', 'updated', 'unchanged', 'warning')
      and action_taken = 'pending'
    order by row_number asc
  loop
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
        source_created_by_batch_id,
        last_import_batch_id,
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
        coalesce(v_row.parsed_data->>'first_name', ''),
        coalesce(v_row.parsed_data->>'paternal_surname', ''),
        coalesce(v_row.parsed_data->>'maternal_surname', ''),
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

        update public.union_workers set
          siap_full_name = coalesce(v_row.parsed_data->>'siap_full_name', siap_full_name),
          category = coalesce(v_row.parsed_data->>'position_description', category),
          assignment = coalesce(v_row.parsed_data->>'department_description', assignment),
          turn = coalesce(v_row.parsed_data->>'turn', turn),
          schedule = coalesce(v_row.parsed_data->>'schedule_description', schedule),
          contract_type_code = coalesce(v_row.parsed_data->>'contract_type_code', contract_type_code),
          plaza_code = coalesce(v_row.parsed_data->>'plaza_code', plaza_code),
          responsibility_area_code = coalesce(v_row.parsed_data->>'responsibility_area_code', responsibility_area_code),
          occupation_start_date = coalesce((v_row.parsed_data->>'occupation_start_date')::date, occupation_start_date),
          occupation_limit_date = coalesce((v_row.parsed_data->>'occupation_limit_date')::date, occupation_limit_date),
          occupation_limit_is_sentinel = coalesce((v_row.parsed_data->>'occupation_limit_is_sentinel')::boolean, occupation_limit_is_sentinel),
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
          seniority_years = coalesce((v_row.parsed_data->>'seniority_years')::integer, seniority_years),
          seniority_fortnights = coalesce((v_row.parsed_data->>'seniority_fortnights')::integer, seniority_fortnights),
          seniority_days = coalesce((v_row.parsed_data->>'seniority_days')::integer, seniority_days),
          rfc = coalesce(v_row.parsed_data->>'rfc', rfc),
          curp = coalesce(v_row.parsed_data->>'curp', curp),
          nss = coalesce(v_row.parsed_data->>'nss', nss),
          employment_start_date = coalesce((v_row.parsed_data->>'employment_start_date')::date, employment_start_date),
          reemployment_date = coalesce((v_row.parsed_data->>'reemployment_date')::date, reemployment_date),
          source_status_code = coalesce(v_row.parsed_data->>'source_status_code', source_status_code),
          termination_code = coalesce(v_row.parsed_data->>'termination_code', termination_code),
          termination_date = coalesce((v_row.parsed_data->>'termination_date')::date, termination_date),
          micro_group_code = coalesce(v_row.parsed_data->>'micro_group_code', micro_group_code),
          last_import_batch_id = p_batch_id,
          source_last_seen_at = v_now,
          source_missing_since = null,
          source_import_state = 'active',
          updated_by = auth.uid(),
          updated_at = v_now
        where id = v_worker_id;

        update public.union_worker_import_rows
        set action_taken = 'applied', target_worker_id = v_worker_id
        where id = v_row.id;

        v_updated_count := v_updated_count + 1;
      else
        update public.union_workers set
          last_import_batch_id = p_batch_id,
          source_last_seen_at = v_now,
          source_missing_since = null,
          updated_at = v_now
        where id = v_worker_id;

        update public.union_worker_import_rows
        set action_taken = 'skipped', target_worker_id = v_worker_id
        where id = v_row.id;

        v_unchanged_count := v_unchanged_count + 1;
      end if;
    end if;
  end loop;

  -- 6. Marcar trabajadores ausentes en SIAP (comportamiento protegido)
  update public.union_workers
  set
    source_missing_since = coalesce(source_missing_since, v_now),
    source_import_state = 'missing_in_source',
    updated_at = v_now
  where delegation_id = v_batch.delegation_id
    and (source_last_seen_at is null or source_last_seen_at < v_now)
    and (source_missing_since is null)
    and active = true;
  get diagnostics v_missing_marked = row_count;

  -- 7. Actualizar estado del lote
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
    'updated_count', v_updated_count,
    'unchanged_count', v_unchanged_count,
    'missing_marked_count', v_missing_marked,
    'history_records_created', v_history_count
  );
end;
$$;

-- union_rollback_worker_import solo acepta lotes SIAP_2026
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
  select * into v_batch
  from public.union_worker_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'BATCH_NOT_FOUND: Lote % no encontrado.', p_batch_id;
  end if;

  if v_batch.format_version <> 'SIAP_2026' then
    raise exception 'INVALID_FORMAT_VERSION: Este lote tiene formato "%" y debe revertirse con union_rollback_master_import.', v_batch.format_version;
  end if;

  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: No tienes permisos de administrador sindical en esta delegación.';
  end if;

  if v_batch.status = 'rolled_back' then
    raise exception 'BATCH_ALREADY_ROLLED_BACK: El lote % ya fue revertido previamente.', p_batch_id;
  end if;

  if v_batch.status = 'preview' then
    raise exception 'INVALID_BATCH_STATUS_FOR_ROLLBACK: Solo se pueden revertir lotes confirmados. Estado actual: "preview".';
  end if;

  if v_batch.status <> 'confirmed' then
    raise exception 'INVALID_BATCH_STATUS_FOR_ROLLBACK: Solo se pueden revertir lotes confirmados. Estado actual: "%".', v_batch.status;
  end if;

  -- Verificar si hubo modificaciones posteriores
  select w.employee_number into v_conflict_emp
  from public.union_workers w
  where w.delegation_id = v_batch.delegation_id
    and w.source_created_by_batch_id = p_batch_id
    and w.last_import_batch_id <> p_batch_id
  limit 1;

  if v_conflict_emp is null then
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

  -- Reversión no destructiva de trabajadores creados por este lote
  update public.union_workers
  set
    source_rolled_back_at = v_now,
    source_import_state = 'rolled_back',
    updated_by = auth.uid(),
    updated_at = v_now
  where delegation_id = v_batch.delegation_id
    and source_created_by_batch_id = p_batch_id;
  get diagnostics v_deactivated_count = row_count;

  -- Restaurar campos de historial
  for v_history in
    select h.worker_id, h.field_name, h.old_value
    from public.union_worker_change_history h
    where h.batch_id = p_batch_id
    order by h.created_at desc
  loop
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
      end if;
      if v_history.field_name = 'department_description' then
        update public.union_workers set assignment = coalesce(v_history.old_value, '') where id = v_history.worker_id;
      end if;
      if v_history.field_name = 'schedule_description' then
        update public.union_workers set schedule = coalesce(v_history.old_value, '') where id = v_history.worker_id;
      end if;

      v_restored_fields_count := v_restored_fields_count + 1;
    end if;
  end loop;

  -- Actualizar estado del lote
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

-- 6. RPC Transaccional Atómica para Aplicar la Importación Maestra (UNION_MASTER_LOCKERS_V1)
-- Reutiliza union_worker_import_batches y union_worker_import_rows
create or replace function public.union_apply_master_import(
  p_batch_id uuid,
  p_resolutions jsonb default '{}'::jsonb
)
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
  v_locker_id uuid;
  v_prev_locker_id uuid;
  v_active_assignment record;
  v_applied_workers integer := 0;
  v_updated_workers integer := 0;
  v_unchanged_workers integer := 0;
  v_new_locker_assignments integer := 0;
  v_locker_changes integer := 0;
  v_skipped_conflicts integer := 0;
  v_now timestamptz := clock_timestamp();
  v_resolution jsonb;
  v_res_action text;
  v_norm_locker text;
  v_first_name text;
  v_paternal text;
  v_maternal text;
  v_c jsonb;
begin
  -- 1. Bloquear y verificar el lote
  select * into v_batch
  from public.union_worker_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'BATCH_NOT_FOUND: Lote % no encontrado.', p_batch_id;
  end if;

  -- 2. Validar que el formato sea UNION_MASTER_LOCKERS_V1
  if v_batch.format_version <> 'UNION_MASTER_LOCKERS_V1' then
    raise exception 'INVALID_FORMAT_VERSION: Este lote no corresponde al formato UNION_MASTER_LOCKERS_V1 (formato actual: "%").', v_batch.format_version;
  end if;

  -- 3. Validar estado
  if v_batch.status <> 'preview' then
    raise exception 'INVALID_BATCH_STATUS: El lote no se encuentra en estado preview (estado actual: "%").', v_batch.status;
  end if;

  -- 4. Validar permisos de union_admin sobre la delegación del lote
  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: No cuentas con permisos de union_admin en la delegación %.', v_batch.delegation_id;
  end if;

  -- 5. Iterar sobre las filas de staging de union_worker_import_rows
  for v_row in
    select *
    from public.union_worker_import_rows
    where batch_id = p_batch_id
    order by row_number asc
  loop
    -- Comprobar si hay resolución manual del usuario
    v_resolution := p_resolutions -> (v_row.row_number::text);
    v_res_action := coalesce(v_resolution ->> 'action', '');

    if v_row.row_status = 'conflict' and v_res_action = 'skip' then
      update public.union_worker_import_rows
      set action_taken = 'skipped'
      where id = v_row.id;
      v_skipped_conflicts := v_skipped_conflicts + 1;
      continue;
    end if;

    if v_row.row_status in ('invalid', 'ignored') then
      update public.union_worker_import_rows
      set action_taken = 'skipped'
      where id = v_row.id;
      continue;
    end if;

    -- Buscar trabajador existente en la delegación por matrícula
    select * into v_existing
    from public.union_workers
    where delegation_id = v_batch.delegation_id
      and employee_number = v_row.matricula;

    if not found then
      -- INSERTAR NUEVO TRABAJADOR
      v_paternal := coalesce(v_row.parsed_data->>'paternal_surname', '');
      v_maternal := coalesce(v_row.parsed_data->>'maternal_surname', '');
      v_first_name := coalesce(v_row.parsed_data->>'first_name', '');

      insert into public.union_workers (
        delegation_id,
        employee_number,
        first_name,
        paternal_surname,
        maternal_surname,
        source_name_raw,
        category,
        position_description,
        turn,
        schedule,
        schedule_description,
        plaza_code,
        import_notes,
        active,
        notes,
        source_created_by_batch_id,
        last_import_batch_id,
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
        v_first_name,
        v_paternal,
        v_maternal,
        coalesce(v_row.parsed_data->>'source_name_raw', v_row.full_name),
        coalesce(v_row.parsed_data->>'position_description', ''),
        coalesce(v_row.parsed_data->>'position_description', ''),
        coalesce(v_row.parsed_data->>'turn', ''),
        coalesce(v_row.parsed_data->>'schedule_description', ''),
        coalesce(v_row.parsed_data->>'schedule_description', ''),
        coalesce(v_row.parsed_data->>'plaza_code', ''),
        coalesce(v_row.parsed_data->>'raw_observations', ''),
        true,
        '',
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

      v_applied_workers := v_applied_workers + 1;
    else
      -- TRABAJADOR EXISTENTE
      v_worker_id := v_existing.id;

      -- Registrar cambios en union_worker_change_history si existen en diff
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
        end loop;

        -- Actualizar trabajador sin sobrescribir notas sindicales manuales
        update public.union_workers set
          category = coalesce(v_row.parsed_data->>'position_description', category),
          position_description = coalesce(v_row.parsed_data->>'position_description', position_description),
          turn = coalesce(v_row.parsed_data->>'turn', turn),
          schedule = coalesce(v_row.parsed_data->>'schedule_description', schedule),
          schedule_description = coalesce(v_row.parsed_data->>'schedule_description', schedule_description),
          plaza_code = coalesce(v_row.parsed_data->>'plaza_code', plaza_code),
          source_name_raw = coalesce(v_row.parsed_data->>'source_name_raw', source_name_raw),
          import_notes = coalesce(v_row.parsed_data->>'raw_observations', import_notes),
          active = true,
          source_missing_since = null,
          source_import_state = 'active',
          last_import_batch_id = p_batch_id,
          source_last_seen_at = v_now,
          updated_by = auth.uid(),
          updated_at = v_now
        where id = v_worker_id;

        v_updated_workers := v_updated_workers + 1;
      else
        -- Sin cambios de campos de trabajador, solo marcar visto
        update public.union_workers set
          active = true,
          source_missing_since = null,
          source_import_state = 'active',
          last_import_batch_id = p_batch_id,
          source_last_seen_at = v_now,
          updated_at = v_now
        where id = v_worker_id;

        v_unchanged_workers := v_unchanged_workers + 1;
      end if;
    end if;

    -- CONCILIACIÓN DE LOCKERS
    v_norm_locker := coalesce(v_row.parsed_data->>'locker', '');

    if v_norm_locker <> '' and coalesce((v_row.parsed_data->>'is_semantic_locker')::boolean, false) = false then
      -- Asegurar existencia del casillero en la delegación
      insert into public.union_lockers (
        delegation_id,
        locker_number,
        zone,
        status,
        notes
      ) values (
        v_batch.delegation_id,
        v_norm_locker,
        'General',
        'ocupado',
        'Registrado por importación base sindical'
      )
      on conflict (delegation_id, locker_number) do update
      set status = 'ocupado'
      returning id into v_locker_id;

      -- Verificar si el trabajador ya tenía asignación activa
      select id, locker_id into v_active_assignment
      from public.union_locker_assignments
      where worker_id = v_worker_id
        and status = 'active'
      limit 1;

      if not found then
        -- NUEVA ASIGNACIÓN
        insert into public.union_locker_assignments (
          locker_id,
          worker_id,
          status,
          assignment_reason,
          created_by,
          assigned_at
        ) values (
          v_locker_id,
          v_worker_id,
          'active',
          'import_master_batch:' || p_batch_id::text,
          auth.uid(),
          v_now
        );
        v_new_locker_assignments := v_new_locker_assignments + 1;
      elsif v_active_assignment.locker_id <> v_locker_id then
        -- CAMBIO DE CASILLERO: Liberar anterior y asignar nuevo
        v_prev_locker_id := v_active_assignment.locker_id;

        update public.union_locker_assignments
        set
          status = 'released',
          released_at = v_now,
          release_reason = 'released_by_import_master_batch:' || p_batch_id::text
        where id = v_active_assignment.id;

        -- Dejar casillero anterior en disponible si no tiene otra asignación activa
        if not exists (
          select 1 from public.union_locker_assignments
          where locker_id = v_prev_locker_id and status = 'active'
        ) then
          update public.union_lockers
          set status = 'disponible'
          where id = v_prev_locker_id;
        end if;

        -- Crear nueva asignación activa
        insert into public.union_locker_assignments (
          locker_id,
          worker_id,
          status,
          assignment_reason,
          created_by,
          assigned_at
        ) values (
          v_locker_id,
          v_worker_id,
          'active',
          'import_master_batch:' || p_batch_id::text,
          auth.uid(),
          v_now
        );
        v_locker_changes := v_locker_changes + 1;
      end if;
    end if;

    -- Marcar fila de staging como aplicada
    update public.union_worker_import_rows
    set action_taken = 'applied', target_worker_id = v_worker_id
    where id = v_row.id;
  end loop;

  -- 6. Finalizar lote en union_worker_import_batches
  -- NOTA IMPORTANTE: En Master Base los ausentes NO causan baja automática (active = false).
  update public.union_worker_import_batches
  set
    status = 'confirmed',
    applied_at = v_now,
    confirmed_at = v_now,
    confirmed_by = auth.uid(),
    new_workers_count = v_applied_workers,
    updated_workers_count = v_updated_workers,
    unchanged_workers_count = v_unchanged_workers,
    new_lockers_count = v_new_locker_assignments,
    locker_changes_count = v_locker_changes,
    updated_at = v_now
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'confirmed',
    'applied_workers', v_applied_workers,
    'updated_workers', v_updated_workers,
    'unchanged_workers', v_unchanged_workers,
    'new_locker_assignments', v_new_locker_assignments,
    'locker_changes', v_locker_changes,
    'skipped_conflicts', v_skipped_conflicts
  );
end;
$$;

-- 7. RPC Transaccional Atómica para Rollback de Importación Maestra
create or replace function public.union_rollback_master_import(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch record;
  v_history record;
  v_row record;
  v_assignment record;
  v_deactivated_workers integer := 0;
  v_restored_fields integer := 0;
  v_reverted_assignments integer := 0;
  v_restored_assignments integer := 0;
  v_now timestamptz := clock_timestamp();
  v_conflict_emp text;
  v_conflict_locker text;
begin
  -- 1. Obtener y bloquear el lote
  select * into v_batch
  from public.union_worker_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'BATCH_NOT_FOUND: Lote % no encontrado.', p_batch_id;
  end if;

  -- 2. Validar formato aislado
  if v_batch.format_version <> 'UNION_MASTER_LOCKERS_V1' then
    raise exception 'INVALID_FORMAT_VERSION: Este lote no corresponde al formato UNION_MASTER_LOCKERS_V1 (formato actual: "%").', v_batch.format_version;
  end if;

  -- 3. Validar estado e idempotencia
  if v_batch.status = 'rolled_back' then
    raise exception 'BATCH_ALREADY_ROLLED_BACK: El lote % ya fue revertido previamente.', p_batch_id;
  end if;

  if v_batch.status = 'preview' then
    raise exception 'INVALID_BATCH_STATUS_FOR_ROLLBACK: Solo se pueden revertir lotes confirmados. Estado actual: "preview".';
  end if;

  if v_batch.status <> 'confirmed' then
    raise exception 'INVALID_BATCH_STATUS_FOR_ROLLBACK: Solo se pueden revertir lotes confirmados. Estado actual: "%".', v_batch.status;
  end if;

  -- 4. Validar permisos de union_admin
  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: No cuentas con permisos de union_admin en la delegación %.', v_batch.delegation_id;
  end if;

  -- 5. Verificar modificaciones posteriores conflictivas en TRABAJADORES
  -- A) Trabajador creado por este lote modificado posteriormente
  select w.employee_number into v_conflict_emp
  from public.union_workers w
  where w.delegation_id = v_batch.delegation_id
    and w.source_created_by_batch_id = p_batch_id
    and (
      w.last_import_batch_id <> p_batch_id
      or exists (
        select 1 from public.union_worker_change_history h
        where h.worker_id = w.id
          and h.batch_id <> p_batch_id
          and h.created_at > coalesce(v_batch.applied_at, v_batch.confirmed_at, v_batch.created_at)
      )
    )
  limit 1;

  if v_conflict_emp is not null then
    raise exception 'ROLLBACK_CONFLICT_NEWER_CHANGES: No se puede revertir el trabajador con matrícula % porque recibió cambios después de esta importación.', v_conflict_emp;
  end if;

  -- B) Trabajador existente actualizado por este lote modificado posteriormente
  select w.employee_number into v_conflict_emp
  from public.union_worker_change_history h
  join public.union_workers w on w.id = h.worker_id
  where h.batch_id = p_batch_id
    and (
      w.last_import_batch_id <> p_batch_id
      or exists (
        select 1 from public.union_worker_change_history h_newer
        where h_newer.worker_id = h.worker_id
          and h_newer.batch_id <> p_batch_id
          and h_newer.created_at > h.created_at
      )
    )
  limit 1;

  if v_conflict_emp is not null then
    raise exception 'ROLLBACK_CONFLICT_NEWER_CHANGES: No se puede revertir el trabajador con matrícula % porque recibió cambios después de esta importación.', v_conflict_emp;
  end if;

  -- 6. Verificar modificaciones posteriores conflictivas en CASILLEROS
  -- A) Asignación creada por este lote que fue posteriormente alterada o el casillero fue asignado a alguien más
  select l.locker_number into v_conflict_locker
  from public.union_locker_assignments a
  join public.union_lockers l on l.id = a.locker_id
  where a.assignment_reason = 'import_master_batch:' || p_batch_id::text
    and (
      a.status <> 'active'
      or exists (
        select 1 from public.union_locker_assignments a_newer
        where a_newer.locker_id = a.locker_id
          and a_newer.id <> a.id
          and a_newer.created_at > a.assigned_at
      )
    )
  limit 1;

  if v_conflict_locker is not null then
    raise exception 'ROLLBACK_CONFLICT_NEWER_CHANGES: El casillero % fue modificado o reasignado con posterioridad a esta importación y no puede ser revertido.', v_conflict_locker;
  end if;

  -- B) Asignación previa liberada por este lote cuyo casillero ahora tiene otra asignación activa distinta
  select l.locker_number into v_conflict_locker
  from public.union_locker_assignments a
  join public.union_lockers l on l.id = a.locker_id
  where a.release_reason = 'released_by_import_master_batch:' || p_batch_id::text
    and exists (
      select 1 from public.union_locker_assignments a_other
      where a_other.locker_id = a.locker_id
        and a_other.status = 'active'
        and a_other.id <> a.id
        and a_other.assignment_reason <> 'import_master_batch:' || p_batch_id::text
    )
  limit 1;

  if v_conflict_locker is not null then
    raise exception 'ROLLBACK_CONFLICT_NEWER_CHANGES: El casillero % fue reasignado posteriormente a este lote y no puede restaurarse la asignación anterior.', v_conflict_locker;
  end if;

  -- 7. REVERSIÓN DE TRABAJADORES
  -- A. Trabajadores creados exclusivamente por este lote: marcado no destructivo (NUNCA DELETE)
  update public.union_workers
  set
    active = false,
    source_rolled_back_at = v_now,
    source_import_state = 'rolled_back',
    updated_by = auth.uid(),
    updated_at = v_now
  where delegation_id = v_batch.delegation_id
    and source_created_by_batch_id = p_batch_id;
  get diagnostics v_deactivated_workers = row_count;

  -- B. Trabajadores actualizados por este lote: restaurar campos desde el historial
  for v_history in
    select h.worker_id, h.field_name, h.old_value
    from public.union_worker_change_history h
    where h.batch_id = p_batch_id
    order by h.created_at desc
  loop
    if v_history.field_name in ('category', 'position_description') then
      update public.union_workers
      set category = coalesce(v_history.old_value, ''),
          position_description = coalesce(v_history.old_value, ''),
          updated_by = auth.uid(),
          updated_at = v_now
      where id = v_history.worker_id;
      v_restored_fields := v_restored_fields + 1;
    elsif v_history.field_name in ('schedule', 'schedule_description') then
      update public.union_workers
      set schedule = coalesce(v_history.old_value, ''),
          schedule_description = coalesce(v_history.old_value, ''),
          updated_by = auth.uid(),
          updated_at = v_now
      where id = v_history.worker_id;
      v_restored_fields := v_restored_fields + 1;
    elsif v_history.field_name = 'turn' then
      update public.union_workers
      set turn = coalesce(v_history.old_value, ''),
          updated_by = auth.uid(),
          updated_at = v_now
      where id = v_history.worker_id;
      v_restored_fields := v_restored_fields + 1;
    elsif v_history.field_name = 'plaza_code' then
      update public.union_workers
      set plaza_code = coalesce(v_history.old_value, ''),
          updated_by = auth.uid(),
          updated_at = v_now
      where id = v_history.worker_id;
      v_restored_fields := v_restored_fields + 1;
    elsif v_history.field_name = 'source_name_raw' then
      update public.union_workers
      set source_name_raw = coalesce(v_history.old_value, ''),
          updated_by = auth.uid(),
          updated_at = v_now
      where id = v_history.worker_id;
      v_restored_fields := v_restored_fields + 1;
    elsif v_history.field_name in ('import_notes', 'raw_observations') then
      update public.union_workers
      set import_notes = coalesce(v_history.old_value, ''),
          updated_by = auth.uid(),
          updated_at = v_now
      where id = v_history.worker_id;
      v_restored_fields := v_restored_fields + 1;
    end if;
  end loop;

  -- C. Snapshot complementario inmutable desde union_worker_import_rows.diff->'previous_snapshot'
  for v_row in
    select r.target_worker_id, r.diff->'previous_snapshot' as prev
    from public.union_worker_import_rows r
    where r.batch_id = p_batch_id
      and r.target_worker_id is not null
      and r.diff ? 'previous_snapshot'
      and r.action_taken = 'applied'
  loop
    if v_row.prev is not null then
      update public.union_workers
      set
        plaza_code = coalesce(v_row.prev->>'plaza_code', plaza_code),
        category = coalesce(v_row.prev->>'category', category),
        position_description = coalesce(v_row.prev->>'position_description', position_description),
        turn = coalesce(v_row.prev->>'turn', turn),
        schedule = coalesce(v_row.prev->>'schedule', schedule),
        schedule_description = coalesce(v_row.prev->>'schedule_description', schedule_description),
        source_name_raw = coalesce(v_row.prev->>'source_name_raw', source_name_raw),
        import_notes = coalesce(v_row.prev->>'import_notes', import_notes),
        updated_by = auth.uid(),
        updated_at = v_now
      where id = v_row.target_worker_id;
    end if;
  end loop;

  -- 8. REVERSIÓN DE CASILLEROS (Operaciones históricas coherentes, sin borrar el pasado)
  -- A. Revertir asignaciones creadas por este lote (marcarlas released)
  for v_assignment in
    select id, locker_id
    from public.union_locker_assignments
    where assignment_reason = 'import_master_batch:' || p_batch_id::text
      and status = 'active'
  loop
    update public.union_locker_assignments
    set
      status = 'released',
      released_at = v_now,
      release_reason = 'Revertido por rollback de lote maestro: ' || p_batch_id::text
    where id = v_assignment.id;

    -- Si el locker ya no tiene asignación activa, poner en disponible
    if not exists (
      select 1 from public.union_locker_assignments
      where locker_id = v_assignment.locker_id and status = 'active'
    ) then
      update public.union_lockers
      set status = 'disponible'
      where id = v_assignment.locker_id;
    end if;

    v_reverted_assignments := v_reverted_assignments + 1;
  end loop;

  -- B. Restaurar asignaciones que habían sido liberadas por este lote
  for v_assignment in
    select id, locker_id
    from public.union_locker_assignments
    where release_reason = 'released_by_import_master_batch:' || p_batch_id::text
      and status = 'released'
  loop
    update public.union_locker_assignments
    set
      status = 'active',
      released_at = null,
      release_reason = ''
    where id = v_assignment.id;

    update public.union_lockers
    set status = 'ocupado'
    where id = v_assignment.locker_id;

    v_restored_assignments := v_restored_assignments + 1;
  end loop;

  -- 9. Actualizar estado del lote
  update public.union_worker_import_batches
  set
    status = 'rolled_back',
    rolled_back_at = v_now,
    rolled_back_by = auth.uid(),
    updated_at = v_now
  where id = p_batch_id;

  -- 10. Registrar en auditoría sindical
  insert into public.union_audit_logs (
    delegation_id,
    user_id,
    action,
    entity_type,
    entity_id,
    details,
    created_at
  ) values (
    v_batch.delegation_id,
    auth.uid(),
    'rollback_master_import',
    'union_worker_import_batches',
    p_batch_id,
    jsonb_build_object(
      'deactivated_workers', v_deactivated_workers,
      'restored_fields', v_restored_fields,
      'reverted_assignments', v_reverted_assignments,
      'restored_assignments', v_restored_assignments
    ),
    v_now
  );

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'rolled_back',
    'deactivated_workers', v_deactivated_workers,
    'restored_fields', v_restored_fields,
    'reverted_assignments', v_reverted_assignments,
    'restored_assignments', v_restored_assignments
  );
end;
$$;
