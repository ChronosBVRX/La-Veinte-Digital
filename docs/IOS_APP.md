# Aplicación iOS (La Veinte Digital)

> Documento de plan / referencia técnica para la portabilidad del shell Android
> a iOS nativo. Estado: **Fases 1–5 implementadas** (esqueleto, seguridad,
> bóveda, portales IMSS, payslips). **Pendiente: compilar en CI macOS y
> validar contra los portales reales.**
> Ámbito: `ios-app/` (shell nativo SwiftUI) que embebe el Home web
> (`https://la-veinte-digital.vercel.app`) en un `WKWebView` persistente.
> Última actualización: **2026-08-13**.

La fuente de verdad del producto es `docs/ANDROID_APP.md`. Este documento
mapea, feature a feature, cómo se reimplementa cada pieza en iOS.

---

## 0. Restricciones y decisiones (leer primero)

- **No se compila en Windows.** iOS requiere macOS + Xcode. Estrategia: el
  código Swift/SwiftUI vive en el repo y se compila/firma en **CI (GitHub
  Actions, runner macOS)**. Otra opción: Mac local con Xcode + XcodeGen.
- **Proyecto generado con XcodeGen** (`ios-app/project.yml`) → produce
  `LaVeinteDigital.xcodeproj`. Evita commitear `.xcodeproj` (binario/difícil de
  revisar). En un Mac: `brew install xcodegen && cd ios-app && xcodegen`.
- **Bundle ID**: `com.laveintedigital.app` (mismo que Android; los bundle IDs son
  por-tienda).
- **Mínimo iOS**: **15.0** (paridad aproximada con `minSdk 29` = Android 10).
- **Lenguaje/UI**: Swift 5.9 + SwiftUI. Sin dependencias externas (solo Apple
  frameworks): WebKit, LocalAuthentication, Security, CryptoKit, PDFKit,
  SafariServices.
- **Sin OTA.** iOS no permite instalar binarios fuera del App Store. El sistema
  completo de actualización OTA (`updates/*`, `latest.json`, `PackageInstaller`)
  **no se porta**. Las actualizaciones van por App Store / TestFlight.
  `window.LaVeinteApp.checkForUpdate()` en iOS se resuelve como no-op (o abre
  la página de la app en el App Store).
- **Detalle de estado / pantalla**: Android protege capturas con `FLAG_SECURE`;
  iOS no tiene un equivalente público robusto, pero puede ocultar el contenido
  en el App Switcher (`.privacySensitive()` en iOS 17+ / snapshot blur).

---

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

## 5. Referencias

- `docs/ANDROID_APP.md` — fuente de verdad del shell Android.
- `src/types/global.d.ts` — contrato `window.LaVeinteApp`.
- `src/shared/hooks/useIsNativeApp.ts` — detección de plataforma nativa.
- `android-app/.../routing/Domains.kt` — allowlists (mantener en sincronía).
- `android-app/.../internal/LaVeinteBridgeInjector.kt` — bridge Android (paridad).
