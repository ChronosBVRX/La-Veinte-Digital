# Requisitos del port a iOS (preparación)

La app Android de La Veinte Digital debe poder portarse a iOS manteniendo funcionalidad y
cumplimiento. Ya existe un **esqueleto** en `ios-app/` (XcodeGen, deployment target iOS 16.0,
proyecto `project.yml`, bundle id `com.laveintedigital.app`). Aquí se documenta el mapeo de cada
subsistema y los requisitos de App Store.

## Mapeo Android → iOS

| Android | iOS (recomendado) | Sub-sistema | Estado |
|---------|-------------------|-------------|--------|
| Compose | SwiftUI | UI | Esqueleto existente |
| WebView (android.webkit) | WKWebView | Páginas web + portales IMSS | `WebView/InternalWebView.swift` |
| AndroidKeyStore (AES-GCM) | Keychain (kSecClassGenericPassword) | Vault de credenciales IMSS | `IMSS/Vault/ImssCredentialKeyStore.swift` |
| BiometricPrompt | LocalAuthentication (LAContext) | Bloqueo de app + desbloqueo de credenciales | `Security/BiometricUnlockView.swift` |
| Custom Tabs (CustomTabsIntent) | ASWebAuthenticationSession (OAuth) / SFSafariViewController | Login OAuth y enlaces | `WebView/SafariView.swift` |
| FCM (firebase-messaging) | APNs (+ Firebase Messaging wrapper) | Notificaciones | Pendiente en el esqueleto |
| App Links (autoVerify).well-known/assetlinks.json | Universal Links (.well-known/apple-app-site-association + AASA) | Deep links | `project.yml` define scheme `laveinte`; falta AASA |
| FileProvider (androidx.core) | UIDocumentInteractionController / ShareSheet / Files | Compartir/abrir PDFs | `Views/ShareSheet.swift` |
| Android Print framework | UIPrintInteractionController | Impresión | Pendiente |
| Cámara / QR (WebView getUserMedia + html5-qrcode) | AVFoundation / VisionKit | Escaneo QR, captura | Pendiente en el esqueleto |
| Room (SQLite ORM) | SwiftData / CoreData / SQLite | Metadatos de tarjetones | `IMSS/Payslips/PayslipStore.swift` (suite propia) |

## Requisitos de App Store

### Toolchain y SDK

- **Xcode 15+/16** y iOS SDK vigente (iOS 17/18). El esqueleto se configura con `Swift 5.9`, targets iOS 16.
- Generar el proyecto con XcodeGen: `cd ios-app && xcodegen generate` (si está instalado) o abrir con Xcode.

### Privacy Manifest (`PrivacyInfo.xcprivacy`)

- Requerido por Apple para apps que recopilan datos o usan APIs de "required reason".
- La app usa: cámara (NSMicrophoneUsageDescription/ NSCameraUsageDescription), Keychain, red, y
  posiblemente `UserDefaults` + archivos → declarar las categorías de datos correspondientes
  (NSPrivacyAccessedAPICategoryHasReturnedReason).
- Añadir: `NSPrivacyAccessedAPICategoryUserDefaults`, `...DiskSpace`, `...FileTimestamp`.

### App Privacy (App Store Connect)

Rellenar las mismas categorías que en `GOOGLE_PLAY_DATA_SAFETY.md`: email, perfil, datos laborales,
IDs de dispositivo. Compartido: solo con Firebase (push). No publicidad ni analítica.

### Account deletion

Apple requiere permitir eliminar la cuenta desde la app si se crea una. La app web ya tiene
`/eliminar-cuenta`; en iOS debe exponerse en Perfil.
(ver `FINAL_REPORT.md`) — SÍ existe en web; falta botón nativo iOS.

### Demo account / acceso de revisores

Apple pide una cuenta demo si la app necesita login. Documentar en `REVIEWER_INSTRUCTIONS_TEMPLATE.md`.

### Justificación de servicios de terceros

Declarar el uso de Firebase (push) y Supabase (auth/datos) en la sección de privacidad de la app y en
el App Store.

### Sign in with Apple

Supabase Auth soporta OAuth; si se habilita login social/de terceros, App Store puede exigir
**Sign in with Apple** cuando se ofrezca otro login de terceros. Si la app solo usa email/password,
no es obligatorio. `[PENDIENTE DE CONFIRMACIÓN — si se habilitarán logins sociales]`.

### Privacy usage strings

- `NSCameraUsageDescription` — escaneo QR / captura.
- `NSFaceIDUsageDescription` — ya presente en `project.yml`.
- `NSMicrophoneUsageDescription` — solo si se usa micrófono (no previsto).
- `NSPhotoLibraryUsageDescription` — si se accede a la galería (no previsto).

### ATS (App Transport Security)

Todas las conexiones son HTTPS. No desactivar ATS.

### Universal Links / AASA

- Crear `https://la-veinte-digital.vercel.app/.well-known/apple-app-site-association` con
  `applinks:la-veinte-digital.vercel.app` y el `appID` del team.
- Tener el dominio en el App ID Capabilities → Associated Domains.

### Mínimo contenido nativo suficiente (4.2 Minimum Functionality)

La app usa un WebView para gran parte del contenido. Apple suele rechazar apps que son "solo un
WebView" si no aportan funcionalidad nativa. Déjalo claro con:

- Navegación nativa (tab bar / SwiftUI) hacia el contenido.
- WebView con chrome propio y no redirijir todo a Safari.
- Funciones nativas: biometría, PDF, compartir, impresión, escaneo QR, almacenamiento local seguro.

## Acciones pendientes antes del port completo

1. Añadir `PrivacyInfo.xcprivacy` y completar App Privacy.
2. Implementar push (FCM → APNs) y su token cleanup.
3. Universal Links + AASA.
4. Botón nativo de eliminación de cuenta.
5. Pantalla de aviso de independencia (no oficial) en el onboarding/portales.
