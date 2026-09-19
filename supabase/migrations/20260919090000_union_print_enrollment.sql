-- ============================================================
-- MIGRATION: 20260919090000_union_print_enrollment.sql
-- Códigos de Vinculación Rápida de 6 Dígitos para Estaciones de Impresión
-- Permite vincular La Veinte Print para Windows sin escribir tokens largos.
-- ============================================================

create table if not exists public.union_print_enrollment_codes (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.union_delegations(id) on delete cascade,
  code_hash text not null,
  station_name text not null default 'Oficina Sindical',
  printer_name text not null default '',
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists union_print_enrollment_codes_hash_idx
  on public.union_print_enrollment_codes (code_hash);

create index if not exists union_print_enrollment_codes_del_idx
  on public.union_print_enrollment_codes (delegation_id, expires_at);

-- Publicación Realtime para actualizar la interfaz web reactivamente
do $$
begin
  begin
    alter publication supabase_realtime add table public.union_print_enrollment_codes;
  exception
    when duplicate_object then null;
  end;
end;
$$;

-- Row Level Security
alter table public.union_print_enrollment_codes enable row level security;

-- Los miembros de la delegación pueden consultar y crear códigos de vinculación
drop policy if exists "union_print_enrollment_select" on public.union_print_enrollment_codes;
create policy "union_print_enrollment_select"
  on public.union_print_enrollment_codes for select to authenticated
  using (
    exists (
      select 1 from public.union_members m
      where m.delegation_id = union_print_enrollment_codes.delegation_id
        and m.user_id = auth.uid()
        and m.active = true
    )
  );

drop policy if exists "union_print_enrollment_insert" on public.union_print_enrollment_codes;
create policy "union_print_enrollment_insert"
  on public.union_print_enrollment_codes for insert to authenticated
  with check (
    exists (
      select 1 from public.union_members m
      where m.delegation_id = union_print_enrollment_codes.delegation_id
        and m.user_id = auth.uid()
        and m.active = true
    )
  );

drop policy if exists "union_print_enrollment_update" on public.union_print_enrollment_codes;
create policy "union_print_enrollment_update"
  on public.union_print_enrollment_codes for update to authenticated
  using (
    exists (
      select 1 from public.union_members m
      where m.delegation_id = union_print_enrollment_codes.delegation_id
        and m.user_id = auth.uid()
        and m.active = true
    )
  )
  with check (
    exists (
      select 1 from public.union_members m
      where m.delegation_id = union_print_enrollment_codes.delegation_id
        and m.user_id = auth.uid()
        and m.active = true
    )
  );
