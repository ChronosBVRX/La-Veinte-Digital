-- ============================================================
-- MIGRATION: 20260920150000_union_locker_authoritative_snapshot.sql
-- Snapshot Autoritativo de Lockers (Hoja1), Supersesión de Lotes,
-- Trazabilidad Estructurada y Reconciliación Transaccional.
-- SNTSS Sección XX · Delegación XXI (HGR No. 1 Charo)
-- ============================================================

-- ============================================================
-- 1. Columnas Aditivas para Metadatos de Snapshot y Supersesión
-- ============================================================

-- En union_worker_import_batches: relación de supersesión e indicador de snapshot vigente
alter table public.union_worker_import_batches
  add column if not exists supersedes_batch_id uuid
    references public.union_worker_import_batches (id) on delete set null,
  add column if not exists is_latest_snapshot boolean not null default false;

create index if not exists union_worker_import_batches_snapshot_idx
  on public.union_worker_import_batches (delegation_id, format_version, is_latest_snapshot)
  where is_latest_snapshot = true;

-- En union_lockers: metadatos de presencia en el último snapshot
alter table public.union_lockers
  add column if not exists last_seen_batch_id uuid
    references public.union_worker_import_batches (id) on delete set null,
  add column if not exists last_seen_at timestamptz;

create index if not exists union_lockers_last_seen_batch_idx
  on public.union_lockers (delegation_id, last_seen_batch_id);

-- ============================================================
-- 2. Backfill Determinista de Asignaciones Legacy
-- ============================================================
-- Corrige las 357 asignaciones generadas por importadores anteriores que tenían source = 'manual'
-- por haber sido creadas antes de la existencia de la columna source.

-- A) Lote 357b35f8 específico
update public.union_locker_assignments
set
  source = 'locker_excel',
  source_batch_id = '357b35f8-df37-444b-b0c3-341b9659ee3e'::uuid
where (source is null or source = 'manual')
  and assignment_reason like 'import_locker_batch:357b35f8-df37-444b-b0c3-341b9659ee3e%';

-- B) Cualquier asignación histórica con patrón import_locker_batch:<uuid>
update public.union_locker_assignments
set
  source = 'locker_excel',
  source_batch_id = substring(assignment_reason from 'import_locker_batch:([a-f0-9\-]{36})')::uuid
where (source is null or source = 'manual')
  and source_batch_id is null
  and assignment_reason ~ '^import_locker_batch:[a-f0-9\-]{36}';

-- C) Cualquier asignación histórica con patrón import_master_batch:<uuid>
update public.union_locker_assignments
set
  source = 'locker_excel',
  source_batch_id = substring(assignment_reason from 'import_master_batch:([a-f0-9\-]{36})')::uuid
where (source is null or source = 'manual')
  and source_batch_id is null
  and assignment_reason ~ '^import_master_batch:[a-f0-9\-]{36}';

-- ============================================================
-- 3. RPC union_apply_locker_import (V3 - Authoritative Snapshot)
-- ============================================================
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
  if v_batch.format_version not in ('UNION_LOCKERS_V2', 'UNION_LOCKERS_V1', 'UNION_MASTER_LOCKERS_V1') then
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

      if v_existing_worker.id is not null then
        v_worker_id := v_existing_worker.id;
      else
        v_raw_name := coalesce(v_source_row.worker_name_raw, v_row.full_name, '');
        v_paternal := '';
        v_maternal := '';
        v_first_name := '';

        if position('/' in v_raw_name) > 0 then
          v_slash_idx1 := position('/' in v_raw_name);
          v_paternal := trim(substring(v_raw_name from 1 for v_slash_idx1 - 1));
          v_raw_name := substring(v_raw_name from v_slash_idx1 + 1);
          v_slash_idx2 := position('/' in v_raw_name);
          if v_slash_idx2 > 0 then
            v_maternal := trim(substring(v_raw_name from 1 for v_slash_idx2 - 1));
            v_first_name := trim(substring(v_raw_name from v_slash_idx2 + 1));
          else
            v_first_name := trim(v_raw_name);
          end if;
        else
          v_paternal := split_part(v_raw_name, ' ', 1);
          v_first_name := trim(substring(v_raw_name from length(v_paternal) + 1));
        end if;

        if v_paternal = '' then v_paternal := 'TRABAJADOR'; end if;
        if v_first_name = '' then v_first_name := v_norm_mat; end if;

        insert into public.union_workers (
          delegation_id,
          employee_number,
          first_name,
          paternal_surname,
          maternal_surname,
          source_name_raw,
          plaza_code,
          turn,
          category,
          schedule,
          source,
          source_batch_id,
          active
        ) values (
          v_batch.delegation_id,
          v_norm_mat,
          v_first_name,
          v_paternal,
          v_maternal,
          coalesce(v_source_row.worker_name_raw, v_row.full_name, ''),
          coalesce(v_source_row.plaza_raw, ''),
          coalesce(v_source_row.turn_raw, ''),
          coalesce(v_source_row.category_raw, ''),
          coalesce(v_source_row.schedule_raw, ''),
          'locker_excel',
          p_batch_id,
          true
        )
        on conflict (delegation_id, employee_number) do update
          set updated_at = public.union_workers.updated_at
        returning id into v_worker_id;

        v_new_workers_created := v_new_workers_created + 1;
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

    if v_locker.status = 'reserved' and v_locker.reserved_for_worker_id is not null and v_locker.reserved_for_worker_id <> v_worker_id then
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

    if v_conflict_code in ('DUPLICATE_LOCKER_DIFFERENT_WORKERS', 'WORKER_MULTIPLE_LOCKERS') and v_res_action <> 'resolve' and v_res_action <> 'override' then
      insert into public.union_locker_review_items (
        delegation_id, locker_id, locker_number, source_batch_id, source_row_number,
        source_employee_number, source_worker_name, source_notes, reason, status, metadata
      ) values (
        v_batch.delegation_id, v_locker_id, v_norm_locker, p_batch_id, v_row.row_number,
        v_norm_mat, coalesce(v_source_row.worker_name_raw, v_row.full_name),
        coalesce(v_source_row.observations_raw, ''), v_conflict_code, 'pending',
        jsonb_build_object('excel_row_number', v_row.row_number, 'conflict_code', v_conflict_code)
      );
      update public.union_worker_import_rows set action_taken = 'conflict_hold' where id = v_row.id;
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
      -- Adoptar procedencia al lote vigente
      update public.union_locker_assignments
      set
        source = 'locker_excel',
        source_batch_id = p_batch_id,
        source_row_id = coalesce(v_source_row.id, source_row_id)
      where id = v_active_locker_asgn.id;

      v_unchanged_assignments := v_unchanged_assignments + 1;
      v_new_assignment_id := v_active_locker_asgn.id;

    -- CASO B: Casillero ocupado por OTRA persona
    elsif v_active_locker_asgn.id is not null and v_active_locker_asgn.worker_id <> v_worker_id then
      v_is_imported_asgn := (
        v_active_locker_asgn.source = 'locker_excel'
        or v_active_locker_asgn.source_batch_id is not null
        or v_active_locker_asgn.assignment_reason like 'import_locker_batch:%'
        or v_active_locker_asgn.assignment_reason like 'import_master_batch:%'
      ) and not coalesce(v_active_locker_asgn.admin_override, false);

      if v_is_imported_asgn or v_res_action = 'override' then
        -- SUSTITUIR ASIGNACIÓN ANTERIOR IMPORTADA
        update public.union_locker_assignments
        set
          status = 'released',
          released_at = v_now,
          released_by_source_batch_id = p_batch_id,
          release_reason = 'Sustituido por nuevo snapshot de lockers (Lote ' || p_batch_id::text || ')'
        where id = v_active_locker_asgn.id;

        -- Crear asignación para el nuevo trabajador de Hoja1
        insert into public.union_locker_assignments (
          locker_id, worker_id, assigned_at, assignment_reason, status, source, source_batch_id, source_row_id
        ) values (
          v_locker_id, v_worker_id, v_now, 'Asignación confirmada por snapshot Hoja1', 'active', 'locker_excel', p_batch_id, v_source_row.id
        ) returning id into v_new_assignment_id;

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
      and (a.source_batch_id is null or a.source_batch_id <> p_batch_id)
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
-- 4. RPC union_rollback_locker_import (V3 - Snapshot Supersession Safe)
-- ============================================================
create or replace function public.union_rollback_locker_import(
  p_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch record;
  v_asgn record;
  v_reverted_assignments integer := 0;
  v_restored_assignments integer := 0;
  v_deactivated_workers integer := 0;
  v_cancelled_reviews integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_batch
  from public.union_worker_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'BATCH_NOT_FOUND: Lote % no encontrado.', p_batch_id;
  end if;

  if v_batch.status not in ('confirmed', 'applied') then
    raise exception 'INVALID_BATCH_STATUS: Solo se pueden revertir lotes confirmados (estado actual: "%").', v_batch.status;
  end if;

  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: No cuentas con permisos de union_admin en la delegación %.', v_batch.delegation_id;
  end if;

  -- 1. Revertir asignaciones creadas por este lote
  for v_asgn in
    select id, locker_id
    from public.union_locker_assignments
    where source_batch_id = p_batch_id
      and status = 'active'
  loop
    update public.union_locker_assignments
    set
      status = 'released',
      released_at = v_now,
      release_reason = 'Rollback de importación Hoja1 (Lote ' || p_batch_id::text || ')'
    where id = v_asgn.id;

    if not exists (
      select 1 from public.union_locker_assignments
      where locker_id = v_asgn.locker_id and status = 'active'
    ) then
      update public.union_lockers set status = 'available', updated_at = v_now where id = v_asgn.locker_id;
    end if;

    v_reverted_assignments := v_reverted_assignments + 1;
  end loop;

  -- 2. Restaurar asignaciones liberadas por este lote
  for v_asgn in
    select id, locker_id, worker_id
    from public.union_locker_assignments
    where released_by_source_batch_id = p_batch_id
      and status = 'released'
  loop
    if not exists (
      select 1 from public.union_locker_assignments
      where locker_id = v_asgn.locker_id and status = 'active'
    ) and not exists (
      select 1 from public.union_locker_assignments
      where worker_id = v_asgn.worker_id and status = 'active'
    ) then
      update public.union_locker_assignments
      set
        status = 'active',
        released_at = null,
        release_reason = '',
        released_by_source_batch_id = null
      where id = v_asgn.id;

      update public.union_lockers set status = 'assigned', updated_at = v_now where id = v_asgn.locker_id;
      v_restored_assignments := v_restored_assignments + 1;
    end if;
  end loop;

  -- 3. Restaurar snapshot vigente previo
  if v_batch.supersedes_batch_id is not null then
    update public.union_worker_import_batches
    set is_latest_snapshot = true
    where id = v_batch.supersedes_batch_id;
  end if;

  -- 4. Inactivación lógica de trabajadores creados exclusivamente por este lote
  update public.union_workers
  set active = false, status_detail = 'rolled_back', updated_at = v_now
  where source = 'locker_excel' and source_batch_id = p_batch_id;

  get diagnostics v_deactivated_workers = row_count;

  -- 5. Cancelar review items pendientes
  update public.union_locker_review_items
  set
    status = 'cancelled_by_rollback',
    resolved_at = v_now,
    resolution = jsonb_build_object('action', 'batch_rolled_back', 'batch_id', p_batch_id),
    updated_at = v_now
  where source_batch_id = p_batch_id and status = 'pending';

  get diagnostics v_cancelled_reviews = row_count;

  -- 6. Actualizar estado del lote
  update public.union_worker_import_batches
  set
    status = 'rolled_back',
    is_latest_snapshot = false,
    rolled_back_at = v_now,
    rolled_back_by = coalesce(auth.uid(), v_batch.imported_by),
    notes = coalesce(notes, '') || ' [Revertido el ' || v_now::text || ']'
  where id = p_batch_id;

  return jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'reverted_assignments', v_reverted_assignments,
    'restored_assignments', v_restored_assignments,
    'deactivated_workers', v_deactivated_workers,
    'cancelled_review_items', v_cancelled_reviews
  );
end;
$$;

revoke execute on function public.union_rollback_locker_import(uuid) from public, anon;
grant execute on function public.union_rollback_locker_import(uuid) to authenticated, service_role;
