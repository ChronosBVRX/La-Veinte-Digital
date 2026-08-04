-- rls_auto_enable: event trigger that auto-enables RLS on new public tables.
-- Deferred migration — do NOT apply to supabase/migrations/ yet.
-- Test in a disposable database before promoting.

BEGIN;

-- Function
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL
        AND cmd.schema_name IN ('public')
        AND cmd.schema_name NOT IN ('pg_catalog','information_schema')
        AND cmd.schema_name NOT LIKE 'pg_toast%'
        AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security',
                       cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %',
                     cmd.object_identity;
      END;
     ELSE
       RAISE LOG 'rls_auto_enable: skip %', cmd.object_identity;
     END IF;
  END LOOP;
END;
$function$;

-- Event trigger
DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION rls_auto_enable();

-- Verify
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls'
  ) THEN
    RAISE EXCEPTION 'rls_auto_enable: event trigger not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable'
      AND prosecdef = true
  ) THEN
    RAISE EXCEPTION 'rls_auto_enable: function not found or not SECURITY DEFINER';
  END IF;

  RAISE NOTICE 'rls_auto_enable: created successfully';
END
$$;

COMMIT;
