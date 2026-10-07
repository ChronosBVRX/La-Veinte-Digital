-- ============================================================
-- MIGRATION: 20261006153000_harden_union_print_agent_rls.sql
-- Revoca las políticas permisivas RLS (anon) introducidas previamente
-- en 20260928200000_union_print_agent_rls.sql sobre la infraestructura
-- de impresión sindical (union_print_enrollment_codes, union_print_stations,
-- union_print_jobs).
--
-- Los endpoints máquina-a-máquina (/api/union/print-agent/*) operan
-- en el servidor utilizando SUPABASE_SERVICE_ROLE_KEY.
-- El acceso anónimo directo a través de la API REST pública de Supabase
-- queda estrictamente denegado (default deny de RLS).
-- Además, endurece la función claim_print_job fijando search_path seguro.
-- ============================================================

begin;

-- 1. Eliminar políticas permisivas expuestas a anon
drop policy if exists "union_print_enrollment_codes_agent_select" on public.union_print_enrollment_codes;
drop policy if exists "union_print_enrollment_codes_agent_update" on public.union_print_enrollment_codes;

drop policy if exists "union_print_stations_agent_select" on public.union_print_stations;
drop policy if exists "union_print_stations_agent_insert" on public.union_print_stations;
drop policy if exists "union_print_stations_agent_update" on public.union_print_stations;

drop policy if exists "union_print_jobs_agent_select" on public.union_print_jobs;
drop policy if exists "union_print_jobs_agent_update" on public.union_print_jobs;

-- 2. Endurecer claim_print_job para fijar search_path (prevenir secuestro de esquemas)
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
set search_path = public, pg_temp
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

-- 3. Endurecer funciones SECURITY DEFINER de lockers fijando search_path
alter function public.union_apply_locker_authoritative_snapshot(uuid) set search_path = public, pg_temp;
alter function public.union_rollback_locker_authoritative_snapshot(uuid) set search_path = public, pg_temp;

commit;
