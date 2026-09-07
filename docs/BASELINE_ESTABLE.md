# BASELINE ESTABLE — La Veinte Digital

> **Snapshot verificado y protegido contra regresiones.**
> Esta tarea fue **exclusivamente de verificación y documentación**: no se
> desarrolló ninguna función nueva y no se modificó código funcional.

---

## 1. Identificación de la versión

| Campo | Valor |
|---|---|
| Fecha de la versión | 2026-09-06 (America/Mexico_City, UTC-6) |
| Rama | `main` |
| SHA exacto de `main` | `3bd9506058578df558bd8c4494e1df703b815be1` |
| Commit | Merge PR #75 `feat/agenda-tipos-y-calculo` (2026-09-06 16:18:08 -0600) |
| Tag anotado | `v2026.09.06-stable` (sobre el SHA anterior, sin sobrescribir tags previos) |
| Estado del árbol al verificar | Limpio (`git status --short` vacío; `main` sincronizado con `origin/main`, 0 ahead / 0 behind) |
| Baseline de gobernanza previo | Commit `d90ab2bbc2f4b648cb8ed0bed1801902cb9976da` (2026-09-05, `docs/STABLE_BASELINE.md`) — sigue vigente; este snapshot lo extiende, no lo sustituye |

---

## 2. Producción desplegada

| Campo | Valor |
|---|---|
| URL de producción | `https://la-veinte-digital.vercel.app` (alias: `https://la20.com.mx`) |
| Deployment Vercel vigente al verificar | `dpl_Cu4mgX5hAqeknzeghkcao8QoXCKu` (`https://la-veinte-digital-nif9jitmo-innovacion-sindicals-projects.vercel.app`) |
| Estado / entorno | `● Ready` / `Production` |
| Creado | 2026-09-06 16:18:11 -0600 (≈ 3 s después del merge de `main`, corresponde al auto-deploy de `main`) |
| SHA desplegado | `3bd9506058578df558bd8c4494e1df703b815be1` (por correlación temporal merge→deploy; el CLI de Vercel no expone el SHA git en `inspect`, verificar en el dashboard ante duda) |
| Salud observada | `GET /api/health` → HTTP 200; `GET /` → 307 a `/login` (guardia de auth operativa) |

---

## 3. Compuertas de calidad (salida real, 2026-09-06)

| Compuerta | Comando | Resultado |
|---|---|---|
| Tests | `npm test` (vitest run) | **PASS** — 164 archivos pasados, 1 omitido (165); **1652 tests pasados**, 10 omitidos (1662); duración 179.26 s; exit 0 |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | **PASS** — 0 errores; exit 0 |
| Lint | `npm run lint` (ESLint flat config) | **PASS** — **0 errores, 88 warnings** preexistentes; exit 0 |
| Build | `npm run build` (Next.js 16.2.12) | **PASS** — compilación y prerender exitosos; exit 0 |

> No se ejecutaron suites E2E (Playwright) en esta tarea: los gates
> unitarios/integración + typecheck + lint + build constituyen la evidencia
> registrada. Ver §9 Limitaciones.

---

## 4. Migraciones de base de datos

### 4.1. Ledger local (35 archivos en `supabase/migrations/`)

```
001_vacation_schema.sql
002_bitacora_schema.sql
003_payroll_contexts.sql
004_imported_payslips.sql
005_api_usage_log.sql
006_profiles_lifecycle.sql
007_base_schema.sql
008_seed_2027_and_validate.sql
009_right_to_erasure.sql
010_chat_policies.sql
011_quota_mexico_timezone.sql
012_tarjeton_consent.sql
013_payroll_erasure_rpc.sql
014_harden_tarjeton_confirmation.sql
015_sync_tarjeton_contract.sql
016_fix_tarjeton_profile_record.sql
017_diagnose_numeric_overflow.sql
20260804150936_harden_profile_privileges.sql
20260804162446_worker_profile_persistence.sql
20260810120000_android_releases.sql
20260812100000_transfer_documents.sql
20260812183000_tolerant_secondary_fields.sql
20260813000000_drop_retired_chat_forum.sql
20260824000000_worker_commitments.sql
20260825120000_centralize_bitacora_into_worker_commitments.sql
20260826000001_pgvector_normativa.sql
20260829000001_push_devices.sql
20260830000000_account_deletion.sql
20260903120000_update_payslip_due_date_on_duplicate.sql
20260903183000_atomic_payslip_vacation_due_date.sql
20260903210000_vacation_calendar_role_rules.sql
20260906000000_commitment_reminder_deliveries.sql
20260906120000_agenda_event_specific_details.sql
20260906140000_admin_announcements_campaigns.sql
20260906160000_agenda_general_reminder_and_types.sql
```

### 4.2. Estado remoto

- Último inventario remoto documentado: **2026-08-04**
  (`docs/schema-reconciliation/REMOTE_MIGRATION_HISTORY.md`,
  `MIGRATION_LIST.md`). Existe **deriva conocida** entre el ledger local y
  el historial remoto (migraciones `001`–`013` sin equivalente exacto
  remoto; versión `014` con contenido no equivalente). **No asumir
  equivalencia SQL por igualdad de nombres.**
- El CLI de Supabase **no está instalado en este entorno**, por lo que el
  ledger remoto **no pudo reconsultarse** en esta tarea (toda operación
  remota, incluso de lectura, exige herramientas y aprobación explícitas).
- Migraciones más recientes (2026-09-03 y 2026-09-06: vencimiento de
  tarjetón/vacaciones, `commitment_reminder_deliveries`, detalles por tipo
  de agenda, anuncios/campañas admin, tipos y recordatorio general):
  presentes en el repo y fusionadas a `main`; su **aplicación remota debe
  confirmarse en el dashboard de Supabase** antes de considerarse
  operativas en producción. El procedimiento de rollout del panel admin
  está en `docs/admin/ROLLOUT_ROLLBACK.md`.
- **Prohibido** `supabase db push`, `migration repair`, `db reset --linked`
  o cualquier escritura remota sin revisión y aprobación explícitas.

---

## 5. Funciones confirmadas como operativas

Verificado en esta tarea mediante gates en verde (§3) y sondas de
producción (§2), más suites de regresión existentes (especificación
ejecutable — prohibido modificarlas para ocultar regresiones):

- **Autenticación y guardia de rutas** (`src/proxy.ts`): `/` redirige a
  `/login` sin sesión; `/api/health` responde 200 en producción.
- **Agenda laboral** (`/bitacora`, `src/features/agenda-laboral/`):
  suites `canonical-agenda`, `commitment-form`, `commitment-reminders`,
  `commitments-validation`, `falta-calculo` en verde.
- **Notificaciones**: recordatorios de agenda (entregas idempotentes +
  cron `/api/cron/agenda-reminders`) y push/FCM (registro, campañas con
  snapshot, worker transaccional, cron `/api/cron/push-campaigns`) con
  suites en verde.
- **Panel administrativo** (`/admin`, tareas T0–T8 completadas según
  `docs/admin/PROGRESS.md`): avisos, barra móvil, campañas, push,
  métricas, con gates T8 en verde (160 suites / 1621 tests al cierre de
  T8; la suite actual registra 164 suites / 1652 tests por PR #75).
- **Resto del ecosistema protegido** (calculadoras con prerrelleno
  normativo, tarjetón 100% local, vacaciones, escritos, documentos,
  asistente IA, simulador, biblioteca normativa, Radio Studio): sin
  cambios en esta tarea; cubiertos por la suite en verde y por
  `docs/STABLE_BASELINE.md` + `docs/REGRESSION_GUARDRAILS.md`.

---

## 6. Arquitectura y estado: Agenda

- **Código:** `src/features/agenda-laboral/` (`components/`,
  `hooks/`, `lib/`, `services/`, `__tests__/`, `types.ts`).
  Persistencia en Supabase (`worker_commitments`) + caché local.
  Integración con inicio y calendario (`WelcomeCard`,
  `CalendarioLaboral`, `commitment-calendar.ts`).
- **Tipos permitidos para nuevas altas (5, lista cerrada en
  `PRIMARY_COMMITMENT_TYPES`, enforced por `commitments-validation.ts`):**
  1. `overtime` — Tiempo extra
  2. `falta_injustificada` — Falta injustificada
  3. `no_pagado` — Reclamación pendiente
  4. `txt_substitution` — TxT
  5. `general_reminder` — Recordatorio general (con prioridad
     `normal`/`importante`/`urgente`)
- **Tipos históricos (12 en el CHECK de BD; los no-PRIMARY se conservan
  solo lectura, sin pérdida de registros):** `shift_change` (Cambio de
  turno), `sport`, `guardia_festiva`, `incapacidad`, `pase_salida`,
  `vacaciones`, `other`, además de los 5 anteriores.
- **Conservación de históricos de Cambio de turno:** `shift_change`
  permanece en el constraint
  (`20260906160000_agenda_general_reminder_and_types.sql`), en
  `COMMITMENT_TYPE_LABELS` y en lecturas; la validación solo bloquea su
  **nueva alta**, jamás su lectura ni su borrado silencioso.
- **Cálculo canónico de faltas** (`lib/falta-calculo.ts`): quincena
  natural (1–15 / 16–fin de mes, bisiestos contemplados); descuento
  estimado = sueldo base tabular (concepto 002) ÷ 15; estado
  **"pendiente de calcular"** si no hay sueldo registrado (sin inventar
  cifras).
- **Detalles por tipo** (columna `details jsonb`, migración
  `20260906120000`): campos propios por registro con validación
  (p. ej. turno + autorizador en tiempo extra).

---

## 7. Arquitectura y estado: Notificaciones

- **Recordatorios de agenda:** servicio `commitment-reminders.ts`;
  tabla `commitment_reminder_deliveries` (unicidad por
  `commitment_id × reminder_type`; trigger que limpia entregas al
  cancelar/completar/reprogramar); tipos `DAY_BEFORE`, `HOURS_BEFORE`,
  `AT_START`, `SCHEDULED_TIME`; cron `GET /api/cron/agenda-reminders`
  (`vercel.json`: `0 1 * * *`) + workflow
  `.github/workflows/agenda-reminders-cron.yml`.
- **Push / campañas:** `src/features/push/` (registro FCM,
  `push-admin.ts` con lotes ≤ 500 y deduplicación, `campaign-worker.ts`
  con snapshot inmutable y leasing atómico); cron
  `/api/cron/push-campaigns` (Bearer `CRON_SECRET`) + workflow
  `push-campaigns-cron.yml` (cada 15 min).
- **Comunicados:** tablas `announcements`, `announcement_reads`,
  `notification_preferences`, `push_campaigns`,
  `push_campaign_deliveries`, `admin_audit_log`, `notification_job_runs`
  (migración `20260906140000`); bandeja del trabajador en `/avisos`
  (lecturas idempotentes) y preferencias en `/avisos/preferencias`.

---

## 8. Estado real del panel administrativo

- **Rutas:** `/admin` (hub con métricas agregadas sin fuga de PII),
  `/admin/avisos` (+ `/nuevo`, `/[id]`), `/admin/barra`,
  `/admin/campanas` (+ `/nueva`, `/[id]`), `/admin/push` (formulario
  heredado), `/admin/android`, más `/vacaciones/admin`.
- **Acceso** (`src/shared/server/admin/admin-capabilities.ts`): rol
  `admin` en `profiles` → acceso completo; email en
  `PUSH_ADMIN_ALLOWED_EMAILS` sin rol → solo `/admin/push`; resto → sin
  acceso. Layout guard + enlace condicional en navegación.
- **Progreso:** T0–T8 **COMPLETADAS** (`docs/admin/PROGRESS.md`);
  contrato en `docs/admin/CHANGE_CONTRACT.md`; rollout/rollback en
  `docs/admin/ROLLOUT_ROLLBACK.md`. Fusionado a `main` vía PR #74
  (commit `2291762`).
- **Nota operativa:** el panel es funcional en código y pruebas; su
  operación plena en producción depende de la migración
  `20260906140000_*` aplicada en remoto (§4.2) y de secretos de servidor
  (`CRON_SECRET`, FCM) configurados en Vercel.

---

## 9. Comportamiento protegido (vinculante)

1. **No modificar funciones existentes sin pruebas:** todo cambio de
   comportamiento exige pruebas que lo cubran; los tests existentes son
   la especificación ejecutable — un test que falla tras un cambio es
   una regresión hasta demostrar lo contrario; prohibido editar tests
   para ocultar regresiones.
2. **No cambiar contratos de base de datos sin migración y revisión:**
   ningún cambio de esquema/RLS/RPC sin archivo de migración
   versionado, revisión explícita y verificación contra la deriva
   documentada en `docs/schema-reconciliation/`; prohibidas escrituras
   remotas no aprobadas.
3. **No ocultar ni eliminar registros históricos:** los tipos de Agenda
   fuera de `PRIMARY_COMMITMENT_TYPES` (incluido `shift_change`) se
   conservan legibles; prohibido borrar, archivar silenciosamente o
   dejar inaccesibles registros de usuario.
4. **No modificar Android (ni iOS) salvo autorización expresa:** esta
   tarea no tocó `android-app/` ni `ios-app/` (árbol limpio en ambas
   rutas; §10); cualquier cambio nativo exige bump de versión + doc +
   OTA documentada según `docs/ANDROID_APP.md`.
5. **No desplegar cambios que no pasen las compuertas de calidad:**
   `npm test`, `npm run typecheck`, `npm run lint` (0 errores) y
   `npm run build` deben pasar; ningún deploy con gates en rojo.

---

## 10. Confirmación: Android no fue modificado

- `git status --short -- android-app/ ios-app/` → **vacío** (sin cambios).
- Último cambio en `android-app/`: commit preexistente `84ff195`
  `release(android): canonical versioning 1.1.4 (204)` — anterior a esta
  tarea, intacto.
- Alcance real de esta tarea: **solo documentación**
  (`README.md`, `AGENTS.md`, `docs/BASELINE_ESTABLE.md`,
  `CHANGELOG.md`) + **tag anotado**. Cero cambios funcionales en web,
  Android, iOS, migraciones o contratos.

---

## 11. Limitaciones conocidas

- Ledger remoto de migraciones no reconsultado aquí (sin CLI Supabase en
  el entorno); deriva histórica documentada desde 2026-08-03/04.
- SHA desplegado establecido por correlación temporal merge→deploy;
  confirmación definitiva en el dashboard de Vercel.
- E2E Playwright no ejecutado en esta tarea.
- Operación plena del panel admin y recordatorios en producción sujeta a
  migraciones remotas (§4.2) y secretos de servidor en Vercel.
- Tabulador Base expira **2026-10-15** (independiente del CCT 2025-2027,
  vigente hasta 2027-10-15); Estatutos SNTSS edición octubre 2022
  (`PENDING_REVIEW`, nunca etiquetar "vigentes 2026").
- OCR de tarjetones escaneados depende de `public/vendor/` (gitignored,
  regenerado por `predev`/`prebuild`) con fallback a CDN.

---

## 12. Archivos tocados por esta tarea (delta completo autorizado)

```
README.md
AGENTS.md
docs/BASELINE_ESTABLE.md   (creado)
CHANGELOG.md
```

Ningún otro archivo fue modificado. Verificar con
`git status --short` y `git diff --stat`.
