-- 20260914000000_union_representacion.sql
-- Módulo autónomo de Representación Sindical — Delegación XXI HGR No. 1
-- Aditivo. No toca tablas existentes. RLS estricta por delegación.
-- Convenciones: UUID PK, created_by/updated_by, sin DELETE físico desde UI.

-- ============================================================
-- 0. Extensión pgcrypto para gen_random_uuid (idempotente)
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. Delegaciones sindicales
-- ============================================================
create table if not exists public.union_delegations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  section text not null default 'XX Michoacán',
  facility text not null default 'HGR No. 1',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. Membresías / roles sindicales (RBAC propio del módulo).
--    BETA: solo union_members otorga acceso; profiles.role='admin' NO bypass.
-- ============================================================
create table if not exists public.union_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  role text not null default 'union_rep',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, delegation_id, role)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_members'::regclass and conname = 'union_members_role_check'
  ) then
    alter table public.union_members add constraint union_members_role_check
      check (role in ('union_rep', 'union_admin'));
  end if;
end $$;

-- ============================================================
-- 3. Padrón de trabajadores (por delegación)
-- ============================================================
create table if not exists public.union_workers (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  employee_number text not null,
  first_name text not null,
  paternal_surname text not null,
  maternal_surname text default '',
  category text not null default '',
  assignment text not null default '',
  turn text not null default '',
  schedule text not null default '',
  rest_days text not null default '',
  phone text,
  active boolean not null default true,
  notes text not null default '',
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists union_workers_delegation_idx on public.union_workers (delegation_id);
create index if not exists union_workers_matricula_idx on public.union_workers (delegation_id, employee_number);
create index if not exists union_workers_name_idx on public.union_workers (delegation_id, paternal_surname, maternal_surname, first_name);
create index if not exists union_workers_active_idx on public.union_workers (delegation_id, active);

-- ============================================================
-- 4. Expedientes (casos)
-- ============================================================
create table if not exists public.union_cases (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  worker_id uuid not null references public.union_workers (id) on delete restrict,
  case_type text not null,
  folio text not null unique,
  status text not null default 'draft',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  worker_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_cases'::regclass and conname = 'union_cases_type_check'
  ) then
    alter table public.union_cases add constraint union_cases_type_check
      check (case_type in ('maternity', 'lactation', 'locker', 'passage_026', 'passage_027', 'license'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_cases'::regclass and conname = 'union_cases_status_check'
  ) then
    alter table public.union_cases add constraint union_cases_status_check
      check (status in ('draft', 'ready', 'submitted', 'under_review', 'approved', 'rejected', 'completed', 'cancelled', 'archived'));
  end if;
end $$;

create index if not exists union_cases_delegation_idx on public.union_cases (delegation_id, case_type, status);
create index if not exists union_cases_worker_idx on public.union_cases (worker_id, opened_at desc);
create index if not exists union_cases_folio_idx on public.union_cases (folio);

-- Contador de folios por delegación/año/tipo (unicidad a nivel DB)
create table if not exists public.union_folio_counters (
  delegation_code text not null,
  year int not null,
  case_prefix text not null,
  last_seq int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (delegation_code, year, case_prefix)
);

-- ============================================================
-- 5. Detalles por tipo
-- ============================================================
create table if not exists public.union_maternity_cases (
  case_id uuid primary key references public.union_cases (id) on delete cascade,
  incapacity_start date not null,
  incapacity_end date not null,
  return_to_work date not null,
  lactation_start date not null,
  lactation_end date not null,
  rule_version text not null default 'CCT-2025-2027-Cl77',
  notes text not null default ''
);

create table if not exists public.union_lactation_cases (
  case_id uuid primary key references public.union_cases (id) on delete cascade,
  return_to_work date not null,
  period_start date not null,
  period_end date not null,
  workday_type text not null default '8h',
  selected_modality text not null default '',
  rule_version text not null default 'CCT-2025-2027-Cl77',
  notes text not null default ''
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_lactation_cases'::regclass and conname = 'union_lactation_workday_check'
  ) then
    alter table public.union_lactation_cases add constraint union_lactation_workday_check
      check (workday_type in ('8h', 'lte6_5h', 'accumulated'));
  end if;
end $$;

create table if not exists public.union_passage_cases (
  case_id uuid primary key references public.union_cases (id) on delete cascade,
  concept text not null,
  request_date date not null,
  control_number text,
  ooad text not null default '',
  discontinuous_schedule text not null default '',
  extramural_functions text not null default '',
  transfer_period text not null default '',
  worker_address jsonb not null default '{}'::jsonb,
  assignment_address jsonb not null default '{}'::jsonb,
  phone text not null default '',
  observations text not null default '',
  external_status text not null default 'pending',
  external_resolution_at date,
  external_resolution_note text not null default ''
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_passage_cases'::regclass and conname = 'union_passage_concept_check'
  ) then
    alter table public.union_passage_cases add constraint union_passage_concept_check
      check (concept in ('026', '027'));
  end if;
end $$;

create table if not exists public.union_license_cases (
  case_id uuid primary key references public.union_cases (id) on delete cascade,
  with_pay boolean not null default false,
  license_range_type text not null default 'r1_3',
  start_date date not null,
  end_date date not null,
  total_days int not null,
  previous_license_start date,
  previous_license_end date,
  is_extension boolean not null default false,
  reason text not null default '',
  proof_description text not null default '',
  debt_control_required boolean not null default false,
  debt_certification_status text not null default 'pending',
  notes text not null default '',
  external_status text not null default 'pending',
  external_resolution_at date,
  external_resolution_note text not null default ''
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_license_cases'::regclass and conname = 'union_license_range_check'
  ) then
    alter table public.union_license_cases add constraint union_license_range_check
      check (license_range_type in ('with_pay', 'r1_3', 'r4_60', 'r61_365'));
  end if;
end $$;

-- ============================================================
-- 6. Lockers
-- ============================================================
create table if not exists public.union_lockers (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  locker_number text not null,
  location text not null default '',
  section text not null default '',
  status text not null default 'available',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (delegation_id, locker_number)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_lockers'::regclass and conname = 'union_lockers_status_check'
  ) then
    alter table public.union_lockers add constraint union_lockers_status_check
      check (status in ('available', 'assigned', 'reserved', 'maintenance', 'blocked'));
  end if;
end $$;

create index if not exists union_lockers_delegation_status_idx on public.union_lockers (delegation_id, status);

create table if not exists public.union_locker_assignments (
  id uuid primary key default gen_random_uuid(),
  locker_id uuid not null references public.union_lockers (id) on delete cascade,
  worker_id uuid not null references public.union_workers (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  status text not null default 'active',
  assignment_reason text not null default '',
  release_reason text not null default '',
  resguardo_status text not null default 'pending',
  admin_override boolean not null default false,
  admin_override_reason text not null default '',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_locker_assignments'::regclass and conname = 'union_locker_assign_status_check'
  ) then
    alter table public.union_locker_assignments add constraint union_locker_assign_status_check
      check (status in ('active', 'released'));
  end if;
end $$;

create index if not exists union_locker_assign_locker_idx on public.union_locker_assignments (locker_id, status);
create index if not exists union_locker_assign_worker_idx on public.union_locker_assignments (worker_id, status);

-- Impide dos asignaciones activas al mismo locker y doble locker activo
-- por trabajador (salvo override administrativo explícito y auditado).
create unique index if not exists union_locker_one_active_per_locker
  on public.union_locker_assignments (locker_id) where (status = 'active');

create unique index if not exists union_locker_one_active_per_worker
  on public.union_locker_assignments (worker_id) where (status = 'active' and admin_override = false);

create table if not exists public.union_locker_waitlist (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  worker_id uuid not null references public.union_workers (id) on delete cascade,
  requested_at timestamptz not null default now(),
  priority_override int,
  status text not null default 'waiting',
  notes text not null default '',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_locker_waitlist'::regclass and conname = 'union_waitlist_status_check'
  ) then
    alter table public.union_locker_waitlist add constraint union_waitlist_status_check
      check (status in ('waiting', 'assigned', 'cancelled'));
  end if;
end $$;

create index if not exists union_waitlist_delegation_idx on public.union_locker_waitlist (delegation_id, status, requested_at);

-- ============================================================
-- 7. Documentos, eventos (timeline) y auditoría
-- ============================================================
create table if not exists public.union_case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.union_cases (id) on delete cascade,
  document_type text not null,
  storage_path text not null default '',
  file_name text not null default '',
  mime_type text not null default '',
  template_version text not null default '',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists union_case_documents_case_idx on public.union_case_documents (case_id, created_at);

create table if not exists public.union_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.union_cases (id) on delete cascade,
  event_type text not null,
  title text not null,
  detail text not null default '',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists union_case_events_case_idx on public.union_case_events (case_id, created_at);

create table if not exists public.union_audit_log (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid references public.union_delegations (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  entity_type text not null,
  entity_id text not null default '',
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists union_audit_delegation_idx on public.union_audit_log (delegation_id, created_at desc);
create index if not exists union_audit_entity_idx on public.union_audit_log (entity_type, entity_id);

-- ============================================================
-- 8. Configuración del comité (por delegación, sin hardcodear)
-- ============================================================
create table if not exists public.union_settings (
  delegation_id uuid primary key references public.union_delegations (id) on delete cascade,
  delegation_display_name text not null default 'Comité Delegacional XXI',
  center_name text not null default 'HGR No. 1',
  center_address text not null default 'La Goleta, Charo, Michoacán',
  default_recipient_name text not null default '',
  default_recipient_role text not null default 'Jefe de Personal H.G.R. No. 1',
  general_secretary text not null default '',
  interior_secretary text not null default '',
  conflicts_secretary text not null default '',
  admission_secretary text not null default '',
  social_welfare_secretary text not null default '',
  default_signer_name text not null default '',
  default_signer_role text not null default 'Secretario del Interior XXI',
  institutional_motto text not null default 'Seguridad Social y Bienestar Económico de los Trabajadores',
  active_templates jsonb not null default '{"license_excel": "1A74-009-036-v1", "license_letter": "xxi-v1", "passage_026": "1A32-009-026-v1", "passage_027": "1A32-009-010-v1"}'::jsonb,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 9. Helpers de permisos (SECURITY DEFINER, search_path fijo)
-- BETA PRIVADA: el acceso depende EXCLUSIVAMENTE de union_members.
-- profiles.role='admin' NO otorga acceso a expedientes sindicales.
create or replace function public.union_is_member(p_delegation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.union_members m
    where m.user_id = auth.uid()
      and m.delegation_id = p_delegation
      and m.active = true
  );
$$;

create or replace function public.union_is_admin(p_delegation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.union_members m
    where m.user_id = auth.uid()
      and m.delegation_id = p_delegation
      and m.active = true
      and m.role = 'union_admin'
  );
$$;

create or replace function public.union_my_delegations()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.delegation_id from public.union_members m
  where m.user_id = auth.uid() and m.active = true;
$$;

revoke all on function public.union_is_member(uuid) from public;
revoke all on function public.union_is_admin(uuid) from public;
revoke all on function public.union_my_delegations() from public;
grant execute on function public.union_is_member(uuid) to authenticated;
grant execute on function public.union_is_admin(uuid) to authenticated;
grant execute on function public.union_my_delegations() to authenticated;

-- ============================================================
-- 10. RLS
-- ============================================================
alter table public.union_delegations enable row level security;
alter table public.union_members enable row level security;
alter table public.union_workers enable row level security;
alter table public.union_cases enable row level security;
alter table public.union_maternity_cases enable row level security;
alter table public.union_lactation_cases enable row level security;
alter table public.union_passage_cases enable row level security;
alter table public.union_license_cases enable row level security;
alter table public.union_lockers enable row level security;
alter table public.union_locker_assignments enable row level security;
alter table public.union_locker_waitlist enable row level security;
alter table public.union_case_documents enable row level security;
alter table public.union_case_events enable row level security;
alter table public.union_audit_log enable row level security;
alter table public.union_settings enable row level security;
alter table public.union_folio_counters enable row level security;

-- Delegaciones: visibles para miembros; gestión solo admins de esa delegación
drop policy if exists "union_delegations_member_read" on public.union_delegations;
create policy "union_delegations_member_read"
  on public.union_delegations for select to authenticated
  using (id in (select public.union_my_delegations()));

drop policy if exists "union_delegations_admin_write" on public.union_delegations;
create policy "union_delegations_admin_write"
  on public.union_delegations for update to authenticated
  using (public.union_is_admin(id)) with check (public.union_is_admin(id));

-- Miembros: lectura por miembros de la delegación; escritura por admin
drop policy if exists "union_members_read" on public.union_members;
create policy "union_members_read"
  on public.union_members for select to authenticated
  using (delegation_id in (select public.union_my_delegations()));

drop policy if exists "union_members_admin_write" on public.union_members;
create policy "union_members_admin_write"
  on public.union_members for all to authenticated
  using (public.union_is_admin(delegation_id))
  with check (public.union_is_admin(delegation_id));

-- Workers
drop policy if exists "union_workers_member_read" on public.union_workers;
create policy "union_workers_member_read"
  on public.union_workers for select to authenticated
  using (public.union_is_member(delegation_id));

drop policy if exists "union_workers_member_write" on public.union_workers;
create policy "union_workers_member_write"
  on public.union_workers for insert to authenticated
  with check (public.union_is_member(delegation_id));

drop policy if exists "union_workers_member_update" on public.union_workers;
create policy "union_workers_member_update"
  on public.union_workers for update to authenticated
  using (public.union_is_member(delegation_id))
  with check (public.union_is_member(delegation_id));

-- Cases
drop policy if exists "union_cases_member_read" on public.union_cases;
create policy "union_cases_member_read"
  on public.union_cases for select to authenticated
  using (public.union_is_member(delegation_id));

drop policy if exists "union_cases_member_insert" on public.union_cases;
create policy "union_cases_member_insert"
  on public.union_cases for insert to authenticated
  with check (public.union_is_member(delegation_id));

drop policy if exists "union_cases_member_update" on public.union_cases;
create policy "union_cases_member_update"
  on public.union_cases for update to authenticated
  using (public.union_is_member(delegation_id))
  with check (public.union_is_member(delegation_id));

-- Tablas detalle: acceso vía delegación del caso padre
drop policy if exists "union_maternity_rw" on public.union_maternity_cases;
create policy "union_maternity_rw"
  on public.union_maternity_cases for all to authenticated
  using (exists (select 1 from public.union_cases c where c.id = case_id and public.union_is_member(c.delegation_id)))
  with check (exists (select 1 from public.union_cases c where c.id = case_id and public.union_is_member(c.delegation_id)));

drop policy if exists "union_lactation_rw" on public.union_lactation_cases;
create policy "union_lactation_rw"
  on public.union_lactation_cases for all to authenticated
  using (exists (select 1 from public.union_cases c where c.id = case_id and public.union_is_member(c.delegation_id)))
  with check (exists (select 1 from public.union_cases c where c.id = case_id and public.union_is_member(c.delegation_id)));

drop policy if exists "union_passage_rw" on public.union_passage_cases;
create policy "union_passage_rw"
  on public.union_passage_cases for all to authenticated
  using (exists (select 1 from public.union_cases c where c.id = case_id and public.union_is_member(c.delegation_id)))
  with check (exists (select 1 from public.union_cases c where c.id = case_id and public.union_is_member(c.delegation_id)));

drop policy if exists "union_license_rw" on public.union_license_cases;
create policy "union_license_rw"
  on public.union_license_cases for all to authenticated
  using (exists (select 1 from public.union_cases c where c.id = case_id and public.union_is_member(c.delegation_id)))
  with check (exists (select 1 from public.union_cases c where c.id = case_id and public.union_is_member(c.delegation_id)));

-- Lockers
drop policy if exists "union_lockers_member_read" on public.union_lockers;
create policy "union_lockers_member_read"
  on public.union_lockers for select to authenticated
  using (public.union_is_member(delegation_id));

drop policy if exists "union_lockers_member_write" on public.union_lockers;
create policy "union_lockers_member_write"
  on public.union_lockers for all to authenticated
  using (public.union_is_member(delegation_id))
  with check (public.union_is_member(delegation_id));

drop policy if exists "union_assign_rw" on public.union_locker_assignments;
create policy "union_assign_rw"
  on public.union_locker_assignments for all to authenticated
  using (exists (select 1 from public.union_lockers l where l.id = locker_id and public.union_is_member(l.delegation_id)))
  with check (exists (select 1 from public.union_lockers l where l.id = locker_id and public.union_is_member(l.delegation_id)));

drop policy if exists "union_waitlist_rw" on public.union_locker_waitlist;
create policy "union_waitlist_rw"
  on public.union_locker_waitlist for all to authenticated
  using (public.union_is_member(delegation_id))
  with check (public.union_is_member(delegation_id));

-- Documentos / eventos / auditoría / settings
drop policy if exists "union_docs_rw" on public.union_case_documents;
create policy "union_docs_rw"
  on public.union_case_documents for all to authenticated
  using (exists (select 1 from public.union_cases c where c.id = case_id and public.union_is_member(c.delegation_id)))
  with check (exists (select 1 from public.union_cases c where c.id = case_id and public.union_is_member(c.delegation_id)));

drop policy if exists "union_events_rw" on public.union_case_events;
create policy "union_events_rw"
  on public.union_case_events for all to authenticated
  using (exists (select 1 from public.union_cases c where c.id = case_id and public.union_is_member(c.delegation_id)))
  with check (exists (select 1 from public.union_cases c where c.id = case_id and public.union_is_member(c.delegation_id)));

drop policy if exists "union_audit_read" on public.union_audit_log;
create policy "union_audit_read"
  on public.union_audit_log for select to authenticated
  using (delegation_id is null or public.union_is_member(delegation_id));

drop policy if exists "union_audit_insert" on public.union_audit_log;
create policy "union_audit_insert"
  on public.union_audit_log for insert to authenticated
  with check (delegation_id is null or public.union_is_member(delegation_id));

drop policy if exists "union_settings_read" on public.union_settings;
create policy "union_settings_read"
  on public.union_settings for select to authenticated
  using (public.union_is_member(delegation_id));

drop policy if exists "union_settings_admin_write" on public.union_settings;
create policy "union_settings_admin_write"
  on public.union_settings for all to authenticated
  using (public.union_is_admin(delegation_id))
  with check (public.union_is_admin(delegation_id));

drop policy if exists "union_counters_rw" on public.union_folio_counters;
-- Sin policies de acceso directo: solo el RPC SECURITY DEFINER
-- union_next_folio (ejecutado como owner, bypass RLS) puede avanzar folios.
-- Cualquier SELECT/INSERT/UPDATE/DELETE directo vía PostgREST queda denegado.

-- ============================================================
-- 11. Folio interno atómico (XXI-2026-LIC-000001)
-- ============================================================
create or replace function public.union_next_folio(p_delegation_code text, p_year int, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  insert into public.union_folio_counters (delegation_code, year, case_prefix, last_seq)
  values (p_delegation_code, p_year, p_prefix, 1)
  on conflict (delegation_code, year, case_prefix)
  do update set last_seq = public.union_folio_counters.last_seq + 1, updated_at = now()
  returning last_seq into v_seq;

  -- En concurrencia alta el RETURNING del upsert puede devolver el valor
  -- previo en algunas versiones; re-leer para garantizar monotonicidad.
  if v_seq is null then
    select last_seq into v_seq from public.union_folio_counters
    where delegation_code = p_delegation_code and year = p_year and case_prefix = p_prefix;
  end if;

  return format('%s-%s-%s-%s', p_delegation_code, p_year, p_prefix, lpad(v_seq::text, 6, '0'));
end;
$$;

revoke all on function public.union_next_folio(text, int, text) from public;
grant execute on function public.union_next_folio(text, int, text) to authenticated;

-- ============================================================
-- 12. Seed Delegación XXI (idempotente)
-- ============================================================
insert into public.union_delegations (code, name, section, facility, active)
values ('XXI', 'Comité Delegacional XXI', 'XX Michoacán', 'HGR No. 1', true)
on conflict (code) do update set
  name = excluded.name,
  section = excluded.section,
  facility = excluded.facility,
  active = true,
  updated_at = now();

insert into public.union_settings (delegation_id)
select id from public.union_delegations where code = 'XXI'
on conflict (delegation_id) do nothing;

-- ============================================================
-- 13. Storage privado union-private (idempotente)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('union-private', 'union-private', false)
on conflict (id) do nothing;

drop policy if exists "union_private_member_read" on storage.objects;
create policy "union_private_member_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'union-private'
    and exists (
      select 1 from public.union_members m
      where m.user_id = auth.uid() and m.active = true
    )
  );

drop policy if exists "union_private_member_write" on storage.objects;
create policy "union_private_member_write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'union-private'
    and exists (
      select 1 from public.union_members m
      where m.user_id = auth.uid() and m.active = true
    )
  );

drop policy if exists "union_private_member_update" on storage.objects;
create policy "union_private_member_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'union-private'
    and exists (
      select 1 from public.union_members m
      where m.user_id = auth.uid() and m.active = true
    )
  )
  with check (bucket_id = 'union-private');

drop policy if exists "union_private_member_delete" on storage.objects;
create policy "union_private_member_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'union-private'
    and exists (
      select 1 from public.union_members m
      where m.user_id = auth.uid() and m.active = true
    )
  );
