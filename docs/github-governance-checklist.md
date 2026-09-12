# 🏛️ Lista de Verificación y Gobernanza para Lanzamiento a Producción — La Veinte Digital

> **Fecha de formulación:** 2026-09-10  
> **Ámbito:** Repositorio GitHub `ChronosBVRX/La-Veinte-Digital`, GitHub Actions, Vercel, Supabase, Google Play Console, App Store Connect  
> **Objetivo:** Cero regresiones, despliegues reproducibles e inmutabilidad de la rama `main`.

---

## 1. Reglas Recomendadas de Protección de Ramas (`main`)

Para garantizar la estabilidad permanente del baseline auditado, se establecen las siguientes directivas obligatorias de protección en GitHub:

| Regla de Protección | Configuración Exigida | Justificación Técnica |
| :--- | :---: | :--- |
| **Require a pull request before merging** | **Habilitado** (mínimo 1 aprobación) | Prohíbe commits directos a `main` sin revisión previa. |
| **Require status checks to pass before merging** | **Estricto** | Bloquea el merge si cualquiera de las siguientes comprobaciones falla: |
| — `validate (CI)` | Exigido | Typecheck, linting, tests unitarios, cobertura y build de Next.js. |
| — `audit:production` | Exigido | Cero vulnerabilidades de dependencias altas o críticas no mitigadas. |
| — `test:coverage` | Exigido | Cobertura >= 75% stmts, >= 65% branches, >= 80% funcs, >= 75% lines. |
| — `supabase-db (CI)` | Exigido | Verificación de migraciones limpias, RLS en todas las tablas y tests de aislamiento multiusuario. |
| — `android-release (Release Gate)` | Exigido | Validación de políticas Play Store, 16 KB page size, AAB y APKs. |
| **Require branches to be up to date before merging** | **Habilitado** | Garantiza que el código fue probado contra la punta más reciente de `main`. |
| **Restrict who can push to matching branches** | **Habilitado** (Solo mantenedores líderes) | Previene pushes accidentales fuera del flujo PR. |
| **Require signed commits** | **Habilitado** | Firma criptográfica GPG/SSH obligatoria para verificar la identidad del autor. |
| **Do not allow bypassing the above settings** | **Habilitado** | Ni siquiera administradores pueden puentear los gates en `main`. |

---

## 2. Auditoría de Seguridad de Flujos GitHub Actions

1. **Acciones Oficiales y Versiones Confiables**:
   - `actions/checkout@v4`
   - `actions/setup-node@v4` (Node.js 22 LTS)
   - `actions/setup-java@v4` (JDK 17 Eclipse Temurin)
   - `gradle/actions/setup-gradle@v4`
   - `supabase/setup-cli@v1`
2. **Principio de Mínimo Privilegio (`permissions`)**:
   - Los flujos operan con permisos de solo lectura de código (`contents: read`) de forma predeterminada, limitando el impacto ante posibles compromisos de dependencias.
3. **Protección de Secretos y Enmascaramiento de Logs**:
   - Secretos de firma Android (`LAVEINTE_KEYSTORE_BASE64`, contraseñas de alias) residen exclusivamente en GitHub Repository Secrets.
   - Enmascaramiento nativo de GitHub Actions: los valores de secretos se ocultan como `***` en los logs públicos de ejecución.
   - La tarea Gradle de firma escribe el archivo `.jks` en memoria o carpetas temporales locales ignoradas en `.gitignore`.

---

## 3. Checklist Previo al Lanzamiento de Producción (Release Gate Checklist)

Antes de autorizar el merge de `hardening/production-readiness` a `main` y proceder al despliegue:

### A. Integridad de Código y Suites Automatizadas
- [x] **Fase 0**: Baseline técnico capturado y documentado en `docs/production-hardening-baseline.md`.
- [x] **Fase 1**: Puerta de verificación de release (`scripts/release-check.ts` y test de validación) implementada.
- [x] **Fase 2**: Auditoría de dependencias fail-closed (`npm run audit:production`) sin vulnerabilidades no mitigadas.
- [x] **Fase 3**: Matriz RLS documentada (`docs/supabase-rls-matrix.md`) y suite multi-inquilino (`supabase/tests/user_isolation_rls.sql`).
- [x] **Fase 4**: Funciones `SECURITY DEFINER` auditadas y endurecidas (`search_path = public`, permisos anon revocados).
- [x] **Fase 5**: Preflight de entorno (`npm run preflight:env`) con validaciones criptográficas de URLs y llaves JWT.
- [x] **Fase 6**: Test de integración de sincronización canónica de nómina y tarjetón IMSS (`canonical-payslip-synchronization.integration.test.ts`).
- [x] **Fase 7**: Suite E2E endurecida con jornadas críticas protegidas (`e2e/full/business-journeys.spec.ts`).
- [x] **Fase 8**: Puerta de cobertura configurada (`npm run test:coverage`) y documentada en `docs/test-coverage-baseline.md`.
- [x] **Fase 9**: Cabeceras de seguridad Next.js (`poweredByHeader: false`, CSP estricto) y documentación en `docs/security-csp-followup.md`.
- [x] **Fase 10**: Auditoría Android y WebView (`docs/android-webview-security-audit.md`), targetSdk 36, alineación a 16 KB verificada.
- [x] **Fase 11**: Auditoría iOS (`docs/ios-security-audit.md`), Manifiesto de Privacidad (`PrivacyInfo.xcprivacy`), ATS sin excepciones.
- [x] **Fase 12**: Auditoría de logs y privacidad (`docs/logging-privacy-audit.md`), supresión de `console.log` en compilación de producción.
- [x] **Fase 13**: Manual de reversión y contingencia documentado en `docs/PRODUCTION_ROLLBACK.md`.

### B. Validación de Entorno en Servidores
- [ ] Variables de producción en Vercel verificadas con `npm run preflight:env` (sin placeholders, URLs HTTPS válidas).
- [ ] Migración `20260910200000_harden_security_definer_functions.sql` aplicada en la base de datos Supabase de producción.
- [ ] Tablas activas en Supabase verificadas con RLS habilitado (34/34 tablas).

### C. Cumplimiento de Tiendas Móviles
- [ ] Android App Bundle (`playRelease`) generado sin `REQUEST_INSTALL_PACKAGES` (aprobado por `validateDistributionPolicyPlayRelease`).
- [ ] Android APK directo (`directRelease`) generado con mecanismo de auto-actualización in-app firmado.
- [ ] iOS Archive generado con `PrivacyInfo.xcprivacy` incluido y permisos Face ID/Cámara con textos en español.
