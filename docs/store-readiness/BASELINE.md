# BASELINE

Estado del repositorio y de las validaciones al inicio de la misión de preparación para Google Play.

## Repositorio

| Campo | Valor |
|-------|-------|
| Commit inicial | `1fd823a` — `release(android): publica v1.0.98 (versionCode 198)` |
| Branch | `main` |
| Estado del árbol | **Limpio** (sin cambios sin commit) al inicio |
| Remote | `https://github.com/ChronosBVRX/La-Veinte-Digital.git` |

## Contexto de la app en el baseline

- Android: `android-app/` (Kotlin, Compose, un único flavour `main`).
- `compileSdk = 35`, `targetSdk = 35`, `minSdk = 29`, `versionCode = 198`, `versionName = 1.0.98`.
- Un solo canal de distribución: **actualizador propio** (UpdateManager + manifest remoto + PackageInstaller + `REQUEST_INSTALL_PACKAGES` + `UpdateInstallReceiver` exportado).
- `lint { checkReleaseBuilds = false }` (lint de release desactivado).
- Firma de release solo por variables de entorno (`LAVEINTE_KEYSTORE_BASE64`/`PASSWORD`/`KEY_ALIAS`/`KEY_PASSWORD`) — no había keystore en el repo.
- SDK instalado: `platforms/android-35`, `build-tools/35.0.0`, Gradle 8.11.1, AGP 8.10.0, JDK 17.

## Validaciones ejecutadas

### Builds (Gradle)

| Build | Resultado | Notas |
|-------|-----------|-------|
| `:app:assembleDebug` | ✅ SUCCESS | Compila los sources de `main`. |
| `:app:assemblePlayDebug` | ✅ SUCCESS | (tras separar canales) |
| `:app:assembleDirectDebug` | ✅ SUCCESS | (tras separar canales) |

> La primera pasada de `assembleDebug` terminó `BUILD SUCCESSFUL` sobre el código original en `main`
> (targetSdk 35). Los resultados marcados "tras separar canales" corresponden a la primera compilación
> una vez añadidos los flavours `play`/`direct`.

### Tests unitarios (JVM)

| Suites | Resultado |
|--------|-----------|
| `testPlayDebugUnitTest` | ✅ PASSED (141 tests) |
| `testDirectDebugUnitTest` | ✅ PASSED (141 tests) |

Cubren los parser/reglas existentes de tarjetón, biometría, bridge y origen.

### Lint

En el baseline el lint de **release estaba desactivado** (`checkReleaseBuilds = false`), por lo que no
existía una señal de calidad de release. Durante la misión se habilitó (ver `PERMISSIONS.md` /
`docs/store-readiness`).

### Frontend (web)

No se re-ejecutó el build de producción del frontend en el baseline; se hizo durante la misión.
Al inicio la suite de Vitest estaba **roja de forma preexistente** por dos fallos en
`route-policy.test.ts` (rutas `/api/push/*` no contempladas y `requireUser()` ausente en
`/api/push/send`), ajenos al trabajo de la misión.

## Problemas conocidos en el baseline

1. `targetSdk = 35` — no cumple la exigencia de Google Play para apps nuevas/actualizaciones a partir de 2026.
2. El actualizador propio (PackageInstaller + `REQUEST_INSTALL_PACKAGES` + receptor exportado) estaba
   presente en el único canal → **violación de política de Google Play**.
3. Permisos de storage legacy (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`,
   `READ_MEDIA_DOCUMENTS`) declarados sin uso de código.
4. `allowBackup = true` con reglas que incluían una prefs (`la_veinte_prefs.xml`) y, de forma silenciosa,
   el resto de datos (vault de credenciales IMSS, cookies WebView, Room, PDFs) era candidato a backup.
5. Lint de release desactivado.
6. Sin AAB configurado/validado; entrega solo APK.
7. Falta de privacidad, términos, soporte, eliminación de cuenta y documentación asociada.
