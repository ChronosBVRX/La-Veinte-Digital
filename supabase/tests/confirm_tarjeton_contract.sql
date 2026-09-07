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

-- 6. Cleanup
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
