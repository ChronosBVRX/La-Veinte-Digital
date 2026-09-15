# Digitalizador de documentos y servicio Sacar copias

Módulo tipo CamScanner que alimenta el servicio independiente **Sacar copias** (`/copias`):
escanear desde el teléfono o tomar foto, detectar bordes, corregir perspectiva, recortar,
mejorar la imagen, capturar varias páginas, generar un PDF localmente y enviarlo a imprimir
por el flujo QR existente hacia la PC.

De forma opcional, el trabajador puede marcar la casilla "Guardar también en Mis documentos".
Por lo tanto, **Mis documentos** (`/documentos-personales`) funge como el repositorio personal
y visor de documentos guardados, no como el lanzador principal del escáner.

Todo el procesamiento es **local**. No hay APIs SaaS, no se suben imágenes ni PDFs a
servidores y no se usa IA generativa ni OCR para modificar la imagen.

---

## Arquitectura

```text
Inicio (Hero Card "Sacar copias" / Navegación)
        │
        ▼
Sacar copias (/copias) — CopyServicePage
        │  [Escanear documento] / [Escanear INE]
        ▼
DocumentScannerFlow (modal, aislado, intent="print")
        │
        ├─ NativeMlKitDocumentScanner   (Android con Play services)
        │      window.LaVeinteApp.scanDocument({ mode, allowGallery, pageLimit })
        │      → páginas JPEG base64 → normalizadas a JPEG en el cliente
        │
        └─ WebDocumentScanner           (navegador / APK antigua / sin Play services)
               captura getUserMedia → análisis → detección de cuadrilátero
               → ajuste manual de esquinas (con reintento controlado de OpenCV)
               → warpPerspective → filtro
        │
        ▼
Revisión: reordenar / rotar / eliminar / filtro / volver a tomar
        │
        ├─ Documento normal → pdf-lib (A4, multipágina, imágenes centradas)
        └─ INE             → pdf-lib (Carta, UNA página: frente arriba, reverso abajo)
        │
        ▼
Confirmación (intent="print")
        │
        ├─ Casilla opcional: "Guardar también en Mis documentos" (desactivada por defecto)
        │      ├─ Intento de persistencia (Android Room o IndexedDB)
        │      ├─ Si falla (ej. QuotaExceededError):
        │      │     • NO bloquea la impresión (P0: imprimir es independiente de guardar)
        │      │     • Clasifica la falla: quota_exceeded, storage_unavailable, write_failed, unknown
        │      │     • Emite onSaveFailed y notifica a la pantalla final
        │      │     • Muestra aviso amigable al usuario (no muestra confirmación falsa de guardado)
        │      └─ Si tiene éxito:
        │            • Muestra badge verde confirmando el guardado
        │
        └─ Envío a impresión (siempre prioritario):
               File en memoria → SendPrintModal existente → uploadTransferFile (QR de la PC)
```

Regla de oro del flujo de impresión: **no existe un segundo sistema QR**. El escáner
solo produce un `File` y lo entrega al `SendPrintModal` / `uploadTransferFile`
existentes.


---

## Fuentes de verdad

| Archivo | Rol |
|---|---|
| `src/shared/contracts/document-scan.ts` | Modos, filtros, fuentes (`DOCUMENT_SCAN`, `INE_SCAN`), validadores, títulos y nombres seguros |
| `src/shared/services/scan-document-storage.ts` | IndexedDB aislada por usuario (clave `<userId>:<id>` + validación de dueño en lectura) |
| `src/features/document-scanner/lib/` | Geometría, detección, warp, filtros, raster, PDF (documento e INE), render de páginas |
| `src/features/document-scanner/services/` | Proveedor web, puente nativo de guardado, persistencia |
| `src/features/document-scanner/components/` | Flujo, captura, editor de esquinas, revisión |
| `src/features/documentos-personales/lib/documents.ts` | Clasificación por `source` explícito + agrupación visual |
| `android-app/.../scanner/` | Motor Android (ML Kit) y payload del bridge |
| `android-app/.../internal/LaVeinteBridgeInjector.kt` | `window.LaVeinteApp.scanDocument` |

---

## Pipeline web

```text
getUserMedia (o foto de galería)
  → downscale de análisis (≈900 px)
  → gris → desenfoque → Sobel → Otsu → dilatar
  → componentes conectados → casco convexo
  → approxPolyDP / rectángulo mínimo → puntuación
  → [OpenCV.js opcional si public/vendor/opencv/opencv.js existe]
  → editor manual de 4 esquinas (obligatorio)
  → homografía + warpPerspective con muestreo bilineal
  → filtro (Original / Color mejorado / Grises / Blanco y negro)
  → JPEG re-codificado (máx. 2400 px, calidad 0.82) → páginas del PDF
```

- `raster.ts`, `geometry.ts`, `warp.ts`, `image-filters.ts`, `quad-detection.ts` son
  funciones puras y se prueban sin DOM.
- El editor de esquinas siempre está disponible: si la detección automática falla o
  el usuario quiere ajustar, arrastra los cuatro puntos.
- OpenCV.js se carga **solo** desde rutas locales (`/vendor/opencv/opencv.js`,
  `/vendor/opencv.js`). `scripts/copy-vendor.mjs` intenta descargarlo opcionalmente;
  si no existe, el detector propio (TypeScript) se usa siempre.

## Filtros

| Filtro | Implementación |
|---|---|
| Original | Copia sin cambios |
| Color mejorado | Autocontraste por percentiles + saturación moderada |
| Grises | Luminancia + autocontraste |
| Blanco y negro | Umbral adaptativo local (imagen integral) |

Ningún filtro modifica el contenido textual ni inventa datos.

---

## INE (frente + reverso)

- Flujo propio: frente → confirmar → reverso → confirmar → vista previa → PDF.
- PDF final: **exactamente una página Carta vertical** (612×792 pt), fondo blanco,
  frente arriba, reverso abajo, misma anchura visual, proporciones originales
  (nunca estirados), separación de 18 pt y márgenes de 36 pt.
- El layout es una función pura (`computeIneLayout`) con pruebas de proporción,
  márgenes y ancho común.

### Privacidad del INE

- Sin OCR y sin extraer nombre, CURP, domicilio, clave de elector, OCR, CIC ni QR.
- El PDF no contiene texto generado; solo las dos imágenes.
- Las imágenes se re-codifican en canvas (se descartan metadatos EXIF del original).
- Los temporales viven en memoria; al cerrar el flujo se revocan los object URLs.
- Almacenamiento aislado por usuario (IndexedDB con dueño validado / Room con `ownerId`).
- Pruebas: escenario A→B→A en `scan-document-storage-isolation.test.ts` y en la
  integración de Documentos personales.

---

## Persistencia (sin tablas nuevas)

No se añadieron tablas ni migraciones Supabase. Se extiende el almacenamiento existente:

| Entorno | Almacén | Clasificación |
|---|---|---|
| Android con scanner (APK nueva) | Room `payslip_documents` + `filesDir/documentos` / `filesDir/identificaciones` | `source = DOCUMENT_SCAN` / `INE_SCAN` |
| Web / fallback | IndexedDB `la_veinte_scan_docs_db` → store `scan_documents` | `kind = documento` / `ine` |

- La clasificación es **explícita** (`source` de Room o `kind` del registro); nunca
  se deduce del nombre del archivo.
- APKs antiguas ignoran el campo `source` en `saveStart` y guardarían como `ESCRITO`;
  por eso el guardado nativo solo se usa cuando la MISMA APK expone `scanDocument`.
  Si el guardado nativo falla, el PDF se conserva en IndexedDB (no se pierde).

## Impresión por QR (reutilizada)

```text
Documento escaneado → getFile() → SendPrintModal existente → cámara → QR de la PC
→ extractTransferToken (hosts oficiales) → uploadTransferFile → PDF en la PC
```

- Modo copiadora: `Escanear para imprimir` → por defecto **no guarda**; el PDF vive
  solo en memoria y se entrega al modal existente. La casilla
  “Guardar también en mis documentos” es opcional y desactivada por defecto.
- El QR sigue conteniendo únicamente el token efímero del sistema actual.

### Hardening de persistencia y clasificación de errores

Cuando el usuario activa la opción de guardar en Mis documentos durante el flujo de copias:
1. **Independencia absoluta de la impresión (P0):** Si el guardado falla (por ejemplo por cuota de almacenamiento llena), la impresión **no se aborta**. El documento en memoria se envía a imprimir normalmente.
2. **Clasificación de errores (`ScanStorageFailure`):**
   - `quota_exceeded`: detecta `QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED` (Firefox) o código numérico 22.
   - `storage_unavailable`: IndexedDB inaccesible, `SecurityError`, o `InvalidStateError`.
   - `write_failed`: aborto de transacción, error de restricción o fallo de escritura.
   - `unknown`: cualquier otra falla no anticipada.
3. **Transacciones atómicas y verificación estricta:** `saveScanDocument` espera la confirmación en `tx.oncomplete` antes de considerar la escritura como exitosa, rechazando blobs vacíos (0 bytes) y escuchando abortos de transacción.
4. **Claridad hacia el usuario:** Si el guardado falla, la UI **nunca** muestra el mensaje de confirmación "También guardamos una copia en Mis documentos". En su lugar, la pantalla de finalización ("¡Listo!") muestra una alerta ámbar explicativa (ej. *"El documento se envió a imprimir, pero no pudo guardarse porque no hay suficiente espacio disponible en este dispositivo."*).

### Resiliencia del cargador de OpenCV.js

- El cargador `opencv-loader.ts` deduplica solicitudes concurrentes mediante una promesa compartida.
- Si la carga inicial falla (por red o script bloqueado), no bloquea la aplicación: el detector propio en TypeScript asume la detección.
- Se permite **un único reintento controlado** manual (`retryOpenCv()`, verificado vía `canRetryOpenCv()`).
- Al reintentar, se remueve el tag `<script>` fallido del DOM para no saturar el encabezado y se restablece el estado de manera determinista. No se permiten bucles de reintento infinito.


## Tamaño y compresión

- Cada página se re-codifica a JPEG ≤ 2400 px de lado y calidad 0.82
  (equivalente práctico a 200–240 DPI en Carta/A4).
- Los límites del backend de transferencia (10 MB por archivo, 10 archivos,
  25 MB por sesión) **no se modificaron**.
- Si un PDF excede el límite, el mensaje de error es humano y proviene del backend
  existente; el escáner no eleva límites de forma silenciosa.

---

## Bridge Android

Contrato (`window.LaVeinteApp.scanDocument`, solo APKs nuevas):

```js
scanDocument({ mode, allowGallery, pageLimit })
  → { ok: true,  engine: "mlkit", pages: [{ base64, mimeType, width, height }] }
  → { ok: false, reason: "unsupported" | "play_services_unavailable" | "cancelled" |
                          "permission_denied" | "busy" | "too_large" |
                          "invalid_options" | "failed" }
```

Implementación:

- `scanner/ScanDocumentOptions.kt` — parser puro de opciones (modo válido, límites).
- `scanner/ScanResultPayload.kt` — serialización JSON y mapeo de errores.
- `scanner/NativeMlKitDocumentScanner.kt` — `play-services-mlkit-document-scanner`
  **16.0.0** (estable), modo `SCANNER_MODE_FULL`, solo `RESULT_FORMAT_JPEG`;
  decodifica y recomprime cada página (≤2200 px, JPEG 82) antes de responder.
- `scanner/DocumentScannerService.kt` — interfaz del motor.
- `scanner/TaskAwait.kt` — `Task → corrutina` sin dependencias nuevas.
- La captura usa `ActivityResultContracts.StartIntentSenderForResult` y responde por
  `pushBridgeResult` (mismo mecanismo del resto del bridge).
- Fuentes de persistencia: `NativeDocuments.SOURCE_DOCUMENT_SCAN` / `SOURCE_INE_SCAN`
  con `sanitizeExternalSource` (allowlist). Directorios `documentos/` e
  `identificaciones/` (los escaneos no viven en `escritos/`).
- Permisos: `CAMERA` ya estaba declarado; ML Kit gestiona su propio flujo. El permiso
  de cámara web del fallback usa `requestCameraPermission` del bridge.

---

## Pruebas

```bash
npx vitest run src/features/document-scanner src/shared/services/__tests__/scan-document-storage-isolation.test.ts \
  src/features/documentos-personales/__tests__/document-scanner-integration.test.tsx
```

Cobertura funcional: geometría y orden de esquinas, homografía/warp, filtros,
detección sintética de documentos (incluye documentos inclinados y ausencia de papel),
páginas (agregar/eliminar/reordenar/rotar), PDF multipágina, INE (una sola página,
proporciones, márgenes, sin texto), persistencia y aislamiento A/B, flujo nativo
(éxito, cancelación, Play services ausente, fallo), modo copiadora y guardado.

Pruebas JVM Android: `ScanDocumentOptionsTest` y `ScanResultPayloadTest`.

## Limitaciones conocidas

- El ajuste de esquinas y los filtros del flujo nativo requieren volver a capturar
  (ML Kit ya entrega la imagen procesada); el usuario puede cambiar filtro y rotación
  en la revisión, que se aplican en el render final.
- En jsdom no hay canvas real: el pipeline de imagen se cubre con funciones puras y
  pruebas de layout; la verificación visual corresponde a QA en dispositivo.
- iOS no implementa el bridge de documentos nativos; en iOS se usa el flujo web.
