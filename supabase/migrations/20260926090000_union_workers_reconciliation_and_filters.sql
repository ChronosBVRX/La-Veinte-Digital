-- ============================================================================
-- MIGRACIÓN: RECONCILIACIÓN DE PADRÓN SIAP, AUTORIDAD DE DATOS Y FILTROS
-- Fecha: 2026-09-26
-- Objetivo:
-- 1. Respaldo preventivo de seguridad de union_workers.
-- 2. Corregir los 2,321 trabajadores SIAP que quedaron con source = 'manual' a source = 'siap_excel'.
-- 3. Marcar los 323 trabajadores originados en Excel de lockers con source_import_state = 'missing_in_source'
--    para no contaminar el padrón laboral vigente sin romper los 312 registros de asignación en union_locker_assignments.
-- 4. Actualizar union_confirm_worker_import para incluir explícitamente source = 'siap_excel' y promover registros previos.
-- 5. Actualizar union_apply_locker_import para que NUNCA inserte trabajadores sintéticos en union_workers.
-- ============================================================================

-- 1. RESPALDO PREVENTIVO DE SEGURIDAD
create table if not exists public.backup_union_workers_20260926 as
select * from public.union_workers;

-- 2. CORREGIR SOURCE DE TRABAJADORES SIAP
update public.union_workers
set
  source = 'siap_excel',
  source_import_state = 'active',
  updated_at = clock_timestamp()
where source = 'manual'
  and (source_batch_id = 'e671988a-c623-4ce5-a0f4-bc953b692700' or last_import_batch_id = 'e671988a-c623-4ce5-a0f4-bc953b692700');

-- 3. MARCAR TRABAJADORES DE LOCKERS COMO HISTÓRICOS / NO VIGENTES EN SIAP
update public.union_workers
set
  source_import_state = 'missing_in_source',
  source_missing_since = coalesce(source_missing_since, clock_timestamp()),
  updated_at = clock_timestamp()
where source = 'locker_excel';

-- 4. ESTABLECER VALOR POR DEFECTO PARA source_import_state
alter table public.union_workers
  alter column source_import_state set default 'active';

-- 5. ACTUALIZAR union_confirm_worker_import
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
        source,
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
        'siap_excel',
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
          source = 'siap_excel',
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
          source = 'siap_excel',
          last_import_batch_id = p_batch_id,
          source_last_seen_at = v_now,
          source_missing_since = null,
          source_import_state = 'active',
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

  -- 7. Actualizar resumen y estado del lote
  update public.union_worker_import_batches set
    status = 'confirmed',
    confirmed_at = v_now,
    confirmed_by = auth.uid(),
    applied_rows_count = v_applied_count,
    missing_marked_count = v_missing_marked,
    notes = format('Confirmado exitosamente: %s creados, %s actualizados, %s sin cambios, %s marcados como ausentes.',
      v_applied_count, v_updated_count, v_unchanged_count, v_missing_marked),
    updated_at = v_now
  where id = p_batch_id;

  return jsonb_build_object(
    'applied_count', v_applied_count + v_updated_count,
    'new_count', v_applied_count,
    'updated_count', v_updated_count,
    'unchanged_count', v_unchanged_count,
    'missing_marked_count', v_missing_marked,
    'history_records_created', v_history_count
  );
end;
$$;

-- 6. ACTUALIZAR union_apply_locker_import PARA NO INSERTAR TRABAJADORES SINTÉTICOS
create or replace function public.union_apply_locker_import(
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
  v_source_row record;
  v_locker record;
  v_existing_worker record;
  v_active_locker_asgn record;
  v_worker_other_asgn record;
  v_worker_id uuid;
  v_locker_id uuid;
  v_new_assignment_id uuid;
  v_now timestamptz := clock_timestamp();

  v_norm_mat text;
  v_norm_locker text;
  v_resolution jsonb;
  v_res_action text;
  v_override_reason text;
  v_conflict_code text;
  v_is_imported_asgn boolean;
  v_is_semantic boolean;

  v_new_lockers_created integer := 0;
  v_new_workers_created integer := 0;
  v_assignments_created integer := 0;
  v_assignments_updated integer := 0;
  v_unchanged_assignments integer := 0;
  v_cleared_previous integer := 0;
  v_pending_reviews integer := 0;
  v_skipped_conflicts integer := 0;
  v_manual_conflicts integer := 0;
begin
  -- 1. Obtener y bloquear el lote
  select * into v_batch
  from public.union_worker_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'BATCH_NOT_FOUND: Lote % no encontrado.', p_batch_id;
  end if;

  if v_batch.format_version not in ('UNION_LOCKERS_V1', 'UNION_LOCKERS_HOJA1_V1') then
    raise exception 'INVALID_FORMAT_VERSION: Formato no soportado por este RPC: %', v_batch.format_version;
  end if;

  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: Permisos insuficientes.';
  end if;

  if v_batch.status <> 'preview' then
    raise exception 'INVALID_BATCH_STATUS: El lote está en estado "%".', v_batch.status;
  end if;

  -- 2. Asegurar existencia de casilleros físicos detectados en el archivo
  for v_row in
    select *
    from public.union_worker_import_rows
    where batch_id = p_batch_id
      and row_status not in ('invalid', 'ignored')
    order by row_number asc
  loop
    v_norm_locker := coalesce(v_row.parsed_data->>'locker', '');
    v_is_semantic := coalesce((v_row.parsed_data->>'is_semantic_locker')::boolean, false);

    if v_norm_locker <> '' and not v_is_semantic then
      select * into v_locker
      from public.union_lockers
      where delegation_id = v_batch.delegation_id
        and locker_number = v_norm_locker
      for update;

      if v_locker.id is null then
        insert into public.union_lockers (
          delegation_id,
          locker_number,
          status,
          condition,
          source,
          source_batch_id,
          last_seen_batch_id,
          last_seen_at
        ) values (
          v_batch.delegation_id,
          v_norm_locker,
          'available',
          'ok',
          'locker_excel',
          p_batch_id,
          p_batch_id,
          v_now
        )
        on conflict (delegation_id, locker_number) do update
          set
            last_seen_batch_id = p_batch_id,
            last_seen_at = v_now,
            updated_at = v_now
        returning id into v_locker_id;

        v_new_lockers_created := v_new_lockers_created + 1;
      else
        update public.union_lockers
        set
          last_seen_batch_id = p_batch_id,
          last_seen_at = v_now,
          updated_at = v_now
        where id = v_locker.id;
      end if;
    end if;

    -- Cotejar trabajador existente únicamente (NUNCA crear trabajador sintético)
    select * into v_source_row
    from public.union_locker_import_source_rows
    where batch_id = p_batch_id
      and row_number = v_row.row_number;

    v_norm_mat := coalesce(v_row.matricula, '');

    if v_norm_mat <> '' and v_norm_mat not like 'ROW_%' then
      v_worker_id := null;

      select id into v_worker_id
      from public.union_workers
      where delegation_id = v_batch.delegation_id
        and employee_number = v_norm_mat;

      if v_source_row.id is not null then
        update public.union_locker_import_source_rows
        set matched_worker_id = v_worker_id, updated_at = clock_timestamp()
        where id = v_source_row.id;
      end if;
    end if;
  end loop;

  -- 3. Reconciliación del snapshot autoritativo de casilleros
  for v_row in
    select *
    from public.union_worker_import_rows
    where batch_id = p_batch_id
    order by row_number asc
  loop
    select * into v_source_row
    from public.union_locker_import_source_rows
    where batch_id = p_batch_id
      and row_number = v_row.row_number;

    v_resolution := p_resolutions -> (v_row.row_number::text);
    v_res_action := coalesce(v_resolution ->> 'action', '');
    v_override_reason := trim(coalesce(v_resolution ->> 'reason', ''));

    if v_res_action = 'skip' then
      update public.union_worker_import_rows set action_taken = 'skipped' where id = v_row.id;
      if v_source_row.id is not null then
        update public.union_locker_import_source_rows set resolution_state = 'skipped', updated_at = clock_timestamp() where id = v_source_row.id;
      end if;
      v_skipped_conflicts := v_skipped_conflicts + 1;
      continue;
    end if;

    if v_row.row_status in ('invalid', 'ignored') then
      update public.union_worker_import_rows set action_taken = 'skipped' where id = v_row.id;
      if v_source_row.id is not null then
        update public.union_locker_import_source_rows set resolution_state = 'skipped', updated_at = clock_timestamp() where id = v_source_row.id;
      end if;
      continue;
    end if;

    v_norm_locker := coalesce(v_row.parsed_data->>'locker', '');
    v_is_semantic := coalesce((v_row.parsed_data->>'is_semantic_locker')::boolean, false);
    v_norm_mat := coalesce(v_row.matricula, '');

    -- Si no hay casillero o es semántico no físico
    if v_norm_locker = '' or v_is_semantic then
      update public.union_worker_import_rows set action_taken = 'skipped' where id = v_row.id;
      if v_source_row.id is not null then
        update public.union_locker_import_source_rows set resolution_state = 'skipped', updated_at = clock_timestamp() where id = v_source_row.id;
      end if;
      continue;
    end if;

    -- Localizar casillero físico
    select * into v_locker
    from public.union_lockers
    where delegation_id = v_batch.delegation_id
      and locker_number = v_norm_locker
    for update;

    v_locker_id := v_locker.id;

    -- Caso Locker Vacío en el Excel
    if v_norm_mat = '' or v_norm_mat like 'ROW_%' then
      select * into v_active_locker_asgn
      from public.union_locker_assignments
      where locker_id = v_locker_id and status = 'active'
      for update;

      if v_active_locker_asgn.id is not null then
        v_is_imported_asgn := (
          v_active_locker_asgn.source = 'locker_excel'
          or v_active_locker_asgn.source_batch_id is not null
          or v_active_locker_asgn.assignment_reason like 'import_locker_batch:%'
          or v_active_locker_asgn.assignment_reason like 'import_master_batch:%'
        ) and not coalesce(v_active_locker_asgn.admin_override, false);

        if v_is_imported_asgn then
          update public.union_locker_assignments
          set
            status = 'released',
            released_at = v_now,
            released_by_source_batch_id = p_batch_id,
            release_reason = 'Liberado por nuevo snapshot de lockers (casillero vacío en Hoja1 - Lote ' || p_batch_id::text || ')'
          where id = v_active_locker_asgn.id;

          update public.union_lockers
          set status = 'available', updated_at = v_now
          where id = v_locker_id;

          v_cleared_previous := v_cleared_previous + 1;
        else
          insert into public.union_locker_review_items (
            delegation_id, locker_id, locker_number, source_batch_id, source_row_number,
            source_employee_number, source_worker_name, source_notes, reason, status, metadata
          ) values (
            v_batch.delegation_id, v_locker_id, v_norm_locker, p_batch_id, v_row.row_number,
            '', '', 'Hoja1 indica casillero vacío pero existe asignación manual activa',
            'CONFLICT_WITH_MANUAL_CHANGE', 'pending',
            jsonb_build_object(
              'existing_assignment_id', v_active_locker_asgn.id,
              'existing_worker_id', v_active_locker_asgn.worker_id,
              'type', 'clear_blocked_by_manual'
            )
          );
          v_manual_conflicts := v_manual_conflicts + 1;
          v_pending_reviews := v_pending_reviews + 1;
        end if;
      end if;

      update public.union_worker_import_rows set action_taken = 'applied' where id = v_row.id;
      if v_source_row.id is not null then
        update public.union_locker_import_source_rows
        set matched_locker_id = v_locker_id, resolution_state = 'applied', updated_at = clock_timestamp()
        where id = v_source_row.id;
      end if;
      continue;
    end if;

    -- Obtener trabajador de la base de datos
    select id into v_worker_id
    from public.union_workers
    where delegation_id = v_batch.delegation_id
      and employee_number = v_norm_mat;

    -- SI EL TRABAJADOR NO EXISTE EN UNION_WORKERS: REGISTRAR EN REVISIÓN (NUNCA CREAR SINTÉTICO)
    if v_worker_id is null then
      insert into public.union_locker_review_items (
        delegation_id, locker_id, locker_number, source_batch_id, source_row_number,
        source_employee_number, source_worker_name, source_notes, reason, status, metadata
      ) values (
        v_batch.delegation_id, v_locker_id, v_norm_locker, p_batch_id, v_row.row_number,
        v_norm_mat, coalesce(v_source_row.worker_name_raw, v_row.full_name),
        coalesce(v_source_row.observations_raw, ''), 'LOCKER_ONLY_PERSON', 'pending',
        jsonb_build_object(
          'excel_row_number', v_row.row_number,
          'raw_nombre', coalesce(v_source_row.worker_name_raw, v_row.full_name),
          'raw_matricula', v_norm_mat,
          'raw_locker', v_norm_locker,
          'conflict_code', 'LOCKER_ONLY_PERSON'
        )
      );
      update public.union_worker_import_rows set action_taken = 'conflict_hold' where id = v_row.id;
      if v_source_row.id is not null then
        update public.union_locker_import_source_rows
        set matched_worker_id = null, matched_locker_id = v_locker_id, resolution_state = 'pending_review', updated_at = clock_timestamp()
        where id = v_source_row.id;
      end if;
      v_pending_reviews := v_pending_reviews + 1;
      continue;
    end if;

    -- Filtros de seguridad física del casillero
    if v_locker.condition in ('maintenance', 'blocked') then
      if v_res_action <> 'override' then
        insert into public.union_locker_review_items (
          delegation_id, locker_id, locker_number, source_batch_id, source_row_number,
          source_employee_number, source_worker_name, source_notes, reason, status, metadata
        ) values (
          v_batch.delegation_id, v_locker_id, v_norm_locker, p_batch_id, v_row.row_number,
          v_norm_mat, coalesce(v_source_row.worker_name_raw, v_row.full_name),
          coalesce(v_source_row.observations_raw, ''),
          case when v_locker.condition = 'maintenance' then 'MAINTENANCE_LOCKER' else 'BLOCKED_LOCKER' end,
          'pending',
          jsonb_build_object(
            'condition', v_locker.condition,
            'worker_id', v_worker_id,
            'matricula', v_norm_mat
          )
        );
        update public.union_worker_import_rows set action_taken = 'conflict_hold' where id = v_row.id;
        if v_source_row.id is not null then
          update public.union_locker_import_source_rows
          set matched_worker_id = v_worker_id, matched_locker_id = v_locker_id, resolution_state = 'pending_review', updated_at = clock_timestamp()
          where id = v_source_row.id;
        end if;
        v_pending_reviews := v_pending_reviews + 1;
        continue;
      end if;
    end if;

    -- Reconciliación con asignación existente
    select * into v_active_locker_asgn
    from public.union_locker_assignments
    where locker_id = v_locker_id and status = 'active'
    for update;

    if v_active_locker_asgn.id is not null and v_active_locker_asgn.worker_id = v_worker_id then
      update public.union_locker_assignments
      set
        source = coalesce(source, 'locker_excel'),
        source_row_id = coalesce(v_source_row.id, source_row_id)
      where id = v_active_locker_asgn.id;

      v_unchanged_assignments := v_unchanged_assignments + 1;
      v_new_assignment_id := v_active_locker_asgn.id;
    elsif v_active_locker_asgn.id is not null and v_active_locker_asgn.worker_id <> v_worker_id then
      -- Ocupante distinto en casillero
      v_is_imported_asgn := (
        v_active_locker_asgn.source = 'locker_excel'
        or v_active_locker_asgn.source_batch_id is not null
        or v_active_locker_asgn.assignment_reason like 'import_locker_batch:%'
        or v_active_locker_asgn.assignment_reason like 'import_master_batch:%'
      ) and not coalesce(v_active_locker_asgn.admin_override, false);

      if v_is_imported_asgn or v_res_action = 'reassign' or v_res_action = 'override' then
        update public.union_locker_assignments
        set
          status = 'released',
          released_at = v_now,
          released_by_source_batch_id = p_batch_id,
          release_reason = case
            when v_res_action in ('reassign', 'override') then
              'Reasignado por resolución administrativa de snapshot (Lote ' || p_batch_id::text || '): ' || coalesce(v_override_reason, 'Sin motivo')
            else
              'Reasignado por nuevo snapshot autoritativo de lockers (Hoja1 - Lote ' || p_batch_id::text || ')'
          end
        where id = v_active_locker_asgn.id;

        insert into public.union_locker_assignments (
          locker_id,
          worker_id,
          status,
          assignment_reason,
          source,
          source_batch_id,
          source_row_id,
          admin_override,
          admin_override_reason,
          created_by,
          assigned_at,
          created_at
        ) values (
          v_locker_id,
          v_worker_id,
          'active',
          'import_locker_snapshot:' || p_batch_id::text,
          'locker_excel',
          p_batch_id,
          v_source_row.id,
          v_res_action in ('reassign', 'override'),
          case when v_res_action in ('reassign', 'override') then v_override_reason else '' end,
          auth.uid(),
          v_now,
          v_now
        ) returning id into v_new_assignment_id;

        v_assignments_updated := v_assignments_updated + 1;
      else
        insert into public.union_locker_review_items (
          delegation_id, locker_id, locker_number, source_batch_id, source_row_number,
          source_employee_number, source_worker_name, source_notes, reason, status, metadata
        ) values (
          v_batch.delegation_id, v_locker_id, v_norm_locker, p_batch_id, v_row.row_number,
          v_norm_mat, coalesce(v_source_row.worker_name_raw, v_row.full_name),
          coalesce(v_source_row.observations_raw, ''),
          'CONFLICT_WITH_MANUAL_CHANGE', 'pending',
          jsonb_build_object(
            'existing_assignment_id', v_active_locker_asgn.id,
            'existing_worker_id', v_active_locker_asgn.worker_id,
            'new_worker_id', v_worker_id,
            'type', 'reassign_blocked_by_manual'
          )
        );
        v_manual_conflicts := v_manual_conflicts + 1;
        v_pending_reviews := v_pending_reviews + 1;
        update public.union_worker_import_rows set action_taken = 'conflict_hold' where id = v_row.id;
        if v_source_row.id is not null then
          update public.union_locker_import_source_rows
          set matched_worker_id = v_worker_id, matched_locker_id = v_locker_id, resolution_state = 'pending_review', updated_at = clock_timestamp()
          where id = v_source_row.id;
        end if;
        continue;
      end if;
    else
      -- Casillero libre: crear asignación activa
      insert into public.union_locker_assignments (
        locker_id,
        worker_id,
        status,
        assignment_reason,
        source,
        source_batch_id,
        source_row_id,
        admin_override,
        admin_override_reason,
        created_by,
        assigned_at,
        created_at
      ) values (
        v_locker_id,
        v_worker_id,
        'active',
        'import_locker_snapshot:' || p_batch_id::text,
        'locker_excel',
        p_batch_id,
        v_source_row.id,
        v_res_action in ('reassign', 'override'),
        case when v_res_action in ('reassign', 'override') then v_override_reason else '' end,
        auth.uid(),
        v_now,
        v_now
      ) returning id into v_new_assignment_id;

      v_assignments_created := v_assignments_created + 1;
    end if;

    -- Actualizar estado del casillero físico
    update public.union_lockers
    set
      status = 'assigned',
      updated_at = v_now
    where id = v_locker_id;

    update public.union_worker_import_rows
    set action_taken = 'applied'
    where id = v_row.id;

    if v_source_row.id is not null then
      update public.union_locker_import_source_rows
      set
        matched_worker_id = v_worker_id,
        matched_locker_id = v_locker_id,
        applied_assignment_id = v_new_assignment_id,
        resolution_state = 'applied',
        updated_at = clock_timestamp()
      where id = v_source_row.id;
    end if;
  end loop;

  -- 4. Cerrar lote de importación
  update public.union_worker_import_batches
  set
    status = 'confirmed',
    confirmed_at = v_now,
    confirmed_by = auth.uid(),
    applied_rows_count = v_assignments_created + v_assignments_updated + v_unchanged_assignments,
    notes = format('Snapshot aplicado: %s creadas, %s reasignadas, %s intactas, %s liberadas, %s pendientes.',
      v_assignments_created, v_assignments_updated, v_unchanged_assignments, v_cleared_previous, v_pending_reviews),
    updated_at = v_now
  where id = p_batch_id;

  return jsonb_build_object(
    'new_lockers_created', v_new_lockers_created,
    'new_workers_created', v_new_workers_created,
    'assignments_created', v_assignments_created,
    'assignments_updated', v_assignments_updated,
    'unchanged_assignments', v_unchanged_assignments,
    'cleared_previous', v_cleared_previous,
    'pending_reviews', v_pending_reviews,
    'skipped_conflicts', v_skipped_conflicts,
    'manual_conflicts', v_manual_conflicts
  );
end;
$$;

-- 7. ÍNDICES DE OPTIMIZACIÓN
create index if not exists union_workers_dir_filter_idx
  on public.union_workers (delegation_id, source_import_state, active, shift_code);

create index if not exists union_workers_dir_category_idx
  on public.union_workers (delegation_id, category);
