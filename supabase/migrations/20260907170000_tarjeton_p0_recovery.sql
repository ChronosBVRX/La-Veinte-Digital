-- =============================================================================
-- P0 RECOVERY: restaurar importación y contexto laboral después de PR #85/#86
--
-- Corrige tres regresiones combinadas:
-- 1) set_active_payslip eliminaba payroll_contexts al cambiar de trabajador.
-- 2) la UI degradaba worker_preferences.onboarding_state a basic.
-- 3) usuarios ya afectados pueden quedar configured/basic sin payroll_contexts.
--
-- Esta migración es forward-only y no borra históricos de tarjetones.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Reparación inmediata de usuarios degradados a BASIC por la regresión.
-- Sólo se repara el caso inequívoco: preferencia payslip + tarjetón activo real.
-- -----------------------------------------------------------------------------
UPDATE public.worker_preferences wp
SET onboarding_state = 'configured',
    preferred_worker_mode = 'payslip',
    updated_at = now()
WHERE wp.onboarding_state = 'basic'
  AND wp.preferred_worker_mode = 'payslip'
  AND EXISTS (
    SELECT 1
    FROM public.worker_active_context wac
    JOIN public.imported_payslips ip
      ON ip.id = wac.active_payslip_id
     AND ip.user_id = wp.user_id
    WHERE wac.user_id = wp.user_id
  );

-- -----------------------------------------------------------------------------
-- 2. Reparar payroll_contexts faltante para usuarios que ya tienen un
--    tarjetón activo confirmado. La ausencia de esta fila rompe
--    WorkerProfileService.getCurrentProfile().
-- -----------------------------------------------------------------------------
WITH chosen AS (
  SELECT
    p.id AS user_id,
    COALESCE(active_ip.id, latest_ip.id) AS payslip_id
  FROM public.profiles p
  LEFT JOIN public.worker_active_context wac
    ON wac.user_id = p.id
  LEFT JOIN public.imported_payslips active_ip
    ON active_ip.id = wac.active_payslip_id
   AND active_ip.user_id = p.id
  LEFT JOIN LATERAL (
    SELECT ip.id
    FROM public.imported_payslips ip
    WHERE ip.user_id = p.id
      AND (
        NULLIF(trim(p.matricula), '') IS NULL
        OR ip.employee_number = NULLIF(trim(p.matricula), '')
      )
    ORDER BY
      ip.period_year DESC NULLS LAST,
      ip.period_month DESC NULLS LAST,
      ip.period_half DESC NULLS LAST,
      ip.created_at DESC
    LIMIT 1
  ) latest_ip ON true
), source_rows AS (
  SELECT
    c.user_id AS chosen_user_id,
    ip.*,
    COALESCE(rc.recurring_concepts, '[]'::jsonb) AS rebuilt_recurring
  FROM chosen c
  JOIN public.imported_payslips ip
    ON ip.id = c.payslip_id
   AND ip.user_id = c.user_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'conceptCode', l.concept_code,
        'appearsNormally', true,
        'lastAmount', l.amount,
        'source', 'payslip_import',
        'lastSeenAt', ip.period_raw,
        'confirmed', l.confirmed_by_user
      ) ORDER BY l.line_index
    ) AS recurring_concepts
    FROM public.imported_payslip_lines l
    WHERE l.payslip_id = ip.id
      AND l.kind = 'earning'
      AND l.amount > 0
      AND l.confirmed_by_user = true
  ) rc ON true
)
INSERT INTO public.payroll_contexts (
  user_id,
  matricula,
  category_code,
  category_name,
  workday_hours,
  employment_type,
  effective_seniority_date,
  adscripcion,
  recurring_concepts,
  payroll_facts,
  source_matricula,
  source_category_name,
  source_workday_hours,
  source_employment_type,
  source_effective_seniority_date,
  source_adscripcion,
  updated_at
)
SELECT
  s.chosen_user_id,
  COALESCE(NULLIF(trim(s.employee_number), ''), NULLIF(trim(s.employee_data->>'employeeNumber'), '')),
  NULLIF(trim(s.employee_data->>'categoryCode'), ''),
  NULLIF(trim(s.employee_data->>'categoryName'), ''),
  NULLIF(s.employee_data->>'workdayHours', '')::NUMERIC,
  NULLIF(trim(s.employee_data->>'employmentType'), ''),
  NULLIF(s.employee_data->'seniority'->>'reconstructedEffectiveDate', '')::DATE,
  COALESCE(
    NULLIF(trim(s.employee_data->>'assignmentName'), ''),
    NULLIF(trim(s.employee_data->>'location'), '')
  ),
  s.rebuilt_recurring,
  '[]'::jsonb,
  'payslip_confirmed',
  CASE WHEN NULLIF(trim(s.employee_data->>'categoryName'), '') IS NOT NULL THEN 'payslip_confirmed' ELSE NULL END,
  CASE WHEN NULLIF(s.employee_data->>'workdayHours', '') IS NOT NULL THEN 'payslip_confirmed' ELSE NULL END,
  CASE WHEN NULLIF(trim(s.employee_data->>'employmentType'), '') IS NOT NULL THEN 'payslip_confirmed' ELSE NULL END,
  CASE WHEN NULLIF(s.employee_data->'seniority'->>'reconstructedEffectiveDate', '') IS NOT NULL THEN 'payslip_confirmed' ELSE NULL END,
  CASE WHEN COALESCE(NULLIF(trim(s.employee_data->>'assignmentName'), ''), NULLIF(trim(s.employee_data->>'location'), '')) IS NOT NULL THEN 'payslip_confirmed' ELSE NULL END,
  now()
FROM source_rows s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.payroll_contexts pc
  WHERE pc.user_id = s.chosen_user_id
)
ON CONFLICT (user_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. set_active_payslip seguro.
--    Nunca vuelve a borrar payroll_contexts. Reconstruye el contexto desde el
--    tarjetón seleccionado y mantiene onboarding=CONFIGURED/PAYSLIP.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_active_payslip(
  p_payslip_id UUID,
  p_selection_mode TEXT DEFAULT 'PINNED'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mode TEXT := COALESCE(NULLIF(trim(p_selection_mode), ''), 'PINNED');
  v_profile public.profiles%ROWTYPE;
  v_payslip public.imported_payslips%ROWTYPE;
  v_old_ctx public.payroll_contexts%ROWTYPE;
  v_emp JSONB;
  v_seniority JSONB;
  v_active_matricula TEXT;
  v_target_matricula TEXT;
  v_is_worker_change BOOLEAN := false;
  v_has_054 BOOLEAN := false;
  v_recurring JSONB := '[]'::jsonb;
  v_revision TIMESTAMPTZ := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF v_mode NOT IN ('AUTO_LATEST', 'PINNED') THEN
    RAISE EXCEPTION 'invalid_mode';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  v_active_matricula := NULLIF(trim(v_profile.matricula), '');

  IF v_mode = 'AUTO_LATEST' THEN
    SELECT * INTO v_payslip
    FROM public.imported_payslips ip
    WHERE ip.user_id = v_user_id
      AND (
        v_active_matricula IS NULL
        OR ip.employee_number = v_active_matricula
      )
    ORDER BY
      ip.period_year DESC NULLS LAST,
      ip.period_month DESC NULLS LAST,
      ip.period_half DESC NULLS LAST,
      ip.created_at DESC
    LIMIT 1;

    -- Si no hay tarjetones, dejar AUTO_LATEST sin romper el perfil existente.
    IF v_payslip.id IS NULL THEN
      INSERT INTO public.worker_active_context (
        user_id, employee_number, active_payslip_id, selection_mode, updated_at
      ) VALUES (
        v_user_id, COALESCE(v_active_matricula, 'SIN_MATRICULA'), NULL, 'AUTO_LATEST', v_revision
      )
      ON CONFLICT (user_id) DO UPDATE SET
        employee_number = COALESCE(v_active_matricula, public.worker_active_context.employee_number),
        active_payslip_id = NULL,
        selection_mode = 'AUTO_LATEST',
        updated_at = v_revision;

      RETURN jsonb_build_object(
        'ok', true,
        'selectionMode', 'AUTO_LATEST',
        'activePayslipId', NULL,
        'employeeNumber', v_active_matricula,
        'workerChanged', false,
        'contextRevision', v_revision
      );
    END IF;
  ELSE
    SELECT * INTO v_payslip
    FROM public.imported_payslips
    WHERE id = p_payslip_id
      AND user_id = v_user_id;

    IF v_payslip.id IS NULL THEN
      RAISE EXCEPTION 'payslip_not_found_or_not_owned';
    END IF;
  END IF;

  v_emp := COALESCE(v_payslip.employee_data, '{}'::jsonb);
  v_seniority := COALESCE(v_emp->'seniority', '{}'::jsonb);
  v_target_matricula := COALESCE(
    NULLIF(trim(v_payslip.employee_number), ''),
    NULLIF(trim(v_emp->>'employeeNumber'), ''),
    v_active_matricula
  );

  v_is_worker_change := (
    v_target_matricula IS NOT NULL
    AND (v_active_matricula IS NULL OR v_target_matricula <> v_active_matricula)
  );

  -- Si cambia el trabajador, toda la identidad visible cambia en bloque.
  IF v_is_worker_change THEN
    UPDATE public.profiles
    SET
      matricula = v_target_matricula,
      full_name = COALESCE(NULLIF(trim(v_emp->>'fullName'), ''), full_name),
      categoria = COALESCE(NULLIF(trim(v_emp->>'categoryName'), ''), categoria),
      antiguedad = COALESCE(NULLIF(trim(v_seniority->>'raw'), ''), antiguedad),
      adscripcion = COALESCE(
        NULLIF(trim(v_emp->>'assignmentName'), ''),
        NULLIF(trim(v_emp->>'location'), ''),
        adscripcion
      ),
      updated_at = v_revision
    WHERE id = v_user_id;

    v_active_matricula := v_target_matricula;
  END IF;

  SELECT * INTO v_old_ctx
  FROM public.payroll_contexts
  WHERE user_id = v_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'conceptCode', l.concept_code,
        'appearsNormally', true,
        'lastAmount', l.amount,
        'source', 'payslip_import',
        'lastSeenAt', v_payslip.period_raw,
        'confirmed', l.confirmed_by_user
      ) ORDER BY l.line_index
    ),
    '[]'::jsonb
  ) INTO v_recurring
  FROM public.imported_payslip_lines l
  WHERE l.payslip_id = v_payslip.id
    AND l.kind = 'earning'
    AND l.amount > 0
    AND l.confirmed_by_user = true;

  -- Reconstruir SIEMPRE payroll_contexts a partir del tarjetón activo.
  -- Los datos manuales sólo se preservan cuando sigue siendo el mismo trabajador.
  INSERT INTO public.payroll_contexts (
    user_id,
    matricula,
    category_code,
    category_name,
    workday_hours,
    employment_type,
    effective_seniority_date,
    adscripcion,
    recurring_concepts,
    payroll_facts,
    occupational_conditions,
    siap_concept_marks,
    shift,
    consent_given,
    consent_given_at,
    consent_version,
    source_matricula,
    source_category_name,
    source_workday_hours,
    source_employment_type,
    source_effective_seniority_date,
    source_adscripcion,
    source_shift,
    updated_at
  ) VALUES (
    v_user_id,
    v_target_matricula,
    NULLIF(trim(v_emp->>'categoryCode'), ''),
    NULLIF(trim(v_emp->>'categoryName'), ''),
    NULLIF(v_emp->>'workdayHours', '')::NUMERIC,
    NULLIF(trim(v_emp->>'employmentType'), ''),
    NULLIF(v_seniority->>'reconstructedEffectiveDate', '')::DATE,
    COALESCE(NULLIF(trim(v_emp->>'assignmentName'), ''), NULLIF(trim(v_emp->>'location'), '')),
    v_recurring,
    CASE WHEN NOT v_is_worker_change THEN COALESCE(v_old_ctx.payroll_facts, '[]'::jsonb) ELSE '[]'::jsonb END,
    CASE WHEN NOT v_is_worker_change THEN COALESCE(v_old_ctx.occupational_conditions, '[]'::jsonb) ELSE '[]'::jsonb END,
    CASE WHEN NOT v_is_worker_change THEN COALESCE(v_old_ctx.siap_concept_marks, '[]'::jsonb) ELSE '[]'::jsonb END,
    CASE WHEN NOT v_is_worker_change THEN v_old_ctx.shift ELSE NULL END,
    COALESCE(v_old_ctx.consent_given, false),
    v_old_ctx.consent_given_at,
    v_old_ctx.consent_version,
    CASE WHEN v_target_matricula IS NOT NULL THEN 'payslip_confirmed' ELSE NULL END,
    CASE WHEN NULLIF(trim(v_emp->>'categoryName'), '') IS NOT NULL THEN 'payslip_confirmed' ELSE NULL END,
    CASE WHEN NULLIF(v_emp->>'workdayHours', '') IS NOT NULL THEN 'payslip_confirmed' ELSE NULL END,
    CASE WHEN NULLIF(trim(v_emp->>'employmentType'), '') IS NOT NULL THEN 'payslip_confirmed' ELSE NULL END,
    CASE WHEN NULLIF(v_seniority->>'reconstructedEffectiveDate', '') IS NOT NULL THEN 'payslip_confirmed' ELSE NULL END,
    CASE WHEN COALESCE(NULLIF(trim(v_emp->>'assignmentName'), ''), NULLIF(trim(v_emp->>'location'), '')) IS NOT NULL THEN 'payslip_confirmed' ELSE NULL END,
    CASE WHEN NOT v_is_worker_change THEN v_old_ctx.source_shift ELSE NULL END,
    v_revision
  )
  ON CONFLICT (user_id) DO UPDATE SET
    matricula = EXCLUDED.matricula,
    category_code = EXCLUDED.category_code,
    category_name = EXCLUDED.category_name,
    workday_hours = EXCLUDED.workday_hours,
    employment_type = EXCLUDED.employment_type,
    effective_seniority_date = EXCLUDED.effective_seniority_date,
    adscripcion = EXCLUDED.adscripcion,
    recurring_concepts = EXCLUDED.recurring_concepts,
    payroll_facts = EXCLUDED.payroll_facts,
    occupational_conditions = EXCLUDED.occupational_conditions,
    siap_concept_marks = EXCLUDED.siap_concept_marks,
    shift = EXCLUDED.shift,
    consent_given = EXCLUDED.consent_given,
    consent_given_at = EXCLUDED.consent_given_at,
    consent_version = EXCLUDED.consent_version,
    source_matricula = EXCLUDED.source_matricula,
    source_category_name = EXCLUDED.source_category_name,
    source_workday_hours = EXCLUDED.source_workday_hours,
    source_employment_type = EXCLUDED.source_employment_type,
    source_effective_seniority_date = EXCLUDED.source_effective_seniority_date,
    source_adscripcion = EXCLUDED.source_adscripcion,
    source_shift = EXCLUDED.source_shift,
    updated_at = EXCLUDED.updated_at;

  -- Radiación actual desde el tarjetón seleccionado. Nunca usar histórico 054.
  SELECT EXISTS (
    SELECT 1
    FROM public.imported_payslip_lines l
    WHERE l.payslip_id = v_payslip.id
      AND l.concept_code = '054'
      AND l.kind = 'earning'
      AND l.amount > 0
      AND l.confirmed_by_user = true
  ) INTO v_has_054;

  -- No destruir vacation_profile_data de otro trabajador. Si pertenece al
  -- trabajador seleccionado, actualizar sólo datos derivados del tarjetón.
  IF EXISTS (
    SELECT 1
    FROM public.vacation_profile_data vpd
    WHERE vpd.user_id = v_user_id
      AND (vpd.employee_number IS NULL OR vpd.employee_number = v_target_matricula)
  ) THEN
    UPDATE public.vacation_profile_data
    SET
      employee_number = COALESCE(v_target_matricula, employee_number),
      category = COALESCE(NULLIF(trim(v_emp->>'categoryName'), ''), category),
      category_code = COALESCE(NULLIF(trim(v_emp->>'categoryCode'), ''), category_code),
      adscription = COALESCE(
        NULLIF(trim(v_emp->>'assignmentName'), ''),
        NULLIF(trim(v_emp->>'location'), ''),
        adscription
      ),
      entry_date = COALESCE(NULLIF(v_emp->>'entryDate', '')::DATE, entry_date),
      effective_seniority_years = COALESCE((v_seniority->>'years')::INTEGER, effective_seniority_years),
      effective_seniority_fortnights = COALESCE((v_seniority->>'fortnights')::INTEGER, effective_seniority_fortnights),
      effective_seniority_days = COALESCE((v_seniority->>'days')::INTEGER, effective_seniority_days),
      radiological_exposure = CASE
        WHEN radiological_exposure_source = 'USER_CONFIRMED' THEN radiological_exposure
        WHEN v_has_054 THEN 'YES'
        ELSE 'NO'
      END,
      radiological_exposure_source = CASE
        WHEN radiological_exposure_source = 'USER_CONFIRMED' THEN radiological_exposure_source
        ELSE 'ACTIVE_PAYSLIP'
      END,
      radiological_exposure_updated_at = CASE
        WHEN radiological_exposure_source = 'USER_CONFIRMED' THEN radiological_exposure_updated_at
        ELSE v_revision
      END,
      updated_at = v_revision
    WHERE user_id = v_user_id
      AND (employee_number IS NULL OR employee_number = v_target_matricula);
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.vacation_profile_data WHERE user_id = v_user_id
  ) THEN
    INSERT INTO public.vacation_profile_data (
      user_id, employee_number, category, category_code, adscription,
      entry_date, effective_seniority_years, effective_seniority_fortnights,
      effective_seniority_days, radiological_exposure, radiological_exposure_source,
      radiological_exposure_updated_at, weekly_rest_days, created_at, updated_at
    ) VALUES (
      v_user_id,
      v_target_matricula,
      NULLIF(trim(v_emp->>'categoryName'), ''),
      NULLIF(trim(v_emp->>'categoryCode'), ''),
      COALESCE(NULLIF(trim(v_emp->>'assignmentName'), ''), NULLIF(trim(v_emp->>'location'), '')),
      NULLIF(v_emp->>'entryDate', '')::DATE,
      (v_seniority->>'years')::INTEGER,
      (v_seniority->>'fortnights')::INTEGER,
      (v_seniority->>'days')::INTEGER,
      CASE WHEN v_has_054 THEN 'YES' ELSE 'NO' END,
      'ACTIVE_PAYSLIP',
      v_revision,
      '{5,6}',
      v_revision,
      v_revision
    );
  END IF;

  -- Mantener el perfil laboral configurado; nunca degradarlo a BASIC por
  -- seleccionar otro tarjetón confirmado.
  INSERT INTO public.worker_preferences (
    user_id, onboarding_state, preferred_worker_mode, updated_at
  ) VALUES (
    v_user_id, 'configured', 'payslip', v_revision
  )
  ON CONFLICT (user_id) DO UPDATE SET
    onboarding_state = 'configured',
    preferred_worker_mode = 'payslip',
    updated_at = v_revision;

  INSERT INTO public.worker_active_context (
    user_id, employee_number, active_payslip_id, selection_mode, updated_at
  ) VALUES (
    v_user_id,
    COALESCE(v_target_matricula, 'SIN_MATRICULA'),
    v_payslip.id,
    v_mode,
    v_revision
  )
  ON CONFLICT (user_id) DO UPDATE SET
    employee_number = EXCLUDED.employee_number,
    active_payslip_id = EXCLUDED.active_payslip_id,
    selection_mode = EXCLUDED.selection_mode,
    updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'ok', true,
    'selectionMode', v_mode,
    'activePayslipId', v_payslip.id,
    'employeeNumber', v_target_matricula,
    'workerChanged', v_is_worker_change,
    'contextRevision', v_revision
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_active_payslip(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_payslip(UUID, TEXT) TO authenticated;
