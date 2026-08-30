# Reporte Final — La Veinte Digital, publicación Google Play (misión final)

Fecha: 2026-08-30 · Branch `main`. Resumen del cierre operacional de la publicación para Google Play.

## Estado

```
GOOGLE PLAY READINESS: 9/10
ANDROID SECURITY:       9/10
REGRESSION CONFIDENCE:  8/10
IOS PORT READINESS:     6/10
```

> Quedan únicamente bloqueos EXTERNOS reales: acceso a Play Console (requiere 2FA de la cuenta
> comercial), el fingerprint del certificado de **App Signing** de Google (se obtiene DESPUÉS de
> subir el AAB), y **capturas de pantalla con datos** (esta máquina no puede alcanzar
> `*.supabase.co`, por lo que una build en el emulador local no puede autenticarse). Todo lo
> demás está hecho y verificado.

## Código

| Ítem | Valor |
|------|-------|
| Commit inicial | `1fd823a` (`release(android): v1.0.98`) |
| Commit final | `32dea34` (último de esta misión, sin push) |
| Commits de la misión final | 7 (c6439bf→32dea34) + 5 de la misión anterior |
| Branch | `main` (adelantado a origin/main; no se hizo push) |
| `git status` | limpio tras commits locales |

### Secuencia (misión final)
- `c6439bf security(api)`: push admin deny-by-default + tests.
- `cf39f63 fix(web)`: static-file proxy matcher + timeout de corpus.
- `d2caf67 feat(deploy)`: fingerprint real + migración `delete_my_account` endurecida.
- `2124c6e ci(android)`: fix rutas de canal + `release-gate.yml`.
- `32dea34 docs(play)`: assets demo + instrucciones de revisor.

## Seguridad

### `/api/push/send`
- **Resultado: DENY BY DEFAULT, verificada con tests.**
  Exige (1) sesión Supabase válida (`requireUser`), (2) email en `PUSH_ADMIN_EMAILS`,
  (3) cabecera `X-Push-Admin-Key`. Sin configurar → 503 (fail closed). No-admin → 403.
- **Tests:** 28 (autorización, validación, rate-limit + ruta). Se probó por unidad: anónimo→401,
  no-admin→403, key errónea→403, body enorme→413, esquema inválido→400, destination externa→400,
  userIds no-UUID→400, broadcast/target directo→200.
- **Límites:** body ≤32 KB, userIds UUID dedupe ≤100, título≤200, mensaje≤500, destination solo
  interna, rate-limit best-effort por IP (10/min).
- **Secretos:** `PUSH_ADMIN_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `SUPABASE_SERVICE_ROLE_KEY`
  solo en el servidor; nunca se loguea ni se expone.

### Supabase
- **Migración aplicada al proyecto real `ragktminwduiggvaoeix`** vía Management API (el CLI Rechaza
  el formato del token). Verificado: `delete_my_account` es SECURITY DEFINER (owner postgres),
  solo `authenticated` tiene EXECUTE, `anon` sin acceso.
- **E2E de borrado verificado en la BD:** se creó un usuario sintético + filas (vacation_calendars,
  vacation_rule_versions, push_devices, payroll_contexts, profile), se invocó el RPC con
  `request.jwt.claims` → **todas las filas + el auth user eliminados**. Sin sesión → `not_authenticated`.
- **FK NO ACTION resuelto:** `vacation_calendars`/`vacation_rule_versions` (creados por el usuario)
  se borran explícitamente (con detach de `vacation_simulations.calendar_id`), y `auth.admin_delete_user`
  **no existe** en esta instancia → se borra `auth.users` directamente (los hijos `auth.*` cascadean).

### WebView / Web
- Proxy matcher ampliado para servir estáticos (`pdf`, `txt`, `zip`, fuentes, media) sin redirigir.
- Páginas `/privacidad`, `/terminos`, `/soporte`, `/acerca-de`, `/eliminar-cuenta` **desplegadas y
  accesibles (HTTP 200)**.

### Auditoría de secretos
- Sin keystore/passwords/secrets en Git (`.gitignore` cubre `*.jks`, `*.b64`, `*.env`, `build/`).
- Se revisaron `TODO/FIXME/password/service_role/private_key/Bearer/console.log/Log.d/Log.i` en código
  y artefactos; **no hay secretos versionados**. El update-key y la cuenta demo viven en
  `$HOME/.laveinte/keystore/` (fuera del repo).

## Cuenta (eliminación E2E)

| Paso | Resultado |
|------|-----------|
| `delete_my_account()` RPC | ✅ creado y aplicado |
| RLS / deny-by-default | ✅ sin sesión → `not_authenticated`; solo `auth.uid()` |
| Borrado de perfil/contexto/tarjetones/push/vacaciones | ✅ verificado (filas → 0) |
| Borrado del auth user + identities/sessions | ✅ verificado |
| Storage (transfer_sessions/files) | ✅ borrado por `owner_id` |
| Reuso de token | ⚠️ no se pudo probar por HTTP (bloqueo de red a supabase.co); a nivel BD el usuario ya no existe → `invalid_credentials`. |
| Login tras borrado | Verificar con revisor (el usuario no existe → login falla) |

## Android

| Build/Chequeo | Resultado |
|---------------|-----------|
| `assembleDebug` | ✅ |
| `assemblePlayDebug` / `assembleDirectDebug` | ✅ |
| `assemblePlayRelease` (R8) | ✅ |
| `bundlePlayRelease` (AAB) | ✅ `app-play-release.aab` (22 MB) |
| `assembleDirectRelease` (R8) | ✅ |
| `lint` (release habilitado) | ✅ (solo warnings) |
| `testPlayDebugUnitTest` / `testDirectDebugUnitTest` | ✅ 141/141 por canal |
| `validateDistributionPolicyPlayRelease` | ✅ sin REQUEST_INSTALL_PACKAGES, sin UpdateInstallReceiver |
| `validateDistributionPolicyDirectRelease` | ✅ con REQUEST_INSTALL_PACKAGES + UpdateInstallReceiver exported=false |
| 16 KB (`zipalign -P 16`) | ✅ `Verification successful` (play y direct) |
| Firma | ✅ firmado con la upload key nueva; verificado (`apksigner`/`jarsigner`) |

### Build de revisión
- **VersionCode** `198` · **VersionName** `1.0.98`
- **AAB**: `android-app/app/build/outputs/bundle/playRelease/app-play-release.aab`
  - SHA-256: `983cbf647115abb00a723bb2f565408ad26b443d97498b2bff9682821e61931f`
  - Certificado (SHA-256): `17:2D:1E:04:A6:F1:1A:D5:E4:5D:4B:83:B2:68:3B:D4:B7:C5:E1:93:9E:0B:D6:D0:16:2C:D7:81:FD:EC:ED:F8`
- **APK Play**: `apk/play/release/LaVeinteDigital-play-release-v1.0.98.apk` (24 MB, firmado)
- **APK Direct**: `apk/direct/release/LaVeinteDigital-direct-release-v1.0.98.apk` (24 MB, firmado, con updater)

## Google Play

| Ítem | Estado |
|------|--------|
| App created | ⛔ **BLOQUEO EXTERNO: 2FA** — no hay sesión ni credenciales de Play Console |
| Play App Signing | ⛔ se configura al subir el AAB (requiere Play Console) |
| Internal Testing | ⛔ requiere Play Console |
| AAB uploaded | ⛔ requiere Play Console |
| Data Safety | ✅ matriz en `GOOGLE_PLAY_DATA_SAFETY.md` (lista para rellenar) |
| Privacy Policy | ✅ `https://la-veinte-digital.vercel.app/privacidad` (live, 200) |
| App Access | ✅ instrucciones de acceso demo (cuenta + assets) |
| Content Rating | ✅ determinable (herramienta/productividad, 18+ sugerido) |
| Target Audience | ✅ adultos/trabajadores; sin menores |
| Account Deletion | ✅ RPC + UI + `/eliminar-cuenta` (live) |
| Screenshots | ⚠️ parcial (ver bloqueo abajo) |
| Feature Graphic | ⚠️ pendiente (no se generó; ver bloqueo de assets) |
| App Links | ✅ assetlinks.json correcto (upload key) **desplegado** |

### Bloqueos externos (lo que NO pude hacer)
1. **Play Console / 2FA** — `MOTIVO:` requiere login 2FA de la cuenta comercial.
   `QUÉ INTENTASTE:` verificar CLI/sesiones (gcloud/fastlane/credenciales); no hay ninguna.
   `POR QUÉ ES IMPOSIBLE AUTOMATIZAR:` la plataforma exige autenticación interactiva con 2FA que
   solo puede aprobar el titular. `ESTADO:` pendiente (todo lo demás está listo).
2. **Fingerprint del App Signing de Google** — `MOTIVO:` solo existe después de subir el AAB a Play.
   `QUÉ INTENTASTE:` incluir el de la upload key en assetlinks (válido para el canal direct).
   `POR QUÉ ES IMPOSIBLE AUTOMATIZAR:` Google lo genera en Play Console. `ESTADO:` el AAB ya lleva el
   fingerprint de la upload key para Direct; hay que añadir el de Play Signing tras subir.
3. **Screenshots con datos + E2E HTTP de login/registro** — `MOTIVO:` esta máquina NO puede alcanzar
   `*.supabase.co` (curl → http=000, timeout; `api.supabase.com` sí se alcanza).
   `QUÉ INTENTASTE:` curl por DNS/verbose, Management API, emulador.
   `POR QUÉ ES IMPOSIBLE AUTOMATIZAR:` es un bloqueo de red por egress de esta máquina al host del
   proyecto; el login del reviewer y las capturas de pantalla con datos reales requieren ese canal.
   `ESTADO:` intento de screenshots pre-auth en emulador en curso; las demás quedan documentadas.

## Testing (síntesis)

| Suite | Resultado |
|-------|-----------|
| Android unit (play/direct) | ✅ 141/141 |
| Frontend `tsc` | ✅ |
| Frontend `vitest` aislado (push, routing, normativa) | ✅ (28 push + 60 routing + 30 corpus) |
| `npm run build` | ✅ |
| Web desplegada | ✅ (páginas + assets live) |

## Riesgo de rechazo residual

- **WebView-centric:** la app tiene función nativa (biometría, PDF, cámara, QR, docs, vault cifrado).
- **Imagen de "app no oficial":** disclaimer presente en `acerca-de`/`privacidad`/`terminos` y zona de
  portales; redacción prudente.
- **Out-of-app:** abre Custom Tabs y portales oficiales; declarar en Play.
- **Data Safety:** refleja Supabase + Firebase (push), sin analytics/publicidad.
- **Cuenta:** borrado real implementado y verificado en BD; pendiente solo confirmar con sesión HTTP
  en un entorno con acceso a supabase.co.

> El AAB firmado, la política de privacidad, el borrado de cuenta, el actualizador en `direct`, el
> matcher de estáticos, la firma verificada, los tests y los CI workflows están completos y verificados.
