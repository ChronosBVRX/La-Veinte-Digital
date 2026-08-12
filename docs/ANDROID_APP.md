# Aplicación Android (La Veinte Digital)

> Documentación técnica de referencia para agentes futuros.
> Ámbito: `android-app/` (shell nativo Compose) que embebe el Home web
> (`https://la-veinte-digital.vercel.app`) en un WebView persistente.
> Última actualización: **2026-08-12 — v1.0.49 (versionCode 149)**.

Esta guía describe rutas, APIs, flujos de datos y convenciones del shell
Android para que cualquier agente pueda retomar el trabajo **sin romper
funcionalidad ni provocar regresiones**. Antes de tocar código, lee también
`AGENTS.md`, `docs/ARCHITECTURE.md` y `docs/TARJETON_IMPORT.md` (la parte
web del mismo producto).

---

## 1. Resumen

- **Paquete**: `com.laveintedigital.app` (debug: `com.laveintedigital.app.debug`).
- **Idioma de UI**: español (es-MX). No se usa i18n.
- **Modelo**: shell híbrido. El WebView interno carga SIEMPRE el Home web desde
  `https://la-veinte-digital.vercel.app` (`DEFAULT_URL` en `MainActivity.kt`).
  El web (Next.js) contiene login/auth Supabase, dashboard, calculadoras,
  tarjetón web, etc. El shell nativo añade: actualizaciones OTA, biometría,
  bóveda de credenciales IMSS, captura de tarjetones de los portales oficiales,
  visor PDF local, navegación por dominios y gestos.
- **Stack**: Kotlin 2.0.21, Jetpack Compose (BOM 2024.09.03, Material 3),
  Navigation Compose 2.8.2, Room 2.6.1, DataStore 1.1.1, Biometric 1.1.0,
  AndroidX WebKit 1.11.0, Browser (Custom Tabs) 1.8.0. AGP 8.10.0.
- **SDKs**: `compileSdk 35`, `minSdk 29`, `targetSdk 35`. Java/Kotlin target 17.

---

## 2. Estructura del código

```
android-app/app/src/main/java/com/laveintedigital/app/
├── MainActivity.kt            # Activity única (singleTask), bootloader, lock, updates
├── LaVeinteApplication.kt     # canal de notificaciones "la_veinte_downloads"
├── DeepLinkBus.kt             # transporta URIs de onNewIntent → Compose tree
├── StartupCoordinator.kt      # estados del bootloader (progress/messages)
├── UpdateManager.kt           # coordinador del ciclo de actualización
├── UpdateTrigger.kt           # trigger manual desde el bridge web
├── UpdateDialogs.kt           # AlertDialogs del flujo OTA
├── BootloaderScreen.kt / OfflineErrorScreen.kt
├── nav/                       # NavRoute (rutas) + AppNavHost (grafo)
├── internal/                  # WebView interno + bridge JS
│   ├── InternalWebScreen.kt
│   ├── LaVeinteBridge.kt            # addJavascriptInterface (LEGACY, sin wiring)
│   ├── LaVeinteBridgeInjector.kt    # bridge ACTIVO (inyección JS + laveinte://)
│   ├── LaVeinteInternalWebViewClient.kt
│   ├── LaVeinteChromeClient.kt
├── external/                  # Navegador externo integrado (chrome mínimo)
│   ├── ExternalBrowserScreen.kt
│   ├── LaVeinteExternalWebViewClient.kt
│   └── ExternalWebViewScrollCallback.kt
├── routing/                   # Decisión de a dónde va cada URL
│   ├── Domains.kt, NavigationRouter.kt, NavigationTarget.kt
├── intents/                   # IntentLauncher (intents genéricos + Custom Tabs)
├── downloads/                 # LaVeinteDownloadListener (DownloadManager)
├── security/                  # Bloqueo + biometría
│   ├── AppLockManager.kt, BiometricKeyStore.kt, BiometricPreferences.kt
│   ├── LaveinteBiometricManager.kt, BiometricUnlockScreen.kt
├── imss/
│   ├── credentials/           # Bóveda de credenciales (Keystore+DataStore+Room)
│   │   ├── ImssCredentialModels.kt, ImssCredentialKeyStore.kt
│   │   ├── ImssCredentialRepository.kt, ImssVaultManager.kt
│   │   └── ImssCredentialUnlock.kt
│   ├── portal/                # Automatización portales IMSS + captura PDF
│   │   ├── TuPerfilFlowController.kt + TuPerfilFlowState.kt + TuPerfilPortalAdapter.kt
│   │   ├── ImssPdfCaptureCoordinator.kt, ImssAuthDetector.kt, PortalDetectionRules.kt
│   │   ├── ImssLoginAdapters.kt, NativeDomTapper.kt
│   ├── payslips/              # Room + descarga de PDFs
│   │   ├── PayslipDatabase.kt (PayslipDao + PayslipDocument)
│   │   └── ImssPayslipDownloader.kt
│   ├── tarjeton/              # modelos de captura (TarjetonCaptureSession, etc.)
│   └── ui/                    # Pantallas compose
│       ├── OfficialPayslipsScreen.kt + OfficialServiceCard.kt   # hub (claro)
│       ├── ImssPortalScreen.kt, PayslipHistoryScreen.kt
│       ├── PayslipViewerScreen.kt, SaveImssCredentialsScreen.kt
│       ├── ManageImssCredentialsScreen.kt, TuPerfilLoginDialog.kt
│       └── TuPerfilTarjetonOverlay.kt
├── ui/theme/                  # Colores, tipografía, tema + StatusBarAppearance
└── updates/                   # Lógica OTA
    ├── UpdateRepository.kt, UpdateManifest.kt, UpdateState.kt, UpdateCache.kt
    ├── UpdateDownloader.kt, ApkVerifier.kt, ApkInstaller.kt, UpdateInstallReceiver.kt
```

---

## 3. Build y entorno

### 3.1 Prerrequisitos

- **`JAVA_HOME` OBLIGATORIO** apuntando al JBR de Android Studio, o el daemon de
  Gradle falla (error: `Could not reserve enough space for 2097152KB object
  heap`):
  ```powershell
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
  ```
- Requiere SDK Android 35 y `local.properties` con `sdk.dir`.

### 3.2 Comandos

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :app:compileDebugKotlin   # compilar rápido
.\gradlew.bat :app:assembleDebug        # APK debug instalable
```

El APK de salida queda en
`app\build\outputs\apk\debug\LaVeinteDigital-debug-v<version>-debug.apk`.

### 3.3 Signing (release)

Definido en `app/build.gradle.kts`. La firma **release** se lee de variables de
entorno (nunca commitearlas): `LAVEINTE_KEYSTORE_BASE64`, `LAVEINTE_KEYSTORE_PASSWORD`,
`LAVEINTE_KEY_ALIAS`, `LAVEINTE_KEY_PASSWORD`. El keystore se materializa como
archivo temporal Base64 y se elimina al salir.

Build types: `debug` (suffix `.debug` + `-debug`, minify off · el que se publica
para OTA), `release` (minify + shrink, firma env) y `releaseDebug` (initWith
release pero firma debug — para testear minify localmente).

---

## 4. Versionado y publicación OTA (regla CRÍTICA)

**Regla vigente**: **cada modificación de código requiere bump de versión +
actualización de la documentación y publicación OTA**. Cambios puramente
documentales **no** bump an APK (evitar deriva entre `latest.json` y el binario).

Checklist de publicación (ejecutado en las versiones 1.0.44/145/146):

1. **Bump** en `android-app/app/build.gradle.kts`: `versionCode` (único y
   creciente) y `versionName` (`X.Y.Z`).
2. **Compilar**: `:app:assembbleDebug`.
3. **Copiar** el APK a `public/LaVeinteDigital.apk` (raíz de `vercel.json`).
4. **SHA-256** del APK (verificar 64 dígitos en minúsculas).
5. **Actualizar** `public/android/stable/latest.json`: `versionCode`,
   `versionName`, `publishedAt`, `apk.url`, `apk.sha256`, `apk.size`, y
   `releaseNotes` con los cambios en español.
6. **Deploy**: `vercel --prod --yes` (solicitar aprobación/confirmación).
7. **Verificar**: `HEAD https://la-veinte-digital.vercel.app/LaVeinteDigital.apk`
   → 200 y tamaño coincidente; GET `latest.json` → versionName/sha coincidentes.

Estado actual de producción: **1.0.49 / 149** — SHA
`390c7403e2e6d3a380efcc5d8234c33c3b4785d13633d136e5e91ad50a6fa3b4`,
66,559,588 bytes.

**Canales**: `/android/{stable,beta,dev}/latest.json`. La app solo consulta
`stable`. El `proxy` de Next.js excluye `.apk`/`.json` del matcher de auth.

---

## 5. Navegación (Compose Navigation)

Rutas definidas en `nav/NavRoute.kt` y grafo en `nav/AppNavHost.kt`.
`startDestination = NavRoute.Internal.route` (`"internal"`).

| Ruta | create(...) | Pantalla | Args |
|---|---|---|---|
| `internal` | — | `InternalWebScreen` | — |
| `external/{url}` | `Uri.encode(url)` | `ExternalBrowserScreen` | url (String) |
| `official_payslips` | — | `OfficialPayslipsScreen` | — |
| `imss_portal/{portalId}/{autoLogin}` | `create(portalId, autoLogin)` | `ImssPortalScreen` | portalId, autoLogin (Bool, default false) |
| `imss_save_creds/{portalId}` | `create(portalId)` | `SaveImssCredentialsScreen` | portalId |
| `payslip_history` | — | `PayslipHistoryScreen` | — |
| `payslip_viewer/{filePath}` | `Uri.encode(filePath)` | `PayslipViewerScreen` | filePath |
| `manage_imss_creds` | — | `ManageImssCredentialsScreen` | — |

Detalles del grafo:

- **Internal** → maneja navegación externa dentro de `InternalWebScreen`
  (External → navega a `external/...`; CustomTab/Intent → callbacks).
- **Save creds** → al guardar, guarda `savedPayload` y navega a
  `imss_portal/{portalId}/true` (autoLogin). "Saltar" navega con `false`.
- **ImssPortal** → resuelve el portal por `portalId` buscando en
  `ImssPortal.entries`; si no existe, no renderiza nada.
- **PayslipViewer** recibe una **ruta absoluta local**; nunca un blob ni URL.
- `onCustomTab` y `onIntent` van a `IntentLauncher`.

### Deep links (AndroidManifest.xml)

- `https://la-veinte-digital.vercel.app` (`autoVerify`) → verificación de
  vínculo de app.
- `com.laveintedigital.app` (esquema propio).
- Ambos en `MainActivity` (singleTask). El URI llega por `onNewIntent` →
  `DeepLinkBus.dispatch(intent)`. Si la app está LOCKED, se guarda en
  `AppLockManager.pendingDeepLink` y se re-despacha al desbloquear.

---

## 6. Ruteo de URLs (navegación del WebView)

### 6.1 `routing/Domains.kt` — listas de hosts

- `INTERNAL_HOSTS`: `la-veinte-digital.vercel.app`, `laveinte-digital.vercel.app`,
  `la-veinte-digital.pages.dev`, `la-veinte-digital.localhost`.
- `EXTERNAL_WEBVIEW_HOSTS`: gobierno/SNTSS que deben abrirse dentro del navegador
  integrado (`imss.gob.mx`, `sat.gob.mx`, `sntss.org.mx`, `gob.mx`,
  `stps.gob.mx`, `condusef.gob.mx`, `infonavit.gob.mx`, `prosperabit.gob.mx`).
- `CUSTOM_TAB_HOSTS`: OAuth/bancos que requieren el navegador del sistema
  (`accounts.google.com`, `login.microsoftonline.com`, `facebook.com`, `x.com`,
  `appleid.apple.com`, `github.com`, `mercadopago.com.mx`, `stripe.com`,
  `wa.me`, etc.).
- `INTENT_SCHEMES`: `tel`, `mailto`, `sms`, `smsto`, `geo`, `whatsapp`,
  `intent`, `market`, `vnd.youtube`, `maps`, `lyft`, `uber`, `waze`.
- `BLOCKED_SCHEMES`: `javascript`, `file`, `content`, `about`.

### 6.2 `routing/NavigationRouter.kt` — filtro puro

Orden de resolución: bloqueados → internal → (http/https) external → custom-tab
→ default external para cualquier otro host http(s) → INTENT_SCHEMES → Block.
`shouldOverride(url)` devuelve `true` si el target NO es Internal (usado por
`LaVeinteExternalWebViewClient`). **Ojo**: `LaVeinteInternalWebViewClient`
usa su propia lógica simplificada (ver 7.3) y NO `NavigationRouter.resolve`
para la decisión de `shouldOverrideUrlLoading`.

---

## 7. WebView interno (INTERNAL) y navegador externo (EXTERNAL)

### 7.1 Configuración base (`util/WebSettingsExt.kt`)

`configureForLaVeinte(appVersion)`: JS on, DOM storage on, DB storage on, file
access on, `mediaPlaybackRequiresUserGesture=false`, un solo WebView
(`setSupportMultipleWindows(false)` — `target=_blank` navega en el mismo),
y UA con sufijo `LaVeinteDigitalAndroid/<v>` para permitir detección nativa en
la web. Cache `LOAD_DEFAULT`.

### 7.2 `internal/InternalWebScreen.kt` (la pantalla principal)

- WebView persistente; fondo de carga con logo + progress en gradiente navy.
- **Bridge handlers** (vía `BridgeHandler` + `LaVeinteBridgeInjector`):
  - `onOpenOfficialPayslips` → navega a `official_payslips`.
  - `onCheckForUpdate` → `UpdateTrigger.request()`.
  - `onAuthenticated` → si la web reportó login y la biometría está disponible,
    muestra el diálogo de invitación a enrolamiento.
  - `onLoggedOut` → borra llave biometría + preferencias, `AppLockManager.lock()`.
- **Enrollamiento biometría**: genera secreto de 32 bytes, lo cifra con
  `BiometricKeyStore`, guarda `BiometricEnrollment` en `BiometricPreferences`.
- **File chooser** (`LaVeinteChromeClient.onShowFileChooser`) usa launcher de
  `ActivityResultContracts.StartActivityForResult()` y `FileChooserParams`.
- **Deep link**: colecta `DeepLinkBus.uri` y hace `webView.loadUrl(uri)`.
- **Back**: primero `webView.canGoBack()/goBack()`, si no, pop del NavHost.
- **Offline**: `LaVeinteInternalWebViewClient` marca `isOffline`; se muestra
  `OfflineErrorScreen` con "Reintentar" → `webView.reload()`.
- **Descargas**: `attachDownloadListener(ctx)`.

### 7.3 `LaVeinteInternalWebViewClient`

`shouldOverrideUrlLoading` (en orden):
1. `handleBridgeUrl(url)` (scheme `laveinte://bridge/...`) → handled.
2. Esquemas `KNOWN_INTENT_SCHEMES` (`tel|mailto|sms|smsto|whatsapp|geo|market|intent`)
   → `NavigationTarget.Intent`.
3. Host en `CUSTOM_TAB_HOSTS` → Custom Tab.
4. Host en `EXTERNAL_WEBVIEW_HOSTS` → `NavigationTarget.External`.
5. Todo lo demás **se carga en el mismo WebView** (return false).

En `onPageFinished`, si el host es interno, inyecta el bridge JS y lanza el
evento `laveinte:native-ready`. `onReceivedSslError` → cancelar + callback.
`onReceivedError` (main frame) → offline.

### 7.4 `external/ExternalBrowserScreen.kt`

Barra superior navy (44dp) con back/dominio/lock/close; se oculta al hacer
scroll (scroll-up re-muestra). `LaVeinteExternalWebViewClient`: cualquier host
interno → `onReturnToLaVeinte()` (pop al `internal`, que conserva estado);
CustomTab/Intent → `IntentLauncher`; el resto carga aquí. `NavigationRouter`
sí se usa en esta pantalla.

### 7.5 Puente JS (`window.LaVeinteApp`) — **ACTIVO**

El mecanismo ACTUAL es `LaVeinteBridgeInjector` + `handleBridgeUrl` +
`BridgeHandler`. Se inyecta por `evaluateJavascript` (más fiable que
`addJavascriptInterface`) **solo cuando el host del WebView es interno**.

Métodos expuestos a la web (inyección):
`appPlatform()="android"`, `appVersion()`, `sdkVersion()`, `packageName()`,
`isNativeApp()=true`, `hasBiometrics()` (mock), `isBiometricsEnabled()` (mock),
`openExternal(url)`, `openOfficialPayslips()`, `checkForUpdate()`,
`hasImssCredentials(portalId)`, `onAuthenticated()`, `onLoggedOut()`, `log(msg)`.

Los métodos "callback" viajan al nativo mediante **intercepción de URL**
`laveinte://bridge/<path>[?portalId=...]` capturada en
`LaVeinteInternalWebViewClient` → `handleBridgeUrl` → `BridgeHandler`:

| URL | Handler |
|---|---|
| `laveinte://bridge/openOfficialPayslips` | `onOpenOfficialPayslips` |
| `laveinte://bridge/checkForUpdate` | `onCheckForUpdate` |
| `laveinte://bridge/onAuthenticated` | `onAuthenticated` (invitación biometría) |
| `laveinte://bridge/onLoggedOut` | `onLoggedOut` (limpiar biometría + lock) |
| `laveinte://bridge/hasImssCredentials?portalId=...` | consumido (sin retorno) |
| `laveinte://bridge/openExternal?url=...` | (definido en JS inyectado) |

> **LEGACY / NO WIRE**: `internal/LaVeinteBridge.kt`
> (clase `LaVeinteBridge` con `@JavascriptInterface`, `installLaVeinteBridgeFor`,
> `injectBridgeFallback`) NO está conectado a `InternalWebScreen`. No usarlo;
> si se vuelve a activar, mantener los nombres de métodos idénticos a los de la
> inyección para no romper la web que los llama (`window.LaVeinteApp.*`).

---

## 8. Flujo OTA (actualización en la app)

### 8.1 Estados (`updates/UpdateState.kt`)

`Idle → Checking → Available(manifest) | UpToDate | Error → Downloading(progress) →
Verifying → ReadyToInstall → install()`. `forceUpdate` se marca si
`manifest.minimumVersionCode > currentCode`.

### 8.2 Coordinación (`UpdateManager.kt` + `MainActivity`)

- `UpdateRepository.fetch(context, channel="stable")`: GET
  `$BASE_URL/android/stable/latest.json` con timeouts 10s; si
  `manifest.versionCode <= current` lanza `NoUpdateAvailableException`.
- Cache en DataStore `la_veinte_update_cache` (`UpdateCache`): usado como
  fallback offline (y si el cache marcaba forceUpdate pendiente).
- `UpdateDownloader` baja a `filesDir/updates/LaVeinteDigital-<v>.apk` (timeouts
  30s/300s, sigue redirects).
- `ApkVerifier.verify(file, apk.sha256)`: compara SHA-256; si el sha del
  manifest está vacío salta la verificación. **No instalar si falla**
  (borra el archivo).
- `ApkInstaller.install`: usa `PackageInstaller.Session` con receiver
  (`UpdateInstallReceiver`); si no hay permiso de instalar, abre
  `ACTION_MANAGE_UNKNOWN_APP_SOURCES`; fallback `ACTION_VIEW` con FileProvider.
- `UpdateInstallReceiver` muestra notificación con el resultado del commit y
  maneja `STATUS_PENDING_USER_ACTION`.
- En `MainActivity`: el check corre tras el bootloader; `UpdateTrigger.pending`
  (desde bridge) lanza check manual con Toast de feedback; dialogs en
  `UpdateDialogs.kt` (normal / forzado / descarga / verifica / listo / error).

### 8.3 Descargas normales (`downloads/LaVeinteDownloadListener.kt`)

Usa `DownloadManager` → `Environment.DIRECTORY_DOWNLOADS/La Veinte Digital/`,
notificación low-priority en el canal `la_veinte_downloads`, fallback ACTION_VIEW.
Nombre resolvido: `content-disposition` → último segmento URL → sintetizado por
mime.

---

## 9. Seguridad

### 9.1 Bloqueo + biometría

- `AppLockManager`: estados `LOCKED/UNLOCKING/UNLOCKED`; auto-rebloqueo a los
  **5 min** (`tickForeground` cada 30s en `MainActivity`); `shouldLockOnReturn`
  al volver de background; `pendingDeepLink` para deep links mientras está
  bloqueada.
- `BiometricKeyStore`: AES/GCM 256 AES en Android Keystore, alias
  `laveinte_biometric_key`, `userAuthenticationRequired` + BIOMETRIC_STRONG.
- `BiometricPreferences`: DataStore `la_veinte_biometric` con `biometric_enabled`
  y el `BiometricEnrollment` (ciphertext+IV+ts).
- `BiometricUnlockScreen`: pantalla navy con BiometricPrompt (CryptoObject de
  decrypt); al exito `AppLockManager.unlock()`; fallback si no hay sensor.
- `MainActivity.updateSecureFlags()`: añade/az FLAG_SECURE según lock state
  (pantalla protegida de capturas mientras bloqueada).

### 9.2 Bóveda de credenciales IMSS

- **Claves**: `ImssCredentialKeyStore` — AES/GCM 256, una llave por portal en
  Keystore (`laveinte_imss_<portalId>_v1`); **no** exige re-autenticación (el
  acceso está gated por la misma app y biometría).
- **Datos cifrados (ct+iv)**: DataStore `laveinte_imss_vault`
  (`ImssCredentialRepository`, claves `imss_ct_<id>` / `imss_iv_<id>`, Base64).
- **Metadatos**: Room `imss_credentials` (`ImssCredentialEntity`: portalId PK,
  versions/timestamps) — la tabla existe en `PayslipDatabase` aunque
  `ImssVaultManager` la roza de forma poco limpia (no inserta entidad; ver nota).
- `ImssVaultManager`: orquesta save/read/delete (Keystore + DataStore).
- `ImssPortal`: `TU_PERFIL` (tuperfil.imss.gob.mx) y `TARJETON_DIGITAL`
  (rh.imss.gob.mx).
- Guardar requiere **biometría fuerte disponible** (`ImssCredentialUnlock.canUseBiometric`);
  sin ella la pantalla de guardar deshabilita el formulario.

> Regla de seguridad: las credenciales IMSS NUNCA se suben a ningún servidor;
> se cifran localmente con llave no exportable y viven solo en el dispositivo.

---

## 10. IMSS: portales, tarjetones y visor PDF

### 10.1 Hub "Tarjetones oficiales" (`OfficialPayslipsScreen` + `OfficialServiceCard`)

Pantalla CLARA (diseño 1.0.46):
- Grid 2 columnas (compact < 360dp con paddings menores), altura celda =
  `ancho / 0.78`.
- 4 tarjetas blancas: **Tu Perfil IMSS**, **Tarjetón Digital**, **Mis
  tarjetones** (contador de documentos; singular: "1 documento guardado"),
  **Administrar accesos** (con badge "Guardado" si hay credenciales).
- Card: fondo blanco, sombra 2dp + borde `outline` 1dp (alpha 0.7), esquinas
  16/20dp, título `onSurface`, descripción `onSurfaceVariant`, CTA texto
  `Primary` semibold 13-14sp + flecha (SIN cápsula outline), ilustración con
  color en la familia azul/navy/celeste, icono principal + 2 accent icons.
- AppBar clara con divisor; `StatusBarAppearance(lightIcons = true)`.
- Al montar: carga `PayslipDatabase.count()`, credenciales de ambos portales, y
  `ImssPdfCaptureCoordinator.cleanOrphans(context)`.

### 10.2 Portal (`ImssPortalScreen`) y flujo Tu Perfil

- URL login: Tu Perfil `https://tuperfil.imss.gob.mx/guitpei-web/login`;
  Tarjetón Digital `https://rh.imss.gob.mx/Personal/TarjetonDigital/`.
- WebView con cookies compartidas (`CookieManager`), desktop viewport para Tu
  Perfil, debug remoto habilitado en DEBUG (`setWebContentsDebuggingEnabled`).
- **Tu Perfil** → `TuPerfilFlowController`:
  - `CheckingSession` → intenta auto-login con credenciales guardadas
    (descifradas vía `ImssVaultManager`); si no, `LoginRequired` → diálogo
    nativo (`TuPerfilLoginDialog`) → `loginWithCredentials` llama a `doLogin`
    **directamente con los valores en memoria** (sin esperar a que se complete
    el guardado en Keystore). Las credenciales se persisten **solo después**
    de que el login es exitoso — nunca se guarda una contraseña incorrecta.
    Protección `loginJob` anti-doble-tap.
  - Login automático: detecta inputs `#matricula`/`#password`, los rellena vía
    `HTMLInputElement.prototype.value` setter + eventos, clickea botón
    "iniciar sesión" (normalizado sin acentos), espera pathname que contenga
    `/guitpei-web/app`. Fallback manual tras 10s.
  - Tarjetón: navega a `.../app/administration/card`, espera DOM, corre un
    script único de automatización (`CARD_AUTOMATION_JS`) que escoge OOAD **17
    (Michoacán)** y el período más reciente, dejando resultados en
    `window.__LVD_CARD_RESULT__/__STATE__/__ERROR__` (polling desde Kotlin).
  - El overlay `TuPerfilTarjetonOverlay` permite cambiar OOAD/período,
    consultar, reintentar y abrir el "formulario original" del portal.
- **Captura del PDF** (`ImssPdfCaptureCoordinator`): doble vía —
  1) `DownloadListener` capturando descargas HTTP `.pdf` (descarga autenticada
  con cookies y valida cabecera `%PDF-`), 2) monitor JS inyectado
  (`PDF_MONITOR_SCRIPT`) que intercepta `URL.createObjectURL` de Blobs PDF y los
  lee como Base64 (`__LVD_PDFS__` map, polling 2s desde `ImssPortalScreen`).
  Los bytes se validan (`%PDF-`), se escriben de forma atómica (`.tmp` → rename)
  en `filesDir/Tarjetones/<portalId>/<ooad>/<period>/`, y se insertan en Room
  deduplicando por SHA-256 (`wasDuplicate`). Secuencia 1 = tarjetón,
  secuencia 2 = conceptos (asociado vía `updateConceptsPath`). Timeout de
  búsqueda 45s.

### 10.3 Room (`PayslipDatabase`)

- DB `laveinte_payslips.db`, versión **2** (migración 1→2 añade `conceptsPath`).
- Entidad `payslip_documents`: `id`, `source` ("TU_PERFIL"/"TARJETON_DIGITAL"),
  `displayName`, `localPath`, `downloadedAt`, `fileSize`, `sha256`, `mimeType`,
  `periodLabel`, `conceptsPath`, `sourceHost`.
- `findByHash` para dedupe; `count()` para el hub; `getAll()` (DESC) para el
  historial.

### 10.4 Historial (`PayslipHistoryScreen`)

Navy AppBar; lista con nombre/fecha/tamaño; acciones Ver (→ viewer),
Compartir (FileProvider `application/vnd.android.package-archive` no —
`application/pdf` + chooser), Eliminar (confirma; borra DB + archivo).
Únicamente elimina del dispositivo.

### 10.5 Visor PDF (`PayslipViewerScreen`)

- Renderiza todas las páginas a bitmaps **off-main-thread** con `PdfRenderer`,
  factor ~1.5-2.5x (crisp en zoom), fondo blanco.
- `<1.0.44` → el cenit era `splineBasedDecay/animableDecay`; la inercia se
  reemplazó por **decaimiento exponencial manual** (`withFrameNanos`,
  `exp(-4.8f * dt)`).
- **Motor de gestos actual (1.0.45+)**: 1:1 directo.
  - `FLING_ENABLED = false` (el `flingJob` existe pero `FLING_ENABLED` lo apaga
    hasta validar el pan).
  - Zoom: 1-5x; double-tap: toggle 2.25x anclado al punto.
  - Estado `listScrollEnabled` **desacoplado** de `scale` (`LaunchedEffect(scale)`
    → `scale <= 1f`) para impedir recomposición del `LazyColumn` en cada frame
    de gesto; `userScrollEnabled = listScrollEnabled`.
  - El layer zoomable toma el gesto si `count >= 2 || (count == 1 && scale > 1f)`;
    consume todos los cambios. Fórmula por evento:
    ```
    ratio = newScale/oldScale
    appliedX = pan.x + (1-ratio) * (centroidOld.x - beforeX - cx)
    ```
    donde `centroidOld = centroid - pan`. Con `ratio == 1` colapsa a
    `offset += pan` (pan directo 1:1, en px de viewport) — corrige el bug
    previo donde el pan se descartaba al hacer zoom (solo ancla).
  - `clampOffsets()`: `coerceIn(-max, max)` con `max = (viewport*scale-viewport)/2`
    (SIN resistencia de borde).
  - `resetZoom()` cuando `scale <= 1`.
  - **Debug**: log `PDF_PAN_DEBUG` cada ~100ms con `scale/pan/applied/offset/
    clamped/fingers` — SOLO en `BuildConfig.DEBUG`. Reiniciar/validar con él al
    tocar el motor.
- Indicador de página (n/n) estilo pill; botones Ajustar (reset) y Compartir
  (FileProvider; ojo: el share sheet hace `onPause` — NO cerrar el visor al
  volver).

---

## 11. Tema / Design System (política CLARA)

- **`ui/theme/Theme.kt`**: `LaVeinteTheme` NO tiene parámetro `darkTheme` y
  SIEMPRE usa `lightColorScheme` (la marca es clara y el Home web siempre
  renderiza claro — **no debe heredar el modo oscuro del teléfono**; esta fue la
  raíz del "dark/gaming"). Define iconos claros (dark icons) por defecto y barras
  transparentes.
- **`ui/theme/StatusBarAppearance.kt`**: `StatusBarAppearance(lightIcons)` por
  pantalla — override de `isAppearanceLightStatusBars` con DisposableEffect que
  restaura el valor previo al salir.
  - Pantallas navy (Bootloader, BiometricUnlock, Manage/Save creds,
    PayslipHistory, ImssPortal, PayslipViewer, External browser):
    `lightIcons = false` (iconos blancos).
  - Pantallas claras: `OfficialPayslipsScreen` → `lightIcons = true`.
- **Colores** (`ui/theme/Color.kt`): mirror del CSS web: `Bg #F8FAFC`,
  `Fg #0F172A`, `Primary #2563EB`, `Border #E2E8F0`, `Muted #64748B`,
  `Card #FFF`, `Accent #F1F5F9`; navy de marca `BrandNavy #17324D`,
  `BrandBlue #2E4F77`, `BrandCyan #4DA1A8`; acentos tarjetones
  `SkyBlue/SteelBlue/LightBlue300/HeroNavyTop/HeroNavyBottom`.
- Accesibilidad: si una pantalla nueva es navy/full-color, añadir
  `StatusBarAppearance(lightIcons = false)`; si es clara, `true`. No usar el
  esquema oscuro.

---

## 11b. LaVeinteDesignSystem v1 (LVD) — identidad visual nueva

Desde **1.0.48** existe `com.laveintedigital.app.ui.lvd` con la identidad visual
que refleja la plataforma web (fondo claro + cards blancas + navy oscuro + azul
eléctrico). Es un **refactor visual**: los componentes NO cambian lógica.

### Paleta (tokens en `ui/lvd/LvdColors.kt`)

| Token | Hex |
|---|---|
| `LvdColors.Navy` | `#161F32` |
| `LvdColors.Blue` | `#2462EA` |
| `LvdColors.Background` | `#F7F9FA` |
| `LvdColors.Surface` | `#FFFFFF` |
| `LvdColors.SurfaceSoft` | `#F3F6F9` |
| `LvdColors.TextPrimary` | `#161F32` |
| `LvdColors.TextSecondary` | `#5E728C` |
| `LvdColors.TextMuted` | `#9DA2AA` |
| `LvdColors.Border` | `#D9E1EA` |
| `LvdColors.BorderStrong` | `#B9CADF` |
| `LvdColors.Info` | `#5F92F1` |
| `LvdColors.Success` | `#5FCA8A` |
| `LvdColors.Warning` | `#F0C65B` |
| `LvdColors.Error` | `#EEAFAA` |

Regla: **ningún composable usa hex suelto**. Todo pasa por `LvdColors` /
`LvdSemantic` para poder cambiar la identidad desde un archivo.

### Tokens (`ui/lvd/LvdTokens.kt`)

- Radios: `Small 8` / `Medium 12` / `Large 18` / `Sheet 28` (arriba) / `Button 14`
  / `Field 14` / `Card 16`.
- Espaciado: `LvdSpacing.{Xs 4, Sm 8, Md 12, Lg 16, Xl 20, Xxl 24, Xxxl 32}`.
- Elevación: `Card 1` / `Sheet 8` / `Floating 4` dp (sombras mínimas, nada de
  negros fuertes).
- Dimens: `ButtonHeight 52`, `FieldHeight 56`.

### Componentes (`ui/lvd/`)

- **`LvdSurfaces.kt`**: `LvdTopBar` (navy, título blanco, subtítulo 70%),
  `LvdBottomSheet` (28dp arriba, con grab handle + close opcional),
  `LvdDialog` (superficie blanca, radio 18dp, `containerColor` configurable),
  `LvdCard` (blanca, 1dp, `containerColor` configurable para avisos),
  `LvdStatusCard` (icono + título + subtítulo), `LvdSectionHeader`
  (título + subtítulo + acción).
- **`LvdInputs.kt`**: `LvdPrimaryButton` (azul #2462EA, blanco, 52dp, radio 14,
  con `loading` + `loadingText` + `fullWidth`), `LvdSecondaryButton` (contorno
  fino + azul), `LvdTextField` (superficie suave, borde fino #D9E1EA, al enfocar
  borde/icono azul — **sin bordes navy gruesos**), `LvdFormField` (alias de
  LvdTextField para formularios), `LvdSelectField` (dropdown LVD con flecha
  azul, label + hint informativo).
- **`LvdStates.kt`**: `LvdLoadingState` (spinner azul + título),
  `LvdErrorState` (icono rojo + Reintentar), `LvdSuccessState` (check verde,
  animación scale 0.94→1), `LvdFullscreenState` (scrim + contenido centrado),
  `LvdMotion.StateTransition` (220ms).

### Migración actual (1.0.48) — Tu Perfil IMSS completo

Solo se migró el flujo Tu Perfil (refactor visual, lógica intacta):

- `TuPerfilLoginDialog.kt` → bottom sheet 28dp, `LvdTextField` para
  usuario/contraseña, check "Recordar mis datos", `LvdPrimaryButton`.
- `TuPerfilTarjetonOverlay.kt` → bottom sheet con selector OOAD/Periodo
  (`LvdSelectField`, hint "Último periodo disponible"), CTA azul, estados
  `GENERATING` (loading) / `COMPLETED` (LvdSuccessState + Ver/Histórico) /
  `ERROR` (LvdErrorState + Abrir formulario original). `debugStage` solo en DEBUG.
- `ImssPortalScreen.kt` → `LvdTopBar` navy con subtítulo host; `LoadingOverlay`
  ahora usa `LvdColors.Scrim` + `LvdLoadingState` + "Entrar manualmente".

### Migración modales/formularios (1.0.49)

- `SaveImssCredentialsScreen.kt` → `LvdTopBar` + `LvdSectionHeader` +
  `LvdTextField` (usuario/contraseña) + `LvdPrimaryButton` (con `loading`),
  aviso de "sin biometría" como `LvdCard` ámbar (`containerColor = Warning alpha`).
- `ManageImssCredentialsScreen.kt` → tarjetas blancas `LvdCard` por portal;
  "Olvidar acceso" y "Actualizar acceso" como `LvdDialog` con `LvdTextField`.
- `UpdateDialogs.kt` (OTA) → todos los diálogos (disponible/obligatoria/
  descarga/verificación/lista) ahora son `LvdDialog` con tokens LVD.
- `PayslipHistoryScreen.kt` → confirmación de eliminación con `LvdDialog`.

> **Pendiente**: migrar el resto de pantallas (hub Tarjetones, historial,
> visor PDF, bootloader, biometría, portales) cuando el usuario apruebe la
> identidad. Mantener los componentes/tokens LVD y NO volver a dispersar
> colores ni AlertDialog genéricos.

---

## 12. Lado servidor — `src/proxy.ts` y `latest.json`

- `src/proxy.ts` (función **`proxy`**, NO `middleware`): maper matcher excluye
  rutas estáticas incluyendo `*.apk` y `*.json`
  (`/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|apk|json)$).*)`).
  Clasifica las rutas con `classifyRequestPath` (`src/shared/server/routing/route-policy.ts`):
  APIs desconocidas → JSON 404; públicas pasa; autenticadas sin sesión → 401;
  páginas sin sesión → redirect `/login`.
  **Implicación**: `public/android/stable/latest.json` y `public/LaVeinteDigital.apk`
  son públicos (sin auth) para que la app los consuma con curl HTTP.
- Para cambios web (Next.js) mantén las reglas de `AGENTS.md` (build + lint +
  vitest antes de commit).

---

## 13. Áreas de REGRESIÓN — no romper

| Frontera | Qué NO cambiar sin verificación |
|---|---|
| `window.LaVeinteApp` | Nombres/tipos de retorno usados por la web. Si modificas el bridge, actualizar AMBOS: inyección JS (`LaVeinteBridgeInjector`) y, si se reactiva, la clase legacy. |
| Gestos del visor | Motor 1:1 + `clampOffsets` + `listScrollEnabled` + `PDF_PAN_DEBUG`. Validar con el log en debug; no reintroducir la inercia (`FLING_ENABLED`) sin probar. |
| Tema | `LaVeinteTheme` SIEMPRE claro; usar `StatusBarAppearance` por pantalla. |
| OTA | `latest.json` EXACTO a la versión del APK publicado (codes crecientes, sha real, tamaño real). |
| Bóveda IMSS | NUNCA subir credenciales; mantener Keystore + DataStore + dedupe por SHA. |
| Captura PDF | Los scripts de monitoreo (`PDF_MONITOR_SCRIPT`) y el flujo Tu Perfil dependen del DOM del portal IMSS; no "mejorar" sin probar contra el portal real. |
| Auth/Proxy | No exponer rutas por error (¡`latest.json`/APK son públicos a propósito!). |
| Downgrade | versionCode nunca decrece; no instalar APK con firma distinta (el receiver ya lo detecta). |

## 14. Referencias para publicar

- `public/android/stable/latest.json` — manifest OTA.
- `public/LaVeinteDigital.apk` — binario publicado.
- `vercel.json` — rewrites del host.
- `android-app/gradle/libs.versions.toml` — catálogo de versiones.
- `android-app/app/build.gradle.kts` — versión + signing.