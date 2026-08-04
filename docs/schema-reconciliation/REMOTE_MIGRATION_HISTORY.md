# Remote Migration History

Captured: 2026-08-04 via `supabase migration list --linked` + SQL query.

## Remote Migrations (8 total)

| # | Version | Name | Timestamp | Local Equivalent |
|---|---------|------|-----------|-----------------|
| 1 | 014 | harden_tarjeton_confirmation | — | 014 (equivalencia confirmada) |
| 2 | 20260727231648 | create_profiles_table | 2026-07-27 23:16:48 | Ninguno (crea profiles desde cero) |
| 3 | 20260727231656 | create_forum_tables | 2026-07-27 23:16:56 | Ninguno (forum, obsoleto) |
| 4 | 20260727231703 | create_chat_tables | 2026-07-27 23:17:03 | Ninguno (chat, obsoleto + ai_chat_history) |
| 5 | 20260727231842 | seed_default_chat_room | 2026-07-27 23:18:42 | Ninguno (seed data, obsoleto) |
| 6 | 20260727233904 | add_profile_fields | 2026-07-27 23:39:04 | Parcial (006 profiles_lifecycle) |
| 7 | 20260728003305 | create_catalog_tables | 2026-07-28 00:33:05 | Parcial (007 base_schema) |
| 8 | 20260728003432 | search_catalogo_function | 2026-07-28 00:34:32 | Parcial (007 base_schema) |

## Local Migrations (15 total)

| Version | Local Name | Remote Equivalent |
|---------|------------|------------------|
| 001 | vacation_schema | Ninguno |
| 002 | bitacora_schema | Ninguno |
| 003 | payroll_contexts | Ninguno |
| 004 | imported_payslips | Ninguno |
| 005 | api_usage_log | Ninguno |
| 006 | profiles_lifecycle | Parcial: 20260727233904 (add_profile_fields) |
| 007 | base_schema | Parcial: 20260728003305 + 20260728003432 |
| 008 | seed_2027_and_validate | Ninguno |
| 009 | right_to_erasure | Ninguno |
| 010 | chat_policies | Parcial: 20260727231703 (create_chat_tables) |
| 011 | quota_mexico_timezone | Ninguno |
| 012 | tarjeton_consent | Ninguno |
| 013 | payroll_erasure_rpc | Ninguno |
| 014 | harden_tarjeton_confirmation | 014 (equivalencia confirmada) |
| 20260804150936 | harden_profile_privileges | Ninguno (solo local) |

## Análisis

### Origen del historial remoto

El historial remoto indica que la base de datos fue inicializada mediante
`supabase db push` o `supabase link` en algún momento entre el 27 y 28 de
julio de 2026. Las migraciones timestamp (20260727-20260728) representan
las primeras migraciones aplicadas remotamente.

Las migraciones 001-013 locales no aparecen en el historial remoto porque
Supabase CLI mapea migraciones numeradas a timestamps internamente cuando
se vincula una base preexistente. Esto **no significa** que el esquema
remoto carezca de esas tablas — las migraciones remotas crearon las tablas
mediante SQL directo, no mediante el sistema de migraciones numeradas.

### Equivalencias confirmadas

- 014 ↔ 014: ambas aplican `harden_tarjeton_confirmation`. Confirmado
  porque el SQL de la migración remota contiene exactamente la función
  `confirm_imported_payslip_v1` con REVOKE/GRANT idénticos.

### Equivalencias parciales

- 006 (profiles_lifecycle) ≈ 20260727233904 (add_profile_fields): ambos
  agregan phone, antiguedad, categoria a profiles. Diferencias:
  - Local crea `limited_profiles` view; remoto no.
  - Local crea trigger `ensure_profile_exists`; remoto no.
  - Local crea trigger `guard_profile_protected_fields`; remoto no.
  - Local aplica REVOKE/GRANT por columna; remoto no.

- 007 (base_schema) ≈ 20260728003305 + 20260728003432: ambos crean
  catalogo_categorias, catalogo_adscripciones y search_catalogo.
  Diferencias:
  - Local incluye tablas adicionales (vacation_*, bitacora, etc.)
  - Remoto incluye extensiones pg_trgm, unaccent.

### Migraciones sin equivalente

**Solo local (13):** 001-005, 008-013, 20260804150936
**Solo remoto (6):** 20260727231648, 20260727231656, 20260727231703,
20260727231842, 20260727233904, 20260728003305, 20260728003432

### Evidencia

- `supabase migration list --linked` output
- SQL: `SELECT version, statements, name FROM supabase_migrations.schema_migrations ORDER BY version`
