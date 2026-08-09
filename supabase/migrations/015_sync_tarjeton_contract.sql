-- Sincroniza la whitelist SQL del RPC de confirmacion de tarjeton con
-- el contrato TypeScript (TarjetonSeniority incluye parsed y status).
-- La migracion 014 quedo desfasada: el parser TS produce estos campos
-- pero la validacion SQL los rechazaba como unknown field.
--
-- No se modifica la logica de negocio: solo se extiende la whitelist
-- y se anade validacion recursiva estricta sobre parsed y status.

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
      'periodNumberToEnjoy', 'firstPeriodStartRaw', 'secondPeriodStartRaw', 'accumulatedRetirementDays'
    ])
  ) THEN
    RAISE EXCEPTION 'invalid_payload: unknown field';
  END IF;

  -- Validacion recursiva de seniority.parsed (debe contener solo years, fortnights, days)
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

  -- Defensa en profundidad para invocaciones directas al RPC. La API aplica
  -- ademas la whitelist completa del contrato TypeScript.
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
