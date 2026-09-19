-- 20260919100000_union_lockers_v2.sql
-- Lockers 2.0: Modelo de Inventario Físico (Zonas, Bloques, Auditorías Físicas y RPCs Atómicas)
-- Delegación XXI (SNTSS Sección XX · HGR No. 1 Charo)

-- 1. Zonas Físicas de Casilleros
create table if not exists public.union_locker_zones (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  name text not null,
  description text not null default '',
  building text not null default '',
  floor text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  unique (delegation_id, name)
);

create index if not exists union_locker_zones_delegation_idx
  on public.union_locker_zones (delegation_id, sort_order);

-- 2. Bloques / Muebles Físicos de Casilleros
create table if not exists public.union_locker_banks (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  zone_id uuid not null references public.union_locker_zones (id) on delete cascade,
  name text not null,
  description text not null default '',
  rows integer not null default 1 check (rows > 0),
  columns integer not null default 1 check (columns > 0),
  sort_order integer not null default 0,
  orientation text not null default 'horizontal',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  unique (zone_id, name)
);

create index if not exists union_locker_banks_zone_idx
  on public.union_locker_banks (zone_id, sort_order);
create index if not exists union_locker_banks_delegation_idx
  on public.union_locker_banks (delegation_id);

-- 3. Columnas Aditivas en union_lockers
alter table public.union_lockers
  add column if not exists zone_id uuid references public.union_locker_zones (id) on delete set null,
  add column if not exists bank_id uuid references public.union_locker_banks (id) on delete set null,
  add column if not exists row_position integer check (row_position is null or row_position > 0),
  add column if not exists column_position integer check (column_position is null or column_position > 0),
  add column if not exists position_label text,
  add column if not exists sort_order integer default 0,
  add column if not exists physical_code text,
  add column if not exists condition text not null default 'ok',
  add column if not exists maintenance_reason text not null default '',
  add column if not exists maintenance_notes text not null default '',
  add column if not exists maintenance_date timestamptz,
  add column if not exists reserved_for_worker_id uuid references public.union_workers (id) on delete set null,
  add column if not exists reservation_reason text not null default '',
  add column if not exists reserved_until timestamptz;

-- Constraint para condition en union_lockers
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_lockers'::regclass and conname = 'union_lockers_condition_check'
  ) then
    alter table public.union_lockers add constraint union_lockers_condition_check
      check (condition in ('ok', 'maintenance', 'blocked'));
  end if;
end $$;

-- Índices de posición en bloques
create index if not exists union_lockers_bank_pos_idx
  on public.union_lockers (bank_id, row_position, column_position)
  where bank_id is not null;
create index if not exists union_lockers_zone_idx
  on public.union_lockers (zone_id);

-- 4. Auditorías Físicas / Recorridos
create table if not exists public.union_locker_audits (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  zone_id uuid references public.union_locker_zones (id) on delete set null,
  bank_id uuid references public.union_locker_banks (id) on delete set null,
  started_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled')),
  notes text not null default '',
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists union_locker_audits_delegation_idx
  on public.union_locker_audits (delegation_id, started_at desc);

create table if not exists public.union_locker_audit_items (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.union_locker_audits (id) on delete cascade,
  locker_id uuid not null references public.union_lockers (id) on delete cascade,
  expected_assignment_id uuid references public.union_locker_assignments (id) on delete set null,
  result text not null check (result in ('matches', 'physically_empty', 'different_person', 'damaged', 'unverified')),
  observed_worker_id uuid references public.union_workers (id) on delete set null,
  notes text not null default '',
  verified_at timestamptz not null default now(),
  verified_by uuid references auth.users (id) on delete set null
);

create index if not exists union_locker_audit_items_audit_idx
  on public.union_locker_audit_items (audit_id);
create index if not exists union_locker_audit_items_locker_idx
  on public.union_locker_audit_items (locker_id);

-- 5. Seguridad Row-Level Security (RLS)
alter table public.union_locker_zones enable row level security;
alter table public.union_locker_banks enable row level security;
alter table public.union_locker_audits enable row level security;
alter table public.union_locker_audit_items enable row level security;

-- Policies para Zonas
drop policy if exists "union_locker_zones_member_read" on public.union_locker_zones;
create policy "union_locker_zones_member_read"
  on public.union_locker_zones for select to authenticated
  using (public.union_is_member(delegation_id));

drop policy if exists "union_locker_zones_admin_write" on public.union_locker_zones;
create policy "union_locker_zones_admin_write"
  on public.union_locker_zones for all to authenticated
  using (public.union_is_admin(delegation_id))
  with check (public.union_is_admin(delegation_id));

-- Policies para Bloques
drop policy if exists "union_locker_banks_member_read" on public.union_locker_banks;
create policy "union_locker_banks_member_read"
  on public.union_locker_banks for select to authenticated
  using (public.union_is_member(delegation_id));

drop policy if exists "union_locker_banks_admin_write" on public.union_locker_banks;
create policy "union_locker_banks_admin_write"
  on public.union_locker_banks for all to authenticated
  using (public.union_is_admin(delegation_id))
  with check (public.union_is_admin(delegation_id));

-- Policies para Auditorías
drop policy if exists "union_locker_audits_member_read" on public.union_locker_audits;
create policy "union_locker_audits_member_read"
  on public.union_locker_audits for select to authenticated
  using (public.union_is_member(delegation_id));

drop policy if exists "union_locker_audits_member_insert" on public.union_locker_audits;
create policy "union_locker_audits_member_insert"
  on public.union_locker_audits for insert to authenticated
  with check (public.union_is_member(delegation_id));

drop policy if exists "union_locker_audits_member_update" on public.union_locker_audits;
create policy "union_locker_audits_member_update"
  on public.union_locker_audits for update to authenticated
  using (public.union_is_member(delegation_id))
  with check (public.union_is_member(delegation_id));

-- Policies para Items de Auditoría
drop policy if exists "union_locker_audit_items_member_read" on public.union_locker_audit_items;
create policy "union_locker_audit_items_member_read"
  on public.union_locker_audit_items for select to authenticated
  using (
    exists (
      select 1 from public.union_locker_audits a
      where a.id = audit_id and public.union_is_member(a.delegation_id)
    )
  );

drop policy if exists "union_locker_audit_items_member_write" on public.union_locker_audit_items;
create policy "union_locker_audit_items_member_write"
  on public.union_locker_audit_items for all to authenticated
  using (
    exists (
      select 1 from public.union_locker_audits a
      where a.id = audit_id and public.union_is_member(a.delegation_id)
    )
  )
  with check (
    exists (
      select 1 from public.union_locker_audits a
      where a.id = audit_id and public.union_is_member(a.delegation_id)
    )
  );

-- 6. RPCs Transaccionales Atómicas (Concurrencia Segura y Zero Estado Parcial)

-- A. Asignación Atómica
create or replace function public.union_assign_locker(
  p_locker_id uuid,
  p_worker_id uuid,
  p_assignment_reason text default '',
  p_admin_override boolean default false,
  p_admin_override_reason text default '',
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_locker record;
  v_worker record;
  v_existing_worker_asg record;
  v_existing_locker_asg record;
  v_new_assignment_id uuid;
begin
  -- 1. Bloquear casillero FOR UPDATE para concurrencia estricta
  select * into v_locker
  from public.union_lockers
  where id = p_locker_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Locker no encontrado');
  end if;

  if v_locker.condition in ('maintenance', 'blocked') then
    return jsonb_build_object('success', false, 'error', 'El casillero se encuentra en mantenimiento o bloqueado');
  end if;

  if v_locker.status not in ('available', 'reserved', 'disponible') then
    return jsonb_build_object('success', false, 'error', 'Este casillero ya se encuentra asignado');
  end if;

  -- 2. Verificar que no exista asignación activa en este locker
  select id into v_existing_locker_asg
  from public.union_locker_assignments
  where locker_id = p_locker_id and status = 'active'
  limit 1;

  if found then
    return jsonb_build_object('success', false, 'error', 'El casillero ya tiene una asignación activa en el sistema');
  end if;

  -- 3. Validar trabajador
  select id, delegation_id, first_name, paternal_surname, maternal_surname, employee_number into v_worker
  from public.union_workers
  where id = p_worker_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Trabajador no encontrado en el padrón');
  end if;

  if v_worker.delegation_id <> v_locker.delegation_id then
    return jsonb_build_object('success', false, 'error', 'El trabajador y el casillero pertenecen a delegaciones distintas');
  end if;

  -- 4. Verificar si el trabajador ya tiene otro locker activo
  select a.id, l.locker_number into v_existing_worker_asg
  from public.union_locker_assignments a
  join public.union_lockers l on l.id = a.locker_id
  where a.worker_id = p_worker_id and a.status = 'active'
  limit 1;

  if found and not p_admin_override then
    return jsonb_build_object(
      'success', false,
      'error', 'El trabajador ya tiene asignado el casillero #' || v_existing_worker_asg.locker_number || '. Se requiere autorización administrativa con motivo.'
    );
  end if;

  -- 5. Crear la asignación
  insert into public.union_locker_assignments (
    locker_id,
    worker_id,
    assigned_at,
    status,
    assignment_reason,
    admin_override,
    admin_override_reason,
    created_by
  ) values (
    p_locker_id,
    p_worker_id,
    now(),
    'active',
    coalesce(p_assignment_reason, ''),
    coalesce(p_admin_override, false),
    coalesce(p_admin_override_reason, ''),
    p_created_by
  ) returning id into v_new_assignment_id;

  -- 6. Actualizar estado del casillero
  update public.union_lockers
  set
    status = 'assigned',
    reserved_for_worker_id = null,
    reservation_reason = '',
    reserved_until = null,
    updated_at = now()
  where id = p_locker_id;

  -- 7. Registrar auditoría
  insert into public.union_audit_log (
    delegation_id,
    user_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    v_locker.delegation_id,
    p_created_by,
    'locker.assigned',
    'union_locker',
    p_locker_id,
    jsonb_build_object(
      'locker_number', v_locker.locker_number,
      'worker_id', p_worker_id,
      'employee_number', v_worker.employee_number,
      'worker_name', trim(coalesce(v_worker.first_name, '') || ' ' || coalesce(v_worker.paternal_surname, '')),
      'admin_override', p_admin_override,
      'assignment_id', v_new_assignment_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'assignment_id', v_new_assignment_id,
    'locker_number', v_locker.locker_number
  );
end;
$$;

-- B. Liberación Atómica
create or replace function public.union_release_locker(
  p_assignment_id uuid,
  p_release_reason text default 'Liberación ordinaria',
  p_released_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asg record;
  v_locker record;
begin
  -- 1. Bloquear asignación FOR UPDATE
  select * into v_asg
  from public.union_locker_assignments
  where id = p_assignment_id and status = 'active'
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Asignación activa no encontrada');
  end if;

  -- 2. Bloquear locker FOR UPDATE
  select * into v_locker
  from public.union_lockers
  where id = v_asg.locker_id
  for update;

  -- 3. Marcar liberada la asignación
  update public.union_locker_assignments
  set
    status = 'released',
    released_at = now(),
    release_reason = coalesce(p_release_reason, 'Liberación')
  where id = p_assignment_id;

  -- 4. Poner casillero en disponible (respetando su condición física)
  update public.union_lockers
  set
    status = 'available',
    updated_at = now()
  where id = v_asg.locker_id;

  -- 5. Registrar auditoría
  insert into public.union_audit_log (
    delegation_id,
    user_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    v_locker.delegation_id,
    p_released_by,
    'locker.released',
    'union_locker',
    v_asg.locker_id,
    jsonb_build_object(
      'locker_number', v_locker.locker_number,
      'assignment_id', p_assignment_id,
      'worker_id', v_asg.worker_id,
      'release_reason', p_release_reason
    )
  );

  return jsonb_build_object(
    'success', true,
    'locker_number', v_locker.locker_number
  );
end;
$$;

-- C. Mover Trabajador de Casillero Atómicamente
create or replace function public.union_move_locker_assignment(
  p_from_locker_id uuid,
  p_to_locker_id uuid,
  p_move_reason text default 'Reubicación de casillero',
  p_moved_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from_locker record;
  v_to_locker record;
  v_from_asg record;
  v_new_asg_id uuid;
  v_first_id uuid;
  v_second_id uuid;
begin
  if p_from_locker_id = p_to_locker_id then
    return jsonb_build_object('success', false, 'error', 'El casillero de origen y destino son el mismo');
  end if;

  -- Prevención estricta de deadlock ordenando los locks por ID
  if p_from_locker_id < p_to_locker_id then
    v_first_id := p_from_locker_id;
    v_second_id := p_to_locker_id;
  else
    v_first_id := p_to_locker_id;
    v_second_id := p_from_locker_id;
  end if;

  perform 1 from public.union_lockers where id = v_first_id for update;
  perform 1 from public.union_lockers where id = v_second_id for update;

  select * into v_from_locker from public.union_lockers where id = p_from_locker_id;
  select * into v_to_locker from public.union_lockers where id = p_to_locker_id;

  if not found or v_to_locker.id is null then
    return jsonb_build_object('success', false, 'error', 'Uno de los casilleros no existe');
  end if;

  if v_to_locker.condition in ('maintenance', 'blocked') then
    return jsonb_build_object('success', false, 'error', 'El casillero destino se encuentra en mantenimiento o bloqueado');
  end if;

  if v_to_locker.status not in ('available', 'disponible') then
    return jsonb_build_object('success', false, 'error', 'El casillero destino #' || v_to_locker.locker_number || ' no está disponible');
  end if;

  -- Obtener asignación activa del origen
  select * into v_from_asg
  from public.union_locker_assignments
  where locker_id = p_from_locker_id and status = 'active'
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'El casillero origen #' || v_from_locker.locker_number || ' no tiene una asignación activa');
  end if;

  -- 1. Liberar asignación origen
  update public.union_locker_assignments
  set
    status = 'released',
    released_at = now(),
    release_reason = 'Reubicado a locker #' || v_to_locker.locker_number || ' (' || coalesce(p_move_reason, '') || ')'
  where id = v_from_asg.id;

  update public.union_lockers
  set status = 'available', updated_at = now()
  where id = p_from_locker_id;

  -- 2. Crear asignación destino
  insert into public.union_locker_assignments (
    locker_id,
    worker_id,
    assigned_at,
    status,
    assignment_reason,
    admin_override,
    admin_override_reason,
    created_by
  ) values (
    p_to_locker_id,
    v_from_asg.worker_id,
    now(),
    'active',
    'Reubicado desde locker #' || v_from_locker.locker_number || ' (' || coalesce(p_move_reason, '') || ')',
    v_from_asg.admin_override,
    v_from_asg.admin_override_reason,
    p_moved_by
  ) returning id into v_new_asg_id;

  update public.union_lockers
  set status = 'assigned', updated_at = now()
  where id = p_to_locker_id;

  -- 3. Auditoría
  insert into public.union_audit_log (
    delegation_id,
    user_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    v_from_locker.delegation_id,
    p_moved_by,
    'locker.moved',
    'union_locker',
    p_to_locker_id,
    jsonb_build_object(
      'from_locker_number', v_from_locker.locker_number,
      'to_locker_number', v_to_locker.locker_number,
      'worker_id', v_from_asg.worker_id,
      'reason', p_move_reason,
      'old_assignment_id', v_from_asg.id,
      'new_assignment_id', v_new_asg_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'from_locker_number', v_from_locker.locker_number,
    'to_locker_number', v_to_locker.locker_number,
    'new_assignment_id', v_new_asg_id
  );
end;
$$;

-- D. Intercambiar Casilleros Entre Dos Trabajadores (Swap Atómico)
create or replace function public.union_swap_locker_assignments(
  p_locker_a_id uuid,
  p_locker_b_id uuid,
  p_swap_reason text default 'Intercambio mutuo de casilleros',
  p_swapped_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_locker_a record;
  v_locker_b record;
  v_asg_a record;
  v_asg_b record;
  v_new_asg_a_id uuid;
  v_new_asg_b_id uuid;
  v_first_id uuid;
  v_second_id uuid;
begin
  if p_locker_a_id = p_locker_b_id then
    return jsonb_build_object('success', false, 'error', 'No se puede intercambiar un casillero consigo mismo');
  end if;

  if p_locker_a_id < p_locker_b_id then
    v_first_id := p_locker_a_id;
    v_second_id := p_locker_b_id;
  else
    v_first_id := p_locker_b_id;
    v_second_id := p_locker_a_id;
  end if;

  perform 1 from public.union_lockers where id = v_first_id for update;
  perform 1 from public.union_lockers where id = v_second_id for update;

  select * into v_locker_a from public.union_lockers where id = p_locker_a_id;
  select * into v_locker_b from public.union_lockers where id = p_locker_b_id;

  select * into v_asg_a from public.union_locker_assignments where locker_id = p_locker_a_id and status = 'active' for update;
  select * into v_asg_b from public.union_locker_assignments where locker_id = p_locker_b_id and status = 'active' for update;

  if not found or v_asg_a.id is null or v_asg_b.id is null then
    return jsonb_build_object('success', false, 'error', 'Ambos casilleros deben tener una asignación activa para poder ser intercambiados');
  end if;

  -- Liberar asignaciones actuales
  update public.union_locker_assignments
  set
    status = 'released',
    released_at = now(),
    release_reason = 'Intercambio con locker #' || v_locker_b.locker_number || ' (' || coalesce(p_swap_reason, '') || ')'
  where id = v_asg_a.id;

  update public.union_locker_assignments
  set
    status = 'released',
    released_at = now(),
    release_reason = 'Intercambio con locker #' || v_locker_a.locker_number || ' (' || coalesce(p_swap_reason, '') || ')'
  where id = v_asg_b.id;

  -- Crear nuevas asignaciones cruzadas
  insert into public.union_locker_assignments (
    locker_id, worker_id, assigned_at, status, assignment_reason, created_by
  ) values (
    p_locker_a_id, v_asg_b.worker_id, now(), 'active',
    'Intercambio desde locker #' || v_locker_b.locker_number, p_swapped_by
  ) returning id into v_new_asg_a_id;

  insert into public.union_locker_assignments (
    locker_id, worker_id, assigned_at, status, assignment_reason, created_by
  ) values (
    p_locker_b_id, v_asg_a.worker_id, now(), 'active',
    'Intercambio desde locker #' || v_locker_a.locker_number, p_swapped_by
  ) returning id into v_new_asg_b_id;

  -- Auditoría
  insert into public.union_audit_log (
    delegation_id, user_id, action, entity_type, entity_id, details
  ) values (
    v_locker_a.delegation_id,
    p_swapped_by,
    'locker.swapped',
    'union_locker',
    p_locker_a_id,
    jsonb_build_object(
      'locker_a', v_locker_a.locker_number,
      'locker_b', v_locker_b.locker_number,
      'worker_a', v_asg_a.worker_id,
      'worker_b', v_asg_b.worker_id,
      'reason', p_swap_reason
    )
  );

  return jsonb_build_object(
    'success', true,
    'locker_a', v_locker_a.locker_number,
    'locker_b', v_locker_b.locker_number
  );
end;
$$;
