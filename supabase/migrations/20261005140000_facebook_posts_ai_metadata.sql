-- ═══════════════════════════════════════════════════════════════════
-- 20261005140000_facebook_posts_ai_metadata.sql
--
-- Enriquecimiento de publicaciones de Facebook mediante IA local (Ollama Qwen):
-- - category: Categoría sindical (Deportes y Cultura, Previsión Social, etc.)
-- - summary: Resumen institucional en una oración
-- - tags: Etiquetas temáticas
-- - ai_processed: Bandera para procesar en segundo plano sin reprocesar
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.facebook_posts
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_processed boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS facebook_posts_category_idx
  ON public.facebook_posts (category) WHERE is_visible = true;
