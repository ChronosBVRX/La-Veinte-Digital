-- Bitácora Module Schema
-- Requires: auth.users, public.profiles

-- 1. Bitácora entries (logbook)
CREATE TABLE IF NOT EXISTS public.bitacora_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bitacora_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only see, insert, and delete their own entries
CREATE POLICY "Users can read own bitacora entries"
  ON public.bitacora_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own bitacora entries"
  ON public.bitacora_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own bitacora entries"
  ON public.bitacora_entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all entries (optional — uncomment if needed)
-- CREATE POLICY "Admins can read all bitacora entries"
--   ON public.bitacora_entries FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
--   );
