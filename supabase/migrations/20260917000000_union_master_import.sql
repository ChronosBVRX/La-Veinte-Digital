-- 20260917000000_union_master_import.sql
-- Migración aditiva: Actualizar base sindical (Conciliación Maestra Trabajadores + Lockers)
-- No destructiva. No añade UNIQUE constraints a union_workers que puedan romper producción.

-- 1. Campos aditivos en public.union_workers
alter table public.union_workers
  add column if not exists position_number text not null default '',
  add column if not exists source_name_raw text not null default '',
  add column if not exists import_notes text not null default '';

create index if not exists union_workers_pos_idx
  on public.union_workers (delegation_id, position_number);

-- 2. Tabla de lotes de importación maestra (union_import_batches)
create table if not exists public.union_import_batches (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  filename text not null,
  file_hash text not null,
  uploaded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  status text not null default 'preview' check (status in ('preview', 'applied', 'failed', 'cancelled')),
  total_rows integer not null default 0,
  new_workers integer not null default 0,
  updated_workers integer not null default 0,
  unchanged_workers integer not null default 0,
  conflicts integer not null default 0,
  invalid_rows integer not null default 0,
  new_lockers integer not null default 0,
  locker_changes integer not null default 0,
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists union_import_batches_del_idx
  on public.union_import_batches (delegation_id, created_at desc);
create index if not exists union_import_batches_hash_idx
  on public.union_import_batches (delegation_id, file_hash);

-- 3. Tabla de filas de staging de importación maestra (union_import_rows)
create table if not exists public.union_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.union_import_batches (id) on delete cascade,
  row_number integer not null,
  matricula text not null default '',
  raw_name text not null default '',
  category text not null default '',
  turn text not null default '',
  schedule text not null default '',
  position_number text not null default '',
  locker_number text not null default '',
  row_status text not null check (row_status in ('new', 'update', 'unchanged', 'conflict', 'invalid', 'ignored')),
  action_taken text not null default 'pending' check (action_taken in ('pending', 'applied', 'skipped', 'conflict_resolved')),
  worker_id uuid references public.union_workers (id) on delete set null,
  locker_id uuid references public.union_lockers (id) on delete set null,
  diff jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  resolutions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists union_import_rows_batch_idx
  on public.union_import_rows (batch_id, row_number);
create index if not exists union_import_rows_status_idx
  on public.union_import_rows (batch_id, row_status);

-- 4. RLS y Políticas de Seguridad
alter table public.union_import_batches enable row level security;
alter table public.union_import_rows enable row level security;

-- union_import_batches: union_rep y union_admin pueden leer; solo union_admin puede insertar/modificar
drop policy if exists "union_import_batches_select" on public.union_import_batches;
create policy "union_import_batches_select"
  on public.union_import_batches for select to authenticated
  using (public.union_is_member(delegation_id));

drop policy if exists "union_import_batches_admin_write" on public.union_import_batches;
create policy "union_import_batches_admin_write"
  on public.union_import_batches for all to authenticated
  using (public.union_is_admin(delegation_id))
  with check (public.union_is_admin(delegation_id));

-- union_import_rows: visibilidad según delegación del lote
drop policy if exists "union_import_rows_select" on public.union_import_rows;
create policy "union_import_rows_select"
  on public.union_import_rows for select to authenticated
  using (exists (
    select 1 from public.union_import_batches b
    where b.id = batch_id and public.union_is_member(b.delegation_id)
  ));

drop policy if exists "union_import_rows_admin_write" on public.union_import_rows;
create policy "union_import_rows_admin_write"
  on public.union_import_rows for all to authenticated
  using (exists (
    select 1 from public.union_import_batches b
    where b.id = batch_id and public.union_is_admin(b.delegation_id)
  ))
  with check (exists (
    select 1 from public.union_import_batches b
    where b.id = batch_id and public.union_is_admin(b.delegation_id)
  ));

-- 5. RPC Transaccional Atómica para Aplicar la Importación Maestra
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
  v_existing_worker record;
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
begin
  -- 1. Bloquear y verificar el lote
  select * into v_batch
  from public.union_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'BATCH_NOT_FOUND: Lote % no encontrado.', p_batch_id;
  end if;

  -- 2. Permiso estricto de union_admin
  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: Se requiere rol union_admin en esta delegación.';
  end if;

  -- 3. Estado debe ser preview
  if v_batch.status <> 'preview' then
    raise exception 'INVALID_BATCH_STATUS: El lote se encuentra en estado "%" y no puede ser aplicado.', v_batch.status;
  end if;

  -- 4. Iterar sobre las filas de staging
  for v_row in
    select *
    from public.union_import_rows
    where batch_id = p_batch_id
    order by row_number asc
  loop
    -- Comprobar si hay resoluciones pasadas en p_resolutions o guardadas en la fila
    v_resolution := coalesce(p_resolutions->(v_row.row_number::text), v_row.resolutions);
    v_res_action := coalesce(v_resolution->>'action', 'default');

    -- Manejo de filas inválidas o ignoradas
    if v_row.row_status in ('invalid', 'ignored') then
      update public.union_import_rows
      set action_taken = 'skipped'
      where id = v_row.id;
      continue;
    end if;

    -- Manejo de conflictos
    if v_row.row_status = 'conflict' then
      if v_res_action = 'skip' or v_res_action = 'omit' then
        v_skipped_conflicts := v_skipped_conflicts + 1;
        update public.union_import_rows
        set action_taken = 'skipped', resolutions = v_resolution
        where id = v_row.id;
        continue;
      elsif v_res_action <> 'resolve' then
        raise exception 'UNRESOLVED_CONFLICT: La fila % presenta un conflicto no resuelto ni omitido.', v_row.row_number;
      end if;
    end if;

    -- Conciliación del trabajador por delegation_id + employee_number
    select * into v_existing_worker
    from public.union_workers
    where delegation_id = v_batch.delegation_id
      and employee_number = v_row.matricula
    limit 1;

    if not found then
      -- Trabajador Nuevo
      v_first_name := coalesce(v_row.diff->>'first_name', '');
      v_paternal := coalesce(v_row.diff->>'paternal_surname', '');
      v_maternal := coalesce(v_row.diff->>'maternal_surname', '');

      insert into public.union_workers (
        delegation_id,
        employee_number,
        first_name,
        paternal_surname,
        maternal_surname,
        source_name_raw,
        category,
        turn,
        schedule,
        position_number,
        plaza_code,
        import_notes,
        active,
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
        v_row.raw_name,
        v_row.category,
        v_row.turn,
        v_row.schedule,
        v_row.position_number,
        v_row.position_number,
        coalesce(v_row.diff->>'import_notes', ''),
        true,
        auth.uid(),
        auth.uid(),
        v_now,
        v_now
      ) returning id into v_worker_id;

      v_applied_workers := v_applied_workers + 1;
    else
      -- Trabajador Existente
      v_worker_id := v_existing_worker.id;

      if v_row.row_status in ('update', 'conflict') then
        -- Aplicar actualizaciones respetando resoluciones si existen
        update public.union_workers
        set
          category = case when v_resolution->>'category' = 'keep' then category else coalesce(nullif(v_row.category, ''), category) end,
          turn = case when v_resolution->>'turn' = 'keep' then turn else coalesce(nullif(v_row.turn, ''), turn) end,
          schedule = case when v_resolution->>'schedule' = 'keep' then schedule else coalesce(nullif(v_row.schedule, ''), schedule) end,
          position_number = case when v_resolution->>'position_number' = 'keep' then position_number else coalesce(nullif(v_row.position_number, ''), position_number) end,
          plaza_code = case when v_resolution->>'position_number' = 'keep' then plaza_code else coalesce(nullif(v_row.position_number, ''), plaza_code) end,
          source_name_raw = case when source_name_raw = '' then v_row.raw_name else source_name_raw end,
          import_notes = coalesce(nullif(v_row.diff->>'import_notes', ''), import_notes),
          updated_by = auth.uid(),
          updated_at = v_now
        where id = v_worker_id;

        v_updated_workers := v_updated_workers + 1;
      else
        v_unchanged_workers := v_unchanged_workers + 1;
      end if;
    end if;

    -- Conciliación de Casillero / Locker (si la fila tiene un número de casillero válido)
    v_norm_locker := trim(v_row.locker_number);
    if v_norm_locker <> '' and v_norm_locker !~ '^(S/N|DE PASO|VACIO|ABRIR|ABIERTO|JUBILADO)$' then
      -- Asegurar existencia del casillero en union_lockers
      select id into v_locker_id
      from public.union_lockers
      where delegation_id = v_batch.delegation_id
        and locker_number = v_norm_locker;

      if not found then
        insert into public.union_lockers (
          delegation_id,
          locker_number,
          status,
          notes,
          created_at,
          updated_at
        ) values (
          v_batch.delegation_id,
          v_norm_locker,
          'available',
          'Creado mediante importación maestra de base sindical',
          v_now,
          v_now
        ) returning id into v_locker_id;
      end if;

      -- Verificar si el trabajador ya tiene asignación activa
      select id, locker_id into v_active_assignment
      from public.union_locker_assignments
      where worker_id = v_worker_id
        and status = 'active'
      limit 1;

      if not found then
        -- Nueva asignación para el trabajador
        -- Si estaba ocupado por otro trabajador, se libera con motivo auditado
        if exists (
          select 1 from public.union_locker_assignments
          where locker_id = v_locker_id and status = 'active'
        ) then
          update public.union_locker_assignments
          set status = 'released',
              released_at = v_now,
              release_reason = 'Reasignación por importación maestra'
          where locker_id = v_locker_id and status = 'active';
        end if;

        insert into public.union_locker_assignments (
          locker_id,
          worker_id,
          assigned_at,
          status,
          assignment_reason,
          created_by,
          created_at
        ) values (
          v_locker_id,
          v_worker_id,
          v_now,
          'active',
          'Asignado en importación maestra de base sindical',
          auth.uid(),
          v_now
        );

        update public.union_lockers
        set status = 'assigned', updated_at = v_now
        where id = v_locker_id;

        v_new_locker_assignments := v_new_locker_assignments + 1;
      elsif v_active_assignment.locker_id <> v_locker_id then
        -- Cambio de locker (e.g. 284 -> 320)
        v_prev_locker_id := v_active_assignment.locker_id;

        -- 1. Cerrar asignación anterior
        update public.union_locker_assignments
        set status = 'released',
            released_at = v_now,
            release_reason = 'Reasignación por actualización de base sindical'
        where id = v_active_assignment.id;

        -- 2. Liberar locker anterior si no tiene otras asignaciones activas
        if not exists (
          select 1 from public.union_locker_assignments
          where locker_id = v_prev_locker_id and status = 'active'
        ) then
          update public.union_lockers
          set status = 'available', updated_at = v_now
          where id = v_prev_locker_id;
        end if;

        -- 3. Crear nueva asignación
        insert into public.union_locker_assignments (
          locker_id,
          worker_id,
          assigned_at,
          status,
          assignment_reason,
          created_by,
          created_at
        ) values (
          v_locker_id,
          v_worker_id,
          v_now,
          'active',
          'Cambio de locker por actualización de base sindical',
          auth.uid(),
          v_now
        );

        -- 4. Marcar nuevo locker como assigned
        update public.union_lockers
        set status = 'assigned', updated_at = v_now
        where id = v_locker_id;

        v_locker_changes := v_locker_changes + 1;
      end if;
    end if;

    -- Actualizar staging row
    update public.union_import_rows
    set action_taken = case when v_row.row_status = 'conflict' then 'conflict_resolved' else 'applied' end,
        worker_id = v_worker_id,
        locker_id = v_locker_id,
        resolutions = v_resolution
    where id = v_row.id;
  end loop;

  -- 5. Actualizar estado del lote a applied
  update public.union_import_batches
  set status = 'applied',
      applied_at = v_now,
      new_workers = v_applied_workers,
      updated_workers = v_updated_workers,
      unchanged_workers = v_unchanged_workers,
      locker_changes = v_locker_changes
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'applied',
    'applied_workers', v_applied_workers,
    'updated_workers', v_updated_workers,
    'unchanged_workers', v_unchanged_workers,
    'new_locker_assignments', v_new_locker_assignments,
    'locker_changes', v_locker_changes,
    'skipped_conflicts', v_skipped_conflicts
  );
end;
$$;
