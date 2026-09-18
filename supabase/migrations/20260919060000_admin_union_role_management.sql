-- ═══════════════════════════════════════════════════════════════════
-- 20260919060000_admin_union_role_management.sql
--
-- Gestión del rol sindical (Representación) desde el Centro de
-- Administración de Usuarios. Aditivo y compatible:
--   1. admin_user_detail ahora incluye `union`: membresías del usuario y
--      delegaciones activas (para la ficha administrativa).
--   2. admin_set_union_membership: alta/baja auditada de membresías
--      (union_rep / union_admin) en public.union_members, ejecutable solo
--      por service_role y validando que el actor sea platform admin.
--
-- PRESERVA EL GUARDRAIL: profiles.role='admin' no otorga acceso sindical por
-- sí mismo; el acceso a Representación sigue dependiendo de una membresía
-- explícita en union_members. Esta migración solo permite CREARLA/QUITARLA
-- desde el panel, con auditoría.
--
-- Rollback: reemplazar las funciones por las versiones previas (DROP FUNCTION
-- admin_set_union_membership + restaurar admin_user_detail) y eliminar las
-- filas de auditoría creadas si se desea. No toca datos existentes.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Ficha administrativa con información sindical (aditiva).
CREATE OR REPLACE FUNCTION public.admin_user_detail(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_profile record;
  v_status record;
  v_effective text;
  v_payslips bigint := 0;
  v_transfers bigint := 0;
  v_payroll_updated timestamptz;
  v_storage_ok boolean := true;
  v_documents_ok boolean := true;
  v_suspension_expired boolean := false;
  v_authentication text := 'OK';
  v_last_sync timestamptz;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id, email, created_at, last_sign_in_at, email_confirmed_at, banned_until, raw_app_meta_data
    INTO v_user
    FROM auth.users
   WHERE id = p_target;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT id, full_name, matricula, adscripcion, categoria, role, phone, created_at, updated_at
    INTO v_profile
    FROM public.profiles
   WHERE id = p_target;

  SELECT status, suspension_kind, suspension_ends_at, status_reason,
         status_changed_at, status_changed_by, trashed_at, purge_after,
         sessions_revoked_at, auth_sync_at, auth_sync_error, updated_at
    INTO v_status
    FROM public.user_admin_status
   WHERE user_id = p_target;

  v_effective := public.admin_effective_status(
    v_status.status, v_status.suspension_kind, v_status.suspension_ends_at
  );

  v_suspension_expired :=
    v_status.status = 'suspended'
    AND v_status.suspension_kind = 'temporary'
    AND v_status.suspension_ends_at IS NOT NULL
    AND v_status.suspension_ends_at <= now();

  IF v_user.banned_until IS NOT NULL AND v_user.banned_until > now() AND v_effective = 'active' THEN
    v_authentication := 'ERROR';
  END IF;

  BEGIN
    SELECT count(*) INTO v_payslips
      FROM public.imported_payslips
     WHERE user_id = p_target;
  EXCEPTION WHEN others THEN
    v_storage_ok := false;
    v_documents_ok := false;
  END;

  BEGIN
    SELECT count(*) INTO v_transfers
      FROM public.transfer_files f
      JOIN public.transfer_sessions ts ON ts.id = f.session_id
     WHERE ts.owner_id = p_target;
  EXCEPTION WHEN others THEN
    v_documents_ok := false;
  END;

  BEGIN
    SELECT updated_at INTO v_payroll_updated
      FROM public.payroll_contexts
     WHERE user_id = p_target;

    SELECT greatest(
             v_profile.updated_at,
             v_payroll_updated,
             (SELECT max(created_at) FROM public.imported_payslips WHERE user_id = p_target),
             v_status.updated_at
           )
      INTO v_last_sync;
  EXCEPTION WHEN others THEN
    v_storage_ok := false;
  END;

  RETURN jsonb_build_object(
    'user', jsonb_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'fullName', v_profile.full_name,
      'matricula', v_profile.matricula,
      'adscripcion', v_profile.adscripcion,
      'categoria', v_profile.categoria,
      'role', coalesce(v_profile.role, 'user'),
      'registeredAt', v_user.created_at,
      'profileCreatedAt', v_profile.created_at,
      'lastSignInAt', v_user.last_sign_in_at,
      'emailConfirmedAt', v_user.email_confirmed_at,
      'providers', coalesce(v_user.raw_app_meta_data -> 'providers', '[]'::jsonb)
    ),
    'status', jsonb_build_object(
      'accountStatus', v_effective,
      'rawStatus', coalesce(v_status.status, 'active'),
      'suspensionKind', v_status.suspension_kind,
      'suspensionEndsAt', v_status.suspension_ends_at,
      'suspensionExpired', v_suspension_expired,
      'reason', v_status.status_reason,
      'changedAt', v_status.status_changed_at,
      'changedBy', v_status.status_changed_by,
      'trashedAt', v_status.trashed_at,
      'purgeAfter', v_status.purge_after,
      'sessionsRevokedAt', v_status.sessions_revoked_at,
      'authSyncAt', v_status.auth_sync_at,
      'authSyncError', v_status.auth_sync_error
    ),
    'union', jsonb_build_object(
      'memberships', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', um.id,
          'delegationId', um.delegation_id,
          'delegationCode', d.code,
          'delegationName', d.name,
          'role', um.role,
          'active', um.active,
          'createdAt', um.created_at,
          'updatedAt', um.updated_at
        ) ORDER BY d.code, um.role)
        FROM public.union_members um
        JOIN public.union_delegations d ON d.id = um.delegation_id
        WHERE um.user_id = p_target
      ), '[]'::jsonb),
      'delegations', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', d.id,
          'code', d.code,
          'name', d.name,
          'active', d.active
        ) ORDER BY d.code)
        FROM public.union_delegations d
        WHERE d.active = true
      ), '[]'::jsonb)
    ),
    'counts', jsonb_build_object(
      'payslips', v_payslips,
      'remoteDocuments', v_payslips + v_transfers,
      'hasPayrollContext', v_payroll_updated IS NOT NULL
    ),
    'diagnostics', jsonb_build_object(
      'authentication', v_authentication,
      'profile', CASE
        WHEN public.admin_profile_is_complete(v_profile.full_name, v_profile.matricula) THEN 'OK'
        ELSE 'INCOMPLETO'
      END,
      'payslip', CASE WHEN v_payslips > 0 THEN 'DISPONIBLE' ELSE 'NO_DISPONIBLE' END,
      'documents', CASE
        WHEN NOT v_documents_ok THEN 'ERROR'
        WHEN (v_payslips + v_transfers) > 0 THEN 'DISPONIBLE'
        ELSE 'NO_DISPONIBLE'
      END,
      'storage', CASE WHEN v_storage_ok THEN 'OK' ELSE 'ERROR' END,
      'lastSyncAt', v_last_sync
    ),
    'flags', jsonb_build_object(
      'isSelf', p_target = auth.uid(),
      'canReactivate', coalesce(v_status.status, 'active') = 'suspended',
      'canRestore', coalesce(v_status.status, 'active') = 'trashed'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(uuid) TO authenticated;

-- 2. Alta/baja de membresía sindical (solo service_role, actor admin).
CREATE OR REPLACE FUNCTION public.admin_set_union_membership(
  p_actor uuid,
  p_target uuid,
  p_delegation_id uuid,
  p_role text,
  p_active boolean,
  p_reason text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delegation record;
  v_previous boolean;
  v_exists boolean;
BEGIN
  PERFORM public.admin_assert_actor(p_actor, p_reason);

  IF p_role IS NULL OR p_role NOT IN ('union_rep', 'union_admin') THEN
    RAISE EXCEPTION 'invalid_union_role' USING ERRCODE = '22023';
  END IF;

  IF p_active IS NULL THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE = '22023';
  END IF;

  SELECT id, code, name, active INTO v_delegation
    FROM public.union_delegations
   WHERE id = p_delegation_id;

  IF NOT FOUND OR v_delegation.active IS NOT TRUE THEN
    RAISE EXCEPTION 'delegation_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'target_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT active INTO v_previous
    FROM public.union_members
   WHERE user_id = p_target
     AND delegation_id = p_delegation_id
     AND role = p_role
     FOR UPDATE;

  IF p_active THEN
    INSERT INTO public.union_members (user_id, delegation_id, role, active)
    VALUES (p_target, p_delegation_id, p_role, true)
    ON CONFLICT (user_id, delegation_id, role)
    DO UPDATE SET active = true, updated_at = now();
  ELSE
    IF v_previous IS NULL THEN
      RAISE EXCEPTION 'membership_not_found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.union_members
       SET active = false, updated_at = now()
     WHERE user_id = p_target
       AND delegation_id = p_delegation_id
       AND role = p_role;
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details, request_id)
  VALUES (
    p_actor,
    'user.union_role_change',
    'user',
    p_target::text,
    jsonb_build_object(
      'previous', CASE
        WHEN v_previous IS TRUE THEN 'active'
        WHEN v_previous IS FALSE THEN 'inactive'
        ELSE 'none'
      END,
      'new', CASE WHEN p_active THEN 'active' ELSE 'inactive' END,
      'delegation', v_delegation.code,
      'role', p_role,
      'reason', btrim(p_reason)
    ),
    p_request_id
  );

  RETURN jsonb_build_object(
    'active', p_active,
    'role', p_role,
    'delegation', v_delegation.code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_union_membership(uuid, uuid, uuid, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_union_membership(uuid, uuid, uuid, text, boolean, text, text) TO service_role;

COMMIT;
