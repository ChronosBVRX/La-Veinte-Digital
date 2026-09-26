-- 20260926140000_union_locker_cases.sql
-- Módulo de Representación Sindical — Programa de Actualización de Locker 2026
-- Tabla complementaria para expedientes de lockers (tipo 'locker') con folio LOK.
-- Idempotente y aditivo.

create table if not exists public.union_locker_cases (
  case_id uuid primary key references public.union_cases (id) on delete cascade,
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  locker_id uuid not null references public.union_lockers (id) on delete restrict,
  assignment_id uuid references public.union_locker_assignments (id) on delete set null,
  movement_type text not null default 'actualizacion_2026',
  locker_number text not null,
  zone_name text not null default '',
  bank_name text not null default '',
  physical_code text,
  condition text not null default 'ok',
  worker_phone text not null default '',
  worker_turn text not null default '',
  worker_assignment text not null default '',
  worker_category text not null default '',
  observations text not null default '',
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.union_locker_cases'::regclass and conname = 'union_locker_cases_movement_check'
  ) then
    alter table public.union_locker_cases add constraint union_locker_cases_movement_check
      check (movement_type in ('actualizacion_2026', 'asignacion_nueva', 'cambio', 'baja'));
  end if;
end $$;

create index if not exists union_locker_cases_delegation_idx on public.union_locker_cases (delegation_id);
create index if not exists union_locker_cases_locker_idx on public.union_locker_cases (locker_id);
create index if not exists union_locker_cases_created_idx on public.union_locker_cases (created_at desc);

-- Habilitar RLS
alter table public.union_locker_cases enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'union_locker_cases' and policyname = 'union_locker_cases_select_policy'
  ) then
    create policy union_locker_cases_select_policy on public.union_locker_cases
      for select
      using (
        exists (
          select 1 from public.union_members m
          where m.user_id = auth.uid()
            and m.delegation_id = union_locker_cases.delegation_id
            and m.active = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'union_locker_cases' and policyname = 'union_locker_cases_insert_policy'
  ) then
    create policy union_locker_cases_insert_policy on public.union_locker_cases
      for insert
      with check (
        exists (
          select 1 from public.union_members m
          where m.user_id = auth.uid()
            and m.delegation_id = union_locker_cases.delegation_id
            and m.active = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'union_locker_cases' and policyname = 'union_locker_cases_update_policy'
  ) then
    create policy union_locker_cases_update_policy on public.union_locker_cases
      for update
      using (
        exists (
          select 1 from public.union_members m
          where m.user_id = auth.uid()
            and m.delegation_id = union_locker_cases.delegation_id
            and m.active = true
        )
      );
  end if;
end $$;
