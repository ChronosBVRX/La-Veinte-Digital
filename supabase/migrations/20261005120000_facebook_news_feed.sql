-- ═══════════════════════════════════════════════════════════════════
-- 20261005120000_facebook_news_feed.sql
--
-- Feed nativo de noticias SNTSS (Sección XX Michoacán y CEN Nacional):
-- 1. Crea la tabla `public.facebook_posts` para almacenar publicaciones
--    extraídas de las páginas oficiales de Facebook del SNTSS.
-- 2. Habilita RLS estricto: lectura de posts visibles para usuarios
--    autenticados; escritura reservada a service_role (worker/cron).
-- 3. Configura el bucket público `facebook-media` en Supabase Storage
--    para persistir las imágenes de cada publicación y evitar que
--    caduquen las firmas temporales (`oe=...`) de `fbcdn.net`.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.facebook_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL CHECK (page_key IN ('seccionxx', 'cen')),
  page_name text NOT NULL,
  external_post_id text NOT NULL,
  permalink_url text NOT NULL,
  content_text text NOT NULL DEFAULT '',
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  raw_metadata jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facebook_posts_page_external_unique UNIQUE (page_key, external_post_id)
);

CREATE INDEX IF NOT EXISTS facebook_posts_feed_idx
  ON public.facebook_posts (is_visible, published_at DESC);

CREATE INDEX IF NOT EXISTS facebook_posts_page_feed_idx
  ON public.facebook_posts (page_key, is_visible, published_at DESC);

ALTER TABLE public.facebook_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'facebook_posts'
      AND policyname = 'facebook_posts_read_visible'
  ) THEN
    CREATE POLICY "facebook_posts_read_visible"
      ON public.facebook_posts FOR SELECT
      TO authenticated
      USING (is_visible = true);
  END IF;
END $$;

-- Bucket público para imágenes de noticias sincronizadas desde Facebook
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'facebook-media',
  'facebook-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'facebook_media_public_read'
  ) THEN
    CREATE POLICY "facebook_media_public_read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'facebook-media');
  END IF;
END $$;

GRANT SELECT ON public.facebook_posts TO anon, authenticated;
GRANT ALL ON public.facebook_posts TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
