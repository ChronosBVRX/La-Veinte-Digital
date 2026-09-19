-- 20260919120000_union_lockers_semantic_consistency.sql
-- Consistencia Semántica, Separación de Estado vs Condición y Blindaje de Asignaciones en Lockers 2.0
-- Delegación XXI (SNTSS Sección XX Michoacán · HGR No. 1 Charo)

-- ============================================================
-- 1. Normalización Idempotente de Estados Legacy en union_lockers
-- ============================================================

-- Normalizar status 'ocupado' a 'assigned'
update public.union_lockers
set status = 'assigned'
where status = 'ocupado';

-- Normalizar status 'disponible' a 'available'
update public.union_lockers
set status = 'available'
where status = 'disponible';

-- Migrar 'maintenance' de status a condition física
update public.union_lockers l
set
  condition = 'maintenance',
  status = case
    when exists (select 1 from public.union_locker_assignments a where a.locker_id = l.id and a.status = 'active') then 'assigned'
    else 'available'
  end
where status = 'maintenance';

-- Migrar 'blocked' de status a condition física
update public.union_lockers l
set
  condition = 'blocked',
  status = case
    when exists (select 1 from public.union_locker_assignments a where a.locker_id = l.id and a.status = 'active') then 'assigned'
    else 'available'
  end
where status = 'blocked';

-- ============================================================
-- 2. Perfeccionamiento de RPC union_assign_locker
-- ============================================================
create or replace function public.union_assign_locker(
  p_locker_id uuid,
  p_worker_id uuid,
  p_assignment_reason text default '',
  p_admin_override boolean default false,
  p_admin_override_reason text default '',
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_locker record;
  v_worker record;
  v_existing_worker_asg record;
  v_existing_locker_asg record;
  v_new_assignment_id uuid;
  v_masked_emp text;
begin
  -- 1. Resolver actor de forma estricta desde contexto de autenticación
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- 2. Bloquear casillero FOR UPDATE para concurrencia estricta
  select * into v_locker
  from public.union_lockers
  where id = p_locker_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Locker no encontrado');
  end if;

  -- 3. Verificar membresía en la delegación del casillero
  if not public.union_is_member(v_locker.delegation_id) then
    raise exception 'No autorizado para operar en esta delegación';
  end if;

  -- 4. Validar condición física del casillero
  if v_locker.condition in ('maintenance', 'blocked') then
    return jsonb_build_object('success', false, 'error', 'El casillero se encuentra en mantenimiento o bloqueado');
  end if;

  -- 5. Validar estado de asignación
  if v_locker.status not in ('available', 'reserved', 'disponible') then
    return jsonb_build_object('success', false, 'error', 'Este casillero ya se encuentra asignado');
  end if;

  -- 6. Manejo estricto de reservas
  if v_locker.status = 'reserved' then
    if v_locker.reserved_for_worker_id is not null then
      if v_locker.reserved_for_worker_id <> p_worker_id then
        return jsonb_build_object('success', false, 'error', 'El casillero se encuentra reservado para otro trabajador');
      end if;
    else
      -- Reserva genérica: solo administradores sindicales pueden asignarla
      if not public.union_is_admin(v_locker.delegation_id) then
        raise exception 'El casillero tiene reserva genérica. Se requiere rol de administrador sindical para asignarlo';
      end if;
    end if;
  end if;

  -- 7. Verificar que no exista asignación activa previa en este locker
  select id into v_existing_locker_asg
  from public.union_locker_assignments
  where locker_id = p_locker_id and status = 'active'
  limit 1;

  if found then
    return jsonb_build_object('success', false, 'error', 'El casillero ya tiene una asignación activa en el sistema');
  end if;

  -- 8. Validar trabajador y coincidencia de delegación
  select id, delegation_id, first_name, paternal_surname, maternal_surname, employee_number into v_worker
  from public.union_workers
  where id = p_worker_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Trabajador no encontrado en el padrón');
  end if;

  if v_worker.delegation_id <> v_locker.delegation_id then
    return jsonb_build_object('success', false, 'error', 'El trabajador y el casillero pertenecen a delegaciones distintas');
  end if;

  -- 9. Validación universal de admin_override:
  -- Si p_admin_override es true, SIEMPRE se exige union_is_admin() Y admin_override_reason obligatorio,
  -- independientemente de si el trabajador tiene o no otro casillero activo.
  if coalesce(p_admin_override, false) then
    if not public.union_is_admin(v_locker.delegation_id) then
      raise exception 'Se requieren privilegios de administrador sindical para autorizar override administrativo';
    end if;

    if p_admin_override_reason is null or trim(p_admin_override_reason) = '' then
      return jsonb_build_object(
        'success', false,
        'error', 'El override administrativo requiere un motivo justificado obligatorio'
      );
    end if;
  end if;

  -- 10. Verificar si el trabajador ya tiene otro locker activo
  select a.id, l.locker_number into v_existing_worker_asg
  from public.union_locker_assignments a
  join public.union_lockers l on l.id = a.locker_id
  where a.worker_id = p_worker_id and a.status = 'active'
  limit 1;

  if found then
    if not coalesce(p_admin_override, false) then
      return jsonb_build_object(
        'success', false,
        'error', 'El trabajador ya tiene asignado el casillero #' || v_existing_worker_asg.locker_number || '. Se requiere autorización administrativa justificada.'
      );
    end if;
  end if;

  -- 11. Crear la asignación atómica
  insert into public.union_locker_assignments (
    locker_id,
    worker_id,
    assigned_at,
    status,
    assignment_reason,
    admin_override,
    admin_override_reason,
    created_by
  ) values (
    p_locker_id,
    p_worker_id,
    now(),
    'active',
    coalesce(p_assignment_reason, ''),
    coalesce(p_admin_override, false),
    coalesce(p_admin_override_reason, ''),
    v_actor
  ) returning id into v_new_assignment_id;

  -- 12. Actualizar estado del casillero
  update public.union_lockers
  set
    status = 'assigned',
    reserved_for_worker_id = null,
    reservation_reason = '',
    reserved_until = null,
    updated_at = now()
  where id = p_locker_id;

  -- 13. Registrar auditoría con sanitización de PII
  v_masked_emp := case
    when length(coalesce(v_worker.employee_number, '')) > 4 then '***' || right(v_worker.employee_number, 4)
    else '***'
  end;

  insert into public.union_audit_log (
    delegation_id,
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_locker.delegation_id,
    v_actor,
    'locker.assigned',
    'union_locker',
    p_locker_id::text,
    jsonb_build_object(
      'locker_number', v_locker.locker_number,
      'worker_id', p_worker_id,
      'masked_employee_number', v_masked_emp,
      'admin_override', coalesce(p_admin_override, false),
      'assignment_id', v_new_assignment_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'assignment_id', v_new_assignment_id,
    'locker_number', v_locker.locker_number
  );
end;
$$;

-- ============================================================
-- 3. RPC para Modificar Condición Física (union_set_locker_condition)
-- ============================================================
create or replace function public.union_set_locker_condition(
  p_locker_id uuid,
  p_condition text,
  p_maintenance_reason text default '',
  p_maintenance_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_locker record;
  v_cond text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Usuario no autenticado';
  end if;

  v_cond := lower(trim(coalesce(p_condition, 'ok')));
  if v_cond not in ('ok', 'maintenance', 'blocked') then
    return jsonb_build_object('success', false, 'error', 'Condición física inválida. Permitidas: ok, maintenance, blocked');
  end if;

  select * into v_locker
  from public.union_lockers
  where id = p_locker_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Locker no encontrado');
  end if;

  if not public.union_is_member(v_locker.delegation_id) then
    raise exception 'No autorizado para operar en esta delegación';
  end if;

  update public.union_lockers
  set
    condition = v_cond,
    maintenance_reason = coalesce(p_maintenance_reason, ''),
    maintenance_notes = coalesce(p_maintenance_notes, ''),
    maintenance_date = case when v_cond = 'maintenance' then now() else maintenance_date end,
    updated_at = now()
  where id = p_locker_id;

  insert into public.union_audit_log (
    delegation_id,
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_locker.delegation_id,
    v_actor,
    'locker.condition_changed',
    'union_locker',
    p_locker_id::text,
    jsonb_build_object(
      'locker_number', v_locker.locker_number,
      'old_condition', v_locker.condition,
      'new_condition', v_cond,
      'reason', coalesce(p_maintenance_reason, '')
    )
  );

  return jsonb_build_object(
    'success', true,
    'locker_id', p_locker_id,
    'condition', v_cond
  );
end;
$$;

-- ============================================================
-- 4. RPC para Reservar Casillero (union_reserve_locker)
-- ============================================================
create or replace function public.union_reserve_locker(
  p_locker_id uuid,
  p_worker_id uuid default null,
  p_reservation_reason text default '',
  p_reserved_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_locker record;
  v_existing_asg record;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into v_locker
  from public.union_lockers
  where id = p_locker_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Locker no encontrado');
  end if;

  -- Reservas requieren rol de administrador sindical
  if not public.union_is_admin(v_locker.delegation_id) then
    raise exception 'Se requieren privilegios de administrador sindical para reservar casilleros';
  end if;

  -- Verificar que no tenga asignación activa
  select id into v_existing_asg
  from public.union_locker_assignments
  where locker_id = p_locker_id and status = 'active'
  limit 1;

  if found then
    return jsonb_build_object('success', false, 'error', 'No se puede reservar un casillero con asignación activa');
  end if;

  update public.union_lockers
  set
    status = 'reserved',
    reserved_for_worker_id = p_worker_id,
    reservation_reason = coalesce(p_reservation_reason, 'Reserva administrativa'),
    reserved_until = p_reserved_until,
    updated_at = now()
  where id = p_locker_id;

  insert into public.union_audit_log (
    delegation_id,
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_locker.delegation_id,
    v_actor,
    'locker.reserved',
    'union_locker',
    p_locker_id::text,
    jsonb_build_object(
      'locker_number', v_locker.locker_number,
      'reserved_for_worker_id', p_worker_id,
      'reason', coalesce(p_reservation_reason, '')
    )
  );

  return jsonb_build_object('success', true, 'locker_id', p_locker_id);
end;
$$;

-- ============================================================
-- 5. RPC para Cancelar Reserva (union_cancel_locker_reservation)
-- ============================================================
create or replace function public.union_cancel_locker_reservation(
  p_locker_id uuid,
  p_cancellation_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_locker record;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into v_locker
  from public.union_lockers
  where id = p_locker_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Locker no encontrado');
  end if;

  if not public.union_is_admin(v_locker.delegation_id) then
    raise exception 'Se requieren privilegios de administrador sindical para cancelar reservas';
  end if;

  update public.union_lockers
  set
    status = 'available',
    reserved_for_worker_id = null,
    reservation_reason = '',
    reserved_until = null,
    updated_at = now()
  where id = p_locker_id;

  insert into public.union_audit_log (
    delegation_id,
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_locker.delegation_id,
    v_actor,
    'locker.reservation_cancelled',
    'union_locker',
    p_locker_id::text,
    jsonb_build_object(
      'locker_number', v_locker.locker_number,
      'reason', coalesce(p_cancellation_reason, '')
    )
  );

  return jsonb_build_object('success', true, 'locker_id', p_locker_id);
end;
$$;

-- ============================================================
-- 6. Concesión y Revocación de Privilegios
-- ============================================================
revoke execute on function public.union_assign_locker(uuid, uuid, text, boolean, text, uuid) from public, anon;
grant execute on function public.union_assign_locker(uuid, uuid, text, boolean, text, uuid) to authenticated, service_role;

revoke execute on function public.union_set_locker_condition(uuid, text, text, text) from public, anon;
grant execute on function public.union_set_locker_condition(uuid, text, text, text) to authenticated, service_role;

revoke execute on function public.union_reserve_locker(uuid, uuid, text, timestamptz) from public, anon;
grant execute on function public.union_reserve_locker(uuid, uuid, text, timestamptz) to authenticated, service_role;

revoke execute on function public.union_cancel_locker_reservation(uuid, text) from public, anon;
grant execute on function public.union_cancel_locker_reservation(uuid, text) to authenticated, service_role;
