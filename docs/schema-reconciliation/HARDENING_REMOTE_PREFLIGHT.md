# Hardening Remote Preflight

Generated: 2026-08-04. **DO NOT EXECUTE — read-only audit document.**

## Objects Affected

| Object | Type | Action |
|--------|------|--------|
| profiles | TABLE | ALTER DEFAULT, REVOKE, GRANT (column-level) |
| profiles | RLS POLICY | DROP + CREATE (INSERT, UPDATE) |
| limited_profiles | VIEW | REVOKE ALL |
| guard_profile_protected_fields | FUNCTION | CREATE |
| guard_profile_protected_fields | TRIGGER | CREATE |

## Grants BEFORE (remote)

### profiles — Table-level

| Grantee | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| anon | YES | YES | YES | YES |
| authenticated | YES | YES | YES | YES |

### profiles — Column-level

Every column (id, full_name, matricula, adscripcion, avatar_url, role,
is_online, created_at, updated_at, phone, antiguedad, categoria):
INSERT, UPDATE, SELECT, REFERENCES for both `anon` and `authenticated`.

### limited_profiles (VIEW)

| Grantee | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| anon | YES | YES | — | YES |
| authenticated | YES | YES | YES | YES |

## Grants AFTER (local, post-migration)

### profiles — Table-level

| Grantee | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| anon | — | — | — | — |
| authenticated | YES | — | — | — |

### profiles — Column-level (authenticated only)

| Column | INSERT | UPDATE |
|--------|--------|--------|
| id | YES | — |
| full_name | YES | YES |
| matricula | YES | YES |
| adscripcion | YES | YES |
| categoria | YES | YES |
| antiguedad | YES | YES |
| phone | YES | YES |
| avatar_url | YES | YES |
| role | — | — |
| is_online | — | — |
| created_at | — | — |
| updated_at | — | — |

### limited_profiles (VIEW)

| Grantee | Any |
|---------|-----|
| anon | REVOKE ALL |
| authenticated | REVOKE ALL |

## Policies BEFORE (remote)

| Policy | Command | Using | With Check |
|--------|---------|-------|------------|
| Users can insert own profile | INSERT | — | auth.uid() = id |
| Users can read own profile | SELECT | auth.uid() = id | — |
| Users can update own profile | UPDATE | auth.uid() = id | auth.uid() = id |

## Policies AFTER (local)

| Policy | Command | Using | With Check |
|--------|---------|-------|------------|
| Users can insert own profile | INSERT | — | auth.uid() = id AND role = 'user' |
| Users can read own profile | SELECT | auth.uid() = id | — |
| Users can update own profile | UPDATE | auth.uid() = id | auth.uid() = id |

## Triggers BEFORE

None on `public.profiles`.

## Triggers AFTER

| Trigger | Timing | Event | Function |
|---------|--------|-------|----------|
| guard_profile_protected_fields | BEFORE | INSERT OR UPDATE | guard_profile_protected_fields() |

### Trigger behavior

- **INSERT**: blocks if `NEW.id != auth.uid()` or `NEW.role != 'user'`
- **UPDATE**: blocks changes to `id`, `role`, `created_at`; auto-sets `updated_at`
- **SECURITY INVOKER**: runs as the calling role (authenticated)
- **search_path**: pg_catalog, public (fixed)

## Columns Editable by authenticated (after)

full_name, matricula, adscripcion, categoria, antiguedad, phone, avatar_url

## Columns Readable by authenticated (after)

All columns (via SELECT on table, filtered by RLS to own row only)

## Impact on ProfileForm

ProfileForm uses `EditableProfileFields` contract:
- full_name, matricula, adscripcion, categoria, antiguedad, phone, avatar_url

All 7 fields have INSERT + UPDATE grants. **No impact.**

## Impact on handle_new_user

Trigger runs as SECURITY DEFINER (postgres). Bypasses RLS and column
grants. INSERT into profiles succeeds regardless of grant changes.
**No impact.**

## Impact on ensure_profile_exists

Function is SECURITY DEFINER. INSERT via `ON CONFLICT DO NOTHING`
bypasses RLS. Grant on `id` column supports the INSERT.
**No impact.**

## Impact on confirm_imported_payslip

Function is SECURITY DEFINER. Updates profiles via direct SQL.
UPDATE grants on personal columns support the operation.
**No impact** — function already validates allowed columns.

## Verification Queries (read-only)

```sql
-- 1. Verify grants
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'profiles'
AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- 2. Verify column grants
SELECT column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'profiles'
AND grantee = 'authenticated'
AND privilege_type IN ('INSERT', 'UPDATE')
ORDER BY column_name, privilege_type;

-- 3. Verify trigger exists
SELECT tgname FROM pg_trigger
WHERE tgname = 'guard_profile_protected_fields'
AND tgrelid = 'public.profiles'::regclass;

-- 4. Verify RLS policies
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- 5. Verify role default
SELECT column_default FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
AND column_name = 'role';

-- 6. Verify limited_profiles grants
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'limited_profiles'
AND grantee IN ('anon', 'authenticated');
```

## Rollback

See `rollback-profile-hardening-remote.sql`.

## No-Go Conditions

- **Absence of backup**: do not proceed without confirmed backup
- **Grants differ from inventory**: re-run inventory queries before applying
- **Unexpected function signatures**: compare `confirm_imported_payslip`
  arguments against local definition
- **Users with invalid role**: query `SELECT DISTINCT role FROM profiles`
  — any value other than 'user' or 'admin' indicates data issue
- **Unknown dependencies on limited_profiles**: search codebase for
  `limited_profiles` imports — if any exist, resolve before applying
- **Frontend depending on limited_profiles writes**: verify no INSERT/UPDATE
  on limited_profiles from client code
