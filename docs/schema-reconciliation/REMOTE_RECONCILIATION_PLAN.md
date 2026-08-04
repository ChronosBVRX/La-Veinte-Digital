# Remote Reconciliation Plan

Generated: 2026-08-04. Updated: corrected migration repair policy,
social deploy order, and anon grant clarification.

**DO NOT EXECUTE until explicitly authorized per phase.**

## Current State

- Branch: `fix/public-launch-readiness`
- HEAD: `66b2da9`
- Remote: `ragktminwduiggvaoeix` (Supabase)
- Remote has 8 migrations; local has 15
- Remote profiles: wide-open grants, no trigger protection
- Local profiles: hardened (column-grants, trigger, tightened RLS)
- Social tables: present in remote, retired in local frontend
- Social data: seed only (1 room, 2 messages, 3 categories, 0 posts)

## Phased Execution

### Phase 1: Backup (no code changes)

1. Create remote backup via Supabase dashboard (PITR or pg_dump).
2. Export current remote schema via `supabase db dump --linked --schema-only`.
3. **Gate**: backup confirmed before any write.

### Phase 2: Migration History — Recover Files First

**Do NOT use `migration repair` yet.**

The 7 remote-only timestamp migrations exist in production but their
SQL files are not in the repository. Before any repair:

1. **Recover or reconstruct** each migration file using the exact remote
   timestamps:
   - 20260727231648 (create_profiles_table)
   - 20260727231656 (create_forum_tables)
   - 20260727231703 (create_chat_tables)
   - 20260727231842 (seed_default_chat_room)
   - 20260727233904 (add_profile_fields)
   - 20260728003305 (create_catalog_tables)
   - 20260728003432 (search_catalogo_function)
2. **Compare SQL** of each recovered file against the remote `statements`
   column (already captured in `REMOTE_MIGRATION_HISTORY.md`).
3. **Validate effect** by applying each to a disposable local database.
4. **Classify each migration**:
   - **Equivalencia exacta**: SQL idéntico, mismo efecto
   - **Equivalencia funcional demostrada**: SQL difiere pero efecto es el mismo
   - **Equivalencia parcial**: crea objetos similares pero con diferencias
   - **Sin equivalencia**: no existe archivo local
   - **Migración obsoleta pero histórica**: existe pero el objeto fue
     modificado o eliminado después
5. **Only then**: use `migration repair` for specific versions whose
   equivalence is demonstrated. Never mark migrations as repaired in
   bulk by name similarity.

**Gate**: all 7 files recovered, compared, classified before any repair.

### Phase 3: Profile Hardening (security — urgent)

3a. **Apply migration 20260804150936** to remote:
    ```
    supabase migration up --linked
    ```
    See `HARDENING_REMOTE_PREFLIGHT.md` for preconditions and no-go.
    See `apply-profile-hardening-remote.sql` for the exact SQL.

3b. **Verify** critical paths:
    - Login/register → profile creation
    - Profile read/update (ProfileForm)
    - Tarjeton import flow
    - AI assistant access

### Phase 4: Push and Deploy Frontend (social retired)

4a. Push branch:
    ```
    git push origin fix/public-launch-readiness
    ```
4b. Open PR and merge.
4c. Deploy to Vercel (frontend without chat/forum).
4d. **Confirm** via Vercel logs that no requests hit `/chat`, `/foro`,
    or social API routes.

### Phase 5: Social Schema Cleanup (after deploy confirmed)

5a. Export social data if any user content exists (currently: seed only).
5b. Apply social drop migration (deferred-migrations/remove_social_chat_and_forum.sql).
5c. Remove Realtime publication on chat_messages.
5d. Regenerate TypeScript types.
5e. Redeploy if types changed.

### Phase 6: Event Trigger Parity

6a. Apply `rls_auto_enable` event trigger locally and remotely.
    See `deferred-migrations/create_rls_auto_enable.sql`.

### Phase 7: handle_new_user Reconciliation

7a. Apply reconciled `handle_new_user` that includes phone + avatar_url.
    See `deferred-migrations/reconcile_handle_new_user.sql`.

### Phase 8: Smoke Tests

8a. Test all critical paths.
8b. Verify no regressions.

### Phase 9: Rollback Readiness

9a. Keep backup accessible for 30 days.
9b. Document rollback procedure in `rollback-profile-hardening-remote.sql`.

## Migration Repair Policy

**Never** mark migrations as repaired in bulk. Each repair must be:

1. Preceded by file recovery and SQL comparison.
2. Classified with one of:
   - equivalencia exacta
   - equivalencia funcional demostrada
   - equivalencia parcial
   - sin equivalencia
   - migración obsoleta pero histórica
3. Applied to a single, specific version.
4. Verified after repair.

The goal is a reconstructable history, not an apparently aligned one.

## Social Deploy Order

**Never** drop social tables before deploying the frontend that stopped
using them. Order:

1. Backup
2. Hardening
3. Deploy frontend (social retired)
4. Confirm no social queries in logs
5. Export social data if needed
6. Drop social schema
7. Remove Realtime
8. Regenerate types
9. Smoke tests

## Operations Requiring Authorization

| Operation | Phase | Risk | Status |
|-----------|-------|------|--------|
| Backup remote DB | 1 | None | Pending |
| Recover migration files | 2 | None | Pending |
| Compare SQL | 2 | None | Pending |
| Migration repair (per version) | 2 | Low | Pending |
| Apply hardening migration | 3 | Medium | Pending |
| Push branch | 4 | Low | Pending |
| Deploy frontend | 4 | Medium | Pending |
| Drop social tables | 5 | High | Pending |
| Create rls_auto_enable | 6 | Low | Pending |
| Reconcile handle_new_user | 7 | Low | Pending |
| Regenerate types | 5 | Low | Pending |
