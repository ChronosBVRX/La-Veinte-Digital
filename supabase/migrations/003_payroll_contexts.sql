-- Payroll Context Schema
-- Requires: auth.users, public.profiles
--
-- Contexto de nómina del trabajador: fuente única de verdad para el
-- prerrelleno normativo de calculadoras (categoría, antigüedad efectiva,
-- jornada, condiciones ocupacionales y evidencia de conceptos recurrentes).
-- Es una fila por usuario (user_id es la llave); el contenido se sincroniza
-- localmente con consentimiento explícito.

-- 1. Payroll contexts (one row per user)
CREATE TABLE IF NOT EXISTS public.payroll_contexts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id TEXT,
  category_code TEXT,
  category_name TEXT,
  workday_hours NUMERIC(4, 1),
  employment_type TEXT,
  effective_seniority_date DATE,
  occupational_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  payroll_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  recurring_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  siap_concept_marks JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payroll_contexts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only see, insert, and update their own context
CREATE POLICY "Users can read own payroll context"
  ON public.payroll_contexts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own payroll context"
  ON public.payroll_contexts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own payroll context"
  ON public.payroll_contexts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all contexts (optional — uncomment if needed)
-- CREATE POLICY "Admins can read all payroll contexts"
--   ON public.payroll_contexts FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
--   );
