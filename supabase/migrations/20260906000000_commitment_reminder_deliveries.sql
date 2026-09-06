-- ═══════════════════════════════════════════════════════════════════
-- commitment_reminder_deliveries — Registro idempotente de recordatorios de agenda
--
-- Reglas de diseño:
-- - Un registro por cada recordatorio entregado por compromiso y tipo
--   (DAY_BEFORE, HOURS_BEFORE, AT_START).
-- - Garantía de unicidad estricta para evitar dobles envíos en crons / reintentos.
-- - RLS habilitado: cada usuario solo ve sus propios recordatorios entregados.
-- - El envío y registro se efectúa desde el backend / service_role.
-- - Trigger defensivo: cuando un compromiso se cancela o completa, o cambia su horario,
--   se limpian los registros de entrega pendientes para permitir reprogramación limpia.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.commitment_reminder_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL REFERENCES public.worker_commitments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('DAY_BEFORE', 'HOURS_BEFORE', 'AT_START')),
  scheduled_for timestamptz NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS commitment_reminder_deliveries_unique_idx
  ON public.commitment_reminder_deliveries(commitment_id, reminder_type);

CREATE INDEX IF NOT EXISTS commitment_reminder_deliveries_user_idx
  ON public.commitment_reminder_deliveries(user_id);

CREATE INDEX IF NOT EXISTS commitment_reminder_deliveries_scheduled_idx
  ON public.commitment_reminder_deliveries(scheduled_for);

-- RLS
ALTER TABLE public.commitment_reminder_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commitment_reminder_deliveries_select_own" ON public.commitment_reminder_deliveries;
CREATE POLICY "commitment_reminder_deliveries_select_own"
  ON public.commitment_reminder_deliveries FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger para recalcular o descartar recordatorios ante cambios del compromiso
CREATE OR REPLACE FUNCTION public.clean_commitment_reminders_on_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.start_at IS DISTINCT FROM NEW.start_at OR OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('cancelled', 'completed') THEN
      DELETE FROM public.commitment_reminder_deliveries WHERE commitment_id = NEW.id;
    ELSIF OLD.start_at IS DISTINCT FROM NEW.start_at THEN
      -- Horario modificado: eliminar entregas previas para que el nuevo horario sea programado
      DELETE FROM public.commitment_reminder_deliveries WHERE commitment_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_clean_commitment_reminders ON public.worker_commitments;
CREATE TRIGGER trg_clean_commitment_reminders
  AFTER UPDATE ON public.worker_commitments
  FOR EACH ROW
  EXECUTE FUNCTION public.clean_commitment_reminders_on_update();
