-- 20260903183000_atomic_payslip_vacation_due_date.sql
-- Actualización atómica de fecha por vencer y dueDate en imported_payslips
-- dentro del RPC confirm_imported_payslip_v1 para reimportaciones duplicadas.
--
-- Evita actualizaciones no atómicas desde el cliente y garantiza que
-- si el tarjetón ya existía pero no tenía dueDate o porVencer persistida
-- (e.g. recibos procesados con versión previa que no extraía formato DDMMYYYY),
-- el registro se actualice de forma transaccional e idempotente.

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

  -- Matrícula: sin confirmación explícita no se actualiza ni se acepta
  -- un cambio. Si el tarjetón trae matrícula distinta a la del perfil y
  -- el trabajador no autorizó el cambio, se detiene la confirmación.
  SELECT matricula INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF v_profile.matricula IS NOT NULL
     AND NULLIF(v_emp->>'employeeNumber', '') IS NOT NULL
     AND v_profile.matricula <> (v_emp->>'employeeNumber')
     AND (p_profile_updates->>'matricula') <> 'true' THEN
    RAISE EXCEPTION 'matricula_mismatch';
  END IF;

  -- Idempotencia: si ya existe para este usuario con el mismo source_hash,
  -- actualizar atómicamente la sección de vacations si el nuevo payload trae fecha por vencer
  SELECT id, vacations INTO v_existing, v_existing_vac FROM public.imported_payslips
    WHERE user_id = v_user_id AND source_hash = p_source_hash;

  IF v_existing IS NOT NULL THEN
    IF v_vac IS NOT NULL AND (
      NULLIF(v_vac->>'dueDate', '') IS NOT NULL OR
      NULLIF(v_vac->>'porVencer', '') IS NOT NULL OR
      NULLIF(v_vac->>'porVencerRaw', '') IS NOT NULL
    ) THEN
      v_merged_vac := jsonb_strip_nulls(
        COALESCE(v_existing_vac, '{}'::jsonb) ||
        jsonb_build_object(
          'porVencer', COALESCE(NULLIF(v_existing_vac->>'porVencer', ''), NULLIF(v_vac->>'porVencer', '')),
          'dueDate', COALESCE(NULLIF(v_existing_vac->>'dueDate', ''), NULLIF(v_vac->>'dueDate', ''), NULLIF(v_existing_vac->>'porVencer', ''), NULLIF(v_vac->>'porVencer', '')),
          'porVencerRaw', COALESCE(NULLIF(v_existing_vac->>'porVencerRaw', ''), NULLIF(v_vac->>'porVencerRaw', ''))
        )
      );
      UPDATE public.imported_payslips
      SET vacations = v_merged_vac,
          updated_at = now()
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
    user_id, source_hash, extraction_method, period_raw, period_year,
    period_month, period_half, folio, fiscal_folio_hash, certification_date,
    global_confidence, warnings, employee_data, attendance, vacations, payroll_totals
  ) VALUES (
    v_user_id, p_source_hash, v_method, v_period_raw, v_year, v_month,
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
    IF (p_profile_updates->>'matricula') = 'true' AND NULLIF(v_emp->>'employeeNumber', '') IS NOT NULL THEN
      UPDATE public.profiles SET matricula = v_emp->>'employeeNumber', updated_at = now() WHERE id = v_user_id;
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

  -- Contexto de nomina: categoria, jornada, antiguedad efectiva, tipo de
  -- contratacion, conceptos recurrentes del tarjeton y hechos de nomina.
  SELECT recurring_concepts, payroll_facts INTO v_existing_rc, v_existing_facts
    FROM public.payroll_contexts WHERE user_id = v_user_id;

  IF v_existing_rc IS NOT NULL AND jsonb_typeof(v_existing_rc) = 'array' THEN
    v_new_rc := v_existing_rc;
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
  v_facts := COALESCE(v_existing_facts, '[]'::jsonb);
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
    user_id, category_name, category_code, workday_hours, effective_seniority_date,
    employment_type, recurring_concepts, payroll_facts, created_at, updated_at
  ) VALUES (
    v_user_id, v_cat_name, v_emp->>'categoryCode', v_hours, v_sen_date,
    v_employment, v_new_rc, v_facts, now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    category_name = COALESCE(EXCLUDED.category_name, public.payroll_contexts.category_name),
    category_code = COALESCE(EXCLUDED.category_code, public.payroll_contexts.category_code),
    workday_hours = COALESCE(EXCLUDED.workday_hours, public.payroll_contexts.workday_hours),
    effective_seniority_date = COALESCE(EXCLUDED.effective_seniority_date, public.payroll_contexts.effective_seniority_date),
    employment_type = COALESCE(EXCLUDED.employment_type, public.payroll_contexts.employment_type),
    recurring_concepts = EXCLUDED.recurring_concepts,
    payroll_facts = EXCLUDED.payroll_facts,
    updated_at = now();
  v_ctx_updated := true;

  RETURN jsonb_build_object(
    'id', v_id,
    'duplicate', false,
    'warnings', v_warnings,
    'profileUpdated', v_profile_updated,
    'payrollContextUpdated', v_ctx_updated
  );
END;
$$;
