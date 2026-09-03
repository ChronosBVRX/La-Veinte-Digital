-- 20260903210000_vacation_calendar_role_rules.sql
-- Reglas de roles para calendarios anuales de vacaciones (Roles A y B),
-- obligatoriedad de fecha de término (end_date) antes de publicación,
-- y control administrativo estricto.

-- 1. Agregar columnas end_date y role_group a vacation_calendar_roles
ALTER TABLE public.vacation_calendar_roles
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS role_group TEXT DEFAULT 'GENERAL';

-- 2. Constraints de validación de fechas y grupos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vacation_calendar_roles_date_check'
  ) THEN
    ALTER TABLE public.vacation_calendar_roles
      ADD CONSTRAINT vacation_calendar_roles_date_check
      CHECK (end_date IS NULL OR end_date >= start_date);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vacation_calendar_roles_group_check'
  ) THEN
    ALTER TABLE public.vacation_calendar_roles
      ADD CONSTRAINT vacation_calendar_roles_group_check
      CHECK (role_group IN ('A', 'B', 'GENERAL'));
  END IF;
END $$;

-- 3. Trigger que impide publicar cualquier calendario que no tenga fechas de término en todos sus roles
CREATE OR REPLACE FUNCTION public.check_vacation_calendar_publishable()
RETURNS TRIGGER AS $$
DECLARE
  v_role_count INTEGER;
  v_missing_end_dates INTEGER;
BEGIN
  IF NEW.status = 'PUBLISHED' THEN
    SELECT count(*), count(*) FILTER (WHERE end_date IS NULL)
    INTO v_role_count, v_missing_end_dates
    FROM public.vacation_calendar_roles
    WHERE calendar_id = NEW.id AND enabled = true;

    IF v_role_count = 0 THEN
      RAISE EXCEPTION 'cannot_publish_empty_calendar: el calendario debe contener roles antes de ser publicado';
    END IF;

    IF v_missing_end_dates > 0 THEN
      RAISE EXCEPTION 'cannot_publish_calendar_without_end_dates: todos los roles habilitados deben tener fecha de término definida';
    END IF;

    IF NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_vacation_calendar_publishable ON public.vacation_calendars;
CREATE TRIGGER trg_check_vacation_calendar_publishable
  BEFORE INSERT OR UPDATE OF status ON public.vacation_calendars
  FOR EACH ROW
  EXECUTE FUNCTION public.check_vacation_calendar_publishable();

-- 4. RPC para publicar calendario con validación de rol de administrador
CREATE OR REPLACE FUNCTION public.publish_vacation_calendar(p_calendar_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN := false;
  v_cal RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT (role = 'admin') INTO v_is_admin
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'forbidden: solo administradores pueden publicar calendarios';
  END IF;

  SELECT * INTO v_cal FROM public.vacation_calendars WHERE id = p_calendar_id;
  IF v_cal.id IS NULL THEN
    RAISE EXCEPTION 'not_found: calendario no encontrado';
  END IF;

  UPDATE public.vacation_calendars
  SET status = 'PUBLISHED',
      published_at = now(),
      updated_at = now()
  WHERE id = p_calendar_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_calendar_id,
    'status', 'PUBLISHED',
    'publishedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_vacation_calendar(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.publish_vacation_calendar(UUID) TO authenticated;
