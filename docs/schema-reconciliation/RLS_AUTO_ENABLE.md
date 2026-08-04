# Unversioned `rls_auto_enable`

## Catalog Evidence

| Property | Remote value |
| --- | --- |
| Schema/name | `public.rls_auto_enable()` |
| Owner | `postgres` |
| Return type | `event_trigger` |
| Security | `SECURITY DEFINER` |
| Search path | `pg_catalog` |
| Event trigger | `ensure_rls` |
| Event | `ddl_command_end` |
| Tags | `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO` |
| Enabled | yes (`O`) |

The function loops over `pg_event_trigger_ddl_commands()` and enables RLS on
new tables or partitioned tables in `public`. It logs and continues on errors.
It does not create policies and does not force RLS.

## Grants

The catalog reports EXECUTE for PUBLIC, `anon`, `authenticated`, `postgres`, and
`service_role`. Although an event-trigger function is not a normal RPC return
type, these grants are broader than necessary and should be reviewed in the
future convergence migration.

## Provenance

No local migration contains `rls_auto_enable` or `ensure_rls`, and none of the
eight remote ledger rows records it. PostgreSQL does not retain a general object
creation timestamp, so its creation date cannot be established from the catalog.
It predates this 2026-08-03 inventory and is currently unversioned.

## Objects Modified

The function can alter any newly created `public` table by enabling RLS. The
catalog does not retain a reliable list of historical invocations. All current
remote public base tables have RLS enabled, but that fact alone cannot prove
which were modified by this trigger.

No removal or modification was performed.
