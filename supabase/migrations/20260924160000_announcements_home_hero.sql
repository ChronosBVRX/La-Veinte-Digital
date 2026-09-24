-- ═══════════════════════════════════════════════════════════════════
-- 20260924160000_announcements_home_hero.sql
--
-- Extensión aditiva al sistema editorial de avisos:
-- 1. Agrega la columna `show_in_home_hero` a `public.announcements`
--    para permitir destacar avisos en el carrusel superior de Inicio.
-- 2. Actualiza la restricción `chk_announcement_surface` para incluir
--    la nueva superficie sin romper compatibilidad existente.
-- 3. Crea índice para consultas eficientes de destacados activos.
-- 4. Establece política RLS de mínimo privilegio para trabajadores
--    autenticados que consulten avisos vigentes del hero.
--    (No otorga acceso directo a `anon`; las lecturas públicas se
--     resuelven server-side a través de /api/announcements/hero).
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

-- 4. Política RLS estricta para lectura autenticada de destacados vigentes
-- Permite que los trabajadores autenticados lean exclusivamente los avisos
-- formalmente publicados con fecha vigente y marcados para el hero.
-- `anon` queda excluido de la consulta directa por base de datos; la entrega
-- pública se efectúa exclusivamente vía endpoint server-side protegido.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'announcements'
      AND policyname = 'announcements_read_published_hero'
  ) THEN
    CREATE POLICY "announcements_read_published_hero"
      ON public.announcements FOR SELECT
      TO authenticated
      USING (
        status = 'PUBLISHED'
        AND show_in_home_hero = true
        AND (publish_at IS NULL OR publish_at <= now())
        AND (expires_at IS NULL OR expires_at > now())
      );
  END IF;
END $$;

COMMIT;
