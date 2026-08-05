-- rollback-worker-profile-persistence.sql
-- DO NOT EXECUTE without explicit authorization.
-- Adaptado de docs/worker-profile/PR2_ROLLBACK_PLAN.md

-- ============================================================
-- ESCENARIO A — Rollback antes de uso (sin datos nuevos)
-- ============================================================
-- Condición: las tablas/columnas/RPCs existen pero NO recibieron datos
-- de usuarios reales (sin filas en worker_preferences/consents/events,
-- sin columnas nuevas de payroll_contexts pobladas).

-- Verificar que no hay datos antes de DROP.
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.worker_preferences;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'rollback aborted: worker_preferences has % rows. Use Scenario B.', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.worker_consents;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'rollback aborted: worker_consents has % rows. Use Scenario B.', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.worker_data_events;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'rollback aborted: worker_data_events has % rows. Use Scenario B.', v_count;
  END IF;
END
$$;

BEGIN;

-- Revocar y eliminar RPCs de dominio
drop function if exists public.choose_basic_mode() cascade;
drop function if exists public.confirm_manual_worker_profile(jsonb, jsonb, jsonb, text) cascade;
drop function if exists public.confirm_payslip_worker_profile(jsonb, text, text, numeric, text) cascade;
drop function if exists public.change_worker_profile_mode(text) cascade;
drop function if exists public.delete_worker_data() cascade;
drop function if exists public.grant_worker_consent(text, text) cascade;
drop function if exists public.revoke_worker_consent(text) cascade;
drop function if exists public.get_effective_consent(text) cascade;
drop function if exists public._insert_worker_event(text, text, jsonb) cascade;
drop function if exists public.backfill_worker_profile() cascade;

-- Eliminar tablas nuevas
drop table if exists public.worker_data_events cascade;
drop table if exists public.worker_consents cascade;
drop table if exists public.worker_preferences cascade;

-- Eliminar columnas nuevas de payroll_contexts
alter table public.payroll_contexts
  drop column if exists matricula,
  drop column if exists adscripcion,
  drop column if exists shift,
  drop column if exists source_matricula,
  drop column if exists source_adscripcion,
  drop column if exists source_category_name,
  drop column if exists source_workday_hours,
  drop column if exists source_employment_type,
  drop column if exists source_shift,
  drop column if exists source_effective_seniority_date;

-- Revocar grant SELECT añadido (vuelve al estado pre-migración)
revoke select on public.payroll_contexts from authenticated;

COMMIT;

RAISE NOTICE 'Rollback Scenario A completed. Worker profile persistence removed.';

-- ============================================================
-- ESCENARIO B — Rollback después de uso (soft-disable)
-- ============================================================
-- Instrucciones (no SQL ejecutable automático):
--
-- 1. Revocar EXECUTE de todas las RPCs de dominio a authenticated:
--    revoke execute on function public.choose_basic_mode() from authenticated;
--    (repetir para las 8 RPCs)
--
-- 2. Mantener tablas y columnas intactas (no DROP).
--
-- 3. Desplegar versión del frontend sin /profile/mi-informacion-laboral
--    (revertir PR #12).
--
-- 4. Las rutas legacy (/profile) siguen funcionando con ProfileForm original.
--
-- 5. El WorkerProfileService en servidor devuelve WorkerProfileUnavailableError
--    (sin conexión a worker_preferences).
--
-- 6. Tras periodo de observación, decidir:
--    a) Re-activar (re-aplicar grants de EXECUTE + deploy frontend).
--    b) Limpieza definitiva (exportar datos → Scenario A).
