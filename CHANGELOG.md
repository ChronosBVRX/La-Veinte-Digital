# Changelog

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
