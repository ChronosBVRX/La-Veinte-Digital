# Inventario de Dependencias (SBOM)

Inventario de las dependencias que impactan el binario Android (AAB/APK) y las principales del
entorno de servidor/frontend. El foco para Google Play es el primer bloque.

> Nota de licencias: la revisión legal final de cada licencia (especialmente AGPL) es
> [`PENDIENTE DE CONFIRMACIÓN DEL PROPIETARIO`]. No se recomienda subir a producción sin revisarla.

## Android (APK/AAB)

### Plugins de build

| Componente | Versión | Propósito | Licencia |
|------------|---------|-----------|----------|
| Android Gradle Plugin (AGP) | 8.10.0 | Build/empaquetado | Apache-2.0 |
| Kotlin (android + compose plugin) | 2.0.21 | Lenguaje | Apache-2.0 |
| KSP | 2.0.21-1.0.27 | Compilador de Room | Apache-2.0 |
| Google Services | 4.4.2 | Firebase/Google config | Apache-2.0 |

### Librerías de runtime (Android)

| Librería | Versión | Propósito | Datos que podría procesar | Licencia | Mantenimiento |
|----------|---------|-----------|---------------------------|----------|---------------|
| `androidx.core:core-ktx` | 1.13.1 | Extensiones Android | — | Apache-2.0 | Activo (AndroidX) |
| `androidx.appcompat` | 1.7.0 | Activity base | — | Apache-2.0 | Activo |
| `androidx.activity:activity-compose` | 1.9.2 | Compose ↔ Activity | — | Apache-2.0 | Activo |
| `androidx.lifecycle` | 2.8.5 | Ciclo de vida/ViewModel | — | Apache-2.0 | Activo |
| `androidx.navigation:navigation-compose` | 2.8.2 | Navegación | — | Apache-2.0 | Activo |
| `androidx.core:core-splashscreen` | 1.0.1 | Splash | — | Apache-2.0 | Activo |
| `androidx.webkit` | 1.11.0 | WebView compat | Navegación de la WebView (URLs de La Veinte + portales) | Apache-2.0 | Activo |
| `androidx.browser` | 1.8.0 | Custom Tabs | Abre URL externas en el navegador del sistema | Apache-2.0 | Activo |
| `androidx.datastore:datastore-preferences` | 1.1.1 | Preferencias | Prefs locales (biometría, permisos, cache de actualización) | Apache-2.0 | Activo |
| `androidx.biometric` | 1.1.0 | Biometría | Invoca autenticación biométrica (no guarda material) | Apache-2.0 | Activo |
| `androidx.room` | 2.6.1 | ORM SQLite | Metadatos de tarjetones/documentos en local | Apache-2.0 | Activo |
| `org.jetbrains.kotlinx:kotlinx-coroutines-android` | 1.9.0 | Async | — | Apache-2.0 | Activo |
| Compose BOM | 2024.09.03 | UI | — | Apache-2.0 | Activo |
| `com.google.android.material:material` | 1.12.0 | Material | — | Apache-2.0 | Activo |
| Firebase BOM | 33.5.1 | — | — | Apache-2.0 | Activo |
| `firebase-messaging` | (BOM) | Push (FCM) | Token de dispositivo para notificaciones | Apache-2.0 / Firebase Términos | Activo |

### Librerías nativas `.so` empaquetadas

| `.so` | Origen | Nota |
|-------|--------|------|
| `libandroidx.graphics.path.so` | androidx.graphics.path | Ver `ANDROID_16KB.md` (alineación 16 KB) |
| `libdatastore_shared_counter.so` | androidx.datastore | Ver `ANDROID_16KB.md` |

## Web / servidor (entorno de build)

Dependencias usadas por la web que se sirve a la app y por tooling:

| Librería | Versión | Uso | Licencia |
|----------|---------|-----|----------|
| `next` | 16.2.12 | Framework web | MIT |
| `@supabase/ssr`, `@supabase/supabase-js` | 0.12.3 / 2.111.0 | Auth + client | Apache-2.0 |
| `firebase-admin` | 13.10.0 | Envío de notificaciones | Apache-2.0 |
| `openai` | 7.0.0 | Chat/RAG | MIT |
| `pdfjs-dist` | 6.1.200 | Extracción de tarjetón (local) | Apache-2.0 |
| `jspdf` | 4.2.1 | Generación PDF (escritos) | MIT |
| `qrcode.react` | 4.2.0 | QR | MIT |
| `html5-qrcode` | 2.3.8 | Escaneo QR | MIT |
| `mupdf` | 1.28.0 | Render/OCR normativa (**AGPL**) | **AGPL-3.0** ⚠️ |
| `edge-tts` | 1.0.1 | TTS maqueta | LGPL/MIT (revisar) |
| `framer-motion`, `lucide-react`, `@phosphor-icons/react` | — | UI | MIT/ISC |

### Avisos

- **mupdf (AGPL-3.0):** se usa en el pipeline de normativa/radio (local/tooling), no en el
  runtime de la app web pública que reciben los usuarios de la app Android. Confirmar que no se
  distribuye en el binario web servido; si se distribuye, AGPL obliga a publicar el código fuente.
- **firebase-admin / service role:** solo en el servidor, nunca en el cliente.
