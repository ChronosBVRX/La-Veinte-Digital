-- ============================================================
-- MIGRATION: 20260920220000_union_locker_inventory_management.sql
-- Lockers como Inventario Físico Completo:
-- Columnas de archivo, RPCs canónicas de CRUD, renumeración segura,
-- archivado/restauración, borrado físico condicional y resumen de inventario.
-- SNTSS Sección XX · Delegación XXI (HGR No. 1 Charo)
-- ============================================================

-- 1. Columnas de Archivado en union_lockers
ALTER TABLE public.union_lockers
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text NULL,
  ADD COLUMN IF NOT EXISTS archive_source text NULL;

CREATE INDEX IF NOT EXISTS union_lockers_archived_idx
  ON public.union_lockers (delegation_id, archived_at);

-- 2. Función Canónica: union_create_locker
CREATE OR REPLACE FUNCTION public.union_create_locker(
  p_delegation_id uuid,
  p_locker_number text,
  p_physical_code text DEFAULT NULL,
  p_zone_id uuid DEFAULT NULL,
  p_bank_id uuid DEFAULT NULL,
  p_row_position integer DEFAULT NULL,
  p_column_position integer DEFAULT NULL,
  p_position_label text DEFAULT NULL,
  p_condition text DEFAULT 'ok',
  p_notes text DEFAULT '',
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_norm_number text;
  v_existing record;
  v_new_id uuid;
  v_cond text;
BEGIN
  -- Normalización básica de identificador preservando sufijos alfanuméricos
  v_norm_number := upper(trim(regexp_replace(p_locker_number, '^[#\s]+|\s+$', '', 'g')));
  IF v_norm_number = '' OR v_norm_number IS NULL THEN
    RAISE EXCEPTION 'El identificador del casillero es obligatorio.';
  END IF;

  -- Validar duplicados en la misma delegación
  SELECT id, archived_at INTO v_existing
  FROM public.union_lockers
  WHERE delegation_id = p_delegation_id
    AND upper(trim(locker_number)) = v_norm_number
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.archived_at IS NULL THEN
      RAISE EXCEPTION 'Ya existe el Locker %.', v_norm_number;
    ELSE
      RAISE EXCEPTION 'El Locker % ya existe en el archivo histórico. Puede restaurarlo al inventario en lugar de crearlo.', v_norm_number;
    END IF;
  END IF;

  v_cond := lower(trim(coalesce(p_condition, 'ok')));
  IF v_cond NOT IN ('ok', 'maintenance', 'blocked', 'damaged') THEN
    v_cond := 'ok';
  END IF;

  INSERT INTO public.union_lockers (
    delegation_id,
    locker_number,
    physical_code,
    zone_id,
    bank_id,
    row_position,
    column_position,
    position_label,
    condition,
    notes,
    status,
    source,
    created_at,
    updated_at
  ) VALUES (
    p_delegation_id,
    v_norm_number,
    nullif(trim(p_physical_code), ''),
    p_zone_id,
    p_bank_id,
    p_row_position,
    p_column_position,
    nullif(trim(p_position_label), ''),
    v_cond,
    coalesce(trim(p_notes), ''),
    'available',
    'manual',
    now(),
    now()
  )
  RETURNING id INTO v_new_id;

  -- Auditoría
  INSERT INTO public.union_audit_logs (
    delegation_id,
    entity_type,
    entity_id,
    action,
    metadata,
    created_at
  ) VALUES (
    p_delegation_id,
    'union_locker',
    v_new_id,
    'locker.created',
    jsonb_build_object(
      'locker_number', v_norm_number,
      'physical_code', p_physical_code,
      'condition', v_cond,
      'created_by', p_user_id
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'locker_number', v_norm_number
  );
END;
$$;

-- 3. Función Canónica: union_update_locker (con soporte de renumeración segura)
CREATE OR REPLACE FUNCTION public.union_update_locker(
  p_locker_id uuid,
  p_new_locker_number text,
  p_physical_code text DEFAULT NULL,
  p_zone_id uuid DEFAULT NULL,
  p_bank_id uuid DEFAULT NULL,
  p_row_position integer DEFAULT NULL,
  p_column_position integer DEFAULT NULL,
  p_position_label text DEFAULT NULL,
  p_condition text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_renumber_reason text DEFAULT '',
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_locker record;
  v_norm_number text;
  v_collision record;
  v_cond text;
  v_renumbered boolean := false;
  v_old_number text;
BEGIN
  SELECT * INTO v_locker
  FROM public.union_lockers
  WHERE id = p_locker_id
  FOR UPDATE;

  IF v_locker.id IS NULL THEN
    RAISE EXCEPTION 'Casillero no encontrado.';
  END IF;

  v_norm_number := upper(trim(regexp_replace(p_new_locker_number, '^[#\s]+|\s+$', '', 'g')));
  IF v_norm_number = '' OR v_norm_number IS NULL THEN
    RAISE EXCEPTION 'El identificador del casillero no puede ser vacío.';
  END IF;

  -- Renumeración
  IF v_norm_number != upper(trim(v_locker.locker_number)) THEN
    SELECT id, locker_number INTO v_collision
    FROM public.union_lockers
    WHERE delegation_id = v_locker.delegation_id
      AND upper(trim(locker_number)) = v_norm_number
      AND id != p_locker_id
    LIMIT 1;

    IF v_collision.id IS NOT NULL THEN
      RAISE EXCEPTION 'Ya existe el Locker % en esta delegación.', v_norm_number;
    END IF;

    v_renumbered := true;
    v_old_number := v_locker.locker_number;
  END IF;

  v_cond := v_locker.condition;
  IF p_condition IS NOT NULL THEN
    v_cond := lower(trim(p_condition));
    IF v_cond NOT IN ('ok', 'maintenance', 'blocked', 'damaged') THEN
      v_cond := v_locker.condition;
    END IF;
  END IF;

  UPDATE public.union_lockers
  SET
    locker_number = v_norm_number,
    physical_code = nullif(trim(p_physical_code), ''),
    zone_id = p_zone_id,
    bank_id = p_bank_id,
    row_position = p_row_position,
    column_position = p_column_position,
    position_label = nullif(trim(p_position_label), ''),
    condition = v_cond,
    notes = coalesce(p_notes, notes),
    maintenance_date = CASE WHEN v_cond IN ('maintenance', 'damaged') AND v_locker.condition NOT IN ('maintenance', 'damaged') THEN now() ELSE maintenance_date END,
    updated_at = now()
  WHERE id = p_locker_id;

  -- Registro de auditoría por renumeración si ocurrió
  IF v_renumbered THEN
    INSERT INTO public.union_audit_logs (
      delegation_id,
      entity_type,
      entity_id,
      action,
      metadata,
      created_at
    ) VALUES (
      v_locker.delegation_id,
      'union_locker',
      p_locker_id,
      'locker.renumbered',
      jsonb_build_object(
        'old_number', v_old_number,
        'new_number', v_norm_number,
        'motivo', coalesce(trim(p_renumber_reason), 'Renumeración administrativa'),
        'actor', p_user_id,
        'fecha', now()
      ),
      now()
    );
  END IF;

  -- Auditoría general de actualización
  INSERT INTO public.union_audit_logs (
    delegation_id,
    entity_type,
    entity_id,
    action,
    metadata,
    created_at
  ) VALUES (
    v_locker.delegation_id,
    'union_locker',
    p_locker_id,
    'locker.updated',
    jsonb_build_object(
      'locker_number', v_norm_number,
      'physical_code', p_physical_code,
      'condition', v_cond,
      'zone_id', p_zone_id,
      'bank_id', p_bank_id,
      'updated_by', p_user_id
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', p_locker_id,
    'locker_number', v_norm_number,
    'renumbered', v_renumbered
  );
END;
$$;

-- 4. Función Canónica: union_archive_locker
CREATE OR REPLACE FUNCTION public.union_archive_locker(
  p_locker_id uuid,
  p_reason text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_locker record;
  v_clean_reason text;
BEGIN
  SELECT * INTO v_locker
  FROM public.union_lockers
  WHERE id = p_locker_id
  FOR UPDATE;

  IF v_locker.id IS NULL THEN
    RAISE EXCEPTION 'Casillero no encontrado.';
  END IF;

  IF v_locker.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'El Locker % ya se encuentra retirado del inventario.', v_locker.locker_number;
  END IF;

  v_clean_reason := trim(coalesce(p_reason, ''));
  IF v_clean_reason = '' THEN
    RAISE EXCEPTION 'Debes proporcionar un motivo para retirar el casillero del inventario.';
  END IF;

  -- Regla 1: No archivar si tiene assignment activa
  IF EXISTS (
    SELECT 1 FROM public.union_locker_assignments
    WHERE locker_id = p_locker_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'No puedes retirar el Locker % porque está asignado actualmente a un trabajador. Libera o mueve primero la asignación.', v_locker.locker_number;
  END IF;

  -- Regla 2: No archivar si tiene reserva activa
  IF v_locker.reserved_for_worker_id IS NOT NULL THEN
    RAISE EXCEPTION 'No puedes retirar el Locker % porque tiene una reserva activa. Cancela la reserva primero.', v_locker.locker_number;
  END IF;

  -- Regla 3: No archivar si participa en incidencias pendientes
  IF EXISTS (
    SELECT 1 FROM public.union_locker_review_items
    WHERE locker_id = p_locker_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'No puedes retirar el Locker % porque participa en incidencias de conciliación pendientes. Resuélvelas primero.', v_locker.locker_number;
  END IF;

  UPDATE public.union_lockers
  SET
    archived_at = now(),
    archived_by = p_user_id,
    archive_reason = v_clean_reason,
    archive_source = 'manual_inventory',
    updated_at = now()
  WHERE id = p_locker_id;

  INSERT INTO public.union_audit_logs (
    delegation_id,
    entity_type,
    entity_id,
    action,
    metadata,
    created_at
  ) VALUES (
    v_locker.delegation_id,
    'union_locker',
    p_locker_id,
    'locker.archived',
    jsonb_build_object(
      'locker_number', v_locker.locker_number,
      'reason', v_clean_reason,
      'archived_by', p_user_id
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', p_locker_id,
    'locker_number', v_locker.locker_number,
    'archived_at', now()
  );
END;
$$;

-- 5. Función Canónica: union_restore_locker
CREATE OR REPLACE FUNCTION public.union_restore_locker(
  p_locker_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_locker record;
  v_collision record;
BEGIN
  SELECT * INTO v_locker
  FROM public.union_lockers
  WHERE id = p_locker_id
  FOR UPDATE;

  IF v_locker.id IS NULL THEN
    RAISE EXCEPTION 'Casillero no encontrado.';
  END IF;

  IF v_locker.archived_at IS NULL THEN
    RAISE EXCEPTION 'El Locker % ya se encuentra activo en el inventario.', v_locker.locker_number;
  END IF;

  -- Validar que el identificador no haya sido reutilizado por otro casillero activo
  SELECT id INTO v_collision
  FROM public.union_lockers
  WHERE delegation_id = v_locker.delegation_id
    AND upper(trim(locker_number)) = upper(trim(v_locker.locker_number))
    AND id != p_locker_id
    AND archived_at IS NULL
  LIMIT 1;

  IF v_collision.id IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede restaurar: el identificador % ya está en uso por otro casillero activo.', v_locker.locker_number;
  END IF;

  UPDATE public.union_lockers
  SET
    archived_at = NULL,
    archived_by = NULL,
    archive_reason = NULL,
    archive_source = NULL,
    updated_at = now()
  WHERE id = p_locker_id;

  INSERT INTO public.union_audit_logs (
    delegation_id,
    entity_type,
    entity_id,
    action,
    metadata,
    created_at
  ) VALUES (
    v_locker.delegation_id,
    'union_locker',
    p_locker_id,
    'locker.restored',
    jsonb_build_object(
      'locker_number', v_locker.locker_number,
      'restored_by', p_user_id
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', p_locker_id,
    'locker_number', v_locker.locker_number
  );
END;
$$;

-- 6. Función Canónica: union_delete_unused_locker (Hard delete seguro)
CREATE OR REPLACE FUNCTION public.union_delete_unused_locker(
  p_locker_id uuid,
  p_confirm_number text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_locker record;
  v_del_id uuid;
  v_num text;
BEGIN
  SELECT * INTO v_locker
  FROM public.union_lockers
  WHERE id = p_locker_id
  FOR UPDATE;

  IF v_locker.id IS NULL THEN
    RAISE EXCEPTION 'Casillero no encontrado.';
  END IF;

  -- Validación de texto de confirmación
  IF upper(trim(coalesce(p_confirm_number, ''))) != upper(trim(v_locker.locker_number)) THEN
    RAISE EXCEPTION 'El número de confirmación ingresado (%) no coincide con el número del casillero (%).', p_confirm_number, v_locker.locker_number;
  END IF;

  -- 1. Verificar que NUNCA haya tenido asignaciones
  IF EXISTS (
    SELECT 1 FROM public.union_locker_assignments
    WHERE locker_id = p_locker_id
  ) THEN
    RAISE EXCEPTION 'El Locker % tiene historial de asignaciones registrado. Por integridad institucional no puede ser eliminado físicamente. Utilice la función de Archivar.', v_locker.locker_number;
  END IF;

  -- 2. Verificar que no tenga reservas
  IF v_locker.reserved_for_worker_id IS NOT NULL THEN
    RAISE EXCEPTION 'El Locker % tiene una reserva activa. Utilice la función de Archivar.', v_locker.locker_number;
  END IF;

  -- 3. Verificar que no participe en incidencias de revisión
  IF EXISTS (
    SELECT 1 FROM public.union_locker_review_items
    WHERE locker_id = p_locker_id
  ) THEN
    RAISE EXCEPTION 'El Locker % tiene incidencias registradas en la bandeja de revisión. Utilice la función de Archivar.', v_locker.locker_number;
  END IF;

  -- 4. Verificar que no provenga de filas de importación autoritativas
  IF EXISTS (
    SELECT 1 FROM public.union_locker_import_source_rows
    WHERE resolved_locker_id = p_locker_id
  ) THEN
    RAISE EXCEPTION 'El Locker % proviene de un lote de importación estructurada con trazabilidad. Utilice la función de Archivar.', v_locker.locker_number;
  END IF;

  v_del_id := v_locker.delegation_id;
  v_num := v_locker.locker_number;

  -- Auditoría antes de borrar
  INSERT INTO public.union_audit_logs (
    delegation_id,
    entity_type,
    entity_id,
    action,
    metadata,
    created_at
  ) VALUES (
    v_del_id,
    'union_locker',
    p_locker_id,
    'locker.deleted',
    jsonb_build_object(
      'locker_number', v_num,
      'physical_code', v_locker.physical_code,
      'deleted_by', p_user_id
    ),
    now()
  );

  -- Borrado físico
  DELETE FROM public.union_lockers WHERE id = p_locker_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', true,
    'locker_number', v_num
  );
END;
$$;

-- 7. Función Canónica: union_bulk_update_lockers
CREATE OR REPLACE FUNCTION public.union_bulk_update_lockers(
  p_delegation_id uuid,
  p_locker_ids uuid[],
  p_action text,
  p_params jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_count integer := 0;
  v_skipped_count integer := 0;
  v_target_zone_id uuid;
  v_target_bank_id uuid;
  v_target_cond text;
  v_reason text;
  v_lid uuid;
BEGIN
  IF p_action = 'assign_zone' THEN
    v_target_zone_id := (p_params->>'zone_id')::uuid;
    UPDATE public.union_lockers
    SET zone_id = v_target_zone_id, updated_at = now()
    WHERE delegation_id = p_delegation_id AND id = ANY(p_locker_ids);
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  ELSIF p_action = 'assign_bank' THEN
    v_target_bank_id := (p_params->>'bank_id')::uuid;
    UPDATE public.union_lockers
    SET bank_id = v_target_bank_id, updated_at = now()
    WHERE delegation_id = p_delegation_id AND id = ANY(p_locker_ids);
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  ELSIF p_action = 'set_condition' THEN
    v_target_cond := lower(trim(p_params->>'condition'));
    IF v_target_cond IN ('ok', 'maintenance', 'blocked', 'damaged') THEN
      UPDATE public.union_lockers
      SET condition = v_target_cond,
          maintenance_date = CASE WHEN v_target_cond IN ('maintenance', 'damaged') THEN now() ELSE maintenance_date END,
          updated_at = now()
      WHERE delegation_id = p_delegation_id AND id = ANY(p_locker_ids);
      GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    END IF;

  ELSIF p_action = 'archive_empty' THEN
    v_reason := coalesce(trim(p_params->>'reason'), 'Retirado masivo de casilleros desocupados');
    -- Solo archivar casilleros sin assignment activa, sin reserva y sin revisión pendiente
    FOREACH v_lid IN ARRAY p_locker_ids
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.union_locker_assignments WHERE locker_id = v_lid AND status = 'active')
         AND NOT EXISTS (SELECT 1 FROM public.union_lockers WHERE id = v_lid AND reserved_for_worker_id IS NOT NULL)
         AND NOT EXISTS (SELECT 1 FROM public.union_locker_review_items WHERE locker_id = v_lid AND status = 'pending')
      THEN
        UPDATE public.union_lockers
        SET archived_at = now(),
            archived_by = p_user_id,
            archive_reason = v_reason,
            archive_source = 'bulk_inventory',
            updated_at = now()
        WHERE id = v_lid AND archived_at IS NULL;
        v_updated_count := v_updated_count + 1;
      ELSE
        v_skipped_count := v_skipped_count + 1;
      END IF;
    END LOOP;

  ELSE
    RAISE EXCEPTION 'Acción masiva no reconocida: %', p_action;
  END IF;

  -- Auditoría
  INSERT INTO public.union_audit_logs (
    delegation_id,
    entity_type,
    entity_id,
    action,
    metadata,
    created_at
  ) VALUES (
    p_delegation_id,
    'union_lockers',
    p_delegation_id,
    'lockers.bulk_updated',
    jsonb_build_object(
      'action', p_action,
      'updated_count', v_updated_count,
      'skipped_count', v_skipped_count,
      'user_id', p_user_id
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', p_action,
    'updated_count', v_updated_count,
    'skipped_count', v_skipped_count
  );
END;
$$;

-- 8. Actualizar Función Canónica: union_get_locker_summary (Métricas de Inventario y Archivados)
CREATE OR REPLACE FUNCTION public.union_get_locker_summary(p_delegation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total integer := 0;
  v_archived integer := 0;
  v_assigned integer := 0;
  v_available integer := 0;
  v_maintenance integer := 0;
  v_blocked integer := 0;
  v_reserved integer := 0;
  v_unlocated integer := 0;
  v_pending_review integer := 0;
  v_affected_lockers integer := 0;
  v_issue_count integer := 0;
  v_waitlist integer := 0;
BEGIN
  -- 1. Total activo en inventario (no archivados)
  SELECT count(*) INTO v_total
  FROM public.union_lockers
  WHERE delegation_id = p_delegation_id
    AND archived_at IS NULL;

  -- 2. Total archivados
  SELECT count(*) INTO v_archived
  FROM public.union_lockers
  WHERE delegation_id = p_delegation_id
    AND archived_at IS NOT NULL;

  -- 3. Asignados (con asignación activa en locker no archivado)
  SELECT count(DISTINCT l.id) INTO v_assigned
  FROM public.union_lockers l
  INNER JOIN public.union_locker_assignments a
    ON a.locker_id = l.id
   AND a.status = 'active'
  WHERE l.delegation_id = p_delegation_id
    AND l.archived_at IS NULL;

  -- 4. Disponibles (no archivados y status available)
  SELECT count(*) INTO v_available
  FROM public.union_lockers
  WHERE delegation_id = p_delegation_id
    AND archived_at IS NULL
    AND status = 'available';

  -- 5. Mantenimiento (no archivados y condición mantenimiento)
  SELECT count(*) INTO v_maintenance
  FROM public.union_lockers
  WHERE delegation_id = p_delegation_id
    AND archived_at IS NULL
    AND condition IN ('maintenance', 'damaged');

  -- 6. Bloqueados (no archivados y condición bloqueado)
  SELECT count(*) INTO v_blocked
  FROM public.union_lockers
  WHERE delegation_id = p_delegation_id
    AND archived_at IS NULL
    AND condition = 'blocked';

  -- 7. Reservados (no archivados y status reserved)
  SELECT count(*) INTO v_reserved
  FROM public.union_lockers
  WHERE delegation_id = p_delegation_id
    AND archived_at IS NULL
    AND status = 'reserved';

  -- 8. Sin ubicar (no archivados sin zona o sin banco)
  SELECT count(*) INTO v_unlocated
  FROM public.union_lockers
  WHERE delegation_id = p_delegation_id
    AND archived_at IS NULL
    AND (zone_id IS NULL OR bank_id IS NULL);

  -- 9. Pendientes de revisión (incidencias pendientes)
  SELECT count(*) INTO v_pending_review
  FROM public.union_locker_review_items
  WHERE delegation_id = p_delegation_id
    AND status = 'pending';

  -- 10. Casilleros únicos afectados por incidencias pendientes
  SELECT count(DISTINCT locker_number) INTO v_affected_lockers
  FROM public.union_locker_review_items
  WHERE delegation_id = p_delegation_id
    AND status = 'pending';

  -- 11. Conteo total de incidencias
  v_issue_count := v_pending_review;

  -- 12. Lista de espera activa
  SELECT count(*) INTO v_waitlist
  FROM public.union_locker_waitlist
  WHERE delegation_id = p_delegation_id
    AND status = 'waiting';

  RETURN jsonb_build_object(
    'total', v_total,
    'active_inventory', v_total,
    'archived', v_archived,
    'assigned', v_assigned,
    'available', v_available,
    'maintenance', v_maintenance,
    'blocked', v_blocked,
    'reserved', v_reserved,
    'unlocated', v_unlocated,
    'pending_review', v_pending_review,
    'pendingReview', v_pending_review,
    'affected_lockers', v_affected_lockers,
    'affectedLockers', v_affected_lockers,
    'issue_count', v_issue_count,
    'issueCount', v_issue_count,
    'waitlist', v_waitlist
  );
END;
$$;
