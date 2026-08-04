# PR2 — Matriz RLS / Grants

> Diseño de referencia para la migración PR2. NO es SQL ejecutable.
> Roles considerados: `anon`, `authenticated`, `service_role`, y funciones
> `SECURITY DEFINER` (equivalen a `postgres`).

## 1. Principios

1. **No ampliar grants de `profiles`** — se mantiene el hardening (authenticated solo SELECT de tabla + column-level INSERT/UPDATE de campos personales).
2. **`authenticated` no escribe directamente `worker_data_events`, `worker_consents` ni `worker_preferences`** — solo a través de RPC SECURITY DEFINER del dominio.
3. **`authenticated` no escribe directamente las nuevas columnas laborales de `payroll_contexts`** — solo vía `WorkerProfileService` (RPC específicas).
4. **`authenticated` no puede elegir otro `user_id`** — toda RPC toma `auth.uid()`; toda RLS filtra por `auth.uid()`.
5. **Funciones SECURITY DEFINER con `search_path` endurecido** (solo `public`, sin `$user`) y `REVOKE ALL ... FROM PUBLIC`.
6. **Ninguna tabla nueva queda sin policies** (relevante por `rls_auto_enable` remoto).
7. **No hay RPC genérica que acepte objetos/columnas arbitrarios.** Cada operación de dominio tiene su RPC específica con parámetros tipados y validados.

## 2. Matriz de tabla × rol × operación

### 2.1 `worker_preferences` (nueva)

| Rol | SELECT | INSERT | UPDATE | DELETE | Grant |
|-----|:------:|:------:|:------:|:------:|-------|
| `anon` | ❌ | ❌ | ❌ | ❌ | — |
| `authenticated` | ✅ (propio) | ❌ directo | ❌ directo | ❌ directo | `GRANT SELECT ON ... TO authenticated` |
| `service_role` | ✅ | ✅ | ✅ | ✅ | default (RLS bypass) |
| Función SECURITY DEFINER | ✅ | ✅ | ✅ | ✅ | owner |

**RLS:**
- SELECT: `user_id = auth.uid()`
- INSERT/UPDATE/DELETE: **sin policy de usuario** — solo RPC de dominio.

**Cambios de estado SOLO vía RPC de dominio** (§3). El cliente nunca escribe `onboarding_state` ni `preferred_worker_mode` libremente.

**Constraints de combinación (§6 del esquema):**
- `onboarding_state IN ('unconfigured','basic','configured')`
- `preferred_worker_mode IN ('manual','payslip')` o `NULL`
- `CHECK (onboarding_state = 'configured' OR preferred_worker_mode IS NULL)` → si no está `configured`, el modo preferido debe ser `NULL`.
- `CHECK (onboarding_state <> 'configured' OR preferred_worker_mode IS NOT NULL)` → si está `configured`, el modo preferido es obligatorio.

### 2.2 `payroll_contexts` (existente + columnas nuevas)

| Rol | SELECT | INSERT | UPDATE | DELETE | Grant |
|-----|:------:|:------:|:------:|:------:|-------|
| `anon` | ❌ | ❌ | ❌ | ❌ | — (solo REFERENCES/TRIGGER/TRUNCATE) |
| `authenticated` | ✅ (propio) | ❌ genérico | ❌ genérico | ❌ genérico | `GRANT SELECT ON ... TO authenticated` |
| `service_role` | ✅ | ✅ | ✅ | ✅ | default |
| Función SECURITY DEFINER | ✅ | ✅ | ✅ | ✅ | owner |

**RLS existentes (se mantienen):** SELECT/INSERT/UPDATE/DELETE con `user_id = auth.uid()` — **pero el frontend nuevo no recibe grants de escritura**, por lo que las policies de INSERT/UPDATE/DELETE solo son alcanzables por `service_role`/owner.

**Columnas nuevas (matricula, adscripcion, shift, source_*):**
- **NO se conceden grants de INSERT/UPDATE columnares a `authenticated`.** Solo las RPC de `WorkerProfileService` (§3) las escriben.
- El frontend nuevo las lee vía SELECT (RLS propio).

**Compatibilidad temporal del legacy:**
- El código legacy (`payroll-consent.ts`, `confirm_imported_payslip`, wizard de nómina) **puede conservar temporalmente** los permisos estrictamente necesarios (INSERT/UPDATE vía RPC y/o columnar existente).
- **Debe documentarse como compatibilidad temporal con fecha de retiro** (ver `PR2_ROLLBACK_PLAN.md` y el plan de PR8). No se conceden permisos nuevos de escritura al frontend nuevo.

### 2.3 `worker_consents` (nueva)

| Rol | SELECT | INSERT | UPDATE | DELETE | Grant |
|-----|:------:|:------:|:------:|:------:|-------|
| `anon` | ❌ | ❌ | ❌ | ❌ | — |
| `authenticated` | ✅ (propio) | ❌ directo | ❌ directo | ❌ directo | `GRANT SELECT ON ... TO authenticated` |
| `service_role` | ✅ | ✅ | ✅ | ✅ | default |
| RPC `get_effective_consent` (SECURITY DEFINER) | ✅ | — | — | — | owner |

**RLS:**
- SELECT: `user_id = auth.uid()`
- INSERT/UPDATE/DELETE: **sin policy de usuario** — solo vía RPC de dominio.

**Escritura:** RPC específicas `grant_worker_consent(...)` y `revoke_worker_consent(...)` (ver §3). Cada aceptación crea una fila nueva; la revocación apunta al consentimiento vigente; no se sobrescribe evidencia histórica.

### 2.4 `worker_data_events` (nueva)

| Rol | SELECT | INSERT | UPDATE | DELETE | Grant |
|-----|:------:|:------:|:------:|:------:|-------|
| `anon` | ❌ | ❌ | ❌ | ❌ | — |
| `authenticated` | ✅ (propio) | ❌ directo | ❌ directo | ❌ directo | `GRANT SELECT ON ... TO authenticated` |
| `service_role` | ✅ | ✅ | ✅ | ✅ | default |
| Función interna `_insert_worker_event` (SECURITY DEFINER) | — | ✅ | — | — | **solo owner, NO ejecutable por authenticated** |

**RLS:**
- SELECT: `user_id = auth.uid()`
- INSERT/UPDATE/DELETE: **sin policy de usuario**.

**Historial no falsificable (§2):**
- **NO existe `GRANT EXECUTE insert_worker_event TO authenticated`.**
- La función interna `_insert_worker_event(event_type, priority, metadata)`:
  - **no recibe `user_id`** (lo toma de `auth.uid()` al ser invocada en el contexto de la transacción de la RPC de dominio);
  - **no es ejecutable por `anon` ni `authenticated`** (solo owner);
  - solo la llaman las RPC de dominio controladas (dentro de su transacción);
  - valida metadata contra allowlist;
  - **calcula `event_type` y `priority` desde la operación de dominio**, no desde valores enviados por el cliente.
- El cliente nunca decide `event_type`, `priority` ni `created_at`.

## 3. RPC específicas de dominio (escritura exclusiva)

> Modelo de RPC. Todas: `SECURITY DEFINER`, `search_path` endurecido,
> `REVOKE ALL ... FROM PUBLIC`, `GRANT EXECUTE ... TO authenticated` (cuando el
> usuario deba iniciar la operación), `user_id` desde `auth.uid()` con rechazo
> si `auth.uid()` es NULL, validación de transición de estado y consentimiento,
> y escritura perfil + preferencia + consentimiento + evento en una misma
> transacción cuando corresponda.

| RPC | Parámetros | Operación | Evento generado |
|-----|-----------|-----------|-----------------|
| `choose_basic_mode()` | — | `unconfigured→basic`; no crea payroll_contexts; `preferred_worker_mode=NULL` | `mode_changed` (info) |
| `confirm_manual_worker_profile(p_identity jsonb, p_situation jsonb, p_sources jsonb)` | identidad+situación+sources tipados y validados contra allowlist de campos | `unconfigured/basic→configured(manual)`; crea/actualiza payroll_contexts; valida consentimiento `use_worker_data` | `profile_created`/`mode_changed` + `field_updated` |
| `confirm_payslip_worker_profile(p_update jsonb, p_consent_version text)` | update confirmado desde tarjetón | `unconfigured/basic/manual→configured(payslip)`; aplica update; registra consentimiento `store_tarjeton` | `tarjeton_imported` (important) + `field_updated` |
| `change_worker_profile_mode(p_new_mode text)` | `'manual'` \| `'payslip'` | `manual↔payslip`; conserva tarjetones al pasar a manual | `mode_changed` (info) |
| `delete_worker_data()` | — | borra payroll_contexts + tarjetones; `configured→basic`; `preferred_worker_mode=NULL`; revoca consents vigentes; conserva cuenta y events mínimos | `data_deleted` (critical) en la misma transacción |
| `grant_worker_consent(p_purpose text, p_version text)` | purpose+version validados contra allowlist del servidor | crea fila nueva en worker_consents | `consent_granted` (important) |
| `revoke_worker_consent(p_purpose text)` | purpose validado | revoca el consentimiento vigente de ese purpose | `consent_revoked` (important) |

**Reglas transversales:**
- **`accepted_source` NO se acepta del cliente**: lo determina la RPC de dominio (p. ej. `confirm_payslip_worker_profile` → `tarjeton`; `choose_basic_mode`/wizard → `onboarding` o `worker_center`).
- **`event_type`/`priority`** los calcula la RPC de dominio, no el cliente.
- **Sin RPC genérica** tipo `update_worker_profile(payload jsonb)`: cada operación valida sus propios campos permitidos y descarta el resto.

## 4. Matriz de funciones

| Función | security definer | search_path | execute | user_id desde |
|---------|:----------------:|:-----------:|:-------:|---------------|
| `ensure_profile_exists()` | sí | public | authenticated | `auth.uid()` |
| `confirm_imported_payslip(...)` | sí | public | authenticated | `auth.uid()` |
| `erase_user_payroll_data()` | sí | public | authenticated | `auth.uid()` |
| `choose_basic_mode()` | sí | public | authenticated | `auth.uid()` |
| `confirm_manual_worker_profile(...)` | sí | public | authenticated | `auth.uid()` |
| `confirm_payslip_worker_profile(...)` | sí | public | authenticated | `auth.uid()` |
| `change_worker_profile_mode(...)` | sí | public | authenticated | `auth.uid()` |
| `delete_worker_data()` | sí | public | authenticated | `auth.uid()` |
| `grant_worker_consent(...)` | sí | public | authenticated | `auth.uid()` |
| `revoke_worker_consent(...)` | sí | public | authenticated | `auth.uid()` |
| `get_effective_consent(...)` | sí | public | authenticated | `auth.uid()` |
| `_insert_worker_event(...)` (interna) | sí | public | **solo owner** | dentro de transacción de RPC de dominio |
| `backfill_worker_profile()` (admin/1x) | sí | public | **solo postgres/service_role** | n/a |

Todas las expuestas a authenticated: `REVOKE ALL ON FUNCTION ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`
`_insert_worker_event`: **sin** `GRANT EXECUTE TO authenticated`.

## 5. Guardas críticas

- `authenticated` **no fabrica eventos** (sin INSERT directo + `_insert_worker_event` no ejecutable por él).
- `authenticated` **no elige `event_type`/`priority`/`created_at`** (los calcula la RPC de dominio).
- `authenticated` **no acepta consentimiento por otro user** (RPC usa `auth.uid()`; purpose/version/source validados en servidor).
- `authenticated` **no escribe otro perfil ni `worker_preferences`** (`auth.uid()` en RLS y RPC).
- **Backfill** solo vía función admin (service_role), nunca expuesta a authenticated.
- **Sin grants de escritura** (tabla o columnar) de las columnas nuevas de `payroll_contexts` para authenticated.
