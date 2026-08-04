# Remote Public Schema Inventory

Captured on 2026-08-03 using read-only transactions. No table rows, user IDs,
tokens, connection strings, or Storage/Auth data were exported.

## Relations And Columns

The remote `public` schema contains 23 base tables and one view:

| Relation | Columns (type, nullability/default abbreviated) |
| --- | --- |
| `ai_chat_history` | `id uuid`, `user_id uuid`, `role text`, `content text`, `created_at timestamptz` |
| `api_usage_log` | `id bigint`, `user_id uuid`, `route text`, `usage_date date`, `count integer` |
| `bitacora_entries` | `id uuid`, `user_id uuid`, `entry_type text`, `entry_date date`, `description text`, `created_at timestamptz` |
| `catalogo_adscripciones` | `id integer`, `nombre text`, `created_at timestamptz` |
| `chat_messages` | `id uuid`, `content text`, `room_id uuid`, `user_id uuid`, `created_at timestamptz` |
| `chat_participants` | `id uuid`, `room_id uuid`, `user_id uuid`, `joined_at timestamptz` |
| `chat_room_invitations` | `id uuid`, `room_id uuid`, `user_id uuid`, `created_at timestamptz` |
| `chat_rooms` | `id uuid`, `name text`, `description text`, `is_private boolean`, `created_by uuid`, `created_at timestamptz` |
| `forum_categories` | `id uuid`, `name text`, `slug text`, `description text`, `sort_order integer`, `created_at timestamptz` |
| `forum_comments` | `id uuid`, `content text`, `post_id uuid`, `author_id uuid`, `parent_id uuid`, timestamps |
| `forum_posts` | `id uuid`, `title text`, `content text`, `category_id uuid`, `author_id uuid`, flags, timestamps |
| `imported_payslip_lines` | `id uuid`, `payslip_id uuid`, index/code/description/amount/kind/confidence/confirmation fields |
| `imported_payslip_observations` | `id uuid`, `payslip_id uuid`, index/code/amount/due-period/units/control/charge/notes fields |
| `imported_payslips` | identifiers, period fields, confidence, JSONB employee/attendance/vacation/totals, `created_at` |
| `limited_profiles` | view: `id uuid`, `full_name text`, `avatar_url text` |
| `payroll_contexts` | category/workday/employment/seniority fields, JSONB context arrays, consent fields, `updated_at` |
| `profiles` | `id`, personal fields, `role`, `is_online`, timestamps |
| `vacation_calendar_roles` | `id`, `calendar_id`, role number/start/label/enabled |
| `vacation_calendars` | `id`, year/version/status/source/publication/audit fields |
| `vacation_mandatory_rest_days` | `id`, year/date/label/source |
| `vacation_profile_data` | user contract/category/schedule/seniority/radiology/rest-day fields and timestamps |
| `vacation_rule_versions` | code/regime/effective/source/priority/configuration/audit fields |
| `vacation_simulation_events` | simulation/event/description/metadata/timestamp fields |
| `vacation_simulations` | user/calendar/rule/input/result/status/timestamp fields |

`catalogo_categorias` does not exist remotely, although the retained
`search_catalogo(search_term, catalogo_type)` function queries it for
`catalogo_type = 'categoria'`. That branch is currently broken.

## RLS And Policies

All 23 base tables have RLS enabled. None has `FORCE ROW LEVEL SECURITY`.

Policy counts by area:

- Profiles: 3 (`SELECT`, `INSERT`, `UPDATE`). INSERT and UPDATE check only
  `auth.uid() = id`; neither protects `role`.
- AI history: 2 owner-scoped policies. This table must be retained.
- Social chat/forum: 26 policies across seven tables, including one duplicate
  legacy chat-message INSERT policy that survived later policy changes.
- Payslips/payroll: owner-scoped read/insert/delete/update policies.
- Vacation: owner-scoped profile/simulation policies and four admin policy pairs
  that trust `profiles.role = 'admin'`.
- Bitacora: owner-scoped CRUD policies.
- Catalog: one public read policy on `catalogo_adscripciones`.

## Privileges

Supabase default table ACLs grant broad table privileges to `anon` and
`authenticated`, with RLS expected to restrict rows. On `profiles`, both client
roles currently have INSERT and UPDATE privilege for every column, including
`role`, `id`, `created_at`, and `updated_at`.

`limited_profiles` is owned by `postgres`, has no `security_invoker` option, is
updatable/insertable, and has this effective client exposure:

- `authenticated`: SELECT plus broad write privileges.
- `anon`: write privileges remain, while SELECT was revoked later.

The view therefore runs as its owner and must have all client DML revoked. The
prepared docs-only hotfix addresses this but has not been executed.

## Functions

Application functions found:

- `confirm_imported_payslip(...)` (`SECURITY DEFINER`, `search_path=public`)
- `confirm_imported_payslip_v1(...)` (`SECURITY DEFINER`, private from authenticated but still executable by `anon`)
- `ensure_profile_exists()` (`SECURITY DEFINER`)
- `erase_user_payroll_data()` (`SECURITY DEFINER`)
- `handle_new_user()` (`SECURITY DEFINER`)
- `increment_api_usage(...)` (`SECURITY DEFINER`)
- four social chat helper functions (`SECURITY DEFINER`)
- `mexico_date()`
- `search_catalogo(...)`
- unversioned `rls_auto_enable()` event-trigger function

The `pg_trgm` 1.6 and `unaccent` 1.1 extensions are installed in `public`; their
extension-owned routines also appear in the function catalog.

## Triggers

Row triggers:

- `auth.users` AFTER INSERT -> `handle_new_user()`
- `auth.users` AFTER UPDATE -> `handle_new_user()`

Relevant event trigger:

- `ensure_rls`, enabled on `ddl_command_end` for CREATE TABLE variants, invokes
  `public.rls_auto_enable()`.

Platform-managed event triggers were also present and are not baseline candidates.

## Realtime

Only `public.chat_messages` is in publication `supabase_realtime`.

## Constraints And Indexes

Primary keys, foreign keys, unique checks, domain checks, and indexes were
enumerated from `pg_constraint` and `pg_indexes`. Security-relevant observations:

- `profiles.role` is constrained to `user|admin` but remains client-writable.
- `profiles.matricula` is unique.
- Social foreign keys cascade through profiles/rooms/posts.
- Payslip ownership chains and unique source hashes are present.
- `catalogo_adscripciones` has the expected trigram index.
- No category-catalog relation or index exists.

## Schema Dump Status

`supabase db dump --linked --schema public` could not run because the installed
CLI requires Docker for `pg_dump`, and no standalone `pg_dump` exists in `PATH`.
`remote-public-schema.sql` therefore contains only the exact read-only inventory
queries and is explicitly not represented as a pg_dump or executable baseline.
