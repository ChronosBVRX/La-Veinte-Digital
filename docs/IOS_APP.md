# Aplicación iOS (La Veinte Digital)

> Documento de referencia técnica para el shell nativo iOS.
> Ámbito: `ios-app/` (shell nativo SwiftUI) que embebe el Home web
> (`https://la-veinte-digital.vercel.app`) en un `WKWebView` persistente.
> Última actualización: **2026-09-05 — v1.0.0 (build 1) — Stable Baseline**.

La fuente de verdad del comportamiento general es `docs/ANDROID_APP.md` y `docs/STABLE_BASELINE.md`. Este documento
mapea, feature a feature, cómo se implementa cada pieza en iOS y cataloga expresamente qué es paridad,
qué es diferencia intencional y qué es fallback.

---

## 0. Restricciones y decisiones (leer primero)

- **No se compila en Windows.** iOS requiere macOS + Xcode. Estrategia: el
  código Swift/SwiftUI vive en el repo (`ios-app/`) y se compila/firma en **CI (GitHub
  Actions, runner macOS)** (`.github/workflows/ios-build.yml` y `ios-release.yml`).
- **Proyecto generado con XcodeGen** (`ios-app/project.yml`) → produce
  `LaVeinteDigital.xcodeproj`.
- **Bundle ID**: `com.laveintedigital.app` (mismo que Android; versión `1.0.0`, build `1`).
- **Mínimo iOS**: **16.0** (definido canónicamente en `ios-app/project.yml` como `deploymentTarget: iOS: "16.0"`).
- **Lenguaje/UI**: Swift 5.9 + SwiftUI. Sin dependencias externas de terceros (solo Apple
  frameworks): WebKit, LocalAuthentication, Security, CryptoKit, PDFKit,
  SafariServices.
- **Sin OTA (DIFERENCIA INTENCIONAL):** iOS no permite instalar binarios ejecutables fuera del App Store. El sistema
  de actualización OTA (`updates/*`, `PackageInstaller`) **no se porta**. Las actualizaciones van por App Store / TestFlight.
  `window.LaVeinteApp.checkForUpdate()` en iOS se resuelve como no-op.
- **User-Agent Marker (FALLBACK):** La app iOS incluye en su WebView el marcador `LaVeinteDigitalIOS`,
  detectado por `src/shared/lib/app-environment.ts` como fallback al bridge.

---

## Categorización Formal de Compatibilidad (Android vs iOS)

| Característica | Estado | Detalle |
|---|---|---|
| Contrato `window.LaVeinteApp` | **PARIDAD** | Mismos nombres, firmas y tipos expuestos en `src/types/global.d.ts`. |
| Biometría | **PARIDAD** | Face ID / Touch ID vía `LocalAuthentication` (`BiometricManager.swift`). |
| Bóveda de credenciales IMSS | **PARIDAD** | Cifrado seguro AES-GCM con llaves en Keychain de iOS (`IMSS/Vault/*`). |
| Visor de documentos | **PARIDAD** | Renderizado con `PDFKit` y adaptación a `DocumentViewerModal`. |
| Actualizador OTA | **DIFERENCIA INTENCIONAL** | No existe en iOS por política de App Store. No implementar. |
| Gestión de proyecto | **DIFERENCIA INTENCIONAL** | XcodeGen (`project.yml`) en lugar de Gradle. |
| Persistencia local | **DIFERENCIA INTENCIONAL** | `PayslipStore.swift` (JSON en Documents/actor) en lugar de Room SQLite. |
| Detección UA | **FALLBACK** | Marcador `LaVeinteDigitalIOS` para casos de hidratación previa al bridge. |

## 1. Mapeo Android → iOS (feature a feature)

| Android (`android-app/`) | iOS (`ios-app/`) | Notas |
|---|---|---|
| `MainActivity.kt` (singleTask) | `LaVeinteDigitalApp.swift` (`@main`) + `AppState` | singleTask ≈ `.single` scene + manejo de URLs |
| `StartupCoordinator` / `BootloaderScreen` | `BootloaderView` + `StartupCoordinator` | misma lógica de estados |
| `internal/InternalWebScreen` | `WebView/InternalWebView.swift` (WKWebView persistente) | bridge por `WKUserScript` + `WKScriptMessageHandler` |
| `LaVeinteBridgeInjector` | `WebView/LaVeinteBridge.swift` | inyecta `window.LaVeinteApp` (mismos nombres) |
| `LaVeinteInternalWebViewClient` | `WKUIDelegate`/`WKNavigationDelegate` (`decidePolicyFor`) | ruteo de URLs |
| `LaVeinteChromeClient` (file chooser) | `WKUIDelegate.runJavaScriptConfirmPanel`/`WKDownload` | file input: `WKWebView` no expone picker; usar `UIDocumentPickerViewController` vía bridge |
| `external/ExternalBrowserScreen` | `WebView/ExternalBrowserView.swift` | chrome mínimo con barra superior |
| `routing/Domains.kt` | `Core/Domains.swift` | mismos allowlists (hosts) |
| `routing/NavigationRouter.kt` | `Core/NavigationRouter.swift` | mismo orden de resolución |
| `intents/IntentLauncher` + Custom Tabs | `SFSafariViewController` + `UIApplication.open(_:)` | Custom Tabs ≈ SFSafariViewController |
| `downloads/LaVeinteDownloadListener` | `URLSession` + `UIDocumentInteractionController` | descargas a Documents/Downloads |
| `security/AppLockManager` | `Security/AppLockManager.swift` | auto-rebloqueo 5 min, `pendingDeepLink` |
| `security/BiometricKeyStore` + `LaveinteBiometricManager` | `Security/BiometricManager.swift` (LocalAuthentication) | Face ID / Touch ID |
| `security/BiometricPreferences` | `UserDefaults` (enrollment) | |
| `imss/credentials/*` (Keystore+DataStore+Room) | `IMSS/Vault/*` (Keychain + CryptoKit AES-GCM) | llave por portal |
| `imss/payslips/PayslipDatabase` (Room) | `IMSS/Payslips/PayslipStore.swift` (JSON en Documents, actor) | sin CoreData para simplicidad |
| `imss/payslips/ImssPayslipDownloader` | `IMSS/Payslips/ImssPayslipDownloader.swift` (URLSession con cookies) | |
| `imss/portal/TuPerfilFlowController` | `IMSS/Portal/TuPerfilFlowController.swift` | reutiliza los mismos scripts JS (selectores, estados) |
| `imss/portal/TarjetonDigitalFlowController` | `IMSS/Portal/TarjetonDigitalFlowController.swift` | idem |
| `imss/portal/ImssPdfCaptureCoordinator` | `IMSS/Portal/ImssPdfCaptureCoordinator.swift` | monitor JS + descarga autenticada |
| `imss/ui/*` (pantallas) | `IMSS/UI/*` (SwiftUI) | misma UX clara LVD |
| `ui/theme/*` + `ui/lvd/*` | `Theme/*` (LvdColors + tokens Swift) | mismo palette/tokens |
| `updates/*` (OTA) | **NO se porta** | App Store |
| Deep links (`AndroidManifest`) | Universal Links + `laveinte://` URL scheme | `autoVerify` ≈ `apple-app-site-association` |
| `FLAG_SECURE` | `.privacySensitive()` (iOS 17+) + snapshot | parcial |

---

## 2. Contrato del bridge (CRÍTICO — no romper)

La web llama `window.LaVeinteApp.*`. iOS debe inyectar **exactamente los mismos
nombres** que define `src/types/global.d.ts`:

```
appPlatform() -> "ios"        // <-- Android devuelve "android"
appVersion(), sdkVersion(), packageName(), isNativeApp() -> true
hasBiometrics(), isBiometricsEnabled()
openExternal(url), openOfficialPayslips(), checkForUpdate()
hasImssCredentials(portalId), onAuthenticated(), onLoggedOut(), log(msg)
```

- Android inyecta JS vía `evaluateJavascript`. iOS inyecta con
  `WKUserScript` (atDocumentEnd, forMainFrameOnly) y recibe callbacks con
  `WKScriptMessageHandler` (nombre de handler `laveinte`) o interceptando
  `laveinte://bridge/...` en `decidePolicyFor`. **Recomendado en iOS:**
  `WKScriptMessageHandler` (más robusto que interceptar `location.href`).
- **UA**: Android usa sufijo `LaVeinteDigitalAndroid/<v>`. iOS debe usar
  `LaVeinteDigitalIOS/<v>`. Actualizar `src/shared/hooks/useIsNativeApp.ts`
  para detectar ambos (ver Fase 1).

### Cambios web necesarios

- `src/shared/hooks/useIsNativeApp.ts`: detectar `LaVeinteDigitalIOS`.
- Los `window.LaVeinteApp?.checkForUpdate?.()` / `openOfficialPayslips()` en
  `Sidebar.tsx`, `DesktopSidebar.tsx`, `HomeQuickActions.tsx` ya usan
  optional-chaining → no requieren cambio.
- Si se quiere, `hasImssCredentials` en iOS puede devolver valor real (a
  diferencia de Android que lo consume sin retorno). Mantener compatibilidad:
  la web no debe depender del retorno.

---

## 3. Fases

### Fase 1 — Esqueleto funcional (MVP)
SwiftUI + WKWebView cargando `https://la-veinte-digital.vercel.app`, bridge JS
(`appPlatform()="ios"`), tema LVD, ruteo (internal/external/SFSafari/openURL),
bootloader simple, detección offline. Cambio web de detección de UA.
**Salida**: app que abre la web igual que Android, navegación básica OK.

### Fase 2 — Seguridad
AppLock (auto-rebloqueo 5 min), biometría LocalAuthentication, ocultar en app
switcher, deep link pendiente.

### Fase 3 — Bóveda IMSS
Keychain + CryptoKit AES-GCM (llave por portal), guardar/leer/borrar
credenciales, gating por biometría.

### Fase 4 — Portales IMSS + captura PDF
Portar los flujos Tu Perfil y Tarjetón Digital (estados, scripts JS, parsing
con el fix de doble serialización, captura PDF autenticada + monitor de blobs).

### Fase 5 — Payslips
Historial (JSON store), visor PDFKit (zoom/pan), compartir, eliminar.

### Fase 6 — CI + distribución
GitHub Actions macOS (build + test + export IPA), Universal Links, App Store.

---

## 4. Áreas de REGRESIÓN (no romper)

| Frontera | Qué NO cambiar sin verificación |
|---|---|
| `window.LaVeinteApp` | Mismos nombres/tipos que `src/types/global.d.ts`. Si cambias el bridge, actualiza AMBOS lados (web + ambos shells). |
| Allowlists `Domains` | Mantener en sincronía los hosts con `android-app/.../Domains.kt`. |
| Scripts JS de portales | Los selectores de Tu Perfil / Tarjetón Digital dependen del DOM del portal IMSS; no "mejorar" sin probar contra el portal real. |
| Bóveda IMSS | NUNCA subir credenciales; Keychain + AES-GCM, dedupe por SHA. |
| Tema | Siempre claro (la marca es clara); no heredar dark mode del sistema. |

---

## 5. Firma y distribución (Fase 6)

**Requisito previo**: cuenta de Apple Developer (USD 99/año). Sin ella no hay
firma ni App Store, con o sin Mac.

### Secrets de GitHub Actions (no commitear)

El workflow `.github/workflows/ios-release.yml` (disparo manual `workflow_dispatch`)
firma y exporta el IPA. Configurar estos secrets en GitHub (Settings → Secrets):

| Secret | Valor |
|---|---|
| `APPLE_CERTIFICATE_BASE64` | Certificado de firma `.p12` en base64 (`base64 cert.p12`) |
| `APPLE_CERTIFICATE_PASSWORD` | Contraseña del `.p12` |
| `APPLE_PROVISIONING_PROFILE_BASE64` | `.mobileprovision` en base64 (bundle `com.laveintedigital.app`) |
| `APPLE_KEYCHAIN_PASSWORD` | Cualquier contraseña (keychain temporal del CI) |
| `APPLE_TEAM_ID` | Team ID de Apple Developer |

### Cómo obtenerlos

1. En developer.apple.com → Certificates → crear "Apple Distribution" (o "iOS
   Distribution") y exportar como `.p12` (con contraseña).
2. En Profiles → crear provisioning profile **App Store** (o **Ad Hoc** para
   instalar en dispositivos concretos) con el bundle id `com.laveintedigital.app`.
3. Member Center → Membership → copiar el **Team ID**.

### Publicar

1. `Actions` → `iOS Release` → `Run workflow` → elegir `app-store-connect`.
2. Descargar el artefacto `LaVeinteDigital.ipa`.
3. Subirlo con [Transporter](https://apps.apple.com/app/transporter/id1450874784)
   o `xcrun altool --upload-app`.

### Universal Links (opcional)

Para deep links `https://la-veinte-digital.vercel.app` en iOS hay que alojar
`/.well-known/apple-app-site-association` y declarar `com.apple.developer.associated-domains`
en entitlements. Pendiente de implementar cuando se quiera.

---

## 6. Referencias

- `docs/ANDROID_APP.md` — fuente de verdad del shell Android.
- `src/types/global.d.ts` — contrato `window.LaVeinteApp`.
- `src/shared/hooks/useIsNativeApp.ts` — detección de plataforma nativa.
- `android-app/.../routing/Domains.kt` — allowlists (mantener en sincronía).
- `android-app/.../internal/LaVeinteBridgeInjector.kt` — bridge Android (paridad).
