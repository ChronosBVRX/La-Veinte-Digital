# E2E Testing Guide

Suite de pruebas end-to-end con Playwright para La Veinte Digital.

---

## Instalación

```bash
npm install
npx playwright install chromium firefox
```

Genera los PDFs de prueba:

```bash
node e2e/fixtures/pdfs/generate-pdf-fixtures.mjs
```

---

## Variables de entorno

Crear `.env.local` con:

| Variable | Descripción | Requerida para |
|----------|-------------|----------------|
| `E2E_BASE_URL` | URL base de la app (default: `http://localhost:3000`) | Todas las pruebas |
| `E2E_USER_EMAIL` | Email de la cuenta E2E | Pruebas autenticadas |
| `E2E_USER_PASSWORD` | Contraseña de la cuenta E2E | Pruebas autenticadas |

Las credenciales NUNCA se commitean al repositorio.

---

## Preparación de cuenta E2E

1. Crear una cuenta dedicada en Supabase (dashboard o vía `/register`).
2. Si la app requiere confirmación por email, confirmar manualmente.
3. Opcional: completar perfil con datos de prueba.
4. Configurar `E2E_USER_EMAIL` y `E2E_USER_PASSWORD` en `.env.local`.

---

## Ejecución

```bash
# Smoke tests (rápidos, navegación + autenticación)
npm run e2e:smoke

# Suite completa
npm run e2e:full

# Modo visible (ver navegador)
npm run e2e:headed

# UI interactiva (depuración paso a paso)
npm run e2e:ui

# Depurar un test específico
npm run e2e:debug

# Abrir reporte HTML
npm run e2e:report
```

Ejemplos directos con Playwright:

```bash
npx playwright test --project=chromium-desktop
npx playwright test --project=chromium-public
npx playwright test e2e/smoke/auth-public.spec.ts --headed
npx playwright test e2e/full/tarjeton.spec.ts --debug
```

---

## Estructura

```
e2e/
├── global-setup.ts              # Autenticación (storageState)
├── fixtures/
│   ├── monitored-page.ts        # Captura errores consola/red
│   └── pdfs/
│       ├── generate-pdf-fixtures.mjs  # Generador de PDFs sintéticos
│       ├── tarjeton-valido.pdf
│       ├── tarjeton-sin-percepciones.pdf
│       ├── tarjeton-sin-deducciones.pdf
│       ├── imss-no-tarjeton.pdf
│       ├── documento-generico.pdf
│       └── tarjeton-ambiguo.pdf
├── smoke/
│   ├── auth-public.spec.ts      # Login público (sin sesión)
│   ├── auth-authenticated.spec.ts # Sesión persistente
│   ├── navigation.spec.ts       # Navegación por todas las rutas
│   └── profile.spec.ts          # Perfil de usuario
├── full/
│   ├── tarjeton.spec.ts         # Importación de tarjetones
│   ├── asistente.spec.ts        # Chat IA
│   ├── calculadoras.spec.ts     # Aguinaldo, Tiempo Extra, etc.
│   ├── nomina.spec.ts           # Nómina y simuladores
│   ├── extras.spec.ts           # Calendario, Bitácora, etc.
│   ├── responsive.spec.ts       # Pruebas responsive
│   ├── accessibility.spec.ts    # Accesibilidad básica
│   └── crawler.spec.ts          # Exploración segura de rutas
└── utils/
    ├── error-capture.ts         # Watchers de consola/red
    └── helpers.ts               # Utilidades de navegación
```

---

## Proyectos de Playwright

| Proyecto | Navegador | Auth | Uso |
|----------|-----------|------|-----|
| `setup` | Chrome | Login inicial | Ejecuta una vez, guarda storageState |
| `chromium-desktop` | Chrome 1440x900 | storageState | Pruebas autenticadas desktop |
| `chromium-mobile` | Pixel 8 | storageState | Pruebas autenticadas mobile |
| `firefox-desktop` | Firefox 1440x900 | storageState | Smoke cross-browser |
| `chromium-public` | Chrome 1440x900 | Sin auth | Pruebas de login público |

---

## Fixtures de PDF

Los PDFs son generados sintéticamente con `jspdf`. No contienen datos reales.

Para regenerar:

```bash
node e2e/fixtures/pdfs/generate-pdf-fixtures.mjs
```

| Archivo | Propósito |
|---------|-----------|
| `tarjeton-valido.pdf` | Tarjetón IMSS con percepciones y deducciones |
| `tarjeton-sin-percepciones.pdf` | Solo deducciones |
| `tarjeton-sin-deducciones.pdf` | Solo percepciones |
| `imss-no-tarjeton.pdf` | Documento IMSS que no es tarjetón |
| `documento-generico.pdf` | PDF sin relación con IMSS |
| `tarjeton-ambiguo.pdf` | Campos faltantes para confianza baja |

---

## Pruebas con mocks

Las pruebas del asistente interceptan `POST /api/consulta` para verificar headers sin consumir cuota real.

Para pruebas de integración real con OpenAI/Python bot, usar una suite separada (no incluida en el commit).

---

## Limpieza de datos

Los tests que modifican datos (perfil, tarjetón) deben ejecutarse contra:
- Entorno local con Supabase local
- Cuenta E2E aislada en staging

Para limpiar datos después de tests:

```sql
-- Limpiar tarjetones de la cuenta E2E
DELETE FROM imported_payslips WHERE user_id = '<e2e-user-id>';
-- Limpiar compromisos
DELETE FROM commitments WHERE user_id = '<e2e-user-id>';
```

Ejecutar `node scripts/cleanup-e2e-data.mjs` si existe.

---

## CI

El workflow `.github/workflows/e2e.yml` ejecuta:

1. **check** – typecheck + lint + unit tests (siempre)
2. **e2e-public** – pruebas sin auth (todos los PRs)
3. **e2e-authenticated** – pruebas con auth (solo ramas internas, requiere secrets)
4. **e2e-full-manual** – suite completa (manual via `workflow_dispatch`)

Secrets requeridos en GitHub:
- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Problemas conocidos

1. **Send button sin nombre accesible** – El botón de enviar del chat usa solo un ícono SVG sin `aria-label`. Los tests usan selectores estructurales.
2. **IDs autogenerados** – Varios inputs usan `useId()` de React. Los tests usan `getByLabel` con el texto visible del label.
3. **Tesseract en CI** – El OCR requiere `tesseract.js` que descarga archivos de lenguaje. Puede ser lento en CI.
4. **Storage state expiry** – Las sesiones de Supabase expiran. El setup de auth debe ejecutarse antes de cada suite.

---

## Revisar trazas

Cuando un test falla, Playwright guarda una traza:

```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

La traza muestra: acciones del usuario, snapshots del DOM, requests de red, consola y timeline.

---

## Convenciones

- No usar `waitForTimeout` arbitrario. Preferir `waitForURL`, `waitForLoadState`, `expect(...).toBeVisible()`.
- Selectores accesibles: `getByRole`, `getByLabel`, `getByPlaceholder`, `getByText`.
- Cada test debe ser independiente (no depende del estado de otro test).
- No modificar fórmulas laborales ni lógica de negocio para hacer pasar tests.
- No guardar tokens, NSS, CURP, RFC ni contenido de tarjetones en artifacts.
