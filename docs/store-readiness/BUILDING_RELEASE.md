# Building Release (AAB / APK)

Comandos exactos para generar los artefactos de distribución. Parte de `android-app/`.

## Requisitos

- JDK 17
- Android SDK (platforms;android-36 + build-tools;36.0.0)
- Firma release: variables de entorno (ver `PLAY_APP_SIGNING.md`)

## Canales disponibles (product flavors)

| Variante | Canal | Uso | Actualizaciones |
|----------|-------|-----|-----------------|
| `playRelease` | Google Play | Subir AAB a Play Console | Google Play (sin auto-update) |
| `directRelease` | Sideload | Distribución directa | Actualizador propio |
| `*Debug` | Cualquiera | Desarrollo | — |

## Comandos

```bash
# 1) Debug
./gradlew :app:assembleDebug

# 2) Play — AAB (Android App Bundle, requerido por Google Play)
./gradlew :app:bundlePlayRelease

# 3) Play — APK opcional
./gradlew :app:assemblePlayRelease

# 4) Direct — APK con actualizador
./gradlew :app:assembleDirectRelease

# 5) Verificación de política de canal (parte de `check`)
./gradlew :app:validateDistributionPolicyPlayRelease :app:validateDistributionPolicyDirectRelease

# 6) Lint (release habilitado)
./gradlew :app:lintRelease   # o :app:lint
```

## Artefactos de salida

```text
android-app/app/build/outputs/bundle/playRelease/      ← *.aab (subir a Play)
android-app/app/build/outputs/apk/playRelease/         ← *.apk (opcional)
android-app/app/build/outputs/apk/directRelease/       ← *.apk (sideload)
android-app/app/build/outputs/apk/debug/               ← *.apk (dev)
android-app/app/build/outputs/apk/playDebug/           ← *.apk (dev)
```

El nombre se forma así (definido en `build.gradle.kts`):
`LaVeinteDigital-<flavor>-<buildType>-v<versionName>.apk`

## Notas importantes

- **Play** usa **Android App Bundle (`.aab`)**, no APK.
- **Direct** usa **APK** con el actualizador propio.
- La firma release se activa SOLO si existen las variables de entorno de keystore; sin ellas el
  build genera artefactos **sin firmar**. Para subir a Play debe firmarse.
- La versión se controla en `defaultConfig.versionCode` / `versionName` (actual: 198 / 1.0.98).

## Rebumping la versión

```bash
# Editar android-app/app/build.gradle.kts → defaultConfig { versionCode, versionName }
```

## CI (opcional)

Configurar secrets `LAVEINTE_KEYSTORE_BASE64/PASSWORD/KEY_ALIAS/KEY_PASSWORD` en GitHub Actions y
correr `./gradlew :app:bundlePlayRelease`. El keystore no se commitea.
