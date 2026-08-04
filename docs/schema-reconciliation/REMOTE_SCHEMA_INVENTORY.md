# Remote Schema Inventory

Captured: 2026-08-04 via read-only SQL queries against `ragktminwduiggvaoeix`.

## Tables (23)

| Table | RLS | Forced | Realtime |
|-------|-----|--------|----------|
| ai_chat_history | enabled | no | no |
| api_usage_log | enabled | no | no |
| bitacora_entries | enabled | no | no |
| catalogo_adscripciones | enabled | no | no |
| chat_messages | enabled | no | YES |
| chat_participants | enabled | no | no |
| chat_room_invitations | enabled | no | no |
| chat_rooms | enabled | no | no |
| forum_categories | enabled | no | no |
| forum_comments | enabled | no | no |
| forum_posts | enabled | no | no |
| imported_payslip_lines | enabled | no | no |
| imported_payslip_observations | enabled | no | no |
| imported_payslips | enabled | no | no |
| payroll_contexts | enabled | no | no |
| profiles | enabled | no | no |
| vacation_calendar_roles | enabled | no | no |
| vacation_calendars | enabled | no | no |
| vacation_mandatory_rest_days | enabled | no | no |
| vacation_profile_data | enabled | no | no |
| vacation_rule_versions | enabled | no | no |
| vacation_simulation_events | enabled | no | no |
| vacation_simulations | enabled | no | no |

## Views (1)

| View | Definition |
|------|-----------|
| limited_profiles | `SELECT id, full_name, avatar_url FROM profiles` |

## Extensions

- pg_trgm (trigram similarity)
- unaccent (accent removal)

## Functions (application-relevant)

| Function | Security Definer | Arguments |
|----------|-----------------|-----------|
| confirm_imported_payslip | YES | text, jsonb, jsonb, boolean, boolean |
| confirm_imported_payslip_v1 | YES | text, jsonb, jsonb, boolean, boolean |
| ensure_profile_exists | YES | — |
| erase_user_payroll_data | YES | — |
| handle_new_user | YES | — (trigger on auth.users) |
| increment_api_usage | YES | uuid, text, integer |
| is_chat_admin | YES | uuid |
| is_chat_invited | YES | uuid, uuid |
| is_chat_participant | YES | uuid, uuid |
| is_chat_room_visible | YES | uuid, uuid |
| mexico_date | NO | — |
| rls_auto_enable | YES | — (event trigger) |
| search_catalogo | NO | text, text |

## Event Triggers

| Name | Event | Function | Enabled |
|------|-------|----------|---------|
| ensure_rls | ddl_command_end | rls_auto_enable | O (origin) |

## Triggers

No triggers on `public` schema. The `handle_new_user` trigger is on
`auth.users` (not queryable from `information_schema.triggers` with
`trigger_schema = 'public'`).

## profiles — Grants

### Table-level (anon, authenticated)

| Grantee | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| anon | YES | YES | YES | YES |
| authenticated | YES | YES | YES | YES |

### Column-level (all columns, both anon and authenticated)

Every column has SELECT, INSERT, UPDATE, REFERENCES for both `anon` and
`authenticated`. No column-level restrictions.

### profiles — RLS Policies

| Policy | Command | Roles | Using | With Check |
|--------|---------|-------|-------|------------|
| Users can insert own profile | INSERT | public | — | auth.uid() = id |
| Users can read own profile | SELECT | public | auth.uid() = id | — |
| Users can update own profile | UPDATE | public | auth.uid() = id | auth.uid() = id |

### profiles — Vulnerabilities

- **role column**: `anon` and `authenticated` have INSERT/UPDATE on `role`.
  No trigger or CHECK constraint prevents `role = 'admin'`.
- **id column**: `anon` and `authenticated` have INSERT/UPDATE on `id`.
  No trigger prevents cross-user profile creation.
- **created_at column**: `anon` and `authenticated` have INSERT/UPDATE on
  `created_at`. No trigger prevents modification.

## limited_profiles — Grants

| Grantee | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| anon | YES | YES | — | YES |
| authenticated | YES | YES | YES | YES |

Note: `limited_profiles` is a view, not a table. Column-level grants do
not apply to views in the same way.

## payroll_contexts — Consent Columns

| Column | Type | Default |
|--------|------|---------|
| consent_given | boolean | false |
| consent_given_at | timestamptz | null |
| consent_version | text | '1.0' |

These columns exist in `payroll_contexts`, NOT in `profiles`. There is
no `tarjeton_consent` column anywhere in the remote database.

## confirm_imported_payslip — Consent Flow

The function `confirm_imported_payslip_v1` checks:
1. `auth.uid() IS NULL` → unauthorized
2. `p_authorize_server_storage <> true` → consent_required
3. Upserts `payroll_contexts` with `consent_given = true`

Consent is stored in `payroll_contexts.consent_given`, not in `profiles`.
