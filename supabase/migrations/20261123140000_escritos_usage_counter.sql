-- 20261123140000_escritos_usage_counter.sql
-- Contador y registro anónimo de uso del Creador de Escritos.
--
-- Privacidad por diseño:
-- NO guarda el contenido del escrito, ni borradores, ni datos personales,
-- ni destinatarios, ni hechos. Únicamente registra el evento atómico
-- de generación para métricas reales de impacto y uso comunitario.

CREATE TABLE IF NOT EXISTS public.escritos_generations_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo_escrito TEXT DEFAULT 'general',
  modo TEXT DEFAULT 'ia',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escritos_generations_user_id ON public.escritos_generations_log (user_id);
CREATE INDEX IF NOT EXISTS idx_escritos_generations_created_at ON public.escritos_generations_log (created_at DESC);

ALTER TABLE public.escritos_generations_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can log generation" ON public.escritos_generations_log;
CREATE POLICY "Authenticated users can log generation"
  ON public.escritos_generations_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can read own generation log" ON public.escritos_generations_log;
CREATE POLICY "Users can read own generation log"
  ON public.escritos_generations_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.escritos_generations_log TO authenticated;
GRANT ALL ON public.escritos_generations_log TO service_role;

-- Función segura para consultar estadísticas agregadas reales sin exponer filas
CREATE OR REPLACE FUNCTION public.get_escritos_stats()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_generados', (SELECT count(*)::int FROM public.escritos_generations_log),
    'total_companeros', (SELECT count(DISTINCT user_id)::int FROM public.escritos_generations_log WHERE user_id IS NOT NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.get_escritos_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_escritos_stats() TO anon, authenticated, service_role;

-- Función para registrar una generación de escrito de forma atómica y devolver estadísticas actualizadas
CREATE OR REPLACE FUNCTION public.log_escrito_generation(
  p_tipo_escrito TEXT DEFAULT 'general',
  p_modo TEXT DEFAULT 'ia',
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_id BIGINT;
BEGIN
  INSERT INTO public.escritos_generations_log (user_id, tipo_escrito, modo)
  VALUES (v_uid, COALESCE(NULLIF(trim(p_tipo_escrito), ''), 'general'), COALESCE(NULLIF(trim(p_modo), ''), 'ia'))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'total_generados', (SELECT count(*)::int FROM public.escritos_generations_log),
    'total_companeros', (SELECT count(DISTINCT user_id)::int FROM public.escritos_generations_log WHERE user_id IS NOT NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_escrito_generation(TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_escrito_generation(TEXT, TEXT, UUID) TO authenticated, service_role;
