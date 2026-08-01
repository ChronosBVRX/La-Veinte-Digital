# Changelog

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
