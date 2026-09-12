# 🛡️ Auditoría de Production Gate — La Veinte Digital

**Fecha de auditoría:** 2026-09-10  
**Rama de trabajo:** `hardening/production-readiness`  
**Commit base auditado:** `24a39b7c0dc05348586b59fa72b9e8bf9f421959` (`main`)  
**Estatus:** APROBADO / FAIL-CLOSED COMPLIANT  

---

## 1. Mapeo y Arquitectura de CI / Production Gate

El pipeline de integración continua y compuertas de producción está orquestado principalmente en `.github/workflows/ci.yml`, complementado por `.github/workflows/release-gate.yml` y `.github/workflows/e2e.yml`.

La compuerta central de producción es el job `production-gate` dentro de `ci.yml`, el cual se ejecuta siempre (`if: ${{ always() }}`) después de que todos los jobs upstream han completado, y delega la decisión en el evaluador fail-closed `scripts/evaluate-production-gate.ts`.

### Grafo de Dependencias (DAG)
```
            ┌──────────────┐
            │   validate   │──┐
            └──────────────┘  │
            ┌──────────────┐  │
            │ supabase-db  │──┤
            └──────────────┘  │
            ┌──────────────┐  │     ┌───────────────────┐
            │    python    │──┼────▶│  production-gate  │
            └──────────────┘  │     │   (Fail-Closed)   │
            ┌──────────────┐  │     └───────────────────┘
            │     e2e      │──┤
            └──────────────┘  │
            ┌──────────────┐  │
            │   android    │──┘
            └──────────────┘
```

**Dependencias circulares:** Ninguna. El grafo es estrictamente acíclico y unidireccional hacia `production-gate`.

---

## 2. Matriz de Compuertas y Checks de CI

| Check / Job | Comando o Mecanismo | Qué verifica | Bloquea merge | Bloquea release |
| :--- | :--- | :--- | :---: | :---: |
| **`validate:typecheck`** | `npm run typecheck` (`tsc --noEmit`) | Cero errores de tipos en todo el proyecto TypeScript (`bundler` module resolution, tipado estricto de Supabase y contratos). | Sí | Sí |
| **`validate:lint`** | `npm run lint` (`eslint`) | Cero errores de ESLint (Next.js flat config `eslint.config.mjs`). Reglas de imports y sintaxis. | Sí | Sí |
| **`validate:test`** | `npm test` (`vitest run`) | Suite completa de pruebas unitarias y de integración rápida (165 archivos, 1641+ pruebas). Incluye contratos, cálculos laborales, parsers de tarjetón y evaluadores de compuertas. | Sí | Sí |
| **`validate:build`** | `npm run build` (`next build`) | Compilación de producción con Turbopack. Genera todas las 74 rutas estáticas y dinámicas, empaquetado de assets y bundle integrity. | Sí | Sí |
| **`supabase-db:reset`** | `supabase start && supabase db reset` | Valida que la totalidad de las migraciones SQL (desde `001` hasta `024`) se apliquen secuencial y limpiamente desde cero en una instancia PostgreSQL efímera en Docker. | Sí | Sí |
| **`supabase-db:rls-check`** | Consulta de catálogo `pg_class` y `pg_namespace` | Cero tablas públicas sin RLS (`NOT relrowsecurity`). Si existe una sola tabla sin RLS, falla de inmediato con código 1. | Sí | Sí |
| **`supabase-db:seeds`** | Verificación SQL de descanso obligatorio y tablas clave | Integridad de datos semilla (12 días de descanso 2027) y existencia de tablas esenciales (`profiles`, `payroll_contexts`, `worker_commitments`). | Sí | Sí |
| **`supabase-db:chat-rls`** | `psql < supabase/tests/chat_rls.sql` | Prueba funcional de aislamiento multi-inquilino entre dos usuarios con tokens y roles de autenticación distintos. Cero filtración entre usuarios. | Sí | Sí |
| **`supabase-db:tarjeton-rpc`** | `psql < supabase/tests/confirm_tarjeton_contract.sql` | Contrato de función almacenada `confirm_imported_payslip`: permisos `authenticated`, sanitización de datos sensibles e idempotencia. | Sí | Sí |
| **`supabase-db:restore-drill`** | `bash scripts/postgres-restore-drill.sh` | Simulacro en vivo de respaldo (`pg_dump`) y restauración (`pg_restore`) validando integridad referencial, roles y consistencia de tablas. | Sí | Sí |
| **`python:syntax`** | `python -m compileall bot-api` | Compilación y validación de sintaxis para el servicio FastAPI/LangChain. | Sí | Sí |
| **`python:tests`** | `python -m pytest -v` en `bot-api/` | Pruebas del servicio de embeddings, verificación de shared secret y endpoints del bot. | Sí | Sí |
| **`e2e:public`** | `npx playwright test --project=chromium-public` | Flujos de usuario completos de navegación pública, simuladores y cálculo laboral sin autenticación. | Sí | Sí |
| **`android:change-check`** | `scripts/check-android-changes.ts` | Detección determinista de cambios en `android-app/`, contratos compartidos (`src/shared/contracts/`) o proxy de autenticación (`src/proxy.ts`). | Sí | Sí |
| **`android:tests-and-policy`** | `./gradlew test validateDistributionPolicyPlayRelease` | Pruebas unitarias de Android y verificación de directivas de distribución para Google Play (solo si `affects_android=true`). | Sí | Sí |
| **`production-gate`** | `scripts/evaluate-production-gate.ts` | Agregador fail-closed que recibe los resultados de los 5 jobs anteriores (`validate`, `supabase-db`, `python`, `e2e`, `android`). Si cualquiera no es `"success"`, termina con código 1. | **SÍ** | **SÍ** |

---

## 3. Auditoría de Fallos Silenciosos

Se auditó minuciosamente el código de los flujos de CI en busca de prácticas que pudieran ocultar fallos:

1. **`continue-on-error`:**
   - **Resultado:** **0 ocurrencias** en `.github/workflows/ci.yml`. Ningún paso de compilación, prueba, lint o base de datos tiene permitido continuar tras un fallo.
2. **`|| true` y supresión de códigos de salida:**
   - Líneas de inspección en `ci.yml`:
     - `git fetch origin "${{ github.base_ref }}" --depth=1 || true`: Recuperación defensiva de la referencia base en forks/shallow clones sin alterar el resultado del test.
     - `DIFF_FILES=$(git diff --name-only HEAD~1 HEAD || true)`: Fallback de diff en caso de commit huérfano inicial.
     - `node ... scripts/check-android-changes ... 2>/dev/null || echo "true"`: En caso de que el script de detección falle o no pueda ejecutarse, la compuerta adopta la política **fail-safe / fail-closed**: asume `affects_android=true` y fuerza la ejecución completa de Gradle.
   - **Resultado:** No existen supresiones de errores en pasos de verificación de código, pruebas ni migraciones.
3. **Manejo de `production-gate` con `if: ${{ always() }}`:**
   - El uso de `always()` en `production-gate` es deliberado y correcto: permite que el agregador se ejecute incluso si un job previo falló o fue cancelado. El script `scripts/evaluate-production-gate.ts` inspecciona los estados y **aborta con error** (`process.exit(1)`) si algún job tiene un estado diferente a `'success'` (incluyendo `'failure'`, `'cancelled'`, `'skipped'`, `'timed_out'`).

---

## 4. Requisitos Bloqueantes No Negociables para Release Web

Para declarar un commit o artefacto apto para producción web, los siguientes 6 requisitos son estrictamente bloqueantes e inderogables:

1. **Lint (Cero Errores):**
   - Ejecutado vía `npm run lint`.
   - Cero errores permitidos. Las advertencias están acotadas a estándares de deprecación documentados.
2. **Pruebas Unitarias e Integración:**
   - Ejecutado vía `npm test`.
   - 100% de los tests deben pasar limpiamente en todos los módulos (`features/`, `shared/`, `packages/`).
3. **Build de Producción:**
   - Ejecutado vía `npm run build`.
   - Cero errores de tipado, cero rutas dinámicas rotas, empaquetado Turbopack completo.
4. **Migraciones de Supabase:**
   - Ejecutado en el job `supabase-db`.
   - Migraciones aplicadas en orden cronológico en PostgreSQL limpio. Verificación de RLS en todas las tablas y verificación de seeds.
5. **E2E Críticos:**
   - Ejecutado en el job `e2e` con Playwright (`chromium-public`).
   - Flujos críticos de navegación y calculadora laboral validados en un servidor Next.js productivo.
6. **Production Gate Evaluator:**
   - Evaluado por `scripts/evaluate-production-gate.ts`.
   - Agregación estricta y transparente de todos los resultados.

---

## 5. Pruebas Locales y Portabilidad

- Se validó la suite `production-gate-evaluator.test.ts` (7/7 tests pasando) que comprueba que cualquier fallo, cancelación, timeout o estado inesperado rechaza la compuerta.
- Se corrigió la portabilidad entre plataformas en `src/shared/server/__tests__/release-check-gate.test.ts` sustituyendo comillas simples de bash por comillas dobles compatibles con Windows (`cmd`/`powershell`) y Linux (`sh`/`bash`).
- Los scripts `scripts/release-check.ts` y `scripts/evaluate-production-gate.ts` se mantienen alineados con la política de cero regresiones.
