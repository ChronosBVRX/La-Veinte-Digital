-- ═══════════════════════════════════════════════════════════════════
-- 20260906160000_agenda_general_reminder_and_types.sql
--
-- Agenda laboral: amplía validación de tipos para incorporar
-- 'general_reminder', preservando intactos todos los tipos históricos.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.worker_commitments
  drop constraint if exists worker_commitments_type_check;

alter table public.worker_commitments
  add constraint worker_commitments_type_check
  check (type in (
    'txt_substitution',
    'overtime',
    'shift_change',
    'sport',
    'guardia_festiva',
    'falta_injustificada',
    'incapacidad',
    'pase_salida',
    'vacaciones',
    'no_pagado',
    'other',
    'general_reminder'
  ));

alter table public.commitment_reminder_deliveries
  drop constraint if exists commitment_reminder_deliveries_reminder_type_check;

alter table public.commitment_reminder_deliveries
  add constraint commitment_reminder_deliveries_reminder_type_check
  check (reminder_type in (
    'DAY_BEFORE',
    'HOURS_BEFORE',
    'AT_START',
    'SCHEDULED_TIME'
  ));

commit;

