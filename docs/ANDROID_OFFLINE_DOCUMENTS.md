# Android Offline Documents — Documentos guardados sin conexión

> **La Veinte Digital NO funciona completamente offline.**
>
> El modo offline de Android permite consultar documentos previamente guardados en
> el dispositivo. Las herramientas que requieren servidor continúan necesitando Internet.

Extensión aislada del baseline estable: añade capacidad de consulta offline sin modificar
el comportamiento online existente (web idéntica con Internet; bridge con compatibilidad
hacia atrás; sin migraciones destructivas).

---

## 1. Propósito

Cuando la app Android no tiene acceso real a Internet, el usuario puede seguir entrando a
los documentos que ya están físicamente almacenados en su dispositivo:

- **Tarjetones** (Room + `filesDir`, infraestructura preexistente reutilizada).
- **Checadas / biométricos** (misma Room + `filesDir`, `source = TU_PERFIL_BIOMETRIC`).
- **Escritos guardados** (nueva copia PDF nativa; antes solo vivían en
  localStorage/IndexedDB de la WebView).

Regla de producto: **guardado = disponible sin conexión**.

## 2. Arquitectura

```text
CON INTERNET
Android → InternalWebScreen / WebView → La Veinte Digital (sin modificaciones)

SIN INTERNET (fallo real de navegación)
Android → OfflineErrorScreen [Ver mis documentos] → OfflineDocumentsScreen (Compose)
        → NativeDocuments (Room) → filesDir → PayslipViewerScreen (PdfRenderer local)
```

- No es PWA offline: no se cachean Supabase, sesiones, páginas, APIs ni frontend.
- Una sola fuente de verdad: base Room `laveinte_payslips.db`, tabla `payslip_documents`
  (v4). No se duplican PDFs ni existen dos índices.
- Archivos siempre dentro del almacenamiento privado (`filesDir/...`); compartir solo vía
  `FileProvider` (`<files-path path="."/>` ya lo cubre). `allowBackup=false`: nada viaja a
  backups en la nube.

## 3. Almacenamiento

| Tipo | Dónde está el archivo | Índice | Apertura | Compartir | Eliminar |
|---|---|---|---|---|---|
| Tarjetón | `filesDir/Tarjetones/...` (sesión IMSS) | Room (`TU_PERFIL`/`TARJETON_DIGITAL`) | Visor local | FileProvider | `deleteById` canónico |
| Checadas | `filesDir/Tarjetones/.../biometricos` | Room (`TU_PERFIL_BIOMETRIC`) | Visor local | FileProvider | `deleteById` canónico |
| Escrito | `filesDir/escritos/...` | Room (`ESCRITO`, `externalKey` = id del escrito) | Visor local | FileProvider | `deleteById` / `deleteByExternalKey` |

### Escritos: cierre de persistencia local

La web genera el PDF definitivo (jsPDF institucional) y lo envía a la app por el canal
`laVeintePdfBridge` con acciones `saveStart`/`chunk`/`commit` (mismo protocolo fragmentado
del compartir, con sha256 y validación `%PDF-`). La app persiste en `filesDir/escritos` +
Room con upsert por `(source, externalKey)`: re-guardar no duplica.

Disparadores web (fire-and-forget, solo en `window.LaVeinteApp.isNativeApp()`):

- `EscritosGenerator.handleSaveDraft` → `syncEscritoPdfToNative`.
- `adaptEscritoToViewerDocument` (visor) → `syncEscritoBlobToNative` con el PDF ya generado.
- Borrar escrito (generador y "Mis documentos") → `deleteNativeEscritoCopies`.

Compatibilidad: APKs viejas responden `INVALID_REQUEST` a `saveStart`/`setOwner` sin efectos
(jamás abren la hoja de compartir); web vieja + APK nueva usa `start`/`commit` de compartir
sin cambios. La lista web ignora `source = ESCRITO` (`toNativo` → null) para no duplicar lo
que ya muestra desde localStorage.

## 4. Navegación

- Nueva ruta `offline_documents` (`NavRoute.OfflineDocuments`).
- `OfflineErrorScreen → OfflineDocumentsScreen` vía `onOpenSavedDocuments`; Back de interfaz
  y Back de Android regresan con `popBackStack` (nunca cierran la app).
- Apertura con la ruta `payslip_viewer` existente (visor `PdfRenderer`, sin red).
- `PayslipHistoryScreen` ahora borra por el canónico `deleteById` (antes borraba fila +
  archivo a mano, sin limpiar conceptos ni `PendingPrint`).

## 5. Detección de conectividad (`OfflineDetection` + `NetworkMonitor`)

- Entrada a offline: **solo** error del marco principal clasificado como conectividad
  (`ERROR_UNKNOWN/HOST_LOOKUP/CONNECT/TIMEOUT/IO`). `onReceivedHttpError` jamás dispara
  offline → un HTTP 401/403/404/500 no se confunde con modo avión.
- `NetworkMonitor` (sin polling, `NetworkCallback` + `NET_CAPABILITY_VALIDATED`) distingue
  "red disponible" de "acceso real validado" y alimenta el aviso de recuperación.
- Arranque sin Internet: el overlay offline ya no exige `initialLoadDone`, así que en modo
  avión al abrir la app se llega a "Ver mis documentos" sin depender de la WebView.

## 6. Recuperación online

- `OfflineErrorScreen`: botón "Intentar de nuevo" (recarga la WebView) + píldora discreta
  "Conexión recuperada" cuando el sistema valida Internet.
- `OfflineDocumentsScreen`: banner "Conexión recuperada [Volver a La Veinte Digital]" →
  `popBackStack(internal)` + `OnlineRecovery.requestReload()` (la WebView recarga una vez;
  el flujo online normal no se toca).

## 7. Aislamiento por usuario (Room v4)

Migración `3 → 4` estrictamente aditiva (`ownerId`, `externalKey` NULL por defecto; sin
`fallbackToDestructiveMigration`, sin borrar filas). Política de visibilidad
(`NativeDocuments.isVisibleTo`):

- Sin propietario de sesión conocido → todo visible (comportamiento histórico).
- Con sesión conocida → propios + legacy sin atribuir (NULL).
- Documentos de otro usuario → ocultos.

El propietario lo informa la web (`setOwner` por el canal WebMessage; "Mis documentos" y
generador de escritos) y se limpia al cerrar sesión (**sin borrar documentos**). Los
tarjetones/checadas guardados desde flujos IMSS nativos toman el propietario vigente o NULL.
Los legacy nunca se eliminan ni se reasignan en migración.

## 8. Archivos faltantes/corruptos

`NativeDocuments.pruneMissingFiles()` purga filas cuyo archivo físico ausente (log
`OFFLINE_FILE_MISSING` con id+source, sin rutas ni PII) antes de listar; la UI nunca
intenta abrir rutas inexistentes ("Archivo no disponible" en compartir si aplica).

## 9. Logs (tag `OFFLINE_MODE`, sin PII)

`OFFLINE_MODE_ENTERED`, `OFFLINE_DOCUMENTS_OPENED`, `OFFLINE_FILE_MISSING`,
`NETWORK_RECOVERED` (+ `NETWORK_LOST`), `OFFLINE_DOC_OPENED/SHARED/DELETED/SAVED`
(solo id, source y tamaño). Nunca tokens, rutas completas, PDFs ni contenido.

## 10. Limitaciones actuales

- Solo lectura/consulta: sin sincronización bidireccional ni descarga masiva automática.
- Escritos con anexos/firmas: la copia offline es el PDF final renderizado (no editable).
- La atribución de propietario es best-effort (requiere web autenticada que informe `setOwner`).
- El visor local renderiza PDF; otros formatos no contemplados (todo el corpus es PDF).

## 11. Pruebas

- Android JVM: `OfflineDetectionTest` (clasificación conectividad vs HTTP/archivo, buckets,
  `ownerId`), `NativeDocumentsOfflineTest` (visibilidad por usuario, sanitizado de nombres).
  Suites históricas (`PdfShare*`, `ShareBridgeRegression`, biométricos, navegación) intactas.
- Web: `escrito-native-sync.test.ts` (no-op fuera de native, validaciones previas al envío);
  `native-bridge-compat` y suites de documentos/escritos/transfer en verde.
- Gates ejecutados: `:app:testPlayDebugUnitTest`, `:app:assemblePlayDebug`,
  `:app:assembleDirectDebug`, `npm run typecheck`, `npm run lint` (0 errores),
  `npm test` (full), `npm run build`.

## 12. Archivos

Nuevos: `offline/` (`OfflineDocumentsScreen`, `OfflineDetection`, `NetworkMonitor` +
`OnlineRecovery`, `NativeSessionOwner`, `OfflineLog`), tests `offline/` +
`NativeDocumentsOfflineTest`, `services/escrito-native-sync.ts` (+ test).
Modificados (delta mínimo): `PayslipDatabase` (v4), `NativeDocuments`, `PdfShareManager`
(modo SAVE + `setOwner`), `LaVeinteInternalWebViewClient`, `InternalWebScreen`,
`OfflineErrorScreen`, `AppNavHost`, `NavRoute`, `LaVeinteApplication`,
`PayslipHistoryScreen` (borrado canónico), `build.gradle.kts` (1.1.6/206),
`pdfShareBridge.ts` (`savePdfToNativeDocs`, `setNativeDocsOwner`),
`escrito-native-sync` hooks (`EscritosGenerator`, `document-viewer-adapter`,
`DocumentosPersonales`), tipos (`global.d.ts`, `documents.ts`).
