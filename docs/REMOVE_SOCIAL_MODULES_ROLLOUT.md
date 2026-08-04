# Social Modules Removal Rollout

## Current State

The `/chat` and `/foro` routes, navigation entries, components, hooks, and
services are removed from the application worktree. The AI assistant at
`/asistente`, `/api/consulta`, `bot-api`, and `ai_chat_history` is retained.

The social database schema is intentionally still active. Its removal SQL is a
deferred candidate under `docs/schema-reconciliation/deferred-migrations/`, not
an active migration. No production command from this document has been run.

## Required Order

1. Create and verify a protected backup or PITR marker. Export the seven social
   tables to an encrypted location outside the repository when policy requires it.
2. Deploy only the frontend release that removes the social modules. Do not
   include deferred database, admin-membership, or legal-consent migrations.
3. Confirm logs show no application reads, writes, RPC dependencies, or Realtime
   subscriptions involving the social schema for one normal traffic interval.
4. After migration reconciliation and human approval, create a new timestamped
   removal migration from the reviewed deferred candidate and validate it with a
   clean local `supabase db reset`.
5. During a separately approved maintenance window, apply the reviewed migration
   and verify API, Postgres, Auth, and Realtime logs for missing-relation or
   permission failures.
6. Retain the encrypted backup for the approved period, then destroy it according
   to the documented retention decision.

## Social Objects To Remove Later

- `chat_room_invitations`
- `chat_messages`
- `chat_participants`
- `chat_rooms`
- `forum_comments`
- `forum_posts`
- `forum_categories`
- `is_chat_participant`, `is_chat_admin`, `is_chat_room_visible`, `is_chat_invited`
- `limited_profiles`
- `profiles.is_online`
- `chat_messages` membership in `supabase_realtime`

Never remove `ai_chat_history`.

## Stop Conditions

Stop before database removal when any active client still references a social
object, the backup is missing or unverified, Docker reset has not passed, schema
equivalence is unresolved, unexpected dependencies exist, or human approval is
absent. Do not use `CASCADE` to bypass an unexplained dependency.

## Rollback

Before database removal, rollback is a frontend redeploy. After destructive
removal, recovery requires the protected snapshot/export and reviewed schema
recreation in dependency order. Use a new forward migration for corrections;
never edit applied migration files or falsify the migration ledger.
