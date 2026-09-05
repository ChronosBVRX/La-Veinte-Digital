# STORE RELEASE CHECKLIST — La Veinte Digital (Android)

Checklist maestra para subir el AAB a Google Play. Marca `[x]` SOLO lo verificado realmente.
`[PENDIENTE]` = requiere acción del propietario (dato humano/externo).

## Android técnico

- [x] `compileSdk = 36`
- [x] `targetSdk = 36`
- [x] `minSdk = 29` (se mantiene)
- [x] `flavorDimensions` con `play` y `direct`
- [x] Builds compilan: `assembleDebug`, `assemblePlayDebug`, `assembleDirectDebug`
- [x] `bundlePlayRelease` genera AAB (verificado durante la misión)
- [x] `assemblePlayRelease` genérica AAB/APK (verificado)
- [x] `assembleDirectRelease` (verificado)
- [x] `versionCode`/`versionName` consistentes (203 / 1.1.3 — Stable Baseline)
- [x] Cambios estrictamente documentales (`docs-only`) no requieren bump de versión del APK.

## Google Play Policy

- [x] `playRelease`: `REQUEST_INSTALL_PACKAGES` **AUSENTE** (manifest merged verificado)
- [x] `playRelease`: `UpdateInstallReceiver` (PackageInstaller) **AUSENTE**
- [x] `directRelease`: actualizador presente (`REQUEST_INSTALL_PACKAGES` + receiver `exported=false`)
- [x] Tarea Gradle `validateDistributionPolicy*` falla el build si difiere (parte de `check`)
- [x] `debugar` de release = `false` (no `debuggable` en manifest release)
- [x] `usesCleartextTraffic = false`
- [x] Sin `MANAGE_EXTERNAL_STORAGE`, sin permisos de storage legacy
- [x] `android:allowBackup = false`

## Seguridad

- [x] WebView: `allowFileAccess = false`, `mixedContentMode = NEVER_ALLOW`
- [x] WebView: SSL errors → `handler.cancel()` (nunca `proceed()`)
- [x] Bridge JS→native solo en hosts de La Veinte (allowlist)
- [x] Deep links: solo `https` en dominios propios + `laveinte://`; se bloquean `file:`/`javascript:`/custom
- [x] Credenciales IMSS: AES-256/GCM + AndroidKeyStore no exportable (auditado)
- [x] Sin contraseñas en logs/exceptions (revisado — ver FASE 22)
- [x] `UpdateInstallReceiver` `exported=false` (solo direct)
- [x] `FileProvider` `exported=false` + paths restringidos
- [ ] Smoke test sobre build **minificado** en dispositivo real (requiere hardware) — ⚠️ bloqueado sin dispositivo/emulador (KVM) en este entorno

## Privacidad

- [x] Página pública `/privacidad` (ruta registrada como pública)
- [x] Página pública `/terminos`
- [x] Página pública `/soporte`
- [x] Página pública `/acerca-de` (aviso de independencia)
- [x] Enlaces desde Perfil → Política de privacidad
- [x] Threat model de backup en `BACKUPS.md`
- [x] Aviso de independencia (no oficial) en acerca/privacidad/terminos

## Cuenta

- [x] Botón «Eliminar mi cuenta» en Perfil → Privacidad y cuenta
- [x] Ruta pública `/eliminar-cuenta` (con confirmación + reautenticación)
- [x] Server Action `deleteAccountAction` (sesión derivada, sin `user_id` del cliente)
- [x] RPC `delete_my_account()` (SECURITY DEFINER, `auth.uid()`, grant solo a `authenticated`)
- [x] **Aplicar la migración** `20260830000000_account_deletion.sql` al Supabase remoto (Management API)
- [x] `delete_my_account` tipado a mano; validado con `tsc` (regen automático bloqueado por CLI/red)

## Permisos

- [x] Matriz en `PERMISSIONS.md`
- [x] Eliminados `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_DOCUMENTS`
- [x] Cámara solo bajo demanda
- [x] Notificaciones: se piden con contexto; no bloquean la app
- [x] `REQUEST_INSTALL_PACKAGES` solo en `direct`

## Data Safety

- [x] Matriz en `GOOGLE_PLAY_DATA_SAFETY.md`
- [x] Terceros documentados en `THIRD_PARTY_SERVICES.md`

## Testing

- [x] Android unit tests: `testPlayDebugUnitTest` ✅, `testDirectDebugUnitTest` ✅
- [x] Deep-link policy test (`DeepLinkPolicyTest`)
- [x] Tarea `validateDistributionPolicy*` ✅ para play/direct debug+release
- [x] Frontend `tsc --noEmit` ✅
- [x] Frontend Vitest: 1056 pasan (1 env-dependiente de LLM local, 10 skip por env)
- [x] `route-policy.test.ts` ✅ (se corrigió `/api/push/*`)
- [ ] Prueba en dispositivo físico (ver `FASE 31`)

## Metadata Play Store

- [x] Borrador en `PLAY_STORE_LISTING.md`
- [ ] Nombre/descripción/categoría final aprobada por propietario
- [ ] Capturas de pantalla — ⚠️ bloqueado: sin dispositivo/emulador (KVM) y red a `supabase.co`
- [ ] URL de política de privacidad desplegada como `/privacidad`

## Reviewer access

- [x] Plantilla `REVIEWER_INSTRUCTIONS_TEMPLATE.md`
- [x] Cuenta demo creada (`play.reviewer@laveinte.demo`); credencial en almacén privado `$HOME/.laveinte/keystore/reviewer_creds.txt`
- [x] PDF demo **generado** y publicado (`/demo/demo-tarjeton-imss.pdf`)
- [x] QR demo **generado** y publicado (`/demo/demo-qr-transfer.png`)

## Signing

- [x] Firma release por variables de entorno (sin secrets en Git)
- [x] Doc `PLAY_APP_SIGNING.md`
- [x] Upload keystore generado y guardado en `$HOME/.laveinte/keystore/` (privado, sin password en Git)
- [x] App Links: `assetlinks.json` publicado con las **3 huellas de Play App Signing** (FF:A7:…, 09:0E:…, 75:DD:…) **+** la upload key del canal `directRelease`; HTTP 200 y JSON válido. Verificación en dispositivo (Internal Testing) pendiente de Android físico.

## AAB

- [x] Se puede generar `bundlePlayRelease`
- [x] AAB **firmado** con la upload key (verificado) — subida a Play Console bloqueada por 2FA

## Post-release monitoring

- [x] Sin Crashlytics en baseline (documentado) — considerar añadirlo
- [ ] Verificar en Play Console el reporte de Data Safety tras subir
- [ ] Monitor por si Play rechaza por permisos/privacidad

## iOS future port

- [x] `IOS_PORT_REQUIREMENTS.md`
- [ ] Privacy Manifest, App Privacy, Universal Links, push (pendiente)
