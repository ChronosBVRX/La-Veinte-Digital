-- worker_commitments — tabla de agenda/bitácora (fuente de verdad).
-- Se creó out-of-band en el proyecto real y NO estaba versionada en migraciones, por lo que
-- `supabase db reset` (CI) no podía reconstruir la base desde cero. Este archivo la declara
-- explícitamente (IF NOT EXISTS → no-op en el proyecto donde ya existe) para que el replay
-- local sea consistente.
--
-- El esquema se obtuvo por introspección del proyecto real ragktminwduiggvaoeix.

CREATE TABLE IF NOT EXISTS public.worker_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  workplace text,
  service text,
  substitute_worker_name text,
  notes text,
  reminder_day_before boolean NOT NULL DEFAULT true,
  reminder_hours_before boolean NOT NULL DEFAULT true,
  reminder_at_start boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  legacy_local_id text
);

CREATE INDEX IF NOT EXISTS worker_commitments_user_idx ON public.worker_commitments(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS worker_commitments_user_legacy_idx ON public.worker_commitments(user_id, legacy_local_id);

ALTER TABLE public.worker_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worker_commitments_select" ON public.worker_commitments;
CREATE POLICY "worker_commitments_select" ON public.worker_commitments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "worker_commitments_insert" ON public.worker_commitments;
CREATE POLICY "worker_commitments_insert" ON public.worker_commitments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "worker_commitments_update" ON public.worker_commitments;
CREATE POLICY "worker_commitments_update" ON public.worker_commitments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "worker_commitments_delete" ON public.worker_commitments;
CREATE POLICY "worker_commitments_delete" ON public.worker_commitments
  FOR DELETE USING (auth.uid() = user_id);
