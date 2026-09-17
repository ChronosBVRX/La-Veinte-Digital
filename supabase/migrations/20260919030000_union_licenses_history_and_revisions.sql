-- ============================================================
-- MIGRATION: 20260919030000_union_licenses_history_and_revisions.sql
-- Trazabilidad, autoguardado de borradores, control de revisiones
-- y borrado lógico / papelera para el módulo de Licencias Sindicales.
-- ============================================================

-- 1. Agregar columnas a union_cases para pasos, revisiones y borrado lógico
alter table public.union_cases add column if not exists current_step int not null default 1;
alter table public.union_cases add column if not exists revision_number int not null default 1;
alter table public.union_cases add column if not exists document_revision int not null default 0;
alter table public.union_cases add column if not exists deleted_at timestamptz;
alter table public.union_cases add column if not exists deleted_by uuid references auth.users (id);
alter table public.union_cases add column if not exists status_before_delete text;

-- 2. Actualizar la restricción de estados en union_cases
alter table public.union_cases drop constraint if exists union_cases_status_check;
alter table public.union_cases add constraint union_cases_status_check
  check (status in (
    'draft',
    'ready',
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'completed',
    'cancelled',
    'archived',
    'deleted',
    'pending_signature',
    'signed'
  ));

-- Índices para optimizar consultas de papelera y listado activo
create index if not exists union_cases_deleted_idx on public.union_cases (delegation_id, case_type, deleted_at);

-- 3. Flexibilizar union_license_cases para admitir borradores parciales
alter table public.union_license_cases alter column start_date drop not null;
alter table public.union_license_cases alter column end_date drop not null;
alter table public.union_license_cases alter column total_days drop not null;
alter table public.union_license_cases alter column total_days set default 0;

-- 4. Tabla de revisiones históricas para expedientes de licencia
create table if not exists public.union_license_revisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.union_cases (id) on delete cascade,
  revision_number int not null,
  snapshot jsonb not null default '{}'::jsonb,
  change_summary text not null default '',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (case_id, revision_number)
);

create index if not exists union_license_revisions_case_idx
  on public.union_license_revisions (case_id, revision_number desc);

-- 5. Row Level Security (RLS) para union_license_revisions
alter table public.union_license_revisions enable row level security;

drop policy if exists "union_license_revisions_select" on public.union_license_revisions;
create policy "union_license_revisions_select"
  on public.union_license_revisions for select to authenticated
  using (
    exists (
      select 1 from public.union_cases c
      join public.union_members m on m.delegation_id = c.delegation_id
      where c.id = union_license_revisions.case_id
        and m.user_id = auth.uid()
        and m.active = true
    )
  );

drop policy if exists "union_license_revisions_insert" on public.union_license_revisions;
create policy "union_license_revisions_insert"
  on public.union_license_revisions for insert to authenticated
  with check (
    exists (
      select 1 from public.union_cases c
      join public.union_members m on m.delegation_id = c.delegation_id
      where c.id = union_license_revisions.case_id
        and m.user_id = auth.uid()
        and m.active = true
    )
  );
