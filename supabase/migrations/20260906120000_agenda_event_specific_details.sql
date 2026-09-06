-- Agenda laboral: datos específicos por tipo de registro.
-- Conserva todos los tipos históricos y habilita "sport" para las nuevas altas.

begin;

alter table public.worker_commitments
  add column if not exists details jsonb not null default '{}'::jsonb;

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
    'other'
  ));

alter table public.worker_commitments
  drop constraint if exists worker_commitments_details_object_check;

alter table public.worker_commitments
  add constraint worker_commitments_details_object_check
  check (jsonb_typeof(details) = 'object');

commit;
