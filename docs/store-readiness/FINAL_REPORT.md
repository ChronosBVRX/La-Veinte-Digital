# Reporte Final — Preparación para Google Play (Android) + base iOS

Fecha: 2026-08-30 · Branch `main`. Resumen del trabajo autónomo de preparación para Play.

## Estado

```
GOOGLE PLAY READINESS: 8/10
ANDROID SECURITY:       8/10
REGRESSION CONFIDENCE:  8/10
IOS PORT READINESS:     6/10
```

> Faltan datos del propietario (firma real, fingerprint de App Links, cuenta demo, screenshots,
> metadata registrada en Play Console, aplicar migración de borrado de cuenta) que no se pueden
> completar sin acceso externo. Están marcados como `PENDIENTE DEL PROPIETARIO`.

## Cambios realizados

### Android — separación de canales (Play vs Direct)

| Archivo | Cambio |
|---------|--------|
| `android-app/app/build.gradle.kts` | `compileSdk=36`, `targetSdk=36`, `flavorDimensions` + flavors `play`/`direct`, `buildConfigField`s, `lint.checkReleaseBuilds=true`, tarea `validateDistributionPolicy*`, nombre de salida por flavor. |
| `android-app/gradle.properties` | `android.suppressUnsupportedCompileSdk=36`. |
| `src/main/AndroidManifest.xml` | Quitados permisos de storage legacy, `REQUEST_INSTALL_PACKAGES` y `UpdateInstallReceiver`; `allowBackup=false`. |
| `src/direct/AndroidManifest.xml` | **Nuevo**: `REQUEST_INSTALL_PACKAGES` + `UpdateInstallReceiver` (`exported=false`) — solo en `direct`. |
| `src/main/.../distribution/UpdateCoordinator.kt` | **Nuevo**: interfaz de política de actualización. |
| `src/play/.../distribution/{PlayUpdateCoordinator,UpdateCoordinatorProvider}.kt` | **Nuevo**: política Play (sin autocarga; mensaje "se administran mediante Google Play"). |
| `src/direct/.../distribution/{DirectUpdateCoordinator,UpdateCoordinatorProvider}.kt` | **Nuevo**: envuelve el actualizador (`UpdateManager`). |
| `src/direct/.../UpdateManager.kt`, `updates/*` | **Movidos a `src/direct`**: el actualizador ya no está en `src/main`, por lo que el APK de Play no lo contiene. |
| `src/main/.../MainActivity.kt` | Usa `UpdateCoordinatorProvider.provide()` en lugar de `UpdateManager` directo. |
| `src/main/.../UpdateTrigger.kt` | Comentario actualizado. |

### Android — endurecimiento

| Archivo | Cambio |
|---------|--------|
| `src/main/.../util/WebSettingsExt.kt` | `allowFileAccess=false`, `mixedContentMode=NEVER_ALLOW`. |
| `src/main/.../internal/InternalWebScreen.kt` | Guard de deep links (solo `https` en dominios propios + `laveinte://`). |
| `src/main/.../internal/DeepLinkPolicy.kt` (+ test) | **Nuevo**: política de deep links testable. |
| `src/main/.../res/xml/backup_rules.xml`, `data_extraction_rules.xml` | **Nuevo contenido**: excluir todo (por si se re-habilita el backup). |
| `src/main/.../security/*`, `imss/credentials/*` | Auditados (AES-GCM + Keystore correctos; sin cambios porque el diseño ya es seguro). |

### Web / backend

| Archivo | Cambio |
|---------|--------|
| `src/shared/server/routing/route-policy.ts` | Rutas públicas: `/privacidad`, `/terminos`, `/soporte`, `/acerca-de`, `/eliminar-cuenta`. |
| `src/app/privacidad|terminos|soporte|acerca-de|eliminar-cuenta/page.tsx` | **Nuevas** páginas públicas. |
| `src/shared/components/public/PublicPageShell.tsx` | **Nuevo** shell para páginas públicas. |
| `src/features/account/{actions.ts,components/DeleteAccountButton.tsx}` | **Nuevo**: borrado de cuenta (server action + botón con confirmación). |
| `src/app/(dashboard)/profile/page.tsx` | Enlaces "Privacidad y cuenta / Eliminar mi cuenta". |
| `src/app/api/push/send/route.ts` | Añadido `requireUser()` (defensa en profundidad). |
| `src/lib/supabase/types.ts` | Añadida la RPC `delete_my_account` a mano (pendiente de regenerar). |
| `supabase/migrations/20260830000000_account_deletion.sql` | **Nuevo** RPC seguro (SECURITY DEFINER, `auth.uid()`). |

### Documentación (`docs/store-readiness/`, raíz)

`BASELINE.md`, `PERMISSIONS.md`, `BACKUPS.md`, `GOOGLE_PLAY_DATA_SAFETY.md`,
`THIRD_PARTY_SERVICES.md`, `DEPENDENCIES.md`, `ANDROID_16KB.md`, `IOS_PORT_REQUIREMENTS.md`,
`REVIEWER_INSTRUCTIONS_TEMPLATE.md`, `PLAY_APP_SIGNING.md`, `BUILDING_RELEASE.md`,
`PLAY_STORE_LISTING.md`, y `STORE_RELEASE_CHECKLIST.md` (raíz).

## Problemas corregidos

### BLOCKER
- ~~`playRelease` declaraba `REQUEST_INSTALL_PACKAGES` y registraba el actualizador (violación de
  política de Google Play).~~ → Resuelto con la separación de canales (verificado: manifest mergeado
  de `playRelease` NO lo contiene).

### HIGH
- `targetSdk`/`compileSdk` = 35 → **36**.
- `allowBackup=true` permitía respaldar datos sensibles (vault IMSS, cookies WebView, documentos,
  Room, token FCM) → **`allowBackup=false`** + reglas de exclusión.
- Permisos de storage `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_DOCUMENTS`
  declarados sin uso → **eliminados**.
- WebView permitía `file://` (archivo/ejecución) → **`allowFileAccess=false`** + `MIXED_CONTENT_NEVER_ALLOW`.
- Deep links podían cargar esquemas arbitrarios en la WebView privilegiada → **guard de esquema/host**.
- `/api/push/send` no verificaba la sesión → **`requireUser()`**.
- Lint de release desactivado → **habilitado** (solo warnings, sin errores).

### MEDIUM
- `UpdateInstallReceiver` `exported=true` → **`exported=false`** (solo `direct`).
- `route-policy.test.ts` y expectativas obsoletas (rutas `/api/push/*`) → **actualizadas**.
- Deep-link `com.laveintedigital.app://` (no usado) → se bloquea su carga en la WebView (menos superficie).

### LOW
- Avisos de deprecación `ObsoleteSdkInt` / `databaseEnabled` / `statusBarColor` (cosméticos; no se
  cambió comportamiento).
- `FileProvider` `<cache-path path="/">` amplio — se documentó (los grants son temporales por URI).

## Problemas pendientes (requieren dato o acción externa)

- **Aplicar** `supabase/migrations/20260830000000_account_deletion.sql` al remoto (aprobación) y
  **regen** `types.ts` con `supabase gen types`.
- Rellenar `public/.well-known/assetlinks.json` con el **SHA-256 del certificado de release** (hoy `PENDIENTE`).
- Proporcionar keystore release + env vars para **firmar** el AAB.
- Cuenta **demo** real + PDF de tarjetón de ejemplo + QR/entorno de prueba.
- **Screenshots** para Play Console.
- Confirmar **metadatos** (categoría, audiencia, correo de contacto).
- Confirmar si hay **analytics/crash reporting** (en el baseline el SDK es solo FCM, no analytics).
- Smoke test en **dispositivo real** sobre el build minificado (R8).
- Cuenta/datos del **App Store** para el port iOS.

## Tests

| Suite | Resultado |
|-------|-----------|
| Android `testPlayDebugUnitTest` | ✅ 141 tests, 0 failures |
| Android `testDirectDebugUnitTest` | ✅ 141 tests, 0 failures |
| `validateDistributionPolicyPlayRelease` | ✅ installPermission=false, receiver=false |
| `validateDistributionPolicyDirectRelease` | ✅ installPermission=true, receiver=true |
| Frontend `tsc --noEmit` | ✅ |
| Frontend `vitest` (todo) | ⚠️ 1056 passed · 1 failed (anti-alucinación RAG que depende del LLM local/Ollama, no corrió) · 10 skipped (requieren Supabase local) |
| `route-policy.test.ts` | ✅ 21 tests |

## Builds

| Build | Resultado |
|-------|-----------|
| `:app:assembleDebug` | ✅ |
| `:app:assemblePlayDebug` · `:app:assembleDirectDebug` | ✅ |
| `:app:assemblePlayRelease` (R8) | ✅ |
| `:app:assembleDirectRelease` (R8) | ✅ |
| `:app:bundlePlayRelease` (AAB) | ✅ |
| `:app:lint` (release habilitado) | ✅ (solo warnings) |
| Web `npm run build` | ✅ (incluye `/privacidad`, `/terminos`, `/soporte`, `/acerca-de`, `/eliminar-cuenta`) |

## Artefactos

```
android-app/app/build/outputs/bundle/playRelease/app-play-release.aab   (22 MB, AAB Play)
android-app/app/build/outputs/apk/play/release/LaVeinteDigital-play-release-v1.0.98.apk  (24 MB, R8)
android-app/app/build/outputs/apk/direct/release/LaVeinteDigital-direct-release-v1.0.98.apk  (24 MB, R8, con actualizador)
android-app/app/build/outputs/apk/debug/LaVeinteDigital-debug-v1.0.98-debug.apk
```

> El AAB generado aquí está **sin firmar con el keystore de release** (no había env vars). Para subir a
> Play debe generarse con `LAVEINTE_KEYSTORE_*`.

## Manifests (resumen de diferencias entre canales)

- **playRelease:** sin `REQUEST_INSTALL_PACKAGES`, sin `UpdateInstallReceiver`, `allowBackup=false`,
  `usesCleartextTraffic=false`, sin `debuggable`.
- **directRelease:** con `REQUEST_INSTALL_PACKAGES`, con `UpdateInstallReceiver` (`exported=false`),
  `allowBackup=false`, `usesCleartextTraffic=false`, sin `debuggable`. El actualizador, la verificación
  SHA-256 y el canal stable se conservan intactos.

## Datos que necesito proporcionar posteriormente

- Keystore release + pass (variables `LAVEINTE_KEYSTORE_*`).
- Fingerprint SHA-256 del certificado de release (para `assetlinks.json` + OAuth).
- Correo/contacto legal y de soporte (marcado `REQUIERE_DATO_DEL_PROPIETARIO`).
- Cuenta demo + PDF demo de tarjetón + QR de prueba.
- Screenshots.
- Cuenta de Play Console y (para iOS) cuenta de Apple Developer.
- Confirmar categoría/audiencia/analytics.

## Riesgo de rechazo residual

- **WebView-centric:** la app usa la web como núcleo. Tiene función nativa (biometría, PDF, cámara,
  QR, expulsión de docs, almacenamiento cifrado), lo que ayuda a cumplir "Minimum Functionality".
- **OOC (out-of-app):** abre Custom Tabs y portales oficiales; declarar y justificar.
- **Independencia IMSS:** el disclaimer (no app oficial) ya está en privacidad/terminos/acerca-de y en
  la zona de portales. Riesgo bajo, pero es lo que más suele preguntar el revisor.
- **Data Safety:** debe reflejar Firebase (push) y Supabase. No hay analytics/publicidad.
- **Cuenta:** borrado real (RPC) ya implementado — pendiente aplicar la migración y regen types.

Scores finales: `GOOGLE PLAY READINESS: 8/10`, `ANDROID SECURITY: 8/10`,
`REGRESSION CONFIDENCE: 8/10`, `IOS PORT READINESS: 6/10`.
