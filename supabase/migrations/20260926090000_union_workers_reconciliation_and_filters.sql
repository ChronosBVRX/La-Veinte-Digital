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

alter table public.backup_union_workers_20260926 enable row level security;
revoke all on public.backup_union_workers_20260926 from anon, authenticated;

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
drop function if exists public.union_apply_locker_import(uuid, jsonb);
drop function if exists public.union_apply_locker_import(uuid, jsonb, jsonb);

create or replace function public.union_apply_locker_import(
  p_batch_id uuid,
  p_resolutions jsonb default '{}'::jsonb,
  p_options jsonb default '{}'::jsonb
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
  v_existing_worker record;
  v_locker record;
  v_worker_id uuid;
  v_locker_id uuid;
  v_active_locker_asgn record;
  v_active_worker_asgn record;
  v_stale_asgn record;
  v_new_assignment_id uuid;
  v_prev_snapshot_batch_id uuid;
  v_confirmed_asgn_ids uuid[] := '{}';

  -- Contadores exactos
  v_new_lockers_inventoried integer := 0;
  v_new_locker_assignments integer := 0;
  v_locker_changes integer := 0;
  v_unchanged_assignments integer := 0;
  v_replaced_previous integer := 0;
  v_cleared_previous integer := 0;
  v_stale_released integer := 0;
  v_manual_conflicts integer := 0;
  v_skipped_conflicts integer := 0;
  v_pending_reviews integer := 0;
  v_new_workers_created integer := 0;
  v_total_active integer := 0;

  v_now timestamptz := clock_timestamp();
  v_resolution jsonb;
  v_res_action text;
  v_override_reason text;
  v_norm_locker text;
  v_norm_mat text;
  v_is_semantic boolean;
  v_conflict_code text;
  v_first_name text;
  v_paternal text;
  v_maternal text;
  v_raw_name text;
  v_slash_idx1 integer;
  v_slash_idx2 integer;
  v_existing_batch_id uuid;
  v_existing_confirmed_at timestamptz;
  v_allow_reimport boolean;
  v_is_imported_asgn boolean;
begin
  -- 1. Bloquear y verificar el lote
  select * into v_batch
  from public.union_worker_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'BATCH_NOT_FOUND: Lote % no encontrado.', p_batch_id;
  end if;

  -- Bloqueo consultivo a nivel delegación para serializar ejecuciones concurrentes
  perform pg_advisory_xact_lock(hashtext('union_locker_import_' || v_batch.delegation_id::text));

  -- 2. Validar versión de formato
  if v_batch.format_version not in ('UNION_LOCKERS_V2', 'UNION_LOCKERS_V1', 'UNION_MASTER_LOCKERS_V1', 'UNION_LOCKERS_HOJA1_V1') then
    raise exception 'INVALID_FORMAT_VERSION: Formato no soportado "%".', v_batch.format_version;
  end if;

  -- 3. Validar estado preview
  if v_batch.status <> 'preview' then
    raise exception 'INVALID_BATCH_STATUS: El lote no se encuentra en estado preview (estado actual: "%").', v_batch.status;
  end if;

  -- 4. Validar permisos de union_admin sobre la delegación
  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: No cuentas con permisos de union_admin en la delegación %.', v_batch.delegation_id;
  end if;

  -- 5. Idempotencia: Verificar si este mismo archivo (file_sha256) ya fue confirmado previamente
  v_allow_reimport := coalesce(
    (p_options->>'allow_reimport')::boolean,
    (p_options->>'allowReimport')::boolean,
    (p_resolutions->>'allow_reimport')::boolean,
    (p_resolutions->>'allowReimport')::boolean,
    false
  );

  select id, confirmed_at into v_existing_batch_id, v_existing_confirmed_at
  from public.union_worker_import_batches
  where delegation_id = v_batch.delegation_id
    and file_sha256 = v_batch.file_sha256
    and status = 'confirmed'
    and id <> p_batch_id
  limit 1;

  if v_existing_batch_id is not null and not v_allow_reimport then
    raise exception 'FILE_ALREADY_IMPORTED: Este archivo ya fue confirmado el % (Lote %).', v_existing_confirmed_at, v_existing_batch_id;
  end if;

  -- 6. Obtener el lote del snapshot canónico anterior para registrar la supersesión
  select id into v_prev_snapshot_batch_id
  from public.union_worker_import_batches
  where delegation_id = v_batch.delegation_id
    and status = 'confirmed'
    and format_version in ('UNION_LOCKERS_V2', 'UNION_LOCKERS_V1', 'UNION_MASTER_LOCKERS_V1')
    and id <> p_batch_id
  order by is_latest_snapshot desc, confirmed_at desc nulls last, created_at desc
  limit 1;

  -- ==========================================================
  -- FASE 1: INVENTARIO FÍSICO (Asegurar que todos los casilleros existen y actualizar last_seen)
  -- ==========================================================
  for v_row in
    select distinct
      coalesce(r.parsed_data->>'locker', '') as locker_number
    from public.union_worker_import_rows r
    where r.batch_id = p_batch_id
      and coalesce((r.parsed_data->>'is_semantic_locker')::boolean, false) = false
      and coalesce(r.parsed_data->>'locker', '') <> ''
  loop
    insert into public.union_lockers (
      delegation_id,
      locker_number,
      status,
      condition,
      notes,
      source,
      source_batch_id,
      last_seen_batch_id,
      last_seen_at
    ) values (
      v_batch.delegation_id,
      v_row.locker_number,
      'available',
      'ok',
      'Registrado por importación Hoja1',
      'locker_excel',
      p_batch_id,
      p_batch_id,
      v_now
    )
    on conflict (delegation_id, locker_number) do update
      set
        last_seen_batch_id = p_batch_id,
        last_seen_at = v_now,
        updated_at = v_now;

    if found then
      v_new_lockers_inventoried := v_new_lockers_inventoried + 1;
    end if;
  end loop;

  -- ==========================================================
  -- FASE 2: GESTIÓN DE TRABAJADORES (Padrón vs Nuevos desde Excel)
  -- ==========================================================
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

    v_norm_mat := coalesce(v_row.matricula, '');

    if v_norm_mat <> '' and v_norm_mat not like 'ROW_%' then
      v_worker_id := null;
      v_existing_worker := null;

      select * into v_existing_worker
      from public.union_workers
      where delegation_id = v_batch.delegation_id
        and employee_number = v_norm_mat
      for update;

      -- ORDEN MAESTRA: Lockers NUNCA crea trabajadores sintéticos en union_workers.
      if v_existing_worker.id is not null then
        v_worker_id := v_existing_worker.id;
      else
        v_worker_id := null;
      end if;

      if v_source_row.id is not null then
        update public.union_locker_import_source_rows
        set matched_worker_id = v_worker_id, updated_at = clock_timestamp()
        where id = v_source_row.id;
      end if;
    end if;
  end loop;

  -- ==========================================================
  -- FASE 3: RECONCILIACIÓN DEL SNAPSHOT AUTORITATIVO (HOJA1)
  -- ==========================================================

  -- 3.1: PROCESAR FILAS DE HOJA1
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

    -- ========================================================
    -- CASO C: LOCKER VACÍO EN EL NUEVO EXCEL
    -- ========================================================
    if v_norm_mat = '' or v_norm_mat like 'ROW_%' then
      -- Buscar si tiene asignación activa actualmente
      select * into v_active_locker_asgn
      from public.union_locker_assignments
      where locker_id = v_locker_id and status = 'active'
      for update;

      if v_active_locker_asgn.id is not null then
        -- Verificar si la asignación previa proviene de una importación
        v_is_imported_asgn := (
          v_active_locker_asgn.source = 'locker_excel'
          or v_active_locker_asgn.source_batch_id is not null
          or v_active_locker_asgn.assignment_reason like 'import_locker_batch:%'
          or v_active_locker_asgn.assignment_reason like 'import_master_batch:%'
        ) and not coalesce(v_active_locker_asgn.admin_override, false);

        if v_is_imported_asgn then
          -- LIBERAR ASIGNACIÓN IMPORTADA ANTERIOR
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
          -- ASIGNACIÓN MANUAL PROTEGIDA -> CONFLICTO
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

    -- Obtener trabajador
    select id into v_worker_id
    from public.union_workers
    where delegation_id = v_batch.delegation_id
      and employee_number = v_norm_mat;

    -- ========================================================
    -- FILTROS DE SEGURIDAD FÍSICA (Mantenimiento, Bloqueo, Reserva)
    -- ========================================================
    if v_locker.condition in ('maintenance', 'blocked') then
      if v_res_action <> 'override' then
        insert into public.union_locker_review_items (
          delegation_id, locker_id, locker_number, source_batch_id, source_row_number,
          source_employee_number, source_worker_name, source_notes, reason, status, metadata
        ) values (
          v_batch.delegation_id, v_locker_id, v_norm_locker, p_batch_id, v_row.row_number,
          v_norm_mat, coalesce(v_source_row.worker_name_raw, v_row.full_name),
          coalesce(v_source_row.observations_raw, ''),
          case when v_locker.condition = 'maintenance' then 'LOCKER_IN_MAINTENANCE' else 'LOCKER_BLOCKED' end,
          'pending',
          jsonb_build_object('condition', v_locker.condition, 'excel_row_number', v_row.row_number)
        );
        update public.union_worker_import_rows set action_taken = 'conflict_hold' where id = v_row.id;
        v_pending_reviews := v_pending_reviews + 1;
        continue;
      end if;
    end if;

    if v_locker.status = 'reserved' and v_locker.reserved_for_worker_id is not null and v_locker.reserved_for_worker_id is distinct from v_worker_id then
      if v_res_action <> 'override' then
        insert into public.union_locker_review_items (
          delegation_id, locker_id, locker_number, source_batch_id, source_row_number,
          source_employee_number, source_worker_name, source_notes, reason, status, metadata
        ) values (
          v_batch.delegation_id, v_locker_id, v_norm_locker, p_batch_id, v_row.row_number,
          v_norm_mat, coalesce(v_source_row.worker_name_raw, v_row.full_name),
          coalesce(v_source_row.observations_raw, ''), 'LOCKER_RESERVED', 'pending',
          jsonb_build_object('reserved_for_worker_id', v_locker.reserved_for_worker_id, 'excel_row_number', v_row.row_number)
        );
        update public.union_worker_import_rows set action_taken = 'conflict_hold' where id = v_row.id;
        v_pending_reviews := v_pending_reviews + 1;
        continue;
      end if;
    end if;

    -- ========================================================
    -- CONFLICTOS INTRÍNSECOS EN EL MISMO EXCEL
    -- ========================================================
    v_conflict_code := coalesce(v_row.parsed_data->>'conflict_reason_code', '');

    if v_conflict_code in ('HISTORICAL_SUPERSEDED', 'DUPLICATE_IDENTICAL_ROW', 'DUPLICATE_LOCKER_SAME_WORKER') then
      update public.union_worker_import_rows set action_taken = 'skipped' where id = v_row.id;
      if v_source_row.id is not null then
        update public.union_locker_import_source_rows
        set matched_worker_id = v_worker_id, matched_locker_id = v_locker_id, resolution_state = 'historical_superseded', updated_at = clock_timestamp()
        where id = v_source_row.id;
      end if;
      continue;
    end if;

    -- Si tiene conflicto intrínseco o ambiguo no resuelto: enviar a review items
    if v_conflict_code in (
      'DUPLICATE_LOCKER_DIFFERENT_WORKERS',
      'WORKER_MULTIPLE_LOCKERS',
      'LOCKER_ASSIGNED_TO_OTHER_WORKER',
      'AMBIGUOUS_HISTORY',
      'REAL_CONFLICT',
      'CONFLICT_WITH_MANUAL_CHANGE'
    ) and v_res_action <> 'resolve' and v_res_action <> 'override' then
      insert into public.union_locker_review_items (
        delegation_id, locker_id, locker_number, source_batch_id, source_row_number,
        source_employee_number, source_worker_name, source_notes, reason, status, metadata
      ) values (
        v_batch.delegation_id, v_locker_id, v_norm_locker, p_batch_id, v_row.row_number,
        v_norm_mat, coalesce(v_source_row.worker_name_raw, v_row.full_name),
        coalesce(v_source_row.observations_raw, ''), v_conflict_code, 'pending',
        jsonb_build_object(
          'excel_row_number', v_row.row_number,
          'raw_nombre', coalesce(v_source_row.worker_name_raw, v_row.full_name),
          'raw_matricula', v_norm_mat,
          'raw_locker', v_norm_locker,
          'conflict_code', v_conflict_code
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

    -- ========================================================
    -- ORDEN MAESTRA: SI EL TRABAJADOR NO EXISTE EN UNION_WORKERS (PADRÓN SIAP)
    -- ========================================================
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

    -- ========================================================
    -- RECONCILIACIÓN AUTORITATIVA DEL CASILLERO Y TRABAJADOR
    -- ========================================================
    select * into v_active_locker_asgn
    from public.union_locker_assignments
    where locker_id = v_locker_id and status = 'active'
    for update;

    -- CASO A: Asignación idéntica ya activa (mismo trabajador en mismo casillero)
    if v_active_locker_asgn.id is not null and v_active_locker_asgn.worker_id = v_worker_id then
      -- Asegurar procedencia pero sin alterar source_batch_id original para no romper rollbacks
      update public.union_locker_assignments
      set
        source = coalesce(source, 'locker_excel'),
        source_row_id = coalesce(v_source_row.id, source_row_id)
      where id = v_active_locker_asgn.id;

      v_unchanged_assignments := v_unchanged_assignments + 1;
      v_new_assignment_id := v_active_locker_asgn.id;
      v_confirmed_asgn_ids := array_append(v_confirmed_asgn_ids, v_new_assignment_id);

    -- CASO B: Casillero ocupado por OTRA persona
    elsif v_active_locker_asgn.id is not null and v_active_locker_asgn.worker_id <> v_worker_id then
      v_is_imported_asgn := (
        v_active_locker_asgn.source = 'locker_excel'
        or v_active_locker_asgn.source_batch_id is not null
        or v_active_locker_asgn.assignment_reason like 'import_locker_batch:%'
        or v_active_locker_asgn.assignment_reason like 'import_master_batch:%'
      ) and not coalesce(v_active_locker_asgn.admin_override, false);

      if v_is_imported_asgn or v_res_action = 'override' then
        if not v_is_imported_asgn and v_res_action = 'override' and v_override_reason = '' then
          raise exception 'OVERRIDE_REQUIRES_REASON: Se requiere justificación para override del casillero % (ocupado por otro trabajador).', v_norm_locker;
        end if;

        -- SUSTITUIR ASIGNACIÓN ANTERIOR DEL CASILLERO
        update public.union_locker_assignments
        set
          status = 'released',
          released_at = v_now,
          released_by_source_batch_id = p_batch_id,
          release_reason = case
            when v_is_imported_asgn then 'Sustituido por nuevo snapshot de lockers (Lote ' || p_batch_id::text || ')'
            else 'Override por importación Hoja1 (Lote ' || p_batch_id::text || '): ' || v_override_reason
          end
        where id = v_active_locker_asgn.id;

        -- Si el nuevo trabajador ya tenía otro casillero activo previamente (cambio de casillero A -> B), liberarlo
        select * into v_active_worker_asgn
        from public.union_locker_assignments
        where worker_id = v_worker_id and status = 'active' and locker_id <> v_locker_id
        for update;

        if v_active_worker_asgn.id is not null then
          update public.union_locker_assignments
          set
            status = 'released',
            released_at = v_now,
            released_by_source_batch_id = p_batch_id,
            release_reason = 'Reasignación a casillero ' || v_norm_locker || ' por snapshot Hoja1 (Lote ' || p_batch_id::text || ')'
          where id = v_active_worker_asgn.id;

          if not exists (
            select 1 from public.union_locker_assignments
            where locker_id = v_active_worker_asgn.locker_id and status = 'active' and id <> v_active_worker_asgn.id
          ) then
            update public.union_lockers set status = 'available', updated_at = v_now where id = v_active_worker_asgn.locker_id;
          end if;

          v_locker_changes := v_locker_changes + 1;
        else
          v_new_locker_assignments := v_new_locker_assignments + 1;
        end if;

        -- Crear asignación para el nuevo trabajador de Hoja1
        insert into public.union_locker_assignments (
          locker_id, worker_id, assigned_at, assignment_reason, status, source, source_batch_id, source_row_id, admin_override
        ) values (
          v_locker_id, v_worker_id, v_now,
          case when v_res_action = 'override' then 'Asignación confirmada por override Hoja1: ' || v_override_reason else 'Asignación confirmada por snapshot Hoja1' end,
          'active', 'locker_excel', p_batch_id, v_source_row.id,
          case when v_res_action = 'override' then true else false end
        ) returning id into v_new_assignment_id;

        v_confirmed_asgn_ids := array_append(v_confirmed_asgn_ids, v_new_assignment_id);
        update public.union_lockers set status = 'assigned', updated_at = v_now where id = v_locker_id;
        v_replaced_previous := v_replaced_previous + 1;
      else
        -- Asignación manual protegida
        insert into public.union_locker_review_items (
          delegation_id, locker_id, locker_number, source_batch_id, source_row_number,
          source_employee_number, source_worker_name, source_notes, reason, status, metadata
        ) values (
          v_batch.delegation_id, v_locker_id, v_norm_locker, p_batch_id, v_row.row_number,
          v_norm_mat, coalesce(v_source_row.worker_name_raw, v_row.full_name),
          'Conflicto con cambio manual previo en casillero', 'CONFLICT_WITH_MANUAL_CHANGE', 'pending',
          jsonb_build_object('existing_assignment_id', v_active_locker_asgn.id, 'existing_worker_id', v_active_locker_asgn.worker_id)
        );
        update public.union_worker_import_rows set action_taken = 'conflict_hold' where id = v_row.id;
        if v_source_row.id is not null then
          update public.union_locker_import_source_rows
          set matched_worker_id = v_worker_id, matched_locker_id = v_locker_id, resolution_state = 'pending_review', updated_at = clock_timestamp()
          where id = v_source_row.id;
        end if;
        v_manual_conflicts := v_manual_conflicts + 1;
        v_pending_reviews := v_pending_reviews + 1;
        continue;
      end if;

    -- CASO NUEVA ASIGNACIÓN (Casillero estaba libre)
    else
      -- CASO D: Verificar si el trabajador ya tenía otro casillero
      select * into v_active_worker_asgn
      from public.union_locker_assignments
      where worker_id = v_worker_id and status = 'active'
      for update;

      if v_active_worker_asgn.id is not null and v_active_worker_asgn.locker_id <> v_locker_id then
        update public.union_locker_assignments
        set
          status = 'released',
          released_at = v_now,
          released_by_source_batch_id = p_batch_id,
          release_reason = 'Reasignación a casillero ' || v_norm_locker || ' por snapshot Hoja1 (Lote ' || p_batch_id::text || ')'
        where id = v_active_worker_asgn.id;

        if not exists (
          select 1 from public.union_locker_assignments
          where locker_id = v_active_worker_asgn.locker_id and status = 'active' and id <> v_active_worker_asgn.id
        ) then
          update public.union_lockers set status = 'available', updated_at = v_now where id = v_active_worker_asgn.locker_id;
        end if;

        v_locker_changes := v_locker_changes + 1;
      else
        v_new_locker_assignments := v_new_locker_assignments + 1;
      end if;

      insert into public.union_locker_assignments (
        locker_id, worker_id, assigned_at, assignment_reason, status, source, source_batch_id, source_row_id
      ) values (
        v_locker_id, v_worker_id, v_now, 'Asignación confirmada por snapshot Hoja1', 'active', 'locker_excel', p_batch_id, v_source_row.id
      ) returning id into v_new_assignment_id;

      v_confirmed_asgn_ids := array_append(v_confirmed_asgn_ids, v_new_assignment_id);
      update public.union_lockers set status = 'assigned', updated_at = v_now where id = v_locker_id;
    end if;

    update public.union_worker_import_rows set action_taken = 'applied' where id = v_row.id;
    if v_source_row.id is not null then
      update public.union_locker_import_source_rows
      set
        matched_worker_id = v_worker_id,
        matched_locker_id = v_locker_id,
        matched_assignment_id = v_new_assignment_id,
        resolution_state = 'applied',
        updated_at = clock_timestamp()
      where id = v_source_row.id;
    end if;
  end loop;

  -- ==========================================================
  -- 3.2: CASO E — LIBERAR ASIGNACIONES OBSOLETAS DEL SNAPSHOT PREVIO
  -- ==========================================================
  -- Toda asignación activa importada previamente que no fue adoptada por el nuevo lote
  -- debe liberarse de forma segura sin borrar historial.
  for v_stale_asgn in
    select a.id, a.locker_id, a.worker_id
    from public.union_locker_assignments a
    join public.union_lockers l on l.id = a.locker_id
    where l.delegation_id = v_batch.delegation_id
      and a.status = 'active'
      and not (a.id = any(v_confirmed_asgn_ids))
      and (
        a.source = 'locker_excel'
        or a.source_batch_id is not null
        or a.assignment_reason like 'import_locker_batch:%'
        or a.assignment_reason like 'import_master_batch:%'
      )
      and not coalesce(a.admin_override, false)
  loop
    update public.union_locker_assignments
    set
      status = 'released',
      released_at = v_now,
      released_by_source_batch_id = p_batch_id,
      release_reason = 'Liberado por ausencia en nuevo snapshot de lockers (Lote ' || p_batch_id::text || ')'
    where id = v_stale_asgn.id;

    if not exists (
      select 1 from public.union_locker_assignments
      where locker_id = v_stale_asgn.locker_id and status = 'active'
    ) then
      update public.union_lockers set status = 'available', updated_at = v_now where id = v_stale_asgn.locker_id;
    end if;

    v_stale_released := v_stale_released + 1;
  end loop;

  -- ==========================================================
  -- FASE 4: CONFIRMACIÓN DEL LOTE Y SUPERSESIÓN
  -- ==========================================================
  -- Desmarcar snapshot vigente previo
  update public.union_worker_import_batches
  set is_latest_snapshot = false
  where delegation_id = v_batch.delegation_id
    and format_version in ('UNION_LOCKERS_V2', 'UNION_LOCKERS_V1', 'UNION_MASTER_LOCKERS_V1')
    and id <> p_batch_id;

  select count(*) into v_total_active
  from public.union_locker_assignments
  where status = 'active' and locker_id in (
    select id from public.union_lockers where delegation_id = v_batch.delegation_id
  );

  update public.union_worker_import_batches
  set
    status = 'confirmed',
    is_latest_snapshot = true,
    supersedes_batch_id = v_prev_snapshot_batch_id,
    confirmed_at = v_now,
    confirmed_by = coalesce(auth.uid(), v_batch.imported_by),
    applied_at = v_now,
    new_lockers_count = v_new_lockers_inventoried,
    locker_changes_count = v_locker_changes,
    new_workers_count = v_new_workers_created,
    pending_review_count = v_pending_reviews,
    summary_metadata = jsonb_build_object(
      'new_physical_lockers', v_new_lockers_inventoried,
      'new_locker_assignments', v_new_locker_assignments,
      'locker_changes', v_locker_changes,
      'unchanged_assignments', v_unchanged_assignments,
      'replaced_previous_assignments', v_replaced_previous,
      'cleared_previous_assignments', v_cleared_previous,
      'stale_previous_released', v_stale_released,
      'manual_conflicts', v_manual_conflicts,
      'total_active_assignments', v_total_active,
      'new_workers_created', v_new_workers_created,
      'supersedes_batch_id', v_prev_snapshot_batch_id
    )
  where id = p_batch_id;

  return jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'status', 'confirmed',
    'new_physical_lockers', v_new_lockers_inventoried,
    'new_lockers_count', v_new_lockers_inventoried,
    'new_locker_assignments', v_new_locker_assignments,
    'locker_changes', v_locker_changes,
    'unchanged_assignments', v_unchanged_assignments,
    'replaced_previous_assignments', v_replaced_previous,
    'cleared_previous_assignments', v_cleared_previous,
    'stale_previous_released', v_stale_released,
    'total_active_assignments', v_total_active,
    'new_workers_created', v_new_workers_created,
    'skipped_conflicts', v_skipped_conflicts,
    'pending_review_count', v_pending_reviews
  );
end;
$$;

revoke execute on function public.union_apply_locker_import(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.union_apply_locker_import(uuid, jsonb, jsonb) to authenticated, service_role;

-- ============================================================

revoke execute on function public.union_apply_locker_import(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.union_apply_locker_import(uuid, jsonb, jsonb) to authenticated, service_role;

-- 7. ÍNDICES DE OPTIMIZACIÓN
create index if not exists union_workers_dir_filter_idx
  on public.union_workers (delegation_id, source_import_state, active, shift_code);

create index if not exists union_workers_dir_category_idx
  on public.union_workers (delegation_id, category);
