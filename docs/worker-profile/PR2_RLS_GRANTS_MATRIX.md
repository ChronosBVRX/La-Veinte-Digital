# PR2 — Matriz RLS / Grants

> Diseño de referencia para la migración PR2. NO es SQL ejecutable.
> Roles considerados: `anon`, `authenticated`, `service_role`, y funciones
> `SECURITY DEFINER` (equivalen a `postgres`).

## 1. Principios

1. **No ampliar grants de `profiles`** — se mantiene el hardening (authenticated solo SELECT de tabla + column-level INSERT/UPDATE de campos personales).
2. **`authenticated` no escribe directamente `worker_data_events` ni `worker_consents`** — solo a través de RPC SECURITY DEFINER del servicio.
3. **`authenticated` no puede elegir otro `user_id`** — toda fila se filtra por `auth.uid()`.
4. **Todo DML a `worker_preferences` y `payroll_contexts` restringido a la fila propia** por RLS.
5. **Funciones SECURITY DEFINER con `search_path = public` fijo** y `REVOKE ALL ... FROM PUBLIC`.
6. **Ninguna tabla nueva queda sin policies** (relevante por `rls_auto_enable` remoto).

## 2. Matriz de tabla × rol × operación

### 2.1 `worker_preferences` (nueva)

| Rol | SELECT | INSERT | UPDATE | DELETE | Grant |
|-----|:------:|:------:|:------:|:------:|-------|
| `anon` | ❌ | ❌ | ❌ | ❌ | — |
| `authenticated` | ✅ (propio) | ✅ (propio) | ✅ (propio) | ❌ (solo servicio) | `GRANT SELECT, INSERT, UPDATE ON ... TO authenticated` |
| `service_role` | ✅ | ✅ | ✅ | ✅ | default (via RLS bypass) |
| Función SECURITY DEFINER | ✅ | ✅ | ✅ | ✅ | owner |

**RLS:**
- SELECT: `user_id = auth.uid()`
- INSERT: `WITH CHECK (user_id = auth.uid())`
- UPDATE: `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`
- DELETE: **sin policy** (no hay DELETE de preferencias por el usuario; solo cascade por cuenta)

### 2.2 `payroll_contexts` (existente + columnas nuevas)

| Rol | SELECT | INSERT | UPDATE | DELETE | Grant |
|-----|:------:|:------:|:------:|:------:|-------|
| `anon` | ❌ | ❌ | ❌ | ❌ | — (solo REFERENCES/TRIGGER/TRUNCATE) |
| `authenticated` | ✅ (propio) | ✅ (propio) | ✅ (propio, solo columnas autorizadas) | ✅ (propio, legacy) | `GRANT SELECT ON ... TO authenticated` + column-level INSERT/UPDATE para campos nuevos |
| `service_role` | ✅ | ✅ | ✅ | ✅ | default |

**RLS existentes (se mantienen):** SELECT/INSERT/UPDATE/DELETE con `user_id = auth.uid()`.

**Grants de columnas nuevas** (matricula, adscripcion, shift, source_*):
- `GRANT INSERT (matricula, adscripcion, shift, source_matricula, source_adscripcion, source_category_name, source_workday_hours, source_employment_type, source_shift, source_effective_seniority_date) ON public.payroll_contexts TO authenticated`
- `GRANT UPDATE (mismas columnas) ON public.payroll_contexts TO authenticated`
- NO se concede UPDATE/DELETE de tabla a authenticated (coherente con hardening).
- **Nota:** el UPDATE de `employment_type` por el usuario se mantiene a nivel de columna, pero el valor debe respetar el CHECK DB (ver discrepancia §1.4 del esquema).

### 2.3 `worker_consents` (nueva)

| Rol | SELECT | INSERT | UPDATE | DELETE | Grant |
|-----|:------:|:------:|:------:|:------:|-------|
| `anon` | ❌ | ❌ | ❌ | ❌ | — |
| `authenticated` | ✅ (propio) | ❌ directo | ❌ directo | ❌ directo | `GRANT SELECT ON ... TO authenticated` |
| `service_role` | ✅ | ✅ | ✅ | ✅ | default |
| RPC `get_effective_consent` (SECURITY DEFINER) | ✅ | — | — | — | owner |

**RLS:**
- SELECT: `user_id = auth.uid()`
- INSERT/UPDATE/DELETE: **sin policy de usuario** (solo vía RPC/service; `service_role` y owner tienen acceso).

**Escritura:** RPC `upsert_consent(p_purpose, p_version, p_accepted_source, p_revoke bool)` SECURITY DEFINER:
- `user_id = auth.uid()` (nunca del cliente).
- Reaceptación: si existe `(user_id, purpose, version)` con `revoked_at NOT NULL`, limpia `revoked_at` y actualiza `accepted_at`.
- Revocación: `revoked_at = now()` en la fila vigente.
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`

### 2.4 `worker_data_events` (nueva)

| Rol | SELECT | INSERT | UPDATE | DELETE | Grant |
|-----|:------:|:------:|:------:|:------:|-------|
| `anon` | ❌ | ❌ | ❌ | ❌ | — |
| `authenticated` | ✅ (propio) | ❌ directo | ❌ directo | ❌ directo | `GRANT SELECT ON ... TO authenticated` |
| `service_role` | ✅ | ✅ | ✅ | ✅ | default |
| RPC `insert_worker_event` (SECURITY DEFINER) | — | ✅ | — | — | owner |

**RLS:**
- SELECT: `user_id = auth.uid()`
- INSERT/UPDATE/DELETE: **sin policy de usuario**.

**Escritura:** RPC `insert_worker_event(p_event_type, p_priority, p_metadata jsonb)` SECURITY DEFINER:
- `user_id = auth.uid()`.
- Valida event_type/priority contra enums.
- Valida metadata contra allowlist (claves de `validateWorkerEventMetadata` del PR1).
- `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`

## 3. Matriz de funciones

| Función | security definer | search_path | execute | user_id desde |
|---------|:----------------:|:-----------:|:-------:|---------------|
| `ensure_profile_exists()` | sí | public | authenticated | `auth.uid()` |
| `confirm_imported_payslip(...)` | sí | public | authenticated | `auth.uid()` |
| `erase_user_payroll_data()` | sí | public | authenticated | `auth.uid()` |
| `upsert_consent(...)` | sí | public | authenticated | `auth.uid()` |
| `get_effective_consent(...)` | sí | public | authenticated | `auth.uid()` |
| `insert_worker_event(...)` | sí | public | authenticated | `auth.uid()` |
| `backfill_worker_profile()` (admin/1x) | sí | public | **solo postgres/service_role** | n/a |

Todas: `REVOKE ALL ON FUNCTION ... FROM PUBLIC; GRANT EXECUTE ... TO <rol>;`

## 4. Guardas críticas

- `authenticated` **no fabrica eventos** (sin INSERT directo + RPC valida metadata).
- `authenticated` **no acepta consentimiento por otro user** (RLS SELECT propio + RPC usa `auth.uid()`).
- `authenticated` **no escribe otro perfil** (`user_id = auth.uid()` en RLS).
- Backfill solo vía función admin (service_role), nunca expuesta a authenticated.
