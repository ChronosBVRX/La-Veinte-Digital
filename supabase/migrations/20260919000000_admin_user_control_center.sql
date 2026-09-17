-- ═══════════════════════════════════════════════════════════════════
-- 20260919000000_admin_user_control_center.sql
--
-- Centro de Administración de Usuarios (aditivo, no destructivo).
--
-- 1. public.user_admin_status — estado administrativo por cuenta
--    (activo / suspendido / papelera). Una fila ausente equivale a activo,
--    de modo que la migración es compatible con todos los usuarios existentes.
-- 2. Lecturas administrativas (SECURITY DEFINER, solo admins de plataforma):
--    admin_list_users, admin_user_metrics, admin_user_detail,
--    admin_user_activity, admin_list_audit_log.
-- 3. Escrituras administrativas (SECURITY DEFINER, EXECUTE solo service_role):
--    admin_apply_user_role, admin_suspend_user, admin_reactivate_user,
--    admin_trash_user, admin_restore_user, admin_purge_user,
--    admin_revoke_user_sessions.
-- 4. Auditoría append-only en public.admin_audit_log (tabla existente).
--
-- REGLAS DE SEGURIDAD:
--  - Las lecturas validan public.is_admin_user() DENTRO de la función.
--  - Las escrituras se conceden EXCLUSIVAMENTE a service_role, que jamás se
--    expone al navegador; además validan que p_actor tenga role='admin' en la
--    misma transacción (doble validación: ruta de sesión + RPC).
--  - Ninguna escritura puede tocar al propio actor en suspensión/papelera/purga,
--    ni degradar, suspender, enviar a papelera o purgar al último admin.
--  - La purga física es atómica y bloqueada por defecto: además del guard de
--    último admin, la API la deshabilita con ADMIN_PERMANENT_DELETE_ENABLED.
--    Si existen referencias FK (p. ej. representación sindical) la transacción
--    completa se revierte con 'blocked_references' y no se borra nada.
--  - Los detalles auditados se limitan a estados/reason operativos; nunca
--    contenido de tarjetones, documentos, escritos ni tokens.
--
-- NO aplicada a producción por el agente: se entrega para revisión.
-- Rollback documentado: docs/admin-user-control-center.md
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. Tabla: user_admin_status
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_admin_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trashed')),
  suspension_kind text CHECK (suspension_kind IS NULL OR suspension_kind IN ('temporary', 'indefinite')),
  suspension_ends_at timestamptz,
  status_reason text CHECK (status_reason IS NULL OR char_length(status_reason) <= 500),
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  status_changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trashed_at timestamptz,
  purge_after timestamptz,
  sessions_revoked_at timestamptz,
  auth_sync_at timestamptz,
  auth_sync_error text CHECK (auth_sync_error IS NULL OR char_length(auth_sync_error) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_admin_status_suspension_consistency CHECK (
    (status = 'suspended' AND suspension_kind IS NOT NULL)
    OR (status <> 'suspended' AND suspension_kind IS NULL AND suspension_ends_at IS NULL)
  ),
  CONSTRAINT user_admin_status_trash_consistency CHECK (
    (status = 'trashed' AND trashed_at IS NOT NULL AND purge_after IS NOT NULL)
    OR (status <> 'trashed' AND trashed_at IS NULL AND purge_after IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS user_admin_status_status_idx
  ON public.user_admin_status (status);

CREATE INDEX IF NOT EXISTS user_admin_status_purge_after_idx
  ON public.user_admin_status (purge_after)
  WHERE status = 'trashed';

ALTER TABLE public.user_admin_status ENABLE ROW LEVEL SECURITY;

-- El titular puede leer su propio estado (para el mensaje humano de suspensión).
-- No existen políticas de INSERT/UPDATE/DELETE: solo escriben service_role y
-- las funciones SECURITY DEFINER de esta migración.
DROP POLICY IF EXISTS "user_admin_status_select_own" ON public.user_admin_status;
CREATE POLICY "user_admin_status_select_own"
  ON public.user_admin_status FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_admin_status IS
  'Estado administrativo de cuenta (activo/suspendido/papelera). Fila ausente = activo. Escritura exclusiva server-side.';

-- Grants explícitos (el proyecto ya no auto-expone tablas nuevas):
--  - authenticated: solo SELECT; las políticas RLS limitan a la fila propia.
--  - service_role: DML para la sincronización de Auth y las RPC de escritura.
GRANT SELECT ON TABLE public.user_admin_status TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_admin_status TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Helpers internos
-- ═══════════════════════════════════════════════════════════════════

-- Estado efectivo: una suspensión temporal vencida vuelve a ser activa para
-- lecturas y métricas (la API sincroniza el desbaneo de Auth). El estado crudo
-- permanece en la fila hasta que un administrador lo normalice.
CREATE OR REPLACE FUNCTION public.admin_effective_status(
  p_status text,
  p_kind text,
  p_ends_at timestamptz
) RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_status = 'suspended'
      AND p_kind = 'temporary'
      AND p_ends_at IS NOT NULL
      AND p_ends_at <= now() THEN 'active'
    ELSE COALESCE(p_status, 'active')
  END;
$$;

REVOKE ALL ON FUNCTION public.admin_effective_status(text, text, timestamptz) FROM PUBLIC, anon, authenticated;
-- service_role puede invocarlo para diagnósticos y pruebas internas.
GRANT EXECUTE ON FUNCTION public.admin_effective_status(text, text, timestamptz) TO service_role;

-- Completitud mínima de perfil para indicadores administrativos.
-- (Sin datos personales adicionales: solo nombre y matrícula.)
CREATE OR REPLACE FUNCTION public.admin_profile_is_complete(
  p_full_name text,
  p_matricula text
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_full_name IS NOT NULL AND btrim(p_full_name) <> ''
     AND p_matricula IS NOT NULL AND btrim(p_matricula) <> '';
$$;

REVOKE ALL ON FUNCTION public.admin_profile_is_complete(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_profile_is_complete(text, text) TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Lecturas administrativas (solo admins de plataforma)
-- ═══════════════════════════════════════════════════════════════════

-- 3.1 Listado paginado con búsqueda, filtros y ordenamiento.
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_registered_from date DEFAULT NULL,
  p_registered_to date DEFAULT NULL,
  p_sort text DEFAULT 'created_at',
  p_direction text DEFAULT 'desc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  matricula text,
  role text,
  account_status text,
  suspension_kind text,
  suspension_ends_at timestamptz,
  email_confirmed boolean,
  registered_at timestamptz,
  last_sign_in_at timestamptz,
  providers jsonb,
  profile_complete boolean,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_sort_col text;
  v_dir text := CASE WHEN lower(coalesce(p_direction, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_sort_col := CASE p_sort
    WHEN 'last_sign_in_at' THEN 'last_sign_in_at'
    WHEN 'email' THEN 'email'
    WHEN 'full_name' THEN 'full_name'
    ELSE 'registered_at'
  END;

  RETURN QUERY EXECUTE format($q$
    WITH base AS (
      SELECT u.id AS user_id,
             u.email::text AS email,
             p.full_name,
             p.matricula,
             coalesce(p.role, 'user') AS role,
             public.admin_effective_status(s.status, s.suspension_kind, s.suspension_ends_at) AS account_status,
             s.suspension_kind,
             s.suspension_ends_at,
             (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
             u.created_at AS registered_at,
             u.last_sign_in_at,
             coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb) AS providers,
             (p.id IS NOT NULL
               AND public.admin_profile_is_complete(p.full_name, p.matricula)) AS profile_complete
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      LEFT JOIN public.user_admin_status s ON s.user_id = u.id
      WHERE ($1 IS NULL
             OR u.email ILIKE '%%' || $1 || '%%'
             OR p.full_name ILIKE '%%' || $1 || '%%'
             OR p.matricula ILIKE '%%' || $1 || '%%'
             OR u.id::text = $1)
        AND ($2 IS NULL OR $2 NOT IN ('active', 'suspended', 'trashed')
             OR public.admin_effective_status(s.status, s.suspension_kind, s.suspension_ends_at) = $2)
        AND ($3 IS NULL OR $3 NOT IN ('user', 'admin')
             OR coalesce(p.role, 'user') = $3)
        AND ($4 IS NULL OR u.created_at >= $4::date)
        AND ($5 IS NULL OR u.created_at < ($5::date + interval '1 day'))
    )
    SELECT base.*, count(*) OVER () AS total_count
    FROM base
    ORDER BY %I %s NULLS LAST, base.user_id
    LIMIT $6 OFFSET $7
  $q$, v_sort_col, v_dir)
  USING v_search, p_status, p_role, p_registered_from, p_registered_to, v_limit, v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(text, text, text, date, date, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, text, date, date, text, text, integer, integer) TO authenticated;

-- 3.2 Indicadores agregados del panel (sin PII).
CREATE OR REPLACE FUNCTION public.admin_user_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'totalUsers', (SELECT count(*) FROM auth.users),
    'activeUsers', (
      SELECT count(*) FROM auth.users u
      LEFT JOIN public.user_admin_status s ON s.user_id = u.id
      WHERE public.admin_effective_status(s.status, s.suspension_kind, s.suspension_ends_at) = 'active'
    ),
    'recentRegistrations', (
      SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '7 days'
    ),
    'pendingEmailConfirmation', (
      SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NULL
    ),
    'suspendedAccounts', (
      SELECT count(*) FROM auth.users u
      LEFT JOIN public.user_admin_status s ON s.user_id = u.id
      WHERE public.admin_effective_status(s.status, s.suspension_kind, s.suspension_ends_at) = 'suspended'
    ),
    'trashedAccounts', (
      SELECT count(*) FROM auth.users u
      LEFT JOIN public.user_admin_status s ON s.user_id = u.id
      WHERE public.admin_effective_status(s.status, s.suspension_kind, s.suspension_ends_at) = 'trashed'
    ),
    'incompleteProfiles', (
      SELECT count(*) FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE p.id IS NULL OR NOT public.admin_profile_is_complete(p.full_name, p.matricula)
    ),
    'usersWithPayslip', (
      SELECT count(DISTINCT user_id) FROM public.imported_payslips
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_metrics() TO authenticated;

-- 3.3 Ficha administrativa (estados técnicos y conteos; nunca contenido).
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

  -- Autenticación: ERROR solo si Auth mantiene un baneo activo que el estado
  -- administrativo ya no refleja (desincronización real, no contenido privado).
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

-- 3.4 Actividad operativa (sin títulos, textos ni contenido privado).
CREATE OR REPLACE FUNCTION public.admin_user_activity(
  p_target uuid,
  p_limit integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_events jsonb := '[]'::jsonb;
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Inicios de sesión (GoTrue audit log, si el esquema lo expone).
  IF to_regclass('auth.audit_log_entries') IS NOT NULL THEN
    BEGIN
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'kind', 'login',
               'at', e.created_at
             )), '[]'::jsonb)
        INTO v_rows
        FROM auth.audit_log_entries e
       WHERE e.payload ->> 'actor_id' = p_target::text
         AND e.payload ->> 'action' = 'login';
      v_events := v_events || v_rows;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  -- Importaciones de tarjetón (solo fecha; nunca conceptos ni montos).
  BEGIN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'kind', 'payslip_import',
             'at', ip.created_at
           )), '[]'::jsonb)
      INTO v_rows
      FROM public.imported_payslips ip
     WHERE ip.user_id = p_target;
    v_events := v_events || v_rows;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Uso de herramientas por día/ruta (contadores agregados, sin contenido).
  BEGIN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'kind', 'tool_usage',
             'at', aul.usage_date::timestamptz,
             'route', aul.route,
             'count', aul.count
           )), '[]'::jsonb)
      INTO v_rows
      FROM public.api_usage_log aul
     WHERE aul.user_id = p_target;
    v_events := v_events || v_rows;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Acciones administrativas registradas sobre la cuenta.
  BEGIN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'kind', 'admin_action',
             'at', al.created_at,
             'action', al.action,
             'reason', al.details ->> 'reason'
           )), '[]'::jsonb)
      INTO v_rows
      FROM public.admin_audit_log al
     WHERE al.entity_type = 'user'
       AND al.entity_id = p_target::text;
    v_events := v_events || v_rows;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN (
    SELECT coalesce(jsonb_agg(ev ORDER BY ev ->> 'at' DESC), '[]'::jsonb)
    FROM (
      SELECT value AS ev
      FROM jsonb_array_elements(v_events)
      ORDER BY value ->> 'at' DESC
      LIMIT v_limit
    ) limited
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_activity(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_activity(uuid, integer) TO authenticated;

-- 3.5 Bitácora administrativa paginada con filtros (solo metadatos).
CREATE OR REPLACE FUNCTION public.admin_list_audit_log(
  p_action text DEFAULT NULL,
  p_target uuid DEFAULT NULL,
  p_actor uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  id uuid,
  action text,
  entity_id text,
  target_email text,
  target_name text,
  actor_id uuid,
  actor_email text,
  actor_name text,
  reason text,
  previous_value text,
  new_value text,
  request_id text,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT a.*
    FROM public.admin_audit_log a
    WHERE a.entity_type = 'user'
      AND (p_action IS NULL OR a.action = p_action)
      AND (p_target IS NULL OR a.entity_id = p_target::text)
      AND (p_actor IS NULL OR a.actor_id = p_actor)
      AND (p_from IS NULL OR a.created_at >= p_from::date)
      AND (p_to IS NULL OR a.created_at < (p_to::date + interval '1 day'))
  )
  SELECT
    f.id,
    f.action,
    f.entity_id,
    tu.email::text AS target_email,
    tp.full_name AS target_name,
    f.actor_id,
    au.email::text AS actor_email,
    ap.full_name AS actor_name,
    f.details ->> 'reason' AS reason,
    f.details ->> 'previous' AS previous_value,
    f.details ->> 'new' AS new_value,
    f.request_id,
    f.created_at,
    count(*) OVER () AS total_count
  FROM filtered f
  LEFT JOIN auth.users tu
    ON tu.id = CASE
      WHEN f.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN f.entity_id::uuid
      ELSE NULL
    END
  LEFT JOIN public.profiles tp ON tp.id = tu.id
  LEFT JOIN auth.users au ON au.id = f.actor_id
  LEFT JOIN public.profiles ap ON ap.id = f.actor_id
  ORDER BY f.created_at DESC, f.id DESC
  LIMIT least(greatest(coalesce(p_limit, 25), 1), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_audit_log(text, uuid, uuid, date, date, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_log(text, uuid, uuid, date, date, integer, integer) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Escrituras administrativas (EXECUTE solo service_role)
--    Validan p_actor (admin) y auditan dentro de la misma transacción.
-- ═══════════════════════════════════════════════════════════════════

-- 4.1 Validación común de actor, motivo y objetivo.
CREATE OR REPLACE FUNCTION public.admin_assert_actor(
  p_actor uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_actor AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  IF char_length(p_reason) > 500 THEN
    RAISE EXCEPTION 'reason_too_long' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assert_actor(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assert_actor(uuid, text) TO service_role;

-- 4.2 Cambio de rol de plataforma (user <-> admin).
CREATE OR REPLACE FUNCTION public.admin_apply_user_role(
  p_actor uuid,
  p_target uuid,
  p_new_role text,
  p_reason text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous text;
  v_admin_count integer;
BEGIN
  PERFORM public.admin_assert_actor(p_actor, p_reason);

  IF p_new_role IS NULL OR p_new_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_previous
    FROM public.profiles
   WHERE id = p_target
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_previous := coalesce(v_previous, 'user');

  IF v_previous = p_new_role THEN
    RAISE EXCEPTION 'role_unchanged' USING ERRCODE = '22023';
  END IF;

  IF p_new_role = 'user' THEN
    -- Bloqueo de conjunto para que dos degradaciones concurrentes no puedan
    -- quedarse sin administradores.
    PERFORM 1 FROM public.profiles WHERE role = 'admin' FOR UPDATE;
    SELECT count(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'last_admin' USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.profiles SET role = p_new_role WHERE id = p_target;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details, request_id)
  VALUES (
    p_actor,
    'user.role_change',
    'user',
    p_target::text,
    jsonb_build_object('previous', v_previous, 'new', p_new_role, 'reason', btrim(p_reason)),
    p_request_id
  );

  RETURN jsonb_build_object('previous', v_previous, 'current', p_new_role);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_apply_user_role(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_user_role(uuid, uuid, text, text, text) TO service_role;

-- 4.3 Suspensión (temporal o indefinida).
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  p_actor uuid,
  p_target uuid,
  p_kind text,
  p_ends_at timestamptz,
  p_reason text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous text := 'active';
  v_target_role text;
  v_admin_count integer;
BEGIN
  PERFORM public.admin_assert_actor(p_actor, p_reason);

  IF p_target = p_actor THEN
    RAISE EXCEPTION 'self_target_forbidden' USING ERRCODE = '22023';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('temporary', 'indefinite') THEN
    RAISE EXCEPTION 'invalid_kind' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'temporary' THEN
    IF p_ends_at IS NULL OR p_ends_at <= now() THEN
      RAISE EXCEPTION 'invalid_ends_at' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_ends_at IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_ends_at' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF coalesce(v_target_role, 'user') = 'admin' THEN
    PERFORM 1 FROM public.profiles WHERE role = 'admin' FOR UPDATE;
    SELECT count(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'last_admin' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT public.admin_effective_status(status, suspension_kind, suspension_ends_at)
    INTO v_previous
    FROM public.user_admin_status
   WHERE user_id = p_target
     FOR UPDATE;

  INSERT INTO public.user_admin_status (
    user_id, status, suspension_kind, suspension_ends_at, status_reason,
    status_changed_at, status_changed_by, trashed_at, purge_after, updated_at
  ) VALUES (
    p_target, 'suspended', p_kind, p_ends_at, btrim(p_reason),
    now(), p_actor, NULL, NULL, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'suspended',
    suspension_kind = EXCLUDED.suspension_kind,
    suspension_ends_at = EXCLUDED.suspension_ends_at,
    status_reason = EXCLUDED.status_reason,
    status_changed_at = now(),
    status_changed_by = p_actor,
    trashed_at = NULL,
    purge_after = NULL,
    updated_at = now();

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details, request_id)
  VALUES (
    p_actor,
    'user.suspend',
    'user',
    p_target::text,
    jsonb_build_object(
      'previous', coalesce(v_previous, 'active'),
      'new', 'suspended',
      'kind', p_kind,
      'ends_at', p_ends_at,
      'reason', btrim(p_reason)
    ),
    p_request_id
  );

  RETURN jsonb_build_object('status', 'suspended', 'kind', p_kind, 'endsAt', p_ends_at);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, uuid, text, timestamptz, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, uuid, text, timestamptz, text, text) TO service_role;

-- 4.4 Reactivación de una suspensión.
CREATE OR REPLACE FUNCTION public.admin_reactivate_user(
  p_actor uuid,
  p_target uuid,
  p_reason text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  PERFORM public.admin_assert_actor(p_actor, p_reason);

  SELECT status INTO v_status
    FROM public.user_admin_status
   WHERE user_id = p_target
     FOR UPDATE;

  IF v_status IS NULL OR v_status <> 'suspended' THEN
    RAISE EXCEPTION 'not_suspended' USING ERRCODE = '22023';
  END IF;

  UPDATE public.user_admin_status
     SET status = 'active',
         suspension_kind = NULL,
         suspension_ends_at = NULL,
         status_reason = btrim(p_reason),
         status_changed_at = now(),
         status_changed_by = p_actor,
         updated_at = now()
   WHERE user_id = p_target;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details, request_id)
  VALUES (
    p_actor,
    'user.reactivate',
    'user',
    p_target::text,
    jsonb_build_object('previous', 'suspended', 'new', 'active', 'reason', btrim(p_reason)),
    p_request_id
  );

  RETURN jsonb_build_object('status', 'active');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reactivate_user(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_user(uuid, uuid, text, text) TO service_role;

-- 4.5 Envío a papelera (retención de 30 días).
CREATE OR REPLACE FUNCTION public.admin_trash_user(
  p_actor uuid,
  p_target uuid,
  p_reason text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous text;
  v_raw_status text;
  v_target_role text;
  v_admin_count integer;
  v_purge_after timestamptz := now() + interval '30 days';
BEGIN
  PERFORM public.admin_assert_actor(p_actor, p_reason);

  IF p_target = p_actor THEN
    RAISE EXCEPTION 'self_target_forbidden' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF coalesce(v_target_role, 'user') = 'admin' THEN
    PERFORM 1 FROM public.profiles WHERE role = 'admin' FOR UPDATE;
    SELECT count(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'last_admin' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT public.admin_effective_status(status, suspension_kind, suspension_ends_at), status
    INTO v_previous, v_raw_status
    FROM public.user_admin_status
   WHERE user_id = p_target;

  IF v_raw_status = 'trashed' THEN
    RAISE EXCEPTION 'already_trashed' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_admin_status (
    user_id, status, suspension_kind, suspension_ends_at, status_reason,
    status_changed_at, status_changed_by, trashed_at, purge_after, updated_at
  ) VALUES (
    p_target, 'trashed', NULL, NULL, btrim(p_reason),
    now(), p_actor, now(), v_purge_after, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'trashed',
    suspension_kind = NULL,
    suspension_ends_at = NULL,
    status_reason = EXCLUDED.status_reason,
    status_changed_at = now(),
    status_changed_by = p_actor,
    trashed_at = now(),
    purge_after = v_purge_after,
    updated_at = now();

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details, request_id)
  VALUES (
    p_actor,
    'user.trash',
    'user',
    p_target::text,
    jsonb_build_object(
      'previous', coalesce(v_previous, 'active'),
      'new', 'trashed',
      'purge_after', v_purge_after,
      'reason', btrim(p_reason)
    ),
    p_request_id
  );

  RETURN jsonb_build_object('status', 'trashed', 'purgeAfter', v_purge_after);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_trash_user(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_trash_user(uuid, uuid, text, text) TO service_role;

-- 4.6 Restauración desde papelera.
CREATE OR REPLACE FUNCTION public.admin_restore_user(
  p_actor uuid,
  p_target uuid,
  p_reason text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  PERFORM public.admin_assert_actor(p_actor, p_reason);

  SELECT status INTO v_status
    FROM public.user_admin_status
   WHERE user_id = p_target
     FOR UPDATE;

  IF v_status IS NULL OR v_status <> 'trashed' THEN
    RAISE EXCEPTION 'not_trashed' USING ERRCODE = '22023';
  END IF;

  UPDATE public.user_admin_status
     SET status = 'active',
         suspension_kind = NULL,
         suspension_ends_at = NULL,
         status_reason = btrim(p_reason),
         status_changed_at = now(),
         status_changed_by = p_actor,
         trashed_at = NULL,
         purge_after = NULL,
         updated_at = now()
   WHERE user_id = p_target;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details, request_id)
  VALUES (
    p_actor,
    'user.restore',
    'user',
    p_target::text,
    jsonb_build_object('previous', 'trashed', 'new', 'active', 'reason', btrim(p_reason)),
    p_request_id
  );

  RETURN jsonb_build_object('status', 'active');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_restore_user(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_user(uuid, uuid, text, text) TO service_role;

-- 4.7 Cierre de todas las sesiones (refresh tokens + sesiones GoTrue).
CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(
  p_actor uuid,
  p_target uuid,
  p_reason text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revoked integer := 0;
  v_rows integer := 0;
  v_exists boolean;
BEGIN
  PERFORM public.admin_assert_actor(p_actor, p_reason);

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'target_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
    DELETE FROM auth.refresh_tokens WHERE user_id = p_target;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_revoked := v_revoked + v_rows;
  END IF;

  IF to_regclass('auth.sessions') IS NOT NULL THEN
    DELETE FROM auth.sessions WHERE user_id = p_target;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_revoked := v_revoked + v_rows;
  END IF;

  INSERT INTO public.user_admin_status (user_id, status, sessions_revoked_at, updated_at)
  VALUES (p_target, 'active', now(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    sessions_revoked_at = now(),
    updated_at = now();

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details, request_id)
  VALUES (
    p_actor,
    'user.sessions_revoked',
    'user',
    p_target::text,
    jsonb_build_object('revoked', v_revoked, 'reason', btrim(p_reason)),
    p_request_id
  );

  RETURN jsonb_build_object('revoked', v_revoked);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_sessions(uuid, uuid, text, text) TO service_role;

-- 4.8 Purga física definitiva (bloqueada por defecto en la API).
--     Solo cuentas en papelera, con correo confirmado por el administrador y
--     sin referencias FK que comprometan integridad (si las hay, se revierte
--     todo y se responde 'blocked_references').
CREATE OR REPLACE FUNCTION public.admin_purge_user(
  p_actor uuid,
  p_target uuid,
  p_confirm_email text,
  p_reason text,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_email text;
  v_target_role text;
  v_admin_count integer;
BEGIN
  PERFORM public.admin_assert_actor(p_actor, p_reason);

  IF p_target = p_actor THEN
    RAISE EXCEPTION 'self_target_forbidden' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_status
    FROM public.user_admin_status
   WHERE user_id = p_target
     FOR UPDATE;

  IF v_status IS NULL OR v_status <> 'trashed' THEN
    RAISE EXCEPTION 'not_trashed' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_target;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'target_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_confirm_email IS NULL
     OR lower(btrim(p_confirm_email)) <> lower(btrim(v_email)) THEN
    RAISE EXCEPTION 'email_mismatch' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_target FOR UPDATE;
  IF coalesce(v_target_role, 'user') = 'admin' THEN
    PERFORM 1 FROM public.profiles WHERE role = 'admin' FOR UPDATE;
    SELECT count(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'last_admin' USING ERRCODE = '23514';
    END IF;
  END IF;

  BEGIN
    -- Mismo contrato que delete_my_account(), aplicado al objetivo.
    DELETE FROM public.bitacora_entries WHERE user_id = p_target;
    IF to_regclass('public.worker_commitments') IS NOT NULL THEN
      DELETE FROM public.worker_commitments WHERE user_id = p_target;
    END IF;
    DELETE FROM public.imported_payslips WHERE user_id = p_target;
    DELETE FROM public.payroll_contexts WHERE user_id = p_target;
    DELETE FROM public.vacation_simulations WHERE user_id = p_target;
    DELETE FROM public.vacation_profile_data WHERE user_id = p_target;
    DELETE FROM public.push_devices WHERE user_id = p_target;
    DELETE FROM public.transfer_sessions WHERE owner_id = p_target;
    DELETE FROM public.api_usage_log WHERE user_id = p_target;

    UPDATE public.vacation_simulations
       SET calendar_id = NULL
     WHERE calendar_id IN (SELECT id FROM public.vacation_calendars WHERE created_by = p_target);
    DELETE FROM public.vacation_calendars WHERE created_by = p_target;
    DELETE FROM public.vacation_rule_versions WHERE created_by = p_target;

    DELETE FROM public.profiles WHERE id = p_target;

    -- Borrado de la identidad de Auth; las tablas auth.* hijas cascadean.
    -- Si alguna FK NO ACTION (p. ej. representación sindical) lo bloquea, la
    -- transacción completa se revierte y se informa 'blocked_references'.
    DELETE FROM auth.users WHERE id = p_target;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'blocked_references' USING ERRCODE = '23503';
  END;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details, request_id)
  VALUES (
    p_actor,
    'user.purge',
    'user',
    p_target::text,
    jsonb_build_object('previous', 'trashed', 'new', 'deleted', 'reason', btrim(p_reason)),
    p_request_id
  );

  RETURN jsonb_build_object('purged', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_user(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_purge_user(uuid, uuid, text, text, text) TO service_role;

COMMIT;
