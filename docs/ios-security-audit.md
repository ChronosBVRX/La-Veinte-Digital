# 🍎 Auditoría de Seguridad iOS y App Store Readiness — La Veinte Digital

> **Fecha de auditoría:** 2026-09-10  
> **Ámbito:** `ios-app/` (`project.yml`, `PrivacyInfo.xcprivacy`, `InternalWebView.swift`, `NavigationRouter.swift`, `Domains.swift`)  
> **Estado:** PRODUCCIÓN AUDITADA Y CUMPLIDA (App Store Compliant)

---

## 1. Configuración de Seguridad de WKWebView

La interacción con el motor web en iOS se implementa mediante SwiftUI y WebKit en `InternalWebView.swift`:

| Componente | Configuración Activa | Estado | Justificación de Seguridad |
| :--- | :---: | :---: | :--- |
| **Data Store** | `WKWebsiteDataStore.default()` | ✅ AISLADO | Gestión de cookies, almacenamiento local y caché en el sandbox privado de la app. |
| **Media Playback** | `allowsInlineMediaPlayback = true` | ✅ CONTROLADO | Reproducción de audio y video normativo directamente en el flujo de la app. |
| **Gestos de Navegación** | `allowsBackForwardNavigationGestures = true` | ✅ NATIVO | Navegación gestual nativa de iOS fluida. |
| **User-Agent Customizado** | `... LaVeinteDigitalIOS/<version>` | ✅ IDENTIDAD | Firma explícita que permite al frontend web activar integraciones y estilos para iOS. |
| **Bridge Seguro** | `WKScriptMessageHandler` | 🛡️ HARDENED | Comunicación bidireccional mediante mensajes JSON estructurados (`LaVeinteBridge`). No se inyectan variables globales vulnerables en el DOM. |

---

## 2. Ruteo de Enlaces y Allowlists de Navegación (`NavigationRouter.swift`)

La navegación externa e interna replica exactamente los principios de seguridad de la versión Android para evitar escapes arbitrarios del sandbox:

1. **Esquemas Bloqueados (`Domains.blockedSchemes`)**:
   - `javascript:`, `file:`, `content:`, `about:` son **bloqueados y cancelados inmediatamente**.
2. **Esquemas de Integración / Intent (`Domains.intentSchemes`)**:
   - `tel:`, `mailto:`, `sms:`, `whatsapp:`, `maps:` se delegan al sistema operativo mediante `UIApplication.shared.open()`.
3. **Flujos OAuth y Pagos en `SFSafariViewController` (`Domains.customTabHosts`)**:
   - `accounts.google.com`, `appleid.apple.com`, `facebook.com`, `x.com`, pasarelas de pago (`stripe.com`, `mercadopago.com.mx`).
   - Se ejecutan en un contexto aislado de Safari con cookies y credenciales del usuario protegidas contra la aplicación anfitriona.
4. **Sitios Gubernamentales en Navegador Integrado (`Domains.externalWebviewHosts`)**:
   - `imss.gob.mx`, `sat.gob.mx`, `sntss.org.mx`, `gob.mx`, `stps.gob.mx`.
   - Se cargan dentro de una vista externa dedicada para mantener al usuario dentro de la experiencia asistida.
5. **Navegación Interna Segura (`Domains.internalHosts`)**:
   - `la-veinte-digital.vercel.app` se mantiene en el WebView principal.

---

## 3. App Transport Security (ATS) y Metadatos de `Info.plist`

Configurados de manera determinista en `ios-app/project.yml` para generación con XcodeGen:

1. **App Transport Security**:
   - `NSAppTransportSecurity` configurado explícitamente con `NSAllowsArbitraryLoads: false`.
   - Todas las conexiones de red requieren HTTPS obligatorio con TLS 1.2/1.3.
2. **Descripciones de Permisos en Español Claro y Orientado al Usuario**:
   - `NSFaceIDUsageDescription`: *"Usamos Face ID / Touch ID para proteger tu información y acceder a tus tarjetones de forma segura."*
   - `NSCameraUsageDescription`: *"Usamos la cámara para escanear credenciales y códigos QR institucionales."*
3. **Parámetros de Publicación en App Store**:
   - **Deployment Target**: `iOS 16.0` (garantiza compatibilidad moderna con Swift 5.9 y WebKit moderno).
   - **Bundle Identifier**: `com.laveintedigital.app`.
   - **Exención de Cifrado (`ITSAppUsesNonExemptEncryption: false`)**: Cumplimiento del cuestionario de exportación de EE.UU. de App Store Connect para cifrado estándar HTTPS.
   - **Esquema de URL Personalizado**: `laveinte://` registrado exclusivamente para retornos OAuth y deep-linking.

---

## 4. Manifiesto de Privacidad de Apple (`PrivacyInfo.xcprivacy`)

Cumple estrictamente con el mandato obligatorio de Apple vigente desde el 1 de mayo de 2024:

- **Rastreo de Usuarios (`NSPrivacyTracking`)**: `false` (la aplicación no rastrea a los usuarios a través de apps ni sitios web de terceros).
- **Dominios de Rastreo (`NSPrivacyTrackingDomains`)**: Lista vacía `[]`.
- **Datos Recopilados (`NSPrivacyCollectedDataTypes`)**: No se recopilan datos para venta o perfilado comercial.
- **APIs con Motivos Requeridos (`NSPrivacyAccessedAPITypes`)**:
  - `NSPrivacyAccessedAPICategoryUserDefaults` declarado con motivo `CA92.1` (*Access user defaults to read and write information that is only accessible to the app itself*), utilizado para guardar la preferencia local del interruptor biométrico.
