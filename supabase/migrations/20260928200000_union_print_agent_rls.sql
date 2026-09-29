-- ============================================================
-- MIGRATION: 20260928200000_union_print_agent_rls.sql
-- Permite que los endpoints máquina-a-máquina (/api/union/print-agent/*)
-- operen correctamente tanto con service_role como con el cliente SSR sin cookies
-- durante la vinculación por código de 6 dígitos, latidos y cola de impresión.
-- ============================================================

drop policy if exists "union_print_enrollment_codes_agent_select" on public.union_print_enrollment_codes;
create policy "union_print_enrollment_codes_agent_select"
  on public.union_print_enrollment_codes for select
  to anon, authenticated
  using (true);

drop policy if exists "union_print_enrollment_codes_agent_update" on public.union_print_enrollment_codes;
create policy "union_print_enrollment_codes_agent_update"
  on public.union_print_enrollment_codes for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "union_print_stations_agent_select" on public.union_print_stations;
create policy "union_print_stations_agent_select"
  on public.union_print_stations for select
  to anon, authenticated
  using (true);

drop policy if exists "union_print_stations_agent_insert" on public.union_print_stations;
create policy "union_print_stations_agent_insert"
  on public.union_print_stations for insert
  to anon, authenticated
  with check (true);

drop policy if exists "union_print_stations_agent_update" on public.union_print_stations;
create policy "union_print_stations_agent_update"
  on public.union_print_stations for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "union_print_jobs_agent_select" on public.union_print_jobs;
create policy "union_print_jobs_agent_select"
  on public.union_print_jobs for select
  to anon, authenticated
  using (true);

drop policy if exists "union_print_jobs_agent_update" on public.union_print_jobs;
create policy "union_print_jobs_agent_update"
  on public.union_print_jobs for update
  to anon, authenticated
  using (true)
  with check (true);
