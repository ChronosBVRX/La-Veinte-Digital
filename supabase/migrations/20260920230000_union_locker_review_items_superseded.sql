-- 20260920230000_union_locker_review_items_superseded.sql
-- Migración: Soporte para estado 'superseded' en union_locker_review_items
-- Evita acumulación de pendientes históricos entre snapshots autoritativos sucesivos

-- 1. Ampliar CHECK constraint de union_locker_review_items
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'union_locker_review_items_status_check'
  ) then
    alter table public.union_locker_review_items
      drop constraint union_locker_review_items_status_check;
  end if;

  alter table public.union_locker_review_items
    add constraint union_locker_review_items_status_check
    check (status in ('pending', 'resolved', 'ignored', 'cancelled_by_rollback', 'superseded'));
end $$;

-- 2. Transición histórica de pendientes de lotes que NO son el snapshot vigente
update public.union_locker_review_items r
set
  status = 'superseded',
  resolved_at = coalesce(r.resolved_at, now()),
  resolution = jsonb_build_object(
    'action', 'superseded_by_snapshot',
    'superseded_by_batch_id', (
      select b_latest.id from public.union_worker_import_batches b_latest
      where b_latest.delegation_id = r.delegation_id
        and b_latest.is_latest_snapshot = true
      order by b_latest.created_at desc
      limit 1
    )
  ),
  updated_at = now()
where r.status = 'pending'
  and r.source_batch_id in (
    select id from public.union_worker_import_batches
    where is_latest_snapshot = false
  );

-- 3. Actualizar función union_apply_locker_authoritative_snapshot para superseder automáticamente
create or replace function public.union_apply_locker_authoritative_snapshot(
  p_batch_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_batch record;
  v_prev_snapshot_batch_id uuid;
  v_now timestamptz := now();
  v_row record;
  v_worker_id uuid;
  v_locker_id uuid;
  v_existing_asgn record;
  v_other_asgn record;
  v_new_lockers_inventoried integer := 0;
  v_new_locker_assignments integer := 0;
  v_locker_changes integer := 0;
  v_unchanged_assignments integer := 0;
  v_replaced_previous integer := 0;
  v_cleared_previous integer := 0;
  v_stale_released integer := 0;
  v_manual_conflicts integer := 0;
  v_new_workers_created integer := 0;
  v_pending_reviews integer := 0;
  v_total_active integer := 0;
  v_stale_asgn record;
begin
  select * into v_batch
  from public.union_worker_import_batches
  where id = p_batch_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Lote no encontrado');
  end if;

  if v_batch.status = 'confirmed' then
    return jsonb_build_object('success', false, 'error', 'El lote ya fue confirmado previamente');
  end if;

  select id into v_prev_snapshot_batch_id
  from public.union_worker_import_batches
  where delegation_id = v_batch.delegation_id
    and is_latest_snapshot = true
    and format_version in ('UNION_LOCKERS_V2', 'UNION_LOCKERS_V1', 'UNION_MASTER_LOCKERS_V1')
    and id <> p_batch_id
  order by confirmed_at desc nulls last, created_at desc
  limit 1;

  for v_row in (
    select *
    from public.union_locker_import_source_rows
    where batch_id = p_batch_id
    order by row_number asc
  ) loop
    v_worker_id := null;
    v_locker_id := null;

    if v_row.locker_normalized is not null and v_row.locker_normalized <> '' then
      select id into v_locker_id
      from public.union_lockers
      where delegation_id = v_batch.delegation_id
        and locker_number = v_row.locker_normalized;

      if v_locker_id is null then
        insert into public.union_lockers (
          delegation_id,
          locker_number,
          status,
          condition,
          source,
          source_batch_id,
          notes,
          created_at,
          updated_at
        ) values (
          v_batch.delegation_id,
          v_row.locker_normalized,
          'available',
          'ok',
          'excel_snapshot',
          p_batch_id,
          coalesce(v_row.observations_raw, ''),
          v_now,
          v_now
        )
        returning id into v_locker_id;

        v_new_lockers_inventoried := v_new_lockers_inventoried + 1;
      end if;
    end if;

    if v_row.matricula_normalized is not null and v_row.matricula_normalized <> '' then
      select id into v_worker_id
      from public.union_workers
      where delegation_id = v_batch.delegation_id
        and employee_number = v_row.matricula_normalized;
    end if;

    if v_row.is_conflict = true then
      insert into public.union_locker_review_items (
        delegation_id,
        locker_id,
        locker_number,
        source_batch_id,
        source_row_number,
        source_employee_number,
        source_worker_name,
        source_notes,
        reason,
        status,
        metadata,
        created_at,
        updated_at
      ) values (
        v_batch.delegation_id,
        v_locker_id,
        coalesce(v_row.locker_normalized, 'SIN_NUMERO'),
        p_batch_id,
        v_row.row_number,
        v_row.matricula_normalized,
        v_row.worker_name_raw,
        v_row.observations_raw,
        coalesce(v_row.conflict_reason, 'SNAPSHOT_CONFLICT'),
        'pending',
        jsonb_build_object('source_row_id', v_row.id),
        v_now,
        v_now
      );
      v_pending_reviews := v_pending_reviews + 1;
      continue;
    end if;

    if v_locker_id is not null and v_worker_id is not null then
      select * into v_existing_asgn
      from public.union_locker_assignments
      where locker_id = v_locker_id and status = 'active'
      limit 1;

      if found and v_existing_asgn.admin_override = true and v_existing_asgn.worker_id <> v_worker_id then
        v_manual_conflicts := v_manual_conflicts + 1;

        insert into public.union_locker_review_items (
          delegation_id,
          locker_id,
          locker_number,
          source_batch_id,
          source_row_number,
          source_employee_number,
          source_worker_name,
          source_notes,
          reason,
          status,
          metadata,
          created_at,
          updated_at
        ) values (
          v_batch.delegation_id,
          v_locker_id,
          v_row.locker_normalized,
          p_batch_id,
          v_row.row_number,
          v_row.matricula_normalized,
          v_row.worker_name_raw,
          v_row.observations_raw,
          'MANUAL_ASSIGNMENT_CONFLICT',
          'pending',
          jsonb_build_object('manual_worker_id', v_existing_asgn.worker_id),
          v_now,
          v_now
        );
        v_pending_reviews := v_pending_reviews + 1;
        continue;
      end if;

      select * into v_other_asgn
      from public.union_locker_assignments
      where worker_id = v_worker_id and locker_id <> v_locker_id and status = 'active';

      if found then
        update public.union_locker_assignments
        set
          status = 'replaced',
          released_at = v_now,
          released_by_source_batch_id = p_batch_id,
          release_reason = 'Reemplazado por nuevo casillero ' || coalesce(v_row.locker_normalized, '') || ' en snapshot ' || p_batch_id::text
        where id = v_other_asgn.id;

        if not exists (
          select 1 from public.union_locker_assignments
          where locker_id = v_other_asgn.locker_id and status = 'active'
        ) then
          update public.union_lockers set status = 'available', updated_at = v_now where id = v_other_asgn.locker_id;
        end if;

        v_replaced_previous := v_replaced_previous + 1;
      end if;

      if v_existing_asgn.id is not null and v_existing_asgn.worker_id = v_worker_id then
        update public.union_locker_assignments
        set
          last_confirmed_snapshot_batch_id = p_batch_id,
          source = 'excel_snapshot',
          notes = coalesce(v_row.observations_raw, notes),
          updated_at = v_now
        where id = v_existing_asgn.id;
        v_unchanged_assignments := v_unchanged_assignments + 1;
      elsif v_existing_asgn.id is not null and v_existing_asgn.worker_id <> v_worker_id then
        update public.union_locker_assignments
        set
          status = 'replaced',
          released_at = v_now,
          released_by_source_batch_id = p_batch_id,
          release_reason = 'Reemplazado por nuevo ocupante en snapshot ' || p_batch_id::text
        where id = v_existing_asgn.id;

        insert into public.union_locker_assignments (
          locker_id,
          worker_id,
          status,
          source,
          source_batch_id,
          last_confirmed_snapshot_batch_id,
          assigned_at,
          notes,
          admin_override,
          created_at,
          updated_at
        ) values (
          v_locker_id,
          v_worker_id,
          'active',
          'excel_snapshot',
          p_batch_id,
          p_batch_id,
          v_now,
          coalesce(v_row.observations_raw, ''),
          false,
          v_now,
          v_now
        );
        v_locker_changes := v_locker_changes + 1;
      else
        insert into public.union_locker_assignments (
          locker_id,
          worker_id,
          status,
          source,
          source_batch_id,
          last_confirmed_snapshot_batch_id,
          assigned_at,
          notes,
          admin_override,
          created_at,
          updated_at
        ) values (
          v_locker_id,
          v_worker_id,
          'active',
          'excel_snapshot',
          p_batch_id,
          p_batch_id,
          v_now,
          coalesce(v_row.observations_raw, ''),
          false,
          v_now,
          v_now
        );
        v_new_locker_assignments := v_new_locker_assignments + 1;
      end if;

      update public.union_lockers
      set status = 'assigned', updated_at = v_now
      where id = v_locker_id;

    elsif v_locker_id is not null and v_worker_id is null and (v_row.matricula_normalized is null or v_row.matricula_normalized = '') then
      for v_existing_asgn in (
        select * from public.union_locker_assignments
        where locker_id = v_locker_id and status = 'active'
      ) loop
        if v_existing_asgn.admin_override = true then
          v_manual_conflicts := v_manual_conflicts + 1;
        else
          update public.union_locker_assignments
          set
            status = 'cleared',
            released_at = v_now,
            released_by_source_batch_id = p_batch_id,
            release_reason = 'Liberado porque el snapshot indica casillero vacío/disponible'
          where id = v_existing_asgn.id;

          v_cleared_previous := v_cleared_previous + 1;
        end if;
      end loop;

      if not exists (
        select 1 from public.union_locker_assignments
        where locker_id = v_locker_id and status = 'active'
      ) then
        update public.union_lockers set status = 'available', updated_at = v_now where id = v_locker_id;
      end if;
    end if;
  end loop;

  for v_stale_asgn in (
    select a.id, a.locker_id, a.worker_id
    from public.union_locker_assignments a
    join public.union_lockers l on l.id = a.locker_id
    where l.delegation_id = v_batch.delegation_id
      and a.status = 'active'
      and a.admin_override = false
      and a.last_confirmed_snapshot_batch_id is not null
      and a.last_confirmed_snapshot_batch_id <> p_batch_id
  ) loop
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

  -- Desmarcar snapshot vigente previo
  update public.union_worker_import_batches
  set is_latest_snapshot = false
  where delegation_id = v_batch.delegation_id
    and format_version in ('UNION_LOCKERS_V2', 'UNION_LOCKERS_V1', 'UNION_MASTER_LOCKERS_V1')
    and id <> p_batch_id;

  -- Marcar como 'superseded' los items de revisión pendientes de lotes previos
  update public.union_locker_review_items
  set
    status = 'superseded',
    resolved_at = v_now,
    resolution = jsonb_build_object(
      'action', 'superseded_by_snapshot',
      'superseded_by_batch_id', p_batch_id
    ),
    updated_at = v_now
  where delegation_id = v_batch.delegation_id
    and status = 'pending'
    and source_batch_id <> p_batch_id;

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
    'locker_changes_count', v_locker_changes,
    'unchanged_assignments', v_unchanged_assignments,
    'replaced_previous_assignments', v_replaced_previous,
    'cleared_previous_assignments', v_cleared_previous,
    'stale_previous_released', v_stale_released,
    'manual_conflicts', v_manual_conflicts,
    'total_active_assignments', v_total_active,
    'pending_review_count', v_pending_reviews
  );
end;
$$;

-- 4. Actualizar función union_rollback_locker_authoritative_snapshot para revertir superseded
create or replace function public.union_rollback_locker_authoritative_snapshot(
  p_batch_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_batch record;
  v_now timestamptz := now();
  v_asgn record;
  v_restored_assignments integer := 0;
  v_cancelled_reviews integer := 0;
  v_deactivated_workers integer := 0;
begin
  select * into v_batch
  from public.union_worker_import_batches
  where id = p_batch_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Lote no encontrado');
  end if;

  if v_batch.status <> 'confirmed' then
    return jsonb_build_object('success', false, 'error', 'Solo se pueden revertir lotes confirmados');
  end if;

  -- 1. Cancelar asignaciones activas generadas por este lote
  update public.union_locker_assignments
  set
    status = 'cancelled_by_rollback',
    released_at = v_now,
    release_reason = 'Reversión completa de snapshot (Lote ' || p_batch_id::text || ')',
    updated_at = v_now
  where source_batch_id = p_batch_id and status = 'active';

  -- 2. Restaurar asignaciones previas que este lote reemplazó o liberó
  for v_asgn in (
    select * from public.union_locker_assignments
    where released_by_source_batch_id = p_batch_id
  ) loop
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
        released_by_source_batch_id = null,
        release_reason = null,
        updated_at = v_now
      where id = v_asgn.id;

      update public.union_lockers set status = 'assigned', updated_at = v_now where id = v_asgn.locker_id;
      v_restored_assignments := v_restored_assignments + 1;
    end if;
  end loop;

  -- 3. Restaurar snapshot vigente previo y sus pendientes si correspondiera
  if v_batch.supersedes_batch_id is not null then
    update public.union_worker_import_batches
    set is_latest_snapshot = true
    where id = v_batch.supersedes_batch_id;

    update public.union_locker_review_items
    set
      status = 'pending',
      resolved_at = null,
      resolution = null,
      updated_at = v_now
    where source_batch_id = v_batch.supersedes_batch_id
      and status = 'superseded'
      and (resolution->>'superseded_by_batch_id')::uuid = p_batch_id;
  end if;

  -- 4. Inactivación lógica de trabajadores creados exclusivamente por este lote
  update public.union_workers
  set active = false, status_detail = 'rolled_back', updated_at = v_now
  where source = 'locker_excel' and source_batch_id = p_batch_id;

  get diagnostics v_deactivated_workers = row_count;

  -- 5. Cancelar review items pendientes del lote actual
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
    updated_at = v_now
  where id = p_batch_id;

  return jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'status', 'rolled_back',
    'restored_assignments', v_restored_assignments,
    'cancelled_reviews', v_cancelled_reviews,
    'deactivated_workers', v_deactivated_workers
  );
end;
$$;
