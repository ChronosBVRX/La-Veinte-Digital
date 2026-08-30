-- ═══════════════════════════════════════════════════════════════════
-- delete_my_account — Eliminación definitiva de la cuenta (derecho a erasure).
--
-- Requiere: 001_vacation_schema.sql, 002_bitacora_schema.sql,
--           003_payroll_contexts.sql, 004_imported_payslips.sql,
--           006_profiles_lifecycle.sql, 013_payroll_erasure_rpc.sql,
--           20260812100000_transfer_documents.sql,
--           20260829000001_push_devices.sql
--
-- SEGURIDAD:
--  - El destino SIEMPRE se deriva de `auth.uid()` (la sesión del RPC). El cliente
--    NUNCA envía un id, de modo que es imposible borrar la cuenta de otra persona
--    cambiando un campo de la petición.
--  - El cuerpo es SECURITY DEFINER (corre como el rol que crea la migración) y solo
--    se concede EXECUTE a `authenticated`. Se revoca de PUBLIC y de anon.
--  - Datos borrados en una sola transacción; si algo falla, nada se elimina.
--  - El borrado del usuario auth (y de sus identidades/sesiones) se hace mediante
--    auth.admin_delete_user, que requiere privilegios de administrador que el
--    cliente no tiene: nunca se expone la service_role en el cliente.
--
-- NOTA DE FK (comprobada contra el proyecto ragktminwduiggvaoeix):
--   vacation_calendars y vacation_rule_versions referencian auth.users con NO ACTION,
--   por lo que BLOQUEARÍAN auth.admin_delete_user si el usuario es su creador. Se
--   borran explícitamente antes (detachando primero las simulaciones que los usen).
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- 1) Datos efímeros / compartidos (FK a auth.users o a profiles).
  DELETE FROM public.bitacora_entries WHERE user_id = v_uid;
  IF to_regclass('public.worker_commitments') IS NOT NULL THEN
    -- worker_commitments fue creado out-of-band en el proyecto real (no está en migraciones
    -- versionadas), por lo que en un replay desde cero podría no existir. Se borra solo si existe.
    DELETE FROM public.worker_commitments WHERE user_id = v_uid;
  END IF;
  DELETE FROM public.imported_payslips WHERE user_id = v_uid;          -- cascada líneas+observaciones
  DELETE FROM public.payroll_contexts WHERE user_id = v_uid;
  DELETE FROM public.vacation_simulations WHERE user_id = v_uid;       -- cascada eventos
  DELETE FROM public.vacation_profile_data WHERE user_id = v_uid;
  DELETE FROM public.push_devices WHERE user_id = v_uid;               -- tokens FCM
  DELETE FROM public.transfer_sessions WHERE owner_id = v_uid;         -- cascada transfer_files
  DELETE FROM public.api_usage_log WHERE user_id = v_uid;

  -- 2) Contenido creado por el usuario cuya FK es NO ACTION → bloquearía el borrado.
  --    Vacaciones: desvincular simulaciones que apunten a calendarios del usuario.
  UPDATE public.vacation_simulations
    SET calendar_id = NULL
    WHERE calendar_id IN (SELECT id FROM public.vacation_calendars WHERE created_by = v_uid);
  DELETE FROM public.vacation_calendars WHERE created_by = v_uid;      -- cascada calendar_roles
  DELETE FROM public.vacation_rule_versions WHERE created_by = v_uid;

  -- 3) Perfil del usuario (las tablas hijas ya se borraron o cascadan desde aquí).
  DELETE FROM public.profiles WHERE id = v_uid;

  -- 4) Borrar la identidad de autenticación y sus sesiones.
  --    a) auth.users se borra directamente (SECURITY DEFINER corre como postgres).
  --    b) Todas las tablas auth.* hijas (identities, sessions, mfa, oauth, one_time_tokens,
  --       webauthn) tienen ON DELETE CASCADE sobre auth.users, por lo que se limpian en cascada.
  --    c) No se usa auth.admin_delete_user porque en esta instancia no existe; el borrado
  --       directo con REVOKE de una casada es equivalente y más portable.
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
