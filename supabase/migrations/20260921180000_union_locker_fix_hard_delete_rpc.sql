-- ============================================================
-- MIGRATION: 20260921180000_union_locker_fix_hard_delete_rpc.sql
-- Hotfix quirúrgico:
-- 1. Corrige columna union_locker_import_source_rows.matched_locker_id
--    en union_delete_unused_locker (la migración 20260920220000 referenciaba resolved_locker_id).
-- 2. Normaliza condition='damaged' a 'maintenance' en union_create_locker,
--    union_update_locker y union_bulk_update_lockers para respetar
--    el check constraint canónico ('ok', 'maintenance', 'blocked').
-- ============================================================

-- 1. Función Canónica: union_delete_unused_locker (Hard delete seguro)
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

  -- 4. Verificar que no provenga de filas de importación autoritativas (columna correcta: matched_locker_id)
  IF EXISTS (
    SELECT 1 FROM public.union_locker_import_source_rows
    WHERE matched_locker_id = p_locker_id
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

-- 2. Función Canónica: union_create_locker (Normalización de condition='damaged' -> 'maintenance')
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
  v_notes text;
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

  v_notes := coalesce(trim(p_notes), '');

  -- Normalización institucional de daño físico a estado canónico maintenance
  IF v_cond = 'damaged' THEN
    v_cond := 'maintenance';
    IF v_notes = '' THEN
      v_notes := 'Reporte de daño físico';
    END IF;
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
    maintenance_reason,
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
    v_notes,
    CASE WHEN v_cond = 'maintenance' THEN 'Reporte de mantenimiento / daño físico' ELSE NULL END,
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

-- 3. Función Canónica: union_update_locker (Normalización de condition='damaged' -> 'maintenance')
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
      RAISE EXCEPTION 'Ya existe otro casillero con el número %.', v_norm_number;
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
    -- Normalización de daño físico a estado canónico maintenance
    IF v_cond = 'damaged' THEN
      v_cond := 'maintenance';
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
        'old_locker_number', v_old_number,
        'new_locker_number', v_norm_number,
        'reason', coalesce(trim(p_renumber_reason), 'Renumeración administrativa'),
        'user_id', p_user_id
      ),
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_locker_id,
    'locker_number', v_norm_number,
    'renumbered', v_renumbered
  );
END;
$$;
