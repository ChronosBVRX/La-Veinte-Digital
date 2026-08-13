-- 019: limpieza de tablas retiradas (chat social y foro)
--
-- El chat social (/chat) y el foro (/foro) están retirados de la plataforma.
-- Sus tablas quedaron huérfanas tras la reorganización del historial de
-- migraciones. Esta migración las elimina de forma idempotente (IF EXISTS).
--
-- El asistente IA sigue activo: `ai_chat_history` NO se elimina.

DROP TABLE IF EXISTS public.forum_comments CASCADE;
DROP TABLE IF EXISTS public.forum_posts CASCADE;
DROP TABLE IF EXISTS public.forum_categories CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_participants CASCADE;
DROP TABLE IF EXISTS public.chat_room_invitations CASCADE;
DROP TABLE IF EXISTS public.chat_rooms CASCADE;

DROP FUNCTION IF EXISTS public.is_chat_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_chat_invited(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_chat_participant(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_chat_room_visible(uuid, uuid) CASCADE;
