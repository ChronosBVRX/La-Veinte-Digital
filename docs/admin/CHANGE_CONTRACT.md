# CONTRATO DE CAMBIO — PANEL DE ADMINISTRACIÓN DE LA VEINTE DIGITAL

> **Fecha:** 6 de septiembre de 2026  
> **Repositorio:** `ChronosBVRX/La-Veinte-Digital`  
> **Rama base:** `main` (`7cd9a69672fe583089a6758269c24db7d29927a3`)  
> **Rama de trabajo:** `feat/admin-panel`  
> **Baseline protegido de referencia:** `d90ab2bbc2f4b648cb8ed0bed1801902cb9976da`  
> **Gobernanza:** `AGENTS.md`, `docs/STABLE_BASELINE.md`, `docs/REGRESSION_GUARDRAILS.md`

---

## 1. REQUESTED DELTA
Construir e integrar el Panel de Administración editorial y operativo para La Veinte Digital según las tareas **T0 a T8** (prioridades **P0** y **P1**):
- **P0:** Avisos con push Android y bandeja dentro de la plataforma (`/avisos`, `/avisos/[id]`, `/admin/avisos`).
- **P0:** Flujo seguro de prueba a cuenta propia (`SELF`), previsualización, confirmación previa e historial de campañas.
- **P0:** Acceso administrativo unificado y comprobado en servidor basado en `profiles.role === "admin"`, preservando compatibilidad estricta con accesos heredados (`PUSH_ADMIN_ALLOWED_EMAILS`, `PUSH_ADMIN_EMAILS`, `PUSH_ADMIN_KEY`).
- **P1:** Campañas inmediatas y programadas con worker duradero de lotes, exclusión mutua de reclamos (`lease_until`), reintentos y cancelación.
- **P1:** Mensajes administrables para la barra inferior compacta (`MobileValueBar`) con respaldo en catálogo local.
- **P1:** Resumen operativo de salud y campañas en `/admin` con contadores agregados reales y sin fuga de datos sensibles.
- **P1:** Disparador cron independiente (`/api/cron/push-campaigns` + `.github/workflows/push-campaigns-cron.yml`).

---

## 2. ALLOWED SCOPE
Archivos concretos de las tareas T0 a T8 y sus consumidores directos estrictamente indispensables:
- `docs/admin/*` (`CHANGE_CONTRACT.md`, `PROGRESS.md`, `ROLLOUT_ROLLBACK.md`).
- `supabase/migrations/20260906140000_admin_announcements_campaigns.sql` y `src/lib/supabase/types.ts`.
- `src/shared/server/admin/*` (evaluador centralizado de capacidades administrativas server-side).
- `src/shared/server/routing/route-policy.ts` (registro exhaustivo de nuevas APIs).
- `src/app/(dashboard)/layout.tsx`, `src/shared/components/layout/DashboardShell.tsx`, `src/shared/components/app/DesktopSidebar.tsx`, `src/app/(dashboard)/admin/layout.tsx`.
- `src/features/announcements/*` (servicios, contratos, acciones y componentes de avisos y bandeja).
- `src/features/push/services/push-admin.ts` (paginación, lotes <= 500, des-duplicación, URL parsing y asignación de ID numérico), `campaign-worker.ts`, `campaign-actions.ts`.
- `src/app/(dashboard)/admin/*` (páginas `/admin`, `/admin/avisos`, `/admin/avisos/nuevo`, `/admin/avisos/[id]`, `/admin/campanas/[id]`, `/admin/barra`).
- `src/app/(dashboard)/avisos/*` (páginas `/avisos`, `/avisos/[id]`, `/avisos/preferencias`).
- `src/features/announcements/services/mobile-bar-service.ts` y cableado no invasivo en `src/shared/components/app/MobileValueBar.tsx`.
- `src/app/api/cron/push-campaigns/route.ts` y `.github/workflows/push-campaigns-cron.yml`.
- Suites de pruebas asociadas en `src/features/push/__tests__/`, `src/features/announcements/__tests__/`, `src/shared/server/admin/__tests__/`, etc.

---

## 3. PROTECTED BEHAVIOR
Comportamientos protegidos existentes que DEBEN conservarse intactos sin degradación:
- **Autenticación y Seguridad:** Sesión SSR con cookies PKCE, proxy en `src/proxy.ts`, `requireUser()`, inmutabilidad de `profiles.role` mediante el trigger `guard_profile_protected_fields()`.
- **Registro de Dispositivos Push:** Tabla `push_devices`, RPCs `register_push_device` y `unregister_push_device`, componente `PushTokenSync`. El registro sigue reactivando `notifications_enabled`, pero la nueva preferencia editorial vive en `notification_preferences`.
- **Recordatorios de Agenda:** Servicio `commitment-reminders.ts`, tabla `worker_commitment_reminder_deliveries`, cron `/api/cron/agenda-reminders` y workflow `.github/workflows/agenda-reminders-cron.yml`. Ninguna campaña editorial puede interferir ni modificar recordatorios personales de agenda.
- **Barra Informativa Móvil (`MobileValueBar`):** Una sola fila compacta, cierre por sesión en `sessionStorage`, ocultamiento con teclado abierto, respeto estricto a `prefers-reduced-motion`, área segura móvil, sin loader propio y sin introducir una nueva capa de Back. Fallback permanente al catálogo local `MOBILE_VALUE_ITEMS`.
- **Módulos Laborales:** Fórmulas de nómina, cálculo de 2ª de Julio y Fondo de Ahorro, importación y balance de tarjetones (100% cliente), calculadoras, asesor vacacional, generador de escritos, visor unificado y RAG normativo.
- **Bridges Nativos:** Compatibilidad intacta con Android e iOS. En Android, `LaVeinteFirebaseMessagingService.kt` ya parsea `data["id"]?.toIntOrNull()`; se envía el `notification_id` de la campaña como string para permitir coexistencia de notificaciones sin alterar código nativo.

---

## 4. DEPENDENCIES
- **Web App:** Next.js 16 App Router, React 19, TypeScript 5, Supabase SSR.
- **Android App:** App instalada con FCM service esperando campos `type`, `title`, `body`, `destination`, `id`, `silent`.
- **iOS App:** WebView persistente y puente `LaVeinteBridge` intacto.
- **Supabase PostgreSQL:** Base de datos relacional con RLS activado, triggers de integridad y RPCs transaccionales.
- **Firebase Admin SDK:** Servicio de entrega multicast FCM.
- **GitHub Actions:** Programador cron para invocación de `/api/cron/push-campaigns`.

---

## 5. REGRESSION TESTS
- **Pruebas Existentes Protegidas:**
  - `src/features/push/__tests__/push-authorize.test.ts`
  - `src/features/push/__tests__/push-rate-limit.test.ts`
  - `src/features/push/__tests__/push-validate.test.ts`
  - `src/shared/server/routing/__tests__/route-policy.test.ts`
  - `src/features/agenda-laboral/tests/commitment-reminders.test.ts`
  - `src/shared/components/app/__tests__/mobile-value-bar.test.tsx`
  - `src/shared/components/app/__tests__/dashboard-shell.test.tsx`
  - Suite completa de 152 archivos de tests ejecutada vía `npm test`.
- **Nuevas Pruebas Requeridas:**
  - Sanitización de destinos URL (`push-sanitize-destination.test.ts` con origen exacto y rechazo de bypasses).
  - Lotes FCM <= 500, deduplicación de tokens, paginación y manejo de UNREGISTERED.
  - Exclusión mutua de workers con claims y reintentos.
  - Flujo de prueba SELF.
  - Matriz de capacidades administrativas por perfil y correo.
  - Ciclo de vida de avisos (DRAFT, PUBLISHED, ARCHIVED, lectura idempotente y concurrencia optimista).
  - Integración de items en `MobileValueBar` con catálogo local como respaldo.

---

## 6. OUT OF SCOPE
- **P2-A:** Segmentación por unidad/adscripción y categoría.
- **P2-B:** Contabilidad unificada de gasto/tokens de modelos IA y tope de USD 10/mes.
- **P2-C:** Editores libres de vacaciones, catálogo normativo o directorio sindical.
- **P3:** Patrocinios comerciales activos, automatización de radio studio y tickets de soporte.
- Refactorización de dependencias, reescritura de CSS o cambios arquitectónicos no solicitados.
