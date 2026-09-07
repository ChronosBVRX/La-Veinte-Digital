-- Migration: 20260907161000_update_set_active_payslip_worker_transition.sql
-- Description: Actualiza set_active_payslip para permitir transiciones atómicas de trabajador
-- desde el historial (CASO J) y sincronización de condición radiológica (054).

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
  v_payslip RECORD;
  v_profile RECORD;
  v_active_matricula TEXT;
  v_mode TEXT := COALESCE(NULLIF(trim(p_selection_mode), ''), 'PINNED');
  v_has_054 BOOLEAN := false;
  v_is_worker_change BOOLEAN := false;
  v_seniority JSONB;
  v_latest_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF v_mode NOT IN ('AUTO_LATEST', 'PINNED') THEN
    RAISE EXCEPTION 'invalid_mode';
  END IF;

  SELECT matricula, full_name, categoria, antiguedad INTO v_profile FROM public.profiles WHERE id = v_user_id;
  v_active_matricula := NULLIF(trim(v_profile.matricula), '');

  IF v_mode = 'AUTO_LATEST' THEN
    -- Buscar el tarjetón más reciente para la matrícula activa
    SELECT id INTO v_latest_id
    FROM public.imported_payslips
    WHERE user_id = v_user_id
      AND (v_active_matricula IS NULL OR employee_number = v_active_matricula)
    ORDER BY period_year DESC NULLS LAST, period_month DESC NULLS LAST, period_half DESC NULLS LAST, created_at DESC
    LIMIT 1;

    INSERT INTO public.worker_active_context (
      user_id, employee_number, active_payslip_id, selection_mode, updated_at
    ) VALUES (
      v_user_id, COALESCE(v_active_matricula, ''), v_latest_id, 'AUTO_LATEST', now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      employee_number = COALESCE(v_active_matricula, public.worker_active_context.employee_number),
      selection_mode = 'AUTO_LATEST',
      active_payslip_id = v_latest_id,
      updated_at = now();

    -- Sincronizar 054 si el tarjetón más reciente existe
    IF v_latest_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.imported_payslip_lines
        WHERE payslip_id = v_latest_id AND concept_code = '054' AND kind = 'earning' AND amount > 0
      ) INTO v_has_054;

      UPDATE public.vacation_profile_data
      SET radiological_exposure = CASE WHEN v_has_054 THEN 'YES' ELSE 'NO' END,
          radiological_exposure_source = 'ACTIVE_PAYSLIP',
          radiological_exposure_updated_at = now(),
          updated_at = now()
      WHERE user_id = v_user_id
        AND (radiological_exposure_source IS NULL OR radiological_exposure_source <> 'USER_CONFIRMED');
    END IF;

    RETURN jsonb_build_object('ok', true, 'selectionMode', 'AUTO_LATEST', 'activePayslipId', v_latest_id);
  END IF;

  -- Modo PINNED: validar que el payslip pertenezca al usuario
  SELECT * INTO v_payslip FROM public.imported_payslips WHERE id = p_payslip_id AND user_id = v_user_id;
  IF v_payslip.id IS NULL THEN
    RAISE EXCEPTION 'payslip_not_found_or_not_owned';
  END IF;

  v_is_worker_change := (v_payslip.employee_number IS NOT NULL AND (v_active_matricula IS NULL OR v_payslip.employee_number <> v_active_matricula));

  -- Determinar si el tarjetón seleccionado tiene concepto 054
  SELECT EXISTS (
    SELECT 1 FROM public.imported_payslip_lines
    WHERE payslip_id = v_payslip.id AND concept_code = '054' AND kind = 'earning' AND amount > 0
  ) INTO v_has_054;

  v_seniority := v_payslip.employee_data->'seniority';

  IF v_is_worker_change THEN
    -- Transición atómica de trabajador: actualizar profiles con la identidad del nuevo tarjetón
    UPDATE public.profiles
    SET
      matricula = v_payslip.employee_number,
      full_name = COALESCE(NULLIF(trim(v_payslip.employee_data->>'fullName'), ''), full_name),
      categoria = COALESCE(NULLIF(trim(v_payslip.employee_data->>'categoryName'), ''), categoria),
      antiguedad = COALESCE(NULLIF(trim(v_seniority->>'raw'), ''), antiguedad),
      adscripcion = COALESCE(NULLIF(trim(v_payslip.employee_data->>'assignmentName'), ''), NULLIF(trim(v_payslip.employee_data->>'location'), ''), adscripcion),
      updated_at = now()
    WHERE id = v_user_id;

    v_active_matricula := v_payslip.employee_number;

    -- Resetear contextos de nómina para el nuevo trabajador
    DELETE FROM public.payroll_contexts WHERE user_id = v_user_id;

    -- Resetear / crear vacation_profile_data para el nuevo trabajador
    INSERT INTO public.vacation_profile_data (
      user_id, employee_number, category, category_code, adscription,
      entry_date, effective_seniority_years, effective_seniority_fortnights,
      effective_seniority_days, radiological_exposure, radiological_exposure_source,
      radiological_exposure_updated_at, weekly_rest_days, created_at, updated_at
    ) VALUES (
      v_user_id, v_payslip.employee_number,
      v_payslip.employee_data->>'categoryName',
      v_payslip.employee_data->>'categoryCode',
      COALESCE(v_payslip.employee_data->>'assignmentName', v_payslip.employee_data->>'location'),
      NULLIF(v_payslip.employee_data->>'entryDate', '')::DATE,
      (v_seniority->>'years')::INTEGER,
      (v_seniority->>'fortnights')::INTEGER,
      (v_seniority->>'days')::INTEGER,
      CASE WHEN v_has_054 THEN 'YES' ELSE 'NO' END,
      'ACTIVE_PAYSLIP',
      now(),
      '{5,6}', now(), now()
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
    -- Mismo trabajador: sincronizar 054 y antigüedad del tarjetón fijado si no fue bloqueado por el usuario
    UPDATE public.vacation_profile_data
    SET
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
        ELSE now()
      END,
      effective_seniority_years = COALESCE((v_seniority->>'years')::INTEGER, effective_seniority_years),
      effective_seniority_fortnights = COALESCE((v_seniority->>'fortnights')::INTEGER, effective_seniority_fortnights),
      effective_seniority_days = COALESCE((v_seniority->>'days')::INTEGER, effective_seniority_days),
      updated_at = now()
    WHERE user_id = v_user_id;
  END IF;

  -- Actualizar contexto activo
  INSERT INTO public.worker_active_context (
    user_id, employee_number, active_payslip_id, selection_mode, updated_at
  ) VALUES (
    v_user_id, COALESCE(v_payslip.employee_number, v_active_matricula, ''), v_payslip.id, 'PINNED', now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    employee_number = COALESCE(v_payslip.employee_number, EXCLUDED.employee_number, public.worker_active_context.employee_number),
    active_payslip_id = v_payslip.id,
    selection_mode = 'PINNED',
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'selectionMode', 'PINNED',
    'activePayslipId', v_payslip.id,
    'employeeNumber', COALESCE(v_payslip.employee_number, v_active_matricula),
    'workerChanged', v_is_worker_change
  );
END;
$$;
