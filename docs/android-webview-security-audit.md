# 🤖 Auditoría de Seguridad Android y WebView — La Veinte Digital

> **Fecha de auditoría:** 2026-09-10  
> **Ámbito:** `android-app/` (`build.gradle.kts`, `AndroidManifest.xml`, `WebSettingsExt.kt`, `network_security_config.xml`)  
> **Estado:** PRODUCCIÓN AUDITADA Y CUMPLIDA (Google Play & Direct Channels)

---

## 1. Configuración de Seguridad de WebView

La configuración de WebViews se centraliza de manera estricta en `com.laveintedigital.app.util.WebSettingsExt.kt`:

| Directiva WebView | Configuración Activa | Estado | Justificación de Seguridad |
| :--- | :---: | :---: | :--- |
| **JavaScript** | `javaScriptEnabled = true` | ✅ REQUERIDO | Requerido para la SPA de Next.js. |
| **DOM Storage** | `domStorageEnabled = true` | ✅ REQUERIDO | Soporte de almacenamiento local (`localStorage` / `sessionStorage`) para tokens de sesión e hidratación offline. |
| **Acceso a Archivos Locales** | `allowFileAccess = false` | 🛡️ HARDENED | Bloquea la navegación arbitraria a esquemas `file://`. La carga de documentos se realiza exclusivamente vía SAF (*Storage Access Framework*). |
| **Acceso entre Archivos URL** | `allowFileAccessFromFileURLs = false` | 🛡️ HARDENED | Deshabilita ataques de lectura cruzada de archivos locales. |
| **Acceso Universal entre URLs** | `allowUniversalAccessFromFileURLs = false` | 🛡️ HARDENED | Impide que scripts en contexto de archivo accedan a cualquier origen. |
| **Safe Browsing** | `safeBrowsingEnabled = true` | 🛡️ HARDENED | Activa la protección de Google Safe Browsing contra phishing y malware. |
| **Contenido Mixto** | `MIXED_CONTENT_NEVER_ALLOW` | 🛡️ HARDENED | Bloquea de forma tajante la carga de recursos HTTP no cifrados en páginas HTTPS. |
| **Ventanas Múltiples** | `setSupportMultipleWindows(false)` | 🛡️ CONTROLADO | Previene la apertura no controlada de pop-ups y navegación no contenida. |
| **User-Agent Customizado** | `... LaVeinteDigitalAndroid/<ver>` | ✅ IDENTIDAD | Permite a la aplicación web detectar la capa nativa para optimizaciones específicas de interfaz. |

---

## 2. Cumplimiento de Políticas de Distribución y Google Play

### A. Versiones de SDK y Requisitos de Play Store (2025/2026)
- **`compileSdk`**: `36` (Android 16 Developer / Android 15 Preview)
- **`targetSdk`**: `36` (Supera con creces el requisito mínimo de Google Play `targetSdk >= 35`)
- **`minSdk`**: `29` (Android 10 Q; garantiza que APIs heredadas inseguras queden excluidas)
- **`versionCode`**: `206`
- **`versionName`**: `"1.1.6"`

### B. Validación Automatizada de la Política de Distribución (`validateDistributionPolicy`)
El script de compilación `android-app/app/build.gradle.kts` define dos sabores (*flavors*) independientes y un guardrail fail-closed en Gradle:

1. **Flavor `play` (Canal Oficial Google Play)**:
   - `SELF_UPDATE_ENABLED = false`
   - **Regla estricta**: No declara `REQUEST_INSTALL_PACKAGES` ni registra `UpdateInstallReceiver`.
   - La tarea `validateDistributionPolicyPlayRelease` inspecciona el archivo resultante `AndroidManifest.xml` fusionado; si encuentra cualquiera de estos elementos, la compilación falla con `GradleException`.
2. **Flavor `direct` (Canal de Descarga Directa Sindical / Sideload)**:
   - `SELF_UPDATE_ENABLED = true`
   - Declara `REQUEST_INSTALL_PACKAGES` y registra `UpdateInstallReceiver` para auto-actualizaciones in-app firmadas.

### C. Alineación de Páginas de Memoria a 16 KB (Android 15+)
- La aplicación está desarrollada 100% en **Kotlin, AndroidX, Jetpack Compose y Room**.
- **Cero código nativo C/C++ (NDK)** propio.
- Las librerías de soporte (Room, SQLite nativo de AndroidX) se gestionan mediante el Android Gradle Plugin (`agp = 8.10.0`), el cual incluye soporte y empaquetado compatible con la alineación de páginas de memoria de 16 KB requerida en dispositivos con procesadores Android 15+.

### D. Ofuscación y Reducción de Código (R8 / ProGuard)
- En compilaciones `release`:
  - `isMinifyEnabled = true` (ofuscación de símbolos y eliminación de clases no utilizadas).
  - `isShrinkResources = true` (purgado de recursos estáticos redundantes).
  - Reglas en `proguard-rules.pro` optimizadas para Coroutines, Room y Firebase.

---

## 3. Auditoría del `AndroidManifest.xml` y Permisos

1. **Permisos Mínimos Necesarios**:
   - `INTERNET`: Comunicación con Supabase y backend Vercel.
   - `ACCESS_NETWORK_STATE`: Detección de conectividad para pantallas offline.
   - `POST_NOTIFICATIONS`: Notificaciones push de convocatorias sindicales (Android 13+).
   - `CAMERA` (`android:required="false"`): Escaneo opcional de credenciales y códigos QR.
   - *Permisos de almacenamiento (`READ/WRITE_EXTERNAL_STORAGE`)*: **Deliberadamente eliminados**. La selección de PDFs y documentos utiliza el Storage Access Framework (SAF) con URIs efímeras de acceso de solo lectura.
2. **Superficie de Exposición de Componentes (`android:exported`)**:
   - `FileProvider`: `android:exported="false"`, `android:grantUriPermissions="true"`.
   - `LaVeinteFirebaseMessagingService`: `android:exported="false"`.
   - `MainActivity`: `android:exported="true"` (único componente exportado, requerido por ser el punto de entrada `MAIN` / `LAUNCHER`).
3. **Copia de Seguridad (`android:allowBackup="false"`)**:
   - Deshabilitado deliberadamente. Protege contra la extracción de tokens FCM, credenciales de nómina y cookies de sesión mediante copias de seguridad de nube de Google Drive o transferencias ad-hoc vía ADB.
4. **Seguridad de Red (`network_security_config.xml`)**:
   - `android:usesCleartextTraffic="false"`
   - `cleartextTrafficPermitted="false"` a nivel base y por dominio.
   - Tráfico cifrado TLS obligatorio hacia `la-veinte-digital.vercel.app` y `ragktminwduiggvaoeix.supabase.co`.
