-- ==============================================================================
-- Migración: 20260908020000_fix_tarjeton_identity_initialization_and_runtime.sql
-- Propósito:
--   1. Resolver la violación de check constraint (SQLSTATE 23514 en STAGE_PAYROLL_CONTEXT)
--      provocada por valores como "Base" (capital B) extraídos por el parser/tarjetón:
--      se normaliza canónicamente `employment_type` a minúsculas
--      ('base' | 'confianza' | 'eventual' | 'confianza_a_estatuto' | NULL).
--   2. Normalizar de forma segura `workday_hours` contra (6, 6.5, 8, 12) o NULL.
--   3. Implementar la máquina de estados de identidad en 4 casos exhaustivos:
--      - MISSING_WORKER_IDENTITY: tarjetón sin matrícula -> rechazar de inmediato.
--      - INITIALIZE_WORKER: perfil sin matrícula previa -> inicializar atómicamente
--        matrícula, nombre, categoría, antigüedad y adscripción en profiles;
--        limpiar residuales en payroll_contexts, vacation_profile_data; marcar
--        worker_preferences como 'configured' / 'payslip' y activar en worker_active_context.
--      - WORKER_REPLACEMENT: matrícula distinta a la guardada -> exige confirmación
--        explícita y resetea atómicamente los contextos para el nuevo trabajador.
--      - SAME_WORKER: misma matrícula -> actualiza campos según profile_updates y
--        preserva confirmaciones manuales de radiología.
--   4. Blindar campos JSON legacy en payroll_contexts (recurring_concepts, payroll_facts)
--      verificando `jsonb_typeof(...) = 'array'` antes de cualquier iteración.
--   5. Trazabilidad diagnóstica con etapas (STAGE_*) y reporte de SQLSTATE ante errores.
-- ==============================================================================

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
  v_stage TEXT := 'STAGE_AUTH_VALIDATE';
  v_user_id UUID := auth.uid();
  v_doc JSONB;
  v_emp JSONB;
  v_att JSONB;
  v_vac JSONB;
  v_pay JSONB;
  v_ext JSONB;
  v_lines JSONB;
  v_obs JSONB;
  v_sum_earn NUMERIC := 0;
  v_sum_ded NUMERIC := 0;
  v_tot_earn NUMERIC;
  v_tot_ded NUMERIC;
  v_net NUMERIC;
  v_line JSONB;
  v_obs_row JSONB;
  v_i INT := 0;
  v_id UUID;
  v_existing UUID;
  v_existing_emp_num TEXT;
  v_existing_vac JSONB;
  v_merged_vac JSONB;
  v_warnings JSONB := '[]'::jsonb;
  v_method TEXT;
  v_confidence NUMERIC;
  v_period_raw TEXT;
  v_year SMALLINT;
  v_month SMALLINT;
  v_half SMALLINT;
  v_folio TEXT;
  v_fiscal_hash TEXT;
  v_cert DATE;
  v_cat_name TEXT;
  v_hours NUMERIC;
  v_seniority JSONB;
  v_sen_date DATE;
  v_employment TEXT;
  v_has_054 BOOLEAN := false;
  v_rc_entry JSONB;
  v_facts JSONB := '[]'::jsonb;
  v_fact_entry JSONB;
  v_new_rc JSONB := '[]'::jsonb;
  v_existing_rc JSONB;
  v_existing_facts JSONB;
  v_found BOOLEAN;
  v_code TEXT;
  v_profile RECORD;
  v_profile_updated BOOLEAN := false;
  v_ctx_updated BOOLEAN := false;
  v_accept BOOLEAN;
  v_new_matricula TEXT;
  v_old_matricula TEXT;
  v_is_initialize_worker BOOLEAN := false;
  v_same_worker BOOLEAN := false;
  v_worker_replacement BOOLEAN := false;
  v_is_duplicate BOOLEAN := false;
  v_is_latest_period BOOLEAN := true;
  v_err_sqlstate TEXT;
  v_err_message TEXT;
BEGIN
  -- --------------------------------------------------------------------------
  -- 1. AUTENTICACIÓN
  -- --------------------------------------------------------------------------
  v_stage := 'STAGE_AUTH_VALIDATE';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. VALIDACIÓN DEL CONTRATO
  -- --------------------------------------------------------------------------
  v_stage := 'STAGE_PAYLOAD_VALIDATE';
  IF p_parsed IS NULL THEN
    RAISE EXCEPTION 'invalid_payload: parsed is null';
  END IF;

  v_doc := p_parsed->'document';
  v_emp := p_parsed->'employee';
  v_att := p_parsed->'attendance';
  v_vac := p_parsed->'vacations';
  v_pay := p_parsed->'payroll';
  v_ext := p_parsed->'extraction';

  IF v_doc IS NULL OR v_emp IS NULL OR v_pay IS NULL THEN
    RAISE EXCEPTION 'invalid_payload: missing document, employee or payroll';
  END IF;

  IF v_pay->'earnings' IS NOT NULL OR v_pay->'deductions' IS NOT NULL THEN
    v_lines := COALESCE(v_pay->'earnings', '[]'::jsonb) || COALESCE(v_pay->'deductions', '[]'::jsonb);
  ELSE
    v_lines := COALESCE(p_parsed->'lines', '[]'::jsonb);
  END IF;

  IF v_pay->'observations' IS NOT NULL THEN
    v_obs := v_pay->'observations';
  ELSE
    v_obs := COALESCE(p_parsed->'observations', '[]'::jsonb);
  END IF;

  v_method := COALESCE(v_ext->>'method', v_doc->>'extractionMethod', 'manual_assisted');
  IF v_method NOT IN ('native_pdf', 'native_text', 'ocr', 'ocr_client', 'ocr_external', 'hybrid', 'manual_assisted') THEN
    v_method := 'manual_assisted';
  END IF;
  v_confidence := COALESCE((v_ext->>'globalConfidence')::NUMERIC, (v_doc->>'globalConfidence')::NUMERIC, 0);

  -- --------------------------------------------------------------------------
  -- 3. RECONCILIACIÓN DE TOTALES
  -- --------------------------------------------------------------------------
  v_stage := 'STAGE_TOTALS_RECONCILE';
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    IF (v_line->>'kind') = 'earning' THEN
      v_sum_earn := v_sum_earn + (v_line->>'amount')::NUMERIC;
      IF (COALESCE(v_line->>'code', v_line->>'concept_code')) = '054' AND (v_line->>'amount')::NUMERIC > 0 THEN
        v_has_054 := true;
      END IF;
    ELSIF (v_line->>'kind') = 'deduction' THEN
      v_sum_ded := v_sum_ded + (v_line->>'amount')::NUMERIC;
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

  -- --------------------------------------------------------------------------
  -- 4. MÁQUINA DE ESTADOS DE IDENTIDAD DEL TRABAJADOR
  -- --------------------------------------------------------------------------
  v_stage := 'STAGE_IDENTITY_CHECK';
  v_new_matricula := NULLIF(trim(v_emp->>'employeeNumber'), '');
  SELECT matricula, full_name, categoria, antiguedad, adscripcion INTO v_profile FROM public.profiles WHERE id = v_user_id;
  v_old_matricula := NULLIF(trim(v_profile.matricula), '');

  IF v_new_matricula IS NULL THEN
    RAISE EXCEPTION 'matricula_required: tarjeton does not contain employeeNumber';
  END IF;

  IF v_old_matricula IS NULL THEN
    -- ESTADO 1: INITIALIZE_WORKER (Primer tarjetón del usuario o perfil sin matrícula)
    v_is_initialize_worker := true;
    v_same_worker := false;
    v_worker_replacement := false;
  ELSIF v_old_matricula = v_new_matricula THEN
    -- ESTADO 2: SAME_WORKER (Mismo trabajador previamente configurado)
    v_is_initialize_worker := false;
    v_same_worker := true;
    v_worker_replacement := false;
  ELSE
    -- ESTADO 3: WORKER_REPLACEMENT (Sustitución explícita de matrícula)
    v_is_initialize_worker := false;
    v_same_worker := false;
    v_worker_replacement := true;
    IF (p_profile_updates->>'matricula') <> 'true' THEN
      RAISE EXCEPTION 'matricula_mismatch';
    END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- 5. DERIVACIÓN Y NORMALIZACIÓN DE CAMPOS LABORALES
  -- --------------------------------------------------------------------------
  v_period_raw := v_doc->>'periodRaw';
  v_year := (v_doc->>'year')::SMALLINT;
  v_month := (v_doc->>'month')::SMALLINT;
  v_half := (v_doc->>'half')::SMALLINT;
  v_folio := NULLIF(v_doc->>'folio', '');
  v_fiscal_hash := NULLIF(v_doc->>'fiscalFolioHash', '');
  v_cert := NULLIF(v_doc->>'certificationDate', '')::DATE;
  v_warnings := COALESCE(v_ext->'warnings', p_parsed->'warnings', '[]'::jsonb);

  v_cat_name := NULLIF(v_emp->>'categoryName', '');
  v_hours := (v_emp->>'workdayHours')::NUMERIC;
  IF v_hours NOT IN (6, 6.5, 8, 12) THEN
    v_hours := NULL;
  END IF;

  v_seniority := v_emp->'seniority';
  v_sen_date := NULLIF(v_seniority->>'reconstructedEffectiveDate', '')::DATE;

  -- Normalización canónica de employment_type para satisfacer:
  -- CHECK (((employment_type IS NULL) OR (employment_type = ANY (ARRAY['base'::text, 'confianza'::text, 'eventual'::text, 'confianza_a_estatuto'::text]))))
  v_employment := lower(trim(COALESCE(v_emp->>'employmentType', '')));
  IF v_employment = '' THEN
    v_employment := NULL;
  ELSIF v_employment IN ('base', 'confianza', 'eventual', 'confianza_a_estatuto') THEN
    -- Ya coincide con el dominio permitido
  ELSIF v_employment LIKE '%confianza%estatuto%' THEN
    v_employment := 'confianza_a_estatuto';
  ELSIF v_employment LIKE '%confianza%' THEN
    v_employment := 'confianza';
  ELSIF v_employment LIKE '%eventual%' THEN
    v_employment := 'eventual';
  ELSIF v_employment LIKE '%base%' THEN
    v_employment := 'base';
  ELSE
    v_employment := NULL;
  END IF;

  -- --------------------------------------------------------------------------
  -- 6. IDEMPOTENCIA Y PERSISTENCIA DE TARJETÓN (imported_payslips)
  -- --------------------------------------------------------------------------
  v_stage := 'STAGE_PERSIST_PAYSLIP';
  SELECT id, vacations, employee_number INTO v_existing, v_existing_vac, v_existing_emp_num
    FROM public.imported_payslips
    WHERE user_id = v_user_id AND source_hash = p_source_hash;

  IF v_existing IS NOT NULL THEN
    v_id := v_existing;
    v_is_duplicate := true;
    v_warnings := v_warnings || jsonb_build_array('Este tarjetón ya había sido importado anteriormente.');

    IF v_existing_emp_num IS NULL AND v_new_matricula IS NOT NULL THEN
      UPDATE public.imported_payslips
      SET employee_number = v_new_matricula
      WHERE id = v_existing AND user_id = v_user_id;
    END IF;

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
  ELSE
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
        v_id, v_i,
        COALESCE(v_line->>'code', v_line->>'concept_code'),
        COALESCE(v_line->>'description', ''),
        (v_line->>'amount')::NUMERIC,
        v_line->>'kind',
        COALESCE((v_line->>'confidence')::NUMERIC, 0),
        COALESCE((v_line->>'confirmedByUser')::BOOLEAN, (v_line->>'confirmed_by_user')::BOOLEAN, false)
      );
    END LOOP;

    v_i := 0;
    FOR v_obs_row IN SELECT * FROM jsonb_array_elements(v_obs) LOOP
      v_i := v_i + 1;
      INSERT INTO public.imported_payslip_observations (
        payslip_id, line_index, concept_code, amount, due_period, units,
        control_number, initial_charge, notes
      ) VALUES (
        v_id, v_i,
        COALESCE(v_obs_row->>'conceptCode', v_obs_row->>'concept_code', ''),
        (v_obs_row->>'amount')::NUMERIC,
        NULLIF(COALESCE(v_obs_row->>'duePeriod', v_obs_row->>'due_period'), ''),
        (v_obs_row->>'units')::SMALLINT,
        NULLIF(COALESCE(v_obs_row->>'controlNumber', v_obs_row->>'control_number'), ''),
        (COALESCE(v_obs_row->>'initialCharge', v_obs_row->>'initial_charge'))::NUMERIC,
        NULLIF(v_obs_row->>'notes', '')
      );
    END LOOP;
  END IF;

  -- --------------------------------------------------------------------------
  -- 7. RECONCILIACIÓN DEL PERFIL (profiles)
  -- --------------------------------------------------------------------------
  v_stage := 'STAGE_PROFILE_UPDATE';
  IF v_is_initialize_worker OR v_worker_replacement THEN
    -- En inicialización o sustitución: establecer atómicamente la identidad completa
    UPDATE public.profiles
    SET
      matricula = v_new_matricula,
      full_name = COALESCE(NULLIF(trim(v_emp->>'fullName'), ''), full_name),
      categoria = COALESCE(v_cat_name, categoria),
      antiguedad = COALESCE(NULLIF(v_seniority->>'raw', ''), antiguedad),
      adscripcion = COALESCE(NULLIF(v_emp->>'assignmentName', ''), NULLIF(v_emp->>'location', ''), adscripcion),
      updated_at = now()
    WHERE id = v_user_id;
    v_profile_updated := true;
  ELSE
    -- Mismo trabajador: respetar banderas explícitas de actualización
    IF v_profile.matricula IS NOT NULL THEN
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
  END IF;

  -- --------------------------------------------------------------------------
  -- 8. CONTEXTO DE NÓMINA (payroll_contexts)
  -- --------------------------------------------------------------------------
  v_stage := 'STAGE_PAYROLL_CONTEXT';
  IF v_is_initialize_worker OR v_worker_replacement THEN
    -- Inicialización o sustitución limpia: sin arrastrar conceptos o facts residuales
    v_new_rc := '[]'::jsonb;
    v_facts := '[]'::jsonb;
  ELSE
    -- Mismo trabajador: blindar contra JSON corrupto o no-array
    SELECT recurring_concepts, payroll_facts INTO v_existing_rc, v_existing_facts
      FROM public.payroll_contexts WHERE user_id = v_user_id;

    IF v_existing_rc IS NOT NULL AND jsonb_typeof(v_existing_rc) = 'array' THEN
      v_new_rc := v_existing_rc;
    ELSE
      v_new_rc := '[]'::jsonb;
    END IF;

    IF v_existing_facts IS NOT NULL AND jsonb_typeof(v_existing_facts) = 'array' THEN
      v_facts := v_existing_facts;
    ELSE
      v_facts := '[]'::jsonb;
    END IF;
  END IF;

  -- Reconciliar conceptos recurrentes (050, 023, 063, etc.)
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_code := COALESCE(v_line->>'code', v_line->>'concept_code');
    IF (v_line->>'kind') <> 'earning' OR (v_line->>'amount')::NUMERIC <= 0 THEN
      CONTINUE;
    END IF;

    IF v_code NOT IN ('050', '023', '063', '011', '022', '019', '020', '021', '024', '040', '047', '048', '054') THEN
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

  -- Hechos de nómina: registrar concepto 054 si vino en este tarjetón
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
        'sourcePeriod', v_period_raw,
        'employeeNumber', v_new_matricula,
        'recordedAt', now()
      ));
    END IF;
  END IF;

  INSERT INTO public.payroll_contexts (
    user_id, matricula, category_name, category_code, workday_hours, effective_seniority_date,
    employment_type, recurring_concepts, payroll_facts, updated_at
  ) VALUES (
    v_user_id, v_new_matricula, v_cat_name, v_emp->>'categoryCode', v_hours, v_sen_date,
    v_employment, v_new_rc, v_facts, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    matricula = EXCLUDED.matricula,
    category_name = EXCLUDED.category_name,
    category_code = EXCLUDED.category_code,
    workday_hours = EXCLUDED.workday_hours,
    effective_seniority_date = EXCLUDED.effective_seniority_date,
    employment_type = EXCLUDED.employment_type,
    recurring_concepts = EXCLUDED.recurring_concepts,
    payroll_facts = EXCLUDED.payroll_facts,
    updated_at = now();
  v_ctx_updated := true;

  -- --------------------------------------------------------------------------
  -- 9. CONTEXTO DE VACACIONES (vacation_profile_data)
  -- --------------------------------------------------------------------------
  v_stage := 'STAGE_VACATION_PROFILE';
  IF v_is_initialize_worker OR v_worker_replacement THEN
    INSERT INTO public.vacation_profile_data (
      user_id, employee_number, category, category_code, adscription,
      entry_date, effective_seniority_years, effective_seniority_fortnights,
      effective_seniority_days, radiological_exposure, radiological_exposure_source,
      radiological_exposure_updated_at, weekly_rest_days, created_at, updated_at
    ) VALUES (
      v_user_id, v_new_matricula, v_cat_name, v_emp->>'categoryCode', COALESCE(v_emp->>'assignmentName', v_emp->>'location'),
      NULLIF(v_emp->>'entryDate', '')::DATE, (v_seniority->>'years')::INTEGER, (v_seniority->>'fortnights')::INTEGER,
      (v_seniority->>'days')::INTEGER, CASE WHEN v_has_054 THEN 'YES' ELSE 'NO' END, 'ACTIVE_PAYSLIP',
      now(), '{5,6}', now(), now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      employee_number = EXCLUDED.employee_number,
      contract_type = NULL,
      category = EXCLUDED.category,
      category_code = EXCLUDED.category_code,
      work_schedule_type = NULL,
      shift = NULL,
      adscription = EXCLUDED.adscription,
      unit = NULL,
      service = NULL,
      entry_date = EXCLUDED.entry_date,
      effective_seniority_years = EXCLUDED.effective_seniority_years,
      effective_seniority_fortnights = EXCLUDED.effective_seniority_fortnights,
      effective_seniority_days = EXCLUDED.effective_seniority_days,
      radiological_exposure = EXCLUDED.radiological_exposure,
      radiological_exposure_source = 'ACTIVE_PAYSLIP',
      radiological_exposure_updated_at = now(),
      weekly_rest_days = '{5,6}',
      contract_end_date = NULL,
      updated_at = now();
  ELSE
    INSERT INTO public.vacation_profile_data (
      user_id, employee_number, category, category_code, adscription,
      entry_date, effective_seniority_years, effective_seniority_fortnights,
      effective_seniority_days, radiological_exposure, radiological_exposure_source,
      radiological_exposure_updated_at, weekly_rest_days, created_at, updated_at
    ) VALUES (
      v_user_id, v_new_matricula, v_cat_name, v_emp->>'categoryCode', COALESCE(v_emp->>'assignmentName', v_emp->>'location'),
      NULLIF(v_emp->>'entryDate', '')::DATE, (v_seniority->>'years')::INTEGER, (v_seniority->>'fortnights')::INTEGER,
      (v_seniority->>'days')::INTEGER, CASE WHEN v_has_054 THEN 'YES' ELSE 'NO' END, 'ACTIVE_PAYSLIP',
      now(), '{5,6}', now(), now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      employee_number = COALESCE(v_new_matricula, public.vacation_profile_data.employee_number, EXCLUDED.employee_number),
      category = COALESCE(public.vacation_profile_data.category, EXCLUDED.category),
      category_code = COALESCE(public.vacation_profile_data.category_code, EXCLUDED.category_code),
      adscription = COALESCE(public.vacation_profile_data.adscription, EXCLUDED.adscription),
      entry_date = COALESCE(public.vacation_profile_data.entry_date, EXCLUDED.entry_date),
      effective_seniority_years = COALESCE(public.vacation_profile_data.effective_seniority_years, EXCLUDED.effective_seniority_years),
      effective_seniority_fortnights = COALESCE(public.vacation_profile_data.effective_seniority_fortnights, EXCLUDED.effective_seniority_fortnights),
      effective_seniority_days = COALESCE(public.vacation_profile_data.effective_seniority_days, EXCLUDED.effective_seniority_days),
      radiological_exposure = CASE
        WHEN public.vacation_profile_data.radiological_exposure_source = 'USER_CONFIRMED' THEN public.vacation_profile_data.radiological_exposure
        ELSE EXCLUDED.radiological_exposure
      END,
      radiological_exposure_source = CASE
        WHEN public.vacation_profile_data.radiological_exposure_source = 'USER_CONFIRMED' THEN public.vacation_profile_data.radiological_exposure_source
        ELSE 'ACTIVE_PAYSLIP'
      END,
      radiological_exposure_updated_at = now(),
      updated_at = now();
  END IF;

  -- --------------------------------------------------------------------------
  -- 10. PREFERENCIAS DEL TRABAJADOR (worker_preferences)
  -- --------------------------------------------------------------------------
  v_stage := 'STAGE_WORKER_PREFERENCES';
  INSERT INTO public.worker_preferences (
    user_id, onboarding_state, preferred_worker_mode, updated_at
  ) VALUES (
    v_user_id, 'configured', 'payslip', now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    onboarding_state = 'configured',
    preferred_worker_mode = 'payslip',
    updated_at = now();

  -- --------------------------------------------------------------------------
  -- 11. CONTEXTO ACTIVO (worker_active_context)
  -- --------------------------------------------------------------------------
  v_stage := 'STAGE_WORKER_ACTIVE_CONTEXT';
  IF v_is_initialize_worker OR v_worker_replacement THEN
    INSERT INTO public.worker_active_context (
      user_id, employee_number, active_payslip_id, selection_mode, updated_at
    ) VALUES (
      v_user_id, v_new_matricula, v_id, 'AUTO_LATEST', now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      employee_number = EXCLUDED.employee_number,
      active_payslip_id = EXCLUDED.active_payslip_id,
      selection_mode = 'AUTO_LATEST',
      updated_at = now();
  ELSE
    SELECT NOT EXISTS (
      SELECT 1 FROM public.imported_payslips
      WHERE user_id = v_user_id
        AND employee_number = v_new_matricula
        AND id <> v_id
        AND (
          period_year > COALESCE(v_year, 0)
          OR (period_year = COALESCE(v_year, 0) AND period_month > COALESCE(v_month, 0))
          OR (period_year = COALESCE(v_year, 0) AND period_month = COALESCE(v_month, 0) AND period_half > COALESCE(v_half, 0))
        )
    ) INTO v_is_latest_period;

    INSERT INTO public.worker_active_context (
      user_id, employee_number, active_payslip_id, selection_mode, updated_at
    ) VALUES (
      v_user_id, v_new_matricula, v_id, 'AUTO_LATEST', now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      employee_number = COALESCE(v_new_matricula, EXCLUDED.employee_number, public.worker_active_context.employee_number),
      active_payslip_id = CASE
        WHEN public.worker_active_context.selection_mode = 'AUTO_LATEST' AND v_is_latest_period THEN v_id
        WHEN public.worker_active_context.active_payslip_id IS NULL THEN v_id
        ELSE public.worker_active_context.active_payslip_id
      END,
      updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'duplicate', v_is_duplicate,
    'warnings', v_warnings,
    'profileUpdated', v_profile_updated,
    'payrollContextUpdated', v_ctx_updated
  );

EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_message = MESSAGE_TEXT;

    IF v_err_message IN (
      'auth_required',
      'unauthorized',
      'totals_mismatch: earnings',
      'totals_mismatch: deductions',
      'totals_mismatch: netPay',
      'matricula_mismatch',
      'matricula_required',
      'consent_required',
      'limits_exceeded',
      'template_not_detected'
    )
    OR v_err_message LIKE 'totals_mismatch%'
    OR v_err_message LIKE 'invalid_payload%'
    OR v_err_message LIKE 'matricula_required%' THEN
      RAISE;
    END IF;

    RAISE EXCEPTION 'TARJETON_CONFIRM_STAGE_FAILED:%:%:%', v_stage, v_err_sqlstate, v_err_message;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_imported_payslip_v1(TEXT, JSONB, JSONB, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_imported_payslip_v1(TEXT, JSONB, JSONB, BOOLEAN, BOOLEAN) FROM authenticated;
