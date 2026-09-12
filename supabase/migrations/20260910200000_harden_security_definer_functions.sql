-- Migration: 20260910200000_harden_security_definer_functions.sql
-- Harden SECURITY DEFINER functions: explicitly fix search_path to prevent
-- search_path hijacking and revoke unneeded public execute privileges on trigger functions.

BEGIN;

-- 1. Redefinir clean_commitment_reminders_on_update con search_path seguro
CREATE OR REPLACE FUNCTION public.clean_commitment_reminders_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 2. Revocar privilegios de ejecución directa en la función de trigger (solo debe ser invocada por el motor de triggers)
REVOKE ALL ON FUNCTION public.clean_commitment_reminders_on_update() FROM PUBLIC, anon, authenticated;

COMMIT;
