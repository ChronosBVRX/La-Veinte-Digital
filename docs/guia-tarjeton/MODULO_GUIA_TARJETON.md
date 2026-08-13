# Guía de mi Tarjetón — Módulo técnico

> Reemplaza **"Entender conceptos de mi pago"** (`/catalogo`) por una guía
> educativa interactiva que se integra con los tarjetones reales del pipeline
> `imported_payslips` + `imported_payslip_lines`.

## 1. Rutas

| Ruta | Vista | Componente |
|---|---|---|
| `/guia` | Home de la guía (hero de quincena + grid) | `GuiaHome` (`tarjeton-guia/components/GuiaHome.tsx`) |
| `/guia/conceptos` | Buscador + catálogo de conceptos | `ConceptHub` |
| `/guia/conceptos/:code` | Ficha de concepto (Fácil / Detallado / Fundamento) | `ConceptFichaPage` |
| `/guia/campos/:id` | Ficha de campo del tarjetón | `FieldFichaPage` |
| `/guia/tarjeton` | Explorador visual "Conoce tu tarjetón" | `TarjetonExplorer` |
| `/guia/aprender` | Rutas educativas + preguntas cortas | `AprenderPage` |
| `/guia/aprender/primeros-pasos` | Micro-lecciones con avance persistido | `PrimerosPasosPage` |
| `/guia/mi-quincena` | "Mi quincena explicada" (carrusel + revisión + comparación) | `MiQuincenaPage` |

Las páginas son **server components** delgados en `src/app/(dashboard)/guia/`
(consultan `imported_payslips`) que delegan en componentes client de
`features/tarjeton-guia/`. Todas quedan bajo `protected-page` por defecto
(no hay que tocarlas en `route-policy.ts`).

## 2. Arquitectura (reglas del monorepo)

- **Datos**: `src/data/guia-tarjeton/` (semilla del Knowledge Pack Manual IMSS 2023,
  verificada idéntica al pack; referencia educativa, **nunca** normativa productiva).
- **Contenido curado**: `src/features/tarjeton-guia/data/`
  - `concept-details.ts` (~30 percepciones + ~25 deducciones curadas).
  - `field-details.ts` (~45 campos curados; el resto cae en "información insuficiente").
  - `lessons.ts` (`guideLessonPaths` 8 lecciones + `guideQuickLessons`).
  - `tips.ts`, `review-rules.ts`.
- **Lib puro** (`lib/`, probado): `normalize`, `search`, `catalog`, `explainer`,
  `compare`, `review`, `progress`.
- **Hooks**: `useGuideProgress` (localStorage `guia_tarjeton_progress_v1`),
  `useLatestPayslip` (fusiona localStorage + servidor por ranking de periodo).
- **Servicios**: `payslip-guide` (adaptadores `GuidePayslip`), `fetch-latest-payslip`
  (server-only, lee el tarjetón más reciente y sus líneas/observaciones).
- **Reuso** (`shared/`): `Card`, `Badge`, `ActionLink`, `Tabs`, `Input`, `PageHeader`,
  `ConceptHelp`. Íconos `@phosphor-icons/react`.

**Regla de oro**: los montos y fórmulas vigentes viven en los **motores** de La Veinte
(Nómina/calculadoras). La guía solo explica y enlaza: un concepto sin motor validado
se muestra como "referencia 2023, no vigente por sí sola" y redirige al simulador
existente cuando aplica (`calculator` en los detalles).

## 3. Integración con el visor de tarjetón

- `src/shared/components/app/ConceptHelp.tsx` (variantes `icon`/`label`) navega a
  `/guia/conceptos/:code` y resuelve el nombre dinámicamente.
- `Review.tsx` (visor de import) muestra `ConceptHelp` junto a cada fila de 3 dígitos.
- `TarjetonPageClient` / `TarjetonHistorySection` reciben `latestConcepts`
  (primeras 12 líneas del último tarjetón, consultadas en `tarjeton/page.tsx`)
  y muestran chips clicables `code · description ⓘ`.

## 4. Navegación y reemplazo de `/catalogo`

- `navigation.ts` (grupo Herramientas): `Entender conceptos de mi pago` → **`Guía de mi Tarjetón`** `/guia`.
- `herramientas/page.tsx`: tile actualizado.
- `callback/route.ts`: `/guia` agregado a `ALLOWED_INTERNAL_PATHS`.
- `mobile-navigation.test.tsx`: expectativa actualizada a `/guia`.
- `e2e/utils/helpers.ts`: `ALL_ROUTES` con las rutas nuevas.
- La página `/catalogo` (catálogo de adscripciones, `features/catalogo`) se conserva:
  es una feature distinta a la guía y sigue disponible.

## 5. Persistencia y privacidad

- Avance educativo → `localStorage` (sin migraciones, tolerante a datos corruptos).
- NO se suben PDFs a las rutas API (regla del tarjetón: extracción 100% local).
- Campos sensibles (RFC/CURP/NSS/cuenta) marcados `sensible` en el explorador;
  el home no muestra datos reales salvo concepto/importe ya confirmados.

## 6. Mantenimiento

- Para curar un concepto nuevo: editar `data/concept-details.ts` (o añadir
  `related` a `field-details.ts`) y correr `npm test` + `npm run typecheck`.
- El Knowledge Pack (`src/data/guia-tarjeton/` + `docs/guia-tarjeton/`) es de solo
  lectura: no editar, regenerar desde el pack 2023 si cambia.
- Si el bot / normativa cambia, actualizar **ambos** motores (regla 9) y NO copiar
  fórmulas a la guía.
- `public/vendor/` y `supabase/.temp/` siguen gitignoreados y regenerados por prebuild.

## 7. QA estándar

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (flat config) — 0 errores
npm test            # vitest — suite de tarjeton-guia en __tests__/
npm run build       # next build
npm run e2e:smoke   # playwright (requiere E2E_EMAIL/E2E_PASSWORD)
```
