# RLS Auto-Enable Analysis

Captured: 2026-08-04.

## Definition

```sql
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
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public')
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
```

## Event Trigger

```sql
CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION rls_auto_enable();
```

- **Name**: ensure_rls
- **Event**: ddl_command_end
- **Enabled**: O (origin)
- **Tags**: CREATE TABLE, CREATE TABLE AS, SELECT INTO

## Type

Event trigger function (not a regular function, not a trigger function).
Fires after DDL commands that create tables in the `public` schema.

## Owner

Created by `postgres` (superuser). SECURITY DEFINER means it executes as
the function owner regardless of who invokes it.

## Security Properties

- **SECURITY DEFINER**: yes — runs as the owner (postgres)
- **search_path**: `pg_catalog` — prevents search_path injection
- **Error handling**: EXCEPTION block catches failures and logs them
- **Scope**: only `public` schema, excludes pg_catalog, information_schema,
  pg_toast, pg_temp

## Behavior

When any CREATE TABLE, CREATE TABLE AS, or SELECT INTO statement completes
in the `public` schema, this function automatically runs:

```sql
ALTER TABLE <new_table> ENABLE ROW LEVEL SECURITY;
```

This ensures every new table in `public` has RLS enabled by default.

## Tables Affected (current)

All 23 tables in `public` have `relrowsecurity = true`. This is consistent
with the event trigger being active.

## Local Equivalente

**No existe localmente.** La base local no tiene este event trigger.
RLS se habilita manualmente en cada migración (`ALTER TABLE ... ENABLE
ROW LEVEL SECURITY`).

## Risk Analysis

### Risk of keeping it

- **Low-medium**: The function is well-scoped (public schema only) and
  has proper error handling. It only enables RLS — it does not create
  policies, grants, or other security objects.
- **Potential issue**: If a migration creates a table and then immediately
  tries to INSERT data, RLS being enabled could block the insert if no
  policy exists yet. This is a known pattern that requires careful ordering.

### Risk of removing it

- **High**: Removing it would mean new tables created via dashboard or
  SQL editor would NOT have RLS enabled by default, creating security
  gaps.
- **Mitigation**: If removed, all new tables must manually include
  `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in their migration.

### Recommendation

**Keep it.** The function is a safety net. Local migrations should
continue to explicitly enable RLS for clarity, but the event trigger
provides defense-in-depth for tables created outside the migration system
(dashboard, SQL editor, etc.).

When creating the local equivalent, add to a new migration:

```sql
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
-- (exact copy of remote function)
$function$;

CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION rls_auto_enable();
```
