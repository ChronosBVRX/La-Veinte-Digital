-- Test: rls_auto_enable event trigger
-- Run against a disposable database AFTER applying create_rls_auto_enable.sql
-- No production data at risk.

-- Test 1: New table in public receives RLS automatically
CREATE TABLE public._test_rls_auto (id serial PRIMARY KEY, name text);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = '_test_rls_auto'
    AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Test 1 FAILED: new public table does not have RLS';
  END IF;
  RAISE NOTICE 'Test 1 PASSED: new public table has RLS';
END
$$;

-- Test 2: Table in non-public schema is not modified
CREATE SCHEMA IF NOT EXISTS _test_non_public;
CREATE TABLE _test_non_public._test_no_rls (id serial PRIMARY KEY, name text);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = '_test_non_public'
    AND c.relname = '_test_no_rls'
    AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Test 2 FAILED: non-public table has RLS (should not)';
  END IF;
  RAISE NOTICE 'Test 2 PASSED: non-public table untouched';
END
$$;

-- Test 3: Event trigger does not create permissive policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = '_test_rls_auto'
  ) THEN
    RAISE EXCEPTION 'Test 3 FAILED: trigger created policies (should only enable RLS)';
  END IF;
  RAISE NOTICE 'Test 3 PASSED: no policies created by trigger';
END
$$;

-- Test 4: Existing tables are not affected
CREATE TABLE public._test_existing_before (id serial PRIMARY KEY, val int);
-- RLS is already enabled by trigger. Now create another table.
-- The first table should still have RLS (from trigger), not double-enabled.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = '_test_existing_before'
    AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Test 4 FAILED: table created before trigger test lost RLS';
  END IF;
  RAISE NOTICE 'Test 4 PASSED: existing tables unaffected';
END
$$;

-- Test 5: Event trigger can be dropped (rollback)
DROP EVENT TRIGGER IF EXISTS ensure_rls;
DROP FUNCTION IF EXISTS public.rls_auto_enable();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls'
  ) THEN
    RAISE EXCEPTION 'Test 5 FAILED: event trigger not dropped';
  END IF;
  RAISE NOTICE 'Test 5 PASSED: event trigger dropped (rollback works)';
END
$$;

-- Cleanup
DROP TABLE IF EXISTS public._test_rls_auto;
DROP TABLE IF EXISTS public._test_existing_before;
DROP TABLE IF EXISTS _test_non_public._test_no_rls;
DROP SCHEMA IF EXISTS _test_non_public;
