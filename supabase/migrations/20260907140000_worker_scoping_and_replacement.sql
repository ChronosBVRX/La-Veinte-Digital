-- 20260907140000_worker_scoping_and_replacement.sql
-- Aislamiento estricto de datos laborales por matrícula activa.
--
-- 1. Agrega employee_number a imported_payslips y vacation_profile_data
-- 2. Índices de consulta para el tarjetón activo por (user_id, employee_number)
-- 3. Backfill idempotente de employee_number desde employee_data
-- 4. RPC confirm_imported_payslip_v1 y wrapper confirm_imported_payslip
--    con aislamiento de reemplazo (sameWorker vs workerReplacement)

-- 1. Nuevas columnas normalizadas
ALTER TABLE public.imported_payslips
  ADD COLUMN IF NOT EXISTS employee_number TEXT;

CREATE INDEX IF NOT EXISTS idx_imported_payslips_worker
  ON public.imported_payslips (user_id, employee_number, period_year DESC, period_month DESC, period_half DESC, created_at DESC);

ALTER TABLE public.vacation_profile_data
  ADD COLUMN IF NOT EXISTS employee_number TEXT;

CREATE INDEX IF NOT EXISTS idx_vacation_profile_worker
  ON public.vacation_profile_data (user_id, employee_number);

-- 2. Backfill idempotente
UPDATE public.imported_payslips
SET employee_number = NULLIF(trim(employee_data->>'employeeNumber'), '')
WHERE employee_number IS NULL
  AND employee_data->>'employeeNumber' IS NOT NULL
  AND NULLIF(trim(employee_data->>'employeeNumber'), '') IS NOT NULL;

UPDATE public.payroll_contexts pc
SET matricula = p.matricula
FROM public.profiles p
WHERE pc.user_id = p.id
  AND pc.matricula IS NULL
  AND p.matricula IS NOT NULL;

UPDATE public.vacation_profile_data vpd
SET employee_number = p.matricula
FROM public.profiles p
WHERE vpd.user_id = p.id
  AND vpd.employee_number IS NULL
  AND p.matricula IS NOT NULL;

-- 3. RPC confirm_imported_payslip_v1
CREATE OR REPLACE FUNCTION public.confirm_imported_payslip_v1(
  p_source_hash TEXT,
  p_parsed JSONB,
  p_profile_updates JSONB,
  p_acknowledge_total_difference BOOLEAN,
  p_authorize_server_storage BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing UUID;
  v_existing_emp_num TEXT;
  v_id UUID;
  v_doc JSONB;
  v_emp JSONB;
  v_att JSONB;
  v_vac JSONB;
  v_pay JSONB;
  v_ext JSONB;
  v_lines JSONB;
  v_obs JSONB;
  v_line JSONB;
  v_obs_row JSONB;
  v_amount NUMERIC;
  v_sum_earn NUMERIC := 0;
  v_sum_ded NUMERIC := 0;
  v_tot_earn NUMERIC;
  v_tot_ded NUMERIC;
  v_net NUMERIC;
  v_accept BOOLEAN;
  v_i INTEGER;
  v_count INTEGER;
  v_code TEXT;
  v_kind TEXT;
  v_method TEXT;
  v_confidence NUMERIC;
  v_period_raw TEXT;
  v_year SMALLINT;
  v_month SMALLINT;
  v_half SMALLINT;
  v_folio TEXT;
  v_fiscal_hash TEXT;
  v_cert DATE;
  v_warnings JSONB;
  v_cat_name TEXT;
  v_hours NUMERIC;
  v_seniority JSONB;
  v_sen_date DATE;
  v_employment TEXT;
  v_profile_updated BOOLEAN := false;
  v_ctx_updated BOOLEAN := false;
  v_profile RECORD;
  v_old_matricula TEXT;
  v_new_matricula TEXT;
  v_same_worker BOOLEAN;
  v_worker_replacement BOOLEAN;
  v_rc JSONB := '[]'::jsonb;
  v_facts JSONB := '[]'::jsonb;
  v_existing_rc JSONB;
  v_existing_facts JSONB;
  v_rc_entry JSONB;
  v_fact_entry JSONB;
  v_found BOOLEAN;
  v_new_rc JSONB := '[]'::jsonb;
  v_has_054 BOOLEAN := false;
  v_existing_vac JSONB;
  v_merged_vac JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_source_hash IS NULL OR p_source_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_payload: source_hash';
  END IF;

  IF p_parsed IS NULL OR p_parsed->>'schemaVersion' <> '1.0' THEN
    RAISE EXCEPTION 'invalid_payload: schemaVersion';
  END IF;

  v_doc := p_parsed->'document';
  v_emp := p_parsed->'employee';
  v_att := p_parsed->'attendance';
  v_vac := p_parsed->'vacations';
  v_pay := p_parsed->'payroll';
  v_ext := p_parsed->'extraction';
  v_lines := COALESCE(v_pay->'earnings', '[]'::jsonb) || COALESCE(v_pay->'deductions', '[]'::jsonb);
  v_obs := COALESCE(v_pay->'observations', '[]'::jsonb);

  IF jsonb_typeof(v_lines) <> 'array' OR jsonb_typeof(v_obs) <> 'array' THEN
    RAISE EXCEPTION 'invalid_payload: arrays';
  END IF;

  v_count := jsonb_array_length(v_lines);
  IF v_count = 0 OR v_count > 80 THEN
    RAISE EXCEPTION 'limits_exceeded: concept lines';
  END IF;
  IF jsonb_array_length(v_obs) > 80 THEN
    RAISE EXCEPTION 'limits_exceeded: observations';
  END IF;

  IF v_doc->>'type' IS DISTINCT FROM 'imss_payroll_receipt' THEN
    RAISE EXCEPTION 'invalid_payload: type';
  END IF;

  v_method := v_ext->>'method';
  IF v_method NOT IN ('native_text', 'ocr', 'hybrid') THEN
    RAISE EXCEPTION 'invalid_payload: method';
  END IF;
  v_confidence := COALESCE((v_ext->>'globalConfidence')::NUMERIC, 0);
  IF v_confidence < 0 OR v_confidence > 1 THEN
    RAISE EXCEPTION 'invalid_payload: confidence';
  END IF;

  -- Recalcular totales en el servidor (nunca se confía en el cliente).
  v_sum_earn := 0;
  v_sum_ded := 0;
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_amount := (v_line->>'amount')::NUMERIC;
    v_kind := v_line->>'kind';
    IF v_amount IS NULL OR NOT (v_kind IN ('earning', 'deduction')) THEN
      RAISE EXCEPTION 'invalid_payload: line';
    END IF;
    IF v_kind = 'earning' THEN
      v_sum_earn := v_sum_earn + v_amount;
    ELSE
      v_sum_ded := v_sum_ded + v_amount;
    END IF;
  END LOOP;

  v_tot_earn := (v_pay->>'totalEarnings')::NUMERIC;
  v_tot_ded := (v_pay->>'totalDeductions')::NUMERIC;
  v_net := (v_pay->>'netPay')::NUMERIC;

  v_accept := p_acknowledge_total_difference = true;

  IF v_tot_earn IS NOT NULL AND abs(v_sum_earn - v_tot_earn) > 0.05 AND NOT v_accept THEN
    RAISE EXCEPTION 'totals_mismatch: earnings';
  END IF;
  IF v_tot_ded IS NOT NULL AND abs(abs(v_sum_ded) - v_tot_ded) > 0.05 AND NOT v_accept THEN
    RAISE EXCEPTION 'totals_mismatch: deductions';
  END IF;
  IF v_tot_earn IS NOT NULL AND v_tot_ded IS NOT NULL AND v_net IS NOT NULL
     AND abs((v_tot_earn - v_tot_ded) - v_net) > 0.05 AND NOT v_accept THEN
    RAISE EXCEPTION 'totals_mismatch: netPay';
  END IF;

  -- Identidad del trabajador y protección de sustitución
  v_new_matricula := NULLIF(trim(v_emp->>'employeeNumber'), '');
  SELECT matricula INTO v_profile FROM public.profiles WHERE id = v_user_id;
  v_old_matricula := NULLIF(trim(v_profile.matricula), '');

  v_same_worker := (v_old_matricula IS NULL OR v_new_matricula IS NULL OR v_old_matricula = v_new_matricula);
  v_worker_replacement := (v_old_matricula IS NOT NULL AND v_new_matricula IS NOT NULL AND v_old_matricula <> v_new_matricula AND (p_profile_updates->>'matricula') = 'true');

  IF NOT v_same_worker AND NOT v_worker_replacement THEN
    RAISE EXCEPTION 'matricula_mismatch';
  END IF;

  -- Idempotencia: si ya existe para este usuario con el mismo source_hash
  SELECT id, vacations, employee_number INTO v_existing, v_existing_vac, v_existing_emp_num
    FROM public.imported_payslips
    WHERE user_id = v_user_id AND source_hash = p_source_hash;

  IF v_existing IS NOT NULL THEN
    -- Actualizar employee_number si estaba nulo en el registro previo
    IF v_existing_emp_num IS NULL AND v_new_matricula IS NOT NULL THEN
      UPDATE public.imported_payslips
      SET employee_number = v_new_matricula
      WHERE id = v_existing AND user_id = v_user_id;
    END IF;

    -- Hallazgo 5: Si el nuevo payload trae fecha por vencer o dueDate, el valor confirmado gana
    IF v_vac IS NOT NULL AND (
      NULLIF(v_vac->>'dueDate', '') IS NOT NULL OR
      NULLIF(v_vac->>'porVencer', '') IS NOT NULL OR
      NULLIF(v_vac->>'porVencerRaw', '') IS NOT NULL
    ) THEN
      v_merged_vac := jsonb_strip_nulls(
        COALESCE(v_existing_vac, '{}'::jsonb) ||
        jsonb_build_object(
          'porVencer', COALESCE(NULLIF(v_vac->>'porVencer', ''), NULLIF(v_existing_vac->>'porVencer', '')),
          'dueDate', COALESCE(NULLIF(v_vac->>'dueDate', ''), NULLIF(v_vac->>'porVencer', ''), NULLIF(v_existing_vac->>'dueDate', ''), NULLIF(v_existing_vac->>'porVencer', '')),
          'porVencerRaw', COALESCE(NULLIF(v_vac->>'porVencerRaw', ''), NULLIF(v_existing_vac->>'porVencerRaw', ''))
        )
      );
      UPDATE public.imported_payslips
      SET vacations = v_merged_vac
      WHERE id = v_existing AND user_id = v_user_id;
    END IF;

    RETURN jsonb_build_object(
      'id', v_existing,
      'duplicate', true,
      'warnings', jsonb_build_array('Este tarjetón ya había sido importado anteriormente.'),
      'profileUpdated', false,
      'payrollContextUpdated', false
    );
  END IF;

  -- Campos derivados
  v_period_raw := v_doc->>'periodRaw';
  v_year := (v_doc->>'year')::SMALLINT;
  v_month := (v_doc->>'month')::SMALLINT;
  v_half := (v_doc->>'half')::SMALLINT;
  v_folio := NULLIF(v_doc->>'folio', '');
  v_fiscal_hash := NULLIF(v_doc->>'fiscalFolioHash', '');
  v_cert := NULLIF(v_doc->>'certificationDate', '')::DATE;
  v_warnings := COALESCE(p_parsed->'warnings', '[]'::jsonb);

  v_cat_name := NULLIF(v_emp->>'categoryName', '');
  v_hours := (v_emp->>'workdayHours')::NUMERIC;
  v_seniority := v_emp->'seniority';
  v_sen_date := NULLIF(v_seniority->>'reconstructedEffectiveDate', '')::DATE;
  v_employment := NULLIF(v_emp->>'employmentType', '');

  INSERT INTO public.imported_payslips (
    user_id, employee_number, source_hash, extraction_method, period_raw, period_year,
    period_month, period_half, folio, fiscal_folio_hash, certification_date,
    global_confidence, warnings, employee_data, attendance, vacations, payroll_totals
  ) VALUES (
    v_user_id, v_new_matricula, p_source_hash, v_method, v_period_raw, v_year, v_month,
    v_half, v_folio, v_fiscal_hash, v_cert, v_confidence, v_warnings,
    v_emp, v_att, v_vac,
    jsonb_build_object(
      'totalEarnings', v_tot_earn,
      'totalDeductions', v_tot_ded,
      'netPay', v_net,
      'daysWorkedInYear', (v_pay->>'daysWorkedInYear')::NUMERIC,
      'daysPaidInFortnight', (v_pay->>'daysPaidInFortnight')::NUMERIC,
      'integratedMonthlySalary', (v_pay->>'integratedMonthlySalary')::NUMERIC,
      'creditCapacity', (v_pay->>'creditCapacity')::NUMERIC
    )
  ) RETURNING id INTO v_id;

  v_i := 0;
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_i := v_i + 1;
    INSERT INTO public.imported_payslip_lines (
      payslip_id, line_index, concept_code, description, amount, kind, confidence, confirmed_by_user
    ) VALUES (
      v_id, v_i, v_line->>'code', COALESCE(v_line->>'description', ''),
      (v_line->>'amount')::NUMERIC, v_line->>'kind',
      COALESCE((v_line->>'confidence')::NUMERIC, 0),
      COALESCE((v_line->>'confirmedByUser')::BOOLEAN, false)
    );
    IF (v_line->>'kind') = 'earning' AND (v_line->>'code') = '054' AND (v_line->>'amount')::NUMERIC > 0 THEN
      v_has_054 := true;
    END IF;
  END LOOP;

  v_i := 0;
  FOR v_obs_row IN SELECT * FROM jsonb_array_elements(v_obs) LOOP
    v_i := v_i + 1;
    INSERT INTO public.imported_payslip_observations (
      payslip_id, line_index, concept_code, amount, due_period, units,
      control_number, initial_charge, notes
    ) VALUES (
      v_id, v_i, COALESCE(v_obs_row->>'conceptCode', ''), (v_obs_row->>'amount')::NUMERIC,
      NULLIF(v_obs_row->>'duePeriod', ''), (v_obs_row->>'units')::SMALLINT,
      NULLIF(v_obs_row->>'controlNumber', ''), (v_obs_row->>'initialCharge')::NUMERIC,
      NULLIF(v_obs_row->>'notes', '')
    );
  END LOOP;

  -- Perfil: SOLO los campos autorizados por el trabajador.
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF v_profile.id IS NOT NULL THEN
    IF (p_profile_updates->>'fullName') = 'true' AND NULLIF(v_emp->>'fullName', '') IS NOT NULL THEN
      UPDATE public.profiles SET full_name = v_emp->>'fullName', updated_at = now() WHERE id = v_user_id;
      v_profile_updated := true;
    END IF;
    IF (p_profile_updates->>'matricula') = 'true' AND v_new_matricula IS NOT NULL THEN
      UPDATE public.profiles SET matricula = v_new_matricula, updated_at = now() WHERE id = v_user_id;
      v_profile_updated := true;
    END IF;
    IF (p_profile_updates->>'adscripcion') = 'true' AND NULLIF(v_emp->>'assignmentName', '') IS NOT NULL THEN
      UPDATE public.profiles SET adscripcion = v_emp->>'assignmentName', updated_at = now() WHERE id = v_user_id;
      v_profile_updated := true;
    END IF;
    IF (p_profile_updates->>'categoria') = 'true' AND v_cat_name IS NOT NULL THEN
      UPDATE public.profiles SET categoria = v_cat_name, updated_at = now() WHERE id = v_user_id;
      v_profile_updated := true;
    END IF;
    IF (p_profile_updates->>'antiguedad') = 'true' AND NULLIF(v_seniority->>'raw', '') IS NOT NULL THEN
      UPDATE public.profiles SET antiguedad = v_seniority->>'raw', updated_at = now() WHERE id = v_user_id;
      v_profile_updated := true;
    END IF;
  END IF;

  -- Hallazgo 2: Contexto de nómina (scoping por trabajador)
  IF v_worker_replacement THEN
    -- Sustitución: NO heredar conceptos recurrentes ni hechos del trabajador anterior
    v_new_rc := '[]'::jsonb;
    v_facts := '[]'::jsonb;
  ELSE
    -- Mismo trabajador: fusionar histórico como hasta ahora
    SELECT recurring_concepts, payroll_facts INTO v_existing_rc, v_existing_facts
      FROM public.payroll_contexts WHERE user_id = v_user_id;

    IF v_existing_rc IS NOT NULL AND jsonb_typeof(v_existing_rc) = 'array' THEN
      v_new_rc := v_existing_rc;
    END IF;
    v_facts := COALESCE(v_existing_facts, '[]'::jsonb);
  END IF;

  -- Codigos recurrentes confirmados: 050 (mayor importe), 023 y 063.
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_code := v_line->>'code';
    IF (v_line->>'kind') <> 'earning' OR v_code NOT IN ('050', '023', '063') THEN
      CONTINUE;
    END IF;
    v_found := false;
    FOR v_rc_entry IN SELECT * FROM jsonb_array_elements(v_new_rc) LOOP
      IF v_rc_entry->>'conceptCode' = v_code THEN
        v_found := true;
      END IF;
    END LOOP;
    IF v_found THEN
      v_new_rc := (
        SELECT jsonb_agg(
          CASE
            WHEN elem->>'conceptCode' = v_code THEN
              jsonb_build_object(
                'conceptCode', v_code,
                'appearsNormally', true,
                'lastAmount', CASE
                  WHEN v_code = '050' THEN GREATEST(COALESCE((elem->>'lastAmount')::NUMERIC, 0), (v_line->>'amount')::NUMERIC)
                  ELSE (v_line->>'amount')::NUMERIC
                END,
                'source', 'payslip_import',
                'lastSeenAt', now()
              )
            ELSE elem
          END
        ) FROM jsonb_array_elements(v_new_rc) AS elem
      );
    ELSE
      v_new_rc := v_new_rc || jsonb_build_array(jsonb_build_object(
        'conceptCode', v_code,
        'appearsNormally', true,
        'lastAmount', (v_line->>'amount')::NUMERIC,
        'source', 'payslip_import',
        'firstSeenAt', now(),
        'lastSeenAt', now()
      ));
    END IF;
  END LOOP;

  -- Hechos de nomina: registrar concepto 054 si vino en percepciones.
  IF v_has_054 THEN
    v_found := false;
    FOR v_fact_entry IN SELECT * FROM jsonb_array_elements(v_facts) LOOP
      IF v_fact_entry->>'key' = 'concept_054_on_payslip' THEN
        v_found := true;
      END IF;
    END LOOP;
    IF NOT v_found THEN
      v_facts := v_facts || jsonb_build_array(jsonb_build_object(
        'key', 'concept_054_on_payslip',
        'value', true,
        'source', 'payslip_import',
        'recordedAt', now()
      ));
    END IF;
  END IF;

  INSERT INTO public.payroll_contexts (
    user_id, matricula, category_name, category_code, workday_hours, effective_seniority_date,
    employment_type, recurring_concepts, payroll_facts, created_at, updated_at
  ) VALUES (
    v_user_id, COALESCE(v_new_matricula, v_old_matricula), v_cat_name, v_emp->>'categoryCode', v_hours, v_sen_date,
    v_employment, v_new_rc, v_facts, now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    matricula = COALESCE(v_new_matricula, EXCLUDED.matricula, public.payroll_contexts.matricula),
    category_name = EXCLUDED.category_name,
    category_code = EXCLUDED.category_code,
    workday_hours = EXCLUDED.workday_hours,
    effective_seniority_date = EXCLUDED.effective_seniority_date,
    employment_type = EXCLUDED.employment_type,
    recurring_concepts = EXCLUDED.recurring_concepts,
    payroll_facts = EXCLUDED.payroll_facts,
    updated_at = now();
  v_ctx_updated := true;

  -- Hallazgo 3: vacation_profile_data — aislar o resetear ante workerReplacement
  IF v_worker_replacement THEN
    UPDATE public.vacation_profile_data
    SET employee_number = v_new_matricula,
        contract_type = NULL,
        category = v_cat_name,
        category_code = v_emp->>'categoryCode',
        work_schedule_type = NULL,
        shift = NULL,
        adscription = v_emp->>'location',
        unit = NULL,
        service = NULL,
        entry_date = NULLIF(v_emp->>'entryDate', '')::DATE,
        effective_seniority_years = (v_seniority->>'years')::INTEGER,
        effective_seniority_fortnights = (v_seniority->>'fortnights')::INTEGER,
        effective_seniority_days = (v_seniority->>'days')::INTEGER,
        radiological_exposure = NULL,
        weekly_rest_days = '{5,6}',
        contract_end_date = NULL,
        updated_at = now()
    WHERE user_id = v_user_id;
  ELSE
    UPDATE public.vacation_profile_data
    SET employee_number = COALESCE(v_new_matricula, v_old_matricula)
    WHERE user_id = v_user_id AND employee_number IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'duplicate', false,
    'warnings', v_warnings,
    'profileUpdated', v_profile_updated,
    'payrollContextUpdated', v_ctx_updated
  );
END;
$$;

-- 4. Actualizar wrapper público confirm_imported_payslip
CREATE OR REPLACE FUNCTION public.confirm_imported_payslip(
  p_source_hash TEXT,
  p_parsed JSONB,
  p_profile_updates JSONB,
  p_acknowledge_total_difference BOOLEAN,
  p_authorize_server_storage BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_line JSONB;
  v_fiscal_hash TEXT;
  v_category_code TEXT;
  v_category_name TEXT;
  v_seniority JSONB;
  v_parsed JSONB;
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF COALESCE(p_profile_updates, '{}'::jsonb) ? 'adscripcion'
     OR COALESCE(p_parsed->'employee', '{}'::jsonb) ?| ARRAY['assignmentCode', 'assignmentName'] THEN
    RAISE EXCEPTION 'invalid_payload: assignment';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(COALESCE(p_profile_updates, '{}'::jsonb)) AS keys(key)
    WHERE key <> ALL (ARRAY['fullName', 'matricula', 'categoria', 'antiguedad'])
  ) OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(COALESCE(p_parsed->'employee', '{}'::jsonb)) AS keys(key)
    WHERE key <> ALL (ARRAY[
      'employeeNumber', 'fullName', 'employmentType', 'location', 'organizationalCode',
      'categoryCode', 'categoryName', 'workdayHours', 'plaza', 'entryDate', 'seniority'
    ])
  ) OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(COALESCE(p_parsed->'employee'->'seniority', '{}'::jsonb)) AS keys(key)
    WHERE key <> ALL (ARRAY['raw', 'years', 'fortnights', 'days', 'referenceDate', 'reconstructedEffectiveDate', 'parsed', 'status'])
  ) OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(COALESCE(p_parsed->'attendance', '{}'::jsonb)) AS keys(key)
    WHERE key <> ALL (ARRAY[
      'delays', 'exitPasses', 'absences', 'noDelayDays', 'attendanceScore', 'incidentFortnight',
      'generalIllnessLeave', 'occupationalRiskLeave', 'maternityLeave', 'license140Bis',
      'paidLicenses', 'unpaidLicenses', 'commissions', 'trainingCommissions',
      'scholarshipWithPay', 'scholarshipWithoutPay', 'concept033Days'
    ])
  ) OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(COALESCE(p_parsed->'vacations', '{}'::jsonb)) AS keys(key)
    WHERE key <> ALL (ARRAY[
      'enjoyedDays', 'daysInYear', 'twentyYearsOrMoreDays', 'expiredPeriods', 'continuityMark',
      'periodNumberToEnjoy', 'firstPeriodStartRaw', 'secondPeriodStartRaw', 'accumulatedRetirementDays',
      'porVencer', 'porVencerRaw', 'dueDate'
    ])
  ) THEN
    RAISE EXCEPTION 'invalid_payload: unknown field';
  END IF;

  -- Validacion recursiva de seniority.parsed
  v_seniority := COALESCE(p_parsed->'employee'->'seniority', '{}'::jsonb);
  IF v_seniority ? 'parsed' THEN
    v_parsed := v_seniority->'parsed';
    IF jsonb_typeof(v_parsed) <> 'object' THEN
      RAISE EXCEPTION 'invalid_payload: seniority.parsed must be an object';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(v_parsed) AS keys(key)
      WHERE key <> ALL (ARRAY['years', 'fortnights', 'days'])
    ) THEN
      RAISE EXCEPTION 'invalid_payload: unknown field in seniority.parsed';
    END IF;
  END IF;

  -- Validacion de seniority.status
  IF v_seniority ? 'status' THEN
    v_status := v_seniority->>'status';
    IF v_status <> ALL (ARRAY['unparsed', 'missing_reference_date', 'complete']) THEN
      RAISE EXCEPTION 'invalid_payload: invalid seniority.status';
    END IF;
  END IF;

  -- Defensa en profundidad contra campos sensibles
  IF p_parsed::TEXT ~* '"(rfc|curp|nss|numero.?de.?seguro.?social|cuenta.?bancaria|numero.?de.?cuenta|tarjeta|codigo.?qr|sello|cadena.?original|dato.?biometrico)"[[:space:]]*:' THEN
    RAISE EXCEPTION 'invalid_payload: sensitive field';
  END IF;

  v_fiscal_hash := NULLIF(p_parsed->'document'->>'fiscalFolioHash', '');
  IF v_fiscal_hash IS NOT NULL AND v_fiscal_hash !~ '^[a-fA-F0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_payload: fiscalFolioHash';
  END IF;

  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(
      COALESCE(p_parsed->'payroll'->'earnings', '[]'::jsonb)
      || COALESCE(p_parsed->'payroll'->'deductions', '[]'::jsonb)
    )
  LOOP
    IF COALESCE((v_line->>'confirmedByUser')::BOOLEAN, false) <> true THEN
      RAISE EXCEPTION 'invalid_payload: unconfirmed line';
    END IF;
  END LOOP;

  v_result := public.confirm_imported_payslip_v1(
    p_source_hash,
    p_parsed,
    p_profile_updates,
    p_acknowledge_total_difference,
    p_authorize_server_storage
  );

  v_category_code := NULLIF(p_parsed->'employee'->>'categoryCode', '');
  v_category_name := NULLIF(p_parsed->'employee'->>'categoryName', '');
  IF COALESCE((v_result->>'duplicate')::BOOLEAN, false) = false AND v_category_name IS NOT NULL THEN
    UPDATE public.payroll_contexts
       SET category_code = v_category_code,
           updated_at = now()
     WHERE user_id = auth.uid();
  END IF;

  RETURN jsonb_set(v_result, '{schemaVersion}', '"1.0"'::jsonb, true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_imported_payslip(TEXT, JSONB, JSONB, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_imported_payslip(TEXT, JSONB, JSONB, BOOLEAN, BOOLEAN) TO authenticated;
