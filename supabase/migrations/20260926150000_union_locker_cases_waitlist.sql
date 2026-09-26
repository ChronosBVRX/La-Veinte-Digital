-- 20260926150000_union_locker_cases_waitlist.sql
-- Permite registrar solicitudes de lista de espera en union_locker_cases (locker_id nullable)
-- y añade 'lista_espera' como movement_type válido.

-- 1. Hacer locker_id opcional (para cuando el trabajador queda en lista de espera sin casillero físico asignado)
alter table public.union_locker_cases alter column locker_id drop not null;

-- 2. Actualizar el constraint de tipos de movimiento para incluir 'lista_espera'
do $$
begin
  alter table public.union_locker_cases drop constraint if exists union_locker_cases_movement_check;
  alter table public.union_locker_cases add constraint union_locker_cases_movement_check
    check (movement_type in ('actualizacion_2026', 'asignacion_nueva', 'cambio', 'baja', 'lista_espera'));
end $$;
