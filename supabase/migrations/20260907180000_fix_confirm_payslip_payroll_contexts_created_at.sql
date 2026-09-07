-- ==============================================================================
-- Migración: 20260907180000_fix_confirm_payslip_payroll_contexts_created_at.sql
-- Propósito:
--   1. Agregar la columna `created_at` a `public.payroll_contexts` con valor por
--      defecto `now()`, estandarizando columnas de auditoría temporal en la tabla.
--   2. Corregir el RPC `confirm_imported_payslip_v1`: remover `created_at` del
--      INSERT explícito a `public.payroll_contexts` para evitar fallos de columna
--      inexistente o discrepancias de schema, confiando en el DEFAULT `now()`.
-- ==============================================================================

-- 1. Asegurar columna created_at en public.payroll_contexts
ALTER TABLE public.payroll_contexts
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Versión canónica y corregida de confirm_imported_payslip_v1
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
  v_same_worker BOOLEAN;
  v_worker_replacement BOOLEAN;
  v_is_duplicate BOOLEAN := false;
  v_is_latest_period BOOLEAN := true;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF p_parsed IS NULL THEN
    RAISE EXCEPTION 'invalid_payload: parsed is null';
  END IF;

  -- Extracción fiel de las secciones según el contrato ParsedImssTarjeton
  v_doc := p_parsed->'document';
  v_emp := p_parsed->'employee';
  v_att := p_parsed->'attendance';
  v_vac := p_parsed->'vacations';
  v_pay := p_parsed->'payroll';
  v_ext := p_parsed->'extraction';

  IF v_doc IS NULL OR v_emp IS NULL OR v_pay IS NULL THEN
    RAISE EXCEPTION 'invalid_payload: missing document, employee or payroll';
  END IF;

  -- Líneas y observaciones: contrato canónico reside en payroll.earnings / deductions / observations
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

  -- Metadatos de extracción
  v_method := COALESCE(v_ext->>'method', v_doc->>'extractionMethod', 'manual_assisted');
  IF v_method NOT IN ('native_pdf', 'native_text', 'ocr', 'ocr_client', 'ocr_external', 'hybrid', 'manual_assisted') THEN
    v_method := 'manual_assisted';
  END IF;
  v_confidence := COALESCE((v_ext->>'globalConfidence')::NUMERIC, (v_doc->>'globalConfidence')::NUMERIC, 0);

  -- Reconciliar sumas declaradas vs calculadas
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

  -- Identidad del trabajador y protección de sustitución
  v_new_matricula := NULLIF(trim(v_emp->>'employeeNumber'), '');
  SELECT matricula, full_name INTO v_profile FROM public.profiles WHERE id = v_user_id;
  v_old_matricula := NULLIF(trim(v_profile.matricula), '');

  v_same_worker := (v_old_matricula IS NULL OR v_new_matricula IS NULL OR v_old_matricula = v_new_matricula);
  v_worker_replacement := (v_old_matricula IS NOT NULL AND v_new_matricula IS NOT NULL AND v_old_matricula <> v_new_matricula AND (p_profile_updates->>'matricula') = 'true');

  IF NOT v_same_worker AND NOT v_worker_replacement THEN
    RAISE EXCEPTION 'matricula_mismatch';
  END IF;

  -- Campos derivados del documento y empleado
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
  v_seniority := v_emp->'seniority';
  v_sen_date := NULLIF(v_seniority->>'reconstructedEffectiveDate', '')::DATE;
  v_employment := NULLIF(v_emp->>'employmentType', '');

  -- Idempotencia: comprobar si ya existe para este usuario con el mismo source_hash
  SELECT id, vacations, employee_number INTO v_existing, v_existing_vac, v_existing_emp_num
    FROM public.imported_payslips
    WHERE user_id = v_user_id AND source_hash = p_source_hash;

  IF v_existing IS NOT NULL THEN
    -- DOCUMENTO DUPLICADO: omitir inserción física de payslip y líneas
    v_id := v_existing;
    v_is_duplicate := true;
    v_warnings := v_warnings || jsonb_build_array('Este tarjetón ya había sido importado anteriormente.');

    IF v_existing_emp_num IS NULL AND v_new_matricula IS NOT NULL THEN
      UPDATE public.imported_payslips
      SET employee_number = v_new_matricula
      WHERE id = v_existing AND user_id = v_user_id;
    END IF;

    -- Si el nuevo payload trae fecha por vencer o dueDate, el valor confirmado gana
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
    -- NUEVO DOCUMENTO: insertar payslip, líneas y observaciones
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

  -- ==========================================================================
  -- RECONCILIACIÓN DEL TRABAJADOR ACTIVO (SIEMPRE se ejecuta, incluso en duplicados)
  -- ==========================================================================

  -- 1. Perfil: actualización atómica de identidad en sustitución
  IF v_worker_replacement THEN
    -- Sustitución de trabajador: ATÓMICAMENTE se actualizan matrícula, nombre, categoría y antigüedad
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
    -- Mismo trabajador: respetar banderas individuales de profileUpdates
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
  END IF;

  -- 2. Contexto de nómina (payroll_contexts)
  IF v_worker_replacement THEN
    -- Sustitución autorizada: arrancar limpio para el nuevo trabajador
    v_new_rc := '[]'::jsonb;
    v_facts := '[]'::jsonb;
  ELSE
    -- Mismo trabajador: fusionar histórico previo
    SELECT recurring_concepts, payroll_facts INTO v_existing_rc, v_existing_facts
      FROM public.payroll_contexts WHERE user_id = v_user_id;

    IF v_existing_rc IS NOT NULL AND jsonb_typeof(v_existing_rc) = 'array' THEN
      v_new_rc := v_existing_rc;
    END IF;
    v_facts := COALESCE(v_existing_facts, '[]'::jsonb);
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

  -- Hechos de nomina: registrar concepto 054 como hecho histórico si vino en este tarjetón
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
        'employeeNumber', COALESCE(v_new_matricula, v_old_matricula),
        'recordedAt', now()
      ));
    END IF;
  END IF;

  INSERT INTO public.payroll_contexts (
    user_id, matricula, category_name, category_code, workday_hours, effective_seniority_date,
    employment_type, recurring_concepts, payroll_facts, updated_at
  ) VALUES (
    v_user_id, COALESCE(v_new_matricula, v_old_matricula), v_cat_name, v_emp->>'categoryCode', v_hours, v_sen_date,
    v_employment, v_new_rc, v_facts, now()
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

  -- 3. Contexto de vacaciones (vacation_profile_data)
  IF v_worker_replacement THEN
    -- Sustitución: resetear datos específicos y sincronizar condición radiológica con el tarjetón del nuevo trabajador
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
    -- Mismo trabajador: actualizar si no está bloqueado por confirmación manual USER_CONFIRMED
    INSERT INTO public.vacation_profile_data (
      user_id, employee_number, category, category_code, adscription,
      entry_date, effective_seniority_years, effective_seniority_fortnights,
      effective_seniority_days, radiological_exposure, radiological_exposure_source,
      radiological_exposure_updated_at, weekly_rest_days, created_at, updated_at
    ) VALUES (
      v_user_id, COALESCE(v_new_matricula, v_old_matricula), v_cat_name, v_emp->>'categoryCode', COALESCE(v_emp->>'assignmentName', v_emp->>'location'),
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

  -- 4. Contexto Activo Canónico (worker_active_context)
  IF v_worker_replacement THEN
    -- Sustitución de trabajador: el nuevo trabajador pasa a ser el activo inmediatamente
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
    -- Mismo trabajador: si no existe contexto o si está en AUTO_LATEST y este payslip es el más reciente
    SELECT NOT EXISTS (
      SELECT 1 FROM public.imported_payslips
      WHERE user_id = v_user_id
        AND employee_number = COALESCE(v_new_matricula, v_old_matricula)
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
      v_user_id, COALESCE(v_new_matricula, v_old_matricula), v_id, 'AUTO_LATEST', now()
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
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_imported_payslip_v1(TEXT, JSONB, JSONB, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_imported_payslip_v1(TEXT, JSONB, JSONB, BOOLEAN, BOOLEAN) FROM authenticated;
