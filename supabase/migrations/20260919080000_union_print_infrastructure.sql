-- ============================================================
-- MIGRATION: 20260919080000_union_print_infrastructure.sql
-- Infraestructura de Impresión Automática Silenciosa para Oficina Sindical
-- Estaciones de impresión, cola de trabajos atómica y sincronización Realtime.
-- ============================================================

-- 1. Tabla de Estaciones de Impresión (Hardware local en oficinas sindicales)
create table if not exists public.union_print_stations (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations(id) on delete cascade,
  name text not null,
  device_token_hash text not null,
  printer_name text not null default '',
  is_active boolean not null default true,
  last_seen_at timestamptz,
  agent_version text,
  ip_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists union_print_stations_delegation_idx
  on public.union_print_stations (delegation_id, is_active);

-- 2. Tabla de Cola de Trabajos de Impresión (Jobs)
create table if not exists public.union_print_jobs (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations(id) on delete cascade,
  station_id uuid not null references public.union_print_stations(id) on delete cascade,
  case_id uuid references public.union_cases(id) on delete set null,
  document_type text not null default 'license_package',
  document_revision int not null default 1,
  status text not null default 'queued'
    check (status in ('queued', 'claimed', 'printing', 'printed', 'failed', 'cancelled')),
  copies int not null default 1,
  duplex boolean not null default false,
  document_storage_path text,
  document_sha256 text,
  document_size_bytes int,
  error_code text,
  error_message text,
  attempt_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  printing_at timestamptz,
  printed_at timestamptz,
  failed_at timestamptz
);

create index if not exists union_print_jobs_station_status_idx
  on public.union_print_jobs (station_id, status, created_at asc);

create index if not exists union_print_jobs_case_idx
  on public.union_print_jobs (case_id, created_at desc);

create index if not exists union_print_jobs_delegation_status_idx
  on public.union_print_jobs (delegation_id, status, created_at desc);

-- 3. Función atómica para reclamar un trabajo sin condición de carrera (concurrency-safe)
create or replace function public.claim_print_job(
  p_job_id uuid,
  p_station_id uuid
)
returns table (
  claimed boolean,
  job_id uuid,
  case_id uuid,
  document_type text,
  document_revision int,
  copies int,
  duplex boolean
)
language plpgsql
security definer
as $$
declare
  v_job public.union_print_jobs%rowtype;
begin
  update public.union_print_jobs
  set
    status = 'claimed',
    claimed_at = now(),
    attempt_count = attempt_count + 1
  where id = p_job_id
    and station_id = p_station_id
    and status = 'queued'
  returning * into v_job;

  if found then
    return query select
      true,
      v_job.id,
      v_job.case_id,
      v_job.document_type,
      v_job.document_revision,
      v_job.copies,
      v_job.duplex;
  else
    return query select
      false,
      null::uuid,
      null::uuid,
      null::text,
      null::int,
      null::int,
      null::boolean;
  end if;
end;
$$;

-- 4. Habilitar Supabase Realtime para actualización reactiva instantánea
do $$
begin
  begin
    alter publication supabase_realtime add table public.union_print_jobs;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.union_print_stations;
  exception
    when duplicate_object then null;
  end;
end;
$$;

-- 5. Row Level Security (RLS)
alter table public.union_print_stations enable row level security;
alter table public.union_print_jobs enable row level security;

-- Políticas para union_print_stations
drop policy if exists "union_print_stations_select" on public.union_print_stations;
create policy "union_print_stations_select"
  on public.union_print_stations for select to authenticated
  using (
    exists (
      select 1 from public.union_members m
      where m.delegation_id = union_print_stations.delegation_id
        and m.user_id = auth.uid()
        and m.active = true
    )
  );

drop policy if exists "union_print_stations_admin_all" on public.union_print_stations;
create policy "union_print_stations_admin_all"
  on public.union_print_stations for all to authenticated
  using (
    exists (
      select 1 from public.union_members m
      where m.delegation_id = union_print_stations.delegation_id
        and m.user_id = auth.uid()
        and m.active = true
        and m.role = 'union_admin'
    )
  )
  with check (
    exists (
      select 1 from public.union_members m
      where m.delegation_id = union_print_stations.delegation_id
        and m.user_id = auth.uid()
        and m.active = true
        and m.role = 'union_admin'
    )
  );

-- Políticas para union_print_jobs
drop policy if exists "union_print_jobs_select" on public.union_print_jobs;
create policy "union_print_jobs_select"
  on public.union_print_jobs for select to authenticated
  using (
    exists (
      select 1 from public.union_members m
      where m.delegation_id = union_print_jobs.delegation_id
        and m.user_id = auth.uid()
        and m.active = true
    )
  );

drop policy if exists "union_print_jobs_insert" on public.union_print_jobs;
create policy "union_print_jobs_insert"
  on public.union_print_jobs for insert to authenticated
  with check (
    exists (
      select 1 from public.union_members m
      where m.delegation_id = union_print_jobs.delegation_id
        and m.user_id = auth.uid()
        and m.active = true
    )
  );

drop policy if exists "union_print_jobs_update" on public.union_print_jobs;
create policy "union_print_jobs_update"
  on public.union_print_jobs for update to authenticated
  using (
    exists (
      select 1 from public.union_members m
      where m.delegation_id = union_print_jobs.delegation_id
        and m.user_id = auth.uid()
        and m.active = true
    )
  )
  with check (
    exists (
      select 1 from public.union_members m
      where m.delegation_id = union_print_jobs.delegation_id
        and m.user_id = auth.uid()
        and m.active = true
    )
  );
