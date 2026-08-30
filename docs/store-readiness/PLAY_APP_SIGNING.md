# Firma de Release y Play App Signing

Documentación de configuración de firma. **Ninguna clave, contraseña o keystore se ha commiteado.**

## Variables de entorno requeridas para firma release

| Variable | Contenido |
|----------|-----------|
| `LAVEINTE_KEYSTORE_BASE64` | El keystore (`.jks`) en Base64, una sola línea. |
| `LAVEINTE_KEYSTORE_PASSWORD` | Contraseña del keystore. |
| `LAVEINTE_KEY_ALIAS` | Alias de la clave de subida. |
| `LAVEINTE_KEY_PASSWORD` | Contraseña de la clave (alias). |

> Configúralas en el entorno CI (GitHub Actions secrets) o en `.env.local` (NO commitear). El
> `build.gradle.kts` lee estas variables y **solo entonces** crea el `signingConfig` release.

## Estructura de firma (Play App Signing)

- **Upload key:** la que firmamos localmente (el keystore de arriba). Es la que se sube a Google Play.
- **App signing key:** la que Google Play genera/administra para firmar el AAB al distribuir. No la tenemos.

### Almacenamiento seguro y recuperación

- Guardar el archivo `.jks` y sus contraseñas en un gestor de secretos (1Password / Vault / encriptado).
- Guardar la **upload key** de forma separada de la app signing key.
- Subir el certificado de la upload key al Play Console una única vez; si se pierde, no se puede
  recuperar la app string key (solo solicitar recuperación de Play App Signing).

### Fingerprints SHA-256 (se incluyen en el reporte sin exponer la clave)

```bash
keytool -list -v -keystore laveinte-release.jks -alias <ALIAS> -storepass <PASS>
# → Copiar "SHA1:" y "SHA-256:" del certificado.
```

## App Links / OAuth redirects

- **SHA-256 del fingerprint** se usa en `assetlinks.json` para Android App Links. Debe generarse.
- **OAuth providers** (Google) requieren la SHA-1 y SHA-256 del fingerprint para el redirect. Se
  calculan del mismo certificado (upload key cuando se usa App Signing, o la key de firma si no).

## Generar el keystore (solo si no existe)

```bash
keytool -genkeypair -v \
  -keystore laveinte-release.jks \
  -alias <ALIAS> \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass <PASS> -keypass <PASS> \
  -dname "CN=La Veinte Digital, OU=Android, O=La Veinte Digital, L=, ST=, C=MX"
```

## Verificar la firma del AAB

```bash
# Con los jarsigner / apksigner (o keytool) tras generar el bundle:
jarsigner -verify -verbose -certs <path>.aab
# o para APK:
"$HOME/Android/sdk/build-tools/36.0.0/apksigner" verify --print-certs <path>.apk
```

## Verificación de que no se commitearon secretos

```bash
git check-ignore android-app/app/build/keystore/laveinte-release.jks   # debe devolver el path (ignorado)
grep -rn "LAVEINTE_KEYSTORE\|storePassword\|keyAlias" android-app --include=*.kts
```
