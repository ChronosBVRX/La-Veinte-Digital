-- 20260918000000_union_separate_imports.sql
-- Migración aditiva: Separación estricta de importaciones (Trabajadores vs Lockers)
-- Provee RPCs dedicadas exclusivamente para la gestión de casilleros (format_version: UNION_LOCKERS_V1)
-- Garantiza CERO modificaciones en public.union_workers desde el subsistema de lockers.

-- 1. RPC Transaccional Atómica para Aplicar la Importación de Casilleros (UNION_LOCKERS_V1)
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
  v_existing_worker record;
  v_worker_id uuid;
  v_locker_id uuid;
  v_prev_locker_id uuid;
  v_active_assignment record;
  v_new_locker_assignments integer := 0;
  v_locker_changes integer := 0;
  v_skipped_conflicts integer := 0;
  v_now timestamptz := clock_timestamp();
  v_resolution jsonb;
  v_res_action text;
  v_norm_locker text;
begin
  -- 1. Bloquear y verificar el lote
  select * into v_batch
  from public.union_worker_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'BATCH_NOT_FOUND: Lote % no encontrado.', p_batch_id;
  end if;

  -- 2. Validar que el formato sea UNION_LOCKERS_V1 (o compatible UNION_MASTER_LOCKERS_V1)
  if v_batch.format_version not in ('UNION_LOCKERS_V1', 'UNION_MASTER_LOCKERS_V1') then
    raise exception 'INVALID_FORMAT_VERSION: Este lote no corresponde al formato de casilleros UNION_LOCKERS_V1 (formato actual: "%").', v_batch.format_version;
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

    -- Buscar trabajador existente en la delegación por matrícula (SOLO LECTURA)
    select * into v_existing_worker
    from public.union_workers
    where delegation_id = v_batch.delegation_id
      and employee_number = v_row.matricula;

    if not found then
      -- REGLA OBLIGATORIA: Un importador de casilleros NUNCA crea un trabajador nuevo.
      -- Si no existe en el padrón, se omite de forma segura.
      update public.union_worker_import_rows
      set action_taken = 'skipped'
      where id = v_row.id;
      v_skipped_conflicts := v_skipped_conflicts + 1;
      continue;
    end if;

    v_worker_id := v_existing_worker.id;

    -- CONCILIACIÓN DE LOCKERS (CERO MODIFICACIONES EN union_workers)
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
        'Registrado por importación de casilleros'
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
          'import_locker_batch:' || p_batch_id::text,
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
          release_reason = 'released_by_import_locker_batch:' || p_batch_id::text
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
          'import_locker_batch:' || p_batch_id::text,
          auth.uid(),
          v_now
        );
        v_locker_changes := v_locker_changes + 1;
      end if;
    end if;

    -- Marcar fila de staging como aplicada (target_worker_id solo como enlace)
    update public.union_worker_import_rows
    set action_taken = 'applied', target_worker_id = v_worker_id
    where id = v_row.id;
  end loop;

  -- 6. Finalizar lote en union_worker_import_batches (CERO trabajadores nuevos o actualizados)
  update public.union_worker_import_batches
  set
    status = 'confirmed',
    applied_at = v_now,
    confirmed_at = v_now,
    confirmed_by = auth.uid(),
    new_workers_count = 0,
    updated_workers_count = 0,
    unchanged_workers_count = 0,
    new_lockers_count = v_new_locker_assignments,
    locker_changes_count = v_locker_changes,
    updated_at = v_now
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'confirmed',
    'applied_workers', 0,
    'updated_workers', 0,
    'unchanged_workers', 0,
    'new_locker_assignments', v_new_locker_assignments,
    'locker_changes', v_locker_changes,
    'skipped_conflicts', v_skipped_conflicts
  );
end;
$$;

-- 2. RPC Transaccional Atómica para Rollback de Importación de Casilleros (UNION_LOCKERS_V1)
-- Garantiza CERO efectos sobre public.union_workers.
create or replace function public.union_rollback_locker_import(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch record;
  v_assignment record;
  v_reverted_assignments integer := 0;
  v_restored_assignments integer := 0;
  v_now timestamptz := clock_timestamp();
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

  -- 2. Validar formato
  if v_batch.format_version not in ('UNION_LOCKERS_V1', 'UNION_MASTER_LOCKERS_V1') then
    raise exception 'INVALID_FORMAT_VERSION: Este lote no corresponde a una importación de casilleros (formato actual: "%").', v_batch.format_version;
  end if;

  -- 3. Validar estado
  if v_batch.status = 'rolled_back' then
    raise exception 'BATCH_ALREADY_ROLLED_BACK: El lote % ya fue revertido previamente.', p_batch_id;
  end if;

  if v_batch.status <> 'confirmed' then
    raise exception 'INVALID_BATCH_STATUS_FOR_ROLLBACK: Solo se pueden revertir lotes confirmados. Estado actual: "%".', v_batch.status;
  end if;

  -- 4. Validar permisos de union_admin
  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: No cuentas con permisos de union_admin en la delegación %.', v_batch.delegation_id;
  end if;

  -- 5. Verificar modificaciones posteriores conflictivas en CASILLEROS
  -- A) Asignación creada por este lote que fue posteriormente alterada
  select l.locker_number into v_conflict_locker
  from public.union_locker_assignments a
  join public.union_lockers l on l.id = a.locker_id
  where (a.assignment_reason = 'import_locker_batch:' || p_batch_id::text
         or a.assignment_reason = 'import_master_batch:' || p_batch_id::text)
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
  where (a.release_reason = 'released_by_import_locker_batch:' || p_batch_id::text
         or a.release_reason = 'released_by_import_master_batch:' || p_batch_id::text)
    and exists (
      select 1 from public.union_locker_assignments a_other
      where a_other.locker_id = a.locker_id
        and a_other.status = 'active'
        and a_other.id <> a.id
    )
  limit 1;

  if v_conflict_locker is not null then
    raise exception 'ROLLBACK_CONFLICT_NEWER_CHANGES: El casillero liberado % ahora tiene otra asignación activa y no puede ser restaurado automáticamente.', v_conflict_locker;
  end if;

  -- 6. Revertir asignaciones creadas por este lote
  for v_assignment in
    select *
    from public.union_locker_assignments
    where (assignment_reason = 'import_locker_batch:' || p_batch_id::text
           or assignment_reason = 'import_master_batch:' || p_batch_id::text)
      and status = 'active'
  loop
    update public.union_locker_assignments
    set
      status = 'released',
      released_at = v_now,
      release_reason = 'reverted_by_rollback:' || p_batch_id::text
    where id = v_assignment.id;

    if not exists (
      select 1 from public.union_locker_assignments
      where locker_id = v_assignment.locker_id
        and status = 'active'
    ) then
      update public.union_lockers
      set status = 'disponible'
      where id = v_assignment.locker_id;
    end if;

    v_reverted_assignments := v_reverted_assignments + 1;
  end loop;

  -- 7. Restaurar asignaciones que fueron liberadas por este lote
  for v_assignment in
    select *
    from public.union_locker_assignments
    where release_reason = 'released_by_import_locker_batch:' || p_batch_id::text
       or release_reason = 'released_by_import_master_batch:' || p_batch_id::text
  loop
    update public.union_locker_assignments
    set
      status = 'active',
      released_at = null,
      release_reason = null
    where id = v_assignment.id;

    update public.union_lockers
    set status = 'ocupado'
    where id = v_assignment.locker_id;

    v_restored_assignments := v_restored_assignments + 1;
  end loop;

  -- 8. Actualizar estado del lote
  -- NOTA: CERO MODIFICACIONES SOBRE public.union_workers.
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
    'reverted_assignments', v_reverted_assignments,
    'restored_assignments', v_restored_assignments,
    'deactivated_workers', 0,
    'restored_fields', 0
  );
end;
$$;
