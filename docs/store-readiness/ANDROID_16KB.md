# Compatibilidad 16 KB Page Size

Verificación de compatibilidad de La Veinte Digital con dispositivos Android que usan páginas de
memoria de 16 KB (64-bit, requerido por Google Play para apps publicadas a partir de finales de 2025).

## Librerías nativas (`*.so`) empaquetadas

La app no incorpora librerías nativas propias. Las únicas `.so` que llegan en el APK/AAB son
transitivas de AndroidX:

```
libandroidx.graphics.path.so   (androidx.graphics)
libdatastore_shared_counter.so (androidx.datastore)
```

Estas librerías provienen de repos de AndroidX, que ya están alineadas/compiladas para 16 KB en las
versiones usadas. De todas formas, se documenta la verificación.

## Comandos de verificación

### Con `zipalign` (Android SDK build-tools) sobre el APK final

```bash
SDK=~/Android/sdk
# Nombre exacto del APK release (channel direct/play; ajusta la ruta)
APK=android-app/app/build/outputs/apk/...(carpeta de salida)
"$SDK/build-tools/36.0.0/zipalign" -c -P 16 -v 4 "$APK"
# Si sale "Verification succesful", todas las .so están alineadas a 16 KB.
```

### Inspección ELF (por si hay `.so` con alineación menor)

```bash
# Para cada .so del APK:
unzip -o "$APK" 'lib/*/*.so'
for so in $(find . -name '*.so'); do
  echo "== $so =="
  readelf -l "$so" | grep -E 'LOAD' | awk '{ print $5 }'   # p_align debe ser >= 0x4000 (16384)
done
```

Un segmento con `p_align = 0x4000` (16384) o mayor es compatible con 16 KB; `0x1000` (4096) NO lo es.

## Resultado

**Verificado sobre el APK de release:**

```
SDK=~/Android/sdk
APK=android-app/app/build/outputs/apk/direct/release/LaVeinteDigital-direct-release-v1.0.98.apk
"$SDK/build-tools/36.0.0/zipalign" -c -P 16 -v 4 "$APK"
→ Verification successful
```

**`zipalign -c -P 16` devuelve `Verification successful`** → todas las entradas (incluidas las `.so`
de AndroidX) están alineadas a 16 KB. La app es compatible con dispositivos Android que usan páginas
de memoria de 16 KB.

## Observaciones

- Al empaquetar, Gradle reporta `Unable to strip the following libraries: libandroidx.graphics.path.so,
  libdatastore_shared_counter.so`. Esto es un aviso de *stripping* de símbolos, no de alineación; no
  afecta la compatibilidad de 16 KB.
- No hay archivos `.so` propios de la app, por lo que no hay riesgo de incompatibilidad de origen propio.
