# Matriz de Permisos (Principio de Mínimo Privilegio)

Análisis de cada permiso Android declarado por La Veinte Digital, con su necesidad real, API de
origen y decisión. Se documenta el estado **final** (tras la auditoría), con la referencia del
estado inicial cuando cambió.

## Permisos en el manifest merged — tabla resumen

| Permiso | ¿Se declara? | Uso real | Runtime? | API | Cuándo se solicita | Decisión |
|---------|--------------|----------|----------|-----|--------------------|----------|
| `INTERNET` | ✅ | Carga del WebView, Supabase, FCM, manifiesto de actualización | No | − | Siempre | Mantener |
| `ACCESS_NETWORK_STATE` | ✅ | Detección offline (OfflineErrorScreen) | No | − | Siempre | Mantener |
| `POST_NOTIFICATIONS` | ✅ | Avisos FCM (LaVeinteNotificationManager) | Sí | 33 | Tras el bootloader (`PermissionCoordinator.maybeRequestNotifications`) | Mantener |
| `CAMERA` | ✅ | Escaneo QR / captura (WebView `getUserMedia`) | Sí | 23 | Solo al entrar a la función de cámara | Mantener |
| `USE_BIOMETRIC` | ✅ | Bloqueo de app y desbloqueo de credenciales IMSS | No | 28 | — | Transitiva (androidx.biometric) |
| `USE_FINGERPRINT` | ✅ | Fallback | No | 23 | — | Transitiva (androidx.biometric) |
| `WAKE_LOCK` | ✅ | Firebase Messaging entrega | No | 3 | — | Transitiva (Firebase) |
| `BIND_JOB_SERVICE` | ✅ | Firebase DataTransport scheduler | No | 21 | — | Transitiva (Firebase) |
| `DUMP` | ✅ | `adb dumpsys` | No | 3 | — | Solo en **debug** (AGP la añade en builds debuggables; ausente en release) |
| `READ_EXTERNAL_STORAGE` | ❌ eliminado | — | — | ≤32 | — | **Eliminado** (nada de código lo usa) |
| `READ_MEDIA_DOCUMENTS` | ❌ eliminado | — | — | — | — | **Eliminado** (permiso no estándar, sin uso) |
| `WRITE_EXTERNAL_STORAGE` | ❌ eliminado | — | — | ≤28 | — | **Eliminado** (muerto; minSdk 29) |
| `REQUEST_INSTALL_PACKAGES` | ⚠️ `direct` SOLO | Instalación de APK del actualizador | Sí | 26 | Al instalar actualización | **Prohibido en `play`**; solo en `direct` |

## Detalle por permiso

### Cámara (`CAMERA`)

- **Dónde se usa:** WebView interno (escaneo QR, captura de documentos) vía `onPermissionRequest`
  y el bridge `requestCameraPermission`.
- **Flujo de solicitud:** el *web* dispara `requestCameraPermission` solo cuando el usuario entra a la
  función de cámara; el Android resuelve con `PermissionCoordinator.cameraState()` →
  `GRANTED` / `SHOW_REQUEST` / `PERMANENTLY_DENIED`. Solamente en `SHOW_REQUEST` se lanza el diálogo
  del sistema. **No se pide en el arranque de la app.**
- **Estado:** correcto. `NEW_PERMISSION` solo bajo acción explícita del usuario.

### Notificaciones (`POST_NOTIFICATIONS`)

- **Dónde se usa:** `LaVeinteNotificationManager.notify()` (avisos, agenda, documentos, descargas).
- **Flujo:** `PermissionCoordinator.maybeRequestNotifications()` se llama una sola vez tras el
  bootloader. Si el usuario lo deniega, el "activity" continúa sin bloquear. El canal se crea igualmente
  (para que si el usuario lo habilita después, funcione). Si se deniega permanentemente, se muestra la
  ruta "Abrir ajustes" desde el bridge.
- **Estado:** correcto. No bloquea el uso de la app si el usuario responde NO.

### Almacenamiento (todos eliminados)

- **Descargas:** `LaVeinteDownloadListener` usa `DownloadManager` con
  `setDestinationInExternalFilesDir` (carpeta privada de la app) → **no requiere permiso** en API 29+.
- **Selector de PDF/documentos:** el WebView lanza un `FileChooser` del sistema (Storage Access
  Framework / `ACTION_GET_CONTENT`) → acceso efímero por URI, **sin permisos de almacenamiento**.
- **Documentos nativos:** se guardan en `filesDir` (privado de la app) → no requiere permiso.
- **Conclusión:** los tres permisos legacy eran innecesarios y se eliminaron.

### REQUEST_INSTALL_PACKAGES

- **`playRelease`:** **AUSENTE** del manifest merged (verificado). El actualizador/instalador no está
  compilado en el APK de Play.
- **`directRelease`:** **PRESENTE** (imprescindible) para el actualizador auto. Únicamente cuando el
  usuario acepta instalar una actualización se abre el permiso. Es un canal de sideload fuera de Play.
- **Cumplimiento:** documentado en `GOOGLE_PLAY_DATA_SAFETY.md` y verificado por la tarea Gradle
  `validateDistributionPolicy*`.

## Cómo inspeccionar el manifest merged

```bash
# Play (debe NO contener REQUEST_INSTALL_PACKAGES ni UpdateInstallReceiver):
grep -E "REQUEST_INSTALL_PACKAGES|UpdateInstallReceiver" \
  android-app/app/build/intermediates/merged_manifests/playRelease/processPlayReleaseManifest/AndroidManifest.xml

# Direct (debe contener ambos):
grep -E "REQUEST_INSTALL_PACKAGES|UpdateInstallReceiver" \
  android-app/app/build/intermediates/merged_manifests/directRelease/processDirectReleaseManifest/AndroidManifest.xml
```

La tarea de verificación automática (parte de `./gradlew check`) es:

```bash
./gradlew :app:validateDistributionPolicyPlayRelease :app:validateDistributionPolicyDirectRelease
```

## Decisiones tomadas

- Mantener únicamente los permisos con uso real: `INTERNET`, `ACCESS_NETWORK_STATE`,
  `POST_NOTIFICATIONS`, `CAMERA` (+ transitivos).
- Eliminar permisos de storage legacy sin uso.
- `REQUEST_INSTALL_PACKAGES` migrado a `src/direct` exclusivamente.
