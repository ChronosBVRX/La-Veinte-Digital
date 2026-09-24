-- ═══════════════════════════════════════════════════════════════════
-- 20260924160000_announcements_home_hero.sql
--
-- Extensión aditiva al sistema editorial de avisos:
-- 1. Agrega la columna `show_in_home_hero` a `public.announcements`
--    para permitir destacar avisos en el carrusel superior de Inicio.
-- 2. Actualiza la restricción `chk_announcement_surface` para incluir
--    la nueva superficie sin romper compatibilidad existente.
-- 3. Crea índice para consultas eficientes de destacados activos.
-- 4. Otorga permisos explícitos (GRANT) y actualiza políticas RLS
--    para permitir lectura de avisos publicados en el carrusel de Inicio.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Agregar columna show_in_home_hero
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS show_in_home_hero boolean NOT NULL DEFAULT false;

-- 2. Actualizar restricción de superficie de visibilidad
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS chk_announcement_surface;

ALTER TABLE public.announcements
  ADD CONSTRAINT chk_announcement_surface
  CHECK (show_in_inbox = true OR show_in_bar = true OR show_in_home_hero = true);

-- 3. Índice para acelerar la consulta de destacados del Inicio
CREATE INDEX IF NOT EXISTS announcements_home_hero_idx
  ON public.announcements(show_in_home_hero, status);

-- 4. Política de lectura pública/autenticada para destacados publicados del Inicio
-- Permite que tanto trabajadores autenticados como clientes anónimos (si acceden vía API)
-- lean los avisos que estén formalmente publicados con fecha vigente y marcados para el hero.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'announcements'
      AND policyname = 'announcements_read_published_hero'
  ) THEN
    CREATE POLICY "announcements_read_published_hero"
      ON public.announcements FOR SELECT
      TO authenticated, anon
      USING (
        status = 'PUBLISHED'
        AND show_in_home_hero = true
        AND (publish_at IS NULL OR publish_at <= now())
        AND (expires_at IS NULL OR expires_at > now())
      );
  END IF;
END $$;

-- 5. Privilegios explícitos de acceso (GRANTs requeridos)
GRANT SELECT ON public.announcements TO authenticated, anon;

COMMIT;
