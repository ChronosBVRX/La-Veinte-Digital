# Baseline Decision

## Decision

Use a hybrid strategy after local Docker validation and human approval:

1. Preserve the exact remote ledger spine: empty version `014` plus the seven
   timestamped migrations using their original stored SQL.
2. Archive local `001` through `013` and the current non-empty `014` as source
   material, not as claimed production history.
3. Add a new timestamped forward convergence migration for the retained schema
   and the intended tarjeton hardening.
4. Add later, separately reviewed migrations for profile security and eventual
   social-schema removal.

This is not yet an active migration rewrite. Current migration files remain in
place until Docker can prove the failure mode and the candidate can be reset
from an empty local database.

## Why Not Pure Exact History

The seven original remote migrations are recoverable, but they do not explain
the complete current remote schema. Vacation, payroll, bitacora, quota, profile
lifecycle, later chat policies, and tarjeton objects exist without matching
ledger versions. Exact replay of only the recorded history is therefore
incomplete.

## Why Not A Synthesized Baseline Yet

The current numbered chain is not an exact baseline:

- Remote `014` has no statements, while local `014` is non-empty.
- `007` does not create `search_catalogo` or `catalogo_categorias`.
- Remote `search_catalogo` references the missing `catalogo_categorias` table.
- Seed equivalence cannot be proven from schema-only queries.
- No clean local reset or schema fingerprint comparison is available without Docker.

## Proposed Future Ordering

Illustrative names only; generate final timestamps with `supabase migration new`:

| Order | File | Purpose |
| --- | --- | --- |
| 1 | `014_harden_tarjeton_confirmation.sql` | Empty marker matching the remote row. |
| 2-8 | seven `202607...` files | Exact SQL recovered from the remote ledger. |
| 9 | `<timestamp>_reconcile_retained_schema.sql` | Reproduce retained unversioned production state and tarjeton hardening. |
| 10 | `<timestamp>_reconcile_catalog_contract.sql` | Resolve the broken category branch explicitly. |
| 11 | `<timestamp>_harden_profile_privileges.sql` | Apply reviewed INSERT/UPDATE protection. |
| 12 | `<timestamp>_remove_social_chat_and_forum.sql` | Run only after frontend rollout and backup. |

Unrelated legal-consent and admin-membership candidates found in the initial
dirty worktree were removed by explicit user decision. Any future version must
use a separate branch, migration, approval, and rollout plan.

## Required Proof Before Activation

- Docker is available.
- `supabase db reset` failure is captured before changing history.
- Exact remote migration files replay on a fresh local stack.
- The convergence migration creates every retained table, function, trigger,
  policy, grant, extension, publication rule, and deterministic seed.
- Local and remote schema fingerprints are compared.
- Profile and authentication tests pass with synthetic users.
- `ai_chat_history` remains present.
- No protected labor formula or expected result changes.

## Migration Repair

Do not repair `001` through `013`. A repair only changes ledger metadata and
would falsely assert that mutable local files ran remotely. Under the hybrid
strategy, new convergence migrations should be applied normally in the future.

Any repair decision remains a separate human-approved production operation
after exact replay and schema comparison.

Supabase documents that `migration repair` changes only the tracking table and
does not apply or revert SQL:
https://supabase.com/docs/reference/cli/supabase-migration-repair

## Rollback

No remote change has been made, so the current rollback is simply to discard
the unapproved local candidate work. A future production rollout requires a
snapshot/PITR marker and forward-fix plan; destructive social removal cannot be
reversed without restoring its protected backup.

`supabase db reset --linked` is prohibited because Supabase documents it as
destructive to the linked remote database:
https://supabase.com/docs/guides/local-development/cli-workflows
