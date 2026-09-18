-- ═══════════════════════════════════════════════════════════════════
-- 20260919050000_admin_user_status_least_privilege.sql
--
-- Endurecimiento aditivo de privilegios de public.user_admin_status.
--
-- El proyecto remoto conserva las default privileges heredadas que otorgan
-- ALL (SELECT/INSERT/UPDATE/DELETE) sobre tablas nuevas a anon y authenticated.
-- La tabla ya está protegida por RLS con una única política de lectura propia,
-- por lo que no hay exposición ni escalada; esta migración aplica mínimo
-- privilegio explícito (mismo patrón que 20260804150936_harden_profile_privileges):
--   - anon: sin privilegios (no tiene políticas).
--   - authenticated: solo SELECT (la política RLS limita a la fila propia).
--   - service_role: DML completo (sincronización de Auth y RPC de escritura).
--
-- Idempotente y reversible: puede re-ejecutarse sin efectos adicionales.
-- Rollback: GRANT ALL ON public.user_admin_status TO anon, authenticated.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.user_admin_status FROM anon, authenticated;

GRANT SELECT ON TABLE public.user_admin_status TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_admin_status TO service_role;

COMMIT;
