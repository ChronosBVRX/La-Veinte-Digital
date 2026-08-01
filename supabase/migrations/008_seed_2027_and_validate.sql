-- 008_seed_2027_and_validate.sql
-- Seed de descansos obligatorios 2027 (Cláusula 46) como migración propia
-- (NO modificar 001 una vez aplicada) + validación de constraints NOT VALID
-- agregados en 006.

-- ============================================================
-- 1. Descansos obligatorios 2027
-- ============================================================
INSERT INTO vacation_mandatory_rest_days (year, date, label, source_document) VALUES
  (2027, '2027-01-01', 'Año Nuevo', 'CCT 2025-2027 - Cláusula 46'),
  (2027, '2027-02-01', 'Primer lunes de febrero (Día de la Constitución)', 'CCT 2025-2027 - Cláusula 46'),
  (2027, '2027-03-15', 'Tercer lunes de marzo (Natalicio de Juárez)', 'CCT 2025-2027 - Cláusula 46'),
  (2027, '2027-03-25', 'Jueves de Semana Mayor', 'CCT 2025-2027 - Cláusula 46'),
  (2027, '2027-03-26', 'Viernes de Semana Mayor', 'CCT 2025-2027 - Cláusula 46'),
  (2027, '2027-03-27', 'Sábado de Semana Mayor', 'CCT 2025-2027 - Cláusula 46'),
  (2027, '2027-05-01', 'Día del Trabajo', 'CCT 2025-2027 - Cláusula 46'),
  (2027, '2027-05-10', 'Día de la Madre', 'CCT 2025-2027 - Cláusula 46'),
  (2027, '2027-09-15', 'Fiesta Nacional (15 de septiembre)', 'CCT 2025-2027 - Cláusula 46'),
  (2027, '2027-09-16', 'Día de la Independencia', 'CCT 2025-2027 - Cláusula 46'),
  (2027, '2027-11-15', 'Tercer lunes de noviembre (Día de la Revolución)', 'CCT 2025-2027 - Cláusula 46'),
  (2027, '2027-12-25', 'Navidad', 'CCT 2025-2027 - Cláusula 46')
ON CONFLICT (year, date) DO NOTHING;

-- ============================================================
-- 2. Validar constraints NOT VALID agregados en 006
-- ============================================================
alter table public.bitacora_entries
  validate constraint bitacora_entry_type_check;

alter table public.payroll_contexts
  validate constraint payroll_contexts_hours_check;
alter table public.payroll_contexts
  validate constraint payroll_contexts_employment_type_check;
alter table public.payroll_contexts
  validate constraint payroll_contexts_conditions_array_check;
alter table public.payroll_contexts
  validate constraint payroll_contexts_facts_array_check;
alter table public.payroll_contexts
  validate constraint payroll_contexts_recurrent_array_check;
