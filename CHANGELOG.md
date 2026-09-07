# Changelog

## [Unreleased] — Eliminación quirúrgica del Simulador de Nómina

### Removed
- Ruta `/simulador-nomina` (`src/app/(dashboard)/simulador-nomina/page.tsx`) y feature completa `src/features/simulador-nomina/**` (componentes `SimuladorNominaIndex`, `SimuladorNominaPageClient`, `ScenarioComparison`, servicio `simulate.ts` y tests unitarios).
- Enlaces y accesos al Simulador de Nómina en navegación desktop/móvil (`navigation.ts`, `QuickActionsGrid.tsx`, `herramientas/page.tsx`, `ImportSuccess.tsx`, `AnnouncementForm.tsx`, `safe-return-path.ts`, `guide-calculator-links.ts`, `guide-content.ts`).

### Changed
- Redirecciones canónicas: `/nomina` y `/nomina/proyeccion` redirigen a `/calculadoras`.
- `ImportSuccess.tsx`: enlace post-importación redirige a `/calculadoras`.

### Protected Behavior
- `src/features/nomina/**` (motor de nómina y fórmulas) 100% intacto.
- `src/features/calculators/**` (todas las calculadoras de nómina: Aguinaldo, Segunda de Julio, Tiempo Extra, Cláusula 97, Préstamos) 100% intactas.
- `src/features/simulador/**` y `/simulador` (Simulador de Audiencia) 100% intactos.
- Android nativo y Supabase sin alteraciones.

## [Unreleased] — Modo offline Android: documentos guardados sin conexión

### Added
- Pantalla nativa `OfflineDocumentsScreen` (Compose, sin WebView ni red): Todos/Tarjetones/Checadas/Escritos, abrir con visor local, compartir por `FileProvider`, eliminar canónico. Ruta `offline_documents` con Back correcto.
- `OfflineErrorScreen` evolucionada: "Sin conexión a Internet… Tus documentos guardados siguen disponibles." + [Ver mis documentos] + [Intentar de nuevo] (reintento intacto) + aviso "Conexión recuperada".
- Persistencia local de escritos: la web respalda el PDF definitivo en Room + `filesDir/escritos` (upsert por id de escrito, sin duplicar) vía protocolo fragmentado `saveStart/chunk/commit`; borrado web sincroniza la copia nativa.
- Detección real de offline: solo errores de conectividad del marco principal activan el fallback (HTTP 401/403/404/500 jamás), `NetworkMonitor` con `NET_CAPABILITY_VALIDATED`, arranque en modo avión soportado, recuperación con recarga única.
- Aislamiento por usuario: Room v4 (`ownerId`, `externalKey`, migración 3→4 aditiva, sin borrados); legacy visibles, otros usuarios ocultos; propietario informado por la web y limpiado al logout sin borrar.
- Docs: `docs/ANDROID_OFFLINE_DOCUMENTS.md` (propósito, arquitectura, almacenamiento, navegación, detección, recuperación, aislamiento, limitaciones, pruebas).

### Tests
- Android: `OfflineDetectionTest`, `NativeDocumentsOfflineTest` nuevos; `:app:testPlayDebugUnitTest` en verde; `assemblePlayDebug` + `assembleDirectDebug` OK (1.1.6/206).
- Web: `escrito-native-sync.test.ts` nuevo; `npm test` full en verde; `typecheck` 0 errores; `lint` 0 errores; `npm run build` OK.

### Protected Behavior
- Web con Internet idéntica; bridge compatible hacia atrás (APKs viejas responden error inocuo, jamás comparten por accidente); tarjetones/checadas reutilizan Room + `filesDir` existentes sin copiar ni duplicar; sin PWA, sin réplica de Supabase, sin WorkManager, sin migraciones destructivas.

### Deploy a producción (2026-09-06)
- Web: deployment `dpl_6cMkJN9guNMarctpcpEsR1UPfqbg` (`target: production`, `● Ready`) con aliases `https://la-veinte-digital.vercel.app` y `https://la20.com.mx`. Verificado: `GET /api/health` → 200, `GET /` → 307 a `/login`.
- Android: `bundlePlayRelease` generado (`app-play-release.aab`, 22 MB, v1.1.6/206, minificado, policy play/direct validada) y `LaVeinteDigital-direct-release-v1.1.6-b206.apk`. **Subida a Play Console pendiente (bloqueada por 2FA, acción del propietario).**

## [Unreleased] — Fix teclado móvil en modales (foco/remount)

### Fixed
- `src/shared/components/ui/Modal.tsx`: el efecto de inicialización/foco dependía de `[open, onClose]`; cada letra escrita en un formulario (nueva identidad de `onClose`) re-ejecutaba el autofocus al primer elemento (botón X), robando el foco y cerrando el teclado virtual. Ahora el efecto depende solo de `open` y Escape usa `onCloseRef` (siempre la callback vigente, sin closures obsoletas).
- `src/shared/components/ui/BottomSheet.tsx`: mismo defecto latente, misma corrección (sin consumidores actuales; sin cambio de comportamiento observable).
- `src/features/agenda-laboral/components/CommitmentForm.tsx`: `onClose` inline estabilizado con `useCallback` (`handleClose`; mismo `reset()` + `onClose()`).

### Tests
- `Modal.test.tsx`: "keeps focus in content input when onClose identity changes" (fallaba antes del fix) y "Escape calls the latest onClose after parent rerenders".
- `commitment-form.test.tsx`: "mantiene el foco al escribir de corrido" (fallaba antes del fix: foco robado al botón X).
- Gates: typecheck 0 errores; lint 0 errores y 88 warnings (idéntico al baseline); `npm test` 1655 passed / 10 skipped / 0 fallos (+3 pruebas nuevas); `npm run build` OK.

### Protected Behavior
- Sin cambios de UX, textos, campos, validaciones, navegación, almacenamiento, esquema de BD ni Android/iOS.

## [0.008] - 2026-09-06 — Snapshot estable v2026.09.06-stable (solo documentación)

### Governance
- Snapshot verificado de `main` `3bd9506058578df558bd8c4494e1df703b815be1` (merge PR #75): tag anotado `v2026.09.06-stable`. Extiende el baseline `d90ab2bb` (2026-09-05) sin sustituirlo.
- Compuertas en verde: `npm test` (164 suites / 1652 tests OK), `npm run typecheck` (0 errores), `npm run lint` (0 errores, 88 warnings preexistentes), `npm run build` (OK).
- Producción: `https://la-veinte-digital.vercel.app` (deployment `dpl_Cu4mgX5hAqeknzeghkcao8QoXCKu`, auto-deploy del HEAD).
- Comportamiento protegido declarado en `docs/BASELINE_ESTABLE.md`: sin cambios funcionales, Android/iOS intactos, históricos de Agenda (incluido Cambio de turno) preservados, 5 tipos autorizados para nuevas altas.

### Docs
- Creación de `docs/BASELINE_ESTABLE.md`: SHA, producción, gates, migraciones, Agenda/notificaciones/admin, limitaciones.
- `README.md`: Mi Agenda corregida (5 altas autorizadas + cálculo canónico + recordatorios), secciones de Panel de Administración y Notificaciones, tablas de BD ampliadas, puntero a versión estable.
- `AGENTS.md`: puntero al snapshot (sin cambios de gobernanza).

## [Unreleased] — Versionado Canónico Android 1.1.4 (204)

### Changed
- `versionCode` 203 → 204, `versionName` 1.1.3 → 1.1.4 (`android-app/app/build.gradle.kts`, única fuente de verdad).
- `LaVeinteBridgeInjector.appVersion()` y los 4 `configureForLaVeinte()` (WebViews interna, externa y portales IMSS) leen `BuildConfig.VERSION_NAME`: el User-Agent reporta `LaVeinteDigitalAndroid/1.1.4` y la web muestra la versión real.
- Nombre de APK con código de build: `LaVeinteDigital-<flavor>-<type>-v<version>-b<code>.apk`.
- Comparación del actualizador Direct centralizada en `isUpdateAvailable()` (solo `versionCode` ordena; semántica idéntica).
- Workflow `android-build.yml`: subida a Supabase con path explícito `direct/release` (sin `find|head` ambiguo) e input `promote` real (actualiza y publica `latest.json` solo con `promote=true`).
- Identidad del build: footer `Versión 1.1.4 (204) · Canal: Direct` en Servicios oficiales IMSS y log único `APP_BUILD version=… code=… channel=…` al arrancar.

### Protected Behavior
- Sin cambios a Back PR #66, feedback PR #67, fórmulas, navegación web, iOS ni políticas Play.

## [Unreleased] — Feedback Nativo de Navegación Android

### Added
- Paquete aislado `android-app/.../internal/navigation/`: `NavFeedbackController` (máquina IDLE→PENDING→VISIBLE→SLOW con generaciones, carga real prioritaria sobre watchdog SPA), `NavFeedbackEvents` (protocolo mínimo `intent`/`commit`), `NavFeedbackDetector` (script document-start que solo observa clicks internos e History API + `WebMessageListener` independiente `laVeinteNavFeedback` con la misma allowlist del PDF bridge) y `NativeNavigationOverlay` (scrim ligero, isotipo, indicador, "Cargando…" → "La conexión está tardando un poco…", solo fade, respeta animaciones reducidas y TalkBack).
- Cableado mínimo en `InternalWebScreen.kt`: controller post-splash, señales `onPageLoadStateChanged`/`onOffline`/externas, barra superior solo mientras el overlay no alcanzó su umbral. Sin tocar Back canónico, bridges, WebView, flavors ni web/iOS.
- 42 tests JVM nuevos (`NavFeedbackControllerTest`, `NavFeedbackEventsTest`, `NavFeedbackDetectorTest`).

### Protected Behavior
- PR #66 intacto: `window.LaVeinteNavigation`, `BackNavigationCoordinator`, `useBackLayer`, cooldown de Back y logs temporales `BACK_NAV`/`BACK_NAV_WEB` sin cambios. Suite web 1519 tests en verde sin modificar tests existentes.

## [0.007] - 2026-09-05 — Rediseño Integral de UX en Calculadoras

### Added
- Componentes UI compartidos y accesibles para el módulo de calculadoras:
  - `FriendlyCalculatorIntro`: Explicación en lenguaje humano de qué es la prestación, cuándo se paga y cómo se calcula.
  - `FriendlyField`: Campos de captura con etiquetas amigables, aclaraciones contextuales y ayuda desplegable.
  - `CalculationResultHero`: Resultado monetario destacado con tarjeta accesible y badge oficial.
  - `FriendlyBreakdown`: Desglose claro de percepciones y deducciones orientado al trabajador.
  - `WorkerExplanation`: Sección "¿Qué significa esto para ti?" explicando el impacto práctico.
  - `TechnicalDetails`: Acordeón técnico colapsado por defecto con fórmulas, claves CCT y fundamento normativo.
  - `CalculatorNotice`: Mensajes de aviso amigables y no alarmistas.
  - `TarjetonDataNotice`: Notificación sutil cuando los campos se precargan desde el tarjetón con opción de edición.

### Changed
- **Aguinaldo (`AguinaldoCalculator`)**: Introducción humana, desglose en 3 momentos de pago (Enero 047, Agosto 043, Diciembre 049) y detalle técnico colapsable.
- **Segunda de Julio (`SegundaJulioCalculator`)**: Flujo unificado con selector claro de periodo completo vs proporcional, tratamiento estricto de unidades computables (sin asumir que unidades = días), ayuda didáctica de 180 unidades (50%) y ruta `/calculadoras/segunda-julio-proporcional` delegada sin romper compatibilidad.
- **Anticipo de sueldo (`Clausula97Calculator`)**: Renombrado claro como "Anticipo de sueldo" (Cláusula 97 CCT), selector interactivo de 1 a 4 meses, visualización de cuota quincenal y 4 tarjetas comparativas.
- **Tiempo Extra (`TiempoExtraCalculator`)**: Enfoque primero en lo que el trabajador conoce (horas trabajadas en la quincena, jornada 6/6.5/8/12h), desglose de horas dobles y triples con diálogo amigable ante excedentes.
- **Préstamos por Categoría (`PrestamosCategoriaCalculator`)**: Búsqueda intuitiva de categoría, tarjetas con monto máximo disponible por tipo de préstamo y parámetros técnicos en acordeón.
- **Índice (`CalculatorsIndex`)**: 5 tarjetas con lenguaje directo y grid optimizada para móviles (360×800, 390×844, 412×915).

### Protected Behavior
- Cero modificaciones a `src/features/calculators/lib/*`: todas las fórmulas matemáticas, factores, constantes y límites normativos permanecen 100% idénticos e intactos.

## [0.006] - 2026-09-05 — Stable Baseline Declaration

### Governance
- El commit `d90ab2bbc2f4b648cb8ed0bed1801902cb9976da` (tree `267ea495aa773f01410759478ed412c174413f3c`) queda formalmente declarado como **baseline funcional estable** de La Veinte Digital.
- Transición formal de fase de reconstrucción a fase de **ESTABILIZACIÓN + PULIDO INCREMENTAL**.
- Política de cero regresiones no autorizadas: todo comportamiento existente es considerado comportamiento protegido.
- Esta entrada documenta formalmente el estado existente y **no altera ningún comportamiento del software**.

### Docs
- Creación de `docs/STABLE_BASELINE.md`: Especificación canónica del baseline, arquitectura multiplataforma, fuentes de verdad, contratos y dependencias externas.
- Creación de `docs/REGRESSION_GUARDRAILS.md`: Matriz integral de regresión por dominio, diagramas de flujos de datos críticos, protocolos Change Contract, Pre-Change Checklist y Post-Change Checklist.
- Actualización de `AGENTS.md`: Inclusión del bloque `# STABLE BASELINE — READ BEFORE CHANGING CODE`, principios de no drive-by refactoring y actualización a la versión 0.006.
- Actualización de `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/ANDROID_APP.md`, `docs/IOS_APP.md`, `docs/CALCULATOR_PREFILL.md`, `docs/E2E_TESTING.md`, `docs/RADIO_STUDIO.md`, `README.md` y `STORE_RELEASE_CHECKLIST.md`.

## [0.003] - 2026-07-31

### Docs
- `AGENTS.md`: estructura del proyecto con `features/tarjeton/`, `shared/services/` y `shared/contracts/`; convención de import `@/shared/services/<service>`; nueva Rule 11 (tarjetón: extracción 100% local, RPC atómico, `public/vendor/` gitignore); estado de migraciones aplicadas en Supabase; anti-patterns de vendor y subida de PDFs.
- `README.md`: stack con `pdfjs-dist` y `tesseract.js`; estructura de `shared/`; nota del prerrelleno alimentado por tarjetones confirmados.
- `src/features/calculators/README.md`: jornada 6h en Tiempo Extra (6 | 6.5 | 8 | 12), concepto adicional 1 (023/063), sección de prerrelleno normativo y actualización de privacidad (API interna autenticada, sin datos sensibles).
- `CHANGELOG.md`: entrada 0.003.

### Meta
- Versión 0.003 en `AGENTS.md`.

## [0.002] - 2026-07-31

### Added
- **Tarjetón IMSS** (`/tarjeton`): importador de recibos de pago con extracción
  100% local (PDF.js texto nativo + OCR Tesseract de respaldo vía
  `public/vendor/`), revisión humana campo por campo y confirmación que solo
  sube el resultado estructurado (el PDF nunca sale del dispositivo).
- Migración `004_imported_payslips.sql`: tablas `imported_payslips`,
  `imported_payslip_lines`, `imported_payslip_observations` con RLS por
  propietario y RPC `confirm_imported_payslip` (validación de contrato,
  totales, dedup por SHA-256, actualización de perfil y upsert de
  `payroll_contexts` en una transacción).
- Prerrelleno de `daysWorkedInAnnualPeriod` desde el último tarjetón
  confirmado (`source: "last_payslip"`).
- Jornada de **6 horas** soportada en Tiempo Extra (`JORNADAS = [6, 6.5, 8, 12]`)
  y etiqueta del concepto adicional 1 corregida a "(023 o 063)".
- CTAs "Mi Tarjetón" en Calculadoras y Nómina; link en la Sidebar.
- Docs: `docs/TARJETON_IMPORT.md`, actualizaciones en README, ARCHITECTURE,
  API y CALCULATOR_PREFILL.
- Storage compartido promovido a `src/shared/services/local-storage.ts`.

### Tests
- 22 tests de tarjetón (parsers + servicio de confirmación) con fixtures
  ficticios; suite total 201 tests en 7 archivos.

### Fixes
- `confirm-tarjeton-client.ts`: unión tipada como `type` (no `interface`).
- `useTarjetonImporter`: flujo revisión→confirmación sin render duplicado.
- Tests de Tiempo Extra actualizados para jornada de 6 horas.

## [0.001] - 2026-07-30

### Fixes
- Replaced raw `<input>`, `<button>`, `<textarea>` with shared UI components (`Input`, `Button`, `Textarea`) across all client components:
  - `login-form.tsx` - now uses `Input` with icon prop
  - `register-form.tsx` - now uses `Input` with icon prop
  - `ChatRoom.tsx` - now uses `Input` and `Button`
  - `ChatAssistant.tsx` - now uses `Input` and `Button`
  - `CatalogSearch.tsx` - now uses `Input`
  - `CommentSection.tsx` - now uses `Textarea`
- Fixed cross-feature import violation: `TodayCard.tsx` now imports calendar types from `@/shared/data/calendario` instead of `@/features/calendario/`
- Added `icon` prop support to shared `Input` component for icon-inside-input patterns
- Added `/facebook` (Noticias SNTSS) to Sidebar navigation
- Extracted calendar types, data, and helpers to `src/shared/data/calendario.ts` for cross-feature reuse
- Updated `calendarioData.ts` to re-export from shared location (backward compatible)

### Meta
- Set version to 0.001 (semantic versioning start)
- Created CHANGELOG.md
- Updated AGENTS.md with version info
