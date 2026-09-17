-- 20260919000000_union_locker_review_items.sql
-- Migración aditiva: Modelo persistente de incidencias de casilleros (union_locker_review_items)
-- Permite la importación progresiva no destructiva: todo casillero físico se inventaría de inmediato,
-- las asignaciones inequívocas se aplican, y los registros dudosos o con personas fuera de padrón
-- se guardan como pendientes de revisión sin inventar ni modificar registros en union_workers.

-- 1. Tabla de Pendientes de Revisión de Casilleros
create table if not exists public.union_locker_review_items (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  locker_id uuid references public.union_lockers (id) on delete set null,
  locker_number text not null,
  source_batch_id uuid not null references public.union_worker_import_batches (id) on delete cascade,
  source_row_number integer,
  source_employee_number text,
  source_worker_name text,
  source_notes text,
  reason text not null, -- WORKER_NOT_FOUND, LOCKER_MULTIPLE_WORKERS, WORKER_MULTIPLE_LOCKERS, LOCKER_ALREADY_ASSIGNED, etc.
  status text not null default 'pending', -- pending, resolved, ignored, cancelled_by_rollback
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolution jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Check constraint para status en union_locker_review_items
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'union_locker_review_items_status_check'
  ) then
    alter table public.union_locker_review_items
      add constraint union_locker_review_items_status_check
      check (status in ('pending', 'resolved', 'ignored', 'cancelled_by_rollback'));
  end if;
end $$;

-- Asegurar que union_lockers acepte tanto 'available'/'assigned' como 'disponible'/'ocupado'
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'union_lockers_status_check'
  ) then
    alter table public.union_lockers drop constraint union_lockers_status_check;
  end if;
  alter table public.union_lockers
    add constraint union_lockers_status_check
    check (status in ('available', 'assigned', 'reserved', 'maintenance', 'blocked', 'disponible', 'ocupado'));
end $$;

-- Asegurar que union_worker_import_rows acepte 'pending_review'
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'union_worker_import_rows_action_taken_check'
  ) then
    alter table public.union_worker_import_rows drop constraint union_worker_import_rows_action_taken_check;
  end if;
  alter table public.union_worker_import_rows
    add constraint union_worker_import_rows_action_taken_check
    check (action_taken in ('pending', 'applied', 'skipped', 'conflict_hold', 'pending_review'));
end $$;

-- 2. Columna aditiva en public.union_worker_import_batches
alter table public.union_worker_import_batches
  add column if not exists pending_review_count integer not null default 0;

-- 3. Índices de rendimiento y aislamiento
create index if not exists union_locker_review_items_delegation_status_idx
  on public.union_locker_review_items (delegation_id, status);

create index if not exists union_locker_review_items_batch_idx
  on public.union_locker_review_items (source_batch_id);

create index if not exists union_locker_review_items_emp_no_idx
  on public.union_locker_review_items (delegation_id, source_employee_number);

-- 4. Seguridad RLS
alter table public.union_locker_review_items enable row level security;

drop policy if exists "union_locker_review_items_member_read" on public.union_locker_review_items;
create policy "union_locker_review_items_member_read"
  on public.union_locker_review_items for select to authenticated
  using (public.union_is_member(delegation_id));

drop policy if exists "union_locker_review_items_admin_write" on public.union_locker_review_items;
create policy "union_locker_review_items_admin_write"
  on public.union_locker_review_items for all to authenticated
  using (public.union_is_admin(delegation_id))
  with check (public.union_is_admin(delegation_id));

-- 5. RPC Actualizada para Aplicar Importación de Casilleros con Guardado de Pendientes
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
  v_pending_reviews integer := 0;
  v_now timestamptz := clock_timestamp();
  v_resolution jsonb;
  v_res_action text;
  v_norm_locker text;
  v_is_semantic boolean;
  v_conflict_code text;
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
    -- Comprobar si hay resolución manual explícita enviada por el usuario
    v_resolution := p_resolutions -> (v_row.row_number::text);
    v_res_action := coalesce(v_resolution ->> 'action', '');

    if v_res_action = 'skip' then
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

    v_norm_locker := coalesce(v_row.parsed_data->>'locker', '');
    v_is_semantic := coalesce((v_row.parsed_data->>'is_semantic_locker')::boolean, false);

    -- Si no hay casillero o es semántico no físico, omitir asignación
    if v_norm_locker = '' or v_is_semantic then
      update public.union_worker_import_rows
      set action_taken = 'skipped'
      where id = v_row.id;
      continue;
    end if;

    -- INVENTARIO DE CASILLEROS: Asegurar que el casillero físico exista
    insert into public.union_lockers (
      delegation_id,
      locker_number,
      status,
      notes
    ) values (
      v_batch.delegation_id,
      v_norm_locker,
      'available',
      'Registrado por importación de casilleros'
    )
    on conflict (delegation_id, locker_number) do nothing;

    select id into v_locker_id
    from public.union_lockers
    where delegation_id = v_batch.delegation_id
      and locker_number = v_norm_locker;

    -- Buscar si el trabajador existe en el padrón por matrícula (SOLO LECTURA)
    v_existing_worker := null;
    if coalesce(v_row.matricula, '') <> '' then
      select * into v_existing_worker
      from public.union_workers
      where delegation_id = v_batch.delegation_id
        and employee_number = v_row.matricula;
    end if;

    -- CASO A: TRABAJADOR NO ENCONTRADO EN EL PADRÓN
    if v_existing_worker is null then
      -- REGLA DE ORO: Jamás inventar trabajador. Conservar casillero e insertar pendiente.
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
        metadata
      ) values (
        v_batch.delegation_id,
        v_locker_id,
        v_norm_locker,
        p_batch_id,
        v_row.row_number,
        v_row.matricula,
        coalesce(v_row.parsed_data->>'nombre', v_row.full_name),
        v_row.parsed_data->>'observaciones',
        'WORKER_NOT_FOUND',
        'pending',
        jsonb_build_object(
          'excel_row_number', v_row.row_number,
          'raw_nombre', coalesce(v_row.parsed_data->>'nombre', v_row.full_name),
          'raw_matricula', v_row.matricula,
          'raw_locker', v_norm_locker
        )
      );

      update public.union_worker_import_rows
      set action_taken = 'pending_review'
      where id = v_row.id;

      v_pending_reviews := v_pending_reviews + 1;
      continue;
    end if;

    v_worker_id := v_existing_worker.id;

    -- CASO B: FILA CON CONFLICTO / INCONSISTENCIA
    if v_row.row_status = 'conflict' then
      v_conflict_code := coalesce(v_row.parsed_data->>'conflict_reason_code', 'NEEDS_REVIEW');
      
      -- Guardar como pendiente de revisión. CERO asignaciones dudosas.
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
        metadata
      ) values (
        v_batch.delegation_id,
        v_locker_id,
        v_norm_locker,
        p_batch_id,
        v_row.row_number,
        v_row.matricula,
        coalesce(v_row.parsed_data->>'nombre', v_row.full_name),
        v_row.parsed_data->>'observaciones',
        v_conflict_code,
        'pending',
        jsonb_build_object(
          'excel_row_number', v_row.row_number,
          'conflict_code', v_conflict_code,
          'issues', v_row.issues,
          'raw_nombre', coalesce(v_row.parsed_data->>'nombre', v_row.full_name),
          'raw_matricula', v_row.matricula,
          'raw_locker', v_norm_locker
        )
      );

      update public.union_worker_import_rows
      set action_taken = 'pending_review'
      where id = v_row.id;

      v_pending_reviews := v_pending_reviews + 1;
      continue;
    end if;

    -- CASO C: ASIGNACIÓN SEGURA E INEQUÍVOCA (Trabajador existente, sin conflicto)
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

      update public.union_lockers
      set status = 'assigned'
      where id = v_locker_id;

      v_new_locker_assignments := v_new_locker_assignments + 1;
    elsif v_active_assignment.locker_id <> v_locker_id then
      -- REASIGNACIÓN SEGURA
      v_prev_locker_id := v_active_assignment.locker_id;

      update public.union_locker_assignments
      set
        status = 'released',
        released_at = v_now,
        release_reason = 'released_by_import_locker_batch:' || p_batch_id::text
      where id = v_active_assignment.id;

      if not exists (
        select 1 from public.union_locker_assignments
        where locker_id = v_prev_locker_id and status = 'active'
      ) then
        update public.union_lockers
        set status = 'available'
        where id = v_prev_locker_id;
      end if;

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

      update public.union_lockers
      set status = 'assigned'
      where id = v_locker_id;

      v_locker_changes := v_locker_changes + 1;
    end if;

    update public.union_worker_import_rows
    set action_taken = 'applied', target_worker_id = v_worker_id
    where id = v_row.id;
  end loop;

  -- 6. Finalizar lote en union_worker_import_batches (CERO trabajadores creados/modificados)
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
    pending_review_count = v_pending_reviews,
    summary_metadata = summary_metadata || jsonb_build_object(
      'pending_review_count', v_pending_reviews,
      'applied_assignments', v_new_locker_assignments + v_locker_changes,
      'skipped_count', v_skipped_conflicts
    ),
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
    'pending_review_count', v_pending_reviews,
    'skipped_conflicts', v_skipped_conflicts
  );
end;
$$;

-- 6. RPC Actualizada para Rollback de Importación de Casilleros con Cancelación de Pendientes
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
  v_cancelled_reviews integer := 0;
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

  if v_batch.format_version not in ('UNION_LOCKERS_V1', 'UNION_MASTER_LOCKERS_V1') then
    raise exception 'INVALID_FORMAT_VERSION: Este lote no corresponde a una importación de casilleros (formato actual: "%").', v_batch.format_version;
  end if;

  if v_batch.status = 'rolled_back' then
    raise exception 'BATCH_ALREADY_ROLLED_BACK: El lote % ya fue revertido previamente.', p_batch_id;
  end if;

  if v_batch.status <> 'confirmed' then
    raise exception 'INVALID_BATCH_STATUS_FOR_ROLLBACK: Solo se pueden revertir lotes confirmados. Estado actual: "%".', v_batch.status;
  end if;

  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: No cuentas con permisos de union_admin en la delegación %.', v_batch.delegation_id;
  end if;

  -- 2. Verificar modificaciones posteriores conflictivas en casilleros
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

  -- 3. Revertir asignaciones creadas por este lote
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
      set status = 'available'
      where id = v_assignment.locker_id;
    end if;

    v_reverted_assignments := v_reverted_assignments + 1;
  end loop;

  -- 4. Restaurar asignaciones liberadas por este lote
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
    set status = 'assigned'
    where id = v_assignment.locker_id;

    v_restored_assignments := v_restored_assignments + 1;
  end loop;

  -- 5. Manejar pendientes de revisión: marcar como cancelados por rollback
  update public.union_locker_review_items
  set
    status = 'cancelled_by_rollback',
    updated_at = v_now
  where source_batch_id = p_batch_id
    and status = 'pending';

  get diagnostics v_cancelled_reviews = row_count;

  -- 6. Actualizar estado del lote
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
    'cancelled_review_items', v_cancelled_reviews,
    'deactivated_workers', 0,
    'restored_fields', 0
  );
end;
$$;
