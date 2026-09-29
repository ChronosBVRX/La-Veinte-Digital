-- 20260928220000_union_parking_hgr1.sql
-- Integración del Sistema de Control de Acceso Vehicular (CAV HGR 1 - 11.1.17.44:8080)
-- con el Padrón Sindical (union_workers) en Representación Sindical.
-- Aditivo, con RLS estricta por delegación (union_is_member).

create table if not exists public.union_parking_records (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  external_id_reg integer not null,
  worker_id uuid references public.union_workers (id) on delete set null,
  matricula text not null default '',
  full_name text not null default '',
  nombre text not null default '',
  apellido_paterno text not null default '',
  apellido_materno text not null default '',
  cargo text not null default '',
  area_code text not null default '',
  area_label text not null default '',
  placas text not null default '',
  vehicle_model_id integer,
  vehicle_model_label text not null default '',
  parking_lot text not null default '1',
  cajon_number text not null default '',
  shift text not null default 'M',
  email text not null default '',
  status text not null default 'A',
  internal_status text not null default 'activo',
  suspension_reason text not null default '',
  last_synced_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (delegation_id, external_id_reg)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_parking_records'::regclass
      and conname = 'union_parking_records_status_check'
  ) then
    alter table public.union_parking_records
      add constraint union_parking_records_status_check
      check (status in ('A', 'X'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_parking_records'::regclass
      and conname = 'union_parking_records_internal_status_check'
  ) then
    alter table public.union_parking_records
      add constraint union_parking_records_internal_status_check
      check (internal_status in ('activo', 'suspendido', 'baja'));
  end if;
end $$;

create index if not exists union_parking_records_delegation_status_idx
  on public.union_parking_records (delegation_id, status, internal_status);

create index if not exists union_parking_records_worker_idx
  on public.union_parking_records (delegation_id, worker_id);

create index if not exists union_parking_records_matricula_idx
  on public.union_parking_records (delegation_id, matricula);

create index if not exists union_parking_records_placas_idx
  on public.union_parking_records (delegation_id, placas);

alter table public.union_parking_records enable row level security;

drop policy if exists "union_parking_records_member_read" on public.union_parking_records;
create policy "union_parking_records_member_read"
  on public.union_parking_records for select to authenticated
  using (public.union_is_member(delegation_id));

drop policy if exists "union_parking_records_member_insert" on public.union_parking_records;
create policy "union_parking_records_member_insert"
  on public.union_parking_records for insert to authenticated
  with check (public.union_is_member(delegation_id));

drop policy if exists "union_parking_records_member_update" on public.union_parking_records;
create policy "union_parking_records_member_update"
  on public.union_parking_records for update to authenticated
  using (public.union_is_member(delegation_id))
  with check (public.union_is_member(delegation_id));

-- Tabla de cola RPC en vivo (Puente en Tiempo Real < 1.5s entre la20.com.mx y La Veinte Print Agent en la oficina)
create table if not exists public.union_parking_bridge_requests (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  station_id uuid references public.union_print_stations (id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  result jsonb,
  error_message text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_parking_bridge_requests'::regclass
      and conname = 'union_parking_bridge_requests_status_check'
  ) then
    alter table public.union_parking_bridge_requests
      add constraint union_parking_bridge_requests_status_check
      check (status in ('pending', 'processing', 'completed', 'failed'));
  end if;
end $$;

create index if not exists union_parking_bridge_requests_pending_idx
  on public.union_parking_bridge_requests (delegation_id, status, created_at);

alter table public.union_parking_bridge_requests enable row level security;

drop policy if exists "union_parking_bridge_requests_member_all" on public.union_parking_bridge_requests;
create policy "union_parking_bridge_requests_member_all"
  on public.union_parking_bridge_requests for all to authenticated
  using (public.union_is_member(delegation_id))
  with check (public.union_is_member(delegation_id));

