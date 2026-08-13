-- 018: persistencia tolerante a datos secundarios imperfectos
--
-- Un dato opcional mal leido por el PDF/OCR (observaciones, fechas
-- auxiliares, confianzas, jornada) NO debe abortar la confirmacion de un
-- tarjeton completo: se normaliza a NULL y se agrega un warning a la fila.
-- Los datos criticos (importes de conceptos y totales) mantienen la
-- validacion estricta con mensajes claros.
--
-- Se reemplaza confirm_imported_payslip_v1 (migracion 017) con
-- conversiones defensivas; el wrapper publico confirm_imported_payslip
-- (migracion 015) no cambia.

-- Helper: casteo a NUMERIC que devuelve NULL en lugar de lanzar error
-- ante texto no numerico (artifacts geometricos del PDF).
CREATE OR REPLACE FUNCTION public.safe_numeric_cast(value TEXT)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN value ~ '^-?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$' THEN value::NUMERIC
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION public.safe_numeric_cast(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.confirm_imported_payslip_v1(
  p_source_hash TEXT, p_parsed JSONB, p_profile_updates JSONB,
  p_acknowledge_total_difference BOOLEAN, p_authorize_server_storage BOOLEAN
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing UUID; v_id UUID;
  v_doc JSONB; v_emp JSONB; v_att JSONB; v_vac JSONB; v_pay JSONB; v_ext JSONB;
  v_lines JSONB; v_obs JSONB; v_line JSONB; v_obs_row JSONB;
  v_amount NUMERIC; v_sum_earn NUMERIC := 0; v_sum_ded NUMERIC := 0;
  v_tot_earn NUMERIC; v_tot_ded NUMERIC; v_net NUMERIC; v_accept BOOLEAN;
  v_i INTEGER; v_count INTEGER; v_code TEXT; v_kind TEXT;
  v_method TEXT; v_confidence NUMERIC; v_line_conf NUMERIC; v_period_raw TEXT;
  v_year SMALLINT; v_month SMALLINT; v_half SMALLINT;
  v_folio TEXT; v_fiscal_hash TEXT; v_cert DATE; v_cert_bad BOOLEAN := false; v_warnings JSONB;
  v_cat_name TEXT; v_hours NUMERIC; v_seniority JSONB; v_sen_date DATE; v_sen_bad BOOLEAN := false;
  v_employment TEXT;
  v_obs_amount NUMERIC; v_obs_charge NUMERIC; v_obs_units SMALLINT;
  v_obs_clean JSONB := '[]'::jsonb;
  v_profile_updated BOOLEAN := false; v_ctx_updated BOOLEAN := false;
  v_profile_matricula TEXT; v_profile RECORD;
  v_rc JSONB := '[]'::jsonb; v_facts JSONB := '[]'::jsonb;
  v_existing_rc JSONB; v_existing_facts JSONB;
  v_rc_entry JSONB; v_fact_entry JSONB; v_found BOOLEAN;
  v_new_rc JSONB := '[]'::jsonb; v_has_054 BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_authorize_server_storage <> true THEN RAISE EXCEPTION 'consent_required'; END IF;
  INSERT INTO public.payroll_contexts (user_id, consent_given, consent_given_at)
  VALUES (v_user_id, true, now()) ON CONFLICT (user_id) DO UPDATE SET consent_given = true, consent_given_at = now();
  IF p_source_hash IS NULL OR p_source_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_payload: source_hash'; END IF;
  IF p_parsed IS NULL OR p_parsed->>'schemaVersion' <> '1.0' THEN RAISE EXCEPTION 'invalid_payload: schemaVersion'; END IF;
  v_doc := p_parsed->'document'; v_emp := p_parsed->'employee';
  v_att := p_parsed->'attendance'; v_vac := p_parsed->'vacations';
  v_pay := p_parsed->'payroll'; v_ext := p_parsed->'extraction';
  v_lines := COALESCE(v_pay->'earnings', '[]'::jsonb) || COALESCE(v_pay->'deductions', '[]'::jsonb);
  v_obs := COALESCE(v_pay->'observations', '[]'::jsonb);
  IF jsonb_typeof(v_lines) <> 'array' OR jsonb_typeof(v_obs) <> 'array' THEN RAISE EXCEPTION 'invalid_payload: arrays'; END IF;
  v_count := jsonb_array_length(v_lines);
  IF v_count = 0 OR v_count > 80 THEN RAISE EXCEPTION 'limits_exceeded: concept lines'; END IF;
  IF jsonb_array_length(v_obs) > 80 THEN RAISE EXCEPTION 'limits_exceeded: observations'; END IF;
  IF v_doc->>'type' IS DISTINCT FROM 'imss_payroll_receipt' THEN RAISE EXCEPTION 'invalid_payload: type'; END IF;
  v_method := v_ext->>'method';
  IF v_method NOT IN ('native_text', 'ocr', 'hybrid') THEN RAISE EXCEPTION 'invalid_payload: method'; END IF;
  v_warnings := COALESCE(v_ext->'warnings', '[]'::jsonb);
  v_confidence := COALESCE(public.safe_numeric_cast(v_ext->>'globalConfidence'), 0);
  IF v_confidence < 0 OR v_confidence > 1 THEN RAISE EXCEPTION 'invalid_payload: confidence'; END IF;
  v_sum_earn := 0; v_sum_ded := 0;
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_amount := public.safe_numeric_cast(v_line->>'amount');
    v_kind := v_line->>'kind';
    IF v_amount IS NULL OR NOT (v_kind IN ('earning', 'deduction')) THEN RAISE EXCEPTION 'invalid_payload: line amount'; END IF;
    IF abs(v_amount) > 100000000 THEN RAISE EXCEPTION 'invalid_payload: line amount out of range'; END IF;
    IF v_kind = 'earning' THEN v_sum_earn := v_sum_earn + v_amount; ELSE v_sum_ded := v_sum_ded + v_amount; END IF;
  END LOOP;
  v_tot_earn := public.safe_numeric_cast(v_pay->>'totalEarnings');
  v_tot_ded := public.safe_numeric_cast(v_pay->>'totalDeductions');
  v_net := public.safe_numeric_cast(v_pay->>'netPay');
  v_accept := p_acknowledge_total_difference = true;
  IF v_tot_earn IS NOT NULL AND abs(v_sum_earn - v_tot_earn) > 0.05 AND NOT v_accept THEN RAISE EXCEPTION 'totals_mismatch: earnings'; END IF;
  IF v_tot_ded IS NOT NULL AND abs(abs(v_sum_ded) - v_tot_ded) > 0.05 AND NOT v_accept THEN RAISE EXCEPTION 'totals_mismatch: deductions'; END IF;
  IF v_tot_earn IS NOT NULL AND v_tot_ded IS NOT NULL AND v_net IS NOT NULL AND abs((v_tot_earn - v_tot_ded) - v_net) > 0.05 AND NOT v_accept THEN RAISE EXCEPTION 'totals_mismatch: netPay'; END IF;
  IF (v_emp->>'employeeNumber') IS NOT NULL AND (v_emp->>'employeeNumber') <> '' THEN
    SELECT matricula INTO v_profile_matricula FROM public.profiles WHERE id = v_user_id;
    IF v_profile_matricula IS NOT NULL AND v_profile_matricula <> '' AND v_profile_matricula <> (v_emp->>'employeeNumber') THEN
      IF (p_profile_updates->>'matricula') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'matricula_mismatch'; END IF;
    END IF;
  END IF;
  SELECT id INTO v_existing FROM public.imported_payslips WHERE user_id = v_user_id AND source_hash = p_source_hash LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('id', v_existing, 'duplicate', true, 'profileUpdated', false, 'payrollContextUpdated', false); END IF;

  -- Datos secundarios: si no se pueden interpretar, se omiten con warning.
  v_period_raw := COALESCE(v_doc->>'periodRaw', '');
  v_year := NULL; v_month := NULL; v_half := NULL;
  IF (v_doc->>'year') IS NOT NULL THEN
    IF (v_doc->>'year') ~ '^\d{4}$' AND (v_doc->>'year')::INTEGER BETWEEN 1900 AND 2100 THEN v_year := (v_doc->>'year')::SMALLINT;
    ELSE v_warnings := v_warnings || jsonb_build_array('Anio de periodo invalido; se omitio.'); END IF;
  END IF;
  IF (v_doc->>'month') IS NOT NULL THEN
    IF (v_doc->>'month') ~ '^\d{1,2}$' AND (v_doc->>'month')::INTEGER BETWEEN 1 AND 12 THEN v_month := (v_doc->>'month')::SMALLINT;
    ELSE v_warnings := v_warnings || jsonb_build_array('Mes de periodo invalido; se omitio.'); END IF;
  END IF;
  IF (v_doc->>'half') IS NOT NULL THEN
    IF (v_doc->>'half') ~ '^[12]$' THEN v_half := (v_doc->>'half')::SMALLINT;
    ELSE v_warnings := v_warnings || jsonb_build_array('Quincena de periodo invalida; se omitio.'); END IF;
  END IF;
  v_folio := NULLIF(v_doc->>'folio', ''); v_fiscal_hash := NULLIF(v_doc->>'fiscalFolioHash', '');
  BEGIN
    v_cert := NULLIF(v_doc->>'certificationDate', '')::DATE;
  EXCEPTION WHEN OTHERS THEN
    v_cert := NULL; v_cert_bad := true;
  END;
  IF v_cert_bad THEN v_warnings := v_warnings || jsonb_build_array('Fecha de certificacion invalida; se omitio.'); END IF;
  v_cat_name := NULLIF(v_emp->>'categoryName', '');
  v_hours := public.safe_numeric_cast(v_emp->>'workdayHours');
  IF (v_emp->>'workdayHours') IS NOT NULL AND v_hours IS NULL THEN
    v_warnings := v_warnings || jsonb_build_array('Jornada invalida; se omitio.');
  END IF;
  v_seniority := v_emp->'seniority';
  BEGIN
    v_sen_date := NULLIF(v_seniority->>'reconstructedEffectiveDate', '')::DATE;
  EXCEPTION WHEN OTHERS THEN
    v_sen_date := NULL; v_sen_bad := true;
  END;
  IF v_sen_bad THEN v_warnings := v_warnings || jsonb_build_array('Fecha efectiva de antiguedad invalida; se omitio.'); END IF;
  v_employment := LOWER(NULLIF(v_emp->>'employmentType', ''));

  IF (v_pay->>'daysWorkedInYear') IS NOT NULL AND public.safe_numeric_cast(v_pay->>'daysWorkedInYear') IS NULL THEN
    v_warnings := v_warnings || jsonb_build_array('Dias trabajados en el anio invalidos; se omitieron.');
  END IF;
  IF (v_pay->>'daysPaidInFortnight') IS NOT NULL AND public.safe_numeric_cast(v_pay->>'daysPaidInFortnight') IS NULL THEN
    v_warnings := v_warnings || jsonb_build_array('Dias pagados en la quincena invalidos; se omitieron.');
  END IF;
  IF (v_pay->>'integratedMonthlySalary') IS NOT NULL AND public.safe_numeric_cast(v_pay->>'integratedMonthlySalary') IS NULL THEN
    v_warnings := v_warnings || jsonb_build_array('Salario mensual integrado invalido; se omitio.');
  END IF;
  IF (v_pay->>'creditCapacity') IS NOT NULL AND public.safe_numeric_cast(v_pay->>'creditCapacity') IS NULL THEN
    v_warnings := v_warnings || jsonb_build_array('Capacidad de credito invalida; se omitio.');
  END IF;

  -- Observaciones: se normalizan ANTES del INSERT del encabezado para que
  -- los warnings queden registrados en la misma fila. Los campos opcionales
  -- invalidos no abortan la transaccion.
  v_i := 0;
  FOR v_obs_row IN SELECT * FROM jsonb_array_elements(v_obs) LOOP
    v_i := v_i + 1;
    v_obs_amount := public.safe_numeric_cast(v_obs_row->>'amount');
    IF (v_obs_row->>'amount') IS NOT NULL AND v_obs_amount IS NULL THEN
      v_warnings := v_warnings || jsonb_build_array('Observacion ' || v_i || ': importe invalido; se omitio.');
    ELSIF v_obs_amount IS NOT NULL AND abs(v_obs_amount) > 100000000 THEN
      v_obs_amount := NULL;
      v_warnings := v_warnings || jsonb_build_array('Observacion ' || v_i || ': importe fuera de rango; se omitio.');
    END IF;
    v_obs_charge := public.safe_numeric_cast(v_obs_row->>'initialCharge');
    IF (v_obs_row->>'initialCharge') IS NOT NULL AND v_obs_charge IS NULL THEN
      v_warnings := v_warnings || jsonb_build_array('Observacion ' || v_i || ': cargo inicial invalido; se omitio.');
    ELSIF v_obs_charge IS NOT NULL AND abs(v_obs_charge) > 100000000 THEN
      v_obs_charge := NULL;
      v_warnings := v_warnings || jsonb_build_array('Observacion ' || v_i || ': cargo inicial fuera de rango; se omitio.');
    END IF;
    v_obs_units := NULL;
    IF (v_obs_row->>'units') IS NOT NULL AND (v_obs_row->>'units') ~ '^-?\d+$' AND (v_obs_row->>'units')::BIGINT BETWEEN -32768 AND 32767 THEN
      v_obs_units := (v_obs_row->>'units')::SMALLINT;
    ELSIF (v_obs_row->>'units') IS NOT NULL THEN
      v_warnings := v_warnings || jsonb_build_array('Observacion ' || v_i || ': unidades invalidas; se omitieron.');
    END IF;
    v_obs_clean := v_obs_clean || jsonb_build_object(
      '_i', v_i,
      'conceptCode', COALESCE(v_obs_row->>'conceptCode', ''),
      'amount', v_obs_amount,
      'duePeriod', NULLIF(v_obs_row->>'duePeriod', ''),
      'units', v_obs_units,
      'controlNumber', NULLIF(v_obs_row->>'controlNumber', ''),
      'initialCharge', v_obs_charge,
      'notes', NULLIF(v_obs_row->>'notes', ''),
      'rawAmount', v_obs_row->>'amount',
      'rawUnits', v_obs_row->>'units',
      'rawCharge', v_obs_row->>'initialCharge'
    );
  END LOOP;

  INSERT INTO public.imported_payslips (user_id, source_hash, extraction_method, period_raw, period_year, period_month, period_half, folio, fiscal_folio_hash, certification_date, global_confidence, warnings, employee_data, attendance, vacations, payroll_totals)
  VALUES (v_user_id, p_source_hash, v_method, v_period_raw, v_year, v_month, v_half, v_folio, v_fiscal_hash, v_cert, v_confidence, v_warnings, v_emp, v_att, v_vac,
    jsonb_build_object('totalEarnings', v_tot_earn, 'totalDeductions', v_tot_ded, 'netPay', v_net,
      'daysWorkedInYear', public.safe_numeric_cast(v_pay->>'daysWorkedInYear'), 'daysPaidInFortnight', public.safe_numeric_cast(v_pay->>'daysPaidInFortnight'),
      'integratedMonthlySalary', public.safe_numeric_cast(v_pay->>'integratedMonthlySalary'), 'creditCapacity', public.safe_numeric_cast(v_pay->>'creditCapacity')))
  RETURNING id INTO v_id;

  v_i := 0;
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_i := v_i + 1;
    BEGIN
      v_line_conf := COALESCE(public.safe_numeric_cast(v_line->>'confidence'), 0);
      v_line_conf := LEAST(1, GREATEST(0, v_line_conf));
      INSERT INTO public.imported_payslip_lines (payslip_id, line_index, concept_code, description, amount, kind, confidence, confirmed_by_user)
      VALUES (v_id, v_i, v_line->>'code', COALESCE(v_line->>'description', ''), (v_line->>'amount')::NUMERIC, v_line->>'kind', v_line_conf, COALESCE((v_line->>'confirmedByUser')::BOOLEAN, false));
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'line_insert_failed: line % code % amount % confidence % error %', v_i, v_line->>'code', v_line->>'amount', v_line->>'confidence', SQLERRM;
    END;
    IF (v_line->>'kind') = 'earning' AND (v_line->>'code') = '054' AND COALESCE(public.safe_numeric_cast(v_line->>'amount'), 0) > 0 THEN v_has_054 := true; END IF;
  END LOOP;

  v_i := 0;
  FOR v_obs_row IN SELECT * FROM jsonb_array_elements(v_obs_clean) LOOP
    v_i := v_i + 1;
    BEGIN
      INSERT INTO public.imported_payslip_observations (payslip_id, line_index, concept_code, amount, due_period, units, control_number, initial_charge, notes)
      VALUES (v_id, (v_obs_row->>'_i')::INTEGER, v_obs_row->>'conceptCode', (v_obs_row->>'amount')::NUMERIC, NULLIF(v_obs_row->>'duePeriod', ''), (v_obs_row->>'units')::SMALLINT, NULLIF(v_obs_row->>'controlNumber', ''), (v_obs_row->>'initialCharge')::NUMERIC, NULLIF(v_obs_row->>'notes', ''));
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'obs_insert_failed: line % code % amount % units % initialCharge % error %', v_i, v_obs_row->>'conceptCode', v_obs_row->>'rawAmount', v_obs_row->>'rawUnits', v_obs_row->>'rawCharge', SQLERRM;
    END;
  END LOOP;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF v_profile.id IS NOT NULL THEN
    IF (p_profile_updates->>'fullName') = 'true' AND NULLIF(v_emp->>'fullName', '') IS NOT NULL THEN UPDATE public.profiles SET full_name = v_emp->>'fullName', updated_at = now() WHERE id = v_user_id; v_profile_updated := true; END IF;
    IF (p_profile_updates->>'matricula') = 'true' AND NULLIF(v_emp->>'employeeNumber', '') IS NOT NULL THEN UPDATE public.profiles SET matricula = v_emp->>'employeeNumber', updated_at = now() WHERE id = v_user_id; v_profile_updated := true; END IF;
    IF (p_profile_updates->>'adscripcion') = 'true' AND NULLIF(v_emp->>'assignmentName', '') IS NOT NULL THEN UPDATE public.profiles SET adscripcion = v_emp->>'assignmentName', updated_at = now() WHERE id = v_user_id; v_profile_updated := true; END IF;
    IF (p_profile_updates->>'categoria') = 'true' AND v_cat_name IS NOT NULL THEN UPDATE public.profiles SET categoria = v_cat_name, updated_at = now() WHERE id = v_user_id; v_profile_updated := true; END IF;
    IF (p_profile_updates->>'antiguedad') = 'true' AND NULLIF(v_seniority->>'raw', '') IS NOT NULL THEN UPDATE public.profiles SET antiguedad = v_seniority->>'raw', updated_at = now() WHERE id = v_user_id; v_profile_updated := true; END IF;
  END IF;

  SELECT recurring_concepts, payroll_facts INTO v_existing_rc, v_existing_facts FROM public.payroll_contexts WHERE user_id = v_user_id;
  IF v_existing_rc IS NOT NULL AND jsonb_typeof(v_existing_rc) = 'array' THEN v_new_rc := v_existing_rc; END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_code := v_line->>'code';
    IF (v_line->>'kind') <> 'earning' OR v_code NOT IN ('050', '023', '063') THEN CONTINUE; END IF;
    v_found := false;
    FOR v_rc_entry IN SELECT * FROM jsonb_array_elements(v_new_rc) LOOP
      IF v_rc_entry->>'conceptCode' = v_code THEN v_found := true; END IF;
    END LOOP;
    IF v_found THEN
      v_new_rc := (SELECT COALESCE(jsonb_agg(CASE WHEN entry->>'conceptCode' = v_code THEN jsonb_set(jsonb_set(entry, ARRAY['lastAmount'], to_jsonb(public.safe_numeric_cast(v_line->>'amount'))), ARRAY['lastSeenAt'], to_jsonb(NULLIF(v_doc->>'periodRaw', ''))) ELSE entry END), '[]'::jsonb) FROM jsonb_array_elements(v_new_rc) AS entry);
    ELSIF (v_line->>'confirmedByUser')::BOOLEAN THEN
      v_new_rc := v_new_rc || jsonb_build_object('conceptCode', v_code, 'appearsNormally', true, 'lastAmount', public.safe_numeric_cast(v_line->>'amount'), 'source', 'last_payslip', 'firstSeenAt', NULLIF(v_doc->>'periodRaw', ''), 'lastSeenAt', NULLIF(v_doc->>'periodRaw', ''), 'confirmed', true);
    END IF;
  END LOOP;
  IF v_existing_facts IS NOT NULL AND jsonb_typeof(v_existing_facts) = 'array' THEN v_facts := v_existing_facts; END IF;
  IF v_has_054 THEN
    v_found := false;
    FOR v_fact_entry IN SELECT * FROM jsonb_array_elements(v_facts) LOOP IF v_fact_entry->>'key' = 'concept_054_on_payslip' THEN v_found := true; END IF; END LOOP;
    IF NOT v_found THEN v_facts := v_facts || jsonb_build_object('key', 'concept_054_on_payslip', 'value', true, 'source', 'imported_payslip', 'period', NULLIF(v_doc->>'periodRaw', '')); END IF;
  END IF;
  INSERT INTO public.payroll_contexts (user_id, category_name, workday_hours, employment_type, effective_seniority_date, recurring_concepts, payroll_facts, updated_at)
  VALUES (v_user_id, v_cat_name, CASE WHEN v_hours IN (6, 6.5, 8, 12) THEN v_hours ELSE NULL END, v_employment, v_sen_date, v_new_rc, v_facts, now())
  ON CONFLICT (user_id) DO UPDATE SET category_name = COALESCE(EXCLUDED.category_name, public.payroll_contexts.category_name), workday_hours = COALESCE(EXCLUDED.workday_hours, public.payroll_contexts.workday_hours), employment_type = COALESCE(EXCLUDED.employment_type, public.payroll_contexts.employment_type), effective_seniority_date = COALESCE(EXCLUDED.effective_seniority_date, public.payroll_contexts.effective_seniority_date), recurring_concepts = EXCLUDED.recurring_concepts, payroll_facts = EXCLUDED.payroll_facts, updated_at = now();
  v_ctx_updated := true;
  RETURN jsonb_build_object('id', v_id, 'duplicate', false, 'profileUpdated', v_profile_updated, 'payrollContextUpdated', v_ctx_updated);
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_imported_payslip_v1(TEXT, JSONB, JSONB, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_imported_payslip_v1(TEXT, JSONB, JSONB, BOOLEAN, BOOLEAN) FROM authenticated;
