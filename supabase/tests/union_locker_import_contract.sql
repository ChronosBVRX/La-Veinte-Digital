-- =============================================================================
-- Test suite: union_locker_import_contract.sql
-- Valida la ejecución real y las invariantes de:
--   - public.union_apply_locker_import
--   - public.union_rollback_locker_import
-- Garantiza:
--   1. Locker físico nuevo inventariado inmediatamente.
--   2. Asignación inequívoca aplicada.
--   3. Fila WORKER_NOT_FOUND guardada en union_locker_review_items (0 workers creados).
--   4. Fila con conflicto ambiguo guardada en union_locker_review_items (0 asignaciones arbitrarias).
--   5. union_workers 100% INTACTO (cero INSERT, cero UPDATE).
--   6. Rollback restaura asignaciones y cancela pendientes trazablemente.
-- =============================================================================

DO $$
DECLARE
  v_delegation_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_worker_id UUID := gen_random_uuid();
  v_batch_id UUID := gen_random_uuid();
  v_worker_count_before INTEGER;
  v_worker_count_after INTEGER;
  v_locker_101_id UUID;
  v_locker_102_id UUID;
  v_locker_103_id UUID;
  v_apply_res JSONB;
  v_rollback_res JSONB;
  v_active_count INTEGER;
  v_pending_count INTEGER;
  v_cancelled_count INTEGER;
  v_worker_record RECORD;
BEGIN
  -- 1. SETUP: Delegación, admin sindical y 1 trabajador preexistente
  INSERT INTO public.union_delegations (id, name, code)
  VALUES (v_delegation_id, 'Delegación Test Lockers Contrato', 'TEST_LOCKERS_CTR');

  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_user_id, 'authenticated', 'authenticated', 'admin.lockers.test@la20.local', '', now(), '{}', '{}', now(), now());

  INSERT INTO public.union_members (delegation_id, user_id, role)
  VALUES (v_delegation_id, v_user_id, 'union_admin');

  INSERT INTO public.union_workers (
    id, delegation_id, employee_number, first_name, paternal_surname, maternal_surname, category, turn, plaza_code, notes
  ) VALUES (
    v_worker_id, v_delegation_id, '11223344', 'JUAN', 'PEREZ', 'LOPEZ', 'ENFERMERA GENERAL 80', 'MATUTINO', 'PLZ-001', 'Notas originales intactas'
  );

  -- Guardar estado inicial de trabajadores
  SELECT count(*) INTO v_worker_count_before
  FROM public.union_workers
  WHERE delegation_id = v_delegation_id;

  IF v_worker_count_before <> 1 THEN
    RAISE EXCEPTION 'SETUP FAILED: Se esperaba 1 trabajador inicial, obtenido %', v_worker_count_before;
  END IF;

  -- Simular identidad del usuario admin
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);

  -- 2. Lote de Staging (UNION_LOCKERS_V1)
  INSERT INTO public.union_worker_import_batches (
    id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
    format_version, total_rows, new_workers_count, updated_workers_count,
    unchanged_workers_count, warnings_count, invalid_rows_count, conflicts_count,
    missing_in_file_count, status, notes, summary_metadata
  ) VALUES (
    v_batch_id, v_delegation_id, v_user_id, 'LOKER_TEST.xlsx', 4500000, 'hash_test_sha256',
    'UNION_LOCKERS_V1', 3, 0, 0, 0, 0, 0, 2, 0, 'preview', 'Lote de prueba de contrato', '{}'::jsonb
  );

  -- Fila 1: Asignación segura (Trabajador 11223344 existe, casillero 101 nuevo)
  INSERT INTO public.union_worker_import_rows (
    batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken
  ) VALUES (
    v_batch_id, 1, '11223344', 'PEREZ/LOPEZ/JUAN', '{}'::jsonb,
    jsonb_build_object('locker', '101', 'nombre', 'PEREZ/LOPEZ/JUAN', 'is_semantic_locker', false),
    'new', 'pending'
  );

  -- Fila 2: Trabajador no encontrado en padrón (Matrícula 99887766 no existe, casillero 102 nuevo)
  INSERT INTO public.union_worker_import_rows (
    batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken
  ) VALUES (
    v_batch_id, 2, '99887766', 'RODRIGUEZ/MARIA', '{}'::jsonb,
    jsonb_build_object('locker', '102', 'nombre', 'RODRIGUEZ/MARIA', 'conflict_reason_code', 'WORKER_NOT_FOUND', 'is_semantic_locker', false),
    'conflict', 'pending'
  );

  -- Fila 3: Conflicto ambiguo (Casillero 103 con conflicto LOCKER_MULTIPLE_WORKERS)
  INSERT INTO public.union_worker_import_rows (
    batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken
  ) VALUES (
    v_batch_id, 3, '11223344', 'PEREZ/LOPEZ/JUAN', '{}'::jsonb,
    jsonb_build_object('locker', '103', 'nombre', 'PEREZ/LOPEZ/JUAN', 'conflict_reason_code', 'LOCKER_MULTIPLE_WORKERS', 'is_semantic_locker', false),
    'conflict', 'pending'
  );

  -- 3. EJECUTAR RPC: union_apply_locker_import
  v_apply_res := public.union_apply_locker_import(v_batch_id, '{}'::jsonb);

  -- 4. VERIFICACIONES DE APLICACIÓN
  -- A) Casilleros físicos inventariados
  SELECT id INTO v_locker_101_id FROM public.union_lockers WHERE delegation_id = v_delegation_id AND locker_number = '101';
  SELECT id INTO v_locker_102_id FROM public.union_lockers WHERE delegation_id = v_delegation_id AND locker_number = '102';
  SELECT id INTO v_locker_103_id FROM public.union_lockers WHERE delegation_id = v_delegation_id AND locker_number = '103';

  IF v_locker_101_id IS NULL OR v_locker_102_id IS NULL OR v_locker_103_id IS NULL THEN
    RAISE EXCEPTION 'TEST FAILED: Los casilleros físicos 101, 102 y 103 debieron crearse en inventario.';
  END IF;

  -- B) Estatus de casilleros: 101 assigned, 102 y 103 available
  IF (SELECT status FROM public.union_lockers WHERE id = v_locker_101_id) <> 'assigned' THEN
    RAISE EXCEPTION 'TEST FAILED: Casillero 101 debió quedar como assigned';
  END IF;
  IF (SELECT status FROM public.union_lockers WHERE id = v_locker_102_id) <> 'available' THEN
    RAISE EXCEPTION 'TEST FAILED: Casillero 102 debió quedar como available';
  END IF;
  IF (SELECT status FROM public.union_lockers WHERE id = v_locker_103_id) <> 'available' THEN
    RAISE EXCEPTION 'TEST FAILED: Casillero 103 debió quedar como available';
  END IF;

  -- C) Asignación segura única: Solo casillero 101 asignado a Juan Perez
  SELECT count(*) INTO v_active_count
  FROM public.union_locker_assignments
  WHERE worker_id = v_worker_id AND status = 'active';

  IF v_active_count <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Debe haber exactamente 1 asignación activa, obtenidas %', v_active_count;
  END IF;

  -- D) Pendientes de revisión: 2 registros creados (1 WORKER_NOT_FOUND, 1 LOCKER_MULTIPLE_WORKERS)
  SELECT count(*) INTO v_pending_count
  FROM public.union_locker_review_items
  WHERE source_batch_id = v_batch_id AND status = 'pending';

  IF v_pending_count <> 2 THEN
    RAISE EXCEPTION 'TEST FAILED: Se esperaban 2 pendientes de revisión en union_locker_review_items, obtenidos %', v_pending_count;
  END IF;

  -- E) INVARIANTE SUPREMO: union_workers 100% INTACTO
  SELECT count(*) INTO v_worker_count_after
  FROM public.union_workers
  WHERE delegation_id = v_delegation_id;

  IF v_worker_count_after <> v_worker_count_before THEN
    RAISE EXCEPTION 'INVARIANT VIOLATION: Se crearon trabajadores indebidamente. Inicial: %, Final: %', v_worker_count_before, v_worker_count_after;
  END IF;

  SELECT * INTO v_worker_record
  FROM public.union_workers
  WHERE id = v_worker_id;

  IF v_worker_record.notes <> 'Notas originales intactas' OR v_worker_record.plaza_code <> 'PLZ-001' THEN
    RAISE EXCEPTION 'INVARIANT VIOLATION: Se mutaron campos de trabajadores preexistentes.';
  END IF;

  -- 5. EJECUTAR RPC: union_rollback_locker_import
  v_rollback_res := public.union_rollback_locker_import(v_batch_id);

  -- 6. VERIFICACIONES DE ROLLBACK
  -- Asignación revertida a released
  IF EXISTS (SELECT 1 FROM public.union_locker_assignments WHERE locker_id = v_locker_101_id AND status = 'active') THEN
    RAISE EXCEPTION 'ROLLBACK FAILED: La asignación activa del casillero 101 debió liberarse.';
  END IF;

  -- Casillero 101 restaurado a available
  IF (SELECT status FROM public.union_lockers WHERE id = v_locker_101_id) <> 'available' THEN
    RAISE EXCEPTION 'ROLLBACK FAILED: Casillero 101 debió quedar available tras rollback.';
  END IF;

  -- Pendientes marcados como cancelled_by_rollback
  SELECT count(*) INTO v_cancelled_count
  FROM public.union_locker_review_items
  WHERE source_batch_id = v_batch_id AND status = 'cancelled_by_rollback';

  IF v_cancelled_count <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK FAILED: Se esperaban 2 registros cancelled_by_rollback, obtenidos %', v_cancelled_count;
  END IF;

  -- Trabajadores siguen 100% intactos
  SELECT count(*) INTO v_worker_count_after
  FROM public.union_workers
  WHERE delegation_id = v_delegation_id;

  IF v_worker_count_after <> v_worker_count_before THEN
    RAISE EXCEPTION 'INVARIANT VIOLATION: El conteo de trabajadores cambió tras rollback.';
  END IF;

  -- Limpieza de prueba
  DELETE FROM public.union_locker_assignments WHERE locker_id IN (v_locker_101_id, v_locker_102_id, v_locker_103_id);
  DELETE FROM public.union_locker_review_items WHERE source_batch_id = v_batch_id;
  DELETE FROM public.union_worker_import_rows WHERE batch_id = v_batch_id;
  DELETE FROM public.union_worker_import_batches WHERE id = v_batch_id;
  DELETE FROM public.union_lockers WHERE id IN (v_locker_101_id, v_locker_102_id, v_locker_103_id);
  DELETE FROM public.union_workers WHERE id = v_worker_id;
  DELETE FROM public.union_members WHERE delegation_id = v_delegation_id;
  DELETE FROM public.union_delegations WHERE id = v_delegation_id;
  DELETE FROM auth.users WHERE id = v_user_id;

  RAISE NOTICE 'SUCCESS: union_locker_import_contract ejecutado y validado al 100%%';
END $$;
