# Migration Ledger Comparison

Captured read-only on 2026-08-03 with Supabase CLI `2.110.0`.

## Summary

The remote ledger contains only version `014` and seven timestamped versions.
Versions `001` through `013` are absent remotely even though many of their
effects are visible in the remote catalog. Version `014` is especially
important: the remote row stores zero SQL statements, while the local file has
a non-empty tarjeton hardening migration. Equal version names therefore do not
mean equal migration contents.

The seven remote rows retain their original SQL in the `statements` column.
Their exact source is recoverable; no inferred no-op placeholder is acceptable.

## Comparison

| Version | Local active file | Remote | State | Equivalence | Evidence |
| --- | --- | --- | --- | --- | --- |
| `001` | `001_vacation_schema.sql` | no | local only | unknown | Vacation objects exist remotely, but the ledger does not prove this exact file ran. |
| `002` | `002_bitacora_schema.sql` | no | local only | unknown | Bitacora objects exist remotely; exact historical SQL is unrecorded. |
| `003` | `003_payroll_contexts.sql` | no | local only | unknown | Payroll context exists remotely with later changes. |
| `004` | `004_imported_payslips.sql` | no | local only | unknown | Payslip tables/functions exist remotely with later wrappers. |
| `005` | `005_api_usage_log.sql` | no | local only | probable, not confirmed | Table and RPC exist; exact execution history is absent. |
| `006` | `006_profiles_lifecycle.sql` | no | local only | unknown | Remote profile lifecycle resembles the file but includes unversioned state. |
| `007` | `007_base_schema.sql` | no | local only | not equivalent to remote | It omits `catalogo_categorias` and `search_catalogo`; remote also lacks the category table but retains the function. |
| `008` | `008_seed_2027_and_validate.sql` | no | local only | unknown | Schema metadata cannot prove seed-row equivalence. |
| `009` | `009_right_to_erasure.sql` | no | local only | probable, not confirmed | Delete policies exist remotely. |
| `010` | `010_chat_policies.sql` | no | local only | not exact | Remote has an extra legacy chat INSERT policy in addition to later policies. |
| `011` | `011_quota_mexico_timezone.sql` | no | local only | probable, not confirmed | `mexico_date()` and the default exist remotely. |
| `012` | `012_tarjeton_consent.sql` | no | local only | probable, not confirmed | Five-argument RPC state exists remotely. |
| `013` | `013_payroll_erasure_rpc.sql` | no | local only | probable, not confirmed | `erase_user_payroll_data()` exists remotely. |
| `014` | `014_harden_tarjeton_confirmation.sql` | yes | same version, different content | confirmed non-equivalent | Remote `statement_count = 0`; local file renames and creates functions. |
| `20260727231648` | none | yes | remote only | exact SQL recoverable | `create_profiles_table`, MD5 `a9212beebcc057fa692a26443cdcef1d`. |
| `20260727231656` | none | yes | remote only | exact SQL recoverable | `create_forum_tables`, MD5 `f7bd2c52f069e820e0d30436b1bbeb09`. |
| `20260727231703` | none | yes | remote only | exact SQL recoverable | `create_chat_tables`, MD5 `1f57adc13d23ae83e5e556043e41a56b`. |
| `20260727231842` | none | yes | remote only | exact SQL recoverable | `seed_default_chat_room`, MD5 `efc88e277188179cec420da6fe0d2365`. |
| `20260727233904` | none | yes | remote only | exact SQL recoverable | `add_profile_fields`, MD5 `aeef6ed42700e644ed25a02c0a0582c6`. |
| `20260728003305` | none | yes | remote only | exact SQL recoverable | `create_catalog_tables`, MD5 `3406d2d7a1cc663e83d93db9f3d8ce8a`. |
| `20260728003432` | none | yes | remote only | exact SQL recoverable | `search_catalogo_function`, MD5 `c89d6086a4f4d08c2e22b7b526532f2c`. |

## Safety Actions Taken

Seven comment-only placeholders found in `supabase/migrations` were removed.
They falsely claimed equivalence and would have caused Supabase to compare only
matching versions, not matching SQL.

The proposed social removal SQL was moved to `deferred-migrations/`. It is not
in the active migration directory and must not be pushed. Unrelated legal and
admin-membership candidates found in the initial dirty worktree were removed
from this branch by explicit user decision.

## Read-Only Evidence

The following commands or equivalent catalog queries were used:

```text
supabase migration list --linked
supabase db query --linked "begin transaction read only; select * from supabase_migrations.schema_migrations order by version; commit;"
```

The temporary `migration fetch` project could not be linked because the CLI
account returned `Unauthorized`. No workspace file was overwritten. The SQL
was instead verified directly from the remote ledger's `statements` column.

No `migration repair`, `db push`, remote migration, or remote DML was run.

## Official References

- [Migration list](https://supabase.com/docs/reference/cli/supabase-migration-list): only migration timestamps are compared.
- [Migration fetch](https://supabase.com/docs/reference/cli/supabase-migration-fetch): fetches files stored in the history table.
- [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations): repair changes tracking metadata, not schema SQL.
