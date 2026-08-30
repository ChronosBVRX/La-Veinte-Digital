# Backups y Datos Sensibles (Threat Model)

Decisión de respaldo de La Veinte Digital para Android, con el modelo de amenaza subyacente.

## Decisión adoptada

**`android:allowBackup = "false"`.**

El respaldo en la nube y la transferencia dispositivo-a-dispositivo están **deshabilitados** para toda
la app. Se eliminaron las referencias a `backup_rules.xml` y `data_extraction_rules.xml` del
`<application>`, y ambos archivos se reescribieron para **excluir todo** (por si se re-habilita en el
futuro, el default no se vuelve a "incluir todo").

## Por qué

La app almacena datos que **no deben** viajar a un backup en la nube ni a otro dispositivo:

| Dato | Ubicación | Riesgo de respaldarlo |
|------|-----------|-----------------------|
| Credenciales IMSS | DataStore `laveinte_imss_vault` (cifrado AES-GCM) | El cifrado depende de una clave AndroidKeyStore **no exportable**. Respaldar el ciphertext a otro dispositivo produce datos indescifrables (rompe el KeyStore) y, además, es un secreto que no debe salir. |
| Cookies WebView (sesión Supabase + sesión IMSS) | `app_webview` | Son cookies de autenticación; copiarlas a otro dispositivo permite un login fantasma. |
| Documentos / PDFs laborales | `filesDir/tarjetones`, downloads, Room | Contenido laboral sensible; no debe duplicarse en infraestructura de backup. |
| Metadatos de tarjetones / nómina | Room DB (`laveinte_imss`, etc.) | Datos laborales. |
| Token FCM | SharedPreferences `la_veinte_prefs.xml` | Identificador de dispositivo; respaldarlo a otro dispositivo asocia un push token a un dispositivo ajeno. |
| Biometría / bloqueo | DataStore `la_veinte_biometric` | No es transferible entre dispositivos (el material biométrico vive en el TEE). |

`profiles` y demás datos remotos no son relevantes para el backup de la app: viven en **Supabase**.

## Modelo de amenaza

Se asume que:

- El custodiado de respaldo en la nube (Google) y la transferencia a otro dispositivo son externos al
  control de la app.
- Un adversario con acceso a un respaldo (o a otro dispositivo tras la transferencia) podría acceder a
  cualquier dato que la app respalde.
- Los datos que la app maneja (credenciales IMSS, documentos laborales, sesiones) son de alto valor y
  sensibilidad → el costo de perder los datos locales al reinstalar es **menor** que el riesgo de
  filtrarlos.

Por ello, la decisión es **no respaldar nada**. Si el usuario reinstala la app, deberá volver a
iniciar sesión, y las credenciales IMSS guardadas de forma local se pierden (la clave Keystore nunca
se respalda).

## Alternativas descartadas

1. **Allowlist restringida** (solo una prefs inocua): se descartó porque el beneficio (conservar una
   preferencia menor) es bajo frente al riesgo de que una adición futura al backup re-exponga datos
   sensibles por error.
2. **Backup cifrado por clave Keystore**: Android no permite respaldar la clave Keystore; respaldar
   ciphertext sin la clave es inútil y engañoso.

## Cómo verificarlo

```bash
grep -o 'android:allowBackup="[a-z]*"' \
  android-app/app/build/intermediates/merged_manifests/playRelease/processPlayReleaseManifest/AndroidManifest.xml
# → android:allowBackup="false"
```

> Índice local: el flujo /imss y el fallback SAPI que se mencionan en AGENTS.md NO cambian esta
> decisión: la app no respalda nada, con o sin actualizador propio.
