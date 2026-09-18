-- ============================================================
-- MIGRATION: 20260919070000_union_licenses_rest_days_and_phone.sql
-- Agregar campos manuales de descansos y teléfono al caso de licencia
-- ============================================================

alter table public.union_license_cases
  add column if not exists rest_days text,
  add column if not exists phone text;
