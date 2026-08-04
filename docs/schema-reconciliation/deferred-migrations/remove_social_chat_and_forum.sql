-- DEFERRED CANDIDATE. Do not execute before baseline approval and frontend rollout.
-- Remove the retired social features after their frontend routes have been removed.
-- Every DROP uses RESTRICT (the default) after known dependencies are removed so
-- unexpected production dependencies stop the migration instead of being cascaded.

-- chat_messages: detach it from Realtime before dropping the relation.
DO $$
BEGIN
  IF to_regclass('public.chat_messages') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_catalog.pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'chat_messages'
     ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_messages;
  END IF;
END
$$;

-- Chat/forum policies: remove every policy, including legacy names and drifted
-- additions, before dropping helper functions and tables that policy expressions
-- may reference.
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'chat_messages',
        'chat_room_invitations',
        'chat_participants',
        'chat_rooms',
        'forum_comments',
        'forum_posts',
        'forum_categories'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  END LOOP;
END
$$;

-- is_chat_room_visible: depends on chat rooms and participant/admin helpers.
DROP FUNCTION IF EXISTS public.is_chat_room_visible(uuid, uuid) RESTRICT;

-- is_chat_invited: depends on chat room invitations.
DROP FUNCTION IF EXISTS public.is_chat_invited(uuid, uuid) RESTRICT;

-- is_chat_participant: depends on chat participants.
DROP FUNCTION IF EXISTS public.is_chat_participant(uuid, uuid) RESTRICT;

-- is_chat_admin: legacy role-based chat authorization is no longer used.
DROP FUNCTION IF EXISTS public.is_chat_admin(uuid) RESTRICT;

-- chat_messages: child of chat_rooms and profiles.
DROP TABLE IF EXISTS public.chat_messages RESTRICT;

-- chat_room_invitations: child of chat_rooms and profiles.
DROP TABLE IF EXISTS public.chat_room_invitations RESTRICT;

-- chat_participants: child of chat_rooms and profiles.
DROP TABLE IF EXISTS public.chat_participants RESTRICT;

-- chat_rooms: parent chat relation, dropped after every chat child.
DROP TABLE IF EXISTS public.chat_rooms RESTRICT;

-- forum_comments: self-referencing child of forum_posts and profiles.
DROP TABLE IF EXISTS public.forum_comments RESTRICT;

-- forum_posts: child of forum_categories and profiles.
DROP TABLE IF EXISTS public.forum_posts RESTRICT;

-- forum_categories: parent forum relation, dropped after every forum child.
DROP TABLE IF EXISTS public.forum_categories RESTRICT;

-- limited_profiles: social-only projection; no remaining feature consumes it.
DROP VIEW IF EXISTS public.limited_profiles RESTRICT;

-- profiles.is_online: fail closed if schema drift introduced any dependency that
-- was not visible in the repository-wide usage review.
DO $$
DECLARE
  v_profiles regclass := to_regclass('public.profiles');
  v_attnum smallint;
  v_dependencies text;
BEGIN
  IF v_profiles IS NULL THEN
    RETURN;
  END IF;

  SELECT attnum
    INTO v_attnum
    FROM pg_catalog.pg_attribute
   WHERE attrelid = v_profiles
     AND attname = 'is_online'
     AND NOT attisdropped;

  IF v_attnum IS NULL THEN
    RETURN;
  END IF;

  SELECT string_agg(
           pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid),
           ', '
         )
    INTO v_dependencies
    FROM pg_catalog.pg_depend AS d
   WHERE d.refclassid = 'pg_catalog.pg_class'::regclass
     AND d.refobjid = v_profiles
     AND d.refobjsubid = v_attnum
     AND d.deptype NOT IN ('a', 'i');

  IF v_dependencies IS NOT NULL THEN
    RAISE EXCEPTION
      'Refusing to drop public.profiles.is_online; dependent objects remain: %',
      v_dependencies;
  END IF;
END
$$;

-- profiles.is_online: social presence flag, removed only after the dependency guard.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_online RESTRICT;
