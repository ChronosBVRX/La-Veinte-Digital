-- ============================================================
-- Migración: union_document_templates (Plantillas Documentales)
-- Módulo: Representación Sindical
-- Propósito: Registro de metadatos, versiones e integridad SHA-256
--            de plantillas maestras almacenadas en storage privado.
-- ============================================================

create table if not exists public.union_document_templates (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations (id) on delete cascade,
  template_kind text not null,
  version text not null,
  storage_bucket text not null default 'union-private',
  storage_path text not null,
  mime_type text not null,
  sha256 text not null,
  file_size bigint not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint union_document_templates_kind_check check (
    template_kind in ('license_word', 'license_excel', 'passage_026', 'passage_027')
  ),
  constraint union_document_templates_del_kind_ver_key unique (delegation_id, template_kind, version)
);

-- Constraint de unicidad para garantizar que SOLO exista UNA plantilla activa por tipo y delegación
create unique index if not exists union_document_templates_active_idx
  on public.union_document_templates (delegation_id, template_kind)
  where (is_active = true);

create index if not exists union_document_templates_lookup_idx
  on public.union_document_templates (delegation_id, template_kind, is_active);

-- Habilitar Row Level Security (RLS)
alter table public.union_document_templates enable row level security;

-- Políticas de seguridad
drop policy if exists "union_document_templates_member_read" on public.union_document_templates;
create policy "union_document_templates_member_read"
  on public.union_document_templates for select to authenticated
  using (
    public.union_is_member(delegation_id)
  );

drop policy if exists "union_document_templates_admin_write" on public.union_document_templates;
create policy "union_document_templates_admin_write"
  on public.union_document_templates for all to authenticated
  using (
    public.union_is_admin(delegation_id)
  )
  with check (
    public.union_is_admin(delegation_id)
  );
