# REGISTRO DE PROGRESO — PANEL DE ADMINISTRACIÓN

> **Rama:** `feat/admin-panel`  
> **Fecha de inicio:** 2026-09-06  
> **Estado:** En ejecución

---

## Matriz de Tareas

| Tarea | Descripción | Estado | Archivos Principales | Pruebas |
|---|---|---|---|---|
| **T0** | Fijar punto de partida y contratos | COMPLETADO | `docs/admin/CHANGE_CONTRACT.md`, `docs/admin/PROGRESS.md` | Baseline suites (152 passed), typecheck, lint, build |
| **T1** | Acceso y estructura administrativa | COMPLETADO | `src/shared/server/admin/*`, layouts, `DesktopSidebar.tsx` | Permisos por rol/email, navegación segura (6 tests) |
| **T2** | Migraciones y servicios de contenido | COMPLETADO | Migración SQL, `types.ts`, `announcements-service.ts` | Integración Supabase, revisión optimista, RLS (10 tests) |
| **T3** | Editor y bandeja de trabajadores | COMPLETADO | `/admin/avisos/*`, `/avisos/*`, componentes | Ciclo de aviso, lectura idempotente, responsive |
| **T4** | Transporte, prueba y campañas inmediatas | COMPLETADO | `push-admin.ts`, `campaign-worker.ts`, `/admin/campanas/*` | Lotes <= 500, des-duplicación, SELF, URL parser (37 tests) |
| **T5** | Disparador cron y programación | COMPLETADO | `/api/cron/push-campaigns`, workflow GitHub Actions | Autenticación cron, reclamos transaccionales (23 tests) |
| **T6** | Barra informativa administrable | COMPLETADO | `mobile-bar-service.ts`, `MobileValueBar.tsx`, `/admin/barra` | Fusión con catálogo local, dismiss, safe area (34 tests) |
| **T7** | Resumen operativo útil | COMPLETADO | `/admin/page.tsx`, `admin-metrics-service.ts` | Agregados SQL, métricas reales sin fuga de PII (2 tests) |
| **T8** | Verificación integral y entrega | COMPLETADO | `ROLLOUT_ROLLBACK.md`, reportes de auditoría | Gates completos: typecheck (OK), lint (OK), test (160 suites / 1,621 tests OK), build (OK) |

---

## Bitácora de Ejecución

### T0 — Fijar el punto de partida (2026-09-06)
- Rama creada: `feat/admin-panel` desde `main` (`7cd9a69`).
- Verificación del baseline:
  - Pruebas unitarias/integración: 152 suites pasadas (1,571 tests OK, 1 skipped).
  - TypeScript: `npm run typecheck` completado sin errores.
  - Linting: `npm run lint` sin errores (88 advertencias previas preservadas).
  - Build de producción: `npm run build` completado exitosamente.
- Creados `docs/admin/CHANGE_CONTRACT.md` y `docs/admin/PROGRESS.md`.

### T1 — Acceso y estructura administrativa (2026-09-06)
- Servicio de capacidades puras: `src/shared/server/admin/admin-capabilities.ts`.
- Layout guard: `src/app/(dashboard)/admin/layout.tsx`.
- Hub administrativo inicial: `src/app/(dashboard)/admin/page.tsx`.
- Enlace condicional en `DesktopSidebar.tsx`, `DashboardShell.tsx` y `layout.tsx`.
- Tests unitarios: 6 pasados.

### T2 — Migraciones y servicios de contenido (2026-09-06)
- Migración `supabase/migrations/20260906140000_admin_announcements_campaigns.sql` con 7 tablas, sequence `push_campaign_notification_id_seq`, RPC `archive_announcement_atomic` y políticas RLS.
- Actualizado `src/lib/supabase/types.ts`.
- Contratos en `src/shared/contracts/announcements.ts`.
- Validador puro en `src/features/announcements/services/announcements-validate.ts` (10 tests).
- Servicios `announcements-service.ts` y `announcements-inbox.ts`.

### T3 — Editor y bandeja de trabajadores (2026-09-06)
- Server actions: `announcement-actions.ts`.
- Formulario de edición con preview en vivo y previsualizador de chips normativos: `AnnouncementForm.tsx`.
- Formulario de preferencias de notificación del trabajador: `PreferencesForm.tsx`.
- Páginas creadas: `/admin/avisos`, `/admin/avisos/nuevo`, `/admin/avisos/[id]`, `/avisos`, `/avisos/[id]`, `/avisos/preferencias`.

### T4 — Transporte, prueba y campañas inmediatas (2026-09-06)
- Endurecimiento de `src/features/push/services/push-admin.ts` (sanitización estricta de URL con `new URL()`, deduplicación de tokens, lotes <= 500, paginación, notificationId).
- Worker transaccional: `src/features/push/services/campaign-worker.ts` con snapshot, leasing atómico, reintentos con backoff exponencial.
- Server actions: `campaign-actions.ts`.
- Despachador de campañas: `CampaignDispatchForm.tsx`, `/admin/campanas/nueva`, `/admin/campanas/[id]`.
- Tests unitarios: 37 pasados.

### T5 — Disparador cron y programación (2026-09-06)
- Ruta API: `src/app/api/cron/push-campaigns/route.ts` protegida con Bearer `CRON_SECRET`.
- Registro público en `src/shared/server/routing/route-policy.ts`.
- Workflow de GitHub Actions: `.github/workflows/push-campaigns-cron.yml` (cada 15 minutos).
- Tests: `push-campaigns-cron.test.ts` y `route-policy.test.ts` (23 pasados). Typecheck OK.

### T6 — Barra informativa administrable (2026-09-06)
- Servicio `src/features/announcements/services/mobile-bar-service.ts` con reglas de elegibilidad, bloqueo automático de tips normativos sin revisión editorial formal (`requires_normativa_review`), mapeo y obtención con fallback.
- Función pura `mergeMobileBarItems` en `src/shared/components/app/mobileValueItems.ts`.
- Hidratación resiliente del lado cliente en `MobileValueBar.tsx` (conserva catálogo local intacto ante fallas de red).
- Ruta API: `GET /api/announcements/bar` registrada en `route-policy.ts`.
- Página administrativa: `src/app/(dashboard)/admin/barra/page.tsx` con preview móvil, estado de revisión editorial y visualizador del catálogo base.
- Tests: 18 tests en `mobile-bar-service.test.ts`, 16 tests preservados en `mobile-value-bar.test.tsx`, 21 tests en `route-policy.test.ts`. Typecheck OK.

### T7 — Resumen operativo útil (2026-09-06)
- Servicio `src/features/announcements/services/admin-metrics-service.ts` con consultas seguras de agregados (avisos por estado, tokens push registrados, estado de última campaña, latido de cron).
- Hub `/admin` renovado con tarjetas de métricas en vivo, sin fuga de PII ni bloqueos si la BD está fría.
- Accesos rápidos a herramientas operativas (push directo, vacaciones admin, releases Android, vista de trabajadores).
- Tests: `admin-metrics-service.test.ts` (2 pasados). Typecheck OK.

### T8 — Verificación integral y entrega (2026-09-06)
- Documento operativo creado: `docs/admin/ROLLOUT_ROLLBACK.md`.
- Verificación exhaustiva de compuertas de calidad:
  - `npm run typecheck`: 0 errores.
  - `npm run lint`: 0 errores (96 advertencias preexistentes del baseline preservadas, 0 nuevas).
  - `npm test`: 160 suites pasadas, 1,621 tests pasando, 0 fallas (baseline era 152 suites y 1,571 tests; +8 suites y +50 tests unitarios/integración agregados).
  - `npm run build`: Turbopack y compilación estática completadas exitosamente en 41s / 77 rutas.
- Estado: **ENTREGA LISTA PARA PR / MERGE**.
