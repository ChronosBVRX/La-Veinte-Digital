# Local DB Reset Result

**Date:** 2026-08-03
**Supabase CLI:** 2.110.0
**Docker:** Docker Desktop 4.85.0 (Engine 29.6.2)
**Branch:** fix/public-launch-readiness (HEAD: 44606e0)

## Result: SUCCESS

All 14 local migrations applied cleanly on a fresh database. No errors.

## Migrations Applied (in order)

| # | File | Status |
|---|------|--------|
| 001 | 001_vacation_schema.sql | ✅ |
| 002 | 002_bitacora_schema.sql | ✅ |
| 003 | 003_payroll_contexts.sql | ✅ |
| 004 | 004_imported_payslips.sql | ✅ |
| 005 | 005_api_usage_log.sql | ✅ |
| 006 | 006_profiles_lifecycle.sql | ✅ (NOTICE: policies/triggers created fresh) |
| 007 | 007_base_schema.sql | ✅ (NOTICE: policies created fresh) |
| 008 | 008_seed_2027_and_validate.sql | ✅ |
| 009 | 009_right_to_erasure.sql | ✅ |
| 010 | 010_chat_policies.sql | ✅ (NOTICE: chat policies created fresh) |
| 011 | 011_quota_mexico_timezone.sql | ✅ |
| 012 | 012_tarjeton_consent.sql | ✅ |
| 013 | 013_payroll_erasure_rpc.sql | ✅ |
| 014 | 014_harden_tarjeton_confirmation.sql | ✅ |

## NOTICEs (informational, not errors)

All NOTICEs are "relation/policy/trigger does not exist, skipping" — normal for a fresh database where `IF NOT EXISTS` / `DROP IF EXISTS` patterns are used. No errors.

## Key Observations

- `supabase start` and `supabase db reset` both succeed identically
- The local migration chain is self-contained and idempotent
- No dependency on remote state
- No conflict with existing objects (fresh database each time)
- The deferred migrations (015, 016, 017) are NOT applied — they're excluded from the active migration chain
- Social tables (chat_*, forum_*) ARE created by migrations 006/007/010 — they remain in the schema
- `ai_chat_history` is created by migration 007
- `profiles` table with `role` column is created by migration 006
- `limited_profiles` view is created by migration 006

## Conclusion

The local migration chain works correctly on a clean database. The migration reconciliation strategy (keeping 001-014 as-is, no repair) is validated locally. The seven remote-only timestamped migrations (20260727231648 through 20260728003432) represent the drift between local and remote — they need separate reconciliation.
