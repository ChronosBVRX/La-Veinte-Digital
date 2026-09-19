-- 20260919110000_union_lockers_hardening.sql
-- Hardening funcional, seguridad estricta y corrección de RPCs en Lockers 2.0
-- Corrige inserción a union_audit_log (columna metadata en lugar de details),
-- resolución obligatoria de identidad de actor vía auth.uid(),
-- validaciones de membresía y rol administrativo, prevención de delegación cruzada
-- y revocación de permisos a PUBLIC/anon.

-- ============================================================
-- 1. Asignación Atómica Segura (union_assign_locker)
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

  if v_locker.condition in ('maintenance', 'blocked') then
    return jsonb_build_object('success', false, 'error', 'El casillero se encuentra en mantenimiento o bloqueado');
  end if;

  if v_locker.status not in ('available', 'reserved', 'disponible') then
    return jsonb_build_object('success', false, 'error', 'Este casillero ya se encuentra asignado');
  end if;

  -- 4. Verificar que no exista asignación activa en este locker
  select id into v_existing_locker_asg
  from public.union_locker_assignments
  where locker_id = p_locker_id and status = 'active'
  limit 1;

  if found then
    return jsonb_build_object('success', false, 'error', 'El casillero ya tiene una asignación activa en el sistema');
  end if;

  -- 5. Validar trabajador y coincidencia de delegación
  select id, delegation_id, first_name, paternal_surname, maternal_surname, employee_number into v_worker
  from public.union_workers
  where id = p_worker_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Trabajador no encontrado en el padrón');
  end if;

  if v_worker.delegation_id <> v_locker.delegation_id then
    return jsonb_build_object('success', false, 'error', 'El trabajador y el casillero pertenecen a delegaciones distintas');
  end if;

  -- 6. Verificar si el trabajador ya tiene otro locker activo
  select a.id, l.locker_number into v_existing_worker_asg
  from public.union_locker_assignments a
  join public.union_lockers l on l.id = a.locker_id
  where a.worker_id = p_worker_id and a.status = 'active'
  limit 1;

  if found then
    if not coalesce(p_admin_override, false) then
      return jsonb_build_object(
        'success', false,
        'error', 'El trabajador ya tiene asignado el casillero #' || v_existing_worker_asg.locker_number || '. Se requiere autorización administrativa con motivo.'
      );
    end if;

    -- Validar privilegios de administrador sindical para autorizar casillero extra
    if not public.union_is_admin(v_locker.delegation_id) then
      raise exception 'Se requieren privilegios de administrador sindical para autorizar casillero adicional';
    end if;

    if p_admin_override_reason is null or trim(p_admin_override_reason) = '' then
      return jsonb_build_object(
        'success', false,
        'error', 'El override administrativo requiere un motivo justificado obligatorio'
      );
    end if;
  end if;

  -- 7. Crear la asignación atómica
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

  -- 8. Actualizar estado del casillero
  update public.union_lockers
  set
    status = 'assigned',
    reserved_for_worker_id = null,
    reservation_reason = '',
    reserved_until = null,
    updated_at = now()
  where id = p_locker_id;

  -- 9. Registrar auditoría con sanitización de PII
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
-- 2. Liberación Atómica Segura (union_release_locker)
-- ============================================================
create or replace function public.union_release_locker(
  p_assignment_id uuid,
  p_release_reason text default 'Liberación ordinaria',
  p_released_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_asg record;
  v_locker record;
begin
  -- 1. Resolver actor de forma estricta
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- 2. Bloquear asignación FOR UPDATE
  select * into v_asg
  from public.union_locker_assignments
  where id = p_assignment_id and status = 'active'
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Asignación activa no encontrada');
  end if;

  -- 3. Bloquear locker FOR UPDATE
  select * into v_locker
  from public.union_lockers
  where id = v_asg.locker_id
  for update;

  -- 4. Verificar membresía en la delegación
  if not public.union_is_member(v_locker.delegation_id) then
    raise exception 'No autorizado para operar en esta delegación';
  end if;

  -- 5. Marcar liberada la asignación
  update public.union_locker_assignments
  set
    status = 'released',
    released_at = now(),
    release_reason = coalesce(p_release_reason, 'Liberación')
  where id = p_assignment_id;

  -- 6. Poner casillero en disponible (conservando su condición física)
  update public.union_lockers
  set
    status = 'available',
    updated_at = now()
  where id = v_asg.locker_id;

  -- 7. Registrar auditoría
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
    'locker.released',
    'union_locker',
    v_asg.locker_id::text,
    jsonb_build_object(
      'locker_number', v_locker.locker_number,
      'assignment_id', p_assignment_id,
      'worker_id', v_asg.worker_id,
      'release_reason', coalesce(p_release_reason, '')
    )
  );

  return jsonb_build_object(
    'success', true,
    'locker_number', v_locker.locker_number
  );
end;
$$;

-- ============================================================
-- 3. Reubicación Atómica Segura (union_move_locker_assignment)
-- ============================================================
create or replace function public.union_move_locker_assignment(
  p_from_locker_id uuid,
  p_to_locker_id uuid,
  p_move_reason text default 'Reubicación de casillero',
  p_moved_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_from_locker record;
  v_to_locker record;
  v_from_asg record;
  v_new_asg_id uuid;
  v_first_id uuid;
  v_second_id uuid;
begin
  -- 1. Resolver actor
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_from_locker_id = p_to_locker_id then
    return jsonb_build_object('success', false, 'error', 'El casillero de origen y destino son el mismo');
  end if;

  -- Prevención estricta de deadlock ordenando los locks por ID
  if p_from_locker_id < p_to_locker_id then
    v_first_id := p_from_locker_id;
    v_second_id := p_to_locker_id;
  else
    v_first_id := p_to_locker_id;
    v_second_id := p_from_locker_id;
  end if;

  perform 1 from public.union_lockers where id = v_first_id for update;
  perform 1 from public.union_lockers where id = v_second_id for update;

  select * into v_from_locker from public.union_lockers where id = p_from_locker_id;
  select * into v_to_locker from public.union_lockers where id = p_to_locker_id;

  if not found or v_to_locker.id is null then
    return jsonb_build_object('success', false, 'error', 'Uno de los casilleros no existe');
  end if;

  -- 2. Validar que ambos casilleros pertenezcan a la misma delegación
  if v_from_locker.delegation_id <> v_to_locker.delegation_id then
    raise exception 'Los casilleros pertenecen a delegaciones distintas';
  end if;

  -- 3. Verificar membresía
  if not public.union_is_member(v_from_locker.delegation_id) then
    raise exception 'No autorizado para operar en esta delegación';
  end if;

  if v_to_locker.condition in ('maintenance', 'blocked') then
    return jsonb_build_object('success', false, 'error', 'El casillero destino se encuentra en mantenimiento o bloqueado');
  end if;

  if v_to_locker.status not in ('available', 'disponible') then
    return jsonb_build_object('success', false, 'error', 'El casillero destino #' || v_to_locker.locker_number || ' no está disponible');
  end if;

  -- Obtener asignación activa del origen
  select * into v_from_asg
  from public.union_locker_assignments
  where locker_id = p_from_locker_id and status = 'active'
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'El casillero origen #' || v_from_locker.locker_number || ' no tiene una asignación activa');
  end if;

  -- 4. Liberar asignación origen
  update public.union_locker_assignments
  set
    status = 'released',
    released_at = now(),
    release_reason = 'Reubicado a locker #' || v_to_locker.locker_number || ' (' || coalesce(p_move_reason, '') || ')'
  where id = v_from_asg.id;

  update public.union_lockers
  set status = 'available', updated_at = now()
  where id = p_from_locker_id;

  -- 5. Crear asignación destino
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
    p_to_locker_id,
    v_from_asg.worker_id,
    now(),
    'active',
    'Reubicado desde locker #' || v_from_locker.locker_number || ' (' || coalesce(p_move_reason, '') || ')',
    v_from_asg.admin_override,
    v_from_asg.admin_override_reason,
    v_actor
  ) returning id into v_new_asg_id;

  update public.union_lockers
  set status = 'assigned', updated_at = now()
  where id = p_to_locker_id;

  -- 6. Registrar auditoría
  insert into public.union_audit_log (
    delegation_id,
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_from_locker.delegation_id,
    v_actor,
    'locker.moved',
    'union_locker',
    p_to_locker_id::text,
    jsonb_build_object(
      'from_locker_number', v_from_locker.locker_number,
      'to_locker_number', v_to_locker.locker_number,
      'worker_id', v_from_asg.worker_id,
      'reason', coalesce(p_move_reason, ''),
      'old_assignment_id', v_from_asg.id,
      'new_assignment_id', v_new_asg_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'from_locker_number', v_from_locker.locker_number,
    'to_locker_number', v_to_locker.locker_number,
    'new_assignment_id', v_new_asg_id
  );
end;
$$;

-- ============================================================
-- 4. Intercambio Atómico Seguro (union_swap_locker_assignments)
-- ============================================================
create or replace function public.union_swap_locker_assignments(
  p_locker_a_id uuid,
  p_locker_b_id uuid,
  p_swap_reason text default 'Intercambio mutuo de casilleros',
  p_swapped_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_locker_a record;
  v_locker_b record;
  v_asg_a record;
  v_asg_b record;
  v_new_asg_a_id uuid;
  v_new_asg_b_id uuid;
  v_first_id uuid;
  v_second_id uuid;
begin
  -- 1. Resolver actor
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_locker_a_id = p_locker_b_id then
    return jsonb_build_object('success', false, 'error', 'No se puede intercambiar un casillero consigo mismo');
  end if;

  -- Prevención estricta de deadlock ordenando los locks por ID
  if p_locker_a_id < p_locker_b_id then
    v_first_id := p_locker_a_id;
    v_second_id := p_locker_b_id;
  else
    v_first_id := p_locker_b_id;
    v_second_id := p_locker_a_id;
  end if;

  perform 1 from public.union_lockers where id = v_first_id for update;
  perform 1 from public.union_lockers where id = v_second_id for update;

  select * into v_locker_a from public.union_lockers where id = p_locker_a_id;
  select * into v_locker_b from public.union_lockers where id = p_locker_b_id;

  if not found or v_locker_b.id is null then
    return jsonb_build_object('success', false, 'error', 'Uno de los casilleros no existe');
  end if;

  -- 2. Validar que ambos casilleros pertenezcan a la misma delegación
  if v_locker_a.delegation_id <> v_locker_b.delegation_id then
    raise exception 'Los casilleros pertenecen a delegaciones distintas';
  end if;

  -- 3. Requiere rol de administrador sindical
  if not public.union_is_admin(v_locker_a.delegation_id) then
    raise exception 'Se requieren privilegios de administrador sindical para intercambiar casilleros';
  end if;

  select * into v_asg_a from public.union_locker_assignments where locker_id = p_locker_a_id and status = 'active' for update;
  select * into v_asg_b from public.union_locker_assignments where locker_id = p_locker_b_id and status = 'active' for update;

  if not found or v_asg_a.id is null or v_asg_b.id is null then
    return jsonb_build_object('success', false, 'error', 'Ambos casilleros deben tener una asignación activa para poder ser intercambiados');
  end if;

  -- 4. Liberar asignaciones actuales
  update public.union_locker_assignments
  set
    status = 'released',
    released_at = now(),
    release_reason = 'Intercambio con locker #' || v_locker_b.locker_number || ' (' || coalesce(p_swap_reason, '') || ')'
  where id = v_asg_a.id;

  update public.union_locker_assignments
  set
    status = 'released',
    released_at = now(),
    release_reason = 'Intercambio con locker #' || v_locker_a.locker_number || ' (' || coalesce(p_swap_reason, '') || ')'
  where id = v_asg_b.id;

  -- 5. Crear asignaciones cruzadas
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
    p_locker_b_id,
    v_asg_a.worker_id,
    now(),
    'active',
    'Intercambio desde locker #' || v_locker_a.locker_number || ' (' || coalesce(p_swap_reason, '') || ')',
    v_asg_a.admin_override,
    v_asg_a.admin_override_reason,
    v_actor
  ) returning id into v_new_asg_a_id;

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
    p_locker_a_id,
    v_asg_b.worker_id,
    now(),
    'active',
    'Intercambio desde locker #' || v_locker_b.locker_number || ' (' || coalesce(p_swap_reason, '') || ')',
    v_asg_b.admin_override,
    v_asg_b.admin_override_reason,
    v_actor
  ) returning id into v_new_asg_b_id;

  -- 6. Auditoría
  insert into public.union_audit_log (
    delegation_id,
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_locker_a.delegation_id,
    v_actor,
    'locker.swapped',
    'union_locker',
    p_locker_a_id::text,
    jsonb_build_object(
      'locker_a_number', v_locker_a.locker_number,
      'locker_b_number', v_locker_b.locker_number,
      'worker_a_id', v_asg_a.worker_id,
      'worker_b_id', v_asg_b.worker_id,
      'reason', coalesce(p_swap_reason, ''),
      'new_asg_a_id', v_new_asg_a_id,
      'new_asg_b_id', v_new_asg_b_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'locker_a_number', v_locker_a.locker_number,
    'locker_b_number', v_locker_b.locker_number,
    'new_asg_a_id', v_new_asg_a_id,
    'new_asg_b_id', v_new_asg_b_id
  );
end;
$$;

-- ============================================================
-- 5. Permisos de Ejecución Estrictos
-- ============================================================
revoke all on function public.union_assign_locker(uuid, uuid, text, boolean, text, uuid) from public, anon;
grant execute on function public.union_assign_locker(uuid, uuid, text, boolean, text, uuid) to authenticated, service_role;

revoke all on function public.union_release_locker(uuid, text, uuid) from public, anon;
grant execute on function public.union_release_locker(uuid, text, uuid) to authenticated, service_role;

revoke all on function public.union_move_locker_assignment(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.union_move_locker_assignment(uuid, uuid, text, uuid) to authenticated, service_role;

revoke all on function public.union_swap_locker_assignments(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.union_swap_locker_assignments(uuid, uuid, text, uuid) to authenticated, service_role;
