-- ═══════════════════════════════════════════════════════════════════
-- 20260906140000_admin_announcements_campaigns.sql
--
-- Panel de administración editorial:
-- 1. announcements (comunicados, tips y herramientas)
-- 2. announcement_reads (lecturas idempotentes por usuario)
-- 3. notification_preferences (preferencias de push de comunicados)
-- 4. push_campaigns (campañas push duraderas con snapshot inmutable)
-- 5. push_campaign_deliveries (entregas individuales con claim transaccional)
-- 6. admin_audit_log (registro append-only de acciones administrativas)
-- 7. notification_job_runs (bitácora de ejecuciones de cron)
-- 8. Funciones RPC transaccionales y políticas RLS estrictas
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Tabla: announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'announcement' CHECK (kind IN ('announcement', 'tip', 'tool')),
  title text NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 100),
  push_summary text CHECK (push_summary IS NULL OR char_length(push_summary) <= 200),
  body text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 5000),
  bar_text text CHECK (bar_text IS NULL OR char_length(bar_text) <= 120),
  destination_path text CHECK (destination_path IS NULL OR char_length(destination_path) <= 2048),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
  show_in_inbox boolean NOT NULL DEFAULT true,
  show_in_bar boolean NOT NULL DEFAULT false,
  publish_at timestamptz,
  expires_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  source_document text,
  source_reference text,
  source_version text,
  source_page text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_announcement_surface CHECK (show_in_inbox = true OR show_in_bar = true),
  CONSTRAINT chk_announcement_dates CHECK (expires_at IS NULL OR publish_at IS NULL OR expires_at > publish_at)
);

CREATE INDEX IF NOT EXISTS announcements_status_idx ON public.announcements(status, publish_at DESC);
CREATE INDEX IF NOT EXISTS announcements_bar_idx ON public.announcements(show_in_bar, status);
CREATE INDEX IF NOT EXISTS announcements_created_by_idx ON public.announcements(created_by);

-- 2. Tabla: announcement_reads
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS announcement_reads_user_idx ON public.announcement_reads(user_id);

-- 3. Tabla: notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  announcements_push_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Secuencia y Tabla: push_campaigns
CREATE SEQUENCE IF NOT EXISTS public.push_campaign_notification_id_seq AS integer MINVALUE 1000 START WITH 1000;

CREATE TABLE IF NOT EXISTS public.push_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE SET NULL,
  announcement_revision integer NOT NULL DEFAULT 1,
  purpose text NOT NULL CHECK (purpose IN ('TEST', 'LIVE')),
  snapshot_title text NOT NULL CHECK (char_length(snapshot_title) <= 200),
  snapshot_body text NOT NULL CHECK (char_length(snapshot_body) <= 500),
  snapshot_destination text CHECK (snapshot_destination IS NULL OR char_length(snapshot_destination) <= 2048),
  snapshot_type text NOT NULL DEFAULT 'GENERAL' CHECK (snapshot_type IN ('GENERAL', 'IMPORTANT_ALERT', 'AGENDA', 'DOCUMENT', 'UPDATE')),
  audience text NOT NULL CHECK (audience IN ('ALL', 'SELF')),
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'PAUSED', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED', 'NEEDS_REVIEW')),
  scheduled_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key text UNIQUE,
  notification_id integer NOT NULL UNIQUE DEFAULT nextval('public.push_campaign_notification_id_seq'),
  target_accounts integer NOT NULL DEFAULT 0,
  target_devices integer NOT NULL DEFAULT 0,
  accepted_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  invalid_tokens_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  unknown_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_campaigns_status_idx ON public.push_campaigns(status, scheduled_at);
CREATE INDEX IF NOT EXISTS push_campaigns_announcement_idx ON public.push_campaigns(announcement_id);

-- 5. Tabla: push_campaign_deliveries
CREATE TABLE IF NOT EXISTS public.push_campaign_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.push_campaigns(id) ON DELETE CASCADE,
  snapshot_device_id uuid NOT NULL,
  device_id uuid REFERENCES public.push_devices(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'ACCEPTED', 'RETRY_PENDING', 'FAILED', 'INVALID', 'SKIPPED', 'UNKNOWN')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  lease_until timestamptz,
  claim_token text,
  error_code text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_campaign_snapshot_device UNIQUE (campaign_id, snapshot_device_id)
);

CREATE INDEX IF NOT EXISTS pcd_claim_idx ON public.push_campaign_deliveries(status, next_attempt_at, lease_until);
CREATE INDEX IF NOT EXISTS pcd_campaign_status_idx ON public.push_campaign_deliveries(campaign_id, status);
CREATE INDEX IF NOT EXISTS pcd_user_idx ON public.push_campaign_deliveries(user_id);

-- 6. Tabla: admin_audit_log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx ON public.admin_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx ON public.admin_audit_log(entity_type, entity_id);

-- 7. Tabla: notification_job_runs
CREATE TABLE IF NOT EXISTS public.notification_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_kind text NOT NULL DEFAULT 'push_campaigns_cron',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')),
  processed_campaigns integer NOT NULL DEFAULT 0,
  processed_deliveries integer NOT NULL DEFAULT 0,
  error_code text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_job_runs_started_idx ON public.notification_job_runs(job_kind, started_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- SEGURIDAD RLS (Row Level Security)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_campaign_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_job_runs ENABLE ROW LEVEL SECURITY;

-- Helper privado para checar si el usuario autenticado tiene rol admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Políticas announcements:
-- 1) Los trabajadores leen avisos PUBLISHED visibles en bandeja
CREATE POLICY "announcements_read_published"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (
    status = 'PUBLISHED'
    AND show_in_inbox = true
    AND (publish_at IS NULL OR publish_at <= now())
  );

-- 2) Admins tienen SELECT total
CREATE POLICY "announcements_admin_select"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- 3) Admins pueden insertar
CREATE POLICY "announcements_admin_insert"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());

-- 4) Admins pueden actualizar
CREATE POLICY "announcements_admin_update"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Políticas announcement_reads:
CREATE POLICY "announcement_reads_select_own"
  ON public.announcement_reads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "announcement_reads_insert_own"
  ON public.announcement_reads FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.announcements
      WHERE id = announcement_id
        AND status = 'PUBLISHED'
        AND show_in_inbox = true
    )
  );

CREATE POLICY "announcement_reads_update_own"
  ON public.announcement_reads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.announcements
      WHERE id = announcement_id
        AND status = 'PUBLISHED'
        AND show_in_inbox = true
    )
  );

CREATE POLICY "announcement_reads_delete_own"
  ON public.announcement_reads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Políticas notification_preferences:
CREATE POLICY "notification_preferences_select_own"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notification_preferences_insert_own"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_preferences_update_own"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Políticas push_campaigns (Solo admin / service_role):
CREATE POLICY "push_campaigns_admin_all"
  ON public.push_campaigns FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Políticas push_campaign_deliveries (Solo admin / service_role):
CREATE POLICY "pcd_admin_all"
  ON public.push_campaign_deliveries FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Políticas admin_audit_log (Solo admin lectura; inserción append-only admin o service_role):
CREATE POLICY "admin_audit_log_select"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "admin_audit_log_insert"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());

-- Políticas notification_job_runs (Solo admin lectura):
CREATE POLICY "notification_job_runs_select"
  ON public.notification_job_runs FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- ═══════════════════════════════════════════════════════════════════
-- RPCs TRANSACCIONALES
-- ═══════════════════════════════════════════════════════════════════

-- Reclamo atómico de lote de entregas para campaign worker (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_campaign_deliveries(
  p_campaign_id uuid,
  p_batch_limit integer,
  p_claim_token text,
  p_lease_until timestamptz
) RETURNS TABLE (
  id uuid,
  fcm_token text,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH available AS (
    SELECT pcd.id
    FROM public.push_campaign_deliveries pcd
    WHERE pcd.campaign_id = p_campaign_id
      AND (
        (pcd.status = 'PENDING' AND (pcd.lease_until IS NULL OR pcd.lease_until < now()))
        OR
        (pcd.status = 'RETRY_PENDING' AND (pcd.next_attempt_at IS NULL OR pcd.next_attempt_at <= now()) AND (pcd.lease_until IS NULL OR pcd.lease_until < now()))
      )
    ORDER BY pcd.created_at ASC
    LIMIT p_batch_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.push_campaign_deliveries pcd
  SET status = 'PROCESSING',
      lease_until = p_lease_until,
      claim_token = p_claim_token,
      updated_at = now()
  FROM available
  WHERE pcd.id = available.id
  RETURNING pcd.id, pcd.fcm_token, pcd.attempts;
END;
$$;

-- Archivar anuncio y cancelar transaccionalmente entregas pendientes
CREATE OR REPLACE FUNCTION public.archive_announcement_atomic(
  p_announcement_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;

  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_uid;
  IF NOT coalesce(v_is_admin, false) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  -- 1. Actualizar anuncio
  UPDATE public.announcements
  SET status = 'ARCHIVED',
      updated_by = v_uid,
      updated_at = now()
  WHERE id = p_announcement_id;

  -- 2. Cancelar campañas asociadas encoladas o pausadas
  UPDATE public.push_campaigns
  SET status = 'CANCELLED',
      updated_at = now()
  WHERE announcement_id = p_announcement_id
    AND status IN ('QUEUED', 'PROCESSING', 'PAUSED');

  -- 3. Omitir entregas pendientes o en reintento
  UPDATE public.push_campaign_deliveries
  SET status = 'SKIPPED',
      error_code = 'ANNOUNCEMENT_ARCHIVED',
      lease_until = NULL,
      claim_token = NULL,
      updated_at = now()
  WHERE campaign_id IN (
    SELECT id FROM public.push_campaigns WHERE announcement_id = p_announcement_id
  )
  AND status IN ('PENDING', 'RETRY_PENDING', 'PROCESSING');
END;
$$;

COMMIT;
