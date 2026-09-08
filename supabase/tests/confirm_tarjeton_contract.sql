-- =============================================================================
-- Test suite: confirm_tarjeton_contract.sql
-- Valida la ejecución y las invariantes del RPC público confirm_imported_payslip
-- contra una base de datos PostgreSQL real (Supabase).
-- =============================================================================

-- 1. Setup: Crear usuario sintético aislado
DELETE FROM public.imported_payslip_observations WHERE payslip_id IN (
  SELECT id FROM public.imported_payslips WHERE user_id = '00000000-0000-0000-0000-00000000c001'
);
DELETE FROM public.imported_payslip_lines WHERE payslip_id IN (
  SELECT id FROM public.imported_payslips WHERE user_id = '00000000-0000-0000-0000-00000000c001'
);
DELETE FROM public.worker_active_context WHERE user_id = '00000000-0000-0000-0000-00000000c001';
DELETE FROM public.vacation_profile_data WHERE user_id = '00000000-0000-0000-0000-00000000c001';
DELETE FROM public.payroll_contexts WHERE user_id = '00000000-0000-0000-0000-00000000c001';
DELETE FROM public.imported_payslips WHERE user_id = '00000000-0000-0000-0000-00000000c001';
DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000c001';
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000c001';

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-00000000c001', 'authenticated', 'authenticated',
  'synthetic.tarjeton@test.local', '', now(), '{}', '{"full_name":"Usuario Sintético Tarjeton"}', now(), now()
);

INSERT INTO public.profiles (id, full_name, matricula, categoria)
VALUES ('00000000-0000-0000-0000-00000000c001', 'Usuario Sintético Tarjeton', '88888888', 'ENFERMERA GENERAL 80')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- 2. Simular sesión autenticada
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c001', true);

-- 3. Test 1: Inserción exitosa de payload maximal con porVencer y dueDate
DO $$
DECLARE
  v_payload JSONB;
  v_result JSONB;
  v_new_id UUID;
  v_cat_code TEXT;
BEGIN
  v_payload := jsonb_build_object(
    'schemaVersion', '1.0',
    'document', jsonb_build_object(
      'type', 'imss_payroll_receipt',
      'pageCount', 1,
      'periodRaw', '1A-OCT-2026',
      'year', 2026,
      'month', 10,
      'half', 1,
      'fiscalFolioHash', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    ),
    'employee', jsonb_build_object(
      'employeeNumber', '88888888',
      'fullName', 'Usuario Sintético Tarjeton',
      'categoryCode', '20570080',
      'categoryName', 'ENFERMERA GENERAL 80',
      'workdayHours', 8,
      'entryDate', '2015-01-16',
      'seniority', jsonb_build_object(
        'raw', '11 años 17 qnas 0 dias',
        'years', 11,
        'fortnights', 17,
        'days', 0,
        'parsed', jsonb_build_object('years', 11, 'fortnights', 17, 'days', 0),
        'status', 'complete'
      )
    ),
    'attendance', jsonb_build_object(
      'delays', 0,
      'exitPasses', 0,
      'absences', 0,
      'noDelayDays', 15
    ),
    'vacations', jsonb_build_object(
      'enjoyedDays', 10,
      'daysInYear', 20,
      'continuityMark', 2,
      'periodNumberToEnjoy', 11,
      'porVencer', '2026-12-31',
      'porVencerRaw', '31122026',
      'dueDate', '2026-12-31'
    ),
    'payroll', jsonb_build_object(
      'earnings', jsonb_build_array(
        jsonb_build_object('lineIndex', 0, 'code', '002', 'description', 'SUELDO', 'amount', 5000, 'kind', 'earning', 'confidence', 1, 'confirmedByUser', true)
      ),
      'deductions', jsonb_build_array(
        jsonb_build_object('lineIndex', 1, 'code', '212', 'description', 'ISR', 'amount', -1000, 'kind', 'deduction', 'confidence', 1, 'confirmedByUser', true)
      ),
      'observations', jsonb_build_array(),
      'totalEarnings', 5000,
      'totalDeductions', 1000,
      'netPay', 4000
    ),
    'extraction', jsonb_build_object(
      'method', 'native_text',
      'globalConfidence', 1,
      'validations', jsonb_build_object('templateDetected', true)
    )
  );

  v_result := public.confirm_imported_payslip(
    'test_source_hash_synth_001',
    v_payload,
    '{"matricula": true, "categoria": true}'::jsonb,
    false,
    true
  );

  IF (v_result->>'schemaVersion') <> '1.0' THEN
    RAISE EXCEPTION 'Test 1 FAILED: schemaVersion <> 1.0, got %', v_result->>'schemaVersion';
  END IF;

  IF (v_result->>'duplicate')::BOOLEAN IS NOT FALSE THEN
    RAISE EXCEPTION 'Test 1 FAILED: expected duplicate=false';
  END IF;

  v_new_id := (v_result->>'id')::UUID;
  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'Test 1 FAILED: id was null';
  END IF;

  -- Validar persistencia en payroll_contexts
  SELECT category_code INTO v_cat_code
  FROM public.payroll_contexts
  WHERE user_id = '00000000-0000-0000-0000-00000000c001';

  IF v_cat_code <> '20570080' THEN
    RAISE EXCEPTION 'Test 1 FAILED: payroll_contexts category_code was %, expected 20570080', v_cat_code;
  END IF;
END;
$$;

-- 4. Test 2: Idempotencia en duplicados con el mismo hash
DO $$
DECLARE
  v_payload JSONB;
  v_result JSONB;
BEGIN
  v_payload := jsonb_build_object(
    'schemaVersion', '1.0',
    'document', jsonb_build_object(
      'type', 'imss_payroll_receipt',
      'pageCount', 1,
      'periodRaw', '1A-OCT-2026',
      'fiscalFolioHash', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    ),
    'employee', jsonb_build_object('employeeNumber', '88888888', 'categoryName', 'ENFERMERA GENERAL 80'),
    'attendance', '{}'::jsonb,
    'vacations', jsonb_build_object('dueDate', '2026-12-31'),
    'payroll', jsonb_build_object(
      'earnings', jsonb_build_array(
        jsonb_build_object('lineIndex', 0, 'code', '002', 'description', 'SUELDO', 'amount', 5000, 'kind', 'earning', 'confidence', 1, 'confirmedByUser', true)
      ),
      'deductions', jsonb_build_array(),
      'observations', jsonb_build_array(),
      'totalEarnings', 5000,
      'totalDeductions', 0,
      'netPay', 5000
    ),
    'extraction', jsonb_build_object('method', 'native_text', 'globalConfidence', 1, 'validations', jsonb_build_object('templateDetected', true))
  );

  v_result := public.confirm_imported_payslip(
    'test_source_hash_synth_001',
    v_payload,
    '{}'::jsonb,
    false,
    true
  );

  IF (v_result->>'duplicate')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'Test 2 FAILED: expected duplicate=true on repeated hash';
  END IF;
END;
$$;

-- 5. Test 3: Rechazo estricto de campos no autorizados en vacations
DO $$
DECLARE
  v_payload JSONB;
BEGIN
  v_payload := jsonb_build_object(
    'schemaVersion', '1.0',
    'document', jsonb_build_object('type', 'imss_payroll_receipt', 'pageCount', 1, 'periodRaw', '1A-OCT-2026'),
    'employee', jsonb_build_object('employeeNumber', '88888888'),
    'attendance', '{}'::jsonb,
    'vacations', jsonb_build_object('campoInvalidoNoEnWhitelist', 123),
    'payroll', jsonb_build_object(
      'earnings', jsonb_build_array(
        jsonb_build_object('lineIndex', 0, 'code', '002', 'description', 'SUELDO', 'amount', 100, 'kind', 'earning', 'confidence', 1, 'confirmedByUser', true)
      ),
      'deductions', jsonb_build_array(),
      'observations', jsonb_build_array()
    ),
    'extraction', jsonb_build_object('method', 'native_text', 'globalConfidence', 1, 'validations', jsonb_build_object('templateDetected', true))
  );

  BEGIN
    PERFORM public.confirm_imported_payslip('hash_invalido_01', v_payload, '{}'::jsonb, false, true);
    RAISE EXCEPTION 'Test 3 FAILED: expected invalid_payload: unknown field exception was not raised';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invalid_payload: unknown field%' THEN
        RAISE EXCEPTION 'Test 3 FAILED: unexpected exception message: %', SQLERRM;
      END IF;
  END;
END;
$$;

-- 6. Test 4: INITIALIZE_WORKER (profile.matricula IS NULL, employmentType='Base' mayúscula, payroll_contexts residual)
DO $$
DECLARE
  v_payload JSONB;
  v_result JSONB;
  v_prof_mat TEXT;
  v_prof_cat TEXT;
  v_emp_type TEXT;
  v_ctx_mat TEXT;
  v_pref_state TEXT;
  v_pref_mode TEXT;
  v_act_mat TEXT;
BEGIN
  -- Simular usuario en estado INITIALIZE_WORKER (perfil sin matrícula)
  UPDATE public.profiles
  SET matricula = NULL, categoria = NULL
  WHERE id = '00000000-0000-0000-0000-00000000c001';

  -- Contexto residual previo con conceptos antiguos
  INSERT INTO public.payroll_contexts (
    user_id, matricula, category_name, category_code, workday_hours,
    employment_type, recurring_concepts, payroll_facts, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-00000000c001', NULL, 'ANTIGUA', NULL, 8,
    'base', '[{"conceptCode": "022", "lastAmount": 100}]'::jsonb, '[{"key": "old_fact"}]'::jsonb, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    matricula = NULL,
    recurring_concepts = '[{"conceptCode": "022", "lastAmount": 100}]'::jsonb,
    payroll_facts = '[{"key": "old_fact"}]'::jsonb;

  -- Payload con 'employmentType': 'Base' (mayúscula como viene del parser) y matrícula nueva
  v_payload := jsonb_build_object(
    'schemaVersion', '1.0',
    'document', jsonb_build_object(
      'type', 'imss_payroll_receipt',
      'pageCount', 1,
      'periodRaw', '1A-FEB-2026',
      'year', 2026,
      'month', 2,
      'half', 1,
      'folio', '577',
      'fiscalFolioHash', 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
    ),
    'employee', jsonb_build_object(
      'employeeNumber', '11342099',
      'fullName', 'CARLOS ALBERTO GUERRERO RASCON',
      'categoryCode', '20360180',
      'categoryName', 'MEDICO NO FAMILIAR 80',
      'employmentType', 'Base',
      'workdayHours', 8,
      'entryDate', '2001-04-05',
      'seniority', jsonb_build_object(
        'raw', '24 anos 20 qnas 10 dias',
        'years', 24,
        'fortnights', 20,
        'days', 10,
        'parsed', jsonb_build_object('years', 24, 'fortnights', 20, 'days', 10),
        'status', 'complete'
      )
    ),
    'attendance', jsonb_build_object('delays', 0, 'noDelayDays', 15),
    'vacations', jsonb_build_object('enjoyedDays', 0, 'daysInYear', 20, 'dueDate', '2026-10-15'),
    'payroll', jsonb_build_object(
      'earnings', jsonb_build_array(
        jsonb_build_object('lineIndex', 0, 'code', '002', 'description', 'SUELDO', 'amount', 6000, 'kind', 'earning', 'confidence', 1, 'confirmedByUser', true)
      ),
      'deductions', jsonb_build_array(),
      'observations', jsonb_build_array(),
      'totalEarnings', 6000,
      'totalDeductions', 0,
      'netPay', 6000
    ),
    'extraction', jsonb_build_object(
      'method', 'native_text',
      'globalConfidence', 0.98,
      'validations', jsonb_build_object('templateDetected', true)
    )
  );

  v_result := public.confirm_imported_payslip(
    'test_source_hash_init_worker_001',
    v_payload,
    '{}'::jsonb,
    false,
    true
  );

  IF (v_result->>'schemaVersion') <> '1.0' THEN
    RAISE EXCEPTION 'Test 4 FAILED: schemaVersion <> 1.0';
  END IF;

  -- 1. Verificar profiles
  SELECT matricula, categoria INTO v_prof_mat, v_prof_cat
  FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-00000000c001';

  IF v_prof_mat <> '11342099' THEN
    RAISE EXCEPTION 'Test 4 FAILED: profiles.matricula was %, expected 11342099', v_prof_mat;
  END IF;
  IF v_prof_cat <> 'MEDICO NO FAMILIAR 80' THEN
    RAISE EXCEPTION 'Test 4 FAILED: profiles.categoria was %, expected MEDICO NO FAMILIAR 80', v_prof_cat;
  END IF;

  -- 2. Verificar payroll_contexts (employment_type normalizado a 'base')
  SELECT matricula, employment_type INTO v_ctx_mat, v_emp_type
  FROM public.payroll_contexts
  WHERE user_id = '00000000-0000-0000-0000-00000000c001';

  IF v_ctx_mat <> '11342099' THEN
    RAISE EXCEPTION 'Test 4 FAILED: payroll_contexts.matricula was %, expected 11342099', v_ctx_mat;
  END IF;
  IF v_emp_type <> 'base' THEN
    RAISE EXCEPTION 'Test 4 FAILED: payroll_contexts.employment_type was %, expected base', v_emp_type;
  END IF;

  -- 3. Verificar worker_preferences
  SELECT onboarding_state, preferred_worker_mode INTO v_pref_state, v_pref_mode
  FROM public.worker_preferences
  WHERE user_id = '00000000-0000-0000-0000-00000000c001';

  IF v_pref_state <> 'configured' OR v_pref_mode <> 'payslip' THEN
    RAISE EXCEPTION 'Test 4 FAILED: worker_preferences was (%, %), expected (configured, payslip)', v_pref_state, v_pref_mode;
  END IF;

  -- 4. Verificar worker_active_context
  SELECT employee_number INTO v_act_mat
  FROM public.worker_active_context
  WHERE user_id = '00000000-0000-0000-0000-00000000c001';

  IF v_act_mat <> '11342099' THEN
    RAISE EXCEPTION 'Test 4 FAILED: worker_active_context.employee_number was %, expected 11342099', v_act_mat;
  END IF;
END;
$$;

-- 7. Test 5: WORKER_REPLACEMENT rechaza cambio no autorizado
DO $$
DECLARE
  v_payload JSONB;
BEGIN
  v_payload := jsonb_build_object(
    'schemaVersion', '1.0',
    'document', jsonb_build_object('type', 'imss_payroll_receipt', 'pageCount', 1, 'periodRaw', '2A-FEB-2026'),
    'employee', jsonb_build_object('employeeNumber', '99999999', 'categoryName', 'OTRA CATEGORIA'),
    'attendance', '{}'::jsonb,
    'vacations', '{}'::jsonb,
    'payroll', jsonb_build_object(
      'earnings', jsonb_build_array(
        jsonb_build_object('lineIndex', 0, 'code', '002', 'description', 'SUELDO', 'amount', 100, 'kind', 'earning', 'confidence', 1, 'confirmedByUser', true)
      ),
      'deductions', jsonb_build_array(),
      'observations', jsonb_build_array(),
      'totalEarnings', 100,
      'totalDeductions', 0,
      'netPay', 100
    ),
    'extraction', jsonb_build_object('method', 'native_text', 'globalConfidence', 1, 'validations', jsonb_build_object('templateDetected', true))
  );

  BEGIN
    PERFORM public.confirm_imported_payslip('hash_replacement_unauth', v_payload, '{}'::jsonb, false, true);
    RAISE EXCEPTION 'Test 5 FAILED: expected matricula_mismatch was not raised';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%matricula_mismatch%' THEN
        RAISE EXCEPTION 'Test 5 FAILED: unexpected error: %', SQLERRM;
      END IF;
  END;
END;
$$;

-- 8. Cleanup
RESET ROLE;
DELETE FROM public.imported_payslip_observations WHERE payslip_id IN (
  SELECT id FROM public.imported_payslips WHERE user_id = '00000000-0000-0000-0000-00000000c001'
);
DELETE FROM public.imported_payslip_lines WHERE payslip_id IN (
  SELECT id FROM public.imported_payslips WHERE user_id = '00000000-0000-0000-0000-00000000c001'
);
DELETE FROM public.worker_active_context WHERE user_id = '00000000-0000-0000-0000-00000000c001';
DELETE FROM public.vacation_profile_data WHERE user_id = '00000000-0000-0000-0000-00000000c001';
DELETE FROM public.payroll_contexts WHERE user_id = '00000000-0000-0000-0000-00000000c001';
DELETE FROM public.imported_payslips WHERE user_id = '00000000-0000-0000-0000-00000000c001';
DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000c001';
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000c001';

