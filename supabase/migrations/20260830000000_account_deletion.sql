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
--    se concede EXECUTE a `authenticated`. Se revoca de PUBLIC.
--  - Los datos se borran en una sola transacción; si algo falla, nada se elimina.
--  - El borrado del usuario auth (y de sus identidades/sesiones) se hace mediante
--    auth.admin_delete_user, que requiere privilegios de administrador que el
--    cliente no tiene: nunca se expone la service_role en el cliente.
--
-- NOTA DE DESPLIEGUE: este archivo debe aplicarse al proyecto remoto Supabase con
-- `supabase db push` (o desde el dashboard) y validarse; es un cambio de esquema que
-- la misión no aplica automáticamente sin aprobación explícita.
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

  -- 1) Datos efímeros / compartidos cuya FK a auth.users o a profiles podría
  --    bloquear el borrado del usuario. Se borran expresamente primero.
  DELETE FROM public.bitacora_entries WHERE user_id = v_uid;
  DELETE FROM public.worker_commitments WHERE user_id = v_uid;
  DELETE FROM public.imported_payslips WHERE user_id = v_uid;          -- cascada líneas+observaciones
  DELETE FROM public.payroll_contexts WHERE user_id = v_uid;
  DELETE FROM public.vacation_simulations WHERE user_id = v_uid;       -- cascada eventos
  DELETE FROM public.vacation_profile_data WHERE user_id = v_uid;
  DELETE FROM public.push_devices WHERE user_id = v_uid;               -- tokens FCM
  DELETE FROM public.transfer_sessions WHERE owner_id = v_uid;         -- cascada transfer_files
  DELETE FROM public.api_usage_log WHERE user_id = v_uid;

  -- 2) Perfil del usuario (las tablas hijas ya se borraron o cascadan desde aquí).
  DELETE FROM public.profiles WHERE id = v_uid;

  -- 3) Borrar la identidad de autenticación y sus sesiones.
  PERFORM auth.admin_delete_user(v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- Usuarios anónimos nunca pueden llamar a esta función.
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;
