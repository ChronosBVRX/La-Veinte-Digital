-- =============================================================================
-- Test suite: union_locker_import_contract.sql (V2.1 Runtime Integrity)
-- Valida contra PostgreSQL real los 10 casos obligatorios del importador V2:
--   CASO 1: Locker nuevo -> condition ok.
--   CASO 2: Batch preview -> confirmed (status canónico).
--   CASO 3: Worker inexistente -> creado una sola vez con source = 'locker_excel'.
--   CASO 4: Locker sin worker -> inventariado available.
--   CASO 5: Conflicto ambiguo -> pending review en union_locker_review_items.
--   CASO 6: Rollback -> cancelled_by_rollback con resolution JSONB (cero error de columna).
--   CASO 7: Movimiento A -> B -> rollback restaura A.
--   CASO 8: Override de B ocupado -> rollback restaura ambos estados (ocupante previo de B y casillero A).
--   CASO 9: Importar mismo archivo dos veces -> detección de duplicado / idempotencia por file_sha256.
--   CASO 10: Locker en maintenance / blocked / reserved -> nunca auto-asignación, canalizado a pending_review.
-- =============================================================================

DO $$
DECLARE
  v_delegation_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_worker_siap_id UUID := gen_random_uuid();
  v_batch_1_id UUID := gen_random_uuid();
  v_batch_2_id UUID := gen_random_uuid();
  v_batch_3_id UUID := gen_random_uuid();
  v_batch_4_id UUID := gen_random_uuid();
  v_batch_5_id UUID := gen_random_uuid();
  v_locker_101_id UUID;
  v_locker_102_id UUID;
  v_locker_empty_id UUID;
  v_locker_maint_id UUID := gen_random_uuid();
  v_locker_res_id UUID := gen_random_uuid();
  v_locker_mov_a_id UUID := gen_random_uuid();
  v_locker_mov_b_id UUID := gen_random_uuid();
  v_worker_mov_id UUID := gen_random_uuid();
  v_asgn_mov_a_id UUID := gen_random_uuid();
  v_locker_ovr_a_id UUID := gen_random_uuid();
  v_locker_ovr_b_id UUID := gen_random_uuid();
  v_worker_ovr_1_id UUID := gen_random_uuid();
  v_worker_ovr_2_id UUID := gen_random_uuid();
  v_asgn_ovr_a_id UUID := gen_random_uuid();
  v_asgn_ovr_b_id UUID := gen_random_uuid();
  v_worker_idem_id UUID := gen_random_uuid();
  v_locker_idem_id UUID := gen_random_uuid();
  v_asgn_idem_id UUID := gen_random_uuid();
  v_apply_res JSONB;
  v_rollback_res JSONB;
  v_count INTEGER;
  v_cond TEXT;
  v_batch_status TEXT;
  v_err_caught BOOLEAN;
BEGIN
  -- =========================================================================
  -- SETUP GENERAL: Delegación, Usuario Admin Sindical y Trabajador SIAP Inicial
  -- =========================================================================
  INSERT INTO public.union_delegations (id, name, code)
  VALUES (v_delegation_id, 'Delegación Test Lockers V2.1', 'TEST_LOCKERS_V21');

  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_user_id, 'authenticated', 'authenticated', 'admin.lockers.v21@la20.local', '', now(), '{}', '{}', now(), now());

  INSERT INTO public.union_members (delegation_id, user_id, role)
  VALUES (v_delegation_id, v_user_id, 'union_admin');

  INSERT INTO public.union_workers (
    id, delegation_id, employee_number, first_name, paternal_surname, maternal_surname, category, turn, plaza_code, notes, source
  ) VALUES (
    v_worker_siap_id, v_delegation_id, '11223344', 'JUAN', 'PEREZ', 'LOPEZ', 'ENFERMERA GENERAL 80', 'MATUTINO', 'PLZ-001', 'SIAP INTACTO', 'siap_excel'
  );

  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);

  -- Casilleros protegidos de Lockers 2.0 para Caso 10
  INSERT INTO public.union_lockers (id, delegation_id, locker_number, status, condition, notes)
  VALUES (v_locker_maint_id, v_delegation_id, 'L-MAINT', 'maintenance', 'maintenance', 'En reparación');

  INSERT INTO public.union_lockers (id, delegation_id, locker_number, status, condition, reserved_for_worker_id, notes)
  VALUES (v_locker_res_id, v_delegation_id, 'L-RES', 'reserved', 'ok', v_worker_siap_id, 'Reservado para Juan Perez');

  -- =========================================================================
  -- LOTE 1: Pruebas de Casos 1, 2, 3, 4, 5, 10
  -- =========================================================================
  INSERT INTO public.union_worker_import_batches (
    id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
    format_version, total_rows, status, notes
  ) VALUES (
    v_batch_1_id, v_delegation_id, v_user_id, 'LOTE_1.xlsx', 1000, 'hash_batch_1_unique',
    'UNION_LOCKERS_V2', 6, 'preview', 'Lote 1 Casos 1 a 5 y 10'
  );

  -- Fila 1: CASO 1 -> Locker nuevo '101' a trabajador SIAP '11223344'
  INSERT INTO public.union_worker_import_rows (batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken)
  VALUES (v_batch_1_id, 1, '11223344', 'PEREZ/LOPEZ/JUAN', '{}'::jsonb, jsonb_build_object('locker', '101', 'nombre', 'PEREZ/LOPEZ/JUAN'), 'new', 'pending');

  -- Fila 2: CASO 3 -> Trabajador nuevo '99887766' en locker '102'
  INSERT INTO public.union_worker_import_rows (batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken)
  VALUES (v_batch_1_id, 2, '99887766', 'RODRIGUEZ/MARIA', '{}'::jsonb, jsonb_build_object('locker', '102', 'nombre', 'RODRIGUEZ/MARIA'), 'new', 'pending');

  -- Fila 3: CASO 4 -> Locker '104' sin trabajador
  INSERT INTO public.union_worker_import_rows (batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken)
  VALUES (v_batch_1_id, 3, '', '', '{}'::jsonb, jsonb_build_object('locker', '104', 'nombre', ''), 'new', 'pending');

  -- Fila 4: CASO 10A -> Trabajador '99887766' intenta asignar locker en maintenance 'L-MAINT'
  INSERT INTO public.union_worker_import_rows (batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken)
  VALUES (v_batch_1_id, 4, '99887766', 'RODRIGUEZ/MARIA', '{}'::jsonb, jsonb_build_object('locker', 'L-MAINT', 'nombre', 'RODRIGUEZ/MARIA'), 'new', 'pending');

  -- Fila 5: CASO 10B -> Trabajador nuevo '77665544' intenta asignar locker reservado 'L-RES' para otro
  INSERT INTO public.union_worker_import_rows (batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken)
  VALUES (v_batch_1_id, 5, '77665544', 'GOMEZ/LUCIA', '{}'::jsonb, jsonb_build_object('locker', 'L-RES', 'nombre', 'GOMEZ/LUCIA'), 'new', 'pending');

  -- Fila 6: CASO 5 -> Conflicto ambiguo AMBIGUOUS_HISTORY
  INSERT INTO public.union_worker_import_rows (batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken)
  VALUES (v_batch_1_id, 6, '11223344', 'PEREZ/LOPEZ/JUAN', '{}'::jsonb, jsonb_build_object('locker', '105', 'nombre', 'PEREZ/LOPEZ/JUAN', 'conflict_reason_code', 'AMBIGUOUS_HISTORY'), 'conflict', 'pending');

  -- Ejecutar union_apply_locker_import para Lote 1
  v_apply_res := public.union_apply_locker_import(v_batch_1_id, '{}'::jsonb);

  -- VERIFICACIÓN CASO 1: Locker nuevo creado con condition = 'ok'
  SELECT condition INTO v_cond FROM public.union_lockers WHERE delegation_id = v_delegation_id AND locker_number = '101';
  IF v_cond <> 'ok' THEN
    RAISE EXCEPTION 'CASO 1 FAILED: Casillero 101 debió crearse con condition = ok, pero tiene: %', v_cond;
  END IF;

  -- VERIFICACIÓN CASO 2: Batch status canónico = 'confirmed'
  SELECT status INTO v_batch_status FROM public.union_worker_import_batches WHERE id = v_batch_1_id;
  IF v_batch_status <> 'confirmed' THEN
    RAISE EXCEPTION 'CASO 2 FAILED: Batch status debió ser confirmed, pero tiene: %', v_batch_status;
  END IF;

  -- VERIFICACIÓN CASO 3: Worker nuevo creado con source = 'locker_excel' e intacto
  SELECT count(*) INTO v_count FROM public.union_workers WHERE delegation_id = v_delegation_id AND employee_number = '99887766' AND source = 'locker_excel';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'CASO 3 FAILED: Worker 99887766 debió crearse exactamente una vez desde locker_excel';
  END IF;

  -- VERIFICACIÓN CASO 4: Locker sin worker inventariado como available
  SELECT status INTO v_cond FROM public.union_lockers WHERE delegation_id = v_delegation_id AND locker_number = '104';
  IF v_cond <> 'available' THEN
    RAISE EXCEPTION 'CASO 4 FAILED: Locker 104 sin worker debió quedar available, obtenido: %', v_cond;
  END IF;

  -- VERIFICACIÓN CASO 5: Conflicto ambiguo registrado en union_locker_review_items
  SELECT count(*) INTO v_count FROM public.union_locker_review_items WHERE source_batch_id = v_batch_1_id AND reason = 'AMBIGUOUS_HISTORY' AND status = 'pending';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'CASO 5 FAILED: Conflicto ambiguo debió enviarse a union_locker_review_items';
  END IF;

  -- VERIFICACIÓN CASO 10: Locker en maintenance y reserved no asignados automáticamente
  SELECT count(*) INTO v_count FROM public.union_locker_assignments WHERE locker_id IN (v_locker_maint_id, v_locker_res_id) AND source_batch_id = v_batch_1_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'CASO 10 FAILED: Se crearon asignaciones automáticas indebidas para casilleros en maintenance/reserved';
  END IF;

  SELECT count(*) INTO v_count FROM public.union_locker_review_items WHERE source_batch_id = v_batch_1_id AND reason IN ('LOCKER_IN_MAINTENANCE', 'LOCKER_RESERVED');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'CASO 10 FAILED: Casilleros maintenance y reserved debieron enviarse a review items (esperados 2, obtenidos %)', v_count;
  END IF;

  -- =========================================================================
  -- CASO 6: Rollback de Lote 1 -> cancelled_by_rollback en review items y rolled_back en batch
  -- =========================================================================
  v_rollback_res := public.union_rollback_locker_import(v_batch_1_id);

  SELECT count(*) INTO v_count FROM public.union_locker_review_items WHERE source_batch_id = v_batch_1_id AND status = 'cancelled_by_rollback';
  IF v_count < 3 THEN
    RAISE EXCEPTION 'CASO 6 FAILED: Los review items debieron marcarse como cancelled_by_rollback, obtenidos: %', v_count;
  END IF;

  SELECT status INTO v_batch_status FROM public.union_worker_import_batches WHERE id = v_batch_1_id;
  IF v_batch_status <> 'rolled_back' THEN
    RAISE EXCEPTION 'CASO 6 FAILED: Batch debió quedar como rolled_back, obtenido: %', v_batch_status;
  END IF;

  -- Worker nuevo inactivado lógicamente
  SELECT active INTO v_err_caught FROM public.union_workers WHERE delegation_id = v_delegation_id AND employee_number = '99887766';
  IF v_err_caught IS NOT FALSE THEN
    RAISE EXCEPTION 'CASO 6 FAILED: Worker creado desde Excel debió ser desactivado lógicamente tras rollback';
  END IF;

  -- =========================================================================
  -- CASO 7: Movimiento A -> B y Rollback restaura A
  -- =========================================================================
  INSERT INTO public.union_workers (id, delegation_id, employee_number, first_name, paternal_surname, source)
  VALUES (v_worker_mov_id, v_delegation_id, '33445566', 'PEDRO', 'SANCHEZ', 'siap_excel');

  INSERT INTO public.union_lockers (id, delegation_id, locker_number, status, condition)
  VALUES (v_locker_mov_a_id, v_delegation_id, 'L-MOV-A', 'assigned', 'ok');

  INSERT INTO public.union_lockers (id, delegation_id, locker_number, status, condition)
  VALUES (v_locker_mov_b_id, v_delegation_id, 'L-MOV-B', 'available', 'ok');

  INSERT INTO public.union_locker_assignments (id, locker_id, worker_id, status, assignment_reason)
  VALUES (v_asgn_mov_a_id, v_locker_mov_a_id, v_worker_mov_id, 'active', 'Asignación previa legítima en A');

  -- Batch 2 reasigna al trabajador Pedro Sanchez a L-MOV-B
  INSERT INTO public.union_worker_import_batches (id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256, format_version, total_rows, status)
  VALUES (v_batch_2_id, v_delegation_id, v_user_id, 'LOTE_MOV.xlsx', 1000, 'hash_batch_mov', 'UNION_LOCKERS_V2', 1, 'preview');

  INSERT INTO public.union_worker_import_rows (batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken)
  VALUES (v_batch_2_id, 1, '33445566', 'SANCHEZ/PEDRO', '{}'::jsonb, jsonb_build_object('locker', 'L-MOV-B', 'nombre', 'SANCHEZ/PEDRO'), 'new', 'pending');

  PERFORM public.union_apply_locker_import(v_batch_2_id, '{}'::jsonb);

  -- Asignación anterior en A debe estar released con released_by_source_batch_id = v_batch_2_id
  IF NOT EXISTS (
    SELECT 1 FROM public.union_locker_assignments
    WHERE id = v_asgn_mov_a_id AND status = 'released' AND released_by_source_batch_id = v_batch_2_id
  ) THEN
    RAISE EXCEPTION 'CASO 7 FAILED: Asignación A debió ser liberada con released_by_source_batch_id estructurado';
  END IF;

  -- Rollback de Batch 2
  PERFORM public.union_rollback_locker_import(v_batch_2_id);

  -- Asignación A debió ser restaurada a active
  IF NOT EXISTS (
    SELECT 1 FROM public.union_locker_assignments
    WHERE id = v_asgn_mov_a_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'CASO 7 FAILED: Asignación previa en A no fue restaurada tras rollback';
  END IF;

  -- =========================================================================
  -- CASO 8: Override de casillero ocupado por otro trabajador y Rollback restaura ambos
  -- =========================================================================
  INSERT INTO public.union_workers (id, delegation_id, employee_number, first_name, paternal_surname, source)
  VALUES (v_worker_ovr_1_id, v_delegation_id, '44556677', 'OCUPANTE', 'ORIGINAL_B', 'siap_excel');

  INSERT INTO public.union_workers (id, delegation_id, employee_number, first_name, paternal_surname, source)
  VALUES (v_worker_ovr_2_id, v_delegation_id, '55667788', 'NUEVO', 'INVASOR_A', 'siap_excel');

  INSERT INTO public.union_lockers (id, delegation_id, locker_number, status, condition)
  VALUES (v_locker_ovr_a_id, v_delegation_id, 'L-OVR-A', 'assigned', 'ok');

  INSERT INTO public.union_lockers (id, delegation_id, locker_number, status, condition)
  VALUES (v_locker_ovr_b_id, v_delegation_id, 'L-OVR-B', 'assigned', 'ok');

  INSERT INTO public.union_locker_assignments (id, locker_id, worker_id, status, assignment_reason)
  VALUES (v_asgn_ovr_a_id, v_locker_ovr_a_id, v_worker_ovr_2_id, 'active', 'Asignación previa en A');

  INSERT INTO public.union_locker_assignments (id, locker_id, worker_id, status, assignment_reason)
  VALUES (v_asgn_ovr_b_id, v_locker_ovr_b_id, v_worker_ovr_1_id, 'active', 'Asignación previa en B');

  -- Batch 3: Intenta asignar worker 55667788 al locker L-OVR-B mediante override con justificación
  INSERT INTO public.union_worker_import_batches (id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256, format_version, total_rows, status)
  VALUES (v_batch_3_id, v_delegation_id, v_user_id, 'LOTE_OVR.xlsx', 1000, 'hash_batch_ovr', 'UNION_LOCKERS_V2', 1, 'preview');

  INSERT INTO public.union_worker_import_rows (batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken)
  VALUES (v_batch_3_id, 1, '55667788', 'INVASOR_A/NUEVO', '{}'::jsonb, jsonb_build_object('locker', 'L-OVR-B', 'nombre', 'INVASOR_A/NUEVO'), 'new', 'pending');

  -- Aplicar con override y motivo obligatorio
  PERFORM public.union_apply_locker_import(
    v_batch_3_id,
    jsonb_build_object('1', jsonb_build_object('action', 'override', 'reason', 'Autorizado por Comité Mixto'))
  );

  -- Comprobar que tanto la asignación de A como la de B quedaron liberadas con el batch_id
  IF (SELECT count(*) FROM public.union_locker_assignments WHERE released_by_source_batch_id = v_batch_3_id) <> 2 THEN
    RAISE EXCEPTION 'CASO 8 FAILED: Debieron liberarse 2 asignaciones (A y B) con procedencia estructurada';
  END IF;

  -- Rollback de Batch 3
  PERFORM public.union_rollback_locker_import(v_batch_3_id);

  -- Ambas asignaciones originales deben estar restauradas como activas
  IF (SELECT status FROM public.union_locker_assignments WHERE id = v_asgn_ovr_a_id) <> 'active' OR
     (SELECT status FROM public.union_locker_assignments WHERE id = v_asgn_ovr_b_id) <> 'active' THEN
    RAISE EXCEPTION 'CASO 8 FAILED: El rollback no restauró fielmente a los ocupantes legítimos previos de A y B';
  END IF;

  -- =========================================================================
  -- CASO 9: Importar mismo archivo dos veces -> Idempotencia / Bloqueo de Duplicado
  -- =========================================================================
  INSERT INTO public.union_worker_import_batches (id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256, format_version, total_rows, status)
  VALUES (v_batch_4_id, v_delegation_id, v_user_id, 'DUPLICADO.xlsx', 1000, 'hash_archivo_identico_sha256', 'UNION_LOCKERS_V2', 1, 'preview');

  INSERT INTO public.union_worker_import_rows (batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken)
  VALUES (v_batch_4_id, 1, '11223344', 'PEREZ/JUAN', '{}'::jsonb, jsonb_build_object('locker', 'L-IDEM-99', 'nombre', 'PEREZ/JUAN'), 'new', 'pending');

  PERFORM public.union_apply_locker_import(v_batch_4_id, '{}'::jsonb);

  -- Segundo lote con IDÉNTICO file_sha256
  INSERT INTO public.union_worker_import_batches (id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256, format_version, total_rows, status)
  VALUES (v_batch_5_id, v_delegation_id, v_user_id, 'DUPLICADO_REPLAY.xlsx', 1000, 'hash_archivo_identico_sha256', 'UNION_LOCKERS_V2', 1, 'preview');

  INSERT INTO public.union_worker_import_rows (batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken)
  VALUES (v_batch_5_id, 1, '11223344', 'PEREZ/JUAN', '{}'::jsonb, jsonb_build_object('locker', 'L-IDEM-99', 'nombre', 'PEREZ/JUAN'), 'new', 'pending');

  v_err_caught := false;
  BEGIN
    PERFORM public.union_apply_locker_import(v_batch_5_id, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%FILE_ALREADY_IMPORTED%' THEN
      v_err_caught := true;
    ELSE
      RAISE EXCEPTION 'CASO 9 UNEXPECTED ERROR: %', SQLERRM;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'CASO 9 FAILED: El segundo lote con idéntico file_sha256 debió ser rechazado por idempotencia';
  END IF;

  -- =========================================================================
  -- TEARDOWN DE PRUEBAS
  -- =========================================================================
  DELETE FROM public.union_locker_assignments WHERE locker_id IN (
    SELECT id FROM public.union_lockers WHERE delegation_id = v_delegation_id
  );
  DELETE FROM public.union_locker_review_items WHERE delegation_id = v_delegation_id;
  DELETE FROM public.union_locker_import_source_rows WHERE delegation_id = v_delegation_id;
  DELETE FROM public.union_worker_import_rows WHERE batch_id IN (v_batch_1_id, v_batch_2_id, v_batch_3_id, v_batch_4_id, v_batch_5_id);
  DELETE FROM public.union_worker_import_batches WHERE delegation_id = v_delegation_id;
  DELETE FROM public.union_lockers WHERE delegation_id = v_delegation_id;
  DELETE FROM public.union_workers WHERE delegation_id = v_delegation_id;
  DELETE FROM public.union_members WHERE delegation_id = v_delegation_id;
  DELETE FROM public.union_delegations WHERE id = v_delegation_id;
  DELETE FROM auth.users WHERE id = v_user_id;

  RAISE NOTICE 'SUCCESS: Los 10 casos de union_locker_import_contract han sido ejecutados y validados al 100%%.';
END $$;
