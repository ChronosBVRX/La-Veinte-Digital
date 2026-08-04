# PR2 — Diseño de persistencia y seguridad del perfil laboral

> Fase de diseño. NO es SQL ejecutable. No se crea migración activa todavía.
> Basado en el esquema real auditado localmente (2026-08-04) y en los
> contratos del PR1 (`src/shared/domain/worker`).

## 1. Mapa objeto → consumidor → acceso → cambio futuro

### 1.1 `payroll_contexts` (tabla actual, 15 columnas)

| Columna | Consumidor | Tipo de acceso | Cambio futuro |
|---------|-----------|----------------|---------------|
| `user_id` (PK, FK→profiles.id ON DELETE CASCADE) | todos | RLS propio | se mantiene |
| `category_id` / `category_code` / `category_name` | prefill, tarjetón, nómina | R/W via RPC | se mantiene; `category_name` absorbe `profiles.categoria` |
| `workday_hours` | prefill, tiempo extra | R/W via RPC | se mantiene |
| `employment_type` | prefill, nómina | R/W via RPC | se mantiene; **discrepancia con contrato de dominio** (ver §1.4) |
| `effective_seniority_date` | prefill, vacaciones | R/W via RPC | se mantiene |
| `occupational_conditions` / `payroll_facts` / `recurring_concepts` / `siap_concept_marks` | nómina, tarjetón | R/W via RPC | se mantienen |
| `updated_at` | todos | server | se mantiene |
| `consent_given` / `consent_given_at` / `consent_version` | prefill (gate), tarjetón | R/W via RPC | **se migran a `worker_consents`** (versionado) en PR2 |
| *(nuevas)* `matricula`, `adscripcion`, `shift`, `source_*` | perfil laboral | vía servicio central | se agregan (ver §3) |

**Constraints actuales:** PK `user_id`; CHECKs de arrays jsonb; CHECK `workday_hours IN (6,6.5,8,12)`; CHECK `employment_type IN (base, confianza, eventual, confianza_a_estatuto)`; FK `user_id → profiles(id) ON DELETE CASCADE`.
**Índices:** solo PK.
**Grants:** `anon`/`authenticated` solo REFERENCES/TRIGGER/TRUNCATE (sin DML directo); `postgres` full; `service_role` REFERENCES/TRIGGER/TRUNCATE.
**RLS:** 4 políticas propias (SELECT/INSERT/UPDATE/DELETE con `user_id = auth.uid()`).

### 1.2 Funciones SECURITY DEFINER (search_path = public)

| Función | Acceso | Uso actual | Cambio futuro |
|---------|--------|-----------|---------------|
| `confirm_imported_payslip(...)` | writes payroll_contexts, imported_payslips(+lines+obs), consent | tarjetón | mantiene persistencia del tarjetón; delega perfil al servicio central |
| `confirm_imported_payslip_v1(...)` | alias | compatibilidad | deprecar |
| `ensure_profile_exists()` | upsert profiles.id | onboarding/profilo | se mantiene |
| `erase_user_payroll_data()` | DELETE imported_payslips + payroll_contexts | borrado laboral | se amplía a events/consents según política (§5) |

### 1.3 Consumidores TypeScript

| Módulo | Tablas | Acceso |
|--------|--------|--------|
| `payroll-consent.ts` | payroll_contexts (grant/revoke/fetch, saveProfileRemote) | R/W authenticated via RLS |
| `build-calculator-prefill.ts` | profiles (SELECT), payroll_contexts (SELECT gate), imported_payslips (SELECT) | read-only |
| `confirm-tarjeton.ts` | vía RPC | server |
| `payslip-sync.ts` / `useNomina` | localStorage `nomina_*` | cliente local |
| `EscritosGenerator` / `TodayCard` / dashboard | profiles | read-only |

### 1.4 Discrepancias detectadas (deben resolverse en PR2, no silenciosamente)

1. **`employment_type`:** el CHECK DB permite `base, confianza, eventual, confianza_a_estatuto`; el contrato de dominio (`EmploymentType`) permite `base, sustituto, interino, obra_determinada, confianza, otro`. Hay que decidir si el dominio se adapta al DB o viceversa. **Recomendación:** el DB es el que ya está en producción; el dominio debe alinearse o documentarse la diferencia sin romper el CHECK.
2. **`antiguedad` de `profiles` es texto libre** (`"18 años 3 meses"`); `effective_seniority_date` es DATE. El backfill no puede convertir texto arbitrario a fecha de forma fiable → se documenta por fila (ver PR2_BACKFILL_PLAN).
3. **`categoria` de `profiles` (texto) vs `category_name` de payroll_contexts (texto)** — misma semántica; backfill conservador (ver plan).

---

## 2. `worker_preferences` — decisión de diseño

### 2.1 Por qué se necesita

El estado de onboarding **no debe depender de que exista una fila laboral**. Si `mode='basic'` viviera en `payroll_contexts`, borrar datos laborales (que elimina esa fila) perdería la decisión de "elegí modo básico" y el usuario volvería a verse `unconfigured`. `worker_preferences` es una entidad de cuenta pequeña e independiente del perfil laboral.

### 2.2 Esquema

```
worker_preferences
- user_id                uuid PK REFERENCES profiles(id) ON DELETE CASCADE
- onboarding_state       text NOT NULL CHECK (onboarding_state IN ('unconfigured','basic','configured'))
- preferred_worker_mode  text CHECK (preferred_worker_mode IN ('manual','payslip'))
- created_at             timestamptz NOT NULL DEFAULT now()
- updated_at             timestamptz NOT NULL DEFAULT now()
- CHECK (onboarding_state = 'configured' OR preferred_worker_mode IS NULL)
- CHECK (onboarding_state <> 'configured' OR preferred_worker_mode IS NOT NULL)
```

**Constraints de combinación (§6 de decisiones):**
- Si `onboarding_state <> 'configured'` (es decir, `unconfigured` o `basic`), `preferred_worker_mode` **debe** ser `NULL`.
- Si `onboarding_state = 'configured'`, `preferred_worker_mode` **debe** ser `'manual'` o `'payslip'`.

**Escritura:** el usuario **no escribe `onboarding_state` ni `preferred_worker_mode` libremente**. Solo las RPC de dominio (§3 de la matriz RLS) cambian estos valores según las transiciones definidas.

### 2.2b Transiciones de onboarding (solo vía RPC)

| Transición | RPC | preferred_worker_mode |
|-----------|-----|------------------------|
| `unconfigured → basic` | `choose_basic_mode()` | `NULL` |
| `unconfigured → configured` | `confirm_manual_worker_profile(...)` / `confirm_payslip_worker_profile(...)` | `manual` / `payslip` |
| `basic → configured` | `confirm_manual_worker_profile(...)` / `confirm_payslip_worker_profile(...)` | `manual` / `payslip` |
| `configured → basic` | `delete_worker_data()` | `NULL` |

### 2.3 Justificaciones por evento

| Evento | Comportamiento |
|--------|----------------|
| **Registro** | Se crea fila `worker_preferences` con `onboarding_state='unconfigured'`, `preferred_worker_mode=NULL`. Se crea en el mismo flujo que `ensure_profile_exists` (idempotente). |
| **Elegir modo básico** | `onboarding_state='basic'`, `preferred_worker_mode=NULL`. No se crea `payroll_contexts`. |
| **Elegir configurar** | `onboarding_state='configured'`, `preferred_worker_mode='manual'` o `'payslip'` según método. Se crea `payroll_contexts` al confirmar. |
| **Borrar datos laborales** | `payroll_contexts` se elimina (vía `erase_user_payroll_data`); `worker_preferences.onboarding_state` pasa a `'basic'`, `preferred_worker_mode=NULL`. **La cuenta y la preferencia básica se conservan.** |
| **Eliminar cuenta** | `worker_preferences` se elimina por `ON DELETE CASCADE` (igual que profiles). |
| **Evitar confusión basic vs vacío** | `unconfigured` = nunca eligió; `basic` = eligió explícitamente no guardar datos. La presencia o ausencia de `payroll_contexts` ya no codifica la decisión. |

### 2.4 Alcance v1

Solo `onboarding_state` y `preferred_worker_mode`. No se añaden preferencias futuras (tema, idioma, IA) en esta primera versión.

---

## 3. `payroll_contexts` extendido — columnas exactas

> Se agregan sobre la tabla existente. **NO se agrega `mode`** (vive en `worker_preferences`).

### 3.1 `matricula` (text, nullable, sin default)
- **Tipo:** `TEXT`
- **Nullable:** sí
- **Default:** `NULL`
- **Constraint:** ninguna (texto libre como en profiles)
- **Índice:** no necesario (1×1 por usuario)
- **Grant:** columnar INSERT/UPDATE para `authenticated` (RLS ya filtra `user_id = auth.uid()`)
- **RLS:** policy propia heredada (misma fila)
- **Backfill:** `profiles.matricula`

### 3.2 `adscripcion` (text, nullable)
- Igual que `matricula`; backfill de `profiles.adscripcion`.

### 3.3 `shift` (text, nullable)
- **Tipo:** `TEXT`
- **Constraint:** `CHECK (shift IS NULL OR shift IN ('matutino','vespertino','nocturno','jornada_acumulada','mixto'))`
- **Backfill:** ninguna fuente directa en profiles (hoy solo vive en localStorage `nomina_profile`); no se puede backfill → NULL.

### 3.4 `source_matricula`, `source_adscripcion`, `source_category_name`, `source_workday_hours`, `source_employment_type`, `source_shift`, `source_effective_seniority_date` (text, nullable)
- **Tipo:** `TEXT`
- **Constraint:** `CHECK (source IN ('manual','payslip_confirmed','calculated','inferred'))`
- **Default:** `NULL`
- **Backfill:** conservador; legacy de `profiles` se marca `'manual'` (no se inventa `payslip_confirmed`); categoría derivada de jornada → `'calculated'` solo si hay evidencia; si no hay evidencia → `'inferred'`. Detalle en PR2_BACKFILL_PLAN.

### 3.5 `updated_at`
- **Ya existe** (`timestamptz NOT NULL DEFAULT now()`). No se re-agrega.

### 3.6 Notas transversales
- Toda columna nueva es aditiva (ADD COLUMN IF NOT EXISTS).
- Las nuevas columnas se gobiernan por las políticas RLS existentes de la tabla (por fila `user_id = auth.uid()`).
- **`grant` de las columnas nuevas:** NO se conceden grants de INSERT/UPDATE (ni de tabla ni columnares) a `authenticated`. Solo las RPC de `WorkerProfileService` escriben estas columnas. El frontend nuevo las lee vía SELECT (RLS propio).
- El código legacy (wizard de nómina, `confirm_imported_payslip`) conserva temporalmente los permisos estrictamente necesarios, documentados como **compatibilidad temporal con fecha de retiro** (PR8).

---

## 4. `worker_consents` — registros versionados

### 4.1 Esquema

```
worker_consents
- id            uuid PK DEFAULT gen_random_uuid()
- user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
- purpose       text NOT NULL CHECK (purpose IN ('use_worker_data','store_tarjeton'))
- version       text NOT NULL
- accepted_at   timestamptz NOT NULL
- accepted_source text NOT NULL CHECK (accepted_source IN ('onboarding','worker_center','tarjeton','settings'))
- revoked_at    timestamptz
- created_at    timestamptz NOT NULL DEFAULT now()
- UNIQUE (user_id, purpose, version)
```

### 4.2 Decisiones

| Pregunta | Respuesta |
|----------|-----------|
| **Unicidad** | `(user_id, purpose, version)`. Cada aceptación es un registro distinto. |
| **Reaceptación** | **Cada aceptación crea una fila nueva.** No se usa UPSERT que borre `accepted_at` histórico. Si se reacepta la misma `version` tras revocación, se crea una fila nueva con su propio `accepted_at` (la evidencia histórica de la aceptación anterior se conserva intacta). |
| **Consentimiento vigente** | La fila con `revoked_at IS NULL` y el `accepted_at` más reciente para el `purpose`. Función server `get_effective_consent(user_id, purpose)` (SECURITY DEFINER). |
| **Revocación** | Apunta al **consentimiento vigente** (`revoked_at IS NULL`): `UPDATE ... SET revoked_at = now() WHERE user_id=? AND purpose=? AND revoked_at IS NULL`. No se borra la fila (historial). |
| **Propósito y versión** | Se validan contra **allowlists del servidor** dentro de la RPC; el cliente no los envía libremente. |
| **accepted_source** | **No se acepta libremente del cliente**: lo determina la RPC de dominio (onboarding, worker_center, tarjeton o settings según la operación). |
| **Tras borrar datos laborales** | Se conservan los registros de consentimiento (evidencia histórica) con `revoked_at` seteado para las finalidades activas. No se borra la evidencia. |
| **Al eliminar cuenta** | Se borran por `ON DELETE CASCADE` (igual que profiles). |
| **IP / user-agent** | **NO se guardan en v1.** Si más adelante se requieren, se declaran en el aviso y se agregan columnas con retención documentada. |

---

## 5. `worker_data_events` — historial append-only

### 5.1 Esquema

```
worker_data_events
- id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
- user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
- event_type    text NOT NULL CHECK (event_type IN ('profile_created','mode_changed','tarjeton_imported','field_updated','consent_granted','consent_revoked','data_deleted'))
- priority      text NOT NULL CHECK (priority IN ('info','important','critical'))
- metadata      jsonb NOT NULL DEFAULT '{}'::jsonb
- created_at    timestamptz NOT NULL DEFAULT now()
```

### 5.2 Reglas de acceso

| Operación | authenticated | Función interna `_insert_worker_event` (SECURITY DEFINER) |
|-----------|---------------|------------------------------------------------------------|
| SELECT | ✅ solo `user_id = auth.uid()` (RLS) | ✅ (postgres) |
| INSERT | ❌ **no directo** | ✅ solo llamada por RPC de dominio controladas |
| UPDATE | ❌ | ❌ (append-only, ni servicio) |
| DELETE | ❌ | ❌ salvo limpieza admin/cuenta (cascade) |

### 5.3 Cómo insertar sin conceder service_role al frontend

- **NO existe `GRANT EXECUTE insert_worker_event TO authenticated`.** El historial no es falsificable.
- Función interna `_insert_worker_event(event_type, priority, metadata)`:
  - **no recibe `user_id`** — lo toma de `auth.uid()` en el contexto de la transacción de la RPC de dominio que la invoca;
  - **no es ejecutable por `anon` ni `authenticated`** (solo owner / postgres);
  - solo la llaman las RPC de dominio controladas (§3 de la matriz RLS) dentro de su misma transacción;
  - valida `metadata` contra la **allowlist** (claves de `validateWorkerEventMetadata` del PR1): `modeFrom, modeTo, field, source, consentVersion, consentPurpose, extractionMethod, confidence, period`;
  - **calcula `event_type` y `priority` desde la operación de dominio** que la invoca, no desde valores enviados por el cliente;
  - `created_at` lo fija la BD (`DEFAULT now()`), el cliente no puede decidirlo.
- Sin `INSERT` directo a la tabla para `authenticated` (ni siquiera con RLS de propio user).

### 5.4 Política de conservación

- **Borrar datos laborales:** se inserta `data_deleted` (critical) en la misma transacción; se conservan solo eventos mínimos no sensibles (`data_deleted`, `consent_revoked`, `mode_changed`). Los eventos ligados a importaciones/campos pueden eliminarse si ya no son necesarios (decisión: conservar los no sensibles, eliminar los ligados a importaciones previas).
- **Eliminar cuenta:** todo el historial se elimina por cascade.

---

## 6. Matriz RLS / grants (detalle en PR2_RLS_GRANTS_MATRIX.md)

| Tabla | Rol | SELECT | INSERT | UPDATE | DELETE |
|-------|-----|:------:|:------:|:------:|:------:|
| `worker_preferences` | authenticated | ✅ propio | ❌ directo | ❌ directo | ❌ directo |
| `payroll_contexts` | authenticated | ✅ propio | ❌ genérico (solo RPC) | ❌ genérico (solo RPC) | ❌ genérico (solo RPC/legacy) |
| `worker_consents` | authenticated | ✅ propio | ❌ directo | ❌ directo | ❌ directo |
| `worker_data_events` | authenticated | ✅ propio | ❌ directo | ❌ directo | ❌ directo |

Condiciones globales:
- No se amplían grants de `profiles`.
- `authenticated` no puede elegir otro `user_id` (RLS por `auth.uid()`; RPC usan `auth.uid()`).
- Funciones SECURITY DEFINER con `search_path` endurecido y `REVOKE ... FROM PUBLIC`.
- Solo el servicio central (RPC de dominio específicas) escribe preferences, consents y events, y las columnas nuevas de `payroll_contexts`.

---

## 7. Compatibilidad remota (sin ejecución)

- Las 7 migraciones remotas sin archivo local y el hardening aplicado directamente **no** impiden una migración timestamp nueva.
- **Local:** la migración timestamp se aplica con `supabase db reset` (es aditiva y reproducible desde cero).
- **Remoto:** se aplicaría mediante **SQL preflight controlado** (como en el hardening de profiles), con backup previo y smoke tests; **sin** depender de que el ledger local/remoto coincida. No se usa `migration repair` ni `db push`.
- `rls_auto_enable` (solo remoto) auto-habilita RLS en tablas nuevas: por eso cada tabla nueva debe crear explícitamente sus policies en la migración (de lo contrario RLS quedaría sin policies y todo denegado para authenticated).

## 8. Rollback (detalle en PR2_ROLLBACK_PLAN.md)

- **Antes de recibir datos:** DROP de columnas/tablas nuevas es posible (no hay datos que perder).
- **Después de recibir datos:** NO basta DROP. Se usa feature flag / soft-disable, se conservan las tablas y columnas, y se restauran los lectores legacy. Nunca se borran columnas/tablas con datos sin respaldo y plan de exportación.

## 9. `employment_type` — resolución antes de SQL

### 9.1 Valores actuales en DB (CHECK de `payroll_contexts`)

`base`, `confianza`, `eventual`, `confianza_a_estatuto`

### 9.2 Valores del dominio PR1 (`EmploymentType`)

`base`, `sustituto`, `interino`, `obra_determinada`, `confianza`, `otro`

### 9.3 Matriz valor legacy → canónico

| Valor DB (legacy) | Valor dominio (canónico) | Equivalencia | Acción |
|-------------------|--------------------------|--------------|--------|
| `base` | `base` | **exacta** | sin cambio |
| `confianza` | `confianza` | **exacta** | sin cambio |
| `eventual` | — | **sin equivalencia** en el dominio | requiere confirmación manual o nuevo valor canónico |
| `confianza_a_estatuto` | — | **sin equivalencia** en el dominio | requiere confirmación manual o nuevo valor canónico |
| — | `sustituto` | **sin valor DB previo** | nuevo valor del dominio sin dato existente |
| — | `interino` | **sin valor DB previo** | nuevo valor del dominio sin dato existente |
| — | `obra_determinada` | **sin valor DB previo** | nuevo valor del dominio sin dato existente |
| — | `otro` | **sin valor DB previo** | nuevo valor del dominio sin dato existente |

> Nota: `sustituto`/`interino`/`obra_determinada`/`otro` no existen hoy en el CHECK DB. Cualquier correspondencia con valores legacy que no esté listada arriba **no se inventa**; si aparece un valor legacy sin equivalencia definida, se marca `requiere confirmación manual`.

### 9.4 Estrategia propuesta

**Opción recomendada: B — introducir valores canónicos nuevos con adaptador temporal.**

| Criterio | A (ampliar CHECK, mantener legacy) | B (canónicos nuevos + adaptador) | C (migrar gradual a enum nuevo) |
|----------|-------------------------------------|-----------------------------------|---------------------------------|
| Compatibilidad con datos existentes | Alta (no toca filas) | Media (nuevos valores; legacy intacto) | Baja (reescribe datos) |
| Impacto en fórmulas | Bajo (sin cambio de dominio) | Medio (adaptador en lectura) | Alto (renombra datos en fórmulas) |
| Impacto en UI | Ninguno | El wizard usa valores canónicos | Sustituye valores en UI |
| Rollback | Trivial | Simple (adaptador se retira) | Complejo (migración inversa) |
| Pruebas | Fáciles | Requieren mapeo legacy→canónico | Requieren migración de datos |

**Justificación de B:**
1. No rompe los datos existentes (`base`, `confianza`, `eventual`, `confianza_a_estatuto` siguen siendo válidos en el CHECK).
2. El dominio PR1 expone valores más expresivos; el adaptador traduce lectura/escritura entre ambos sin alterar fórmulas.
3. `eventual` y `confianza_a_estatuto` (legacy sin equivalente canónico claro) **no se eliminan ni se mapean forzadamente**: se conservan en el CHECK durante la transición y se documentan como `requiere confirmación manual` si el usuario los tiene.
4. Rollback simple: retirar el adaptador sin migración de datos.

**Acción concreta (NO autorizada todavía):** ampliar el CHECK para incluir los valores canónicos del dominio, manteniendo los legacy; un adaptador en el servicio traduce entre `EmploymentType` y el valor DB. No se modifica el CHECK hasta aprobación explícita.

## 10. Pruebas SQL planeadas (detalle en PR2_TEST_PLAN.md)

Onboarding, transiciones, aislamiento por usuario, fabricación de eventos, consentimiento por otro user, reaceptación, revocación, backfill idempotente, borrado conserva cuenta+basic, cascade por cuenta, metadata sensible rechazada, grants mínimos, combinaciones inválidas de `worker_preferences`, y comportamiento de cada valor `employment_type` legacy, db reset desde cero.

## 11. Decisión documentada: RLS, propietario y FORCE RLS

### 11.1 Propietario

| Objeto | Owner (local) |
|--------|---------------|
| `worker_preferences`, `worker_consents`, `worker_data_events` | `postgres` |
| `_insert_worker_event`, `backfill_worker_profile`, `choose_basic_mode`, `confirm_manual_worker_profile`, `confirm_payslip_worker_profile`, `change_worker_profile_mode`, `delete_worker_data`, `grant_worker_consent`, `revoke_worker_consent`, `get_effective_consent` | `postgres` |

En Supabase, `postgres` es un superusuario y **tiene BYPASSRLS** de forma implícita. Las funciones `SECURITY DEFINER` creadas por `postgres` se ejecutan con privilegios de `postgres` (bypass RLS) y con `search_path = pg_catalog, public`.

### 11.2 Por qué ENABLE RLS + ausencia de DML directo + RPC controlada es suficiente

- **ENABLE RLS** activa el filtrado por fila para todo acceso que NO provenga del owner con BYPASSRLS.
- `authenticated` **no tiene grants de INSERT/UPDATE/DELETE** sobre las tablas nuevas → aunque existiera policy, no puede escribir.
- `authenticated` **solo tiene SELECT** con policy `user_id = auth.uid()` → solo lee lo suyo.
- Toda escritura pasa por **RPC `SECURITY DEFINER`** (owner = `postgres`, BYPASSRLS) que:
  - toma `user_id` de `auth.uid()` (nunca del cliente),
  - valida payloads contra allowlists,
  - valida transición/consentimiento,
  - genera el evento en la misma transacción.
- Por tanto, la combinación **ENABLE RLS + sin grants DML + RPC controlada** impide: escritura directa, fabricación de eventos, escritura de otro usuario, y consentimientos falsificados. El usuario nunca interactúa con las tablas más allá del SELECT propio.

### 11.3 Qué ocurriría con FORCE ROW LEVEL SECURITY

`FORCE RLS` aplica el filtrado por fila **incluso al propietario de la tabla**, salvo que el rol tenga `BYPASSRLS` o sea superusuario. En este proyecto:

- Las RPC `SECURITY DEFINER` corren como `postgres` (superusuario, BYPASSRLS) → **FORCE RLS NO las afecta** (siguen pudiendo escribir).
- `postgres` (owner) también tiene BYPASSRLS → tampoco le afecta en acceso directo de mantenimiento.
- `authenticated` ya está restringido por falta de grants → FORCE RLS no añade protección a `authenticated` (no puede escribir de todos modos).

**Conclusión:** en el stack local actual, `FORCE ROW LEVEL SECURITY` **no añade seguridad real** porque el owner es superusuario con BYPASSRLS y `authenticated` no tiene grants de escritura. Añadirlo sería inofensivo pero no aportaría nada, y en un futuro donde una RPC `SECURITY DEFINER` no fuera owner/superusuario podría romper el servicio. **Se mantiene `ENABLE RLS` sin `FORCE`**, y la protección real descansa en la ausencia de grants DML + RPC validadas. Esta decisión se revisará si cambia el owner o se introducen roles no-superusuario.
