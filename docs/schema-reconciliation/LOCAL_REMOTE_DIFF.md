# Local vs Remote Schema Diff

Generated: 2026-08-04.

## Summary

| Category | Local Only | Remote Only | Different |
|----------|-----------|-------------|-----------|
| Migrations | 13 (001-013, 20260804150936) | 6 (timestamp) | 2 (006≈20260727233904, 007≈20260728003305) |
| Tables | 0 | 0 | 0 |
| Views | 0 | 0 | 0 |
| Functions | 0 | 0 | 1 (handle_new_user) |
| Event Triggers | 0 | 1 (ensure_rls) | 0 |
| Triggers | 1 (guard_profile_protected_fields) | 0 | 0 |
| RLS Policies | 3 on profiles | 3 on profiles | Different definitions |
| Grants (profiles) | Column-restricted | Full DML all columns | YES |

## Detailed Differences

### 1. profiles

#### Columns
- **Local**: id, full_name, matricula, adscripcion, avatar_url, role, is_online, created_at, updated_at, phone, antiguedad, categoria
- **Remote**: id, full_name, matricula, adscripcion, avatar_url, role, is_online, created_at, updated_at, phone, antiguedad, categoria
- **Status**: IDENTICAL

#### Column Defaults
- **Local**: `role DEFAULT 'user'` (set by migration 20260804150936)
- **Remote**: `role` has no explicit DEFAULT (null by default)
- **Status**: DIFFERENT — local hardening migration sets default

#### Grants
- **Local (after migration)**:
  - `authenticated`: SELECT (table), INSERT/UPDATE on 8 personal columns only
  - `anon`: REFERENCES, TRIGGER, TRUNCATE only
- **Remote**:
  - `anon`: SELECT, INSERT, UPDATE, DELETE on ALL columns (including `role`, `id`)
  - `authenticated`: SELECT, INSERT, UPDATE, DELETE on ALL columns (including `role`, `id`)
- **Status**: DIFFERENT — remote is wide open

**Important nuance on anon access:**

PostgreSQL grants and RLS policies operate at different levels:
- **Grants** control whether a role is allowed to attempt an operation on
  a table/column. Without the grant, the operation is blocked at the
  permission level before RLS is even evaluated.
- **RLS policies** filter which rows a role can see/modify. They only
  apply when the role has the table-level grant.

On the remote, `anon` has SELECT/INSERT/UPDATE/DELETE grants on profiles.
The RLS policies (`auth.uid() = id`) would block most anon operations
because `auth.uid()` returns NULL for unauthenticated requests, and
`NULL = id` is never true. **However**, this is defense-in-depth
failure: the grants should not exist for anon in the first place because:

1. A future RLS policy change or misconfiguration could expose data.
2. SECURITY DEFINER functions bypass RLS but still check grants.
3. The grants violate the principle of least privilege.
4. `limited_profiles` is a VIEW — view security depends on the underlying
   table's grants and the view's own RLS, making it more fragile.
5. `role` column is writable by both `anon` and `authenticated` at the
   grant level. While the INSERT policy checks `auth.uid() = id`, there
   is no trigger to prevent an authenticated user from updating their own
   `role` to `admin` (RLS allows the UPDATE since `auth.uid() = id`).

**Severity remains HIGH** because:
- `role` is exposed to authenticated UPDATE without trigger protection
- `limited_profiles` has broad grants on a view over profiles
- Grants exceed what any client-side operation requires
- No defense-in-depth against future policy changes

#### RLS Policies
- **Local**:
  - INSERT: `WITH CHECK (auth.uid() = id AND role = 'user')`
  - UPDATE: `USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`
  - SELECT: `USING (auth.uid() = id)` (from 006)
- **Remote**:
  - INSERT: `WITH CHECK (auth.uid() = id)` (no role check)
  - UPDATE: `USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`
  - SELECT: `USING (auth.uid() = id)`
- **Status**: DIFFERENT — local INSERT policy adds `AND role = 'user'` check

#### Triggers
- **Local**: `guard_profile_protected_fields` (BEFORE INSERT OR UPDATE)
  - Blocks role escalation, id changes, created_at changes
  - Sets updated_at on every update
- **Remote**: NONE
- **Status**: DIFFERENT — remote has no trigger protection

### 2. limited_profiles

- **Local**: VIEW `SELECT id, full_name, avatar_url FROM profiles`
- **Remote**: VIEW `SELECT id, full_name, avatar_url FROM profiles`
- **Status**: IDENTICAL definition
- **Grants DIFFERENT**:
  - Local: REVOKE ALL from anon, authenticated (migration 20260804150936)
  - Remote: anon has SELECT/INSERT/DELETE; authenticated has SELECT/INSERT/UPDATE/DELETE

### 3. handle_new_user

- **Local** (from 006):
  ```sql
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO UPDATE SET ...
  ```
- **Remote** (from 20260727233904):
  ```sql
  INSERT INTO public.profiles (id, full_name, phone, avatar_url)
  VALUES (NEW.id, ..., NEW.raw_user_meta_data->>'phone',
          NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO UPDATE SET ...
  ```
- **Status**: DIFFERENT — remote version includes phone and avatar_url

### 4. rls_auto_enable (event trigger)

- **Local**: Does not exist
- **Remote**: EXISTS — `ensure_rls` event trigger on `ddl_command_end`
- **Status**: LOCAL ONLY ABSENT

### 5. Chat/Forum Tables

- **Local**: Removed from frontend; tables still exist in migrations 010
- **Remote**: 7 tables still present (chat_messages, chat_participants,
  chat_room_invitations, chat_rooms, forum_categories, forum_comments,
  forum_posts) + seed data
- **Status**: REMOTE ONLY (social objects, to be dropped)

### 6. ai_chat_history

- **Local**: Present (created in migration 010)
- **Remote**: Present (created in 20260727231703)
- **Status**: IDENTICAL — both have same schema and RLS policies

### 7. payroll_contexts

- **Local**: Has consent_given, consent_given_at, consent_version columns
- **Remote**: Has consent_given, consent_given_at, consent_version columns
- **Status**: IDENTICAL

### 8. confirm_imported_payslip / confirm_imported_payslip_v1

- **Local**: SECURITY DEFINER, checks auth.uid(), validates payload
- **Remote**: SECURITY DEFINER, identical logic
- **Status**: IDENTICAL

### 9. confirm_imported_payslip_v1 Consent Flow

- **Local**: Checks `p_authorize_server_storage <> true` → consent_required
- **Remote**: Same check, same flow
- **Status**: IDENTICAL

### 10. Tarjeton Consent

- **Local**: `tarjeton_consent` column does NOT exist in profiles
- **Remote**: `tarjeton_consent` column does NOT exist in profiles
- **Consent location**: `payroll_contexts.consent_given` in both
- **Status**: IDENTICAL — `tarjeton_consent` was a test artifact, not real

## Objects Requiring Reconciliation

### Must apply to remote
1. Migration 20260804150936 (profile hardening) — REVOKE broad DML, add
   column-grants, add trigger, tighten RLS policies
2. `rls_auto_enable` event trigger — create locally for parity

### Must drop from remote
1. chat_messages, chat_participants, chat_room_invitations, chat_rooms
2. forum_categories, forum_comments, forum_posts
3. Seed data in forum_categories, chat_rooms
4. is_chat_admin, is_chat_invited, is_chat_participant, is_chat_room_visible
   functions (used only by chat policies)
5. Realtime publication on chat_messages

### Must reconcile
1. `handle_new_user` — remote version includes phone/avatar_url; local
   version from 006 does not. Need to determine which is canonical.
2. Migration history — `migration repair` or baseline to align versions
