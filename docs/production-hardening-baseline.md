# Baseline de Endurecimiento para Producción (Fase 0)

- **Fecha:** 2026-09-10T18:16:00-06:00
- **Commit auditado:** `24a39b7c0dc05348586b59fa72b9e8bf9f421959` (`main`, HEAD)
- **Rama de trabajo exclusiva:** `hardening/production-readiness`
- **Node runtime:** v24.14.1
- **npm runtime:** 11.11.0
- **Sistema Operativo:** Windows 10/11 x64 (entorno local de auditoría) / Ubuntu 22.04 / 24.04 (GitHub Actions CI)

---

## 1. Estado del Repositorio y Git

```text
Commit de referencia auditado: 24a39b7c0dc05348586b59fa72b9e8bf9f421959
Rama origen: main (en sincronía exacta con origin/main y origin/release/production)
Rama activa creada: hardening/production-readiness
Working tree previo a modificaciones: CLEAN (sin archivos modificados o sin trackear en el baseline)
```

Últimos 10 commits en `main`:
1. `24a39b7` fix(simulador): retirar modulo de simulador de audiencia y enlaces asociados (#94)
2. `0fad425` fix(simulador): retirar modulo de simulador de audiencia y enlaces asociados
3. `9fe7305` fix(radio-studio): align retry states, package WebView2Loader automatically and bump to 1.0.0 (#92)
4. `66251fc` fix(tarjeton): inicialización atómica de identidad y blindaje contra SQLSTATE 23514 en importación (#91)
5. `b6b82f9` fix(safety): blindaje permanente contra contaminación E2E en producción y sincronización del RPC de tarjetón (#90)
6. `b9623af` fix(tarjeton): corrección de created_at en confirm_imported_payslip_v1 y payroll_contexts (#89)
7. `7297627` test(tarjeton): cover worker switch persistence and document P0 recovery (#88)
8. `953ec5c` fix(tarjeton): recuperación P0 de importación y perfil laboral
9. `b712fa4` fix(db): desambiguar usuario en backfill P0 de tarjeton
10. `a23cc7c` test(tarjeton): cubrir respuesta RPC con warnings

---

## 2. Dependencias y Vulnerabilidades (`npm audit`)

### Auditoría de Producción (`npm audit --omit=dev --audit-level=high`)
Total de vulnerabilidades detectadas en dependencias de producción: **13 vulnerabilidades** (1 crítica, 3 altas, 9 moderadas):

1. **`next` (`16.2.12`) — CRÍTICA**
   - **Advisories:** [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36) (Unauthenticated RCE en servidores Windows), [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) (RCE en Image Optimization API cuando se procesan archivos AVIF).
   - **Severidad:** Critical.
   - **Dependencia:** Directa en `package.json` (`"next": "16.2.12"`). Depende a su vez de versión vulnerable de `sharp` (<0.35.4).
   - **Riesgo:** Requiere análisis en Fase 2 sin romper contratos ni compatibilidad con Turbopack/Next 16.
2. **`sharp` (`<0.35.4`) — ALTA**
   - **Advisory:** [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) (Vulnerabilidades en libheif: GHSA-g89c-p67h-r497 y GHSA-2jg2-4ch7-h545).
   - **Dependencia:** Transitiva vía `next`.
3. **`pdfjs-dist` (`6.1.200`) — ALTA**
   - **Advisory:** [GHSA-hq66-cqwq-w95j](https://github.com/advisories/GHSA-hq66-cqwq-w95j) (Ejecución arbitraria de JavaScript al abrir PDF malicioso).
   - **Dependencia:** Directa (`"pdfjs-dist": "6.1.200"`), utilizado en cliente para lectura y render de tarjetones IMSS.
4. **`nanoid` (`<3.3.18`) — ALTA**
   - **Advisory:** [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) (Generadores personalizados pueden ciclar indefinidamente cuando tamaño es 0).
   - **Dependencia:** Transitiva.
5. **`dompurify` (`<=3.4.12`) — MODERADA**
   - **Advisory:** [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7) (XSS vía detached subtree).
6. **`uuid` (`<11.1.1`) — MODERADA**
   - **Advisory:** [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
   - **Dependencia:** Transitiva vía `firebase-admin` -> `@google-cloud/firestore` / `@google-cloud/storage`.

---

## 3. Resultados de Lint (`npm run lint`)

- **Estado:** PASS (código de salida 0).
- **Problemas:** 0 errores, 89 advertencias (warnings de hooks deps, variables no leídas y uso de `<img>` en generador de escritos).

---

## 4. Tests Unitarios y de Integración (`npm test`)

- **Archivos de test ejecutados:** 172
- **Archivos de test aprobados:** 165 aprobados, 2 omitidos, 5 fallidos (en entorno local Windows).
- **Pruebas totales:** 1,690 (1,641 aprobadas, 40 omitidas, 9 fallidas).

### Fallos Preexistentes Documentados (Entorno Local Windows vs Linux CI):
1. `src/shared/server/__tests__/release-check-gate.test.ts`:
   - Falla debido a comillas simples `execSync("node -e 'process.exit(1)'")` en Windows CMD (en Linux CI pasa porque bash sí interpreta comillas simples).
2. `apps/radio-studio/sidecar/src/__tests__/groq-editorial-governance.test.ts` (5 tests):
   - Falla por `EPERM` en `fs.rmSync(tmpDir)` durante `afterEach` al eliminar carpetas temporales bloqueadas por procesos de Windows. Pasa en Linux CI.
3. `apps/radio-studio/sidecar/src/services/__tests__/corpus-failclosed.test.ts`:
   - Mismo fallo `EPERM` en `fs.rmSync(emptyRepo)` en Windows.
4. `apps/radio-studio/sidecar/src/services/__tests__/media-security.test.ts`:
   - Falla por `EPERM: operation not permitted, symlink` al crear enlaces simbólicos en Windows sin privilegios elevados. Pasa en Linux CI.
5. `apps/radio-studio/sidecar/src/services/__tests__/watchdog.test.ts`:
   - Timeout por manejo de process group en Windows.

---

## 5. Cobertura de Código (`npm run test:coverage`)

- **Estado inicial:** `@vitest/coverage-v8` / `@vitest/coverage-istanbul` no se encontraban definidos en `package.json`.
- **Baseline de pruebas:** 1,641 pruebas unitarias y de integración pasando en el núcleo.
- **Acción requerida:** Agregar soporte determinista de cobertura en Fase 8 sin alterar dependencias productivas.

---

## 6. Compilación de Producción (`npm run build`)

- **Estado:** PASS (código de salida 0).
- **Compilador:** Next.js 16.2.12 con Turbopack.
- **Páginas generadas:** 74/74 rutas estáticas y dinámicas compiladas exitosamente.
- **Advertencias:** 5 warnings de Turbopack sobre patrones dinámicos en `data/tts` y `data/normativa`.

---

## 7. Inventario de E2E Disponibles

- Playwright suites configuradas bajo `e2e/`:
  - `e2e/full/` (smoke, responsive, escritos, nómina, tarjetón, perfil, vacaciones, agenda, admin).
  - Proyectos configurados en `playwright.config.ts`: `chromium-public`, `chromium-desktop`, `chromium-mobile`.

---

## 8. Verificación de Workflows y Pipelines Existentes

1. `.github/workflows/ci.yml`:
   - `validate` (Typecheck, Lint, Unit tests, Build).
   - `supabase-db` (Init, Reset, RLS check en tablas públicas, seeds, Chat RLS, Tarjeton RPC contract, Restore drill).
   - `python` (FastAPI / Langchain bot-api tests).
   - `e2e` (Playwright chromium-public).
   - `android` (Conditional check `doesAffectAndroid` + Gradle unit tests + validation of distribution policy).
   - `production-gate` (Fail-closed aggregator evaluando el resultado de los 5 jobs previos).
2. `.github/workflows/e2e.yml`:
   - Ejecución en PRs de Typecheck + Lint + Unit Tests + E2E Public + E2E Smoke + E2E Escritos.
3. `.github/workflows/android-build.yml` y `release-gate.yml`:
   - Verificación de AAB/APK, firmas, 16 KB page-size compliance (`zipalign -P 16`) y política de distribución.
4. `.github/workflows/ios-build.yml` y `ios-release.yml`:
   - Build de validación para plataforma iOS.
