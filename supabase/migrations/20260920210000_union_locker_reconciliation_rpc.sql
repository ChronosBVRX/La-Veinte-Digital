-- 20260920210000_union_locker_reconciliation_rpc.sql
-- RPC transaccional canónico para resolución atómica de casos de conciliación de lockers.

CREATE OR REPLACE FUNCTION public.union_resolve_locker_review_case(
  p_delegation_id uuid,
  p_case_type text,
  p_action text,
  p_review_item_ids uuid[],
  p_selected_locker_id uuid DEFAULT NULL,
  p_selected_worker_id uuid DEFAULT NULL,
  p_selected_locker_number text DEFAULT NULL,
  p_selected_employee_number text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locker_id uuid := p_selected_locker_id;
  v_locker_number text := p_selected_locker_number;
  v_worker_id uuid := p_selected_worker_id;
  v_employee_number text := p_selected_employee_number;
  v_new_asgn_id uuid := NULL;
  v_prev_locker_ids uuid[];
  v_released_locker_id uuid;
  v_item_count int := 0;
  v_resolved_item_ids uuid[];
BEGIN
  -- 1. Bloqueo consultivo por delegación para evitar concurrencia en la conciliación
  PERFORM pg_advisory_xact_lock(hashtext('union_lockers_' || p_delegation_id::text));

  -- 2. Manejo de acción IGNORE (Omitir caso)
  IF p_action = 'ignore' THEN
    UPDATE union_locker_review_items
    SET status = 'ignored',
        resolved_by = p_user_id,
        resolved_at = clock_timestamp(),
        resolution = jsonb_build_object(
          'action', 'ignored',
          'case_type', p_case_type,
          'notes', p_notes
        ),
        updated_at = clock_timestamp()
    WHERE id = ANY(p_review_item_ids)
      AND delegation_id = p_delegation_id
    RETURNING id INTO v_resolved_item_ids;

    GET DIAGNOSTICS v_item_count = ROW_COUNT;

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'ignore',
      'resolvedCount', v_item_count,
      'reviewItemIds', p_review_item_ids
    );
  END IF;

  -- 3. Resolver identificadores de casillero y trabajador si se pasaron por clave natural
  IF v_locker_id IS NULL AND v_locker_number IS NOT NULL THEN
    SELECT id INTO v_locker_id
    FROM union_lockers
    WHERE delegation_id = p_delegation_id
      AND locker_number = v_locker_number
    LIMIT 1;
  END IF;

  IF v_worker_id IS NULL AND v_employee_number IS NOT NULL THEN
    SELECT id INTO v_worker_id
    FROM union_workers
    WHERE delegation_id = p_delegation_id
      AND employee_number = v_employee_number
    LIMIT 1;
  END IF;

  -- Para acciones que requieren asignación, asegurar existencia de casillero y trabajador
  IF p_action IN ('select_locker_for_worker', 'select_worker_for_locker', 'link_worker_to_locker') THEN
    -- Si el casillero físico no existe aún en union_lockers, crearlo automáticamente
    IF v_locker_id IS NULL AND v_locker_number IS NOT NULL THEN
      INSERT INTO union_lockers (
        delegation_id,
        locker_number,
        status,
        condition,
        notes
      ) VALUES (
        p_delegation_id,
        v_locker_number,
        'available',
        'ok',
        'Creado automáticamente durante conciliación de pendientes'
      )
      RETURNING id INTO v_locker_id;
    END IF;

    IF v_locker_id IS NULL THEN
      RAISE EXCEPTION 'No se pudo identificar el casillero para la conciliación';
    END IF;

    IF v_worker_id IS NULL THEN
      RAISE EXCEPTION 'No se pudo identificar el trabajador para la conciliación';
    END IF;

    -- Obtener número de casillero oficial
    SELECT locker_number INTO v_locker_number
    FROM union_lockers
    WHERE id = v_locker_id;

    -- Obtener matrícula oficial
    SELECT employee_number INTO v_employee_number
    FROM union_workers
    WHERE id = v_worker_id;

    -- 4. Liberar asignaciones previas del trabajador en OTROS casilleros (movimiento A -> B)
    SELECT array_agg(locker_id) INTO v_prev_locker_ids
    FROM union_locker_assignments
    WHERE worker_id = v_worker_id
      AND status = 'active'
      AND locker_id != v_locker_id;

    IF v_prev_locker_ids IS NOT NULL AND array_length(v_prev_locker_ids, 1) > 0 THEN
      UPDATE union_locker_assignments
      SET status = 'released',
          release_reason = 'reconciliation_released_previous_locker',
          released_at = clock_timestamp()
      WHERE worker_id = v_worker_id
        AND status = 'active'
        AND locker_id != v_locker_id;

      -- Marcar los casilleros anteriores liberados como disponibles
      FOREACH v_released_locker_id IN ARRAY v_prev_locker_ids
      LOOP
        UPDATE union_lockers
        SET status = 'available',
            updated_at = clock_timestamp()
        WHERE id = v_released_locker_id
          AND NOT EXISTS (
            SELECT 1 FROM union_locker_assignments
            WHERE locker_id = v_released_locker_id AND status = 'active'
          );
      END LOOP;
    END IF;

    -- 5. Liberar asignación activa previa en el casillero seleccionado si pertenecía a OTRA persona
    UPDATE union_locker_assignments
    SET status = 'released',
        release_reason = 'reconciliation_reassigned_locker',
        released_at = clock_timestamp()
    WHERE locker_id = v_locker_id
      AND status = 'active'
      AND worker_id != v_worker_id;

    -- 6. Insertar o reactivar asignación activa canónica con source = 'reconciliation'
    -- Si ya existía asignación activa idéntica para (locker, worker), reutilizarla
    SELECT id INTO v_new_asgn_id
    FROM union_locker_assignments
    WHERE locker_id = v_locker_id
      AND worker_id = v_worker_id
      AND status = 'active'
    LIMIT 1;

    IF v_new_asgn_id IS NULL THEN
      INSERT INTO union_locker_assignments (
        locker_id,
        worker_id,
        status,
        source,
        assignment_reason,
        assigned_at,
        created_by
      ) VALUES (
        v_locker_id,
        v_worker_id,
        'active',
        'reconciliation',
        COALESCE(p_notes, 'resolved_case:' || p_case_type),
        clock_timestamp(),
        p_user_id
      )
      RETURNING id INTO v_new_asgn_id;
    END IF;

    -- 7. Actualizar estado del casillero a 'assigned'
    UPDATE union_lockers
    SET status = 'assigned',
        updated_at = clock_timestamp()
    WHERE id = v_locker_id;

    -- 8. Resolver atómicamente todos los review items pasados explícitamente en el caso
    UPDATE union_locker_review_items
    SET status = 'resolved',
        resolved_by = p_user_id,
        resolved_at = clock_timestamp(),
        resolution = jsonb_build_object(
          'action', p_action,
          'case_type', p_case_type,
          'selected_locker_id', v_locker_id,
          'selected_locker_number', v_locker_number,
          'selected_worker_id', v_worker_id,
          'selected_employee_number', v_employee_number,
          'assignment_id', v_new_asgn_id,
          'notes', p_notes
        ),
        updated_at = clock_timestamp()
    WHERE id = ANY(p_review_item_ids)
      AND delegation_id = p_delegation_id;

    GET DIAGNOSTICS v_item_count = ROW_COUNT;

    -- 9. Co-resolución inteligente para items del mismo conflicto en la delegación:
    -- A) Si es WORKER_MULTIPLE_LOCKERS, cerrar cualquier otro item pendiente para este trabajador
    IF p_case_type = 'WORKER_MULTIPLE_LOCKERS' AND v_employee_number IS NOT NULL THEN
      UPDATE union_locker_review_items
      SET status = 'resolved',
          resolved_by = p_user_id,
          resolved_at = clock_timestamp(),
          resolution = jsonb_build_object(
            'action', 'co_resolved_by_worker_multiple_lockers_selection',
            'selected_locker_id', v_locker_id,
            'selected_locker_number', v_locker_number,
            'selected_worker_id', v_worker_id,
            'assignment_id', v_new_asgn_id
          ),
          updated_at = clock_timestamp()
      WHERE delegation_id = p_delegation_id
        AND source_employee_number = v_employee_number
        AND reason = 'WORKER_MULTIPLE_LOCKERS'
        AND status = 'pending';
    END IF;

    -- B) Si es LOCKER_MULTIPLE_WORKERS / DUPLICATE_LOCKER_DIFFERENT_WORKERS, cerrar otros items para este casillero
    IF (p_case_type = 'LOCKER_MULTIPLE_WORKERS' OR p_case_type = 'DUPLICATE_LOCKER_DIFFERENT_WORKERS') AND v_locker_number IS NOT NULL THEN
      UPDATE union_locker_review_items
      SET status = 'resolved',
          resolved_by = p_user_id,
          resolved_at = clock_timestamp(),
          resolution = jsonb_build_object(
            'action', 'co_resolved_by_locker_multiple_workers_selection',
            'selected_locker_id', v_locker_id,
            'selected_locker_number', v_locker_number,
            'selected_worker_id', v_worker_id,
            'assignment_id', v_new_asgn_id
          ),
          updated_at = clock_timestamp()
      WHERE delegation_id = p_delegation_id
        AND locker_number = v_locker_number
        AND reason IN ('LOCKER_MULTIPLE_WORKERS', 'DUPLICATE_LOCKER_DIFFERENT_WORKERS', 'LOCKER_ASSIGNED_TO_OTHER_WORKER')
        AND status = 'pending';
    END IF;

    -- 10. Actualizar resolution_state en union_locker_import_source_rows si existe
    UPDATE union_locker_import_source_rows
    SET resolution_state = 'resolved',
        matched_worker_id = v_worker_id,
        matched_locker_id = v_locker_id,
        matched_assignment_id = v_new_asgn_id,
        updated_at = clock_timestamp()
    WHERE delegation_id = p_delegation_id
      AND (
        (v_locker_number IS NOT NULL AND locker_normalized = v_locker_number)
        OR (v_employee_number IS NOT NULL AND matricula_normalized = v_employee_number)
      )
      AND resolution_state = 'pending';

    -- 11. Auditoría
    INSERT INTO union_audit_log (
      delegation_id,
      user_id,
      entity_type,
      entity_id,
      action,
      metadata
    ) VALUES (
      p_delegation_id,
      p_user_id,
      'union_locker_review_items',
      p_review_item_ids[1]::text,
      'resolve_locker_review_case',
      jsonb_build_object(
        'case_type', p_case_type,
        'action', p_action,
        'locker_number', v_locker_number,
        'employee_number', v_employee_number,
        'resolved_item_ids_count', v_item_count,
        'assignment_id', v_new_asgn_id
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'action', p_action,
      'assignmentId', v_new_asgn_id,
      'selectedLockerId', v_locker_id,
      'selectedLockerNumber', v_locker_number,
      'selectedWorkerId', v_worker_id,
      'selectedEmployeeNumber', v_employee_number,
      'resolvedCount', v_item_count
    );
  END IF;

  RAISE EXCEPTION 'Acción de conciliación no reconocida: %', p_action;
END;
$$;


-- Función de resolución segura en lote para coincidencias verificadas
CREATE OR REPLACE FUNCTION public.union_batch_resolve_safe_matches(
  p_delegation_id uuid,
  p_matches jsonb, -- Array de objetos: [{"reviewItemId": "...", "workerId": "...", "lockerId": "..."}]
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match jsonb;
  v_review_item_id uuid;
  v_worker_id uuid;
  v_locker_id uuid;
  v_locker_cond text;
  v_has_active_locker_asgn boolean;
  v_has_active_worker_asgn boolean;
  v_new_asgn_id uuid;
  v_linked_count int := 0;
  v_skipped_count int := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('union_lockers_' || p_delegation_id::text));

  FOR v_match IN SELECT * FROM jsonb_array_elements(p_matches)
  LOOP
    v_review_item_id := (v_match->>'reviewItemId')::uuid;
    v_worker_id := (v_match->>'workerId')::uuid;
    v_locker_id := (v_match->>'lockerId')::uuid;

    -- Verificar condiciones estrictas de seguridad:
    -- 1. Condición física del casillero debe ser 'ok' o null
    SELECT condition INTO v_locker_cond
    FROM union_lockers
    WHERE id = v_locker_id AND delegation_id = p_delegation_id;

    IF v_locker_cond IN ('maintenance', 'damaged', 'blocked', 'reserved') THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- 2. El casillero NO debe tener asignación activa
    SELECT EXISTS (
      SELECT 1 FROM union_locker_assignments
      WHERE locker_id = v_locker_id AND status = 'active'
    ) INTO v_has_active_locker_asgn;

    IF v_has_active_locker_asgn THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- 3. El trabajador NO debe tener ya otro casillero activo
    SELECT EXISTS (
      SELECT 1 FROM union_locker_assignments
      WHERE worker_id = v_worker_id AND status = 'active'
    ) INTO v_has_active_worker_asgn;

    IF v_has_active_worker_asgn THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Cumple todas las condiciones de seguridad -> Vincular
    INSERT INTO union_locker_assignments (
      locker_id,
      worker_id,
      status,
      source,
      assignment_reason,
      assigned_at,
      created_by
    ) VALUES (
      v_locker_id,
      v_worker_id,
      'active',
      'batch_reconciliation_safe_match',
      'batch_matched_review_item:' || v_review_item_id::text,
      clock_timestamp(),
      p_user_id
    )
    RETURNING id INTO v_new_asgn_id;

    UPDATE union_lockers
    SET status = 'assigned',
        updated_at = clock_timestamp()
    WHERE id = v_locker_id;

    UPDATE union_locker_review_items
    SET status = 'resolved',
        resolved_by = p_user_id,
        resolved_at = clock_timestamp(),
        resolution = jsonb_build_object(
          'action', 'batch_safe_match',
          'assignment_id', v_new_asgn_id,
          'worker_id', v_worker_id,
          'locker_id', v_locker_id
        ),
        updated_at = clock_timestamp()
    WHERE id = v_review_item_id
      AND delegation_id = p_delegation_id;

    v_linked_count := v_linked_count + 1;
  END LOOP;

  -- Auditoría del lote seguro
  INSERT INTO union_audit_log (
    delegation_id,
    user_id,
    entity_type,
    entity_id,
    action,
    metadata
  ) VALUES (
    p_delegation_id,
    p_user_id,
    'union_locker_review_items',
    p_delegation_id::text,
    'batch_resolve_safe_matches',
    jsonb_build_object(
      'linked_count', v_linked_count,
      'skipped_count', v_skipped_count
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'linkedCount', v_linked_count,
    'skippedCount', v_skipped_count
  );
END;
$$;
